/**
 * Weather Day Tracker
 * Records weather-related delays, pushes outdoor task schedules,
 * calculates cost impact, and provides cumulative metrics.
 */

import { prisma } from '@/lib/db';
import { createScopedLogger } from '@/lib/logger';

const log = createScopedLogger('WEATHER_DAY_TRACKER');

// Types

export interface RecordWeatherDayParams {
  projectId: string;
  reportId?: string;
  date: Date;
  hoursLost: number;
  reason: string;
  weatherCondition?: string;
  temperature?: number;
  precipitation?: number;
  windSpeed?: number;
  flaggedBy: string;
  notes?: string;
}

export interface RecordWeatherDayResult {
  weatherDay: any;
  affectedTasks: number;
  costImpact: number;
}

export interface CumulativeWeatherDays {
  totalDays: number;
  totalHoursLost: number;
  totalCostImpact: number;
  byMonth: Array<{
    month: string;
    count: number;
    hoursLost: number;
    costImpact: number;
  }>;
}

export interface WeatherDayLedgerOptions {
  cursor?: string;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface ThresholdCheck {
  exceeded: boolean;
  currentCount: number;
  threshold: number;
}

export interface SmartWeatherPromptResult {
  shouldPrompt: boolean;
  prompts: string[];
}

// Exported functions

/**
 * Record a weather day and push outdoor task end dates
 */
export async function recordWeatherDay(
  params: RecordWeatherDayParams
): Promise<RecordWeatherDayResult> {
  const {
    projectId,
    reportId,
    date,
    hoursLost,
    reason,
    weatherCondition,
    temperature,
    precipitation,
    windSpeed,
    flaggedBy,
    notes,
  } = params;

  try {
    // Find active schedule with in-progress outdoor tasks
    const schedule = await prisma.schedule.findFirst({
      where: { projectId, isActive: true },
      include: {
        ScheduleTask: {
          where: {
            isOutdoorTask: true,
            status: 'in_progress',
            percentComplete: { lt: 100 },
          },
        },
      },
    });

    const outdoorTasks = schedule?.ScheduleTask || [];
    const affectedTaskIds: string[] = [];

    // Calculate days to push (hours lost / 8 hours per day, rounded up)
    const daysToPush = Math.ceil(hoursLost / 8);

    // Push outdoor task end dates
    for (const task of outdoorTasks) {
      const newEndDate = new Date(task.endDate);
      newEndDate.setDate(newEndDate.getDate() + daysToPush);

      await prisma.scheduleTask.update({
        where: { id: task.id },
        data: { endDate: newEndDate },
      });

      affectedTaskIds.push(task.id);
    }

    // Calculate cost impact from daily report labor entries if reportId provided
    let costImpact = 0;
    if (reportId) {
      const report = await prisma.dailyReport.findUnique({
        where: { id: reportId },
        include: { laborEntries: true },
      });

      if (report?.laborEntries) {
        for (const entry of report.laborEntries) {
          const rate = entry.hourlyRate || 45; // default fallback rate
          costImpact += entry.workerCount * hoursLost * rate;
        }
      }
    }

    // Create the WeatherDay record
    const weatherDay = await prisma.weatherDay.create({
      data: {
        projectId,
        reportId,
        date,
        hoursLost,
        reason,
        weatherCondition,
        temperature,
        precipitation,
        windSpeed,
        flaggedBy,
        affectedTaskIds,
        costImpact: costImpact > 0 ? costImpact : null,
        notes,
      },
    });

    log.info('Weather day recorded', {
      weatherDayId: weatherDay.id,
      projectId,
      hoursLost,
      affectedTasks: affectedTaskIds.length,
      costImpact,
    });

    return { weatherDay, affectedTasks: affectedTaskIds.length, costImpact };
  } catch (error) {
    log.error('Failed to record weather day', error as Error, { projectId });
    throw error;
  }
}

/**
 * Get cumulative weather day statistics for a project
 */
export async function getCumulativeWeatherDays(
  projectId: string,
  startDate?: Date,
  endDate?: Date
): Promise<CumulativeWeatherDays> {
  const where: any = { projectId };
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = startDate;
    if (endDate) where.date.lte = endDate;
  }

  const aggregate = await prisma.weatherDay.aggregate({
    where,
    _count: true,
    _sum: {
      hoursLost: true,
      costImpact: true,
    },
  });

  // Get monthly breakdown
  const weatherDays = await prisma.weatherDay.findMany({
    where,
    orderBy: { date: 'asc' },
    select: { date: true, hoursLost: true, costImpact: true },
  });

  const monthMap = new Map<string, { count: number; hoursLost: number; costImpact: number }>();
  for (const wd of weatherDays) {
    const month = wd.date.toISOString().slice(0, 7); // YYYY-MM
    const existing = monthMap.get(month) || { count: 0, hoursLost: 0, costImpact: 0 };
    existing.count++;
    existing.hoursLost += wd.hoursLost;
    existing.costImpact += wd.costImpact || 0;
    monthMap.set(month, existing);
  }

  return {
    totalDays: aggregate._count,
    totalHoursLost: aggregate._sum.hoursLost || 0,
    totalCostImpact: aggregate._sum.costImpact || 0,
    byMonth: Array.from(monthMap.entries()).map(([month, data]) => ({
      month,
      ...data,
    })),
  };
}

/**
 * Get paginated weather day ledger
 */
export async function getWeatherDayLedger(
  projectId: string,
  options: WeatherDayLedgerOptions = {}
) {
  const { cursor, limit = 20, startDate, endDate } = options;

  const where: any = { projectId };
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = startDate;
    if (endDate) where.date.lte = endDate;
  }

  const weatherDays = await prisma.weatherDay.findMany({
    where,
    include: {
      flaggedByUser: { select: { id: true, username: true } },
      dailyReport: { select: { id: true, reportNumber: true, reportDate: true } },
    },
    orderBy: { date: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = weatherDays.length > limit;
  const results = hasMore ? weatherDays.slice(0, limit) : weatherDays;
  const nextCursor = hasMore ? results[results.length - 1]?.id : undefined;

  return { weatherDays: results, nextCursor, hasMore };
}

/**
 * Check if cumulative weather days exceed a threshold
 */
export async function checkWeatherDayThreshold(
  projectId: string,
  thresholdDays: number = 10
): Promise<ThresholdCheck> {
  const count = await prisma.weatherDay.count({ where: { projectId } });
  return {
    exceeded: count >= thresholdDays,
    currentCount: count,
    threshold: thresholdDays,
  };
}

/**
 * Analyze daily report data and return smart weather prompts
 */
export function getSmartWeatherPrompts(reportData: {
  crewSize?: number;
  laborEntries?: Array<{ workerCount: number }>;
  weatherCondition?: string;
}): SmartWeatherPromptResult {
  const prompts: string[] = [];

  // Check if no crew on site
  const totalCrew = reportData.crewSize ??
    (reportData.laborEntries?.reduce((sum, e) => sum + e.workerCount, 0) ?? -1);

  if (totalCrew === 0 || (reportData.laborEntries && reportData.laborEntries.length === 0)) {
    prompts.push('No subs on site today. Is this a weather day? Or is critical path delayed?');
  }

  // Check for severe weather conditions
  const condition = (reportData.weatherCondition || '').toLowerCase();
  const severeKeywords = ['rain', 'snow', 'storm', 'thunder', 'ice', 'sleet', 'hail', 'flood', 'tornado', 'hurricane', 'severe'];

  if (severeKeywords.some(kw => condition.includes(kw))) {
    prompts.push(`Weather conditions show "${reportData.weatherCondition}". Any impact on outdoor work today?`);
  }

  return {
    shouldPrompt: prompts.length > 0,
    prompts,
  };
}
