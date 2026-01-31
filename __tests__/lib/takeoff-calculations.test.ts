import { describe, it, expect } from 'vitest';
import {
  calculateTakeoffTotals,
  calculateCostSummary,
  getCategorySummaries,
  getTotalQuantityByUnit,
  getTotalCost,
} from '@/lib/takeoff-calculations';
import type { TakeoffLineItem } from '@/types/takeoff';

// Helper to create test line items
function createLineItem(overrides: Partial<TakeoffLineItem> = {}): TakeoffLineItem {
  return {
    id: 'item-1',
    category: 'Concrete',
    itemName: 'Concrete Foundation',
    quantity: 100,
    unit: 'CY',
    unitCost: 150,
    totalCost: 15000,
    verified: false,
    ...overrides,
  };
}

describe('takeoff-calculations', () => {
  // ============================================
  // calculateTakeoffTotals Tests
  // ============================================
  describe('calculateTakeoffTotals', () => {
    it('should return zeros for empty array', () => {
      const result = calculateTakeoffTotals([]);

      expect(result.totalCost).toBe(0);
      expect(result.totalQuantity).toBe(0);
      expect(result.itemCount).toBe(0);
      expect(Object.keys(result.byCategory)).toHaveLength(0);
    });

    it('should calculate totals for single item', () => {
      const items = [createLineItem({ totalCost: 5000, quantity: 50 })];
      const result = calculateTakeoffTotals(items);

      expect(result.totalCost).toBe(5000);
      expect(result.totalQuantity).toBe(50);
      expect(result.itemCount).toBe(1);
    });

    it('should calculate totals for multiple items', () => {
      const items = [
        createLineItem({ id: '1', totalCost: 5000, quantity: 50 }),
        createLineItem({ id: '2', totalCost: 3000, quantity: 30 }),
        createLineItem({ id: '3', totalCost: 2000, quantity: 20 }),
      ];
      const result = calculateTakeoffTotals(items);

      expect(result.totalCost).toBe(10000);
      expect(result.totalQuantity).toBe(100);
      expect(result.itemCount).toBe(3);
    });

    it('should group items by category', () => {
      const items = [
        createLineItem({ id: '1', category: 'Concrete', totalCost: 5000 }),
        createLineItem({ id: '2', category: 'Steel', totalCost: 3000 }),
        createLineItem({ id: '3', category: 'Concrete', totalCost: 2000 }),
      ];
      const result = calculateTakeoffTotals(items);

      expect(result.byCategory['Concrete'].itemCount).toBe(2);
      expect(result.byCategory['Concrete'].totalCost).toBe(7000);
      expect(result.byCategory['Steel'].itemCount).toBe(1);
      expect(result.byCategory['Steel'].totalCost).toBe(3000);
    });

    it('should handle items without totalCost', () => {
      const items = [
        createLineItem({ id: '1', totalCost: undefined, quantity: 50 }),
        createLineItem({ id: '2', totalCost: 3000, quantity: 30 }),
      ];
      const result = calculateTakeoffTotals(items);

      expect(result.totalCost).toBe(3000);
      expect(result.totalQuantity).toBe(80);
    });

    it('should use Uncategorized for items without category', () => {
      const items = [
        createLineItem({ id: '1', category: '', totalCost: 1000 }),
      ];
      const result = calculateTakeoffTotals(items);

      expect(result.byCategory['Uncategorized']).toBeDefined();
      expect(result.byCategory['Uncategorized'].totalCost).toBe(1000);
    });
  });

  // ============================================
  // calculateCostSummary Tests
  // ============================================
  describe('calculateCostSummary', () => {
    it('should return zeros for empty array', () => {
      const result = calculateCostSummary([]);

      expect(result.totalCost).toBe(0);
      expect(result.itemCount).toBe(0);
      expect(Object.keys(result.byCategory || {})).toHaveLength(0);
    });

    it('should calculate cost by category', () => {
      const items = [
        createLineItem({ id: '1', category: 'Concrete', totalCost: 5000 }),
        createLineItem({ id: '2', category: 'Steel', totalCost: 3000 }),
        createLineItem({ id: '3', category: 'Concrete', totalCost: 2000 }),
      ];
      const result = calculateCostSummary(items);

      expect(result.byCategory?.['Concrete']).toBe(7000);
      expect(result.byCategory?.['Steel']).toBe(3000);
      expect(result.totalCost).toBe(10000);
    });

    it('should extract CSI codes from category names', () => {
      const items = [
        createLineItem({ id: '1', category: '03 - Concrete', totalCost: 5000 }),
        createLineItem({ id: '2', category: '05 - Metals', totalCost: 3000 }),
        createLineItem({ id: '3', category: '03 - Concrete', totalCost: 2000 }),
      ];
      const result = calculateCostSummary(items);

      expect(result.byCSI?.['03']).toBe(7000);
      expect(result.byCSI?.['05']).toBe(3000);
    });

    it('should handle items without CSI prefix', () => {
      const items = [
        createLineItem({ id: '1', category: 'Concrete', totalCost: 5000 }),
        createLineItem({ id: '2', category: '03 - Concrete', totalCost: 3000 }),
      ];
      const result = calculateCostSummary(items);

      expect(result.byCSI?.['03']).toBe(3000);
      expect(result.byCategory?.['Concrete']).toBe(5000);
    });
  });

  // ============================================
  // getCategorySummaries Tests
  // ============================================
  describe('getCategorySummaries', () => {
    it('should return empty array for empty input', () => {
      const result = getCategorySummaries([]);
      expect(result).toHaveLength(0);
    });

    it('should group items by category', () => {
      const items = [
        createLineItem({ id: '1', category: 'Concrete', totalCost: 5000 }),
        createLineItem({ id: '2', category: 'Steel', totalCost: 3000 }),
        createLineItem({ id: '3', category: 'Concrete', totalCost: 2000 }),
      ];
      const result = getCategorySummaries(items);

      expect(result).toHaveLength(2);

      const concrete = result.find(s => s.category === 'Concrete');
      expect(concrete?.itemCount).toBe(2);
      expect(concrete?.totalCost).toBe(7000);
      expect(concrete?.items).toHaveLength(2);
    });

    it('should sort categories by totalCost descending', () => {
      const items = [
        createLineItem({ id: '1', category: 'Low', totalCost: 1000 }),
        createLineItem({ id: '2', category: 'High', totalCost: 10000 }),
        createLineItem({ id: '3', category: 'Medium', totalCost: 5000 }),
      ];
      const result = getCategorySummaries(items);

      expect(result[0].category).toBe('High');
      expect(result[1].category).toBe('Medium');
      expect(result[2].category).toBe('Low');
    });

    it('should handle uncategorized items', () => {
      const items = [
        createLineItem({ id: '1', category: '', totalCost: 1000 }),
      ];
      const result = getCategorySummaries(items);

      expect(result[0].category).toBe('Uncategorized');
    });
  });

  // ============================================
  // getTotalQuantityByUnit Tests
  // ============================================
  describe('getTotalQuantityByUnit', () => {
    it('should return empty object for empty array', () => {
      const result = getTotalQuantityByUnit([]);
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should sum quantities by unit', () => {
      const items = [
        createLineItem({ id: '1', unit: 'CY', quantity: 100 }),
        createLineItem({ id: '2', unit: 'SF', quantity: 500 }),
        createLineItem({ id: '3', unit: 'CY', quantity: 50 }),
      ];
      const result = getTotalQuantityByUnit(items);

      expect(result['CY']).toBe(150);
      expect(result['SF']).toBe(500);
    });

    it('should handle multiple different units', () => {
      const items = [
        createLineItem({ id: '1', unit: 'LF', quantity: 100 }),
        createLineItem({ id: '2', unit: 'EA', quantity: 25 }),
        createLineItem({ id: '3', unit: 'SF', quantity: 1000 }),
        createLineItem({ id: '4', unit: 'CY', quantity: 50 }),
      ];
      const result = getTotalQuantityByUnit(items);

      expect(Object.keys(result)).toHaveLength(4);
      expect(result['LF']).toBe(100);
      expect(result['EA']).toBe(25);
      expect(result['SF']).toBe(1000);
      expect(result['CY']).toBe(50);
    });
  });

  // ============================================
  // getTotalCost Tests
  // ============================================
  describe('getTotalCost', () => {
    it('should return 0 for empty array', () => {
      const result = getTotalCost([]);
      expect(result).toBe(0);
    });

    it('should sum all item costs', () => {
      const items = [
        createLineItem({ id: '1', totalCost: 5000 }),
        createLineItem({ id: '2', totalCost: 3000 }),
        createLineItem({ id: '3', totalCost: 2000 }),
      ];
      const result = getTotalCost(items);

      expect(result).toBe(10000);
    });

    it('should handle items without totalCost', () => {
      const items = [
        createLineItem({ id: '1', totalCost: 5000 }),
        createLineItem({ id: '2', totalCost: undefined }),
        createLineItem({ id: '3', totalCost: 2000 }),
      ];
      const result = getTotalCost(items);

      expect(result).toBe(7000);
    });

    it('should handle all items without totalCost', () => {
      const items = [
        createLineItem({ id: '1', totalCost: undefined }),
        createLineItem({ id: '2', totalCost: undefined }),
      ];
      const result = getTotalCost(items);

      expect(result).toBe(0);
    });
  });
});
