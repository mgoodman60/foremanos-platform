/**
 * Type definitions for Material Takeoff functionality
 * Used across takeoff components, hooks, and utilities
 */

/**
 * Represents a single line item in a material takeoff
 *
 * @interface TakeoffLineItem
 */
export interface TakeoffLineItem {
  id: string;
  category: string;
  itemName: string;
  description?: string;
  quantity: number;
  unit: string;
  unitCost?: number;
  totalCost?: number;
  location?: string;
  sheetNumber?: string;
  gridLocation?: string;
  notes?: string;
  confidence?: number;
  verified: boolean;
}

/**
 * Represents a complete material takeoff with line items
 *
 * @interface MaterialTakeoff
 */
export interface MaterialTakeoff {
  id: string;
  name: string;
  description?: string;
  status: string;
  totalCost?: number;
  lineItems: TakeoffLineItem[];
  document?: {
    id: string;
    name: string;
  };
  createdAt: string;
}

/**
 * Summary statistics for a category of takeoff items
 *
 * @interface CategorySummary
 */
export interface CategorySummary {
  category: string;
  itemCount: number;
  totalCost: number;
  items: TakeoffLineItem[];
}

/**
 * Cost breakdown summary for takeoff items
 *
 * @interface CostSummary
 */
export interface CostSummary {
  totalCost?: number;
  totalMaterialCost?: number;
  totalLaborCost?: number;
  totalLaborHours?: number;
  pricedItemCount?: number;
  itemCount?: number;
  unpricedItems?: Array<{ id: string; itemName: string }>;
  byCategory?: Record<string, number>;
  byCSI?: Record<string, number>;
}

/**
 * MEP (Mechanical, Electrical, Plumbing) system data
 *
 * @interface MEPData
 */
export interface MEPData {
  items: MEPItem[];
  totalCost: number;
  itemsCreated: number;
  exists?: boolean;
  electrical?: {
    itemCount: number;
    total: number;
  };
  plumbing?: {
    itemCount: number;
    total: number;
  };
  hvac?: {
    itemCount: number;
    total: number;
  };
}

/**
 * Individual MEP system item
 *
 * @interface MEPItem
 */
export interface MEPItem {
  id: string;
  type: 'electrical' | 'plumbing' | 'hvac';
  itemName: string;
  quantity: number;
  unit: string;
  unitCost?: number;
  totalCost?: number;
  location?: string;
}

/**
 * Budget item from project budget
 *
 * @interface BudgetItem
 */
export interface BudgetItem {
  id: string;
  name: string;
  description?: string;
  phaseName?: string;
  phaseCode?: number;
  budgetedAmount?: number;
  costCode?: string;
}

/**
 * Total calculations for takeoff items
 *
 * @interface TakeoffTotals
 */
export interface TakeoffTotals {
  totalCost: number;
  totalQuantity: number;
  itemCount: number;
  byCategory: Record<string, CategorySummary>;
}

/**
 * CSI division grouping summary
 *
 * @interface CSIDivisionSummary
 */
export interface CSIDivisionSummary {
  division: {
    number: number;
    name: string;
  };
  categories: CategorySummary[];
  fromBudget?: boolean;
}
