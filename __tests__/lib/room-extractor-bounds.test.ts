import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractRoomsFromMetadata,
  saveExtractedRooms,
} from '@/lib/room-extractor';

// Mock dependencies
const mockPrisma = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
  },
  room: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  documentChunk: {
    findMany: vi.fn(),
  },
  finishScheduleItem: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mockSheetParser = vi.hoisted(() => ({
  parseSheetNumber: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createScopedLogger: vi.fn(() => mockLogger),
}));
vi.mock('@/lib/sheet-number-parser', () => mockSheetParser);

// Mock other dependencies
vi.mock('@/lib/csi-divisions', () => ({
  getCSIDivisionByNumber: vi.fn(),
}));
vi.mock('@/lib/abacus-llm', () => ({
  callAbacusLLM: vi.fn(),
}));
vi.mock('@/lib/construction-abbreviations', () => ({
  generateAbbreviationContext: vi.fn(() => ''),
}));
vi.mock('@/lib/model-config', () => ({
  EXTRACTION_MODEL: 'gpt-4o-mini',
}));

describe('room-extractor-bounds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractRoomsFromMetadata - hotspot extraction', () => {
    it('should extract hotspot coordinates from bounds in metadata', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          documentId: 'doc-1',
          sheetNumber: 'A-101',
          metadata: {
            rooms: [
              {
                number: '101',
                name: 'Office',
                area: '150 SF',
                bounds: {
                  x: 10.5,
                  y: 20.3,
                  w: 5.2,
                  h: 7.8,
                },
              },
            ],
          },
        },
      ]);
      mockSheetParser.parseSheetNumber.mockReturnValue({
        level: '1',
      });

      const rooms = await extractRoomsFromMetadata('test-project');

      expect(rooms).toHaveLength(1);
      expect(rooms[0].hotspotX).toBe(10.5);
      expect(rooms[0].hotspotY).toBe(20.3);
      expect(rooms[0].hotspotWidth).toBe(5.2);
      expect(rooms[0].hotspotHeight).toBe(7.8);
    });

    it('should handle rooms without bounds', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          documentId: 'doc-1',
          sheetNumber: 'A-101',
          metadata: {
            rooms: [
              {
                number: '101',
                name: 'Office',
                area: '150 SF',
                // No bounds field
              },
            ],
          },
        },
      ]);
      mockSheetParser.parseSheetNumber.mockReturnValue({
        level: '1',
      });

      const rooms = await extractRoomsFromMetadata('test-project');

      expect(rooms).toHaveLength(1);
      expect(rooms[0].hotspotX).toBeUndefined();
      expect(rooms[0].hotspotY).toBeUndefined();
      expect(rooms[0].hotspotWidth).toBeUndefined();
      expect(rooms[0].hotspotHeight).toBeUndefined();
    });

    it('should handle partial bounds (null values)', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          documentId: 'doc-1',
          sheetNumber: 'A-101',
          metadata: {
            rooms: [
              {
                number: '101',
                name: 'Office',
                bounds: {
                  x: null,
                  y: 20,
                  w: null,
                  h: 10,
                },
              },
            ],
          },
        },
      ]);
      mockSheetParser.parseSheetNumber.mockReturnValue({
        level: '1',
      });

      const rooms = await extractRoomsFromMetadata('test-project');

      expect(rooms).toHaveLength(1);
      expect(rooms[0].hotspotX).toBeUndefined();
      expect(rooms[0].hotspotY).toBe(20);
      expect(rooms[0].hotspotWidth).toBeUndefined();
      expect(rooms[0].hotspotHeight).toBe(10);
    });

    it('should infer floor from sheet number when room.floor is missing', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          documentId: 'doc-1',
          sheetNumber: 'A-201',
          metadata: {
            rooms: [
              {
                number: '201',
                name: 'Conference',
                // No floor field
              },
            ],
          },
        },
      ]);
      mockSheetParser.parseSheetNumber.mockReturnValue({
        level: '2',
      });

      const rooms = await extractRoomsFromMetadata('test-project');

      expect(rooms).toHaveLength(1);
      expect(rooms[0].floor).toBe('2nd Floor');
    });

    it('should prefer room.floor over sheet number inference', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          documentId: 'doc-1',
          sheetNumber: 'A-301',
          metadata: {
            rooms: [
              {
                number: '301',
                name: 'Office',
                floor: 'Penthouse',
              },
            ],
          },
        },
      ]);
      mockSheetParser.parseSheetNumber.mockReturnValue({
        level: '3',
      });

      const rooms = await extractRoomsFromMetadata('test-project');

      expect(rooms).toHaveLength(1);
      expect(rooms[0].floor).toBe('Penthouse');
    });

    it('should fallback to 1st Floor when sheet number parsing fails', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          documentId: 'doc-1',
          sheetNumber: null,
          metadata: {
            rooms: [
              {
                number: '101',
                name: 'Office',
              },
            ],
          },
        },
      ]);

      const rooms = await extractRoomsFromMetadata('test-project');

      expect(rooms).toHaveLength(1);
      expect(rooms[0].floor).toBe('1st Floor');
    });
  });

  describe('saveExtractedRooms - hotspot update behavior', () => {
    it('should save hotspot data for new room', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrisma.room.findFirst.mockResolvedValue(null); // No existing room
      mockPrisma.room.create.mockResolvedValue({
        id: 'room-1',
        roomNumber: '101',
      });

      const extractedRooms = [
        {
          roomNumber: '101',
          roomType: 'Office',
          floor: '1st Floor',
          hotspotX: 15,
          hotspotY: 25,
          hotspotWidth: 8,
          hotspotHeight: 10,
        },
      ];

      await saveExtractedRooms('test-project', extractedRooms);

      expect(mockPrisma.room.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hotspotX: 15,
            hotspotY: 25,
            hotspotWidth: 8,
            hotspotHeight: 10,
          }),
        })
      );
    });

    it('should NOT overwrite existing hotspot when updating room', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrisma.room.findFirst.mockResolvedValue({
        id: 'room-1',
        type: 'Office',
        hotspotX: 10,
        hotspotY: 20,
        hotspotWidth: 5,
        hotspotHeight: 7,
      });
      mockPrisma.room.update.mockResolvedValue({
        id: 'room-1',
      });

      const extractedRooms = [
        {
          roomNumber: '101',
          roomType: 'Conference',
          floor: '1st Floor',
          hotspotX: 30,
          hotspotY: 40,
          hotspotWidth: 12,
          hotspotHeight: 15,
        },
      ];

      await saveExtractedRooms('test-project', extractedRooms);

      // Update should NOT include hotspot fields because existing values are not null
      expect(mockPrisma.room.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'room-1' },
          data: expect.objectContaining({
            type: 'Conference',
          }),
        })
      );

      // Check that hotspot fields were NOT updated
      const updateCall = mockPrisma.room.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('hotspotX');
      expect(updateCall.data).not.toHaveProperty('hotspotY');
      expect(updateCall.data).not.toHaveProperty('hotspotWidth');
      expect(updateCall.data).not.toHaveProperty('hotspotHeight');
    });

    it('should fill hotspot when existing room has null hotspot', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrisma.room.findFirst.mockResolvedValue({
        id: 'room-1',
        type: 'Office',
        hotspotX: null,
        hotspotY: null,
        hotspotWidth: null,
        hotspotHeight: null,
      });
      mockPrisma.room.update.mockResolvedValue({
        id: 'room-1',
      });

      const extractedRooms = [
        {
          roomNumber: '101',
          roomType: 'Office',
          floor: '1st Floor',
          hotspotX: 15,
          hotspotY: 25,
          hotspotWidth: 8,
          hotspotHeight: 10,
        },
      ];

      await saveExtractedRooms('test-project', extractedRooms);

      expect(mockPrisma.room.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'room-1' },
          data: expect.objectContaining({
            hotspotX: 15,
            hotspotY: 25,
            hotspotWidth: 8,
            hotspotHeight: 10,
          }),
        })
      );
    });

    it('should partially fill hotspot fields (only null ones)', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrisma.room.findFirst.mockResolvedValue({
        id: 'room-1',
        type: 'Office',
        hotspotX: 10, // Already set
        hotspotY: null,
        hotspotWidth: null,
        hotspotHeight: 5, // Already set
      });
      mockPrisma.room.update.mockResolvedValue({
        id: 'room-1',
      });

      const extractedRooms = [
        {
          roomNumber: '101',
          roomType: 'Office',
          floor: '1st Floor',
          hotspotX: 99,
          hotspotY: 25,
          hotspotWidth: 8,
          hotspotHeight: 99,
        },
      ];

      await saveExtractedRooms('test-project', extractedRooms);

      const updateCall = mockPrisma.room.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('hotspotX'); // Don't overwrite existing 10
      expect(updateCall.data).toHaveProperty('hotspotY', 25); // Fill null
      expect(updateCall.data).toHaveProperty('hotspotWidth', 8); // Fill null
      expect(updateCall.data).not.toHaveProperty('hotspotHeight'); // Don't overwrite existing 5
    });

    it('should handle room with no extracted hotspot data', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrisma.room.findFirst.mockResolvedValue({
        id: 'room-1',
        type: 'Office',
        hotspotX: null,
        hotspotY: null,
        hotspotWidth: null,
        hotspotHeight: null,
      });
      mockPrisma.room.update.mockResolvedValue({
        id: 'room-1',
      });

      const extractedRooms = [
        {
          roomNumber: '101',
          roomType: 'Office',
          floor: '1st Floor',
          // No hotspot fields
        },
      ];

      await saveExtractedRooms('test-project', extractedRooms);

      const updateCall = mockPrisma.room.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('hotspotX');
      expect(updateCall.data).not.toHaveProperty('hotspotY');
      expect(updateCall.data).not.toHaveProperty('hotspotWidth');
      expect(updateCall.data).not.toHaveProperty('hotspotHeight');
    });

    it('should deduplicate by roomNumber + sourceDocumentId', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrisma.room.findFirst.mockResolvedValue(null);
      mockPrisma.room.create.mockResolvedValue({
        id: 'room-1',
        roomNumber: '101',
      });

      const extractedRooms = [
        {
          roomNumber: '101',
          roomType: 'Office',
          floor: '1st Floor',
        },
      ];

      await saveExtractedRooms('test-project', extractedRooms, 'doc-1');

      expect(mockPrisma.room.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            roomNumber: '101',
            sourceDocumentId: 'doc-1',
          }),
        })
      );
    });
  });

  describe('ExtractedRoom interface', () => {
    it('should support optional hotspot fields', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
      });
      mockPrisma.room.findFirst.mockResolvedValue(null);
      mockPrisma.room.create.mockResolvedValue({
        id: 'room-1',
      });

      // Test that all hotspot fields are optional
      const extractedRoomWithAllFields = {
        roomNumber: '101',
        roomType: 'Office',
        floor: '1st Floor',
        hotspotX: 10,
        hotspotY: 20,
        hotspotWidth: 5,
        hotspotHeight: 7,
      };

      const extractedRoomWithoutHotspots = {
        roomNumber: '102',
        roomType: 'Conference',
        floor: '1st Floor',
      };

      await saveExtractedRooms('test-project', [
        extractedRoomWithAllFields,
        extractedRoomWithoutHotspots,
      ]);

      expect(mockPrisma.room.create).toHaveBeenCalledTimes(2);
    });
  });
});
