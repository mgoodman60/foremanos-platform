/**
 * Type definitions for Material Takeoff functionality
 * Used across takeoff components, hooks, and utilities
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

export interface CategorySummary {
  category: string;
  itemCount: number;
  totalCost: number;
  items: TakeoffLineItem[];
}

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

export interface MEPData {
  items: MEPItem[];
  totalCost: number;
  itemsCreated: number;
}

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

export interface BudgetItem {
  id: string;
  name: string;
  description?: string;
  phaseName?: string;
  phaseCode?: number;
  budgetedAmount?: number;
  costCode?: string;
}

export interface TakeoffTotals {
  totalCost: number;
  totalQuantity: number;
  itemCount: number;
  byCategory: Record<string, CategorySummary>;
}

export interface CSIDivisionSummary {
  division: {
    number: number;
    name: string;
  };
  categories: CategorySummary[];
  fromBudget?: boolean;
}
