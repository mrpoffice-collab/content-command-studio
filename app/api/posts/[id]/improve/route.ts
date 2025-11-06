import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import {
  improveReadability,
  improveStructureSEO,
  improveAEO,
  improveEngagement
} from '@/lib/content';
import { performFactCheck } from '@/lib/fact-check';

/**
 * POST /api/posts/[id]/improve
 * Selective improvement - user chooses which pass to run
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    const body = await request.json();
    const { passType } = body; // 'readability' | 'seo' | 'aeo' | 'engagement'

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

    // Get strategy details for local context and target Flesch score
    const strategy = await db.getStrategyById(topic.strategy_id);
    if (!strategy) {
      return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
    }

    console.log(`\n🔧 Running ${passType} improvement on: ${post.title} (ID: ${postId})`);
    if (strategy.target_flesch_score) {
      console.log(`   🎯 Target Flesch Score: ${strategy.target_flesch_score} (${
        strategy.target_flesch_score >= 70 ? '7th grade - general public' :
        strategy.target_flesch_score >= 60 ? '8th-9th grade - standard' :
        strategy.target_flesch_score >= 50 ? '10th grade - educated adults' :
        strategy.target_flesch_score >= 40 ? 'College level - professionals' :
        'Graduate level - technical experts'
      })`);
    }

    // Determine local context
    const localContext = strategy.content_type === 'local' || strategy.content_type === 'hybrid'
      ? {
          city: strategy.city,
          state: strategy.state,
          serviceArea: strategy.service_area,
        }
      : undefined;

    // Run the selected improvement pass
    let improvementResult;

    switch (passType) {
      case 'readability':
        improvementResult = await improveReadability(
          post.content,
          post.title,
          post.meta_description || '',
          localContext,
          strategy.target_flesch_score
        );
        break;

      case 'seo':
        improvementResult = await improveStructureSEO(
          post.content,
          post.title,
          post.meta_description || '',
          localContext
        );
        break;

      case 'aeo':
        improvementResult = await improveAEO(
          post.content,
          post.title,
          post.meta_description || '',
          localContext
        );
        break;

      case 'engagement':
        improvementResult = await improveEngagement(
          post.content,
          post.title,
          post.meta_description || '',
          localContext
        );
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid passType. Must be: readability, seo, aeo, or engagement' },
          { status: 400 }
        );
    }

    // Update the post with improved content
    console.log(`\n📝 Updating post with ${passType} improvements (Score: ${improvementResult.scoreBefore} → ${improvementResult.scoreAfter})...`);
    console.log(`   ℹ️  Keeping original fact-check results (improvements don't re-verify facts)`);

    await db.updatePost(postId, {
      content: improvementResult.content,
      title: post.title,
      meta_description: post.meta_description || '',
      word_count: improvementResult.content.split(/\s+/).filter(Boolean).length,
      aeo_score: improvementResult.categoryScores.after.aeoScore,
      geo_score: improvementResult.categoryScores.after.geoScore,
      aiso_score: improvementResult.scoreAfter,
    });

    // DO NOT re-fact-check after improvements
    // Reason: Selective improvements should only touch their specific metric
    // Re-fact-checking can cause score regression when claims are adjusted
    // Original fact-check results remain valid

    // Log usage
    const estimatedCost = 0.20; // Single pass cost
    await db.logUsage({
      user_id: user.id,
      operation_type: 'content_improvement',
      cost_usd: estimatedCost,
      tokens_used: 8000,
      metadata: {
        action: `improve_${passType}`,
        post_id: postId,
        score_before: improvementResult.scoreBefore,
        score_after: improvementResult.scoreAfter,
        improvement: improvementResult.improvement,
        content_length: improvementResult.content.length,
      },
    });

    const isLocalContent = !!localContext;

    return NextResponse.json({
      success: true,
      message: `${improvementResult.passName} improvement complete! Score: ${improvementResult.scoreBefore} → ${improvementResult.scoreAfter}`,
      passType,
      passName: improvementResult.passName,
      scoreBefore: improvementResult.scoreBefore,
      scoreAfter: improvementResult.scoreAfter,
      improvement: improvementResult.improvement,
      improvedContent: improvementResult.content,
      categoryScores: {
        before: {
          aiso: improvementResult.scoreBefore,
          factCheck: improvementResult.categoryScores.before.factCheckScore || 0,
          aeo: improvementResult.categoryScores.before.aeoScore,
          seo: improvementResult.categoryScores.before.seoScore,
          readability: improvementResult.categoryScores.before.readabilityScore,
          engagement: improvementResult.categoryScores.before.engagementScore,
          geo: improvementResult.categoryScores.before.geoScore,
        },
        after: {
          aiso: improvementResult.scoreAfter,
          factCheck: improvementResult.categoryScores.after.factCheckScore || 0,
          aeo: improvementResult.categoryScores.after.aeoScore,
          seo: improvementResult.categoryScores.after.seoScore,
          readability: improvementResult.categoryScores.after.readabilityScore,
          engagement: improvementResult.categoryScores.after.engagementScore,
          geo: improvementResult.categoryScores.after.geoScore,
        },
      },
      post: {
        id: postId,
        title: post.title,
        wordCount: improvementResult.content.split(/\s+/).filter(Boolean).length,
      },
    });
  } catch (error: any) {
    console.error('Post improvement error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to improve post' },
      { status: 500 }
    );
  }
}
