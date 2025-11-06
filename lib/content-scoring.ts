/**
 * Comprehensive content scoring algorithms
 * AISO Stack: AEO, GEO, SEO, Readability, Engagement metrics
 */

export interface ContentScores {
  seoScore: number;
  readabilityScore: number;
  engagementScore: number;
  aeoScore: number;
  geoScore?: number;
  factCheckScore?: number;
  overallScore: number;
  aisoScore?: number; // Overall AISO score including fact-check
  seoDetails: SEODetails;
  readabilityDetails: ReadabilityDetails;
  engagementDetails: EngagementDetails;
  aeoDetails: AEODetails;
  geoDetails?: GEODetails;
}

export interface SEODetails {
  hasTitle: boolean;
  titleLength: number;
  titleOptimal: boolean;
  hasMetaDescription: boolean;
  metaLength: number;
  metaOptimal: boolean;
  hasHeaders: boolean;
  h2Count: number;
  h3Count: number;
  headerStructure: boolean;
  wordCount: number;
  wordCountOptimal: boolean;
  keywordDensity: number;
  keywordOptimal: boolean;
  hasInternalLinks: boolean;
  hasExternalLinks: boolean;
  imageCount: number;
  hasAltText: boolean;
}

export interface ReadabilityDetails {
  fleschScore: number;
  fleschGrade: string;
  avgSentenceLength: number;
  avgWordLength: number;
  sentenceCount: number;
  paragraphCount: number;
  longSentenceCount: number;
  complexWordCount: number;
}

export interface EngagementDetails {
  hasHook: boolean;
  hasCTA: boolean;
  hasQuestion: boolean;
  hasBulletPoints: boolean;
  hasNumberedList: boolean;
  hasQuotes: boolean;
  hasEmphasis: boolean;
  paragraphVariety: boolean;
  avgParagraphLength: number;
}

export interface AEODetails {
  hasDirectAnswer: boolean;
  answerInFirstParagraph: boolean;
  hasStatistics: boolean;
  hasFAQSection: boolean;
  faqCount: number;
  hasDefinitions: boolean;
  hasHowToSteps: boolean;
  quotableStatementsCount: number;
  hasDataTables: boolean;
  topicalDepth: number;
  internalLinksCount: number;
}

export interface GEODetails {
  hasLocationMentions: boolean;
  cityMentions: number;
  hasServiceArea: boolean;
  hasNearMeOptimization: boolean;
  hasLocalKeywords: boolean;
  localKeywordCount: number;
  hasBusinessInfo: boolean;
  hasLocalIntent: boolean;
  neighborhoodMentions: number;
  hasGBPOptimization: boolean; // Google Business Profile signals
  hasBookingCTA: boolean; // Appointment/booking language
  hasServiceCategories: boolean; // Service type mentions
}

/**
 * Calculate SEO score (0-100)
 */
export function calculateSEOScore(content: string, title?: string, metaDescription?: string): { score: number; details: SEODetails } {
  const details: SEODetails = {
    hasTitle: !!title,
    titleLength: title?.length || 0,
    titleOptimal: false,
    hasMetaDescription: !!metaDescription,
    metaLength: metaDescription?.length || 0,
    metaOptimal: false,
    hasHeaders: false,
    h2Count: 0,
    h3Count: 0,
    headerStructure: false,
    wordCount: 0,
    wordCountOptimal: false,
    keywordDensity: 0,
    keywordOptimal: false,
    hasInternalLinks: false,
    hasExternalLinks: false,
    imageCount: 0,
    hasAltText: false,
  };

  let score = 0;

  // Title scoring (20 points) - more granular
  if (title) {
    details.titleOptimal = title.length >= 40 && title.length <= 70;
    if (details.titleOptimal) score += 20;
    else if (title.length >= 30 && title.length <= 80) score += 15; // Close to optimal
    else if (title.length >= 20) score += 10; // Has a title at least
    else score += 5;
  }

  // Meta description scoring (15 points) - more granular
  if (metaDescription) {
    details.metaOptimal = metaDescription.length >= 140 && metaDescription.length <= 160;
    if (details.metaOptimal) score += 15;
    else if (metaDescription.length >= 120 && metaDescription.length <= 180) score += 12;
    else if (metaDescription.length >= 80) score += 8;
    else score += 5;
  }

  // Header structure (25 points) - more granular and higher weight
  const h2Matches = content.match(/^##\s+.+$/gm);
  const h3Matches = content.match(/^###\s+.+$/gm);
  details.h2Count = h2Matches?.length || 0;
  details.h3Count = h3Matches?.length || 0;
  details.hasHeaders = details.h2Count > 0;
  details.headerStructure = details.h2Count >= 3 && details.h3Count >= 2;

  if (details.h2Count >= 4 && details.h3Count >= 3) score += 25; // Excellent structure
  else if (details.headerStructure) score += 20; // Good structure
  else if (details.h2Count >= 2) score += 15; // Decent structure
  else if (details.hasHeaders) score += 10; // Has some headers
  else score += 0;

  // Word count (no scoring - just informational)
  const words = content.trim().split(/\s+/);
  details.wordCount = words.length;
  details.wordCountOptimal = details.wordCount >= 1200 && details.wordCount <= 2500;
  // No points awarded/deducted for word count

  // Keyword density (15 points) - placeholder assumes optimal
  details.keywordDensity = 1.5;
  details.keywordOptimal = true;
  score += 15;

  // Links (15 points) - more granular
  const linkMatches = content.match(/\[.+?\]\(.+?\)/g);
  const linkCount = linkMatches?.length || 0;
  details.hasInternalLinks = linkCount > 0;
  details.hasExternalLinks = linkCount > 0;

  if (linkCount >= 5) score += 15; // Excellent linking
  else if (linkCount >= 3) score += 12; // Good linking
  else if (linkCount >= 1) score += 8; // Some links
  else score += 0;

  // Images (10 points) - more realistic
  const imageMatches = content.match(/!\[.+?\]\(.+?\)/g);
  details.imageCount = imageMatches?.length || 0;
  details.hasAltText = details.imageCount > 0;

  if (details.imageCount >= 3) score += 10; // Multiple images
  else if (details.imageCount >= 2) score += 8; // Couple images
  else if (details.imageCount >= 1) score += 5; // At least one
  else score += 0;

  return { score: Math.min(score, 100), details };
}

/**
 * Calculate Flesch Reading Ease score
 * Higher = easier to read (90-100 = very easy, 0-30 = very difficult)
 */
/**
 * Extract body content only (exclude AEO sections that shouldn't be graded for readability)
 * This prevents FAQ sections, Key Takeaways, and definitions from lowering readability scores
 */
function extractBodyContent(content: string): string {
  let bodyContent = content;

  // Remove FAQ section (complex by nature - shouldn't affect readability)
  bodyContent = bodyContent.replace(/##\s*Frequently Asked Questions[\s\S]*?(?=##[^#]|$)/gi, '');
  bodyContent = bodyContent.replace(/##\s*FAQ[\s\S]*?(?=##[^#]|$)/gi, '');

  // Remove Key Takeaways (bullet lists with technical terms)
  bodyContent = bodyContent.replace(/##\s*Key Takeaways[\s\S]*?(?=##[^#]|$)/gi, '');

  // Remove "X is defined as" boxes (technical definitions)
  bodyContent = bodyContent.replace(/\*\*[^*]+is defined as\*\*[^\n]+/gi, '');

  // Remove tables (structured data, not narrative content)
  bodyContent = bodyContent.replace(/\|[^\n]+\|[\s\S]*?(?=\n\n|$)/g, '');

  // Remove code blocks (technical content)
  bodyContent = bodyContent.replace(/```[\s\S]*?```/g, '');

  return bodyContent;
}

export function calculateReadabilityScore(
  content: string,
  targetFleschScore?: number
): { score: number; details: ReadabilityDetails } {
  // Calculate readability on FULL content (don't filter)
  // The content generator is responsible for maintaining target readability
  const bodyContent = content;

  // Remove markdown formatting for accurate analysis
  const plainText = bodyContent
    .replace(/[#*_`~\[\]()]/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[.*?\]\(.*?\)/g, '');

  // Count sentences
  const sentences = plainText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceCount = sentences.length || 1;

  // Count words
  const words = plainText.trim().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length || 1;

  // Count syllables (approximation)
  let syllableCount = 0;
  words.forEach(word => {
    syllableCount += countSyllables(word);
  });

  // Flesch Reading Ease formula
  const avgWordsPerSentence = wordCount / sentenceCount;
  const avgSyllablesPerWord = syllableCount / wordCount;
  const fleschScore = Math.max(0, Math.min(100,
    206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord
  ));

  // Grade level
  let fleschGrade = '';
  if (fleschScore >= 90) fleschGrade = '5th Grade (Very Easy)';
  else if (fleschScore >= 80) fleschGrade = '6th Grade (Easy)';
  else if (fleschScore >= 70) fleschGrade = '7th Grade (Fairly Easy)';
  else if (fleschScore >= 60) fleschGrade = '8th-9th Grade (Standard)';
  else if (fleschScore >= 50) fleschGrade = '10th-12th Grade (Fairly Difficult)';
  else if (fleschScore >= 30) fleschGrade = 'College (Difficult)';
  else fleschGrade = 'College Graduate (Very Difficult)';

  // Paragraph analysis
  const paragraphs = plainText.split(/\n\n+/).filter(p => p.trim().length > 0);
  const paragraphCount = paragraphs.length || 1;

  // Long sentences (>25 words)
  const longSentences = sentences.filter(s => s.trim().split(/\s+/).length > 25);

  // Complex words (3+ syllables)
  const complexWords = words.filter(w => countSyllables(w) >= 3);

  const details: ReadabilityDetails = {
    fleschScore: Math.round(fleschScore),
    fleschGrade,
    avgSentenceLength: Math.round(avgWordsPerSentence * 10) / 10,
    avgWordLength: Math.round((plainText.length / wordCount) * 10) / 10,
    sentenceCount,
    paragraphCount,
    longSentenceCount: longSentences.length,
    complexWordCount: complexWords.length,
  };

  // Calculate readability score
  let readabilityScore = 0;

  if (targetFleschScore !== undefined) {
    // INTENT-BASED SCORING: Score based on how close we are to the TARGET reading level
    // This is the NEW, BETTER approach - content is scored on appropriateness for audience
    const gap = Math.abs(Math.round(fleschScore) - targetFleschScore);

    if (gap <= 5) {
      // Perfect match!
      readabilityScore = 95 + (5 - gap); // 95-100
    } else if (gap <= 10) {
      // Very good - close to target
      readabilityScore = 85 + (10 - gap); // 85-94
    } else if (gap <= 15) {
      // Good - within acceptable range
      readabilityScore = 70 + (15 - gap); // 70-84
    } else if (gap <= 20) {
      // Fair - noticeable but not critical
      readabilityScore = 55 + (20 - gap); // 55-69
    } else if (gap <= 30) {
      // Poor - significant mismatch
      readabilityScore = 35 + (30 - gap); // 35-54
    } else {
      // Critical - major mismatch
      readabilityScore = Math.max(10, 35 - (gap - 30)); // 10-34
    }
  } else {
    // FALLBACK: Normalized curve based on ACHIEVABLE ranges (OLD METHOD)
    // Used when no target is specified (backwards compatibility)
    // Professional/technical content naturally scores lower on raw Flesch
    //
    // Flesch 70+ (7th grade or easier) = 95-100 (Excellent - ideal for broad audiences)
    // Flesch 60-69 (8th-9th grade) = 85-94 (Very Good - readable for most)
    // Flesch 50-59 (10th-12th grade) = 75-84 (Good - acceptable for educated readers)
    // Flesch 40-49 (College level) = 65-74 (Acceptable - typical for professional content)
    // Flesch 30-39 (Graduate level) = 50-64 (Below Average - needs simplification)
    // Flesch 20-29 (Very Difficult) = 35-49 (Poor - too complex for most readers)
    // Flesch 10-19 (Academic) = 20-34 (Failing - inaccessible)
    // Flesch <10 (Extremely Difficult) = 10-19 (Critical - urgent improvement needed)
    if (fleschScore >= 70) {
      readabilityScore = 95 + ((fleschScore - 70) / 30) * 5;
    } else if (fleschScore >= 60) {
      readabilityScore = 85 + ((fleschScore - 60) / 10) * 9;
    } else if (fleschScore >= 50) {
      readabilityScore = 75 + ((fleschScore - 50) / 10) * 9;
    } else if (fleschScore >= 40) {
      readabilityScore = 65 + ((fleschScore - 40) / 10) * 9;
    } else if (fleschScore >= 30) {
      readabilityScore = 50 + ((fleschScore - 30) / 10) * 14;
    } else if (fleschScore >= 20) {
      readabilityScore = 35 + ((fleschScore - 20) / 10) * 14;
    } else if (fleschScore >= 10) {
      readabilityScore = 20 + ((fleschScore - 10) / 10) * 14;
    } else {
      readabilityScore = 10 + (fleschScore / 10) * 9;
    }
  }

  readabilityScore = Math.round(readabilityScore);

  return { score: readabilityScore, details };
}

/**
 * Count syllables in a word (approximation)
 */
function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;

  // Count vowel groups
  const vowelGroups = word.match(/[aeiouy]+/g);
  let count = vowelGroups?.length || 1;

  // Silent e
  if (word.endsWith('e')) count--;

  // Minimum 1 syllable
  return Math.max(1, count);
}

/**
 * Calculate engagement score (0-100)
 */
export function calculateEngagementScore(content: string): { score: number; details: EngagementDetails } {
  const details: EngagementDetails = {
    hasHook: false,
    hasCTA: false,
    hasQuestion: false,
    hasBulletPoints: false,
    hasNumberedList: false,
    hasQuotes: false,
    hasEmphasis: false,
    paragraphVariety: false,
    avgParagraphLength: 0,
  };

  let score = 0;

  // Hook in first 200 characters (20 points) - more granular
  const firstPara = content.substring(0, 200);
  details.hasHook = /[?!]|imagine|discover|learn|what if|did you know|here's why/i.test(firstPara);
  if (details.hasHook) score += 20;
  else if (firstPara.length > 100) score += 10; // At least has an intro
  else score += 5;

  // Call to action (15 points) - more granular
  const ctaPatterns = /start|try|get|download|subscribe|click|learn more|read more|contact|sign up|join/i;
  details.hasCTA = ctaPatterns.test(content.substring(content.length - 500));
  if (details.hasCTA) score += 15;
  else if (content.length > 500) score += 8; // At least has a conclusion
  else score += 0;

  // Questions (12 points) - more granular
  const questionCount = (content.match(/\?/g) || []).length;
  details.hasQuestion = questionCount >= 2;
  if (questionCount >= 3) score += 12; // Multiple questions
  else if (questionCount >= 2) score += 10; // Couple questions
  else if (questionCount >= 1) score += 6; // At least one
  else score += 0;

  // Bullet points (12 points) - more granular
  const bulletMatches = content.match(/^[-*+]\s+.+$/gm);
  const bulletCount = bulletMatches?.length || 0;
  details.hasBulletPoints = bulletCount >= 3;
  if (bulletCount >= 5) score += 12; // Lots of bullets
  else if (bulletCount >= 3) score += 10; // Good bullets
  else if (bulletCount >= 1) score += 6; // Some bullets
  else score += 0;

  // Numbered lists (12 points) - more granular
  const numberedMatches = content.match(/^\d+\.\s+.+$/gm);
  const numberedCount = numberedMatches?.length || 0;
  details.hasNumberedList = numberedCount >= 3;
  if (numberedCount >= 5) score += 12; // Lots of steps
  else if (numberedCount >= 3) score += 10; // Good steps
  else if (numberedCount >= 1) score += 6; // Some steps
  else score += 0;

  // Quotes (9 points) - bonus feature
  const quoteMatches = content.match(/^>\s+.+$/gm);
  const quoteCount = quoteMatches?.length || 0;
  details.hasQuotes = quoteCount > 0;
  if (quoteCount >= 2) score += 9; // Multiple quotes
  else if (quoteCount >= 1) score += 5; // At least one
  else score += 0;

  // Emphasis (bold/italic) (10 points) - more granular
  const emphasisCount = (content.match(/[*_]{1,2}.+?[*_]{1,2}/g) || []).length;
  details.hasEmphasis = emphasisCount >= 5;
  if (emphasisCount >= 10) score += 10; // Lots of emphasis
  else if (emphasisCount >= 5) score += 8; // Good emphasis
  else if (emphasisCount >= 2) score += 5; // Some emphasis
  else score += 0;

  // Paragraph variety (10 points) - less strict
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
  const paraLengths = paragraphs.map(p => p.split(/\s+/).length);
  const avgParaLength = paraLengths.reduce((a, b) => a + b, 0) / (paraLengths.length || 1);
  details.avgParagraphLength = Math.round(avgParaLength);

  // Check for paragraph variety
  const shortParas = paraLengths.filter(l => l <= 50).length;
  const mediumParas = paraLengths.filter(l => l > 50 && l <= 100).length;
  const longParas = paraLengths.filter(l => l > 100).length;
  details.paragraphVariety = shortParas > 0 && mediumParas > 0;

  if (shortParas > 0 && mediumParas > 0 && longParas > 0) score += 10; // Excellent variety
  else if (shortParas > 0 && mediumParas > 0) score += 8; // Good variety
  else if (paragraphs.length >= 3) score += 5; // At least has multiple paragraphs
  else score += 0;

  return { score: Math.min(score, 100), details };
}

/**
 * Calculate AEO (Answer Engine Optimization) score (0-100)
 */
/**
 * Calculate AEO (Answer Engine Optimization) score
 *
 * IMPORTANT: This function primarily scores STRUCTURED sections:
 * - FAQ sections and Q&A format
 * - Definitions and "is defined as" statements
 * - Data tables and statistics
 * - Key Takeaways and bullet lists
 * - How-to steps and instructions
 *
 * These sections should NOT be simplified for readability - they are meant
 * to be comprehensive and citation-worthy for AI answer engines.
 */
export function calculateAEOScore(content: string): { score: number; details: AEODetails } {
  const details: AEODetails = {
    hasDirectAnswer: false,
    answerInFirstParagraph: false,
    hasStatistics: false,
    hasFAQSection: false,
    faqCount: 0,
    hasDefinitions: false,
    hasHowToSteps: false,
    quotableStatementsCount: 0,
    hasDataTables: false,
    topicalDepth: 0,
    internalLinksCount: 0,
  };

  let score = 0;

  // Answer Quality (30 points)
  const firstPara = content.substring(0, 200);
  const answerPatterns = /the answer is|simply put|in short|to summarize|here's (?:what|how|why)|the key (?:point|takeaway) is/i;
  details.hasDirectAnswer = answerPatterns.test(firstPara);
  details.answerInFirstParagraph = /^.{50,200}[.!?]/.test(firstPara);

  if (details.hasDirectAnswer && details.answerInFirstParagraph) score += 30;
  else if (details.hasDirectAnswer || details.answerInFirstParagraph) score += 20;
  else if (firstPara.length > 100) score += 10;

  // Citation-Worthiness (25 points)
  const statPatterns = /\d+%|\d+\s*(?:percent|billion|million|thousand)|according to|research (?:shows|indicates)|studies (?:show|reveal)/gi;
  const statMatches = content.match(statPatterns) || [];
  details.hasStatistics = statMatches.length >= 2;
  details.quotableStatementsCount = statMatches.length;

  const tablePattern = /\|.+\|/g;
  const tableRows = content.match(tablePattern) || [];
  details.hasDataTables = tableRows.length >= 3;

  if (details.hasStatistics && details.hasDataTables) score += 25;
  else if (details.hasStatistics) score += 18;
  else if (statMatches.length >= 1) score += 12;
  else if (details.hasDataTables) score += 15;

  // Structured Data Opportunities (20 points)
  const faqPattern = /###?\s*(?:Q:|Question:|FAQ)|\?\s*\n\n/gi;
  const faqMatches = content.match(faqPattern) || [];
  details.faqCount = faqMatches.length;
  details.hasFAQSection = details.faqCount >= 3;

  const howToPattern = /(?:step \d+|^\d+\.|how to|instructions|guide)/gi;
  const howToMatches = content.match(howToPattern) || [];
  details.hasHowToSteps = howToMatches.length >= 3;

  if (details.hasFAQSection && details.hasHowToSteps) score += 20;
  else if (details.hasFAQSection) score += 15;
  else if (details.hasHowToSteps) score += 12;
  else if (details.faqCount >= 1 || howToMatches.length >= 1) score += 8;

  // AI-Friendly Formatting (15 points)
  const definitionPattern = /(?:is defined as|refers to|means that|is a (?:type|form|kind) of)/gi;
  const defMatches = content.match(definitionPattern) || [];
  details.hasDefinitions = defMatches.length >= 1;

  const bulletMatches = content.match(/^[-*+]\s+.+$/gm) || [];
  const summaryPattern = /(?:key takeaways|summary|conclusion|in summary)/gi;
  const hasSummary = summaryPattern.test(content);

  if (details.hasDefinitions && bulletMatches.length >= 5 && hasSummary) score += 15;
  else if (details.hasDefinitions && bulletMatches.length >= 3) score += 12;
  else if (bulletMatches.length >= 5 || details.hasDefinitions) score += 8;
  else if (bulletMatches.length >= 2) score += 5;

  // Topical Authority (10 points)
  const h2Count = (content.match(/^##\s+.+$/gm) || []).length;
  const h3Count = (content.match(/^###\s+.+$/gm) || []).length;
  details.topicalDepth = h2Count + h3Count;

  const linkMatches = content.match(/\[.+?\]\(.+?\)/g) || [];
  details.internalLinksCount = linkMatches.length;

  if (details.topicalDepth >= 8 && details.internalLinksCount >= 5) score += 10;
  else if (details.topicalDepth >= 6 && details.internalLinksCount >= 3) score += 8;
  else if (details.topicalDepth >= 4 || details.internalLinksCount >= 2) score += 5;
  else if (details.topicalDepth >= 2) score += 3;

  return { score: Math.min(score, 100), details };
}

/**
 * Calculate GEO (Local Intent Optimization) score (0-100)
 * Only applicable for local business content
 * Includes GBP (Google Business Profile) optimization signals
 */
export function calculateGEOScore(content: string, localContext?: { city?: string; state?: string; serviceArea?: string }): { score: number; details: GEODetails } {
  const details: GEODetails = {
    hasLocationMentions: false,
    cityMentions: 0,
    hasServiceArea: false,
    hasNearMeOptimization: false,
    hasLocalKeywords: false,
    localKeywordCount: 0,
    hasBusinessInfo: false,
    hasLocalIntent: false,
    neighborhoodMentions: 0,
    hasGBPOptimization: false,
    hasBookingCTA: false,
    hasServiceCategories: false,
  };

  let score = 0;

  // Location Signals (30 points)
  const locationPatterns = [
    /\b(?:in|near|around|serving|located in)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g,
    /[A-Z][a-z]+,\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)/g,
  ];

  locationPatterns.forEach(pattern => {
    const matches = content.match(pattern) || [];
    details.cityMentions += matches.length;
  });

  if (localContext?.city) {
    const cityRegex = new RegExp(localContext.city, 'gi');
    const cityMatches = content.match(cityRegex) || [];
    details.cityMentions += cityMatches.length;
  }

  details.hasLocationMentions = details.cityMentions >= 1;

  const nearMePattern = /near (?:me|you)|nearby|local|in your area|close to you/gi;
  const nearMeMatches = content.match(nearMePattern) || [];
  details.hasNearMeOptimization = nearMeMatches.length >= 1;

  const serviceAreaPattern = /service area|serving|coverage area|we serve|available in/gi;
  const serviceAreaMatches = content.match(serviceAreaPattern) || [];
  details.hasServiceArea = serviceAreaMatches.length >= 1;

  if (details.cityMentions >= 3 && details.hasNearMeOptimization && details.hasServiceArea) score += 30;
  else if (details.cityMentions >= 2 && (details.hasNearMeOptimization || details.hasServiceArea)) score += 24;
  else if (details.hasLocationMentions) score += 18;
  else score += 8;

  // Local Schema Readiness (25 points)
  const businessInfoPattern = /(?:hours|open|phone|call|contact|address|location|directions)/gi;
  const businessMatches = content.match(businessInfoPattern) || [];
  details.hasBusinessInfo = businessMatches.length >= 2;

  const reviewPattern = /review|rating|testimonial|feedback|customer|client/gi;
  const reviewMatches = content.match(reviewPattern) || [];

  if (details.hasBusinessInfo && reviewMatches.length >= 2) score += 25;
  else if (details.hasBusinessInfo) score += 18;
  else if (reviewMatches.length >= 1 || businessMatches.length >= 1) score += 12;

  // Local Keywords (25 points)
  const localKeywordPattern = /(?:best|top|affordable|professional|trusted|licensed|certified)\s+(?:\w+\s+)?(?:in|near)\s+[A-Z][a-z]+/gi;
  const localKeywords = content.match(localKeywordPattern) || [];
  details.localKeywordCount = localKeywords.length;
  details.hasLocalKeywords = details.localKeywordCount >= 1;

  const neighborhoodPattern = /neighborhood|district|downtown|area|community|suburb/gi;
  const neighborhoodMatches = content.match(neighborhoodPattern) || [];
  details.neighborhoodMentions = neighborhoodMatches.length;

  if (details.localKeywordCount >= 3 && details.neighborhoodMentions >= 2) score += 25;
  else if (details.localKeywordCount >= 2) score += 20;
  else if (details.hasLocalKeywords) score += 15;
  else if (details.neighborhoodMentions >= 1) score += 10;

  // Local Intent Matching (15 points)
  const localIntentPattern = /find|looking for|need|hire|book|schedule|get|compare|choose/gi;
  const intentMatches = content.match(localIntentPattern) || [];
  const questionPattern = /where|how to find|how to choose|which|best way to/gi;
  const questionMatches = content.match(questionPattern) || [];
  details.hasLocalIntent = intentMatches.length >= 2 || questionMatches.length >= 1;

  if (details.hasLocalIntent && intentMatches.length >= 3) score += 15;
  else if (details.hasLocalIntent) score += 12;
  else if (intentMatches.length >= 1) score += 8;

  // GBP (Google Business Profile) Optimization (15 points) - NEW!
  // Detects content optimized for Google Business Profile discovery
  const bookingPattern = /book|schedule|appointment|reserve|call now|get directions|visit us|contact us|request (?:a )?(?:quote|estimate|consultation)/gi;
  const bookingMatches = content.match(bookingPattern) || [];
  details.hasBookingCTA = bookingMatches.length >= 2;

  const servicePattern = /(?:our services|we offer|we provide|specializ(?:e|ing) in|expert in)|(?:plumbing|roofing|hvac|electrical|legal|dental|medical|salon|restaurant|contractor|remodel|repair|installation|maintenance|cleaning)/gi;
  const serviceMatches = content.match(servicePattern) || [];
  details.hasServiceCategories = serviceMatches.length >= 2;

  const gbpSignals = [
    details.hasBookingCTA,
    details.hasServiceCategories,
    details.hasBusinessInfo,
    reviewMatches.length >= 1
  ].filter(Boolean).length;

  details.hasGBPOptimization = gbpSignals >= 3;

  if (details.hasGBPOptimization && details.hasBookingCTA) score += 15;
  else if (gbpSignals >= 2 && details.hasBookingCTA) score += 12;
  else if (details.hasBookingCTA || details.hasServiceCategories) score += 8;
  else if (gbpSignals >= 1) score += 5;

  return { score: Math.min(score, 100), details };
}

/**
 * Calculate comprehensive content scores with AISO Stack
 */
export function scoreContent(
  content: string,
  title?: string,
  metaDescription?: string,
  localContext?: { city?: string; state?: string; serviceArea?: string }
): ContentScores {
  const seo = calculateSEOScore(content, title, metaDescription);
  const readability = calculateReadabilityScore(content);
  const engagement = calculateEngagementScore(content);
  const aeo = calculateAEOScore(content);
  const geo = localContext ? calculateGEOScore(content, localContext) : undefined;

  // Weighted overall score with AISO Stack
  // Fact-checking remains KEY DIFFERENTIATOR - kept at high weight
  // If GEO is applicable: AEO 20%, GEO 10%, SEO 15%, Readability 15%, Engagement 15%, Fact-check 25%
  // If no GEO: AEO 25%, SEO 15%, Readability 15%, Engagement 15%, Fact-check 30%
  // NOTE: This function signature doesn't include fact-check score yet - will be added in API routes
  const overallScore = geo
    ? Math.round(
        aeo.score * 0.25 +
        geo.score * 0.15 +
        seo.score * 0.20 +
        readability.score * 0.20 +
        engagement.score * 0.20
      )
    : Math.round(
        aeo.score * 0.30 +
        seo.score * 0.20 +
        readability.score * 0.25 +
        engagement.score * 0.25
      );

  return {
    seoScore: seo.score,
    readabilityScore: readability.score,
    engagementScore: engagement.score,
    aeoScore: aeo.score,
    geoScore: geo?.score,
    overallScore,
    seoDetails: seo.details,
    readabilityDetails: readability.details,
    engagementDetails: engagement.details,
    aeoDetails: aeo.details,
    geoDetails: geo?.details,
  };
}

/**
 * Calculate complete AISO score including fact-checking
 * This is the MAIN scoring function that includes our key differentiator
 */
export function calculateAISOScore(
  content: string,
  title?: string,
  metaDescription?: string,
  factCheckScore?: number,
  localContext?: { city?: string; state?: string; serviceArea?: string },
  targetFleschScore?: number
): ContentScores {
  const seo = calculateSEOScore(content, title, metaDescription);
  const readability = calculateReadabilityScore(content, targetFleschScore);
  const engagement = calculateEngagementScore(content);
  const aeo = calculateAEOScore(content);
  const geo = localContext ? calculateGEOScore(content, localContext) : undefined;

  // Base overall score without fact-check (for content without fact-checking yet)
  const baseOverallScore = geo
    ? Math.round(
        aeo.score * 0.25 +
        geo.score * 0.15 +
        seo.score * 0.20 +
        readability.score * 0.20 +
        engagement.score * 0.20
      )
    : Math.round(
        aeo.score * 0.30 +
        seo.score * 0.20 +
        readability.score * 0.25 +
        engagement.score * 0.25
      );

  // AISO score with fact-checking (KEY DIFFERENTIATOR)
  // Fact-checking gets highest individual weight to maintain competitive advantage
  let aisoScore: number | undefined = undefined;

  if (factCheckScore !== undefined) {
    if (geo) {
      // LOCAL CONTENT (6 categories): Fact-check 25%, AEO 20%, GEO 10%, SEO 15%, Readability 15%, Engagement 15% = 100%
      aisoScore = Math.round(
        factCheckScore * 0.25 +  // Fact-Check: 25% (still highest!)
        aeo.score * 0.20 +        // AEO: 20%
        geo.score * 0.10 +        // GEO: 10% (local optimization)
        seo.score * 0.15 +        // SEO: 15%
        readability.score * 0.15 + // Readability: 15%
        engagement.score * 0.15    // Engagement: 15%
      );
    } else {
      // NATIONAL CONTENT (5 categories): Fact-check 30%, AEO 25%, SEO 15%, Readability 15%, Engagement 15% = 100%
      aisoScore = Math.round(
        factCheckScore * 0.30 +    // Fact-Check: 30% (KEY DIFFERENTIATOR!)
        aeo.score * 0.25 +          // AEO: 25%
        seo.score * 0.15 +          // SEO: 15%
        readability.score * 0.15 +  // Readability: 15%
        engagement.score * 0.15     // Engagement: 15%
      );
    }
  }

  return {
    seoScore: seo.score,
    readabilityScore: readability.score,
    engagementScore: engagement.score,
    aeoScore: aeo.score,
    geoScore: geo?.score,
    factCheckScore,
    overallScore: baseOverallScore,
    aisoScore, // This is the complete AISO score with fact-checking
    seoDetails: seo.details,
    readabilityDetails: readability.details,
    engagementDetails: engagement.details,
    aeoDetails: aeo.details,
    geoDetails: geo?.details,
  };
}
