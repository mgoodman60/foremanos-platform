import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  autoGenerateTakeoffs,
  triggerAutoTakeoffAfterProcessing
} from '@/lib/auto-takeoff-generator';

// Mock dependencies
const mockPrisma = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn()
  },
  materialTakeoff: {
    create: vi.fn(),
    update: vi.fn()
  },
  takeoffLineItem: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn()
  },
  document: {
    findUnique: vi.fn()
  }
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
}));

const mockExtractFinishSchedules = vi.hoisted(() => vi.fn());
const mockExtractMEPTakeoffs = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createScopedLogger: vi.fn(() => mockLogger)
}));
vi.mock('@/lib/finish-schedule-extractor', () => ({
  extractFinishSchedules: mockExtractFinishSchedules
}));
vi.mock('@/lib/mep-takeoff-generator', () => ({
  extractMEPTakeoffs: mockExtractMEPTakeoffs
}));
vi.mock('@/lib/project-specific-pricing', () => ({
  getProjectSpecificPrice: vi.fn().mockResolvedValue(null),
  getConcreteSpecs: vi.fn(),
  getSiteworkSpecs: vi.fn()
}));

describe('auto-takeoff-generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('autoGenerateTakeoffs', () => {
    it('should generate takeoffs for rooms with finish schedules', async () => {
      mockExtractFinishSchedules.mockResolvedValue({
        matchedRooms: 2,
        totalFinishes: 8
      });

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        ownerId: 'user1',
        Room: [
          {
            id: 'room1',
            roomNumber: '101',
            name: 'Office',
            area: 200,
            FinishScheduleItem: [
              {
                id: 'finish1',
                category: 'flooring',
                material: 'LVT',
                finishType: 'Luxury Vinyl Tile'
              },
              {
                id: 'finish2',
                category: 'walls',
                material: 'GWB',
                finishType: 'Gypsum Wall Board'
              }
            ]
          }
        ],
        MaterialTakeoff: []
      });

      mockPrisma.materialTakeoff.create.mockResolvedValue({
        id: 'takeoff1'
      });

      mockPrisma.takeoffLineItem.findFirst.mockResolvedValue(null);
      mockPrisma.takeoffLineItem.create.mockResolvedValue({});
      mockPrisma.takeoffLineItem.findMany.mockResolvedValue([
        { totalCost: 2200, confidence: 85 },
        { totalCost: 1800, confidence: 85 }
      ]);

      mockExtractMEPTakeoffs.mockResolvedValue({
        itemsCreated: 5,
        totalCost: 15000
      });

      const result = await autoGenerateTakeoffs('test-project');

      expect(result.success).toBe(true);
      expect(result.stats.roomsProcessed).toBe(1);
      expect(result.stats.itemsCreated).toBeGreaterThan(0);
      expect(mockPrisma.materialTakeoff.create).toHaveBeenCalled();
    });

    it('should create new takeoff if none exists', async () => {
      mockExtractFinishSchedules.mockResolvedValue({
        matchedRooms: 0,
        totalFinishes: 0
      });

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        ownerId: 'user1',
        Room: [],
        MaterialTakeoff: []
      });

      mockPrisma.materialTakeoff.create.mockResolvedValue({
        id: 'takeoff1'
      });

      mockPrisma.takeoffLineItem.findMany.mockResolvedValue([]);
      mockExtractMEPTakeoffs.mockResolvedValue({
        itemsCreated: 0,
        totalCost: 0
      });

      await autoGenerateTakeoffs('test-project');

      expect(mockPrisma.materialTakeoff.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Auto-Generated Takeoff',
          status: 'draft',
          extractedBy: 'system'
        })
      });
    });

    it('should use existing takeoff if available', async () => {
      mockExtractFinishSchedules.mockResolvedValue({
        matchedRooms: 0,
        totalFinishes: 0
      });

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        ownerId: 'user1',
        Room: [],
        MaterialTakeoff: [{ id: 'existing-takeoff' }]
      });

      mockPrisma.takeoffLineItem.findMany.mockResolvedValue([]);
      mockExtractMEPTakeoffs.mockResolvedValue({
        itemsCreated: 0,
        totalCost: 0
      });

      await autoGenerateTakeoffs('test-project');

      expect(mockPrisma.materialTakeoff.create).not.toHaveBeenCalled();
    });

    it('should skip rooms without area', async () => {
      mockExtractFinishSchedules.mockResolvedValue({
        matchedRooms: 1,
        totalFinishes: 2
      });

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        ownerId: 'user1',
        Room: [
          {
            id: 'room1',
            roomNumber: '101',
            area: null,
            FinishScheduleItem: [{ category: 'flooring', material: 'LVT' }]
          }
        ],
        MaterialTakeoff: [{ id: 'takeoff1' }]
      });

      mockPrisma.takeoffLineItem.findMany.mockResolvedValue([]);
      mockExtractMEPTakeoffs.mockResolvedValue({
        itemsCreated: 0,
        totalCost: 0
      });

      const result = await autoGenerateTakeoffs('test-project');

      expect(result.stats.roomsProcessed).toBe(0);
    });

    it('should skip rooms with no finish items', async () => {
      mockExtractFinishSchedules.mockResolvedValue({
        matchedRooms: 0,
        totalFinishes: 0
      });

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        ownerId: 'user1',
        Room: [
          {
            id: 'room1',
            roomNumber: '101',
            area: 200,
            FinishScheduleItem: []
          }
        ],
        MaterialTakeoff: [{ id: 'takeoff1' }]
      });

      mockPrisma.takeoffLineItem.findMany.mockResolvedValue([]);
      mockExtractMEPTakeoffs.mockResolvedValue({
        itemsCreated: 0,
        totalCost: 0
      });

      await autoGenerateTakeoffs('test-project');

      expect(mockPrisma.takeoffLineItem.create).not.toHaveBeenCalled();
    });

    it('should calculate flooring quantities with waste factor', async () => {
      mockExtractFinishSchedules.mockResolvedValue({
        matchedRooms: 1,
        totalFinishes: 1
      });

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        ownerId: 'user1',
        Room: [
          {
            id: 'room1',
            roomNumber: '101',
            area: 100,
            FinishScheduleItem: [
              { category: 'flooring', material: 'LVT' }
            ]
          }
        ],
        MaterialTakeoff: [{ id: 'takeoff1' }]
      });

      mockPrisma.takeoffLineItem.findFirst.mockResolvedValue(null);
      mockPrisma.takeoffLineItem.create.mockResolvedValue({});
      mockPrisma.takeoffLineItem.findMany.mockResolvedValue([]);
      mockExtractMEPTakeoffs.mockResolvedValue({
        itemsCreated: 0,
        totalCost: 0
      });

      await autoGenerateTakeoffs('test-project');

      const createCall = mockPrisma.takeoffLineItem.create.mock.calls[0][0];
      expect(createCall.data.quantity).toBeGreaterThan(100); // Should include waste
      expect(createCall.data.unit).toBe('SF');
    });

    it('should calculate wall quantities from floor area', async () => {
      mockExtractFinishSchedules.mockResolvedValue({
        matchedRooms: 1,
        totalFinishes: 1
      });

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        ownerId: 'user1',
        Room: [
          {
            id: 'room1',
            roomNumber: '101',
            area: 100,
            FinishScheduleItem: [
              { category: 'walls', material: 'Drywall' }
            ]
          }
        ],
        MaterialTakeoff: [{ id: 'takeoff1' }]
      });

      mockPrisma.takeoffLineItem.findFirst.mockResolvedValue(null);
      mockPrisma.takeoffLineItem.create.mockResolvedValue({});
      mockPrisma.takeoffLineItem.findMany.mockResolvedValue([]);
      mockExtractMEPTakeoffs.mockResolvedValue({
        itemsCreated: 0,
        totalCost: 0
      });

      await autoGenerateTakeoffs('test-project');

      const createCall = mockPrisma.takeoffLineItem.create.mock.calls[0][0];
      expect(createCall.data.quantity).toBeGreaterThan(100); // Wall area > floor area
      expect(createCall.data.unit).toBe('SF');
    });

    it('should calculate ceiling quantities', async () => {
      mockExtractFinishSchedules.mockResolvedValue({
        matchedRooms: 1,
        totalFinishes: 1
      });

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        ownerId: 'user1',
        Room: [
          {
            id: 'room1',
            roomNumber: '101',
            area: 100,
            FinishScheduleItem: [
              { category: 'ceiling', material: 'ACT' }
            ]
          }
        ],
        MaterialTakeoff: [{ id: 'takeoff1' }]
      });

      mockPrisma.takeoffLineItem.findFirst.mockResolvedValue(null);
      mockPrisma.takeoffLineItem.create.mockResolvedValue({});
      mockPrisma.takeoffLineItem.findMany.mockResolvedValue([]);
      mockExtractMEPTakeoffs.mockResolvedValue({
        itemsCreated: 0,
        totalCost: 0
      });

      await autoGenerateTakeoffs('test-project');

      const createCall = mockPrisma.takeoffLineItem.create.mock.calls[0][0];
      expect(createCall.data.unit).toBe('SF');
    });

    it('should calculate base quantities in linear feet', async () => {
      mockExtractFinishSchedules.mockResolvedValue({
        matchedRooms: 1,
        totalFinishes: 1
      });

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        ownerId: 'user1',
        Room: [
          {
            id: 'room1',
            roomNumber: '101',
            area: 100,
            FinishScheduleItem: [
              { category: 'base', material: 'Rubber Base' }
            ]
          }
        ],
        MaterialTakeoff: [{ id: 'takeoff1' }]
      });

      mockPrisma.takeoffLineItem.findFirst.mockResolvedValue(null);
      mockPrisma.takeoffLineItem.create.mockResolvedValue({});
      mockPrisma.takeoffLineItem.findMany.mockResolvedValue([]);
      mockExtractMEPTakeoffs.mockResolvedValue({
        itemsCreated: 0,
        totalCost: 0
      });

      await autoGenerateTakeoffs('test-project');

      const createCall = mockPrisma.takeoffLineItem.create.mock.calls[0][0];
      expect(createCall.data.unit).toBe('LF');
    });

    it('should update existing items instead of creating duplicates', async () => {
      mockExtractFinishSchedules.mockResolvedValue({
        matchedRooms: 1,
        totalFinishes: 1
      });

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        ownerId: 'user1',
        Room: [
          {
            id: 'room1',
            roomNumber: '101',
            name: 'Office',
            area: 100,
            FinishScheduleItem: [
              { category: 'flooring', material: 'LVT' }
            ]
          }
        ],
        MaterialTakeoff: [{ id: 'takeoff1' }]
      });

      mockPrisma.takeoffLineItem.findFirst.mockResolvedValue({
        id: 'existing-item'
      });
      mockPrisma.takeoffLineItem.update.mockResolvedValue({});
      mockPrisma.takeoffLineItem.findMany.mockResolvedValue([]);
      mockExtractMEPTakeoffs.mockResolvedValue({
        itemsCreated: 0,
        totalCost: 0
      });

      await autoGenerateTakeoffs('test-project');

      expect(mockPrisma.takeoffLineItem.update).toHaveBeenCalled();
      expect(mockPrisma.takeoffLineItem.create).not.toHaveBeenCalled();
    });

    it('should include MEP takeoffs', async () => {
      mockExtractFinishSchedules.mockResolvedValue({
        matchedRooms: 0,
        totalFinishes: 0
      });

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        ownerId: 'user1',
        Room: [],
        MaterialTakeoff: [{ id: 'takeoff1' }]
      });

      mockPrisma.takeoffLineItem.findMany.mockResolvedValue([]);
      mockExtractMEPTakeoffs.mockResolvedValue({
        itemsCreated: 10,
        totalCost: 25000
      });

      const result = await autoGenerateTakeoffs('test-project');

      expect(result.stats.itemsCreated).toBe(10);
      expect(result.stats.totalCost).toBe(25000);
    });

    it('should handle MEP extraction errors gracefully', async () => {
      mockExtractFinishSchedules.mockResolvedValue({
        matchedRooms: 0,
        totalFinishes: 0
      });

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        ownerId: 'user1',
        Room: [],
        MaterialTakeoff: [{ id: 'takeoff1' }]
      });

      mockPrisma.takeoffLineItem.findMany.mockResolvedValue([]);
      mockExtractMEPTakeoffs.mockRejectedValue(new Error('MEP extraction failed'));

      const result = await autoGenerateTakeoffs('test-project');

      expect(result.success).toBe(true);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should update takeoff totals after generation', async () => {
      mockExtractFinishSchedules.mockResolvedValue({
        matchedRooms: 1,
        totalFinishes: 1
      });

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        ownerId: 'user1',
        Room: [
          {
            id: 'room1',
            roomNumber: '101',
            area: 100,
            FinishScheduleItem: [{ category: 'flooring', material: 'LVT' }]
          }
        ],
        MaterialTakeoff: [{ id: 'takeoff1' }]
      });

      mockPrisma.takeoffLineItem.findFirst.mockResolvedValue(null);
      mockPrisma.takeoffLineItem.create.mockResolvedValue({});
      mockPrisma.takeoffLineItem.findMany.mockResolvedValue([
        { totalCost: 1500, confidence: 85 }
      ]);
      mockPrisma.materialTakeoff.update.mockResolvedValue({});
      mockExtractMEPTakeoffs.mockResolvedValue({
        itemsCreated: 0,
        totalCost: 0
      });

      await autoGenerateTakeoffs('test-project');

      expect(mockPrisma.materialTakeoff.update).toHaveBeenCalledWith({
        where: { id: 'takeoff1' },
        data: expect.objectContaining({
          totalCost: expect.any(Number)
        })
      });
    });

    it('should throw error for non-existent project', async () => {
      mockExtractFinishSchedules.mockResolvedValue({
        matchedRooms: 0,
        totalFinishes: 0
      });

      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(autoGenerateTakeoffs('non-existent')).rejects.toThrow('Project not found');
    });

    it('should set high confidence for auto-generated items', async () => {
      mockExtractFinishSchedules.mockResolvedValue({
        matchedRooms: 1,
        totalFinishes: 1
      });

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        ownerId: 'user1',
        Room: [
          {
            id: 'room1',
            roomNumber: '101',
            area: 100,
            FinishScheduleItem: [{ category: 'flooring', material: 'LVT' }]
          }
        ],
        MaterialTakeoff: [{ id: 'takeoff1' }]
      });

      mockPrisma.takeoffLineItem.findFirst.mockResolvedValue(null);
      mockPrisma.takeoffLineItem.create.mockResolvedValue({});
      mockPrisma.takeoffLineItem.findMany.mockResolvedValue([]);
      mockExtractMEPTakeoffs.mockResolvedValue({
        itemsCreated: 0,
        totalCost: 0
      });

      await autoGenerateTakeoffs('test-project');

      const createCall = mockPrisma.takeoffLineItem.create.mock.calls[0][0];
      expect(createCall.data.confidence).toBe(85);
      expect(createCall.data.verificationStatus).toBe('auto_approved');
    });
  });

  describe('triggerAutoTakeoffAfterProcessing', () => {
    it('should trigger auto-generation for plans documents', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc1',
        name: 'Floor Plans',
        fileName: 'floor-plans.pdf',
        Project: {
          slug: 'test-project'
        }
      });

      mockExtractFinishSchedules.mockResolvedValue({
        matchedRooms: 1,
        totalFinishes: 4
      });

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        ownerId: 'user1',
        Room: [],
        MaterialTakeoff: [{ id: 'takeoff1' }]
      });

      mockPrisma.takeoffLineItem.findMany.mockResolvedValue([]);
      mockExtractMEPTakeoffs.mockResolvedValue({
        itemsCreated: 0,
        totalCost: 0
      });

      await triggerAutoTakeoffAfterProcessing('doc1');

      // Should not block - runs async
      expect(mockPrisma.document.findUnique).toHaveBeenCalled();
    });

    it('should skip documents without projects', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc1',
        name: 'Document',
        Project: null
      });

      await triggerAutoTakeoffAfterProcessing('doc1');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('no project'),
        expect.any(Object)
      );
    });

    it('should skip non-plans documents', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc1',
        name: 'Report',
        fileName: 'monthly-report.pdf',
        Project: {
          slug: 'test-project'
        }
      });

      await triggerAutoTakeoffAfterProcessing('doc1');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('does not appear to be plans'),
        expect.any(Object)
      );
    });

    it('should recognize schedule documents', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc1',
        name: 'Finish Schedule',
        fileName: 'finish-schedule.pdf',
        Project: {
          slug: 'test-project'
        }
      });

      mockExtractFinishSchedules.mockResolvedValue({
        matchedRooms: 0,
        totalFinishes: 0
      });

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        ownerId: 'user1',
        Room: [],
        MaterialTakeoff: [{ id: 'takeoff1' }]
      });

      mockPrisma.takeoffLineItem.findMany.mockResolvedValue([]);
      mockExtractMEPTakeoffs.mockResolvedValue({
        itemsCreated: 0,
        totalCost: 0
      });

      await triggerAutoTakeoffAfterProcessing('doc1');

      // Should trigger generation
      expect(mockPrisma.document.findUnique).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.document.findUnique.mockRejectedValue(new Error('Database error'));

      await triggerAutoTakeoffAfterProcessing('doc1');

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('pricing calculations', () => {
    it('should apply unit costs to quantities', async () => {
      mockExtractFinishSchedules.mockResolvedValue({
        matchedRooms: 1,
        totalFinishes: 1
      });

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj1',
        ownerId: 'user1',
        Room: [
          {
            id: 'room1',
            roomNumber: '101',
            area: 100,
            FinishScheduleItem: [{ category: 'flooring', material: 'LVT' }]
          }
        ],
        MaterialTakeoff: [{ id: 'takeoff1' }]
      });

      mockPrisma.takeoffLineItem.findFirst.mockResolvedValue(null);
      mockPrisma.takeoffLineItem.create.mockResolvedValue({});
      mockPrisma.takeoffLineItem.findMany.mockResolvedValue([]);
      mockExtractMEPTakeoffs.mockResolvedValue({
        itemsCreated: 0,
        totalCost: 0
      });

      await autoGenerateTakeoffs('test-project');

      const createCall = mockPrisma.takeoffLineItem.create.mock.calls[0][0];
      expect(createCall.data.unitCost).toBeGreaterThan(0);
      expect(createCall.data.totalCost).toBeGreaterThan(0);
    });
  });
});
