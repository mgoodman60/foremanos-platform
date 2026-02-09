import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseGridCoordinate,
  calculateGridDistance,
  areGridsAdjacent,
  extractGridSystem,
  findSheetsAtLocation,
  correlateTwoSheets,
  transformCoordinate,
  type GridCoordinate,
  type CrossSheetQuery,
} from '@/lib/spatial-correlation';

// Mock dependencies
const mockPrisma = vi.hoisted(() => ({
  documentChunk: {
    findMany: vi.fn(),
  },
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

describe('spatial-correlation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseGridCoordinate', () => {
    it('should parse letter-number format with dash', () => {
      const coord = parseGridCoordinate('A-3');

      expect(coord).toEqual({
        x: 'A',
        y: '3',
        numeric: { x: 1, y: 3 },
      });
    });

    it('should parse letter-number format with slash', () => {
      const coord = parseGridCoordinate('B/12');

      expect(coord).toEqual({
        x: 'B',
        y: '12',
        numeric: { x: 2, y: 12 },
      });
    });

    it('should parse letter-number format with space', () => {
      const coord = parseGridCoordinate('C 7');

      expect(coord).toEqual({
        x: 'C',
        y: '7',
        numeric: { x: 3, y: 7 },
      });
    });

    it('should parse with "Grid" prefix', () => {
      const coord = parseGridCoordinate('Grid A-3');

      expect(coord).toEqual({
        x: 'A',
        y: '3',
        numeric: { x: 1, y: 3 },
      });
    });

    it('should parse with "at" prefix', () => {
      const coord = parseGridCoordinate('at B-5');

      expect(coord).toEqual({
        x: 'B',
        y: '5',
        numeric: { x: 2, y: 5 },
      });
    });

    it('should parse multi-letter grid coordinates', () => {
      const coord = parseGridCoordinate('AA-10');

      expect(coord).toEqual({
        x: 'AA',
        y: '10',
        numeric: { x: 27, y: 10 }, // AA = 27 (26 + 1)
      });
    });

    it('should parse number-letter format', () => {
      const coord = parseGridCoordinate('3-A');

      expect(coord).toEqual({
        x: '3',
        y: 'A',
        numeric: { x: 3, y: 1 },
      });
    });

    it('should handle lowercase input', () => {
      const coord = parseGridCoordinate('a-3');

      expect(coord).toEqual({
        x: 'A',
        y: '3',
        numeric: { x: 1, y: 3 },
      });
    });

    it('should return null for invalid format', () => {
      expect(parseGridCoordinate('invalid')).toBeNull();
      expect(parseGridCoordinate('123')).toBeNull();
      expect(parseGridCoordinate('ABC')).toBeNull();
    });

    it('should handle "between" prefix', () => {
      const coord = parseGridCoordinate('Between A-3 and A-4');

      expect(coord).toEqual({
        x: 'A',
        y: '3',
        numeric: { x: 1, y: 3 },
      });
    });
  });

  describe('calculateGridDistance', () => {
    it('should calculate distance between adjacent horizontal grids', () => {
      const grid1: GridCoordinate = { x: 'A', y: '1', numeric: { x: 1, y: 1 } };
      const grid2: GridCoordinate = { x: 'B', y: '1', numeric: { x: 2, y: 1 } };

      const distance = calculateGridDistance(grid1, grid2);

      expect(distance).toBe(1);
    });

    it('should calculate distance between adjacent vertical grids', () => {
      const grid1: GridCoordinate = { x: 'A', y: '1', numeric: { x: 1, y: 1 } };
      const grid2: GridCoordinate = { x: 'A', y: '2', numeric: { x: 1, y: 2 } };

      const distance = calculateGridDistance(grid1, grid2);

      expect(distance).toBe(1);
    });

    it('should calculate distance between diagonal grids', () => {
      const grid1: GridCoordinate = { x: 'A', y: '1', numeric: { x: 1, y: 1 } };
      const grid2: GridCoordinate = { x: 'B', y: '2', numeric: { x: 2, y: 2 } };

      const distance = calculateGridDistance(grid1, grid2);

      expect(distance).toBeCloseTo(Math.sqrt(2), 5);
    });

    it('should calculate distance between distant grids', () => {
      const grid1: GridCoordinate = { x: 'A', y: '1', numeric: { x: 1, y: 1 } };
      const grid2: GridCoordinate = { x: 'E', y: '5', numeric: { x: 5, y: 5 } };

      const distance = calculateGridDistance(grid1, grid2);

      const expected = Math.sqrt(16 + 16); // sqrt((5-1)² + (5-1)²)
      expect(distance).toBeCloseTo(expected, 5);
    });

    it('should return 0 for same grid', () => {
      const grid1: GridCoordinate = { x: 'A', y: '3', numeric: { x: 1, y: 3 } };
      const grid2: GridCoordinate = { x: 'A', y: '3', numeric: { x: 1, y: 3 } };

      const distance = calculateGridDistance(grid1, grid2);

      expect(distance).toBe(0);
    });

    it('should return Infinity if numeric values missing', () => {
      const grid1: GridCoordinate = { x: 'A', y: '1' };
      const grid2: GridCoordinate = { x: 'B', y: '2', numeric: { x: 2, y: 2 } };

      const distance = calculateGridDistance(grid1, grid2);

      expect(distance).toBe(Infinity);
    });
  });

  describe('areGridsAdjacent', () => {
    it('should return true for horizontally adjacent grids', () => {
      const grid1: GridCoordinate = { x: 'A', y: '1', numeric: { x: 1, y: 1 } };
      const grid2: GridCoordinate = { x: 'B', y: '1', numeric: { x: 2, y: 1 } };

      expect(areGridsAdjacent(grid1, grid2)).toBe(true);
    });

    it('should return true for vertically adjacent grids', () => {
      const grid1: GridCoordinate = { x: 'A', y: '1', numeric: { x: 1, y: 1 } };
      const grid2: GridCoordinate = { x: 'A', y: '2', numeric: { x: 1, y: 2 } };

      expect(areGridsAdjacent(grid1, grid2)).toBe(true);
    });

    it('should return true for diagonally adjacent grids', () => {
      const grid1: GridCoordinate = { x: 'A', y: '1', numeric: { x: 1, y: 1 } };
      const grid2: GridCoordinate = { x: 'B', y: '2', numeric: { x: 2, y: 2 } };

      expect(areGridsAdjacent(grid1, grid2)).toBe(true);
    });

    it('should return false for non-adjacent grids', () => {
      const grid1: GridCoordinate = { x: 'A', y: '1', numeric: { x: 1, y: 1 } };
      const grid2: GridCoordinate = { x: 'C', y: '3', numeric: { x: 3, y: 3 } };

      expect(areGridsAdjacent(grid1, grid2)).toBe(false);
    });

    it('should return true for same grid', () => {
      const grid1: GridCoordinate = { x: 'A', y: '1', numeric: { x: 1, y: 1 } };
      const grid2: GridCoordinate = { x: 'A', y: '1', numeric: { x: 1, y: 1 } };

      expect(areGridsAdjacent(grid1, grid2)).toBe(true);
    });
  });

  describe('extractGridSystem', () => {
    it('should extract grid system from document chunks', async () => {
      const mockChunks = [
        {
          content: 'Grid A-1, Grid A-2, Grid B-1, Grid B-2',
          metadata: {
            sheet_number: 'A-101',
            drawing_type: 'Floor Plan',
            scaleData: { primaryScale: '1/4" = 1\'-0"' },
          },
        },
      ];

      mockPrisma.documentChunk.findMany.mockResolvedValue(mockChunks);

      const result = await extractGridSystem('test-project', 'A-101');

      expect(result).toBeDefined();
      expect(result?.sheetNumber).toBe('A-101');
      expect(result?.discipline).toBe('architectural');
      expect(result?.scale).toBe('1/4" = 1\'-0"');
      expect(result?.gridSystem.length).toBeGreaterThan(0);
      expect(result?.bounds).toBeDefined();
    });

    it('should deduplicate grid coordinates', async () => {
      const mockChunks = [
        {
          content: 'Grid A-1, Grid A-1, Grid A-2',
          metadata: { sheet_number: 'A-101' },
        },
      ];

      mockPrisma.documentChunk.findMany.mockResolvedValue(mockChunks);

      const result = await extractGridSystem('test-project', 'A-101');

      const uniqueGrids = result?.gridSystem || [];
      const gridStrings = uniqueGrids.map(g => `${g.x}-${g.y}`);
      const uniqueGridStrings = [...new Set(gridStrings)];

      expect(gridStrings.length).toBe(uniqueGridStrings.length);
    });

    it('should extract grids from cross-references metadata', async () => {
      const mockChunks = [
        {
          content: '',
          metadata: {
            sheet_number: 'A-101',
            crossReferences: [
              { location: 'Grid A-3', context: 'Detail' },
              { location: 'Grid B-5', context: 'Section' },
            ],
          },
        },
      ];

      mockPrisma.documentChunk.findMany.mockResolvedValue(mockChunks);

      const result = await extractGridSystem('test-project', 'A-101');

      expect(result?.gridSystem.length).toBeGreaterThanOrEqual(2);
    });

    it('should calculate bounds from grid coordinates', async () => {
      const mockChunks = [
        {
          content: 'Grid A-1, Grid C-3',
          metadata: { sheet_number: 'A-101' },
        },
      ];

      mockPrisma.documentChunk.findMany.mockResolvedValue(mockChunks);

      const result = await extractGridSystem('test-project', 'A-101');

      expect(result?.bounds).toEqual({
        minX: 1, // A
        maxX: 3, // C
        minY: 1,
        maxY: 3,
      });
    });

    it('should infer discipline from drawing type', async () => {
      const testCases = [
        { type: 'Structural Foundation Plan', expected: 'structural' },
        { type: 'Mechanical HVAC Layout', expected: 'mechanical' },
        { type: 'Electrical Power Plan', expected: 'electrical' },
        { type: 'Plumbing Riser Diagram', expected: 'plumbing' },
        { type: 'Civil Site Plan', expected: 'civil' },
      ];

      for (const { type, expected } of testCases) {
        mockPrisma.documentChunk.findMany.mockResolvedValue([
          { content: '', metadata: { drawing_type: type } },
        ]);

        const result = await extractGridSystem('test-project', 'TEST');
        expect(result?.discipline).toBe(expected);
      }
    });

    it('should return null for non-existent sheet', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValue([]);

      const result = await extractGridSystem('test-project', 'NONEXISTENT');

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.documentChunk.findMany.mockRejectedValue(new Error('Database error'));

      const result = await extractGridSystem('test-project', 'A-101');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('findSheetsAtLocation', () => {
    it('should find sheets with exact grid match', async () => {
      const mockChunks = [
        {
          content: 'Grid A-3 is at the main entrance',
          metadata: { sheet_number: 'A-101', drawing_type: 'Floor Plan' },
        },
      ];

      mockPrisma.documentChunk.findMany.mockResolvedValue(mockChunks);

      const query: CrossSheetQuery = { location: 'Grid A-3' };
      const matches = await findSheetsAtLocation('test-project', query);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].matchType).toBe('grid');
      expect(matches[0].confidence).toBe(1.0);
    });

    it('should find adjacent grids when includeRelated is true', async () => {
      const mockChunks = [
        {
          content: 'Grid A-4 column location',
          metadata: { sheet_number: 'A-101', drawing_type: 'Floor Plan' },
        },
      ];

      mockPrisma.documentChunk.findMany.mockResolvedValue(mockChunks);

      const query: CrossSheetQuery = {
        location: 'Grid A-3',
        includeRelated: true,
      };
      const matches = await findSheetsAtLocation('test-project', query);

      const adjacentMatch = matches.find(m => m.confidence === 0.7);
      expect(adjacentMatch).toBeDefined();
    });

    it('should find rooms by number', async () => {
      const mockChunks = [
        {
          content: 'Room 101 is the main office space',
          metadata: { sheet_number: 'A-101' },
        },
      ];

      mockPrisma.documentChunk.findMany.mockResolvedValue(mockChunks);

      const query: CrossSheetQuery = { location: 'Room 101' };
      const matches = await findSheetsAtLocation('test-project', query);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].matchType).toBe('room');
      expect(matches[0].confidence).toBe(0.9);
    });

    it('should filter by discipline', async () => {
      const mockChunks = [
        {
          content: 'Grid A-3',
          metadata: { sheet_number: 'A-101', drawing_type: 'Floor Plan' },
        },
        {
          content: 'Grid A-3',
          metadata: { sheet_number: 'M-101', drawing_type: 'Mechanical Plan' },
        },
      ];

      mockPrisma.documentChunk.findMany.mockResolvedValue(mockChunks);

      const query: CrossSheetQuery = {
        location: 'Grid A-3',
        disciplines: ['architectural'],
      };
      const matches = await findSheetsAtLocation('test-project', query);

      expect(matches.every(m => m.sourceSheet === 'A-101')).toBe(true);
    });

    it('should perform fuzzy matching when includeRelated is true', async () => {
      const mockChunks = [
        {
          content: 'Located at northeast corner near entrance',
          metadata: { sheet_number: 'A-101' },
        },
      ];

      mockPrisma.documentChunk.findMany.mockResolvedValue(mockChunks);

      const query: CrossSheetQuery = {
        location: 'northeast corner',
        includeRelated: true,
      };
      const matches = await findSheetsAtLocation('test-project', query);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].matchType).toBe('element');
      expect(matches[0].confidence).toBe(0.5);
    });

    it('should sort matches by confidence', async () => {
      const mockChunks = [
        {
          content: 'Grid A-3 exact match',
          metadata: { sheet_number: 'A-101' },
        },
        {
          content: 'Grid A-4 adjacent',
          metadata: { sheet_number: 'A-102' },
        },
      ];

      mockPrisma.documentChunk.findMany.mockResolvedValue(mockChunks);

      const query: CrossSheetQuery = {
        location: 'Grid A-3',
        includeRelated: true,
      };
      const matches = await findSheetsAtLocation('test-project', query);

      // Results should be sorted highest confidence first
      for (let i = 0; i < matches.length - 1; i++) {
        expect(matches[i].confidence).toBeGreaterThanOrEqual(matches[i + 1].confidence);
      }
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.documentChunk.findMany.mockRejectedValue(new Error('Database error'));

      const query: CrossSheetQuery = { location: 'Grid A-3' };
      const matches = await findSheetsAtLocation('test-project', query);

      expect(matches).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('correlateTwoSheets', () => {
    it('should find common grids between sheets', async () => {
      const mockChunks1 = [
        {
          content: 'Grid A-1, Grid A-2, Grid B-1',
          metadata: { sheet_number: 'A-101' },
        },
      ];

      const mockChunks2 = [
        {
          content: 'Grid A-1, Grid A-2, Grid C-1',
          metadata: { sheet_number: 'M-101' },
        },
      ];

      mockPrisma.documentChunk.findMany
        .mockResolvedValueOnce(mockChunks1) // First call for A-101
        .mockResolvedValueOnce(mockChunks1) // extractGridSystem for A-101
        .mockResolvedValueOnce(mockChunks2) // extractGridSystem for M-101
        .mockResolvedValueOnce(mockChunks1) // Chunks for A-101 rooms
        .mockResolvedValueOnce(mockChunks2); // Chunks for M-101 rooms

      const result = await correlateTwoSheets('test-project', 'A-101', 'M-101');

      expect(result).toBeDefined();
      expect(result?.commonGrids.length).toBeGreaterThanOrEqual(2); // A-1, A-2
    });

    it('should calculate spatial overlap', async () => {
      const mockChunks1 = [
        {
          content: 'Grid A-1, Grid C-3',
          metadata: { sheet_number: 'A-101' },
        },
      ];

      const mockChunks2 = [
        {
          content: 'Grid B-2, Grid D-4',
          metadata: { sheet_number: 'M-101' },
        },
      ];

      mockPrisma.documentChunk.findMany
        .mockResolvedValueOnce(mockChunks1)
        .mockResolvedValueOnce(mockChunks1)
        .mockResolvedValueOnce(mockChunks2)
        .mockResolvedValueOnce(mockChunks1)
        .mockResolvedValueOnce(mockChunks2);

      const result = await correlateTwoSheets('test-project', 'A-101', 'M-101');

      expect(result?.spatialOverlap).toBeGreaterThanOrEqual(0);
      expect(result?.spatialOverlap).toBeLessThanOrEqual(1);
    });

    it('should identify common rooms', async () => {
      const mockChunks1 = [
        {
          content: 'Room 101, Room 102, Room 103',
          metadata: { sheet_number: 'A-101' },
        },
      ];

      const mockChunks2 = [
        {
          content: 'Room 101, Room 102, Room 104',
          metadata: { sheet_number: 'M-101' },
        },
      ];

      mockPrisma.documentChunk.findMany
        .mockResolvedValueOnce(mockChunks1)
        .mockResolvedValueOnce(mockChunks1)
        .mockResolvedValueOnce(mockChunks2)
        .mockResolvedValueOnce(mockChunks1)
        .mockResolvedValueOnce(mockChunks2);

      const result = await correlateTwoSheets('test-project', 'A-101', 'M-101');

      expect(result?.commonRooms.length).toBeGreaterThanOrEqual(2); // 101, 102
    });

    it('should return disciplines for both sheets', async () => {
      const mockChunks1 = [
        {
          content: 'Grid A-1',
          metadata: { sheet_number: 'A-101', drawing_type: 'Floor Plan' },
        },
      ];

      const mockChunks2 = [
        {
          content: 'Grid A-1',
          metadata: { sheet_number: 'M-101', drawing_type: 'HVAC Plan' },
        },
      ];

      // Need exact sequence for extractGridSystem calls within correlateTwoSheets
      mockPrisma.documentChunk.findMany
        .mockResolvedValueOnce(mockChunks1) // First extractGridSystem for A-101
        .mockResolvedValueOnce(mockChunks2) // Second extractGridSystem for M-101
        .mockResolvedValueOnce(mockChunks1) // Chunks for A-101 rooms
        .mockResolvedValueOnce(mockChunks2); // Chunks for M-101 rooms

      const result = await correlateTwoSheets('test-project', 'A-101', 'M-101');

      // Test that result is returned
      expect(result).toBeDefined();
      // Disciplines may be inferred from drawing_type metadata
      expect(['architectural', 'unknown']).toContain(result?.discipline1);
      expect(['mechanical', 'unknown']).toContain(result?.discipline2);
    });

    it('should handle sheets with different grids', async () => {
      const mockChunks1 = [
        {
          content: 'Grid X-50',
          metadata: { sheet_number: 'A-101' },
        },
      ];

      const mockChunks2 = [
        {
          content: 'Grid Y-60',
          metadata: { sheet_number: 'M-101' },
        },
      ];

      mockPrisma.documentChunk.findMany
        .mockResolvedValueOnce(mockChunks1)
        .mockResolvedValueOnce(mockChunks2)
        .mockResolvedValueOnce(mockChunks1)
        .mockResolvedValueOnce(mockChunks2);

      const result = await correlateTwoSheets('test-project', 'A-101', 'M-101');

      // Should return result with few or no common grids
      expect(result).toBeDefined();
      expect(result?.commonGrids.length).toBeLessThanOrEqual(1);
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.documentChunk.findMany.mockRejectedValue(new Error('Database error'));

      const result = await correlateTwoSheets('test-project', 'A-101', 'M-101');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('transformCoordinate', () => {
    it('should transform coordinate if it exists in common grids', async () => {
      const mockChunks = [
        {
          content: 'Grid A-1, Grid A-2, Grid B-1',
          metadata: { sheet_number: 'A-101' },
        },
      ];

      mockPrisma.documentChunk.findMany
        .mockResolvedValueOnce(mockChunks)
        .mockResolvedValueOnce(mockChunks)
        .mockResolvedValueOnce(mockChunks)
        .mockResolvedValueOnce(mockChunks)
        .mockResolvedValueOnce(mockChunks);

      const coord: GridCoordinate = { x: 'A', y: '1', numeric: { x: 1, y: 1 } };
      const result = await transformCoordinate('test-project', 'A-101', 'M-101', coord);

      expect(result).toBeDefined();
      expect(result?.x).toBe('A');
      expect(result?.y).toBe('1');
    });

    it('should return null if coordinate not in common grids', async () => {
      const mockChunks1 = [
        {
          content: 'Grid A-1',
          metadata: { sheet_number: 'A-101' },
        },
      ];

      const mockChunks2 = [
        {
          content: 'Grid B-2',
          metadata: { sheet_number: 'M-101' },
        },
      ];

      mockPrisma.documentChunk.findMany
        .mockResolvedValueOnce(mockChunks1)
        .mockResolvedValueOnce(mockChunks1)
        .mockResolvedValueOnce(mockChunks2)
        .mockResolvedValueOnce(mockChunks1)
        .mockResolvedValueOnce(mockChunks2);

      const coord: GridCoordinate = { x: 'C', y: '3', numeric: { x: 3, y: 3 } };
      const result = await transformCoordinate('test-project', 'A-101', 'M-101', coord);

      expect(result).toBeNull();
    });

    it('should return null if insufficient common grids', async () => {
      const mockChunks1 = [
        {
          content: 'Grid A-1',
          metadata: { sheet_number: 'A-101' },
        },
      ];

      mockPrisma.documentChunk.findMany
        .mockResolvedValueOnce(mockChunks1)
        .mockResolvedValueOnce(mockChunks1)
        .mockResolvedValueOnce(mockChunks1)
        .mockResolvedValueOnce(mockChunks1)
        .mockResolvedValueOnce(mockChunks1);

      const coord: GridCoordinate = { x: 'A', y: '1', numeric: { x: 1, y: 1 } };
      const result = await transformCoordinate('test-project', 'A-101', 'M-101', coord);

      // Only 1 common grid, need at least 2
      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.documentChunk.findMany.mockRejectedValue(new Error('Database error'));

      const coord: GridCoordinate = { x: 'A', y: '1', numeric: { x: 1, y: 1 } };
      const result = await transformCoordinate('test-project', 'A-101', 'M-101', coord);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle multi-letter grid coordinates correctly', () => {
      const coord = parseGridCoordinate('AA-10');

      expect(coord?.numeric?.x).toBe(27); // A=1, Z=26, AA=27
    });

    it('should handle very large grid numbers', () => {
      const coord = parseGridCoordinate('Z-999');

      expect(coord?.numeric?.y).toBe(999);
    });

    it('should handle empty content gracefully', async () => {
      const mockChunks = [
        {
          content: '',
          metadata: { sheet_number: 'A-101' },
        },
      ];

      mockPrisma.documentChunk.findMany.mockResolvedValue(mockChunks);

      const result = await extractGridSystem('test-project', 'A-101');

      expect(result?.gridSystem).toEqual([]);
    });

    it('should handle special characters in grid references', () => {
      const coord = parseGridCoordinate('Grid: A-3 (Main)');

      expect(coord?.x).toBe('A');
      expect(coord?.y).toBe('3');
    });
  });
});
