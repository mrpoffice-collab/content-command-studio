import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

/**
 * PATCH /api/money-pages/[id]
 * Update a money page
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

    // Get existing money page
    const existing = await db.getMoneyPageById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Money page not found' }, { status: 404 });
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

    // Update money page
    const moneyPage = await db.updateMoneyPage(id, {
      url: body.url,
      title: body.title,
      page_type: body.page_type,
      description: body.description,
      priority: body.priority,
      target_keywords: body.target_keywords,
    });

    console.log(`✅ Updated money page: ${moneyPage?.title}`);

    return NextResponse.json({ moneyPage });
  } catch (error: any) {
    console.error('Error updating money page:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update money page' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/money-pages/[id]
 * Delete a money page
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

    // Get existing money page
    const existing = await db.getMoneyPageById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Money page not found' }, { status: 404 });
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

    // Delete money page
    const deleted = await db.deleteMoneyPage(id);

    console.log(`✅ Deleted money page: ${deleted?.title}`);

    return NextResponse.json({ success: true, moneyPage: deleted });
  } catch (error: any) {
    console.error('Error deleting money page:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete money page' },
      { status: 500 }
    );
  }
}
