/**
 * Cash Flow & Financial Forecasting Service
 * Phase 4: Payment Applications, Cash Flow Projections
 */

import { prisma } from './db';
import type { Prisma, ProcurementStatus } from '@prisma/client';
import { addMonths, addWeeks, startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, differenceInMonths, differenceInWeeks, isBefore, isAfter, eachMonthOfInterval, eachWeekOfInterval } from 'date-fns';

// =============================================
// TYPE DEFINITIONS
// =============================================

/** Payment application line item for creation */
interface PaymentApplicationLineItem {
  budgetItemId: string;
  costCode: string;
  description: string;
  scheduledValue: number;
  fromPreviousApp: number;
  thisApplication: number;
  materialsStored: number;
  totalCompleted: number;
  percentComplete: number;
  balanceToFinish: number;
  retainage: number;
}

/** Payment application with items */
interface PaymentApplicationWithItems {
  id: string;
  projectId: string;
  budgetId: string;
  applicationNumber: number;
  periodStart: Date;
  periodEnd: Date;
  scheduledValue: number;
  previouslyApproved: number;
  currentPeriod: number;
  totalCompleted: number;
  retainage: number;
  retainagePercent: number;
  netDue: number;
  status: string;
  createdBy: string;
  items: Array<{
    id: string;
    budgetItemId: string;
    costCode: string;
    description: string;
    scheduledValue: number;
    fromPreviousApp: number;
    thisApplication: number;
    materialsStored: number;
    totalCompleted: number;
    percentComplete: number;
    balanceToFinish: number;
    retainage: number;
  }>;
}

/** Cash flow forecast period data */
interface CashFlowForecastPeriod {
  projectId: string;
  periodDate: Date;
  periodType: 'WEEKLY' | 'MONTHLY';
  plannedInflow: number;
  actualInflow: number;
  forecastInflow: number;
  plannedOutflow: number;
  actualOutflow: number;
  forecastOutflow: number;
  plannedNet: number;
  actualNet: number;
  forecastNet: number;
  cumulativePlanned: number;
  cumulativeActual: number;
  cumulativeForecast: number;
  isLocked: boolean;
  period?: string;
}

/** Payment application update data */
interface PaymentApplicationUpdateData {
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED' | 'PARTIALLY_PAID' | 'PAID';
  approvedAt?: Date;
  approvedBy?: string;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
}

// =============================================
// PAYMENT APPLICATION MANAGEMENT
// =============================================

export async function generatePaymentApplication(
  projectId: string,
  periodStart: Date,
  periodEnd: Date,
  userId: string
): Promise<PaymentApplicationWithItems> {
  // Get project and budget
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      ProjectBudget: {
        include: {
          BudgetItem: true
        }
      }
    }
  });

  if (!project || !project.ProjectBudget) {
    throw new Error('Project or budget not found');
  }

  const budget = project.ProjectBudget;

  // Get previous payment applications
  const previousApps = await prisma.paymentApplication.findMany({
    where: { projectId },
    orderBy: { applicationNumber: 'desc' },
    take: 1
  });

  const lastApp = previousApps[0];
  const applicationNumber = (lastApp?.applicationNumber || 0) + 1;
  const previouslyApproved = lastApp?.totalCompleted || 0;

  // Calculate current period progress from budget items
  const items: PaymentApplicationLineItem[] = [];
  let totalScheduledValue = 0;
  let totalCurrentPeriod = 0;
  let totalMaterialsStored = 0;

  for (const budgetItem of budget.BudgetItem) {
    // Get progress from linked tasks
    let percentComplete = 0;
    if (budgetItem.linkedTaskIds.length > 0) {
      const tasks = await prisma.scheduleTask.findMany({
        where: { taskId: { in: budgetItem.linkedTaskIds } }
      });
      percentComplete = tasks.length > 0
        ? tasks.reduce((sum, t) => sum + t.percentComplete, 0) / tasks.length
        : 0;
    } else {
      // Estimate from actual vs budgeted costs
      percentComplete = budgetItem.budgetedAmount > 0
        ? Math.min(100, (budgetItem.actualCost / budgetItem.budgetedAmount) * 100)
        : 0;
    }

    const scheduledValue = budgetItem.budgetedAmount;
    const totalCompleted = (percentComplete / 100) * scheduledValue;
    
    // Calculate from previous (if we have history)
    const prevItem = lastApp ? await prisma.paymentApplicationItem.findFirst({
      where: { paymentAppId: lastApp.id, budgetItemId: budgetItem.id }
    }) : null;
    
    const fromPreviousApp = prevItem?.totalCompleted || 0;
    const thisApplication = totalCompleted - fromPreviousApp;
    const materialsStored = 0; // Would need inventory tracking
    const balanceToFinish = scheduledValue - totalCompleted;

    items.push({
      budgetItemId: budgetItem.id,
      costCode: budgetItem.costCode,
      description: budgetItem.name,
      scheduledValue,
      fromPreviousApp,
      thisApplication: Math.max(0, thisApplication),
      materialsStored,
      totalCompleted,
      percentComplete,
      balanceToFinish,
      retainage: 0 // Will be calculated at save
    });

    totalScheduledValue += scheduledValue;
    totalCurrentPeriod += Math.max(0, thisApplication);
    totalMaterialsStored += materialsStored;
  }

  // Calculate totals
  const totalCompleted = previouslyApproved + totalCurrentPeriod + totalMaterialsStored;
  const retainagePercent = 10; // Standard 10% retainage
  const retainage = totalCompleted * (retainagePercent / 100);
  const netDue = totalCurrentPeriod - (totalCurrentPeriod * (retainagePercent / 100));

  // Create payment application
  const payApp = await prisma.paymentApplication.create({
    data: {
      projectId,
      budgetId: budget.id,
      applicationNumber,
      periodStart,
      periodEnd,
      scheduledValue: totalScheduledValue,
      previouslyApproved,
      currentPeriod: totalCurrentPeriod,
      totalCompleted,
      retainage,
      retainagePercent,
      netDue,
      status: 'DRAFT',
      createdBy: userId,
      items: {
        create: items.map((item) => ({
          budgetItemId: item.budgetItemId,
          costCode: item.costCode,
          description: item.description,
          scheduledValue: item.scheduledValue,
          fromPreviousApp: item.fromPreviousApp,
          thisApplication: item.thisApplication,
          materialsStored: item.materialsStored,
          totalCompleted: item.totalCompleted,
          percentComplete: item.percentComplete,
          balanceToFinish: item.balanceToFinish,
          retainage: item.thisApplication * (retainagePercent / 100)
        }))
      }
    },
    include: {
      items: true
    }
  });

  return payApp;
}

export async function reviewPaymentApplication(
  payAppId: string,
  action: 'approve' | 'reject' | 'request_revision',
  userId: string,
  reason?: string
) {
  const now = new Date();

  let data: PaymentApplicationUpdateData;

  switch (action) {
    case 'approve':
      data = {
        status: 'APPROVED',
        approvedAt: now,
        approvedBy: userId,
        reviewedAt: now,
        reviewedBy: userId
      };
      break;
    case 'reject':
      data = {
        status: 'REJECTED',
        reviewedAt: now,
        reviewedBy: userId,
        rejectionReason: reason
      };
      break;
    case 'request_revision':
      data = {
        status: 'REVISION_REQUIRED',
        reviewedAt: now,
        reviewedBy: userId,
        rejectionReason: reason
      };
      break;
    default:
      throw new Error('Invalid action');
  }

  const updated = await prisma.paymentApplication.update({
    where: { id: payAppId },
    data
  });

  return updated;
}

export async function getPaymentApplicationSummary(projectId: string) {
  const payApps = await prisma.paymentApplication.findMany({
    where: { projectId },
    orderBy: { applicationNumber: 'asc' }
  });

  const budget = await prisma.projectBudget.findFirst({
    where: { projectId }
  });

  const totalBilled = payApps
    .filter((pa) => pa.status !== 'REJECTED')
    .reduce((sum, pa) => sum + pa.currentPeriod, 0);

  const totalApproved = payApps
    .filter((pa) => ['APPROVED', 'PARTIALLY_PAID', 'PAID'].includes(pa.status))
    .reduce((sum, pa) => sum + pa.currentPeriod, 0);

  const totalPaid = payApps
    .filter((pa) => pa.status === 'PAID')
    .reduce((sum, pa) => sum + pa.netDue, 0);

  const totalRetainage = payApps
    .filter((pa) => pa.status !== 'REJECTED')
    .reduce((sum, pa) => sum + pa.retainage, 0);

  const pendingPayment = payApps
    .filter((pa) => ['APPROVED', 'PARTIALLY_PAID'].includes(pa.status))
    .reduce((sum, pa) => sum + pa.netDue, 0);

  return {
    totalContractValue: budget?.totalBudget || 0,
    totalBilled,
    totalApproved,
    totalPaid,
    totalRetainage,
    pendingPayment,
    percentBilled: budget?.totalBudget ? (totalBilled / budget.totalBudget) * 100 : 0,
    percentPaid: budget?.totalBudget ? (totalPaid / budget.totalBudget) * 100 : 0,
    applicationCount: payApps.length,
    lastApplication: payApps[payApps.length - 1]
  };
}

// =============================================
// CASH FLOW FORECASTING
// =============================================

export async function generateCashFlowForecast(
  projectId: string,
  periodType: 'WEEKLY' | 'MONTHLY' = 'MONTHLY',
  periodsAhead: number = 12
): Promise<CashFlowForecastPeriod[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      ProjectBudget: {
        include: {
          BudgetItem: true
        }
      }
    }
  });

  if (!project || !project.ProjectBudget) {
    throw new Error('Project or budget not found');
  }

  const budget = project.ProjectBudget;
  const now = new Date();

  // Get schedule for timing
  const schedule = await prisma.schedule.findFirst({
    where: { projectId, isActive: true },
    include: { ScheduleTask: true }
  });

  const projectStart = schedule?.startDate || now;
  const projectEnd = schedule?.endDate || addMonths(now, 12);

  // Generate period dates
  const periods = periodType === 'MONTHLY'
    ? eachMonthOfInterval({ start: projectStart, end: addMonths(now, periodsAhead) })
    : eachWeekOfInterval({ start: projectStart, end: addWeeks(now, periodsAhead) });

  // Get existing forecasts
  const existingForecasts = await prisma.cashFlowForecast.findMany({
    where: { projectId, periodType }
  });

  const forecasts: CashFlowForecastPeriod[] = [];
  let cumulativePlanned = 0;
  let cumulativeActual = 0;
  let cumulativeForecast = 0;

  for (const periodDate of periods) {
    const periodStart = periodType === 'MONTHLY' 
      ? startOfMonth(periodDate) 
      : startOfWeek(periodDate);
    const periodEnd = periodType === 'MONTHLY'
      ? endOfMonth(periodDate)
      : endOfWeek(periodDate);

    const isPast = isBefore(periodEnd, now);
    const isCurrent = !isPast && isBefore(periodStart, now);

    // Calculate planned outflow based on schedule
    let plannedOutflow = 0;
    if (schedule) {
      // Get tasks in this period
      const tasksInPeriod = schedule.ScheduleTask.filter(task => {
        const taskStart = new Date(task.startDate);
        const taskEnd = new Date(task.endDate);
        return (
          (isAfter(taskStart, periodStart) && isBefore(taskStart, periodEnd)) ||
          (isAfter(taskEnd, periodStart) && isBefore(taskEnd, periodEnd)) ||
          (isBefore(taskStart, periodStart) && isAfter(taskEnd, periodEnd))
        );
      });

      // Sum budgeted costs for tasks in period
      plannedOutflow = tasksInPeriod.reduce((sum, task) => {
        const taskCost = task.budgetedCost || 0;
        // Prorate cost if task spans multiple periods
        const totalPeriods = periodType === 'MONTHLY'
          ? differenceInMonths(new Date(task.endDate), new Date(task.startDate)) || 1
          : differenceInWeeks(new Date(task.endDate), new Date(task.startDate)) || 1;
        return sum + (taskCost / Math.max(1, totalPeriods));
      }, 0);
    } else {
      // Distribute budget evenly
      const totalPeriods = periodType === 'MONTHLY'
        ? differenceInMonths(projectEnd, projectStart) || 1
        : differenceInWeeks(projectEnd, projectStart) || 1;
      plannedOutflow = budget.totalBudget / totalPeriods;
    }

    // Calculate actual outflow from invoices/costs
    let actualOutflow = 0;
    if (isPast || isCurrent) {
      const invoices = await prisma.invoice.findMany({
        where: {
          projectId,
          invoiceDate: {
            gte: periodStart,
            lte: periodEnd
          },
          status: { in: ['APPROVED', 'PAID'] }
        }
      });
      actualOutflow = invoices.reduce((sum, inv) => sum + inv.amount, 0);
    }

    // Calculate planned inflow from payment apps
    let plannedInflow = 0;
    let actualInflow = 0;
    
    // Assume billing one period after work
    const billingPeriod = periodType === 'MONTHLY' 
      ? addMonths(periodDate, 1) 
      : addWeeks(periodDate, 1);
    plannedInflow = plannedOutflow * 1.1; // Assume 10% markup

    if (isPast) {
      const payApps = await prisma.paymentApplication.findMany({
        where: {
          projectId,
          periodEnd: {
            gte: periodStart,
            lte: periodEnd
          },
          status: 'PAID'
        }
      });
      actualInflow = payApps.reduce((sum, pa) => sum + pa.netDue, 0);
    }

    // Forecast (blend of planned and actual trends)
    const forecastInflow = isPast ? actualInflow : plannedInflow;
    const forecastOutflow = isPast ? actualOutflow : plannedOutflow;

    // Net cash
    const plannedNet = plannedInflow - plannedOutflow;
    const actualNet = actualInflow - actualOutflow;
    const forecastNet = forecastInflow - forecastOutflow;

    // Cumulative
    cumulativePlanned += plannedNet;
    cumulativeActual += isPast ? actualNet : 0;
    cumulativeForecast += forecastNet;

    const forecast = {
      projectId,
      periodDate: periodStart,
      periodType,
      plannedInflow,
      actualInflow,
      forecastInflow,
      plannedOutflow,
      actualOutflow,
      forecastOutflow,
      plannedNet,
      actualNet,
      forecastNet,
      cumulativePlanned,
      cumulativeActual: isPast ? cumulativeActual : 0,
      cumulativeForecast,
      isLocked: isPast
    };

    // Upsert forecast
    const existing = existingForecasts.find(
      f => format(f.periodDate, 'yyyy-MM-dd') === format(periodStart, 'yyyy-MM-dd')
    );

    if (existing) {
      await prisma.cashFlowForecast.update({
        where: { id: existing.id },
        data: forecast
      });
    } else {
      await prisma.cashFlowForecast.create({
        data: forecast
      });
    }

    forecasts.push({
      ...forecast,
      period: format(periodStart, periodType === 'MONTHLY' ? 'MMM yyyy' : "'W'w yyyy")
    });
  }

  return forecasts;
}

export async function getCashFlowSummary(projectId: string) {
  const forecasts = await prisma.cashFlowForecast.findMany({
    where: { projectId },
    orderBy: { periodDate: 'asc' }
  });

  const now = new Date();
  const pastPeriods = forecasts.filter((f) => isBefore(new Date(f.periodDate), now));
  const futurePeriods = forecasts.filter((f) => isAfter(new Date(f.periodDate), now));

  return {
    totalPlannedInflow: forecasts.reduce((sum, f) => sum + f.plannedInflow, 0),
    totalActualInflow: pastPeriods.reduce((sum, f) => sum + f.actualInflow, 0),
    totalPlannedOutflow: forecasts.reduce((sum, f) => sum + f.plannedOutflow, 0),
    totalActualOutflow: pastPeriods.reduce((sum, f) => sum + f.actualOutflow, 0),
    projectedNetCash: forecasts[forecasts.length - 1]?.cumulativeForecast || 0,
    currentNetCash: pastPeriods[pastPeriods.length - 1]?.cumulativeActual || 0,
    remainingPeriods: futurePeriods.length,
    forecasts
  };
}

// =============================================
// PROCUREMENT TRACKING
// =============================================

export async function createProcurement(
  projectId: string,
  data: {
    description: string;
    itemType: 'EQUIPMENT' | 'MATERIAL' | 'LONG_LEAD_ITEM' | 'SPECIALTY_ITEM' | 'OWNER_FURNISHED';
    specifications?: string;
    quantity?: number;
    unit?: string;
    requiredDate?: Date;
    leadTime?: number;
    budgetedCost?: number;
    vendorName?: string;
    budgetItemId?: string;
  },
  userId: string
) {
  // Generate procurement number
  const lastProcurement = await prisma.procurement.findFirst({
    where: { projectId },
    orderBy: { createdAt: 'desc' }
  });

  const count = lastProcurement
    ? parseInt(lastProcurement.procurementNumber.split('-')[1] || '0') + 1
    : 1;
  const procurementNumber = `PROC-${count.toString().padStart(4, '0')}`;

  const procurement = await prisma.procurement.create({
    data: {
      projectId,
      procurementNumber,
      description: data.description,
      itemType: data.itemType,
      specifications: data.specifications,
      quantity: data.quantity,
      unit: data.unit,
      requiredDate: data.requiredDate,
      leadTime: data.leadTime,
      budgetedCost: data.budgetedCost,
      vendorName: data.vendorName,
      budgetItemId: data.budgetItemId,
      status: 'IDENTIFIED',
      createdBy: userId
    }
  });

  return procurement;
}

export async function updateProcurementStatus(
  procurementId: string,
  status: string,
  additionalData?: {
    orderDate?: Date;
    expectedDelivery?: Date;
    actualDelivery?: Date;
    quotedCost?: number;
    actualCost?: number;
    purchaseOrder?: string;
    trackingNumber?: string;
    vendorId?: string;
  }
) {
  const procurement = await prisma.procurement.update({
    where: { id: procurementId },
    data: {
      status: status as ProcurementStatus,
      ...additionalData
    }
  });

  // Update budget item if linked
  if (procurement.budgetItemId && additionalData?.actualCost) {
    await prisma.budgetItem.update({
      where: { id: procurement.budgetItemId },
      data: {
        committedCost: { increment: additionalData.actualCost }
      }
    });
  }

  return procurement;
}

export async function getProcurementDashboard(projectId: string) {
  const procurements = await prisma.procurement.findMany({
    where: { projectId },
    include: {
      vendor: true,
      budgetItem: true
    },
    orderBy: { requiredDate: 'asc' }
  });

  const now = new Date();

  // Group by status
  const byStatus = procurements.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  // Find at-risk items (required date approaching but not ordered)
  const atRisk = procurements.filter((p) => {
    if (!p.requiredDate || ['RECEIVED', 'INSTALLED', 'CANCELLED'].includes(p.status)) {
      return false;
    }
    const daysUntilRequired = Math.ceil(
      (new Date(p.requiredDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const leadTime = p.leadTime || 14;
    return daysUntilRequired < leadTime && !['ORDERED', 'IN_TRANSIT'].includes(p.status);
  });

  // Long lead items
  const longLeadItems = procurements.filter((p) => p.itemType === 'LONG_LEAD_ITEM');

  // Calculate totals
  const totalBudgeted = procurements.reduce((sum, p) => sum + (p.budgetedCost || 0), 0);
  const totalCommitted = procurements
    .filter((p) => ['ORDERED', 'IN_TRANSIT', 'RECEIVED', 'INSTALLED'].includes(p.status))
    .reduce((sum, p) => sum + (p.quotedCost || p.budgetedCost || 0), 0);
  const totalActual = procurements
    .filter((p) => p.actualCost !== null)
    .reduce((sum, p) => sum + (p.actualCost || 0), 0);

  return {
    total: procurements.length,
    byStatus,
    atRisk,
    longLeadItems,
    totalBudgeted,
    totalCommitted,
    totalActual,
    variance: totalBudgeted - totalActual,
    procurements
  };
}

// =============================================
// COST FORECASTING (EAC/ETC)
// =============================================

export async function calculateCostForecast(projectId: string) {
  const budget = await prisma.projectBudget.findFirst({
    where: { projectId },
    include: { BudgetItem: true }
  });

  if (!budget) {
    throw new Error('Budget not found');
  }

  // Get EVM data
  const latestEVM = await prisma.earnedValue.findFirst({
    where: { budgetId: budget.id },
    orderBy: { periodDate: 'desc' }
  });

  // Budget At Completion (BAC)
  const bac = budget.totalBudget;

  // Actual Cost (AC)
  const ac = budget.actualCost;

  // Calculate Earned Value (EV) from task completion
  const schedule = await prisma.schedule.findFirst({
    where: { projectId, isActive: true },
    include: { ScheduleTask: true }
  });

  let percentComplete = 0;
  if (schedule) {
    percentComplete = schedule.ScheduleTask.reduce((sum, t) => sum + t.percentComplete, 0) /
      (schedule.ScheduleTask.length || 1);
  } else {
    percentComplete = bac > 0 ? (ac / bac) * 100 : 0;
  }

  const ev = (percentComplete / 100) * bac;

  // Cost Performance Index (CPI)
  const cpi = ac > 0 ? ev / ac : 1;

  // Schedule Performance Index (SPI)
  const pv = latestEVM?.plannedValue || ev; // Planned value
  const spi = pv > 0 ? ev / pv : 1;

  // Estimate At Completion (EAC) - Multiple methods
  const eacTypical = bac / cpi; // Assumes future CPI same as past
  const eacAtypical = ac + (bac - ev); // Assumes remaining work at original estimate
  const eacComposite = ac + ((bac - ev) / (cpi * spi)); // Uses both CPI and SPI

  // Use composite as primary forecast
  const eac = eacComposite;

  // Estimate To Complete (ETC)
  const etc = eac - ac;

  // Variance At Completion (VAC)
  const vac = bac - eac;

  // To Complete Performance Index (TCPI)
  const tcpi = (bac - ev) / (bac - ac);

  // Confidence assessment
  let confidenceLevel = 'HIGH';
  let confidencePercent = 90;

  if (cpi < 0.9 || spi < 0.9) {
    confidenceLevel = 'MEDIUM';
    confidencePercent = 70;
  }
  if (cpi < 0.8 || spi < 0.8) {
    confidenceLevel = 'LOW';
    confidencePercent = 50;
  }

  // Generate recommendations
  const recommendations: string[] = [];
  if (cpi < 1) {
    recommendations.push('Cost overrun detected - review change orders and scope');
  }
  if (spi < 1) {
    recommendations.push('Schedule delay detected - consider acceleration measures');
  }
  if (tcpi > 1.1) {
    recommendations.push('Remaining work requires significant cost improvement');
  }
  if (vac < 0) {
    recommendations.push(`Projected cost overrun of $${Math.abs(vac).toLocaleString()}`);
  }

  return {
    // Budget
    bac,
    contingency: budget.contingency,

    // Performance
    ev,
    ac,
    pv,
    cpi,
    spi,

    // Forecasts
    eac,
    eacMethods: {
      typical: eacTypical,
      atypical: eacAtypical,
      composite: eacComposite
    },
    etc,
    vac,
    tcpi,

    // Progress
    percentComplete,
    percentSpent: bac > 0 ? (ac / bac) * 100 : 0,

    // Assessment
    confidenceLevel,
    confidencePercent,
    recommendations,

    // Derived
    projectedOverrun: vac < 0,
    overrunAmount: vac < 0 ? Math.abs(vac) : 0,
    costHealthStatus: cpi >= 1 ? 'ON_BUDGET' : cpi >= 0.9 ? 'AT_RISK' : 'OVER_BUDGET',
    scheduleHealthStatus: spi >= 1 ? 'ON_SCHEDULE' : spi >= 0.9 ? 'AT_RISK' : 'BEHIND_SCHEDULE'
  };
}
