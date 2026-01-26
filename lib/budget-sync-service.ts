/**
 * Budget Sync Service
 * Automatically syncs schedule progress with budget/EVM metrics
 */

import { prisma } from '@/lib/db';
import { startOfDay, subDays } from 'date-fns';

export interface EVMMetrics {
  plannedValue: number;
  earnedValue: number;
  actualCost: number;
  costVariance: number;
  scheduleVariance: number;
  costPerformanceIndex: number;
  schedulePerformanceIndex: number;
  estimateAtCompletion: number;
  estimateToComplete: number;
  varianceAtCompletion: number;
  percentComplete: number;
  percentSpent: number;
}

export interface CostAlertInput {
  projectId: string;
  budgetItemId?: string;
  alertType: 'CPI_LOW' | 'SPI_LOW' | 'BUDGET_EXCEEDED' | 'ITEM_OVER_BUDGET' | 'CONTINGENCY_LOW' | 'FORECAST_OVERRUN';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  currentValue?: number;
  threshold?: number;
}

const ALERT_THRESHOLDS = {
  cpiWarning: 0.95,
  cpiCritical: 0.85,
  spiWarning: 0.95,
  spiCritical: 0.85,
  contingencyWarning: 70, // percent
  contingencyCritical: 90,
  budgetOverrunWarning: 95, // percent of budget spent
  budgetOverrunCritical: 100,
};

/**
 * Calculate EVM metrics from schedule tasks and budget items
 */
export async function calculateEVMFromSchedule(projectId: string, date: Date = new Date()): Promise<EVMMetrics | null> {
  // Get budget with items
  const budget = await prisma.projectBudget.findUnique({
    where: { projectId },
    include: { BudgetItem: { where: { isActive: true } } },
  });

  if (!budget) return null;

  // Get active schedule with tasks
  const schedule = await prisma.schedule.findFirst({
    where: { projectId, isActive: true },
    include: { ScheduleTask: true },
  });

  if (!schedule || schedule.ScheduleTask.length === 0) return null;

  const tasks = schedule.ScheduleTask;
  const totalBudget = budget.totalBudget;

  let plannedValue = 0;
  let earnedValue = 0;
  let actualCost = 0;

  for (const task of tasks) {
    const taskBudget = task.budgetedCost || 0;

    // Planned Value: What should have been done by now
    if (task.endDate && task.endDate <= date) {
      plannedValue += taskBudget;
    } else if (task.startDate && task.startDate <= date && task.endDate && task.endDate > date) {
      const duration = task.duration || 1;
      const daysElapsed = Math.floor((date.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24));
      const plannedPercent = Math.min((daysElapsed / duration) * 100, 100);
      plannedValue += (taskBudget * plannedPercent) / 100;
    }

    // Earned Value: What was actually completed
    earnedValue += (taskBudget * (task.percentComplete || 0)) / 100;

    // Actual Cost from schedule tasks (for task-level tracking)
    actualCost += task.actualCost || 0;
  }

  // Also include actual costs from BudgetItems (updated by labor/material extraction)
  // This captures costs that may not be directly tied to schedule tasks
  const budgetItemActuals = budget.BudgetItem.reduce(
    (sum, item) => sum + item.actualCost,
    0
  );

  // Use the higher of task-level or budget-item-level actuals
  // This ensures we capture all cost sources
  actualCost = Math.max(actualCost, budgetItemActuals);

  // Calculate variances and indices
  const costVariance = earnedValue - actualCost;
  const scheduleVariance = earnedValue - plannedValue;
  const costPerformanceIndex = actualCost > 0 ? earnedValue / actualCost : 1;
  const schedulePerformanceIndex = plannedValue > 0 ? earnedValue / plannedValue : 1;

  // Forecast metrics
  const budgetAtCompletion = totalBudget;
  const estimateAtCompletion = costPerformanceIndex > 0
    ? budgetAtCompletion / costPerformanceIndex
    : budgetAtCompletion;
  const estimateToComplete = estimateAtCompletion - actualCost;
  const varianceAtCompletion = budgetAtCompletion - estimateAtCompletion;

  // Calculate overall percent complete
  const totalTaskBudget = tasks.reduce((sum: number, t: { budgetedCost?: number | null }) => sum + (t.budgetedCost || 0), 0);
  const percentComplete = totalTaskBudget > 0 ? (earnedValue / totalTaskBudget) * 100 : 0;
  const percentSpent = totalBudget > 0 ? (actualCost / totalBudget) * 100 : 0;

  return {
    plannedValue,
    earnedValue,
    actualCost,
    costVariance,
    scheduleVariance,
    costPerformanceIndex,
    schedulePerformanceIndex,
    estimateAtCompletion,
    estimateToComplete,
    varianceAtCompletion,
    percentComplete,
    percentSpent,
  };
}

/**
 * Record EVM snapshot in database
 */
export async function recordEVMSnapshot(
  projectId: string,
  metrics: EVMMetrics,
  calculatedBy?: string
): Promise<void> {
  const budget = await prisma.projectBudget.findUnique({
    where: { projectId },
  });

  if (!budget) return;

  const today = startOfDay(new Date());

  // Check if we already have a record for today
  const existing = await prisma.earnedValue.findFirst({
    where: {
      budgetId: budget.id,
      periodDate: today,
      periodType: 'daily',
    },
  });

  if (existing) {
    // Update existing record
    await prisma.earnedValue.update({
      where: { id: existing.id },
      data: {
        plannedValue: metrics.plannedValue,
        earnedValue: metrics.earnedValue,
        actualCost: metrics.actualCost,
        costVariance: metrics.costVariance,
        scheduleVariance: metrics.scheduleVariance,
        costPerformanceIndex: metrics.costPerformanceIndex,
        schedulePerformanceIndex: metrics.schedulePerformanceIndex,
        estimateAtCompletion: metrics.estimateAtCompletion,
        estimateToComplete: metrics.estimateToComplete,
        varianceAtCompletion: metrics.varianceAtCompletion,
        percentComplete: metrics.percentComplete,
        percentSpent: metrics.percentSpent,
      },
    });
  } else {
    // Create new record
    await prisma.earnedValue.create({
      data: {
        budgetId: budget.id,
        periodDate: today,
        periodType: 'daily',
        plannedValue: metrics.plannedValue,
        earnedValue: metrics.earnedValue,
        actualCost: metrics.actualCost,
        costVariance: metrics.costVariance,
        scheduleVariance: metrics.scheduleVariance,
        costPerformanceIndex: metrics.costPerformanceIndex,
        schedulePerformanceIndex: metrics.schedulePerformanceIndex,
        estimateAtCompletion: metrics.estimateAtCompletion,
        estimateToComplete: metrics.estimateToComplete,
        varianceAtCompletion: metrics.varianceAtCompletion,
        percentComplete: metrics.percentComplete,
        percentSpent: metrics.percentSpent,
        calculatedBy: calculatedBy,
      },
    });
  }
}

/**
 * Generate S-curve snapshot
 */
export async function generateSCurveSnapshot(projectId: string): Promise<void> {
  const metrics = await calculateEVMFromSchedule(projectId);
  if (!metrics) return;

  const today = startOfDay(new Date());

  // Check for existing snapshot today
  const existing = await prisma.budgetSnapshot.findFirst({
    where: {
      projectId,
      snapshotDate: today,
    },
  });

  if (existing) {
    await prisma.budgetSnapshot.update({
      where: { id: existing.id },
      data: {
        plannedValue: metrics.plannedValue,
        earnedValue: metrics.earnedValue,
        actualCost: metrics.actualCost,
        cpi: metrics.costPerformanceIndex,
        spi: metrics.schedulePerformanceIndex,
        percentComplete: metrics.percentComplete,
      },
    });
  } else {
    await prisma.budgetSnapshot.create({
      data: {
        projectId,
        snapshotDate: today,
        plannedValue: metrics.plannedValue,
        earnedValue: metrics.earnedValue,
        actualCost: metrics.actualCost,
        cpi: metrics.costPerformanceIndex,
        spi: metrics.schedulePerformanceIndex,
        percentComplete: metrics.percentComplete,
      },
    });
  }
}

/**
 * Check and generate cost alerts based on current metrics
 */
export async function checkAndGenerateAlerts(projectId: string): Promise<CostAlertInput[]> {
  const alerts: CostAlertInput[] = [];
  const metrics = await calculateEVMFromSchedule(projectId);
  
  if (!metrics) return alerts;

  // Dismiss old alerts of the same type before creating new ones
  const dismissOldAlerts = async (alertType: string) => {
    await prisma.costAlert.updateMany({
      where: {
        projectId,
        alertType: alertType as any,
        isDismissed: false,
      },
      data: { isDismissed: true },
    });
  };

  // Check CPI
  if (metrics.costPerformanceIndex < ALERT_THRESHOLDS.cpiCritical) {
    await dismissOldAlerts('CPI_LOW');
    const alert: CostAlertInput = {
      projectId,
      alertType: 'CPI_LOW',
      severity: 'CRITICAL',
      title: 'Critical: Cost Performance Below Threshold',
      message: `CPI is ${metrics.costPerformanceIndex.toFixed(2)}, indicating significant cost overruns. Immediate action required.`,
      currentValue: metrics.costPerformanceIndex,
      threshold: ALERT_THRESHOLDS.cpiCritical,
    };
    alerts.push(alert);
    await createAlert(alert);
  } else if (metrics.costPerformanceIndex < ALERT_THRESHOLDS.cpiWarning) {
    await dismissOldAlerts('CPI_LOW');
    const alert: CostAlertInput = {
      projectId,
      alertType: 'CPI_LOW',
      severity: 'WARNING',
      title: 'Warning: Cost Performance Declining',
      message: `CPI is ${metrics.costPerformanceIndex.toFixed(2)}, approaching critical threshold. Review spending.`,
      currentValue: metrics.costPerformanceIndex,
      threshold: ALERT_THRESHOLDS.cpiWarning,
    };
    alerts.push(alert);
    await createAlert(alert);
  }

  // Check SPI
  if (metrics.schedulePerformanceIndex < ALERT_THRESHOLDS.spiCritical) {
    await dismissOldAlerts('SPI_LOW');
    const alert: CostAlertInput = {
      projectId,
      alertType: 'SPI_LOW',
      severity: 'CRITICAL',
      title: 'Critical: Schedule Performance Below Threshold',
      message: `SPI is ${metrics.schedulePerformanceIndex.toFixed(2)}, indicating significant schedule delays. Immediate action required.`,
      currentValue: metrics.schedulePerformanceIndex,
      threshold: ALERT_THRESHOLDS.spiCritical,
    };
    alerts.push(alert);
    await createAlert(alert);
  } else if (metrics.schedulePerformanceIndex < ALERT_THRESHOLDS.spiWarning) {
    await dismissOldAlerts('SPI_LOW');
    const alert: CostAlertInput = {
      projectId,
      alertType: 'SPI_LOW',
      severity: 'WARNING',
      title: 'Warning: Schedule Performance Declining',
      message: `SPI is ${metrics.schedulePerformanceIndex.toFixed(2)}, approaching critical threshold. Review schedule.`,
      currentValue: metrics.schedulePerformanceIndex,
      threshold: ALERT_THRESHOLDS.spiWarning,
    };
    alerts.push(alert);
    await createAlert(alert);
  }

  // Check budget overrun forecast
  const budget = await prisma.projectBudget.findUnique({ where: { projectId } });
  if (budget && metrics.estimateAtCompletion > budget.totalBudget) {
    await dismissOldAlerts('FORECAST_OVERRUN');
    const overrunPercent = ((metrics.estimateAtCompletion - budget.totalBudget) / budget.totalBudget) * 100;
    const alert: CostAlertInput = {
      projectId,
      alertType: 'FORECAST_OVERRUN',
      severity: overrunPercent > 10 ? 'CRITICAL' : 'WARNING',
      title: `Forecast: Budget Overrun by ${overrunPercent.toFixed(1)}%`,
      message: `EAC ($${metrics.estimateAtCompletion.toLocaleString()}) exceeds budget ($${budget.totalBudget.toLocaleString()}) by $${(metrics.estimateAtCompletion - budget.totalBudget).toLocaleString()}.`,
      currentValue: metrics.estimateAtCompletion,
      threshold: budget.totalBudget,
    };
    alerts.push(alert);
    await createAlert(alert);
  }

  // Check contingency usage
  if (budget && budget.contingency > 0) {
    const contingencyUsages = await prisma.contingencyUsage.findMany({
      where: { projectId },
    });
    const totalUsed = contingencyUsages.reduce((sum: number, u: { amount: number }) => sum + u.amount, 0);
    const percentUsed = (totalUsed / budget.contingency) * 100;

    if (percentUsed >= ALERT_THRESHOLDS.contingencyCritical) {
      await dismissOldAlerts('CONTINGENCY_LOW');
      const alert: CostAlertInput = {
        projectId,
        alertType: 'CONTINGENCY_LOW',
        severity: 'CRITICAL',
        title: 'Critical: Contingency Nearly Exhausted',
        message: `${percentUsed.toFixed(1)}% of contingency has been used. Only $${(budget.contingency - totalUsed).toLocaleString()} remaining.`,
        currentValue: percentUsed,
        threshold: ALERT_THRESHOLDS.contingencyCritical,
      };
      alerts.push(alert);
      await createAlert(alert);
    } else if (percentUsed >= ALERT_THRESHOLDS.contingencyWarning) {
      await dismissOldAlerts('CONTINGENCY_LOW');
      const alert: CostAlertInput = {
        projectId,
        alertType: 'CONTINGENCY_LOW',
        severity: 'WARNING',
        title: 'Warning: Contingency Running Low',
        message: `${percentUsed.toFixed(1)}% of contingency has been used. $${(budget.contingency - totalUsed).toLocaleString()} remaining.`,
        currentValue: percentUsed,
        threshold: ALERT_THRESHOLDS.contingencyWarning,
      };
      alerts.push(alert);
      await createAlert(alert);
    }
  }

  return alerts;
}

async function createAlert(alert: CostAlertInput): Promise<void> {
  await prisma.costAlert.create({
    data: {
      projectId: alert.projectId,
      budgetItemId: alert.budgetItemId,
      alertType: alert.alertType,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      currentValue: alert.currentValue,
      threshold: alert.threshold,
    },
  });

  // Also create a notification for the project owner
  const project = await prisma.project.findUnique({
    where: { id: alert.projectId },
    select: { ownerId: true },
  });

  if (project?.ownerId) {
    await prisma.notification.create({
      data: {
        userId: project.ownerId,
        type: 'alert',
        subject: alert.title,
        body: alert.message,
      },
    });
  }
}

/**
 * Main sync function - call this when schedule tasks are updated
 */
export async function syncBudgetFromSchedule(projectId: string, userId?: string): Promise<void> {
  try {
    console.log(`[BudgetSync] Starting sync for project ${projectId}`);

    // 1. Calculate fresh EVM metrics
    const metrics = await calculateEVMFromSchedule(projectId);
    if (!metrics) {
      console.log(`[BudgetSync] No budget or schedule found for project ${projectId}`);
      return;
    }

    // 2. Record EVM snapshot
    await recordEVMSnapshot(projectId, metrics, userId);
    console.log(`[BudgetSync] EVM snapshot recorded`);

    // 3. Generate S-curve data point
    await generateSCurveSnapshot(projectId);
    console.log(`[BudgetSync] S-curve snapshot generated`);

    // 4. Check and generate alerts
    const alerts = await checkAndGenerateAlerts(projectId);
    console.log(`[BudgetSync] Generated ${alerts.length} alerts`);

    console.log(`[BudgetSync] Sync complete for project ${projectId}`);
  } catch (error) {
    console.error(`[BudgetSync] Error syncing budget:`, error);
  }
}
