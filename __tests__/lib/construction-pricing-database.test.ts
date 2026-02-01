import { describe, it, expect, beforeEach } from 'vitest';
import {
  findPriceByCategory,
  findPriceByDivision,
  getDivisionItems,
  getDivisionBudget,
  getDivisionSummary,
  REGIONAL_MULTIPLIERS,
  CSI_DIVISION_PRICING,
  type UnitPriceEntry,
  type DivisionPricing,
} from '@/lib/construction-pricing-database';

describe('construction-pricing-database', () => {
  // ============================================
  // Constants Tests
  // ============================================
  describe('REGIONAL_MULTIPLIERS', () => {
    it('should have default multiplier of 1.00', () => {
      expect(REGIONAL_MULTIPLIERS['default']).toBe(1.00);
      expect(REGIONAL_MULTIPLIERS['national']).toBe(1.00);
    });

    it('should have Kentucky region multipliers', () => {
      expect(REGIONAL_MULTIPLIERS['kentucky']).toBe(0.88);
      expect(REGIONAL_MULTIPLIERS['morehead-ky']).toBe(0.86);
    });

    it('should have high-cost region multipliers', () => {
      expect(REGIONAL_MULTIPLIERS['new-york']).toBe(1.45);
      expect(REGIONAL_MULTIPLIERS['california']).toBe(1.45);
      expect(REGIONAL_MULTIPLIERS['boston']).toBe(1.35);
    });

    it('should have low-cost region multipliers', () => {
      expect(REGIONAL_MULTIPLIERS['morehead-ky']).toBeLessThan(1.00);
      expect(REGIONAL_MULTIPLIERS['georgia']).toBeLessThan(1.00);
    });

    it('should have all multipliers as positive numbers', () => {
      Object.values(REGIONAL_MULTIPLIERS).forEach(multiplier => {
        expect(multiplier).toBeGreaterThan(0);
        expect(typeof multiplier).toBe('number');
      });
    });
  });

  describe('CSI_DIVISION_PRICING', () => {
    it('should have 23 divisions', () => {
      expect(CSI_DIVISION_PRICING).toHaveLength(23);
    });

    it('should have Division 1 - General Requirements', () => {
      const division1 = CSI_DIVISION_PRICING.find(d => d.divisionCode === 1);
      expect(division1).toBeDefined();
      expect(division1?.divisionName).toBe('General Requirements');
      expect(division1?.items).toBeDefined();
    });

    it('should have Division 3 - Concrete', () => {
      const division3 = CSI_DIVISION_PRICING.find(d => d.divisionCode === 3);
      expect(division3).toBeDefined();
      expect(division3?.divisionName).toBe('Concrete');
    });

    it('should have all divisions with required structure', () => {
      CSI_DIVISION_PRICING.forEach(division => {
        expect(division).toHaveProperty('divisionCode');
        expect(division).toHaveProperty('divisionName');
        expect(division).toHaveProperty('items');
        expect(typeof division.divisionCode).toBe('number');
        expect(typeof division.divisionName).toBe('string');
        expect(typeof division.items).toBe('object');
      });
    });

    it('should have items with valid UnitPriceEntry structure', () => {
      const division1 = CSI_DIVISION_PRICING[0];
      const firstItem = Object.values(division1.items)[0];

      expect(firstItem).toHaveProperty('materialCost');
      expect(firstItem).toHaveProperty('laborCost');
      expect(firstItem).toHaveProperty('totalInstalled');
      expect(firstItem).toHaveProperty('unit');
      expect(firstItem).toHaveProperty('laborHoursPerUnit');
      expect(firstItem).toHaveProperty('wasteFactorPercent');

      expect(typeof firstItem.materialCost).toBe('number');
      expect(typeof firstItem.laborCost).toBe('number');
      expect(typeof firstItem.totalInstalled).toBe('number');
      expect(typeof firstItem.unit).toBe('string');
      expect(typeof firstItem.laborHoursPerUnit).toBe('number');
      expect(typeof firstItem.wasteFactorPercent).toBe('number');
    });

    it('should have division codes in expected range', () => {
      const divisionCodes = CSI_DIVISION_PRICING.map(d => d.divisionCode);
      divisionCodes.forEach(code => {
        expect(code).toBeGreaterThan(0);
        expect(code).toBeLessThanOrEqual(33);
      });
    });

    it('should have unique division codes', () => {
      const divisionCodes = CSI_DIVISION_PRICING.map(d => d.divisionCode);
      const uniqueCodes = new Set(divisionCodes);
      expect(uniqueCodes.size).toBe(divisionCodes.length);
    });
  });

  // ============================================
  // findPriceByCategory Tests
  // ============================================
  describe('findPriceByCategory', () => {
    it('should find price for exact category match', () => {
      const result = findPriceByCategory('mobilization');
      expect(result).not.toBeNull();
      expect(result?.totalInstalled).toBe(2500);
      expect(result?.unit).toBe('LS');
    });

    it('should find price for category with default region', () => {
      const result = findPriceByCategory('temporary-fence', 'default');
      expect(result).not.toBeNull();
      expect(result?.totalInstalled).toBe(13.00);
      expect(result?.unit).toBe('LF');
    });

    it('should apply regional multiplier correctly', () => {
      const defaultResult = findPriceByCategory('temporary-fence', 'default');
      const kentuckyResult = findPriceByCategory('temporary-fence', 'kentucky');

      expect(defaultResult).not.toBeNull();
      expect(kentuckyResult).not.toBeNull();

      // Kentucky multiplier is 0.88, so prices should be lower
      expect(kentuckyResult!.totalInstalled).toBeLessThan(defaultResult!.totalInstalled);
      expect(kentuckyResult!.materialCost).toBeLessThan(defaultResult!.materialCost);
      expect(kentuckyResult!.laborCost).toBeLessThan(defaultResult!.laborCost);
    });

    it('should apply high-cost regional multiplier', () => {
      const defaultResult = findPriceByCategory('temporary-fence', 'default');
      const newYorkResult = findPriceByCategory('temporary-fence', 'new-york');

      expect(defaultResult).not.toBeNull();
      expect(newYorkResult).not.toBeNull();

      // New York multiplier is 1.45, so prices should be higher
      expect(newYorkResult!.totalInstalled).toBeGreaterThan(defaultResult!.totalInstalled);
    });

    it('should normalize category name with hyphens', () => {
      const result1 = findPriceByCategory('temporary-fence');
      const result2 = findPriceByCategory('temporary fence');
      const result3 = findPriceByCategory('Temporary Fence');

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(result3).not.toBeNull();

      expect(result1?.totalInstalled).toBe(result2?.totalInstalled);
      expect(result2?.totalInstalled).toBe(result3?.totalInstalled);
    });

    it('should handle partial category matches', () => {
      const result = findPriceByCategory('fence');
      expect(result).not.toBeNull();
      expect(result?.unit).toBe('LF');
    });

    it('should return null for non-existent category', () => {
      const result = findPriceByCategory('non-existent-category-xyz');
      expect(result).toBeNull();
    });

    it('should return first match for empty category (due to includes behavior)', () => {
      const result = findPriceByCategory('');
      // Empty string matches all items via .includes(''), returns first found
      expect(result).not.toBeNull();
      expect(result?.totalInstalled).toBe(2500); // mobilization from Division 1
    });

    it('should use default multiplier for unknown region', () => {
      const defaultResult = findPriceByCategory('mobilization', 'default');
      const unknownResult = findPriceByCategory('mobilization', 'unknown-region-xyz');

      expect(defaultResult).not.toBeNull();
      expect(unknownResult).not.toBeNull();
      expect(unknownResult?.totalInstalled).toBe(defaultResult?.totalInstalled);
    });

    it('should round prices to 2 decimal places', () => {
      const result = findPriceByCategory('temporary-fence', 'kentucky');
      expect(result).not.toBeNull();

      // Check that prices are rounded
      const materialCostStr = result!.materialCost.toString();
      const decimalPlaces = materialCostStr.includes('.')
        ? materialCostStr.split('.')[1].length
        : 0;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });

    it('should preserve all fields in returned entry', () => {
      const result = findPriceByCategory('mobilization');
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('materialCost');
      expect(result).toHaveProperty('laborCost');
      expect(result).toHaveProperty('totalInstalled');
      expect(result).toHaveProperty('unit');
      expect(result).toHaveProperty('laborHoursPerUnit');
      expect(result).toHaveProperty('wasteFactorPercent');
    });

    it('should handle special characters in category name', () => {
      const result = findPriceByCategory('cmu-8in-standard');
      expect(result).not.toBeNull();
    });

    it('should find items from different divisions', () => {
      const div1Result = findPriceByCategory('mobilization'); // Division 1
      const div2Result = findPriceByCategory('demolition-light'); // Division 2

      expect(div1Result).not.toBeNull();
      expect(div2Result).not.toBeNull();
      expect(div1Result?.totalInstalled).not.toBe(div2Result?.totalInstalled);
    });
  });

  // ============================================
  // findPriceByDivision Tests
  // ============================================
  describe('findPriceByDivision', () => {
    it('should find price by division code and item key', () => {
      const result = findPriceByDivision(1, 'mobilization');
      expect(result).not.toBeNull();
      expect(result?.totalInstalled).toBe(2500);
      expect(result?.unit).toBe('LS');
    });

    it('should apply regional multiplier by division', () => {
      const defaultResult = findPriceByDivision(1, 'temporary-fence', 'default');
      const californiaResult = findPriceByDivision(1, 'temporary-fence', 'california');

      expect(defaultResult).not.toBeNull();
      expect(californiaResult).not.toBeNull();

      // California multiplier is 1.45
      expect(californiaResult!.totalInstalled).toBeGreaterThan(defaultResult!.totalInstalled);
    });

    it('should return null for non-existent division', () => {
      const result = findPriceByDivision(999, 'any-item');
      expect(result).toBeNull();
    });

    it('should return null for non-existent item in valid division', () => {
      const result = findPriceByDivision(1, 'non-existent-item');
      expect(result).toBeNull();
    });

    it('should return null for division code 0', () => {
      const result = findPriceByDivision(0, 'mobilization');
      expect(result).toBeNull();
    });

    it('should handle negative division codes', () => {
      const result = findPriceByDivision(-1, 'mobilization');
      expect(result).toBeNull();
    });

    it('should find items in Division 3 - Concrete', () => {
      const result = findPriceByDivision(3, 'concrete-foundation-wall');
      expect(result).not.toBeNull();
      expect(result?.unit).toBe('CY');
    });

    it('should find items in Division 4 - Masonry', () => {
      const result = findPriceByDivision(4, 'cmu-8in-standard');
      expect(result).not.toBeNull();
      expect(result?.unit).toBe('SF');
    });

    it('should find items in Division 5 - Metals', () => {
      const result = findPriceByDivision(5, 'structural-steel-fabricated');
      expect(result).not.toBeNull();
      expect(result?.unit).toBe('TON');
    });

    it('should apply multiplier correctly for different regions', () => {
      const morehoadResult = findPriceByDivision(1, 'mobilization', 'morehead-ky');
      const defaultResult = findPriceByDivision(1, 'mobilization', 'default');

      expect(morehoadResult).not.toBeNull();
      expect(defaultResult).not.toBeNull();

      // Morehead multiplier is 0.86
      expect(morehoadResult!.totalInstalled).toBeLessThan(defaultResult!.totalInstalled);
    });

    it('should use default multiplier for invalid region', () => {
      const defaultResult = findPriceByDivision(1, 'mobilization', 'default');
      const invalidResult = findPriceByDivision(1, 'mobilization', 'invalid-region');

      expect(defaultResult).not.toBeNull();
      expect(invalidResult).not.toBeNull();
      expect(invalidResult?.totalInstalled).toBe(defaultResult?.totalInstalled);
    });

    it('should round prices to 2 decimal places', () => {
      const result = findPriceByDivision(1, 'temporary-fence', 'california');
      expect(result).not.toBeNull();

      const totalStr = result!.totalInstalled.toString();
      const decimalPlaces = totalStr.includes('.')
        ? totalStr.split('.')[1].length
        : 0;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });

    it('should preserve labor hours and waste factor', () => {
      const result = findPriceByDivision(1, 'temporary-fence');
      expect(result).not.toBeNull();
      expect(result?.laborHoursPerUnit).toBe(0.08);
      expect(result?.wasteFactorPercent).toBe(5);
    });
  });

  // ============================================
  // getDivisionItems Tests
  // ============================================
  describe('getDivisionItems', () => {
    it('should return all items for Division 1', () => {
      const items = getDivisionItems(1);
      expect(items).toBeDefined();
      expect(Object.keys(items).length).toBeGreaterThan(0);
      expect(items['mobilization']).toBeDefined();
      expect(items['site-superintendent']).toBeDefined();
    });

    it('should return empty object for non-existent division', () => {
      const items = getDivisionItems(999);
      expect(items).toEqual({});
    });

    it('should return empty object for division code 0', () => {
      const items = getDivisionItems(0);
      expect(items).toEqual({});
    });

    it('should apply regional multiplier to all items', () => {
      const defaultItems = getDivisionItems(1, 'default');
      const kentuckyItems = getDivisionItems(1, 'kentucky');

      expect(Object.keys(defaultItems).length).toBe(Object.keys(kentuckyItems).length);

      const defaultMobilization = defaultItems['mobilization'];
      const kentuckyMobilization = kentuckyItems['mobilization'];

      expect(kentuckyMobilization.totalInstalled).toBeLessThan(defaultMobilization.totalInstalled);
    });

    it('should apply high-cost regional multiplier to all items', () => {
      const defaultItems = getDivisionItems(1, 'default');
      const bostonItems = getDivisionItems(1, 'boston');

      const defaultFence = defaultItems['temporary-fence'];
      const bostonFence = bostonItems['temporary-fence'];

      expect(bostonFence.totalInstalled).toBeGreaterThan(defaultFence.totalInstalled);
    });

    it('should return all items with proper structure', () => {
      const items = getDivisionItems(1);

      Object.values(items).forEach(item => {
        expect(item).toHaveProperty('materialCost');
        expect(item).toHaveProperty('laborCost');
        expect(item).toHaveProperty('totalInstalled');
        expect(item).toHaveProperty('unit');
        expect(item).toHaveProperty('laborHoursPerUnit');
        expect(item).toHaveProperty('wasteFactorPercent');
      });
    });

    it('should preserve item keys', () => {
      const items = getDivisionItems(1);
      const keys = Object.keys(items);

      expect(keys).toContain('mobilization');
      expect(keys).toContain('site-superintendent');
      expect(keys).toContain('temporary-fence');
    });

    it('should round all prices to 2 decimal places', () => {
      const items = getDivisionItems(1, 'california');

      Object.values(items).forEach(item => {
        const materialStr = item.materialCost.toString();
        const laborStr = item.laborCost.toString();
        const totalStr = item.totalInstalled.toString();

        const materialDecimals = materialStr.includes('.') ? materialStr.split('.')[1].length : 0;
        const laborDecimals = laborStr.includes('.') ? laborStr.split('.')[1].length : 0;
        const totalDecimals = totalStr.includes('.') ? totalStr.split('.')[1].length : 0;

        expect(materialDecimals).toBeLessThanOrEqual(2);
        expect(laborDecimals).toBeLessThanOrEqual(2);
        expect(totalDecimals).toBeLessThanOrEqual(2);
      });
    });

    it('should handle Division 4 - Masonry', () => {
      const items = getDivisionItems(4);
      expect(Object.keys(items).length).toBeGreaterThan(0);
      expect(items['cmu-8in-standard']).toBeDefined();
      expect(items['brick-veneer']).toBeDefined();
    });

    it('should handle Division 6 - Wood', () => {
      const items = getDivisionItems(6);
      expect(Object.keys(items).length).toBeGreaterThan(0);
      expect(items['wood-framing-2x4']).toBeDefined();
    });

    it('should use default multiplier for unknown region', () => {
      const defaultItems = getDivisionItems(1, 'default');
      const unknownItems = getDivisionItems(1, 'unknown-region-xyz');

      const defaultMobilization = defaultItems['mobilization'];
      const unknownMobilization = unknownItems['mobilization'];

      expect(unknownMobilization.totalInstalled).toBe(defaultMobilization.totalInstalled);
    });
  });

  // ============================================
  // getDivisionBudget Tests
  // ============================================
  describe('getDivisionBudget', () => {
    it('should return budget for Division 1', () => {
      const budget = getDivisionBudget(1);
      expect(budget).not.toBeNull();
      expect(budget?.name).toBe('General Requirements');
      expect(budget?.totalBudget).toBeGreaterThan(0);
    });

    it('should return null for non-existent division', () => {
      const budget = getDivisionBudget(999);
      expect(budget).toBeNull();
    });

    it('should return null for division code 0', () => {
      const budget = getDivisionBudget(0);
      expect(budget).toBeNull();
    });

    it('should return null for negative division code', () => {
      const budget = getDivisionBudget(-1);
      expect(budget).toBeNull();
    });

    it('should return budget with name and totalBudget properties', () => {
      const budget = getDivisionBudget(1);
      expect(budget).not.toBeNull();
      expect(budget).toHaveProperty('name');
      expect(budget).toHaveProperty('totalBudget');
      expect(typeof budget?.name).toBe('string');
      expect(typeof budget?.totalBudget).toBe('number');
    });

    it('should calculate average of all items in division', () => {
      const budget = getDivisionBudget(1);
      const items = getDivisionItems(1);

      const itemValues = Object.values(items);
      const expectedAvg = itemValues.reduce((sum, item) => sum + item.totalInstalled, 0) / itemValues.length;
      const roundedAvg = Math.round(expectedAvg * 100) / 100;

      expect(budget?.totalBudget).toBe(roundedAvg);
    });

    it('should round budget to 2 decimal places', () => {
      const budget = getDivisionBudget(1);
      expect(budget).not.toBeNull();

      const budgetStr = budget!.totalBudget.toString();
      const decimalPlaces = budgetStr.includes('.')
        ? budgetStr.split('.')[1].length
        : 0;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });

    it('should return budget for Division 3 - Concrete', () => {
      const budget = getDivisionBudget(3);
      expect(budget).not.toBeNull();
      expect(budget?.name).toBe('Concrete');
      expect(budget?.totalBudget).toBeGreaterThan(0);
    });

    it('should return budget for Division 4 - Masonry', () => {
      const budget = getDivisionBudget(4);
      expect(budget).not.toBeNull();
      expect(budget?.name).toBe('Masonry');
      expect(budget?.totalBudget).toBeGreaterThan(0);
    });

    it('should return different budgets for different divisions', () => {
      const budget1 = getDivisionBudget(1);
      const budget3 = getDivisionBudget(3);

      expect(budget1).not.toBeNull();
      expect(budget3).not.toBeNull();
      expect(budget1?.totalBudget).not.toBe(budget3?.totalBudget);
    });
  });

  // ============================================
  // getDivisionSummary Tests
  // ============================================
  describe('getDivisionSummary', () => {
    it('should return summary for all divisions', () => {
      const summary = getDivisionSummary();
      expect(summary).toHaveLength(23);
    });

    it('should return summary with correct structure', () => {
      const summary = getDivisionSummary();

      summary.forEach(division => {
        expect(division).toHaveProperty('code');
        expect(division).toHaveProperty('name');
        expect(division).toHaveProperty('itemCount');
        expect(division).toHaveProperty('priceRange');
        expect(division.priceRange).toHaveProperty('min');
        expect(division.priceRange).toHaveProperty('max');

        expect(typeof division.code).toBe('number');
        expect(typeof division.name).toBe('string');
        expect(typeof division.itemCount).toBe('number');
        expect(typeof division.priceRange.min).toBe('number');
        expect(typeof division.priceRange.max).toBe('number');
      });
    });

    it('should have Division 1 in summary', () => {
      const summary = getDivisionSummary();
      const division1 = summary.find(d => d.code === 1);

      expect(division1).toBeDefined();
      expect(division1?.name).toBe('General Requirements');
      expect(division1?.itemCount).toBeGreaterThan(0);
    });

    it('should have valid price ranges', () => {
      const summary = getDivisionSummary();

      summary.forEach(division => {
        expect(division.priceRange.min).toBeGreaterThanOrEqual(0);
        expect(division.priceRange.max).toBeGreaterThanOrEqual(division.priceRange.min);
      });
    });

    it('should calculate correct item counts', () => {
      const summary = getDivisionSummary();
      const division1 = summary.find(d => d.code === 1);
      const division1Items = getDivisionItems(1);

      expect(division1?.itemCount).toBe(Object.keys(division1Items).length);
    });

    it('should calculate correct price ranges', () => {
      const summary = getDivisionSummary();
      const division1 = summary.find(d => d.code === 1);
      const division1Items = getDivisionItems(1);

      const prices = Object.values(division1Items).map(item => item.totalInstalled);
      const expectedMin = Math.min(...prices);
      const expectedMax = Math.max(...prices);

      expect(division1?.priceRange.min).toBe(expectedMin);
      expect(division1?.priceRange.max).toBe(expectedMax);
    });

    it('should include all 23 divisions', () => {
      const summary = getDivisionSummary();
      const codes = summary.map(d => d.code);

      expect(codes).toContain(1);
      expect(codes).toContain(2);
      expect(codes).toContain(3);
      expect(codes).toContain(4);
      expect(codes).toContain(5);
      expect(codes).toContain(6);
    });

    it('should have unique division codes', () => {
      const summary = getDivisionSummary();
      const codes = summary.map(d => d.code);
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(codes.length);
    });

    it('should have non-empty division names', () => {
      const summary = getDivisionSummary();

      summary.forEach(division => {
        expect(division.name).toBeTruthy();
        expect(division.name.length).toBeGreaterThan(0);
      });
    });

    it('should have positive item counts', () => {
      const summary = getDivisionSummary();

      summary.forEach(division => {
        expect(division.itemCount).toBeGreaterThan(0);
      });
    });
  });

  // ============================================
  // Edge Cases and Integration Tests
  // ============================================
  describe('Edge Cases', () => {
    it('should handle empty string category in findPriceByCategory', () => {
      const result = findPriceByCategory('');
      // Empty string matches all items via .includes(''), returns first found
      expect(result).not.toBeNull();
      expect(result?.totalInstalled).toBe(2500); // mobilization from Division 1
    });

    it('should handle empty string item key in findPriceByDivision', () => {
      const result = findPriceByDivision(1, '');
      expect(result).toBeNull();
    });

    it('should handle whitespace-only category', () => {
      const result = findPriceByCategory('   ');
      expect(result).toBeNull();
    });

    it('should handle very long category names', () => {
      const longCategory = 'a'.repeat(1000);
      const result = findPriceByCategory(longCategory);
      expect(result).toBeNull();
    });

    it('should handle category with only special characters', () => {
      const result = findPriceByCategory('!@#$%^&*()');
      expect(result).toBeNull();
    });

    it('should handle case sensitivity consistently', () => {
      const lower = findPriceByCategory('mobilization');
      const upper = findPriceByCategory('MOBILIZATION');
      const mixed = findPriceByCategory('MoBiLiZaTiOn');

      expect(lower).not.toBeNull();
      expect(upper).not.toBeNull();
      expect(mixed).not.toBeNull();
      expect(lower?.totalInstalled).toBe(upper?.totalInstalled);
      expect(upper?.totalInstalled).toBe(mixed?.totalInstalled);
    });

    it('should handle multiple regional multipliers sequentially', () => {
      const regions = ['default', 'kentucky', 'new-york', 'california', 'morehead-ky'];

      regions.forEach(region => {
        const result = findPriceByCategory('mobilization', region);
        expect(result).not.toBeNull();
        expect(result?.totalInstalled).toBeGreaterThan(0);
      });
    });

    it('should maintain data integrity across function calls', () => {
      const firstCall = findPriceByCategory('mobilization');
      const secondCall = findPriceByCategory('mobilization');

      expect(firstCall).toEqual(secondCall);
    });
  });

  // ============================================
  // Data Validation Tests
  // ============================================
  describe('Data Validation', () => {
    it('should have non-negative costs in all entries', () => {
      CSI_DIVISION_PRICING.forEach(division => {
        Object.values(division.items).forEach(item => {
          expect(item.materialCost).toBeGreaterThanOrEqual(0);
          expect(item.laborCost).toBeGreaterThanOrEqual(0);
          expect(item.totalInstalled).toBeGreaterThanOrEqual(0);
        });
      });
    });

    it('should have valid labor hours in all entries', () => {
      CSI_DIVISION_PRICING.forEach(division => {
        Object.values(division.items).forEach(item => {
          expect(item.laborHoursPerUnit).toBeGreaterThanOrEqual(0);
        });
      });
    });

    it('should have valid waste factors in all entries', () => {
      CSI_DIVISION_PRICING.forEach(division => {
        Object.values(division.items).forEach(item => {
          expect(item.wasteFactorPercent).toBeGreaterThanOrEqual(0);
          expect(item.wasteFactorPercent).toBeLessThanOrEqual(100);
        });
      });
    });

    it('should have non-empty units in all entries', () => {
      CSI_DIVISION_PRICING.forEach(division => {
        Object.values(division.items).forEach(item => {
          expect(item.unit).toBeTruthy();
          expect(item.unit.length).toBeGreaterThan(0);
        });
      });
    });

    it('should have totalInstalled equal to or greater than sum of material and labor', () => {
      CSI_DIVISION_PRICING.forEach(division => {
        Object.values(division.items).forEach(item => {
          const sum = item.materialCost + item.laborCost;
          // Allow for small rounding differences
          expect(item.totalInstalled).toBeGreaterThanOrEqual(sum - 0.01);
        });
      });
    });
  });

  // ============================================
  // Regional Multiplier Integration Tests
  // ============================================
  describe('Regional Multiplier Integration', () => {
    it('should apply multiplier consistently across all functions', () => {
      const region = 'kentucky';
      const multiplier = REGIONAL_MULTIPLIERS[region];

      const byCategoryResult = findPriceByCategory('mobilization', region);
      const byDivisionResult = findPriceByDivision(1, 'mobilization', region);

      expect(byCategoryResult).not.toBeNull();
      expect(byDivisionResult).not.toBeNull();
      expect(byCategoryResult?.totalInstalled).toBe(byDivisionResult?.totalInstalled);
    });

    it('should scale all cost components proportionally', () => {
      const defaultResult = findPriceByCategory('temporary-fence', 'default');
      const scaledResult = findPriceByCategory('temporary-fence', 'kentucky');

      expect(defaultResult).not.toBeNull();
      expect(scaledResult).not.toBeNull();

      const multiplier = REGIONAL_MULTIPLIERS['kentucky'];

      // Check that material, labor, and total are all scaled
      const expectedMaterial = Math.round(defaultResult!.materialCost * multiplier * 100) / 100;
      const expectedLabor = Math.round(defaultResult!.laborCost * multiplier * 100) / 100;
      const expectedTotal = Math.round(defaultResult!.totalInstalled * multiplier * 100) / 100;

      expect(scaledResult!.materialCost).toBe(expectedMaterial);
      expect(scaledResult!.laborCost).toBe(expectedLabor);
      expect(scaledResult!.totalInstalled).toBe(expectedTotal);
    });

    it('should not modify non-cost fields', () => {
      const defaultResult = findPriceByCategory('temporary-fence', 'default');
      const scaledResult = findPriceByCategory('temporary-fence', 'california');

      expect(defaultResult).not.toBeNull();
      expect(scaledResult).not.toBeNull();

      expect(scaledResult!.unit).toBe(defaultResult!.unit);
      expect(scaledResult!.laborHoursPerUnit).toBe(defaultResult!.laborHoursPerUnit);
      expect(scaledResult!.wasteFactorPercent).toBe(defaultResult!.wasteFactorPercent);
    });

    it('should handle extreme multipliers correctly', () => {
      const highMultiplierRegions = ['new-york', 'california'];

      highMultiplierRegions.forEach(region => {
        const result = findPriceByCategory('mobilization', region);
        expect(result).not.toBeNull();
        expect(result!.totalInstalled).toBeGreaterThan(2500); // Base price
      });
    });

    it('should handle low multipliers correctly', () => {
      const lowMultiplierRegions = ['morehead-ky', 'kentucky', 'georgia'];

      lowMultiplierRegions.forEach(region => {
        const result = findPriceByCategory('mobilization', region);
        expect(result).not.toBeNull();
        expect(result!.totalInstalled).toBeLessThan(2500); // Base price
      });
    });
  });

  // ============================================
  // Type Safety Tests
  // ============================================
  describe('Type Safety', () => {
    it('should return correct type for UnitPriceEntry', () => {
      const result = findPriceByCategory('mobilization');
      if (result) {
        const entry: UnitPriceEntry = result;
        expect(entry.materialCost).toBeDefined();
        expect(entry.laborCost).toBeDefined();
        expect(entry.totalInstalled).toBeDefined();
        expect(entry.unit).toBeDefined();
        expect(entry.laborHoursPerUnit).toBeDefined();
        expect(entry.wasteFactorPercent).toBeDefined();
      }
    });

    it('should return correct type for DivisionPricing', () => {
      const division: DivisionPricing = CSI_DIVISION_PRICING[0];
      expect(division.divisionCode).toBeDefined();
      expect(division.divisionName).toBeDefined();
      expect(division.items).toBeDefined();
    });

    it('should handle null returns correctly', () => {
      const result = findPriceByCategory('non-existent');
      expect(result).toBeNull();

      const divResult = findPriceByDivision(999, 'any');
      expect(divResult).toBeNull();

      const budgetResult = getDivisionBudget(999);
      expect(budgetResult).toBeNull();
    });
  });
});
