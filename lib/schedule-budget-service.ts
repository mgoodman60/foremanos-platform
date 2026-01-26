/**
 * Schedule & Budget Integration Service
 * Phase 4: CPM Analysis, Resource Leveling, Forecasting
 */

import { prisma } from './db';
import { addDays, differenceInDays, startOfMonth, endOfMonth, format, isAfter, isBefore } from 'date-fns';

// Types
interface TaskNode {
  id: string;
  taskId: string;
  name: string;
  duration: number;
  predecessors: string[];
  successors: string[];
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  totalFloat: number;
  freeFloat: number;
  isCritical: boolean;
  status: string;
  percentComplete: number;
  budgetedCost?: number;
  actualCost?: number;
}

interface CPMResult {
  criticalPath: string[];
  projectDuration: number;
  totalFloat: number;
  tasks: TaskNode[];
}

interface ResourceSummary {
  resourceType: string;
  resourceName: string;
  totalAllocated: number;
  maxCapacity: number;
  utilizationPercent: number;
  isOverallocated: boolean;
  periods: Array<{
    date: string;
    allocated: number;
    available: number;
  }>;
}

interface ForecastResult {
  projectedEndDate: Date;
  originalEndDate: Date;
  varianceDays: number;
  schedulePerformanceIndex: number;
  completionConfidence: number;
  riskLevel: string;
  riskFactors: string[];
  recoveryActions: string[];
}

// =============================================
// CRITICAL PATH METHOD (CPM) ANALYSIS
// =============================================

export async function calculateCPM(scheduleId: string): Promise<CPMResult> {
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: {
      ScheduleTask: {
        orderBy: { startDate: 'asc' }
      }
    }
  });

  if (!schedule) {
    throw new Error('Schedule not found');
  }

  const tasks = schedule.ScheduleTask;
  if (tasks.length === 0) {
    return {
      criticalPath: [],
      projectDuration: 0,
      totalFloat: 0,
      tasks: []
    };
  }

  // Build task map
  const taskMap = new Map<string, TaskNode>();
  const projectStart = new Date(schedule.startDate).getTime();
  
  tasks.forEach((task: any) => {
    const startDay = Math.floor((new Date(task.startDate).getTime() - projectStart) / (1000 * 60 * 60 * 24));
    taskMap.set(task.taskId, {
      id: task.id,
      taskId: task.taskId,
      name: task.name,
      duration: task.duration,
      predecessors: task.predecessors,
      successors: task.successors,
      earlyStart: startDay,
      earlyFinish: startDay + task.duration,
      lateStart: 0,
      lateFinish: 0,
      totalFloat: 0,
      freeFloat: 0,
      isCritical: false,
      status: task.status,
      percentComplete: task.percentComplete,
      budgetedCost: task.budgetedCost ?? undefined,
      actualCost: task.actualCost ?? undefined
    });
  });

  // Forward pass - calculate early start/finish
  const sorted = topologicalSort(taskMap);
  sorted.forEach(taskId => {
    const task = taskMap.get(taskId)!;
    if (task.predecessors.length > 0) {
      let maxEF = 0;
      task.predecessors.forEach(predId => {
        const pred = taskMap.get(predId);
        if (pred) {
          maxEF = Math.max(maxEF, pred.earlyFinish);
        }
      });
      task.earlyStart = maxEF;
      task.earlyFinish = task.earlyStart + task.duration;
    }
  });

  // Find project duration
  let projectDuration = 0;
  taskMap.forEach(task => {
    projectDuration = Math.max(projectDuration, task.earlyFinish);
  });

  // Backward pass - calculate late start/finish
  const reverseSorted = [...sorted].reverse();
  reverseSorted.forEach(taskId => {
    const task = taskMap.get(taskId)!;
    if (task.successors.length === 0) {
      task.lateFinish = projectDuration;
      task.lateStart = task.lateFinish - task.duration;
    } else {
      let minLS = projectDuration;
      task.successors.forEach(succId => {
        const succ = taskMap.get(succId);
        if (succ) {
          minLS = Math.min(minLS, succ.lateStart);
        }
      });
      task.lateFinish = minLS;
      task.lateStart = task.lateFinish - task.duration;
    }
  });

  // Calculate float and identify critical path
  const criticalPath: string[] = [];
  taskMap.forEach(task => {
    task.totalFloat = task.lateStart - task.earlyStart;
    task.isCritical = task.totalFloat === 0;
    if (task.isCritical) {
      criticalPath.push(task.taskId);
    }
    
    // Calculate free float
    if (task.successors.length > 0) {
      let minSuccES = projectDuration;
      task.successors.forEach(succId => {
        const succ = taskMap.get(succId);
        if (succ) {
          minSuccES = Math.min(minSuccES, succ.earlyStart);
        }
      });
      task.freeFloat = minSuccES - task.earlyFinish;
    }
  });

  // Update tasks in database with critical path info
  const updatePromises = Array.from(taskMap.values()).map(task =>
    prisma.scheduleTask.update({
      where: { id: task.id },
      data: {
        isCritical: task.isCritical,
        totalFloat: task.totalFloat
      }
    })
  );
  await Promise.all(updatePromises);

  return {
    criticalPath,
    projectDuration,
    totalFloat: Math.min(...Array.from(taskMap.values()).map((t: any) => t.totalFloat)),
    tasks: Array.from(taskMap.values())
  };
}

function topologicalSort(taskMap: Map<string, TaskNode>): string[] {
  const visited = new Set<string>();
  const result: string[] = [];
  const inProgress = new Set<string>();

  function visit(taskId: string) {
    if (visited.has(taskId)) return;
    if (inProgress.has(taskId)) return; // Cycle detected, skip
    
    inProgress.add(taskId);
    const task = taskMap.get(taskId);
    if (task) {
      task.predecessors.forEach(predId => {
        if (taskMap.has(predId)) {
          visit(predId);
        }
      });
    }
    inProgress.delete(taskId);
    visited.add(taskId);
    result.push(taskId);
  }

  taskMap.forEach((_, taskId) => visit(taskId));
  return result;
}

// =============================================
// RESOURCE LEVELING
// =============================================

export async function analyzeResourceAllocation(projectId: string): Promise<ResourceSummary[]> {
  const allocations = await prisma.resourceAllocation.findMany({
    where: { projectId },
    include: {
      task: true
    }
  });

  // Group by resource
  const resourceGroups = new Map<string, typeof allocations>();
  allocations.forEach((alloc: any) => {
    const key = `${alloc.resourceType}-${alloc.resourceName}`;
    if (!resourceGroups.has(key)) {
      resourceGroups.set(key, []);
    }
    resourceGroups.get(key)!.push(alloc);
  });

  const summaries: ResourceSummary[] = [];

  resourceGroups.forEach((allocs, key) => {
    const [type, name] = key.split('-');
    const first = allocs[0];
    
    // Aggregate daily allocation
    const dailyAllocation = new Map<string, number>();
    allocs.forEach((alloc: any) => {
      const days = differenceInDays(alloc.endDate, alloc.startDate) || 1;
      for (let i = 0; i < days; i++) {
        const date = format(addDays(alloc.startDate, i), 'yyyy-MM-dd');
        dailyAllocation.set(
          date,
          (dailyAllocation.get(date) || 0) + alloc.allocatedUnits
        );
      }
    });

    // Calculate utilization
    const periods = Array.from(dailyAllocation.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, allocated]) => ({
        date,
        allocated,
        available: first.maxUnits
      }));

    const totalAllocated = allocs.reduce((sum: number, a: any) => sum + a.allocatedUnits, 0);
    const maxCapacity = first.maxUnits * allocs.length;
    const utilizationPercent = (totalAllocated / maxCapacity) * 100;
    const isOverallocated = periods.some((p: any) => p.allocated > first.maxUnits);

    summaries.push({
      resourceType: type,
      resourceName: name,
      totalAllocated,
      maxCapacity,
      utilizationPercent,
      isOverallocated,
      periods
    });
  });

  return summaries;
}

export async function levelResources(projectId: string): Promise<{ adjusted: number; message: string }> {
  const summaries = await analyzeResourceAllocation(projectId);
  let adjustedCount = 0;

  for (const summary of summaries) {
    if (summary.isOverallocated) {
      // Find overallocated periods
      const overPeriods = summary.periods.filter(p => p.allocated > p.available);
      
      for (const period of overPeriods) {
        // Get allocations for this date
        const allocations = await prisma.resourceAllocation.findMany({
          where: {
            projectId,
            resourceName: summary.resourceName,
            startDate: { lte: new Date(period.date) },
            endDate: { gte: new Date(period.date) }
          },
          orderBy: { task: { isCritical: 'desc' } },
          include: { task: true }
        });

        // Reduce non-critical allocations
        for (const alloc of allocations) {
          if (!alloc.task?.isCritical && alloc.allocatedUnits > 0.5) {
            await prisma.resourceAllocation.update({
              where: { id: alloc.id },
              data: {
                allocatedUnits: alloc.allocatedUnits * 0.75,
                isOverallocated: false
              }
            });
            adjustedCount++;
          }
        }
      }
    }
  }

  return {
    adjusted: adjustedCount,
    message: adjustedCount > 0 
      ? `Adjusted ${adjustedCount} resource allocations to resolve overallocation`
      : 'No overallocations found'
  };
}

// =============================================
// SCHEDULE FORECASTING
// =============================================

export async function generateScheduleForecast(projectId: string, scheduleId?: string): Promise<ForecastResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    throw new Error('Project not found');
  }

  // Get schedule or find active one
  let schedule;
  if (scheduleId) {
    schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: { ScheduleTask: true }
    });
  } else {
    schedule = await prisma.schedule.findFirst({
      where: { projectId, isActive: true },
      include: { ScheduleTask: true }
    });
  }

  if (!schedule) {
    throw new Error('No active schedule found');
  }

  const tasks = schedule.ScheduleTask;
  const now = new Date();
  const originalEndDate = new Date(schedule.endDate);

  // Calculate Schedule Performance Index (SPI)
  const plannedComplete = calculatePlannedProgress(tasks, now, schedule.startDate);
  const actualComplete = tasks.reduce((sum: number, t: any) => sum + t.percentComplete, 0) / (tasks.length || 1);
  const spi = plannedComplete > 0 ? actualComplete / plannedComplete : 1;

  // Calculate projected end date based on SPI
  const totalDuration = differenceInDays(schedule.endDate, schedule.startDate);
  const adjustedDuration = spi > 0 ? Math.ceil(totalDuration / spi) : totalDuration * 1.5;
  const projectedEndDate = addDays(schedule.startDate, adjustedDuration);
  const varianceDays = differenceInDays(projectedEndDate, originalEndDate);

  // Determine risk level and factors
  const riskFactors: string[] = [];
  let riskLevel = 'LOW';

  // Check critical path tasks
  const criticalTasks = tasks.filter((t: any) => t.isCritical);
  const delayedCritical = criticalTasks.filter((t: any) => {
    const taskEnd = new Date(t.endDate);
    return t.percentComplete < 100 && isBefore(taskEnd, now);
  });

  if (delayedCritical.length > 0) {
    riskFactors.push(`${delayedCritical.length} critical path tasks are delayed`);
    riskLevel = 'HIGH';
  }

  // Check overall progress
  if (spi < 0.8) {
    riskFactors.push('Schedule Performance Index below 80%');
    riskLevel = 'HIGH';
  } else if (spi < 0.95) {
    riskFactors.push('Schedule Performance Index below target');
    if (riskLevel !== 'HIGH') riskLevel = 'MEDIUM';
  }

  // Check resource overallocation
  const overallocated = await prisma.resourceAllocation.count({
    where: { projectId, isOverallocated: true }
  });
  if (overallocated > 0) {
    riskFactors.push(`${overallocated} resources are overallocated`);
    if (riskLevel !== 'HIGH') riskLevel = 'MEDIUM';
  }

  // Check for tasks starting soon with predecessors incomplete
  const upcomingTasks = tasks.filter((t: any) => {
    const taskStart = new Date(t.startDate);
    return differenceInDays(taskStart, now) <= 14 && t.percentComplete === 0;
  });
  for (const task of upcomingTasks) {
    const incompletePreds = task.predecessors.filter(predId => {
      const pred = tasks.find((t: any) => t.taskId === predId);
      return pred && pred.percentComplete < 100;
    });
    if (incompletePreds.length > 0) {
      riskFactors.push(`Task "${task.name}" has incomplete predecessors`);
    }
  }

  // Generate recovery actions
  const recoveryActions: string[] = [];
  if (varianceDays > 0) {
    if (delayedCritical.length > 0) {
      recoveryActions.push('Fast-track critical path activities');
      recoveryActions.push('Add resources to critical tasks');
    }
    if (spi < 0.9) {
      recoveryActions.push('Review and optimize task sequences');
      recoveryActions.push('Consider schedule compression (crashing)');
    }
    if (overallocated > 0) {
      recoveryActions.push('Balance resource workloads');
    }
    recoveryActions.push('Conduct progress review meeting');
  }

  // Calculate completion confidence
  let confidence = 95;
  if (varianceDays > 30) confidence -= 30;
  else if (varianceDays > 14) confidence -= 15;
  else if (varianceDays > 7) confidence -= 5;
  
  if (riskLevel === 'HIGH') confidence -= 20;
  else if (riskLevel === 'MEDIUM') confidence -= 10;

  confidence = Math.max(20, Math.min(99, confidence));

  // Save forecast
  await prisma.scheduleForecast.create({
    data: {
      projectId,
      scheduleId: schedule.id,
      projectedEndDate,
      originalEndDate,
      varianceDays,
      schedulePerformanceIndex: spi,
      completionConfidence: confidence,
      riskLevel,
      riskFactors,
      recoveryActions,
      forecastMethod: 'TRENDING'
    }
  });

  return {
    projectedEndDate,
    originalEndDate,
    varianceDays,
    schedulePerformanceIndex: spi,
    completionConfidence: confidence,
    riskLevel,
    riskFactors,
    recoveryActions
  };
}

function calculatePlannedProgress(tasks: any[], asOfDate: Date, projectStart: Date): number {
  let plannedWork = 0;
  let totalWork = 0;

  tasks.forEach((task: any) => {
    const taskStart = new Date(task.startDate);
    const taskEnd = new Date(task.endDate);
    const duration = task.duration || 1;
    totalWork += 100; // Each task contributes 100% when complete

    if (isBefore(taskEnd, asOfDate)) {
      // Task should be complete
      plannedWork += 100;
    } else if (isBefore(taskStart, asOfDate)) {
      // Task is in progress
      const elapsed = differenceInDays(asOfDate, taskStart);
      const progress = Math.min(100, (elapsed / duration) * 100);
      plannedWork += progress;
    }
    // Tasks not yet started contribute 0 to planned
  });

  return totalWork > 0 ? plannedWork / tasks.length : 0;
}

// =============================================
// MILESTONE MANAGEMENT
// =============================================

export async function updateMilestoneStatus(projectId: string): Promise<number> {
  const now = new Date();
  let updated = 0;

  const milestones = await prisma.milestone.findMany({
    where: { projectId }
  });

  for (const milestone of milestones) {
    let newStatus = milestone.status;
    const plannedDate = milestone.forecastDate || milestone.plannedDate;

    // Auto-update status based on dates
    if (milestone.actualDate) {
      newStatus = 'COMPLETED';
    } else if (isAfter(now, plannedDate)) {
      const daysPast = differenceInDays(now, plannedDate);
      if (daysPast > 7) {
        newStatus = 'MISSED';
      } else {
        newStatus = 'DELAYED';
      }
    } else if (differenceInDays(plannedDate, now) <= 14) {
      // Check linked tasks for risk assessment
      if (milestone.linkedTaskIds.length > 0) {
        const linkedTasks = await prisma.scheduleTask.findMany({
          where: { taskId: { in: milestone.linkedTaskIds } }
        });
        const allComplete = linkedTasks.every((t: any) => t.percentComplete >= 100);
        const anyDelayed = linkedTasks.some(t => {
          const taskEnd = new Date(t.endDate);
          return t.percentComplete < 100 && isBefore(taskEnd, now);
        });

        if (allComplete) {
          newStatus = 'IN_PROGRESS';
        } else if (anyDelayed) {
          newStatus = 'AT_RISK';
        } else {
          newStatus = 'IN_PROGRESS';
        }
      } else {
        newStatus = 'IN_PROGRESS';
      }
    } else {
      newStatus = 'UPCOMING';
    }

    if (newStatus !== milestone.status) {
      await prisma.milestone.update({
        where: { id: milestone.id },
        data: { status: newStatus }
      });
      updated++;
    }
  }

  return updated;
}

export async function getMilestoneTimeline(projectId: string) {
  const milestones = await prisma.milestone.findMany({
    where: { projectId },
    orderBy: { plannedDate: 'asc' }
  });

  const schedule = await prisma.schedule.findFirst({
    where: { projectId, isActive: true }
  });

  if (!schedule) {
    return { milestones, timeline: [] };
  }

  // Build timeline with milestones and schedule phases
  const timeline = milestones.map(m => ({
    id: m.id,
    name: m.name,
    type: 'milestone' as const,
    category: m.category,
    plannedDate: m.plannedDate,
    forecastDate: m.forecastDate,
    actualDate: m.actualDate,
    status: m.status,
    isCritical: m.isCritical,
    varianceDays: m.forecastDate 
      ? differenceInDays(m.forecastDate, m.plannedDate)
      : m.actualDate
        ? differenceInDays(m.actualDate, m.plannedDate)
        : 0
  }));

  return { milestones, timeline };
}

// =============================================
// SCHEDULE-BUDGET INTEGRATION
// =============================================

export async function linkTasksToBudget(projectId: string): Promise<{ linked: number }> {
  // Get all tasks with budgeted costs
  const tasks = await prisma.scheduleTask.findMany({
    where: {
      Schedule: { projectId },
      budgetedCost: { not: null }
    },
    include: { Schedule: true }
  });

  // Get budget items
  const budget = await prisma.projectBudget.findFirst({
    where: { projectId },
    include: { BudgetItem: true }
  });

  if (!budget) {
    return { linked: 0 };
  }

  let linked = 0;

  for (const task of tasks) {
    // Find matching budget item by trade type or name
    let matchingItem = budget.BudgetItem.find(item => 
      item.linkedTaskIds.includes(task.taskId)
    );

    if (!matchingItem && task.tradeType) {
      matchingItem = budget.BudgetItem.find(item =>
        item.tradeType?.toString().toLowerCase() === task.tradeType?.toLowerCase()
      );
    }

    if (!matchingItem) {
      // Try name matching
      matchingItem = budget.BudgetItem.find(item =>
        task.name.toLowerCase().includes(item.name.toLowerCase()) ||
        item.name.toLowerCase().includes(task.name.toLowerCase())
      );
    }

    if (matchingItem && !matchingItem.linkedTaskIds.includes(task.taskId)) {
      await prisma.budgetItem.update({
        where: { id: matchingItem.id },
        data: {
          linkedTaskIds: [...matchingItem.linkedTaskIds, task.taskId]
        }
      });
      linked++;
    }
  }

  return { linked };
}

export async function calculateScheduleDrivenCosts(projectId: string) {
  const now = new Date();
  
  // Get linked budget items
  const budget = await prisma.projectBudget.findFirst({
    where: { projectId },
    include: { BudgetItem: { where: { linkedTaskIds: { isEmpty: false } } } }
  });

  if (!budget) {
    return { items: [], totalPlanned: 0, totalActual: 0 };
  }

  const items = [];

  for (const item of budget.BudgetItem) {
    // Get linked tasks
    const tasks = await prisma.scheduleTask.findMany({
      where: { taskId: { in: item.linkedTaskIds } }
    });

    // Calculate planned spend based on schedule progress
    const avgProgress = tasks.reduce((sum: number, t: any) => sum + t.percentComplete, 0) / (tasks.length || 1);
    const plannedSpend = (avgProgress / 100) * item.budgetedAmount;

    items.push({
      budgetItemId: item.id,
      name: item.name,
      budgetedAmount: item.budgetedAmount,
      plannedSpend,
      actualSpend: item.actualCost,
      variance: plannedSpend - item.actualCost,
      linkedTasks: tasks.length,
      avgTaskProgress: avgProgress
    });
  }

  return {
    items,
    totalPlanned: items.reduce((sum, i) => sum + i.plannedSpend, 0),
    totalActual: items.reduce((sum, i) => sum + i.actualSpend, 0)
  };
}

// =============================================
// BASELINE MANAGEMENT
// =============================================

export async function createScheduleBaseline(
  scheduleId: string,
  name: string,
  userId: string,
  description?: string
) {
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: { ScheduleTask: true }
  });

  if (!schedule) {
    throw new Error('Schedule not found');
  }

  // Get next baseline number
  const lastBaseline = await prisma.scheduleBaseline.findFirst({
    where: { scheduleId },
    orderBy: { baselineNumber: 'desc' }
  });
  const baselineNumber = (lastBaseline?.baselineNumber || 0) + 1;

  // Calculate metrics
  const criticalTasks = schedule.ScheduleTask.filter((t: any) => t.isCritical);
  const projectDuration = differenceInDays(schedule.endDate, schedule.startDate);
  const criticalPathDays = criticalTasks.length > 0
    ? criticalTasks.reduce((sum: number, t: any) => sum + t.duration, 0)
    : projectDuration;

  // Create snapshot of all tasks
  const taskSnapshot = schedule.ScheduleTask.map((t: any) => ({
    taskId: t.taskId,
    name: t.name,
    startDate: t.startDate.toISOString(),
    endDate: t.endDate.toISOString(),
    duration: t.duration,
    percentComplete: t.percentComplete,
    isCritical: t.isCritical,
    predecessors: t.predecessors,
    budgetedCost: t.budgetedCost
  }));

  // Deactivate previous baselines
  await prisma.scheduleBaseline.updateMany({
    where: { scheduleId },
    data: { isActive: false }
  });

  // Create new baseline
  const baseline = await prisma.scheduleBaseline.create({
    data: {
      scheduleId,
      baselineNumber,
      name,
      description,
      totalDuration: projectDuration,
      criticalPathDays,
      totalFloat: criticalTasks.reduce((sum, t) => sum + (t.totalFloat || 0), 0),
      taskSnapshot,
      totalTasks: schedule.ScheduleTask.length,
      milestonesCount: schedule.ScheduleTask.filter((t: any) => t.duration === 0).length,
      isActive: true,
      createdBy: userId
    }
  });

  return baseline;
}

export async function compareToBaseline(scheduleId: string, baselineId?: string) {
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: { ScheduleTask: true }
  });

  if (!schedule) {
    throw new Error('Schedule not found');
  }

  // Get baseline (active or specified)
  let baseline;
  if (baselineId) {
    baseline = await prisma.scheduleBaseline.findUnique({
      where: { id: baselineId }
    });
  } else {
    baseline = await prisma.scheduleBaseline.findFirst({
      where: { scheduleId, isActive: true }
    });
  }

  if (!baseline) {
    return { hasBaseline: false, comparison: null };
  }

  const baselineTasks = baseline.taskSnapshot as any[];
  const currentTasks = schedule.ScheduleTask;

  // Compare tasks
  const comparison = currentTasks.map(current => {
    const baselineTask = baselineTasks.find((b: any) => b.taskId === current.taskId);
    if (!baselineTask) {
      return {
        taskId: current.taskId,
        name: current.name,
        status: 'NEW',
        startVariance: 0,
        endVariance: 0,
        durationVariance: 0
      };
    }

    const baselineStart = new Date(baselineTask.startDate);
    const baselineEnd = new Date(baselineTask.endDate);

    return {
      taskId: current.taskId,
      name: current.name,
      status: 'TRACKED',
      startVariance: differenceInDays(current.startDate, baselineStart),
      endVariance: differenceInDays(current.endDate, baselineEnd),
      durationVariance: current.duration - baselineTask.duration,
      baselineStart: baselineTask.startDate,
      baselineEnd: baselineTask.endDate,
      currentStart: current.startDate.toISOString(),
      currentEnd: current.endDate.toISOString()
    };
  });

  // Find deleted tasks
  const deletedTasks = baselineTasks
    .filter(b => !currentTasks.find((c: any) => c.taskId === b.taskId))
    .map(b => ({
      taskId: b.taskId,
      name: b.name,
      status: 'DELETED'
    }));

  // Overall variance - use baselineTasks which is already cast from taskSnapshot
  const lastBaselineTask = baselineTasks.length > 0 ? baselineTasks[baselineTasks.length - 1] : null;
  const totalEndVariance = lastBaselineTask 
    ? differenceInDays(schedule.endDate, new Date(lastBaselineTask.endDate)) 
    : 0;

  return {
    hasBaseline: true,
    baseline: {
      id: baseline.id,
      name: baseline.name,
      capturedAt: baseline.capturedAt,
      baselineNumber: baseline.baselineNumber
    },
    comparison: {
      tracked: comparison.filter(c => c.status === 'TRACKED'),
      newTasks: comparison.filter(c => c.status === 'NEW'),
      deletedTasks,
      summary: {
        totalTasks: currentTasks.length,
        trackedTasks: comparison.filter(c => c.status === 'TRACKED').length,
        newTasks: comparison.filter(c => c.status === 'NEW').length,
        deletedTasks: deletedTasks.length,
        projectEndVariance: totalEndVariance,
        tasksAhead: comparison.filter(c => c.endVariance < 0).length,
        tasksBehind: comparison.filter(c => c.endVariance > 0).length,
        tasksOnTrack: comparison.filter(c => c.endVariance === 0).length
      }
    }
  };
}
