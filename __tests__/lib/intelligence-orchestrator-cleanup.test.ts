import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  document: {
    findUnique: vi.fn(),
  },
  documentChunk: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  drawingType: { deleteMany: vi.fn() },
  sheetLegend: { deleteMany: vi.fn() },
  dimensionAnnotation: { deleteMany: vi.fn() },
  detailCallout: { deleteMany: vi.fn() },
  enhancedAnnotation: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { runIntelligenceExtraction } from '@/lib/intelligence-orchestrator';

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
  content: 'Basic content',
  sheetNumber: null,
  scaleData: null,
  metadata: {},
  discipline: null,
};

describe('Intelligence Orchestrator - Cleanup Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.document.findUnique.mockResolvedValue(mockDocument);
    mockPrisma.documentChunk.findMany.mockResolvedValue([mockChunk]);
    mockPrisma.documentChunk.update.mockImplementation((args) =>
      Promise.resolve({ ...mockChunk, ...args.data })
    );
    mockPrisma.$transaction.mockResolvedValue([]);
  });

  it('should clean up stale extraction records before re-extraction', async () => {
    await runIntelligenceExtraction({
      documentId: 'doc-1',
      projectSlug: 'test-project',
      skipExisting: false,
    });

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    const txArg = mockPrisma.$transaction.mock.calls[0][0];
    expect(Array.isArray(txArg)).toBe(true);
    expect(txArg.length).toBe(5);
  });

  it('should skip cleanup when skipExisting is true', async () => {
    await runIntelligenceExtraction({
      documentId: 'doc-1',
      projectSlug: 'test-project',
      skipExisting: true,
    });

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('should clean up all 5 record types in a transaction', async () => {
    await runIntelligenceExtraction({
      documentId: 'doc-1',
      projectSlug: 'test-project',
      skipExisting: false,
      phases: ['A'],
    });

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    // The transaction receives 5 Prisma promises for:
    // drawingType, sheetLegend, dimensionAnnotation, detailCallout, enhancedAnnotation
    const txArg = mockPrisma.$transaction.mock.calls[0][0];
    expect(txArg).toHaveLength(5);
  });

  it('should continue extraction even if cleanup fails', async () => {
    mockPrisma.$transaction.mockRejectedValueOnce(new Error('Transaction failed'));

    const result = await runIntelligenceExtraction({
      documentId: 'doc-1',
      projectSlug: 'test-project',
      skipExisting: false,
      phases: ['A'],
    });

    // Extraction should still succeed even though cleanup failed
    expect(result.success).toBe(true);
    expect(result.phasesRun).toContain('A');
    // Chunks should still have been processed
    expect(mockPrisma.documentChunk.update).toHaveBeenCalled();
  });

  it('should not clean up when document is not found', async () => {
    mockPrisma.document.findUnique.mockResolvedValueOnce(null);

    const result = await runIntelligenceExtraction({
      documentId: 'nonexistent',
      projectSlug: 'test-project',
      skipExisting: false,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Document not found');
    // Cleanup runs AFTER document check, so $transaction should not be called
    // Actually, looking at the code, cleanup runs after document is found.
    // If document is not found, it throws before cleanup.
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
