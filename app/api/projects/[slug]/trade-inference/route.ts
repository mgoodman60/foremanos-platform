/**
 * Trade Inference API
 * Triggers AI-powered trade inference for schedule tasks
 * and manages manual trade assignments
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  inferTradesForSchedule,
  setTaskTrade,
  getTasksNeedingClarification,
  TRADE_TYPES,
  TRADE_DISPLAY_NAMES,
} from '@/lib/trade-inference';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_TRADE_INFERENCE');

export const dynamic = 'force-dynamic';

/**
 * GET - Get trade inference status and tasks needing clarification
 */
export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get tasks needing clarification
    const tasksNeedingClarification = await getTasksNeedingClarification(project.id);

    // Get all schedules with trade inference stats
    const schedules = await prisma.schedule.findMany({
      where: { projectId: project.id },
      include: {
        ScheduleTask: {
          select: {
            id: true,
            taskId: true,
            name: true,
            inferredTradeType: true,
            tradeInferenceConfidence: true,
            tradeInferenceSource: true,
            tradeNeedsClarification: true,
            subcontractorId: true,
            Subcontractor: {
              select: {
                companyName: true,
                tradeType: true,
              },
            },
          },
        },
      },
    });

    // Calculate stats
    const stats = schedules.map((schedule: any) => {
      const tasks = schedule.ScheduleTask;
      const total = tasks.length;
      const inferred = tasks.filter((t: any) => t.inferredTradeType).length;
      const assigned = tasks.filter((t: any) => t.subcontractorId).length;
      const needsClarification = tasks.filter((t: any) => t.tradeNeedsClarification).length;

      return {
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        totalTasks: total,
        inferredTasks: inferred,
        assignedTasks: assigned,
        needsClarification,
        percentInferred: total > 0 ? Math.round((inferred / total) * 100) : 0,
      };
    });

    // Get available subcontractors
    const subcontractors = await prisma.subcontractor.findMany({
      where: { projectId: project.id, isActive: true },
      select: {
        id: true,
        companyName: true,
        tradeType: true,
      },
      orderBy: { companyName: 'asc' },
    });

    return NextResponse.json({
      stats,
      tasksNeedingClarification,
      subcontractors,
      tradeTypes: TRADE_TYPES.map(t => ({
        value: t,
        label: TRADE_DISPLAY_NAMES[t],
      })),
    });
  } catch (error: unknown) {
    logger.error('[TRADE-INFERENCE API] Error', error);
    return NextResponse.json(
      { error: 'Failed to fetch trade inference data' },
      { status: 500 }
    );
  }
}

/**
 * POST - Trigger trade inference or update task trade
 */
export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await req.json();
    const { action, scheduleId, taskId, tradeType, subcontractorId } = body;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Handle different actions
    switch (action) {
      case 'run_inference': {
        // Run trade inference for a schedule
        if (!scheduleId) {
          return NextResponse.json(
            { error: 'scheduleId is required' },
            { status: 400 }
          );
        }

        const result = await inferTradesForSchedule(scheduleId, project.id);

        return NextResponse.json({
          success: true,
          updated: result.updated,
          needsClarification: result.needsClarification,
          errors: result.errors,
        });
      }

      case 'set_trade': {
        // Manually set trade for a task
        if (!taskId || !tradeType) {
          return NextResponse.json(
            { error: 'taskId and tradeType are required' },
            { status: 400 }
          );
        }

        await setTaskTrade(taskId, tradeType, subcontractorId);

        return NextResponse.json({ success: true });
      }

      case 'bulk_set_trades': {
        // Bulk update trades
        const { updates } = body;
        if (!Array.isArray(updates)) {
          return NextResponse.json(
            { error: 'updates array is required' },
            { status: 400 }
          );
        }

        for (const update of updates) {
          await setTaskTrade(
            update.taskId,
            update.tradeType,
            update.subcontractorId
          );
        }

        return NextResponse.json({
          success: true,
          updated: updates.length,
        });
      }

      case 'run_all': {
        // Run inference for all schedules in project
        const schedules = await prisma.schedule.findMany({
          where: { projectId: project.id },
          select: { id: true },
        });

        let totalUpdated = 0;
        let totalNeedsClarification = 0;
        const allErrors: string[] = [];

        for (const schedule of schedules) {
          const result = await inferTradesForSchedule(schedule.id, project.id);
          totalUpdated += result.updated;
          totalNeedsClarification += result.needsClarification;
          allErrors.push(...result.errors);
        }

        return NextResponse.json({
          success: true,
          schedulesProcessed: schedules.length,
          updated: totalUpdated,
          needsClarification: totalNeedsClarification,
          errors: allErrors,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    logger.error('[TRADE-INFERENCE API] Error', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: errMsg || 'Failed to process trade inference' },
      { status: 500 }
    );
  }
}
