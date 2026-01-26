/**
 * 3-Week Lookahead Service
 * Auto-generates lookahead from master schedule with weather-aware scheduling
 */

import { prisma } from './db';
import { addDays, addWeeks, startOfWeek, endOfWeek, isWithinInterval, format, differenceInDays } from 'date-fns';

interface LookaheadTask {
  id: string;
  sourceTaskId?: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'not-started' | 'in-progress' | 'completed' | 'delayed' | 'weather-day';
  trade?: string;
  subcontractorId?: string;
  subcontractor?: { id: string; companyName: string; tradeType: string };
  percentComplete: number;
  budgetedCost?: number;
  actualCost?: number;
  isCritical?: boolean;
  weatherSensitive?: boolean;
  predecessors?: string[];
  notes?: string;
}

interface WeatherForecast {
  date: string;
  condition: string;
  temp: number;
  precipitation: number;
  workImpact: 'none' | 'low' | 'moderate' | 'high' | 'severe';
}

interface ResourceConflict {
  date: string;
  subcontractorId: string;
  subcontractorName: string;
  taskCount: number;
  tasks: string[];
  suggestion: string;
}

export interface LookaheadGenerationResult {
  tasks: LookaheadTask[];
  weatherForecast: WeatherForecast[];
  resourceConflicts: ResourceConflict[];
  weatherAffectedDays: number;
  totalTasks: number;
  criticalTasks: number;
}

/**
 * Generate 3-week lookahead from master schedule
 */
export async function generateLookahead(
  projectId: string,
  startDate: Date = new Date()
): Promise<LookaheadGenerationResult> {
  const weekStart = startOfWeek(startDate, { weekStartsOn: 1 }); // Monday
  const lookaheadEnd = endOfWeek(addWeeks(weekStart, 2), { weekStartsOn: 1 }); // 3 weeks total

  // Fetch schedule tasks that fall within the lookahead window
  const scheduleTasks = await prisma.scheduleTask.findMany({
    where: {
      Schedule: { projectId },
      OR: [
        // Tasks starting in the window
        {
          startDate: { gte: weekStart, lte: lookaheadEnd },
        },
        // Tasks ending in the window
        {
          endDate: { gte: weekStart, lte: lookaheadEnd },
        },
        // Tasks spanning the window
        {
          startDate: { lte: weekStart },
          endDate: { gte: lookaheadEnd },
        },
      ],
    },
    orderBy: { startDate: 'asc' },
  });

  // Fetch weather forecasts
  const weatherData = await prisma.weatherImpact.findMany({
    where: {
      projectId,
      reportDate: { gte: weekStart, lte: lookaheadEnd },
    },
    orderBy: { reportDate: 'asc' },
  });

  // Build weather forecast array
  const weatherForecast: WeatherForecast[] = [];
  let currentDate = new Date(weekStart);
  while (currentDate <= lookaheadEnd) {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const weather = weatherData.find(
      w => format(w.reportDate, 'yyyy-MM-dd') === dateStr
    );
    // Calculate work impact based on weather conditions
    const workImpact = weather?.workStopped ? 'severe' :
                       (weather?.precipitation || 0) > 0.5 ? 'high' :
                       (weather?.windSpeed || 0) > 25 ? 'moderate' : 'none';
    weatherForecast.push({
      date: dateStr,
      condition: weather?.conditions || 'Clear',
      temp: weather?.avgTemperature || 70,
      precipitation: weather?.precipitation || 0,
      workImpact: workImpact as any,
    });
    currentDate = addDays(currentDate, 1);
  }

  // Identify weather-sensitive trades
  const weatherSensitiveTrades = new Set([
    'concrete',
    'masonry',
    'roofing',
    'sitework',
    'grading',
    'paving',
    'landscaping',
    'exterior',
    'painting',
    'waterproofing',
  ]);

  // Convert schedule tasks to lookahead format
  const lookaheadTasks: LookaheadTask[] = scheduleTasks.map(task => {
    const trade = task.tradeType?.toLowerCase() || '';
    const isWeatherSensitive = weatherSensitiveTrades.has(trade) ||
      trade.includes('concrete') ||
      trade.includes('exterior') ||
      trade.includes('roof');

    // Check if task is delayed
    const isDelayed = task.status !== 'completed' &&
      task.endDate &&
      new Date(task.endDate) < new Date();

    return {
      id: `schedule-${task.id}`,
      sourceTaskId: task.id,
      name: task.name,
      startDate: format(task.actualStartDate || task.startDate || new Date(), 'yyyy-MM-dd'),
      endDate: format(task.actualEndDate || task.endDate || new Date(), 'yyyy-MM-dd'),
      status: task.status === 'completed' ? 'completed' :
              isDelayed ? 'delayed' :
              task.status === 'in_progress' ? 'in-progress' : 'not-started',
      trade: task.tradeType || undefined,
      subcontractorId: task.subcontractorId || undefined,
      subcontractor: undefined,
      percentComplete: task.percentComplete || 0,
      budgetedCost: task.budgetedCost || undefined,
      actualCost: task.actualCost || undefined,
      isCritical: task.isCritical || false,
      weatherSensitive: isWeatherSensitive,
      predecessors: task.predecessors || [],
      notes: task.notes || undefined,
    };
  });

  // Detect resource conflicts
  const resourceConflicts = detectResourceConflicts(lookaheadTasks, weekStart, lookaheadEnd);

  // Count weather-affected days
  const weatherAffectedDays = weatherForecast.filter(
    w => w.workImpact === 'high' || w.workImpact === 'severe'
  ).length;

  return {
    tasks: lookaheadTasks,
    weatherForecast,
    resourceConflicts,
    weatherAffectedDays,
    totalTasks: lookaheadTasks.length,
    criticalTasks: lookaheadTasks.filter(t => t.isCritical).length,
  };
}

/**
 * Detect resource conflicts (same subcontractor on multiple tasks same day)
 */
function detectResourceConflicts(
  tasks: LookaheadTask[],
  startDate: Date,
  endDate: Date
): ResourceConflict[] {
  const conflicts: ResourceConflict[] = [];
  const dayMap: Record<string, Record<string, { name: string; tasks: string[] }>> = {};

  // Build a map of subcontractor work per day
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    dayMap[dateStr] = {};

    tasks.forEach(task => {
      if (!task.subcontractorId || !task.subcontractor) return;
      
      const taskStart = new Date(task.startDate);
      const taskEnd = new Date(task.endDate);
      
      if (isWithinInterval(currentDate, { start: taskStart, end: taskEnd })) {
        if (!dayMap[dateStr][task.subcontractorId]) {
          dayMap[dateStr][task.subcontractorId] = {
            name: task.subcontractor.companyName,
            tasks: [],
          };
        }
        dayMap[dateStr][task.subcontractorId].tasks.push(task.name);
      }
    });

    currentDate = addDays(currentDate, 1);
  }

  // Find conflicts (>2 tasks per subcontractor per day)
  Object.entries(dayMap).forEach(([date, subs]) => {
    Object.entries(subs).forEach(([subId, data]) => {
      if (data.tasks.length > 2) {
        conflicts.push({
          date,
          subcontractorId: subId,
          subcontractorName: data.name,
          taskCount: data.tasks.length,
          tasks: data.tasks,
          suggestion: `Consider spreading ${data.name}'s ${data.tasks.length} tasks across multiple days`,
        });
      }
    });
  });

  return conflicts;
}

/**
 * Suggest weather-adjusted schedule
 */
export async function suggestWeatherAdjustments(
  projectId: string,
  lookahead: LookaheadGenerationResult
): Promise<{ taskId: string; originalDate: string; suggestedDate: string; reason: string }[]> {
  const adjustments: { taskId: string; originalDate: string; suggestedDate: string; reason: string }[] = [];

  const badWeatherDays = new Set(
    lookahead.weatherForecast
      .filter(w => w.workImpact === 'high' || w.workImpact === 'severe')
      .map(w => w.date)
  );

  for (const task of lookahead.tasks) {
    if (!task.weatherSensitive) continue;
    if (task.status === 'completed') continue;

    // Check if task starts on a bad weather day
    if (badWeatherDays.has(task.startDate)) {
      // Find next good weather day
      let nextGoodDay = new Date(task.startDate);
      let attempts = 0;
      while (badWeatherDays.has(format(nextGoodDay, 'yyyy-MM-dd')) && attempts < 14) {
        nextGoodDay = addDays(nextGoodDay, 1);
        attempts++;
      }

      if (attempts < 14) {
        adjustments.push({
          taskId: task.id,
          originalDate: task.startDate,
          suggestedDate: format(nextGoodDay, 'yyyy-MM-dd'),
          reason: `Weather impact on ${task.startDate} - ${lookahead.weatherForecast.find(w => w.date === task.startDate)?.condition}`,
        });
      }
    }
  }

  return adjustments;
}

/**
 * Import lookahead tasks back to master schedule
 */
export async function syncLookaheadToSchedule(
  projectId: string,
  tasks: LookaheadTask[]
): Promise<{ synced: number; created: number; errors: string[] }> {
  let synced = 0;
  let created = 0;
  const errors: string[] = [];

  for (const task of tasks) {
    try {
      if (task.sourceTaskId) {
        // Update existing task
        await prisma.scheduleTask.update({
          where: { id: task.sourceTaskId },
          data: {
            actualStartDate: task.status !== 'not-started' ? new Date(task.startDate) : undefined,
            percentComplete: task.percentComplete,
            status: task.status === 'completed' ? 'completed' :
                    task.status === 'in-progress' ? 'in_progress' : 'not_started',
            notes: task.notes,
          },
        });
        synced++;
      }
      // Skip creating new tasks - would need a valid scheduleId
    } catch (e: any) {
      errors.push(`Failed to sync task "${task.name}": ${e.message}`);
    }
  }

  return { synced, created, errors };
}
