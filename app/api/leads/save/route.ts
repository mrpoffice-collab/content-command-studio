import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

/**
 * POST /api/leads/save
 * Save a discovered lead to the pipeline
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
      project_id,
      domain,
      business_name,
      city,
      state,
      industry,
      overall_score,
      content_score,
      seo_score,
      design_score,
      speed_score,
      has_blog,
      blog_post_count,
      last_blog_update,
      opportunity_rating,
    } = body;

    if (!domain || !business_name) {
      return NextResponse.json(
        { error: 'Domain and business name are required' },
        { status: 400 }
      );
    }

    // Auto-calculate opportunity rating if not provided
    let rating = opportunity_rating;
    if (!rating) {
      if (overall_score >= 45 && overall_score <= 70) {
        rating = 'high';
      } else if (overall_score < 45) {
        rating = 'medium';
      } else {
        rating = 'low';
      }
    }

    // Create the lead
    const lead = await db.createLead({
      user_id: user.id,
      project_id,
      domain,
      business_name,
      city,
      state,
      industry,
      overall_score,
      content_score,
      seo_score,
      design_score,
      speed_score,
      has_blog,
      blog_post_count,
      last_blog_update,
      status: 'new',
      opportunity_rating: rating,
    });

    // Log the activity
    await db.createLeadActivity({
      lead_id: lead.id,
      user_id: user.id,
      activity_type: 'note',
      description: 'Lead discovered and added to pipeline',
    });

    return NextResponse.json({ success: true, lead });

  } catch (error: any) {
    console.error('Save lead error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save lead' },
      { status: 500 }
    );
  }
}
