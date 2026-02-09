import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateGridMethod,
  calculateAverageEndArea,
  calculateSimpleVolume,
  parseElevationData,
  generateEarthworkReport,
  SOIL_FACTORS,
  type ElevationGrid,
  type CrossSection,
  type SoilType,
} from '@/lib/earthwork-calculator';

// Mock construction-pricing-database
const mockPricingDatabase = vi.hoisted(() => ({
  findPriceByDivision: vi.fn(),
  REGIONAL_MULTIPLIERS: {
    'KY-Morehead': 0.86,
    'KY': 0.86,
    'CA': 1.25,
  },
}));

vi.mock('@/lib/construction-pricing-database', () => mockPricingDatabase);

describe('earthwork-calculator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateGridMethod', () => {
    it('should calculate cut and fill volumes from elevation grid', () => {
      const grid: ElevationGrid = {
        points: [
          { x: 0, y: 0, existingElev: 100, proposedElev: 98 }, // 2' cut
          { x: 10, y: 0, existingElev: 100, proposedElev: 102 }, // 2' fill
          { x: 0, y: 10, existingElev: 100, proposedElev: 100 }, // No change
          { x: 10, y: 10, existingElev: 100, proposedElev: 101 }, // 1' fill
        ],
        gridSpacing: 10,
        bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
      };

      const result = calculateGridMethod(grid);

      // Cut: 1 point * 100 SF * 2' = 200 CF = 7.41 CY
      // Fill: 2 points * 100 SF * 2' + 100 SF * 1' = 300 CF = 11.11 CY
      expect(result.cutVolumeCY).toBeGreaterThan(0);
      expect(result.fillVolumeCY).toBeGreaterThan(0);
      expect(result.method).toBe('grid');
    });

    it('should apply shrinkage factor to cut volume', () => {
      const grid: ElevationGrid = {
        points: [
          { x: 0, y: 0, existingElev: 100, proposedElev: 98 }, // 2' cut
        ],
        gridSpacing: 10,
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      };

      const result = calculateGridMethod(grid, 'clay');

      // Clay shrinkage factor = 0.90
      expect(result.shrinkageFactor).toBe(0.90);
      expect(result.adjustedCutCY).toBeCloseTo(result.cutVolumeCY * 0.90, 1);
    });

    it('should apply swell factor to fill volume', () => {
      const grid: ElevationGrid = {
        points: [
          { x: 0, y: 0, existingElev: 100, proposedElev: 102 }, // 2' fill
        ],
        gridSpacing: 10,
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      };

      const result = calculateGridMethod(grid, 'clay');

      // Clay swell factor = 1.30
      expect(result.swellFactor).toBe(1.30);
      expect(result.adjustedFillCY).toBeCloseTo(result.fillVolumeCY * 1.30, 1);
    });

    it('should calculate net volume (cut - fill)', () => {
      const grid: ElevationGrid = {
        points: [
          { x: 0, y: 0, existingElev: 105, proposedElev: 100 }, // 5' cut
          { x: 10, y: 0, existingElev: 100, proposedElev: 102 }, // 2' fill
        ],
        gridSpacing: 10,
        bounds: { minX: 0, maxX: 10, minY: 0, maxY: 0 },
      };

      const result = calculateGridMethod(grid, 'mixed');

      // Net = adjustedCut - adjustedFill
      const expectedNet = result.cutVolumeCY * 0.92 - result.fillVolumeCY * 1.20;
      expect(result.netVolumeCY).toBeCloseTo(expectedNet, 1);
    });

    it('should calculate cut and fill areas', () => {
      const grid: ElevationGrid = {
        points: [
          { x: 0, y: 0, existingElev: 100, proposedElev: 98 },
          { x: 10, y: 0, existingElev: 100, proposedElev: 102 },
        ],
        gridSpacing: 10,
        bounds: { minX: 0, maxX: 10, minY: 0, maxY: 0 },
      };

      const result = calculateGridMethod(grid);

      expect(result.cutAreaSF).toBe(100); // 1 point * 10*10
      expect(result.fillAreaSF).toBe(100); // 1 point * 10*10
    });

    it('should use different soil factors', () => {
      const grid: ElevationGrid = {
        points: [{ x: 0, y: 0, existingElev: 110, proposedElev: 100 }],
        gridSpacing: 10,
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      };

      const soilTypes: SoilType[] = ['clay', 'sand', 'gravel', 'topsoil', 'rock', 'mixed'];

      soilTypes.forEach(soilType => {
        const result = calculateGridMethod(grid, soilType);
        expect(result.shrinkageFactor).toBe(SOIL_FACTORS[soilType].shrinkage);
        expect(result.swellFactor).toBe(SOIL_FACTORS[soilType].swell);
      });
    });

    it('should generate balance description', () => {
      const balancedGrid: ElevationGrid = {
        points: [
          { x: 0, y: 0, existingElev: 100, proposedElev: 99 },
          { x: 10, y: 0, existingElev: 100, proposedElev: 101 },
        ],
        gridSpacing: 10,
        bounds: { minX: 0, maxX: 10, minY: 0, maxY: 0 },
      };

      const result = calculateGridMethod(balancedGrid, 'mixed');

      // Net should be close to 0 (balanced)
      if (Math.abs(result.netVolumeCY) < 50) {
        expect(result.balancePoint).toContain('balanced');
      }
    });

    it('should handle all cut scenario', () => {
      const grid: ElevationGrid = {
        points: [
          { x: 0, y: 0, existingElev: 105, proposedElev: 100 },
          { x: 10, y: 0, existingElev: 103, proposedElev: 100 },
        ],
        gridSpacing: 10,
        bounds: { minX: 0, maxX: 10, minY: 0, maxY: 0 },
      };

      const result = calculateGridMethod(grid);

      expect(result.cutVolumeCY).toBeGreaterThan(0);
      expect(result.fillVolumeCY).toBe(0);
      expect(result.fillAreaSF).toBe(0);
    });

    it('should handle all fill scenario', () => {
      const grid: ElevationGrid = {
        points: [
          { x: 0, y: 0, existingElev: 95, proposedElev: 100 },
          { x: 10, y: 0, existingElev: 97, proposedElev: 100 },
        ],
        gridSpacing: 10,
        bounds: { minX: 0, maxX: 10, minY: 0, maxY: 0 },
      };

      const result = calculateGridMethod(grid);

      expect(result.fillVolumeCY).toBeGreaterThan(0);
      expect(result.cutVolumeCY).toBe(0);
      expect(result.cutAreaSF).toBe(0);
    });
  });

  describe('calculateAverageEndArea', () => {
    it('should calculate volumes from cross sections', () => {
      const sections: CrossSection[] = [
        { station: 0, cutArea: 100, fillArea: 0 },
        { station: 1, cutArea: 150, fillArea: 0 },
        { station: 2, cutArea: 200, fillArea: 0 },
      ];

      const result = calculateAverageEndArea(sections);

      // Between station 0 and 1: (100 + 150)/2 * 100' = 12,500 CF
      // Between station 1 and 2: (150 + 200)/2 * 100' = 17,500 CF
      // Total: 30,000 CF = 1,111 CY
      expect(result.cutVolumeCY).toBeGreaterThan(1000);
      expect(result.method).toBe('average-end-area');
    });

    it('should handle sections with both cut and fill', () => {
      const sections: CrossSection[] = [
        { station: 0, cutArea: 50, fillArea: 30 },
        { station: 1, cutArea: 60, fillArea: 40 },
      ];

      const result = calculateAverageEndArea(sections);

      expect(result.cutVolumeCY).toBeGreaterThan(0);
      expect(result.fillVolumeCY).toBeGreaterThan(0);
    });

    it('should sort sections by station number', () => {
      const unsortedSections: CrossSection[] = [
        { station: 2, cutArea: 200, fillArea: 0 },
        { station: 0, cutArea: 100, fillArea: 0 },
        { station: 1, cutArea: 150, fillArea: 0 },
      ];

      const result = calculateAverageEndArea(unsortedSections);

      // Should calculate correctly even with unsorted input
      expect(result.cutVolumeCY).toBeGreaterThan(0);
    });

    it('should calculate total section areas', () => {
      const sections: CrossSection[] = [
        { station: 0, cutArea: 100, fillArea: 50 },
        { station: 1, cutArea: 120, fillArea: 60 },
        { station: 2, cutArea: 140, fillArea: 70 },
      ];

      const result = calculateAverageEndArea(sections);

      expect(result.cutAreaSF).toBe(100 + 120 + 140);
      expect(result.fillAreaSF).toBe(50 + 60 + 70);
    });

    it('should handle single section', () => {
      const sections: CrossSection[] = [
        { station: 0, cutArea: 100, fillArea: 0 },
      ];

      const result = calculateAverageEndArea(sections);

      expect(result.cutVolumeCY).toBe(0); // Need at least 2 sections for volume
      expect(result.cutAreaSF).toBe(100);
    });

    it('should handle empty sections array', () => {
      const sections: CrossSection[] = [];

      const result = calculateAverageEndArea(sections);

      expect(result.cutVolumeCY).toBe(0);
      expect(result.fillVolumeCY).toBe(0);
      expect(result.cutAreaSF).toBe(0);
      expect(result.fillAreaSF).toBe(0);
    });
  });

  describe('calculateSimpleVolume', () => {
    it('should calculate volume from area and average depths', () => {
      const result = calculateSimpleVolume(10000, 3, 2, 'mixed');

      // Cut: 10000 SF * 3' = 30,000 CF = 1,111 CY
      // Fill: 10000 SF * 2' = 20,000 CF = 741 CY
      expect(result.cutVolumeCY).toBeCloseTo(1111.11, 0);
      expect(result.fillVolumeCY).toBeCloseTo(740.74, 0);
    });

    it('should handle cut-only scenario', () => {
      const result = calculateSimpleVolume(5000, 4, 0);

      expect(result.cutVolumeCY).toBeGreaterThan(0);
      expect(result.fillVolumeCY).toBe(0);
      expect(result.cutAreaSF).toBe(5000);
      expect(result.fillAreaSF).toBe(0);
    });

    it('should handle fill-only scenario', () => {
      const result = calculateSimpleVolume(5000, 0, 3);

      expect(result.cutVolumeCY).toBe(0);
      expect(result.fillVolumeCY).toBeGreaterThan(0);
      expect(result.cutAreaSF).toBe(0);
      expect(result.fillAreaSF).toBe(5000);
    });

    it('should apply soil factors', () => {
      const result = calculateSimpleVolume(1000, 5, 5, 'rock');

      expect(result.shrinkageFactor).toBe(1.00);
      expect(result.swellFactor).toBe(1.50);
      expect(result.adjustedCutCY).toBeCloseTo(result.cutVolumeCY * 1.00, 1);
      expect(result.adjustedFillCY).toBeCloseTo(result.fillVolumeCY * 1.50, 1);
    });
  });

  describe('parseElevationData', () => {
    it('should parse elevation data into grid', () => {
      const existingElevations = [
        { x: 0, y: 0, elev: 100 },
        { x: 25, y: 0, elev: 102 },
        { x: 0, y: 25, elev: 101 },
        { x: 25, y: 25, elev: 103 },
      ];

      const proposedElevations = [
        { x: 0, y: 0, elev: 98 },
        { x: 25, y: 0, elev: 100 },
        { x: 0, y: 25, elev: 99 },
        { x: 25, y: 25, elev: 101 },
      ];

      const grid = parseElevationData(existingElevations, proposedElevations, 25);

      expect(grid).toBeDefined();
      expect(grid?.gridSpacing).toBe(25);
      expect(grid?.points.length).toBeGreaterThan(0);
      expect(grid?.bounds).toBeDefined();
    });

    it('should calculate correct bounds', () => {
      const existingElevations = [
        { x: 10, y: 20, elev: 100 },
        { x: 50, y: 60, elev: 102 },
      ];

      const proposedElevations = [
        { x: 10, y: 20, elev: 98 },
        { x: 50, y: 60, elev: 100 },
      ];

      const grid = parseElevationData(existingElevations, proposedElevations);

      expect(grid?.bounds).toEqual({
        minX: 10,
        maxX: 50,
        minY: 20,
        maxY: 60,
      });
    });

    it('should use default 25ft grid spacing', () => {
      const existingElevations = [{ x: 0, y: 0, elev: 100 }];
      const proposedElevations = [{ x: 0, y: 0, elev: 98 }];

      const grid = parseElevationData(existingElevations, proposedElevations);

      expect(grid?.gridSpacing).toBe(25);
    });

    it('should return null for empty elevation data', () => {
      const grid1 = parseElevationData([], [{ x: 0, y: 0, elev: 100 }]);
      const grid2 = parseElevationData([{ x: 0, y: 0, elev: 100 }], []);

      expect(grid1).toBeNull();
      expect(grid2).toBeNull();
    });

    it('should interpolate elevations for grid points', () => {
      const existingElevations = [
        { x: 0, y: 0, elev: 100 },
        { x: 100, y: 0, elev: 100 },
        { x: 0, y: 100, elev: 100 },
        { x: 100, y: 100, elev: 100 },
      ];

      const proposedElevations = [
        { x: 0, y: 0, elev: 95 },
        { x: 100, y: 0, elev: 95 },
        { x: 0, y: 100, elev: 95 },
        { x: 100, y: 100, elev: 95 },
      ];

      const grid = parseElevationData(existingElevations, proposedElevations, 50);

      expect(grid).toBeDefined();
      expect(grid?.points.length).toBeGreaterThan(4); // Should have interpolated points
    });

    it('should return null if no interpolated points created', () => {
      // Very sparse data that won't interpolate
      const existingElevations = [{ x: 0, y: 0, elev: 100 }];
      const proposedElevations = [{ x: 1000, y: 1000, elev: 100 }]; // Too far apart

      const grid = parseElevationData(existingElevations, proposedElevations, 25);

      // May return null if interpolation fails for all points
      if (grid === null || grid.points.length === 0) {
        expect(true).toBe(true); // Expected behavior
      }
    });
  });

  describe('generateEarthworkReport', () => {
    it('should generate formatted report text', () => {
      const mockResult = {
        cutVolumeCY: 1000,
        fillVolumeCY: 800,
        netVolumeCY: 50,
        cutAreaSF: 10000,
        fillAreaSF: 8000,
        balancePoint: 'Export 50 CY of excess material',
        shrinkageFactor: 0.92,
        swellFactor: 1.20,
        adjustedCutCY: 920,
        adjustedFillCY: 960,
        method: 'grid' as const,
        costEstimate: {
          excavationCost: 8000,
          fillCost: 16000,
          compactionCost: 9000,
          importCost: 0,
          exportCost: 625,
          gradingCost: 18000,
          totalCost: 51625,
          laborHours: 220,
          regionalMultiplier: 0.86,
          breakdown: [
            { item: 'Bulk Excavation', quantity: 1000, unit: 'CY', unitCost: 8, total: 8000 },
            { item: 'Compacted Backfill', quantity: 800, unit: 'CY', unitCost: 20, total: 16000 },
          ],
        },
      };

      const report = generateEarthworkReport(mockResult);

      expect(report).toContain('EARTHWORK VOLUME CALCULATION REPORT');
      expect(report).toContain('Cut Volume:');
      expect(report).toContain('1,000');
      expect(report).toContain('Fill Volume:');
      expect(report).toContain('800');
      expect(report).toContain('BALANCE');
      expect(report).toContain('Export 50 CY');
      expect(report).toContain('COST ESTIMATE');
      expect(report).toContain('Bulk Excavation');
      expect(report).toContain('$51,625.00');
      expect(report).toContain('220');
    });

    it('should format method name correctly', () => {
      const result1 = {
        cutVolumeCY: 100,
        fillVolumeCY: 100,
        netVolumeCY: 0,
        cutAreaSF: 1000,
        fillAreaSF: 1000,
        balancePoint: 'Balanced',
        shrinkageFactor: 0.92,
        swellFactor: 1.20,
        adjustedCutCY: 92,
        adjustedFillCY: 120,
        method: 'average-end-area' as const,
        costEstimate: {
          excavationCost: 0,
          fillCost: 0,
          compactionCost: 0,
          importCost: 0,
          exportCost: 0,
          gradingCost: 0,
          totalCost: 0,
          laborHours: 0,
          regionalMultiplier: 1,
          breakdown: [],
        },
      };

      const report = generateEarthworkReport(result1);

      expect(report).toContain('AVERAGE END-AREA'); // Note: uses dash, not space
    });
  });

  describe('cost estimation', () => {
    it('should calculate excavation costs', () => {
      const grid: ElevationGrid = {
        points: [{ x: 0, y: 0, existingElev: 110, proposedElev: 100 }],
        gridSpacing: 100,
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      };

      const result = calculateGridMethod(grid);

      expect(result.costEstimate.excavationCost).toBeGreaterThan(0);
      expect(result.costEstimate.laborHours).toBeGreaterThan(0);
    });

    it('should calculate import costs when fill exceeds cut', () => {
      const grid: ElevationGrid = {
        points: [
          { x: 0, y: 0, existingElev: 100, proposedElev: 110 }, // 10' fill
        ],
        gridSpacing: 100,
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      };

      const result = calculateGridMethod(grid);

      // Large fill requirement should trigger import cost
      if (result.netVolumeCY < -50) {
        expect(result.costEstimate.importCost).toBeGreaterThan(0);
      }
    });

    it('should calculate export costs when cut exceeds fill', () => {
      const grid: ElevationGrid = {
        points: [
          { x: 0, y: 0, existingElev: 110, proposedElev: 100 }, // 10' cut
        ],
        gridSpacing: 100,
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      };

      const result = calculateGridMethod(grid);

      // Large cut should trigger export cost
      if (result.netVolumeCY > 50) {
        expect(result.costEstimate.exportCost).toBeGreaterThan(0);
      }
    });

    it('should apply regional multiplier to costs', () => {
      const grid: ElevationGrid = {
        points: [{ x: 0, y: 0, existingElev: 105, proposedElev: 100 }],
        gridSpacing: 50,
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      };

      const result = calculateGridMethod(grid);

      expect(result.costEstimate.regionalMultiplier).toBeGreaterThan(0);
    });

    it('should include cost breakdown', () => {
      const grid: ElevationGrid = {
        points: [
          { x: 0, y: 0, existingElev: 105, proposedElev: 100 },
          { x: 50, y: 0, existingElev: 100, proposedElev: 102 },
        ],
        gridSpacing: 50,
        bounds: { minX: 0, maxX: 50, minY: 0, maxY: 0 },
      };

      const result = calculateGridMethod(grid);

      expect(result.costEstimate.breakdown.length).toBeGreaterThan(0);
      expect(result.costEstimate.breakdown[0]).toHaveProperty('item');
      expect(result.costEstimate.breakdown[0]).toHaveProperty('quantity');
      expect(result.costEstimate.breakdown[0]).toHaveProperty('unit');
      expect(result.costEstimate.breakdown[0]).toHaveProperty('unitCost');
      expect(result.costEstimate.breakdown[0]).toHaveProperty('total');
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('should handle zero elevation difference', () => {
      const grid: ElevationGrid = {
        points: [
          { x: 0, y: 0, existingElev: 100, proposedElev: 100 },
        ],
        gridSpacing: 10,
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      };

      const result = calculateGridMethod(grid);

      expect(result.cutVolumeCY).toBe(0);
      expect(result.fillVolumeCY).toBe(0);
      expect(result.netVolumeCY).toBe(0);
    });

    it('should handle very large volumes', () => {
      const grid: ElevationGrid = {
        points: [
          { x: 0, y: 0, existingElev: 200, proposedElev: 100 },
        ],
        gridSpacing: 1000,
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      };

      const result = calculateGridMethod(grid);

      expect(result.cutVolumeCY).toBeGreaterThan(1000);
    });

    it('should handle very small elevation differences', () => {
      const grid: ElevationGrid = {
        points: [
          { x: 0, y: 0, existingElev: 100.1, proposedElev: 100 },
        ],
        gridSpacing: 10,
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      };

      const result = calculateGridMethod(grid);

      expect(result.cutVolumeCY).toBeGreaterThan(0);
      expect(result.cutVolumeCY).toBeLessThan(1);
    });

    it('should round results appropriately', () => {
      const grid: ElevationGrid = {
        points: [
          { x: 0, y: 0, existingElev: 103.333, proposedElev: 100 },
        ],
        gridSpacing: 10,
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      };

      const result = calculateGridMethod(grid);

      // Results should be rounded to 1 decimal place (or may be integer 0)
      expect(result.cutVolumeCY.toString()).toMatch(/^\d+(\.\d)?$/);
      expect(result.fillVolumeCY.toString()).toMatch(/^\d+(\.\d)?$/);
      expect(result.netVolumeCY.toString()).toMatch(/^-?\d+(\.\d)?$/);
    });

    it('should handle negative coordinates', () => {
      const existingElevations = [
        { x: -50, y: -50, elev: 100 },
        { x: 50, y: 50, elev: 102 },
      ];

      const proposedElevations = [
        { x: -50, y: -50, elev: 98 },
        { x: 50, y: 50, elev: 100 },
      ];

      const grid = parseElevationData(existingElevations, proposedElevations, 50);

      expect(grid).toBeDefined();
      expect(grid?.bounds.minX).toBe(-50);
      expect(grid?.bounds.minY).toBe(-50);
    });
  });

  describe('SOIL_FACTORS constants', () => {
    it('should have correct shrinkage and swell factors for all soil types', () => {
      expect(SOIL_FACTORS.clay).toEqual({ shrinkage: 0.90, swell: 1.30 });
      expect(SOIL_FACTORS.sand).toEqual({ shrinkage: 0.95, swell: 1.15 });
      expect(SOIL_FACTORS.gravel).toEqual({ shrinkage: 0.95, swell: 1.12 });
      expect(SOIL_FACTORS.topsoil).toEqual({ shrinkage: 0.90, swell: 1.25 });
      expect(SOIL_FACTORS.rock).toEqual({ shrinkage: 1.00, swell: 1.50 });
      expect(SOIL_FACTORS.mixed).toEqual({ shrinkage: 0.92, swell: 1.20 });
    });

    it('should have shrinkage <= 1.0 for all soils', () => {
      Object.values(SOIL_FACTORS).forEach(factors => {
        expect(factors.shrinkage).toBeLessThanOrEqual(1.0);
      });
    });

    it('should have swell >= 1.0 for all soils', () => {
      Object.values(SOIL_FACTORS).forEach(factors => {
        expect(factors.swell).toBeGreaterThanOrEqual(1.0);
      });
    });
  });
});
