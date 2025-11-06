import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

/**
 * PATCH /api/clusters/[id]
 * Update a topic cluster
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Get existing cluster
    const existing = await db.getTopicClusterById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: 404 });
    }

    // Verify user owns the strategy
    const strategy = await db.getStrategyById(existing.strategy_id);
    if (!strategy) {
      return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
    }

    const user = await db.getUserByClerkId(userId);
    if (!user || strategy.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Update cluster
    const cluster = await db.updateTopicCluster(id, {
      name: body.name,
      description: body.description,
      primary_money_page_id: body.primary_money_page_id,
      secondary_money_page_ids: body.secondary_money_page_ids,
      funnel_stage: body.funnel_stage,
    });

    console.log(`✅ Updated cluster: ${cluster?.name}`);

    return NextResponse.json({ cluster });
  } catch (error: any) {
    console.error('Error updating cluster:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update cluster' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clusters/[id]
 * Delete a topic cluster
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get existing cluster
    const existing = await db.getTopicClusterById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: 404 });
    }

    // Verify user owns the strategy
    const strategy = await db.getStrategyById(existing.strategy_id);
    if (!strategy) {
      return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
    }

    const user = await db.getUserByClerkId(userId);
    if (!user || strategy.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete cluster
    const deleted = await db.deleteTopicCluster(id);

    console.log(`✅ Deleted cluster: ${deleted?.name}`);

    return NextResponse.json({ success: true, cluster: deleted });
  } catch (error: any) {
    console.error('Error deleting cluster:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete cluster' },
      { status: 500 }
    );
  }
}
