import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  setBaselineForSchedule,
  backfillActualsFromHistory,
  updateTaskActuals,
} from '@/lib/schedule-actuals-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SCHEDULE_ACTUALS');

// GET - Get schedule with actuals summary
export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const schedule = await prisma.schedule.findFirst({
      where: { projectId: project.id },
      include: {
        ScheduleTask: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            actualStartDate: true,
            actualEndDate: true,
            baselineStartDate: true,
            baselineEndDate: true,
            percentComplete: true,
            status: true,
          },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // Calculate summary stats
    const tasks = schedule.ScheduleTask;
    const totalTasks = tasks.length;
    const tasksWithActuals = tasks.filter(t => t.actualStartDate).length;
    const tasksWithBaseline = tasks.filter(t => t.baselineStartDate).length;
    const completedTasks = tasks.filter(t => t.actualEndDate).length;

    // Calculate schedule health
    let behindSchedule = 0;
    let aheadOfSchedule = 0;

    for (const task of tasks) {
      if (task.actualStartDate && task.baselineStartDate) {
        const baselineStart = new Date(task.baselineStartDate);
        const actualStart = new Date(task.actualStartDate);
        if (actualStart > baselineStart) behindSchedule++;
        else if (actualStart < baselineStart) aheadOfSchedule++;
      }
    }

    return NextResponse.json({
      scheduleId: schedule.id,
      summary: {
        totalTasks,
        tasksWithActuals,
        tasksWithBaseline,
        completedTasks,
        behindSchedule,
        aheadOfSchedule,
        onSchedule: totalTasks - behindSchedule - aheadOfSchedule,
      },
      tasks,
    });
  } catch (error) {
    logger.error('[Schedule Actuals API] Error', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedule actuals' },
      { status: 500 }
    );
  }
}

// POST - Set baseline or backfill actuals
export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const { action, taskId, actualStartDate, actualEndDate, percentComplete } = body;

    const schedule = await prisma.schedule.findFirst({
      where: { projectId: project.id },
      select: { id: true },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    switch (action) {
      case 'setBaseline': {
        const result = await setBaselineForSchedule(schedule.id);
        return NextResponse.json({
          success: true,
          message: `Baseline set for ${result.tasksUpdated} tasks`,
          ...result,
        });
      }

      case 'backfill': {
        const result = await backfillActualsFromHistory(project.id);
        return NextResponse.json({
          success: true,
          message: `Processed ${result.reportsProcessed} reports, updated ${result.tasksUpdated} tasks`,
          ...result,
        });
      }

      case 'updateTask': {
        if (!taskId) {
          return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
        }
        const success = await updateTaskActuals(
          taskId,
          actualStartDate ? new Date(actualStartDate) : undefined,
          actualEndDate ? new Date(actualEndDate) : undefined,
          percentComplete
        );
        return NextResponse.json({ success });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: setBaseline, backfill, or updateTask' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('[Schedule Actuals API] Error', error);
    return NextResponse.json(
      { error: 'Failed to process schedule actuals' },
      { status: 500 }
    );
  }
}
