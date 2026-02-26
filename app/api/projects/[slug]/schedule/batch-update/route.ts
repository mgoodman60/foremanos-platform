import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/audit-log';
import { syncBudgetFromSchedule } from '@/lib/budget-sync-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SCHEDULE_BATCH_UPDATE');

export const dynamic = 'force-dynamic';

interface BatchUpdateRequest {
  updates: {
    taskId: string;
    scheduleId: string;
    newStatus?: string;
    newPercentComplete?: number;
    reasoning?: string;
    confidence?: number;
    impactType?: string;
    severity?: string;
  }[];
  source: 'daily_report' | 'manual';
  sourceId?: string;
}

interface BatchUpdateResponse {
  success: boolean;
  applied: number;
  failed: number;
  errors?: { taskId: string; error: string }[];
  scheduleUpdateIds: string[];
}

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { slug } = params;
    const body: BatchUpdateRequest = await request.json();

    if (!body.updates || !Array.isArray(body.updates) || body.updates.length === 0) {
      return NextResponse.json(
        { error: 'Updates array is required and must not be empty' },
        { status: 400 }
      );
    }

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
        { error: 'Insufficient permissions. Only admins and editors can update schedules.' },
        { status: 403 }
      );
    }

    const applied: number[] = [];
    const failed: Array<{ taskId: string; error: string }> = [];
    const scheduleUpdateIds: string[] = [];

    // Get active schedule if not provided in updates
    let defaultScheduleId: string | undefined;
    if (body.updates.some(u => !u.scheduleId)) {
      const activeSchedule = await prisma.schedule.findFirst({
        where: {
          projectId: project.id,
          isActive: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      defaultScheduleId = activeSchedule?.id;
    }

    // Process each update
    for (const update of body.updates) {
      try {
        // Use default schedule if not provided
        const scheduleId = update.scheduleId || defaultScheduleId;

        // Validate update data
        if (!update.taskId || !scheduleId) {
          failed.push({
            taskId: update.taskId || 'unknown',
            error: 'Missing required fields: taskId and/or no active schedule found',
          });
          continue;
        }

        // Validate percent complete if provided
        if (
          update.newPercentComplete !== undefined &&
          (update.newPercentComplete < 0 || update.newPercentComplete > 100)
        ) {
          failed.push({
            taskId: update.taskId,
            error: 'Percent complete must be between 0 and 100',
          });
          continue;
        }

        // Get current task state
        const task = await prisma.scheduleTask.findFirst({
          where: {
            taskId: update.taskId,
            scheduleId: scheduleId,
          },
        });

        if (!task) {
          failed.push({
            taskId: update.taskId,
            error: 'Task not found',
          });
          continue;
        }

        // Create ScheduleUpdate record (audit trail)
        const scheduleUpdate = await prisma.scheduleUpdate.create({
          data: {
            projectId: project.id,
            scheduleId: scheduleId,
            taskId: update.taskId,
            source: body.source,
            sourceId: body.sourceId,
            previousStatus: task.status,
            newStatus: update.newStatus || task.status,
            previousPercentComplete: task.percentComplete,
            newPercentComplete: update.newPercentComplete ?? task.percentComplete,
            confidence: update.confidence,
            reasoning: update.reasoning,
            impactType: update.impactType,
            severity: update.severity,
            status: 'approved',
            appliedAt: new Date(),
            appliedBy: session.user.id,
            createdBy: session.user.id,
          },
        });

        scheduleUpdateIds.push(scheduleUpdate.id);

        // Update the actual schedule task
        const updateData: any = {};
        if (update.newStatus) {
          updateData.status = update.newStatus;
        }
        if (update.newPercentComplete !== undefined) {
          updateData.percentComplete = update.newPercentComplete;
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.scheduleTask.update({
            where: { id: task.id },
            data: updateData,
          });
        }

        // Log activity
        await logActivity({
          userId: session.user.id,
          action: 'schedule_update',
          resource: 'Schedule',
          resourceId: scheduleId,
          details: {
            taskId: update.taskId,
            source: body.source,
            newStatus: update.newStatus,
            newPercentComplete: update.newPercentComplete,
          },
        });

        applied.push(1);
      } catch (error) {
        logger.error('Error processing update for task', error, { taskId: update.taskId });
        failed.push({
          taskId: update.taskId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Update lastAutoUpdateAt on schedule if applicable
    if (applied.length > 0) {
      const uniqueScheduleIds = [...new Set(body.updates.map(u => u.scheduleId))];
      for (const scheduleId of uniqueScheduleIds) {
        await prisma.schedule.update({
          where: { id: scheduleId },
          data: { lastAutoUpdateAt: new Date() },
        });
      }

      // Trigger budget sync after schedule updates
      syncBudgetFromSchedule(project.id, session.user.id).catch((err) => {
        logger.error('Budget sync failed', err);
      });
    }

    const response: BatchUpdateResponse = {
      success: failed.length === 0,
      applied: applied.length,
      failed: failed.length,
      errors: failed.length > 0 ? failed : undefined,
      scheduleUpdateIds,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
