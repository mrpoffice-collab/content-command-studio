import { AEODetails } from '@/lib/content-scoring';

interface AEOScoreCardProps {
  score: number;
  details: AEODetails;
}

/**
 * AEO (Answer Engine Optimization) Score Card Component
 *
 * Displays comprehensive breakdown of how well content is optimized
 * for AI answer engines like ChatGPT Search, Perplexity, Google SGE, Bing Copilot
 *
 * Score Breakdown (0-100):
 * - Answer Quality: 30 points
 * - Citation-Worthiness: 25 points
 * - Structured Data: 20 points
 * - AI-Friendly Formatting: 15 points
 * - Topical Authority: 10 points
 */
export default function AEOScoreCard({ score, details }: AEOScoreCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-700 bg-green-50 border-green-200';
    if (score >= 75) return 'text-blue-700 bg-blue-50 border-blue-200';
    if (score >= 60) return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    return 'text-red-700 bg-red-50 border-red-200';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 85) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Improvement';
  };

  // Calculate component scores
  const answerQualityScore = Math.round(
    (details.hasDirectAnswer ? 15 : 0) +
    (details.answerInFirstParagraph ? 15 : 0)
  );

  const citationWorthinessScore = Math.round(
    (details.hasStatistics ? 10 : 0) +
    (details.quotableStatementsCount >= 3 ? 10 : details.quotableStatementsCount * 3) +
    (details.hasDefinitions ? 5 : 0)
  );

  const structuredDataScore = Math.round(
    (details.hasFAQSection ? 10 : 0) +
    (details.hasHowToSteps ? 5 : 0) +
    (details.hasDataTables ? 5 : 0)
  );

  const aiFriendlyFormattingScore = Math.round(
    (details.faqCount >= 5 ? 10 : details.faqCount * 2) +
    (details.hasHowToSteps ? 5 : 0)
  );

  const topicalAuthorityScore = Math.round(
    (details.topicalDepth >= 3 ? 5 : details.topicalDepth * 1.5) +
    (details.internalLinksCount >= 3 ? 5 : details.internalLinksCount * 1.5)
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-2xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            AEO Score
          </h3>
          <div className={`inline-flex items-center gap-3 px-5 py-3 rounded-xl border-2 ${getScoreColor(score)}`}>
            <div className="text-4xl font-black">{score}</div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider">/ 100</div>
              <div className="text-sm font-bold">{getScoreLabel(score)}</div>
            </div>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          Answer Engine Optimization - How quotable your content is by AI (ChatGPT, Perplexity, Google SGE, Bing Copilot)
        </p>
      </div>

      {/* Key Indicators */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className={`p-3 rounded-lg border ${details.hasDirectAnswer ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-2">
            {details.hasDirectAnswer ? (
              <span className="text-green-600 text-xl">✓</span>
            ) : (
              <span className="text-slate-400 text-xl">○</span>
            )}
            <span className="text-xs font-bold text-slate-900">Direct Answer</span>
          </div>
        </div>
        <div className={`p-3 rounded-lg border ${details.hasFAQSection ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-2">
            {details.hasFAQSection ? (
              <span className="text-green-600 text-xl">✓</span>
            ) : (
              <span className="text-slate-400 text-xl">○</span>
            )}
            <span className="text-xs font-bold text-slate-900">FAQ Section</span>
          </div>
        </div>
        <div className={`p-3 rounded-lg border ${details.hasDefinitions ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-2">
            {details.hasDefinitions ? (
              <span className="text-green-600 text-xl">✓</span>
            ) : (
              <span className="text-slate-400 text-xl">○</span>
            )}
            <span className="text-xs font-bold text-slate-900">Definitions</span>
          </div>
        </div>
      </div>

      {/* Component Breakdown */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Score Breakdown</h4>

        {/* Answer Quality - 30 points */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-slate-900">Answer Quality</span>
              <span className="text-sm font-black text-slate-900">{answerQualityScore}/30</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                style={{ width: `${(answerQualityScore / 30) * 100}%` }}
              />
            </div>
            <div className="flex gap-2 mt-1">
              {details.hasDirectAnswer && (
                <span className="text-xs text-green-600">✓ Direct answer</span>
              )}
              {details.answerInFirstParagraph && (
                <span className="text-xs text-green-600">✓ Answer-first structure</span>
              )}
            </div>
          </div>
        </div>

        {/* Citation-Worthiness - 25 points */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-slate-900">Citation-Worthiness</span>
              <span className="text-sm font-black text-slate-900">{citationWorthinessScore}/25</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all"
                style={{ width: `${(citationWorthinessScore / 25) * 100}%` }}
              />
            </div>
            <div className="flex gap-2 mt-1">
              {details.hasStatistics && (
                <span className="text-xs text-green-600">✓ Statistics</span>
              )}
              {details.quotableStatementsCount > 0 && (
                <span className="text-xs text-green-600">✓ {details.quotableStatementsCount} quotable insights</span>
              )}
              {details.hasDefinitions && (
                <span className="text-xs text-green-600">✓ Definitions</span>
              )}
            </div>
          </div>
        </div>

        {/* Structured Data - 20 points */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-slate-900">Structured Data</span>
              <span className="text-sm font-black text-slate-900">{structuredDataScore}/20</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all"
                style={{ width: `${(structuredDataScore / 20) * 100}%` }}
              />
            </div>
            <div className="flex gap-2 mt-1">
              {details.hasFAQSection && (
                <span className="text-xs text-green-600">✓ FAQ schema</span>
              )}
              {details.hasHowToSteps && (
                <span className="text-xs text-green-600">✓ HowTo steps</span>
              )}
              {details.hasDataTables && (
                <span className="text-xs text-green-600">✓ Data tables</span>
              )}
            </div>
          </div>
        </div>

        {/* AI-Friendly Formatting - 15 points */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-slate-900">AI-Friendly Formatting</span>
              <span className="text-sm font-black text-slate-900">{aiFriendlyFormattingScore}/15</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all"
                style={{ width: `${(aiFriendlyFormattingScore / 15) * 100}%` }}
              />
            </div>
            <div className="flex gap-2 mt-1">
              {details.faqCount > 0 && (
                <span className="text-xs text-green-600">✓ {details.faqCount} FAQ items</span>
              )}
              {details.hasHowToSteps && (
                <span className="text-xs text-green-600">✓ Step-by-step</span>
              )}
            </div>
          </div>
        </div>

        {/* Topical Authority - 10 points */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-slate-900">Topical Authority</span>
              <span className="text-sm font-black text-slate-900">{topicalAuthorityScore}/10</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                style={{ width: `${(topicalAuthorityScore / 10) * 100}%` }}
              />
            </div>
            <div className="flex gap-2 mt-1">
              {details.topicalDepth > 0 && (
                <span className="text-xs text-green-600">✓ Depth: {details.topicalDepth}</span>
              )}
              {details.internalLinksCount > 0 && (
                <span className="text-xs text-green-600">✓ {details.internalLinksCount} internal links</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {score < 85 && (
        <div className="mt-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
          <h4 className="text-sm font-bold text-slate-900 mb-2">💡 Recommendations to Improve AEO</h4>
          <ul className="space-y-1 text-sm text-slate-700">
            {!details.hasDirectAnswer && (
              <li>• Add a clear, direct answer in the first paragraph</li>
            )}
            {!details.hasFAQSection && (
              <li>• Include an FAQ section with 5-8 common questions</li>
            )}
            {details.quotableStatementsCount < 3 && (
              <li>• Add more quotable insights and key takeaways</li>
            )}
            {!details.hasStatistics && (
              <li>• Include data, statistics, or research findings</li>
            )}
            {!details.hasDefinitions && (
              <li>• Define key terms for better AI understanding</li>
            )}
            {details.faqCount < 5 && (
              <li>• Expand FAQ section to at least 5 questions</li>
            )}
          </ul>
        </div>
      )}

      {score >= 85 && (
        <div className="mt-6 p-4 rounded-lg bg-green-50 border border-green-200">
          <p className="text-green-800 font-bold text-sm">
            ✅ Excellent AEO! This content is highly quotable by AI answer engines.
          </p>
        </div>
      )}
    </div>
  );
}
