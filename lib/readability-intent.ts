/**
 * Intent-based readability scoring
 * Analyzes keywords and audience to determine target reading level
 * Content is scored on how well it matches the INTENT, not absolute simplicity
 */

export interface ReadabilityIntent {
  targetFleschScore: number;
  readingLevel: string;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Analyze keywords and audience to determine target Flesch Reading Ease score
 */
export function analyzeReadabilityIntent(
  keywords: string[],
  targetAudience: string
): ReadabilityIntent {
  const audienceLower = targetAudience.toLowerCase();
  const keywordLower = keywords.map(kw => kw.toLowerCase());

  // Technical indicators suggest lower Flesch scores (more complex)
  const technicalIndicators = [
    'api', 'rest', 'php', 'development', 'implementation', 'optimization',
    'configuration', 'integration', 'authentication', 'migration', 'deployment',
    'framework', 'architecture', 'infrastructure', 'database', 'server', 'cloud',
    'devops', 'kubernetes', 'docker', 'microservices', 'software', 'programming',
    'code', 'algorithm', 'compiler', 'debugging'
  ];

  // Professional indicators suggest moderate Flesch scores
  const professionalIndicators = [
    'business', 'strategy', 'professional', 'services', 'consulting',
    'management', 'planning', 'analysis', 'marketing', 'sales', 'revenue',
    'roi', 'b2b', 'enterprise', 'corporate', 'executive', 'leadership',
    'compliance', 'regulations', 'financial', 'investment'
  ];

  // Consumer indicators suggest higher Flesch scores (simpler)
  const consumerIndicators = [
    'how to', 'guide', 'tips', 'easy', 'simple', 'beginner',
    'home', 'family', 'personal', 'diy', 'tutorial', 'basic',
    'step-by-step', 'quick', 'everyday', 'anyone', 'everyone'
  ];

  // Count matches in keywords
  let technicalCount = 0;
  let professionalCount = 0;
  let consumerCount = 0;

  keywordLower.forEach(keyword => {
    if (technicalIndicators.some(term => keyword.includes(term))) technicalCount++;
    if (professionalIndicators.some(term => keyword.includes(term))) professionalCount++;
    if (consumerIndicators.some(term => keyword.includes(term))) consumerCount++;
  });

  // Analyze audience demographics
  const isOlderAudience = /\b(40|50|60|70|senior|elderly|retiree)\b/.test(audienceLower);
  const isYoungerAudience = /\b(teen|young|student|beginner)\b/.test(audienceLower);
  const isDeveloperAudience = /\b(developer|engineer|programmer|technical)\b/.test(audienceLower);
  const isBusinessAudience = /\b(executive|manager|business|professional|b2b)\b/.test(audienceLower);
  const isGeneralPublic = /\b(public|consumer|homeowner|parent|family|anyone)\b/.test(audienceLower);
  const isEmotionalTopic = /\b(grief|memorial|loss|funeral|remembrance|legacy|death)\b/.test(audienceLower + ' ' + keywordLower.join(' '));

  // Determine target Flesch score based on analysis
  let targetFleschScore = 55; // Default: educated general audience
  let readingLevel = 'Professional/Educated Adults (10th-12th grade)';
  let reasoning = 'Default for educated general audience';
  let confidence: 'high' | 'medium' | 'low' = 'medium';

  // Technical content for developers
  if (technicalCount > keywords.length * 0.4 || isDeveloperAudience) {
    targetFleschScore = 35;
    readingLevel = 'Technical/Expert (College Graduate)';
    reasoning = 'High technical content requires specialized terminology';
    confidence = 'high';
  }
  // Professional content
  else if (professionalCount > keywords.length * 0.3 || isBusinessAudience) {
    targetFleschScore = 50;
    readingLevel = 'Professional/Business (College level)';
    reasoning = 'Business/professional audience expects formal language';
    confidence = 'high';
  }
  // Consumer/general public
  else if (consumerCount > keywords.length * 0.3 || isGeneralPublic) {
    targetFleschScore = 70;
    readingLevel = 'General Public (7th-8th grade)';
    reasoning = 'Consumer content should be accessible to broad audience';
    confidence = 'high';
  }
  // Emotional topics for older adults (Firefly Grove case)
  else if (isEmotionalTopic && isOlderAudience) {
    targetFleschScore = 58;
    readingLevel = 'Accessible Adults (10th grade)';
    reasoning = 'Emotional topics for adults 40+ need clarity during difficult times';
    confidence = 'high';
  }
  // Younger/beginner audience
  else if (isYoungerAudience) {
    targetFleschScore = 75;
    readingLevel = 'Teens/Beginners (6th-7th grade)';
    reasoning = 'Young or beginner audience needs simple, clear language';
    confidence = 'high';
  }

  // Adjust for mixed signals
  if (technicalCount > 0 && consumerCount > 0) {
    // Technical "how-to" guides
    targetFleschScore = 60;
    readingLevel = 'Technical Consumers (8th-9th grade)';
    reasoning = 'Technical topics for general audience - balance clarity with accuracy';
    confidence = 'medium';
  }

  return {
    targetFleschScore,
    readingLevel,
    reasoning,
    confidence
  };
}

/**
 * Calculate readability score based on how close content matches target intent
 * Returns score 0-100 where higher = better match to intended reading level
 */
export function scoreAgainstIntent(
  actualFleschScore: number,
  targetFleschScore: number
): {
  score: number;
  gap: number;
  assessment: string;
} {
  const gap = Math.abs(actualFleschScore - targetFleschScore);

  let score: number;
  let assessment: string;

  if (gap <= 5) {
    // Perfect match!
    score = 95 + (5 - gap); // 95-100
    assessment = 'Excellent - perfect match for target audience';
  } else if (gap <= 10) {
    // Very good - close to target
    score = 85 + (10 - gap); // 85-94
    assessment = 'Very Good - close to target reading level';
  } else if (gap <= 15) {
    // Good - within acceptable range
    score = 70 + (15 - gap); // 70-84
    assessment = 'Good - within acceptable range';
  } else if (gap <= 20) {
    // Fair - noticeable but not critical
    score = 55 + (20 - gap); // 55-69
    assessment = actualFleschScore < targetFleschScore
      ? 'Fair - somewhat too complex for audience'
      : 'Fair - somewhat too simple for audience';
  } else if (gap <= 30) {
    // Poor - significant mismatch
    score = 35 + (30 - gap); // 35-54
    assessment = actualFleschScore < targetFleschScore
      ? 'Poor - too complex for target audience'
      : 'Poor - too simple, lacks depth for audience';
  } else {
    // Critical - major mismatch
    score = Math.max(10, 35 - (gap - 30)); // 10-34
    assessment = actualFleschScore < targetFleschScore
      ? 'Critical - far too complex, audience cannot understand'
      : 'Critical - far too simple, audience will not take seriously';
  }

  return {
    score: Math.round(score),
    gap,
    assessment
  };
}

/**
 * Get reading level description from Flesch score
 */
export function getReadingLevelDescription(fleschScore: number): string {
  if (fleschScore >= 90) return '5th Grade (Very Easy)';
  if (fleschScore >= 80) return '6th Grade (Easy)';
  if (fleschScore >= 70) return '7th Grade (Fairly Easy)';
  if (fleschScore >= 60) return '8th-9th Grade (Standard)';
  if (fleschScore >= 50) return '10th-12th Grade (Fairly Difficult)';
  if (fleschScore >= 30) return 'College (Difficult)';
  return 'College Graduate (Very Difficult)';
}
