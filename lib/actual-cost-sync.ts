/**
 * Actual Cost Synchronization Service
 * Manages project actual costs with preference hierarchy:
 * 1. Pay Applications (highest priority - actual billed amounts)
 * 2. Invoices (second priority)
 * 3. Daily Reports / Schedule derived data (fallback)
 */

import { prisma } from './db';

export interface ActualCostSummary {
  source: 'PAY_APPLICATION' | 'INVOICE' | 'DERIVED' | 'NONE';
  totalActualCost: number;
  totalBudget: number;
  percentComplete: number;
  lastUpdated: Date | null;
  byCategory: {
    name: string;
    budget: number;
    actual: number;
    percentComplete: number;
    source: string;
  }[];
  dataQuality: {
    hasPayApps: boolean;
    payAppCount: number;
    latestPayAppDate: Date | null;
    hasInvoices: boolean;
    invoiceCount: number;
    hasDerivedData: boolean;
  };
}

/**
 * Get actual costs for a project with priority:
 * Pay Apps > Invoices > Derived Data
 */
export async function getProjectActualCosts(projectId: string): Promise<ActualCostSummary> {
  // Get pay applications (approved/paid only)
  const payApps = await prisma.paymentApplication.findMany({
    where: {
      projectId,
      status: { in: ['APPROVED', 'PARTIALLY_PAID', 'PAID'] }
    },
    orderBy: { applicationNumber: 'desc' },
    include: {
      items: true
    }
  });

  // Get invoices
  const invoices = await prisma.invoice.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' }
  });

  // Get budget with items
  const budget = await prisma.projectBudget.findFirst({
    where: { projectId },
    include: {
      BudgetItem: true
    }
  });

  const dataQuality = {
    hasPayApps: payApps.length > 0,
    payAppCount: payApps.length,
    latestPayAppDate: payApps[0]?.periodEnd || null,
    hasInvoices: invoices.length > 0,
    invoiceCount: invoices.length,
    hasDerivedData: (budget?.BudgetItem.some(i => i.actualCost && i.actualCost > 0)) || false
  };

  // Priority 1: Use Pay Application data
  if (payApps.length > 0) {
    const latestPayApp = payApps[0];
    const totalBudget = budget?.totalBudget || latestPayApp.scheduledValue;
    
    // Build category breakdown from pay app items
    const byCategory = latestPayApp.items.map(item => ({
      name: item.description,
      budget: item.scheduledValue,
      actual: item.totalCompleted,
      percentComplete: item.percentComplete,
      source: 'PAY_APPLICATION'
    }));

    return {
      source: 'PAY_APPLICATION',
      totalActualCost: latestPayApp.totalCompleted,
      totalBudget,
      percentComplete: totalBudget > 0 ? (latestPayApp.totalCompleted / totalBudget) * 100 : 0,
      lastUpdated: latestPayApp.periodEnd,
      byCategory,
      dataQuality
    };
  }

  // Priority 2: Use Invoice data
  if (invoices.length > 0) {
    const totalActual = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalBudget = budget?.totalBudget || 0;

    return {
      source: 'INVOICE',
      totalActualCost: totalActual,
      totalBudget,
      percentComplete: totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0,
      lastUpdated: invoices[0]?.createdAt || null,
      byCategory: [],
      dataQuality
    };
  }

  // Priority 3: Use derived data from budget items
  if (budget && budget.BudgetItem.length > 0) {
    const totalActual = budget.BudgetItem.reduce((sum, item) => sum + (item.actualCost || 0), 0);
    const totalBudget = budget.totalBudget || budget.BudgetItem.reduce((sum, item) => sum + (item.budgetedAmount || 0), 0);

    const byCategory = budget.BudgetItem
      .filter(item => item.actualCost && item.actualCost > 0)
      .map(item => ({
        name: item.name,
        budget: item.budgetedAmount,
        actual: item.actualCost || 0,
        percentComplete: item.budgetedAmount > 0 ? ((item.actualCost || 0) / item.budgetedAmount) * 100 : 0,
        source: 'DERIVED'
      }));

    return {
      source: 'DERIVED',
      totalActualCost: totalActual,
      totalBudget,
      percentComplete: totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0,
      lastUpdated: budget.updatedAt || null,
      byCategory,
      dataQuality
    };
  }

  // No data available
  return {
    source: 'NONE',
    totalActualCost: 0,
    totalBudget: budget?.totalBudget || 0,
    percentComplete: 0,
    lastUpdated: null,
    byCategory: [],
    dataQuality
  };
}

/**
 * Sync budget item actuals from the latest pay application
 */
export async function syncBudgetFromPayApp(
  projectId: string,
  payAppId?: string
): Promise<{ updated: number; skipped: number }> {
  // Get the pay app (latest approved if not specified)
  const payApp = payAppId 
    ? await prisma.paymentApplication.findUnique({
        where: { id: payAppId },
        include: { items: true }
      })
    : await prisma.paymentApplication.findFirst({
        where: {
          projectId,
          status: { in: ['APPROVED', 'PARTIALLY_PAID', 'PAID'] }
        },
        orderBy: { applicationNumber: 'desc' },
        include: { items: true }
      });

  if (!payApp) {
    return { updated: 0, skipped: 0 };
  }

  // Separate items with budgetItemId from those without
  const itemsToUpdate = payApp.items.filter(item => item.budgetItemId);
  const skipped = payApp.items.length - itemsToUpdate.length;

  // Batch update using transaction instead of N individual queries
  if (itemsToUpdate.length > 0) {
    await prisma.$transaction(
      itemsToUpdate.map(item =>
        prisma.budgetItem.update({
          where: { id: item.budgetItemId! },
          data: {
            actualCost: item.totalCompleted,
            billedToDate: item.totalCompleted,
          },
        })
      )
    );
  }

  return { updated: itemsToUpdate.length, skipped };
}

/**
 * Get data source breakdown for cost display
 */
export async function getCostDataSources(projectId: string) {
  const sources = await prisma.projectDataSource.findMany({
    where: {
      projectId,
      featureType: 'budget'
    },
    orderBy: { extractedAt: 'desc' }
  });

  const payAppSource = sources.find(s => s.sourceType === 'payment_application');
  const scheduleSource = sources.find(s => s.sourceType === 'schedule' || s.sourceType === 'daily_report');
  const manualSource = sources.find(s => s.sourceType === 'manual');

  return {
    primary: payAppSource ? 'PAY_APPLICATION' : 
             scheduleSource ? 'DERIVED' : 
             manualSource ? 'MANUAL' : 'NONE',
    sources: sources.map(s => ({
      sourceType: s.sourceType,
      confidence: s.confidence,
      extractedAt: s.extractedAt,
      metadata: s.metadata
    }))
  };
}
