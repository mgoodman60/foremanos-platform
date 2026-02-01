import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mocks Setup - Using vi.hoisted pattern
// ============================================

const mocks = vi.hoisted(() => ({
  prisma: {
    autodeskModel: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    document: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    documentChunk: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
  extractMEPEquipment: vi.fn(),
  categorizeElement: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/lib/bim-to-takeoff-service', () => ({
  extractMEPEquipment: mocks.extractMEPEquipment,
}));

vi.mock('@/lib/bim-metadata-extractor', () => ({
  categorizeElement: mocks.categorizeElement,
}));

import {
  generateBIMIndexEntries,
  indexBIMForRAG,
  getBIMContext,
  BIMIndexEntry,
} from '@/lib/bim-rag-indexer';
import type { BIMExtractionResult, ElementProperty } from '@/lib/bim-metadata-extractor';

// ============================================
// Test Data Fixtures
// ============================================

const createMockElement = (overrides: Partial<ElementProperty> = {}): ElementProperty => ({
  dbId: 1,
  name: 'Wall-001',
  category: 'Revit Walls',
  properties: {},
  material: 'Concrete',
  level: 'Level 1',
  ...overrides,
});

const createMockBIMData = (overrides: Partial<BIMExtractionResult> = {}): BIMExtractionResult => ({
  modelUrn: 'urn:test:model',
  extractedAt: '2026-01-31T00:00:00Z',
  viewableGuids: ['guid-1', 'guid-2'],
  totalElements: 100,
  categories: {
    'Revit Walls': 50,
    'Revit Doors': 20,
    'Revit Windows': 30,
  },
  elements: [
    createMockElement({ dbId: 1, name: 'Wall-001', category: 'Revit Walls' }),
    createMockElement({ dbId: 2, name: 'Door-001', category: 'Revit Doors' }),
    createMockElement({ dbId: 3, name: 'Window-001', category: 'Revit Windows' }),
  ],
  summary: {
    structural: 50,
    mep: 0,
    architectural: 50,
    site: 0,
    other: 0,
  },
  ...overrides,
});

// ============================================
// Tests for generateBIMIndexEntries
// ============================================

describe('BIM RAG Indexer - generateBIMIndexEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate summary entry with totals', () => {
    const bimData = createMockBIMData();
    mocks.extractMEPEquipment.mockReturnValue({
      mechanical: [],
      electrical: [],
      plumbing: [],
      fireProtection: [],
    });
    mocks.categorizeElement.mockReturnValue({ category: 'structural', subcategory: 'walls' });

    const entries = generateBIMIndexEntries(bimData);

    const summaryEntry = entries.find(e => e.type === 'summary' && e.content.includes('BIM Model Summary'));
    expect(summaryEntry).toBeDefined();
    expect(summaryEntry?.content).toContain('100 total elements');
    expect(summaryEntry?.content).toContain('Structural: 50 elements');
    expect(summaryEntry?.content).toContain('Architectural: 50 elements');
    expect(summaryEntry?.metadata.totalElements).toBe(100);
  });

  it('should generate category breakdown entries', () => {
    const bimData = createMockBIMData();
    mocks.extractMEPEquipment.mockReturnValue({
      mechanical: [],
      electrical: [],
      plumbing: [],
      fireProtection: [],
    });
    mocks.categorizeElement.mockReturnValue({ category: 'structural', subcategory: 'walls' });

    const entries = generateBIMIndexEntries(bimData);

    const wallEntry = entries.find(e => e.content.includes('50 Revit Walls elements'));
    expect(wallEntry).toBeDefined();
    expect(wallEntry?.type).toBe('summary');
    expect(wallEntry?.metadata.category).toBe('Revit Walls');
    expect(wallEntry?.metadata.count).toBe(50);

    const doorEntry = entries.find(e => e.content.includes('20 Revit Doors elements'));
    expect(doorEntry).toBeDefined();
  });

  it('should skip categories with zero count', () => {
    const bimData = createMockBIMData({
      categories: {
        'Revit Walls': 50,
        'Revit Doors': 0,
      },
    });
    mocks.extractMEPEquipment.mockReturnValue({
      mechanical: [],
      electrical: [],
      plumbing: [],
      fireProtection: [],
    });
    mocks.categorizeElement.mockReturnValue({ category: 'structural', subcategory: 'walls' });

    const entries = generateBIMIndexEntries(bimData);

    const doorEntry = entries.find(e => e.content.includes('Revit Doors'));
    expect(doorEntry).toBeUndefined();
  });

  it('should generate MEP mechanical equipment entries', () => {
    const bimData = createMockBIMData();
    const mechanicalEquipment = [
      createMockElement({ dbId: 10, name: 'HVAC Unit 1', category: 'Revit Mechanical Equipment' }),
      createMockElement({ dbId: 11, name: 'HVAC Unit 2', category: 'Revit Mechanical Equipment' }),
      createMockElement({ dbId: 12, name: 'Duct-001', category: 'Revit Ducts' }),
    ];

    mocks.extractMEPEquipment.mockReturnValue({
      mechanical: mechanicalEquipment,
      electrical: [],
      plumbing: [],
      fireProtection: [],
    });
    mocks.categorizeElement.mockReturnValue({ category: 'mep', subcategory: 'mechanical' });

    const entries = generateBIMIndexEntries(bimData);

    const mepEntry = entries.find(e => e.type === 'mep' && e.metadata.type === 'mechanical');
    expect(mepEntry).toBeDefined();
    expect(mepEntry?.content).toContain('Mechanical/HVAC Equipment (3 items)');
    expect(mepEntry?.content).toContain('HVAC Unit 1');
    expect(mepEntry?.metadata.count).toBe(3);
  });

  it('should generate MEP electrical equipment entries', () => {
    const bimData = createMockBIMData();
    const electricalEquipment = [
      createMockElement({ dbId: 20, name: 'Light Fixture 1', category: 'Revit Lighting Fixtures' }),
      createMockElement({ dbId: 21, name: 'Panel-001', category: 'Revit Electrical Equipment' }),
    ];

    mocks.extractMEPEquipment.mockReturnValue({
      mechanical: [],
      electrical: electricalEquipment,
      plumbing: [],
      fireProtection: [],
    });
    mocks.categorizeElement.mockReturnValue({ category: 'mep', subcategory: 'electrical' });

    const entries = generateBIMIndexEntries(bimData);

    const mepEntry = entries.find(e => e.type === 'mep' && e.metadata.type === 'electrical');
    expect(mepEntry).toBeDefined();
    expect(mepEntry?.content).toContain('Electrical Equipment (2 items)');
    expect(mepEntry?.content).toContain('Light Fixture 1');
    expect(mepEntry?.metadata.items).toContain('Light Fixture 1');
  });

  it('should generate MEP plumbing equipment entries', () => {
    const bimData = createMockBIMData();
    const plumbingEquipment = [
      createMockElement({ dbId: 30, name: 'Sink-001', category: 'Revit Plumbing Fixtures' }),
      createMockElement({ dbId: 31, name: 'Pipe-001', category: 'Revit Pipes' }),
    ];

    mocks.extractMEPEquipment.mockReturnValue({
      mechanical: [],
      electrical: [],
      plumbing: plumbingEquipment,
      fireProtection: [],
    });
    mocks.categorizeElement.mockReturnValue({ category: 'mep', subcategory: 'plumbing' });

    const entries = generateBIMIndexEntries(bimData);

    const mepEntry = entries.find(e => e.type === 'mep' && e.metadata.type === 'plumbing');
    expect(mepEntry).toBeDefined();
    expect(mepEntry?.content).toContain('Plumbing Equipment (2 items)');
    expect(mepEntry?.content).toContain('Sink-001');
  });

  it('should generate MEP fire protection entries', () => {
    const bimData = createMockBIMData();
    const fireProtection = [
      createMockElement({ dbId: 40, name: 'Sprinkler-001', category: 'Revit Sprinklers' }),
    ];

    mocks.extractMEPEquipment.mockReturnValue({
      mechanical: [],
      electrical: [],
      plumbing: [],
      fireProtection,
    });
    mocks.categorizeElement.mockReturnValue({ category: 'mep', subcategory: 'fire_protection' });

    const entries = generateBIMIndexEntries(bimData);

    const mepEntry = entries.find(e => e.type === 'mep' && e.metadata.type === 'fire_protection');
    expect(mepEntry).toBeDefined();
    expect(mepEntry?.content).toContain('Fire Protection (1 items)');
    expect(mepEntry?.content).toContain('Sprinkler-001');
  });

  it('should limit MEP equipment names to 20 items', () => {
    const bimData = createMockBIMData();
    const manyItems = Array.from({ length: 30 }, (_, i) =>
      createMockElement({ dbId: i, name: `Item-${i}`, category: 'Revit Mechanical Equipment' })
    );

    mocks.extractMEPEquipment.mockReturnValue({
      mechanical: manyItems,
      electrical: [],
      plumbing: [],
      fireProtection: [],
    });
    mocks.categorizeElement.mockReturnValue({ category: 'mep', subcategory: 'mechanical' });

    const entries = generateBIMIndexEntries(bimData);

    const mepEntry = entries.find(e => e.type === 'mep' && e.metadata.type === 'mechanical');
    expect(mepEntry?.metadata.items.length).toBeLessThanOrEqual(20);
  });

  it('should generate material summary entries', () => {
    const bimData = createMockBIMData({
      elements: [
        createMockElement({ dbId: 1, material: 'Concrete' }),
        createMockElement({ dbId: 2, material: 'Concrete' }),
        createMockElement({ dbId: 3, material: 'Steel' }),
        createMockElement({ dbId: 4, material: 'Steel' }),
        createMockElement({ dbId: 5, material: 'Wood' }),
      ],
    });

    mocks.extractMEPEquipment.mockReturnValue({
      mechanical: [],
      electrical: [],
      plumbing: [],
      fireProtection: [],
    });
    mocks.categorizeElement.mockReturnValue({ category: 'structural', subcategory: 'walls' });

    const entries = generateBIMIndexEntries(bimData);

    const materialEntry = entries.find(e => e.type === 'material');
    expect(materialEntry).toBeDefined();
    expect(materialEntry?.content).toContain('Materials used in BIM model');
    expect(materialEntry?.content).toContain('Concrete (2 elements)');
    expect(materialEntry?.content).toContain('Steel (2 elements)');
    expect(materialEntry?.metadata.materials).toEqual({
      'Concrete': 2,
      'Steel': 2,
      'Wood': 1,
    });
  });

  it('should skip material entry when no materials present', () => {
    const bimData = createMockBIMData({
      elements: [
        createMockElement({ dbId: 1, material: undefined }),
        createMockElement({ dbId: 2, material: undefined }),
      ],
    });

    mocks.extractMEPEquipment.mockReturnValue({
      mechanical: [],
      electrical: [],
      plumbing: [],
      fireProtection: [],
    });
    mocks.categorizeElement.mockReturnValue({ category: 'structural', subcategory: 'walls' });

    const entries = generateBIMIndexEntries(bimData);

    const materialEntry = entries.find(e => e.type === 'material');
    expect(materialEntry).toBeUndefined();
  });

  it('should limit materials to top 15 by count', () => {
    const elements = Array.from({ length: 20 }, (_, i) =>
      createMockElement({ dbId: i, material: `Material-${i}` })
    );
    const bimData = createMockBIMData({ elements });

    mocks.extractMEPEquipment.mockReturnValue({
      mechanical: [],
      electrical: [],
      plumbing: [],
      fireProtection: [],
    });
    mocks.categorizeElement.mockReturnValue({ category: 'structural', subcategory: 'walls' });

    const entries = generateBIMIndexEntries(bimData);

    const materialEntry = entries.find(e => e.type === 'material');
    const materialCount = Object.keys(materialEntry?.metadata.materials || {}).length;
    expect(materialCount).toBeLessThanOrEqual(15);
  });

  it('should generate level/floor summary entries', () => {
    const bimData = createMockBIMData({
      elements: [
        createMockElement({ dbId: 1, level: 'Level 1' }),
        createMockElement({ dbId: 2, level: 'Level 1' }),
        createMockElement({ dbId: 3, level: 'Level 2' }),
      ],
    });

    mocks.extractMEPEquipment.mockReturnValue({
      mechanical: [],
      electrical: [],
      plumbing: [],
      fireProtection: [],
    });
    mocks.categorizeElement.mockReturnValue({ category: 'structural', subcategory: 'walls' });

    const entries = generateBIMIndexEntries(bimData);

    const levelEntry = entries.find(e => e.type === 'level');
    expect(levelEntry).toBeDefined();
    expect(levelEntry?.content).toContain('Building levels in BIM model');
    expect(levelEntry?.content).toContain('Level 1 (2 elements)');
    expect(levelEntry?.content).toContain('Level 2 (1 elements)');
    expect(levelEntry?.metadata.levels).toEqual({
      'Level 1': 2,
      'Level 2': 1,
    });
  });

  it('should skip level entry when no levels present', () => {
    const bimData = createMockBIMData({
      elements: [
        createMockElement({ dbId: 1, level: '' }),
        createMockElement({ dbId: 2, level: undefined }),
      ],
    });

    mocks.extractMEPEquipment.mockReturnValue({
      mechanical: [],
      electrical: [],
      plumbing: [],
      fireProtection: [],
    });
    mocks.categorizeElement.mockReturnValue({ category: 'structural', subcategory: 'walls' });

    const entries = generateBIMIndexEntries(bimData);

    const levelEntry = entries.find(e => e.type === 'level');
    expect(levelEntry).toBeUndefined();
  });

  it('should generate element detail entries grouped by category', () => {
    const bimData = createMockBIMData({
      elements: [
        createMockElement({ dbId: 1, name: 'Wall-Basic', category: 'Revit Walls' }),
        createMockElement({ dbId: 2, name: 'Wall-Basic', category: 'Revit Walls' }),
        createMockElement({ dbId: 3, name: 'Wall-Exterior', category: 'Revit Walls' }),
      ],
    });

    mocks.extractMEPEquipment.mockReturnValue({
      mechanical: [],
      electrical: [],
      plumbing: [],
      fireProtection: [],
    });
    mocks.categorizeElement.mockReturnValue({ category: 'structural', subcategory: 'walls' });

    const entries = generateBIMIndexEntries(bimData);

    const elementEntry = entries.find(e => e.type === 'element');
    expect(elementEntry).toBeDefined();
    expect(elementEntry?.content).toContain('Wall-Basic (2)');
    expect(elementEntry?.content).toContain('Wall-Exterior (1)');
    expect(elementEntry?.metadata.items).toEqual({
      'Wall-Basic': 2,
      'Wall-Exterior': 1,
    });
  });

  it('should limit element details to top 10 items per category', () => {
    const elements = Array.from({ length: 15 }, (_, i) =>
      createMockElement({ dbId: i, name: `Wall-${i}`, category: 'Revit Walls' })
    );
    const bimData = createMockBIMData({ elements });

    mocks.extractMEPEquipment.mockReturnValue({
      mechanical: [],
      electrical: [],
      plumbing: [],
      fireProtection: [],
    });
    mocks.categorizeElement.mockReturnValue({ category: 'structural', subcategory: 'walls' });

    const entries = generateBIMIndexEntries(bimData);

    const elementEntry = entries.find(e => e.type === 'element');
    const itemCount = Object.keys(elementEntry?.metadata.items || {}).length;
    expect(itemCount).toBeLessThanOrEqual(10);
  });

  it('should handle empty BIM data gracefully', () => {
    const bimData = createMockBIMData({
      totalElements: 0,
      categories: {},
      elements: [],
      summary: { structural: 0, mep: 0, architectural: 0, site: 0, other: 0 },
    });

    mocks.extractMEPEquipment.mockReturnValue({
      mechanical: [],
      electrical: [],
      plumbing: [],
      fireProtection: [],
    });

    const entries = generateBIMIndexEntries(bimData);

    // Should still have summary entry
    const summaryEntry = entries.find(e => e.content.includes('BIM Model Summary'));
    expect(summaryEntry).toBeDefined();
    expect(summaryEntry?.content).toContain('0 total elements');
  });

  it('should capitalize category names in element entries', () => {
    const bimData = createMockBIMData();

    mocks.extractMEPEquipment.mockReturnValue({
      mechanical: [],
      electrical: [],
      plumbing: [],
      fireProtection: [],
    });
    mocks.categorizeElement.mockReturnValue({ category: 'structural', subcategory: 'walls' });

    const entries = generateBIMIndexEntries(bimData);

    const elementEntry = entries.find(e => e.type === 'element');
    expect(elementEntry?.content).toMatch(/^[A-Z]/); // Should start with capital letter
  });
});

// ============================================
// Tests for indexBIMForRAG
// ============================================

describe('BIM RAG Indexer - indexBIMForRAG', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.extractMEPEquipment.mockReturnValue({
      mechanical: [],
      electrical: [],
      plumbing: [],
      fireProtection: [],
    });
    mocks.categorizeElement.mockReturnValue({ category: 'structural', subcategory: 'walls' });
  });

  it('should throw error if model not found', async () => {
    mocks.prisma.autodeskModel.findUnique.mockResolvedValue(null);

    const bimData = createMockBIMData();

    await expect(
      indexBIMForRAG('project-1', 'model-1', bimData)
    ).rejects.toThrow('Model not found');
  });

  it('should create new document if BIM document does not exist', async () => {
    const mockModel = {
      id: 'model-1',
      fileName: 'test-model.rvt',
      objectKey: 's3://bucket/key',
      fileSize: 1024000,
      metadata: {},
    };

    mocks.prisma.autodeskModel.findUnique.mockResolvedValue(mockModel);
    mocks.prisma.document.findFirst.mockResolvedValue(null);
    mocks.prisma.document.create.mockResolvedValue({
      id: 'doc-1',
      projectId: 'project-1',
      name: 'BIM:model-1',
    });
    mocks.prisma.documentChunk.createMany.mockResolvedValue({ count: 5 });
    mocks.prisma.autodeskModel.update.mockResolvedValue(mockModel);

    const bimData = createMockBIMData();
    const result = await indexBIMForRAG('project-1', 'model-1', bimData);

    expect(mocks.prisma.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'project-1',
        name: 'BIM:model-1',
        fileName: 'test-model.rvt',
        fileType: 'bim',
        processed: true,
        category: 'plans_drawings',
        accessLevel: 'admin',
      }),
    });
    expect(result).toBeGreaterThan(0);
  });

  it('should delete existing chunks if BIM document exists', async () => {
    const mockModel = {
      id: 'model-1',
      fileName: 'test-model.rvt',
      objectKey: 's3://bucket/key',
      fileSize: 1024000,
      metadata: {},
    };

    const existingDoc = {
      id: 'doc-1',
      projectId: 'project-1',
      name: 'BIM:model-1',
    };

    mocks.prisma.autodeskModel.findUnique.mockResolvedValue(mockModel);
    mocks.prisma.document.findFirst.mockResolvedValue(existingDoc);
    mocks.prisma.documentChunk.deleteMany.mockResolvedValue({ count: 10 });
    mocks.prisma.documentChunk.createMany.mockResolvedValue({ count: 5 });
    mocks.prisma.autodeskModel.update.mockResolvedValue(mockModel);

    const bimData = createMockBIMData();
    await indexBIMForRAG('project-1', 'model-1', bimData);

    expect(mocks.prisma.documentChunk.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'doc-1' },
    });
  });

  it('should create document chunks from index entries', async () => {
    const mockModel = {
      id: 'model-1',
      fileName: 'test-model.rvt',
      objectKey: 's3://bucket/key',
      fileSize: 1024000,
      metadata: {},
    };

    const existingDoc = {
      id: 'doc-1',
      projectId: 'project-1',
      name: 'BIM:model-1',
    };

    mocks.prisma.autodeskModel.findUnique.mockResolvedValue(mockModel);
    mocks.prisma.document.findFirst.mockResolvedValue(existingDoc);
    mocks.prisma.documentChunk.deleteMany.mockResolvedValue({ count: 0 });
    mocks.prisma.documentChunk.createMany.mockResolvedValue({ count: 5 });
    mocks.prisma.autodeskModel.update.mockResolvedValue(mockModel);

    const bimData = createMockBIMData();
    await indexBIMForRAG('project-1', 'model-1', bimData);

    expect(mocks.prisma.documentChunk.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          documentId: 'doc-1',
          content: expect.any(String),
          chunkIndex: expect.any(Number),
          metadata: expect.any(Object),
        }),
      ]),
    });
  });

  it('should update model metadata with RAG index info', async () => {
    const mockModel = {
      id: 'model-1',
      fileName: 'test-model.rvt',
      objectKey: 's3://bucket/key',
      fileSize: 1024000,
      metadata: { existingField: 'value' },
    };

    const existingDoc = {
      id: 'doc-1',
      projectId: 'project-1',
      name: 'BIM:model-1',
    };

    mocks.prisma.autodeskModel.findUnique.mockResolvedValue(mockModel);
    mocks.prisma.document.findFirst.mockResolvedValue(existingDoc);
    mocks.prisma.documentChunk.deleteMany.mockResolvedValue({ count: 0 });
    mocks.prisma.documentChunk.createMany.mockResolvedValue({ count: 5 });
    mocks.prisma.autodeskModel.update.mockResolvedValue(mockModel);

    const bimData = createMockBIMData();
    await indexBIMForRAG('project-1', 'model-1', bimData);

    expect(mocks.prisma.autodeskModel.update).toHaveBeenCalledWith({
      where: { id: 'model-1' },
      data: {
        metadata: expect.objectContaining({
          existingField: 'value',
          ragIndexed: true,
          ragIndexedAt: expect.any(String),
          ragChunkCount: expect.any(Number),
        }),
      },
    });
  });

  it('should return count of indexed chunks', async () => {
    const mockModel = {
      id: 'model-1',
      fileName: 'test-model.rvt',
      objectKey: 's3://bucket/key',
      fileSize: 1024000,
      metadata: {},
    };

    const existingDoc = {
      id: 'doc-1',
      projectId: 'project-1',
      name: 'BIM:model-1',
    };

    mocks.prisma.autodeskModel.findUnique.mockResolvedValue(mockModel);
    mocks.prisma.document.findFirst.mockResolvedValue(existingDoc);
    mocks.prisma.documentChunk.deleteMany.mockResolvedValue({ count: 0 });
    mocks.prisma.documentChunk.createMany.mockResolvedValue({ count: 7 });
    mocks.prisma.autodeskModel.update.mockResolvedValue(mockModel);

    const bimData = createMockBIMData();
    const result = await indexBIMForRAG('project-1', 'model-1', bimData);

    expect(result).toBeGreaterThan(0);
    expect(typeof result).toBe('number');
  });

  it('should include model description with total elements', async () => {
    const mockModel = {
      id: 'model-1',
      fileName: 'test-model.rvt',
      objectKey: 's3://bucket/key',
      fileSize: 1024000,
      metadata: {},
    };

    mocks.prisma.autodeskModel.findUnique.mockResolvedValue(mockModel);
    mocks.prisma.document.findFirst.mockResolvedValue(null);
    mocks.prisma.document.create.mockResolvedValue({
      id: 'doc-1',
      projectId: 'project-1',
      name: 'BIM:model-1',
    });
    mocks.prisma.documentChunk.createMany.mockResolvedValue({ count: 5 });
    mocks.prisma.autodeskModel.update.mockResolvedValue(mockModel);

    const bimData = createMockBIMData({ totalElements: 250 });
    await indexBIMForRAG('project-1', 'model-1', bimData);

    expect(mocks.prisma.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: expect.stringContaining('250'),
      }),
    });
  });

  it('should tag document with bim, autodesk, and 3d-model tags', async () => {
    const mockModel = {
      id: 'model-1',
      fileName: 'test-model.rvt',
      objectKey: 's3://bucket/key',
      fileSize: 1024000,
      metadata: {},
    };

    mocks.prisma.autodeskModel.findUnique.mockResolvedValue(mockModel);
    mocks.prisma.document.findFirst.mockResolvedValue(null);
    mocks.prisma.document.create.mockResolvedValue({
      id: 'doc-1',
      projectId: 'project-1',
      name: 'BIM:model-1',
    });
    mocks.prisma.documentChunk.createMany.mockResolvedValue({ count: 5 });
    mocks.prisma.autodeskModel.update.mockResolvedValue(mockModel);

    const bimData = createMockBIMData();
    await indexBIMForRAG('project-1', 'model-1', bimData);

    expect(mocks.prisma.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tags: ['bim', 'autodesk', '3d-model'],
      }),
    });
  });
});

// ============================================
// Tests for getBIMContext
// ============================================

describe('BIM RAG Indexer - getBIMContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null for queries without BIM or DWG keywords', async () => {
    const result = await getBIMContext('project-1', 'what is the weather today?');
    expect(result).toBeNull();
  });

  it('should detect BIM-relevant keywords', async () => {
    mocks.prisma.document.findMany.mockResolvedValue([{ id: 'doc-1' }]);
    mocks.prisma.documentChunk.findMany.mockResolvedValue([
      { id: 'chunk-1', content: 'BIM model summary with mechanical equipment', chunkIndex: 0 },
    ]);

    const result = await getBIMContext('project-1', 'show me the MEP equipment');

    expect(result).not.toBeNull();
    expect(mocks.prisma.document.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        projectId: 'project-1',
        name: { startsWith: 'BIM:' },
      }),
      select: { id: true },
    });
  });

  it('should retrieve BIM chunks when query matches BIM keywords', async () => {
    mocks.prisma.document.findMany.mockResolvedValue([{ id: 'doc-1' }]);
    mocks.prisma.documentChunk.findMany.mockResolvedValue([
      { id: 'chunk-1', content: 'BIM Model Summary: 100 total elements', chunkIndex: 0 },
      { id: 'chunk-2', content: 'Mechanical equipment includes HVAC units', chunkIndex: 1 },
    ]);

    const result = await getBIMContext('project-1', 'what mechanical systems are in the model?');

    expect(result).toContain('=== BIM MODEL DATA (3D) ===');
    expect(result).toContain('BIM Model Summary');
    expect(result).toContain('Mechanical equipment');
  });

  it('should limit BIM chunks to 8 results', async () => {
    const manyChunks = Array.from({ length: 20 }, (_, i) => ({
      id: `chunk-${i}`,
      content: `summary chunk ${i}`,
      chunkIndex: i,
    }));

    mocks.prisma.document.findMany.mockResolvedValue([{ id: 'doc-1' }]);
    mocks.prisma.documentChunk.findMany.mockResolvedValue(manyChunks);

    const result = await getBIMContext('project-1', 'show me the BIM model');

    const chunkMatches = result?.match(/summary chunk/g) || [];
    expect(chunkMatches.length).toBeLessThanOrEqual(8);
  });

  it('should prioritize chunks containing summary keyword', async () => {
    mocks.prisma.document.findMany.mockResolvedValue([{ id: 'doc-1' }]);
    mocks.prisma.documentChunk.findMany.mockResolvedValue([
      { id: 'chunk-1', content: 'Regular chunk with walls', chunkIndex: 0 },
      { id: 'chunk-2', content: 'BIM Model Summary with key information', chunkIndex: 1 },
    ]);

    const result = await getBIMContext('project-1', 'tell me about the model');

    expect(result).toContain('Summary');
  });

  it('should filter chunks by query keywords', async () => {
    mocks.prisma.document.findMany.mockResolvedValue([{ id: 'doc-1' }]);
    mocks.prisma.documentChunk.findMany.mockResolvedValue([
      { id: 'chunk-1', content: 'Plumbing fixtures and pipes', chunkIndex: 0 },
      { id: 'chunk-2', content: 'Electrical panels and conduits', chunkIndex: 1 },
    ]);

    const result = await getBIMContext('project-1', 'what plumbing fixtures are there?');

    expect(result).toContain('Plumbing');
  });

  it('should detect DWG-relevant keywords', async () => {
    mocks.prisma.autodeskModel.findMany.mockResolvedValue([
      {
        fileName: 'site-plan.dwg',
        extractedMetadata: {
          summary: { totalLayers: 10, totalBlocks: 5, totalAnnotations: 20 },
        },
      },
    ]);

    const result = await getBIMContext('project-1', 'show me the DWG layers');

    expect(result).not.toBeNull();
    expect(result).toContain('=== DWG DRAWING DATA (2D) ===');
  });

  it('should retrieve DWG metadata when query matches DWG keywords', async () => {
    mocks.prisma.autodeskModel.findMany.mockResolvedValue([
      {
        fileName: 'civil-plan.dwg',
        extractedMetadata: {
          summary: { totalLayers: 15, totalBlocks: 8, totalAnnotations: 25 },
          layerCategories: { 'Civil': 10, 'Site': 5 },
        },
      },
    ]);

    const result = await getBIMContext('project-1', 'what civil drawings do we have?');

    expect(result).toContain('DWG Drawing: civil-plan.dwg');
    expect(result).toContain('Layers: 15');
    expect(result).toContain('Blocks: 8');
  });

  it('should use searchChunks from DWG metadata when available', async () => {
    mocks.prisma.autodeskModel.findMany.mockResolvedValue([
      {
        fileName: 'site.dwg',
        extractedMetadata: {
          searchChunks: [
            'DWG layer: Site grading and utilities',
            'DWG layer: Storm drainage system',
          ],
          summary: { totalLayers: 10 },
        },
      },
    ]);

    const result = await getBIMContext('project-1', 'what layers are in the site drawing?');

    expect(result).toContain('Site grading');
    expect(result).toContain('Storm drainage');
  });

  it('should limit DWG searchChunks to 4 per model', async () => {
    const manyChunks = Array.from({ length: 10 }, (_, i) => `DWG chunk ${i}`);

    mocks.prisma.autodeskModel.findMany.mockResolvedValue([
      {
        fileName: 'site.dwg',
        extractedMetadata: {
          searchChunks: manyChunks,
        },
      },
    ]);

    const result = await getBIMContext('project-1', 'show me the dwg drawing');

    const chunkMatches = result?.match(/DWG chunk/g) || [];
    expect(chunkMatches.length).toBeLessThanOrEqual(4);
  });

  it('should limit overall DWG context to 8 chunks', async () => {
    const manyChunks = Array.from({ length: 20 }, (_, i) => `DWG layer info ${i}`);

    mocks.prisma.autodeskModel.findMany.mockResolvedValue([
      {
        fileName: 'site.dwg',
        extractedMetadata: { searchChunks: manyChunks },
      },
    ]);

    const result = await getBIMContext('project-1', 'show me DWG layers');

    const lines = result?.split('\n').filter(l => l.includes('DWG layer')) || [];
    expect(lines.length).toBeLessThanOrEqual(8);
  });

  it('should include layer categories when no search chunks match', async () => {
    mocks.prisma.autodeskModel.findMany.mockResolvedValue([
      {
        fileName: 'arch.dwg',
        extractedMetadata: {
          summary: { totalLayers: 12, totalBlocks: 6, totalAnnotations: 18 },
          layerCategories: { 'Architectural': 8, 'Structural': 4 },
        },
      },
    ]);

    const result = await getBIMContext('project-1', 'show me the drawing');

    expect(result).toContain('Layer categories');
    expect(result).toContain('Architectural: 8');
    expect(result).toContain('Structural: 4');
  });

  it('should combine BIM and DWG context when both are relevant', async () => {
    mocks.prisma.document.findMany.mockResolvedValue([{ id: 'doc-1' }]);
    mocks.prisma.documentChunk.findMany.mockResolvedValue([
      { id: 'chunk-1', content: 'BIM model summary', chunkIndex: 0 },
    ]);
    mocks.prisma.autodeskModel.findMany.mockResolvedValue([
      {
        fileName: 'site.dwg',
        extractedMetadata: {
          summary: { totalLayers: 10, totalBlocks: 5, totalAnnotations: 15 },
        },
      },
    ]);

    const result = await getBIMContext('project-1', 'show me the 3D model and 2D drawings');

    expect(result).toContain('=== BIM MODEL DATA (3D) ===');
    expect(result).toContain('=== DWG DRAWING DATA (2D) ===');
  });

  it('should return null when no BIM or DWG documents exist', async () => {
    mocks.prisma.document.findMany.mockResolvedValue([]);
    mocks.prisma.autodeskModel.findMany.mockResolvedValue([]);

    const result = await getBIMContext('project-1', 'show me the BIM model');

    expect(result).toBeNull();
  });

  it('should return null when documents exist but have no relevant chunks', async () => {
    mocks.prisma.document.findMany.mockResolvedValue([{ id: 'doc-1' }]);
    mocks.prisma.documentChunk.findMany.mockResolvedValue([]);

    const result = await getBIMContext('project-1', 'show me the MEP systems');

    expect(result).toBeNull();
  });

  it('should handle queries with multiple BIM keywords', async () => {
    mocks.prisma.document.findMany.mockResolvedValue([{ id: 'doc-1' }]);
    mocks.prisma.documentChunk.findMany.mockResolvedValue([
      { id: 'chunk-1', content: 'Mechanical HVAC ductwork and equipment', chunkIndex: 0 },
    ]);

    const result = await getBIMContext('project-1', 'show me HVAC ductwork and MEP equipment');

    expect(result).not.toBeNull();
    expect(result).toContain('Mechanical HVAC');
  });

  it('should be case-insensitive for keyword matching', async () => {
    mocks.prisma.document.findMany.mockResolvedValue([{ id: 'doc-1' }]);
    mocks.prisma.documentChunk.findMany.mockResolvedValue([
      { id: 'chunk-1', content: 'BIM model summary', chunkIndex: 0 },
    ]);

    const result = await getBIMContext('project-1', 'Show Me The BIM MODEL');

    expect(result).not.toBeNull();
  });

  it('should skip query words shorter than 3 characters for filtering', async () => {
    mocks.prisma.document.findMany.mockResolvedValue([{ id: 'doc-1' }]);
    mocks.prisma.documentChunk.findMany.mockResolvedValue([
      { id: 'chunk-1', content: 'BIM model summary with walls', chunkIndex: 0 },
    ]);

    const result = await getBIMContext('project-1', 'show me BIM in 3D');

    expect(result).not.toBeNull();
  });

  it('should limit DWG models to 5 results', async () => {
    const manyModels = Array.from({ length: 10 }, (_, i) => ({
      fileName: `drawing-${i}.dwg`,
      extractedMetadata: {
        summary: { totalLayers: 10, totalBlocks: 5, totalAnnotations: 15 },
      },
    }));

    mocks.prisma.autodeskModel.findMany.mockResolvedValue(manyModels);

    const result = await getBIMContext('project-1', 'show me DWG files');

    // Should query with take: 5
    expect(mocks.prisma.autodeskModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
      })
    );
  });

  it('should only query for 2D DWG models', async () => {
    mocks.prisma.autodeskModel.findMany.mockResolvedValue([]);

    await getBIMContext('project-1', 'show me drawings');

    expect(mocks.prisma.autodeskModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          is2D: true,
        }),
      })
    );
  });

  it('should filter DWG models by extractedMetadata not null', async () => {
    mocks.prisma.autodeskModel.findMany.mockResolvedValue([]);

    await getBIMContext('project-1', 'show me CAD drawings');

    expect(mocks.prisma.autodeskModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          extractedMetadata: { not: null },
        }),
      })
    );
  });
});
