import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// Mocks Setup - Must use vi.hoisted for mock objects
// ============================================

// Mock prisma with vi.hoisted to ensure it's available before mock calls
const mockPrisma = vi.hoisted(() => ({
  document: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  documentChunk: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Import the module after mocks are set up
import {
  runIntelligenceExtraction,
  extractAllIntelligence,
  extractPhaseCOnly,
  getExtractionStats,
  type IntelligenceExtractionOptions,
  type ExtractionResult,
  type PhaseAResult,
  type PhaseBResult,
  type PhaseCResult,
} from '@/lib/intelligence-orchestrator';

describe('Intelligence Orchestrator - Main Orchestration', () => {
  const mockDocument = {
    id: 'doc-1',
    name: 'Test Document',
    fileName: 'test.pdf',
    projectId: 'project-1',
    Project: {
      id: 'project-1',
      name: 'Test Project',
      slug: 'test-project',
    },
  };

  const mockChunk = {
    id: 'chunk-1',
    documentId: 'doc-1',
    pageNumber: 1,
    content: `SHEET NO. A1.1
    SCALE: 1/4" = 1'-0"
    FLOOR PLAN
    12'-6" x 20'-0"
    NOTE: Verify all dimensions in field
    SEE SHEET A2.1 for details
    HVAC ductwork shown
    TYP. wall section`,
    sheetNumber: null,
    scaleData: null,
    metadata: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockPrisma.document.findUnique.mockResolvedValue(mockDocument);
    mockPrisma.documentChunk.findMany.mockResolvedValue([mockChunk]);
    mockPrisma.documentChunk.update.mockImplementation((args) =>
      Promise.resolve({ ...mockChunk, ...args.data })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should run all phases successfully (A, B, C)', async () => {
    const options: IntelligenceExtractionOptions = {
      documentId: 'doc-1',
      projectSlug: 'test-project',
      phases: ['A', 'B', 'C'],
    };

    const result = await runIntelligenceExtraction(options);

    expect(result.success).toBe(true);
    expect(result.phasesRun).toEqual(['A', 'B', 'C']);
    expect(result.pagesProcessed).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(result.phaseResults.phaseA).toBeDefined();
    expect(result.phaseResults.phaseB).toBeDefined();
    expect(result.phaseResults.phaseC).toBeDefined();
  });

  it('should run only Phase A when specified', async () => {
    const options: IntelligenceExtractionOptions = {
      documentId: 'doc-1',
      projectSlug: 'test-project',
      phases: ['A'],
    };

    const result = await runIntelligenceExtraction(options);

    expect(result.success).toBe(true);
    expect(result.phasesRun).toEqual(['A']);
    expect(result.phaseResults.phaseA).toBeDefined();
    expect(result.phaseResults.phaseB).toBeUndefined();
    expect(result.phaseResults.phaseC).toBeUndefined();
  });

  it('should handle document not found error', async () => {
    mockPrisma.document.findUnique.mockResolvedValue(null);

    const options: IntelligenceExtractionOptions = {
      documentId: 'nonexistent',
      projectSlug: 'test-project',
    };

    const result = await runIntelligenceExtraction(options);

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Document not found');
  });

  it('should handle no chunks found scenario', async () => {
    mockPrisma.documentChunk.findMany.mockResolvedValue([]);

    const options: IntelligenceExtractionOptions = {
      documentId: 'doc-1',
      projectSlug: 'test-project',
    };

    const result = await runIntelligenceExtraction(options);

    expect(result.success).toBe(true);
    expect(result.warnings).toContain('No chunks found to process (may already be extracted)');
    expect(result.pagesProcessed).toBe(0);
  });

  it('should respect page range filter', async () => {
    const chunks = [
      { ...mockChunk, id: 'chunk-1', pageNumber: 1 },
      { ...mockChunk, id: 'chunk-2', pageNumber: 2 },
      { ...mockChunk, id: 'chunk-3', pageNumber: 3 },
    ];
    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const options: IntelligenceExtractionOptions = {
      documentId: 'doc-1',
      projectSlug: 'test-project',
      pageRange: { start: 1, end: 2 },
    };

    await runIntelligenceExtraction(options);

    expect(mockPrisma.documentChunk.findMany).toHaveBeenCalledWith({
      where: {
        documentId: 'doc-1',
        pageNumber: { gte: 1, lte: 2 },
      },
      orderBy: { pageNumber: 'asc' },
    });
  });

  it('should skip existing chunks when skipExisting is true', async () => {
    const options: IntelligenceExtractionOptions = {
      documentId: 'doc-1',
      projectSlug: 'test-project',
      skipExisting: true,
    };

    await runIntelligenceExtraction(options);

    expect(mockPrisma.documentChunk.findMany).toHaveBeenCalledWith({
      where: {
        documentId: 'doc-1',
        scaleData: { equals: null },
      },
      orderBy: { pageNumber: 'asc' },
    });
  });

  it('should handle database errors gracefully', async () => {
    mockPrisma.documentChunk.update.mockRejectedValue(new Error('Database error'));

    const options: IntelligenceExtractionOptions = {
      documentId: 'doc-1',
      projectSlug: 'test-project',
      phases: ['A'],
    };

    const result = await runIntelligenceExtraction(options);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('Intelligence Orchestrator - Phase A (Foundation)', () => {
  const mockDocument = {
    id: 'doc-1',
    name: 'Test Document',
    fileName: 'test.pdf',
    projectId: 'project-1',
    Project: {
      id: 'project-1',
      name: 'Test Project',
      slug: 'test-project',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.document.findUnique.mockResolvedValue(mockDocument);
  });

  it('should extract sheet numbers from title blocks', async () => {
    const chunk = {
      id: 'chunk-1',
      documentId: 'doc-1',
      pageNumber: 1,
      content: 'SHEET NO. A1.1\nFLOOR PLAN\nSCALE: 1/4" = 1\'-0"',
      sheetNumber: null,
    };
    mockPrisma.documentChunk.findMany.mockResolvedValue([chunk]);
    mockPrisma.documentChunk.update.mockResolvedValue(chunk);

    const result = await runIntelligenceExtraction({
      documentId: 'doc-1',
      projectSlug: 'test-project',
      phases: ['A'],
    });

    expect(result.phaseResults.phaseA?.titleBlocksExtracted).toBe(1);
    expect(mockPrisma.documentChunk.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'chunk-1' },
        data: expect.objectContaining({
          sheetNumber: 'A1.1',
        }),
      })
    );
  });

  it('should detect architectural scales', async () => {
    const chunk = {
      id: 'chunk-1',
      documentId: 'doc-1',
      pageNumber: 1,
      content: 'SCALE: 1/4" = 1\'-0"',
      sheetNumber: null,
    };
    mockPrisma.documentChunk.findMany.mockResolvedValue([chunk]);
    mockPrisma.documentChunk.update.mockResolvedValue(chunk);

    const result = await runIntelligenceExtraction({
      documentId: 'doc-1',
      projectSlug: 'test-project',
      phases: ['A'],
    });

    expect(result.phaseResults.phaseA?.scalesDetected).toBe(1);
    expect(mockPrisma.documentChunk.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scaleType: 'architectural',
        }),
      })
    );
  });

  it('should detect NTS (Not To Scale) sheets', async () => {
    const chunk = {
      id: 'chunk-1',
      documentId: 'doc-1',
      pageNumber: 1,
      content: 'SCALE: NTS\nDETAIL SHEET',
      sheetNumber: null,
    };
    mockPrisma.documentChunk.findMany.mockResolvedValue([chunk]);
    mockPrisma.documentChunk.update.mockResolvedValue(chunk);

    const result = await runIntelligenceExtraction({
      documentId: 'doc-1',
      projectSlug: 'test-project',
      phases: ['A'],
    });

    expect(mockPrisma.documentChunk.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scaleType: 'NTS',
          primaryScale: 'NTS',
        }),
      })
    );
  });

  it('should calculate scale ratios correctly', async () => {
    const chunk = {
      id: 'chunk-1',
      documentId: 'doc-1',
      pageNumber: 1,
      content: 'SCALE: 1:48',
      sheetNumber: null,
    };
    mockPrisma.documentChunk.findMany.mockResolvedValue([chunk]);
    mockPrisma.documentChunk.update.mockResolvedValue(chunk);

    await runIntelligenceExtraction({
      documentId: 'doc-1',
      projectSlug: 'test-project',
      phases: ['A'],
    });

    expect(mockPrisma.documentChunk.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scaleRatio: 48,
        }),
      })
    );
  });
});

describe('Intelligence Orchestrator - Phase B (Advanced Features)', () => {
  const mockDocument = {
    id: 'doc-1',
    name: 'Test Document',
    fileName: 'test.pdf',
    projectId: 'project-1',
    Project: {
      id: 'project-1',
      name: 'Test Project',
      slug: 'test-project',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.document.findUnique.mockResolvedValue(mockDocument);
  });

  it('should extract dimensions from content', async () => {
    const chunk = {
      id: 'chunk-1',
      documentId: 'doc-1',
      pageNumber: 1,
      content: `Room dimensions: 12'-6" x 20'-0"
        Wall height: 10'
        Area: 250 SF`,
      sheetNumber: null,
    };
    mockPrisma.documentChunk.findMany.mockResolvedValue([chunk]);
    mockPrisma.documentChunk.update.mockResolvedValue(chunk);

    const result = await runIntelligenceExtraction({
      documentId: 'doc-1',
      projectSlug: 'test-project',
      phases: ['B'],
    });

    expect(result.phaseResults.phaseB?.dimensionsExtracted).toBeGreaterThan(0);
    expect(mockPrisma.documentChunk.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dimensionCount: expect.any(Number),
          dimensions: expect.any(Array),
        }),
      })
    );
  });

  it('should extract annotations and callouts', async () => {
    const chunk = {
      id: 'chunk-1',
      documentId: 'doc-1',
      pageNumber: 1,
      content: `NOTE: Verify all dimensions in field
        WARNING: Load bearing wall
        1. All work to comply with code
        2. Contractor to coordinate with MEP
        TYP. detail at all locations`,
      sheetNumber: null,
    };
    mockPrisma.documentChunk.findMany.mockResolvedValue([chunk]);
    mockPrisma.documentChunk.update.mockResolvedValue(chunk);

    const result = await runIntelligenceExtraction({
      documentId: 'doc-1',
      projectSlug: 'test-project',
      phases: ['B'],
    });

    expect(result.phaseResults.phaseB?.annotationsFound).toBeGreaterThan(0);
    expect(result.phaseResults.phaseB?.calloutsExtracted).toBeGreaterThan(0);
    expect(mockPrisma.documentChunk.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          annotations: expect.any(Array),
          callouts: expect.any(Array),
        }),
      })
    );
  });

  it('should extract cross-references', async () => {
    const chunk = {
      id: 'chunk-1',
      documentId: 'doc-1',
      pageNumber: 1,
      content: `SEE SHEET A2.1 for details
        SEE DETAIL 3/A5.1
        Section A-A`,
      sheetNumber: null,
    };
    mockPrisma.documentChunk.findMany.mockResolvedValue([chunk]);
    mockPrisma.documentChunk.update.mockResolvedValue(chunk);

    await runIntelligenceExtraction({
      documentId: 'doc-1',
      projectSlug: 'test-project',
      phases: ['B'],
    });

    expect(mockPrisma.documentChunk.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          crossReferences: expect.arrayContaining([
            expect.stringMatching(/SHEET A2\.1/i),
          ]),
        }),
      })
    );
  });

  it('should handle content with no dimensions', async () => {
    const chunk = {
      id: 'chunk-1',
      documentId: 'doc-1',
      pageNumber: 1,
      content: 'General notes and specifications',
      sheetNumber: null,
    };
    mockPrisma.documentChunk.findMany.mockResolvedValue([chunk]);
    mockPrisma.documentChunk.update.mockResolvedValue(chunk);

    const result = await runIntelligenceExtraction({
      documentId: 'doc-1',
      projectSlug: 'test-project',
      phases: ['B'],
    });

    expect(result.phaseResults.phaseB?.dimensionsExtracted).toBe(0);
  });
});

describe('Intelligence Orchestrator - Phase C (Advanced Intelligence)', () => {
  const mockDocument = {
    id: 'doc-1',
    name: 'Test Document',
    fileName: 'test.pdf',
    projectId: 'project-1',
    Project: {
      id: 'project-1',
      name: 'Test Project',
      slug: 'test-project',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.document.findUnique.mockResolvedValue(mockDocument);
  });

  it('should detect floor plan drawing types', async () => {
    const chunk = {
      id: 'chunk-1',
      documentId: 'doc-1',
      pageNumber: 1,
      content: 'FLOOR PLAN - LEVEL 1\nRoom layout and dimensions',
      sheetNumber: 'A1.1',
    };
    mockPrisma.documentChunk.findMany.mockResolvedValue([chunk]);
    mockPrisma.documentChunk.update.mockResolvedValue(chunk);

    const result = await runIntelligenceExtraction({
      documentId: 'doc-1',
      projectSlug: 'test-project',
      phases: ['C'],
    });

    expect(result.phaseResults.phaseC?.spatialCorrelationsBuilt).toBeGreaterThanOrEqual(0);
    // Verify update was called with drawing type data
    expect(mockPrisma.documentChunk.update).toHaveBeenCalled();
    const updateCall = mockPrisma.documentChunk.update.mock.calls[0][0];
    expect(updateCall.data).toHaveProperty('drawingType');
    expect(updateCall.data).toHaveProperty('drawingTypeConfidence');
  });

  it('should detect MEP disciplines - mechanical', async () => {
    const chunk = {
      id: 'chunk-1',
      documentId: 'doc-1',
      pageNumber: 1,
      content: 'HVAC ductwork layout\nDiffuser schedule\nAHU location',
      sheetNumber: 'M1.1',
    };
    mockPrisma.documentChunk.findMany.mockResolvedValue([chunk]);
    mockPrisma.documentChunk.update.mockResolvedValue(chunk);

    const result = await runIntelligenceExtraction({
      documentId: 'doc-1',
      projectSlug: 'test-project',
      phases: ['C'],
    });

    expect(result.phaseResults.phaseC?.mepElementsMapped).toBeGreaterThan(0);
    expect(mockPrisma.documentChunk.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          discipline: 'mechanical',
        }),
      })
    );
  });

  it('should detect MEP disciplines - electrical', async () => {
    const chunk = {
      id: 'chunk-1',
      documentId: 'doc-1',
      pageNumber: 1,
      content: 'Panel schedule\nCircuit layout\nOutlet locations',
      sheetNumber: 'E1.1',
    };
    mockPrisma.documentChunk.findMany.mockResolvedValue([chunk]);
    mockPrisma.documentChunk.update.mockResolvedValue(chunk);

    const result = await runIntelligenceExtraction({
      documentId: 'doc-1',
      projectSlug: 'test-project',
      phases: ['C'],
    });

    expect(result.phaseResults.phaseC?.mepElementsMapped).toBeGreaterThan(0);
    expect(mockPrisma.documentChunk.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          discipline: 'electrical',
        }),
      })
    );
  });

  it('should detect MEP disciplines - plumbing', async () => {
    const chunk = {
      id: 'chunk-1',
      documentId: 'doc-1',
      pageNumber: 1,
      content: 'Plumbing fixtures\nPipe routing\nDrain locations',
      sheetNumber: 'P1.1',
    };
    mockPrisma.documentChunk.findMany.mockResolvedValue([chunk]);
    mockPrisma.documentChunk.update.mockResolvedValue(chunk);

    const result = await runIntelligenceExtraction({
      documentId: 'doc-1',
      projectSlug: 'test-project',
      phases: ['C'],
    });

    expect(result.phaseResults.phaseC?.mepElementsMapped).toBeGreaterThan(0);
    expect(mockPrisma.documentChunk.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          discipline: 'plumbing',
        }),
      })
    );
  });

  it('should infer drawing type from sheet number prefix', async () => {
    const chunk = {
      id: 'chunk-1',
      documentId: 'doc-1',
      pageNumber: 1,
      content: 'General architectural plan',
      sheetNumber: 'A2.3',
    };
    mockPrisma.documentChunk.findMany.mockResolvedValue([chunk]);
    mockPrisma.documentChunk.update.mockResolvedValue(chunk);

    await runIntelligenceExtraction({
      documentId: 'doc-1',
      projectSlug: 'test-project',
      phases: ['C'],
    });

    expect(mockPrisma.documentChunk.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          drawingType: 'architectural',
        }),
      })
    );
  });

  it('should build spatial correlation maps', async () => {
    const chunks = [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        pageNumber: 1,
        content: 'SHEET A1.1\nSEE SHEET A2.1 for details',
        sheetNumber: 'A1.1',
      },
      {
        id: 'chunk-2',
        documentId: 'doc-1',
        pageNumber: 2,
        content: 'SHEET A2.1\nReferences back to A1.1',
        sheetNumber: 'A2.1',
      },
    ];
    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);
    mockPrisma.documentChunk.update.mockResolvedValue(chunks[0]);

    const result = await runIntelligenceExtraction({
      documentId: 'doc-1',
      projectSlug: 'test-project',
      phases: ['C'],
    });

    expect(result.pagesProcessed).toBe(2);
    expect(mockPrisma.documentChunk.update).toHaveBeenCalledTimes(2);
  });

  it('should count symbols for learning', async () => {
    const chunk = {
      id: 'chunk-1',
      documentId: 'doc-1',
      pageNumber: 1,
      content: 'Symbol legend\nKey: /A1 = Type A\n/A2 = Type B',
      sheetNumber: 'A1.1',
    };
    mockPrisma.documentChunk.findMany.mockResolvedValue([chunk]);
    mockPrisma.documentChunk.update.mockResolvedValue(chunk);

    const result = await runIntelligenceExtraction({
      documentId: 'doc-1',
      projectSlug: 'test-project',
      phases: ['C'],
    });

    expect(result.phaseResults.phaseC?.symbolsLearned).toBeGreaterThan(0);
  });
});

describe('Intelligence Orchestrator - Convenience Functions', () => {
  const mockDocument = {
    id: 'doc-1',
    name: 'Test Document',
    fileName: 'test.pdf',
    projectId: 'project-1',
    Project: {
      id: 'project-1',
      name: 'Test Project',
      slug: 'test-project',
    },
  };

  const mockChunk = {
    id: 'chunk-1',
    documentId: 'doc-1',
    pageNumber: 1,
    content: 'Test content',
    sheetNumber: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.document.findUnique.mockResolvedValue(mockDocument);
    mockPrisma.documentChunk.findMany.mockResolvedValue([mockChunk]);
    mockPrisma.documentChunk.update.mockResolvedValue(mockChunk);
  });

  it('should run all phases with extractAllIntelligence', async () => {
    const result = await extractAllIntelligence('doc-1', 'test-project');

    expect(result.success).toBe(true);
    expect(result.phasesRun).toEqual(['A', 'B', 'C']);
    expect(result.phaseResults.phaseA).toBeDefined();
    expect(result.phaseResults.phaseB).toBeDefined();
    expect(result.phaseResults.phaseC).toBeDefined();
  });

  it('should run only Phase C with extractPhaseCOnly', async () => {
    const result = await extractPhaseCOnly('doc-1', 'test-project');

    expect(result.success).toBe(true);
    expect(result.phasesRun).toEqual(['C']);
    expect(result.phaseResults.phaseC).toBeDefined();
    expect(result.phaseResults.phaseA).toBeUndefined();
    expect(result.phaseResults.phaseB).toBeUndefined();

    // Verify skipExisting was set to true
    expect(mockPrisma.documentChunk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          scaleData: { equals: null },
        }),
      })
    );
  });

  it('should get extraction statistics', async () => {
    const chunks = [
      {
        id: 'chunk-1',
        pageNumber: 1,
        sheetNumber: 'A1.1',
        scaleData: { primaryScale: '1/4" = 1\'-0"' },
        metadata: { processed: true },
      },
      {
        id: 'chunk-2',
        pageNumber: 2,
        sheetNumber: 'A1.2',
        scaleData: null,
        metadata: {},
      },
      {
        id: 'chunk-3',
        pageNumber: 3,
        sheetNumber: null,
        scaleData: null,
        metadata: null,
      },
    ];
    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);

    const stats = await getExtractionStats('doc-1');

    expect(stats.totalPages).toBe(3);
    expect(stats.withTitleBlocks).toBe(2);
    expect(stats.withScales).toBe(1);
    expect(stats.withMetadata).toBe(1);
  });

  it('should return empty stats for document with no chunks', async () => {
    mockPrisma.documentChunk.findMany.mockResolvedValue([]);

    const stats = await getExtractionStats('doc-1');

    expect(stats.totalPages).toBe(0);
    expect(stats.withTitleBlocks).toBe(0);
    expect(stats.withScales).toBe(0);
    expect(stats.withMetadata).toBe(0);
  });
});

describe('Intelligence Orchestrator - Multi-Page Processing', () => {
  const mockDocument = {
    id: 'doc-1',
    name: 'Test Document',
    fileName: 'test.pdf',
    projectId: 'project-1',
    Project: {
      id: 'project-1',
      name: 'Test Project',
      slug: 'test-project',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.document.findUnique.mockResolvedValue(mockDocument);
  });

  it('should process multiple pages concurrently', async () => {
    const chunks = [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        pageNumber: 1,
        content: 'SHEET A1.1\nFLOOR PLAN\nSCALE: 1/4" = 1\'-0"',
        sheetNumber: null,
      },
      {
        id: 'chunk-2',
        documentId: 'doc-1',
        pageNumber: 2,
        content: 'SHEET A1.2\nELEVATION\nSCALE: 1/8" = 1\'-0"',
        sheetNumber: null,
      },
      {
        id: 'chunk-3',
        documentId: 'doc-1',
        pageNumber: 3,
        content: 'SHEET M1.1\nHVAC PLAN\nDuct layout',
        sheetNumber: null,
      },
    ];
    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);
    mockPrisma.documentChunk.update.mockImplementation((args) =>
      Promise.resolve({ ...chunks[0], ...args.data })
    );

    const result = await runIntelligenceExtraction({
      documentId: 'doc-1',
      projectSlug: 'test-project',
      phases: ['A', 'B', 'C'],
    });

    expect(result.success).toBe(true);
    expect(result.pagesProcessed).toBe(3);
    expect(mockPrisma.documentChunk.update).toHaveBeenCalledTimes(9); // 3 pages × 3 phases
  });

  it('should aggregate results across all pages', async () => {
    const chunks = [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        pageNumber: 1,
        content: 'SHEET A1.1\n12\'-6" dimension\nNOTE: Important',
        sheetNumber: null,
      },
      {
        id: 'chunk-2',
        documentId: 'doc-1',
        pageNumber: 2,
        content: 'SHEET A1.2\n20\'-0" dimension\nWARNING: Verify',
        sheetNumber: null,
      },
    ];
    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);
    mockPrisma.documentChunk.update.mockImplementation((args) =>
      Promise.resolve({ ...chunks[0], ...args.data })
    );

    const result = await runIntelligenceExtraction({
      documentId: 'doc-1',
      projectSlug: 'test-project',
      phases: ['A', 'B'],
    });

    expect(result.phaseResults.phaseA?.titleBlocksExtracted).toBe(2);
    expect(result.phaseResults.phaseB?.dimensionsExtracted).toBeGreaterThan(0);
    // Callout extraction may vary based on implementation patterns
    expect(result.phaseResults.phaseB?.calloutsExtracted).toBeGreaterThanOrEqual(1);
  });
});
