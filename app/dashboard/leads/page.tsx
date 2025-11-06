'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';

interface LeadResult {
  domain: string;
  businessName: string;
  city: string;
  state: string;
  overallScore: number;
  technicalSEO: number;
  onPageSEO: number;
  contentMarketing: number;
  localSEO: number;
  hasBlog: boolean;
  blogPostCount: number;
  lastBlogUpdate?: string;
  opportunityRating: 'high' | 'medium' | 'low';
  seoIssues: Array<{
    category: string;
    issue: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    fix: string;
  }>;
  opportunityType?: 'missing-technical-seo' | 'no-content-strategy' | 'weak-local-seo' | 'needs-optimization';
}

export default function LeadsPage() {
  const [industry, setIndustry] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [limit, setLimit] = useState(15);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<LeadResult[]>([]);
  const [error, setError] = useState('');
  const [filterRange, setFilterRange] = useState<'all' | 'sweet-spot' | 'high' | 'low'>('sweet-spot');
  const [generatingReportFor, setGeneratingReportFor] = useState<string | null>(null);
  const [savingToPipeline, setSavingToPipeline] = useState<string | null>(null);
  const [savedLeads, setSavedLeads] = useState<Set<string>>(new Set());

  const handleSearch = async () => {
    if (!industry.trim() || !city.trim()) {
      setError('Please enter both industry and city');
      return;
    }

    setIsSearching(true);
    setError('');
    setResults([]);

    try {
      const response = await fetch('/api/leads/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry, city, state, limit }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to discover leads');
      }

      setResults(data.leads);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleGenerateReport = async (lead: LeadResult) => {
    setGeneratingReportFor(lead.domain);

    try {
      const response = await fetch('/api/leads/opportunity-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: lead.domain,
          businessName: lead.businessName,
          city: lead.city,
          state: lead.state,
          overallScore: lead.overallScore,
          technicalSEO: lead.technicalSEO,
          onPageSEO: lead.onPageSEO,
          contentMarketing: lead.contentMarketing,
          localSEO: lead.localSEO,
          seoIssues: lead.seoIssues,
          hasBlog: lead.hasBlog,
          blogPostCount: lead.blogPostCount,
          industry: industry,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate report');
      }

      // Download the PDF
      const blob = await response.blob();

      // Ensure blob is fully loaded
      if (blob.size === 0) {
        throw new Error('PDF generation returned empty file');
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Opportunity-Report-${lead.businessName.replace(/[^a-z0-9]/gi, '-')}.pdf`;
      document.body.appendChild(a);

      // Small delay to ensure download is ready
      await new Promise(resolve => setTimeout(resolve, 100));

      a.click();

      // Clean up after a delay to ensure download starts
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 1000);

      // Show success message
      alert('✓ PDF report downloaded successfully!');
    } catch (err: any) {
      alert(`Failed to generate report: ${err.message}`);
    } finally {
      setGeneratingReportFor(null);
    }
  };

  const handleSaveToPipeline = async (lead: LeadResult) => {
    setSavingToPipeline(lead.domain);

    try {
      const response = await fetch('/api/leads/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: lead.domain,
          business_name: lead.businessName,
          city: lead.city,
          state: lead.state,
          industry: industry,
          overall_score: lead.overallScore,
          content_score: lead.contentScore,
          seo_score: lead.seoScore,
          design_score: lead.designScore,
          speed_score: lead.speedScore,
          has_blog: lead.hasBlog,
          blog_post_count: lead.blogPostCount,
          last_blog_update: lead.lastBlogUpdate,
          opportunity_rating: lead.opportunityRating,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save lead');
      }

      // Mark as saved
      setSavedLeads(prev => new Set(prev).add(lead.domain));
      alert('✓ Lead saved to pipeline!');
    } catch (err: any) {
      alert(`Failed to save lead: ${err.message}`);
    } finally {
      setSavingToPipeline(null);
    }
  };

  const getFilteredResults = () => {
    if (filterRange === 'all') return results;
    if (filterRange === 'sweet-spot') return results.filter(r => r.overallScore >= 45 && r.overallScore <= 70);
    if (filterRange === 'high') return results.filter(r => r.overallScore > 70);
    if (filterRange === 'low') return results.filter(r => r.overallScore < 45);
    return results;
  };

  const filteredResults = getFilteredResults();

  const getScoreColor = (score: number) => {
    if (score > 70) return 'text-green-700 bg-green-50 border-green-300';
    if (score >= 45) return 'text-orange-600 bg-orange-50 border-orange-300'; // Sweet spot
    return 'text-red-700 bg-red-50 border-red-300';
  };

  const getOpportunityBadge = (rating: string) => {
    if (rating === 'high') return { text: 'High Opportunity', color: 'bg-orange-100 text-orange-800 border-orange-300' };
    if (rating === 'medium') return { text: 'Medium Opportunity', color: 'bg-blue-100 text-blue-800 border-blue-300' };
    return { text: 'Low Priority', color: 'bg-slate-100 text-slate-600 border-slate-300' };
  };

  const getOpportunityTypeInfo = (lead: LeadResult) => {
    const criticalCount = lead.seoIssues.filter(i => i.severity === 'critical').length;
    const highCount = lead.seoIssues.filter(i => i.severity === 'high').length;

    switch (lead.opportunityType) {
      case 'missing-technical-seo':
        return {
          icon: '🔧',
          label: 'Missing Technical SEO',
          color: 'bg-red-50 border-red-300 text-red-900',
          message: `${criticalCount} critical technical issues found. Missing title tags, meta descriptions, or schema markup.`,
          pitch: '"Your website is invisible to search engines due to missing technical SEO elements. Let me fix these issues to get you ranking."'
        };
      case 'no-content-strategy':
        return {
          icon: '📝',
          label: 'No Content Strategy',
          color: 'bg-purple-50 border-purple-300 text-purple-900',
          message: lead.hasBlog ?
            `Blog exists but content marketing score is only ${lead.contentMarketing}/100. Not optimized for search.` :
            'No blog or content marketing strategy. Missing out on massive organic traffic opportunity.',
          pitch: lead.hasBlog ?
            '"Your blog isn\'t optimized for search engines. Let\'s create an SEO content strategy to capture your target keywords."' :
            '"You\'re missing out on free organic traffic. Let\'s build a blog that ranks for keywords your customers are searching."'
        };
      case 'weak-local-seo':
        return {
          icon: '📍',
          label: 'Weak Local SEO',
          color: 'bg-blue-50 border-blue-300 text-blue-900',
          message: `Local SEO score: ${lead.localSEO}/100. Missing NAP consistency or location keywords for local rankings.`,
          pitch: '"Local customers can\'t find you online. Let\'s optimize your local SEO so you show up when people search for [service] in [city]."'
        };
      case 'needs-optimization':
        return {
          icon: '⚡',
          label: 'SEO Optimization Needed',
          color: 'bg-amber-50 border-amber-300 text-amber-900',
          message: `Overall SEO: ${lead.overallScore}/100. ${highCount} high-priority issues affecting search rankings.`,
          pitch: '"Your website has solid foundations but isn\'t optimized for search. Let\'s fix these SEO issues to boost your organic traffic."'
        };
      default:
        return null;
    }
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
              <Link href="/dashboard/leads" className="text-sm font-semibold text-deep-indigo">
                Lead Discovery
              </Link>
              <Link href="/dashboard/pipeline" className="text-sm font-semibold text-slate-600 hover:text-deep-indigo transition-all duration-200 hover:scale-105">
                Pipeline
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
          <h1 className="text-5xl font-black bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Lead Discovery Engine
          </h1>
          <p className="text-lg text-slate-700">
            Find businesses that care enough to invest in marketing, but need help to do it right.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm font-bold text-red-800">{error}</p>
          </div>
        )}

        {/* Search Form */}
        {!results.length && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl mb-8">
            <h2 className="text-2xl font-black text-slate-900 mb-6">Find Your Perfect Prospects</h2>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Industry / Business Type
                </label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g., radiology practices, dental clinics, law firms"
                  className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                  style={{ color: '#0f172a' }}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g., Phoenix, Chicago, Miami"
                  className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                  style={{ color: '#0f172a' }}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  State (Optional)
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g., AZ, IL, FL"
                  className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                  style={{ color: '#0f172a' }}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Number of Results (5-25)
                </label>
                <input
                  type="number"
                  min="5"
                  max="25"
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value))}
                  className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                  style={{ color: '#0f172a' }}
                />
                <p className="mt-2 text-xs text-slate-600">
                  Estimated cost: ${(limit * 0.05).toFixed(2)} (5¢ per prospect)
                </p>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-slate-50 border-2 border-slate-200 mb-6">
              <h3 className="text-sm font-bold text-slate-900 mb-3">How It Works:</h3>
              <ol className="space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-purple-600">1.</span>
                  <span>We search Google for businesses matching your criteria</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-purple-600">2.</span>
                  <span>We analyze each website for content quality, SEO, design, and speed</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-purple-600">3.</span>
                  <span>We filter for the <strong>"sweet spot"</strong> - businesses that care but need help (50-75 score)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-purple-600">4.</span>
                  <span>You get a prioritized list with contact info and audit-ready prospects</span>
                </li>
              </ol>
            </div>

            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isSearching ? (
                <>
                  <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Discovering Leads...
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Discover Leads
                </>
              )}
            </button>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <>
            {/* Summary & Filters */}
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl mb-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    Found {results.length} Prospects
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Showing {filteredResults.length} {filterRange === 'sweet-spot' ? 'sweet spot opportunities' : 'results'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setResults([]);
                    setIndustry('');
                    setCity('');
                    setState('');
                  }}
                  className="text-sm font-semibold text-slate-600 hover:text-deep-indigo"
                >
                  ← New Search
                </button>
              </div>

              {/* Filter Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setFilterRange('sweet-spot')}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                    filterRange === 'sweet-spot'
                      ? 'bg-orange-100 text-orange-800 border-2 border-orange-300'
                      : 'bg-slate-100 text-slate-600 border-2 border-slate-200 hover:border-orange-300'
                  }`}
                >
                  Sweet Spot (50-75)
                </button>
                <button
                  onClick={() => setFilterRange('high')}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                    filterRange === 'high'
                      ? 'bg-green-100 text-green-800 border-2 border-green-300'
                      : 'bg-slate-100 text-slate-600 border-2 border-slate-200 hover:border-green-300'
                  }`}
                >
                  High Scores (75+)
                </button>
                <button
                  onClick={() => setFilterRange('low')}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                    filterRange === 'low'
                      ? 'bg-red-100 text-red-800 border-2 border-red-300'
                      : 'bg-slate-100 text-slate-600 border-2 border-slate-200 hover:border-red-300'
                  }`}
                >
                  Low Scores (&lt;50)
                </button>
                <button
                  onClick={() => setFilterRange('all')}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                    filterRange === 'all'
                      ? 'bg-purple-100 text-purple-800 border-2 border-purple-300'
                      : 'bg-slate-100 text-slate-600 border-2 border-slate-200 hover:border-purple-300'
                  }`}
                >
                  All Results
                </button>
              </div>
            </div>

            {/* Results Table */}
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
              <div className="space-y-6">
                {filteredResults.map((lead, idx) => {
                  const oppBadge = getOpportunityBadge(lead.opportunityRating);
                  return (
                    <div
                      key={idx}
                      className="p-6 rounded-xl border-2 border-slate-200 hover:border-purple-300 hover:shadow-lg transition-all"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-black text-slate-900">{lead.businessName}</h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${oppBadge.color}`}>
                              {oppBadge.text}
                            </span>
                          </div>
                          <a
                            href={`https://${lead.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-purple-600 hover:text-purple-800 font-semibold"
                          >
                            {lead.domain} →
                          </a>
                          <p className="text-sm text-slate-600 mt-1">
                            {lead.city}, {lead.state}
                          </p>
                        </div>

                        <div className="text-right">
                          <div className={`text-3xl font-black px-4 py-2 rounded-lg border-2 ${getScoreColor(lead.overallScore)}`}>
                            {lead.overallScore}
                          </div>
                          <p className="text-xs text-slate-600 mt-1">Overall Score</p>
                        </div>
                      </div>

                      {/* SEO Score Breakdown */}
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div className="text-center p-3 rounded-lg bg-red-50">
                          <div className="text-xl font-bold text-red-900">{lead.technicalSEO}</div>
                          <div className="text-xs text-red-700 font-semibold">Technical SEO</div>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-blue-50">
                          <div className="text-xl font-bold text-blue-900">{lead.onPageSEO}</div>
                          <div className="text-xs text-blue-700 font-semibold">On-Page SEO</div>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-purple-50">
                          <div className="text-xl font-bold text-purple-900">{lead.contentMarketing}</div>
                          <div className="text-xs text-purple-700 font-semibold">Content</div>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-green-50">
                          <div className="text-xl font-bold text-green-900">{lead.localSEO}</div>
                          <div className="text-xs text-green-700 font-semibold">Local SEO</div>
                        </div>
                      </div>

                      {/* Blog Status */}
                      <div className="mb-4">
                        <div className="flex items-center gap-4 text-sm">
                          <span className={`font-semibold ${lead.hasBlog ? 'text-green-700' : 'text-red-700'}`}>
                            {lead.hasBlog ? '✓ Has Blog' : '✗ No Blog'}
                          </span>
                          {lead.hasBlog && (
                            <>
                              <span className="text-slate-400">•</span>
                              <span className="text-slate-600">{lead.blogPostCount} posts</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* SEO Issues List */}
                      {lead.seoIssues && lead.seoIssues.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Top SEO Issues ({lead.seoIssues.length})</p>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {lead.seoIssues.slice(0, 5).map((issue, idx) => {
                              const severityColors = {
                                critical: 'bg-red-50 border-red-300 text-red-900',
                                high: 'bg-orange-50 border-orange-300 text-orange-900',
                                medium: 'bg-yellow-50 border-yellow-300 text-yellow-900',
                                low: 'bg-blue-50 border-blue-300 text-blue-900'
                              };
                              return (
                                <div key={idx} className={`p-2 rounded border ${severityColors[issue.severity]}`}>
                                  <div className="flex items-start gap-2">
                                    <span className="text-xs font-bold uppercase">{issue.severity}</span>
                                    <div className="flex-1">
                                      <p className="text-xs font-semibold">{issue.issue}</p>
                                      <p className="text-xs opacity-75 mt-0.5">Fix: {issue.fix}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                        {/* Opportunity Type - The Money Maker */}
                        {(() => {
                          const oppInfo = getOpportunityTypeInfo(lead);
                          if (!oppInfo) return null;

                          return (
                            <div className={`p-4 rounded-lg border-2 ${oppInfo.color}`}>
                              <div className="flex items-start gap-3">
                                <span className="text-2xl">{oppInfo.icon}</span>
                                <div className="flex-1">
                                  <div className="font-bold text-sm mb-1">{oppInfo.label}</div>
                                  <div className="text-xs mb-2 opacity-90">{oppInfo.message}</div>
                                  <div className="text-xs italic opacity-75 bg-white/50 p-2 rounded border border-current/20">
                                    <strong>Your Pitch:</strong> {oppInfo.pitch}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                      {/* Actions */}
                      <div className="flex gap-3">
                        {!savedLeads.has(lead.domain) ? (
                          <button
                            onClick={() => handleSaveToPipeline(lead)}
                            disabled={savingToPipeline === lead.domain}
                            className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-sm hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {savingToPipeline === lead.domain ? (
                              <>
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Saving...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Save to Pipeline
                              </>
                            )}
                          </button>
                        ) : (
                          <div className="flex-1 px-4 py-2 rounded-lg bg-green-100 border-2 border-green-500 text-green-800 font-bold text-sm flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Saved
                          </div>
                        )}
                        <button
                          onClick={() => handleGenerateReport(lead)}
                          disabled={generatingReportFor === lead.domain}
                          className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold text-sm hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {generatingReportFor === lead.domain ? (
                            <>
                              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Generating...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Sales Report ($0.02)
                            </>
                          )}
                        </button>
                        <Link
                          href={`/dashboard/audit/batch?url=https://${lead.domain}`}
                          className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-sm text-center hover:shadow-lg hover:scale-105 transition-all"
                        >
                          Full Audit ($0.60)
                        </Link>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(lead.domain);
                            alert('Domain copied to clipboard!');
                          }}
                          className="px-4 py-2 rounded-lg border-2 border-slate-300 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
