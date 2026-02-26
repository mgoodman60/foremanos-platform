/**
 * Activity Tracking API (Heartbeat)
 * 
 * POST /api/conversations/[id]/activity
 * Update last activity timestamp for finalization warnings
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { updateLastActivity } from '@/lib/report-finalization';
import { createLogger } from '@/lib/logger';
const logger = createLogger('CONVERSATIONS_ACTIVITY');

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Get conversation to verify ownership
    const { prisma } = await import('@/lib/db');
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { userId: true, conversationType: true },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (conversation.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Only track activity for daily reports
    if (conversation.conversationType === 'daily_report') {
      await updateLastActivity(id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error', error);
    return NextResponse.json(
      { error: 'Failed to update activity' },
      { status: 500 }
    );
  }
}
