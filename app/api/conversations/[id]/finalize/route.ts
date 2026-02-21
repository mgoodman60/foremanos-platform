/**
 * Report Finalization API
 * 
 * POST /api/conversations/[id]/finalize
 * Manually finalize a daily report
 * 
 * GET /api/conversations/[id]/finalize
 * Get finalization status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import {
  finalizeReport,
  getFinalizationStatus,
  hasReportData,
} from '@/lib/report-finalization';
import { markFirstReportFinalized } from '@/lib/onboarding-tracker';
import { createLogger } from '@/lib/logger';

const logger = createLogger('finalize-api');

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
      select: {
        userId: true,
        conversationType: true,
        finalized: true,
        projectId: true,
      },
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

    // Verify it's a daily report
    if (conversation.conversationType !== 'daily_report') {
      return NextResponse.json(
        { error: 'Only daily reports can be finalized' },
        { status: 400 }
      );
    }

    // Check if already finalized
    if (conversation.finalized) {
      return NextResponse.json(
        { error: 'Report already finalized' },
        { status: 400 }
      );
    }

    // Check if report has data
    const hasData = await hasReportData(id);
    if (!hasData) {
      return NextResponse.json(
        { error: 'Report has no data to finalize' },
        { status: 400 }
      );
    }

    // Finalize report
    const result = await finalizeReport({
      conversationId: id,
      userId: session.user.id,
      method: 'manual',
      skipWarning: true, // Manual finalization skips activity warning
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || result.warning || 'Finalization failed' },
        { status: 400 }
      );
    }

    // Track onboarding progress - first report finalized
    if (conversation.projectId) {
      markFirstReportFinalized(session.user.id, conversation.projectId).catch((err) => {
        logger.error('Error marking first report finalized', err as Error);
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Finalization error', error as Error);
    return NextResponse.json(
      { error: 'Failed to finalize report' },
      { status: 500 }
    );
  }
}

export async function GET(
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
      select: { userId: true },
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

    // Get finalization status
    const status = await getFinalizationStatus(id);

    if (!status) {
      return NextResponse.json(
        { error: 'Status not available' },
        { status: 404 }
      );
    }

    return NextResponse.json(status);
  } catch (error) {
    logger.error('Finalization error', error as Error);
    return NextResponse.json(
      { error: 'Failed to get finalization status' },
      { status: 500 }
    );
  }
}
