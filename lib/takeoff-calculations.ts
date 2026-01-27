/**
 * Utility functions for takeoff calculations
 */

import type { TakeoffLineItem, CategorySummary, TakeoffTotals, CostSummary } from '@/types/takeoff';

/**
 * Calculates total cost, quantity, and item count for a set of takeoff line items
 * 
 * @param items - Array of takeoff line items
 * @returns Object containing total cost, quantity, item count, and breakdown by category
 */
export function calculateTakeoffTotals(items: TakeoffLineItem[]): TakeoffTotals {
  const totals: TakeoffTotals = {
    totalCost: 0,
    totalQuantity: 0,
    itemCount: items.length,
    byCategory: {},
  };

  items.forEach((item) => {
    // Update totals
    totals.totalCost += item.totalCost || 0;
    totals.totalQuantity += item.quantity;

    // Update category totals
    const category = item.category || 'Uncategorized';
    if (!totals.byCategory[category]) {
      totals.byCategory[category] = {
        category,
        itemCount: 0,
        totalCost: 0,
        items: [],
      };
    }

    totals.byCategory[category].itemCount++;
    totals.byCategory[category].totalCost += item.totalCost || 0;
    totals.byCategory[category].items.push(item);
  });

  return totals;
}

/**
 * Calculates cost summary for takeoff items
 * 
 * @param items - Array of takeoff line items
 * @returns Cost summary with totals by category and overall
 */
export function calculateCostSummary(items: TakeoffLineItem[]): CostSummary {
  const byCategory: Record<string, number> = {};
  const byCSI: Record<string, number> = {};
  let totalCost = 0;

  items.forEach((item) => {
    const cost = item.totalCost || 0;
    totalCost += cost;

    // By category
    const category = item.category || 'Uncategorized';
    byCategory[category] = (byCategory[category] || 0) + cost;

    // By CSI (if available in category name)
    const csiMatch = category.match(/^(\d+)\s*-/);
    if (csiMatch) {
      const csiNum = csiMatch[1];
      byCSI[csiNum] = (byCSI[csiNum] || 0) + cost;
    }
  });

  return {
    totalCost,
    byCategory,
    byCSI,
    itemCount: items.length,
  };
}

/**
 * Gets category summaries for a set of items
 * 
 * @param items - Array of takeoff line items
 * @returns Array of category summaries
 */
export function getCategorySummaries(items: TakeoffLineItem[]): CategorySummary[] {
  const categoryMap = new Map<string, CategorySummary>();

  items.forEach((item) => {
    const category = item.category || 'Uncategorized';
    
    if (!categoryMap.has(category)) {
      categoryMap.set(category, {
        category,
        itemCount: 0,
        totalCost: 0,
        items: [],
      });
    }

    const summary = categoryMap.get(category)!;
    summary.itemCount++;
    summary.totalCost += item.totalCost || 0;
    summary.items.push(item);
  });

  return Array.from(categoryMap.values()).sort((a, b) => b.totalCost - a.totalCost);
}

/**
 * Calculates total quantity by unit for a set of items
 * 
 * @param items - Array of takeoff line items
 * @returns Record mapping unit to total quantity
 */
export function getTotalQuantityByUnit(items: TakeoffLineItem[]): Record<string, number> {
  const totals: Record<string, number> = {};

  items.forEach((item) => {
    if (!totals[item.unit]) {
      totals[item.unit] = 0;
    }
    totals[item.unit] += item.quantity;
  });

  return totals;
}

/**
 * Calculates total cost for a set of items
 * 
 * @param items - Array of takeoff line items
 * @returns Total cost
 */
export function getTotalCost(items: TakeoffLineItem[]): number {
  return items.reduce((sum, item) => sum + (item.totalCost || 0), 0);
}
