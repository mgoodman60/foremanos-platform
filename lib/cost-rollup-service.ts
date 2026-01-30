/**
 * Cost Rollup Service
 * Aggregates daily costs from labor, materials, and equipment
 * Updates budget items and creates daily cost summaries
 */

import { prisma } from '@/lib/db';
import { startOfDay, endOfDay, format } from 'date-fns';
import { syncBudgetFromSchedule } from './budget-sync-service';

export interface DailyCostSummary {
  date: Date;
  laborCost: number;
  materialCost: number;
  equipmentCost: number;
  subcontractorCost: number;
  totalCost: number;
  laborHours: number;
  workerCount: number;
}

export interface CostRollupResult {
  success: boolean;
  date: Date;
  summary: DailyCostSummary;
  budgetItemsUpdated: number;
  evmRefreshed: boolean;
}

/**
 * Get labor costs for a specific date
 */
async function getLaborCostsForDate(
  projectId: string,
  date: Date
): Promise<{ totalCost: number; totalHours: number; workerCount: number }> {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const laborEntries = await prisma.laborEntry.findMany({
    where: {
      projectId,
      date: { gte: dayStart, lte: dayEnd },
      status: 'APPROVED', // Only count approved labor
    },
  });

  const totalCost = laborEntries.reduce((sum, entry) => sum + entry.totalCost, 0);
  const totalHours = laborEntries.reduce((sum, entry) => sum + entry.hoursWorked, 0);
  
  // Estimate worker count from worker names (each unique name = 1 worker entry)
  const uniqueWorkers = new Set(laborEntries.map(e => e.workerName));
  const workerCount = uniqueWorkers.size;

  return { totalCost, totalHours, workerCount };
}

/**
 * Get material costs for a specific date
 */
async function getMaterialCostsForDate(
  projectId: string,
  date: Date
): Promise<number> {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  // Get received procurement items for the date
  const deliveries = await prisma.procurement.findMany({
    where: {
      projectId,
      actualDelivery: { gte: dayStart, lte: dayEnd },
      status: 'RECEIVED',
    },
  });

  return deliveries.reduce((sum, d) => sum + (d.actualCost || 0), 0);
}

/**
 * Get equipment costs for a specific date (from daily report equipment data)
 */
async function getEquipmentCostsForDate(
  projectId: string,
  date: Date
): Promise<number> {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  // Check for equipment usage from daily reports
  const conversations = await prisma.conversation.findMany({
    where: {
      projectId,
      conversationType: 'daily_report',
      dailyReportDate: { gte: dayStart, lte: dayEnd },
    },
    select: { equipmentData: true },
  });

  let totalCost = 0;
  for (const conv of conversations) {
    const equipment = (conv.equipmentData as any[]) || [];
    // Sum up equipment rental/usage costs if specified
    for (const eq of equipment) {
      totalCost += eq.dailyCost || eq.cost || 0;
    }
  }

  return totalCost;
}

/**
 * Get subcontractor costs for a specific date (from invoices or commitments)
 */
async function getSubcontractorCostsForDate(
  projectId: string,
  date: Date
): Promise<number> {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  // Get approved invoices for the date
  const invoices = await prisma.invoice.findMany({
    where: {
      projectId,
      invoiceDate: { gte: dayStart, lte: dayEnd },
      status: 'APPROVED',
    },
  });

  return invoices.reduce((sum, inv) => sum + inv.amount, 0);
}

/**
 * Calculate and save daily cost summary
 */
export async function calculateDailyCosts(
  projectId: string,
  date: Date
): Promise<DailyCostSummary> {
  // Get all cost categories
  const laborData = await getLaborCostsForDate(projectId, date);
  const materialCost = await getMaterialCostsForDate(projectId, date);
  const equipmentCost = await getEquipmentCostsForDate(projectId, date);
  const subcontractorCost = await getSubcontractorCostsForDate(projectId, date);

  const summary: DailyCostSummary = {
    date,
    laborCost: laborData.totalCost,
    materialCost,
    equipmentCost,
    subcontractorCost,
    totalCost: laborData.totalCost + materialCost + equipmentCost + subcontractorCost,
    laborHours: laborData.totalHours,
    workerCount: laborData.workerCount,
  };

  return summary;
}

/**
 * Update project budget totals with accumulated actuals
 */
async function updateProjectBudgetTotals(projectId: string): Promise<number> {
  // Get the project budget
  const budget = await prisma.projectBudget.findUnique({
    where: { projectId },
  });

  if (!budget) return 0;

  // Use Prisma aggregate to compute sums in database (single query)
  const budgetItemStats = await prisma.budgetItem.aggregate({
    where: {
      budgetId: budget.id,
      isActive: true,
    },
    _sum: {
      actualCost: true,
      actualHours: true,
    },
    _count: {
      id: true,
    },
  });

  const totalActualCost = budgetItemStats._sum.actualCost || 0;
  const totalActualHours = budgetItemStats._sum.actualHours || 0;
  const itemCount = budgetItemStats._count.id;

  console.log(`[CostRollup] Budget totals: $${totalActualCost.toFixed(2)} spent across ${itemCount} items, ${totalActualHours.toFixed(1)} total hours`);

  return itemCount;
}

/**
 * Recalculate budget item actuals from all linked labor and procurement entries
 * Useful for reconciliation or corrections
 */
export async function recalculateBudgetItemActuals(projectId: string): Promise<number> {
  const budget = await prisma.projectBudget.findUnique({
    where: { projectId },
    include: { BudgetItem: { where: { isActive: true } } },
  });

  if (!budget) return 0;

  const budgetItemIds = budget.BudgetItem.map(item => item.id);

  // Batch fetch labor aggregates grouped by budgetItemId
  const laborAggregates = await prisma.laborEntry.groupBy({
    by: ['budgetItemId'],
    where: {
      budgetItemId: { in: budgetItemIds },
      status: 'APPROVED',
    },
    _sum: {
      hoursWorked: true,
      totalCost: true,
    },
  });

  // Batch fetch procurement aggregates grouped by budgetItemId
  const procurementAggregates = await prisma.procurement.groupBy({
    by: ['budgetItemId'],
    where: {
      budgetItemId: { in: budgetItemIds },
      status: 'RECEIVED',
    },
    _sum: {
      actualCost: true,
    },
  });

  // Create lookup maps for O(1) access
  const laborMap = new Map(
    laborAggregates.map(agg => [agg.budgetItemId, agg._sum])
  );
  const procurementMap = new Map(
    procurementAggregates.map(agg => [agg.budgetItemId, agg._sum])
  );

  let updatedCount = 0;

  // Prepare batch updates
  const updatePromises: Promise<unknown>[] = [];

  for (const item of budget.BudgetItem) {
    const laborData = laborMap.get(item.id);
    const procurementData = procurementMap.get(item.id);

    const laborHours = laborData?.hoursWorked || 0;
    const laborCost = laborData?.totalCost || 0;
    const materialCost = procurementData?.actualCost || 0;
    const totalActualCost = laborCost + materialCost;

    // Update budget item if values changed
    if (item.actualHours !== laborHours || item.actualCost !== totalActualCost) {
      updatePromises.push(
        prisma.budgetItem.update({
          where: { id: item.id },
          data: {
            actualHours: laborHours,
            actualCost: totalActualCost,
          },
        })
      );
      updatedCount++;
      console.log(`[CostRollup] Recalculated ${item.name}: ${laborHours} hours, $${totalActualCost.toFixed(2)}`);
    }
  }

  // Execute all updates in parallel
  await Promise.all(updatePromises);

  return updatedCount;
}

/**
 * Main cost rollup function - call after daily report finalization
 */
export async function performDailyCostRollup(
  projectId: string,
  date: Date,
  userId?: string
): Promise<CostRollupResult> {
  console.log(`[CostRollup] Starting rollup for project ${projectId} on ${format(date, 'yyyy-MM-dd')}`);

  try {
    // 1. Calculate daily costs
    const summary = await calculateDailyCosts(projectId, date);
    console.log(`[CostRollup] Daily summary: Labor $${summary.laborCost.toFixed(2)}, Materials $${summary.materialCost.toFixed(2)}, Equipment $${summary.equipmentCost.toFixed(2)}, Total $${summary.totalCost.toFixed(2)}`);

    // 2. Store daily snapshot in BudgetSnapshot
    const dayStart = startOfDay(date);
    const existingSnapshot = await prisma.budgetSnapshot.findFirst({
      where: {
        projectId,
        snapshotDate: dayStart,
      },
    });

    if (existingSnapshot) {
      await prisma.budgetSnapshot.update({
        where: { id: existingSnapshot.id },
        data: {
          actualCost: summary.totalCost,
          // Preserve other fields if they exist
        },
      });
    } else {
      await prisma.budgetSnapshot.create({
        data: {
          Project: { connect: { id: projectId } },
          snapshotDate: dayStart,
          actualCost: summary.totalCost,
          plannedValue: 0, // Will be updated by EVM sync
          earnedValue: 0,
          percentComplete: 0, // Will be updated by EVM sync
        },
      });
    }

    // 3. Update project budget totals
    const budgetItemsUpdated = await updateProjectBudgetTotals(projectId);

    // 4. Trigger EVM/budget sync to recalculate metrics
    let evmRefreshed = false;
    try {
      await syncBudgetFromSchedule(projectId, userId);
      evmRefreshed = true;
      console.log('[CostRollup] EVM metrics refreshed');
    } catch (error) {
      console.error('[CostRollup] Error refreshing EVM:', error);
    }

    console.log(`[CostRollup] Rollup complete for ${format(date, 'yyyy-MM-dd')}`);

    return {
      success: true,
      date,
      summary,
      budgetItemsUpdated,
      evmRefreshed,
    };
  } catch (error) {
    console.error('[CostRollup] Error:', error);
    return {
      success: false,
      date,
      summary: {
        date,
        laborCost: 0,
        materialCost: 0,
        equipmentCost: 0,
        subcontractorCost: 0,
        totalCost: 0,
        laborHours: 0,
        workerCount: 0,
      },
      budgetItemsUpdated: 0,
      evmRefreshed: false,
    };
  }
}

/**
 * Get cost summary for a date range (for reports/dashboards)
 * Optimized to batch fetch all data in a few queries instead of per-day queries
 */
export async function getCostSummaryForRange(
  projectId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalLabor: number;
  totalMaterial: number;
  totalEquipment: number;
  totalSubcontractor: number;
  grandTotal: number;
  totalHours: number;
  dailyBreakdown: DailyCostSummary[];
}> {
  const rangeStart = startOfDay(startDate);
  const rangeEnd = endOfDay(endDate);

  // Batch fetch all data for the entire date range
  const [laborEntries, deliveries, conversations, invoices] = await Promise.all([
    // Labor entries
    prisma.laborEntry.findMany({
      where: {
        projectId,
        date: { gte: rangeStart, lte: rangeEnd },
        status: 'APPROVED',
      },
      select: { date: true, totalCost: true, hoursWorked: true, workerName: true },
    }),
    // Material deliveries
    prisma.procurement.findMany({
      where: {
        projectId,
        actualDelivery: { gte: rangeStart, lte: rangeEnd },
        status: 'RECEIVED',
      },
      select: { actualDelivery: true, actualCost: true },
    }),
    // Equipment from conversations
    prisma.conversation.findMany({
      where: {
        projectId,
        conversationType: 'daily_report',
        dailyReportDate: { gte: rangeStart, lte: rangeEnd },
      },
      select: { dailyReportDate: true, equipmentData: true },
    }),
    // Subcontractor invoices
    prisma.invoice.findMany({
      where: {
        projectId,
        invoiceDate: { gte: rangeStart, lte: rangeEnd },
        status: 'APPROVED',
      },
      select: { invoiceDate: true, amount: true },
    }),
  ]);

  // Group data by date using Maps
  const laborByDate = new Map<string, { totalCost: number; totalHours: number; workers: Set<string> }>();
  const materialByDate = new Map<string, number>();
  const equipmentByDate = new Map<string, number>();
  const subcontractorByDate = new Map<string, number>();

  // Process labor entries
  for (const entry of laborEntries) {
    const dateKey = format(entry.date, 'yyyy-MM-dd');
    const existing = laborByDate.get(dateKey) || { totalCost: 0, totalHours: 0, workers: new Set() };
    existing.totalCost += entry.totalCost;
    existing.totalHours += entry.hoursWorked;
    existing.workers.add(entry.workerName);
    laborByDate.set(dateKey, existing);
  }

  // Process deliveries
  for (const delivery of deliveries) {
    if (delivery.actualDelivery) {
      const dateKey = format(delivery.actualDelivery, 'yyyy-MM-dd');
      materialByDate.set(dateKey, (materialByDate.get(dateKey) || 0) + (delivery.actualCost || 0));
    }
  }

  // Process equipment
  for (const conv of conversations) {
    if (conv.dailyReportDate) {
      const dateKey = format(conv.dailyReportDate, 'yyyy-MM-dd');
      const equipment = (conv.equipmentData as any[]) || [];
      let equipCost = 0;
      for (const eq of equipment) {
        equipCost += eq.dailyCost || eq.cost || 0;
      }
      equipmentByDate.set(dateKey, (equipmentByDate.get(dateKey) || 0) + equipCost);
    }
  }

  // Process invoices
  for (const invoice of invoices) {
    const dateKey = format(invoice.invoiceDate, 'yyyy-MM-dd');
    subcontractorByDate.set(dateKey, (subcontractorByDate.get(dateKey) || 0) + invoice.amount);
  }

  // Build daily breakdown
  const dailyBreakdown: DailyCostSummary[] = [];
  let totalLabor = 0;
  let totalMaterial = 0;
  let totalEquipment = 0;
  let totalSubcontractor = 0;
  let totalHours = 0;

  const current = new Date(startDate);
  while (current <= endDate) {
    const dateKey = format(current, 'yyyy-MM-dd');
    const laborData = laborByDate.get(dateKey);
    const laborCost = laborData?.totalCost || 0;
    const laborHrs = laborData?.totalHours || 0;
    const workerCount = laborData?.workers.size || 0;
    const materialCost = materialByDate.get(dateKey) || 0;
    const equipmentCost = equipmentByDate.get(dateKey) || 0;
    const subcontractorCost = subcontractorByDate.get(dateKey) || 0;

    const summary: DailyCostSummary = {
      date: new Date(current),
      laborCost,
      materialCost,
      equipmentCost,
      subcontractorCost,
      totalCost: laborCost + materialCost + equipmentCost + subcontractorCost,
      laborHours: laborHrs,
      workerCount,
    };

    dailyBreakdown.push(summary);
    totalLabor += laborCost;
    totalMaterial += materialCost;
    totalEquipment += equipmentCost;
    totalSubcontractor += subcontractorCost;
    totalHours += laborHrs;

    current.setDate(current.getDate() + 1);
  }

  return {
    totalLabor,
    totalMaterial,
    totalEquipment,
    totalSubcontractor,
    grandTotal: totalLabor + totalMaterial + totalEquipment + totalSubcontractor,
    totalHours,
    dailyBreakdown,
  };
}
