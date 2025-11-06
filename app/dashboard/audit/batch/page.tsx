'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { UserButton } from '@clerk/nextjs';
import { generateBatchAuditPDF } from '@/lib/pdf-generator';

interface DiscoveredPost {
  url: string;
  title: string;
  excerpt?: string;
}

interface AuditResult {
  url: string;
  title: string;
  overallScore: number;
  seoScore: number;
  readabilityScore: number;
  engagementScore: number;
  wordCount: number;
  publishedDate?: string;
  daysOld?: number;
  issues?: string[];
  imageCount?: number;
  headerCount?: number;
  fleschScore?: number;
  success: boolean;
  error?: string;
}

interface SavedAudit {
  id: string;
  name: string;
  blogUrl: string;
  auditResults: AuditResult[];
  summary: any;
  discoveredPosts: DiscoveredPost[];
  createdAt: string;
}

export default function BatchAuditPage() {
  const [blogUrl, setBlogUrl] = useState('');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredPosts, setDiscoveredPosts] = useState<DiscoveredPost[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(24);
  const [selectedPost, setSelectedPost] = useState<AuditResult | null>(null);
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewriteResult, setRewriteResult] = useState<any>(null);
  const [showRawMarkdown, setShowRawMarkdown] = useState(false);

  // Multi-audit management
  const [savedAudits, setSavedAudits] = useState<SavedAudit[]>([]);
  const [currentAuditId, setCurrentAuditId] = useState<string | null>(null);

  // Load all saved audits from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('batchAudits');
    if (saved) {
      try {
        const audits = JSON.parse(saved);
        setSavedAudits(audits);

        // Load the most recent audit
        if (audits.length > 0) {
          const mostRecent = audits[audits.length - 1];
          loadAudit(mostRecent);
        }
      } catch (e) {
        console.error('Failed to restore saved audits', e);
      }
    }
  }, []);

  // Save current audit to localStorage
  const saveCurrentAudit = () => {
    if (!blogUrl && auditResults.length === 0) return;

    const auditName = blogUrl ? new URL(blogUrl).hostname : 'Unnamed Audit';
    const auditId = currentAuditId || `audit-${Date.now()}`;

    const audit: SavedAudit = {
      id: auditId,
      name: auditName,
      blogUrl,
      auditResults,
      summary,
      discoveredPosts,
      createdAt: new Date().toISOString(),
    };

    const updatedAudits = savedAudits.filter(a => a.id !== auditId);
    updatedAudits.push(audit);

    setSavedAudits(updatedAudits);
    setCurrentAuditId(auditId);
    localStorage.setItem('batchAudits', JSON.stringify(updatedAudits));
  };

  // Auto-save whenever audit data changes
  useEffect(() => {
    if (auditResults.length > 0) {
      saveCurrentAudit();
    }
  }, [auditResults, summary]);

  // Load a specific audit
  const loadAudit = (audit: SavedAudit) => {
    setCurrentAuditId(audit.id);
    setBlogUrl(audit.blogUrl);
    setAuditResults(audit.auditResults);
    setSummary(audit.summary);
    setDiscoveredPosts(audit.discoveredPosts);
  };

  // Start a new fresh audit
  const startNewAudit = () => {
    setCurrentAuditId(null);
    setBlogUrl('');
    setAuditResults([]);
    setSummary(null);
    setDiscoveredPosts([]);
    setError('');
    setSelectedPost(null);
    setRewriteResult(null);
  };

  // Delete an audit
  const deleteAudit = (auditId: string) => {
    const updatedAudits = savedAudits.filter(a => a.id !== auditId);
    setSavedAudits(updatedAudits);
    localStorage.setItem('batchAudits', JSON.stringify(updatedAudits));

    if (currentAuditId === auditId) {
      startNewAudit();
    }
  };

  const handleDiscover = async () => {
    if (!blogUrl.trim()) {
      setError('Please enter a blog URL');
      return;
    }

    setIsDiscovering(true);
    setError('');
    setDiscoveredPosts([]);

    try {
      const response = await fetch('/api/audit/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogUrl, limit }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to discover posts');
      }

      setDiscoveredPosts(data.posts);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleAuditAll = async () => {
    if (discoveredPosts.length === 0) return;

    setIsAuditing(true);
    setError('');
    setAuditResults([]);
    setSummary(null);

    try {
      const urls = discoveredPosts.map(p => p.url);

      const response = await fetch('/api/audit/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Batch audit failed');
      }

      setAuditResults(data.results);
      setSummary(data.summary);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleRewrite = async (post: AuditResult) => {
    setIsRewriting(true);
    setError('');

    try {
      const response = await fetch('/api/audit/rewrite-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: post.url,
          currentScores: {
            overallScore: post.overallScore,
            seoScore: post.seoScore,
            readabilityScore: post.readabilityScore,
            engagementScore: post.engagementScore,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Rewrite failed');
      }

      setRewriteResult(data);
      setSelectedPost(null); // Close the details modal
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRewriting(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!auditResults.length || !summary) return;

    // Transform data for PDF generator
    const pdfAuditResults = auditResults.map(result => ({
      title: result.title,
      url: result.url,
      overallScore: result.overallScore,
      seoScore: result.seoScore,
      readabilityScore: result.readabilityScore,
      engagementScore: result.engagementScore,
      issues: result.issues || [],
    }));

    const pdfSummary = {
      totalPosts: summary.total,
      averageScore: summary.avgScore,
      needsWork: summary.scoreDistribution.needsImprovement,
      fair: summary.scoreDistribution.fair || 0,
      good: summary.scoreDistribution.good,
      excellent: summary.scoreDistribution.excellent,
    };

    const pdf = generateBatchAuditPDF(pdfAuditResults, pdfSummary, blogUrl);
    pdf.save(`batch-audit-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-700 bg-green-50 border-green-300'; // Excellent
    if (score >= 80) return 'text-blue-700 bg-blue-50 border-blue-300'; // Good
    if (score >= 70) return 'text-yellow-700 bg-yellow-50 border-yellow-300'; // Fair
    return 'text-orange-700 bg-orange-50 border-orange-300'; // Poor
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return { text: 'Excellent', color: 'bg-green-100 text-green-800' };
    if (score >= 80) return { text: 'Good', color: 'bg-blue-100 text-blue-800' };
    if (score >= 70) return { text: 'Fair', color: 'bg-yellow-100 text-yellow-800' };
    return { text: 'Needs Work', color: 'bg-orange-100 text-orange-800' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50">
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
              <Link href="/dashboard/audit" className="text-sm font-semibold text-slate-600 hover:text-deep-indigo transition-all duration-200 hover:scale-105">
                Content Audit
              </Link>
            </nav>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-5xl font-black bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
              Batch Content Audit
            </h1>
            <Link
              href="/dashboard/audit"
              className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-deep-indigo"
            >
              ← Single Post Audit
            </Link>
          </div>
          <p className="text-lg text-slate-700">
            Audit multiple blog posts at once and get a comprehensive quality report
          </p>
        </div>

        {/* Saved Audits Tabs */}
        {savedAudits.length > 0 && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <div className="flex items-center gap-3 overflow-x-auto">
              <span className="text-sm font-bold text-slate-700 whitespace-nowrap">Saved Audits:</span>
              {savedAudits.map((audit) => (
                <button
                  key={audit.id}
                  onClick={() => loadAudit(audit)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                    currentAuditId === audit.id
                      ? 'bg-purple-100 text-purple-800 border-2 border-purple-300'
                      : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  <span>{audit.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete audit for ${audit.name}?`)) {
                        deleteAudit(audit.id);
                      }
                    }}
                    className="text-red-600 hover:text-red-800"
                  >
                    ×
                  </button>
                </button>
              ))}
              <button
                onClick={startNewAudit}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-bold whitespace-nowrap hover:shadow-lg hover:scale-105 transition-all"
              >
                + New Audit
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm font-bold text-red-800">{error}</p>
          </div>
        )}

        {/* Step 1: Discover Posts */}
        {!discoveredPosts.length && !auditResults.length && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl mb-8">
            <h2 className="text-2xl font-black text-slate-900 mb-6">Step 1: Discover Blog Posts</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Blog URL (e.g., https://example.com/blog)
                </label>
                <input
                  type="url"
                  value={blogUrl}
                  onChange={(e) => setBlogUrl(e.target.value)}
                  placeholder="https://fireflygrove.app/blog"
                  className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                  style={{ color: '#0f172a' }}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Number of Posts to Analyze (1-50)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value))}
                  className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                  style={{ color: '#0f172a' }}
                />
                <p className="mt-2 text-xs text-slate-600">
                  We'll analyze the most recent {limit} posts. Cost: ${(limit * 0.01).toFixed(2)}
                </p>
              </div>

              <button
                onClick={handleDiscover}
                disabled={isDiscovering}
                className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {isDiscovering ? (
                  <>
                    <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Discovering Posts...
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Discover Blog Posts
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Show Discovered Posts */}
        {discoveredPosts.length > 0 && auditResults.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-slate-900">
                Found {discoveredPosts.length} Blog Posts
              </h2>
              <button
                onClick={() => {
                  setDiscoveredPosts([]);
                  setBlogUrl('');
                }}
                className="text-sm font-semibold text-slate-600 hover:text-deep-indigo"
              >
                ← Start Over
              </button>
            </div>

            <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
              {discoveredPosts.map((post, idx) => (
                <div key={idx} className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="font-bold text-slate-900 text-sm">{post.title}</p>
                  <p className="text-xs text-slate-600 font-mono mt-1">{post.url}</p>
                  {post.excerpt && (
                    <p className="text-xs text-slate-600 mt-2">{post.excerpt}</p>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleAuditAll}
              disabled={isAuditing}
              className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isAuditing ? (
                <>
                  <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Auditing {discoveredPosts.length} Posts...
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Audit All Posts (~${(discoveredPosts.length * 0.01).toFixed(2)})
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 3: Show Audit Results */}
        {auditResults.length > 0 && summary && (
          <div className="space-y-6">
            {/* Summary Statistics */}
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-slate-900">Audit Summary</h2>
                <button
                  onClick={() => {
                    setAuditResults([]);
                    setSummary(null);
                    setDiscoveredPosts([]);
                    setBlogUrl('');
                    localStorage.removeItem('batchAuditState');
                  }}
                  className="text-sm font-semibold text-slate-600 hover:text-deep-indigo"
                >
                  ← New Audit
                </button>
              </div>

              <div className="grid grid-cols-4 gap-6 mb-6">
                <div className="p-6 rounded-xl bg-blue-50 border-2 border-blue-200">
                  <div className="text-3xl font-black text-blue-600">{summary.avgScore}</div>
                  <div className="text-sm font-bold text-slate-700 mt-2">Average Score</div>
                </div>
                <div className="p-6 rounded-xl bg-green-50 border-2 border-green-200">
                  <div className="text-3xl font-black text-green-600">{summary.scoreDistribution.excellent}</div>
                  <div className="text-sm font-bold text-slate-700 mt-2">Excellent (85+)</div>
                </div>
                <div className="p-6 rounded-xl bg-blue-50 border-2 border-blue-200">
                  <div className="text-3xl font-black text-blue-600">{summary.scoreDistribution.good}</div>
                  <div className="text-sm font-bold text-slate-700 mt-2">Good (75-84)</div>
                </div>
                <div className="p-6 rounded-xl bg-orange-50 border-2 border-orange-200">
                  <div className="text-3xl font-black text-orange-600">{summary.scoreDistribution.needsImprovement}</div>
                  <div className="text-sm font-bold text-slate-700 mt-2">Needs Work (&lt;75)</div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 mb-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-700">
                    <span className="font-bold">Total Cost:</span> ${summary.totalCost.toFixed(2)} •
                    <span className="font-bold ml-3">Posts Analyzed:</span> {summary.successful}/{summary.total} successful
                  </p>
                  <button
                    onClick={handleDownloadPDF}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-sm shadow-md hover:shadow-lg hover:scale-105 transition-all flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download PDF Report
                  </button>
                </div>
              </div>

              {/* Honest analysis based on objective facts */}
              {summary.scoreDistribution.needsImprovement > 0 && (
                <div className="p-6 rounded-xl bg-orange-50 border-2 border-orange-200">
                  <h3 className="text-lg font-bold text-slate-900 mb-3">📊 What We Found</h3>
                  <div className="space-y-2 text-sm text-slate-700">
                    <p>
                      <span className="font-bold">{summary.scoreDistribution.needsImprovement} of {summary.total} posts</span> scored below 75 based on technical SEO, readability, and engagement metrics.
                    </p>
                    <p className="text-xs text-slate-600 mt-3">
                      <span className="font-bold">What the scores measure:</span>
                    </p>
                    <ul className="text-xs text-slate-600 space-y-1 ml-4">
                      <li>• SEO: Images, headers, links, meta data (word count shown as context, not scored)</li>
                      <li>• Readability: Flesch score, sentence length, complexity</li>
                      <li>• Engagement: Hooks, CTAs, formatting, structure</li>
                    </ul>
                    <p className="text-xs text-slate-600 mt-3">
                      These are technical issues that can be measured and fixed. Improving these elements gives content a better chance to perform well.
                    </p>
                    <p className="text-xs text-slate-600 mt-2">
                      <span className="font-bold">Note on word count:</span> We show word count for reference only because optimal length depends on content type. Competitive keywords typically need 1,200+ words, while quick answers work well at 600-800 words.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Results Table */}
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
              <h2 className="text-2xl font-black text-slate-900 mb-6">Detailed Results</h2>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="text-left py-3 px-4 text-sm font-bold text-slate-700">Post Title</th>
                      <th className="text-center py-3 px-4 text-sm font-bold text-slate-700">Overall</th>
                      <th className="text-center py-3 px-4 text-sm font-bold text-slate-700">SEO</th>
                      <th className="text-center py-3 px-4 text-sm font-bold text-slate-700">Readability</th>
                      <th className="text-center py-3 px-4 text-sm font-bold text-slate-700">Engagement</th>
                      <th className="text-center py-3 px-4 text-sm font-bold text-slate-700">Words</th>
                      <th className="text-center py-3 px-4 text-sm font-bold text-slate-700">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditResults.map((result, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-bold text-slate-900 text-sm mb-1">{result.title || 'Untitled'}</p>
                            {result.daysOld && result.daysOld > 365 && (
                              <p className="text-xs text-orange-700 font-semibold mb-1">
                                ⚠️ {Math.floor(result.daysOld / 365)} year{Math.floor(result.daysOld / 365) > 1 ? 's' : ''} old
                              </p>
                            )}
                            {result.issues && result.issues.length > 0 && (
                              <p className="text-xs text-slate-600 mb-1">
                                Issues: {result.issues.join(', ')}
                              </p>
                            )}
                            {!result.success && result.error && (
                              <p className="text-xs text-red-600 font-semibold mb-1">
                                ⚠️ {result.error}
                              </p>
                            )}
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline font-mono"
                            >
                              View Post →
                            </a>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          {result.success ? (
                            <div>
                              <div className="text-2xl font-black text-slate-900">{result.overallScore}</div>
                              <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${getScoreBadge(result.overallScore).color}`}>
                                {getScoreBadge(result.overallScore).text}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-red-600">Error</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center text-sm font-bold text-slate-900">
                          {result.success ? result.seoScore : '-'}
                        </td>
                        <td className="py-4 px-4 text-center text-sm font-bold text-slate-900">
                          {result.success ? result.readabilityScore : '-'}
                        </td>
                        <td className="py-4 px-4 text-center text-sm font-bold text-slate-900">
                          {result.success ? result.engagementScore : '-'}
                        </td>
                        <td className="py-4 px-4 text-center text-sm text-slate-700">
                          {result.success ? result.wordCount.toLocaleString() : '-'}
                        </td>
                        <td className="py-4 px-4 text-center">
                          {result.success ? (
                            <button
                              onClick={() => setSelectedPost(result)}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 transition-all"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View Details
                            </button>
                          ) : (
                            <span className="text-xs text-red-600">Failed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Details Modal */}
        {selectedPost && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-900">Post Details</h2>
                <button
                  onClick={() => setSelectedPost(null)}
                  className="text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Title and URL */}
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{selectedPost.title}</h3>
                  <a
                    href={selectedPost.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline font-mono break-all"
                  >
                    {selectedPost.url} →
                  </a>
                  {selectedPost.daysOld && selectedPost.daysOld > 365 && (
                    <p className="text-sm text-orange-700 font-semibold mt-2">
                      ⚠️ Published {Math.floor(selectedPost.daysOld / 365)} year{Math.floor(selectedPost.daysOld / 365) > 1 ? 's' : ''} ago
                    </p>
                  )}
                </div>

                {/* Overall Score */}
                <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
                  <h4 className="text-lg font-bold text-slate-900 mb-4">Overall Score</h4>
                  <div className={`inline-flex items-center gap-4 px-6 py-4 rounded-xl border-2 ${getScoreColor(selectedPost.overallScore)}`}>
                    <div className="text-5xl font-black">{selectedPost.overallScore}</div>
                    <div>
                      <div className="text-sm font-bold uppercase tracking-wider">/ 100</div>
                      <div className="text-lg font-bold">{getScoreBadge(selectedPost.overallScore).text}</div>
                    </div>
                  </div>
                </div>

                {/* Score Breakdown */}
                <div className="grid grid-cols-3 gap-4">
                  <div className={`p-4 rounded-xl border-2 ${getScoreColor(selectedPost.seoScore)}`}>
                    <div className="text-xs font-bold uppercase tracking-wider mb-1">SEO</div>
                    <div className="text-3xl font-black">{selectedPost.seoScore}</div>
                  </div>
                  <div className={`p-4 rounded-xl border-2 ${getScoreColor(selectedPost.readabilityScore)}`}>
                    <div className="text-xs font-bold uppercase tracking-wider mb-1">Readability</div>
                    <div className="text-3xl font-black">{selectedPost.readabilityScore}</div>
                    {selectedPost.fleschScore && (
                      <div className="text-xs text-slate-600 mt-1">Flesch: {selectedPost.fleschScore}</div>
                    )}
                  </div>
                  <div className={`p-4 rounded-xl border-2 ${getScoreColor(selectedPost.engagementScore)}`}>
                    <div className="text-xs font-bold uppercase tracking-wider mb-1">Engagement</div>
                    <div className="text-3xl font-black">{selectedPost.engagementScore}</div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <h4 className="font-bold text-slate-900 mb-3">Quick Stats</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-900">
                    <div>📝 Word Count: <span className="font-bold">{selectedPost.wordCount.toLocaleString()}</span></div>
                    {selectedPost.imageCount !== undefined && (
                      <div>🖼️ Images: <span className="font-bold">{selectedPost.imageCount}</span></div>
                    )}
                    {selectedPost.headerCount !== undefined && (
                      <div>📑 Headers: <span className="font-bold">{selectedPost.headerCount}</span></div>
                    )}
                    {selectedPost.fleschScore && (
                      <div>📖 Flesch Score: <span className="font-bold">{selectedPost.fleschScore}</span></div>
                    )}
                  </div>
                </div>

                {/* Issues */}
                {selectedPost.issues && selectedPost.issues.length > 0 && (
                  <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                    <h4 className="font-bold text-slate-900 mb-2">⚠️ Issues Detected</h4>
                    <ul className="space-y-1 text-sm text-slate-700">
                      {selectedPost.issues.map((issue, idx) => (
                        <li key={idx}>• {issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Context Note */}
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-sm text-slate-700">
                    <span className="font-bold">Note:</span> This is a quick batch audit. For detailed fact-checking and AI-powered rewrite, use the full audit below.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  {selectedPost.overallScore < 90 && (
                    <>
                      <button
                        onClick={() => handleRewrite(selectedPost)}
                        disabled={isRewriting}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isRewriting ? (
                          <>
                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Rewriting...
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Rewrite Until 80+ (~$0.10-$0.30)
                          </>
                        )}
                      </button>
                      <Link
                        href={`/dashboard/audit?url=${encodeURIComponent(selectedPost.url)}`}
                        className="px-6 py-3 rounded-xl bg-purple-600 text-white font-bold text-center shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                        Full Audit (~$0.03)
                      </Link>
                    </>
                  )}
                  <button
                    onClick={() => setSelectedPost(null)}
                    className={`px-6 py-3 rounded-xl bg-slate-200 text-slate-700 font-bold hover:bg-slate-300 transition-all ${selectedPost.overallScore >= 75 ? 'col-span-2' : ''}`}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rewrite Results Modal */}
        {rewriteResult && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-900">Rewrite Complete!</h2>
                <button
                  onClick={() => setRewriteResult(null)}
                  className="text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Title and URL */}
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{rewriteResult.title}</h3>
                  <a
                    href={rewriteResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline font-mono break-all"
                  >
                    {rewriteResult.url} →
                  </a>
                </div>

                {/* Score Improvement */}
                <div className="p-6 rounded-xl bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-bold text-slate-900">Score Improvement</h4>
                    <div className="text-sm text-slate-600">
                      {rewriteResult.attempts} iteration{rewriteResult.attempts > 1 ? 's' : ''} • ${rewriteResult.estimatedCost?.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={`px-6 py-4 rounded-xl border-2 ${getScoreColor(rewriteResult.originalScores.overallScore)}`}>
                      <div className="text-xs font-bold uppercase tracking-wider mb-1">Before</div>
                      <div className="text-3xl font-black">{rewriteResult.originalScores.overallScore}</div>
                    </div>
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <div className={`px-6 py-4 rounded-xl border-2 ${getScoreColor(rewriteResult.newScores.overallScore)}`}>
                      <div className="text-xs font-bold uppercase tracking-wider mb-1">After</div>
                      <div className="text-3xl font-black">{rewriteResult.newScores.overallScore}</div>
                    </div>
                    <div className="ml-4 px-4 py-2 rounded-lg bg-green-100 border border-green-300">
                      <div className="text-xs font-bold text-green-700 uppercase">Improvement</div>
                      <div className="text-2xl font-black text-green-700">+{rewriteResult.improvement}</div>
                    </div>
                  </div>

                  {/* Detailed Score Breakdown */}
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="text-center">
                      <div className="text-xs font-bold text-slate-600 mb-1">SEO</div>
                      <div className="text-sm">
                        <span className="text-slate-500">{rewriteResult.originalScores.seoScore}</span>
                        <span className="mx-2">→</span>
                        <span className="font-bold text-green-700">{rewriteResult.newScores.seoScore}</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-bold text-slate-600 mb-1">Readability</div>
                      <div className="text-sm">
                        <span className="text-slate-500">{rewriteResult.originalScores.readabilityScore}</span>
                        <span className="mx-2">→</span>
                        <span className="font-bold text-green-700">{rewriteResult.newScores.readabilityScore}</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-bold text-slate-600 mb-1">Engagement</div>
                      <div className="text-sm">
                        <span className="text-slate-500">{rewriteResult.originalScores.engagementScore}</span>
                        <span className="mx-2">→</span>
                        <span className="font-bold text-green-700">{rewriteResult.newScores.engagementScore}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* View Toggle */}
                <div className="flex gap-2 border-b border-slate-200">
                  <button
                    onClick={() => setShowRawMarkdown(false)}
                    className={`px-4 py-2 font-bold transition-all ${
                      !showRawMarkdown
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    📄 Before/After Preview
                  </button>
                  <button
                    onClick={() => setShowRawMarkdown(true)}
                    className={`px-4 py-2 font-bold transition-all ${
                      showRawMarkdown
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    💻 Raw Markdown
                  </button>
                </div>

                {/* Content Display */}
                {showRawMarkdown ? (
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 mb-3">Improved Content (Markdown)</h4>
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 max-h-[500px] overflow-y-auto">
                      <pre className="text-sm text-slate-900 whitespace-pre-wrap font-mono">{rewriteResult.improvedContent}</pre>
                    </div>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-lg font-bold text-slate-900 mb-3">Original Content</h4>
                      <div className="p-6 rounded-lg bg-red-50 border-2 border-red-200 max-h-[500px] overflow-y-auto prose prose-slate max-w-none">
                        <div className="text-slate-900">
                          <ReactMarkdown
                            rehypePlugins={[rehypeRaw, rehypeSanitize]}
                            components={{
                              p: ({node, ...props}) => <p className="text-slate-900 mb-4" {...props} />,
                              h1: ({node, ...props}) => <h1 className="text-slate-900 text-3xl font-bold mb-4" {...props} />,
                              h2: ({node, ...props}) => <h2 className="text-slate-900 text-2xl font-bold mb-3" {...props} />,
                              h3: ({node, ...props}) => <h3 className="text-slate-900 text-xl font-bold mb-2" {...props} />,
                              strong: ({node, ...props}) => <strong className="text-slate-900 font-bold" {...props} />,
                              a: ({node, ...props}) => <a className="text-blue-600 hover:underline" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc ml-6 mb-4 text-slate-900" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal ml-6 mb-4 text-slate-900" {...props} />,
                              li: ({node, ...props}) => <li className="text-slate-900 mb-1" {...props} />,
                            }}
                          >
                            {rewriteResult.originalContent}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-900 mb-3">Improved Content</h4>
                      <div className="p-6 rounded-lg bg-green-50 border-2 border-green-200 max-h-[500px] overflow-y-auto prose prose-slate max-w-none">
                        <div className="text-slate-900">
                          <ReactMarkdown
                            rehypePlugins={[rehypeRaw, rehypeSanitize]}
                            components={{
                              p: ({node, ...props}) => <p className="text-slate-900 mb-4" {...props} />,
                              h1: ({node, ...props}) => <h1 className="text-slate-900 text-3xl font-bold mb-4" {...props} />,
                              h2: ({node, ...props}) => <h2 className="text-slate-900 text-2xl font-bold mb-3" {...props} />,
                              h3: ({node, ...props}) => <h3 className="text-slate-900 text-xl font-bold mb-2" {...props} />,
                              strong: ({node, ...props}) => <strong className="text-slate-900 font-bold" {...props} />,
                              a: ({node, ...props}) => <a className="text-blue-600 hover:underline" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc ml-6 mb-4 text-slate-900" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal ml-6 mb-4 text-slate-900" {...props} />,
                              li: ({node, ...props}) => <li className="text-slate-900 mb-1" {...props} />,
                            }}
                          >
                            {rewriteResult.improvedContent}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(rewriteResult.improvedContent);
                      alert('Improved content copied to clipboard!');
                    }}
                    className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    📋 Copy Improved Content
                  </button>
                  <button
                    onClick={() => setRewriteResult(null)}
                    className="px-6 py-3 rounded-xl bg-slate-200 text-slate-700 font-bold hover:bg-slate-300 transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
