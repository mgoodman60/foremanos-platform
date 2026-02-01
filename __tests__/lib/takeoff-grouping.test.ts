import { describe, it, expect, beforeEach } from 'vitest';
import {
  budgetPhaseToCSI,
  getCSIDivisionForCategory,
  getCSIDivisionForItem,
  budgetItemToTakeoffItem,
  getCSIDivisionGroups,
} from '@/lib/takeoff-grouping';
import type { TakeoffLineItem, BudgetItem } from '@/types/takeoff';

// Helper functions to create test data
function createTakeoffItem(overrides: Partial<TakeoffLineItem> = {}): TakeoffLineItem {
  return {
    id: 'item-1',
    category: 'Concrete',
    itemName: 'Foundation Wall',
    description: 'Cast-in-place concrete foundation',
    quantity: 100,
    unit: 'CY',
    unitCost: 150,
    totalCost: 15000,
    location: 'Building A',
    verified: false,
    confidence: 0.85,
    ...overrides,
  };
}

function createBudgetItem(overrides: Partial<BudgetItem> = {}): BudgetItem {
  return {
    id: 'budget-1',
    name: 'Site Concrete',
    description: 'Concrete work for site improvements',
    phaseName: 'Concrete',
    phaseCode: 300,
    budgetedAmount: 50000,
    costCode: '03-100',
    ...overrides,
  };
}

describe('takeoff-grouping', () => {
  beforeEach(() => {
    // Reset any state if needed
  });

  // ============================================
  // budgetPhaseToCSI Tests
  // ============================================
  describe('budgetPhaseToCSI', () => {
    it('should convert phase code to CSI division number', () => {
      expect(budgetPhaseToCSI(100)).toBe(1); // General Requirements
      expect(budgetPhaseToCSI(200)).toBe(2); // Existing Conditions
      expect(budgetPhaseToCSI(300)).toBe(3); // Concrete
      expect(budgetPhaseToCSI(900)).toBe(9); // Finishes
      expect(budgetPhaseToCSI(2600)).toBe(26); // Electrical
    });

    it('should handle zero phase code', () => {
      expect(budgetPhaseToCSI(0)).toBe(1);
    });

    it('should handle null phase code', () => {
      expect(budgetPhaseToCSI(null)).toBe(1);
    });

    it('should handle undefined phase code', () => {
      expect(budgetPhaseToCSI(undefined)).toBe(1);
    });

    it('should floor division results correctly', () => {
      expect(budgetPhaseToCSI(350)).toBe(3); // 350 / 100 = 3.5 -> 3
      expect(budgetPhaseToCSI(999)).toBe(9); // 999 / 100 = 9.99 -> 9
      expect(budgetPhaseToCSI(2650)).toBe(26); // 2650 / 100 = 26.5 -> 26
    });

    it('should handle single digit phase codes', () => {
      expect(budgetPhaseToCSI(50)).toBe(0); // 50 / 100 = 0.5 -> 0
      expect(budgetPhaseToCSI(99)).toBe(0); // 99 / 100 = 0.99 -> 0
    });

    it('should handle large phase codes', () => {
      expect(budgetPhaseToCSI(3100)).toBe(31); // Earthwork
      expect(budgetPhaseToCSI(4800)).toBe(48); // Electrical Power Generation
    });
  });

  // ============================================
  // getCSIDivisionForCategory Tests
  // ============================================
  describe('getCSIDivisionForCategory', () => {
    it('should return Division 1 for "01 - General Requirements"', () => {
      const result = getCSIDivisionForCategory('01 - General Requirements');
      expect(result).toBeDefined();
      expect(result?.number).toBe(1);
      expect(result?.name).toBe('General Requirements');
    });

    it('should return Division 1 for "General Requirements" without prefix', () => {
      const result = getCSIDivisionForCategory('General Requirements');
      expect(result).toBeDefined();
      expect(result?.number).toBe(1);
    });

    it('should be case insensitive', () => {
      const result1 = getCSIDivisionForCategory('GENERAL REQUIREMENTS');
      const result2 = getCSIDivisionForCategory('general requirements');
      const result3 = getCSIDivisionForCategory('General Requirements');

      expect(result1?.number).toBe(1);
      expect(result2?.number).toBe(1);
      expect(result3?.number).toBe(1);
    });

    it('should return undefined for unknown categories', () => {
      const result = getCSIDivisionForCategory('Unknown Category');
      expect(result).toBeUndefined();
    });

    it('should return undefined for empty category', () => {
      const result = getCSIDivisionForCategory('');
      expect(result).toBeUndefined();
    });

    it('should handle categories with extra whitespace', () => {
      // The function toLowerCase() the input but doesn't trim, so whitespace prevents matching
      const result = getCSIDivisionForCategory('  General Requirements  ');
      expect(result).toBeUndefined();

      // Without whitespace, it matches correctly
      const resultNoWhitespace = getCSIDivisionForCategory('General Requirements');
      expect(resultNoWhitespace).toBeDefined();
      expect(resultNoWhitespace?.number).toBe(1);
    });
  });

  // ============================================
  // getCSIDivisionForItem Tests
  // ============================================
  describe('getCSIDivisionForItem', () => {
    it('should return division based on keyword match in item name', () => {
      const item = createTakeoffItem({
        itemName: 'Concrete Foundation Wall',
        description: '',
        category: '',
      });

      const keywordMap = [
        { keywords: ['concrete', 'foundation'], division: 3 },
      ];

      const result = getCSIDivisionForItem(item, keywordMap);
      expect(result).toBeDefined();
      expect(result?.number).toBe(3);
    });

    it('should return division based on keyword match in description', () => {
      const item = createTakeoffItem({
        itemName: 'Wall System',
        description: 'Reinforced concrete wall',
        category: '',
      });

      const keywordMap = [
        { keywords: ['concrete'], division: 3 },
      ];

      const result = getCSIDivisionForItem(item, keywordMap);
      expect(result).toBeDefined();
      expect(result?.number).toBe(3);
    });

    it('should return division based on keyword match in category', () => {
      const item = createTakeoffItem({
        itemName: 'Wall',
        description: '',
        category: 'Concrete Work',
      });

      const keywordMap = [
        { keywords: ['concrete'], division: 3 },
      ];

      const result = getCSIDivisionForItem(item, keywordMap);
      expect(result).toBeDefined();
      expect(result?.number).toBe(3);
    });

    it('should match first keyword in priority order', () => {
      const item = createTakeoffItem({
        itemName: 'Steel Rebar for Concrete',
        description: '',
        category: '',
      });

      const keywordMap = [
        { keywords: ['steel'], division: 5 },
        { keywords: ['concrete'], division: 3 },
      ];

      const result = getCSIDivisionForItem(item, keywordMap);
      expect(result?.number).toBe(5); // Steel comes first
    });

    it('should be case insensitive for keyword matching', () => {
      const item = createTakeoffItem({
        itemName: 'CONCRETE FOUNDATION',
        description: '',
        category: '',
      });

      const keywordMap = [
        { keywords: ['concrete'], division: 3 },
      ];

      const result = getCSIDivisionForItem(item, keywordMap);
      expect(result?.number).toBe(3);
    });

    it('should fallback to category match if no keyword matches', () => {
      const item = createTakeoffItem({
        itemName: 'Wall System',
        description: '',
        category: 'General Requirements',
      });

      const keywordMap = [
        { keywords: ['concrete'], division: 3 },
      ];

      const result = getCSIDivisionForItem(item, keywordMap);
      expect(result).toBeDefined();
      expect(result?.number).toBe(1); // From category match
    });

    it('should default to Division 1 if nothing matches', () => {
      const item = createTakeoffItem({
        itemName: 'Unknown Item',
        description: '',
        category: 'Unknown',
      });

      const keywordMap = [
        { keywords: ['concrete'], division: 3 },
      ];

      const result = getCSIDivisionForItem(item, keywordMap);
      expect(result).toBeDefined();
      expect(result?.number).toBe(1);
    });

    it('should work without keyword map', () => {
      const item = createTakeoffItem({
        itemName: 'Item',
        description: '',
        category: 'General Requirements',
      });

      const result = getCSIDivisionForItem(item);
      expect(result).toBeDefined();
      expect(result?.number).toBe(1);
    });

    it('should handle items with null/undefined fields', () => {
      const item = createTakeoffItem({
        itemName: '',
        description: undefined,
        category: '',
      });

      const result = getCSIDivisionForItem(item);
      expect(result).toBeDefined();
      expect(result?.number).toBe(1);
    });

    it('should match partial keywords', () => {
      const item = createTakeoffItem({
        itemName: 'Precast concrete panels',
        description: '',
        category: '',
      });

      const keywordMap = [
        { keywords: ['concrete'], division: 3 },
      ];

      const result = getCSIDivisionForItem(item, keywordMap);
      expect(result?.number).toBe(3);
    });

    it('should handle multiple keywords for same division', () => {
      const item = createTakeoffItem({
        itemName: 'Structural steel beams',
        description: '',
        category: '',
      });

      const keywordMap = [
        { keywords: ['steel', 'metal', 'beam'], division: 5 },
      ];

      const result = getCSIDivisionForItem(item, keywordMap);
      expect(result?.number).toBe(5);
    });
  });

  // ============================================
  // budgetItemToTakeoffItem Tests
  // ============================================
  describe('budgetItemToTakeoffItem', () => {
    it('should convert basic budget item to takeoff item', () => {
      const budgetItem = createBudgetItem();
      const result = budgetItemToTakeoffItem(budgetItem);

      expect(result.id).toBe('budget-budget-1');
      expect(result.category).toBe('Concrete');
      expect(result.itemName).toBe('Site Concrete');
      expect(result.description).toBe('Concrete work for site improvements');
      expect(result.quantity).toBe(1);
      expect(result.unit).toBe('LS');
      expect(result.unitCost).toBe(50000);
      expect(result.totalCost).toBe(50000);
      expect(result.location).toBe('03-100');
      expect(result.verified).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('should handle budget item without description', () => {
      const budgetItem = createBudgetItem({ description: undefined });
      const result = budgetItemToTakeoffItem(budgetItem);

      expect(result.description).toBe('');
    });

    it('should handle budget item without phase name', () => {
      const budgetItem = createBudgetItem({ phaseName: undefined });
      const result = budgetItemToTakeoffItem(budgetItem);

      expect(result.category).toBe('Budget Item');
    });

    it('should handle budget item without budgeted amount', () => {
      const budgetItem = createBudgetItem({ budgetedAmount: undefined });
      const result = budgetItemToTakeoffItem(budgetItem);

      expect(result.unitCost).toBe(0);
      expect(result.totalCost).toBe(0);
    });

    it('should handle budget item without cost code', () => {
      const budgetItem = createBudgetItem({ costCode: undefined });
      const result = budgetItemToTakeoffItem(budgetItem);

      expect(result.location).toBeUndefined();
      expect(result.notes).toContain('N/A');
    });

    it('should include cost code in notes', () => {
      const budgetItem = createBudgetItem({ costCode: '03-200' });
      const result = budgetItemToTakeoffItem(budgetItem);

      expect(result.notes).toContain('03-200');
      expect(result.notes).toContain('Budget Document');
    });

    it('should preserve budget item ID in converted item ID', () => {
      const budgetItem = createBudgetItem({ id: 'unique-budget-id' });
      const result = budgetItemToTakeoffItem(budgetItem);

      expect(result.id).toBe('budget-unique-budget-id');
    });

    it('should handle zero budgeted amount', () => {
      const budgetItem = createBudgetItem({ budgetedAmount: 0 });
      const result = budgetItemToTakeoffItem(budgetItem);

      expect(result.unitCost).toBe(0);
      expect(result.totalCost).toBe(0);
    });

    it('should use LS (Lump Sum) as unit', () => {
      const budgetItem = createBudgetItem();
      const result = budgetItemToTakeoffItem(budgetItem);

      expect(result.unit).toBe('LS');
      expect(result.quantity).toBe(1);
    });
  });

  // ============================================
  // getCSIDivisionGroups Tests
  // ============================================
  describe('getCSIDivisionGroups', () => {
    it('should return empty array for empty input', () => {
      const result = getCSIDivisionGroups([], []);
      expect(result).toHaveLength(0);
    });

    it('should group takeoff items by CSI division', () => {
      const items = [
        createTakeoffItem({ id: '1', category: 'Concrete', totalCost: 10000 }),
        createTakeoffItem({ id: '2', category: 'Steel', totalCost: 5000 }),
      ];

      const keywordMap = [
        { keywords: ['concrete'], division: 3 },
        { keywords: ['steel'], division: 5 },
      ];

      const result = getCSIDivisionGroups(items, [], false, keywordMap);

      expect(result.length).toBeGreaterThan(0);
      const concreteDivision = result.find(d => d.division.number === 3);
      expect(concreteDivision).toBeDefined();
    });

    it('should group budget items by CSI division', () => {
      const budgetItems = [
        createBudgetItem({ id: '1', phaseCode: 300, budgetedAmount: 50000 }),
        createBudgetItem({ id: '2', phaseCode: 500, budgetedAmount: 30000 }),
      ];

      const result = getCSIDivisionGroups([], budgetItems, true);

      expect(result.length).toBeGreaterThan(0);
      const concreteDivision = result.find(d => d.division.number === 3);
      const metalsDivision = result.find(d => d.division.number === 5);

      expect(concreteDivision).toBeDefined();
      expect(metalsDivision).toBeDefined();
    });

    it('should merge budget items and takeoff items', () => {
      const budgetItems = [
        createBudgetItem({ id: '1', phaseCode: 300, phaseName: 'Concrete', budgetedAmount: 50000 }),
      ];

      const takeoffItems = [
        createTakeoffItem({ id: '1', category: 'Concrete', totalCost: 10000 }),
      ];

      const keywordMap = [
        { keywords: ['concrete'], division: 3 },
      ];

      const result = getCSIDivisionGroups(takeoffItems, budgetItems, true, keywordMap);

      const concreteDivision = result.find(d => d.division.number === 3);
      expect(concreteDivision).toBeDefined();
      expect(concreteDivision?.categories.length).toBeGreaterThan(0);
    });

    it('should separate takeoff categories from budget categories when budget exists', () => {
      const budgetItems = [
        createBudgetItem({ id: '1', phaseCode: 300, phaseName: 'Concrete', budgetedAmount: 50000 }),
      ];

      const takeoffItems = [
        createTakeoffItem({ id: '1', category: 'Concrete', totalCost: 10000 }),
      ];

      const keywordMap = [
        { keywords: ['concrete'], division: 3 },
      ];

      const result = getCSIDivisionGroups(takeoffItems, budgetItems, true, keywordMap);

      const concreteDivision = result.find(d => d.division.number === 3);
      const takeoffCategory = concreteDivision?.categories.find(c => c.category.includes('(Takeoff)'));

      expect(takeoffCategory).toBeDefined();
    });

    it('should not add (Takeoff) suffix when no budget document', () => {
      const takeoffItems = [
        createTakeoffItem({ id: '1', category: 'Concrete', totalCost: 10000 }),
      ];

      const keywordMap = [
        { keywords: ['concrete'], division: 3 },
      ];

      const result = getCSIDivisionGroups(takeoffItems, [], false, keywordMap);

      const concreteDivision = result.find(d => d.division.number === 3);
      const category = concreteDivision?.categories[0];

      expect(category?.category).toBe('Concrete');
      expect(category?.category).not.toContain('(Takeoff)');
    });

    it('should calculate total cost for categories', () => {
      const takeoffItems = [
        createTakeoffItem({ id: '1', category: 'Concrete', totalCost: 10000 }),
        createTakeoffItem({ id: '2', category: 'Concrete', totalCost: 5000 }),
      ];

      const keywordMap = [
        { keywords: ['concrete'], division: 3 },
      ];

      const result = getCSIDivisionGroups(takeoffItems, [], false, keywordMap);

      const concreteDivision = result.find(d => d.division.number === 3);
      const category = concreteDivision?.categories.find(c => c.category === 'Concrete');

      expect(category?.totalCost).toBe(15000);
      expect(category?.itemCount).toBe(2);
    });

    it('should handle items without total cost', () => {
      const takeoffItems = [
        createTakeoffItem({ id: '1', category: 'Concrete', totalCost: undefined }),
      ];

      const keywordMap = [
        { keywords: ['concrete'], division: 3 },
      ];

      const result = getCSIDivisionGroups(takeoffItems, [], false, keywordMap);

      const concreteDivision = result.find(d => d.division.number === 3);
      const category = concreteDivision?.categories[0];

      expect(category?.totalCost).toBe(0);
    });

    it('should sort divisions by number', () => {
      const takeoffItems = [
        createTakeoffItem({ id: '1', category: 'Steel', totalCost: 5000 }),
        createTakeoffItem({ id: '2', category: 'Concrete', totalCost: 10000 }),
      ];

      const keywordMap = [
        { keywords: ['steel'], division: 5 },
        { keywords: ['concrete'], division: 3 },
      ];

      const result = getCSIDivisionGroups(takeoffItems, [], false, keywordMap);

      // Should be sorted by division number
      if (result.length >= 2) {
        expect(result[0].division.number).toBeLessThan(result[1].division.number);
      }
    });

    it('should sort categories within division', () => {
      const budgetItems = [
        createBudgetItem({ id: '1', phaseCode: 300, phaseName: 'Concrete Foundation', budgetedAmount: 20000 }),
        createBudgetItem({ id: '2', phaseCode: 300, phaseName: 'Concrete Slabs', budgetedAmount: 50000 }),
      ];

      const takeoffItems = [
        createTakeoffItem({ id: '1', category: 'Concrete', totalCost: 10000 }),
      ];

      const keywordMap = [
        { keywords: ['concrete'], division: 3 },
      ];

      const result = getCSIDivisionGroups(takeoffItems, budgetItems, true, keywordMap);

      const concreteDivision = result.find(d => d.division.number === 3);

      // Budget categories should come before takeoff categories
      const firstCategory = concreteDivision?.categories[0];
      expect(firstCategory?.category).not.toContain('(Takeoff)');
    });

    it('should include all items in categories', () => {
      const takeoffItems = [
        createTakeoffItem({ id: '1', category: 'Concrete', totalCost: 10000 }),
        createTakeoffItem({ id: '2', category: 'Concrete', totalCost: 5000 }),
      ];

      const keywordMap = [
        { keywords: ['concrete'], division: 3 },
      ];

      const result = getCSIDivisionGroups(takeoffItems, [], false, keywordMap);

      const concreteDivision = result.find(d => d.division.number === 3);
      const category = concreteDivision?.categories[0];

      expect(category?.items).toHaveLength(2);
      expect(category?.items[0].id).toBe('1');
      expect(category?.items[1].id).toBe('2');
    });

    it('should mark divisions with budget items as fromBudget', () => {
      const budgetItems = [
        createBudgetItem({ id: '1', phaseCode: 300, budgetedAmount: 50000 }),
      ];

      const result = getCSIDivisionGroups([], budgetItems, true);

      const concreteDivision = result.find(d => d.division.number === 3);
      expect(concreteDivision?.fromBudget).toBe(true);
    });

    it('should not mark divisions without budget items as fromBudget', () => {
      const takeoffItems = [
        createTakeoffItem({ id: '1', category: 'Concrete', totalCost: 10000 }),
      ];

      const keywordMap = [
        { keywords: ['concrete'], division: 3 },
      ];

      const result = getCSIDivisionGroups(takeoffItems, [], false, keywordMap);

      const concreteDivision = result.find(d => d.division.number === 3);
      // The implementation always sets fromBudget based on hasAnyBudgetItems flag
      // When there are no budget items, it's set to false (not undefined)
      expect(concreteDivision?.fromBudget).toBe(false);
    });

    it('should handle multiple categories in same division', () => {
      const takeoffItems = [
        createTakeoffItem({ id: '1', category: 'Concrete Walls', totalCost: 10000 }),
        createTakeoffItem({ id: '2', category: 'Concrete Floors', totalCost: 15000 }),
      ];

      const keywordMap = [
        { keywords: ['concrete'], division: 3 },
      ];

      const result = getCSIDivisionGroups(takeoffItems, [], false, keywordMap);

      const concreteDivision = result.find(d => d.division.number === 3);
      expect(concreteDivision?.categories.length).toBeGreaterThanOrEqual(1);
    });

    it('should work with empty keyword map', () => {
      const takeoffItems = [
        createTakeoffItem({ id: '1', category: 'General Requirements', totalCost: 5000 }),
      ];

      const result = getCSIDivisionGroups(takeoffItems, [], false);

      expect(result.length).toBeGreaterThan(0);
      const division = result.find(d => d.division.number === 1);
      expect(division).toBeDefined();
    });

    it('should accumulate costs from multiple budget items in same category', () => {
      const budgetItems = [
        createBudgetItem({ id: '1', phaseCode: 300, phaseName: 'Concrete', budgetedAmount: 30000 }),
        createBudgetItem({ id: '2', phaseCode: 300, phaseName: 'Concrete', budgetedAmount: 20000 }),
      ];

      const result = getCSIDivisionGroups([], budgetItems, true);

      const concreteDivision = result.find(d => d.division.number === 3);
      const category = concreteDivision?.categories.find(c => c.category === 'Concrete');

      expect(category?.totalCost).toBe(50000);
      expect(category?.items).toHaveLength(2);
    });

    it('should handle large number of items efficiently', () => {
      const items = Array.from({ length: 100 }, (_, i) =>
        createTakeoffItem({ id: `item-${i}`, category: 'Concrete', totalCost: 1000 })
      );

      const keywordMap = [
        { keywords: ['concrete'], division: 3 },
      ];

      const result = getCSIDivisionGroups(items, [], false, keywordMap);

      const concreteDivision = result.find(d => d.division.number === 3);
      const category = concreteDivision?.categories[0];

      expect(category?.itemCount).toBe(100);
      expect(category?.totalCost).toBe(100000);
    });

    it('should preserve division metadata', () => {
      const takeoffItems = [
        createTakeoffItem({ id: '1', category: 'Concrete', totalCost: 10000 }),
      ];

      const keywordMap = [
        { keywords: ['concrete'], division: 3 },
      ];

      const result = getCSIDivisionGroups(takeoffItems, [], false, keywordMap);

      const concreteDivision = result.find(d => d.division.number === 3);
      expect(concreteDivision?.division.number).toBe(3);
      expect(concreteDivision?.division.name).toBe('Concrete');
    });
  });
});
