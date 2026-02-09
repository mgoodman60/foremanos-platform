/**
 * Tests for Hardware Set Extractor
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtractedHardwareSet, HardwareComponent } from '@/lib/hardware-set-extractor';

// Mocks
const mockPrisma = vi.hoisted(() => ({
  doorScheduleItem: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  windowScheduleItem: {
    count: vi.fn(),
  },
  hardwareSetDefinition: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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
}));

const mockCallAbacusLLM = vi.hoisted(() => vi.fn());

vi.mock('@/lib/abacus-llm', () => ({
  callAbacusLLM: mockCallAbacusLLM,
}));

// Import after mocks
import {
  extractHardwareSetsFromDoorSchedule,
  extractHardwareSetsFromSpec,
  syncHardwareSets,
  extractAndSyncAllHardwareSets,
  getProjectHardwareSets,
  calculateHardwareRequirements,
} from '@/lib/hardware-set-extractor';

describe('Hardware Set Extractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractHardwareSetsFromDoorSchedule', () => {
    it('should extract hardware sets from door schedule data', async () => {
      mockPrisma.doorScheduleItem.findMany.mockResolvedValueOnce([
        {
          id: 'door1',
          doorNumber: 'D-101',
          hardwareSet: 'HS-1',
          hinges: '3 - 4.5x4.5 Ball Bearing',
          lockset: 'Mortise Lock, Classroom Function',
          closer: 'LCN 4040XP',
          fireRating: '20 MIN',
          kickplate: true,
          weatherstrip: false,
          threshold: 'Aluminum',
        },
        {
          id: 'door2',
          doorNumber: 'D-102',
          hardwareSet: 'HS-1',
          hinges: '3 - 4.5x4.5 Ball Bearing',
          lockset: 'Mortise Lock, Classroom Function',
          closer: 'LCN 4040XP',
          fireRating: '20 MIN',
          kickplate: true,
          weatherstrip: false,
          threshold: 'Aluminum',
        },
      ]);

      const result = await extractHardwareSetsFromDoorSchedule('project-id');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        setNumber: 'HS-1',
        setName: 'Hardware Set HS-1',
        sourceType: 'door_schedule',
        fireRated: true,
        fireRating: '20 MIN',
      });

      expect(result[0].components).toHaveLength(5);
      expect(result[0].components).toContainEqual({
        type: 'HINGES',
        spec: '4.5x4.5 Ball Bearing',
        qtyPerDoor: 3,
      });
    });

    it('should parse hinge quantities correctly', async () => {
      mockPrisma.doorScheduleItem.findMany.mockResolvedValueOnce([
        {
          id: 'door1',
          doorNumber: 'D-201',
          hardwareSet: 'HS-2',
          hinges: '4 - Heavy Weight',
          lockset: null,
          closer: null,
          fireRating: null,
          kickplate: false,
          weatherstrip: false,
          threshold: null,
        },
      ]);

      const result = await extractHardwareSetsFromDoorSchedule('project-id');

      expect(result[0].components).toContainEqual({
        type: 'HINGES',
        spec: 'Heavy Weight',
        qtyPerDoor: 4,
      });
    });

    it('should default to 3 hinges when quantity not specified', async () => {
      mockPrisma.doorScheduleItem.findMany.mockResolvedValueOnce([
        {
          id: 'door1',
          doorNumber: 'D-301',
          hardwareSet: 'HS-3',
          hinges: 'Standard Hinges',
          lockset: null,
          closer: null,
          fireRating: null,
          kickplate: false,
          weatherstrip: false,
          threshold: null,
        },
      ]);

      const result = await extractHardwareSetsFromDoorSchedule('project-id');

      expect(result[0].components).toContainEqual({
        type: 'HINGES',
        spec: 'Standard Hinges',
        qtyPerDoor: 3,
      });
    });

    it('should extract lockset components', async () => {
      mockPrisma.doorScheduleItem.findMany.mockResolvedValueOnce([
        {
          id: 'door1',
          doorNumber: 'D-401',
          hardwareSet: 'HS-4',
          hinges: null,
          lockset: 'Schlage L9453P Lever Lock',
          closer: null,
          fireRating: null,
          kickplate: false,
          weatherstrip: false,
          threshold: null,
        },
      ]);

      const result = await extractHardwareSetsFromDoorSchedule('project-id');

      expect(result[0].components).toContainEqual({
        type: 'LOCKSET',
        spec: 'Schlage L9453P Lever Lock',
        qtyPerDoor: 1,
      });
    });

    it('should extract closer components', async () => {
      mockPrisma.doorScheduleItem.findMany.mockResolvedValueOnce([
        {
          id: 'door1',
          doorNumber: 'D-501',
          hardwareSet: 'HS-5',
          hinges: null,
          lockset: null,
          closer: 'Surface Mounted Closer',
          fireRating: null,
          kickplate: false,
          weatherstrip: false,
          threshold: null,
        },
      ]);

      const result = await extractHardwareSetsFromDoorSchedule('project-id');

      expect(result[0].components).toContainEqual({
        type: 'CLOSER',
        spec: 'Surface Mounted Closer',
        qtyPerDoor: 1,
      });
    });

    it('should extract kickplate, weatherstrip, and threshold components', async () => {
      mockPrisma.doorScheduleItem.findMany.mockResolvedValueOnce([
        {
          id: 'door1',
          doorNumber: 'D-601',
          hardwareSet: 'HS-6',
          hinges: null,
          lockset: null,
          closer: null,
          fireRating: null,
          kickplate: true,
          weatherstrip: true,
          threshold: 'Saddle Threshold',
        },
      ]);

      const result = await extractHardwareSetsFromDoorSchedule('project-id');

      expect(result[0].components).toHaveLength(3);
      expect(result[0].components).toContainEqual({
        type: 'KICK_PLATE',
        spec: 'Kick Plate',
        qtyPerDoor: 1,
      });
      expect(result[0].components).toContainEqual({
        type: 'WEATHERSTRIP',
        spec: 'Weatherstripping Set',
        qtyPerDoor: 1,
      });
      expect(result[0].components).toContainEqual({
        type: 'THRESHOLD',
        spec: 'Saddle Threshold',
        qtyPerDoor: 1,
      });
    });

    it('should detect ADA compliance from lockset type', async () => {
      mockPrisma.doorScheduleItem.findMany.mockResolvedValueOnce([
        {
          id: 'door1',
          doorNumber: 'D-701',
          hardwareSet: 'HS-7',
          hinges: null,
          lockset: 'Lever Handle ADA Compliant',
          closer: null,
          fireRating: null,
          kickplate: false,
          weatherstrip: false,
          threshold: null,
        },
      ]);

      const result = await extractHardwareSetsFromDoorSchedule('project-id');

      expect(result[0].adaCompliant).toBe(true);
    });

    it('should detect fire rating from doors in set', async () => {
      mockPrisma.doorScheduleItem.findMany.mockResolvedValueOnce([
        {
          id: 'door1',
          doorNumber: 'D-801',
          hardwareSet: 'HS-8',
          hinges: '3 - Standard',
          lockset: null,
          closer: null,
          fireRating: '90 MIN',
          kickplate: false,
          weatherstrip: false,
          threshold: null,
        },
        {
          id: 'door2',
          doorNumber: 'D-802',
          hardwareSet: 'HS-8',
          hinges: '3 - Standard',
          lockset: null,
          closer: null,
          fireRating: null,
          kickplate: false,
          weatherstrip: false,
          threshold: null,
        },
      ]);

      const result = await extractHardwareSetsFromDoorSchedule('project-id');

      expect(result[0]).toMatchObject({
        fireRated: true,
        fireRating: '90 MIN',
      });
    });

    it('should return empty array when no doors exist', async () => {
      mockPrisma.doorScheduleItem.findMany.mockResolvedValueOnce([]);

      const result = await extractHardwareSetsFromDoorSchedule('project-id');

      expect(result).toEqual([]);
    });

    it('should skip doors without hardware set', async () => {
      mockPrisma.doorScheduleItem.findMany.mockResolvedValueOnce([
        {
          id: 'door1',
          doorNumber: 'D-901',
          hardwareSet: null,
          hinges: '3 - Standard',
          lockset: null,
          closer: null,
          fireRating: null,
          kickplate: false,
          weatherstrip: false,
          threshold: null,
        },
      ]);

      const result = await extractHardwareSetsFromDoorSchedule('project-id');

      expect(result).toEqual([]);
    });

    it('should group multiple doors by hardware set', async () => {
      mockPrisma.doorScheduleItem.findMany.mockResolvedValueOnce([
        {
          id: 'door1',
          doorNumber: 'D-101',
          hardwareSet: 'HS-A',
          hinges: '3 - Standard',
          lockset: 'Mortise Lock',
          closer: null,
          fireRating: null,
          kickplate: false,
          weatherstrip: false,
          threshold: null,
        },
        {
          id: 'door2',
          doorNumber: 'D-102',
          hardwareSet: 'HS-B',
          hinges: '4 - Heavy',
          lockset: 'Cylindrical Lock',
          closer: 'Closer',
          fireRating: null,
          kickplate: false,
          weatherstrip: false,
          threshold: null,
        },
        {
          id: 'door3',
          doorNumber: 'D-103',
          hardwareSet: 'HS-A',
          hinges: '3 - Standard',
          lockset: 'Mortise Lock',
          closer: null,
          fireRating: null,
          kickplate: false,
          weatherstrip: false,
          threshold: null,
        },
      ]);

      const result = await extractHardwareSetsFromDoorSchedule('project-id');

      expect(result).toHaveLength(2);
      expect(result.find((s) => s.setNumber === 'HS-A')).toBeDefined();
      expect(result.find((s) => s.setNumber === 'HS-B')).toBeDefined();
    });
  });

  describe('extractHardwareSetsFromSpec', () => {
    it('should extract hardware sets from specification text using LLM', async () => {
      const specText = `Hardware Set 1: Entry Hardware
      - Hinges: 3 - Hager BB1279, 4.5x4.5, US26D
      - Lockset: Schlage L9453P, Mortise, Classroom
      - Closer: LCN 4040XP, Surface Mounted`;

      mockCallAbacusLLM.mockResolvedValueOnce({
        content: JSON.stringify([
          {
            setNumber: '1',
            setName: 'Entry Hardware',
            description: 'Complete entrance door hardware',
            components: [
              {
                type: 'HINGES',
                spec: '4.5x4.5 Ball Bearing',
                qtyPerDoor: 3,
                manufacturer: 'Hager',
                model: 'BB1279',
                finish: 'US26D',
              },
              {
                type: 'LOCKSET',
                spec: 'Mortise Lock, Classroom Function',
                qtyPerDoor: 1,
                manufacturer: 'Schlage',
                model: 'L9453P',
              },
            ],
            fireRated: false,
            fireRating: null,
            adaCompliant: true,
          },
        ]),
      });

      const result = await extractHardwareSetsFromSpec(specText);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        setNumber: '1',
        setName: 'Entry Hardware',
        sourceType: 'spec_section',
      });
      expect(result[0].components).toHaveLength(2);
    });

    it('should handle invalid JSON response gracefully', async () => {
      mockCallAbacusLLM.mockResolvedValueOnce({
        content: 'Invalid response without JSON',
      });

      const result = await extractHardwareSetsFromSpec('Some spec text');

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'HARDWARE_SET_EXTRACTOR',
        'No valid JSON found in response'
      );
    });

    it('should handle LLM errors gracefully', async () => {
      mockCallAbacusLLM.mockRejectedValueOnce(new Error('API timeout'));

      const result = await extractHardwareSetsFromSpec('Spec text');

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'HARDWARE_SET_EXTRACTOR',
        'Spec extraction failed',
        expect.any(Error)
      );
    });

    it('should limit spec text to 12000 characters', async () => {
      const longSpec = 'x'.repeat(20000);

      mockCallAbacusLLM.mockResolvedValueOnce({ content: '[]' });

      await extractHardwareSetsFromSpec(longSpec);

      const callArgs = mockCallAbacusLLM.mock.calls[0][0];
      const promptContent = callArgs[0].content;
      expect(promptContent).toContain('x'.repeat(12000));
      expect(promptContent).not.toContain('x'.repeat(15000));
    });
  });

  describe('syncHardwareSets', () => {
    it('should create new hardware set records', async () => {
      const extractedSets: ExtractedHardwareSet[] = [
        {
          setNumber: 'HS-1',
          setName: 'Entry Set',
          description: 'Complete entry hardware',
          components: [
            { type: 'HINGES', spec: '4.5x4.5', qtyPerDoor: 3 },
            { type: 'LOCKSET', spec: 'Mortise Lock', qtyPerDoor: 1 },
          ],
          fireRated: true,
          fireRating: '20 MIN',
          adaCompliant: true,
          sourceType: 'door_schedule',
        },
      ];

      mockPrisma.doorScheduleItem.count.mockResolvedValueOnce(5);
      mockPrisma.windowScheduleItem.count.mockResolvedValueOnce(0);
      mockPrisma.hardwareSetDefinition.findUnique.mockResolvedValueOnce(null);
      mockPrisma.hardwareSetDefinition.create.mockResolvedValueOnce({});

      const result = await syncHardwareSets('project-id', extractedSets);

      expect(result).toEqual({ created: 1, updated: 0 });
      expect(mockPrisma.hardwareSetDefinition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'project-id',
          setNumber: 'HS-1',
          setName: 'Entry Set',
          doorCount: 5,
          windowCount: 0,
        }),
      });
    });

    it('should update existing hardware set records', async () => {
      const extractedSets: ExtractedHardwareSet[] = [
        {
          setNumber: 'HS-1',
          setName: 'Updated Name',
          description: 'Updated description',
          components: [
            { type: 'HINGES', spec: 'New Spec', qtyPerDoor: 3 },
          ],
          fireRated: false,
          adaCompliant: false,
          sourceType: 'spec_section',
        },
      ];

      mockPrisma.doorScheduleItem.count.mockResolvedValueOnce(3);
      mockPrisma.windowScheduleItem.count.mockResolvedValueOnce(2);
      mockPrisma.hardwareSetDefinition.findUnique.mockResolvedValueOnce({
        id: 'set-id',
        setName: 'Old Name',
        description: 'Old description',
        sourceDocumentId: 'old-doc',
      });
      mockPrisma.hardwareSetDefinition.update.mockResolvedValueOnce({});

      const result = await syncHardwareSets('project-id', extractedSets, 'new-doc');

      expect(result).toEqual({ created: 0, updated: 1 });
      expect(mockPrisma.hardwareSetDefinition.update).toHaveBeenCalledWith({
        where: { id: 'set-id' },
        data: expect.objectContaining({
          setName: 'Updated Name',
          doorCount: 3,
          windowCount: 2,
          sourceDocumentId: 'new-doc',
        }),
      });
    });

    it('should preserve existing values when extractedSet has null fields', async () => {
      const extractedSets: ExtractedHardwareSet[] = [
        {
          setNumber: 'HS-1',
          setName: undefined,
          description: undefined,
          components: [],
          fireRated: false,
          adaCompliant: false,
          sourceType: 'door_schedule',
        },
      ];

      mockPrisma.doorScheduleItem.count.mockResolvedValueOnce(1);
      mockPrisma.windowScheduleItem.count.mockResolvedValueOnce(0);
      mockPrisma.hardwareSetDefinition.findUnique.mockResolvedValueOnce({
        id: 'set-id',
        setName: 'Existing Name',
        description: 'Existing Description',
        sourceDocumentId: 'existing-doc',
      });
      mockPrisma.hardwareSetDefinition.update.mockResolvedValueOnce({});

      await syncHardwareSets('project-id', extractedSets);

      const updateCall = mockPrisma.hardwareSetDefinition.update.mock.calls[0][0];
      expect(updateCall.data.setName).toBe('Existing Name');
      expect(updateCall.data.description).toBe('Existing Description');
      expect(updateCall.data.sourceDocumentId).toBe('existing-doc');
    });
  });

  describe('extractAndSyncAllHardwareSets', () => {
    it('should extract and sync door schedule hardware sets', async () => {
      mockPrisma.doorScheduleItem.findMany.mockResolvedValueOnce([
        {
          id: 'door1',
          doorNumber: 'D-101',
          hardwareSet: 'HS-1',
          hinges: '3 - Standard',
          lockset: 'Mortise',
          closer: null,
          fireRating: null,
          kickplate: false,
          weatherstrip: false,
          threshold: null,
        },
      ]);

      mockPrisma.doorScheduleItem.count.mockResolvedValueOnce(1);
      mockPrisma.windowScheduleItem.count.mockResolvedValueOnce(0);
      mockPrisma.hardwareSetDefinition.findUnique.mockResolvedValueOnce(null);
      mockPrisma.hardwareSetDefinition.create.mockResolvedValueOnce({});

      const result = await extractAndSyncAllHardwareSets('project-id');

      expect(result).toEqual({
        doorScheduleSets: 1,
        specSets: 0,
      });
    });

    it('should return zero counts when no doors exist', async () => {
      mockPrisma.doorScheduleItem.findMany.mockResolvedValueOnce([]);

      const result = await extractAndSyncAllHardwareSets('project-id');

      expect(result).toEqual({
        doorScheduleSets: 0,
        specSets: 0,
      });
    });
  });

  describe('getProjectHardwareSets', () => {
    it('should retrieve hardware sets with door counts and sample doors', async () => {
      mockPrisma.hardwareSetDefinition.findMany.mockResolvedValueOnce([
        {
          id: 'set1',
          projectId: 'project-id',
          setNumber: 'HS-1',
          setName: 'Entry Set',
          components: [
            { type: 'HINGES', spec: '4.5x4.5', qtyPerDoor: 3 },
          ],
        },
      ]);

      mockPrisma.doorScheduleItem.count.mockResolvedValueOnce(5);
      mockPrisma.doorScheduleItem.findMany.mockResolvedValueOnce([
        { doorNumber: 'D-101', roomNumber: '101', fireRating: '20 MIN' },
        { doorNumber: 'D-102', roomNumber: '102', fireRating: null },
      ]);

      const result = await getProjectHardwareSets('project-id');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        setNumber: 'HS-1',
        doorCount: 5,
        sampleDoors: ['D-101', 'D-102'],
      });
    });

    it('should return empty array when no hardware sets exist', async () => {
      mockPrisma.hardwareSetDefinition.findMany.mockResolvedValueOnce([]);

      const result = await getProjectHardwareSets('project-id');

      expect(result).toEqual([]);
    });
  });

  describe('calculateHardwareRequirements', () => {
    it('should calculate total component requirements across all sets', async () => {
      mockPrisma.hardwareSetDefinition.findMany.mockResolvedValueOnce([
        {
          id: 'set1',
          setNumber: 'HS-1',
          components: [
            { type: 'HINGES', spec: '4.5x4.5', qtyPerDoor: 3, manufacturer: 'Hager' },
            { type: 'LOCKSET', spec: 'Mortise Lock', qtyPerDoor: 1 },
          ],
        },
        {
          id: 'set2',
          setNumber: 'HS-2',
          components: [
            { type: 'HINGES', spec: '4.5x4.5', qtyPerDoor: 3, manufacturer: 'Hager' },
            { type: 'CLOSER', spec: 'Surface Closer', qtyPerDoor: 1 },
          ],
        },
      ]);

      mockPrisma.doorScheduleItem.count
        .mockResolvedValueOnce(5) // HS-1
        .mockResolvedValueOnce(3); // HS-2

      mockPrisma.doorScheduleItem.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await calculateHardwareRequirements('project-id');

      expect(result.totalDoors).toBe(8);
      expect(result.componentTotals).toHaveLength(3);

      // Hinges: (5 * 3) + (3 * 3) = 24
      const hinges = result.componentTotals.find((c) => c.type === 'HINGES');
      expect(hinges?.totalQty).toBe(24);
      expect(hinges?.sets).toEqual(['HS-1', 'HS-2']);

      // Lockset: 5 * 1 = 5
      const lockset = result.componentTotals.find((c) => c.type === 'LOCKSET');
      expect(lockset?.totalQty).toBe(5);

      // Closer: 3 * 1 = 3
      const closer = result.componentTotals.find((c) => c.type === 'CLOSER');
      expect(closer?.totalQty).toBe(3);
    });

    it('should handle empty hardware sets', async () => {
      mockPrisma.hardwareSetDefinition.findMany.mockResolvedValueOnce([]);

      const result = await calculateHardwareRequirements('project-id');

      expect(result).toEqual({
        sets: [],
        componentTotals: [],
        totalDoors: 0,
      });
    });

    it('should group components by type and spec combination', async () => {
      mockPrisma.hardwareSetDefinition.findMany.mockResolvedValueOnce([
        {
          id: 'set1',
          setNumber: 'HS-1',
          components: [
            { type: 'HINGES', spec: 'Heavy Duty', qtyPerDoor: 3 },
            { type: 'HINGES', spec: 'Standard', qtyPerDoor: 2 }, // Different spec
          ],
        },
      ]);

      mockPrisma.doorScheduleItem.count.mockResolvedValueOnce(10);
      mockPrisma.doorScheduleItem.findMany.mockResolvedValueOnce([]);

      const result = await calculateHardwareRequirements('project-id');

      expect(result.componentTotals).toHaveLength(2);
      expect(result.componentTotals.find((c) => c.spec === 'Heavy Duty')?.totalQty).toBe(30);
      expect(result.componentTotals.find((c) => c.spec === 'Standard')?.totalQty).toBe(20);
    });
  });
});
