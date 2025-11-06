import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

/**
 * GET /api/leads/pipeline
 * Get all leads in the pipeline with optional filtering
 */
export async function GET(request: NextRequest) {
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

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const project_id = searchParams.get('project_id');
    const status = searchParams.get('status');
    const min_score = searchParams.get('min_score');
    const max_score = searchParams.get('max_score');

    const filters: any = {};
    if (project_id) filters.project_id = parseInt(project_id);
    if (status) filters.status = status;
    if (min_score) filters.min_score = parseInt(min_score);
    if (max_score) filters.max_score = parseInt(max_score);

    // Get leads with filters
    const leads = await db.getLeadsByUserId(user.id, filters);

    return NextResponse.json({ leads });

  } catch (error: any) {
    console.error('Get pipeline error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get pipeline' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/leads/pipeline
 * Update a lead's status or other properties
 */
export async function PATCH(request: NextRequest) {
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
      lead_id,
      project_id,
      status,
      opportunity_rating,
      notes,
      activity_description,
    } = body;

    if (!lead_id) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      );
    }

    // Verify lead belongs to user
    const lead = await db.getLeadById(lead_id);
    if (!lead || lead.user_id !== user.id) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Update the lead
    const updateData: any = {};
    if (project_id !== undefined) updateData.project_id = project_id;
    if (status !== undefined) updateData.status = status;
    if (opportunity_rating !== undefined) updateData.opportunity_rating = opportunity_rating;
    if (notes !== undefined) updateData.notes = notes;

    const updatedLead = await db.updateLead(lead_id, updateData);

    // Log activity if provided
    if (activity_description) {
      await db.createLeadActivity({
        lead_id,
        user_id: user.id,
        activity_type: 'note',
        description: activity_description,
      });
    }

    return NextResponse.json({ success: true, lead: updatedLead });

  } catch (error: any) {
    console.error('Update lead error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update lead' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/leads/pipeline
 * Delete a lead from the pipeline
 */
export async function DELETE(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const lead_id = searchParams.get('lead_id');

    if (!lead_id) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      );
    }

    // Verify lead belongs to user
    const lead = await db.getLeadById(parseInt(lead_id));
    if (!lead || lead.user_id !== user.id) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    await db.deleteLead(parseInt(lead_id));

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Delete lead error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete lead' },
      { status: 500 }
    );
  }
}
