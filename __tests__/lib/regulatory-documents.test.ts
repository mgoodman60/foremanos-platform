import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks before imports
const mockPrisma = vi.hoisted(() => ({
  regulatoryDocument: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
  },
  documentChunk: {
    create: vi.fn(),
    count: vi.fn(),
  },
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

// Mock all dependencies
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
}));
vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createScopedLogger: vi.fn(() => mockLogger),
}));

// Import after mocks
import {
  AVAILABLE_REGULATORY_DOCUMENTS,
  isRegulatoryDocumentCached,
  linkRegulatoryDocumentToProject,
  ensureRegulatoryDocumentForProject,
  getRegulatoryDocumentsStatus,
  initializeRegulatoryDocumentsForProject,
  getProjectRegulatoryDocuments,
  getRegulatoryDocumentStats,
  getApplicableRegulatoryCodes,
  getFreeRegulatoryCodes,
  calculateRegulatoryProcessingCost,
  createRegulatoryDocuments,
} from '@/lib/regulatory-documents';

describe('regulatory-documents', () => {
  const mockRegDoc = {
    id: 'reg-doc-123',
    projectId: null,
    type: 'accessibility',
    jurisdiction: 'Federal',
    standard: 'ADA 2010 Standards',
    version: '2010',
    sourceUrl: null,
    lastUpdated: new Date(),
    expiresAt: null,
    processed: true,
    processorType: 'vision-ai',
    processingCost: 5.5,
    pagesProcessed: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockChunks = [
    {
      id: 'chunk-1',
      content: 'ADA requirement text 1',
      chunkIndex: 0,
      metadata: { page: 1 },
    },
    {
      id: 'chunk-2',
      content: 'ADA requirement text 2',
      chunkIndex: 1,
      metadata: { page: 2 },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AVAILABLE_REGULATORY_DOCUMENTS', () => {
    it('should define regulatory documents', () => {
      expect(AVAILABLE_REGULATORY_DOCUMENTS).toBeDefined();
      expect(AVAILABLE_REGULATORY_DOCUMENTS.length).toBeGreaterThan(0);

      const ada = AVAILABLE_REGULATORY_DOCUMENTS.find(d => d.standard === 'ADA 2010 Standards');
      expect(ada).toBeDefined();
      expect(ada?.type).toBe('accessibility');
      expect(ada?.version).toBe('2010');
    });
  });

  describe('isRegulatoryDocumentCached', () => {
    it('should return cached status when document exists', async () => {
      mockPrisma.regulatoryDocument.findFirst.mockResolvedValue({
        ...mockRegDoc,
        _count: { DocumentChunk: 50 },
      });

      const result = await isRegulatoryDocumentCached('ADA 2010 Standards', '2010');

      expect(result.cached).toBe(true);
      expect(result.regulatoryDocId).toBe('reg-doc-123');
      expect(result.chunkCount).toBe(50);
      expect(result.processorType).toBe('vision-ai');
    });

    it('should return not cached when document does not exist', async () => {
      mockPrisma.regulatoryDocument.findFirst.mockResolvedValue(null);

      const result = await isRegulatoryDocumentCached('IBC 2021', '2021');

      expect(result.cached).toBe(false);
      expect(result.regulatoryDocId).toBeUndefined();
    });

    it('should only match processed documents', async () => {
      mockPrisma.regulatoryDocument.findFirst.mockResolvedValue(null);

      await isRegulatoryDocumentCached('ADA 2010 Standards', '2010');

      expect(mockPrisma.regulatoryDocument.findFirst).toHaveBeenCalledWith({
        where: {
          standard: 'ADA 2010 Standards',
          version: '2010',
          processed: true,
        },
        select: expect.any(Object),
      });
    });
  });

  describe('linkRegulatoryDocumentToProject', () => {
    beforeEach(() => {
      // Reset all mocks
      vi.clearAllMocks();
      mockPrisma.regulatoryDocument.create.mockResolvedValue({
        ...mockRegDoc,
        id: 'project-reg-doc-123',
        projectId: 'project-123',
      });
      mockPrisma.documentChunk.create.mockResolvedValue({ id: 'new-chunk' } as any);
    });

    it('should link cached document to project', async () => {
      // First call: get regulatory doc with chunks
      mockPrisma.regulatoryDocument.findFirst
        .mockResolvedValueOnce({
          ...mockRegDoc,
          DocumentChunk: mockChunks,
        })
        // Second call: check if already linked
        .mockResolvedValueOnce(null);

      const result = await linkRegulatoryDocumentToProject(
        'project-123',
        'ADA 2010 Standards',
        '2010'
      );

      expect(result.success).toBe(true);
      expect(result.chunksLinked).toBe(2);
      expect(mockPrisma.regulatoryDocument.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'project-123',
          standard: 'ADA 2010 Standards',
          version: '2010',
          processingCost: 0,
        }),
      });
      expect(mockPrisma.documentChunk.create).toHaveBeenCalledTimes(2);
    });

    it('should return error if regulatory document not found', async () => {
      mockPrisma.regulatoryDocument.findFirst.mockResolvedValue(null);

      const result = await linkRegulatoryDocumentToProject('project-123', 'Unknown', '2023');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found or not processed');
    });

    it('should return error if document has no chunks', async () => {
      // First findFirst call returns document with no chunks
      mockPrisma.regulatoryDocument.findFirst.mockResolvedValueOnce({
        ...mockRegDoc,
        DocumentChunk: [],
      });

      const result = await linkRegulatoryDocumentToProject(
        'project-123',
        'ADA 2010 Standards',
        '2010'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('has no chunks');
    });

    it('should skip linking if already linked', async () => {
      // First call: get regulatory doc with chunks
      mockPrisma.regulatoryDocument.findFirst
        .mockResolvedValueOnce({
          ...mockRegDoc,
          DocumentChunk: mockChunks,
        })
        // Second call: existing link found
        .mockResolvedValueOnce({
          id: 'existing-link',
          projectId: 'project-123',
        });

      const result = await linkRegulatoryDocumentToProject(
        'project-123',
        'ADA 2010 Standards',
        '2010'
      );

      expect(result.success).toBe(true);
      expect(result.chunksLinked).toBe(2);
      expect(mockPrisma.regulatoryDocument.create).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // First call succeeds
      mockPrisma.regulatoryDocument.findFirst
        .mockResolvedValueOnce({
          ...mockRegDoc,
          DocumentChunk: mockChunks,
        })
        // Second call throws error
        .mockRejectedValueOnce(new Error('Database error'));

      const result = await linkRegulatoryDocumentToProject('project-123', 'ADA 2010 Standards', '2010');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('ensureRegulatoryDocumentForProject', () => {
    it('should return cached document if available', async () => {
      // First call from isRegulatoryDocumentCached
      mockPrisma.regulatoryDocument.findFirst
        .mockResolvedValueOnce({
          ...mockRegDoc,
          _count: { DocumentChunk: 50 },
        })
        // Second call from linkRegulatoryDocumentToProject - get document with chunks
        .mockResolvedValueOnce({
          ...mockRegDoc,
          DocumentChunk: mockChunks,
        })
        // Third call from linkRegulatoryDocumentToProject - check existing link
        .mockResolvedValueOnce(null);

      mockPrisma.regulatoryDocument.create.mockResolvedValue({
        ...mockRegDoc,
        id: 'new-doc',
        projectId: 'project-123',
      });
      mockPrisma.documentChunk.create.mockResolvedValue({ id: 'chunk' } as any);

      const result = await ensureRegulatoryDocumentForProject(
        'project-123',
        'ADA 2010 Standards',
        '2010'
      );

      expect(result.success).toBe(true);
      expect(result.cached).toBe(true);
      expect(result.chunksAvailable).toBe(2);
    });

    it('should indicate needs processing if not cached', async () => {
      mockPrisma.regulatoryDocument.findFirst.mockResolvedValue(null);

      const result = await ensureRegulatoryDocumentForProject('project-123', 'IBC 2021', '2021');

      expect(result.success).toBe(true);
      expect(result.cached).toBe(false);
      expect(result.needsProcessing).toBe(true);
    });

    it('should handle linking errors', async () => {
      mockPrisma.regulatoryDocument.findFirst
        .mockResolvedValueOnce({
          ...mockRegDoc,
          _count: { DocumentChunk: 50 },
        })
        .mockResolvedValueOnce({
          ...mockRegDoc,
          DocumentChunk: mockChunks,
        })
        .mockRejectedValueOnce(new Error('Link error'));

      const result = await ensureRegulatoryDocumentForProject(
        'project-123',
        'ADA 2010 Standards',
        '2010'
      );

      expect(result.success).toBe(false);
      expect(result.cached).toBe(true);
      expect(result.error).toBe('Link error');
    });
  });

  describe('getRegulatoryDocumentsStatus', () => {
    it('should return status for all available documents', async () => {
      mockPrisma.regulatoryDocument.findFirst
        .mockImplementation(async (options: any) => {
          const standard = options.where.standard;
          if (standard === 'ADA 2010 Standards') {
            return {
              id: 'ada-doc',
              _count: { DocumentChunk: 100 },
              processorType: 'vision-ai',
            } as any;
          } else if (standard === 'NFPA 101 2012') {
            return {
              id: 'nfpa-doc',
              _count: { DocumentChunk: 75 },
              processorType: 'vision-ai',
            } as any;
          }
          return null;
        });

      const statuses = await getRegulatoryDocumentsStatus();

      expect(statuses).toHaveLength(3); // ADA, IBC, NFPA
      expect(statuses[0].standard).toBe('ADA 2010 Standards');
      expect(statuses[0].cached).toBe(true);
      expect(statuses[0].chunkCount).toBe(100);
      const ibcStatus = statuses.find(s => s.standard === 'IBC 2021');
      expect(ibcStatus?.cached).toBe(false);
      expect(ibcStatus?.chunkCount).toBe(0);
    });
  });

  describe('initializeRegulatoryDocumentsForProject', () => {
    it('should initialize all available regulatory documents', async () => {
      // Track per-standard call count since Promise.all makes ordering non-deterministic
      const callCounts: Record<string, number> = {};
      mockPrisma.regulatoryDocument.findFirst.mockImplementation(async (options: any) => {
        const standard = options.where.standard;
        if (!standard) return null;
        callCounts[standard] = (callCounts[standard] || 0) + 1;
        const n = callCounts[standard];

        if (standard === 'ADA 2010 Standards') {
          if (n === 1) return { ...mockRegDoc, _count: { DocumentChunk: 50 } } as any;
          if (n === 2) return { ...mockRegDoc, DocumentChunk: mockChunks } as any;
          if (n === 3) return null;
        }
        if (standard === 'IBC 2021') {
          return null; // Not cached
        }
        if (standard === 'NFPA 101 2012') {
          if (n === 1) return { id: 'nfpa-doc', type: 'fire_code', jurisdiction: 'National', standard: 'NFPA 101 2012', version: '2012', sourceUrl: null, lastUpdated: new Date(), expiresAt: null, processed: true, processorType: 'vision-ai', processingCost: 3.0, pagesProcessed: 80, _count: { DocumentChunk: 40 } } as any;
          if (n === 2) return { id: 'nfpa-doc', type: 'fire_code', jurisdiction: 'National', standard: 'NFPA 101 2012', version: '2012', sourceUrl: null, lastUpdated: new Date(), expiresAt: null, processed: true, processorType: 'vision-ai', processingCost: 3.0, pagesProcessed: 80, DocumentChunk: mockChunks } as any;
          if (n === 3) return null;
        }
        return null;
      });

      mockPrisma.regulatoryDocument.create.mockResolvedValue({} as any);
      mockPrisma.documentChunk.create.mockResolvedValue({ id: 'chunk' } as any);

      const result = await initializeRegulatoryDocumentsForProject('project-123');

      expect(result.success).toBe(true);
      expect(result.documentsLinked).toBe(2); // ADA and NFPA
      expect(result.documentsNeedingProcessing).toBe(1); // IBC
      expect(result.details).toHaveLength(3);
    });

    it('should handle individual document errors', async () => {
      const callCounts: Record<string, number> = {};
      mockPrisma.regulatoryDocument.findFirst.mockImplementation(async (options: any) => {
        const standard = options.where.standard;
        if (!standard) return null;
        callCounts[standard] = (callCounts[standard] || 0) + 1;
        const n = callCounts[standard];

        if (standard === 'ADA 2010 Standards') {
          if (n === 1) return { ...mockRegDoc, _count: { DocumentChunk: 50 } } as any;
          if (n === 2) return { ...mockRegDoc, DocumentChunk: mockChunks } as any;
          if (n === 3) return null;
        }
        if (standard === 'IBC 2021') {
          throw new Error('Database error');
        }
        if (standard === 'NFPA 101 2012') {
          return null; // Not cached
        }
        return null;
      });

      mockPrisma.regulatoryDocument.create.mockResolvedValue({} as any);
      mockPrisma.documentChunk.create.mockResolvedValue({ id: 'chunk' } as any);

      const result = await initializeRegulatoryDocumentsForProject('project-123');

      expect(result.success).toBe(true);
      const errorDoc = result.details.find(d => d.status === 'error');
      expect(errorDoc).toBeDefined();
      expect(errorDoc?.error).toBe('Database error');
    });
  });

  describe('getProjectRegulatoryDocuments', () => {
    it('should return regulatory documents for project', async () => {
      mockPrisma.regulatoryDocument.findMany.mockResolvedValue([
        {
          ...mockRegDoc,
          projectId: 'project-123',
          _count: { DocumentChunk: 100 },
        },
      ]);

      const docs = await getProjectRegulatoryDocuments('project-123');

      expect(docs).toHaveLength(1);
      expect(docs[0].standard).toBe('ADA 2010 Standards');
      expect(mockPrisma.regulatoryDocument.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-123' },
        include: expect.any(Object),
      });
    });
  });

  describe('getRegulatoryDocumentStats', () => {
    it('should return stats for project regulatory documents', async () => {
      mockPrisma.regulatoryDocument.findMany.mockResolvedValue([
        { ...mockRegDoc, projectId: 'project-123', processed: true },
        { ...mockRegDoc, id: 'reg-2', projectId: 'project-123', processed: false },
      ]);
      mockPrisma.documentChunk.count.mockResolvedValue(150);

      const stats = await getRegulatoryDocumentStats('project-123');

      expect(stats.total).toBe(2);
      expect(stats.processed).toBe(1);
      expect(stats.totalChunks).toBe(150);
      expect(stats.totalCost).toBe(11); // 5.5 * 2
    });
  });

  describe('getApplicableRegulatoryCodes', () => {
    it('should return all available regulatory documents', () => {
      const codes = getApplicableRegulatoryCodes({
        state: 'CA',
        city: 'Los Angeles',
      });

      expect(codes.length).toBeGreaterThan(0);
      expect(codes[0].isFree).toBe(true);
    });
  });

  describe('getFreeRegulatoryCodes', () => {
    it('should return all available documents as free', () => {
      const codes = getFreeRegulatoryCodes({ state: 'CA' });

      expect(codes.length).toBeGreaterThan(0);
      expect(codes.every(c => c.isFree)).toBe(true);
    });
  });

  describe('calculateRegulatoryProcessingCost', () => {
    it('should return zero cost for cached documents', () => {
      const result = calculateRegulatoryProcessingCost([
        { standard: 'ADA 2010', version: '2010' },
      ]);

      expect(result.estimatedCost).toBe(0);
      expect(result.message).toContain('cached');
    });
  });

  describe('createRegulatoryDocuments', () => {
    it('should create regulatory documents for project', async () => {
      const callCounts: Record<string, number> = {};
      mockPrisma.regulatoryDocument.findFirst.mockImplementation(async (options: any) => {
        const standard = options.where.standard;
        if (!standard) return null;
        callCounts[standard] = (callCounts[standard] || 0) + 1;
        const n = callCounts[standard];
        // ADA cached: 3 calls (cache check, get chunks, check link)
        if (standard === 'ADA 2010 Standards') {
          if (n === 1) return { ...mockRegDoc, _count: { DocumentChunk: 50 } } as any;
          if (n === 2) return { ...mockRegDoc, DocumentChunk: mockChunks } as any;
          if (n === 3) return null; // No existing link
        }
        // IBC not cached
        if (standard === 'IBC 2021') {
          return null;
        }
        return null;
      });

      mockPrisma.regulatoryDocument.create.mockResolvedValue({
        ...mockRegDoc,
        projectId: 'project-123',
      });
      mockPrisma.documentChunk.create.mockResolvedValue({ id: 'chunk' } as any);

      const results = await createRegulatoryDocuments('project-123', [
        { standard: 'ADA 2010 Standards', version: '2010' },
        { standard: 'IBC 2021', version: '2021' },
      ]);

      expect(results).toHaveLength(2);
      // @ts-expect-error strictNullChecks migration
      expect(results[0].success).toBe(true);
      // @ts-expect-error strictNullChecks migration
      expect(results[0].cached).toBe(true);
      // @ts-expect-error strictNullChecks migration
      expect(results[1].success).toBe(true);
      // @ts-expect-error strictNullChecks migration
      expect(results[1].needsProcessing).toBe(true);
    });

    it('should handle creation errors', async () => {
      // First call: cache check succeeds
      mockPrisma.regulatoryDocument.findFirst
        .mockResolvedValueOnce({
          ...mockRegDoc,
          _count: { DocumentChunk: 50 },
        })
        // Second call: get chunks succeeds
        .mockResolvedValueOnce({
          ...mockRegDoc,
          DocumentChunk: mockChunks,
        })
        // Third call: check existing link throws error
        .mockRejectedValueOnce(new Error('Database error'));

      const results = await createRegulatoryDocuments('project-123', [
        { standard: 'ADA 2010 Standards', version: '2010' },
      ]);

      // @ts-expect-error strictNullChecks migration
      expect(results[0].success).toBe(false);
      // @ts-expect-error strictNullChecks migration
      expect(results[0].error).toBe('Database error');
    });
  });
});
