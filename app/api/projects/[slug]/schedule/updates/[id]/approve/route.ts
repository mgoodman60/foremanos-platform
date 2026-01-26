import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/audit-log';
import { markScheduleUpdatesReviewed } from '@/lib/onboarding-tracker';
import { syncBudgetFromSchedule } from '@/lib/budget-sync-service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { slug, id } = params;

    // Get project and verify permissions
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        ProjectMember: {
          where: { userId: session.user.id },
          select: { role: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check permissions (admin, owner, or editor)
    const isOwner = project.ownerId === session.user.id;
    const member = project.ProjectMember[0];
    const isEditor = member?.role === 'editor' || member?.role === 'owner';
    const isAdmin = session.user.role === 'admin';

    if (!isOwner && !isEditor && !isAdmin) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get the schedule update
    const scheduleUpdate = await prisma.scheduleUpdate.findUnique({
      where: { id },
      include: {
        Schedule: true,
      },
    });

    if (!scheduleUpdate) {
      return NextResponse.json(
        { error: 'Schedule update not found' },
        { status: 404 }
      );
    }

    if (scheduleUpdate.projectId !== project.id) {
      return NextResponse.json(
        { error: 'Schedule update does not belong to this project' },
        { status: 403 }
      );
    }

    if (scheduleUpdate.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot approve update with status: ${scheduleUpdate.status}` },
        { status: 400 }
      );
    }

    // Update schedule update status
    const updated = await prisma.scheduleUpdate.update({
      where: { id },
      data: {
        status: 'approved',
        appliedAt: new Date(),
        appliedBy: session.user.id,
      },
    });

    // Apply the update to the schedule task
    const task = await prisma.scheduleTask.findFirst({
      where: {
        taskId: scheduleUpdate.taskId,
        scheduleId: scheduleUpdate.scheduleId,
      },
    });

    if (task) {
      const updateData: any = {};
      if (scheduleUpdate.newStatus) {
        updateData.status = scheduleUpdate.newStatus;
      }
      if (scheduleUpdate.newPercentComplete !== null && scheduleUpdate.newPercentComplete !== undefined) {
        updateData.percentComplete = scheduleUpdate.newPercentComplete;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.scheduleTask.update({
          where: { id: task.id },
          data: updateData,
        });
      }
    }

    // Update lastAutoUpdateAt on schedule
    await prisma.schedule.update({
      where: { id: scheduleUpdate.scheduleId },
      data: { lastAutoUpdateAt: new Date() },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'schedule_update_approved',
      resource: 'ScheduleUpdate',
      resourceId: scheduleUpdate.scheduleId,
      details: {
        updateId: id,
        taskId: scheduleUpdate.taskId,
        newStatus: scheduleUpdate.newStatus,
        newPercentComplete: scheduleUpdate.newPercentComplete,
      },
    });

    // Track onboarding progress - schedule updates reviewed
    markScheduleUpdatesReviewed(session.user.id, project.id).catch((err) => {
      console.error('[ONBOARDING] Error marking schedule updates reviewed:', err);
    });

    // Trigger budget sync after schedule update approval
    syncBudgetFromSchedule(project.id, session.user.id).catch((err) => {
      console.error('[APPROVE_UPDATE] Budget sync failed:', err);
    });

    return NextResponse.json({
      success: true,
      scheduleUpdate: updated,
    });
  } catch (error) {
    console.error('[APPROVE_UPDATE] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
