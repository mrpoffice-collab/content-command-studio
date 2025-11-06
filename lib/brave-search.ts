export interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  snippet?: string;
}

export interface ResearchData {
  statistics: string[];
  caseStudies: string[];
  recentTrends: string[];
}

/**
 * Search Brave for content research
 */
export async function searchBrave(query: string): Promise<BraveSearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;

  if (!apiKey) {
    console.warn('BRAVE_SEARCH_API_KEY not set, skipping research');
    return [];
  }

  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`,
      {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
      }
    );

    if (!response.ok) {
      console.error('Brave Search API error:', response.status);
      return [];
    }

    const data = await response.json();

    return (data.web?.results || []).map((result: any) => ({
      title: result.title,
      url: result.url,
      description: result.description,
      snippet: result.extra_snippets?.[0],
    }));
  } catch (error) {
    console.error('Error fetching from Brave Search:', error);
    return [];
  }
}

/**
 * Perform comprehensive research for a topic using Brave Search
 */
export async function researchTopic(
  keyword: string,
  topic: string
): Promise<ResearchData> {
  const currentYear = new Date().getFullYear();

  // Perform parallel searches
  const [statsResults, caseStudyResults, trendsResults] = await Promise.all([
    searchBrave(`${keyword} statistics ${currentYear}`),
    searchBrave(`${keyword} case study examples`),
    searchBrave(`${keyword} trends ${currentYear}`),
  ]);

  // Extract meaningful insights from results
  const statistics = extractStatistics(statsResults);
  const caseStudies = extractCaseStudies(caseStudyResults);
  const recentTrends = extractTrends(trendsResults);

  return {
    statistics: statistics.slice(0, 5), // Top 5 stats
    caseStudies: caseStudies.slice(0, 3), // Top 3 case studies
    recentTrends: recentTrends.slice(0, 4), // Top 4 trends
  };
}

/**
 * Extract statistics from search results
 */
function extractStatistics(results: BraveSearchResult[]): string[] {
  const statistics: string[] = [];

  for (const result of results) {
    const text = `${result.description} ${result.snippet || ''}`;

    // Look for patterns like "X% of", "X in Y", numbers with context
    const statPatterns = [
      /\d+%\s+of[^.!?]+[.!?]/gi,
      /\d+\s+(?:million|billion|thousand)[^.!?]+[.!?]/gi,
      /\$\d+(?:\.\d+)?(?:\s*(?:million|billion|thousand))?[^.!?]+[.!?]/gi,
    ];

    for (const pattern of statPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        statistics.push(...matches.map(m => m.trim()));
      }
    }
  }

  // Remove duplicates and return unique stats
  return [...new Set(statistics)];
}

/**
 * Extract case studies and examples from search results
 */
function extractCaseStudies(results: BraveSearchResult[]): string[] {
  const caseStudies: string[] = [];

  for (const result of results) {
    // Look for company names, examples, or specific implementations
    const description = result.description || result.snippet || '';

    // Check if the result seems to contain a case study or example
    if (
      description.toLowerCase().includes('case study') ||
      description.toLowerCase().includes('example') ||
      description.toLowerCase().includes('company') ||
      description.toLowerCase().includes('success')
    ) {
      const cleanText = description.replace(/\s+/g, ' ').trim();
      if (cleanText.length > 50) {
        caseStudies.push(`${result.title}: ${cleanText}`);
      }
    }
  }

  return caseStudies;
}

/**
 * Extract current trends from search results
 */
function extractTrends(results: BraveSearchResult[]): string[] {
  const trends: string[] = [];

  for (const result of results) {
    const text = `${result.description} ${result.snippet || ''}`;

    // Look for trend indicators
    const trendKeywords = [
      'trend',
      'emerging',
      'growing',
      'increasing',
      'rising',
      'new',
      'latest',
      'recent',
    ];

    const lowerText = text.toLowerCase();
    if (trendKeywords.some(keyword => lowerText.includes(keyword))) {
      const cleanText = text.replace(/\s+/g, ' ').trim();
      if (cleanText.length > 50) {
        // Extract sentences containing trend keywords
        const sentences = cleanText.split(/[.!?]+/);
        for (const sentence of sentences) {
          if (
            trendKeywords.some(keyword =>
              sentence.toLowerCase().includes(keyword)
            ) &&
            sentence.trim().length > 30
          ) {
            trends.push(sentence.trim());
          }
        }
      }
    }
  }

  return [...new Set(trends)]; // Remove duplicates
}
