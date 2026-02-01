import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mocks Setup - vi.hoisted for all mock objects
// ============================================

const mocks = vi.hoisted(() => ({
  prisma: {
    document: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    documentChunk: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
    materialTakeoff: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    takeoffLineItem: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
  },
  callAbacusLLM: vi.fn(),
  extractSiteworkTakeoff: vi.fn(),
  classifyDrawingType: vi.fn(),
  extractGeotechData: vi.fn(),
  normalizeSiteworkUnit: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }));

vi.mock('@/lib/abacus-llm', () => ({
  callAbacusLLM: mocks.callAbacusLLM,
}));

vi.mock('@/lib/sitework-takeoff-extractor', () => ({
  extractSiteworkTakeoff: mocks.extractSiteworkTakeoff,
  classifyDrawingType: mocks.classifyDrawingType,
  extractGeotechData: mocks.extractGeotechData,
  normalizeUnit: mocks.normalizeSiteworkUnit,
}));

// Import functions after mocks
import {
  extractQuantitiesFromDocument,
  extractQuantitiesWithAI,
  autoExtractTakeoffs,
} from '@/lib/takeoff-extractor';

// ============================================
// Test Helpers
// ============================================

function createMockDocument(overrides = {}) {
  return {
    id: 'doc-1',
    name: 'Foundation Plan',
    fileName: 'foundation-plan.pdf',
    fileType: 'pdf',
    projectId: 'project-1',
    processed: true,
    ...overrides,
  };
}

function createMockChunk(pageNumber: number, overrides = {}) {
  return {
    id: `chunk-${pageNumber}`,
    documentId: 'doc-1',
    pageNumber,
    content: 'Test content',
    metadata: {},
    ...overrides,
  };
}

function createMockTakeoff(overrides = {}) {
  return {
    id: 'takeoff-1',
    name: 'Test Takeoff',
    projectId: 'project-1',
    documentId: 'doc-1',
    createdBy: 'user-1',
    extractedBy: 'vision_ocr',
    extractedAt: new Date(),
    status: 'draft',
    ...overrides,
  };
}

// ============================================
// extractQuantitiesFromDocument Tests
// ============================================

describe('extractQuantitiesFromDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('should successfully extract quantities from a PDF document', async () => {
      const mockDoc = createMockDocument();
      const mockChunks = [
        createMockChunk(1, {
          metadata: {
            labeled_dimensions: ['100\' x 50\'', '4" thick'],
            notes: ['25 CY Concrete', '100 EA Anchor Bolts'],
          },
        }),
      ];
      const mockTakeoff = createMockTakeoff();

      mocks.prisma.document.findUnique.mockResolvedValue(mockDoc);
      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);
      mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
      mocks.prisma.takeoffLineItem.create.mockResolvedValue({ id: 'line-1' });
      mocks.prisma.materialTakeoff.update.mockResolvedValue(mockTakeoff);

      const result = await extractQuantitiesFromDocument('doc-1', 'project-1', 'user-1');

      expect(result.takeoffId).toBe('takeoff-1');
      expect(result.documentId).toBe('doc-1');
      expect(result.totalItems).toBeGreaterThan(0);
      expect(result.pagesProcessed).toBe(1);
      expect(mocks.prisma.materialTakeoff.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'project-1',
            createdBy: 'user-1',
            documentId: 'doc-1',
            extractedBy: 'vision_ocr',
            status: 'draft',
          }),
        })
      );
    });

    it('should use custom takeoff name when provided', async () => {
      const mockDoc = createMockDocument();
      const mockChunks = [createMockChunk(1)];
      const mockTakeoff = createMockTakeoff({ name: 'Custom Takeoff Name' });

      mocks.prisma.document.findUnique.mockResolvedValue(mockDoc);
      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);
      mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
      mocks.prisma.materialTakeoff.update.mockResolvedValue(mockTakeoff);

      await extractQuantitiesFromDocument('doc-1', 'project-1', 'user-1', 'Custom Takeoff Name');

      expect(mocks.prisma.materialTakeoff.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Custom Takeoff Name',
          }),
        })
      );
    });

    it('should process multiple pages with different categories', async () => {
      const mockDoc = createMockDocument();
      const mockChunks = [
        createMockChunk(1, {
          content: 'concrete slab',
          metadata: {
            labeled_dimensions: ['50\' x 40\''],
          },
        }),
        createMockChunk(2, {
          content: 'steel rebar',
          metadata: {
            structuralCallouts: ['#4 @ 12" O.C.'],
          },
        }),
        createMockChunk(3, {
          content: 'lumber framing',
          metadata: {
            notes: ['500 LF 2x4'],
          },
        }),
      ];
      const mockTakeoff = createMockTakeoff();

      mocks.prisma.document.findUnique.mockResolvedValue(mockDoc);
      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);
      mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
      mocks.prisma.takeoffLineItem.create.mockResolvedValue({ id: 'line-1' });
      mocks.prisma.materialTakeoff.update.mockResolvedValue(mockTakeoff);

      const result = await extractQuantitiesFromDocument('doc-1', 'project-1', 'user-1');

      expect(result.pagesProcessed).toBe(3);
      expect(mocks.prisma.takeoffLineItem.create).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should throw error if document not found', async () => {
      mocks.prisma.document.findUnique.mockResolvedValue(null);

      await expect(
        extractQuantitiesFromDocument('nonexistent-doc', 'project-1', 'user-1')
      ).rejects.toThrow('Document not found');
    });

    it('should throw error for non-PDF documents', async () => {
      const mockDoc = createMockDocument({ fileType: 'docx' });
      mocks.prisma.document.findUnique.mockResolvedValue(mockDoc);

      await expect(
        extractQuantitiesFromDocument('doc-1', 'project-1', 'user-1')
      ).rejects.toThrow('Only PDF documents are supported for quantity extraction');
    });

    it('should throw error if document has not been processed for OCR', async () => {
      const mockDoc = createMockDocument();
      mocks.prisma.document.findUnique.mockResolvedValue(mockDoc);
      mocks.prisma.documentChunk.findMany.mockResolvedValue([]);

      await expect(
        extractQuantitiesFromDocument('doc-1', 'project-1', 'user-1')
      ).rejects.toThrow('Document has not been processed for OCR yet');
    });

    it('should handle database errors gracefully', async () => {
      const mockDoc = createMockDocument();
      mocks.prisma.document.findUnique.mockResolvedValue(mockDoc);
      mocks.prisma.documentChunk.findMany.mockRejectedValue(new Error('Database connection lost'));

      await expect(
        extractQuantitiesFromDocument('doc-1', 'project-1', 'user-1')
      ).rejects.toThrow('Database connection lost');
    });
  });

  describe('Dimension Parsing', () => {
    it('should parse area dimensions correctly', async () => {
      const mockDoc = createMockDocument();
      const mockChunks = [
        createMockChunk(1, {
          metadata: {
            labeled_dimensions: ['100\' x 50\''],
          },
        }),
      ];
      const mockTakeoff = createMockTakeoff();

      mocks.prisma.document.findUnique.mockResolvedValue(mockDoc);
      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);
      mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
      mocks.prisma.takeoffLineItem.create.mockResolvedValue({ id: 'line-1' });
      mocks.prisma.materialTakeoff.update.mockResolvedValue(mockTakeoff);

      const result = await extractQuantitiesFromDocument('doc-1', 'project-1', 'user-1');

      expect(result.totalItems).toBeGreaterThan(0);
      expect(mocks.prisma.takeoffLineItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unit: 'SF',
            quantity: expect.any(Number),
          }),
        })
      );
    });

    it('should parse volume dimensions with thickness', async () => {
      const mockDoc = createMockDocument();
      const mockChunks = [
        createMockChunk(1, {
          metadata: {
            labeled_dimensions: ['50\' x 40\' x 4" thick'],
          },
        }),
      ];
      const mockTakeoff = createMockTakeoff();

      mocks.prisma.document.findUnique.mockResolvedValue(mockDoc);
      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);
      mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
      mocks.prisma.takeoffLineItem.create.mockResolvedValue({ id: 'line-1' });
      mocks.prisma.materialTakeoff.update.mockResolvedValue(mockTakeoff);

      await extractQuantitiesFromDocument('doc-1', 'project-1', 'user-1');

      // Should create CY item for concrete volume
      expect(mocks.prisma.takeoffLineItem.create).toHaveBeenCalled();
    });
  });

  describe('Note Parsing', () => {
    it('should extract quantities from notes', async () => {
      const mockDoc = createMockDocument();
      const mockChunks = [
        createMockChunk(1, {
          metadata: {
            notes: ['100 EA Anchor Bolts', '500 LF Conduit', '25 CY Concrete'],
          },
        }),
      ];
      const mockTakeoff = createMockTakeoff();

      mocks.prisma.document.findUnique.mockResolvedValue(mockDoc);
      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);
      mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
      mocks.prisma.takeoffLineItem.create.mockResolvedValue({ id: 'line-1' });
      mocks.prisma.materialTakeoff.update.mockResolvedValue(mockTakeoff);

      const result = await extractQuantitiesFromDocument('doc-1', 'project-1', 'user-1');

      expect(result.totalItems).toBe(3);
      expect(mocks.prisma.takeoffLineItem.create).toHaveBeenCalledTimes(3);
    });

    it('should ignore notes without valid quantity patterns', async () => {
      const mockDoc = createMockDocument();
      const mockChunks = [
        createMockChunk(1, {
          metadata: {
            notes: ['See structural drawings', 'Refer to spec section 03 30 00'],
          },
        }),
      ];
      const mockTakeoff = createMockTakeoff();

      mocks.prisma.document.findUnique.mockResolvedValue(mockDoc);
      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);
      mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
      mocks.prisma.materialTakeoff.update.mockResolvedValue(mockTakeoff);

      const result = await extractQuantitiesFromDocument('doc-1', 'project-1', 'user-1');

      expect(result.totalItems).toBe(0);
    });
  });

  describe('Callout Parsing', () => {
    it('should parse rebar callouts', async () => {
      const mockDoc = createMockDocument();
      const mockChunks = [
        createMockChunk(1, {
          metadata: {
            structuralCallouts: ['#4 @ 12" O.C.', '#5 @ 18" O.C.'],
          },
        }),
      ];
      const mockTakeoff = createMockTakeoff();

      mocks.prisma.document.findUnique.mockResolvedValue(mockDoc);
      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);
      mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
      mocks.prisma.takeoffLineItem.create.mockResolvedValue({ id: 'line-1' });
      mocks.prisma.materialTakeoff.update.mockResolvedValue(mockTakeoff);

      const result = await extractQuantitiesFromDocument('doc-1', 'project-1', 'user-1');

      expect(result.totalItems).toBe(2);
      expect(mocks.prisma.takeoffLineItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            itemName: expect.stringContaining('Rebar'),
            unit: 'TON',
          }),
        })
      );
    });

    it('should parse lumber callouts', async () => {
      const mockDoc = createMockDocument();
      const mockChunks = [
        createMockChunk(1, {
          metadata: {
            structuralCallouts: ['2x6 @ 16" O.C.', '2x10 @ 24" O.C.'],
          },
        }),
      ];
      const mockTakeoff = createMockTakeoff();

      mocks.prisma.document.findUnique.mockResolvedValue(mockDoc);
      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);
      mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
      mocks.prisma.takeoffLineItem.create.mockResolvedValue({ id: 'line-1' });
      mocks.prisma.materialTakeoff.update.mockResolvedValue(mockTakeoff);

      const result = await extractQuantitiesFromDocument('doc-1', 'project-1', 'user-1');

      expect(result.totalItems).toBe(2);
      expect(mocks.prisma.takeoffLineItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unit: 'LF',
          }),
        })
      );
    });

    it('should parse MEP pipe callouts', async () => {
      const mockDoc = createMockDocument();
      const mockChunks = [
        createMockChunk(1, {
          metadata: {
            mepCallouts: ['3/4" PVC', '2" Copper', '1" Conduit'],
          },
        }),
      ];
      const mockTakeoff = createMockTakeoff();

      mocks.prisma.document.findUnique.mockResolvedValue(mockDoc);
      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);
      mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
      mocks.prisma.takeoffLineItem.create.mockResolvedValue({ id: 'line-1' });
      mocks.prisma.materialTakeoff.update.mockResolvedValue(mockTakeoff);

      const result = await extractQuantitiesFromDocument('doc-1', 'project-1', 'user-1');

      expect(result.totalItems).toBe(3);
      expect(mocks.prisma.takeoffLineItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unit: 'LF',
            itemName: expect.stringMatching(/PVC|Copper|Conduit/),
          }),
        })
      );
    });
  });

  describe('Category Detection', () => {
    it('should detect concrete category from content', async () => {
      const mockDoc = createMockDocument();
      const mockChunks = [
        createMockChunk(1, {
          content: 'Concrete footing 3\' x 3\' x 12" depth',
          metadata: {
            labeled_dimensions: ['3\' x 3\''],
          },
        }),
      ];
      const mockTakeoff = createMockTakeoff();

      mocks.prisma.document.findUnique.mockResolvedValue(mockDoc);
      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);
      mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
      mocks.prisma.takeoffLineItem.create.mockResolvedValue({ id: 'line-1' });
      mocks.prisma.materialTakeoff.update.mockResolvedValue(mockTakeoff);

      await extractQuantitiesFromDocument('doc-1', 'project-1', 'user-1');

      expect(mocks.prisma.takeoffLineItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: 'concrete',
          }),
        })
      );
    });

    it('should detect steel category from content', async () => {
      const mockDoc = createMockDocument();
      const mockChunks = [
        createMockChunk(1, {
          content: 'W12x45 steel beam',
          metadata: {
            notes: ['10 EA W-shape beams'],
          },
        }),
      ];
      const mockTakeoff = createMockTakeoff();

      mocks.prisma.document.findUnique.mockResolvedValue(mockDoc);
      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);
      mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
      mocks.prisma.takeoffLineItem.create.mockResolvedValue({ id: 'line-1' });
      mocks.prisma.materialTakeoff.update.mockResolvedValue(mockTakeoff);

      await extractQuantitiesFromDocument('doc-1', 'project-1', 'user-1');

      expect(mocks.prisma.takeoffLineItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: 'steel',
          }),
        })
      );
    });

    it('should detect earthwork category from content', async () => {
      const mockDoc = createMockDocument();
      const mockChunks = [
        createMockChunk(1, {
          content: 'Excavation and backfill operations',
          metadata: {
            notes: ['1000 CY excavation'],
          },
        }),
      ];
      const mockTakeoff = createMockTakeoff();

      mocks.prisma.document.findUnique.mockResolvedValue(mockDoc);
      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);
      mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
      mocks.prisma.takeoffLineItem.create.mockResolvedValue({ id: 'line-1' });
      mocks.prisma.materialTakeoff.update.mockResolvedValue(mockTakeoff);

      await extractQuantitiesFromDocument('doc-1', 'project-1', 'user-1');

      expect(mocks.prisma.takeoffLineItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: 'earthwork',
          }),
        })
      );
    });

    it('should default to general category when no specific category detected', async () => {
      const mockDoc = createMockDocument();
      const mockChunks = [
        createMockChunk(1, {
          content: 'Miscellaneous items',
          metadata: {
            notes: ['100 EA Miscellaneous'],
          },
        }),
      ];
      const mockTakeoff = createMockTakeoff();

      mocks.prisma.document.findUnique.mockResolvedValue(mockDoc);
      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);
      mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
      mocks.prisma.takeoffLineItem.create.mockResolvedValue({ id: 'line-1' });
      mocks.prisma.materialTakeoff.update.mockResolvedValue(mockTakeoff);

      await extractQuantitiesFromDocument('doc-1', 'project-1', 'user-1');

      expect(mocks.prisma.takeoffLineItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: 'general',
          }),
        })
      );
    });
  });
});

// ============================================
// extractQuantitiesWithAI Tests
// ============================================

describe('extractQuantitiesWithAI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('should extract quantities using AI from document chunks', async () => {
      const mockChunks = [
        createMockChunk(1, {
          content: 'Foundation plan showing 10 footings at 3\' x 3\' x 12" depth',
          metadata: {
            scale: '1/4" = 1\'-0"',
            sheet_number: 'S-101',
          },
        }),
      ];

      const aiResponse = JSON.stringify([
        {
          itemName: 'Concrete Spread Footings',
          category: 'concrete',
          quantity: 3.7,
          unit: 'CY',
          location: 'Building Foundation',
          sheetNumber: 'S-101',
          calculationMethod: '10 footings x 3\' x 3\' x 1\' / 27 = 3.7 CY',
          confidence: 90,
          extractedFrom: 'Foundation Plan',
        },
      ]);

      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);
      mocks.prisma.documentChunk.findFirst.mockResolvedValue({
        metadata: { scale: '1/4" = 1\'-0"' },
      });
      mocks.callAbacusLLM.mockResolvedValue({
        content: aiResponse,
        model: 'claude-sonnet-4-20250514',
      });

      const result = await extractQuantitiesWithAI('project-1', 'doc-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        itemName: 'Concrete Spread Footings',
        category: 'concrete',
        quantity: 3.7,
        unit: 'CY',
      });
      expect(mocks.callAbacusLLM).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }),
        ]),
        expect.objectContaining({
          model: 'claude-sonnet-4-20250514',
          temperature: 0.1,
          max_tokens: 4000,
        })
      );
    });

    it('should handle multiple pages with different materials', async () => {
      const mockChunks = [
        createMockChunk(1, {
          content: 'Concrete slab 100\' x 50\' x 4"',
          metadata: { sheet_number: 'S-101' },
        }),
        createMockChunk(2, {
          content: 'Steel columns W12x45',
          metadata: { sheet_number: 'S-201' },
        }),
      ];

      const aiResponse = JSON.stringify([
        {
          itemName: 'Concrete Slab',
          category: 'concrete',
          quantity: 61.7,
          unit: 'CY',
          sheetNumber: 'S-101',
          confidence: 95,
        },
        {
          itemName: 'Steel Columns W12x45',
          category: 'steel',
          quantity: 12,
          unit: 'EA',
          sheetNumber: 'S-201',
          confidence: 90,
        },
      ]);

      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);
      mocks.prisma.documentChunk.findFirst.mockResolvedValue(null);
      mocks.callAbacusLLM.mockResolvedValue({
        content: aiResponse,
        model: 'claude-sonnet-4-20250514',
      });

      const result = await extractQuantitiesWithAI('project-1', 'doc-1');

      expect(result).toHaveLength(2);
      expect(result[0].category).toBe('concrete');
      expect(result[1].category).toBe('steel');
    });

    it('should include scale information in prompt when available', async () => {
      const mockChunks = [createMockChunk(1)];

      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);
      mocks.prisma.documentChunk.findFirst.mockResolvedValue({
        metadata: { scale: '1/8" = 1\'-0"' },
      });
      mocks.callAbacusLLM.mockResolvedValue({
        content: '[]',
        model: 'claude-sonnet-4-20250514',
      });

      await extractQuantitiesWithAI('project-1', 'doc-1');

      expect(mocks.callAbacusLLM).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('1/8" = 1\'-0"'),
          }),
        ]),
        expect.any(Object)
      );
    });

    it('should filter out items with zero quantity', async () => {
      const aiResponse = JSON.stringify([
        { itemName: 'Valid Item', quantity: 10, unit: 'EA', category: 'general', confidence: 80 },
        { itemName: 'Zero Item', quantity: 0, unit: 'EA', category: 'general', confidence: 80 },
        { itemName: 'Negative Item', quantity: -5, unit: 'EA', category: 'general', confidence: 80 },
      ]);

      mocks.prisma.documentChunk.findMany.mockResolvedValue([createMockChunk(1)]);
      mocks.prisma.documentChunk.findFirst.mockResolvedValue(null);
      mocks.callAbacusLLM.mockResolvedValue({
        content: aiResponse,
        model: 'claude-sonnet-4-20250514',
      });

      const result = await extractQuantitiesWithAI('project-1', 'doc-1');

      expect(result).toHaveLength(1);
      expect(result[0].itemName).toBe('Valid Item');
    });

    it('should normalize units correctly', async () => {
      const aiResponse = JSON.stringify([
        { itemName: 'Item 1', quantity: 100, unit: 'square feet', category: 'general', confidence: 80 },
        { itemName: 'Item 2', quantity: 50, unit: 'LF', category: 'general', confidence: 80 },
      ]);

      mocks.prisma.documentChunk.findMany.mockResolvedValue([createMockChunk(1)]);
      mocks.prisma.documentChunk.findFirst.mockResolvedValue(null);
      mocks.callAbacusLLM.mockResolvedValue({
        content: aiResponse,
        model: 'claude-sonnet-4-20250514',
      });

      const result = await extractQuantitiesWithAI('project-1', 'doc-1');

      expect(result[0].unit).toBe('SF'); // Normalized from 'square feet'
      expect(result[1].unit).toBe('LF'); // Already normalized
    });
  });

  describe('Error Handling', () => {
    it('should return empty array when no chunks found', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue([]);

      const result = await extractQuantitiesWithAI('project-1', 'doc-1');

      expect(result).toEqual([]);
      expect(mocks.callAbacusLLM).not.toHaveBeenCalled();
    });

    it('should handle AI API errors gracefully', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue([createMockChunk(1)]);
      mocks.prisma.documentChunk.findFirst.mockResolvedValue(null);
      mocks.callAbacusLLM.mockRejectedValue(new Error('API rate limit exceeded'));

      const result = await extractQuantitiesWithAI('project-1', 'doc-1');

      expect(result).toEqual([]);
    });

    it('should handle invalid JSON response from AI', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue([createMockChunk(1)]);
      mocks.prisma.documentChunk.findFirst.mockResolvedValue(null);
      mocks.callAbacusLLM.mockResolvedValue({
        content: 'This is not valid JSON',
        model: 'claude-sonnet-4-20250514',
      });

      const result = await extractQuantitiesWithAI('project-1', 'doc-1');

      expect(result).toEqual([]);
    });

    it('should handle response with no JSON array', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue([createMockChunk(1)]);
      mocks.prisma.documentChunk.findFirst.mockResolvedValue(null);
      mocks.callAbacusLLM.mockResolvedValue({
        content: 'Here are some quantities but no JSON array',
        model: 'claude-sonnet-4-20250514',
      });

      const result = await extractQuantitiesWithAI('project-1', 'doc-1');

      expect(result).toEqual([]);
    });

    it('should handle malformed JSON objects in array', async () => {
      const aiResponse = JSON.stringify([
        { itemName: 'Valid Item', quantity: 10, unit: 'EA', category: 'general', confidence: 80 },
        { itemName: 'Missing Quantity' }, // Missing required fields
        { quantity: 5, unit: 'LF' }, // Missing itemName
      ]);

      mocks.prisma.documentChunk.findMany.mockResolvedValue([createMockChunk(1)]);
      mocks.prisma.documentChunk.findFirst.mockResolvedValue(null);
      mocks.callAbacusLLM.mockResolvedValue({
        content: aiResponse,
        model: 'claude-sonnet-4-20250514',
      });

      const result = await extractQuantitiesWithAI('project-1', 'doc-1');

      expect(result.length).toBeGreaterThan(0);
      // Should still process valid items with defaults for missing fields
    });
  });

  describe('Edge Cases', () => {
    it('should handle chunks with truncated content', async () => {
      const longContent = 'A'.repeat(3000); // Exceeds 2000 char limit
      const mockChunks = [createMockChunk(1, { content: longContent })];

      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);
      mocks.prisma.documentChunk.findFirst.mockResolvedValue(null);
      mocks.callAbacusLLM.mockResolvedValue({
        content: '[]',
        model: 'claude-sonnet-4-20250514',
      });

      await extractQuantitiesWithAI('project-1', 'doc-1');

      // Should truncate content to 2000 chars in prompt
      expect(mocks.callAbacusLLM).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.any(String),
          }),
        ]),
        expect.any(Object)
      );
    });

    it('should set default confidence when missing', async () => {
      const aiResponse = JSON.stringify([
        { itemName: 'Item Without Confidence', quantity: 10, unit: 'EA', category: 'general' },
      ]);

      mocks.prisma.documentChunk.findMany.mockResolvedValue([createMockChunk(1)]);
      mocks.prisma.documentChunk.findFirst.mockResolvedValue(null);
      mocks.callAbacusLLM.mockResolvedValue({
        content: aiResponse,
        model: 'claude-sonnet-4-20250514',
      });

      const result = await extractQuantitiesWithAI('project-1', 'doc-1');

      expect(result[0].confidence).toBe(75); // Default confidence
    });

    it('should default to EA unit when unit is missing', async () => {
      const aiResponse = JSON.stringify([
        { itemName: 'Item Without Unit', quantity: 10, category: 'general', confidence: 80 },
      ]);

      mocks.prisma.documentChunk.findMany.mockResolvedValue([createMockChunk(1)]);
      mocks.prisma.documentChunk.findFirst.mockResolvedValue(null);
      mocks.callAbacusLLM.mockResolvedValue({
        content: aiResponse,
        model: 'claude-sonnet-4-20250514',
      });

      const result = await extractQuantitiesWithAI('project-1', 'doc-1');

      expect(result[0].unit).toBe('EA'); // Default unit
    });
  });
});

// ============================================
// autoExtractTakeoffs Tests
// ============================================

describe('autoExtractTakeoffs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('should auto-extract takeoffs from all processed documents', async () => {
      const mockDocs = [
        createMockDocument({ id: 'doc-1', name: 'Foundation Plan.pdf' }),
        createMockDocument({ id: 'doc-2', name: 'Floor Plan.pdf' }),
      ];
      const mockProject = { id: 'project-1', ownerId: 'user-1' };
      const mockTakeoff = createMockTakeoff({ extractedBy: 'auto' });

      const aiResponse = JSON.stringify([
        { itemName: 'Concrete', quantity: 50, unit: 'CY', category: 'concrete', confidence: 90 },
      ]);

      mocks.prisma.document.findMany.mockResolvedValue(mockDocs);
      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.documentChunk.findMany.mockResolvedValue([createMockChunk(1)]);
      mocks.prisma.documentChunk.findFirst.mockResolvedValue(null);
      mocks.callAbacusLLM.mockResolvedValue({
        content: aiResponse,
        model: 'claude-sonnet-4-20250514',
      });
      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
      mocks.prisma.takeoffLineItem.create.mockResolvedValue({ id: 'line-1' });
      mocks.extractSiteworkTakeoff.mockResolvedValue([]);

      const result = await autoExtractTakeoffs('project-1', 'test-project');

      expect(result.success).toBe(true);
      expect(result.itemCount).toBeGreaterThan(0);
      expect(result.takeoffId).toBe('takeoff-1');
      expect(mocks.prisma.materialTakeoff.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            extractedBy: 'auto',
          }),
        })
      );
    });

    it('should update existing auto-generated takeoff instead of creating new one', async () => {
      const mockDocs = [createMockDocument()];
      const mockProject = { id: 'project-1', ownerId: 'user-1' };
      const existingTakeoff = createMockTakeoff({ id: 'existing-takeoff', extractedBy: 'auto' });

      const aiResponse = JSON.stringify([
        { itemName: 'Steel', quantity: 10, unit: 'TON', category: 'steel', confidence: 85 },
      ]);

      mocks.prisma.document.findMany.mockResolvedValue(mockDocs);
      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.documentChunk.findMany.mockResolvedValue([createMockChunk(1)]);
      mocks.prisma.documentChunk.findFirst.mockResolvedValue(null);
      mocks.callAbacusLLM.mockResolvedValue({
        content: aiResponse,
        model: 'claude-sonnet-4-20250514',
      });
      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(existingTakeoff);
      mocks.prisma.takeoffLineItem.deleteMany.mockResolvedValue({ count: 5 });
      mocks.prisma.takeoffLineItem.create.mockResolvedValue({ id: 'line-1' });
      mocks.extractSiteworkTakeoff.mockResolvedValue([]);

      const result = await autoExtractTakeoffs('project-1', 'test-project');

      expect(result.success).toBe(true);
      expect(result.takeoffId).toBe('existing-takeoff');
      expect(mocks.prisma.materialTakeoff.create).not.toHaveBeenCalled();
      expect(mocks.prisma.takeoffLineItem.deleteMany).toHaveBeenCalledWith({
        where: { takeoffId: 'existing-takeoff' },
      });
    });

    it('should run enhanced sitework extraction for civil drawings', async () => {
      const mockDocs = [
        createMockDocument({ id: 'doc-1', name: 'C-1 Site Plan.pdf' }),
        createMockDocument({ id: 'doc-2', name: 'Civil Grading Plan.pdf' }),
      ];
      const mockProject = { id: 'project-1', ownerId: 'user-1' };
      const mockTakeoff = createMockTakeoff({ extractedBy: 'auto' });

      const siteworkItems = [
        {
          itemName: 'Excavation',
          description: 'Bulk excavation',
          quantity: 500,
          unit: 'CY',
          category: 'earthwork',
          source: 'sitework:C-1',
          confidence: 90,
          calculationMethod: 'Cut volume from grading plan',
        },
      ];

      mocks.prisma.document.findMany.mockResolvedValue(mockDocs);
      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.documentChunk.findMany.mockResolvedValue([createMockChunk(1)]);
      mocks.prisma.documentChunk.findFirst.mockResolvedValue(null);
      mocks.callAbacusLLM.mockResolvedValue({
        content: '[]',
        model: 'claude-sonnet-4-20250514',
      });
      mocks.extractSiteworkTakeoff.mockResolvedValue(siteworkItems);
      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
      mocks.prisma.takeoffLineItem.create.mockResolvedValue({ id: 'line-1' });

      const result = await autoExtractTakeoffs('project-1', 'test-project');

      expect(result.success).toBe(true);
      expect(mocks.extractSiteworkTakeoff).toHaveBeenCalledTimes(2);
      expect(mocks.extractSiteworkTakeoff).toHaveBeenCalledWith(
        'doc-1',
        'project-1',
        expect.objectContaining({
          includeCAD: true,
          includeGeotech: false,
        })
      );
    });

    it('should cross-reference geotech document for sitework extraction', async () => {
      const mockDocs = [
        createMockDocument({ id: 'doc-1', name: 'C-1 Site Plan.pdf' }),
        createMockDocument({ id: 'doc-2', name: 'Geotech Report.pdf' }),
      ];
      const mockProject = { id: 'project-1', ownerId: 'user-1' };
      const mockTakeoff = createMockTakeoff({ extractedBy: 'auto' });

      mocks.prisma.document.findMany.mockResolvedValue(mockDocs);
      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.documentChunk.findMany.mockResolvedValue([createMockChunk(1)]);
      mocks.prisma.documentChunk.findFirst.mockResolvedValue(null);
      mocks.callAbacusLLM.mockResolvedValue({
        content: '[]',
        model: 'claude-sonnet-4-20250514',
      });
      mocks.extractSiteworkTakeoff.mockResolvedValue([]);
      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);

      await autoExtractTakeoffs('project-1', 'test-project');

      expect(mocks.extractSiteworkTakeoff).toHaveBeenCalledWith(
        'doc-1',
        'project-1',
        expect.objectContaining({
          includeGeotech: true,
          geotechDocumentId: 'doc-2',
        })
      );
    });

    it('should handle sitework extraction errors gracefully', async () => {
      const mockDocs = [createMockDocument({ name: 'Civil Plan.pdf' })];
      const mockProject = { id: 'project-1', ownerId: 'user-1' };
      const mockTakeoff = createMockTakeoff({ extractedBy: 'auto' });

      mocks.prisma.document.findMany.mockResolvedValue(mockDocs);
      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.documentChunk.findMany.mockResolvedValue([createMockChunk(1)]);
      mocks.prisma.documentChunk.findFirst.mockResolvedValue(null);
      mocks.callAbacusLLM.mockResolvedValue({
        content: '[]',
        model: 'claude-sonnet-4-20250514',
      });
      mocks.extractSiteworkTakeoff.mockRejectedValue(new Error('Sitework extraction failed'));
      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);

      // Should not throw - continues with other documents
      const result = await autoExtractTakeoffs('project-1', 'test-project');

      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return failure when no processed documents found', async () => {
      mocks.prisma.document.findMany.mockResolvedValue([]);

      const result = await autoExtractTakeoffs('project-1', 'test-project');

      expect(result.success).toBe(false);
      expect(result.itemCount).toBe(0);
    });

    it('should return failure when project not found', async () => {
      const mockDocs = [createMockDocument()];

      mocks.prisma.document.findMany.mockResolvedValue(mockDocs);
      mocks.prisma.project.findUnique.mockResolvedValue(null);

      const result = await autoExtractTakeoffs('project-1', 'test-project');

      expect(result.success).toBe(false);
      expect(result.itemCount).toBe(0);
    });

    it('should return success with zero items when no quantities extracted', async () => {
      const mockDocs = [createMockDocument()];
      const mockProject = { id: 'project-1', ownerId: 'user-1' };

      mocks.prisma.document.findMany.mockResolvedValue(mockDocs);
      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.documentChunk.findMany.mockResolvedValue([createMockChunk(1)]);
      mocks.prisma.documentChunk.findFirst.mockResolvedValue(null);
      mocks.callAbacusLLM.mockResolvedValue({
        content: '[]',
        model: 'claude-sonnet-4-20250514',
      });
      mocks.extractSiteworkTakeoff.mockResolvedValue([]);

      const result = await autoExtractTakeoffs('project-1', 'test-project');

      expect(result.success).toBe(true);
      expect(result.itemCount).toBe(0);
      expect(result.takeoffId).toBeUndefined();
    });

    it('should handle database errors gracefully', async () => {
      mocks.prisma.document.findMany.mockRejectedValue(new Error('Database connection failed'));

      const result = await autoExtractTakeoffs('project-1', 'test-project');

      expect(result.success).toBe(false);
      expect(result.itemCount).toBe(0);
    });

    it('should handle errors during line item creation', async () => {
      const mockDocs = [createMockDocument()];
      const mockProject = { id: 'project-1', ownerId: 'user-1' };
      const mockTakeoff = createMockTakeoff({ extractedBy: 'auto' });

      const aiResponse = JSON.stringify([
        { itemName: 'Item 1', quantity: 10, unit: 'EA', category: 'general', confidence: 80 },
      ]);

      mocks.prisma.document.findMany.mockResolvedValue(mockDocs);
      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.documentChunk.findMany.mockResolvedValue([createMockChunk(1)]);
      mocks.prisma.documentChunk.findFirst.mockResolvedValue(null);
      mocks.callAbacusLLM.mockResolvedValue({
        content: aiResponse,
        model: 'claude-sonnet-4-20250514',
      });
      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
      mocks.prisma.takeoffLineItem.create.mockRejectedValue(new Error('Constraint violation'));
      mocks.extractSiteworkTakeoff.mockResolvedValue([]);

      const result = await autoExtractTakeoffs('project-1', 'test-project');

      expect(result.success).toBe(false);
      expect(result.itemCount).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle documents with no chunks', async () => {
      const mockDocs = [createMockDocument()];
      const mockProject = { id: 'project-1', ownerId: 'user-1' };

      mocks.prisma.document.findMany.mockResolvedValue(mockDocs);
      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.documentChunk.findMany.mockResolvedValue([]);
      mocks.extractSiteworkTakeoff.mockResolvedValue([]);

      const result = await autoExtractTakeoffs('project-1', 'test-project');

      expect(result.success).toBe(true);
      expect(result.itemCount).toBe(0);
    });

    it('should recognize various civil drawing name patterns', async () => {
      const mockDocs = [
        createMockDocument({ id: 'doc-1', name: 'C-1.pdf' }),
        createMockDocument({ id: 'doc-2', name: 'C_2.pdf' }),
        createMockDocument({ id: 'doc-3', name: 'CIVIL-100.pdf' }),
        createMockDocument({ id: 'doc-4', name: 'Utility Plan.pdf' }),
        createMockDocument({ id: 'doc-5', name: 'Landscape.pdf' }),
        createMockDocument({ id: 'doc-6', name: 'Paving Details.pdf' }),
        createMockDocument({ id: 'doc-7', name: 'Storm Drainage.pdf' }),
      ];
      const mockProject = { id: 'project-1', ownerId: 'user-1' };
      const mockTakeoff = createMockTakeoff({ extractedBy: 'auto' });

      mocks.prisma.document.findMany.mockResolvedValue(mockDocs);
      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.documentChunk.findMany.mockResolvedValue([createMockChunk(1)]);
      mocks.prisma.documentChunk.findFirst.mockResolvedValue(null);
      mocks.callAbacusLLM.mockResolvedValue({
        content: '[]',
        model: 'claude-sonnet-4-20250514',
      });
      mocks.extractSiteworkTakeoff.mockResolvedValue([]);
      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);

      await autoExtractTakeoffs('project-1', 'test-project');

      // Should call sitework extraction for all civil-related documents
      expect(mocks.extractSiteworkTakeoff).toHaveBeenCalledTimes(7);
    });

    it('should not call sitework extraction for non-civil documents', async () => {
      const mockDocs = [
        createMockDocument({ name: 'A-101 Floor Plan.pdf' }),
        createMockDocument({ name: 'S-201 Structural.pdf' }),
        createMockDocument({ name: 'E-301 Electrical.pdf' }),
      ];
      const mockProject = { id: 'project-1', ownerId: 'user-1' };
      const mockTakeoff = createMockTakeoff({ extractedBy: 'auto' });

      mocks.prisma.document.findMany.mockResolvedValue(mockDocs);
      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.documentChunk.findMany.mockResolvedValue([createMockChunk(1)]);
      mocks.prisma.documentChunk.findFirst.mockResolvedValue(null);
      mocks.callAbacusLLM.mockResolvedValue({
        content: '[]',
        model: 'claude-sonnet-4-20250514',
      });
      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);

      await autoExtractTakeoffs('project-1', 'test-project');

      expect(mocks.extractSiteworkTakeoff).not.toHaveBeenCalled();
    });

    it('should handle mixed sitework and standard items', async () => {
      const mockDocs = [
        createMockDocument({ id: 'doc-1', name: 'Site Plan.pdf' }),
      ];
      const mockProject = { id: 'project-1', ownerId: 'user-1' };
      const mockTakeoff = createMockTakeoff({ extractedBy: 'auto' });

      const aiResponse = JSON.stringify([
        { itemName: 'Concrete', quantity: 50, unit: 'CY', category: 'concrete', confidence: 90 },
      ]);

      const siteworkItems = [
        {
          itemName: 'Excavation',
          description: 'Bulk excavation',
          quantity: 500,
          unit: 'CY',
          category: 'earthwork',
          source: 'sitework:page:1',
          confidence: 85,
          calculationMethod: 'Volume calc',
        },
      ];

      mocks.prisma.document.findMany.mockResolvedValue(mockDocs);
      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.documentChunk.findMany.mockResolvedValue([createMockChunk(1)]);
      mocks.prisma.documentChunk.findFirst.mockResolvedValue(null);
      mocks.callAbacusLLM.mockResolvedValue({
        content: aiResponse,
        model: 'claude-sonnet-4-20250514',
      });
      mocks.extractSiteworkTakeoff.mockResolvedValue(siteworkItems);
      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.materialTakeoff.create.mockResolvedValue(mockTakeoff);
      mocks.prisma.takeoffLineItem.create.mockResolvedValue({ id: 'line-1' });

      const result = await autoExtractTakeoffs('project-1', 'test-project');

      expect(result.success).toBe(true);
      expect(result.itemCount).toBe(2); // 1 from AI + 1 from sitework
      expect(mocks.prisma.takeoffLineItem.create).toHaveBeenCalledTimes(2);
    });
  });
});
