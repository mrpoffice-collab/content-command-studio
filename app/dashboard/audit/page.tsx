'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import AISOBadge from '@/components/AISOBadge';
import AEOScoreCard from '@/components/AEOScoreCard';
import { generateComparisonPDF } from '@/lib/comparison-pdf-generator';

export default function AuditPage() {
  const searchParams = useSearchParams();
  const [contentInput, setContentInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [metaInput, setMetaInput] = useState('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewriteResult, setRewriteResult] = useState<any>(null);
  const [error, setError] = useState('');

  // Check for parameters from batch audit or direct post audit
  useEffect(() => {
    const urlParam = searchParams.get('url');
    const fromPost = searchParams.get('fromPost');

    // Check if data was passed via sessionStorage (from post detail page)
    if (fromPost === 'true') {
      const storedData = sessionStorage.getItem('auditPostData');
      if (storedData) {
        try {
          const { title, meta, content } = JSON.parse(storedData);
          setTitleInput(title || '');
          setMetaInput(meta || '');
          setContentInput(content || '');

          // Clear the stored data
          sessionStorage.removeItem('auditPostData');

          // Auto-audit
          setTimeout(() => {
            const auditBtn = document.querySelector('[data-audit-btn]') as HTMLButtonElement;
            auditBtn?.click();
          }, 100);
        } catch (e) {
          console.error('Failed to parse stored audit data:', e);
        }
      }
    } else if (urlParam) {
      setUrlInput(urlParam);
      // Auto-audit when URL is provided
      setTimeout(() => {
        const auditBtn = document.querySelector('[data-audit-btn]') as HTMLButtonElement;
        auditBtn?.click();
      }, 100);
    }
  }, [searchParams]);

  const handleAudit = async () => {
    if (!contentInput.trim() && !urlInput.trim()) {
      setError('Please paste content or enter a URL');
      return;
    }

    setIsAuditing(true);
    setError('');
    setAuditResult(null);

    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: contentInput,
          url: urlInput,
          title: titleInput,
          metaDescription: metaInput,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Audit failed');
      }

      setAuditResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleRewrite = async () => {
    if (!auditResult) return;

    setIsRewriting(true);
    setError('');

    // Capture original data for PDF
    const originalContent = auditResult.content;
    const originalScore = auditResult.aisoScore || auditResult.overallScore;
    const originalTitle = auditResult.title || 'Content Audit';

    try {
      const response = await fetch('/api/audit/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalContent: auditResult.content,
          auditReport: auditResult,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Rewrite failed');
      }

      setRewriteResult(data);

      // Generate comparison PDF after successful rewrite
      setTimeout(() => {
        try {
          console.log('Generating comparison PDF...');
          console.log('Original score:', originalScore);
          console.log('New score:', data.newScore);

          generateComparisonPDF({
            title: originalTitle,
            originalContent: originalContent,
            improvedContent: data.improvedContent,
            originalScore: originalScore,
            improvedScore: data.newScore,
            scoreBreakdown: [
              {
                category: 'AISO Score',
                before: originalScore,
                after: data.newScore,
                improvement: data.newScore - originalScore
              },
              {
                category: 'Fact-Check (30%)',
                before: auditResult.factCheckScore || 0,
                after: data.factCheckScore || auditResult.factCheckScore || 0,
                improvement: (data.factCheckScore || auditResult.factCheckScore || 0) - (auditResult.factCheckScore || 0)
              },
              {
                category: 'AEO (25%)',
                before: auditResult.aeoScore || 0,
                after: data.aeoScore || auditResult.aeoScore || 0,
                improvement: (data.aeoScore || auditResult.aeoScore || 0) - (auditResult.aeoScore || 0)
              },
              {
                category: 'SEO (15%)',
                before: auditResult.seoScore,
                after: data.seoScore || auditResult.seoScore,
                improvement: (data.seoScore || auditResult.seoScore) - auditResult.seoScore
              }
            ],
            generatedDate: new Date().toLocaleDateString(),
          });

          console.log('PDF generation complete!');
          alert('✅ Content rewritten successfully!\n\n📄 Comparison PDF has been downloaded showing before/after improvements.');
        } catch (pdfError: any) {
          console.error('PDF generation error:', pdfError);
          alert('✅ Content rewritten successfully!\n\n⚠️ PDF generation failed: ' + pdfError.message);
        }
      }, 500);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRewriting(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-xl shadow-sm sticky top-0 z-50">
        <div className="container mx-auto flex h-20 items-center justify-between px-6">
          <div className="flex items-center gap-12">
            <Link href="/dashboard" className="text-2xl font-bold bg-gradient-to-r from-sunset-orange to-orange-600 bg-clip-text text-transparent">
              Content Command Studio
            </Link>
            <nav className="flex gap-8">
              <Link href="/dashboard" className="text-sm font-semibold text-slate-600 hover:text-deep-indigo transition-all duration-200 hover:scale-105">
                Dashboard
              </Link>
              <Link href="/dashboard/strategies" className="text-sm font-semibold text-slate-600 hover:text-deep-indigo transition-all duration-200 hover:scale-105">
                Strategies
              </Link>
              <Link href="/dashboard/posts" className="text-sm font-semibold text-slate-600 hover:text-deep-indigo transition-all duration-200 hover:scale-105">
                Posts
              </Link>
              <Link href="/dashboard/audit" className="text-sm font-semibold text-deep-indigo border-b-2 border-sunset-orange pb-1">
                AISO Audit
              </Link>
            </nav>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black bg-gradient-to-r from-deep-indigo via-purple-600 to-pink-600 bg-clip-text text-transparent mb-3">
                AISO Content Audit
              </h1>
              <p className="text-lg text-slate-700">
                Analyze blog posts for AI Search Optimization (AEO + SEO + Fact-Checking). Get scores for ChatGPT, Perplexity, Google SGE.
              </p>
            </div>
            <Link
              href="/dashboard/audit/batch"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Batch Audit
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border-2 border-red-200 p-4 text-red-700 font-semibold">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">
          {/* Input Section */}
          {!auditResult && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
              <h2 className="text-2xl font-black text-slate-900 mb-6">Step 1: Add Content to Audit</h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Option A: Paste Content Directly
                  </label>
                  <textarea
                    value={contentInput}
                    onChange={(e) => {
                      setContentInput(e.target.value);
                      setUrlInput('');
                    }}
                    placeholder="Paste your blog post content here..."
                    rows={12}
                    className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                    style={{ color: '#0f172a' }}
                  />
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 border-t border-slate-300"></div>
                  <span className="text-sm font-bold text-slate-700">OR</span>
                  <div className="flex-1 border-t border-slate-300"></div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Option B: Enter Blog Post URL
                  </label>
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value);
                      setContentInput('');
                    }}
                    placeholder="https://example.com/blog/post-title"
                    className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                    style={{ color: '#0f172a' }}
                  />
                  <p className="mt-2 text-xs text-slate-600">
                    We'll automatically scrape and analyze the content
                  </p>
                </div>

                <button
                  onClick={handleAudit}
                  disabled={isAuditing || (!contentInput.trim() && !urlInput.trim())}
                  data-audit-btn
                  className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {isAuditing ? (
                    <>
                      <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Analyzing Content...
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      Audit Content
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Audit Results */}
          {auditResult && !rewriteResult && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-900">Audit Results</h2>
                <button
                  onClick={() => {
                    setAuditResult(null);
                    setContentInput('');
                    setUrlInput('');
                    setError('');
                  }}
                  className="text-sm font-semibold text-slate-600 hover:text-deep-indigo"
                >
                  ← Audit Another Post
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
                {/* What was analyzed */}
                {auditResult.url && (
                  <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-sm font-bold text-slate-900 mb-1">📄 Analyzed Content:</p>
                    <p className="text-sm text-slate-700">
                      Single blog post from: <span className="font-mono text-xs break-all">{auditResult.url}</span>
                    </p>
                    <p className="text-xs text-slate-600 mt-2">
                      ℹ️ This audit analyzes one individual blog post, not your entire blog or website.
                    </p>
                  </div>
                )}

                {/* AISO Score - Primary Score */}
                {auditResult.aisoScore !== undefined && (
                  <div className="mb-8">
                    <h3 className="text-xl font-bold text-slate-900 mb-4">AISO Score (AI Search Optimization)</h3>
                    <div className="flex items-start gap-4">
                      <AISOBadge score={auditResult.aisoScore} size="lg" />
                      <div className="flex-1 p-4 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200">
                        <p className="text-sm text-slate-700 mb-2">
                          <strong>AISO Score</strong> combines AEO (Answer Engine Optimization) + SEO + Readability + Engagement with <strong className="text-purple-600">30% fact-checking weight</strong> — our key differentiator.
                        </p>
                        <p className="text-xs text-slate-600">
                          This score predicts how likely your content is to be quoted by ChatGPT Search, Perplexity, Google SGE, and Bing Copilot.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Legacy Overall Score - Kept for backward compatibility */}
                <div className="mb-8">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">Legacy Quality Score</h3>
                  <div className={`inline-flex items-center gap-4 px-6 py-4 rounded-xl border-2 ${getScoreColor(auditResult.overallScore)}`}>
                    <div className="text-5xl font-black">{auditResult.overallScore}</div>
                    <div>
                      <div className="text-sm font-bold uppercase tracking-wider">/ 100</div>
                      <div className="text-lg font-bold">{getScoreLabel(auditResult.overallScore)}</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 mt-2">
                    (Base score without fact-checking weight - for comparison only)
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mb-8">
                  {/* Fact-Check Score - 30% weight (KEY DIFFERENTIATOR) */}
                  <div className={`p-4 rounded-xl border-2 ${getScoreColor(auditResult.factCheckScore)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold uppercase tracking-wider">Fact-Check ⭐</span>
                      <span className="text-2xl font-black">{auditResult.factCheckScore}</span>
                    </div>
                    <p className="text-xs">
                      ✅ {auditResult.verifiedClaims} verified &nbsp; ⚠️ {auditResult.uncertainClaims} uncertain &nbsp; ❌ {auditResult.unverifiedClaims} unverified
                    </p>
                    <p className="text-xs font-bold text-purple-600 mt-1">30% weight</p>
                  </div>

                  {/* AEO Score - NEW */}
                  {auditResult.aeoScore !== undefined && (
                    <div className={`p-4 rounded-xl border-2 ${getScoreColor(auditResult.aeoScore)}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider">AEO (AI)</span>
                        <span className="text-2xl font-black">{auditResult.aeoScore}</span>
                      </div>
                      <p className="text-xs">
                        Answer Engine Optimization
                      </p>
                      <p className="text-xs font-bold text-blue-600 mt-1">25% weight</p>
                    </div>
                  )}

                  <div className={`p-4 rounded-xl border-2 ${getScoreColor(auditResult.seoScore)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold uppercase tracking-wider">SEO</span>
                      <span className="text-2xl font-black">{auditResult.seoScore}</span>
                    </div>
                    <p className="text-xs">
                      Keywords, structure, headers, meta tags
                    </p>
                    <p className="text-xs font-bold text-green-600 mt-1">15% weight</p>
                  </div>

                  <div className={`p-4 rounded-xl border-2 ${getScoreColor(auditResult.readabilityScore)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold uppercase tracking-wider">Readability</span>
                      <span className="text-2xl font-black">{auditResult.readabilityScore}</span>
                    </div>
                    <p className="text-xs">
                      {auditResult.readabilityDetails?.fleschGrade || 'Standard reading level'}
                    </p>
                    <p className="text-xs font-bold text-orange-600 mt-1">15% weight</p>
                  </div>

                  <div className={`p-4 rounded-xl border-2 ${getScoreColor(auditResult.engagementScore)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold uppercase tracking-wider">Engagement</span>
                      <span className="text-2xl font-black">{auditResult.engagementScore}</span>
                    </div>
                    <p className="text-xs">
                      Hooks, CTAs, formatting, interactivity
                    </p>
                    <p className="text-xs font-bold text-pink-600 mt-1">15% weight</p>
                  </div>
                </div>

                {/* AEO Score Card - NEW */}
                {auditResult.aeoDetails && (
                  <div className="mb-8">
                    <AEOScoreCard score={auditResult.aeoScore || 0} details={auditResult.aeoDetails} />
                  </div>
                )}

                {/* Detailed Breakdown */}
                <div className="space-y-4 mb-8">
                  <h3 className="text-lg font-bold text-slate-900">Detailed Analysis</h3>

                  {/* SEO Details */}
                  {auditResult.seoDetails && (
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                      <h4 className="font-bold text-slate-900 mb-2">SEO Breakdown</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm text-slate-900">
                        <div>• Headers: <span className="font-bold">{auditResult.seoDetails.h2Count} H2, {auditResult.seoDetails.h3Count} H3</span> {auditResult.seoDetails.headerStructure ? '✅' : '⚠️'}</div>
                        <div>• Title Length: <span className="font-bold">{auditResult.seoDetails.titleLength || 0} chars</span> {auditResult.seoDetails.titleOptimal ? '✅' : '⚠️'}</div>
                        <div>• Meta Description: <span className="font-bold">{auditResult.seoDetails.metaLength || 0} chars</span> {auditResult.seoDetails.metaOptimal ? '✅' : '⚠️'}</div>
                        <div>• Images: <span className="font-bold">{auditResult.seoDetails.imageCount}</span> {auditResult.seoDetails.imageCount >= 2 ? '✅' : '⚠️'}</div>
                        <div>• Links: <span className="font-bold">{auditResult.seoDetails.hasInternalLinks ? 'Yes' : 'No'}</span> {auditResult.seoDetails.hasInternalLinks ? '✅' : '⚠️'}</div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-300">
                        <p className="text-sm text-slate-900 mb-1">
                          <span className="font-bold">Word Count:</span> {auditResult.seoDetails.wordCount} words
                        </p>
                        <p className="text-xs text-slate-600">
                          📊 Context: Competitive keywords typically need 1,200+ words. Quick answers/how-tos work well at 600-800 words. This post's effectiveness depends on its target keywords and content type.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Readability Details */}
                  {auditResult.readabilityDetails && (
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                      <h4 className="font-bold text-slate-900 mb-2">Readability Breakdown</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm text-slate-900">
                        <div>• Flesch Score: <span className="font-bold">{auditResult.readabilityDetails.fleschScore}</span></div>
                        <div>• Reading Level: <span className="font-bold">{auditResult.readabilityDetails.fleschGrade}</span></div>
                        <div>• Avg Sentence: <span className="font-bold">{auditResult.readabilityDetails.avgSentenceLength} words</span></div>
                        <div>• Sentences: <span className="font-bold">{auditResult.readabilityDetails.sentenceCount}</span></div>
                        <div>• Long Sentences: <span className="font-bold">{auditResult.readabilityDetails.longSentenceCount}</span> {auditResult.readabilityDetails.longSentenceCount < 5 ? '✅' : '⚠️'}</div>
                        <div>• Complex Words: <span className="font-bold">{auditResult.readabilityDetails.complexWordCount}</span></div>
                      </div>
                    </div>
                  )}

                  {/* Engagement Details */}
                  {auditResult.engagementDetails && (
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                      <h4 className="font-bold text-slate-900 mb-2">Engagement Breakdown</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm text-slate-900">
                        <div>• Opening Hook: <span className="font-bold">{auditResult.engagementDetails.hasHook ? 'Yes ✅' : 'No ⚠️'}</span></div>
                        <div>• Call-to-Action: <span className="font-bold">{auditResult.engagementDetails.hasCTA ? 'Yes ✅' : 'No ⚠️'}</span></div>
                        <div>• Questions: <span className="font-bold">{auditResult.engagementDetails.hasQuestion ? 'Yes ✅' : 'No ⚠️'}</span></div>
                        <div>• Bullet Points: <span className="font-bold">{auditResult.engagementDetails.hasBulletPoints ? 'Yes ✅' : 'No ⚠️'}</span></div>
                        <div>• Numbered Lists: <span className="font-bold">{auditResult.engagementDetails.hasNumberedList ? 'Yes ✅' : 'No ⚠️'}</span></div>
                        <div>• Text Emphasis: <span className="font-bold">{auditResult.engagementDetails.hasEmphasis ? 'Yes ✅' : 'No ⚠️'}</span></div>
                      </div>
                    </div>
                  )}
                </div>

                {auditResult.overallScore < 75 && (
                  <button
                    onClick={handleRewrite}
                    disabled={isRewriting}
                    className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {isRewriting ? (
                      <>
                        <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Rewriting Content...
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Rewrite to Improve Score (~$0.10)
                      </>
                    )}
                  </button>
                )}

                {auditResult.overallScore >= 75 && (
                  <div className="p-4 rounded-xl bg-green-50 border-2 border-green-200">
                    <p className="text-green-800 font-bold text-center">
                      ✅ This content meets quality standards! No rewrite needed.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rewrite Results - Before/After */}
          {rewriteResult && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-900">Rewrite Complete!</h2>
                <button
                  onClick={() => {
                    setRewriteResult(null);
                    setAuditResult(null);
                    setContentInput('');
                    setUrlInput('');
                  }}
                  className="text-sm font-semibold text-slate-600 hover:text-deep-indigo"
                >
                  ← Audit Another Post
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">Score Improvement</h3>
                  <div className="flex items-center gap-4">
                    <div className={`px-6 py-4 rounded-xl border-2 ${getScoreColor(auditResult.overallScore)}`}>
                      <div className="text-xs font-bold uppercase tracking-wider mb-1">Before</div>
                      <div className="text-3xl font-black">{auditResult.overallScore}</div>
                    </div>
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <div className={`px-6 py-4 rounded-xl border-2 ${getScoreColor(rewriteResult.newScore)}`}>
                      <div className="text-xs font-bold uppercase tracking-wider mb-1">After</div>
                      <div className="text-3xl font-black">{rewriteResult.newScore}</div>
                    </div>
                    <div className="ml-4 px-4 py-2 rounded-lg bg-green-100 border border-green-300">
                      <div className="text-xs font-bold text-green-700 uppercase">Improvement</div>
                      <div className="text-2xl font-black text-green-700">+{rewriteResult.newScore - auditResult.overallScore}</div>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 mb-3">Original Content</h4>
                    <div className="p-4 rounded-lg bg-red-50 border border-red-200 max-h-96 overflow-y-auto">
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{auditResult.content.substring(0, 500)}...</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 mb-3">Improved Content</h4>
                    <div className="p-4 rounded-lg bg-green-50 border border-green-200 max-h-96 overflow-y-auto">
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{rewriteResult.improvedContent.substring(0, 500)}...</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(rewriteResult.improvedContent);
                      alert('Improved content copied to clipboard!');
                    }}
                    className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                  >
                    📋 Copy Improved Content
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
