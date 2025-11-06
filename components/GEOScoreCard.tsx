import { GEODetails } from '@/lib/content-scoring';

interface GEOScoreCardProps {
  score: number;
  details: GEODetails;
  localContext?: {
    city?: string;
    state?: string;
    serviceArea?: string;
  };
}

/**
 * GEO (Local Intent Optimization) Score Card Component
 *
 * Displays how well content is optimized for local search queries
 * and "near me" searches. Only shown for local/hybrid content strategies.
 *
 * Score Breakdown (0-100):
 * - Location Signals: 35 points
 * - Local Keywords: 25 points
 * - Service Area Coverage: 20 points
 * - Business Context: 20 points
 */
export default function GEOScoreCard({ score, details, localContext }: GEOScoreCardProps) {
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
  const locationSignalsScore = Math.round(
    (details.hasLocationMentions ? 15 : 0) +
    (details.cityMentions >= 3 ? 10 : details.cityMentions * 3) +
    (details.neighborhoodMentions >= 2 ? 10 : details.neighborhoodMentions * 5)
  );

  const localKeywordsScore = Math.round(
    (details.hasLocalKeywords ? 10 : 0) +
    (details.localKeywordCount >= 5 ? 15 : details.localKeywordCount * 3)
  );

  const serviceAreaScore = Math.round(
    (details.hasServiceArea ? 10 : 0) +
    (details.hasNearMeOptimization ? 10 : 0)
  );

  const businessContextScore = Math.round(
    (details.hasBusinessInfo ? 10 : 0) +
    (details.hasLocalIntent ? 10 : 0)
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-2xl font-black bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            GEO Score
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
          Local Intent Optimization - How well your content targets local searches and "near me" queries
        </p>
      </div>

      {/* Local Context Info */}
      {localContext && (localContext.city || localContext.state) && (
        <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-bold text-slate-900">Target Location</span>
          </div>
          <div className="text-sm text-slate-700">
            {localContext.city && <span className="font-bold">{localContext.city}</span>}
            {localContext.city && localContext.state && <span>, </span>}
            {localContext.state && <span className="font-bold">{localContext.state}</span>}
          </div>
          {localContext.serviceArea && (
            <div className="mt-1 text-xs text-slate-600">
              Service Area: {localContext.serviceArea}
            </div>
          )}
        </div>
      )}

      {/* Key Indicators */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className={`p-3 rounded-lg border ${details.hasLocationMentions ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-2">
            {details.hasLocationMentions ? (
              <span className="text-green-600 text-xl">✓</span>
            ) : (
              <span className="text-slate-400 text-xl">○</span>
            )}
            <span className="text-xs font-bold text-slate-900">Location Signals</span>
          </div>
          {details.cityMentions > 0 && (
            <div className="mt-1 text-xs text-green-600">{details.cityMentions} mentions</div>
          )}
        </div>
        <div className={`p-3 rounded-lg border ${details.hasLocalKeywords ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-2">
            {details.hasLocalKeywords ? (
              <span className="text-green-600 text-xl">✓</span>
            ) : (
              <span className="text-slate-400 text-xl">○</span>
            )}
            <span className="text-xs font-bold text-slate-900">Local Keywords</span>
          </div>
          {details.localKeywordCount > 0 && (
            <div className="mt-1 text-xs text-green-600">{details.localKeywordCount} found</div>
          )}
        </div>
        <div className={`p-3 rounded-lg border ${details.hasNearMeOptimization ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-2">
            {details.hasNearMeOptimization ? (
              <span className="text-green-600 text-xl">✓</span>
            ) : (
              <span className="text-slate-400 text-xl">○</span>
            )}
            <span className="text-xs font-bold text-slate-900">"Near Me" Ready</span>
          </div>
        </div>
      </div>

      {/* Component Breakdown */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Score Breakdown</h4>

        {/* Location Signals - 35 points */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-slate-900">Location Signals</span>
              <span className="text-sm font-black text-slate-900">{locationSignalsScore}/35</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all"
                style={{ width: `${(locationSignalsScore / 35) * 100}%` }}
              />
            </div>
            <div className="flex gap-2 mt-1">
              {details.hasLocationMentions && (
                <span className="text-xs text-green-600">✓ Location mentions</span>
              )}
              {details.cityMentions > 0 && (
                <span className="text-xs text-green-600">✓ {details.cityMentions} city mentions</span>
              )}
              {details.neighborhoodMentions > 0 && (
                <span className="text-xs text-green-600">✓ {details.neighborhoodMentions} neighborhoods</span>
              )}
            </div>
          </div>
        </div>

        {/* Local Keywords - 25 points */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-slate-900">Local Keywords</span>
              <span className="text-sm font-black text-slate-900">{localKeywordsScore}/25</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all"
                style={{ width: `${(localKeywordsScore / 25) * 100}%` }}
              />
            </div>
            <div className="flex gap-2 mt-1">
              {details.hasLocalKeywords && (
                <span className="text-xs text-green-600">✓ Local keywords present</span>
              )}
              {details.localKeywordCount > 0 && (
                <span className="text-xs text-green-600">✓ {details.localKeywordCount} local terms</span>
              )}
            </div>
          </div>
        </div>

        {/* Service Area Coverage - 20 points */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-slate-900">Service Area Coverage</span>
              <span className="text-sm font-black text-slate-900">{serviceAreaScore}/20</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                style={{ width: `${(serviceAreaScore / 20) * 100}%` }}
              />
            </div>
            <div className="flex gap-2 mt-1">
              {details.hasServiceArea && (
                <span className="text-xs text-green-600">✓ Service area defined</span>
              )}
              {details.hasNearMeOptimization && (
                <span className="text-xs text-green-600">✓ "Near me" optimized</span>
              )}
            </div>
          </div>
        </div>

        {/* Business Context - 20 points */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-slate-900">Business Context</span>
              <span className="text-sm font-black text-slate-900">{businessContextScore}/20</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all"
                style={{ width: `${(businessContextScore / 20) * 100}%` }}
              />
            </div>
            <div className="flex gap-2 mt-1">
              {details.hasBusinessInfo && (
                <span className="text-xs text-green-600">✓ Business info</span>
              )}
              {details.hasLocalIntent && (
                <span className="text-xs text-green-600">✓ Local intent</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {score < 85 && (
        <div className="mt-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
          <h4 className="text-sm font-bold text-slate-900 mb-2">💡 Recommendations to Improve GEO</h4>
          <ul className="space-y-1 text-sm text-slate-700">
            {!details.hasLocationMentions && localContext?.city && (
              <li>• Mention "{localContext.city}" naturally throughout the content</li>
            )}
            {details.cityMentions < 3 && localContext?.city && (
              <li>• Increase mentions of "{localContext.city}" (currently {details.cityMentions})</li>
            )}
            {!details.hasLocalKeywords && (
              <li>• Add local keywords like "near me", "in [city]", "local"</li>
            )}
            {!details.hasServiceArea && (
              <li>• Specify the service area or coverage radius</li>
            )}
            {!details.hasNearMeOptimization && (
              <li>• Optimize for "near me" queries with proximity language</li>
            )}
            {details.neighborhoodMentions < 2 && (
              <li>• Mention specific neighborhoods or districts served</li>
            )}
            {!details.hasBusinessInfo && (
              <li>• Include business hours, contact info, or location details</li>
            )}
          </ul>
        </div>
      )}

      {score >= 85 && (
        <div className="mt-6 p-4 rounded-lg bg-green-50 border border-green-200">
          <p className="text-green-800 font-bold text-sm">
            ✅ Excellent GEO! This content is well-optimized for local searches.
          </p>
        </div>
      )}
    </div>
  );
}
