/**
 * Schedule Actuals Service
 * Auto-extracts actual start/end dates from daily reports
 * and updates schedule tasks accordingly
 */

import { prisma } from './db';
import { logger } from '@/lib/logger';

interface _TaskWorkEntry {
  taskId: string;
  taskName: string;
  workDate: Date;
  percentComplete?: number;
  description?: string;
}

/**
 * Process a daily report and extract actual dates for schedule tasks
 */
export async function extractActualsFromDailyReport(
  projectId: string,
  reportDate: Date,
  workPerformed: string,
  laborEntries?: Array<{ tradeName: string; description?: string }>
): Promise<{ updatedTasks: string[] }> {
  const updatedTasks: string[] = [];

  try {
    // Get all schedule tasks for the project
    const schedule = await prisma.schedule.findFirst({
      where: { projectId },
      include: {
        ScheduleTask: true,
      },
    });

    if (!schedule?.ScheduleTask?.length) {
      return { updatedTasks };
    }

    // Combine all work descriptions
    const allWorkText = [
      workPerformed || '',
      ...(laborEntries?.map(e => e.description || '').filter(Boolean) || []),
    ].join(' ').toLowerCase();

    // Match tasks mentioned in work performed
    for (const task of schedule.ScheduleTask) {
      const taskNameLower = task.name.toLowerCase();
      const taskWords = taskNameLower.split(/\s+/).filter(w => w.length > 3);
      
      // Check if task is mentioned in work description
      const isMentioned = taskWords.some(word => allWorkText.includes(word)) ||
        allWorkText.includes(taskNameLower) ||
        (task.tradeType && allWorkText.includes(task.tradeType.toLowerCase()));

      if (isMentioned) {
        const updates: any = {};

        // Set actual start date if not already set
        if (!task.actualStartDate) {
          updates.actualStartDate = reportDate;
          updates.status = 'in_progress';
        }

        // Check for completion indicators
        const completionIndicators = [
          'completed', 'finished', 'done', '100%', 'complete',
          'final inspection', 'passed inspection', 'signed off'
        ];
        const isCompleted = completionIndicators.some(ind => 
          allWorkText.includes(ind) && allWorkText.includes(taskNameLower)
        );

        if (isCompleted && !task.actualEndDate) {
          updates.actualEndDate = reportDate;
          updates.percentComplete = 100;
          updates.status = 'completed';
        }

        // Apply updates if any
        if (Object.keys(updates).length > 0) {
          await prisma.scheduleTask.update({
            where: { id: task.id },
            data: updates,
          });
          updatedTasks.push(task.name);
        }
      }
    }

    return { updatedTasks };
  } catch (error) {
    logger.error('SCHEDULE_ACTUALS', 'Error extracting actuals', error instanceof Error ? error : undefined);
    return { updatedTasks };
  }
}

/**
 * Set baseline dates for all tasks (snapshot current planned dates)
 */
export async function setBaselineForSchedule(
  scheduleId: string
): Promise<{ tasksUpdated: number }> {
  try {
    const _result = await prisma.scheduleTask.updateMany({
      where: { scheduleId },
      data: {
        // Copy current planned dates to baseline
        // Note: Prisma doesn't support self-referencing in updateMany,
        // so we need to do this in a transaction
      },
    });

    // Use raw query to copy planned dates to baseline
    const tasks = await prisma.scheduleTask.findMany({
      where: { scheduleId },
    });

    let count = 0;
    for (const task of tasks) {
      if (!task.baselineStartDate || !task.baselineEndDate) {
        await prisma.scheduleTask.update({
          where: { id: task.id },
          data: {
            baselineStartDate: task.startDate,
            baselineEndDate: task.endDate,
          },
        });
        count++;
      }
    }

    return { tasksUpdated: count };
  } catch (error) {
    logger.error('SCHEDULE_ACTUALS', 'Error setting baseline', error instanceof Error ? error : undefined);
    return { tasksUpdated: 0 };
  }
}

/**
 * Update actual dates for a specific task
 */
export async function updateTaskActuals(
  taskId: string,
  actualStartDate?: Date,
  actualEndDate?: Date,
  percentComplete?: number
): Promise<boolean> {
  try {
    const updates: any = {};

    if (actualStartDate) {
      updates.actualStartDate = actualStartDate;
      if (!updates.status) updates.status = 'in_progress';
    }

    if (actualEndDate) {
      updates.actualEndDate = actualEndDate;
      updates.status = 'completed';
      updates.percentComplete = 100;
    }

    if (percentComplete !== undefined) {
      updates.percentComplete = percentComplete;
      if (percentComplete === 100 && !updates.actualEndDate) {
        updates.actualEndDate = new Date();
        updates.status = 'completed';
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.scheduleTask.update({
        where: { id: taskId },
        data: updates,
      });
      return true;
    }

    return false;
  } catch (error) {
    logger.error('SCHEDULE_ACTUALS', 'Error updating task actuals', error instanceof Error ? error : undefined);
    return false;
  }
}

/**
 * Calculate schedule variance for a task
 */
export function calculateScheduleVariance(task: {
  startDate: Date;
  endDate: Date;
  actualStartDate?: Date | null;
  actualEndDate?: Date | null;
  baselineStartDate?: Date | null;
  baselineEndDate?: Date | null;
}): {
  startVariance: number; // days (negative = late)
  endVariance: number; // days (negative = late)
  isAheadOfSchedule: boolean;
  isBehindSchedule: boolean;
} {
  const baseline = {
    start: task.baselineStartDate || task.startDate,
    end: task.baselineEndDate || task.endDate,
  };

  const actual = {
    start: task.actualStartDate,
    end: task.actualEndDate,
  };

  const msPerDay = 1000 * 60 * 60 * 24;

  // Start variance (planned - actual = positive means started early)
  const startVariance = actual.start
    ? Math.round((new Date(baseline.start).getTime() - new Date(actual.start).getTime()) / msPerDay)
    : 0;

  // End variance (planned - actual = positive means finished early)
  const endVariance = actual.end
    ? Math.round((new Date(baseline.end).getTime() - new Date(actual.end).getTime()) / msPerDay)
    : 0;

  return {
    startVariance,
    endVariance,
    isAheadOfSchedule: startVariance > 0 || endVariance > 0,
    isBehindSchedule: startVariance < 0 || endVariance < 0,
  };
}

/**
 * Process all historical daily reports to backfill actual dates
 */
export async function backfillActualsFromHistory(
  projectId: string
): Promise<{ reportsProcessed: number; tasksUpdated: number }> {
  let reportsProcessed = 0;
  let tasksUpdated = 0;

  try {
    // Get all daily reports for the project, ordered by date
    const reports = await prisma.dailyReport.findMany({
      where: { projectId },
      include: {
        laborEntries: true,
      },
      orderBy: { reportDate: 'asc' },
    });

    for (const report of reports) {
      const result = await extractActualsFromDailyReport(
        projectId,
        report.reportDate,
        report.workPerformed || '',
        report.laborEntries.map(e => ({
          tradeName: e.tradeName,
          description: e.description || undefined,
        }))
      );

      reportsProcessed++;
      tasksUpdated += result.updatedTasks.length;
    }

    return { reportsProcessed, tasksUpdated };
  } catch (error) {
    logger.error('SCHEDULE_ACTUALS', 'Error backfilling actuals', error instanceof Error ? error : undefined);
    return { reportsProcessed, tasksUpdated };
  }
}
