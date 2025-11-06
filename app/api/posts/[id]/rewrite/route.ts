import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { improveContentFivePass } from '@/lib/content';
import { performFactCheck } from '@/lib/fact-check';

/**
 * POST /api/posts/[id]/rewrite
 * Rewrite a post to improve AISO score using 5-pass sequential improvement system
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;

    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await db.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get post and verify ownership
    const post = await db.getPostById(postId);
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (post.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get topic details for local context
    const topic = await db.getTopicById(post.topic_id);
    if (!topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    // Get strategy details for local context
    const strategy = await db.getStrategyById(topic.strategy_id);
    if (!strategy) {
      return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
    }

    console.log(`\n🔄 Rewriting post with 5-Pass System: ${post.title} (ID: ${postId})`);

    // Determine local context
    const localContext = strategy.content_type === 'local' || strategy.content_type === 'hybrid'
      ? {
          city: strategy.city,
          state: strategy.state,
          serviceArea: strategy.service_area,
        }
      : undefined;

    const isLocalContent = !!localContext;

    // Get original score for comparison
    const originalScore = post.aiso_score || 0;
    console.log(`📊 Original AISO Score: ${originalScore}/100`);

    // Run 5-pass improvement system
    const improvementResult = await improveContentFivePass(
      post.content,
      post.title,
      post.meta_description || '',
      localContext
    );

    // Check if topic was rejected (score < 60)
    if (improvementResult.topicRejection) {
      console.log('\n❌ Topic rejected - quality score too low');
      return NextResponse.json({
        success: false,
        error: improvementResult.error,
        topicRejection: true,
        finalScore: improvementResult.finalScore,
        passResults: improvementResult.passResults,
        message: 'This topic did not meet minimum quality standards after all improvement attempts. Please choose a different topic or provide additional research data to improve content quality.',
      }, { status: 422 }); // 422 Unprocessable Entity
    }

    // Update the post with improved content
    console.log(`\n📝 Updating post with 5-pass results (Final Score: ${improvementResult.finalScore}/100)...`);

    await db.updatePost(postId, {
      content: improvementResult.content,
      title: improvementResult.title,
      meta_description: improvementResult.metaDescription,
      word_count: improvementResult.content.split(/\s+/).filter(Boolean).length,
      aeo_score: improvementResult.scores.aeoScore,
      geo_score: improvementResult.scores.geoScore,
      aiso_score: improvementResult.finalScore,
    });

    // Delete old fact-check records
    await db.deleteFactChecksByPostId(postId);

    // Create new fact-check records
    if (improvementResult.scores.factCheckScore) {
      const factCheckResult = await performFactCheck(improvementResult.content);
      for (const factCheck of factCheckResult.factChecks) {
        await db.createFactCheck({
          post_id: postId,
          claim: factCheck.claim,
          status: factCheck.status,
          confidence: factCheck.confidence,
          sources: factCheck.sources,
        });
      }
    }

    // Log usage
    const estimatedCost = 0.20 * 5; // 5 passes
    await db.logUsage({
      user_id: user.id,
      operation_type: 'content_rewrite',
      cost_usd: estimatedCost,
      tokens_used: 8000 * 5,
      metadata: {
        action: 'rewrite_post_5pass',
        post_id: postId,
        original_score: originalScore,
        final_score: improvementResult.finalScore,
        improvement: improvementResult.finalScore - originalScore,
        passes: 5,
        content_length: improvementResult.content.length,
        pass_results: improvementResult.passResults,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Post rewritten successfully using 5-pass system! AISO score improved from ${originalScore} to ${improvementResult.finalScore}.`,
      originalScore,
      newScore: improvementResult.finalScore,
      improvement: improvementResult.finalScore - originalScore,
      passResults: improvementResult.passResults,
      rewrittenContent: improvementResult.content,
      scoreBreakdown: [
        {
          category: 'AISO Score',
          before: originalScore,
          after: improvementResult.finalScore,
          improvement: improvementResult.finalScore - originalScore
        },
        {
          category: `Fact-Check (${isLocalContent ? '25%' : '30%'})`,
          before: 0, // We don't track original fact-check in this simplified flow
          after: improvementResult.scores.factCheckScore || 0,
          improvement: improvementResult.scores.factCheckScore || 0
        },
        {
          category: `AEO (${isLocalContent ? '20%' : '25%'})`,
          before: 0,
          after: improvementResult.scores.aeoScore,
          improvement: improvementResult.scores.aeoScore
        },
        ...(isLocalContent ? [{
          category: 'GEO (10%)',
          before: 0,
          after: improvementResult.scores.geoScore || 0,
          improvement: improvementResult.scores.geoScore || 0
        }] : []),
        {
          category: 'SEO (15%)',
          before: 0,
          after: improvementResult.scores.seoScore,
          improvement: improvementResult.scores.seoScore
        },
        {
          category: 'Readability (15%)',
          before: 0,
          after: improvementResult.scores.readabilityScore,
          improvement: improvementResult.scores.readabilityScore
        },
        {
          category: 'Engagement (15%)',
          before: 0,
          after: improvementResult.scores.engagementScore,
          improvement: improvementResult.scores.engagementScore
        }
      ],
      factCheckScore: improvementResult.scores.factCheckScore,
      aeoScore: improvementResult.scores.aeoScore,
      geoScore: improvementResult.scores.geoScore,
      seoScore: improvementResult.scores.seoScore,
      readabilityScore: improvementResult.scores.readabilityScore,
      engagementScore: improvementResult.scores.engagementScore,
      post: {
        id: postId,
        title: improvementResult.title,
        wordCount: improvementResult.content.split(/\s+/).filter(Boolean).length,
      },
    });
  } catch (error: any) {
    console.error('Post rewrite error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to rewrite post' },
      { status: 500 }
    );
  }
}
