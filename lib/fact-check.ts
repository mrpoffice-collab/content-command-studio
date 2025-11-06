import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export interface FactCheck {
  claim: string;
  status: 'verified' | 'uncertain' | 'unverified';
  confidence: number; // 0-100
  reasoning: string;
  sources: string[];
}

export interface FactCheckResult {
  overallScore: number; // 0-100, average confidence
  totalClaims: number;
  verifiedClaims: number;
  uncertainClaims: number;
  unverifiedClaims: number;
  factChecks: FactCheck[];
}

export interface SearchResult {
  title: string;
  url: string;
  description: string;
}

/**
 * Search the web using Brave Search API
 */
export async function searchWeb(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;

  if (!apiKey) {
    console.warn('Brave Search API key not configured, skipping web search');
    return [];
  }

  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
      {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
      }
    );

    if (!response.ok) {
      console.error('Brave Search API error:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    const results: SearchResult[] = [];

    if (data.web?.results) {
      for (const result of data.web.results.slice(0, 5)) {
        results.push({
          title: result.title || '',
          url: result.url || '',
          description: result.description || '',
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error searching web:', error);
    return [];
  }
}

/**
 * Extract factual claims from content using OpenAI
 */
async function extractClaims(content: string): Promise<string[]> {
  const prompt = `You are an expert fact-checker. Extract all factual claims from the following blog post that should be verified using web search.

**Content:**
${content}

**Instructions:**
1. Extract specific, verifiable claims (statistics, dates, names, research findings, etc.)
2. Ignore general statements, opinions, or common knowledge
3. Keep claims concise and focused
4. If there are no significant factual claims, return an empty array

**Output Format:**
Return ONLY a JSON array of claim strings:
["claim 1", "claim 2", "claim 3"]

If no claims to verify:
[]`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are an expert fact-checker. Extract factual claims that need verification and return them as a JSON array.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.3,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  const response = completion.choices[0]?.message?.content || '[]';

  // Try to parse as JSON object with claims array
  try {
    const parsed = JSON.parse(response);
    if (parsed.claims && Array.isArray(parsed.claims)) {
      return parsed.claims;
    }
    // If it's already an array
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Fallback: try to extract array using regex
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  }

  return [];
}

/**
 * Verify claims against web search results using OpenAI
 */
async function verifyClaims(
  claims: string[],
  searchResultsMap: Map<string, SearchResult[]>
): Promise<FactCheck[]> {
  if (claims.length === 0) {
    return [];
  }

  // Build search context
  const searchContext = claims.map(claim => {
    const results = searchResultsMap.get(claim) || [];
    return {
      claim,
      sources: results.map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.description,
      })),
    };
  });

  const prompt = `You are an expert fact-checker. Verify the following claims using the provided web search results.

**Claims and Search Results:**
${JSON.stringify(searchContext, null, 2)}

**Instructions:**
For each claim, analyze the search results and determine:
1. Status:
   - "verified": Claim is supported by 2+ credible sources
   - "uncertain": Claim is partially supported or conflicting information
   - "unverified": No supporting evidence found or contradicted by sources
2. Confidence score (0-100) based on evidence quality
3. Brief reasoning explaining your assessment
4. List of source URLs that support or refute the claim

**Output Format:**
Return a JSON object with a "factChecks" array:
{
  "factChecks": [
    {
      "claim": "exact claim text",
      "status": "verified|uncertain|unverified",
      "confidence": 85,
      "reasoning": "Brief explanation",
      "sources": ["url1", "url2"]
    }
  ]
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are an expert fact-checker. Analyze claims against web sources and return structured fact-check results.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.3,
    max_tokens: 8000,
    response_format: { type: 'json_object' },
  });

  const response = completion.choices[0]?.message?.content || '{"factChecks":[]}';

  try {
    const parsed = JSON.parse(response);
    if (parsed.factChecks && Array.isArray(parsed.factChecks)) {
      return parsed.factChecks;
    }
    // If it's already an array
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Fallback: try to extract array using regex
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  }

  return [];
}

/**
 * Perform comprehensive fact-checking on content using web search
 */
export async function performFactCheck(content: string): Promise<FactCheckResult> {
  try {
    // Step 1: Extract factual claims from content
    console.log('Extracting factual claims...');
    const claims = await extractClaims(content);

    if (claims.length === 0) {
      console.log('No factual claims found to verify');
      return {
        overallScore: 100,
        totalClaims: 0,
        verifiedClaims: 0,
        uncertainClaims: 0,
        unverifiedClaims: 0,
        factChecks: [],
      };
    }

    console.log(`Found ${claims.length} claims to verify`);

    // Step 2: Search the web for each claim
    const searchResultsMap = new Map<string, SearchResult[]>();

    for (const claim of claims) {
      console.log(`Searching for: "${claim}"`);
      const results = await searchWeb(claim);
      searchResultsMap.set(claim, results);

      // Rate limiting - wait 200ms between searches
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Step 3: Verify claims using search results
    console.log('Verifying claims with Claude...');
    const factChecks = await verifyClaims(claims, searchResultsMap);

    // Step 4: Calculate statistics
    const totalClaims = factChecks.length;
    const verifiedClaims = factChecks.filter(fc => fc.status === 'verified').length;
    const uncertainClaims = factChecks.filter(fc => fc.status === 'uncertain').length;
    const unverifiedClaims = factChecks.filter(fc => fc.status === 'unverified').length;

    const overallScore = totalClaims > 0
      ? Math.round(factChecks.reduce((sum, fc) => sum + fc.confidence, 0) / totalClaims)
      : 100;

    console.log(`Fact-checking complete: ${verifiedClaims}/${totalClaims} verified`);

    return {
      overallScore,
      totalClaims,
      verifiedClaims,
      uncertainClaims,
      unverifiedClaims,
      factChecks,
    };
  } catch (error) {
    console.error('Error performing fact check:', error);
    // Return a fallback result on error
    return {
      overallScore: 0,
      totalClaims: 0,
      verifiedClaims: 0,
      uncertainClaims: 0,
      unverifiedClaims: 0,
      factChecks: [],
    };
  }
}
