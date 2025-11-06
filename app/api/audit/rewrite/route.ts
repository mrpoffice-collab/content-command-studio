import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { performFactCheck } from '@/lib/fact-check';
import { calculateAISOScore } from '@/lib/content-scoring';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/**
 * POST /api/audit/rewrite
 * Rewrite content to improve quality scores
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await db.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { originalContent, auditReport } = body;

    if (!originalContent) {
      return NextResponse.json(
        { error: 'Original content is required' },
        { status: 400 }
      );
    }

    console.log('Rewriting content to improve AISO quality...');

    const MINIMUM_AISO_SCORE = 90; // Aim for 90+ for high quality
    const MAX_ITERATIONS = 5; // Try up to 5 rewrites for maximum improvement

    let currentContent = originalContent;
    let currentScore = auditReport.aisoScore || auditReport.overallScore;
    let iteration = 0;
    let bestContent = originalContent;
    let bestScore = currentScore;

    while (currentScore < MINIMUM_AISO_SCORE && iteration < MAX_ITERATIONS) {
      iteration++;
      console.log(`Rewrite iteration ${iteration}/${MAX_ITERATIONS}...`);

      // Identify problematic claims from audit
      const problematicClaims = auditReport.factChecks
        ?.filter((fc: any) => fc.status === 'unverified' || fc.status === 'uncertain')
        .map((fc: any) => fc.claim) || [];

      // Calculate what needs improvement
      const factCheckScore = auditReport.factCheckScore || 0;
      const aeoScore = auditReport.aeoScore || 0;
      const seoScore = auditReport.seoScore || 0;
      const readabilityScore = auditReport.readabilityScore || 0;
      const engagementScore = auditReport.engagementScore || 0;

      // Get current date for content freshness
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });

      // Create AISO-focused improvement prompt with iteration-specific guidance
      const prompt = `You are a professional content editor improving blog post quality for AISO (AI Search Optimization). Your goal is to achieve 90%+ AISO score.

**IMPORTANT CONTEXT - CURRENT DATE:**
- **Today's Date:** ${currentMonth} ${currentYear}
- **CRITICAL:** Update ALL year references to ${currentYear} or later (remove ${currentYear - 1}, ${currentYear - 2}, etc.)
- **Use current/timeless language:** "In ${currentYear}...", "Modern approaches...", "Current best practices..."
- **Outdated content kills engagement!** Make content feel fresh and current.

**Iteration ${iteration}/${MAX_ITERATIONS} - Current AISO Score**: ${currentScore}/100 (Target: 90+)

${iteration > 1 ? `**Progress**: Started at ${auditReport.aisoScore || auditReport.overallScore}/100, now at ${currentScore}/100. ${currentScore > (auditReport.aisoScore || auditReport.overallScore) ? 'Improving! Keep pushing.' : 'Score dropped. Focus on quality over changes.'}` : ''}

**Current Content:**
${currentContent}

**DETAILED SCORING BREAKDOWN:**
- 🎯 Fact-Check: ${factCheckScore}/100 (30% weight) ${factCheckScore < 80 ? '⚠️ NEEDS MAJOR WORK!' : factCheckScore < 90 ? '⚠️ Room for improvement' : '✅ Good'}
- 🤖 AEO (SGE): ${aeoScore}/100 (25% weight) ${aeoScore < 70 ? '⚠️ CRITICAL - Missing FAQ/Direct Answer!' : aeoScore < 85 ? '⚠️ Add more structure' : '✅ Good'}
- 📊 SEO: ${seoScore}/100 (15% weight) ${seoScore < 70 ? '⚠️ Poor structure/keywords' : seoScore < 85 ? '⚠️ Improve headers/links' : '✅ Good'}
- 📖 Readability: ${readabilityScore}/100 (15% weight) ${readabilityScore < 70 ? '⚠️ Too complex' : readabilityScore < 85 ? '⚠️ Simplify sentences' : '✅ Good'}
- 🎯 Engagement: ${engagementScore}/100 (15% weight) ${engagementScore < 70 ? '⚠️ Missing hooks/CTAs' : engagementScore < 85 ? '⚠️ Add more variety' : '✅ Good'}
- Unverified claims: ${auditReport.unverifiedClaims || 0} ${auditReport.unverifiedClaims > 0 ? '⚠️ MUST FIX!' : '✅'}

${problematicClaims.length > 0 ? `**PROBLEMATIC CLAIMS TO FIX (CRITICAL):**
${problematicClaims.map((claim: string, i: number) => `${i + 1}. "${claim}" - REMOVE or add "typically", "often", "can", "may"`).join('\n')}` : ''}

**AGGRESSIVE REWRITE INSTRUCTIONS FOR ITERATION ${iteration}:**

${factCheckScore < 80 ? `
🔥 **PRIORITY 1: FIX FACT-CHECK (Currently ${factCheckScore}/100 - 30% of total score!)**
   - REMOVE EVERY UNVERIFIABLE CLAIM - This is killing your score!
   - NEVER say: "studies show", "research indicates", "experts say", "X% of companies"
   - ALWAYS use: "often", "typically", "can help", "may improve", "common approach"
   - Focus on PROCESS and HOW-TO, NOT outcome promises
   - Replace statistics with general knowledge: "Many businesses find..." instead of "95% see results"
` : ''}

${aeoScore < 85 ? `
🔥 **PRIORITY 2: BOOST AEO/SGE (Currently ${aeoScore}/100 - 25% of total score!)**
   ${aeoScore < 70 ? `- ADD FAQ SECTION (MANDATORY!) - EXACT FORMAT REQUIRED:
     ## Frequently Asked Questions

     ### Question: What is [topic]?
     Answer paragraph here (2-3 sentences).

     ### Question: How do I [task]?
     Answer paragraph here (2-3 sentences).

     (Add 6-8 total Q&A pairs in this EXACT format!)` : '- IMPROVE FAQ SECTION - Ensure it uses "### Question:" format for each Q&A'}
   - FIRST PARAGRAPH: Start with "The answer is..." or "Simply put..." or "Here's what you need to know..."
   - Make first paragraph quotable: 2-3 sentences, direct, authoritative
   - Add "## Key Takeaways" section with bullet points (at least 5 bullets)
   - Define terms explicitly: "X is defined as..." or "X refers to..." (at least 2 definitions)
   - Add numbered steps for HOW-TO process: "Step 1:", "Step 2:", etc. (at least 3 steps)
   - Include a comparison table if relevant (markdown table format with | pipes |)
` : ''}

${seoScore < 85 ? `
🔥 **IMPROVE SEO (Currently ${seoScore}/100 - 15% of total score!)**
   - Add 2+ more H2 headers (## Header)
   - Add 3+ more H3 subheaders (### Subheader)
   - Include internal link opportunities: "Learn more about [topic]", "Related: [topic]"
   - Ensure keyword in first paragraph, one H2, and conclusion
   - Add images references: ![Alt text](image-url)
` : ''}

${readabilityScore < 85 ? `
🔥 **IMPROVE READABILITY (Currently ${readabilityScore}/100 - 15% of total score!)**
   - Break up long sentences (keep under 20 words)
   - Use shorter paragraphs (3-5 sentences max)
   - Add transition words: "However", "Additionally", "For example"
   - Simplify complex words: "use" not "utilize", "help" not "facilitate"
` : ''}

${engagementScore < 85 ? `
🔥 **IMPROVE ENGAGEMENT (Currently ${engagementScore}/100 - 15% of total score!)**
   - Start with a question or hook: "Did you know...?", "What if...?"
   - Add call-to-action at end: "Ready to...", "Start by...", "Try..."
   - Use bold text for **key points**
   - Add more bullet points and numbered lists
   - Include a quote or blockquote (> Quote text)
   - CRITICAL: Replace outdated year references (${currentYear - 1}, ${currentYear - 2}) with ${currentYear} or timeless language
` : ''}

**CRITICAL REQUIREMENTS - MUST HAVE ALL TO SCORE 90+:**
✅ First paragraph starts with "The answer is..." or "Simply put..." or "Here's what you need to know..."
✅ "## Frequently Asked Questions" section with 6-8 Q&A pairs using "### Question:" format
✅ "## Key Takeaways" section with 5+ bullet points
✅ At least 2 definitions using "X is defined as..." or "X refers to..."
✅ Numbered steps (Step 1:, Step 2:, Step 3:) for any process/how-to content
✅ At least 5 internal link opportunities: "[Learn more about X]" or "[Related: X]"
✅ At least 1 data table in markdown format (| Header 1 | Header 2 |) if comparing options
✅ 6+ H2 headers (##) and 4+ H3 subheaders (###)
✅ Bold **key terms** throughout (10+ bold phrases)
✅ 5+ bullet points and 3+ numbered list items
✅ Call-to-action in last paragraph: "Ready to...", "Start by...", "Try..."
✅ NO unverifiable statistics without qualifiers ("often", "typically", "can help")

**OPTIMIZATION FOR AI ANSWER ENGINES:**
- Google SGE: First paragraph must be quotable summary
- ChatGPT: FAQ section provides direct answers
- Perplexity: Statistics must be qualified ("typically", "often")
- Bing Copilot: Clear definitions and structured content

**OUTPUT FORMAT:**
Return ONLY the rewritten content in markdown format. No explanations. Just the improved blog post that scores 90+.`;

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const rewrittenContent = message.content[0].type === 'text'
        ? message.content[0].text
        : currentContent;

      console.log('Scoring rewritten content with AISO...');

      // Fact-check the rewritten content
      const factCheckResult = await performFactCheck(rewrittenContent);

      // Calculate full AISO score
      const aisoScores = calculateAISOScore(
        rewrittenContent,
        auditReport.title,
        auditReport.metaDescription,
        factCheckResult.overallScore
      );

      const newAisoScore = aisoScores.aisoScore || aisoScores.overallScore;

      console.log(`AISO improvement attempt ${iteration}: ${currentScore} → ${newAisoScore}`);

      // Track best result
      if (newAisoScore > bestScore) {
        bestScore = newAisoScore;
        bestContent = rewrittenContent;
      }

      // Update current for next iteration
      currentContent = rewrittenContent;
      currentScore = newAisoScore;

      // If we hit the target, break early
      if (currentScore >= MINIMUM_AISO_SCORE) {
        console.log(`✅ Target AISO score achieved: ${currentScore}/100`);
        break;
      }
    }

    // Log usage
    const estimatedCost = 0.15 * iteration; // $0.15 per iteration (includes fact-checking)
    await db.logUsage({
      user_id: user.id,
      operation_type: 'content_rewrite',
      cost_usd: estimatedCost,
      tokens_used: 8000 * iteration,
      metadata: {
        original_score: auditReport.aisoScore || auditReport.overallScore,
        final_score: bestScore,
        improvement: bestScore - (auditReport.aisoScore || auditReport.overallScore),
        iterations: iteration,
        content_length: bestContent.length,
      },
    });

    // Calculate final scores for the best content
    const finalFactCheck = await performFactCheck(bestContent);
    const finalAisoScores = calculateAISOScore(
      bestContent,
      auditReport.title,
      auditReport.metaDescription,
      finalFactCheck.overallScore
    );

    return NextResponse.json({
      success: true,
      improvedContent: bestContent,
      originalScore: auditReport.aisoScore || auditReport.overallScore,
      newScore: bestScore,
      improvement: bestScore - (auditReport.aisoScore || auditReport.overallScore),
      iterations: iteration,
      factCheckScore: finalFactCheck.overallScore,
      aeoScore: finalAisoScores.aeoScore,
      seoScore: finalAisoScores.seoScore,
      scoreBreakdown: [
        {
          category: 'AISO Score',
          before: auditReport.aisoScore || auditReport.overallScore,
          after: bestScore,
          improvement: bestScore - (auditReport.aisoScore || auditReport.overallScore)
        },
        {
          category: 'Fact-Check (30%)',
          before: auditReport.factCheckScore || 0,
          after: finalFactCheck.overallScore,
          improvement: finalFactCheck.overallScore - (auditReport.factCheckScore || 0)
        },
        {
          category: 'AEO (25%)',
          before: auditReport.aeoScore || 0,
          after: finalAisoScores.aeoScore,
          improvement: finalAisoScores.aeoScore - (auditReport.aeoScore || 0)
        },
        {
          category: 'SEO (15%)',
          before: auditReport.seoScore,
          after: finalAisoScores.seoScore,
          improvement: finalAisoScores.seoScore - auditReport.seoScore
        }
      ],
      newFactCheckSummary: {
        overallScore: finalFactCheck.overallScore,
        totalClaims: finalFactCheck.totalClaims,
        verifiedClaims: finalFactCheck.verifiedClaims,
        uncertainClaims: finalFactCheck.uncertainClaims,
        unverifiedClaims: finalFactCheck.unverifiedClaims,
      },
    });
  } catch (error: any) {
    console.error('Rewrite error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to rewrite content' },
      { status: 500 }
    );
  }
}
