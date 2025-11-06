import Anthropic from '@anthropic-ai/sdk';
import { calculateAISOScore, ContentScores } from './content-scoring';
import { performFactCheck } from './fact-check';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export interface ContentGenerationInput {
  title: string;
  keyword: string;
  outline: string[];
  targetAudience: string;
  brandVoice: string;
  wordCount: number;
  seoIntent: string;
}

export interface GeneratedContent {
  title: string;
  metaDescription: string;
  content: string;
  wordCount: number;
}

export interface FivePassResult {
  success: boolean;
  content: string;
  title: string;
  metaDescription: string;
  finalScore: number;
  scores: ContentScores;
  passResults: {
    pass: number;
    name: string;
    scoreBefore: number;
    scoreAfter: number;
    improvement: number;
  }[];
  error?: string;
  topicRejection?: boolean;
}

export interface SinglePassResult {
  success: boolean;
  content: string;
  scoreBefore: number;
  scoreAfter: number;
  improvement: number;
  categoryScores: {
    before: ContentScores;
    after: ContentScores;
  };
  passName: string;
}

export async function generateBlogPost(
  input: ContentGenerationInput,
  researchData?: {
    statistics: string[];
    caseStudies: string[];
    recentTrends: string[];
  },
  targetFleschScore?: number,
  internalLinks?: Array<{ url: string; title: string; meta_description: string }>
): Promise<GeneratedContent> {
  const researchContext = researchData ? `

**RESEARCH DATA (Use these to make content unique and data-backed):**

Recent Statistics:
${researchData.statistics.map((stat, i) => `${i + 1}. ${stat}`).join('\n')}

Case Studies & Examples:
${researchData.caseStudies.map((study, i) => `${i + 1}. ${study}`).join('\n')}

Current Trends:
${researchData.recentTrends.map((trend, i) => `${i + 1}. ${trend}`).join('\n')}
` : '';

  const internalLinksContext = internalLinks && internalLinks.length > 0 ? `

**INTERNAL LINKS - REQUIRED:**
You MUST incorporate 2-4 of these links naturally within the content body. These are authoritative pages from the client's website that provide additional value to readers.

${internalLinks.map((link, i) => `${i + 1}. [${link.title}](${link.url})
   Context: ${link.meta_description || 'Related page'}`).join('\n')}

CRITICAL INSTRUCTIONS:
- Include AT LEAST 2 of these links in the article body
- Use contextually relevant anchor text (not "click here" or "learn more")
- Link naturally where the topic relates to the linked page
- Example: "Many families create [digital memorial pages](URL) to preserve memories"
` : '';

  // Image placeholder instructions (images will be added during WordPress export)
  const imagesContext = `

**IMAGE PLACEHOLDERS:**
Include 2-4 image placeholder suggestions at strategic points in the article. Use this format:

[IMAGE PLACEHOLDER: Description of ideal image]
Example: [IMAGE PLACEHOLDER: Photo of a family reviewing old photos together]

PLACEMENT GUIDELINES:
- Place after major section headers to break up text
- Suggest images that illustrate key concepts
- Use descriptive text that helps identify relevant stock photos later
- Place between paragraphs for visual rhythm
`;

  // Get current date for context
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });

  // Determine reading level description and sentence targets
  const readingLevel = targetFleschScore
    ? targetFleschScore >= 70 ? '7th grade (very accessible for general public)'
      : targetFleschScore >= 60 ? '8th-9th grade (standard readability)'
      : targetFleschScore >= 50 ? '10th grade (educated adults)'
      : targetFleschScore >= 40 ? 'College level (professional audience)'
      : 'Graduate level (technical experts)'
    : '10th grade (educated adults - default)';

  const targetSentenceLength = targetFleschScore
    ? targetFleschScore >= 70 ? '10-12 words'
      : targetFleschScore >= 60 ? '12-15 words'
      : targetFleschScore >= 50 ? '15-18 words'
      : '15-20 words'
    : '15-18 words';

  const prompt = `You are an expert content writer specializing in creating content optimized for AI Search Engines (AISO Stack: AEO + GEO + SEO). Your mission is to write content that is QUOTABLE by AI answer engines like ChatGPT, Perplexity, Google SGE, and Bing Copilot, while maintaining a fresh, authoritative, and distinctly human voice.

${targetFleschScore ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  CRITICAL REQUIREMENT #1: TARGET READING LEVEL (HIGHEST PRIORITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**TARGET:** ${readingLevel} (Flesch Reading Ease Score ${targetFleschScore})

**YOU MUST WRITE AT THIS EXACT READING LEVEL FROM THE START.**

**Sentence Requirements:**
- Average sentence length: ${targetSentenceLength}
- Mix of short and medium sentences
- Avoid long, complex sentences with multiple clauses

**Vocabulary Requirements:**
${targetFleschScore >= 70 ? `- Use ONLY everyday vocabulary (7th grade level)
- NO technical jargon or industry terms
- NO words longer than 3 syllables unless absolutely necessary
- Examples: "use" not "utilize", "help" not "facilitate", "show" not "demonstrate"` :
targetFleschScore >= 60 ? `- Use simple, clear vocabulary (8th-9th grade)
- Minimal technical terms - explain if used
- Prefer common words over formal ones
- Example: "start" over "commence", "end" over "terminate"` :
targetFleschScore >= 50 ? `- Use educated adult vocabulary (10th grade)
- Industry terms OK if explained clearly
- Balance professional and accessible language
- Example: "implement" OK, "operationalize" too complex` :
`- Professional vocabulary acceptable (college level)
- Technical terms appropriate for expert audience`}

**Structure Requirements:**
- Use active voice (not passive)
- Break complex ideas into simple statements
- One idea per sentence
- Short paragraphs (2-4 sentences)

⚠️  THIS READING LEVEL REQUIREMENT OVERRIDES ALL OTHER CONSIDERATIONS.
If you must choose between AEO optimization and readability → CHOOSE READABILITY.
If you must choose between sophisticated vocabulary and simplicity → CHOOSE SIMPLICITY.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}

**IMPORTANT CONTEXT - CURRENT DATE:**
- **Today's Date:** ${currentMonth} ${currentYear}
- **Write for the CURRENT year (${currentYear}) or FUTURE years only**
- **NEVER reference past years (${currentYear - 1}, ${currentYear - 2}, etc.) unless discussing historical context**
- Examples of correct usage:
  ✅ "In ${currentYear}, businesses are focusing on..."
  ✅ "Looking ahead to ${currentYear + 1}..."
  ✅ "Best practices for ${currentYear} include..."
  ✅ "Modern approaches" or "Current strategies" (timeless)
  ❌ "In ${currentYear - 1}, companies discovered..." (sounds outdated!)
  ❌ "${currentYear - 2} trends show..." (too old!)

**Title:** ${input.title}
**Target Keyword:** ${input.keyword}
**SEO Intent:** ${input.seoIntent}
**Target Word Count:** ${input.wordCount} words
**Target Audience:** ${input.targetAudience}
**Brand Voice:** ${input.brandVoice}

**Outline to follow:**
${input.outline.map((section, i) => `${i + 1}. ${section}`).join('\n')}
${researchContext}
${internalLinksContext}
${imagesContext}

**FACT-CHECKING & VERIFICATION REQUIREMENTS - CRITICAL FOR QUALITY:**

⚠️ **This content MUST score 75%+ on automated fact-checking. Follow these rules:**

1. **ONLY Include Verifiable Claims**:
   - If citing statistics, they MUST be from the research data provided or general knowledge
   - DO NOT invent statistics like "95% of companies see results" unless you have the source
   - DO NOT make specific numerical claims without evidence
   - Replace unverifiable claims with general industry knowledge

2. **Avoid Risky Claim Patterns**:
   ❌ "Studies show X% increase..." (unless from research data)
   ❌ "Research indicates that..." (without specific source)
   ❌ "Experts estimate..." (vague authority)
   ❌ "Companies see up to X% improvement..." (unverifiable)
   ✅ "Industry best practices suggest..." (general knowledge)
   ✅ "Common approaches include..." (safe generalization)
   ✅ "Many organizations have found success by..." (qualitative)

3. **Use Research Data Strategically**:
   - When research data is provided, cite it explicitly
   - Example: "According to recent industry data, [specific finding]"
   - This will score as VERIFIED in fact-checking

4. **Write Defensively**:
   - Use qualifiers: "often," "typically," "can," "may," "some"
   - Focus on HOW-TO and PROCESS rather than RESULTS claims
   - Share expertise and methodology, not unverified outcomes

**AEO (ANSWER ENGINE OPTIMIZATION) REQUIREMENTS:**

${targetFleschScore && targetFleschScore >= 50 ? `⚠️ **CRITICAL:** All AEO content MUST be written in SIMPLE, CONVERSATIONAL language (Flesch ${targetFleschScore}).

**WRITING STYLE FOR THIS READING LEVEL:**
- Write like you're talking to a friend, not writing a textbook
- Use "you" and "your" - make it personal
- Short sentences (${targetSentenceLength})
- Simple everyday words only
- NO formal phrases: "is defined as", "refers to", "constitutes", "facilitate"
- YES conversational: "is", "means", "helps", "use", "do"

` : targetFleschScore ? `⚠️ **CRITICAL:** All AEO content MUST match the target reading level (Flesch ${targetFleschScore}).

` : ''}1. **Answer-First Structure** (30 points):
   ${targetFleschScore && targetFleschScore >= 50 ? `- ✅ Start the FIRST PARAGRAPH with a simple, direct answer
   - ✅ Use phrases like: "Here's what you need to know...", "The simple answer is...", "It works like this..."
   - ✅ Write 2-3 short sentences (${targetSentenceLength} each)
   - ✅ Use everyday words, avoid fancy vocabulary
   - ✅ Make it quotable by keeping it simple and clear` : `- ✅ Start the FIRST PARAGRAPH with: "The answer is...", "Simply put...", or "Here's what you need to know..."
   - ✅ Make the answer quotable (2-3 sentences, concise, authoritative)
   - ✅ AI engines must be able to extract this as a featured answer`}

2. **Citation-Worthy Content** (25 points):
   ${targetFleschScore && targetFleschScore >= 50 ? `- ✅ Share stats in plain language: "Studies show X% of people..."
   - ✅ Keep sentences short when citing data
   - ✅ Use simple words to introduce facts: "Research shows...", "Data tells us..."
   - ✅ Bold key numbers for easy scanning
   - ✅ Use comparison tables (markdown format with | pipes |) - keep labels simple` : `- ✅ Include statistics with context: "According to [source], X% of businesses..."
   - ✅ Create quotable insights in standalone sentences
   - ✅ Use data tables when comparing options (markdown table format with | pipes |)
   - ✅ Bold key facts for AI extraction`}

3. **FAQ Section** (20 points) - MANDATORY FORMAT:

   ## Frequently Asked Questions

   ${targetFleschScore && targetFleschScore >= 50 ? `### Question: What is [topic]?
   Answer in 2-3 SHORT sentences. Use simple words. Write like you're explaining to a friend. Example: "A digital memorial is an online page that honors someone. You can add photos and stories. Family and friends can visit anytime."

   ### Question: How do I [task]?
   Answer in 2-3 SHORT sentences. Use everyday language. Give clear, simple steps. Example: "You start by picking a platform. Then you add photos. Finally, you share the link."

   ### Question: When should I [action]?
   Answer in 2-3 SHORT sentences. Keep it simple and practical. Example: "You can start right away. Most people do this soon after a loss. But there's no wrong time."

   (Add 6-8 total Q&A pairs - ALL written in simple, conversational language!)` : `### Question: What is [topic]?
   Answer paragraph here (2-3 sentences explaining the concept).

   ### Question: How do I [task]?
   Answer paragraph here (2-3 sentences with actionable steps).

   ### Question: When should I [action]?
   Answer paragraph here (2-3 sentences with guidance).

   (Add 6-8 total Q&A pairs in this EXACT "### Question:" format!)`}

4. **Structured Content for AI Parsing** (15 points):
   - ✅ Use clear H2/H3 hierarchy (6+ H2 headers, 4+ H3 subheaders)
   - ✅ Include "## Key Takeaways" section with 5+ bullet points${targetFleschScore && targetFleschScore >= 50 ? ' (write in short, simple sentences)' : ''}
   ${targetFleschScore && targetFleschScore >= 50
     ? `- ✅ Explain terms simply: "X means..." or "X is..." (use everyday words like "helps", "does", "means")
   - ✅ NEVER use formal phrases: "is defined as", "refers to", "constitutes", "facilitates"
   - ✅ Use numbered steps: "Step 1:", "Step 2:", "Step 3:" (at least 3 steps, keep instructions simple)`
     : '- ✅ Define technical terms: "X is defined as..." or "X refers to..." (at least 2 definitions)\n   - ✅ Use numbered steps for how-to content: "Step 1:", "Step 2:", "Step 3:" (at least 3 steps)'}

5. **AI-Friendly Formatting** (10 points):
   ${targetFleschScore && targetFleschScore >= 50 ? `- ✅ Start sections with simple topic sentences (short and clear)
   - ✅ Use lots of bullet lists (easier to read than paragraphs)
   - ✅ Keep list items short (one idea per bullet)
   - ✅ Use comparison tables where relevant (simple labels)
   - ✅ Add 5+ internal link opportunities: "[Learn more about X]" or "[Related: X]"` : `- ✅ Lead sections with topic sentences that answer "what/why/how"
   - ✅ Use lists liberally (5+ bullet points, 3+ numbered items)
   - ✅ Include comparison tables where relevant
   - ✅ Add 5+ internal link opportunities: "[Learn more about X]" or "[Related: X]"`}

**GEO (LOCAL BUSINESS OPTIMIZATION) - IF APPLICABLE:**

If this content is for a local business (plumber, lawyer, dentist, contractor, etc.), also optimize for:

1. **Google Business Profile (GBP) Discovery**:
   - ✅ Include booking/appointment CTAs: "Schedule a consultation," "Book your appointment," "Call us today"
   - ✅ Mention service categories explicitly: "Our [service type] services include..."
   - ✅ Reference business hours, location, or contact information naturally
   - ✅ Include "near me" optimization: "looking for [service] near you," "local [service]"

2. **Local Intent Signals**:
   - ✅ Mention the city/state throughout the content (aim for 3+ mentions)
   - ✅ Reference neighborhoods, districts, or service areas
   - ✅ Use local keywords: "best [service] in [city]," "trusted [service] near [location]"
   - ✅ Address local search queries: "Where to find...", "How to choose..."

3. **GBP-Friendly CTAs**:
   - ✅ "Get directions," "Visit us," "Contact our [city] office"
   - ✅ "Request a free estimate," "Schedule your free consultation"
   - ✅ Phone-friendly language: "Call now," "Reach us at"

**ANTI-GENERIC REQUIREMENTS:**
1. **Avoid Clichés**: Never use overused phrases like "In today's digital age," "Game-changer," "Unlock the secrets"

2. **Be Specific Without Being Unverifiable**:
   - Name actual companies/tools when discussing examples
   - Use provided research data for specific claims
   - Share concrete processes and steps
   - Describe real scenarios and use cases

3. **Add Value Through Insight**:
   - Explain WHY things work, not just THAT they work
   - Share tactical implementation details
   - Address common pitfalls and how to avoid them
   - Provide decision frameworks

**CONTENT QUALITY REQUIREMENTS:**
1. Write in the specified brand voice and tone
2. Target the specified audience with precise language they use
3. Include the target keyword naturally throughout (aim for 1-2% density)
4. Follow the provided outline structure
5. Use headers (H2, H3) to organize content hierarchically
6. Include SPECIFIC examples and ACTIONABLE insights (but avoid unverifiable statistics)
7. Write varied paragraph lengths (2-6 sentences) for rhythm
8. End with a thought-provoking call-to-action or conclusion
9. Aim for approximately ${input.wordCount} words (500+ words minimum for SEO)
10. **PRIORITIZE FACT-CHECK SCORE: Only include claims you can verify or that are general knowledge**

**ON-PAGE SEO REQUIREMENTS (CRITICAL - These will be audited):**
1. **H1 Tag**: The title should be 20-70 characters and include the primary keyword
2. **Header Hierarchy**: Use proper H2 and H3 tags (minimum 2 H2 tags) with related keywords
3. **Internal Linking**: Include 3-5 opportunities for internal links (mention "related topics" or "learn more about X")
4. **Content Length**: Minimum 500 words for SEO value, target ${input.wordCount} for depth
5. **Keyword Integration**: Include target keyword in:
   - Title (H1)
   - First paragraph (opening 100 words)
   - At least one H2 heading
   - Naturally throughout body (1-2% density)
   - Conclusion/CTA

**OUTPUT FORMAT:**
Return the content in this exact JSON structure:
{
  "title": "The final H1 title - MUST be 50-60 characters, include primary keyword, compelling and click-worthy",
  "metaDescription": "Meta description - MUST be 150-160 characters, include target keyword, compelling with clear value proposition and call-to-action",
  "content": "The full blog post content in Markdown format with proper headers (## for H2, ### for H3) and formatting. Minimum 500 words."
}

**TECHNICAL SEO CHECKLIST (These exact items will be audited):**
✅ Title: 50-60 characters with primary keyword
✅ Meta Description: 150-160 characters with keyword and CTA
✅ H1 (title): Exactly ONE per post, includes keyword
✅ H2 tags: Minimum 2, include related keywords
✅ H3 tags: Use for subsections under H2s
✅ Content length: 500+ words minimum
✅ Keyword in first paragraph
✅ Internal link opportunities: 3-5 mentions of related topics

**FINAL CHECK BEFORE WRITING (MUST HAVE ALL FOR 90+ AISO SCORE):**
- ✅ First paragraph starts with "The answer is..." or "Simply put..." or "Here's what you need to know..."
- ✅ FAQ section with 6-8 Q&A pairs using "### Question:" format
- ✅ "## Key Takeaways" section with 5+ bullet points
- ✅ At least 2 definitions using "X is defined as..." or "X refers to..."
- ✅ Numbered steps (Step 1:, Step 2:, Step 3:) for any process/how-to
- ✅ At least 5 internal link opportunities: "[Learn more about X]"
- ✅ At least 1 data table in markdown format (| Header | Header |) if comparing
- ✅ 6+ H2 headers (##) and 4+ H3 subheaders (###)
- ✅ Bold **key terms** throughout (10+ bold phrases)
- ✅ 5+ bullet points and 3+ numbered list items
- ✅ Call-to-action in last paragraph
- ✅ NO unverifiable statistics without qualifiers ("often", "typically")
- ✅ Writing for ${currentYear} or later (NEVER ${currentYear - 1}!)
- ✅ Would this be cited by ChatGPT/Perplexity/Google SGE?
- ✅ Would this pass 90%+ fact-check score?

**AISO SCORING TARGETS (will be audited):**
- AEO Score: 70+ (Answer-first structure, FAQ, quotable insights)
- SEO Score: 70+ (Headers, keywords, meta, links)
- Readability Score: 70+ (Clear, concise, scannable)
- Engagement Score: 70+ (Hooks, CTAs, varied formatting)
- Overall AISO Score: 75+

Now create content that is AI-quotable, informative, engaging, authoritative, VERIFIABLE, and optimized for modern answer engines.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    temperature: 0.9,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const response = message.content[0];
  if (response.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  // Parse the JSON response
  const jsonMatch = response.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from Claude response');
  }

  const result = JSON.parse(jsonMatch[0]);

  // Count words in the content
  const wordCount = result.content.split(/\s+/).filter(Boolean).length;

  return {
    title: result.title,
    metaDescription: result.metaDescription,
    content: result.content,
    wordCount,
  };
}

/**
 * 5-Pass Sequential Content Improvement System
 * Each pass focuses on ONE category and locks previous improvements
 */
export async function improveContentFivePass(
  content: string,
  title: string,
  metaDescription: string,
  localContext?: { city?: string; state?: string; serviceArea?: string }
): Promise<FivePassResult> {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
  const isLocalContent = !!localContext;

  let currentContent = content;
  const passResults: FivePassResult['passResults'] = [];

  console.log('\n========================================');
  console.log('🚀 STARTING 5-PASS IMPROVEMENT SYSTEM');
  console.log('========================================\n');

  // Initial scoring
  const initialFactCheck = await performFactCheck(content);
  const initialScores = calculateAISOScore(
    content,
    title,
    metaDescription,
    initialFactCheck.overallScore,
    localContext
  );
  const initialAisoScore = initialScores.aisoScore || initialScores.overallScore;

  console.log(`📊 Initial AISO Score: ${initialAisoScore}/100`);
  console.log(`   - Fact-Check: ${initialFactCheck.overallScore}/100`);
  console.log(`   - Readability: ${initialScores.readabilityScore}/100`);
  console.log(`   - AEO: ${initialScores.aeoScore}/100`);
  console.log(`   - SEO: ${initialScores.seoScore}/100`);
  console.log(`   - Engagement: ${initialScores.engagementScore}/100`);
  if (isLocalContent) {
    console.log(`   - GEO: ${initialScores.geoScore}/100`);
  }

  // Quality gate: If initial score is very low, topic may be bad
  if (initialAisoScore < 40) {
    console.log('\n⚠️  WARNING: Initial score is critically low (<40). Topic may not be viable.');
  }

  // ============================================================================
  // PASS 1: READABILITY ONLY
  // ============================================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📖 PASS 1: READABILITY IMPROVEMENT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const pass1Prompt = `You are a readability expert. Your ONLY task is to simplify this content for better readability.

**CURRENT DATE:** ${currentMonth} ${currentYear}

**CRITICAL RULES:**
1. **DO NOT add any new sections** (no FAQ, Key Takeaways, tables, etc.)
2. **DO NOT add any new claims or information**
3. **DO NOT change the structure or headers**
4. **ONLY simplify existing sentences**

**YOUR ONLY JOB:**
- Rewrite every sentence to be under 15 words
- Use 1-2 syllable words (5th-6th grade level)
- Break long sentences into 2-3 short sentences
- Replace complex words with simple alternatives:
  * "utilize" → "use"
  * "facilitate" → "help"
  * "comprehensive" → "full"
  * "encompasses" → "includes"
  * "implement" → "use" or "do"
- Use active voice: "We do X" not "X is done"
- One idea per sentence
- Break paragraphs to 3 sentences max

**EXAMPLE:**
❌ BEFORE: "Digital memorial etiquette encompasses respectful practices for honoring deceased loved ones in online spaces."
✅ AFTER: "Digital memorials need respect. They honor loved ones who passed away. Online spaces should feel sacred."

**CONTENT TO SIMPLIFY:**
${currentContent}

**OUTPUT:** Return ONLY the simplified content. No explanations. Just the rewritten text with simpler sentences.`;

  const pass1Response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    temperature: 0.5,
    messages: [{ role: 'user', content: pass1Prompt }],
  });

  if (pass1Response.content[0].type === 'text') {
    currentContent = pass1Response.content[0].text;
  }

  const pass1FactCheck = await performFactCheck(currentContent);
  const pass1Scores = calculateAISOScore(
    currentContent,
    title,
    metaDescription,
    pass1FactCheck.overallScore,
    localContext
  );
  const pass1Score = pass1Scores.aisoScore || pass1Scores.overallScore;

  passResults.push({
    pass: 1,
    name: 'Readability',
    scoreBefore: initialAisoScore,
    scoreAfter: pass1Score,
    improvement: pass1Score - initialAisoScore,
  });

  console.log(`✅ Pass 1 Complete: ${initialAisoScore} → ${pass1Score} (${pass1Score > initialAisoScore ? '+' : ''}${pass1Score - initialAisoScore})`);
  console.log(`   Readability: ${initialScores.readabilityScore} → ${pass1Scores.readabilityScore}`);

  // ============================================================================
  // PASS 2: STRUCTURE & SEO
  // ============================================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 PASS 2: STRUCTURE & SEO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const pass2Prompt = `You are an SEO expert. Improve the structure and headers without changing sentence complexity.

**CURRENT DATE:** ${currentMonth} ${currentYear}

**CRITICAL RULES:**
1. **DO NOT rewrite simplified sentences** - they are already optimized
2. **DO NOT add FAQ, Key Takeaways, or definitions** - that comes later
3. **KEEP readability above ${pass1Scores.readabilityScore}** - don't make sentences complex again

**YOUR TASK:**
- Add more H2 headers (##) - aim for 6+ total
- Add more H3 subheaders (###) - aim for 4+ total
- Ensure proper header hierarchy
- Add internal link opportunities: "[Learn more about X]" or "[Related: X]"
- Add bold **key terms** throughout (10+ bold phrases)
- Keep all sentences SHORT (under 15 words)

**CONTENT TO IMPROVE:**
${currentContent}

**OUTPUT:** Return ONLY the improved content with better structure. Keep sentences simple.`;

  const pass2Response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    temperature: 0.5,
    messages: [{ role: 'user', content: pass2Prompt }],
  });

  if (pass2Response.content[0].type === 'text') {
    currentContent = pass2Response.content[0].text;
  }

  const pass2FactCheck = await performFactCheck(currentContent);
  const pass2Scores = calculateAISOScore(
    currentContent,
    title,
    metaDescription,
    pass2FactCheck.overallScore,
    localContext
  );
  const pass2Score = pass2Scores.aisoScore || pass2Scores.overallScore;

  passResults.push({
    pass: 2,
    name: 'Structure/SEO',
    scoreBefore: pass1Score,
    scoreAfter: pass2Score,
    improvement: pass2Score - pass1Score,
  });

  console.log(`✅ Pass 2 Complete: ${pass1Score} → ${pass2Score} (${pass2Score > pass1Score ? '+' : ''}${pass2Score - pass1Score})`);
  console.log(`   SEO: ${pass1Scores.seoScore} → ${pass2Scores.seoScore}`);
  console.log(`   Readability maintained: ${pass2Scores.readabilityScore}`);

  // ============================================================================
  // PASS 3: AEO / FAQ / DEFINITIONS
  // ============================================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 PASS 3: AEO / FAQ / STRUCTURED DATA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check if FAQ should be added based on fact-check confidence
  const shouldAddFAQ = pass2FactCheck.overallScore >= 65;
  console.log(`   Fact-check score: ${pass2FactCheck.overallScore}/100`);
  console.log(`   ${shouldAddFAQ ? '✅ Adding FAQ section (score >= 65%)' : '⚠️  Skipping FAQ section (score < 65%)'}\n`);

  const pass3Prompt = `You are an AEO (Answer Engine Optimization) expert. Add structured sections WITHOUT touching existing content.

**CURRENT DATE:** ${currentMonth} ${currentYear}

**CRITICAL RULES:**
1. **DO NOT rewrite any existing paragraphs** - they are already optimized
2. **ONLY ADD new sections** using clear separation
3. **KEEP readability above ${pass2Scores.readabilityScore}**

**YOUR TASK - ADD THESE SECTIONS:**

1. **Make first paragraph quotable** (if not already):
   - Should start with "The answer is..." or "Simply put..." or "Here's what you need to know..."
   - Keep it 2-3 sentences, direct, authoritative

2. **Add "## Key Takeaways" section** (if missing):
   - 5+ bullet points summarizing main insights
   - Keep bullets short and clear

${shouldAddFAQ ? `3. **Add "## Frequently Asked Questions" section** (MANDATORY):
   Use this EXACT format:

   ## Frequently Asked Questions

   ### Question: What is [topic]?
   Answer paragraph (2-3 sentences).

   ### Question: How do I [task]?
   Answer paragraph (2-3 sentences).

   (Add 6-8 total Q&A pairs)

` : '3. **DO NOT add a Frequently Asked Questions section** - fact-check confidence is too low for FAQ content\n\n'}4. **Add definitions** (2+ definitions):
   - Use format: "X is defined as..." or "X refers to..."
   - Integrate naturally into existing sections

5. **Add numbered steps** (if applicable):
   - "Step 1:", "Step 2:", "Step 3:"
   - For any how-to or process content

6. **Add comparison table** (if relevant):
   - Use markdown table format: | Column 1 | Column 2 |

**CONTENT TO ENHANCE:**
${currentContent}

**OUTPUT:** Return the content with new structured sections added. Don't rewrite existing content.`;

  const pass3Response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    temperature: 0.6,
    messages: [{ role: 'user', content: pass3Prompt }],
  });

  if (pass3Response.content[0].type === 'text') {
    currentContent = pass3Response.content[0].text;
  }

  const pass3FactCheck = await performFactCheck(currentContent);
  const pass3Scores = calculateAISOScore(
    currentContent,
    title,
    metaDescription,
    pass3FactCheck.overallScore,
    localContext
  );
  const pass3Score = pass3Scores.aisoScore || pass3Scores.overallScore;

  passResults.push({
    pass: 3,
    name: 'AEO/FAQ',
    scoreBefore: pass2Score,
    scoreAfter: pass3Score,
    improvement: pass3Score - pass2Score,
  });

  console.log(`✅ Pass 3 Complete: ${pass2Score} → ${pass3Score} (${pass3Score > pass2Score ? '+' : ''}${pass3Score - pass2Score})`);
  console.log(`   AEO: ${pass2Scores.aeoScore} → ${pass3Scores.aeoScore}`);
  console.log(`   Readability maintained: ${pass3Scores.readabilityScore}`);

  // ============================================================================
  // PASS 4: ENGAGEMENT & POLISH
  // ============================================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 PASS 4: ENGAGEMENT & TONE POLISH');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const pass4Prompt = `You are an engagement expert. Polish tone and add engagement elements WITHOUT breaking readability.

**CURRENT DATE:** ${currentMonth} ${currentYear}

**CRITICAL RULES:**
1. **KEEP all sentences under 15 words** - don't make them complex
2. **DO NOT remove any FAQ, Key Takeaways, or definitions** - they are required
3. **ONLY add engagement elements**

**YOUR TASK:**
- Ensure first paragraph has a hook (question, "Did you know...", "What if...")
- Add strong call-to-action at end: "Ready to...", "Start by...", "Try..."
- Add 2-3 questions throughout to engage reader
- Ensure variety in paragraph length (but keep short: 2-4 sentences)
- Update any outdated year references to ${currentYear}
- Add a quote or blockquote if applicable (> Quote text)
- Ensure warm, clear, consistent tone throughout

${isLocalContent ? `**LOCAL OPTIMIZATION (GEO):**
- Add location mentions: "${localContext?.city}, ${localContext?.state}"
- Add "near me" language: "near you", "in your area", "local"
- Add booking CTAs: "Call now", "Schedule appointment", "Get directions"
- Reference service area: "${localContext?.serviceArea}"` : ''}

**CONTENT TO POLISH:**
${currentContent}

**OUTPUT:** Return the polished content with better engagement. Keep it simple and readable.`;

  const pass4Response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    temperature: 0.7,
    messages: [{ role: 'user', content: pass4Prompt }],
  });

  if (pass4Response.content[0].type === 'text') {
    currentContent = pass4Response.content[0].text;
  }

  const pass4FactCheck = await performFactCheck(currentContent);
  const pass4Scores = calculateAISOScore(
    currentContent,
    title,
    metaDescription,
    pass4FactCheck.overallScore,
    localContext
  );
  const pass4Score = pass4Scores.aisoScore || pass4Scores.overallScore;

  passResults.push({
    pass: 4,
    name: 'Engagement',
    scoreBefore: pass3Score,
    scoreAfter: pass4Score,
    improvement: pass4Score - pass3Score,
  });

  console.log(`✅ Pass 4 Complete: ${pass3Score} → ${pass4Score} (${pass4Score > pass3Score ? '+' : ''}${pass4Score - pass3Score})`);
  console.log(`   Engagement: ${pass3Scores.engagementScore} → ${pass4Scores.engagementScore}`);
  if (isLocalContent) {
    console.log(`   GEO: ${pass3Scores.geoScore} → ${pass4Scores.geoScore}`);
  }
  console.log(`   Readability maintained: ${pass4Scores.readabilityScore}`);

  // ============================================================================
  // PASS 5: FINAL SCORING & VALIDATION
  // ============================================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏆 PASS 5: FINAL SCORING & VALIDATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const finalFactCheck = await performFactCheck(currentContent);
  const finalScores = calculateAISOScore(
    currentContent,
    title,
    metaDescription,
    finalFactCheck.overallScore,
    localContext
  );
  const finalScore = finalScores.aisoScore || finalScores.overallScore;

  passResults.push({
    pass: 5,
    name: 'Final Validation',
    scoreBefore: pass4Score,
    scoreAfter: finalScore,
    improvement: finalScore - pass4Score,
  });

  console.log(`\n📊 FINAL SCORES:`);
  console.log(`   - AISO Score: ${finalScore}/100`);
  console.log(`   - Fact-Check: ${finalFactCheck.overallScore}/100`);
  console.log(`   - Readability: ${finalScores.readabilityScore}/100`);
  console.log(`   - AEO: ${finalScores.aeoScore}/100`);
  console.log(`   - SEO: ${finalScores.seoScore}/100`);
  console.log(`   - Engagement: ${finalScores.engagementScore}/100`);
  if (isLocalContent) {
    console.log(`   - GEO: ${finalScores.geoScore}/100`);
  }

  console.log(`\n🎯 Total Improvement: ${initialAisoScore} → ${finalScore} (+${finalScore - initialAisoScore})`);

  // Quality gate: If final score is still below 60, reject topic
  if (finalScore < 60) {
    console.log('\n❌ TOPIC REJECTED: Final score below 60 after all improvements.');
    console.log('   This topic may not be suitable for quality content generation.');

    return {
      success: false,
      content: currentContent,
      title,
      metaDescription,
      finalScore,
      scores: finalScores,
      passResults,
      error: 'Content quality insufficient. This topic may not generate high-quality content. Consider choosing a different topic or providing more specific research data.',
      topicRejection: true,
    };
  }

  // Check if minimum thresholds are met
  const MINIMUM_THRESHOLDS = {
    factCheck: 70,
    readability: 60,
    aeo: 65,
    seo: 60,
    engagement: 60,
    geo: isLocalContent ? 60 : undefined,
  };

  const failedCategories: string[] = [];
  if (finalFactCheck.overallScore < MINIMUM_THRESHOLDS.factCheck) failedCategories.push('Fact-Check');
  if (finalScores.readabilityScore < MINIMUM_THRESHOLDS.readability) failedCategories.push('Readability');
  if (finalScores.aeoScore < MINIMUM_THRESHOLDS.aeo) failedCategories.push('AEO');
  if (finalScores.seoScore < MINIMUM_THRESHOLDS.seo) failedCategories.push('SEO');
  if (finalScores.engagementScore < MINIMUM_THRESHOLDS.engagement) failedCategories.push('Engagement');
  if (isLocalContent && (finalScores.geoScore || 0) < (MINIMUM_THRESHOLDS.geo || 60)) {
    failedCategories.push('GEO');
  }

  if (finalScore >= 70 && failedCategories.length === 0) {
    console.log('\n✅ SUCCESS: All quality thresholds met!');
  } else if (finalScore >= 60) {
    console.log(`\n⚠️  WARNING: Score above 60 but some categories need work: ${failedCategories.join(', ')}`);
  }

  console.log('\n========================================');
  console.log('✨ 5-PASS IMPROVEMENT COMPLETE');
  console.log('========================================\n');

  return {
    success: finalScore >= 60,
    content: currentContent,
    title,
    metaDescription,
    finalScore,
    scores: finalScores,
    passResults,
    error: finalScore < 60 ? 'Failed to meet minimum quality threshold after all improvement passes.' : undefined,
    topicRejection: finalScore < 60,
  };
}

/**
 * Individual Pass Functions - User can choose which improvement to apply
 */

// Pass 1: Readability Only
export async function improveReadability(
  content: string,
  title: string,
  metaDescription: string,
  localContext?: { city?: string; state?: string; serviceArea?: string },
  targetFleschScore?: number
): Promise<SinglePassResult> {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });

  console.log('\n📖 Running READABILITY improvement...\n');

  // Calculate before scores
  const beforeFactCheck = await performFactCheck(content);
  const beforeScores = calculateAISOScore(content, title, metaDescription, beforeFactCheck.overallScore, localContext, targetFleschScore);
  const beforeAiso = beforeScores.aisoScore || beforeScores.overallScore;

  // Determine target reading level for prompt
  const targetReadingLevel = targetFleschScore
    ? targetFleschScore >= 70 ? '7th grade (very accessible)'
      : targetFleschScore >= 60 ? '8th-9th grade (standard)'
      : targetFleschScore >= 50 ? '10th grade (educated adults)'
      : targetFleschScore >= 40 ? 'college level (professionals)'
      : 'graduate level (technical experts)'
    : '5th-6th grade (very simple)';

  const targetSentenceLength = targetFleschScore
    ? targetFleschScore >= 70 ? '10-12 words'
      : targetFleschScore >= 60 ? '12-15 words'
      : targetFleschScore >= 50 ? '15-18 words'
      : '15-20 words'
    : '10-15 words';

  const prompt = `You are a readability expert. Your ONLY task is to adjust this content to match the TARGET READING LEVEL.

**CURRENT DATE:** ${currentMonth} ${currentYear}

**TARGET READING LEVEL:** ${targetReadingLevel}
${targetFleschScore ? `**TARGET FLESCH SCORE:** ${targetFleschScore} (aim within 5 points of this)` : ''}

**CRITICAL RULES:**
1. **DO NOT add any new sections** (no FAQ, Key Takeaways, tables, etc.)
2. **DO NOT add any new claims or information**
3. **DO NOT change the structure or headers**
4. **ONLY adjust sentence complexity to match target level**

**YOUR GOAL:**
- Target sentence length: ${targetSentenceLength}
- Match the reading level of your target audience
- Break long sentences into shorter ones
- Replace overly complex words with simpler alternatives (but keep technical terms if targeting professionals)
- Use active voice: "We do X" not "X is done"
- One idea per sentence
- Break paragraphs to 3-4 sentences max

**EXAMPLE:**
❌ TOO COMPLEX: "Digital memorial etiquette encompasses respectful practices for honoring deceased loved ones in online spaces."
✅ TARGET LEVEL: "Digital memorials need respectful practices. They honor loved ones who passed away. Online spaces should feel sacred and meaningful."

**CONTENT TO ADJUST:**
${content}

**OUTPUT:** Return ONLY the adjusted content at the target reading level. No explanations. Just the rewritten text.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    temperature: 0.5,
    messages: [{ role: 'user', content: prompt }],
  });

  const improvedContent = response.content[0].type === 'text' ? response.content[0].text : content;

  // Calculate after scores
  const afterFactCheck = await performFactCheck(improvedContent);
  const afterScores = calculateAISOScore(improvedContent, title, metaDescription, afterFactCheck.overallScore, localContext, targetFleschScore);
  const afterAiso = afterScores.aisoScore || afterScores.overallScore;

  console.log(`✅ Readability: ${beforeScores.readabilityScore} → ${afterScores.readabilityScore}`);
  console.log(`   AISO: ${beforeAiso} → ${afterAiso}\n`);

  return {
    success: true,
    content: improvedContent,
    scoreBefore: beforeAiso,
    scoreAfter: afterAiso,
    improvement: afterAiso - beforeAiso,
    categoryScores: {
      before: beforeScores,
      after: afterScores,
    },
    passName: 'Readability',
  };
}

// Pass 2: Structure & SEO
export async function improveStructureSEO(
  content: string,
  title: string,
  metaDescription: string,
  localContext?: { city?: string; state?: string; serviceArea?: string }
): Promise<SinglePassResult> {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });

  console.log('\n📊 Running STRUCTURE & SEO improvement...\n');

  const beforeFactCheck = await performFactCheck(content);
  const beforeScores = calculateAISOScore(content, title, metaDescription, beforeFactCheck.overallScore, localContext);
  const beforeAiso = beforeScores.aisoScore || beforeScores.overallScore;

  const prompt = `You are an SEO expert. Improve the structure and headers without changing sentence complexity.

**CURRENT DATE:** ${currentMonth} ${currentYear}

**CRITICAL RULES:**
1. **DO NOT rewrite simplified sentences** - they are already optimized
2. **DO NOT add FAQ, Key Takeaways, or definitions** - that comes later
3. **KEEP existing readability** - don't make sentences complex again

**YOUR TASK:**
- Add more H2 headers (##) - aim for 6+ total
- Add more H3 subheaders (###) - aim for 4+ total
- Ensure proper header hierarchy
- Add internal link opportunities: "[Learn more about X]" or "[Related: X]"
- Add bold **key terms** throughout (10+ bold phrases)
- Keep all sentences SHORT (under 15 words if they already are)

**CONTENT TO IMPROVE:**
${content}

**OUTPUT:** Return ONLY the improved content with better structure. Keep sentences simple.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    temperature: 0.5,
    messages: [{ role: 'user', content: prompt }],
  });

  const improvedContent = response.content[0].type === 'text' ? response.content[0].text : content;

  const afterFactCheck = await performFactCheck(improvedContent);
  const afterScores = calculateAISOScore(improvedContent, title, metaDescription, afterFactCheck.overallScore, localContext);
  const afterAiso = afterScores.aisoScore || afterScores.overallScore;

  console.log(`✅ SEO: ${beforeScores.seoScore} → ${afterScores.seoScore}`);
  console.log(`   Readability maintained: ${afterScores.readabilityScore}`);
  console.log(`   AISO: ${beforeAiso} → ${afterAiso}\n`);

  return {
    success: true,
    content: improvedContent,
    scoreBefore: beforeAiso,
    scoreAfter: afterAiso,
    improvement: afterAiso - beforeAiso,
    categoryScores: {
      before: beforeScores,
      after: afterScores,
    },
    passName: 'Structure/SEO',
  };
}

// Pass 3: AEO/FAQ
export async function improveAEO(
  content: string,
  title: string,
  metaDescription: string,
  localContext?: { city?: string; state?: string; serviceArea?: string }
): Promise<SinglePassResult> {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });

  console.log('\n🤖 Running AEO/FAQ improvement...\n');

  const beforeFactCheck = await performFactCheck(content);
  const beforeScores = calculateAISOScore(content, title, metaDescription, beforeFactCheck.overallScore, localContext);
  const beforeAiso = beforeScores.aisoScore || beforeScores.overallScore;

  const prompt = `You are an AEO (Answer Engine Optimization) expert. Add structured sections WITHOUT touching existing content.

**CURRENT DATE:** ${currentMonth} ${currentYear}

**CRITICAL RULES:**
1. **DO NOT rewrite any existing paragraphs** - they are already optimized
2. **ONLY ADD new sections** using clear separation
3. **KEEP existing readability**

**YOUR TASK - ADD THESE SECTIONS:**

1. **Make first paragraph quotable** (if not already):
   - Should start with "The answer is..." or "Simply put..." or "Here's what you need to know..."
   - Keep it 2-3 sentences, direct, authoritative

2. **Add "## Key Takeaways" section** (if missing):
   - 5+ bullet points summarizing main insights
   - Keep bullets short and clear

3. **Add "## Frequently Asked Questions" section** (MANDATORY):
   Use this EXACT format:

   ## Frequently Asked Questions

   ### Question: What is [topic]?
   Answer paragraph (2-3 sentences).

   ### Question: How do I [task]?
   Answer paragraph (2-3 sentences).

   (Add 6-8 total Q&A pairs)

4. **Add definitions** (2+ definitions):
   - Use format: "X is defined as..." or "X refers to..."
   - Integrate naturally into existing sections

5. **Add numbered steps** (if applicable):
   - "Step 1:", "Step 2:", "Step 3:"
   - For any how-to or process content

6. **Add comparison table** (if relevant):
   - Use markdown table format: | Column 1 | Column 2 |

**CONTENT TO ENHANCE:**
${content}

**OUTPUT:** Return the content with new structured sections added. Don't rewrite existing content.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    temperature: 0.6,
    messages: [{ role: 'user', content: prompt }],
  });

  const improvedContent = response.content[0].type === 'text' ? response.content[0].text : content;

  const afterFactCheck = await performFactCheck(improvedContent);
  const afterScores = calculateAISOScore(improvedContent, title, metaDescription, afterFactCheck.overallScore, localContext);
  const afterAiso = afterScores.aisoScore || afterScores.overallScore;

  console.log(`✅ AEO: ${beforeScores.aeoScore} → ${afterScores.aeoScore}`);
  console.log(`   Readability maintained: ${afterScores.readabilityScore}`);
  console.log(`   AISO: ${beforeAiso} → ${afterAiso}\n`);

  return {
    success: true,
    content: improvedContent,
    scoreBefore: beforeAiso,
    scoreAfter: afterAiso,
    improvement: afterAiso - beforeAiso,
    categoryScores: {
      before: beforeScores,
      after: afterScores,
    },
    passName: 'AEO/FAQ',
  };
}

// Pass 4: Engagement
export async function improveEngagement(
  content: string,
  title: string,
  metaDescription: string,
  localContext?: { city?: string; state?: string; serviceArea?: string }
): Promise<SinglePassResult> {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
  const isLocalContent = !!localContext;

  console.log('\n🎯 Running ENGAGEMENT improvement...\n');

  const beforeFactCheck = await performFactCheck(content);
  const beforeScores = calculateAISOScore(content, title, metaDescription, beforeFactCheck.overallScore, localContext);
  const beforeAiso = beforeScores.aisoScore || beforeScores.overallScore;

  const prompt = `You are an engagement expert. Polish tone and add engagement elements WITHOUT breaking readability.

**CURRENT DATE:** ${currentMonth} ${currentYear}

**CRITICAL RULES:**
1. **KEEP all sentences under 15 words** - don't make them complex
2. **DO NOT remove any FAQ, Key Takeaways, or definitions** - they are required
3. **ONLY add engagement elements**

**YOUR TASK:**
- Ensure first paragraph has a hook (question, "Did you know...", "What if...")
- Add strong call-to-action at end: "Ready to...", "Start by...", "Try..."
- Add 2-3 questions throughout to engage reader
- Ensure variety in paragraph length (but keep short: 2-4 sentences)
- Update any outdated year references to ${currentYear}
- Add a quote or blockquote if applicable (> Quote text)
- Ensure warm, clear, consistent tone throughout

${isLocalContent ? `**LOCAL OPTIMIZATION (GEO):**
- Add location mentions: "${localContext?.city}, ${localContext?.state}"
- Add "near me" language: "near you", "in your area", "local"
- Add booking CTAs: "Call now", "Schedule appointment", "Get directions"
- Reference service area: "${localContext?.serviceArea}"` : ''}

**CONTENT TO POLISH:**
${content}

**OUTPUT:** Return the polished content with better engagement. Keep it simple and readable.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    temperature: 0.7,
    messages: [{ role: 'user', content: prompt }],
  });

  const improvedContent = response.content[0].type === 'text' ? response.content[0].text : content;

  const afterFactCheck = await performFactCheck(improvedContent);
  const afterScores = calculateAISOScore(improvedContent, title, metaDescription, afterFactCheck.overallScore, localContext);
  const afterAiso = afterScores.aisoScore || afterScores.overallScore;

  console.log(`✅ Engagement: ${beforeScores.engagementScore} → ${afterScores.engagementScore}`);
  if (isLocalContent) {
    console.log(`   GEO: ${beforeScores.geoScore} → ${afterScores.geoScore}`);
  }
  console.log(`   Readability maintained: ${afterScores.readabilityScore}`);
  console.log(`   AISO: ${beforeAiso} → ${afterAiso}\n`);

  return {
    success: true,
    content: improvedContent,
    scoreBefore: beforeAiso,
    scoreAfter: afterAiso,
    improvement: afterAiso - beforeAiso,
    categoryScores: {
      before: beforeScores,
      after: afterScores,
    },
    passName: 'Engagement',
  };
}
