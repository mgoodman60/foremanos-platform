import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { markScheduleUpdatesReviewed } from '@/lib/onboarding-tracker';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SCHEDULE_UPDATES_BULK_ACTION');

// POST /api/projects/[slug]/schedule-updates/bulk-action - Bulk approve or reject schedule updates
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();
    const { updateIds, action, reason } = body; // action: 'approve' | 'reject'

    if (!Array.isArray(updateIds) || updateIds.length === 0) {
      return NextResponse.json(
        { error: 'updateIds must be a non-empty array' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be approve or reject' },
        { status: 400 }
      );
    }

    // Fetch project
    const project = await prisma.project.findUnique({
      where: { slug },
      select: {
        id: true,
        ownerId: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Only owners and admins can approve/reject
    const isOwner = project.ownerId === session.user.id;
    const isAdmin = session.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Only project owners and admins can approve or reject updates' },
        { status: 403 }
      );
    }

    // Fetch all schedule updates
    const scheduleUpdates = await prisma.scheduleUpdate.findMany({
      where: {
        id: { in: updateIds },
        projectId: project.id,
        status: 'pending', // Only process pending updates
      },
      include: {
        Schedule: true,
      },
    });

    if (scheduleUpdates.length === 0) {
      return NextResponse.json(
        { error: 'No pending updates found with the provided IDs' },
        { status: 404 }
      );
    }

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[],
    };

    if (action === 'approve') {
      // Process each update
      for (const scheduleUpdate of scheduleUpdates) {
        try {
          // Apply the schedule update
          const updateData: any = {};

          if (scheduleUpdate.newStatus) {
            updateData.status = scheduleUpdate.newStatus;
          }

          if (scheduleUpdate.newPercentComplete !== null && scheduleUpdate.newPercentComplete !== undefined) {
            updateData.percentComplete = scheduleUpdate.newPercentComplete;
          }

          // Update the schedule
          await prisma.schedule.update({
            where: { id: scheduleUpdate.scheduleId },
            data: updateData,
          });

          // Mark update as applied
          await prisma.scheduleUpdate.update({
            where: { id: scheduleUpdate.id },
            data: {
              status: 'applied',
              appliedAt: new Date(),
              appliedBy: session.user.id,
            },
          });

          results.processed++;
        } catch (error: unknown) {
          results.failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.errors.push(`Failed to apply update ${scheduleUpdate.id}: ${errorMessage}`);
        }
      }
    } else {
      // Reject all updates
      for (const scheduleUpdate of scheduleUpdates) {
        try {
          await prisma.scheduleUpdate.update({
            where: { id: scheduleUpdate.id },
            data: {
              status: 'rejected',
              rejectedAt: new Date(),
              rejectedBy: session.user.id,
              rejectionReason: reason || 'Bulk rejection',
            },
          });

          results.processed++;
        } catch (error: unknown) {
          results.failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.errors.push(`Failed to reject update ${scheduleUpdate.id}: ${errorMessage}`);
        }
      }
    }

    // Track onboarding progress - schedule updates reviewed (if any were processed)
    if (results.processed > 0 && session.user.id) {
      markScheduleUpdatesReviewed(session.user.id, project.id).catch((err) => {
        logger.error('Error marking schedule updates reviewed', err);
      });
    }

    return NextResponse.json({
      message: `Bulk ${action} completed`,
      results,
    });
  } catch (error: unknown) {
    logger.error('Error bulk updating schedule updates', error);
    return NextResponse.json(
      { error: 'Failed to bulk update schedule updates' },
      { status: 500 }
    );
  }
}
