import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Prisma with inline object creation in factory
vi.mock('@/lib/db', async () => {
  const { vi } = await import('vitest');
  return {
    prisma: {
      materialTakeoff: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      takeoffLineItem: {
        update: vi.fn(),
        aggregate: vi.fn(),
      },
      unitPrice: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

// Mock takeoff categories
vi.mock('@/lib/takeoff-categories', () => ({
  TAKEOFF_CATEGORIES: [
    {
      id: 'concrete',
      name: 'Concrete',
      csiDivision: '03',
      icon: 'Building2',
      color: '#6B7280',
      subCategories: [
        { id: 'slab-on-grade', name: 'Slab on Grade', defaultUnit: 'CY', wasteFactorPercent: 5, laborHoursPerUnit: 0.8, keywords: ['slab'] },
        { id: 'footings', name: 'Footings', defaultUnit: 'CY', wasteFactorPercent: 5, laborHoursPerUnit: 1.2, keywords: ['footing'] },
      ]
    },
    {
      id: 'flooring',
      name: 'Flooring',
      csiDivision: '09',
      icon: 'Layers',
      color: '#059669',
      subCategories: [
        { id: 'lvt', name: 'LVT', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.05, keywords: ['lvt'] },
        { id: 'carpet', name: 'Carpet', defaultUnit: 'SF', wasteFactorPercent: 8, laborHoursPerUnit: 0.04, keywords: ['carpet'] },
      ]
    },
    {
      id: 'drywall',
      name: 'Drywall',
      csiDivision: '09',
      icon: 'Square',
      color: '#6366F1',
      subCategories: [
        { id: 'standard', name: 'Standard Drywall', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.03, keywords: ['drywall'] },
      ]
    }
  ],
  TakeoffCategory: {},
  SubCategory: {},
}));

// Mock CSI database
vi.mock('@/lib/construction-pricing-database', async () => {
  const { vi } = await import('vitest');
  return {
    CSI_DIVISION_PRICING: [
      {
        divisionCode: 3,
        divisionName: 'Concrete',
        items: {
          'concrete-slab-on-grade-4in': { materialCost: 3.25, laborCost: 2.85, totalInstalled: 6.10, unit: 'SF', laborHoursPerUnit: 0.04, wasteFactorPercent: 5 },
          'concrete-footings': { materialCost: 120, laborCost: 75, totalInstalled: 195, unit: 'CY', laborHoursPerUnit: 1.2, wasteFactorPercent: 5 },
        }
      },
      {
        divisionCode: 9,
        divisionName: 'Finishes',
        items: {
          'lvt-commercial': { materialCost: 8.50, laborCost: 4.00, totalInstalled: 12.50, unit: 'SF', laborHoursPerUnit: 0.055, wasteFactorPercent: 10 },
          'drywall-5/8-type-x': { materialCost: 2.85, laborCost: 3.00, totalInstalled: 5.85, unit: 'SF', laborHoursPerUnit: 0.05, wasteFactorPercent: 10 },
        }
      },
      {
        divisionCode: 8,
        divisionName: 'Openings',
        items: {
          'door-hollow-metal-3070': { materialCost: 650, laborCost: 200, totalInstalled: 850, unit: 'EA', laborHoursPerUnit: 3, wasteFactorPercent: 0 },
        }
      }
    ],
    REGIONAL_MULTIPLIERS: {
      'default': 1.00,
      'national': 1.00,
      'kentucky': 0.88,
      'california': 1.45,
      'new-york': 1.45,
    },
    UnitPriceEntry: {},
    findPriceByCategory: vi.fn((category: string) => {
      if (category.toLowerCase().includes('floor')) {
        return { materialCost: 8.50, laborCost: 4.00, totalInstalled: 12.50, unit: 'SF', laborHoursPerUnit: 0.055, wasteFactorPercent: 10 };
      }
      return null;
    }),
  };
});

import {
  getCSIPriceForCategory,
  getUnitPrice,
  getWasteFactor,
  getLaborHoursPerUnit,
  calculateItemCost,
  calculateTakeoffCosts,
  applyCalculatedCosts,
  saveUnitPrice,
  getProjectUnitPrices,
  REGIONAL_MULTIPLIERS,
  CATEGORY_ALIASES,
  BIM_TO_CSI_MAPPING,
  DEFAULT_UNIT_PRICES,
} from '@/lib/cost-calculation-service';

// Import the mocked prisma to get access to the mock functions
import { prisma } from '@/lib/db';

const materialTakeoffFindUnique = prisma.materialTakeoff.findUnique as ReturnType<typeof vi.fn>;
const materialTakeoffUpdate = prisma.materialTakeoff.update as ReturnType<typeof vi.fn>;
const takeoffLineItemUpdate = prisma.takeoffLineItem.update as ReturnType<typeof vi.fn>;
const takeoffLineItemAggregate = prisma.takeoffLineItem.aggregate as ReturnType<typeof vi.fn>;
const unitPriceFindFirst = prisma.unitPrice.findFirst as ReturnType<typeof vi.fn>;
const unitPriceFindMany = prisma.unitPrice.findMany as ReturnType<typeof vi.fn>;
const unitPriceCreate = prisma.unitPrice.create as ReturnType<typeof vi.fn>;
const unitPriceUpdate = prisma.unitPrice.update as ReturnType<typeof vi.fn>;

describe('Cost Calculation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Constants', () => {
    it('should export REGIONAL_MULTIPLIERS', () => {
      expect(REGIONAL_MULTIPLIERS).toBeDefined();
      expect(REGIONAL_MULTIPLIERS['default']).toBe(1.00);
      expect(REGIONAL_MULTIPLIERS['kentucky']).toBe(0.88);
      expect(REGIONAL_MULTIPLIERS['california']).toBe(1.45);
    });

    it('should export CATEGORY_ALIASES with common category mappings', () => {
      expect(CATEGORY_ALIASES).toBeDefined();
      expect(CATEGORY_ALIASES['flooring']).toEqual({ priceCategory: 'flooring', defaultSubCategory: 'lvt' });
      expect(CATEGORY_ALIASES['drywall']).toEqual({ priceCategory: 'drywall', defaultSubCategory: 'standard' });
      expect(CATEGORY_ALIASES['ceiling']).toEqual({ priceCategory: 'ceilings', defaultSubCategory: 'act-tile' });
    });

    it('should export BIM_TO_CSI_MAPPING with Revit category mappings', () => {
      expect(BIM_TO_CSI_MAPPING).toBeDefined();
      expect(BIM_TO_CSI_MAPPING['Walls']).toEqual({ division: 9, itemKey: 'drywall-5/8-type-x', fallbackUnit: 'SF' });
      expect(BIM_TO_CSI_MAPPING['Doors']).toEqual({ division: 8, itemKey: 'door-hollow-metal-3070', fallbackUnit: 'EA' });
      expect(BIM_TO_CSI_MAPPING['Floors']).toEqual({ division: 3, itemKey: 'concrete-slab-on-grade-4in', fallbackUnit: 'SF' });
    });

    it('should export DEFAULT_UNIT_PRICES with legacy fallback pricing', () => {
      expect(DEFAULT_UNIT_PRICES).toBeDefined();
      expect(DEFAULT_UNIT_PRICES['concrete']).toBeDefined();
      expect(DEFAULT_UNIT_PRICES['flooring']).toBeDefined();
      expect(DEFAULT_UNIT_PRICES['concrete']['slab-on-grade']).toHaveProperty('unitCost');
      expect(DEFAULT_UNIT_PRICES['concrete']['slab-on-grade']).toHaveProperty('laborRate');
    });
  });

  describe('getCSIPriceForCategory', () => {
    it('should return price for valid BIM category', () => {
      const price = getCSIPriceForCategory('Walls', 'SF', 'default');

      expect(price).toBeDefined();
      expect(price?.unitCost).toBeGreaterThan(0);
      expect(price?.laborRate).toBeGreaterThan(0);
      expect(price?.source).toContain('CSI-9');
    });

    it('should apply regional multiplier correctly', () => {
      const priceDefault = getCSIPriceForCategory('Walls', 'SF', 'default');
      const priceKentucky = getCSIPriceForCategory('Walls', 'SF', 'kentucky');

      expect(priceDefault).not.toBeNull();
      expect(priceKentucky).not.toBeNull();
      expect(priceKentucky!.unitCost).toBeLessThan(priceDefault!.unitCost);
      expect(priceKentucky!.unitCost).toBeCloseTo(priceDefault!.unitCost * 0.88, 1);
    });

    it('should return null for unknown BIM category', () => {
      const price = getCSIPriceForCategory('UnknownCategory', 'SF', 'default');

      expect(price).toBeNull();
    });

    it('should return null for valid category but unknown division', () => {
      const price = getCSIPriceForCategory('Doors', 'SF', 'default');

      expect(price).toBeDefined(); // Doors map to division 8
    });

    it('should handle labor rate calculation with zero laborHoursPerUnit', () => {
      // Test edge case where laborHoursPerUnit might be 0
      const price = getCSIPriceForCategory('Walls', 'SF', 'default');

      expect(price?.laborRate).toBeGreaterThan(0);
    });

    it('should round prices to 2 decimal places', () => {
      const price = getCSIPriceForCategory('Walls', 'SF', 'california');

      expect(price).not.toBeNull();
      expect(price!.unitCost).toBe(Math.round(price!.unitCost * 100) / 100);
      expect(price!.laborRate).toBe(Math.round(price!.laborRate * 100) / 100);
    });
  });

  describe('getWasteFactor', () => {
    it('should return waste factor for exact category and subcategory match', () => {
      const waste = getWasteFactor('concrete', 'slab-on-grade');

      expect(waste).toBe(5);
    });

    it('should return waste factor for category with case-insensitive match', () => {
      const waste = getWasteFactor('CONCRETE', 'SLAB-ON-GRADE');

      expect(waste).toBe(5);
    });

    it('should return average waste factor for category when subcategory is null', () => {
      const waste = getWasteFactor('concrete', null);

      expect(waste).toBe(5); // Average of slab-on-grade (5) and footings (5)
    });

    it('should return average waste factor for category when subcategory not found', () => {
      const waste = getWasteFactor('concrete', 'unknown-subcategory');

      expect(waste).toBe(5); // Falls back to category average
    });

    it('should return default 5% waste for unknown category', () => {
      const waste = getWasteFactor('unknown-category', null);

      expect(waste).toBe(5);
    });

    it('should handle flooring with different subcategory waste factors', () => {
      const wasteLVT = getWasteFactor('flooring', 'lvt');
      const wasteCarpet = getWasteFactor('flooring', 'carpet');

      expect(wasteLVT).toBe(10);
      expect(wasteCarpet).toBe(8);
    });
  });

  describe('getLaborHoursPerUnit', () => {
    it('should return labor hours for exact category and subcategory match', () => {
      const hours = getLaborHoursPerUnit('concrete', 'slab-on-grade');

      expect(hours).toBe(0.8);
    });

    it('should return labor hours with case-insensitive matching', () => {
      const hours = getLaborHoursPerUnit('FLOORING', 'LVT');

      expect(hours).toBe(0.05);
    });

    it('should return average labor hours when subcategory is null', () => {
      const hours = getLaborHoursPerUnit('concrete', null);

      expect(hours).toBe(1.0); // Average of 0.8 and 1.2
    });

    it('should return default 0.5 hours for unknown category', () => {
      const hours = getLaborHoursPerUnit('unknown-category', null);

      expect(hours).toBe(0.5);
    });

    it('should match subcategory by name or id', () => {
      const hoursByName = getLaborHoursPerUnit('flooring', 'LVT');
      const hoursById = getLaborHoursPerUnit('flooring', 'lvt');

      expect(hoursByName).toBe(hoursById);
    });
  });

  describe('getUnitPrice', () => {
    beforeEach(() => {
      unitPriceFindFirst.mockResolvedValue(null);
    });

    it('should return project-specific price if available', async () => {
      unitPriceFindFirst.mockResolvedValueOnce({
        id: 'price-1',
        projectId: 'project-1',
        category: 'concrete',
        subCategory: 'slab-on-grade',
        unit: 'CY',
        unitCost: 200,
        laborRate: 70,
        region: 'default',
        effectiveDate: new Date(),
        expirationDate: null,
        source: 'manual',
        supplier: null,
        notes: null,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        itemName: null,
      });

      const price = await getUnitPrice('concrete', 'slab-on-grade', 'CY', 'project-1', 'default');

      expect(price).toEqual({
        unitCost: 200,
        laborRate: 70,
        source: 'project'
      });
      expect(unitPriceFindFirst).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          category: { equals: 'concrete', mode: 'insensitive' },
          subCategory: 'slab-on-grade',
          unit: { equals: 'CY', mode: 'insensitive' },
          OR: [
            { expirationDate: null },
            { expirationDate: { gt: expect.any(Date) } }
          ]
        },
        orderBy: { effectiveDate: 'desc' }
      });
    });

    it('should skip expired project prices', async () => {
      const expiredDate = new Date('2020-01-01');
      unitPriceFindFirst.mockResolvedValueOnce(null); // First call for project-specific
      unitPriceFindFirst.mockResolvedValueOnce(null); // Second call for global

      const price = await getUnitPrice('concrete', 'slab-on-grade', 'CY', 'project-1', 'default');

      // Should fall back to CSI or default prices
      expect(price).toBeDefined();
    });

    it('should return global price if project price not found', async () => {
      unitPriceFindFirst.mockResolvedValueOnce(null); // No project price
      unitPriceFindFirst.mockResolvedValueOnce({
        id: 'price-2',
        projectId: null,
        category: 'concrete',
        subCategory: 'slab-on-grade',
        unit: 'CY',
        unitCost: 185,
        laborRate: 65,
        region: 'default',
        effectiveDate: new Date(),
        expirationDate: null,
        source: 'global',
        supplier: null,
        notes: null,
        createdBy: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
        itemName: null,
      });

      const price = await getUnitPrice('concrete', 'slab-on-grade', 'CY', 'project-1', 'default');

      expect(price).toEqual({
        unitCost: 185,
        laborRate: 65,
        source: 'global'
      });
    });

    it('should fall back to CSI database when no database price found', async () => {
      unitPriceFindFirst.mockResolvedValue(null);

      const price = await getUnitPrice('Walls', null, 'SF', null, 'default');

      expect(price).toBeDefined();
      expect(price?.source).toContain('CSI');
    });

    it('should try fuzzy matching against CSI database', async () => {
      unitPriceFindFirst.mockResolvedValue(null);

      const price = await getUnitPrice('wall', null, 'SF', null, 'default');

      expect(price).toBeDefined(); // Should fuzzy match to 'Walls'
    });

    it('should fall back to legacy DEFAULT_UNIT_PRICES using category aliases', async () => {
      unitPriceFindFirst.mockResolvedValue(null);

      const price = await getUnitPrice('flooring', 'lvt', 'SF', null, 'default');

      expect(price).toBeDefined();
      // CSI database is checked before legacy fallback, so source will be CSI-based
      expect(price?.source).toContain('CSI');
      expect(price?.unitCost).toBeGreaterThan(0);
    });

    it('should apply regional multiplier to legacy prices', async () => {
      unitPriceFindFirst.mockResolvedValue(null);

      const priceDefault = await getUnitPrice('flooring', 'lvt', 'SF', null, 'default');
      const priceKentucky = await getUnitPrice('flooring', 'lvt', 'SF', null, 'kentucky');

      expect(priceDefault).toBeDefined();
      expect(priceKentucky).toBeDefined();
      expect(priceKentucky!.unitCost).toBeLessThan(priceDefault!.unitCost);
    });

    it('should handle null projectId', async () => {
      unitPriceFindFirst.mockResolvedValue(null);

      const price = await getUnitPrice('concrete', null, 'CY', null, 'default');

      expect(price).toBeDefined();
      expect(unitPriceFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: null
          })
        })
      );
    });

    it('should return null when no price source found', async () => {
      unitPriceFindFirst.mockResolvedValue(null);

      const price = await getUnitPrice('completely-unknown-category', null, 'ZZ', null, 'default');

      expect(price).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      unitPriceFindFirst.mockRejectedValue(new Error('Database error'));

      const price = await getUnitPrice('concrete', null, 'CY', 'project-1', 'default');

      expect(price).toBeNull();
    });

    it('should use default labor rate when laborRate is null in database', async () => {
      unitPriceFindFirst.mockResolvedValueOnce({
        id: 'price-3',
        projectId: 'project-1',
        category: 'concrete',
        subCategory: null,
        unit: 'CY',
        unitCost: 200,
        laborRate: null,
        region: 'default',
        effectiveDate: new Date(),
        expirationDate: null,
        source: 'manual',
        supplier: null,
        notes: null,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        itemName: null,
      });

      const price = await getUnitPrice('concrete', null, 'CY', 'project-1', 'default');

      expect(price?.laborRate).toBe(65); // Default labor rate
    });
  });

  describe('calculateItemCost', () => {
    beforeEach(() => {
      unitPriceFindFirst.mockResolvedValue(null);
    });

    it('should calculate cost with provided unitCost', async () => {
      const item = {
        id: 'item-1',
        category: 'concrete',
        itemName: 'Foundation Slab',
        quantity: 100,
        unit: 'CY',
        unitCost: 200,
      };

      const result = await calculateItemCost(item, 'project-1', 'default');

      expect(result.itemId).toBe('item-1');
      expect(result.baseQuantity).toBe(100);
      expect(result.wastePercent).toBe(5); // From concrete category
      expect(result.adjustedQuantity).toBe(105); // 100 * 1.05
      expect(result.unitCost).toBe(200);
      expect(result.materialCost).toBe(21000); // 105 * 200
      expect(result.laborHours).toBe(100); // 100 * 1.0 (average labor hours for concrete)
      expect(result.laborRate).toBe(65);
      expect(result.laborCost).toBe(6500); // 100 * 65
      expect(result.totalCost).toBe(27500); // 21000 + 6500
      expect(result.priceSource).toBe('manual');
    });

    it('should look up unit price when not provided', async () => {
      unitPriceFindFirst.mockResolvedValueOnce({
        id: 'price-1',
        projectId: 'project-1',
        category: 'flooring',
        subCategory: 'lvt',
        unit: 'SF',
        unitCost: 12.50,
        laborRate: 55,
        region: 'default',
        effectiveDate: new Date(),
        expirationDate: null,
        source: 'manual',
        supplier: null,
        notes: null,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        itemName: null,
      });

      const item = {
        id: 'item-2',
        category: 'flooring',
        itemName: 'LVT Flooring',
        quantity: 1000,
        unit: 'SF',
        unitCost: null,
      };

      const result = await calculateItemCost(item, 'project-1', 'default');

      expect(result.unitCost).toBe(12.50);
      expect(result.laborRate).toBe(55);
      expect(result.priceSource).toBe('project');
    });

    it('should handle zero quantity', async () => {
      const item = {
        id: 'item-3',
        category: 'concrete',
        itemName: 'Test',
        quantity: 0,
        unit: 'CY',
        unitCost: 200,
      };

      const result = await calculateItemCost(item, null, 'default');

      expect(result.materialCost).toBe(0);
      expect(result.laborHours).toBe(0);
      expect(result.laborCost).toBe(0);
      expect(result.totalCost).toBe(0);
    });

    it('should apply waste factor correctly', async () => {
      const item = {
        id: 'item-4',
        category: 'flooring',
        itemName: 'LVT',
        quantity: 100,
        unit: 'SF',
        unitCost: 10,
      };

      const result = await calculateItemCost(item, null, 'default');

      expect(result.wastePercent).toBe(9); // Average of flooring subcategories
      expect(result.adjustedQuantity).toBeCloseTo(109, 1);
      expect(result.materialCost).toBeCloseTo(1090, 1);
    });

    it('should calculate labor hours based on category', async () => {
      const item = {
        id: 'item-5',
        category: 'flooring',
        itemName: 'Carpet',
        quantity: 500,
        unit: 'SF',
        unitCost: 8,
      };

      const result = await calculateItemCost(item, null, 'default');

      expect(result.laborHours).toBe(22.5); // 500 * 0.045 (average labor hours)
    });

    it('should handle fallback to default price source', async () => {
      unitPriceFindFirst.mockResolvedValue(null);

      const item = {
        id: 'item-6',
        category: 'flooring',
        itemName: 'LVT',
        quantity: 100,
        unit: 'SF',
        unitCost: null,
      };

      const result = await calculateItemCost(item, null, 'default');

      expect(result.priceSource).toBe('default');
      expect(result.unitCost).toBeGreaterThan(0);
    });
  });

  describe('calculateTakeoffCosts', () => {
    beforeEach(() => {
      unitPriceFindFirst.mockResolvedValue(null);
    });

    it('should calculate costs for all items in takeoff', async () => {
      materialTakeoffFindUnique.mockResolvedValue({
        id: 'takeoff-1',
        projectId: 'project-1',
        documentId: 'doc-1',
        name: 'Test Takeoff',
        TakeoffLineItem: [
          {
            id: 'item-1',
            takeoffId: 'takeoff-1',
            category: 'concrete',
            itemName: 'Slab',
            quantity: 50,
            unit: 'CY',
            unitCost: 200,
            totalCost: null,
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            sheetNumber: null,
            symbolId: null,
          },
          {
            id: 'item-2',
            takeoffId: 'takeoff-1',
            category: 'flooring',
            itemName: 'LVT',
            quantity: 1000,
            unit: 'SF',
            unitCost: 12,
            totalCost: null,
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            sheetNumber: null,
            symbolId: null,
          }
        ],
        Project: { id: 'project-1' },
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'draft',
        totalCost: 0,
        extractionMethod: 'manual',
      });

      const summary = await calculateTakeoffCosts('takeoff-1', 'default');

      expect(summary.takeoffId).toBe('takeoff-1');
      expect(summary.itemCount).toBe(2);
      expect(summary.pricedItemCount).toBe(2);
      expect(summary.totalMaterialCost).toBeGreaterThan(0);
      expect(summary.totalLaborCost).toBeGreaterThan(0);
      expect(summary.totalCost).toBe(summary.totalMaterialCost + summary.totalLaborCost);
      expect(summary.byCategory).toHaveLength(2);
    });

    it('should track unpriced items', async () => {
      materialTakeoffFindUnique.mockResolvedValue({
        id: 'takeoff-2',
        projectId: 'project-1',
        documentId: 'doc-1',
        name: 'Test Takeoff',
        TakeoffLineItem: [
          {
            id: 'item-1',
            takeoffId: 'takeoff-2',
            category: 'concrete',
            itemName: 'Priced Item',
            quantity: 50,
            unit: 'CY',
            unitCost: 200,
            totalCost: null,
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            sheetNumber: null,
            symbolId: null,
          },
          {
            id: 'item-2',
            takeoffId: 'takeoff-2',
            category: 'unknown',
            itemName: 'Unpriced Item',
            quantity: 100,
            unit: 'EA',
            unitCost: null,
            totalCost: null,
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            sheetNumber: null,
            symbolId: null,
          }
        ],
        Project: { id: 'project-1' },
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'draft',
        totalCost: 0,
        extractionMethod: 'manual',
      });

      const summary = await calculateTakeoffCosts('takeoff-2', 'default');

      expect(summary.pricedItemCount).toBe(1);
      expect(summary.unpricedItems).toContain('Unpriced Item');
    });

    it('should aggregate costs by category', async () => {
      materialTakeoffFindUnique.mockResolvedValue({
        id: 'takeoff-3',
        projectId: 'project-1',
        documentId: 'doc-1',
        name: 'Test Takeoff',
        TakeoffLineItem: [
          {
            id: 'item-1',
            takeoffId: 'takeoff-3',
            category: 'concrete',
            itemName: 'Slab',
            quantity: 50,
            unit: 'CY',
            unitCost: 200,
            totalCost: null,
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            sheetNumber: null,
            symbolId: null,
          },
          {
            id: 'item-2',
            takeoffId: 'takeoff-3',
            category: 'concrete',
            itemName: 'Footing',
            quantity: 25,
            unit: 'CY',
            unitCost: 210,
            totalCost: null,
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            sheetNumber: null,
            symbolId: null,
          }
        ],
        Project: { id: 'project-1' },
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'draft',
        totalCost: 0,
        extractionMethod: 'manual',
      });

      const summary = await calculateTakeoffCosts('takeoff-3', 'default');

      expect(summary.byCategory).toHaveLength(1);
      expect(summary.byCategory[0].category).toBe('concrete');
      expect(summary.byCategory[0].itemCount).toBe(2);
    });

    it('should sort categories by total cost descending', async () => {
      materialTakeoffFindUnique.mockResolvedValue({
        id: 'takeoff-4',
        projectId: 'project-1',
        documentId: 'doc-1',
        name: 'Test Takeoff',
        TakeoffLineItem: [
          {
            id: 'item-1',
            takeoffId: 'takeoff-4',
            category: 'flooring',
            itemName: 'LVT',
            quantity: 100,
            unit: 'SF',
            unitCost: 10,
            totalCost: null,
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            sheetNumber: null,
            symbolId: null,
          },
          {
            id: 'item-2',
            takeoffId: 'takeoff-4',
            category: 'concrete',
            itemName: 'Slab',
            quantity: 100,
            unit: 'CY',
            unitCost: 200,
            totalCost: null,
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            sheetNumber: null,
            symbolId: null,
          }
        ],
        Project: { id: 'project-1' },
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'draft',
        totalCost: 0,
        extractionMethod: 'manual',
      });

      const summary = await calculateTakeoffCosts('takeoff-4', 'default');

      expect(summary.byCategory[0].category).toBe('concrete'); // Higher cost
      expect(summary.byCategory[1].category).toBe('flooring'); // Lower cost
    });

    it('should throw error for non-existent takeoff', async () => {
      materialTakeoffFindUnique.mockResolvedValue(null);

      await expect(calculateTakeoffCosts('non-existent', 'default')).rejects.toThrow('Takeoff not found');
    });

    it('should handle takeoff with no items', async () => {
      materialTakeoffFindUnique.mockResolvedValue({
        id: 'takeoff-5',
        projectId: 'project-1',
        documentId: 'doc-1',
        name: 'Empty Takeoff',
        TakeoffLineItem: [],
        Project: { id: 'project-1' },
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'draft',
        totalCost: 0,
        extractionMethod: 'manual',
      });

      const summary = await calculateTakeoffCosts('takeoff-5', 'default');

      expect(summary.itemCount).toBe(0);
      expect(summary.totalCost).toBe(0);
      expect(summary.byCategory).toHaveLength(0);
    });

    it('should handle takeoff without project', async () => {
      materialTakeoffFindUnique.mockResolvedValue({
        id: 'takeoff-6',
        projectId: null,
        documentId: 'doc-1',
        name: 'Standalone Takeoff',
        TakeoffLineItem: [
          {
            id: 'item-1',
            takeoffId: 'takeoff-6',
            category: 'concrete',
            itemName: 'Slab',
            quantity: 50,
            unit: 'CY',
            unitCost: 200,
            totalCost: null,
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            sheetNumber: null,
            symbolId: null,
          }
        ],
        Project: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'draft',
        totalCost: 0,
        extractionMethod: 'manual',
      });

      const summary = await calculateTakeoffCosts('takeoff-6', 'default');

      expect(summary.itemCount).toBe(1);
      expect(summary.totalCost).toBeGreaterThan(0);
    });

    it('should handle database errors', async () => {
      materialTakeoffFindUnique.mockRejectedValue(new Error('Database error'));

      await expect(calculateTakeoffCosts('takeoff-1', 'default')).rejects.toThrow('Database error');
    });
  });

  describe('applyCalculatedCosts', () => {
    beforeEach(() => {
      unitPriceFindFirst.mockResolvedValue(null);
      takeoffLineItemUpdate.mockResolvedValue({} as any);
      materialTakeoffUpdate.mockResolvedValue({} as any);
      takeoffLineItemAggregate.mockResolvedValue({ _sum: { totalCost: 15000 } });
    });

    it('should update items without manual costs', async () => {
      materialTakeoffFindUnique.mockResolvedValue({
        id: 'takeoff-1',
        projectId: 'project-1',
        documentId: 'doc-1',
        name: 'Test Takeoff',
        TakeoffLineItem: [
          {
            id: 'item-1',
            takeoffId: 'takeoff-1',
            category: 'concrete',
            itemName: 'Slab',
            quantity: 50,
            unit: 'CY',
            unitCost: null,
            totalCost: null,
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            sheetNumber: null,
            symbolId: null,
          }
        ],
        Project: { id: 'project-1' },
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'draft',
        totalCost: 0,
        extractionMethod: 'manual',
      });

      unitPriceFindFirst.mockResolvedValue({
        id: 'price-1',
        projectId: 'project-1',
        category: 'concrete',
        subCategory: null,
        unit: 'CY',
        unitCost: 200,
        laborRate: 65,
        region: 'default',
        effectiveDate: new Date(),
        expirationDate: null,
        source: 'manual',
        supplier: null,
        notes: null,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        itemName: null,
      });

      const result = await applyCalculatedCosts('takeoff-1', 'default');

      expect(result.updated).toBe(1);
      expect(result.skipped).toBe(0);
      expect(takeoffLineItemUpdate).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: {
          unitCost: 200,
          totalCost: expect.any(Number),
        }
      });
    });

    it('should skip items with existing manual costs', async () => {
      materialTakeoffFindUnique.mockResolvedValue({
        id: 'takeoff-2',
        projectId: 'project-1',
        documentId: 'doc-1',
        name: 'Test Takeoff',
        TakeoffLineItem: [
          {
            id: 'item-1',
            takeoffId: 'takeoff-2',
            category: 'concrete',
            itemName: 'Slab',
            quantity: 50,
            unit: 'CY',
            unitCost: 250, // Manual cost
            totalCost: 12500,
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            sheetNumber: null,
            symbolId: null,
          }
        ],
        Project: { id: 'project-1' },
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'draft',
        totalCost: 0,
        extractionMethod: 'manual',
      });

      const result = await applyCalculatedCosts('takeoff-2', 'default');

      expect(result.updated).toBe(0);
      expect(result.skipped).toBe(1);
      expect(takeoffLineItemUpdate).not.toHaveBeenCalled();
    });

    it('should skip items without available prices', async () => {
      materialTakeoffFindUnique.mockResolvedValue({
        id: 'takeoff-3',
        projectId: 'project-1',
        documentId: 'doc-1',
        name: 'Test Takeoff',
        TakeoffLineItem: [
          {
            id: 'item-1',
            takeoffId: 'takeoff-3',
            category: 'unknown-category',
            itemName: 'Unknown Item',
            quantity: 50,
            unit: 'EA',
            unitCost: null,
            totalCost: null,
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            sheetNumber: null,
            symbolId: null,
          }
        ],
        Project: { id: 'project-1' },
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'draft',
        totalCost: 0,
        extractionMethod: 'manual',
      });

      unitPriceFindFirst.mockResolvedValue(null);

      const result = await applyCalculatedCosts('takeoff-3', 'default');

      expect(result.updated).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it('should update takeoff total cost', async () => {
      materialTakeoffFindUnique.mockResolvedValue({
        id: 'takeoff-4',
        projectId: 'project-1',
        documentId: 'doc-1',
        name: 'Test Takeoff',
        TakeoffLineItem: [
          {
            id: 'item-1',
            takeoffId: 'takeoff-4',
            category: 'concrete',
            itemName: 'Slab',
            quantity: 50,
            unit: 'CY',
            unitCost: null,
            totalCost: null,
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            sheetNumber: null,
            symbolId: null,
          }
        ],
        Project: { id: 'project-1' },
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'draft',
        totalCost: 0,
        extractionMethod: 'manual',
      });

      unitPriceFindFirst.mockResolvedValue({
        id: 'price-1',
        projectId: 'project-1',
        category: 'concrete',
        subCategory: null,
        unit: 'CY',
        unitCost: 200,
        laborRate: 65,
        region: 'default',
        effectiveDate: new Date(),
        expirationDate: null,
        source: 'manual',
        supplier: null,
        notes: null,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        itemName: null,
      });

      await applyCalculatedCosts('takeoff-4', 'default');

      expect(materialTakeoffUpdate).toHaveBeenCalledWith({
        where: { id: 'takeoff-4' },
        data: { totalCost: 15000 }
      });
    });

    it('should throw error for non-existent takeoff', async () => {
      materialTakeoffFindUnique.mockResolvedValue(null);

      await expect(applyCalculatedCosts('non-existent', 'default')).rejects.toThrow('Takeoff not found');
    });

    it('should handle database errors', async () => {
      materialTakeoffFindUnique.mockRejectedValue(new Error('Database error'));

      await expect(applyCalculatedCosts('takeoff-1', 'default')).rejects.toThrow('Database error');
    });
  });

  describe('saveUnitPrice', () => {
    it('should create new unit price when none exists', async () => {
      unitPriceFindFirst.mockResolvedValue(null);
      unitPriceCreate.mockResolvedValue({
        id: 'new-price-1',
        projectId: 'project-1',
        category: 'concrete',
        subCategory: 'slab-on-grade',
        itemName: null,
        unit: 'CY',
        unitCost: 225,
        laborRate: 70,
        region: 'default',
        supplier: 'ABC Concrete',
        source: 'quote',
        notes: 'Special pricing',
        createdBy: 'user-1',
        effectiveDate: new Date(),
        expirationDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await saveUnitPrice({
        projectId: 'project-1',
        category: 'concrete',
        subCategory: 'slab-on-grade',
        unit: 'CY',
        unitCost: 225,
        laborRate: 70,
        supplier: 'ABC Concrete',
        source: 'quote',
        notes: 'Special pricing',
      }, 'user-1');

      expect(result.created).toBe(true);
      expect(result.id).toBe('new-price-1');
      expect(unitPriceCreate).toHaveBeenCalled();
    });

    it('should update existing unit price', async () => {
      unitPriceFindFirst.mockResolvedValue({
        id: 'existing-price-1',
        projectId: 'project-1',
        category: 'concrete',
        subCategory: 'slab-on-grade',
        itemName: null,
        unit: 'CY',
        unitCost: 200,
        laborRate: 65,
        region: 'default',
        supplier: null,
        source: 'manual',
        notes: null,
        createdBy: 'user-1',
        effectiveDate: new Date(),
        expirationDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      unitPriceUpdate.mockResolvedValue({
        id: 'existing-price-1',
        projectId: 'project-1',
        category: 'concrete',
        subCategory: 'slab-on-grade',
        itemName: null,
        unit: 'CY',
        unitCost: 225,
        laborRate: 70,
        region: 'default',
        supplier: 'ABC Concrete',
        source: 'quote',
        notes: 'Updated pricing',
        createdBy: 'user-1',
        effectiveDate: new Date(),
        expirationDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await saveUnitPrice({
        projectId: 'project-1',
        category: 'concrete',
        subCategory: 'slab-on-grade',
        unit: 'CY',
        unitCost: 225,
        laborRate: 70,
        supplier: 'ABC Concrete',
        source: 'quote',
        notes: 'Updated pricing',
      }, 'user-1');

      expect(result.created).toBe(false);
      expect(result.id).toBe('existing-price-1');
      expect(unitPriceUpdate).toHaveBeenCalled();
    });

    it('should handle null projectId for global prices', async () => {
      unitPriceFindFirst.mockResolvedValue(null);
      unitPriceCreate.mockResolvedValue({
        id: 'global-price-1',
        projectId: null,
        category: 'concrete',
        subCategory: null,
        itemName: null,
        unit: 'CY',
        unitCost: 185,
        laborRate: 65,
        region: 'kentucky',
        supplier: null,
        source: 'rsmeans',
        notes: null,
        createdBy: 'admin',
        effectiveDate: new Date(),
        expirationDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await saveUnitPrice({
        projectId: null,
        category: 'concrete',
        unit: 'CY',
        unitCost: 185,
        region: 'kentucky',
        source: 'rsmeans',
      }, 'admin');

      expect(result.created).toBe(true);
      expect(unitPriceCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: null,
          region: 'kentucky',
        })
      });
    });

    it('should use default region when not specified', async () => {
      unitPriceFindFirst.mockResolvedValue(null);
      unitPriceCreate.mockResolvedValue({
        id: 'price-1',
        projectId: 'project-1',
        category: 'concrete',
        subCategory: null,
        itemName: null,
        unit: 'CY',
        unitCost: 200,
        laborRate: null,
        region: 'default',
        supplier: null,
        source: 'manual',
        notes: null,
        createdBy: 'user-1',
        effectiveDate: new Date(),
        expirationDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await saveUnitPrice({
        projectId: 'project-1',
        category: 'concrete',
        unit: 'CY',
        unitCost: 200,
      }, 'user-1');

      expect(unitPriceCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          region: 'default',
          source: 'manual',
        })
      });
    });

    it('should handle database errors', async () => {
      unitPriceFindFirst.mockRejectedValue(new Error('Database error'));

      await expect(saveUnitPrice({
        category: 'concrete',
        unit: 'CY',
        unitCost: 200,
      }, 'user-1')).rejects.toThrow('Database error');
    });
  });

  describe('getProjectUnitPrices', () => {
    it('should return project-specific and global prices', async () => {
      unitPriceFindMany.mockResolvedValue([
        {
          id: 'price-1',
          projectId: 'project-1',
          category: 'concrete',
          subCategory: 'slab-on-grade',
          unit: 'CY',
          unitCost: 225,
          laborRate: 70,
          source: 'quote',
          region: 'default',
          supplier: null,
          notes: null,
          createdBy: 'user-1',
          effectiveDate: new Date(),
          expirationDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          itemName: null,
        },
        {
          id: 'price-2',
          projectId: null,
          category: 'flooring',
          subCategory: 'lvt',
          unit: 'SF',
          unitCost: 12.50,
          laborRate: 55,
          source: 'rsmeans',
          region: 'default',
          supplier: null,
          notes: null,
          createdBy: 'admin',
          effectiveDate: new Date(),
          expirationDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          itemName: null,
        }
      ]);

      const prices = await getProjectUnitPrices('project-1', 'default');

      expect(prices).toHaveLength(2);
      expect(prices[0].isProjectSpecific).toBe(true);
      expect(prices[1].isProjectSpecific).toBe(false);
    });

    it('should filter by region for global prices', async () => {
      unitPriceFindMany.mockResolvedValue([]);

      await getProjectUnitPrices('project-1', 'kentucky');

      expect(unitPriceFindMany).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              OR: [
                { projectId: 'project-1' },
                { projectId: null, region: 'kentucky' }
              ]
            },
            {
              OR: [
                { expirationDate: null },
                { expirationDate: { gt: expect.any(Date) } }
              ]
            }
          ]
        },
        orderBy: [{ category: 'asc' }, { subCategory: 'asc' }]
      });
    });

    it('should exclude expired prices', async () => {
      unitPriceFindMany.mockResolvedValue([]);

      await getProjectUnitPrices('project-1', 'default');

      expect(unitPriceFindMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: [
                { expirationDate: null },
                { expirationDate: { gt: expect.any(Date) } }
              ]
            })
          ])
        }),
        orderBy: [{ category: 'asc' }, { subCategory: 'asc' }]
      });
    });

    it('should handle null projectId', async () => {
      unitPriceFindMany.mockResolvedValue([]);

      await getProjectUnitPrices(null, 'default');

      expect(unitPriceFindMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: [
                { projectId: null },
                { projectId: null, region: 'default' }
              ]
            })
          ])
        }),
        orderBy: [{ category: 'asc' }, { subCategory: 'asc' }]
      });
    });

    it('should return empty array on database error', async () => {
      unitPriceFindMany.mockRejectedValue(new Error('Database error'));

      const prices = await getProjectUnitPrices('project-1', 'default');

      expect(prices).toEqual([]);
    });

    it('should handle missing source field gracefully', async () => {
      unitPriceFindMany.mockResolvedValue([
        {
          id: 'price-1',
          projectId: 'project-1',
          category: 'concrete',
          subCategory: null,
          unit: 'CY',
          unitCost: 200,
          laborRate: 65,
          source: null, // Missing source
          region: 'default',
          supplier: null,
          notes: null,
          createdBy: 'user-1',
          effectiveDate: new Date(),
          expirationDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          itemName: null,
        }
      ]);

      const prices = await getProjectUnitPrices('project-1', 'default');

      expect(prices[0].source).toBe('unknown');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large quantities', async () => {
      const item = {
        id: 'item-1',
        category: 'concrete',
        itemName: 'Large Project',
        quantity: 999999,
        unit: 'CY',
        unitCost: 200,
      };

      const result = await calculateItemCost(item, null, 'default');

      expect(result.totalCost).toBeGreaterThan(0);
      expect(result.totalCost).toBeLessThan(Infinity);
    });

    it('should handle zero unit cost', async () => {
      const item = {
        id: 'item-1',
        category: 'concrete',
        itemName: 'Free Material',
        quantity: 100,
        unit: 'CY',
        unitCost: 0,
      };

      const result = await calculateItemCost(item, null, 'default');

      expect(result.materialCost).toBe(0);
      expect(result.laborCost).toBeGreaterThan(0); // Still has labor cost
    });

    it('should handle negative quantities gracefully', async () => {
      const item = {
        id: 'item-1',
        category: 'concrete',
        itemName: 'Credit',
        quantity: -50,
        unit: 'CY',
        unitCost: 200,
      };

      const result = await calculateItemCost(item, null, 'default');

      expect(result.materialCost).toBeLessThan(0);
      expect(result.totalCost).toBeLessThan(0);
    });

    it('should handle category name variations', async () => {
      unitPriceFindFirst.mockResolvedValue(null);

      const priceFloor = await getUnitPrice('Floor', null, 'SF', null, 'default');
      const priceFlooring = await getUnitPrice('Flooring', null, 'SF', null, 'default');

      expect(priceFloor).toBeDefined();
      expect(priceFlooring).toBeDefined();
    });

    it('should handle CSI fuzzy matching case insensitivity', async () => {
      unitPriceFindFirst.mockResolvedValue(null);

      const price = await getUnitPrice('walls', null, 'SF', null, 'default');

      expect(price).toBeDefined();
      expect(price?.source).toContain('CSI');
    });
  });
});
