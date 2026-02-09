/**
 * Change Order Budget Service
 * Propagates approved change orders to budget items, forecasts, and cash flow
 */

import { prisma } from './db';
import { logger } from './logger';

interface BudgetImpact {
  budgetItemId: string;
  budgetItemName: string;
  costCode: string | null;
  currentBudget: number;
  currentCommitted: number;
  changeAmount: number;
  newBudget: number;
  newCommitted: number;
  variancePercent: number;
}

interface ProjectBudgetImpact {
  currentTotalBudget: number;
  currentCommittedCost: number;
  changeOrderAmount: number;
  newTotalBudget: number;
  newCommittedCost: number;
  contingencyUsed: number;
  contingencyRemaining: number;
  useContingency: boolean;
}

interface ChangeOrderImpactPreview {
  changeOrder: {
    id: string;
    coNumber: string;
    title: string;
    originalAmount: number;
    approvedAmount: number | null;
  };
  budgetImpacts: BudgetImpact[];
  projectBudgetImpact: ProjectBudgetImpact;
  scheduleImpact: {
    daysAdded: number;
    originalCompletion: Date | null;
    newCompletion: Date | null;
  };
  cashFlowImpact: {
    monthsAffected: string[];
    additionalPerMonth: number;
  };
  warnings: string[];
}

/**
 * Preview the budget impact before approving a change order
 */
export async function previewChangeOrderImpact(
  projectId: string,
  changeOrderId: string,
  approvedAmount?: number
): Promise<ChangeOrderImpactPreview | null> {
  try {
    // Get the change order with contract details
    const changeOrder = await prisma.contractChangeOrder.findFirst({
      where: { id: changeOrderId, projectId },
      include: {
        contract: {
          include: {
            subcontractor: true
          }
        }
      }
    });

    if (!changeOrder) return null;

    const amount = approvedAmount ?? changeOrder.originalAmount;
    const warnings: string[] = [];

    // Get project budget
    const projectBudget = await prisma.projectBudget.findUnique({
      where: { projectId },
      include: {
        BudgetItem: true
      }
    });

    if (!projectBudget) {
      warnings.push('No project budget found - change order will not be linked to budget items');
    }

    // Find linked budget items by trade type
    let linkedBudgetItems: any[] = [];
    if (projectBudget && changeOrder.contract.subcontractor?.tradeType) {
      linkedBudgetItems = projectBudget.BudgetItem.filter(item =>
        item.tradeType === changeOrder.contract.subcontractor?.tradeType
      );
    }

    // Calculate budget impacts
    const budgetImpacts: BudgetImpact[] = linkedBudgetItems.map(item => {
      const newRevisedBudget = (item.revisedBudget ?? item.budgetedAmount) + amount;
      const newCommitted = item.committedCost + amount;
      return {
        budgetItemId: item.id,
        budgetItemName: item.name,
        costCode: item.costCode,
        currentBudget: item.revisedBudget ?? item.budgetedAmount,
        currentCommitted: item.committedCost,
        changeAmount: amount,
        newBudget: newRevisedBudget,
        newCommitted: newCommitted,
        variancePercent: item.budgetedAmount > 0 
          ? ((newRevisedBudget - item.budgetedAmount) / item.budgetedAmount) * 100 
          : 0
      };
    });

    // If no budget items found, add a warning
    if (budgetImpacts.length === 0) {
      warnings.push('No matching budget items found - recommend creating/linking a budget line item');
    }

    // Calculate project budget impact
    const currentTotal = projectBudget?.totalBudget ?? 0;
    const currentContingency = projectBudget?.contingency ?? 0;
    const currentCommitted = projectBudget?.committedCost ?? 0;

    // Determine if contingency should be used
    const useContingency = amount > 0 && currentContingency >= amount;
    const contingencyUsed = useContingency ? amount : 0;
    const contingencyRemaining = currentContingency - contingencyUsed;

    if (amount > currentContingency && currentContingency > 0) {
      warnings.push(`Change order exceeds contingency by $${(amount - currentContingency).toLocaleString()}`);
    }

    const projectBudgetImpact: ProjectBudgetImpact = {
      currentTotalBudget: currentTotal,
      currentCommittedCost: currentCommitted,
      changeOrderAmount: amount,
      newTotalBudget: useContingency ? currentTotal : currentTotal + amount,
      newCommittedCost: currentCommitted + amount,
      contingencyUsed,
      contingencyRemaining,
      useContingency
    };

    // Schedule impact
    const scheduleImpact = {
      daysAdded: changeOrder.daysAdded,
      originalCompletion: changeOrder.contract.completionDate,
      newCompletion: changeOrder.daysAdded > 0
        ? new Date(new Date(changeOrder.contract.completionDate).getTime() + changeOrder.daysAdded * 24 * 60 * 60 * 1000)
        : changeOrder.contract.completionDate
    };

    if (changeOrder.daysAdded > 0) {
      warnings.push(`Schedule will be extended by ${changeOrder.daysAdded} days`);
    }

    // Cash flow impact - distribute over remaining months
    const today = new Date();
    const completion = scheduleImpact.newCompletion || changeOrder.contract.completionDate;
    const monthsRemaining = Math.max(1, Math.ceil(
      (completion.getTime() - today.getTime()) / (30 * 24 * 60 * 60 * 1000)
    ));
    const additionalPerMonth = amount / monthsRemaining;

    const monthsAffected: string[] = [];
    for (let i = 0; i < monthsRemaining; i++) {
      const month = new Date(today);
      month.setMonth(month.getMonth() + i);
      monthsAffected.push(month.toISOString().slice(0, 7)); // YYYY-MM format
    }

    return {
      changeOrder: {
        id: changeOrder.id,
        coNumber: changeOrder.coNumber,
        title: changeOrder.title,
        originalAmount: changeOrder.originalAmount,
        approvedAmount: approvedAmount ?? null
      },
      budgetImpacts,
      projectBudgetImpact,
      scheduleImpact,
      cashFlowImpact: {
        monthsAffected,
        additionalPerMonth
      },
      warnings
    };
  } catch (error) {
    logger.error('CHANGE_ORDER', 'Impact preview error', error as Error);
    return null;
  }
}

/**
 * Apply approved change order to budget
 */
export async function applyChangeOrderToBudget(
  projectId: string,
  changeOrderId: string,
  approvedAmount: number,
  options: {
    useContingency?: boolean;
    allocateToBudgetItems?: string[]; // Specific budget item IDs to update
    createIfMissing?: boolean; // Create a new budget item if none linked
  } = {}
): Promise<{
  success: boolean;
  budgetItemsUpdated: number;
  projectBudgetUpdated: boolean;
  cashFlowsUpdated: number;
  newBudgetItemId?: string;
  error?: string;
}> {
  try {
    const { useContingency = true, allocateToBudgetItems, createIfMissing = true } = options;

    // Get change order with contract
    const changeOrder = await prisma.contractChangeOrder.findFirst({
      where: { id: changeOrderId, projectId },
      include: {
        contract: {
          include: { subcontractor: true }
        }
      }
    });

    if (!changeOrder) {
      return { success: false, budgetItemsUpdated: 0, projectBudgetUpdated: false, cashFlowsUpdated: 0, error: 'Change order not found' };
    }

    // Get project budget
    const projectBudget = await prisma.projectBudget.findUnique({
      where: { projectId },
      include: { BudgetItem: true }
    });

    if (!projectBudget) {
      return { success: false, budgetItemsUpdated: 0, projectBudgetUpdated: false, cashFlowsUpdated: 0, error: 'Project budget not found' };
    }

    let budgetItemsToUpdate: string[] = [];
    let newBudgetItemId: string | undefined;

    // Determine which budget items to update
    if (allocateToBudgetItems?.length) {
      budgetItemsToUpdate = allocateToBudgetItems;
    } else {
      // Try to find by trade type
      const matchingItems = projectBudget.BudgetItem.filter(item =>
        item.tradeType === changeOrder.contract.subcontractor?.tradeType
      );
      budgetItemsToUpdate = matchingItems.map(i => i.id);
    }

    // If no matching items and createIfMissing is true, create one
    if (budgetItemsToUpdate.length === 0 && createIfMissing) {
      const newItem = await prisma.budgetItem.create({
        data: {
          budgetId: projectBudget.id,
          name: `CO: ${changeOrder.contract.title}`,
          description: `Budget line for change orders on ${changeOrder.contract.contractNumber}`,
          costCode: `CO-${changeOrder.contract.contractNumber}`,
          tradeType: (changeOrder.contract.subcontractor?.tradeType as any) || undefined,
          budgetedAmount: approvedAmount,
          revisedBudget: approvedAmount,
          committedCost: approvedAmount
        }
      });
      newBudgetItemId = newItem.id;
      budgetItemsToUpdate = [newItem.id];
    }

    // Update budget items (split evenly if multiple)
    const amountPerItem = approvedAmount / Math.max(1, budgetItemsToUpdate.length);
    let budgetItemsUpdated = 0;

    for (const itemId of budgetItemsToUpdate) {
      const item = projectBudget.BudgetItem.find(i => i.id === itemId);
      if (item) {
        await prisma.budgetItem.update({
          where: { id: itemId },
          data: {
            revisedBudget: (item.revisedBudget ?? item.budgetedAmount) + amountPerItem,
            committedCost: item.committedCost + amountPerItem
          }
        });
        budgetItemsUpdated++;
      }
    }

    // Update project budget
    const contingencyToUse = useContingency ? Math.min(approvedAmount, projectBudget.contingency) : 0;
    const budgetIncrease = approvedAmount - contingencyToUse;

    await prisma.projectBudget.update({
      where: { id: projectBudget.id },
      data: {
        totalBudget: projectBudget.totalBudget + budgetIncrease,
        committedCost: projectBudget.committedCost + approvedAmount,
        contingency: projectBudget.contingency - contingencyToUse,
        lastUpdated: new Date()
      }
    });

    // Update cash flow forecasts - using correct schema field names
    const today = new Date();
    const completion = changeOrder.contract.completionDate;
    const monthsRemaining = Math.max(1, Math.ceil(
      (completion.getTime() - today.getTime()) / (30 * 24 * 60 * 60 * 1000)
    ));
    const additionalPerMonth = approvedAmount / monthsRemaining;

    let cashFlowsUpdated = 0;
    for (let i = 0; i < monthsRemaining; i++) {
      const periodDate = new Date(today);
      periodDate.setMonth(periodDate.getMonth() + i);
      periodDate.setDate(1); // First of month

      // Try to find existing forecast
      const existingForecast = await prisma.cashFlowForecast.findFirst({
        where: {
          projectId,
          periodDate: {
            gte: new Date(periodDate.getFullYear(), periodDate.getMonth(), 1),
            lt: new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 1)
          }
        }
      });

      if (existingForecast) {
        await prisma.cashFlowForecast.update({
          where: { id: existingForecast.id },
          data: {
            forecastOutflow: existingForecast.forecastOutflow + additionalPerMonth,
            notes: `${existingForecast.notes || ''} [+$${additionalPerMonth.toLocaleString()} from CO ${changeOrder.coNumber}]`
          }
        });
        cashFlowsUpdated++;
      } else {
        // Create new forecast entry
        await prisma.cashFlowForecast.create({
          data: {
            projectId,
            periodDate,
            forecastOutflow: additionalPerMonth,
            forecastInflow: 0,
            notes: `CO ${changeOrder.coNumber}: +$${additionalPerMonth.toLocaleString()}`
          }
        });
        cashFlowsUpdated++;
      }
    }

    // Create a change order record in the legacy ChangeOrder table for reporting
    try {
      await prisma.changeOrder.create({
        data: {
          projectId,
          budgetItemId: budgetItemsToUpdate[0] || null,
          orderNumber: changeOrder.coNumber,
          title: changeOrder.title,
          description: changeOrder.description,
          status: 'APPROVED',
          originalAmount: changeOrder.originalAmount,
          proposedAmount: changeOrder.originalAmount,
          approvedAmount: approvedAmount,
          scheduleImpactDays: changeOrder.daysAdded,
          submittedDate: changeOrder.submittedAt || new Date(),
          approvedDate: new Date(),
          approvedBy: changeOrder.approvedBy
        }
      });
    } catch (e) {
      // Non-critical - legacy table sync
      logger.warn('CHANGE_ORDER', 'Legacy ChangeOrder sync skipped', { error: e instanceof Error ? e.message : String(e) });
    }

    return {
      success: true,
      budgetItemsUpdated,
      projectBudgetUpdated: true,
      cashFlowsUpdated,
      newBudgetItemId
    };
  } catch (error) {
    logger.error('CHANGE_ORDER', 'Error applying change order to budget', error as Error);
    return {
      success: false,
      budgetItemsUpdated: 0,
      projectBudgetUpdated: false,
      cashFlowsUpdated: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Recalculate all budget totals from change orders
 */
export async function recalculateBudgetFromChangeOrders(projectId: string): Promise<{
  totalChangeOrderValue: number;
  approvedCount: number;
  pendingCount: number;
  pendingValue: number;
}> {
  try {
    // Get all contract change orders
    const changeOrders = await prisma.contractChangeOrder.findMany({
      where: { projectId }
    });

    const approved = changeOrders.filter(co => co.status === 'APPROVED');
    const pending = changeOrders.filter(co => ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW'].includes(co.status));

    const totalChangeOrderValue = approved.reduce(
      (sum, co) => sum + (co.approvedAmount ?? co.originalAmount),
      0
    );

    const pendingValue = pending.reduce(
      (sum, co) => sum + co.originalAmount,
      0
    );

    return {
      totalChangeOrderValue,
      approvedCount: approved.length,
      pendingCount: pending.length,
      pendingValue
    };
  } catch (error) {
    logger.error('CHANGE_ORDER', 'Error recalculating budget from change orders', error as Error);
    return {
      totalChangeOrderValue: 0,
      approvedCount: 0,
      pendingCount: 0,
      pendingValue: 0
    };
  }
}

/**
 * Get budget summary with change order breakdown
 */
export async function getBudgetWithChangeOrders(projectId: string) {
  try {
    const projectBudget = await prisma.projectBudget.findUnique({
      where: { projectId },
      include: {
        BudgetItem: {
          include: {
            ChangeOrder: true
          }
        }
      }
    });

    if (!projectBudget) return null;

    const coStats = await recalculateBudgetFromChangeOrders(projectId);

    return {
      ...projectBudget,
      changeOrderSummary: coStats,
      originalBudget: projectBudget.totalBudget - coStats.totalChangeOrderValue,
      variance: coStats.totalChangeOrderValue,
      variancePercent: coStats.totalChangeOrderValue / (projectBudget.totalBudget - coStats.totalChangeOrderValue) * 100
    };
  } catch (error) {
    logger.error('CHANGE_ORDER', 'Error getting budget with change orders', error as Error);
    return null;
  }
}
