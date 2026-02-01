import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Prisma BEFORE importing the module
const mockPrisma = vi.hoisted(() => ({
  documentChunk: {
    findMany: vi.fn(),
  },
  room: {
    findUnique: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

describe('Location Detector Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // extractRoomsFromDocument() Tests
  // ============================================

  describe('extractRoomsFromDocument()', () => {
    it('should extract rooms from document chunks with metadata roomNumbers', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Office space with desk',
          pageNumber: 1,
          metadata: {
            roomNumbers: ['101', '102'],
            sheet_number: 'A-101',
            grid_location: 'A2'
          },
        },
        {
          id: 'chunk-2',
          documentId: 'doc-1',
          content: 'Storage area',
          pageNumber: 2,
          metadata: {
            roomNumbers: ['103'],
            sheet_number: 'A-102'
          },
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        name: 'Room 101',
        roomNumber: '101',
        type: 'office',
        sheetId: 'A-101',
        gridLocation: 'A2'
      });
      expect(result[1]).toEqual({
        name: 'Room 102',
        roomNumber: '102',
        type: 'office',
        sheetId: 'A-101',
        gridLocation: 'A2'
      });
      expect(result[2]).toEqual({
        name: 'Room 103',
        roomNumber: '103',
        type: 'storage',
        sheetId: 'A-102',
        gridLocation: undefined
      });
    });

    it('should extract rooms from content using "ROOM" pattern', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ROOM 201 - Conference Room\nROOM 202 - Kitchen Area',
          pageNumber: 1,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'Room 201',
        roomNumber: '201',
        type: 'other',
        sheetId: '1'
      });
      expect(result[1]).toEqual({
        name: 'Room 202',
        roomNumber: '202',
        type: 'kitchen',
        sheetId: '1'
      });
    });

    it('should extract rooms from content using "UNIT" pattern', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'UNIT 301\nSUITE 302',
          pageNumber: 1,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'Unit 301',
        roomNumber: '301',
        type: 'unit',
        sheetId: '1'
      });
      expect(result[1]).toEqual({
        name: 'Unit 302',
        roomNumber: '302',
        type: 'unit',
        sheetId: '1'
      });
    });

    it('should extract rooms using standalone pattern with room type', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: '101 Office\n102 Bath\n103 Kitchen',
          pageNumber: 1,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        name: 'Office 101',
        roomNumber: '101',
        type: 'office',
        sheetId: '1'
      });
      expect(result[1]).toEqual({
        name: 'Bath 102',
        roomNumber: '102',
        type: 'bath',
        sheetId: '1'
      });
      expect(result[2]).toEqual({
        name: 'Kitchen 103',
        roomNumber: '103',
        type: 'kitchen',
        sheetId: '1'
      });
    });

    it('should deduplicate rooms from metadata and content', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ROOM 101 - Office',
          pageNumber: 1,
          metadata: {
            roomNumbers: ['101'],
          },
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result).toHaveLength(1);
      expect(result[0].roomNumber).toBe('101');
    });

    it('should handle alphanumeric room numbers', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ROOM A101\nROOM B202C',
          pageNumber: 1,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result).toHaveLength(2);
      expect(result[0].roomNumber).toBe('A101');
      expect(result[1].roomNumber).toBe('B202C');
    });

    it('should use pageNumber as fallback sheetId when metadata is missing', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ROOM 101',
          pageNumber: 5,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result[0].sheetId).toBe('5');
    });

    it('should use "unknown" as sheetId when pageNumber is null', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ROOM 101',
          pageNumber: null,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result[0].sheetId).toBe('unknown');
    });

    it('should handle chunks with no rooms', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'General notes and specifications',
          pageNumber: 1,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result).toHaveLength(0);
    });

    it('should handle empty document chunks', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result).toHaveLength(0);
    });

    it('should handle database errors', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockRejectedValue(new Error('Database connection failed'));

      await expect(extractRoomsFromDocument('doc-1', 'project-1')).rejects.toThrow('Database connection failed');
    });

    it('should order chunks by pageNumber', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-3',
          documentId: 'doc-1',
          content: 'ROOM 103',
          pageNumber: 3,
          metadata: {},
        },
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ROOM 101',
          pageNumber: 1,
          metadata: {},
        },
      ]);

      await extractRoomsFromDocument('doc-1', 'project-1');

      expect(mockPrisma.documentChunk.findMany).toHaveBeenCalledWith({
        where: { documentId: 'doc-1' },
        orderBy: { pageNumber: 'asc' }
      });
    });
  });

  // ============================================
  // Room Type Detection Tests
  // ============================================

  describe('detectRoomType() - via extractRoomsFromDocument', () => {
    it('should detect bathroom from context keywords', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ROOM 101 bathroom fixtures',
          pageNumber: 1,
          metadata: {},
        },
        {
          id: 'chunk-2',
          documentId: 'doc-1',
          content: 'ROOM 102 wc facilities',
          pageNumber: 1,
          metadata: {},
        },
        {
          id: 'chunk-3',
          documentId: 'doc-1',
          content: 'ROOM 103 restroom area',
          pageNumber: 1,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result[0].type).toBe('bathroom');
      expect(result[1].type).toBe('bathroom');
      expect(result[2].type).toBe('bathroom');
    });

    it('should detect kitchen from context keywords', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ROOM 201 kitchen area',
          pageNumber: 1,
          metadata: {},
        },
        {
          id: 'chunk-2',
          documentId: 'doc-1',
          content: 'ROOM 202 pantry storage',
          pageNumber: 1,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result[0].type).toBe('kitchen');
      expect(result[1].type).toBe('kitchen');
    });

    it('should detect bedroom from context keywords', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ROOM 301 bedroom',
          pageNumber: 1,
          metadata: {},
        },
        {
          id: 'chunk-2',
          documentId: 'doc-1',
          content: 'ROOM 302 bed area',
          pageNumber: 1,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result[0].type).toBe('bedroom');
      expect(result[1].type).toBe('bedroom');
    });

    it('should detect office from context keywords', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ROOM 401 office space',
          pageNumber: 1,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result[0].type).toBe('office');
    });

    it('should detect living area from context keywords', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ROOM 501 living room',
          pageNumber: 1,
          metadata: {},
        },
        {
          id: 'chunk-2',
          documentId: 'doc-1',
          content: 'ROOM 502 lounge area',
          pageNumber: 1,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result[0].type).toBe('living');
      expect(result[1].type).toBe('living');
    });

    it('should detect mechanical from context keywords', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ROOM 601 mechanical room',
          pageNumber: 1,
          metadata: {},
        },
        {
          id: 'chunk-2',
          documentId: 'doc-1',
          content: 'ROOM 602 mech equipment',
          pageNumber: 1,
          metadata: {},
        },
        {
          id: 'chunk-3',
          documentId: 'doc-1',
          content: 'ROOM 603 hvac systems',
          pageNumber: 1,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result[0].type).toBe('mechanical');
      expect(result[1].type).toBe('mechanical');
      expect(result[2].type).toBe('mechanical');
    });

    it('should detect electrical from context keywords', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ROOM 701 electrical room',
          pageNumber: 1,
          metadata: {},
        },
        {
          id: 'chunk-2',
          documentId: 'doc-1',
          content: 'ROOM 702 elec panel',
          pageNumber: 1,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result[0].type).toBe('electrical');
      expect(result[1].type).toBe('electrical');
    });

    it('should detect storage from context keywords', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ROOM 801 storage area',
          pageNumber: 1,
          metadata: {},
        },
        {
          id: 'chunk-2',
          documentId: 'doc-1',
          content: 'ROOM 802 closet',
          pageNumber: 1,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result[0].type).toBe('storage');
      expect(result[1].type).toBe('storage');
    });

    it('should detect common_area from context keywords', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ROOM 901 lobby',
          pageNumber: 1,
          metadata: {},
        },
        {
          id: 'chunk-2',
          documentId: 'doc-1',
          content: 'ROOM 902 entrance hall',
          pageNumber: 1,
          metadata: {},
        },
        {
          id: 'chunk-3',
          documentId: 'doc-1',
          content: 'ROOM 903 corridor',
          pageNumber: 1,
          metadata: {},
        },
        {
          id: 'chunk-4',
          documentId: 'doc-1',
          content: 'ROOM 904 hallway',
          pageNumber: 1,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result[0].type).toBe('common_area');
      expect(result[1].type).toBe('common_area');
      expect(result[2].type).toBe('common_area');
      expect(result[3].type).toBe('common_area');
    });

    it('should detect mechanical from room number prefix M', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ROOM M101',
          pageNumber: 1,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result[0].type).toBe('mechanical');
    });

    it('should detect electrical from room number prefix E', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ROOM E201',
          pageNumber: 1,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result[0].type).toBe('electrical');
    });

    it('should default to "other" when no type can be detected', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ROOM 999 generic space',
          pageNumber: 1,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result[0].type).toBe('other');
    });

    it('should prioritize context keywords over room number prefix', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ROOM M101 office converted',
          pageNumber: 1,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result[0].type).toBe('office');
    });
  });

  // ============================================
  // createRoomsFromExtraction() Tests
  // ============================================

  describe('createRoomsFromExtraction()', () => {
    it('should create rooms in database from extraction data', async () => {
      const { createRoomsFromExtraction } = await import('@/lib/location-detector');

      mockPrisma.room.findUnique.mockResolvedValue(null);
      mockPrisma.room.create.mockResolvedValue({
        id: 'room-1',
        projectId: 'project-1',
        name: 'Room 101',
        roomNumber: '101',
        type: 'office',
      });

      const rooms = [
        {
          name: 'Room 101',
          roomNumber: '101',
          type: 'office',
          sheetId: 'A-101',
          gridLocation: 'A2',
        },
        {
          name: 'Room 102',
          roomNumber: '102',
          type: 'storage',
          sheetId: 'A-102',
        },
      ];

      const created = await createRoomsFromExtraction('project-1', rooms, 'user-1');

      expect(created).toBe(2);
      expect(mockPrisma.room.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.room.create).toHaveBeenCalledWith({
        data: {
          projectId: 'project-1',
          name: 'Room 101',
          roomNumber: '101',
          type: 'office',
          floorNumber: undefined,
          area: undefined,
          gridLocation: 'A2',
          sheetId: 'A-101',
        },
      });
    });

    it('should skip existing rooms', async () => {
      const { createRoomsFromExtraction } = await import('@/lib/location-detector');

      mockPrisma.room.findUnique.mockResolvedValue({
        id: 'existing-room',
        roomNumber: '101',
        projectId: 'project-1',
      });

      const rooms = [
        {
          name: 'Room 101',
          roomNumber: '101',
          type: 'office',
        },
      ];

      const created = await createRoomsFromExtraction('project-1', rooms, 'user-1');

      expect(created).toBe(0);
      expect(mockPrisma.room.create).not.toHaveBeenCalled();
    });

    it('should create rooms with all optional fields', async () => {
      const { createRoomsFromExtraction } = await import('@/lib/location-detector');

      mockPrisma.room.findUnique.mockResolvedValue(null);
      mockPrisma.room.create.mockResolvedValue({ id: 'room-1' });

      const rooms = [
        {
          name: 'Room 201',
          roomNumber: '201',
          type: 'bedroom',
          floorNumber: 2,
          area: 150.5,
          gridLocation: 'B3',
          sheetId: 'A-201',
        },
      ];

      await createRoomsFromExtraction('project-1', rooms, 'user-1');

      expect(mockPrisma.room.create).toHaveBeenCalledWith({
        data: {
          projectId: 'project-1',
          name: 'Room 201',
          roomNumber: '201',
          type: 'bedroom',
          floorNumber: 2,
          area: 150.5,
          gridLocation: 'B3',
          sheetId: 'A-201',
        },
      });
    });

    it('should handle rooms without roomNumber', async () => {
      const { createRoomsFromExtraction } = await import('@/lib/location-detector');

      mockPrisma.room.create.mockResolvedValue({ id: 'room-1' });

      const rooms = [
        {
          name: 'General Storage',
          type: 'storage',
        },
      ];

      const created = await createRoomsFromExtraction('project-1', rooms, 'user-1');

      expect(created).toBe(1);
      expect(mockPrisma.room.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.room.create).toHaveBeenCalledWith({
        data: {
          projectId: 'project-1',
          name: 'General Storage',
          roomNumber: undefined,
          type: 'storage',
          floorNumber: undefined,
          area: undefined,
          gridLocation: undefined,
          sheetId: undefined,
        },
      });
    });

    it('should continue creating rooms even if one fails', async () => {
      const { createRoomsFromExtraction } = await import('@/lib/location-detector');

      mockPrisma.room.findUnique.mockResolvedValue(null);
      mockPrisma.room.create
        .mockResolvedValueOnce({ id: 'room-1' })
        .mockRejectedValueOnce(new Error('Database constraint violation'))
        .mockResolvedValueOnce({ id: 'room-3' });

      const rooms = [
        { name: 'Room 101', roomNumber: '101', type: 'office' },
        { name: 'Room 102', roomNumber: '102', type: 'storage' },
        { name: 'Room 103', roomNumber: '103', type: 'kitchen' },
      ];

      const created = await createRoomsFromExtraction('project-1', rooms, 'user-1');

      expect(created).toBe(2);
      expect(mockPrisma.room.create).toHaveBeenCalledTimes(3);
    });

    it('should handle empty rooms array', async () => {
      const { createRoomsFromExtraction } = await import('@/lib/location-detector');

      const created = await createRoomsFromExtraction('project-1', [], 'user-1');

      expect(created).toBe(0);
      expect(mockPrisma.room.create).not.toHaveBeenCalled();
    });

    it('should check uniqueness by projectId and roomNumber', async () => {
      const { createRoomsFromExtraction } = await import('@/lib/location-detector');

      mockPrisma.room.findUnique.mockResolvedValue(null);
      mockPrisma.room.create.mockResolvedValue({ id: 'room-1' });

      const rooms = [
        { name: 'Room 101', roomNumber: '101', type: 'office' },
      ];

      await createRoomsFromExtraction('project-1', rooms, 'user-1');

      expect(mockPrisma.room.findUnique).toHaveBeenCalledWith({
        where: {
          projectId_roomNumber: {
            projectId: 'project-1',
            roomNumber: '101',
          },
        },
      });
    });
  });

  // ============================================
  // getRoomProgressSummary() Tests
  // ============================================

  describe('getRoomProgressSummary()', () => {
    it('should return room progress summary with all statuses', async () => {
      const { getRoomProgressSummary } = await import('@/lib/location-detector');

      mockPrisma.room.findMany.mockResolvedValue([
        { id: 'room-1', status: 'completed', percentComplete: 100, type: 'office' },
        { id: 'room-2', status: 'in_progress', percentComplete: 60, type: 'office' },
        { id: 'room-3', status: 'not_started', percentComplete: 0, type: 'storage' },
        { id: 'room-4', status: 'completed', percentComplete: 100, type: 'kitchen' },
      ]);

      const result = await getRoomProgressSummary('project-1');

      expect(result).toEqual({
        totalRooms: 4,
        completed: 2,
        inProgress: 1,
        notStarted: 1,
        averageProgress: 65,
        byType: {
          office: 2,
          storage: 1,
          kitchen: 1,
        },
      });
    });

    it('should group rooms by type correctly', async () => {
      const { getRoomProgressSummary } = await import('@/lib/location-detector');

      mockPrisma.room.findMany.mockResolvedValue([
        { id: 'room-1', status: 'completed', percentComplete: 100, type: 'bathroom' },
        { id: 'room-2', status: 'in_progress', percentComplete: 50, type: 'bathroom' },
        { id: 'room-3', status: 'not_started', percentComplete: 0, type: 'bathroom' },
        { id: 'room-4', status: 'completed', percentComplete: 100, type: 'bedroom' },
        { id: 'room-5', status: 'in_progress', percentComplete: 75, type: 'bedroom' },
      ]);

      const result = await getRoomProgressSummary('project-1');

      expect(result.byType).toEqual({
        bathroom: 3,
        bedroom: 2,
      });
    });

    it('should calculate average progress correctly', async () => {
      const { getRoomProgressSummary } = await import('@/lib/location-detector');

      mockPrisma.room.findMany.mockResolvedValue([
        { id: 'room-1', status: 'completed', percentComplete: 100, type: 'office' },
        { id: 'room-2', status: 'in_progress', percentComplete: 50, type: 'office' },
        { id: 'room-3', status: 'in_progress', percentComplete: 25, type: 'storage' },
      ]);

      const result = await getRoomProgressSummary('project-1');

      expect(result.averageProgress).toBe(58.3); // (100 + 50 + 25) / 3 = 58.333... rounded to 58.3
    });

    it('should round average progress to one decimal place', async () => {
      const { getRoomProgressSummary } = await import('@/lib/location-detector');

      mockPrisma.room.findMany.mockResolvedValue([
        { id: 'room-1', status: 'in_progress', percentComplete: 33.3333, type: 'office' },
        { id: 'room-2', status: 'in_progress', percentComplete: 66.6666, type: 'office' },
      ]);

      const result = await getRoomProgressSummary('project-1');

      expect(result.averageProgress).toBe(50); // (33.3333 + 66.6666) / 2 = 50
    });

    it('should handle empty project with no rooms', async () => {
      const { getRoomProgressSummary } = await import('@/lib/location-detector');

      mockPrisma.room.findMany.mockResolvedValue([]);

      const result = await getRoomProgressSummary('project-1');

      expect(result).toEqual({
        totalRooms: 0,
        completed: 0,
        inProgress: 0,
        notStarted: 0,
        averageProgress: 0,
        byType: {},
      });
    });

    it('should handle rooms with same type', async () => {
      const { getRoomProgressSummary } = await import('@/lib/location-detector');

      mockPrisma.room.findMany.mockResolvedValue([
        { id: 'room-1', status: 'completed', percentComplete: 100, type: 'office' },
        { id: 'room-2', status: 'in_progress', percentComplete: 50, type: 'office' },
        { id: 'room-3', status: 'not_started', percentComplete: 0, type: 'office' },
      ]);

      const result = await getRoomProgressSummary('project-1');

      expect(result.byType).toEqual({
        office: 3,
      });
    });

    it('should select only required fields', async () => {
      const { getRoomProgressSummary } = await import('@/lib/location-detector');

      mockPrisma.room.findMany.mockResolvedValue([]);

      await getRoomProgressSummary('project-1');

      expect(mockPrisma.room.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        select: {
          id: true,
          status: true,
          percentComplete: true,
          type: true,
        },
      });
    });
  });

  // ============================================
  // Legacy Stub Functions Tests
  // ============================================

  describe('Legacy Stub Functions', () => {
    it('parseLocationResponse should return null', async () => {
      const { parseLocationResponse } = await import('@/lib/location-detector');

      const result = parseLocationResponse('some text', {
        rooms: [],
        floors: [],
        zones: [],
        areas: [],
        elevations: [],
        siteZones: [],
      });

      expect(result).toBe(null);
    });

    it('structureLocationData should return empty object', async () => {
      const { structureLocationData } = await import('@/lib/location-detector');

      const result = structureLocationData('room', '101', 'painting');

      expect(result).toEqual({});
    });

    it('validateLocation should return true', async () => {
      const { validateLocation } = await import('@/lib/location-detector');

      const result = validateLocation('101', 'room');

      expect(result).toBe(true);
    });

    it('findAvailableLocations should return empty structure', async () => {
      const { findAvailableLocations } = await import('@/lib/location-detector');

      const result = await findAvailableLocations('project-1');

      expect(result).toEqual({
        rooms: [],
        floors: [],
        zones: [],
        areas: [],
        elevations: [],
        siteZones: [],
      });
    });
  });

  // ============================================
  // Edge Cases and Complex Scenarios
  // ============================================

  describe('Edge Cases', () => {
    it('should handle mixed case room patterns', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'room 101\nRoom 102\nROOM 103',
          pageNumber: 1,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result).toHaveLength(3);
    });

    it('should handle rooms with two-digit numbers', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ROOM 01\nROOM 99',
          pageNumber: 1,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result).toHaveLength(2);
      expect(result[0].roomNumber).toBe('01');
      expect(result[1].roomNumber).toBe('99');
    });

    it('should handle rooms with four-digit numbers', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ROOM 1001\nROOM 9999',
          pageNumber: 1,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result).toHaveLength(2);
      expect(result[0].roomNumber).toBe('1001');
      expect(result[1].roomNumber).toBe('9999');
    });

    it('should not match room numbers with only one digit', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ROOM 1\nROOM 9',
          pageNumber: 1,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result).toHaveLength(0);
    });

    it('should handle metadata with non-array roomNumbers', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Floor plan',
          pageNumber: 1,
          metadata: {
            roomNumbers: '101', // Not an array
          },
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result).toHaveLength(0);
    });

    it('should handle null metadata gracefully', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ROOM 101',
          pageNumber: 1,
          metadata: null,
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result).toHaveLength(1);
    });

    it('should handle content with multiple room patterns on same line', async () => {
      const { extractRoomsFromDocument } = await import('@/lib/location-detector');

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ROOM 101 adjacent to UNIT 102',
          pageNumber: 1,
          metadata: {},
        },
      ]);

      const result = await extractRoomsFromDocument('doc-1', 'project-1');

      expect(result).toHaveLength(1);
      expect(result[0].roomNumber).toBe('101');
    });
  });
});
