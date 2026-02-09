import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mocks Setup - Must use vi.hoisted for mock objects
// ============================================

// Mock logger
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

// Mock Prisma with vi.hoisted to ensure it's available before module imports
const mockPrisma = vi.hoisted(() => ({
  documentChunk: {
    findMany: vi.fn(),
  },
  room: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  sheetLegend: {
    findMany: vi.fn(),
  },
  schedule: {
    findFirst: vi.fn(),
  },
  projectDataSource: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Mock OpenAI
const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn(),
    },
  },
};

vi.mock('openai', () => ({
  default: vi.fn(() => mockOpenAI),
}));

// Mock document intelligence router - use vi.hoisted
const { mockRecordDataSource, mockShouldOverrideExisting } = vi.hoisted(() => ({
  mockRecordDataSource: vi.fn(),
  mockShouldOverrideExisting: vi.fn(),
}));

vi.mock('@/lib/document-intelligence-router', () => ({
  recordDataSource: mockRecordDataSource,
  shouldOverrideExisting: mockShouldOverrideExisting,
  DATA_SOURCE_PRIORITY: {
    dwg: 100,
    rvt: 95,
    ifc: 90,
    pdf_cad: 80,
    pdf_scan: 60,
    xlsx: 70,
    docx: 50,
    manual: 40,
  },
}));

// Mock schedule extractor - use vi.hoisted
const { mockExtractScheduleFromDocument } = vi.hoisted(() => ({
  mockExtractScheduleFromDocument: vi.fn(),
}));

vi.mock('@/lib/schedule-document-extractor', () => ({
  extractScheduleFromDocument: mockExtractScheduleFromDocument,
}));

// Import functions after mocks
import {
  syncScaleData,
  syncRoomData,
  syncDoorData,
  syncMEPData,
  syncScheduleData,
  syncDimensionData,
  syncLegendData,
  syncMaterialsData,
} from '@/lib/feature-sync-services';

// ============================================
// Test Helpers
// ============================================

function createMockChunk(overrides = {}) {
  return {
    id: 'chunk-1',
    documentId: 'doc-1',
    content: 'Mock content',
    pageNumber: 1,
    scaleData: null,
    primaryScale: null,
    scaleRatio: null,
    dimensionSummary: null,
    dimensionCount: 0,
    dimensions: null,
    metadata: {},
    ...overrides,
  };
}

function createOpenAIResponse(content: string) {
  return {
    choices: [
      {
        message: {
          content,
        },
      },
    ],
  };
}

// ============================================
// Scale Sync Tests (6 tests)
// ============================================

describe('Feature Sync - syncScaleData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract scale from primaryScale field', async () => {
    const chunks = [
      createMockChunk({
        primaryScale: '1/4" = 1\'-0"',
        scaleRatio: 48,
      }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);
    mockRecordDataSource.mockResolvedValue(undefined);

    const result = await syncScaleData('project-1', 'doc-1', 'dwg');

    expect(result).toEqual({
      updated: true,
      scale: '1/4" = 1\'-0"',
      ratio: 48,
    });

    expect(mockRecordDataSource).toHaveBeenCalledWith(
      'project-1',
      'doc-1',
      'scale',
      'dwg',
      {
        scale: '1/4" = 1\'-0"',
        ratio: 48,
      }
    );
  });

  it('should extract scale from scaleData object', async () => {
    const chunks = [
      createMockChunk({
        scaleData: {
          scale: '1/8" = 1\'-0"',
          ratio: 96,
        },
      }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);
    mockRecordDataSource.mockResolvedValue(undefined);

    const result = await syncScaleData('project-1', 'doc-1', 'pdf_cad');

    expect(result).toEqual({
      updated: true,
      scale: '1/8" = 1\'-0"',
      ratio: 96,
    });
  });

  it('should prioritize primaryScale over scaleData', async () => {
    const chunks = [
      createMockChunk({
        primaryScale: '1/4" = 1\'-0"',
        scaleRatio: 48,
        scaleData: {
          scale: '1/8" = 1\'-0"',
          ratio: 96,
        },
      }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);
    mockRecordDataSource.mockResolvedValue(undefined);

    const result = await syncScaleData('project-1', 'doc-1', 'dwg');

    expect(result.scale).toBe('1/4" = 1\'-0"');
    expect(result.ratio).toBe(48);
  });

  it('should handle chunks with no scale data', async () => {
    const chunks = [
      createMockChunk(),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const result = await syncScaleData('project-1', 'doc-1', 'pdf_scan');

    expect(result).toEqual({ updated: false });
    expect(mockRecordDataSource).not.toHaveBeenCalled();
  });

  it('should handle empty chunks array', async () => {
    mockPrisma.documentChunk.findMany.mockResolvedValue([]);

    const result = await syncScaleData('project-1', 'doc-1', 'pdf_cad');

    expect(result).toEqual({ updated: false });
  });

  it('should log scale update for high-confidence sources', async () => {

    const chunks = [
      createMockChunk({
        primaryScale: '1/4" = 1\'-0"',
      }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);
    mockRecordDataSource.mockResolvedValue(undefined);

    await syncScaleData('project-1', 'doc-1', 'dwg');

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Updated project scale')
    );

  });
});

// ============================================
// Room Sync Tests (12 tests)
// ============================================

describe('Feature Sync - syncRoomData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract rooms using AI', async () => {
    const chunks = [
      createMockChunk({
        content: 'Room Schedule\nOffice 101: 150 SF\nConference 102: 300 SF',
      }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse(JSON.stringify([
      { name: 'Office 101', roomNumber: '101', type: 'Office', sqft: 150, floor: '1' },
      { name: 'Conference 102', roomNumber: '102', type: 'Conference', sqft: 300, floor: '1' },
    ]));

    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);

    mockPrisma.room.findFirst.mockResolvedValue(null);
    mockPrisma.room.create.mockResolvedValue({ id: 'room-1' });
    mockRecordDataSource.mockResolvedValue(undefined);

    const result = await syncRoomData('project-1', 'doc-1', 'rvt');

    expect(result).toEqual({ created: 2, updated: 0 });
    expect(mockPrisma.room.create).toHaveBeenCalledTimes(2);
  });

  it('should create new rooms when they do not exist', async () => {
    const chunks = [
      createMockChunk({ content: 'Room data' }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse(JSON.stringify([
      { name: 'Office 101', roomNumber: '101', type: 'Office', sqft: 150, floor: '1' },
    ]));

    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);
    mockPrisma.room.findFirst.mockResolvedValue(null);
    mockPrisma.room.create.mockResolvedValue({ id: 'room-1' });
    mockRecordDataSource.mockResolvedValue(undefined);

    const result = await syncRoomData('project-1', 'doc-1', 'dwg');

    expect(result.created).toBe(1);
    expect(mockPrisma.room.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'project-1',
        name: 'Office 101',
        roomNumber: '101',
        type: 'Office',
        area: 150,
        floorNumber: 1,
      }),
    });
  });

  it('should update existing rooms with higher confidence source', async () => {
    const chunks = [
      createMockChunk({ content: 'Updated room data' }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse(JSON.stringify([
      { name: 'Office 101', roomNumber: '101', type: 'Office', sqft: 175, floor: '1' },
    ]));

    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);

    const existingRoom = {
      id: 'room-1',
      name: 'Office 101',
      roomNumber: '101',
      area: 150,
      type: 'Office',
      floorNumber: 1,
    };

    mockPrisma.room.findFirst.mockResolvedValue(existingRoom);
    mockPrisma.projectDataSource.findFirst.mockResolvedValue({
      confidence: 60, // Lower than dwg (100)
    });
    mockPrisma.room.update.mockResolvedValue({ id: 'room-1' });
    mockRecordDataSource.mockResolvedValue(undefined);

    const result = await syncRoomData('project-1', 'doc-1', 'dwg');

    expect(result).toEqual({ created: 0, updated: 1 });
    expect(mockPrisma.room.update).toHaveBeenCalledWith({
      where: { id: 'room-1' },
      data: expect.objectContaining({
        area: 175,
      }),
    });
  });

  it('should not update existing rooms with lower confidence source', async () => {
    const chunks = [
      createMockChunk({ content: 'Room data' }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse(JSON.stringify([
      { name: 'Office 101', roomNumber: '101', type: 'Office', sqft: 175, floor: '1' },
    ]));

    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);

    const existingRoom = {
      id: 'room-1',
      name: 'Office 101',
      roomNumber: '101',
      area: 150,
    };

    mockPrisma.room.findFirst.mockResolvedValue(existingRoom);
    mockPrisma.projectDataSource.findFirst.mockResolvedValue({
      confidence: 100, // Higher than pdf_scan (60)
    });
    mockRecordDataSource.mockResolvedValue(undefined);

    const result = await syncRoomData('project-1', 'doc-1', 'pdf_scan');

    expect(result).toEqual({ created: 0, updated: 0 });
    expect(mockPrisma.room.update).not.toHaveBeenCalled();
  });

  it('should handle AI extraction errors gracefully', async () => {
    const chunks = [
      createMockChunk({ content: 'Room data' }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API error'));

    const result = await syncRoomData('project-1', 'doc-1', 'dwg');

    expect(result).toEqual({ created: 0, updated: 0 });
  });

  it('should handle invalid JSON from AI', async () => {
    const chunks = [
      createMockChunk({ content: 'Room data' }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse('This is not valid JSON');

    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);

    const result = await syncRoomData('project-1', 'doc-1', 'dwg');

    expect(result).toEqual({ created: 0, updated: 0 });
  });

  it('should parse floor number from string', async () => {
    const chunks = [
      createMockChunk({ content: 'Room data' }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse(JSON.stringify([
      { name: 'Office 201', roomNumber: '201', type: 'Office', sqft: 150, floor: '2' },
    ]));

    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);
    mockPrisma.room.findFirst.mockResolvedValue(null);
    mockPrisma.room.create.mockResolvedValue({ id: 'room-1' });
    mockRecordDataSource.mockResolvedValue(undefined);

    await syncRoomData('project-1', 'doc-1', 'dwg');

    expect(mockPrisma.room.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        floorNumber: 2,
      }),
    });
  });

  it('should default to "General" type if not provided', async () => {
    const chunks = [
      createMockChunk({ content: 'Room data' }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse(JSON.stringify([
      { name: 'Room 101', roomNumber: '101', sqft: 150, floor: '1' },
    ]));

    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);
    mockPrisma.room.findFirst.mockResolvedValue(null);
    mockPrisma.room.create.mockResolvedValue({ id: 'room-1' });
    mockRecordDataSource.mockResolvedValue(undefined);

    await syncRoomData('project-1', 'doc-1', 'dwg');

    expect(mockPrisma.room.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'General',
      }),
    });
  });

  it('should match rooms by roomNumber OR name', async () => {
    const chunks = [
      createMockChunk({ content: 'Room data' }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse(JSON.stringify([
      { name: 'Office Suite', roomNumber: '101', type: 'Office', sqft: 150 },
    ]));

    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);

    const existingRoom = {
      id: 'room-1',
      roomNumber: '101',
      name: 'Office',
      area: 150,
    };

    mockPrisma.room.findFirst.mockResolvedValue(existingRoom);
    mockPrisma.projectDataSource.findFirst.mockResolvedValue(null);
    mockPrisma.room.update.mockResolvedValue({ id: 'room-1' });
    mockRecordDataSource.mockResolvedValue(undefined);

    await syncRoomData('project-1', 'doc-1', 'dwg');

    expect(mockPrisma.room.findFirst).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        OR: [
          { roomNumber: '101' },
          { name: 'Office Suite' },
        ],
      },
    });
  });

  it('should record data source after extraction', async () => {
    const chunks = [
      createMockChunk({ content: 'Room data' }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse(JSON.stringify([
      { name: 'Office 101', roomNumber: '101', type: 'Office', sqft: 150, floor: '1' },
    ]));

    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);
    mockPrisma.room.findFirst.mockResolvedValue(null);
    mockPrisma.room.create.mockResolvedValue({ id: 'room-1' });
    mockRecordDataSource.mockResolvedValue(undefined);

    await syncRoomData('project-1', 'doc-1', 'rvt');

    expect(mockRecordDataSource).toHaveBeenCalledWith(
      'project-1',
      'doc-1',
      'rooms',
      'rvt',
      {
        totalRooms: 1,
        created: 1,
        updated: 0,
      }
    );
  });

  it('should handle empty chunks array', async () => {
    mockPrisma.documentChunk.findMany.mockResolvedValue([]);
    // When chunks are empty, AI still gets called but with empty content, returning no rooms
    const emptyResponse = createOpenAIResponse(JSON.stringify([]));
    mockOpenAI.chat.completions.create.mockResolvedValue(emptyResponse);

    const result = await syncRoomData('project-1', 'doc-1', 'dwg');

    expect(result).toEqual({ created: 0, updated: 0 });
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
  });

  it('should limit content sent to AI (10000 chars)', async () => {
    const longContent = 'A'.repeat(20000);
    const chunks = [
      createMockChunk({ content: longContent }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse('[]');
    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);

    await syncRoomData('project-1', 'doc-1', 'dwg');

    const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
    const prompt = callArgs.messages[0].content;

    // Prompt should be truncated to 10000 chars
    expect(prompt.length).toBeLessThan(10500); // Account for prompt text
  });
});

// ============================================
// Door Sync Tests (8 tests)
// ============================================

describe('Feature Sync - syncDoorData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract door schedule using AI', async () => {
    const chunks = [
      createMockChunk({
        content: 'Door Schedule\nMark 101: 3\'-0" x 7\'-0" Single-Flush HM',
      }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse(JSON.stringify([
      { mark: '101', type: 'Single-Flush', size: '3\'-0" x 7\'-0"', material: 'HM', hardware: 'Set A' },
      { mark: '102', type: 'Double-Flush', size: '6\'-0" x 7\'-0"', material: 'HM', hardware: 'Set B' },
    ]));

    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);
    mockRecordDataSource.mockResolvedValue(undefined);

    const result = await syncDoorData('project-1', 'doc-1', 'pdf_cad');

    expect(result).toEqual({ created: 2, updated: 0 });
  });

  it('should record door data with unique types', async () => {
    const chunks = [
      createMockChunk({ content: 'Door data' }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse(JSON.stringify([
      { mark: '101', type: 'Single-Flush', size: '3\'-0" x 7\'-0"', material: 'HM' },
      { mark: '102', type: 'Single-Flush', size: '3\'-0" x 7\'-0"', material: 'HM' },
      { mark: '103', type: 'Double-Flush', size: '6\'-0" x 7\'-0"', material: 'HM' },
    ]));

    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);
    mockRecordDataSource.mockResolvedValue(undefined);

    await syncDoorData('project-1', 'doc-1', 'dwg');

    expect(mockRecordDataSource).toHaveBeenCalledWith(
      'project-1',
      'doc-1',
      'doors',
      'dwg',
      {
        totalDoors: 3,
        doorTypes: ['Single-Flush', 'Double-Flush'],
        doors: expect.any(Array),
      }
    );
  });

  it('should handle AI extraction errors gracefully', async () => {
    const chunks = [
      createMockChunk({ content: 'Door data' }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API error'));


    const result = await syncDoorData('project-1', 'doc-1', 'dwg');

    expect(result).toEqual({ created: 0, updated: 0 });
    expect(mockLogger.error).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('Door sync error'), expect.any(Error));

  });

  it('should handle invalid JSON from AI', async () => {
    const chunks = [
      createMockChunk({ content: 'Door data' }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse('Invalid JSON response');

    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);

    const result = await syncDoorData('project-1', 'doc-1', 'dwg');

    expect(result).toEqual({ created: 0, updated: 0 });
  });

  it('should handle empty door array', async () => {
    const chunks = [
      createMockChunk({ content: 'No doors' }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse('[]');

    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);

    const result = await syncDoorData('project-1', 'doc-1', 'dwg');

    expect(result).toEqual({ created: 0, updated: 0 });
  });

  it('should use gpt-4o-mini model', async () => {
    const chunks = [
      createMockChunk({ content: 'Door data' }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse('[]');
    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);

    await syncDoorData('project-1', 'doc-1', 'dwg');

    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        max_tokens: 3000,
      })
    );
  });

  it('should limit content to 10000 characters', async () => {
    const longContent = 'Door data '.repeat(2000);
    const chunks = [
      createMockChunk({ content: longContent }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse('[]');
    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);

    await syncDoorData('project-1', 'doc-1', 'dwg');

    const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
    const prompt = callArgs.messages[0].content;

    expect(prompt.length).toBeLessThan(10500);
  });

  it('should parse JSON array from markdown code blocks', async () => {
    const chunks = [
      createMockChunk({ content: 'Door data' }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse(`
      Here are the doors:
      \`\`\`json
      [
        { "mark": "101", "type": "Single-Flush", "size": "3'-0\\" x 7'-0\\"", "material": "HM" }
      ]
      \`\`\`
    `);

    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);
    mockRecordDataSource.mockResolvedValue(undefined);

    const result = await syncDoorData('project-1', 'doc-1', 'dwg');

    expect(result.created).toBe(1);
  });
});

// ============================================
// MEP Sync Tests (10 tests)
// ============================================

describe('Feature Sync - syncMEPData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract electrical MEP data', async () => {
    const chunks = [
      createMockChunk({
        content: 'Electrical Schedule\nDuplex Outlet: 24 units, 20A, 120V',
      }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse(JSON.stringify([
      { name: 'Duplex Outlet', quantity: 24, location: 'Office areas', specs: '20A, 120V' },
    ]));

    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);
    mockRecordDataSource.mockResolvedValue(undefined);

    const result = await syncMEPData('project-1', 'doc-1', 'dwg', 'mep_electrical');

    expect(result).toEqual({ items: 1 });
  });

  it('should extract plumbing MEP data', async () => {
    const chunks = [
      createMockChunk({
        content: 'Plumbing Schedule\n2" PVC Pipe: 100 LF',
      }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse(JSON.stringify([
      { name: '2" PVC Pipe', quantity: 100, location: 'Basement', specs: 'Schedule 40' },
    ]));

    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);
    mockRecordDataSource.mockResolvedValue(undefined);

    const result = await syncMEPData('project-1', 'doc-1', 'rvt', 'mep_plumbing');

    expect(result).toEqual({ items: 1 });
    expect(mockRecordDataSource).toHaveBeenCalledWith(
      'project-1',
      'doc-1',
      'mep_plumbing',
      'rvt',
      expect.any(Object)
    );
  });

  it('should extract HVAC MEP data', async () => {
    const chunks = [
      createMockChunk({
        content: 'HVAC Schedule\n12" x 8" Supply Duct',
      }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse(JSON.stringify([
      { name: '12" x 8" Supply Duct', quantity: 50, location: 'First Floor', specs: 'Galvanized' },
    ]));

    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);
    mockRecordDataSource.mockResolvedValue(undefined);

    const result = await syncMEPData('project-1', 'doc-1', 'pdf_cad', 'mep_hvac');

    expect(result).toEqual({ items: 1 });
  });

  it('should use appropriate prompt for electrical type', async () => {
    const chunks = [
      createMockChunk({ content: 'Electrical data' }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse('[]');
    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);

    await syncMEPData('project-1', 'doc-1', 'dwg', 'mep_electrical');

    const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
    const prompt = callArgs.messages[0].content;

    expect(prompt).toContain('electrical (outlets, panels, circuits, fixtures)');
  });

  it('should use appropriate prompt for plumbing type', async () => {
    const chunks = [
      createMockChunk({ content: 'Plumbing data' }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse('[]');
    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);

    await syncMEPData('project-1', 'doc-1', 'dwg', 'mep_plumbing');

    const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
    const prompt = callArgs.messages[0].content;

    expect(prompt).toContain('plumbing (pipes, fixtures, valves, drains)');
  });

  it('should use appropriate prompt for HVAC type', async () => {
    const chunks = [
      createMockChunk({ content: 'HVAC data' }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse('[]');
    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);

    await syncMEPData('project-1', 'doc-1', 'dwg', 'mep_hvac');

    const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
    const prompt = callArgs.messages[0].content;

    expect(prompt).toContain('HVAC (ducts, units, vents, thermostats)');
  });

  it('should handle AI extraction errors gracefully', async () => {
    const chunks = [
      createMockChunk({ content: 'MEP data' }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API error'));


    const result = await syncMEPData('project-1', 'doc-1', 'dwg', 'mep_electrical');

    expect(result).toEqual({ items: 0 });
    expect(mockLogger.error).toHaveBeenCalledWith(expect.any(String),
      expect.stringContaining('MEP sync error'),
      expect.any(Error)
    );

  });

  it('should handle invalid JSON from AI', async () => {
    const chunks = [
      createMockChunk({ content: 'MEP data' }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse('Not valid JSON');

    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);

    const result = await syncMEPData('project-1', 'doc-1', 'dwg', 'mep_hvac');

    expect(result).toEqual({ items: 0 });
  });

  it('should record extracted items with data source', async () => {
    const chunks = [
      createMockChunk({ content: 'MEP data' }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const items = [
      { name: 'Outlet', quantity: 10 },
      { name: 'Switch', quantity: 5 },
    ];

    const aiResponse = createOpenAIResponse(JSON.stringify(items));

    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);
    mockRecordDataSource.mockResolvedValue(undefined);

    await syncMEPData('project-1', 'doc-1', 'rvt', 'mep_electrical');

    expect(mockRecordDataSource).toHaveBeenCalledWith(
      'project-1',
      'doc-1',
      'mep_electrical',
      'rvt',
      {
        totalItems: 2,
        items,
      }
    );
  });

  it('should limit content to 10000 characters', async () => {
    const longContent = 'MEP data '.repeat(2000);
    const chunks = [
      createMockChunk({ content: longContent }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse('[]');
    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);

    await syncMEPData('project-1', 'doc-1', 'dwg', 'mep_electrical');

    const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
    const prompt = callArgs.messages[0].content;

    expect(prompt.length).toBeLessThan(10500);
  });
});

// ============================================
// Schedule Sync Tests (4 tests)
// ============================================

describe('Feature Sync - syncScheduleData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return existing schedule task count if already processed', async () => {
    const existingSchedule = {
      id: 'schedule-1',
      projectId: 'project-1',
      documentId: 'doc-1',
      _count: {
        ScheduleTask: 25,
      },
    };

    mockPrisma.schedule.findFirst.mockResolvedValue(existingSchedule);


    const result = await syncScheduleData('project-1', 'doc-1', 'xlsx');

    expect(result).toEqual({ tasks: 25 });
    expect(mockLogger.info).toHaveBeenCalledWith(expect.any(String),
      'Schedule already exists for this document'
    );
    expect(mockExtractScheduleFromDocument).not.toHaveBeenCalled();

  });

  it('should trigger schedule extraction for new documents', async () => {
    mockPrisma.schedule.findFirst.mockResolvedValue(null);

    mockExtractScheduleFromDocument.mockResolvedValue({
      success: true,
      extractedTasks: Array(15).fill({ name: 'Task' }),
      source: 'vision-ai',
    });

    mockRecordDataSource.mockResolvedValue(undefined);

    const result = await syncScheduleData('project-1', 'doc-1', 'xlsx');

    expect(result).toEqual({ tasks: 15 });
    expect(mockExtractScheduleFromDocument).toHaveBeenCalledWith('doc-1');
    expect(mockRecordDataSource).toHaveBeenCalledWith(
      'project-1',
      'doc-1',
      'schedule',
      'xlsx',
      {
        taskCount: 15,
        source: 'vision-ai',
      }
    );
  });

  it('should handle extraction errors gracefully', async () => {
    mockPrisma.schedule.findFirst.mockResolvedValue(null);
    mockExtractScheduleFromDocument.mockRejectedValue(new Error('Extraction failed'));


    const result = await syncScheduleData('project-1', 'doc-1', 'xlsx');

    expect(result).toEqual({ tasks: 0 });
    expect(mockLogger.error).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('Schedule sync error'), expect.any(Error));

  });

  it('should return 0 tasks if extraction returns no tasks', async () => {
    mockPrisma.schedule.findFirst.mockResolvedValue(null);

    mockExtractScheduleFromDocument.mockResolvedValue({
      success: false,
      extractedTasks: [],
      source: 'vision-ai',
    });

    const result = await syncScheduleData('project-1', 'doc-1', 'pdf_scan');

    expect(result).toEqual({ tasks: 0 });
    expect(mockRecordDataSource).not.toHaveBeenCalled();
  });
});

// ============================================
// Dimension Sync Tests (4 tests)
// ============================================

describe('Feature Sync - syncDimensionData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should aggregate dimensions from chunks', async () => {
    const chunks = [
      createMockChunk({
        dimensionCount: 5,
        dimensions: [
          { value: '12\'-0"', type: 'horizontal' },
          { value: '8\'-6"', type: 'vertical' },
        ],
      }),
      createMockChunk({
        dimensionCount: 3,
        dimensions: [
          { value: '24\'-0"', type: 'horizontal' },
        ],
      }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);
    mockRecordDataSource.mockResolvedValue(undefined);

    const result = await syncDimensionData('project-1', 'doc-1', 'dwg');

    expect(result).toEqual({ dimensions: 8 }); // 5 + 3
    expect(mockRecordDataSource).toHaveBeenCalledWith(
      'project-1',
      'doc-1',
      'dimensions',
      'dwg',
      {
        totalDimensions: 8,
        sample: expect.arrayContaining([
          { value: '12\'-0"', type: 'horizontal' },
          { value: '8\'-6"', type: 'vertical' },
          { value: '24\'-0"', type: 'horizontal' },
        ]),
      }
    );
  });

  it('should limit sample to 20 dimensions', async () => {
    const chunks = [
      createMockChunk({
        dimensionCount: 50,
        dimensions: Array(50).fill({ value: '10\'-0"', type: 'horizontal' }),
      }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);
    mockRecordDataSource.mockResolvedValue(undefined);

    await syncDimensionData('project-1', 'doc-1', 'dwg');

    const callArgs = mockRecordDataSource.mock.calls[0][4];
    expect(callArgs.sample).toHaveLength(20);
  });

  it('should handle chunks with no dimensions', async () => {
    const chunks = [
      createMockChunk(),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const result = await syncDimensionData('project-1', 'doc-1', 'pdf_cad');

    expect(result).toEqual({ dimensions: 0 });
    expect(mockRecordDataSource).not.toHaveBeenCalled();
  });

  it('should handle empty dimensions array gracefully', async () => {
    const chunks = [
      createMockChunk({
        dimensionCount: 0,
        dimensions: [],
      }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const result = await syncDimensionData('project-1', 'doc-1', 'dwg');

    expect(result).toEqual({ dimensions: 0 });
  });
});

// ============================================
// Legend Sync Tests (3 tests)
// ============================================

describe('Feature Sync - syncLegendData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should count symbols from legend entries', async () => {
    const legends = [
      {
        id: 'legend-1',
        documentId: 'doc-1',
        legendEntries: [
          { symbol: 'E', description: 'Electrical panel' },
          { symbol: 'L', description: 'Light fixture' },
        ],
      },
      {
        id: 'legend-2',
        documentId: 'doc-1',
        legendEntries: [
          { symbol: 'P', description: 'Plumbing fixture' },
        ],
      },
    ];

    mockPrisma.sheetLegend.findMany.mockResolvedValue(legends);
    mockRecordDataSource.mockResolvedValue(undefined);

    const result = await syncLegendData('project-1', 'doc-1', 'dwg');

    expect(result).toEqual({ symbols: 3 }); // 2 + 1
    expect(mockRecordDataSource).toHaveBeenCalledWith(
      'project-1',
      'doc-1',
      'legends',
      'dwg',
      {
        legendCount: 2,
        totalSymbols: 3,
      }
    );
  });

  it('should handle legends with no entries', async () => {
    const legends = [
      {
        id: 'legend-1',
        documentId: 'doc-1',
        legendEntries: null,
      },
    ];

    mockPrisma.sheetLegend.findMany.mockResolvedValue(legends);
    mockRecordDataSource.mockResolvedValue(undefined);

    const result = await syncLegendData('project-1', 'doc-1', 'pdf_cad');

    expect(result).toEqual({ symbols: 0 });
  });

  it('should return 0 if no legends found', async () => {
    mockPrisma.sheetLegend.findMany.mockResolvedValue([]);

    const result = await syncLegendData('project-1', 'doc-1', 'dwg');

    expect(result).toEqual({ symbols: 0 });
    expect(mockRecordDataSource).not.toHaveBeenCalled();
  });
});

// ============================================
// Materials Sync Tests (3 tests)
// ============================================

describe('Feature Sync - syncMaterialsData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract materials using AI', async () => {
    const chunks = [
      createMockChunk({
        content: 'Materials: 4000 PSI Concrete for foundation, A992 Grade 50 Steel for structural',
      }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse(JSON.stringify([
      { name: 'Concrete', spec: '4000 PSI', application: 'Foundation' },
      { name: 'Steel', spec: 'A992 Grade 50', application: 'Structural' },
    ]));

    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);
    mockRecordDataSource.mockResolvedValue(undefined);

    const result = await syncMaterialsData('project-1', 'doc-1', 'docx');

    expect(result).toEqual({ materials: 2 });
    expect(mockRecordDataSource).toHaveBeenCalledWith(
      'project-1',
      'doc-1',
      'materials',
      'docx',
      {
        totalMaterials: 2,
        materials: expect.any(Array),
      }
    );
  });

  it('should handle AI extraction errors gracefully', async () => {
    const chunks = [
      createMockChunk({ content: 'Materials data' }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API error'));


    const result = await syncMaterialsData('project-1', 'doc-1', 'docx');

    expect(result).toEqual({ materials: 0 });
    expect(mockLogger.error).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('Materials sync error'), expect.any(Error));

  });

  it('should use max_tokens of 2000 for materials extraction', async () => {
    const chunks = [
      createMockChunk({ content: 'Materials data' }),
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const aiResponse = createOpenAIResponse('[]');
    mockOpenAI.chat.completions.create.mockResolvedValue(aiResponse);

    await syncMaterialsData('project-1', 'doc-1', 'docx');

    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        max_tokens: 2000,
      })
    );
  });
});
