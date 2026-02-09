import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateRoomTakeoffs,
  calculateProjectTakeoffs,
  aggregateTakeoffs,
  saveTakeoffsToDatabase,
} from '@/lib/takeoff-calculator';
import type { TakeoffCalculation, TakeoffSummary } from '@/lib/takeoff-calculator';

// ============================================
// Mock Setup with vi.hoisted
// ============================================
const mocks = vi.hoisted(() => ({
  prisma: {
    room: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    materialTakeoff: {
      create: vi.fn(),
    },
    takeoffLineItem: {
      createMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

// ============================================
// Test Data Helpers
// ============================================
function createMockRoom(overrides: any = {}) {
  return {
    id: 'room-1',
    projectId: 'project-1',
    name: 'Conference Room',
    roomNumber: '101',
    type: 'office',
    area: 400, // 400 SF
    FinishScheduleItem: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockFinishItem(category: string, material: string, overrides: any = {}) {
  return {
    id: `finish-${category}`,
    roomId: 'room-1',
    category,
    material,
    finishType: null,
    manufacturer: null,
    modelNumber: null,
    color: null,
    dimensions: null,
    notes: null,
    csiCode: null,
    csiDivision: null,
    sourceDocumentId: null,
    sourceSheetNumber: null,
    extractedAt: null,
    isConfirmed: false,
    status: 'proposed',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('takeoff-calculator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // calculateRoomTakeoffs Tests
  // ============================================
  describe('calculateRoomTakeoffs', () => {
    describe('success cases', () => {
      it('should calculate flooring takeoff with waste factor', async () => {
        const room = createMockRoom({
          area: 400,
          FinishScheduleItem: [
            createMockFinishItem('flooring', 'Carpet Tile'),
          ],
        });

        mocks.prisma.room.findUnique.mockResolvedValue(room);

        const result = await calculateRoomTakeoffs('room-1');

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          roomId: 'room-1',
          roomNumber: '101',
          roomName: 'Conference Room',
          category: 'Flooring',
          material: 'Carpet Tile',
          quantity: 441, // Math.ceil(400 * 1.10) = Math.ceil(440.00000000000006) = 441
          unit: 'SF',
          location: '101 - Conference Room',
        });
      });

      it('should calculate ceiling takeoff with waste factor', async () => {
        const room = createMockRoom({
          area: 400,
          FinishScheduleItem: [
            createMockFinishItem('ceiling', 'ACT 2x2'),
          ],
        });

        mocks.prisma.room.findUnique.mockResolvedValue(room);

        const result = await calculateRoomTakeoffs('room-1');

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          category: 'Ceiling',
          material: 'ACT 2x2',
          quantity: 441, // Math.ceil(400 * 1.10) = Math.ceil(440.00000000000006) = 441
          unit: 'SF',
        });
      });

      it('should calculate wall takeoff based on perimeter and ceiling height', async () => {
        const room = createMockRoom({
          area: 400, // 400 SF
          FinishScheduleItem: [
            createMockFinishItem('walls', 'Paint'),
          ],
        });

        mocks.prisma.room.findUnique.mockResolvedValue(room);

        const result = await calculateRoomTakeoffs('room-1', 9); // 9ft ceiling

        expect(result).toHaveLength(1);
        const wallCalc = result[0];
        expect(wallCalc.category).toBe('Walls');
        expect(wallCalc.material).toBe('Paint');
        expect(wallCalc.unit).toBe('SF');
        expect(wallCalc.quantity).toBeGreaterThan(0);
        expect(wallCalc.notes).toContain('Ceiling Height: 9');
      });

      it('should calculate base molding in linear feet', async () => {
        const room = createMockRoom({
          area: 400,
          FinishScheduleItem: [
            createMockFinishItem('base', 'Wood Base 4"'),
          ],
        });

        mocks.prisma.room.findUnique.mockResolvedValue(room);

        const result = await calculateRoomTakeoffs('room-1');

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          category: 'Base',
          material: 'Wood Base 4"',
          unit: 'LF',
        });
        expect(result[0].quantity).toBeGreaterThan(0);
      });

      it('should calculate all finish types for a room', async () => {
        const room = createMockRoom({
          area: 400,
          FinishScheduleItem: [
            createMockFinishItem('flooring', 'Carpet Tile'),
            createMockFinishItem('ceiling', 'ACT 2x2'),
            createMockFinishItem('walls', 'Paint'),
            createMockFinishItem('base', 'Wood Base 4"'),
          ],
        });

        mocks.prisma.room.findUnique.mockResolvedValue(room);

        const result = await calculateRoomTakeoffs('room-1');

        expect(result).toHaveLength(4);
        expect(result.map(r => r.category)).toEqual(
          expect.arrayContaining(['Flooring', 'Ceiling', 'Walls', 'Base'])
        );
      });

      it('should handle alternative category names (floor vs flooring)', async () => {
        const room = createMockRoom({
          area: 400,
          FinishScheduleItem: [
            createMockFinishItem('floor', 'VCT'), // alternative name
          ],
        });

        mocks.prisma.room.findUnique.mockResolvedValue(room);

        const result = await calculateRoomTakeoffs('room-1');

        expect(result).toHaveLength(1);
        expect(result[0].category).toBe('Flooring');
      });

      it('should handle alternative category names (wall vs walls)', async () => {
        const room = createMockRoom({
          area: 400,
          FinishScheduleItem: [
            createMockFinishItem('wall', 'Paint'), // singular
          ],
        });

        mocks.prisma.room.findUnique.mockResolvedValue(room);

        const result = await calculateRoomTakeoffs('room-1');

        expect(result).toHaveLength(1);
        expect(result[0].category).toBe('Walls');
      });

      it('should handle alternative category names (baseboard vs base)', async () => {
        const room = createMockRoom({
          area: 400,
          FinishScheduleItem: [
            createMockFinishItem('baseboard', 'Wood Base'), // alternative
          ],
        });

        mocks.prisma.room.findUnique.mockResolvedValue(room);

        const result = await calculateRoomTakeoffs('room-1');

        expect(result).toHaveLength(1);
        expect(result[0].category).toBe('Base');
      });

      it('should include finishType in notes when available', async () => {
        const room = createMockRoom({
          area: 400,
          FinishScheduleItem: [
            createMockFinishItem('flooring', 'Carpet', {
              finishType: 'Broadloom',
            }),
          ],
        });

        mocks.prisma.room.findUnique.mockResolvedValue(room);

        const result = await calculateRoomTakeoffs('room-1');

        expect(result[0].notes).toBe('Type: Broadloom');
      });

      it('should round quantities up to nearest integer', async () => {
        const room = createMockRoom({
          area: 333, // Will produce non-integer with waste factor
          FinishScheduleItem: [
            createMockFinishItem('flooring', 'Carpet'),
          ],
        });

        mocks.prisma.room.findUnique.mockResolvedValue(room);

        const result = await calculateRoomTakeoffs('room-1');

        expect(result[0].quantity).toBe(367); // Math.ceil(333 * 1.10) = 367
        expect(Number.isInteger(result[0].quantity)).toBe(true);
      });

      it('should use custom ceiling height', async () => {
        const room = createMockRoom({
          area: 400,
          FinishScheduleItem: [
            createMockFinishItem('walls', 'Paint'),
          ],
        });

        mocks.prisma.room.findUnique.mockResolvedValue(room);

        const result12ft = await calculateRoomTakeoffs('room-1', 12);
        const result9ft = await calculateRoomTakeoffs('room-1', 9);

        expect(result12ft[0].quantity).toBeGreaterThan(result9ft[0].quantity);
        expect(result12ft[0].notes).toContain('Ceiling Height: 12');
      });

      it('should handle room with no room number', async () => {
        const room = createMockRoom({
          roomNumber: null,
          FinishScheduleItem: [
            createMockFinishItem('flooring', 'Carpet'),
          ],
        });

        mocks.prisma.room.findUnique.mockResolvedValue(room);

        const result = await calculateRoomTakeoffs('room-1');

        expect(result[0].roomNumber).toBe('N/A');
        expect(result[0].location).toBe('N/A - Conference Room');
      });
    });

    describe('edge cases', () => {
      it('should skip finish items without material', async () => {
        const room = createMockRoom({
          area: 400,
          FinishScheduleItem: [
            createMockFinishItem('flooring', null), // No material
            createMockFinishItem('ceiling', 'ACT 2x2'),
          ],
        });

        mocks.prisma.room.findUnique.mockResolvedValue(room);

        const result = await calculateRoomTakeoffs('room-1');

        expect(result).toHaveLength(1);
        expect(result[0].category).toBe('Ceiling');
      });

      it('should return empty array when room has no finish items', async () => {
        const room = createMockRoom({
          area: 400,
          FinishScheduleItem: [],
        });

        mocks.prisma.room.findUnique.mockResolvedValue(room);

        const result = await calculateRoomTakeoffs('room-1');

        expect(result).toHaveLength(0);
      });

      it('should skip finish items with unrecognized categories', async () => {
        const room = createMockRoom({
          area: 400,
          FinishScheduleItem: [
            createMockFinishItem('unknown', 'Some Material'),
            createMockFinishItem('flooring', 'Carpet'),
          ],
        });

        mocks.prisma.room.findUnique.mockResolvedValue(room);

        const result = await calculateRoomTakeoffs('room-1');

        expect(result).toHaveLength(1);
        expect(result[0].category).toBe('Flooring');
      });

      it('should handle very small room areas', async () => {
        const room = createMockRoom({
          area: 1,
          FinishScheduleItem: [
            createMockFinishItem('flooring', 'Carpet'),
          ],
        });

        mocks.prisma.room.findUnique.mockResolvedValue(room);

        const result = await calculateRoomTakeoffs('room-1');

        expect(result).toHaveLength(1);
        expect(result[0].quantity).toBe(2); // Math.ceil(1 * 1.10) = 2
      });

      it('should handle very large room areas', async () => {
        const room = createMockRoom({
          area: 100000, // Very large room
          FinishScheduleItem: [
            createMockFinishItem('flooring', 'Carpet'),
          ],
        });

        mocks.prisma.room.findUnique.mockResolvedValue(room);

        const result = await calculateRoomTakeoffs('room-1');

        expect(result).toHaveLength(1);
        expect(result[0].quantity).toBe(110001); // Math.ceil(100000 * 1.10) = Math.ceil(110000.00000000001) = 110001
      });

      it('should handle case-insensitive category matching', async () => {
        const room = createMockRoom({
          area: 400,
          FinishScheduleItem: [
            createMockFinishItem('FLOORING', 'Carpet'), // Uppercase
            createMockFinishItem('Ceiling', 'ACT'), // Title case
          ],
        });

        mocks.prisma.room.findUnique.mockResolvedValue(room);

        const result = await calculateRoomTakeoffs('room-1');

        expect(result).toHaveLength(2);
        expect(result.map(r => r.category)).toEqual(
          expect.arrayContaining(['Flooring', 'Ceiling'])
        );
      });
    });

    describe('error handling', () => {
      it('should throw error when room not found', async () => {
        mocks.prisma.room.findUnique.mockResolvedValue(null);

        await expect(
          calculateRoomTakeoffs('nonexistent-room')
        ).rejects.toThrow('Room nonexistent-room not found');
      });

      it('should throw error when room has no area', async () => {
        const room = createMockRoom({
          area: null,
        });

        mocks.prisma.room.findUnique.mockResolvedValue(room);

        await expect(
          calculateRoomTakeoffs('room-1')
        ).rejects.toThrow('Room 101 has no area defined');
      });

      it('should throw error when room has zero area', async () => {
        const room = createMockRoom({
          area: 0,
        });

        mocks.prisma.room.findUnique.mockResolvedValue(room);

        await expect(
          calculateRoomTakeoffs('room-1')
        ).rejects.toThrow('Room 101 has no area defined');
      });

      it('should throw error when room has negative area', async () => {
        const room = createMockRoom({
          area: -100,
        });

        mocks.prisma.room.findUnique.mockResolvedValue(room);

        await expect(
          calculateRoomTakeoffs('room-1')
        ).rejects.toThrow('Room 101 has no area defined');
      });

      it('should handle database errors', async () => {
        mocks.prisma.room.findUnique.mockRejectedValue(
          new Error('Database connection failed')
        );

        await expect(
          calculateRoomTakeoffs('room-1')
        ).rejects.toThrow('Database connection failed');
      });
    });
  });

  // ============================================
  // calculateProjectTakeoffs Tests
  // ============================================
  describe('calculateProjectTakeoffs', () => {
    describe('success cases', () => {
      it('should calculate takeoffs for all rooms in a project', async () => {
        const rooms = [
          createMockRoom({
            id: 'room-1',
            roomNumber: '101',
            area: 400,
            FinishScheduleItem: [
              createMockFinishItem('flooring', 'Carpet'),
            ],
          }),
          createMockRoom({
            id: 'room-2',
            roomNumber: '102',
            area: 300,
            FinishScheduleItem: [
              createMockFinishItem('flooring', 'VCT'),
            ],
          }),
        ];

        mocks.prisma.room.findMany.mockResolvedValue(rooms);

        // Mock individual room calculations
        mocks.prisma.room.findUnique
          .mockResolvedValueOnce(rooms[0])
          .mockResolvedValueOnce(rooms[1]);

        const result = await calculateProjectTakeoffs('project-1');

        expect(result).toHaveLength(2);
        expect(result[0].roomNumber).toBe('101');
        expect(result[1].roomNumber).toBe('102');
      });

      it('should filter out rooms with no area', async () => {
        const rooms = [
          createMockRoom({
            id: 'room-1',
            area: 400,
            FinishScheduleItem: [
              createMockFinishItem('flooring', 'Carpet'),
            ],
          }),
        ];

        mocks.prisma.room.findMany.mockResolvedValue(rooms);
        mocks.prisma.room.findUnique.mockResolvedValue(rooms[0]);

        const result = await calculateProjectTakeoffs('project-1');

        expect(mocks.prisma.room.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              area: { gt: 0 },
            }),
          })
        );
      });

      it('should sort rooms by room number', async () => {
        const rooms = [
          createMockRoom({ id: 'room-1', roomNumber: '103' }),
          createMockRoom({ id: 'room-2', roomNumber: '101' }),
        ];

        mocks.prisma.room.findMany.mockResolvedValue(rooms);

        await calculateProjectTakeoffs('project-1');

        expect(mocks.prisma.room.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { roomNumber: 'asc' },
          })
        );
      });

      it('should use custom ceiling height for all rooms', async () => {
        const rooms = [
          createMockRoom({
            id: 'room-1',
            area: 400,
            FinishScheduleItem: [
              createMockFinishItem('walls', 'Paint'),
            ],
          }),
        ];

        mocks.prisma.room.findMany.mockResolvedValue(rooms);
        mocks.prisma.room.findUnique.mockResolvedValue(rooms[0]);

        const result = await calculateProjectTakeoffs('project-1', 12);

        expect(result[0].notes).toContain('Ceiling Height: 12');
      });

      it('should return empty array when project has no rooms', async () => {
        mocks.prisma.room.findMany.mockResolvedValue([]);

        const result = await calculateProjectTakeoffs('project-1');

        expect(result).toHaveLength(0);
      });
    });

    describe('error handling', () => {
      it('should continue processing other rooms when one fails', async () => {
        const rooms = [
          createMockRoom({
            id: 'room-1',
            roomNumber: '101',
            area: 400,
            FinishScheduleItem: [
              createMockFinishItem('flooring', 'Carpet'),
            ],
          }),
          createMockRoom({
            id: 'room-2',
            roomNumber: '102',
            area: 300,
            FinishScheduleItem: [
              createMockFinishItem('flooring', 'VCT'),
            ],
          }),
        ];

        mocks.prisma.room.findMany.mockResolvedValue(rooms);

        // First room fails, second succeeds
        mocks.prisma.room.findUnique
          .mockRejectedValueOnce(new Error('Room calculation failed'))
          .mockResolvedValueOnce(rooms[1]);


        const result = await calculateProjectTakeoffs('project-1');

        expect(result).toHaveLength(1);
        expect(result[0].roomNumber).toBe('102');
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should handle database errors when fetching rooms', async () => {
        mocks.prisma.room.findMany.mockRejectedValue(
          new Error('Database connection failed')
        );

        await expect(
          calculateProjectTakeoffs('project-1')
        ).rejects.toThrow('Database connection failed');
      });
    });
  });

  // ============================================
  // aggregateTakeoffs Tests
  // ============================================
  describe('aggregateTakeoffs', () => {
    function createTakeoffCalc(overrides: Partial<TakeoffCalculation> = {}): TakeoffCalculation {
      return {
        roomId: 'room-1',
        roomNumber: '101',
        roomName: 'Conference Room',
        category: 'Flooring',
        material: 'Carpet Tile',
        quantity: 440,
        unit: 'SF',
        location: '101 - Conference Room',
        ...overrides,
      };
    }

    describe('success cases', () => {
      it('should aggregate calculations by material', async () => {
        const calculations = [
          createTakeoffCalc({
            roomNumber: '101',
            category: 'Flooring',
            material: 'Carpet Tile',
            quantity: 440,
            unit: 'SF',
          }),
          createTakeoffCalc({
            roomNumber: '102',
            category: 'Flooring',
            material: 'Carpet Tile',
            quantity: 330,
            unit: 'SF',
          }),
        ];

        const result = aggregateTakeoffs(calculations);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          category: 'Flooring',
          material: 'Carpet Tile',
          totalQuantity: 770,
          unit: 'SF',
          roomCount: 2,
        });
        expect(result[0].rooms).toEqual(['101', '102']);
      });

      it('should separate materials by category', async () => {
        const calculations = [
          createTakeoffCalc({
            category: 'Flooring',
            material: 'Carpet',
            quantity: 440,
          }),
          createTakeoffCalc({
            category: 'Ceiling',
            material: 'Carpet', // Same material, different category
            quantity: 440,
          }),
        ];

        const result = aggregateTakeoffs(calculations);

        expect(result).toHaveLength(2);
        expect(result.find(r => r.category === 'Flooring')).toBeDefined();
        expect(result.find(r => r.category === 'Ceiling')).toBeDefined();
      });

      it('should separate materials by unit', async () => {
        const calculations = [
          createTakeoffCalc({
            category: 'Flooring',
            material: 'Carpet',
            quantity: 440,
            unit: 'SF',
          }),
          createTakeoffCalc({
            category: 'Flooring',
            material: 'Carpet',
            quantity: 100,
            unit: 'LF', // Same material, different unit
          }),
        ];

        const result = aggregateTakeoffs(calculations);

        expect(result).toHaveLength(2);
        expect(result.find(r => r.unit === 'SF')).toBeDefined();
        expect(result.find(r => r.unit === 'LF')).toBeDefined();
      });

      it('should sort results by category then material', async () => {
        const calculations = [
          createTakeoffCalc({ category: 'Walls', material: 'Paint' }),
          createTakeoffCalc({ category: 'Base', material: 'Wood Base' }),
          createTakeoffCalc({ category: 'Ceiling', material: 'ACT' }),
          createTakeoffCalc({ category: 'Base', material: 'Rubber Base' }),
        ];

        const result = aggregateTakeoffs(calculations);

        expect(result[0].category).toBe('Base');
        expect(result[0].material).toBe('Rubber Base');
        expect(result[1].category).toBe('Base');
        expect(result[1].material).toBe('Wood Base');
        expect(result[2].category).toBe('Ceiling');
        expect(result[3].category).toBe('Walls');
      });

      it('should return empty array for empty input', async () => {
        const result = aggregateTakeoffs([]);

        expect(result).toHaveLength(0);
      });

      it('should handle single calculation', async () => {
        const calculations = [
          createTakeoffCalc({
            category: 'Flooring',
            material: 'Carpet',
            quantity: 440,
          }),
        ];

        const result = aggregateTakeoffs(calculations);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          category: 'Flooring',
          material: 'Carpet',
          totalQuantity: 440,
          roomCount: 1,
        });
      });

      it('should accumulate room numbers in order', async () => {
        const calculations = [
          createTakeoffCalc({ roomNumber: '103', material: 'Carpet' }),
          createTakeoffCalc({ roomNumber: '101', material: 'Carpet' }),
          createTakeoffCalc({ roomNumber: '102', material: 'Carpet' }),
        ];

        const result = aggregateTakeoffs(calculations);

        expect(result[0].rooms).toEqual(['103', '101', '102']);
      });
    });

    describe('edge cases', () => {
      it('should handle multiple materials across many rooms', async () => {
        const calculations = [
          // Carpet in 3 rooms
          createTakeoffCalc({ roomNumber: '101', material: 'Carpet', quantity: 400 }),
          createTakeoffCalc({ roomNumber: '102', material: 'Carpet', quantity: 300 }),
          createTakeoffCalc({ roomNumber: '103', material: 'Carpet', quantity: 500 }),
          // VCT in 2 rooms
          createTakeoffCalc({ roomNumber: '104', material: 'VCT', quantity: 200 }),
          createTakeoffCalc({ roomNumber: '105', material: 'VCT', quantity: 150 }),
        ];

        const result = aggregateTakeoffs(calculations);

        const carpet = result.find(r => r.material === 'Carpet');
        const vct = result.find(r => r.material === 'VCT');

        expect(carpet?.totalQuantity).toBe(1200);
        expect(carpet?.roomCount).toBe(3);
        expect(vct?.totalQuantity).toBe(350);
        expect(vct?.roomCount).toBe(2);
      });

      it('should handle duplicate room numbers for different materials', async () => {
        const calculations = [
          createTakeoffCalc({
            roomNumber: '101',
            category: 'Flooring',
            material: 'Carpet',
          }),
          createTakeoffCalc({
            roomNumber: '101',
            category: 'Ceiling',
            material: 'ACT',
          }),
        ];

        const result = aggregateTakeoffs(calculations);

        expect(result).toHaveLength(2);
        expect(result[0].rooms).toEqual(['101']);
        expect(result[1].rooms).toEqual(['101']);
      });
    });
  });

  // ============================================
  // saveTakeoffsToDatabase Tests
  // ============================================
  describe('saveTakeoffsToDatabase', () => {
    function createTakeoffCalc(overrides: Partial<TakeoffCalculation> = {}): TakeoffCalculation {
      return {
        roomId: 'room-1',
        roomNumber: '101',
        roomName: 'Conference Room',
        category: 'Flooring',
        material: 'Carpet Tile',
        quantity: 440,
        unit: 'SF',
        location: '101 - Conference Room',
        notes: 'Type: Commercial Grade',
        ...overrides,
      };
    }

    describe('success cases', () => {
      it('should create MaterialTakeoff record with correct data', async () => {
        const mockTakeoff = {
          id: 'takeoff-1',
          projectId: 'project-1',
          name: 'Automatic Takeoff',
          description: 'Automatically generated takeoff from 2 room calculations',
          status: 'draft',
          extractedBy: 'system',
          extractedAt: expect.any(Date),
          createdBy: 'user-1',
        };

        mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
        mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 2 });

        const calculations = [
          createTakeoffCalc({ roomNumber: '101' }),
          createTakeoffCalc({ roomNumber: '102' }),
        ];

        const result = await saveTakeoffsToDatabase(
          'project-1',
          calculations,
          'user-1'
        );

        expect(result).toBe('takeoff-1');
        expect(mocks.prisma.materialTakeoff.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            projectId: 'project-1',
            name: 'Automatic Takeoff',
            description: 'Automatically generated takeoff from 2 room calculations',
            status: 'draft',
            extractedBy: 'system',
            createdBy: 'user-1',
          }),
        });
      });

      it('should use custom takeoff name when provided', async () => {
        const mockTakeoff = { id: 'takeoff-1' };

        mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
        mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 1 });

        const calculations = [createTakeoffCalc()];

        await saveTakeoffsToDatabase(
          'project-1',
          calculations,
          'user-1',
          'Custom Takeoff Name'
        );

        expect(mocks.prisma.materialTakeoff.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            name: 'Custom Takeoff Name',
          }),
        });
      });

      it('should create TakeoffLineItem records with correct data', async () => {
        const mockTakeoff = { id: 'takeoff-1' };

        mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
        mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 1 });

        const calculations = [
          createTakeoffCalc({
            category: 'Flooring',
            material: 'Carpet Tile',
            quantity: 440,
            unit: 'SF',
            location: '101 - Conference Room',
            roomNumber: '101',
            notes: 'Type: Commercial Grade',
          }),
        ];

        await saveTakeoffsToDatabase('project-1', calculations, 'user-1');

        expect(mocks.prisma.takeoffLineItem.createMany).toHaveBeenCalledWith({
          data: [
            expect.objectContaining({
              takeoffId: 'takeoff-1',
              category: 'Flooring',
              itemName: 'Carpet Tile',
              quantity: 440,
              unit: 'SF',
              location: '101 - Conference Room',
              gridLocation: '101',
              description: 'Type: Commercial Grade',
              confidence: 85,
              verificationStatus: 'needs_review',
              verified: false,
            }),
          ],
        });
      });

      it('should set confidence to 85 for calculated values', async () => {
        const mockTakeoff = { id: 'takeoff-1' };

        mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
        mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 1 });

        const calculations = [createTakeoffCalc()];

        await saveTakeoffsToDatabase('project-1', calculations, 'user-1');

        const lineItemData = mocks.prisma.takeoffLineItem.createMany.mock.calls[0][0].data;
        expect(lineItemData[0].confidence).toBe(85);
      });

      it('should handle calculations without notes', async () => {
        const mockTakeoff = { id: 'takeoff-1' };

        mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
        mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 1 });

        const calculations = [
          createTakeoffCalc({
            notes: undefined,
          }),
        ];

        await saveTakeoffsToDatabase('project-1', calculations, 'user-1');

        const lineItemData = mocks.prisma.takeoffLineItem.createMany.mock.calls[0][0].data;
        expect(lineItemData[0].description).toBe('');
      });

      it('should handle multiple calculations', async () => {
        const mockTakeoff = { id: 'takeoff-1' };

        mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
        mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 3 });

        const calculations = [
          createTakeoffCalc({ category: 'Flooring', material: 'Carpet' }),
          createTakeoffCalc({ category: 'Ceiling', material: 'ACT' }),
          createTakeoffCalc({ category: 'Walls', material: 'Paint' }),
        ];

        await saveTakeoffsToDatabase('project-1', calculations, 'user-1');

        expect(mocks.prisma.takeoffLineItem.createMany).toHaveBeenCalledWith({
          data: expect.arrayContaining([
            expect.objectContaining({ itemName: 'Carpet' }),
            expect.objectContaining({ itemName: 'ACT' }),
            expect.objectContaining({ itemName: 'Paint' }),
          ]),
        });
      });

      it('should include calculation method in line items', async () => {
        const mockTakeoff = { id: 'takeoff-1' };

        mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
        mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 1 });

        const calculations = [
          createTakeoffCalc({
            category: 'Flooring',
            quantity: 440,
            unit: 'SF',
          }),
        ];

        await saveTakeoffsToDatabase('project-1', calculations, 'user-1');

        const lineItemData = mocks.prisma.takeoffLineItem.createMany.mock.calls[0][0].data;
        expect(lineItemData[0].calculationMethod).toContain('Flooring calculation based on room dimensions');
        expect(lineItemData[0].calculationMethod).toContain('440.00 SF');
      });

      it('should include extractedFrom in line items', async () => {
        const mockTakeoff = { id: 'takeoff-1' };

        mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
        mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 1 });

        const calculations = [
          createTakeoffCalc({
            roomNumber: '101',
            location: '101 - Conference Room',
          }),
        ];

        await saveTakeoffsToDatabase('project-1', calculations, 'user-1');

        const lineItemData = mocks.prisma.takeoffLineItem.createMany.mock.calls[0][0].data;
        expect(lineItemData[0].extractedFrom).toContain('Calculated from 101 dimensions');
        expect(lineItemData[0].extractedFrom).toContain('101 - Conference Room');
      });
    });

    describe('edge cases', () => {
      it('should handle empty calculations array', async () => {
        const mockTakeoff = { id: 'takeoff-1' };

        mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
        mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 0 });

        const result = await saveTakeoffsToDatabase(
          'project-1',
          [],
          'user-1'
        );

        expect(result).toBe('takeoff-1');
        expect(mocks.prisma.materialTakeoff.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            description: 'Automatically generated takeoff from 0 room calculations',
          }),
        });
        expect(mocks.prisma.takeoffLineItem.createMany).toHaveBeenCalledWith({
          data: [],
        });
      });
    });

    describe('error handling', () => {
      it('should handle MaterialTakeoff creation error', async () => {
        mocks.prisma.materialTakeoff.create.mockRejectedValue(
          new Error('Database error')
        );

        const calculations = [createTakeoffCalc()];

        await expect(
          saveTakeoffsToDatabase('project-1', calculations, 'user-1')
        ).rejects.toThrow('Database error');
      });

      it('should handle TakeoffLineItem creation error', async () => {
        const mockTakeoff = { id: 'takeoff-1' };

        mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
        mocks.prisma.takeoffLineItem.createMany.mockRejectedValue(
          new Error('Failed to create line items')
        );

        const calculations = [createTakeoffCalc()];

        await expect(
          saveTakeoffsToDatabase('project-1', calculations, 'user-1')
        ).rejects.toThrow('Failed to create line items');
      });
    });
  });
});
