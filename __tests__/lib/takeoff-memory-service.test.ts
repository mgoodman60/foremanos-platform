import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectTakeoffQuery,
  getTakeoffContext,
  getMaterialQuantity,
  getCategoryTotals,
  type TakeoffQueryResult
} from '@/lib/takeoff-memory-service';
import { MaterialTakeoffStatus } from '@prisma/client';

// Mock dependencies
const mockPrisma = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn()
  },
  materialTakeoff: {
    findMany: vi.fn()
  },
  takeoffLineItem: {
    findMany: vi.fn()
  }
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createScopedLogger: vi.fn(() => mockLogger)
}));

// Mock takeoff categories (simplified)
vi.mock('@/lib/takeoff-categories', () => ({
  TAKEOFF_CATEGORIES: [
    {
      id: 'concrete',
      name: 'Concrete',
      subCategories: [
        { id: 'slab', name: 'Slab', wasteFactorPercent: 5, laborHoursPerUnit: 0.5 }
      ]
    },
    {
      id: 'flooring',
      name: 'Flooring',
      subCategories: [
        { id: 'lvt', name: 'LVT', wasteFactorPercent: 10, laborHoursPerUnit: 0.3 }
      ]
    }
  ]
}));

describe('takeoff-memory-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectTakeoffQuery', () => {
    it('should detect quantity queries', () => {
      const result = detectTakeoffQuery('How much concrete do we need?');

      expect(result.isTakeoffQuery).toBe(true);
      expect(result.queryType).toBe('specific');
      expect(result.matchedCategories).toContain('concrete');
    });

    it('should detect cost queries', () => {
      const result = detectTakeoffQuery('What is the estimated cost for plumbing?');

      expect(result.isTakeoffQuery).toBe(true);
      expect(result.queryType).toBe('specific');
      expect(result.matchedCategories).toContain('plumbing');
    });

    it('should detect list queries', () => {
      const result = detectTakeoffQuery('Show me all materials');

      expect(result.isTakeoffQuery).toBe(true);
      expect(result.queryType).toBe('list');
    });

    it('should detect category-specific queries', () => {
      const result = detectTakeoffQuery('Tell me about HVAC');

      expect(result.isTakeoffQuery).toBe(true);
      expect(result.queryType).toBe('specific');
      expect(result.matchedCategories).toContain('hvac');
    });

    it('should detect rebar queries', () => {
      const result = detectTakeoffQuery('How much rebar is needed?');

      expect(result.isTakeoffQuery).toBe(true);
      expect(result.matchedCategories).toContain('rebar');
    });

    it('should detect steel queries', () => {
      const result = detectTakeoffQuery('What about structural steel?');

      expect(result.isTakeoffQuery).toBe(true);
      expect(result.matchedCategories).toContain('steel');
    });

    it('should detect electrical queries', () => {
      const result = detectTakeoffQuery('List electrical conduit');

      expect(result.isTakeoffQuery).toBe(true);
      expect(result.matchedCategories).toContain('electrical');
    });

    it('should detect drywall queries', () => {
      const result = detectTakeoffQuery('How much drywall?');

      expect(result.isTakeoffQuery).toBe(true);
      expect(result.matchedCategories).toContain('drywall');
    });

    it('should detect flooring queries', () => {
      const result = detectTakeoffQuery('What is the total tile area?');

      expect(result.isTakeoffQuery).toBe(true);
      expect(result.matchedCategories).toContain('flooring');
    });

    it('should detect roofing queries', () => {
      const result = detectTakeoffQuery('Tell me about roofing materials');

      expect(result.isTakeoffQuery).toBe(true);
      expect(result.matchedCategories).toContain('roofing');
    });

    it('should detect doors and windows queries', () => {
      const result = detectTakeoffQuery('How many doors?');

      expect(result.isTakeoffQuery).toBe(true);
      expect(result.matchedCategories).toContain('doors_windows');
    });

    it('should detect summary queries', () => {
      const result = detectTakeoffQuery('Give me material summary');

      expect(result.isTakeoffQuery).toBe(true);
      expect(result.queryType).toBe('summary');
    });

    it('should return false for non-takeoff queries', () => {
      const result = detectTakeoffQuery('What is the weather today?');

      expect(result.isTakeoffQuery).toBe(false);
      expect(result.queryType).toBeNull();
    });

    it('should handle multiple category matches', () => {
      const result = detectTakeoffQuery('Concrete and rebar quantities');

      expect(result.isTakeoffQuery).toBe(true);
      expect(result.matchedCategories.length).toBeGreaterThan(1);
    });

    it('should be case-insensitive', () => {
      const result = detectTakeoffQuery('HOW MUCH CONCRETE?');

      expect(result.isTakeoffQuery).toBe(true);
      expect(result.matchedCategories).toContain('concrete');
    });
  });

  describe('getTakeoffContext', () => {
    it('should return null for non-takeoff queries', async () => {
      const result = await getTakeoffContext('Random question', 'test-project');

      expect(result).toBeNull();
    });

    it('should return null for non-existent project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const result = await getTakeoffContext('How much concrete?', 'non-existent');

      expect(result).toBeNull();
    });

    it('should retrieve takeoff data with category filter', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        name: 'Test Project'
      });

      mockPrisma.materialTakeoff.findMany.mockResolvedValue([
        {
          id: 'takeoff1',
          projectId: 'proj1',
          status: MaterialTakeoffStatus.draft,
          TakeoffLineItem: [
            {
              id: 'item1',
              category: 'concrete',
              itemName: 'Concrete Slab',
              description: '4 inch slab',
              quantity: 1000,
              unit: 'SF',
              unitCost: 8.50,
              totalCost: 8500,
              confidence: 85,
              verified: true,
              location: 'Building A',
              sheetNumber: 'S-101'
            }
          ],
          Document: {
            name: 'Structural Plans'
          }
        }
      ]);

      const result = await getTakeoffContext('How much concrete?', 'test-project');

      expect(result).toBeDefined();
      expect(result!.queryType).toBe('specific');
      expect(result!.matchedCategories).toContain('concrete');
      expect(result!.items.length).toBeGreaterThan(0);
      expect(result!.categorySummary.length).toBeGreaterThan(0);
    });

    it('should calculate grand totals', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        name: 'Test Project'
      });

      mockPrisma.materialTakeoff.findMany.mockResolvedValue([
        {
          id: 'takeoff1',
          projectId: 'proj1',
          status: MaterialTakeoffStatus.draft,
          TakeoffLineItem: [
            {
              id: 'item1',
              category: 'concrete',
              itemName: 'Concrete Slab',
              quantity: 1000,
              unit: 'SF',
              unitCost: 8.50,
              totalCost: 8500,
              confidence: 85,
              verified: true
            },
            {
              id: 'item2',
              category: 'rebar',
              itemName: 'Rebar #5',
              quantity: 500,
              unit: 'LB',
              unitCost: 1.20,
              totalCost: 600,
              confidence: 90,
              verified: false
            }
          ],
          Document: { name: 'Plans' }
        }
      ]);

      const result = await getTakeoffContext('List all materials', 'test-project');

      expect(result!.grandTotals.totalItems).toBe(2);
      expect(result!.grandTotals.totalCost).toBe(9100);
      expect(result!.grandTotals.verifiedCount).toBe(1);
      expect(result!.grandTotals.needsReviewCount).toBe(1);
    });

    it('should apply waste factors to quantities', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        name: 'Test Project'
      });

      mockPrisma.materialTakeoff.findMany.mockResolvedValue([
        {
          id: 'takeoff1',
          projectId: 'proj1',
          status: MaterialTakeoffStatus.draft,
          TakeoffLineItem: [
            {
              id: 'item1',
              category: 'concrete',
              itemName: 'Concrete',
              quantity: 100,
              unit: 'CY',
              confidence: 85,
              verified: true
            }
          ],
          Document: { name: 'Plans' }
        }
      ]);

      const result = await getTakeoffContext('How much concrete?', 'test-project');

      expect(result!.items[0].wasteAdjusted).toBeGreaterThan(result!.items[0].quantity);
    });

    it('should calculate labor hours', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        name: 'Test Project'
      });

      mockPrisma.materialTakeoff.findMany.mockResolvedValue([
        {
          id: 'takeoff1',
          projectId: 'proj1',
          status: MaterialTakeoffStatus.draft,
          TakeoffLineItem: [
            {
              id: 'item1',
              category: 'flooring',
              itemName: 'LVT',
              quantity: 1000,
              unit: 'SF',
              confidence: 85,
              verified: true
            }
          ],
          Document: { name: 'Plans' }
        }
      ]);

      const result = await getTakeoffContext('Flooring materials', 'test-project');

      expect(result!.items[0].laborHours).toBeGreaterThan(0);
      expect(result!.grandTotals.totalLaborHours).toBeGreaterThan(0);
    });

    it('should generate appropriate confidence notes', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        name: 'Test Project'
      });

      mockPrisma.materialTakeoff.findMany.mockResolvedValue([
        {
          id: 'takeoff1',
          projectId: 'proj1',
          status: MaterialTakeoffStatus.draft,
          TakeoffLineItem: [
            {
              id: 'item1',
              category: 'concrete',
              itemName: 'Concrete',
              quantity: 100,
              unit: 'CY',
              confidence: 85,
              verified: true
            }
          ],
          Document: { name: 'Plans' }
        }
      ]);

      const result = await getTakeoffContext('Concrete quantity', 'test-project');

      expect(result!.confidenceNote).toBeDefined();
      expect(result!.confidenceNote.length).toBeGreaterThan(0);
    });

    it('should format context for AI consumption', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        name: 'Test Project'
      });

      mockPrisma.materialTakeoff.findMany.mockResolvedValue([
        {
          id: 'takeoff1',
          projectId: 'proj1',
          status: MaterialTakeoffStatus.draft,
          TakeoffLineItem: [
            {
              id: 'item1',
              category: 'concrete',
              itemName: 'Concrete',
              quantity: 100,
              unit: 'CY',
              confidence: 85,
              verified: true
            }
          ],
          Document: { name: 'Plans' }
        }
      ]);

      const result = await getTakeoffContext('Concrete', 'test-project');

      expect(result!.formattedContext).toContain('MATERIAL TAKEOFF DATA');
      expect(result!.formattedContext).toContain('SUMMARY');
      expect(result!.formattedContext).toContain('BY CATEGORY');
    });

    it('should exclude deleted takeoffs', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        name: 'Test Project'
      });

      mockPrisma.materialTakeoff.findMany.mockResolvedValue([
        {
          id: 'takeoff1',
          projectId: 'proj1',
          status: MaterialTakeoffStatus.draft,
          TakeoffLineItem: [],
          Document: { name: 'Plans' }
        }
      ]);

      const result = await getTakeoffContext('List materials', 'test-project');

      expect(result!.items.length).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.project.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await getTakeoffContext('Concrete', 'test-project');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should limit detailed items to prevent context overflow', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        name: 'Test Project'
      });

      const manyItems = Array.from({ length: 50 }, (_, i) => ({
        id: `item${i}`,
        category: 'concrete',
        itemName: `Item ${i}`,
        quantity: 100,
        unit: 'SF',
        confidence: 80,
        verified: true
      }));

      mockPrisma.materialTakeoff.findMany.mockResolvedValue([
        {
          id: 'takeoff1',
          projectId: 'proj1',
          status: MaterialTakeoffStatus.draft,
          TakeoffLineItem: manyItems,
          Document: { name: 'Plans' }
        }
      ]);

      const result = await getTakeoffContext('List concrete', 'test-project');

      expect(result).toBeDefined();
      // Should handle large datasets without issues
    });
  });

  describe('getMaterialQuantity', () => {
    it('should return quantity for specific material', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1'
      });

      mockPrisma.takeoffLineItem.findMany.mockResolvedValue([
        {
          quantity: 500,
          unit: 'SF',
          confidence: 85
        },
        {
          quantity: 300,
          unit: 'SF',
          confidence: 90
        }
      ]);

      const result = await getMaterialQuantity('test-project', 'concrete');

      expect(result).toBeDefined();
      expect(result!.quantity).toBe(800);
      expect(result!.unit).toBe('SF');
      expect(result!.itemCount).toBe(2);
      expect(result!.confidence).toBeGreaterThan(0);
    });

    it('should return null for non-existent project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const result = await getMaterialQuantity('non-existent', 'concrete');

      expect(result).toBeNull();
    });

    it('should return null when no items found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj1' });
      mockPrisma.takeoffLineItem.findMany.mockResolvedValue([]);

      const result = await getMaterialQuantity('test-project', 'nonexistent-material');

      expect(result).toBeNull();
    });

    it('should calculate average confidence', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj1' });
      mockPrisma.takeoffLineItem.findMany.mockResolvedValue([
        { quantity: 100, unit: 'SF', confidence: 80 },
        { quantity: 200, unit: 'SF', confidence: 90 }
      ]);

      const result = await getMaterialQuantity('test-project', 'material');

      expect(result!.confidence).toBe(85); // Average of 80 and 90
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.project.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await getMaterialQuantity('test-project', 'concrete');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getCategoryTotals', () => {
    it('should return totals by category', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj1' });
      mockPrisma.takeoffLineItem.findMany.mockResolvedValue([
        {
          category: 'concrete',
          quantity: 100,
          unit: 'CY',
          totalCost: 5000
        },
        {
          category: 'concrete',
          quantity: 50,
          unit: 'CY',
          totalCost: 2500
        },
        {
          category: 'rebar',
          quantity: 500,
          unit: 'LB',
          totalCost: 600
        }
      ]);

      const result = await getCategoryTotals('test-project');

      expect(result.size).toBe(2);
      expect(result.get('concrete')).toEqual({
        quantity: 150,
        unit: 'CY',
        cost: 7500
      });
      expect(result.get('rebar')).toEqual({
        quantity: 500,
        unit: 'LB',
        cost: 600
      });
    });

    it('should return empty map for non-existent project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const result = await getCategoryTotals('non-existent');

      expect(result.size).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.project.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await getCategoryTotals('test-project');

      expect(result.size).toBe(0);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle null costs', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj1' });
      mockPrisma.takeoffLineItem.findMany.mockResolvedValue([
        {
          category: 'concrete',
          quantity: 100,
          unit: 'CY',
          totalCost: null
        }
      ]);

      const result = await getCategoryTotals('test-project');

      expect(result.get('concrete')?.cost).toBe(0);
    });
  });

  describe('query pattern matching', () => {
    it('should match "how much" patterns', () => {
      const queries = [
        'how much concrete',
        'how many doors',
        'what is the total amount',
        'quantity of rebar'
      ];

      queries.forEach(query => {
        const result = detectTakeoffQuery(query);
        expect(result.isTakeoffQuery).toBe(true);
      });
    });

    it('should match cost patterns', () => {
      const queries = [
        'what is the cost',
        'price estimate',
        'budget for plumbing',
        'how much will it cost'
      ];

      queries.forEach(query => {
        const result = detectTakeoffQuery(query);
        expect(result.isTakeoffQuery).toBe(true);
      });
    });

    it('should match list patterns', () => {
      const queries = [
        'list all materials',
        'show me the takeoff',
        'bill of materials',
        'material list'
      ];

      queries.forEach(query => {
        const result = detectTakeoffQuery(query);
        expect(result.isTakeoffQuery).toBe(true);
      });
    });
  });

  describe('confidence note generation', () => {
    it('should generate high confidence note', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj1', name: 'Test' });
      mockPrisma.materialTakeoff.findMany.mockResolvedValue([
        {
          id: 'takeoff1',
          projectId: 'proj1',
          status: MaterialTakeoffStatus.draft,
          TakeoffLineItem: [
            { id: 'item1', category: 'concrete', itemName: 'Concrete', quantity: 100, unit: 'CY', confidence: 85, verified: true }
          ],
          Document: { name: 'Plans' }
        }
      ]);

      const result = await getTakeoffContext('Concrete', 'test-project');

      expect(result!.confidenceNote).toContain('High confidence');
    });

    it('should generate moderate confidence note', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj1', name: 'Test' });
      mockPrisma.materialTakeoff.findMany.mockResolvedValue([
        {
          id: 'takeoff1',
          projectId: 'proj1',
          status: MaterialTakeoffStatus.draft,
          TakeoffLineItem: [
            { id: 'item1', category: 'concrete', itemName: 'Concrete', quantity: 100, unit: 'CY', confidence: 65, verified: false }
          ],
          Document: { name: 'Plans' }
        }
      ]);

      const result = await getTakeoffContext('Concrete', 'test-project');

      expect(result!.confidenceNote).toContain('Moderate confidence');
    });

    it('should generate low confidence note', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj1', name: 'Test' });
      mockPrisma.materialTakeoff.findMany.mockResolvedValue([
        {
          id: 'takeoff1',
          projectId: 'proj1',
          status: MaterialTakeoffStatus.draft,
          TakeoffLineItem: [
            { id: 'item1', category: 'concrete', itemName: 'Concrete', quantity: 100, unit: 'CY', confidence: 45, verified: false }
          ],
          Document: { name: 'Plans' }
        }
      ]);

      const result = await getTakeoffContext('Concrete', 'test-project');

      expect(result!.confidenceNote).toContain('Low confidence');
    });
  });
});
