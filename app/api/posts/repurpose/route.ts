import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface SocialPost {
  platform: 'linkedin' | 'facebook' | 'instagram' | 'twitter' | 'pinterest';
  content: string;
  hashtags?: string[];
  imagePrompt?: string;
  callToAction: string;
  characterCount: number;
}

/**
 * POST /api/posts/repurpose
 * Repurpose blog content into platform-specific social media posts
 */
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const {
      postId,
      blogTitle,
      blogContent,
      blogUrl,
      platforms = ['linkedin', 'facebook', 'instagram', 'twitter']
    } = body;

    if (!blogContent || !blogTitle) {
      return NextResponse.json(
        { error: 'Blog title and content are required' },
        { status: 400 }
      );
    }

    console.log(`Repurposing blog post: ${blogTitle}`);
    console.log(`Target platforms: ${platforms.join(', ')}`);

    // Create the repurposing prompt
    const prompt = `You are a social media content strategist. Transform this blog post into engaging, platform-specific social media content.

Blog Title: ${blogTitle}
Blog Content:
${blogContent.substring(0, 4000)} ${blogContent.length > 4000 ? '...' : ''}

Create ${platforms.length} social media posts, one for each platform: ${platforms.join(', ')}.

For each platform, follow these guidelines:

LINKEDIN (Professional, B2B):
- Length: 150-300 characters for hook, can expand to 1300
- Tone: Professional, thought leadership, industry insights
- Include: Key takeaway, professional insight, question to drive engagement
- Hashtags: 3-5 industry-relevant hashtags
- CTA: "Read the full article" with link

FACEBOOK (Community, Conversational):
- Length: 40-80 characters for hook, can expand to 500
- Tone: Conversational, community-focused, relatable
- Include: Story angle, emotional connection, community question
- Hashtags: 2-3 broad hashtags
- CTA: "Learn more" or "Read the full story"

INSTAGRAM (Visual, Lifestyle):
- Length: 125-150 characters for caption hook
- Tone: Inspirational, visual-focused, lifestyle angle
- Include: Eye-catching hook, value proposition, emoji usage
- Hashtags: 8-12 relevant hashtags (mix of broad and niche)
- Image Prompt: Describe a compelling image/graphic concept
- CTA: "Link in bio" or "Tap to learn more"

TWITTER/X (Punchy, News):
- Length: 220-280 characters MAX
- Tone: Punchy, newsworthy, conversation-starter
- Include: Key stat or insight, intrigue, question or bold statement
- Hashtags: 1-2 trending/relevant hashtags
- CTA: "Thread below" or "Full article:"

PINTEREST (Inspirational, How-To):
- Length: 100-200 characters
- Tone: Helpful, inspirational, solution-focused
- Include: Clear value proposition, benefit statement
- Hashtags: 3-5 niche hashtags
- Image Prompt: Describe a vertical pin-style graphic
- CTA: "Get the full guide"

Return ONLY a valid JSON array with this exact structure:
[
  {
    "platform": "linkedin",
    "content": "The actual post content here...",
    "hashtags": ["Marketing", "ContentStrategy", "B2B"],
    "imagePrompt": "Optional: describe image concept",
    "callToAction": "Read the full article: [ARTICLE_URL]",
    "characterCount": 245
  }
]

Important:
- Each post must be COMPLETE and ready to copy-paste
- Vary the angle/hook for each platform (don't just rewrite the same content)
- Include [ARTICLE_URL] placeholder in CTAs
- Make each post native to its platform's culture
- Focus on ONE key insight per platform
- Return ONLY the JSON array, no other text`;

    // Call Claude to generate social posts
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', // Consistent with content generation
      max_tokens: 4000,
      temperature: 0.9, // Higher creativity for social content
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract the response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Parse the JSON response
    let socialPosts: SocialPost[];
    try {
      // Try to extract JSON from response (in case Claude adds extra text)
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }
      socialPosts = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse social posts JSON:', parseError);
      console.error('Response text:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse social media posts from AI response' },
        { status: 500 }
      );
    }

    // Add the actual blog URL to each post
    const postsWithUrl = socialPosts.map(post => ({
      ...post,
      callToAction: blogUrl
        ? post.callToAction.replace('[ARTICLE_URL]', blogUrl)
        : post.callToAction.replace('[ARTICLE_URL]', '[Your article URL here]'),
    }));

    // Calculate cost (rough estimate)
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(responseText.length / 4);
    const estimatedCost = (inputTokens * 0.000003) + (outputTokens * 0.000015);

    // Log usage
    await db.logUsage({
      user_id: user.id,
      operation_type: 'content_repurpose',
      cost_usd: estimatedCost,
      tokens_used: inputTokens + outputTokens,
      metadata: {
        post_id: postId,
        blog_title: blogTitle,
        platforms: platforms,
        social_posts_count: postsWithUrl.length,
      },
    });

    console.log(`✓ Generated ${postsWithUrl.length} social media posts`);
    console.log(`Cost: $${estimatedCost.toFixed(4)}`);

    return NextResponse.json({
      success: true,
      socialPosts: postsWithUrl,
      metadata: {
        blogTitle,
        blogUrl,
        platformCount: postsWithUrl.length,
        estimatedCost,
      },
    });

  } catch (error: any) {
    console.error('Repurpose error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to repurpose content' },
      { status: 500 }
    );
  }
}
