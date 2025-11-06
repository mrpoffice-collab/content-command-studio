import { anthropic } from '@/lib/claude';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  similarityScore: number; // 0-100
  warnings: string[];
  matchedUrls: string[];
}

export interface ExistingContent {
  url: string;
  title: string;
  excerpt: string;
}

/**
 * Calculate simple text similarity using word overlap
 * This is a basic implementation - for production, consider using more advanced algorithms
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  // Normalize texts
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3); // Ignore short words

  const words1 = new Set(normalize(text1));
  const words2 = new Set(normalize(text2));

  // Calculate Jaccard similarity
  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);

  return (intersection.size / union.size) * 100;
}

/**
 * Check if generated content is too similar to existing content
 * Uses both simple text similarity and AI-powered semantic analysis
 */
export async function checkForDuplicateContent(
  generatedTitle: string,
  generatedContent: string,
  existingContent: ExistingContent[]
): Promise<DuplicateCheckResult> {
  const warnings: string[] = [];
  const matchedUrls: string[] = [];
  let maxSimilarity = 0;

  // Quick check: Title similarity
  for (const existing of existingContent) {
    const titleSimilarity = calculateTextSimilarity(
      generatedTitle,
      existing.title
    );

    if (titleSimilarity > 70) {
      warnings.push(
        `⚠️ Title very similar to: "${existing.title}" (${titleSimilarity.toFixed(0)}% match)`
      );
      matchedUrls.push(existing.url);
      maxSimilarity = Math.max(maxSimilarity, titleSimilarity);
    }
  }

  // Content similarity check (compare with excerpts)
  const generatedExcerpt = generatedContent.slice(0, 500);

  for (const existing of existingContent) {
    const contentSimilarity = calculateTextSimilarity(
      generatedExcerpt,
      existing.excerpt
    );

    if (contentSimilarity > 60) {
      warnings.push(
        `⚠️ Content similar to: ${existing.url} (${contentSimilarity.toFixed(0)}% match)`
      );
      if (!matchedUrls.includes(existing.url)) {
        matchedUrls.push(existing.url);
      }
      maxSimilarity = Math.max(maxSimilarity, contentSimilarity);
    }
  }

  // AI-powered semantic similarity check for high-similarity cases
  if (maxSimilarity > 50 && existingContent.length > 0) {
    const semanticCheck = await performSemanticSimilarityCheck(
      generatedTitle,
      generatedExcerpt,
      existingContent.slice(0, 3) // Check top 3 most relevant
    );

    if (semanticCheck.isDuplicate) {
      warnings.push(
        `🤖 AI detected semantic similarity: ${semanticCheck.reason}`
      );
      maxSimilarity = Math.max(maxSimilarity, semanticCheck.score);
    }
  }

  return {
    isDuplicate: maxSimilarity > 70, // Threshold for flagging as duplicate
    similarityScore: Math.round(maxSimilarity),
    warnings,
    matchedUrls,
  };
}

/**
 * Use Claude to perform semantic similarity analysis
 */
async function performSemanticSimilarityCheck(
  newTitle: string,
  newExcerpt: string,
  existingContent: ExistingContent[]
): Promise<{ isDuplicate: boolean; score: number; reason: string }> {
  const prompt = `You are a content uniqueness analyzer. Compare the new blog post with existing content and determine if they're too similar (duplicate/plagiarism).

**NEW CONTENT:**
Title: ${newTitle}
Excerpt: ${newExcerpt}

**EXISTING CONTENT:**
${existingContent.map((content, i) => `${i + 1}. Title: ${content.title}\n   Excerpt: ${content.excerpt}`).join('\n\n')}

Analyze:
1. Are the topics essentially the same?
2. Is the angle/perspective too similar?
3. Would Google consider these duplicate content?
4. Does the new content add unique value?

Return ONLY a JSON object:
{
  "isDuplicate": boolean,
  "score": number (0-100, where 100 = identical),
  "reason": "Brief explanation"
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      temperature: 0.3, // Low temperature for consistent analysis
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const response = message.content[0];
    if (response.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON response');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Semantic similarity check failed:', error);
    // Fallback: Don't block on error
    return { isDuplicate: false, score: 0, reason: 'Check failed' };
  }
}

/**
 * Fetch and extract content from a URL
 */
export async function scrapeExistingContent(
  url: string
): Promise<ExistingContent | null> {
  try {
    // Use a simple fetch to get the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ContentCommandStudio/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

    // Extract meta description or first paragraph
    const metaMatch = html.match(
      /<meta\s+name=["']description["']\s+content=["'](.*?)["']/i
    );
    let excerpt = metaMatch ? metaMatch[1] : '';

    // If no meta description, try to get first paragraph
    if (!excerpt) {
      const pMatch = html.match(/<p[^>]*>(.*?)<\/p>/i);
      excerpt = pMatch
        ? pMatch[1].replace(/<[^>]*>/g, '').trim().slice(0, 500)
        : '';
    }

    return {
      url,
      title,
      excerpt: excerpt.slice(0, 500),
    };
  } catch (error) {
    console.error(`Failed to scrape ${url}:`, error);
    return null;
  }
}

/**
 * Batch scrape multiple URLs
 */
export async function scrapeMultipleUrls(
  urls: string[]
): Promise<ExistingContent[]> {
  const results = await Promise.allSettled(
    urls.map(url => scrapeExistingContent(url))
  );

  return results
    .filter(
      (result): result is PromiseFulfilledResult<ExistingContent> =>
        result.status === 'fulfilled' && result.value !== null
    )
    .map(result => result.value);
}

/**
 * Check if a topic is similar to existing pages from website audit
 */
export async function checkTopicAgainstSitePages(
  topicTitle: string,
  topicKeyword: string,
  sitePages: Array<{ url: string; title: string; content_preview: string; meta_description: string }>
): Promise<{ isDuplicate: boolean; similarityScore: number; matchedUrls: string[]; warnings: string[] }> {
  const warnings: string[] = [];
  const matchedUrls: string[] = [];
  let maxSimilarity = 0;

  // Check title similarity
  for (const page of sitePages) {
    const titleSimilarity = calculateTextSimilarity(topicTitle, page.title);

    if (titleSimilarity > 60) {
      warnings.push(
        `⚠️ Topic similar to existing page: "${page.title}" (${titleSimilarity.toFixed(0)}% match)`
      );
      matchedUrls.push(page.url);
      maxSimilarity = Math.max(maxSimilarity, titleSimilarity);
    }
  }

  // Check keyword against page content
  const keywordLower = topicKeyword.toLowerCase();
  for (const page of sitePages) {
    const pageContent = `${page.title} ${page.meta_description} ${page.content_preview}`.toLowerCase();

    // Check if keyword is prominent in page
    const keywordOccurrences = (pageContent.match(new RegExp(keywordLower, 'g')) || []).length;
    if (keywordOccurrences > 2) {
      const keywordSimilarity = Math.min(keywordOccurrences * 15, 100); // Scale occurrences to similarity score

      if (keywordSimilarity > 50 && !matchedUrls.includes(page.url)) {
        warnings.push(
          `🔍 Keyword "${topicKeyword}" already covered in: ${page.url}`
        );
        matchedUrls.push(page.url);
        maxSimilarity = Math.max(maxSimilarity, keywordSimilarity);
      }
    }
  }

  // AI semantic check if we have potential matches
  if (maxSimilarity > 40 && sitePages.length > 0) {
    const relevantPages = sitePages.slice(0, 3).map(p => ({
      url: p.url,
      title: p.title,
      excerpt: p.meta_description || p.content_preview.slice(0, 200)
    }));

    const semanticCheck = await performSemanticSimilarityCheck(
      topicTitle,
      `Keyword: ${topicKeyword}`,
      relevantPages
    );

    if (semanticCheck.isDuplicate) {
      warnings.push(
        `🤖 AI: This topic overlaps with existing content - ${semanticCheck.reason}`
      );
      maxSimilarity = Math.max(maxSimilarity, semanticCheck.score);
    }
  }

  return {
    isDuplicate: maxSimilarity > 65, // Threshold for flagging as duplicate
    similarityScore: Math.round(maxSimilarity),
    matchedUrls,
    warnings
  };
}
