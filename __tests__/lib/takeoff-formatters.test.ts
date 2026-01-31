import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatQuantity,
  formatCSIDivision,
  formatForExport,
  getConfidenceColor,
} from '@/lib/takeoff-formatters';

describe('takeoff-formatters', () => {
  // ============================================
  // formatCurrency Tests
  // ============================================
  describe('formatCurrency', () => {
    it('should format basic currency amount', () => {
      const result = formatCurrency(1000);
      expect(result).toMatch(/^\$1,000\.00$/);
    });

    it('should format zero', () => {
      const result = formatCurrency(0);
      expect(result).toBe('$0.00');
    });

    it('should format decimal amounts', () => {
      const result = formatCurrency(1234.56);
      expect(result).toMatch(/^\$1,234\.56$/);
    });

    it('should format large amounts with commas', () => {
      const result = formatCurrency(1000000);
      expect(result).toMatch(/^\$1,000,000\.00$/);
    });

    it('should respect minimumFractionDigits option', () => {
      const result = formatCurrency(100, { minimumFractionDigits: 0 });
      // May or may not include decimals based on locale
      expect(result).toContain('$');
      expect(result).toContain('100');
    });

    it('should respect maximumFractionDigits option', () => {
      const result = formatCurrency(100.999, { maximumFractionDigits: 2 });
      // Should round to 2 decimal places
      expect(result).toMatch(/^\$101\.00$/);
    });

    it('should handle negative amounts', () => {
      const result = formatCurrency(-500);
      expect(result).toContain('500');
    });
  });

  // ============================================
  // formatQuantity Tests
  // ============================================
  describe('formatQuantity', () => {
    it('should format quantity with unit', () => {
      const result = formatQuantity(100, 'CY');
      expect(result).toBe('100 CY');
    });

    it('should format decimal quantities', () => {
      const result = formatQuantity(100.5, 'SF');
      expect(result).toBe('100.5 SF');
    });

    it('should format large quantities with commas', () => {
      const result = formatQuantity(10000, 'LF');
      expect(result).toMatch(/10,000 LF/);
    });

    it('should handle zero quantity', () => {
      const result = formatQuantity(0, 'EA');
      expect(result).toBe('0 EA');
    });

    it('should truncate long decimals', () => {
      const result = formatQuantity(100.12345, 'CY');
      // Should have at most 2 decimal places
      expect(result).toMatch(/^100\.12 CY$/);
    });
  });

  // ============================================
  // formatCSIDivision Tests
  // ============================================
  describe('formatCSIDivision', () => {
    it('should format single digit division with leading zero', () => {
      const result = formatCSIDivision(3, 'Concrete');
      expect(result).toBe('03 - Concrete');
    });

    it('should format double digit division', () => {
      const result = formatCSIDivision(10, 'Specialties');
      expect(result).toBe('10 - Specialties');
    });

    it('should handle division 0', () => {
      const result = formatCSIDivision(0, 'General Requirements');
      expect(result).toBe('00 - General Requirements');
    });

    it('should format all standard CSI divisions correctly', () => {
      const divisions = [
        { num: 1, name: 'General Requirements' },
        { num: 2, name: 'Site Construction' },
        { num: 3, name: 'Concrete' },
        { num: 5, name: 'Metals' },
        { num: 15, name: 'Mechanical' },
        { num: 16, name: 'Electrical' },
      ];

      divisions.forEach(({ num, name }) => {
        const result = formatCSIDivision(num, name);
        expect(result).toMatch(/^\d{2} - .+$/);
      });
    });
  });

  // ============================================
  // formatForExport Tests
  // ============================================
  describe('formatForExport', () => {
    it('should return empty array for empty input', () => {
      const result = formatForExport([]);
      expect(result).toHaveLength(0);
    });

    it('should format single item for export', () => {
      const items = [
        {
          category: 'Concrete',
          itemName: 'Foundation',
          description: 'Building foundation',
          quantity: 100,
          unit: 'CY',
          unitCost: 150,
          totalCost: 15000,
          location: 'Building A',
          verified: true,
        },
      ];
      const result = formatForExport(items);

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('Concrete');
      expect(result[0].itemName).toBe('Foundation');
      expect(result[0].description).toBe('Building foundation');
      expect(result[0].quantity).toBe('100');
      expect(result[0].unit).toBe('CY');
      expect(result[0].unitCost).toContain('$150');
      expect(result[0].totalCost).toContain('$15,000');
      expect(result[0].location).toBe('Building A');
      expect(result[0].verified).toBe('Yes');
    });

    it('should handle missing optional fields', () => {
      const items = [
        {
          category: 'Steel',
          itemName: 'Rebar',
          quantity: 50,
          unit: 'TN',
          verified: false,
        },
      ];
      const result = formatForExport(items);

      expect(result[0].description).toBe('');
      expect(result[0].unitCost).toBe('');
      expect(result[0].totalCost).toBe('');
      expect(result[0].location).toBe('');
      expect(result[0].verified).toBe('No');
    });

    it('should format verified field correctly', () => {
      const items = [
        { category: 'A', itemName: 'A', quantity: 1, unit: 'EA', verified: true },
        { category: 'B', itemName: 'B', quantity: 1, unit: 'EA', verified: false },
      ];
      const result = formatForExport(items);

      expect(result[0].verified).toBe('Yes');
      expect(result[1].verified).toBe('No');
    });

    it('should handle empty category and itemName', () => {
      const items = [
        {
          category: '',
          itemName: '',
          quantity: 10,
          unit: 'EA',
          verified: false,
        },
      ];
      const result = formatForExport(items);

      expect(result[0].category).toBe('');
      expect(result[0].itemName).toBe('');
    });
  });

  // ============================================
  // getConfidenceColor Tests
  // ============================================
  describe('getConfidenceColor', () => {
    it('should return gray for undefined confidence', () => {
      const result = getConfidenceColor(undefined);
      expect(result).toBe('text-gray-500');
    });

    it('should return green for high confidence (0-1 scale)', () => {
      expect(getConfidenceColor(0.8)).toBe('text-green-500');
      expect(getConfidenceColor(0.9)).toBe('text-green-500');
      expect(getConfidenceColor(1.0)).toBe('text-green-500');
    });

    it('should return green for high confidence (0-100 scale)', () => {
      expect(getConfidenceColor(80)).toBe('text-green-500');
      expect(getConfidenceColor(90)).toBe('text-green-500');
      expect(getConfidenceColor(100)).toBe('text-green-500');
    });

    it('should return yellow for medium-high confidence', () => {
      expect(getConfidenceColor(0.6)).toBe('text-yellow-500');
      expect(getConfidenceColor(0.79)).toBe('text-yellow-500');
      expect(getConfidenceColor(60)).toBe('text-yellow-500');
      expect(getConfidenceColor(79)).toBe('text-yellow-500');
    });

    it('should return orange for medium-low confidence', () => {
      expect(getConfidenceColor(0.4)).toBe('text-orange-500');
      expect(getConfidenceColor(0.59)).toBe('text-orange-500');
      expect(getConfidenceColor(40)).toBe('text-orange-500');
      expect(getConfidenceColor(59)).toBe('text-orange-500');
    });

    it('should return red for low confidence', () => {
      expect(getConfidenceColor(0.0)).toBe('text-red-500');
      expect(getConfidenceColor(0.39)).toBe('text-red-500');
      expect(getConfidenceColor(0)).toBe('text-red-500');
      expect(getConfidenceColor(39)).toBe('text-red-500');
    });

    it('should handle boundary values correctly', () => {
      // Exact boundaries
      expect(getConfidenceColor(0.8)).toBe('text-green-500');  // >= 80
      expect(getConfidenceColor(0.6)).toBe('text-yellow-500'); // >= 60
      expect(getConfidenceColor(0.4)).toBe('text-orange-500'); // >= 40
    });
  });
});
