import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock LLM with hoisted response
const mockLLMResponse = vi.hoisted(() => ({
  content: JSON.stringify({
    doors: [
      {
        doorNumber: '101',
        doorMark: 'A',
        doorType: '3\'-0" x 7\'-0" HOLLOW METAL',
        roomNumber: '101',
        fromRoom: 'CORRIDOR',
        toRoom: 'OFFICE',
        width: '3\'-0"',
        height: '7\'-0"',
        thickness: '1-3/4"',
        frameMaterial: 'HM',
        frameType: 'K',
        doorMaterial: 'HM',
        glazing: null,
        hardwareSet: '1',
        hinges: '3 - 4-1/2" X 4-1/2"',
        lockset: 'MORTISE LOCK',
        closer: 'LCN 4040XP',
        fireRating: '20 MIN',
        smokeRating: false,
        louver: false,
        kickplate: true,
        weatherstrip: false,
        threshold: 'SADDLE',
        notes: 'ADA COMPLIANT',
      },
      {
        doorNumber: '102',
        doorMark: 'B',
        doorType: '3\'-0" x 7\'-0" WOOD',
        roomNumber: '102',
        width: '3\'-0"',
        height: '7\'-0"',
        hardwareSet: '2',
        fireRating: null,
      },
    ],
    doorTypes: {
      A: 'HOLLOW METAL DOOR AND FRAME',
      B: 'WOOD DOOR IN HOLLOW METAL FRAME',
    },
    hardwareSets: {
      '1': 'ENTRY LOCK, CLOSER, KICK PLATE',
      '2': 'PASSAGE SET ONLY',
    },
  }),
}));

vi.mock('@/lib/abacus-llm', () => ({
  callAbacusLLM: vi.fn().mockResolvedValue(mockLLMResponse),
}));

// Mock Prisma
const prismaMock = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
  },
  room: {
    findFirst: vi.fn(),
  },
  doorScheduleItem: {
    upsert: vi.fn(),
    findMany: vi.fn(),
  },
  document: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

describe('extractDoorScheduleFromText', () => {
  const sampleText = `
    DOOR SCHEDULE
    Door No. | Type | Width | Height | Frame | Hardware Set
    101      | A    | 3'-0" | 7'-0"  | HM    | 1
    102      | B    | 3'-0" | 7'-0"  | HM    | 2
  `;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract door schedule from text using LLM', async () => {
    const { extractDoorScheduleFromText } = await import('@/lib/door-schedule-extractor');
    const result = await extractDoorScheduleFromText(sampleText, 'A1.1');

    expect(result.doors).toHaveLength(2);
    expect(result.doorTypes).toBeDefined();
    expect(result.hardwareSets).toBeDefined();
  });

  it('should add source sheet to all extracted doors', async () => {
    const { extractDoorScheduleFromText } = await import('@/lib/door-schedule-extractor');
    const result = await extractDoorScheduleFromText(sampleText, 'A1.1');

    result.doors.forEach((door) => {
      expect(door.sourceSheet).toBe('A1.1');
    });
  });

  it('should parse door with all properties', async () => {
    const { extractDoorScheduleFromText } = await import('@/lib/door-schedule-extractor');
    const result = await extractDoorScheduleFromText(sampleText);

    const door = result.doors[0];
    expect(door.doorNumber).toBe('101');
    expect(door.doorMark).toBe('A');
    expect(door.doorType).toBe('3\'-0" x 7\'-0" HOLLOW METAL');
    expect(door.width).toBe('3\'-0"');
    expect(door.height).toBe('7\'-0"');
    expect(door.hardwareSet).toBe('1');
    expect(door.fireRating).toBe('20 MIN');
  });

  it('should handle missing optional fields', async () => {
    const { extractDoorScheduleFromText } = await import('@/lib/door-schedule-extractor');
    const result = await extractDoorScheduleFromText(sampleText);

    const door = result.doors[1];
    expect(door.fireRating).toBeNull();
    expect(door.fromRoom).toBeUndefined();
    expect(door.toRoom).toBeUndefined();
  });

  it('should return empty result on LLM failure', async () => {
    const { extractDoorScheduleFromText } = await import('@/lib/door-schedule-extractor');
    const { callAbacusLLM } = await import('@/lib/abacus-llm');
    vi.mocked(callAbacusLLM).mockRejectedValueOnce(new Error('LLM error'));

    const result = await extractDoorScheduleFromText(sampleText);

    expect(result.doors).toEqual([]);
    expect(result.doorTypes).toEqual({});
    expect(result.hardwareSets).toEqual({});
  });

  it('should return empty result when no JSON in response', async () => {
    const { extractDoorScheduleFromText } = await import('@/lib/door-schedule-extractor');
    const { callAbacusLLM } = await import('@/lib/abacus-llm');
    vi.mocked(callAbacusLLM).mockResolvedValueOnce({
      content: 'No door schedule found in document',
    });

    const result = await extractDoorScheduleFromText(sampleText);

    expect(result.doors).toEqual([]);
  });

  it('should include timestamp', async () => {
    const { extractDoorScheduleFromText } = await import('@/lib/door-schedule-extractor');
    const result = await extractDoorScheduleFromText(sampleText);

    expect(result.extractedAt).toBeInstanceOf(Date);
  });
});

describe('storeDoorScheduleData', () => {
  const extractionResult = {
    doors: [
      {
        doorNumber: '101',
        doorMark: 'A',
        doorType: '3\'-0" x 7\'-0" HOLLOW METAL',
        roomNumber: '101',
        width: '3\'-0"',
        height: '7\'-0"',
        hardwareSet: '1',
        fireRating: '20 MIN',
        kickplate: true,
      },
    ],
    doorTypes: {},
    hardwareSets: {},
    extractedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.room.findFirst.mockResolvedValue({ id: 'room-1' });
    prismaMock.doorScheduleItem.upsert.mockResolvedValue({ id: 'door-1' });
  });

  it('should store door schedule items in database', async () => {
    const { storeDoorScheduleData } = await import('@/lib/door-schedule-extractor');
    const result = await storeDoorScheduleData('project-1', extractionResult, 'doc-1');

    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(prismaMock.doorScheduleItem.upsert).toHaveBeenCalledTimes(1);
  });

  it('should link door to room when room number matches', async () => {
    const { storeDoorScheduleData } = await import('@/lib/door-schedule-extractor');
    await storeDoorScheduleData('project-1', extractionResult, 'doc-1');

    const upsertCall = prismaMock.doorScheduleItem.upsert.mock.calls[0][0];
    expect(upsertCall.create.roomId).toBe('room-1');
    expect(prismaMock.room.findFirst).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        OR: [
          { roomNumber: '101' },
          { name: { contains: '101' } },
        ],
      },
    });
  });

  it('should upsert by projectId and doorNumber', async () => {
    const { storeDoorScheduleData } = await import('@/lib/door-schedule-extractor');
    await storeDoorScheduleData('project-1', extractionResult, 'doc-1');

    const upsertCall = prismaMock.doorScheduleItem.upsert.mock.calls[0][0];
    expect(upsertCall.where).toEqual({
      projectId_doorNumber: {
        projectId: 'project-1',
        doorNumber: '101',
      },
    });
  });

  it('should include all door properties in create', async () => {
    const { storeDoorScheduleData } = await import('@/lib/door-schedule-extractor');
    await storeDoorScheduleData('project-1', extractionResult, 'doc-1');

    const upsertCall = prismaMock.doorScheduleItem.upsert.mock.calls[0][0];
    expect(upsertCall.create).toMatchObject({
      projectId: 'project-1',
      doorNumber: '101',
      doorMark: 'A',
      doorType: '3\'-0" x 7\'-0" HOLLOW METAL',
      width: '3\'-0"',
      height: '7\'-0"',
      hardwareSet: '1',
      fireRating: '20 MIN',
      kickplate: true,
      sourceDocumentId: 'doc-1',
    });
  });

  it('should handle database errors gracefully', async () => {
    const { storeDoorScheduleData } = await import('@/lib/door-schedule-extractor');
    prismaMock.doorScheduleItem.upsert.mockRejectedValueOnce(
      new Error('Database error')
    );

    const result = await storeDoorScheduleData('project-1', extractionResult, 'doc-1');

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Failed to store door 101');
  });

  it('should continue processing after individual door error', async () => {
    const { storeDoorScheduleData } = await import('@/lib/door-schedule-extractor');
    const multiDoorResult = {
      ...extractionResult,
      doors: [
        extractionResult.doors[0],
        { ...extractionResult.doors[0], doorNumber: '102' },
      ],
    };
    prismaMock.doorScheduleItem.upsert
      .mockRejectedValueOnce(new Error('Error on first'))
      .mockResolvedValueOnce({ id: 'door-2' });

    const result = await storeDoorScheduleData('project-1', multiDoorResult, 'doc-1');

    expect(result.created).toBe(1); // Second one succeeded
    expect(result.errors).toHaveLength(1);
  });
});

describe('processDoorScheduleForProject', () => {
  const mockDocuments = [
    {
      id: 'doc-1',
      name: 'Door Schedule.pdf',
      DocumentChunk: [
        {
          id: 'chunk-1',
          content: 'DOOR SCHEDULE\nDoor 101 - Type A - 3\'-0" x 7\'-0"',
          sheetNumber: 'A1.1',
        },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.document.findMany.mockResolvedValue(mockDocuments);
    prismaMock.room.findFirst.mockResolvedValue(null);
    prismaMock.doorScheduleItem.upsert.mockResolvedValue({ id: 'door-1' });
  });

  it('should find and process door schedule documents', async () => {
    const { processDoorScheduleForProject } = await import('@/lib/door-schedule-extractor');
    const result = await processDoorScheduleForProject('project-1');

    expect(result.success).toBe(true);
    expect(result.doorsExtracted).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should search for architectural documents with door schedules', async () => {
    const { processDoorScheduleForProject } = await import('@/lib/door-schedule-extractor');
    await processDoorScheduleForProject('project-1');

    expect(prismaMock.document.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        projectId: 'project-1',
        deletedAt: null,
        OR: expect.arrayContaining([
          { name: { contains: 'door', mode: 'insensitive' } },
          { name: { contains: 'schedule', mode: 'insensitive' } },
        ]),
      }),
      include: expect.any(Object),
    });
  });

  it('should filter for specific document when documentId provided', async () => {
    const { processDoorScheduleForProject } = await import('@/lib/door-schedule-extractor');
    await processDoorScheduleForProject('project-1', 'doc-1');

    expect(prismaMock.document.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'doc-1',
      }),
      include: expect.any(Object),
    });
  });

  it('should skip documents without relevant chunks', async () => {
    const { processDoorScheduleForProject } = await import('@/lib/door-schedule-extractor');
    prismaMock.document.findMany.mockResolvedValue([
      {
        id: 'doc-2',
        name: 'Other.pdf',
        DocumentChunk: [],
      },
    ]);

    const result = await processDoorScheduleForProject('project-1');

    expect(result.doorsExtracted).toBe(0);
  });

  it('should handle extraction errors gracefully', async () => {
    const { processDoorScheduleForProject } = await import('@/lib/door-schedule-extractor');
    const { callAbacusLLM } = await import('@/lib/abacus-llm');
    vi.mocked(callAbacusLLM).mockRejectedValueOnce(new Error('LLM error'));

    const result = await processDoorScheduleForProject('project-1');

    expect(result.success).toBe(true); // No errors in array means success
    expect(result.doorsExtracted).toBe(0);
  });
});

describe('getDoorScheduleContext', () => {
  const mockDoors = [
    {
      doorNumber: '101',
      doorType: '3\'-0" x 7\'-0" HOLLOW METAL',
      width: '3\'-0"',
      height: '7\'-0"',
      fireRating: '20 MIN',
      roomNumber: '101',
      hardwareSet: '1',
    },
    {
      doorNumber: '102',
      doorType: '3\'-0" x 7\'-0" WOOD',
      width: '3\'-0"',
      height: '7\'-0"',
      fireRating: null,
      roomNumber: '102',
      hardwareSet: '2',
    },
    {
      doorNumber: '103',
      doorType: '3\'-0" x 7\'-0" HOLLOW METAL',
      width: '3\'-0"',
      height: '7\'-0"',
      fireRating: '20 MIN',
      roomNumber: '103',
      hardwareSet: '1',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.project.findUnique.mockResolvedValue({
      id: 'project-1',
      slug: 'test-project',
    });
    prismaMock.doorScheduleItem.findMany.mockResolvedValue(mockDoors);
  });

  it('should return null when project not found', async () => {
    const { getDoorScheduleContext } = await import('@/lib/door-schedule-extractor');
    prismaMock.project.findUnique.mockResolvedValue(null);

    const context = await getDoorScheduleContext('nonexistent');

    expect(context).toBeNull();
  });

  it('should return null when no doors found', async () => {
    const { getDoorScheduleContext } = await import('@/lib/door-schedule-extractor');
    prismaMock.doorScheduleItem.findMany.mockResolvedValue([]);

    const context = await getDoorScheduleContext('test-project');

    expect(context).toBeNull();
  });

  it('should include door count in context', async () => {
    const { getDoorScheduleContext } = await import('@/lib/door-schedule-extractor');
    const context = await getDoorScheduleContext('test-project');

    expect(context).toContain('DOOR SCHEDULE (3 doors)');
  });

  it('should group doors by fire rating', async () => {
    const { getDoorScheduleContext } = await import('@/lib/door-schedule-extractor');
    const context = await getDoorScheduleContext('test-project');

    expect(context).toContain('Fire Rating Summary:');
    expect(context).toContain('20 MIN: 2 doors');
    expect(context).toContain('Non-Rated: 1 doors');
  });

  it('should list all doors with details', async () => {
    const { getDoorScheduleContext } = await import('@/lib/door-schedule-extractor');
    const context = await getDoorScheduleContext('test-project');

    expect(context).toContain('101: 3\'-0" x 7\'-0" HOLLOW METAL');
    expect(context).toContain('[20 MIN]');
    expect(context).toContain('Room 101');
    expect(context).toContain('HW Set: 1');
  });

  it('should handle database errors gracefully', async () => {
    const { getDoorScheduleContext } = await import('@/lib/door-schedule-extractor');
    prismaMock.doorScheduleItem.findMany.mockRejectedValue(
      new Error('Database error')
    );

    const context = await getDoorScheduleContext('test-project');

    expect(context).toBeNull();
  });
});
