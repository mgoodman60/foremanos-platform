import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Prisma with hoisted mocks
const prismaMock = vi.hoisted(() => ({
  documentChunk: {
    findMany: vi.fn(),
  },
  room: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

describe('extractDoorScheduleFromChunks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract doors from document chunks with SCHEDULE DATA', async () => {
    const { extractDoorScheduleFromChunks } = await import('@/lib/auto-mep-extractor');

    prismaMock.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        content: 'SCHEDULE DATA {"mark":"101","width":"3\'-0\\"","height":"7\'-0\\"","family_type":"HM"}',
        projectId: 'project-1',
      },
      {
        id: 'chunk-2',
        content: 'SCHEDULE DATA {"mark":"102","width":"3\'-6\\"","family_type":"WOOD"}',
        projectId: 'project-1',
      },
    ]);

    const result = await extractDoorScheduleFromChunks('project-1');

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      mark: '101',
      width: '3\'-0"',
      height: '7\'-0"',
      family_type: 'HM',
    });
    expect(result[1]).toMatchObject({
      mark: '102',
      width: '3\'-6"',
      family_type: 'WOOD',
    });
  });

  it('should filter chunks by SCHEDULE DATA content', async () => {
    const { extractDoorScheduleFromChunks } = await import('@/lib/auto-mep-extractor');

    prismaMock.documentChunk.findMany.mockResolvedValue([]);

    await extractDoorScheduleFromChunks('project-1');

    expect(prismaMock.documentChunk.findMany).toHaveBeenCalledWith({
      where: {
        Document: { projectId: 'project-1' },
        content: { contains: 'SCHEDULE DATA' },
      },
    });
  });

  it('should deduplicate doors by mark', async () => {
    const { extractDoorScheduleFromChunks } = await import('@/lib/auto-mep-extractor');

    prismaMock.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        content: 'SCHEDULE DATA {"mark":"101","width":"3\'-0\\""}',
      },
      {
        id: 'chunk-2',
        content: 'SCHEDULE DATA {"mark":"101","width":"3\'-6\\""}',
      },
    ]);

    const result = await extractDoorScheduleFromChunks('project-1');

    expect(result).toHaveLength(1);
    // Should keep the last occurrence
    expect(result[0].width).toBe('3\'-6"');
  });

  it('should skip invalid JSON in chunks', async () => {
    const { extractDoorScheduleFromChunks } = await import('@/lib/auto-mep-extractor');

    prismaMock.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        content: 'SCHEDULE DATA {"mark":"101","width":"3\'-0\\""} invalid json {broken',
      },
    ]);

    const result = await extractDoorScheduleFromChunks('project-1');

    expect(result).toHaveLength(1);
    expect(result[0].mark).toBe('101');
  });

  it('should only include doors with mark and either width or family_type', async () => {
    const { extractDoorScheduleFromChunks } = await import('@/lib/auto-mep-extractor');

    prismaMock.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        content: 'SCHEDULE DATA {"mark":"101","width":"3\'-0\\""} {"mark":"102","family_type":"HM"} {"width":"3\'-0\\""} {"mark":"103"}',
      },
    ]);

    const result = await extractDoorScheduleFromChunks('project-1');

    expect(result).toHaveLength(2);
    expect(result[0].mark).toBe('101');
    expect(result[1].mark).toBe('102');
  });

  it('should return empty array when no chunks found', async () => {
    const { extractDoorScheduleFromChunks } = await import('@/lib/auto-mep-extractor');

    prismaMock.documentChunk.findMany.mockResolvedValue([]);

    const result = await extractDoorScheduleFromChunks('project-1');

    expect(result).toEqual([]);
  });

  it('should handle chunks with no JSON matches', async () => {
    const { extractDoorScheduleFromChunks } = await import('@/lib/auto-mep-extractor');

    prismaMock.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        content: 'SCHEDULE DATA but no JSON here',
      },
    ]);

    const result = await extractDoorScheduleFromChunks('project-1');

    expect(result).toEqual([]);
  });

  it('should extract multiple doors from single chunk', async () => {
    const { extractDoorScheduleFromChunks } = await import('@/lib/auto-mep-extractor');

    prismaMock.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        content: 'SCHEDULE DATA {"mark":"101","width":"3\'-0\\""} {"mark":"102","width":"3\'-6\\""} {"mark":"103","family_type":"AUTO"}',
      },
    ]);

    const result = await extractDoorScheduleFromChunks('project-1');

    expect(result).toHaveLength(3);
  });
});

describe('autoLinkMEPToRooms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update rooms with MEP requirements based on room type', async () => {
    const { autoLinkMEPToRooms } = await import('@/lib/auto-mep-extractor');

    prismaMock.room.findMany.mockResolvedValue([
      { id: 'room-1', type: 'Office', notes: 'Existing notes' },
      { id: 'room-2', type: 'Toilet', notes: '' },
    ]);
    prismaMock.room.update.mockResolvedValue({});

    const result = await autoLinkMEPToRooms('project-1');

    expect(result).toBe(2);
    expect(prismaMock.room.update).toHaveBeenCalledTimes(2);
  });

  it('should skip rooms that already have [MEP] notes', async () => {
    const { autoLinkMEPToRooms } = await import('@/lib/auto-mep-extractor');

    prismaMock.room.findMany.mockResolvedValue([
      { id: 'room-1', type: 'Office', notes: 'Existing [MEP] 4 outlets | 4 lights' },
      { id: 'room-2', type: 'Toilet', notes: '' },
    ]);
    prismaMock.room.update.mockResolvedValue({});

    const result = await autoLinkMEPToRooms('project-1');

    expect(result).toBe(1);
    expect(prismaMock.room.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.room.update).toHaveBeenCalledWith({
      where: { id: 'room-2' },
      data: expect.objectContaining({
        notes: expect.stringContaining('[MEP]'),
      }),
    });
  });

  it('should generate correct MEP note for Office room', async () => {
    const { autoLinkMEPToRooms } = await import('@/lib/auto-mep-extractor');

    prismaMock.room.findMany.mockResolvedValue([
      { id: 'room-1', type: 'Office', notes: '' },
    ]);
    prismaMock.room.update.mockResolvedValue({});

    await autoLinkMEPToRooms('project-1');

    expect(prismaMock.room.update).toHaveBeenCalledWith({
      where: { id: 'room-1' },
      data: {
        notes: '\n[MEP] 4 outlets | 4 lights | 2 data',
      },
    });
  });

  it('should generate correct MEP note for Toilet room', async () => {
    const { autoLinkMEPToRooms } = await import('@/lib/auto-mep-extractor');

    prismaMock.room.findMany.mockResolvedValue([
      { id: 'room-1', type: 'Toilet', notes: '' },
    ]);
    prismaMock.room.update.mockResolvedValue({});

    await autoLinkMEPToRooms('project-1');

    expect(prismaMock.room.update).toHaveBeenCalledWith({
      where: { id: 'room-1' },
      data: {
        notes: '\n[MEP] 1 outlets | 2 lights | exhaust | WC, LAV',
      },
    });
  });

  it('should generate correct MEP note for Exam room with med gas', async () => {
    const { autoLinkMEPToRooms } = await import('@/lib/auto-mep-extractor');

    prismaMock.room.findMany.mockResolvedValue([
      { id: 'room-1', type: 'Exam', notes: '' },
    ]);
    prismaMock.room.update.mockResolvedValue({});

    await autoLinkMEPToRooms('project-1');

    expect(prismaMock.room.update).toHaveBeenCalledWith({
      where: { id: 'room-1' },
      data: {
        notes: '\n[MEP] 6 outlets | 4 lights | LAV | med gas',
      },
    });
  });

  it('should generate correct MEP note for Mechanical room with HVAC access', async () => {
    const { autoLinkMEPToRooms } = await import('@/lib/auto-mep-extractor');

    prismaMock.room.findMany.mockResolvedValue([
      { id: 'room-1', type: 'Mechanical', notes: '' },
    ]);
    prismaMock.room.update.mockResolvedValue({});

    await autoLinkMEPToRooms('project-1');

    expect(prismaMock.room.update).toHaveBeenCalledWith({
      where: { id: 'room-1' },
      data: {
        notes: '\n[MEP] 2 outlets | 2 lights | HVAC panel',
      },
    });
  });

  it('should generate correct MEP note for Corridor with fire alarm', async () => {
    const { autoLinkMEPToRooms } = await import('@/lib/auto-mep-extractor');

    prismaMock.room.findMany.mockResolvedValue([
      { id: 'room-1', type: 'Corridor', notes: '' },
    ]);
    prismaMock.room.update.mockResolvedValue({});

    await autoLinkMEPToRooms('project-1');

    expect(prismaMock.room.update).toHaveBeenCalledWith({
      where: { id: 'room-1' },
      data: {
        notes: '\n[MEP] 3 lights | FA device',
      },
    });
  });

  it('should use default assignment for unknown room type', async () => {
    const { autoLinkMEPToRooms } = await import('@/lib/auto-mep-extractor');

    prismaMock.room.findMany.mockResolvedValue([
      { id: 'room-1', type: 'Unknown Room Type', notes: '' },
    ]);
    prismaMock.room.update.mockResolvedValue({});

    await autoLinkMEPToRooms('project-1');

    expect(prismaMock.room.update).toHaveBeenCalledWith({
      where: { id: 'room-1' },
      data: {
        notes: '\n[MEP] 2 outlets | 2 lights',
      },
    });
  });

  it('should use default assignment for null room type', async () => {
    const { autoLinkMEPToRooms } = await import('@/lib/auto-mep-extractor');

    prismaMock.room.findMany.mockResolvedValue([
      { id: 'room-1', type: null, notes: '' },
    ]);
    prismaMock.room.update.mockResolvedValue({});

    await autoLinkMEPToRooms('project-1');

    expect(prismaMock.room.update).toHaveBeenCalledWith({
      where: { id: 'room-1' },
      data: {
        notes: '\n[MEP] 4 outlets | 4 lights | 2 data',
      },
    });
  });

  it('should append MEP note to existing notes', async () => {
    const { autoLinkMEPToRooms } = await import('@/lib/auto-mep-extractor');

    prismaMock.room.findMany.mockResolvedValue([
      { id: 'room-1', type: 'Office', notes: 'Existing room notes' },
    ]);
    prismaMock.room.update.mockResolvedValue({});

    await autoLinkMEPToRooms('project-1');

    expect(prismaMock.room.update).toHaveBeenCalledWith({
      where: { id: 'room-1' },
      data: {
        notes: 'Existing room notes\n[MEP] 4 outlets | 4 lights | 2 data',
      },
    });
  });

  it('should handle null existing notes', async () => {
    const { autoLinkMEPToRooms } = await import('@/lib/auto-mep-extractor');

    prismaMock.room.findMany.mockResolvedValue([
      { id: 'room-1', type: 'Office', notes: null },
    ]);
    prismaMock.room.update.mockResolvedValue({});

    await autoLinkMEPToRooms('project-1');

    expect(prismaMock.room.update).toHaveBeenCalledWith({
      where: { id: 'room-1' },
      data: {
        notes: '\n[MEP] 4 outlets | 4 lights | 2 data',
      },
    });
  });

  it('should return 0 when no rooms found', async () => {
    const { autoLinkMEPToRooms } = await import('@/lib/auto-mep-extractor');

    prismaMock.room.findMany.mockResolvedValue([]);

    const result = await autoLinkMEPToRooms('project-1');

    expect(result).toBe(0);
    expect(prismaMock.room.update).not.toHaveBeenCalled();
  });

  it('should handle all predefined room types correctly', async () => {
    const { autoLinkMEPToRooms } = await import('@/lib/auto-mep-extractor');

    const roomTypes = [
      'PC Bath',
      'Reception',
      'Break Room',
      'Mech',
      'Storage',
      'Multipurpose',
      'Multipurpose Room',
      'Lab',
      'Med Room',
      'Laundry',
      'Nurse Station',
      'Therapy',
      'Quiet Room',
      'IT',
      'IDT',
      'Catering',
      'Serving',
      'Pantry',
      'Janitor',
      'Closet',
      'Clean Linen',
      'Dirty Linen',
      'Vestibule',
      'Program',
      'Circulation',
      'Observation/Triage',
      'Obs/Triage',
    ];

    prismaMock.room.findMany.mockResolvedValue(
      roomTypes.map((type, idx) => ({ id: `room-${idx}`, type, notes: '' }))
    );
    prismaMock.room.update.mockResolvedValue({});

    const result = await autoLinkMEPToRooms('project-1');

    expect(result).toBe(roomTypes.length);
    expect(prismaMock.room.update).toHaveBeenCalledTimes(roomTypes.length);
  });

  it('should handle Closet with 0 outlets', async () => {
    const { autoLinkMEPToRooms } = await import('@/lib/auto-mep-extractor');

    prismaMock.room.findMany.mockResolvedValue([
      { id: 'room-1', type: 'Closet', notes: '' },
    ]);
    prismaMock.room.update.mockResolvedValue({});

    await autoLinkMEPToRooms('project-1');

    // 0 outlets are skipped (truthy check), only lights included
    expect(prismaMock.room.update).toHaveBeenCalledWith({
      where: { id: 'room-1' },
      data: {
        notes: '\n[MEP] 1 lights',
      },
    });
  });
});

describe('countDoorsByType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use door schedule when more than 10 doors found', async () => {
    const { countDoorsByType } = await import('@/lib/auto-mep-extractor');

    const doors = Array.from({ length: 15 }, (_, i) => ({
      mark: `${100 + i}`,
      width: '3\'-0"',
      family_type: i < 5 ? 'HM' : 'WOOD',
    }));

    prismaMock.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        content: `SCHEDULE DATA ${doors.map(d => JSON.stringify(d)).join(' ')}`,
      },
    ]);

    const result = await countDoorsByType('project-1');

    expect(result.fromSchedule).toBe(true);
    expect(result.total).toBe(15);
  });

  it('should categorize auto/sliding doors correctly', async () => {
    const { countDoorsByType } = await import('@/lib/auto-mep-extractor');

    const doors = Array.from({ length: 12 }, (_, i) => ({
      mark: `${100 + i}`,
      width: '3\'-0"',
      family_type: i < 2 ? 'AUTO SLIDING' : 'HM',
    }));

    prismaMock.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        content: `SCHEDULE DATA ${doors.map(d => JSON.stringify(d)).join(' ')}`,
      },
    ]);

    const result = await countDoorsByType('project-1');

    expect(result.auto).toBe(2);
  });

  it('should categorize fire rated doors correctly', async () => {
    const { countDoorsByType } = await import('@/lib/auto-mep-extractor');

    const doors = Array.from({ length: 12 }, (_, i) => ({
      mark: `${100 + i}`,
      width: '3\'-0"',
      family_type: i < 5 ? 'FIRE RATED HM' : 'HM',
    }));

    prismaMock.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        content: `SCHEDULE DATA ${doors.map(d => JSON.stringify(d)).join(' ')}`,
      },
    ]);

    const result = await countDoorsByType('project-1');

    // Minimum only applies when fire < 4, so 5 fire doors = 5
    expect(result.fire).toBe(5);
  });

  it('should categorize exterior doors correctly', async () => {
    const { countDoorsByType } = await import('@/lib/auto-mep-extractor');

    const doors = Array.from({ length: 12 }, (_, i) => ({
      mark: `${100 + i}`,
      width: '3\'-0"',
      family_type: i < 4 ? 'HM EXTERIOR' : 'WOOD',
    }));

    prismaMock.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        content: `SCHEDULE DATA ${doors.map(d => JSON.stringify(d)).join(' ')}`,
      },
    ]);

    const result = await countDoorsByType('project-1');

    expect(result.exterior).toBe(4);
  });

  it('should categorize interior doors by default', async () => {
    const { countDoorsByType } = await import('@/lib/auto-mep-extractor');

    const doors = Array.from({ length: 15 }, (_, i) => ({
      mark: `${100 + i}`,
      width: '3\'-0"',
      family_type: 'WOOD',
    }));

    prismaMock.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        content: `SCHEDULE DATA ${doors.map(d => JSON.stringify(d)).join(' ')}`,
      },
    ]);

    const result = await countDoorsByType('project-1');

    expect(result.interior).toBe(15);
  });

  it('should apply minimum of 1 auto door', async () => {
    const { countDoorsByType } = await import('@/lib/auto-mep-extractor');

    const doors = Array.from({ length: 12 }, (_, i) => ({
      mark: `${100 + i}`,
      width: '3\'-0"',
      family_type: 'HM',
    }));

    prismaMock.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        content: `SCHEDULE DATA ${doors.map(d => JSON.stringify(d)).join(' ')}`,
      },
    ]);

    const result = await countDoorsByType('project-1');

    expect(result.auto).toBe(1); // Minimum
  });

  it('should apply minimum of 3 exterior doors', async () => {
    const { countDoorsByType } = await import('@/lib/auto-mep-extractor');

    const doors = Array.from({ length: 12 }, (_, i) => ({
      mark: `${100 + i}`,
      width: '3\'-0"',
      family_type: i === 0 ? 'HM EXTERIOR' : 'WOOD',
    }));

    prismaMock.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        content: `SCHEDULE DATA ${doors.map(d => JSON.stringify(d)).join(' ')}`,
      },
    ]);

    const result = await countDoorsByType('project-1');

    expect(result.exterior).toBe(3); // Minimum
  });

  it('should apply minimum of 8 fire doors', async () => {
    const { countDoorsByType } = await import('@/lib/auto-mep-extractor');

    const doors = Array.from({ length: 12 }, (_, i) => ({
      mark: `${100 + i}`,
      width: '3\'-0"',
      family_type: i < 2 ? 'FIRE RATED' : 'WOOD',
    }));

    prismaMock.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        content: `SCHEDULE DATA ${doors.map(d => JSON.stringify(d)).join(' ')}`,
      },
    ]);

    const result = await countDoorsByType('project-1');

    expect(result.fire).toBe(8); // Minimum
  });

  it('should use fallback estimation when 10 or fewer doors in schedule', async () => {
    const { countDoorsByType } = await import('@/lib/auto-mep-extractor');

    const doors = Array.from({ length: 10 }, (_, i) => ({
      mark: `${100 + i}`,
      width: '3\'-0"',
      family_type: 'HM',
    }));

    prismaMock.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        content: `SCHEDULE DATA ${doors.map(d => JSON.stringify(d)).join(' ')}`,
      },
    ]);

    prismaMock.room.findMany.mockResolvedValue([
      { id: 'room-1', type: 'Office' },
      { id: 'room-2', type: 'Conference' },
    ]);

    const result = await countDoorsByType('project-1');

    expect(result.fromSchedule).toBe(false);
  });

  it('should exclude open areas from fallback estimation', async () => {
    const { countDoorsByType } = await import('@/lib/auto-mep-extractor');

    prismaMock.documentChunk.findMany.mockResolvedValue([]);
    prismaMock.room.findMany.mockResolvedValue([
      { id: 'room-1', type: 'Office' },
      { id: 'room-2', type: 'Corridor' },
      { id: 'room-3', type: 'Vestibule' },
      { id: 'room-4', type: 'Reception' },
      { id: 'room-5', type: 'Conference' },
    ]);

    const result = await countDoorsByType('project-1');

    expect(result.fromSchedule).toBe(false);
    // 5 total rooms - 3 open areas = 2 rooms
    expect(result.total).toBe(2);
  });

  it('should use fallback values for exterior, fire, and auto doors', async () => {
    const { countDoorsByType } = await import('@/lib/auto-mep-extractor');

    prismaMock.documentChunk.findMany.mockResolvedValue([]);
    prismaMock.room.findMany.mockResolvedValue([
      { id: 'room-1', type: 'Office' },
      { id: 'room-2', type: 'Conference' },
    ]);

    const result = await countDoorsByType('project-1');

    expect(result.exterior).toBe(3);
    expect(result.fire).toBe(8);
    expect(result.auto).toBe(1);
    expect(result.fromSchedule).toBe(false);
  });

  it('should calculate interior doors in fallback mode', async () => {
    const { countDoorsByType } = await import('@/lib/auto-mep-extractor');

    prismaMock.documentChunk.findMany.mockResolvedValue([]);
    prismaMock.room.findMany.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({ id: `room-${i}`, type: 'Office' }))
    );

    const result = await countDoorsByType('project-1');

    // 30 rooms - 15 = 15, but minimum is 25
    expect(result.interior).toBe(25);
  });

  it('should handle case-insensitive room type matching in fallback', async () => {
    const { countDoorsByType } = await import('@/lib/auto-mep-extractor');

    prismaMock.documentChunk.findMany.mockResolvedValue([]);
    prismaMock.room.findMany.mockResolvedValue([
      { id: 'room-1', type: 'CORRIDOR' },
      { id: 'room-2', type: 'lobby' },
      { id: 'room-3', type: 'Program Space' },
      { id: 'room-4', type: 'Office' },
    ]);

    const result = await countDoorsByType('project-1');

    // 4 rooms - 3 open areas = 1 room
    expect(result.total).toBe(1);
  });

  it('should handle null room types in fallback', async () => {
    const { countDoorsByType } = await import('@/lib/auto-mep-extractor');

    prismaMock.documentChunk.findMany.mockResolvedValue([]);
    prismaMock.room.findMany.mockResolvedValue([
      { id: 'room-1', type: null },
      { id: 'room-2', type: 'Office' },
    ]);

    const result = await countDoorsByType('project-1');

    expect(result.total).toBe(2);
  });

  it('should handle metal door family type variations', async () => {
    const { countDoorsByType } = await import('@/lib/auto-mep-extractor');

    const doors = Array.from({ length: 15 }, (_, i) => ({
      mark: `${100 + i}`,
      width: '3\'-0"',
      family_type: i < 3 ? 'METAL FRAME' : i < 6 ? 'hm door' : 'WOOD',
    }));

    prismaMock.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        content: `SCHEDULE DATA ${doors.map(d => JSON.stringify(d)).join(' ')}`,
      },
    ]);

    const result = await countDoorsByType('project-1');

    expect(result.exterior).toBe(6);
  });
});

describe('runAutoMEPExtraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should orchestrate full MEP extraction', async () => {
    const { runAutoMEPExtraction } = await import('@/lib/auto-mep-extractor');

    prismaMock.room.findMany.mockResolvedValue([
      { id: 'room-1', type: 'Office', notes: '' },
      { id: 'room-2', type: 'Toilet', notes: '' },
    ]);
    prismaMock.room.update.mockResolvedValue({});

    const doors = Array.from({ length: 15 }, (_, i) => ({
      mark: `${100 + i}`,
      width: '3\'-0"',
      family_type: 'HM',
    }));

    prismaMock.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        content: `SCHEDULE DATA ${doors.map(d => JSON.stringify(d)).join(' ')}`,
      },
    ]);

    const result = await runAutoMEPExtraction('project-1');

    expect(result).toMatchObject({
      roomsUpdated: 2,
      doorsFound: 15,
      fromSchedule: true,
    });
  });

  it('should return results even when no rooms updated', async () => {
    const { runAutoMEPExtraction } = await import('@/lib/auto-mep-extractor');

    prismaMock.room.findMany.mockResolvedValue([
      { id: 'room-1', type: 'Office', notes: '[MEP] already exists' },
    ]);

    prismaMock.documentChunk.findMany.mockResolvedValue([]);

    const result = await runAutoMEPExtraction('project-1');

    expect(result.roomsUpdated).toBe(0);
  });

  it('should work with fallback door counting', async () => {
    const { runAutoMEPExtraction } = await import('@/lib/auto-mep-extractor');

    prismaMock.room.findMany.mockResolvedValue([
      { id: 'room-1', type: 'Office', notes: '' },
    ]);
    prismaMock.room.update.mockResolvedValue({});

    prismaMock.documentChunk.findMany.mockResolvedValue([]);

    const result = await runAutoMEPExtraction('project-1');

    expect(result.fromSchedule).toBe(false);
    expect(result.roomsUpdated).toBe(1);
    expect(result.doorsFound).toBeGreaterThan(0);
  });

  it('should handle empty project', async () => {
    const { runAutoMEPExtraction } = await import('@/lib/auto-mep-extractor');

    prismaMock.room.findMany.mockResolvedValue([]);
    prismaMock.documentChunk.findMany.mockResolvedValue([]);

    const result = await runAutoMEPExtraction('project-1');

    expect(result).toMatchObject({
      roomsUpdated: 0,
      doorsFound: 0,
      fromSchedule: false,
    });
  });

  it('should call autoLinkMEPToRooms with correct projectId', async () => {
    const { runAutoMEPExtraction } = await import('@/lib/auto-mep-extractor');

    prismaMock.room.findMany.mockResolvedValue([
      { id: 'room-1', type: 'Office', notes: '' },
    ]);
    prismaMock.room.update.mockResolvedValue({});
    prismaMock.documentChunk.findMany.mockResolvedValue([]);

    await runAutoMEPExtraction('test-project-123');

    expect(prismaMock.room.findMany).toHaveBeenCalledWith({
      where: { projectId: 'test-project-123' },
    });
  });

  it('should call countDoorsByType with correct projectId', async () => {
    const { runAutoMEPExtraction } = await import('@/lib/auto-mep-extractor');

    prismaMock.room.findMany.mockResolvedValue([]);
    prismaMock.documentChunk.findMany.mockResolvedValue([]);

    await runAutoMEPExtraction('test-project-456');

    // Called twice: once for door schedule extraction, once for room counting
    const calls = prismaMock.documentChunk.findMany.mock.calls;
    expect(calls[0][0].where.Document.projectId).toBe('test-project-456');
  });
});
