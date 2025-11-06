interface AISOBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  isLocalContent?: boolean;
}

/**
 * AISO Badge Component
 *
 * Displays the overall AISO (AI Search Optimization) score
 * with appropriate color coding and optional label
 *
 * AISO = AEO + GEO (if local) + SEO + Readability + Engagement + Fact-Check (30% weight!)
 */
export default function AISOBadge({ score, size = 'md', showLabel = true, isLocalContent = false }: AISOBadgeProps) {
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-700 bg-green-50 border-green-300';
    if (score >= 75) return 'text-blue-700 bg-blue-50 border-blue-300';
    if (score >= 60) return 'text-yellow-700 bg-yellow-50 border-yellow-300';
    return 'text-red-700 bg-red-50 border-red-300';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 85) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Work';
  };

  const getScoreGrade = (score: number) => {
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 70) return 'C+';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const scoreSizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <div
      className={`inline-flex items-center gap-3 ${sizeClasses[size]} rounded-xl border-2 ${getScoreColor(score)} font-bold transition-all hover:scale-105`}
      title={`AISO Score: ${score}/100 - ${getScoreLabel(score)}`}
    >
      {/* Score Badge */}
      <div className="flex items-center gap-2">
        <div className={`${scoreSizeClasses[size]} font-black leading-none`}>
          {score}
        </div>
        <div className="text-xs leading-none">
          <div className="font-black opacity-60">/100</div>
          {size !== 'sm' && (
            <div className="font-black text-lg mt-0.5">{getScoreGrade(score)}</div>
          )}
        </div>
      </div>

      {/* Label */}
      {showLabel && (
        <div className="border-l border-current opacity-60 pl-3">
          <div className="text-xs uppercase tracking-wider font-black">
            AISO {isLocalContent && '+ GEO'}
          </div>
          {size !== 'sm' && (
            <div className="text-xs font-bold mt-0.5">
              {getScoreLabel(score)}
            </div>
          )}
        </div>
      )}

      {/* Fact-Check Priority Indicator */}
      {score >= 75 && (
        <div className="ml-1" title="Fact-checked content (30% weight)">
          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </div>
  );
}
