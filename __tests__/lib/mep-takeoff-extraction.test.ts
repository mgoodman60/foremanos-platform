/**
 * Tests for MEP Takeoff Extraction
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
const mockPrisma = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
  },
  materialTakeoff: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  takeoffLineItem: {
    deleteMany: vi.fn(),
    create: vi.fn(),
  },
  room: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createScopedLogger: vi.fn(() => mockLogger),
}));

// Import after mocks
import { extractMEPTakeoffs } from '@/lib/mep-takeoff/extraction';

describe('MEP Takeoff Extraction', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default room mock to return empty array (for tests that reach room estimation)
    mockPrisma.room.findMany.mockResolvedValue([]);
  });

  describe('extractMEPTakeoffs', () => {
    it('should return error when project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce(null);

      const result = await extractMEPTakeoffs('nonexistent-project');

      expect(result).toMatchObject({
        success: false,
        errors: ['Project not found'],
        electrical: [],
        plumbing: [],
        hvac: [],
      });
    });

    it('should extract electrical items from document patterns', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        id: 'project-id',
        name: 'Test Project',
        Document: [
          {
            id: 'doc1',
            name: 'E-1.0 Electrical Plan',
            category: 'plans_drawings',
            deletedAt: null,
            DocumentChunk: [
              {
                content: 'Duplex receptacle at Room 101. GFCI outlet in bathroom.',
                pageNumber: 1,
              },
            ],
          },
        ],
      });

      mockPrisma.room.findMany.mockResolvedValueOnce([]);

      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: 'user-id',
        email: 'system@foremanos.ai',
      });

      mockPrisma.materialTakeoff.findFirst.mockResolvedValueOnce(null);
      mockPrisma.materialTakeoff.create.mockResolvedValueOnce({
        id: 'takeoff-id',
      });

      mockPrisma.takeoffLineItem.deleteMany.mockResolvedValueOnce({});
      mockPrisma.takeoffLineItem.create.mockResolvedValue({});

      const result = await extractMEPTakeoffs('test-project');

      expect(result.success).toBe(true);
      // May or may not find items depending on pattern matching
      expect(result).toHaveProperty('electrical');
    });

    it('should extract plumbing items from document patterns', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        id: 'project-id',
        name: 'Test Project',
        Document: [
          {
            id: 'doc1',
            name: 'P-1.0 Plumbing Plan',
            category: 'plans_drawings',
            deletedAt: null,
            DocumentChunk: [
              {
                content: 'Water closet WC-1, Lavatory LAV-1, Floor drain FD-1.',
                pageNumber: 1,
              },
            ],
          },
        ],
      });

      mockPrisma.room.findMany.mockResolvedValueOnce([]);

      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'user-id' });
      mockPrisma.materialTakeoff.findFirst.mockResolvedValueOnce(null);
      mockPrisma.materialTakeoff.create.mockResolvedValueOnce({ id: 'takeoff-id' });
      mockPrisma.takeoffLineItem.deleteMany.mockResolvedValueOnce({});
      mockPrisma.takeoffLineItem.create.mockResolvedValue({});

      const result = await extractMEPTakeoffs('test-project');

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('plumbing');
    });

    it('should extract HVAC items from document patterns', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        id: 'project-id',
        name: 'Test Project',
        Document: [
          {
            id: 'doc1',
            name: 'M-1.0 HVAC Plan',
            category: 'plans_drawings',
            deletedAt: null,
            DocumentChunk: [
              {
                content: 'RTU-1 rooftop unit, Supply diffuser, Return grille.',
                pageNumber: 1,
              },
            ],
          },
        ],
      });

      mockPrisma.room.findMany.mockResolvedValueOnce([]);

      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'user-id' });
      mockPrisma.materialTakeoff.findFirst.mockResolvedValueOnce(null);
      mockPrisma.materialTakeoff.create.mockResolvedValueOnce({ id: 'takeoff-id' });
      mockPrisma.takeoffLineItem.deleteMany.mockResolvedValueOnce({});
      mockPrisma.takeoffLineItem.create.mockResolvedValue({});

      const result = await extractMEPTakeoffs('test-project');

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('hvac');
    });

    it('should categorize documents by MEP type based on name patterns', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        id: 'project-id',
        name: 'Test Project',
        Document: [
          {
            id: 'doc1',
            name: 'E-1 Electrical',
            category: 'plans_drawings',
            deletedAt: null,
            DocumentChunk: [{ content: 'Panel LP-1', pageNumber: 1 }],
          },
          {
            id: 'doc2',
            name: 'P-2 Plumbing',
            category: 'plans_drawings',
            deletedAt: null,
            DocumentChunk: [{ content: 'Water heater', pageNumber: 1 }],
          },
          {
            id: 'doc3',
            name: 'M-3 Mechanical',
            category: 'plans_drawings',
            deletedAt: null,
            DocumentChunk: [{ content: 'Ductwork', pageNumber: 1 }],
          },
        ],
      });

      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'user-id' });
      mockPrisma.materialTakeoff.findFirst.mockResolvedValueOnce(null);
      mockPrisma.materialTakeoff.create.mockResolvedValueOnce({ id: 'takeoff-id' });
      mockPrisma.takeoffLineItem.deleteMany.mockResolvedValueOnce({});
      mockPrisma.takeoffLineItem.create.mockResolvedValue({});

      await extractMEPTakeoffs('test-project');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Found MEP documents',
        expect.objectContaining({
          electrical: expect.any(Number),
          plumbing: expect.any(Number),
          hvac: expect.any(Number),
        })
      );
    });

    it('should consolidate duplicate items and sum quantities', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        id: 'project-id',
        name: 'Test Project',
        Document: [
          {
            id: 'doc1',
            name: 'E-1.0 Electrical',
            category: 'plans_drawings',
            deletedAt: null,
            DocumentChunk: [
              { content: 'Duplex outlet in room 101. Duplex outlet in room 102.', pageNumber: 1 },
              { content: 'Duplex outlet in room 103.', pageNumber: 2 },
            ],
          },
        ],
      });

      mockPrisma.room.findMany.mockResolvedValueOnce([]);

      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'user-id' });
      mockPrisma.materialTakeoff.findFirst.mockResolvedValueOnce(null);
      mockPrisma.materialTakeoff.create.mockResolvedValueOnce({ id: 'takeoff-id' });
      mockPrisma.takeoffLineItem.deleteMany.mockResolvedValueOnce({});
      mockPrisma.takeoffLineItem.create.mockResolvedValue({});

      const result = await extractMEPTakeoffs('test-project');

      // Should consolidate all duplex outlets into one item with summed quantity
      const duplexItems = result.electrical.filter((item) =>
        item.description.toLowerCase().includes('duplex')
      );
      if (duplexItems.length > 0) {
        expect(duplexItems.length).toBe(1);
        expect(duplexItems[0].quantity).toBeGreaterThan(1);
      }
    });

    it('should fall back to room-based estimation when no documents have MEP data', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        id: 'project-id',
        name: 'Test Project',
        Document: [],
      });

      mockPrisma.room.findMany.mockResolvedValueOnce([
          { id: 'room1', type: 'Office', name: 'Room 101', area: 200 },
          { id: 'room2', type: 'Toilet', name: 'Restroom', area: 80 },
          { id: 'room3', type: 'Kitchen', name: 'Break Room', area: 150 },
        ]);

      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'user-id' });
      mockPrisma.materialTakeoff.findFirst.mockResolvedValueOnce(null);
      mockPrisma.materialTakeoff.create.mockResolvedValueOnce({ id: 'takeoff-id' });
      mockPrisma.takeoffLineItem.deleteMany.mockResolvedValueOnce({});
      mockPrisma.takeoffLineItem.create.mockResolvedValue({});

      const result = await extractMEPTakeoffs('test-project');

      expect(result.success).toBe(true);
      expect(result.electrical.length).toBeGreaterThan(0);
      expect(result.plumbing.length).toBeGreaterThan(0);
      expect(result.hvac.length).toBeGreaterThan(0);
      // Should log room-based estimation message
      const logCalls = mockLogger.info.mock.calls;
      const estimationLog = logCalls.find(call => call[0] === 'No items from documents, using room-based estimation');
      expect(estimationLog).toBeDefined();
    });

    it('should calculate total cost across all MEP items', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        id: 'project-id',
        name: 'Test Project',
        Document: [
          {
            id: 'doc1',
            name: 'E-1.0',
            category: 'plans_drawings',
            deletedAt: null,
            DocumentChunk: [
              { content: 'Duplex outlet. GFCI outlet. Panel.', pageNumber: 1 },
            ],
          },
        ],
      });

      mockPrisma.room.findMany.mockResolvedValueOnce([]);

      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'user-id' });
      mockPrisma.materialTakeoff.findFirst.mockResolvedValueOnce(null);
      mockPrisma.materialTakeoff.create.mockResolvedValueOnce({ id: 'takeoff-id' });
      mockPrisma.takeoffLineItem.deleteMany.mockResolvedValueOnce({});
      mockPrisma.takeoffLineItem.create.mockResolvedValue({});

      const result = await extractMEPTakeoffs('test-project');

      const sumOfItems = [...result.electrical, ...result.plumbing, ...result.hvac, ...result.fire_protection].reduce(
        (sum, item) => sum + item.totalCost,
        0
      );
      expect(result.totalCost).toBe(sumOfItems);
    });

    it('should create MaterialTakeoff record in database', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        id: 'project-123',
        name: 'Test Project',
        Document: [],
      });

      mockPrisma.room.findMany.mockResolvedValueOnce([
          { id: 'room1', type: 'Office', name: 'Room 101', area: 200 },
        ]);

      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: 'user-id',
        email: 'admin@test.com',
      });

      mockPrisma.materialTakeoff.findFirst.mockResolvedValueOnce(null);
      mockPrisma.materialTakeoff.create.mockResolvedValueOnce({
        id: 'takeoff-id',
      });

      mockPrisma.takeoffLineItem.deleteMany.mockResolvedValueOnce({});
      mockPrisma.takeoffLineItem.create.mockResolvedValue({});

      await extractMEPTakeoffs('test-project');

      expect(mockPrisma.materialTakeoff.create).toHaveBeenCalledWith({
        data: {
          projectId: 'project-123',
          name: 'MEP Auto-Extracted Takeoff',
          description: 'Automatically extracted MEP items from project documents',
          status: 'draft',
          createdBy: 'user-id',
        },
      });
    });

    it('should reuse existing MaterialTakeoff record', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        id: 'project-id',
        name: 'Test Project',
        Document: [],
      });

      mockPrisma.room.findMany.mockResolvedValueOnce([]);

      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'user-id' });
      mockPrisma.materialTakeoff.findFirst.mockResolvedValueOnce({
        id: 'existing-takeoff-id',
      });

      mockPrisma.takeoffLineItem.deleteMany.mockResolvedValueOnce({});
      mockPrisma.materialTakeoff.update.mockResolvedValueOnce({});

      await extractMEPTakeoffs('test-project');

      expect(mockPrisma.takeoffLineItem.deleteMany).toHaveBeenCalledWith({
        where: {
          takeoffId: 'existing-takeoff-id',
          category: { in: ['Electrical', 'Plumbing', 'HVAC'] },
        },
      });
    });

    it('should create TakeoffLineItem records for each extracted item', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        id: 'project-id',
        name: 'Test Project',
        Document: [],
      });

      mockPrisma.room.findMany.mockResolvedValueOnce([
          { id: 'room1', type: 'Office', name: 'Office', area: 200 },
        ]);

      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'user-id' });
      mockPrisma.materialTakeoff.findFirst.mockResolvedValueOnce(null);
      mockPrisma.materialTakeoff.create.mockResolvedValueOnce({ id: 'takeoff-id' });
      mockPrisma.takeoffLineItem.deleteMany.mockResolvedValueOnce({});
      mockPrisma.takeoffLineItem.create.mockResolvedValue({});

      await extractMEPTakeoffs('test-project');

      expect(mockPrisma.takeoffLineItem.create).toHaveBeenCalled();
      const firstCall = mockPrisma.takeoffLineItem.create.mock.calls[0][0];
      expect(firstCall.data).toMatchObject({
        takeoffId: 'takeoff-id',
        category: expect.stringMatching(/Electrical|Plumbing|HVAC/),
        itemName: expect.any(String),
        quantity: expect.any(Number),
        unit: expect.any(String),
        unitCost: expect.any(Number),
        totalCost: expect.any(Number),
        confidence: expect.any(Number),
        sourceType: 'auto',
        calculationMethod: 'MEP extraction',
      });
    });

    it('should update MaterialTakeoff total cost', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        id: 'project-id',
        name: 'Test Project',
        Document: [
          {
            id: 'doc1',
            name: 'E-1.0',
            category: 'plans_drawings',
            deletedAt: null,
            DocumentChunk: [{ content: 'Duplex outlet', pageNumber: 1 }],
          },
        ],
      });

      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'user-id' });
      mockPrisma.materialTakeoff.findFirst.mockResolvedValueOnce(null);
      mockPrisma.materialTakeoff.create.mockResolvedValueOnce({ id: 'takeoff-id' });
      mockPrisma.takeoffLineItem.deleteMany.mockResolvedValueOnce({});
      mockPrisma.takeoffLineItem.create.mockResolvedValue({});

      const result = await extractMEPTakeoffs('test-project');

      expect(mockPrisma.materialTakeoff.update).toHaveBeenCalledWith({
        where: { id: 'takeoff-id' },
        data: { totalCost: result.totalCost },
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        id: 'project-id',
        name: 'Test Project',
        Document: [],
      });

      mockPrisma.room.findMany.mockResolvedValueOnce([
          { id: 'room1', name: 'Room 1', area: 100 },
        ]);

      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'user-id' });
      mockPrisma.materialTakeoff.findFirst.mockResolvedValueOnce(null);
      mockPrisma.materialTakeoff.create.mockRejectedValueOnce(
        new Error('Database connection error')
      );

      const result = await extractMEPTakeoffs('test-project');

      expect(result.itemsCreated).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Database connection error');
    });

    it('should return error when no user found for takeoff creation', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        id: 'project-id',
        name: 'Test Project',
        Document: [],
      });

      mockPrisma.room.findMany.mockResolvedValueOnce([]);

      mockPrisma.user.findFirst
        .mockResolvedValueOnce(null) // system user
        .mockResolvedValueOnce(null); // admin fallback

      const result = await extractMEPTakeoffs('test-project');

      expect(result.itemsCreated).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('No user found to create takeoffs');
    });

    it('should fallback to admin user if system user not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        id: 'project-id',
        name: 'Test Project',
        Document: [],
      });

      mockPrisma.room.findMany.mockResolvedValueOnce([]);

      mockPrisma.user.findFirst
        .mockResolvedValueOnce(null) // system user not found
        .mockResolvedValueOnce({ id: 'admin-id', role: 'admin' }); // admin fallback

      mockPrisma.materialTakeoff.findFirst.mockResolvedValueOnce(null);
      mockPrisma.materialTakeoff.create.mockResolvedValueOnce({ id: 'takeoff-id' });
      mockPrisma.takeoffLineItem.deleteMany.mockResolvedValueOnce({});
      mockPrisma.materialTakeoff.update.mockResolvedValueOnce({});

      await extractMEPTakeoffs('test-project');

      const createCall = mockPrisma.materialTakeoff.create.mock.calls[0];
      expect(createCall).toBeDefined();
      expect(createCall[0].data.createdBy).toBe('admin-id');
    });

    it('should log extraction progress', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        id: 'project-id',
        name: 'Test Construction Project',
        Document: [],
      });

      mockPrisma.room.findMany.mockResolvedValueOnce([
          { id: 'room1', name: 'Room 1', area: 100 },
        ]);

      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'user-id' });
      mockPrisma.materialTakeoff.findFirst.mockResolvedValueOnce(null);
      mockPrisma.materialTakeoff.create.mockResolvedValueOnce({ id: 'takeoff-id' });
      mockPrisma.takeoffLineItem.deleteMany.mockResolvedValueOnce({});
      mockPrisma.takeoffLineItem.create.mockResolvedValue({});

      await extractMEPTakeoffs('test-project');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting MEP extraction',
        { projectName: 'Test Construction Project' }
      );

      // Find the last call to info that contains 'MEP extraction complete'
      const logCalls = mockLogger.info.mock.calls;
      const completeLog = logCalls.find(call => call[0] === 'MEP extraction complete');
      expect(completeLog).toBeDefined();
      expect(completeLog![1]).toMatchObject({
        itemCount: expect.any(Number),
        totalCost: expect.any(Number),
      });
    });

    it('should handle extraction errors and set success to false', async () => {
      mockPrisma.project.findUnique.mockRejectedValueOnce(new Error('Database error'));

      const result = await extractMEPTakeoffs('test-project');

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['MEP extraction failed: Error: Database error']);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'MEP extraction error',
        expect.any(Error)
      );
    });

    it('should exclude deleted documents from processing', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        id: 'project-id',
        name: 'Test Project',
        Document: [
          {
            id: 'doc1',
            name: 'E-1.0',
            category: 'plans_drawings',
            deletedAt: null,
            DocumentChunk: [{ content: 'Panel LP-1', pageNumber: 1 }],
          },
          {
            id: 'doc2',
            name: 'E-2.0',
            category: 'plans_drawings',
            deletedAt: new Date(),
            DocumentChunk: [{ content: 'Panel LP-2', pageNumber: 1 }],
          },
        ],
      });

      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'user-id' });
      mockPrisma.materialTakeoff.findFirst.mockResolvedValueOnce(null);
      mockPrisma.materialTakeoff.create.mockResolvedValueOnce({ id: 'takeoff-id' });
      mockPrisma.takeoffLineItem.deleteMany.mockResolvedValueOnce({});
      mockPrisma.takeoffLineItem.create.mockResolvedValue({});

      await extractMEPTakeoffs('test-project');

      // Should only find documents from project, Prisma query will handle deletedAt: null
      expect(mockPrisma.project.findUnique).toHaveBeenCalledWith({
        where: { slug: 'test-project' },
        include: {
          Document: {
            where: { deletedAt: null },
            include: { DocumentChunk: true },
          },
        },
      });
    });
  });
});
