/**
 * Activity Tracking API (Heartbeat)
 * 
 * POST /api/conversations/[id]/activity
 * Update last activity timestamp for finalization warnings
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { updateLastActivity } from '@/lib/report-finalization';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
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
    console.error('[ACTIVITY_API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update activity' },
      { status: 500 }
    );
  }
}
