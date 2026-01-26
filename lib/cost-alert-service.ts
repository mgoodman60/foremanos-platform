import { prisma } from './db';

type CostAlertType = 'CPI_LOW' | 'SPI_LOW' | 'BUDGET_EXCEEDED' | 'ITEM_OVER_BUDGET' | 'CONTINGENCY_LOW' | 'FORECAST_OVERRUN';
type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

interface AlertThresholds {
  cpiWarning: number;
  cpiCritical: number;
  spiWarning: number;
  spiCritical: number;
  contingencyWarning: number;
  contingencyCritical: number;
  budgetOverrunWarning: number;
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  cpiWarning: 0.95,
  cpiCritical: 0.85,
  spiWarning: 0.95,
  spiCritical: 0.85,
  contingencyWarning: 70,
  contingencyCritical: 90,
  budgetOverrunWarning: 10,
};

export async function checkAndCreateAlerts(projectId: string) {
  const alerts: Array<{
    alertType: CostAlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    threshold?: number;
    currentValue?: number;
    budgetItemId?: string;
  }> = [];

  // Get budget data
  const budget = await prisma.projectBudget.findUnique({
    where: { projectId },
    include: {
      BudgetItem: true
    }
  });

  if (!budget) return;

  // Get latest EVM data separately
  const latestEVM = await prisma.earnedValue.findFirst({
    where: { budgetId: budget.id },
    orderBy: { periodDate: 'desc' }
  });

  // Check CPI
  if (latestEVM) {
    const cpi = latestEVM.actualCost > 0 
      ? latestEVM.earnedValue / latestEVM.actualCost 
      : null;

    if (cpi !== null) {
      if (cpi < DEFAULT_THRESHOLDS.cpiCritical) {
        alerts.push({
          alertType: 'CPI_LOW',
          severity: 'CRITICAL',
          title: 'Critical: CPI Below Threshold',
          message: `Cost Performance Index has dropped to ${cpi.toFixed(2)}. Project is significantly over budget.`,
          threshold: DEFAULT_THRESHOLDS.cpiCritical,
          currentValue: cpi
        });
      } else if (cpi < DEFAULT_THRESHOLDS.cpiWarning) {
        alerts.push({
          alertType: 'CPI_LOW',
          severity: 'WARNING',
          title: 'Warning: CPI Declining',
          message: `Cost Performance Index is ${cpi.toFixed(2)}. Consider reviewing cost controls.`,
          threshold: DEFAULT_THRESHOLDS.cpiWarning,
          currentValue: cpi
        });
      }

      // Check SPI
      const spi = latestEVM.plannedValue > 0 
        ? latestEVM.earnedValue / latestEVM.plannedValue 
        : null;

      if (spi !== null) {
        if (spi < DEFAULT_THRESHOLDS.spiCritical) {
          alerts.push({
            alertType: 'SPI_LOW',
            severity: 'CRITICAL',
            title: 'Critical: SPI Below Threshold',
            message: `Schedule Performance Index has dropped to ${spi.toFixed(2)}. Project is significantly behind schedule.`,
            threshold: DEFAULT_THRESHOLDS.spiCritical,
            currentValue: spi
          });
        } else if (spi < DEFAULT_THRESHOLDS.spiWarning) {
          alerts.push({
            alertType: 'SPI_LOW',
            severity: 'WARNING',
            title: 'Warning: SPI Declining',
            message: `Schedule Performance Index is ${spi.toFixed(2)}. Schedule may be at risk.`,
            threshold: DEFAULT_THRESHOLDS.spiWarning,
            currentValue: spi
          });
        }
      }
    }
  }

  // Check contingency usage
  const contingencyUsages = await prisma.contingencyUsage.findMany({
    where: { projectId }
  });
  const totalUsed = contingencyUsages.reduce((sum: number, u: { amount: number }) => sum + u.amount, 0);
  const percentUsed = budget.contingency > 0 ? (totalUsed / budget.contingency) * 100 : 0;

  if (percentUsed >= DEFAULT_THRESHOLDS.contingencyCritical) {
    alerts.push({
      alertType: 'CONTINGENCY_LOW',
      severity: 'CRITICAL',
      title: 'Critical: Contingency Nearly Exhausted',
      message: `${percentUsed.toFixed(1)}% of contingency has been used. Only ${(budget.contingency - totalUsed).toLocaleString()} remaining.`,
      threshold: DEFAULT_THRESHOLDS.contingencyCritical,
      currentValue: percentUsed
    });
  } else if (percentUsed >= DEFAULT_THRESHOLDS.contingencyWarning) {
    alerts.push({
      alertType: 'CONTINGENCY_LOW',
      severity: 'WARNING',
      title: 'Warning: High Contingency Usage',
      message: `${percentUsed.toFixed(1)}% of contingency has been used.`,
      threshold: DEFAULT_THRESHOLDS.contingencyWarning,
      currentValue: percentUsed
    });
  }

  // Check budget items over budget
  for (const item of budget.BudgetItem) {
    const effectiveBudget = item.revisedBudget || item.budgetedAmount;
    if (item.actualCost > effectiveBudget) {
      const overrunPercent = ((item.actualCost - effectiveBudget) / effectiveBudget) * 100;
      alerts.push({
        alertType: 'ITEM_OVER_BUDGET',
        severity: overrunPercent > 20 ? 'CRITICAL' : 'WARNING',
        title: `${item.name} Over Budget`,
        message: `Actual cost ($${item.actualCost.toLocaleString()}) exceeds budget ($${effectiveBudget.toLocaleString()}) by ${overrunPercent.toFixed(1)}%`,
        threshold: effectiveBudget,
        currentValue: item.actualCost,
        budgetItemId: item.id
      });
    }
  }

  // Create alerts (avoid duplicates from last 24 hours)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const alert of alerts) {
    // Check if similar alert exists recently
    const existing = await prisma.costAlert.findFirst({
      where: {
        projectId,
        alertType: alert.alertType,
        budgetItemId: alert.budgetItemId || null,
        triggeredAt: { gte: yesterday },
        isDismissed: false
      }
    });

    if (!existing) {
      await prisma.costAlert.create({
        data: {
          projectId,
          ...alert
        }
      });
    }
  }

  return alerts.length;
}
