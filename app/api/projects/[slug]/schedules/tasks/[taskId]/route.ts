// Task Update API for Mobile Field View
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SCHEDULES_TASKS');

export async function PATCH(
  request: Request,
  { params }: { params: { slug: string; taskId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const { status, percentComplete, actualStartDate, actualEndDate, notes } = body;

    // Validate task exists and belongs to project
    const task = await prisma.scheduleTask.findFirst({
      where: {
        id: params.taskId,
        Schedule: {
          projectId: project.id
        }
      }
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    
    if (status !== undefined) {
      updateData.status = status;
    }
    if (percentComplete !== undefined) {
      updateData.percentComplete = percentComplete;
    }
    if (actualStartDate !== undefined) {
      updateData.actualStartDate = actualStartDate ? new Date(actualStartDate) : null;
    }
    if (actualEndDate !== undefined) {
      updateData.actualEndDate = actualEndDate ? new Date(actualEndDate) : null;
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    
    updateData.updatedAt = new Date();

    // Update the task
    const updatedTask = await prisma.scheduleTask.update({
      where: { id: params.taskId },
      data: updateData,
      select: {
        id: true,
        taskId: true,
        name: true,
        status: true,
        percentComplete: true,
        actualStartDate: true,
        actualEndDate: true,
        startDate: true,
        endDate: true,
        isCritical: true
      }
    });

    // Log activity
    try {
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          action: 'TASK_UPDATE',
          resource: 'ScheduleTask',
          resourceId: params.taskId,
          details: {
            taskName: task.name,
            previousStatus: task.status,
            newStatus: status,
            previousProgress: task.percentComplete,
            newProgress: percentComplete,
            projectId: project.id,
            updatedFields: Object.keys(updateData).filter(k => k !== 'updatedAt')
          },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
        }
      });
    } catch (logError) {
      logger.warn('[Task Update] Failed to log activity', { logError });
    }

    return NextResponse.json({
      success: true,
      task: updatedTask
    });
  } catch (error) {
    logger.error('[Task Update API] Error', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: { slug: string; taskId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const task = await prisma.scheduleTask.findFirst({
      where: {
        id: params.taskId,
        Schedule: {
          projectId: project.id
        }
      },
      include: {
        Subcontractor: {
          select: {
            id: true,
            companyName: true,
            tradeType: true
          }
        }
      }
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    logger.error('[Task GET API] Error', error);
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    );
  }
}
