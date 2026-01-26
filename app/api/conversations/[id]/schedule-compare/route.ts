import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  compareScheduleActivities,
  generateScheduleUpdateDraft,
  ScheduledActivity,
} from '@/lib/schedule-parser';

export const dynamic = 'force-dynamic';

/**
 * POST /api/conversations/[id]/schedule-compare
 * Compare reported activities against master schedule and generate update draft
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { actualActivities } = await request.json();

    if (!actualActivities || !Array.isArray(actualActivities)) {
      return NextResponse.json(
        { error: 'actualActivities array is required' },
        { status: 400 }
      );
    }

    // Get the user
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: params.id },
      include: {
        Project: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Verify this is a daily report chat
    if (conversation.conversationType !== 'daily_report') {
      return NextResponse.json(
        { error: 'This is not a daily report conversation' },
        { status: 400 }
      );
    }

    // Get scheduled activities from conversation
    const scheduledActivities =
      (conversation.scheduledActivities as unknown as ScheduledActivity[]) || [];

    if (scheduledActivities.length === 0) {
      return NextResponse.json({
        hasDifferences: false,
        message: 'No scheduled activities to compare against',
      });
    }

    // Compare activities
    const comparison = compareScheduleActivities(
      scheduledActivities,
      actualActivities
    );

    // Generate update draft if there are differences
    let updateDraft = '';
    if (comparison.hasDifferences && conversation.dailyReportDate) {
      updateDraft = generateScheduleUpdateDraft(
        comparison,
        conversation.dailyReportDate
      );
    }

    // Store schedule updates in conversation
    if (updateDraft) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          scheduleUpdates: comparison as any,
        },
      });
    }

    console.log(
      `[SCHEDULE_COMPARE] Conversation ${conversation.id}: ${comparison.differences.length} differences found`
    );

    return NextResponse.json({
      hasDifferences: comparison.hasDifferences,
      comparison,
      updateDraft,
      message: comparison.hasDifferences
        ? `Found ${comparison.differences.length} difference(s) between scheduled and actual work`
        : 'All scheduled activities match reported work',
    });
  } catch (error: any) {
    console.error('[SCHEDULE_COMPARE_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to compare schedule' },
      { status: 500 }
    );
  }
}
