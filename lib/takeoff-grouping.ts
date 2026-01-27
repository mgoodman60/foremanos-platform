/**
 * Utility functions for grouping takeoff items by CSI divisions and categories
 */

import { CSI_DIVISIONS, type CSIDivision } from '@/lib/csi-divisions';
import type { TakeoffLineItem, CategorySummary, BudgetItem, CSIDivisionSummary } from '@/types/takeoff';

/**
 * Maps budget phase code (100, 200, etc.) to CSI division number (1, 2, etc.)
 * 
 * @param phaseCode - Budget phase code
 * @returns CSI division number
 */
export function budgetPhaseToCSI(phaseCode: number | null | undefined): number {
  if (!phaseCode) return 1;
  return Math.floor(phaseCode / 100);
}

/**
 * Gets CSI division for a category name
 * 
 * @param category - Category name to match
 * @returns CSI division or undefined
 */
export function getCSIDivisionForCategory(category: string): CSIDivision | undefined {
  const categoryLower = category.toLowerCase();
  
  // Skip generic "01 - General Requirements" - we'll handle items individually
  if (categoryLower === '01 - general requirements' || categoryLower === 'general requirements') {
    return CSI_DIVISIONS.find(d => d.number === 1);
  }
  
  // Check against keyword map (simplified - full implementation in component)
  // This is a basic version - the full keyword mapping is in the component
  // and should be extracted here for complete functionality
  
  return undefined;
}

/**
 * Gets CSI division for a specific item based on item name, description, and category
 * 
 * @param item - Takeoff line item
 * @param keywordMap - Optional keyword mapping (can be passed from component)
 * @returns CSI division or undefined
 */
export function getCSIDivisionForItem(
  item: TakeoffLineItem,
  keywordMap?: Array<{ keywords: string[]; division: number }>
): CSIDivision | undefined {
  const itemNameLower = (item.itemName || '').toLowerCase();
  const descLower = (item.description || '').toLowerCase();
  const categoryLower = (item.category || '').toLowerCase();
  
  // Combine for comprehensive matching
  const combined = `${itemNameLower} ${descLower} ${categoryLower}`;
  
  // If keyword map provided, use it
  if (keywordMap) {
    for (const mapping of keywordMap) {
      for (const keyword of mapping.keywords) {
        if (combined.includes(keyword)) {
          return CSI_DIVISIONS.find(d => d.number === mapping.division);
        }
      }
    }
  }
  
  // Fallback: check category directly
  const categoryMatch = getCSIDivisionForCategory(item.category);
  if (categoryMatch) {
    return categoryMatch;
  }
  
  // Default to General Requirements if nothing matches
  return CSI_DIVISIONS.find(d => d.number === 1);
}

/**
 * Converts a budget item to a virtual takeoff line item
 * 
 * @param budgetItem - Budget item to convert
 * @returns Takeoff line item
 */
export function budgetItemToTakeoffItem(budgetItem: BudgetItem): TakeoffLineItem {
  return {
    id: `budget-${budgetItem.id}`,
    category: budgetItem.phaseName || 'Budget Item',
    itemName: budgetItem.name,
    description: budgetItem.description || '',
    quantity: 1,
    unit: 'LS',
    unitCost: budgetItem.budgetedAmount || 0,
    totalCost: budgetItem.budgetedAmount || 0,
    location: budgetItem.costCode || undefined,
    verified: true,
    confidence: 1.0,
    notes: `From Budget Document (Cost Code: ${budgetItem.costCode || 'N/A'})`,
  };
}

/**
 * Groups takeoff items by CSI division
 * Merges budget items with takeoff items
 * 
 * @param allItems - All takeoff items from all takeoffs
 * @param budgetItems - Budget items (optional)
 * @param hasBudgetDoc - Whether budget document exists
 * @param keywordMap - Keyword mapping for CSI division detection
 * @returns Array of CSI division groups with categories
 */
export function getCSIDivisionGroups(
  allItems: TakeoffLineItem[],
  budgetItems: BudgetItem[] = [],
  hasBudgetDoc: boolean = false,
  keywordMap?: Array<{ keywords: string[]; division: number }>
): CSIDivisionSummary[] {
  const divisionGroups: Map<number, Map<string, { items: TakeoffLineItem[]; totalCost: number; fromBudget: boolean }>> = new Map();

  // STEP 1: Add budget items first (these define the divisions and their budgeted costs)
  if (hasBudgetDoc && budgetItems.length > 0) {
    budgetItems.forEach((budgetItem) => {
      const csiNumber = budgetPhaseToCSI(budgetItem.phaseCode);
      const categoryName = budgetItem.phaseName || `Division ${csiNumber}`;
      
      if (!divisionGroups.has(csiNumber)) {
        divisionGroups.set(csiNumber, new Map());
      }
      
      const divisionMap = divisionGroups.get(csiNumber)!;
      if (!divisionMap.has(categoryName)) {
        divisionMap.set(categoryName, { items: [], totalCost: 0, fromBudget: true });
      }
      
      const virtualItem = budgetItemToTakeoffItem(budgetItem);
      divisionMap.get(categoryName)!.items.push(virtualItem);
      divisionMap.get(categoryName)!.totalCost += budgetItem.budgetedAmount || 0;
    });
  }

  // STEP 2: Add takeoff items (these provide detailed quantities and may update costs)
  allItems.forEach((item) => {
    const division = getCSIDivisionForItem(item, keywordMap);
    if (division) {
      if (!divisionGroups.has(division.number)) {
        divisionGroups.set(division.number, new Map());
      }
      
      const divisionMap = divisionGroups.get(division.number)!;
      // Use "Takeoff Details" category to separate from budget categories
      const categoryKey = hasBudgetDoc ? `${item.category} (Takeoff)` : item.category;
      
      if (!divisionMap.has(categoryKey)) {
        divisionMap.set(categoryKey, { items: [], totalCost: 0, fromBudget: false });
      }
      
      divisionMap.get(categoryKey)!.items.push(item);
      // Always add takeoff costs - they represent extracted quantities with unit pricing
      divisionMap.get(categoryKey)!.totalCost += item.totalCost || 0;
    }
  });

  // Convert to the expected format
  const result: CSIDivisionSummary[] = [];
  
  divisionGroups.forEach((categoryMap, divisionNumber) => {
    const division = CSI_DIVISIONS.find(d => d.number === divisionNumber);
    if (division) {
      const categories: CategorySummary[] = [];
      let hasAnyBudgetItems = false;
      
      categoryMap.forEach((data, category) => {
        if (data.fromBudget) hasAnyBudgetItems = true;
        categories.push({
          category,
          itemCount: data.items.length,
          totalCost: data.totalCost,
          items: data.items
        });
      });
      
      // Sort categories: budget items first, then by total cost
      categories.sort((a, b) => {
        const aIsBudget = a.category.includes('(Takeoff)') ? 0 : 1;
        const bIsBudget = b.category.includes('(Takeoff)') ? 0 : 1;
        if (aIsBudget !== bIsBudget) return bIsBudget - aIsBudget;
        return b.totalCost - a.totalCost;
      });
      
      result.push({ 
        division: {
          number: division.number,
          name: division.name,
        },
        categories, 
        fromBudget: hasAnyBudgetItems 
      });
    }
  });

  // Sort divisions by number
  return result.sort((a, b) => a.division.number - b.division.number);
}
