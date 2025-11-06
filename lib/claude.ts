import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function generateStrategy({
  clientName,
  industry,
  goals,
  targetAudience,
  brandVoice,
  frequency,
  contentLength,
  keywords,
  targetFleschScore,
}: {
  clientName: string;
  industry: string;
  goals: string[];
  targetAudience: string;
  brandVoice: string;
  frequency: string;
  contentLength: string;
  keywords: string;
  targetFleschScore?: number;
}) {
  const keywordsText = keywords ? keywords : 'No specific keywords provided';

  // Determine reading level description
  const readingLevel = targetFleschScore
    ? targetFleschScore >= 70 ? '7th grade (very accessible for general public)'
      : targetFleschScore >= 60 ? '8th-9th grade (standard readability)'
      : targetFleschScore >= 50 ? '10th grade (educated adults)'
      : targetFleschScore >= 40 ? 'College level (professional audience)'
      : 'Graduate level (technical experts)'
    : '10th grade (default - educated general audience)';

  const prompt = `You are an AISO (AI Search Optimization) strategy expert specializing in AEO (Answer Engine Optimization) and modern SEO. Create a 15-topic content calendar optimized for AI answer engines like ChatGPT Search, Perplexity, Google SGE, and Bing Copilot.

**Client Details:**
Client Name: ${clientName}
Industry: ${industry}
Primary Goals: ${goals.join(', ')}
Target Audience: ${targetAudience}
Brand Voice: ${brandVoice}
Posting Frequency: ${frequency}
Content Length: ${contentLength}
Keywords/Topics of Interest: ${keywordsText}
${targetFleschScore ? `Target Reading Level: ${readingLevel} (Flesch ${targetFleschScore})` : ''}

${targetFleschScore ? `
**⚠️ CRITICAL READING LEVEL REQUIREMENT:**
The target reading level is ${readingLevel} (Flesch ${targetFleschScore}). This means:
${targetFleschScore >= 70 ? `- Audience: General public, including teens and non-experts
- Avoid: Technical jargon, complex terminology, industry acronyms
- Topics should be: Practical, everyday problems with simple solutions
- Examples: "How to Clean Your Phone Screen", "Easy Ways to Save Money on Groceries"
- BAD examples: "Cloud Storage Architecture", "Digital Preservation Strategies", "OAuth Authentication"`
: targetFleschScore >= 60 ? `- Audience: High school educated adults
- Minimize: Technical terms (explain if necessary), complex processes
- Topics should be: Practical with some detail, but still accessible
- Examples: "How to Choose the Right Insurance Plan", "Understanding Your Credit Score"
- BAD examples: "Implementing Data Migration Strategies", "Advanced SEO Techniques"`
: targetFleschScore >= 50 ? `- Audience: College-educated professionals
- Can include: Some industry terms, but with explanations
- Topics should be: Moderately detailed, professional but clear
- Examples: "Project Management Best Practices", "Marketing Analytics for Small Business"
- BAD examples: "Advanced API Authentication Patterns", "Kubernetes Deployment Strategies"`
: `- Audience: Technical experts and specialists
- Can include: Technical terminology, complex concepts
- Topics should be: In-depth, detailed, specialized
- Examples: "REST API Design Patterns", "Database Normalization Strategies"`}

**YOU MUST REJECT topics that:**
- Require technical expertise beyond the target audience
- Use jargon that can't be simplified (e.g., OAuth, Kubernetes, API endpoints)
- Involve complex processes that need graduate-level understanding
- Can only be written at a higher reading level than the target

**Instead, choose topics that:**
- Can naturally be written at the target reading level
- Match the everyday vocabulary of the target audience
- Solve problems the audience actually faces
- Don't require specialized knowledge to understand
` : ''}

**AISO Strategy Requirements:**

Generate 15 blog post topics that:
1. **AEO-Optimized**: Topics should be answerable, quotable, and AI-citation friendly
2. **Question-Based**: Frame topics as questions AI engines commonly answer (What is, How to, Why does, Best ways to)
3. **Answer Engine Intent**: Consider what Perplexity, ChatGPT, or SGE would surface
4. **SEO + AI Balance**: Traditional keyword optimization + AI discoverability
5. **Topical Authority**: Build comprehensive coverage that AI engines trust
6. **Value-First**: Content that deserves to be cited by AI
7. **Diverse Formats**: Mix how-to guides, comparisons, definitions, and listicles
8. **Logical Progression**: Start broad (awareness), narrow to specific (decision-making)
${targetFleschScore ? `9. **CRITICAL - Reading Level Match**: Every topic MUST be naturally writable at ${readingLevel}. If a topic requires technical language or complex concepts beyond this level, DO NOT include it.` : ''}

For each topic, provide:
- **Title**: Compelling, question-based or answer-focused (e.g., "What Is X?", "How to Y", "Z Explained")
- **Target keyword/phrase**: Primary keyword AI engines associate with this topic
- **Brief outline**: 3-5 H2 headings that follow answer-first structure
- **SEO intent**: informational, commercial, or transactional
- **AEO focus**: Type of answer format (definition, how-to, comparison, guide, FAQ)
- **Estimated word count**: Target length

**Outline Structure Tips for AEO:**
- First H2 should answer the main question directly
- Include "Frequently Asked Questions" as one H2
- Use specific, descriptive headings (not vague like "Overview")
- Structure for AI parsing: "What is", "How does", "Why", "When to", "Best practices"

Format your response as a JSON array of topics. Each topic should have this structure:
{
  "title": "string (question-based or answer-focused)",
  "keyword": "string",
  "outline": ["string", "string", "string"],
  "seoIntent": "informational|commercial|transactional",
  "aeoFocus": "definition|how-to|comparison|guide|faq",
  "wordCount": number
}

Return ONLY the JSON array, no additional text.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const tokensUsed = message.usage.input_tokens + message.usage.output_tokens;

  // Parse the JSON response
  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Could not parse topics from Claude response');
  }

  const rawTopics = JSON.parse(jsonMatch[0]);

  // Normalize the data - ensure outline is always an array
  const topics = rawTopics.map((topic: any) => ({
    ...topic,
    outline: Array.isArray(topic.outline)
      ? topic.outline
      : typeof topic.outline === 'string'
        ? topic.outline.split(',').map((s: string) => s.trim())
        : [],
  }));

  return { topics, tokensUsed };
}

export interface FactCheck {
  claim: string;
  status: 'verified' | 'uncertain' | 'unverified';
  confidence: number;
  sources: string[];
}

export async function factCheckContent(
  content: string,
  searchResults: Array<{ url: string; snippet: string }>
): Promise<FactCheck[]> {
  const prompt = `You are a fact-checking expert. Analyze the following blog post content and identify factual claims that should be verified.

Content:
${content}

Available search results for verification:
${searchResults.map((r, i) => `${i + 1}. ${r.snippet}\nSource: ${r.url}`).join('\n\n')}

For each factual claim you identify:
1. Extract the specific claim
2. Determine if it can be verified using the search results
3. Assign a status: "verified" (found in 2+ sources), "uncertain" (found in 1 source or conflicting info), or "unverified" (no sources found)
4. Provide a confidence score (0-100)
5. List the source URLs that support or refute the claim

Focus on objective facts like statistics, dates, quotes, research findings, and technical specifications.
Ignore subjective opinions or general statements.

Return ONLY a JSON array with this structure:
[
  {
    "claim": "string",
    "status": "verified|uncertain|unverified",
    "confidence": number,
    "sources": ["url1", "url2"]
  }
]`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const responseContent = message.content[0];
  if (responseContent.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const tokensUsed = message.usage.input_tokens + message.usage.output_tokens;

  // Parse the JSON response
  const jsonMatch = responseContent.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return [];
  }

  const factChecks: FactCheck[] = JSON.parse(jsonMatch[0]);
  return factChecks;
}
