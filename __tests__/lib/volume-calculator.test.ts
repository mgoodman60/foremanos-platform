import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateConcreteVolume,
  calculateAggregateVolume,
  calculateBackfillVolume,
  slabVolumeCY,
  footingVolumeCY,
  aggregateVolumeCY,
  cyToTons,
  generateVolumeSummary,
  type ConcreteVolumeInput,
  type AggregateVolumeInput,
  type BackfillVolumeInput,
} from '@/lib/volume-calculator';

// Mock construction-pricing-database
const mockPricingDatabase = vi.hoisted(() => ({
  findPriceByDivision: vi.fn(),
  REGIONAL_MULTIPLIERS: {
    'morehead-ky': 0.86,
    'KY': 0.86,
    'CA': 1.25,
    'NY': 1.35,
  },
}));

vi.mock('@/lib/construction-pricing-database', () => mockPricingDatabase);

describe('volume-calculator', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default pricing mock
    mockPricingDatabase.findPriceByDivision.mockReturnValue({
      materialCost: 100,
      laborCost: 50,
      totalInstalled: 150,
      unit: 'CY',
    });
  });

  describe('calculateConcreteVolume', () => {
    describe('slab calculations', () => {
      it('should calculate slab volume with area and thickness in inches', () => {
        const input: ConcreteVolumeInput = {
          elementType: 'slab',
          dimensions: {
            area: 1000, // SF
            thicknessInches: 4,
          },
        };

        const result = calculateConcreteVolume(input);

        expect(result.volumeCF).toBe(333.33); // 1000 * (4/12) = 333.33
        expect(result.volumeCY).toBe(12.35); // 333.33 / 27
        expect(result.volumeWithWasteCY).toBeCloseTo(12.97, 1); // 12.35 * 1.05
        expect(result.wasteFactorApplied).toBe(5);
        expect(result.elementCount).toBe(1);
        expect(result.formula).toContain('1000.0 SF');
        expect(result.formula).toContain('4"');
      });

      it('should calculate slab volume with length, width, and thickness', () => {
        const input: ConcreteVolumeInput = {
          elementType: 'slab',
          dimensions: {
            length: 50,
            width: 30,
            thickness: 6, // inches
          },
        };

        const result = calculateConcreteVolume(input);

        expect(result.volumeCF).toBe(750); // 50 * 30 * (6/12) = 750
        expect(result.volumeCY).toBe(27.78);
      });

      it('should apply custom waste factor', () => {
        const input: ConcreteVolumeInput = {
          elementType: 'slab',
          dimensions: { area: 1000, thicknessInches: 4 },
          wasteFactorPercent: 10,
        };

        const result = calculateConcreteVolume(input);

        expect(result.wasteFactorApplied).toBe(10);
        expect(result.volumeWithWasteCY).toBe(13.58); // 12.35 * 1.10
      });

      it('should handle multiple slabs with quantity', () => {
        const input: ConcreteVolumeInput = {
          elementType: 'slab',
          dimensions: { area: 100, thicknessInches: 4 },
          quantity: 5,
        };

        const result = calculateConcreteVolume(input);

        expect(result.elementCount).toBe(5);
        expect(result.volumeCF).toBe(166.67); // 100 * (4/12) * 5
        expect(result.formula).toContain('× 5 EA');
      });
    });

    describe('footing calculations', () => {
      it('should calculate spread footing volume', () => {
        const input: ConcreteVolumeInput = {
          elementType: 'spread-footing',
          dimensions: {
            length: 4,
            width: 4,
            depth: 2,
          },
        };

        const result = calculateConcreteVolume(input);

        expect(result.volumeCF).toBe(32); // 4 * 4 * 2
        expect(result.volumeCY).toBe(1.19); // 32 / 27
        expect(result.formula).toContain("4' L × 4' W × 2' D");
      });

      it('should use depth or height for footing dimension', () => {
        const input: ConcreteVolumeInput = {
          elementType: 'footing',
          dimensions: {
            length: 5,
            width: 3,
            height: 1.5, // Should use height if depth not provided
          },
        };

        const result = calculateConcreteVolume(input);

        expect(result.volumeCF).toBe(22.5); // 5 * 3 * 1.5
      });
    });

    describe('foundation wall calculations', () => {
      it('should calculate foundation wall volume with thickness in inches', () => {
        const input: ConcreteVolumeInput = {
          elementType: 'foundation-wall',
          dimensions: {
            length: 100,
            height: 8,
            thickness: 10, // inches
          },
        };

        const result = calculateConcreteVolume(input);

        const thicknessFt = 10 / 12;
        expect(result.volumeCF).toBeCloseTo(100 * 8 * thicknessFt, 1);
        expect(result.formula).toContain('10" T');
      });

      it('should use default 8" thickness if not provided', () => {
        const input: ConcreteVolumeInput = {
          elementType: 'foundation-wall',
          dimensions: {
            length: 50,
            height: 10,
          },
        };

        const result = calculateConcreteVolume(input);

        const defaultThickness = 0.667; // 8" = 0.667'
        expect(result.volumeCF).toBeCloseTo(50 * 10 * defaultThickness, 1);
      });
    });

    describe('column calculations', () => {
      it('should calculate rectangular column volume', () => {
        const input: ConcreteVolumeInput = {
          elementType: 'column-rect',
          dimensions: {
            length: 2,
            width: 2,
            height: 12,
          },
        };

        const result = calculateConcreteVolume(input);

        expect(result.volumeCF).toBe(48); // 2 * 2 * 12
        expect(result.volumeCY).toBe(1.78);
      });

      it('should calculate round column volume', () => {
        const input: ConcreteVolumeInput = {
          elementType: 'column-round',
          dimensions: {
            diameter: 2,
            height: 10,
          },
        };

        const result = calculateConcreteVolume(input);

        const expectedVolume = Math.PI * 1 * 1 * 10; // π * r² * h
        expect(result.volumeCF).toBeCloseTo(expectedVolume, 1);
      });

      it('should calculate pier volume using depth instead of height', () => {
        const input: ConcreteVolumeInput = {
          elementType: 'pier',
          dimensions: {
            diameter: 3,
            depth: 8,
          },
        };

        const result = calculateConcreteVolume(input);

        const expectedVolume = Math.PI * 1.5 * 1.5 * 8;
        expect(result.volumeCF).toBeCloseTo(expectedVolume, 1);
      });
    });

    describe('beam and grade beam calculations', () => {
      it('should calculate beam volume', () => {
        const input: ConcreteVolumeInput = {
          elementType: 'beam',
          dimensions: {
            length: 20,
            width: 1.5,
            depth: 2,
          },
        };

        const result = calculateConcreteVolume(input);

        expect(result.volumeCF).toBe(60); // 20 * 1.5 * 2
      });

      it('should use default dimensions for grade beam', () => {
        const input: ConcreteVolumeInput = {
          elementType: 'grade-beam',
          dimensions: {
            length: 50,
          },
        };

        const result = calculateConcreteVolume(input);

        expect(result.volumeCF).toBe(100); // 50 * 1 (default width) * 2 (default depth)
      });
    });

    describe('curb and sidewalk calculations', () => {
      it('should calculate curb-gutter volume with cross-section area', () => {
        const input: ConcreteVolumeInput = {
          elementType: 'curb-gutter',
          dimensions: {
            length: 200,
            crossSectionArea: 1.5,
          },
        };

        const result = calculateConcreteVolume(input);

        expect(result.volumeCF).toBe(300); // 200 * 1.5
      });

      it('should calculate sidewalk volume', () => {
        const input: ConcreteVolumeInput = {
          elementType: 'sidewalk',
          dimensions: {
            length: 100,
            width: 5,
            thicknessInches: 6,
          },
        };

        const result = calculateConcreteVolume(input);

        expect(result.volumeCF).toBe(250); // 100 * 5 * (6/12)
      });
    });

    describe('cost estimation', () => {
      it('should calculate costs with regional multiplier', () => {
        mockPricingDatabase.findPriceByDivision.mockReturnValue({
          materialCost: 100,
          laborCost: 50,
          totalInstalled: 150,
          unit: 'CY',
        });

        const input: ConcreteVolumeInput = {
          elementType: 'slab',
          dimensions: { area: 100, thicknessInches: 4 },
        };

        const result = calculateConcreteVolume(input, 'morehead-ky');

        expect(result.costEstimate.regionalMultiplier).toBe(0.86);
        expect(result.costEstimate.pricePerCY).toBe(129); // 150 * 0.86, rounded
      });

      it('should handle SF-based pricing for slabs', () => {
        mockPricingDatabase.findPriceByDivision.mockReturnValue({
          materialCost: 5,
          laborCost: 3,
          totalInstalled: 8,
          unit: 'SF',
        });

        const input: ConcreteVolumeInput = {
          elementType: 'slab-on-grade',
          dimensions: { area: 1000, thicknessInches: 4 },
        };

        const result = calculateConcreteVolume(input);

        expect(mockPricingDatabase.findPriceByDivision).toHaveBeenCalledWith(3, 'concrete-slab-on-grade-4in');
        expect(result.costEstimate.materialCost).toBeGreaterThan(0);
      });

      it('should use correct price keys for different element types', () => {
        const testCases = [
          { type: 'foundation-wall' as const, key: 'concrete-foundation-wall' },
          { type: 'column-rect' as const, key: 'concrete-columns' },
          { type: 'beam' as const, key: 'concrete-beams' },
          { type: 'pier' as const, key: 'concrete-pier' },
        ];

        testCases.forEach(({ type, key }) => {
          vi.clearAllMocks();
          const input: ConcreteVolumeInput = {
            elementType: type,
            dimensions: { length: 10, width: 2, height: 3 },
          };
          calculateConcreteVolume(input);
          expect(mockPricingDatabase.findPriceByDivision).toHaveBeenCalledWith(3, key);
        });
      });
    });

    describe('edge cases', () => {
      it('should handle zero dimensions', () => {
        const input: ConcreteVolumeInput = {
          elementType: 'slab',
          dimensions: { area: 0, thicknessInches: 4 },
        };

        const result = calculateConcreteVolume(input);

        expect(result.volumeCY).toBe(0);
        expect(result.volumeCF).toBe(0);
      });

      it('should handle missing pricing data', () => {
        mockPricingDatabase.findPriceByDivision.mockReturnValue(null);

        const input: ConcreteVolumeInput = {
          elementType: 'slab',
          dimensions: { area: 100, thicknessInches: 4 },
        };

        const result = calculateConcreteVolume(input);

        expect(result.costEstimate.totalCost).toBe(0);
      });

      it('should round results to 2 decimal places', () => {
        const input: ConcreteVolumeInput = {
          elementType: 'slab',
          dimensions: { area: 333.333, thicknessInches: 5 },
        };

        const result = calculateConcreteVolume(input);

        expect(result.volumeCY.toString()).toMatch(/^\d+\.\d{1,2}$/);
        expect(result.volumeCF.toString()).toMatch(/^\d+\.\d{1,2}$/);
      });
    });
  });

  describe('calculateAggregateVolume', () => {
    it('should calculate aggregate volume with area and thickness', () => {
      const input: AggregateVolumeInput = {
        materialType: 'dga',
        dimensions: {
          area: 5000,
          thicknessInches: 6,
        },
      };

      const result = calculateAggregateVolume(input);

      // 5000 SF * 6" * 1.10 compaction = 2750 CF = 101.85 CY
      expect(result.volumeCY).toBeCloseTo(101.85, 1);
      expect(result.thicknessInches).toBe(6);
      expect(result.compactionFactor).toBe(1.10);
      expect(result.formula).toContain('5,000 SF');
      expect(result.formula).toContain('6"');
    });

    it('should calculate aggregate volume from length and width', () => {
      const input: AggregateVolumeInput = {
        materialType: 'stone-57',
        dimensions: {
          length: 100,
          width: 50,
          thicknessInches: 4,
        },
      };

      const result = calculateAggregateVolume(input);

      const area = 100 * 50; // 5000 SF
      expect(result.areaApplied).toBe(area);
    });

    it('should calculate tonnage based on material density', () => {
      const input: AggregateVolumeInput = {
        materialType: 'dga',
        dimensions: {
          area: 1000,
          thicknessInches: 6,
        },
      };

      const result = calculateAggregateVolume(input);

      // DGA density is 1.4 tons/CY
      expect(result.volumeTons).toBeCloseTo(result.volumeWithWasteCY * 1.4, 1);
    });

    it('should apply different compaction factors for different materials', () => {
      const materials = [
        { type: 'dga' as const, factor: 1.10 },
        { type: 'stone-57' as const, factor: 1.02 },
        { type: 'crusher-run' as const, factor: 1.10 },
        { type: 'topsoil' as const, factor: 1.15 },
      ];

      materials.forEach(({ type, factor }) => {
        const input: AggregateVolumeInput = {
          materialType: type,
          dimensions: { area: 1000, thicknessInches: 6 },
        };
        const result = calculateAggregateVolume(input);
        expect(result.compactionFactor).toBe(factor);
      });
    });

    it('should allow custom compaction factor override', () => {
      const input: AggregateVolumeInput = {
        materialType: 'dga',
        dimensions: { area: 1000, thicknessInches: 6 },
        compactionFactor: 1.25,
      };

      const result = calculateAggregateVolume(input);

      expect(result.compactionFactor).toBe(1.25);
    });

    it('should apply waste factor correctly', () => {
      const input: AggregateVolumeInput = {
        materialType: 'stone-57',
        dimensions: { area: 1000, thicknessInches: 6 },
        wasteFactorPercent: 10,
      };

      const result = calculateAggregateVolume(input);

      expect(result.volumeWithWasteCY).toBeCloseTo(result.volumeCY * 1.10, 1);
    });

    it('should calculate costs with regional pricing', () => {
      const input: AggregateVolumeInput = {
        materialType: 'aggregate-base',
        dimensions: { area: 1000, thicknessInches: 6 },
      };

      const result = calculateAggregateVolume(input, 'CA');

      expect(result.costEstimate.regionalMultiplier).toBe(1.25);
    });
  });

  describe('calculateBackfillVolume', () => {
    it('should calculate backfill required after excavation and concrete', () => {
      const input: BackfillVolumeInput = {
        excavationType: 'footing',
        excavationVolumeCY: 100,
        concreteVolumeCY: 30,
        materialType: 'on-site',
      };

      const result = calculateBackfillVolume(input);

      // Net void = 100 - 30 = 70 CY
      // Backfill needed = 70 / 0.90 = 77.78 CY
      expect(result.backfillRequiredCY).toBeCloseTo(77.8, 1);
      expect(result.compactedVolumeCY).toBe(70);
    });

    it('should account for pipe volume', () => {
      const input: BackfillVolumeInput = {
        excavationType: 'trench',
        excavationVolumeCY: 100,
        pipeVolumeCY: 10,
        materialType: 'pipe-zone',
      };

      const result = calculateBackfillVolume(input);

      const netVoid = 100 - 10;
      expect(result.compactedVolumeCY).toBe(90);
    });

    it('should calculate import required for on-site material', () => {
      const input: BackfillVolumeInput = {
        excavationType: 'foundation',
        excavationVolumeCY: 100,
        concreteVolumeCY: 50,
        materialType: 'on-site',
      };

      const result = calculateBackfillVolume(input);

      const availableOnsite = 100 * 0.8; // 80 CY available
      const backfillNeeded = 50 / 0.90; // 55.56 CY needed
      // No import needed since 80 > 55.56
      expect(result.importRequiredCY).toBe(0);
    });

    it('should calculate import needed when on-site insufficient', () => {
      const input: BackfillVolumeInput = {
        excavationType: 'foundation',
        excavationVolumeCY: 50,
        concreteVolumeCY: 10,
        materialType: 'on-site',
      };

      const result = calculateBackfillVolume(input);

      const availableOnsite = 50 * 0.8; // 40 CY available
      const backfillNeeded = 40 / 0.90; // 44.44 CY needed
      const importNeeded = 44.44 - 40; // 4.44 CY
      expect(result.importRequiredCY).toBeCloseTo(4.4, 1);
    });

    it('should use different shrinkage factors for different materials', () => {
      const materials = [
        { type: 'on-site' as const, factor: 0.90 },
        { type: 'select' as const, factor: 0.92 },
        { type: 'structural' as const, factor: 0.95 },
        { type: 'pipe-zone' as const, factor: 0.95 },
      ];

      materials.forEach(({ type, factor }) => {
        const input: BackfillVolumeInput = {
          excavationType: 'general',
          excavationVolumeCY: 100,
          materialType: type,
        };
        const result = calculateBackfillVolume(input);
        const expectedBackfill = 100 / factor;
        expect(result.backfillRequiredCY).toBeCloseTo(expectedBackfill, 1);
      });
    });

    it('should allow custom shrinkage factor', () => {
      const input: BackfillVolumeInput = {
        excavationType: 'foundation',
        excavationVolumeCY: 100,
        materialType: 'select',
        shrinkageFactor: 0.88,
      };

      const result = calculateBackfillVolume(input);

      const expected = 100 / 0.88;
      expect(result.backfillRequiredCY).toBeCloseTo(expected, 1);
    });

    it('should calculate costs for all backfill components', () => {
      const input: BackfillVolumeInput = {
        excavationType: 'foundation',
        excavationVolumeCY: 100,
        concreteVolumeCY: 30,
        materialType: 'structural',
      };

      const result = calculateBackfillVolume(input);

      expect(result.costEstimate.backfillCost).toBeGreaterThanOrEqual(0);
      expect(result.costEstimate.compactionCost).toBeGreaterThan(0);
      expect(result.costEstimate.totalCost).toBeGreaterThan(0);
    });
  });

  describe('quick helper functions', () => {
    describe('slabVolumeCY', () => {
      it('should calculate slab volume in CY', () => {
        const volume = slabVolumeCY(1000, 4, 5);

        // 1000 SF * 4" * 1.05 waste / 27 = 12.96 CY
        expect(volume).toBeCloseTo(12.96, 2);
      });

      it('should use default 5% waste if not provided', () => {
        const volume = slabVolumeCY(1000, 4);
        const volumeWithWaste = slabVolumeCY(1000, 4, 5);

        expect(volume).toBe(volumeWithWaste);
      });

      it('should handle zero area', () => {
        const volume = slabVolumeCY(0, 4);
        expect(volume).toBe(0);
      });
    });

    describe('footingVolumeCY', () => {
      it('should calculate footing volume in CY', () => {
        const volume = footingVolumeCY(4, 4, 2, 1, 5);

        // 4 * 4 * 2 * 1 * 1.05 / 27 = 1.24 CY
        expect(volume).toBeCloseTo(1.24, 2);
      });

      it('should handle multiple footings', () => {
        const volume = footingVolumeCY(4, 4, 2, 10, 5);

        // 4 * 4 * 2 * 10 * 1.05 / 27 = 12.44 CY
        expect(volume).toBeCloseTo(12.44, 2);
      });

      it('should use default quantity of 1', () => {
        const single = footingVolumeCY(4, 4, 2);
        const explicit = footingVolumeCY(4, 4, 2, 1);

        expect(single).toBe(explicit);
      });
    });

    describe('aggregateVolumeCY', () => {
      it('should calculate aggregate volume with compaction', () => {
        const volume = aggregateVolumeCY(5000, 6, 1.10, 8);

        // 5000 * 6/12 * 1.10 * 1.08 / 27 = 110.00 CY
        expect(volume).toBeCloseTo(110.00, 2);
      });

      it('should use default compaction factor of 1.10', () => {
        const defaultCompaction = aggregateVolumeCY(1000, 6);
        const explicitCompaction = aggregateVolumeCY(1000, 6, 1.10);

        expect(defaultCompaction).toBe(explicitCompaction);
      });

      it('should use default waste of 8%', () => {
        const defaultWaste = aggregateVolumeCY(1000, 6, 1.10);
        const explicitWaste = aggregateVolumeCY(1000, 6, 1.10, 8);

        expect(defaultWaste).toBe(explicitWaste);
      });
    });

    describe('cyToTons', () => {
      it('should convert DGA volume to tons', () => {
        const tons = cyToTons(100, 'dga');

        // 100 CY * 1.4 tons/CY = 140 tons
        expect(tons).toBe(140);
      });

      it('should handle different material densities', () => {
        const dgaTons = cyToTons(100, 'dga'); // 1.4 tons/CY
        const stoneTons = cyToTons(100, 'stone-57'); // 1.3 tons/CY
        const topsoilTons = cyToTons(100, 'topsoil'); // 1.1 tons/CY

        expect(dgaTons).toBe(140);
        expect(stoneTons).toBe(130);
        expect(topsoilTons).toBe(110);
      });

      it('should use DGA as default material', () => {
        const defaultMaterial = cyToTons(100);
        const explicitDGA = cyToTons(100, 'dga');

        expect(defaultMaterial).toBe(explicitDGA);
      });

      it('should round to 1 decimal place', () => {
        const tons = cyToTons(33.333, 'dga');
        expect(tons.toString()).toMatch(/^\d+\.\d$/);
      });
    });
  });

  describe('generateVolumeSummary', () => {
    it('should generate summary for concrete, aggregate, and earthwork items', () => {
      const concreteInputs = [
        {
          name: 'Foundation Slab',
          input: {
            elementType: 'slab' as const,
            dimensions: { area: 1000, thicknessInches: 4 },
          },
        },
      ];

      const aggregateInputs = [
        {
          name: 'Base Course',
          input: {
            materialType: 'dga' as const,
            dimensions: { area: 1000, thicknessInches: 6 },
          },
        },
      ];

      const earthworkInputs = [
        {
          name: 'Foundation Backfill',
          input: {
            excavationType: 'foundation' as const,
            excavationVolumeCY: 100,
            concreteVolumeCY: 30,
            materialType: 'on-site' as const,
          },
        },
      ];

      const summary = generateVolumeSummary(
        concreteInputs,
        aggregateInputs,
        earthworkInputs
      );

      expect(summary.concreteItems).toHaveLength(1);
      expect(summary.aggregateItems).toHaveLength(1);
      expect(summary.earthworkItems).toHaveLength(1);
      expect(summary.totals.totalConcreteCY).toBeGreaterThan(0);
      expect(summary.totals.totalAggregateCY).toBeGreaterThan(0);
      expect(summary.totals.totalBackfillCY).toBeGreaterThan(0);
      expect(summary.totals.totalCost).toBeGreaterThan(0);
    });

    it('should sum totals correctly', () => {
      const concreteInputs = [
        { name: 'Slab 1', input: { elementType: 'slab' as const, dimensions: { area: 1000, thicknessInches: 4 } } },
        { name: 'Slab 2', input: { elementType: 'slab' as const, dimensions: { area: 500, thicknessInches: 4 } } },
      ];

      const summary = generateVolumeSummary(concreteInputs, [], []);

      const expectedTotal = summary.concreteItems.reduce((sum, item) => sum + item.volumeCY, 0);
      expect(summary.totals.totalConcreteCY).toBeCloseTo(expectedTotal, 2);
    });

    it('should include tonnage for aggregate items', () => {
      const aggregateInputs = [
        { name: 'DGA', input: { materialType: 'dga' as const, dimensions: { area: 1000, thicknessInches: 6 } } },
      ];

      const summary = generateVolumeSummary([], aggregateInputs, []);

      expect(summary.aggregateItems[0].tons).toBeGreaterThan(0);
      expect(summary.totals.totalAggregateTons).toBeGreaterThan(0);
    });

    it('should handle empty inputs', () => {
      const summary = generateVolumeSummary([], [], []);

      expect(summary.concreteItems).toHaveLength(0);
      expect(summary.aggregateItems).toHaveLength(0);
      expect(summary.earthworkItems).toHaveLength(0);
      expect(summary.totals.totalCost).toBe(0);
    });

    it('should use specified region for all calculations', () => {
      const concreteInputs = [
        { name: 'Slab', input: { elementType: 'slab' as const, dimensions: { area: 1000, thicknessInches: 4 } } },
      ];

      const summary = generateVolumeSummary(concreteInputs, [], [], 'CA');

      // California multiplier is 1.25, cost should reflect that
      expect(summary.concreteItems[0].cost).toBeGreaterThan(0);
    });
  });

  describe('boundary conditions', () => {
    it('should handle very small volumes', () => {
      const input: ConcreteVolumeInput = {
        elementType: 'slab',
        dimensions: { area: 10, thicknessInches: 2 },
      };

      const result = calculateConcreteVolume(input);

      expect(result.volumeCY).toBeGreaterThan(0);
      expect(result.volumeCY).toBeLessThan(1);
    });

    it('should handle very large volumes', () => {
      const input: ConcreteVolumeInput = {
        elementType: 'slab',
        dimensions: { area: 100000, thicknessInches: 12 },
      };

      const result = calculateConcreteVolume(input);

      expect(result.volumeCY).toBeGreaterThan(1000);
      expect(result.volumeWithWasteCY).toBeGreaterThan(result.volumeCY);
    });

    it('should handle zero waste factor', () => {
      const input: ConcreteVolumeInput = {
        elementType: 'slab',
        dimensions: { area: 1000, thicknessInches: 4 },
        wasteFactorPercent: 0,
      };

      const result = calculateConcreteVolume(input);

      expect(result.volumeWithWasteCY).toBe(result.volumeCY);
    });

    it('should handle fractional dimensions', () => {
      const input: ConcreteVolumeInput = {
        elementType: 'footing',
        dimensions: {
          length: 3.5,
          width: 2.25,
          depth: 1.5,
        },
      };

      const result = calculateConcreteVolume(input);

      expect(result.volumeCF).toBeCloseTo(3.5 * 2.25 * 1.5, 2);
    });
  });
});
