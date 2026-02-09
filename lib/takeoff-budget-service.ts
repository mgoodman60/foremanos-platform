/**
 * Takeoff-Budget Integration Service
 * 
 * Connects material takeoffs with the budget management system.
 * Enables:
 * - Converting takeoff items to budget line items
 * - Syncing costs from takeoffs to budget
 * - Variance tracking between estimates and actuals
 * - Budget category mapping
 */

import { prisma } from './db';
import { TAKEOFF_CATEGORIES } from './takeoff-categories';
import { getUnitPrice } from './cost-calculation-service';
import { logger } from './logger';

// Map takeoff categories to CSI budget divisions
export const CATEGORY_TO_DIVISION: Record<string, { division: string; costCode: string; tradeType: string }> = {
  'concrete': { division: '03', costCode: '03 00 00', tradeType: 'CONCRETE' },
  'rebar': { division: '03', costCode: '03 20 00', tradeType: 'CONCRETE' },
  'masonry': { division: '04', costCode: '04 00 00', tradeType: 'MASONRY' },
  'steel': { division: '05', costCode: '05 00 00', tradeType: 'STRUCTURAL_STEEL' },
  'lumber': { division: '06', costCode: '06 00 00', tradeType: 'CARPENTRY' },
  'doors': { division: '08', costCode: '08 10 00', tradeType: 'DOORS_WINDOWS' },
  'windows': { division: '08', costCode: '08 50 00', tradeType: 'DOORS_WINDOWS' },
  'finishes': { division: '09', costCode: '09 00 00', tradeType: 'FINISHES' },
  'drywall': { division: '09', costCode: '09 20 00', tradeType: 'DRYWALL' },
  'flooring': { division: '09', costCode: '09 60 00', tradeType: 'FLOORING' },
  'plumbing': { division: '22', costCode: '22 00 00', tradeType: 'PLUMBING' },
  'hvac': { division: '23', costCode: '23 00 00', tradeType: 'HVAC' },
  'electrical': { division: '26', costCode: '26 00 00', tradeType: 'ELECTRICAL' },
  'fire-protection': { division: '21', costCode: '21 00 00', tradeType: 'FIRE_PROTECTION' },
  'roofing': { division: '07', costCode: '07 50 00', tradeType: 'ROOFING' },
  'insulation': { division: '07', costCode: '07 20 00', tradeType: 'INSULATION' },
  'sitework': { division: '31', costCode: '31 00 00', tradeType: 'SITEWORK' },
};

export interface TakeoffToBudgetItem {
  takeoffLineItemId: string;
  category: string;
  itemName: string;
  description?: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  laborCost: number;
  materialCost: number;
  wasteFactor: number;
  costCode: string;
  tradeType: string;
}

export interface BudgetSyncResult {
  success: boolean;
  budgetItemsCreated: number;
  budgetItemsUpdated: number;
  totalMaterialCost: number;
  totalLaborCost: number;
  totalCost: number;
  errors: string[];
  itemDetails: Array<{
    lineItemId: string;
    budgetItemId: string;
    action: 'created' | 'updated' | 'skipped';
    reason?: string;
  }>;
}

export interface VarianceReport {
  takeoffId: string;
  budgetId: string;
  totalTakeoffEstimate: number;
  totalBudgetedAmount: number;
  variance: number;
  variancePercent: number;
  items: Array<{
    category: string;
    itemName: string;
    takeoffEstimate: number;
    budgetedAmount: number;
    actualCost: number;
    variance: number;
    variancePercent: number;
    status: 'under' | 'over' | 'on-track';
  }>;
  categoryVariance: Record<string, {
    takeoffTotal: number;
    budgetTotal: number;
    actualTotal: number;
    variance: number;
  }>;
}

/**
 * Prepare takeoff items for budget conversion
 */
export async function prepareTakeoffForBudget(
  takeoffId: string,
  region: string = 'default'
): Promise<TakeoffToBudgetItem[]> {
  const takeoff = await prisma.materialTakeoff.findUnique({
    where: { id: takeoffId },
    include: {
      TakeoffLineItem: true,
      Project: true,
    },
  });

  if (!takeoff) {
    throw new Error(`Takeoff ${takeoffId} not found`);
  }

  const budgetItems: TakeoffToBudgetItem[] = [];

  for (const lineItem of takeoff.TakeoffLineItem) {
    // Get category mapping
    const categoryKey = lineItem.category.toLowerCase().replace(/\s+/g, '-');
    const categoryMapping = CATEGORY_TO_DIVISION[categoryKey] || {
      division: '00',
      costCode: '00 00 00',
      tradeType: 'GENERAL',
    };

    // Get unit price
    const pricing = await getUnitPrice(
      takeoff.projectId,
      lineItem.category,
      lineItem.itemName,
      lineItem.unit,
      region
    );

    // Get waste factor from category config
    const categoryConfig = TAKEOFF_CATEGORIES.find(c => c.id === categoryKey);
    // Get waste factor percent from first subcategory or default to 5%
    const wasteFactorPercent = categoryConfig?.subCategories?.[0]?.wasteFactorPercent || 5;
    const wasteFactor = 1 + (wasteFactorPercent / 100);

    // Calculate costs with null safety
    const unitCost = pricing?.unitCost || lineItem.unitCost || 0;
    const laborRate = pricing?.laborRate || 0;
    const adjustedQuantity = lineItem.quantity * wasteFactor;
    const materialCost = adjustedQuantity * unitCost;
    // Estimate labor hours based on quantity (simplified calculation)
    const laborHoursPerUnit = 0.1; // Default labor hours per unit
    const laborHours = adjustedQuantity * laborHoursPerUnit;
    const laborCost = laborHours * laborRate;
    const totalCost = materialCost + laborCost;

    budgetItems.push({
      takeoffLineItemId: lineItem.id,
      category: lineItem.category,
      itemName: lineItem.itemName,
      description: lineItem.description || undefined,
      quantity: adjustedQuantity,
      unit: lineItem.unit,
      unitCost,
      totalCost,
      laborCost,
      materialCost,
      wasteFactor,
      costCode: categoryMapping.costCode,
      tradeType: categoryMapping.tradeType,
    });
  }

  return budgetItems;
}

/**
 * Sync takeoff to project budget
 * Creates or updates budget line items from takeoff data
 */
export async function syncTakeoffToBudget(
  takeoffId: string,
  budgetId: string,
  options: {
    overwriteExisting?: boolean;
    region?: string;
    linkItems?: boolean;
  } = {}
): Promise<BudgetSyncResult> {
  const { overwriteExisting = false, region = 'default', linkItems = true } = options;

  const result: BudgetSyncResult = {
    success: false,
    budgetItemsCreated: 0,
    budgetItemsUpdated: 0,
    totalMaterialCost: 0,
    totalLaborCost: 0,
    totalCost: 0,
    errors: [],
    itemDetails: [],
  };

  try {
    // Verify budget exists
    const budget = await prisma.projectBudget.findUnique({
      where: { id: budgetId },
      include: { BudgetItem: true },
    });

    if (!budget) {
      result.errors.push(`Budget ${budgetId} not found`);
      return result;
    }

    // Prepare takeoff items
    const takeoffItems = await prepareTakeoffForBudget(takeoffId, region);

    // Create a map of existing budget items by cost code and name
    const existingItemsMap = new Map<string, typeof budget.BudgetItem[0]>();
    for (const item of budget.BudgetItem) {
      const key = `${item.costCode || ''}-${item.name}`.toLowerCase();
      existingItemsMap.set(key, item);
    }

    // Process each takeoff item
    for (const item of takeoffItems) {
      const itemKey = `${item.costCode}-${item.itemName}`.toLowerCase();
      const existingItem = existingItemsMap.get(itemKey);

      result.totalMaterialCost += item.materialCost;
      result.totalLaborCost += item.laborCost;
      result.totalCost += item.totalCost;

      if (existingItem) {
        // Update existing item
        if (overwriteExisting) {
          await prisma.budgetItem.update({
            where: { id: existingItem.id },
            data: {
              budgetedAmount: item.totalCost,
              description: item.description || existingItem.description,
            },
          });

          result.budgetItemsUpdated++;
          result.itemDetails.push({
            lineItemId: item.takeoffLineItemId,
            budgetItemId: existingItem.id,
            action: 'updated',
          });
        } else {
          result.itemDetails.push({
            lineItemId: item.takeoffLineItemId,
            budgetItemId: existingItem.id,
            action: 'skipped',
            reason: 'Item exists and overwrite disabled',
          });
        }
      } else {
        // Create new budget item
        const newItem = await prisma.budgetItem.create({
          data: {
            budgetId,
            name: item.itemName,
            description: `${item.description || ''} (from takeoff: ${item.quantity.toFixed(2)} ${item.unit})`.trim(),
            costCode: item.costCode,
            tradeType: item.tradeType as any,
            budgetedAmount: item.totalCost,
            actualCost: 0,
            committedCost: 0,
            isActive: true,
          },
        });

        result.budgetItemsCreated++;
        result.itemDetails.push({
          lineItemId: item.takeoffLineItemId,
          budgetItemId: newItem.id,
          action: 'created',
        });
      }

      // Link takeoff line item to budget item if enabled
      if (linkItems) {
        const budgetItemId = existingItem?.id || result.itemDetails.slice(-1)[0]?.budgetItemId;
        if (budgetItemId) {
          await prisma.takeoffLineItem.update({
            where: { id: item.takeoffLineItemId },
            data: {
              // Store link in notes or a custom field
              notes: `Linked to budget item: ${budgetItemId}`,
            },
          });
        }
      }
    }

    // Update takeoff with total cost
    await prisma.materialTakeoff.update({
      where: { id: takeoffId },
      data: {
        totalCost: result.totalCost,
      },
    });

    result.success = true;
  } catch (error) {
    logger.error('TAKEOFF_BUDGET', 'Takeoff-budget sync error', error as Error);
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return result;
}

/**
 * Generate variance report between takeoff estimates and budget
 */
export async function generateVarianceReport(
  takeoffId: string,
  budgetId: string
): Promise<VarianceReport> {
  const takeoff = await prisma.materialTakeoff.findUnique({
    where: { id: takeoffId },
    include: { TakeoffLineItem: true },
  });

  const budget = await prisma.projectBudget.findUnique({
    where: { id: budgetId },
    include: { BudgetItem: true },
  });

  if (!takeoff || !budget) {
    throw new Error('Takeoff or budget not found');
  }

  const report: VarianceReport = {
    takeoffId,
    budgetId,
    totalTakeoffEstimate: takeoff.totalCost || 0,
    totalBudgetedAmount: 0,
    variance: 0,
    variancePercent: 0,
    items: [],
    categoryVariance: {},
  };

  // Calculate total budgeted amount
  report.totalBudgetedAmount = budget.BudgetItem.reduce((sum, item) => sum + item.budgetedAmount, 0);
  report.variance = report.totalTakeoffEstimate - report.totalBudgetedAmount;
  report.variancePercent = report.totalBudgetedAmount > 0
    ? (report.variance / report.totalBudgetedAmount) * 100
    : 0;

  // Match takeoff items to budget items and calculate variance
  for (const lineItem of takeoff.TakeoffLineItem) {
    const estimatedCost = lineItem.totalCost || 0;
    
    // Find matching budget item
    const matchingBudgetItem = budget.BudgetItem.find(bi => 
      bi.name.toLowerCase().includes(lineItem.itemName.toLowerCase()) ||
      lineItem.itemName.toLowerCase().includes(bi.name.toLowerCase())
    );

    const budgetedAmount = matchingBudgetItem?.budgetedAmount || 0;
    const actualCost = matchingBudgetItem?.actualCost || 0;
    const variance = estimatedCost - budgetedAmount;
    const variancePercent = budgetedAmount > 0 ? (variance / budgetedAmount) * 100 : 0;

    let status: 'under' | 'over' | 'on-track' = 'on-track';
    if (variancePercent > 5) status = 'over';
    else if (variancePercent < -5) status = 'under';

    report.items.push({
      category: lineItem.category,
      itemName: lineItem.itemName,
      takeoffEstimate: estimatedCost,
      budgetedAmount,
      actualCost,
      variance,
      variancePercent,
      status,
    });

    // Aggregate by category
    if (!report.categoryVariance[lineItem.category]) {
      report.categoryVariance[lineItem.category] = {
        takeoffTotal: 0,
        budgetTotal: 0,
        actualTotal: 0,
        variance: 0,
      };
    }
    report.categoryVariance[lineItem.category].takeoffTotal += estimatedCost;
    report.categoryVariance[lineItem.category].budgetTotal += budgetedAmount;
    report.categoryVariance[lineItem.category].actualTotal += actualCost;
    report.categoryVariance[lineItem.category].variance += variance;
  }

  return report;
}

/**
 * Get budget summary from takeoff
 */
export async function getTakeoffBudgetSummary(takeoffId: string, region: string = 'default') {
  const items = await prepareTakeoffForBudget(takeoffId, region);

  // Group by trade/division
  const byTrade: Record<string, {
    items: TakeoffToBudgetItem[];
    materialTotal: number;
    laborTotal: number;
    total: number;
  }> = {};

  for (const item of items) {
    if (!byTrade[item.tradeType]) {
      byTrade[item.tradeType] = {
        items: [],
        materialTotal: 0,
        laborTotal: 0,
        total: 0,
      };
    }
    byTrade[item.tradeType].items.push(item);
    byTrade[item.tradeType].materialTotal += item.materialCost;
    byTrade[item.tradeType].laborTotal += item.laborCost;
    byTrade[item.tradeType].total += item.totalCost;
  }

  const totalMaterial = items.reduce((sum, i) => sum + i.materialCost, 0);
  const totalLabor = items.reduce((sum, i) => sum + i.laborCost, 0);
  const grandTotal = totalMaterial + totalLabor;

  return {
    takeoffId,
    itemCount: items.length,
    byTrade,
    totals: {
      material: totalMaterial,
      labor: totalLabor,
      total: grandTotal,
    },
    csiDivisionBreakdown: items.reduce((acc, item) => {
      const division = item.costCode.split(' ')[0];
      if (!acc[division]) acc[division] = 0;
      acc[division] += item.totalCost;
      return acc;
    }, {} as Record<string, number>),
  };
}

/**
 * Auto-create or update budget from takeoff
 * Since ProjectBudget uses projectId as unique, this creates or updates
 */
export async function createBudgetFromTakeoff(
  takeoffId: string,
  projectId: string,
  _budgetName: string, // Not used since ProjectBudget doesn't have name field
  options: {
    region?: string;
    contingencyPercent?: number;
    includeLabor?: boolean;
  } = {}
): Promise<{ budgetId: string; syncResult: BudgetSyncResult }> {
  const { region = 'default', contingencyPercent = 10 } = options;

  // Get takeoff summary to calculate total
  const summary = await getTakeoffBudgetSummary(takeoffId, region);

  // Check if budget already exists for this project
  const existingBudget = await prisma.projectBudget.findUnique({
    where: { projectId },
  });

  let budget;
  if (existingBudget) {
    // Update existing budget
    budget = await prisma.projectBudget.update({
      where: { id: existingBudget.id },
      data: {
        totalBudget: summary.totals.total * (1 + contingencyPercent / 100),
        contingency: summary.totals.total * (contingencyPercent / 100),
        lastUpdated: new Date(),
      },
    });
  } else {
    // Create new project budget
    budget = await prisma.projectBudget.create({
      data: {
        projectId,
        totalBudget: summary.totals.total * (1 + contingencyPercent / 100),
        contingency: summary.totals.total * (contingencyPercent / 100),
        baselineDate: new Date(),
      },
    });
  }

  // Sync takeoff items to the budget
  const syncResult = await syncTakeoffToBudget(takeoffId, budget.id, {
    overwriteExisting: true,
    region,
    linkItems: true,
  });

  return {
    budgetId: budget.id,
    syncResult,
  };
}

/**
 * Update budget from takeoff changes
 */
export async function updateBudgetFromTakeoff(
  takeoffId: string,
  budgetId: string,
  options: {
    region?: string;
    updateMode: 'add-new' | 'sync-all' | 'update-quantities';
  } = { updateMode: 'add-new' }
): Promise<BudgetSyncResult> {
  const { region = 'default', updateMode } = options;

  return syncTakeoffToBudget(takeoffId, budgetId, {
    overwriteExisting: updateMode === 'sync-all' || updateMode === 'update-quantities',
    region,
    linkItems: true,
  });
}
