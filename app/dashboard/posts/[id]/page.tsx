'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { generateComparisonPDF } from '@/lib/comparison-pdf-generator';

// Selective Improvement Button Component
function SelectiveImproveButton({
  postId,
  passType,
  label,
  emoji,
  currentScore,
  threshold,
  cost,
  time,
  onSuccess
}: {
  postId: string;
  passType: string;
  label: string;
  emoji: string;
  currentScore: number;
  threshold: number;
  cost: string;
  time: string;
  onSuccess: () => void;
}) {
  const [isImproving, setIsImproving] = useState(false);

  const handleImprove = async () => {
    if (!confirm(`Improve ${label}?\n\nCurrent Score: ${currentScore}/100\nTarget: ${threshold}+\n\nCost: ~${cost}\nTime: ~${time}\n\nThis will:\n- Focus only on ${label.toLowerCase()}\n- Preserve other improvements\n- Update the post automatically\n\nContinue?`)) {
      return;
    }

    setIsImproving(true);

    try {
      const response = await fetch(`/api/posts/${postId}/improve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passType }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to improve ${label}`);
      }

      // Show success message with before/after
      alert(`✅ ${label} Improvement Complete!\n\n📊 Overall Score: ${data.scoreBefore} → ${data.scoreAfter} (${data.improvement > 0 ? '+' : ''}${data.improvement})\n\n${emoji} ${label}: ${data.categoryScores.before[passType === 'readability' ? 'readability' : passType === 'seo' ? 'seo' : passType === 'aeo' ? 'aeo' : 'engagement']} → ${data.categoryScores.after[passType === 'readability' ? 'readability' : passType === 'seo' ? 'seo' : passType === 'aeo' ? 'aeo' : 'engagement']}\n\nRefreshing post data...`);

      // Refresh post data
      onSuccess();
    } catch (err: any) {
      alert(`❌ Improvement Failed: ${err.message}`);
    } finally {
      setIsImproving(false);
    }
  };

  const needsWork = currentScore < threshold;

  return (
    <button
      onClick={handleImprove}
      disabled={isImproving}
      className={`w-full px-4 py-3 rounded-lg border-2 font-bold text-left transition-all flex items-center justify-between ${
        needsWork
          ? 'bg-red-50 border-red-300 hover:bg-red-100 hover:border-red-400'
          : 'bg-green-50 border-green-300 hover:bg-green-100 hover:border-green-400'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{emoji}</span>
        <div>
          <div className="text-sm font-bold text-slate-900">{label}</div>
          <div className="text-xs text-slate-600">
            Score: {currentScore}/100 • {cost} • {time}
            {needsWork && <span className="ml-2 text-red-700 font-bold">⚠</span>}
          </div>
        </div>
      </div>
      {isImproving ? (
        <svg className="animate-spin h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      )}
    </button>
  );
}

export default function PostEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [post, setPost] = useState<any>(null);
  const [factChecks, setFactChecks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [editableContent, setEditableContent] = useState('');
  const [editableTitle, setEditableTitle] = useState('');
  const [editableMetaDesc, setEditableMetaDesc] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isRepurposing, setIsRepurposing] = useState(false);
  const [socialPosts, setSocialPosts] = useState<any[]>([]);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);

  useEffect(() => {
    fetchPost();
  }, [id]);

  const fetchPost = async () => {
    try {
      const response = await fetch(`/api/posts/${id}`);
      if (!response.ok) throw new Error('Failed to fetch post');

      const data = await response.json();
      console.log('📊 Post data loaded:', {
        aiso_score: data.post.aiso_score,
        aeo_score: data.post.aeo_score,
        geo_score: data.post.geo_score,
        title: data.post.title
      });
      setPost(data.post);
      setFactChecks(data.factChecks || []);
      setEditableContent(data.post.content);
      setEditableTitle(data.post.title);
      setEditableMetaDesc(data.post.meta_description || '');
      setIsLoading(false);
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');

    try {
      const response = await fetch(`/api/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editableTitle,
          meta_description: editableMetaDesc,
          content: editableContent,
        }),
      });

      if (!response.ok) throw new Error('Failed to save post');

      const data = await response.json();
      setPost(data.post);
      alert('Post saved successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!confirm('Are you sure you want to approve this post? This will mark it as ready for publication.')) {
      return;
    }

    try {
      const response = await fetch(`/api/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });

      if (!response.ok) throw new Error('Failed to approve post');

      const data = await response.json();
      setPost(data.post);
      alert('Post approved successfully!');
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Export functions
  const handleExportMarkdown = () => {
    const slug = editableTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const filename = `${slug}-${new Date().toISOString().split('T')[0]}.md`;
    const content = `# ${editableTitle}\n\n${editableMetaDesc ? `> ${editableMetaDesc}\n\n` : ''}${editableContent}`;
    downloadFile(content, filename, 'text/markdown');
  };

  const handleExportHTML = () => {
    const slug = editableTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const filename = `${slug}-${new Date().toISOString().split('T')[0]}.html`;
    const content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${editableMetaDesc || ''}">
  <title>${editableTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 2rem; color: #333; }
    h1, h2, h3 { color: #111; margin-top: 2rem; }
    pre { background: #f4f4f4; padding: 1rem; border-radius: 4px; overflow-x: auto; }
    code { background: #f4f4f4; padding: 0.2rem 0.4rem; border-radius: 3px; }
    img { max-width: 100%; height: auto; }
    blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 1rem; color: #666; }
  </style>
</head>
<body>
  <article>
    <h1>${editableTitle}</h1>
    ${editableMetaDesc ? `<p><em>${editableMetaDesc}</em></p>` : ''}
    ${editableContent.split('\n').map(line => {
      if (line.startsWith('# ')) return `<h1>${line.substring(2)}</h1>`;
      if (line.startsWith('## ')) return `<h2>${line.substring(3)}</h2>`;
      if (line.startsWith('### ')) return `<h3>${line.substring(4)}</h3>`;
      if (line.startsWith('- ')) return `<li>${line.substring(2)}</li>`;
      if (line.trim() === '') return '<br>';
      return `<p>${line}</p>`;
    }).join('\n')}
  </article>
</body>
</html>`;
    downloadFile(content, filename, 'text/html');
  };


  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAuditPost = () => {
    // Store post data in sessionStorage to avoid URL length limits
    sessionStorage.setItem('auditPostData', JSON.stringify({
      title: editableTitle,
      meta: editableMetaDesc,
      content: editableContent,
    }));

    // Navigate to audit page
    window.location.href = '/dashboard/audit?fromPost=true';
  };

  const handleRepurpose = async () => {
    if (!confirm(`This will generate 4-5 platform-specific social media posts from this blog article.\n\nPlatforms: LinkedIn, Facebook, Instagram, Twitter\n\nEstimated cost: $0.03\nTime: 30-60 seconds\n\nContinue?`)) {
      return;
    }

    setIsRepurposing(true);
    setError('');

    try {
      const response = await fetch('/api/posts/repurpose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          blogTitle: editableTitle,
          blogContent: editableContent,
          blogUrl: `https://yourdomain.com/blog/${post.id}`, // TODO: Use actual domain
          platforms: ['linkedin', 'facebook', 'instagram', 'twitter'],
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to repurpose content');
      }

      const data = await response.json();
      setSocialPosts(data.socialPosts);
      setShowSocialModal(true);
      console.log('Social posts generated:', data.socialPosts);
    } catch (err: any) {
      setError(err.message);
      alert(`Failed to repurpose content: ${err.message}`);
    } finally {
      setIsRepurposing(false);
    }
  };

  const handleRewrite = async () => {
    if (!confirm(`This will iteratively rewrite the post to improve the AISO score to 90+.\n\nCurrent AISO score: ${overallScore}/100\nTarget score: 90/100\n\nThis will:\n- Run up to 5 improvement iterations\n- Update year references to ${new Date().getFullYear()}\n- Optimize for AEO, SEO, and fact-checking\n- Generate a before/after PDF comparison\n\nEstimated cost: $0.15-0.75\nTime: 2-5 minutes\n\nContinue?`)) {
      return;
    }

    setIsRewriting(true);
    setError('');

    // Capture original content before rewriting
    const originalContent = editableContent;
    const originalTitle = editableTitle;
    const originalScore = overallScore;

    try {
      const response = await fetch(`/api/posts/${id}/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to rewrite post');
      }

      // Get the new score from API response
      const newScore = data.newScore || overallScore;
      const iterations = data.iterations || 1;

      // Generate comparison PDF with actual score breakdown from API
      generateComparisonPDF({
        title: originalTitle,
        originalContent: originalContent,
        improvedContent: data.rewrittenContent || editableContent,
        originalScore: originalScore,
        improvedScore: newScore,
        scoreBreakdown: data.scoreBreakdown || [
          { category: 'AISO Score', before: originalScore, after: newScore, improvement: newScore - originalScore },
        ],
        generatedDate: new Date().toLocaleDateString(),
      });

      // Update content and scores in state immediately
      const updateTimestamp = new Date().toISOString();
      console.log('🔄 BEFORE STATE UPDATE:', {
        oldScore: post?.aiso_score,
        newScore: newScore,
        timestamp: updateTimestamp
      });

      setEditableContent(data.rewrittenContent);
      setPost((prev: any) => ({
        ...prev,
        content: data.rewrittenContent,
        aiso_score: newScore,
        aeo_score: data.aeoScore,
        geo_score: data.geoScore,
        // Add a test field to prove state is updating
        _testUpdate: updateTimestamp,
      }));

      // Show visual "UPDATED" indicator
      setJustUpdated(true);
      setTimeout(() => setJustUpdated(false), 5000); // Hide after 5 seconds

      console.log('✅ STATE UPDATED - checking in 100ms...');

      // Wait a moment to let state update
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('🔍 AFTER STATE UPDATE (before fetchPost):', {
        currentAisoScore: post?.aiso_score,
        shouldBe: newScore,
        testTimestamp: post?._testUpdate,
      });

      // Refetch the post to ensure we have all updated data from database
      console.log('📡 Fetching from database...');
      await fetchPost();

      console.log('🔍 AFTER FETCHPOST:', {
        finalAisoScore: post?.aiso_score,
        shouldBe: newScore
      });

      console.log('✅ Post rewritten - new AISO score:', newScore);

      // Show success message after data is refreshed
      alert(`✅ Post rewritten successfully!\n\n📊 AISO Score: ${originalScore} → ${newScore} (+${newScore - originalScore})\n🔄 Iterations: ${iterations}\n📄 Comparison PDF downloaded\n\nCheck console for debug logs!\nLook for the sidebar score - it should show ${newScore}`);

    } catch (err: any) {
      setError(err.message);
      alert(`Rewrite failed: ${err.message}`);
    } finally {
      setIsRewriting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-sunset-orange border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-semibold text-slate-600">Loading post...</p>
        </div>
      </div>
    );
  }

  if (error && !post) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-red-600">Error: {error}</p>
          <Link href="/dashboard/posts" className="mt-4 inline-block text-deep-indigo hover:underline">
            Back to Posts
          </Link>
        </div>
      </div>
    );
  }

  const verifiedCount = factChecks.filter(fc => fc.status === 'verified').length;
  const uncertainCount = factChecks.filter(fc => fc.status === 'uncertain').length;
  const unverifiedCount = factChecks.filter(fc => fc.status === 'unverified').length;

  // Calculate fact-check score from individual claims
  const factCheckScore = factChecks.length > 0
    ? Math.round(factChecks.reduce((sum, fc) => sum + (fc.confidence || 0), 0) / factChecks.length)
    : 100;

  // Use AISO score if available, otherwise use fact-check score (legacy)
  // Use ?? instead of || so that 0 is not treated as falsy
  const overallScore = post?.aiso_score ?? factCheckScore;

  // Get stored scores or calculate fallback if not available
  let aeoScore = post?.aeo_score || 0;
  let geoScore = post?.geo_score || 0;
  let seoScore = 0;
  let readabilityScore = 0;
  let engagementScore = 0;

  // Calculate SEO, Readability, and Engagement scores on the fly
  if (post?.content) {
    const content = post.content;
    const title = post.title || '';

    // SEO Score calculation
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const h2Count = (content.match(/^##\s/gm) || []).length;
    const h3Count = (content.match(/^###\s/gm) || []).length;
    const imageCount = (content.match(/!\[.*?\]\(.*?\)/g) || []).length;
    const hasKeywordInTitle = title.length > 0;
    const hasKeywordInFirst100 = content.length >= 100;
    const hasInternalLinks = /\[.*?\]\(.*?\)/.test(content);

    seoScore = Math.round(
      (wordCount >= 500 ? 20 : wordCount / 25) +
      (h2Count >= 2 ? 20 : h2Count * 10) +
      (h3Count >= 2 ? 15 : h3Count * 7.5) +
      (imageCount >= 1 ? 15 : imageCount * 15) +
      (hasKeywordInTitle ? 15 : 0) +
      (hasInternalLinks ? 15 : 0)
    );

    // Readability Score - use stored intent-based score if available, otherwise calculate fallback
    if (post?.readability_score !== null && post?.readability_score !== undefined) {
      // Use the stored intent-based readability score (calculated during generation)
      readabilityScore = post.readability_score;
    } else {
      // Fallback: simplified Flesch calculation (old method for legacy posts)
      const sentences = content.split(/[.!?]+/).filter((s: string) => s.trim().length > 0).length;
      const words = wordCount;
      const syllables = words * 1.5; // Rough estimate
      const avgWordsPerSentence = sentences > 0 ? words / sentences : 0;
      const avgSyllablesPerWord = words > 0 ? syllables / words : 0;
      const fleschScore = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
      readabilityScore = Math.round(Math.min(100, Math.max(0, fleschScore)));
    }

    // Engagement Score calculation
    const hasBulletPoints = /^[-*]\s/gm.test(content);
    const hasNumberedLists = /^\d+\.\s/gm.test(content);
    const hasBoldText = /\*\*.*?\*\*/g.test(content);
    const hasQuestions = /\?/.test(content);
    const hasCallToAction = /(try|start|learn|discover|get|download|subscribe|sign up|contact)/gi.test(content);
    const paragraphCount = content.split(/\n\n+/).filter((p: string) => p.trim().length > 0).length;
    const avgParagraphLength = paragraphCount > 0 ? wordCount / paragraphCount : 0;

    engagementScore = Math.round(
      (hasBulletPoints ? 20 : 0) +
      (hasNumberedLists ? 20 : 0) +
      (hasBoldText ? 15 : 0) +
      (hasQuestions ? 15 : 0) +
      (hasCallToAction ? 15 : 0) +
      (avgParagraphLength < 100 ? 15 : 0)
    );
  }

  const isLocalContent = geoScore > 0;

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
              <Link href="/dashboard/posts" className="text-sm font-semibold text-deep-indigo border-b-2 border-sunset-orange pb-1">
                Posts
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href={post?.topic_id ? `/dashboard/strategies/${post.strategy_id || ''}#topics` : '/dashboard/posts'}
            className="group inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-slate-300 bg-white font-bold text-slate-700 hover:border-sunset-orange hover:bg-gradient-to-r hover:from-sunset-orange hover:to-orange-600 hover:text-white transition-all shadow-sm"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Topics
          </Link>

          <div className="flex gap-3">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-4 py-2 rounded-xl border-2 border-slate-300 font-bold text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-all"
            >
              {showPreview ? 'Edit Mode' : 'Preview Mode'}
            </button>
            <button
              onClick={handleRepurpose}
              disabled={isRepurposing}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isRepurposing ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Repurpose to Social
                </>
              )}
            </button>
            <button
              onClick={handleAuditPost}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Audit This Post
            </button>
            {overallScore < 90 && (
              <button
                onClick={handleRewrite}
                disabled={isRewriting}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isRewriting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Rewriting (up to 5 iterations)...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Improve to 90+ (AISO)
                  </>
                )}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={handleApprove}
              disabled={post?.status === 'approved'}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50"
            >
              {post?.status === 'approved' ? 'Approved ✓' : 'Approve Post'}
            </button>
          </div>
        </div>

        {/* Export Options */}
        {post?.status === 'approved' && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">✅ Post Approved - Ready to Export</h3>
                <p className="text-xs text-slate-600">Export your content in different formats for publishing</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExportMarkdown}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  Markdown
                </button>
                <button
                  onClick={handleExportHTML}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  HTML
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border-2 border-red-200 p-4 text-red-700 font-semibold">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          {/* Main Content Area */}
          <div className="col-span-2 space-y-6">
            {/* Title */}
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xl">
              <label className="block text-sm font-bold text-slate-700 mb-3">Post Title</label>
              <input
                type="text"
                value={editableTitle}
                onChange={(e) => setEditableTitle(e.target.value)}
                className="w-full text-2xl font-black text-slate-900 border-2 border-slate-200 rounded-xl px-4 py-3 focus:border-sunset-orange focus:outline-none focus:ring-4 focus:ring-sunset-orange/10"
              />
            </div>

            {/* Meta Description */}
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xl">
              <label className="block text-sm font-bold text-slate-700 mb-3">Meta Description</label>
              <textarea
                value={editableMetaDesc}
                onChange={(e) => setEditableMetaDesc(e.target.value)}
                rows={2}
                className="w-full text-slate-900 border-2 border-slate-200 rounded-xl px-4 py-3 focus:border-sunset-orange focus:outline-none focus:ring-4 focus:ring-sunset-orange/10"
              />
              <p className="mt-2 text-sm text-slate-500">{editableMetaDesc.length} / 160 characters</p>
            </div>

            {/* Content */}
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xl">
              <label className="block text-sm font-bold text-slate-700 mb-3">Content</label>
              {showPreview ? (
                <div className="prose max-w-none" style={{
                  color: '#0f172a',
                  fontSize: '16px',
                  lineHeight: '1.75'
                }}>
                  <ReactMarkdown
                    components={{
                      p: ({node, ...props}) => <p style={{color: '#0f172a', marginBottom: '1rem'}} {...props} />,
                      h1: ({node, ...props}) => <h1 style={{color: '#0f172a', fontSize: '2.25rem', fontWeight: 'bold', marginBottom: '1rem'}} {...props} />,
                      h2: ({node, ...props}) => <h2 style={{color: '#0f172a', fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.875rem'}} {...props} />,
                      h3: ({node, ...props}) => <h3 style={{color: '#0f172a', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.75rem'}} {...props} />,
                      li: ({node, ...props}) => <li style={{color: '#0f172a'}} {...props} />,
                      strong: ({node, ...props}) => <strong style={{color: '#0f172a', fontWeight: 'bold'}} {...props} />,
                    }}
                  >
                    {editableContent}
                  </ReactMarkdown>
                </div>
              ) : (
                <textarea
                  value={editableContent}
                  onChange={(e) => setEditableContent(e.target.value)}
                  rows={25}
                  className="w-full font-mono text-sm text-slate-900 border-2 border-slate-200 rounded-xl px-4 py-3 focus:border-sunset-orange focus:outline-none focus:ring-4 focus:ring-sunset-orange/10"
                />
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Post Stats */}
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xl">
              <h3 className="text-lg font-black text-slate-900 mb-4">Post Details</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                    post?.status === 'approved' ? 'bg-green-100 text-green-700' :
                    post?.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {post?.status || 'draft'}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Word Count</p>
                  <p className="text-lg font-black text-slate-900">{post?.word_count || 0} words</p>
                </div>
              </div>
            </div>

            {/* Generation Stats */}
            {(post?.generation_iterations || post?.generation_cost_cents || post?.generation_time_seconds) && (
              <div className="rounded-2xl border border-slate-200/60 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-xl">
                <h3 className="text-lg font-black text-slate-900 mb-4">Generation Stats</h3>
                <div className="space-y-3">
                  {post?.generation_iterations && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Iterations</p>
                      <p className="text-lg font-black text-deep-indigo">{post.generation_iterations}</p>
                    </div>
                  )}
                  {post?.generation_cost_cents && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Est. Cost</p>
                      <p className="text-lg font-black text-deep-indigo">${(post.generation_cost_cents / 100).toFixed(2)}</p>
                    </div>
                  )}
                  {post?.generation_time_seconds && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Time</p>
                      <p className="text-lg font-black text-deep-indigo">
                        {post.generation_time_seconds < 60
                          ? `${post.generation_time_seconds}s`
                          : `${Math.floor(post.generation_time_seconds / 60)}m ${post.generation_time_seconds % 60}s`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AISO Score Breakdown */}
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xl">
              <h3 className="text-lg font-black text-slate-900 mb-4">Content Quality Score</h3>

              {/* Overall AISO Score */}
              <div className={`mb-4 p-4 rounded-xl border ${
                overallScore >= 90 ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' :
                overallScore >= 75 ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200' :
                'bg-gradient-to-br from-red-50 to-orange-50 border-red-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Overall Quality Score</p>
                  {justUpdated && (
                    <span className="animate-pulse px-2 py-1 rounded-md bg-green-500 text-white text-xs font-black">
                      ✨ JUST UPDATED!
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <p className={`text-4xl font-black ${
                    overallScore >= 90 ? 'text-green-700' :
                    overallScore >= 75 ? 'text-deep-indigo' :
                    'text-red-700'
                  }`}>{overallScore}</p>
                  <p className="text-lg font-bold text-slate-600">/ 100</p>
                  {post?._testUpdate && (
                    <span className="text-xs text-slate-400 ml-2">
                      ({new Date(post._testUpdate).toLocaleTimeString()})
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs font-bold text-slate-600">
                  {overallScore >= 90 ? '✨ Excellent - Ready to publish' :
                   overallScore >= 75 ? '📊 Good - Consider improvements below' :
                   '📉 Needs work - Use targeted improvements'}
                </p>
              </div>

              {/* Score Components */}
              <div className="space-y-2 mb-4">
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-blue-900">🤖 AEO (Answer Engines)</span>
                    <span className="text-lg font-black text-blue-900">
                      {aeoScore > 0 ? `${aeoScore}/100` : '—'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {aeoScore > 0 ? 'Google SGE, ChatGPT, Perplexity' : 'Not calculated - use Rewrite to calculate'}
                  </p>
                  {aeoScore > 0 && (
                    <div className="mt-2 w-full bg-blue-100 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${aeoScore}%` }}></div>
                    </div>
                  )}
                </div>

                {isLocalContent && geoScore > 0 && (
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-green-900">📍 GEO (Local Search)</span>
                      <span className="text-lg font-black text-green-900">{geoScore}/100</span>
                    </div>
                    <p className="text-xs text-slate-600">Google Business Profile optimization</p>
                    <div className="mt-2 w-full bg-green-100 rounded-full h-2">
                      <div className="bg-green-600 h-2 rounded-full" style={{ width: `${geoScore}%` }}></div>
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-purple-900">✓ Fact-Check</span>
                    <span className="text-lg font-black text-purple-900">{factCheckScore}/100</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {verifiedCount} verified, {uncertainCount} uncertain, {unverifiedCount} unverified
                  </p>
                  <div className="mt-2 w-full bg-purple-100 rounded-full h-2">
                    <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${factCheckScore}%` }}></div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-indigo-900">📊 SEO</span>
                    <span className="text-lg font-black text-indigo-900">{seoScore}/100</span>
                  </div>
                  <p className="text-xs text-slate-600">Headers, keywords, structure</p>
                  <div className="mt-2 w-full bg-indigo-100 rounded-full h-2">
                    <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${seoScore}%` }}></div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-cyan-50 border border-cyan-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-cyan-900">📖 Readability</span>
                    <span className="text-lg font-black text-cyan-900">{readabilityScore}/100</span>
                  </div>
                  {post?.target_flesch_score && post?.actual_flesch_score ? (
                    // Intent-based readability display (show target vs actual)
                    <div className="text-xs text-slate-600">
                      <div className="flex items-center justify-between mb-1">
                        <span>Target Flesch:</span>
                        <span className="font-bold text-deep-indigo">{post.target_flesch_score}</span>
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <span>Actual Flesch:</span>
                        <span className="font-bold">{post.actual_flesch_score}</span>
                      </div>
                      {post.readability_gap !== null && post.readability_gap !== undefined && (
                        <div className="flex items-center justify-between">
                          <span>Gap:</span>
                          <span className={`font-bold ${post.readability_gap <= 5 ? 'text-green-700' : post.readability_gap <= 10 ? 'text-blue-700' : 'text-orange-700'}`}>
                            {post.readability_gap} pts
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Fallback display for legacy posts
                    <p className="text-xs text-slate-600">Sentence length, complexity</p>
                  )}
                  <div className="mt-2 w-full bg-cyan-100 rounded-full h-2">
                    <div className="bg-cyan-600 h-2 rounded-full" style={{ width: `${readabilityScore}%` }}></div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-orange-900">🎯 Engagement</span>
                    <span className="text-lg font-black text-orange-900">{engagementScore}/100</span>
                  </div>
                  <p className="text-xs text-slate-600">CTAs, formatting, hooks</p>
                  <div className="mt-2 w-full bg-orange-100 rounded-full h-2">
                    <div className="bg-orange-600 h-2 rounded-full" style={{ width: `${engagementScore}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Score Weights Info */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 mb-4">
                <p className="text-xs font-bold text-slate-700 mb-2">AISO Weights:</p>
                <div className="text-xs text-slate-600 space-y-1">
                  {isLocalContent ? (
                    <>
                      <div className="flex justify-between">
                        <span>Fact-Check:</span>
                        <span className="font-bold">25%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>AEO:</span>
                        <span className="font-bold">20%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>GEO:</span>
                        <span className="font-bold">10%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SEO + Readability + Engagement:</span>
                        <span className="font-bold">45%</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span>Fact-Check:</span>
                        <span className="font-bold">30%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>AEO:</span>
                        <span className="font-bold">25%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SEO + Readability + Engagement:</span>
                        <span className="font-bold">45%</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Fact-Check Details (Collapsible) */}
              {factChecks.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer text-sm font-bold text-slate-700 hover:text-deep-indigo transition-colors mb-2">
                    View {factChecks.length} Fact-Check{factChecks.length !== 1 ? 's' : ''} ›
                  </summary>
                  <div className="space-y-2 mt-3">
                    {factChecks.map((fc, idx) => (
                      <div key={idx} className={`p-3 rounded-lg border ${
                        fc.status === 'verified' ? 'bg-green-50 border-green-200' :
                        fc.status === 'uncertain' ? 'bg-yellow-50 border-yellow-200' :
                        'bg-red-50 border-red-200'
                      }`}>
                        <p className="text-xs font-bold mb-1 text-slate-900">{fc.claim}</p>
                        <p className="text-xs text-slate-900 font-semibold">
                          {fc.status === 'verified' ? '✓' : fc.status === 'uncertain' ? '?' : '✗'} {fc.confidence}% confidence
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>

            {/* Selective Improvement Buttons */}
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xl">
              <h3 className="text-lg font-black text-slate-900 mb-3">Quick Improvements</h3>
              <p className="text-xs text-slate-600 mb-4">Improve specific areas without rewriting the entire post.</p>

              <div className="space-y-2">
                <SelectiveImproveButton
                  postId={id}
                  passType="readability"
                  label="Fix Readability"
                  emoji="📖"
                  currentScore={readabilityScore}
                  threshold={65}
                  cost="$0.12"
                  time="15s"
                  onSuccess={fetchPost}
                />
                <SelectiveImproveButton
                  postId={id}
                  passType="seo"
                  label="Improve SEO"
                  emoji="📊"
                  currentScore={seoScore}
                  threshold={65}
                  cost="$0.12"
                  time="15s"
                  onSuccess={fetchPost}
                />
                <SelectiveImproveButton
                  postId={id}
                  passType="aeo"
                  label="Add FAQ/AEO"
                  emoji="🤖"
                  currentScore={aeoScore}
                  threshold={70}
                  cost="$0.15"
                  time="20s"
                  onSuccess={fetchPost}
                />
                <SelectiveImproveButton
                  postId={id}
                  passType="engagement"
                  label="Polish Engagement"
                  emoji="🎯"
                  currentScore={engagementScore}
                  threshold={65}
                  cost="$0.12"
                  time="15s"
                  onSuccess={fetchPost}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Social Media Posts Modal */}
      {showSocialModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50" onClick={() => setShowSocialModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-pink-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">Social Media Content Pack</h2>
                  <p className="text-sm text-slate-600 mt-1">Ready-to-post content for {socialPosts.length} platforms</p>
                </div>
                <button
                  onClick={() => setShowSocialModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-6">
                {socialPosts.map((socialPost, idx) => {
                  const platformColors = {
                    linkedin: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-900', badge: 'bg-blue-100' },
                    facebook: { bg: 'bg-indigo-50', border: 'border-indigo-300', text: 'text-indigo-900', badge: 'bg-indigo-100' },
                    instagram: { bg: 'bg-pink-50', border: 'border-pink-300', text: 'text-pink-900', badge: 'bg-pink-100' },
                    twitter: { bg: 'bg-sky-50', border: 'border-sky-300', text: 'text-sky-900', badge: 'bg-sky-100' },
                    pinterest: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-900', badge: 'bg-red-100' }
                  };
                  const colors = platformColors[socialPost.platform as keyof typeof platformColors] || platformColors.facebook;

                  return (
                    <div key={idx} className={`p-6 rounded-xl border-2 ${colors.bg} ${colors.border}`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${colors.badge} ${colors.text}`}>
                            {socialPost.platform}
                          </span>
                          <span className="text-sm text-slate-600">{socialPost.characterCount} characters</span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(socialPost.content + '\n\n' + socialPost.callToAction);
                            alert('Copied to clipboard!');
                          }}
                          className="px-4 py-2 rounded-lg bg-white border-2 border-slate-300 text-slate-700 font-bold text-sm hover:border-slate-400 hover:shadow transition-all flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy
                        </button>
                      </div>

                      <div className={`mb-4 ${colors.text}`}>
                        <p className="text-sm font-semibold leading-relaxed whitespace-pre-wrap">{socialPost.content}</p>
                      </div>

                      {socialPost.hashtags && socialPost.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {socialPost.hashtags.map((tag: string, tagIdx: number) => (
                            <span key={tagIdx} className={`px-2 py-1 rounded text-xs font-bold ${colors.text} bg-white/60`}>
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {socialPost.imagePrompt && (
                        <div className="mb-4 p-3 rounded-lg bg-white/60 border border-white">
                          <p className="text-xs font-bold text-slate-600 mb-1">Image Suggestion:</p>
                          <p className="text-xs text-slate-700">{socialPost.imagePrompt}</p>
                        </div>
                      )}

                      <div className="p-3 rounded-lg bg-white/80 border border-white">
                        <p className="text-sm font-bold text-slate-800">{socialPost.callToAction}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-purple-100 to-pink-100 border-2 border-purple-300">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-bold text-purple-900 mb-1">Pro Tips:</p>
                    <ul className="text-xs text-purple-800 space-y-1">
                      <li>• Schedule these posts over 1-2 weeks for maximum reach</li>
                      <li>• Add branded visuals to increase engagement by 2-3x</li>
                      <li>• Update [YOUR_URL] placeholders with your actual article link</li>
                      <li>• Monitor engagement and repost top performers</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowSocialModal(false)}
                className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
