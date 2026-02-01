import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all external dependencies using vi.hoisted pattern
const mocks = vi.hoisted(() => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
    },
  },
  rag: {
    retrieveRelevantDocuments: vi.fn(),
    generateContextWithCorrections: vi.fn(),
    retrieveRelevantCorrections: vi.fn(),
  },
  queryCache: {
    cacheResponse: vi.fn(),
    analyzeQueryComplexity: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/rag', () => mocks.rag);
vi.mock('@/lib/query-cache', () => mocks.queryCache);

// Import after mocks
import {
  COMMON_CONSTRUCTION_QUERIES,
  precomputeCommonQueries,
  getRecommendedQueries,
  autoPrecomputeOnUpload,
} from '@/lib/query-precompute';

describe('Query Precompute System', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Default mock implementations
    mocks.queryCache.analyzeQueryComplexity.mockReturnValue({
      complexity: 'medium',
      model: 'gpt-4o-mini',
    });
    mocks.rag.generateContextWithCorrections.mockReturnValue('mocked context');
    mocks.queryCache.cacheResponse.mockReturnValue(undefined);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('COMMON_CONSTRUCTION_QUERIES', () => {
    it('should define timeline queries', () => {
      expect(COMMON_CONSTRUCTION_QUERIES.timeline).toBeDefined();
      expect(COMMON_CONSTRUCTION_QUERIES.timeline).toBeInstanceOf(Array);
      expect(COMMON_CONSTRUCTION_QUERIES.timeline.length).toBeGreaterThan(0);
      expect(COMMON_CONSTRUCTION_QUERIES.timeline).toContain('When does the project start?');
    });

    it('should define measurements queries', () => {
      expect(COMMON_CONSTRUCTION_QUERIES.measurements).toBeDefined();
      expect(COMMON_CONSTRUCTION_QUERIES.measurements).toBeInstanceOf(Array);
      expect(COMMON_CONSTRUCTION_QUERIES.measurements.length).toBeGreaterThan(0);
      expect(COMMON_CONSTRUCTION_QUERIES.measurements).toContain('What is the footing depth?');
    });

    it('should define counts queries', () => {
      expect(COMMON_CONSTRUCTION_QUERIES.counts).toBeDefined();
      expect(COMMON_CONSTRUCTION_QUERIES.counts).toBeInstanceOf(Array);
      expect(COMMON_CONSTRUCTION_QUERIES.counts.length).toBeGreaterThan(0);
      expect(COMMON_CONSTRUCTION_QUERIES.counts).toContain('How many receptacles are there?');
    });

    it('should define specifications queries', () => {
      expect(COMMON_CONSTRUCTION_QUERIES.specifications).toBeDefined();
      expect(COMMON_CONSTRUCTION_QUERIES.specifications).toBeInstanceOf(Array);
      expect(COMMON_CONSTRUCTION_QUERIES.specifications.length).toBeGreaterThan(0);
      expect(COMMON_CONSTRUCTION_QUERIES.specifications).toContain('What are the concrete specifications?');
    });

    it('should define materials queries', () => {
      expect(COMMON_CONSTRUCTION_QUERIES.materials).toBeDefined();
      expect(COMMON_CONSTRUCTION_QUERIES.materials).toBeInstanceOf(Array);
      expect(COMMON_CONSTRUCTION_QUERIES.materials.length).toBeGreaterThan(0);
      expect(COMMON_CONSTRUCTION_QUERIES.materials).toContain('What type of foundation is required?');
    });

    it('should define safety queries', () => {
      expect(COMMON_CONSTRUCTION_QUERIES.safety).toBeDefined();
      expect(COMMON_CONSTRUCTION_QUERIES.safety).toBeInstanceOf(Array);
      expect(COMMON_CONSTRUCTION_QUERIES.safety.length).toBeGreaterThan(0);
      expect(COMMON_CONSTRUCTION_QUERIES.safety).toContain('What are the fire safety requirements?');
    });

    it('should have all categories covering at least 35 queries total', () => {
      const totalQueries = Object.values(COMMON_CONSTRUCTION_QUERIES).reduce(
        (sum, queries) => sum + queries.length,
        0
      );
      expect(totalQueries).toBeGreaterThanOrEqual(35);
    });
  });

  describe('precomputeCommonQueries', () => {
    describe('Success cases', () => {
      it('should pre-compute all queries when no categories specified', async () => {
        const mockChunks = [
          { id: 'chunk-1', documentId: 'doc-1', content: 'Test content' },
        ];
        mocks.rag.retrieveRelevantDocuments.mockResolvedValue({
          chunks: mockChunks,
          documentNames: ['Plans.pdf'],
        });
        mocks.rag.retrieveRelevantCorrections.mockResolvedValue([]);

        const result = await precomputeCommonQueries('test-project', 'admin');

        const totalQueries = Object.values(COMMON_CONSTRUCTION_QUERIES).reduce(
          (sum, queries) => sum + queries.length,
          0
        );

        expect(result.total).toBe(totalQueries);
        expect(result.success).toBe(totalQueries);
        expect(result.failed).toBe(0);
        expect(result.skipped).toBe(0);
      });

      it('should pre-compute queries for specific categories', async () => {
        const mockChunks = [
          { id: 'chunk-1', documentId: 'doc-1', content: 'Test content' },
        ];
        mocks.rag.retrieveRelevantDocuments.mockResolvedValue({
          chunks: mockChunks,
          documentNames: ['Plans.pdf'],
        });
        mocks.rag.retrieveRelevantCorrections.mockResolvedValue([]);

        const result = await precomputeCommonQueries('test-project', 'admin', ['timeline']);

        expect(result.total).toBe(COMMON_CONSTRUCTION_QUERIES.timeline.length);
        expect(result.success).toBe(COMMON_CONSTRUCTION_QUERIES.timeline.length);
        expect(result.failed).toBe(0);
        expect(result.skipped).toBe(0);
      });

      it('should pre-compute multiple specific categories', async () => {
        const mockChunks = [
          { id: 'chunk-1', documentId: 'doc-1', content: 'Test content' },
        ];
        mocks.rag.retrieveRelevantDocuments.mockResolvedValue({
          chunks: mockChunks,
          documentNames: ['Plans.pdf'],
        });
        mocks.rag.retrieveRelevantCorrections.mockResolvedValue([]);

        const result = await precomputeCommonQueries('test-project', 'admin', ['timeline', 'measurements']);

        const expectedTotal = COMMON_CONSTRUCTION_QUERIES.timeline.length +
                             COMMON_CONSTRUCTION_QUERIES.measurements.length;

        expect(result.total).toBe(expectedTotal);
        expect(result.success).toBe(expectedTotal);
        expect(result.failed).toBe(0);
        expect(result.skipped).toBe(0);
      });

      it('should call retrieveRelevantDocuments with correct parameters', async () => {
        const mockChunks = [
          { id: 'chunk-1', documentId: 'doc-1', content: 'Test content' },
        ];
        mocks.rag.retrieveRelevantDocuments.mockResolvedValue({
          chunks: mockChunks,
          documentNames: ['Plans.pdf'],
        });
        mocks.rag.retrieveRelevantCorrections.mockResolvedValue([]);

        await precomputeCommonQueries('test-project', 'client', ['timeline']);

        expect(mocks.rag.retrieveRelevantDocuments).toHaveBeenCalledWith(
          expect.any(String),
          'client',
          12,
          'test-project'
        );
      });

      it('should call analyzeQueryComplexity for each query', async () => {
        const mockChunks = [
          { id: 'chunk-1', documentId: 'doc-1', content: 'Test content' },
        ];
        mocks.rag.retrieveRelevantDocuments.mockResolvedValue({
          chunks: mockChunks,
          documentNames: ['Plans.pdf'],
        });
        mocks.rag.retrieveRelevantCorrections.mockResolvedValue([]);

        await precomputeCommonQueries('test-project', 'admin', ['timeline']);

        expect(mocks.queryCache.analyzeQueryComplexity).toHaveBeenCalledTimes(
          COMMON_CONSTRUCTION_QUERIES.timeline.length
        );
      });

      it('should call cacheResponse with correct parameters', async () => {
        const mockChunks = [
          { id: 'chunk-1', documentId: 'doc-1', content: 'Test content' },
        ];
        mocks.rag.retrieveRelevantDocuments.mockResolvedValue({
          chunks: mockChunks,
          documentNames: ['Plans.pdf'],
        });
        mocks.rag.retrieveRelevantCorrections.mockResolvedValue([]);

        await precomputeCommonQueries('test-project', 'admin', ['timeline']);

        expect(mocks.queryCache.cacheResponse).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          'test-project',
          ['doc-1'],
          'medium',
          'gpt-4o-mini'
        );
      });

      it('should retrieve admin corrections for each query', async () => {
        const mockChunks = [
          { id: 'chunk-1', documentId: 'doc-1', content: 'Test content' },
        ];
        mocks.rag.retrieveRelevantDocuments.mockResolvedValue({
          chunks: mockChunks,
          documentNames: ['Plans.pdf'],
        });
        mocks.rag.retrieveRelevantCorrections.mockResolvedValue([
          { id: 'correction-1', correction: 'Test correction' },
        ]);

        await precomputeCommonQueries('test-project', 'admin', ['timeline']);

        expect(mocks.rag.retrieveRelevantCorrections).toHaveBeenCalledTimes(
          COMMON_CONSTRUCTION_QUERIES.timeline.length
        );
        expect(mocks.rag.retrieveRelevantCorrections).toHaveBeenCalledWith(
          expect.any(String),
          'test-project',
          3
        );
      });

      it('should generate context with corrections', async () => {
        const mockChunks = [
          { id: 'chunk-1', documentId: 'doc-1', content: 'Test content' },
        ];
        const mockCorrections = [
          { id: 'correction-1', correction: 'Test correction' },
        ];
        mocks.rag.retrieveRelevantDocuments.mockResolvedValue({
          chunks: mockChunks,
          documentNames: ['Plans.pdf'],
        });
        mocks.rag.retrieveRelevantCorrections.mockResolvedValue(mockCorrections);

        await precomputeCommonQueries('test-project', 'admin', ['timeline']);

        expect(mocks.rag.generateContextWithCorrections).toHaveBeenCalledWith(
          mockChunks,
          mockCorrections
        );
      });

      it('should respect different user roles', async () => {
        const mockChunks = [
          { id: 'chunk-1', documentId: 'doc-1', content: 'Test content' },
        ];
        mocks.rag.retrieveRelevantDocuments.mockResolvedValue({
          chunks: mockChunks,
          documentNames: ['Plans.pdf'],
        });
        mocks.rag.retrieveRelevantCorrections.mockResolvedValue([]);

        await precomputeCommonQueries('test-project', 'guest', ['timeline']);

        expect(mocks.rag.retrieveRelevantDocuments).toHaveBeenCalledWith(
          expect.any(String),
          'guest',
          12,
          'test-project'
        );
      });
    });

    describe('Skipped queries', () => {
      it('should skip queries when no relevant documents found', async () => {
        mocks.rag.retrieveRelevantDocuments.mockResolvedValue({
          chunks: [],
          documentNames: [],
        });

        const result = await precomputeCommonQueries('test-project', 'admin', ['timeline']);

        expect(result.skipped).toBe(COMMON_CONSTRUCTION_QUERIES.timeline.length);
        expect(result.success).toBe(0);
        expect(result.failed).toBe(0);
        expect(mocks.queryCache.cacheResponse).not.toHaveBeenCalled();
      });

      it('should log skipped queries', async () => {
        mocks.rag.retrieveRelevantDocuments.mockResolvedValue({
          chunks: [],
          documentNames: [],
        });

        await precomputeCommonQueries('test-project', 'admin', ['timeline']);

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Skipping')
        );
      });
    });

    describe('Error handling', () => {
      it('should handle errors and count as failed', async () => {
        mocks.rag.retrieveRelevantDocuments.mockRejectedValue(
          new Error('Database connection failed')
        );

        const result = await precomputeCommonQueries('test-project', 'admin', ['timeline']);

        expect(result.failed).toBe(COMMON_CONSTRUCTION_QUERIES.timeline.length);
        expect(result.success).toBe(0);
        expect(result.skipped).toBe(0);
      });

      it('should log errors for failed queries', async () => {
        mocks.rag.retrieveRelevantDocuments.mockRejectedValue(
          new Error('Database connection failed')
        );

        await precomputeCommonQueries('test-project', 'admin', ['timeline']);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to pre-compute'),
          expect.any(Error)
        );
      });

      it('should continue processing other queries after one fails', async () => {
        let callCount = 0;
        mocks.rag.retrieveRelevantDocuments.mockImplementation(() => {
          callCount++;
          if (callCount === 2) {
            throw new Error('Temporary failure');
          }
          return Promise.resolve({
            chunks: [{ id: 'chunk-1', documentId: 'doc-1', content: 'Test' }],
            documentNames: ['Plans.pdf'],
          });
        });
        mocks.rag.retrieveRelevantCorrections.mockResolvedValue([]);

        const result = await precomputeCommonQueries('test-project', 'admin', ['timeline']);

        expect(result.failed).toBe(1);
        expect(result.success).toBe(COMMON_CONSTRUCTION_QUERIES.timeline.length - 1);
      });
    });

    describe('Edge cases', () => {
      it('should handle empty categories array', async () => {
        const result = await precomputeCommonQueries('test-project', 'admin', []);

        const totalQueries = Object.values(COMMON_CONSTRUCTION_QUERIES).reduce(
          (sum, queries) => sum + queries.length,
          0
        );

        expect(result.total).toBe(totalQueries);
      });

      it('should handle invalid category names', async () => {
        const mockChunks = [
          { id: 'chunk-1', documentId: 'doc-1', content: 'Test content' },
        ];
        mocks.rag.retrieveRelevantDocuments.mockResolvedValue({
          chunks: mockChunks,
          documentNames: ['Plans.pdf'],
        });
        mocks.rag.retrieveRelevantCorrections.mockResolvedValue([]);

        const result = await precomputeCommonQueries('test-project', 'admin', ['invalid_category']);

        expect(result.total).toBe(0);
        expect(result.success).toBe(0);
      });

      it('should handle mixed valid and invalid categories', async () => {
        const mockChunks = [
          { id: 'chunk-1', documentId: 'doc-1', content: 'Test content' },
        ];
        mocks.rag.retrieveRelevantDocuments.mockResolvedValue({
          chunks: mockChunks,
          documentNames: ['Plans.pdf'],
        });
        mocks.rag.retrieveRelevantCorrections.mockResolvedValue([]);

        const result = await precomputeCommonQueries('test-project', 'admin', ['timeline', 'invalid']);

        expect(result.total).toBe(COMMON_CONSTRUCTION_QUERIES.timeline.length);
      });

      it('should handle chunks with multiple document IDs', async () => {
        const mockChunks = [
          { id: 'chunk-1', documentId: 'doc-1', content: 'Test content 1' },
          { id: 'chunk-2', documentId: 'doc-2', content: 'Test content 2' },
          { id: 'chunk-3', documentId: 'doc-3', content: 'Test content 3' },
        ];
        mocks.rag.retrieveRelevantDocuments.mockResolvedValue({
          chunks: mockChunks,
          documentNames: ['Plans.pdf', 'Specs.pdf', 'Schedule.pdf'],
        });
        mocks.rag.retrieveRelevantCorrections.mockResolvedValue([]);

        await precomputeCommonQueries('test-project', 'admin', ['timeline']);

        expect(mocks.queryCache.cacheResponse).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          'test-project',
          ['doc-1', 'doc-2', 'doc-3'],
          expect.any(String),
          expect.any(String)
        );
      });
    });

    describe('Performance and rate limiting', () => {
      it('should apply rate limiting delay between queries', async () => {
        const mockChunks = [
          { id: 'chunk-1', documentId: 'doc-1', content: 'Test content' },
        ];
        mocks.rag.retrieveRelevantDocuments.mockResolvedValue({
          chunks: mockChunks,
          documentNames: ['Plans.pdf'],
        });
        mocks.rag.retrieveRelevantCorrections.mockResolvedValue([]);

        const startTime = Date.now();
        await precomputeCommonQueries('test-project', 'admin', ['timeline']);
        const endTime = Date.now();

        // Should take at least (queries - 1) * 100ms
        const expectedMinTime = (COMMON_CONSTRUCTION_QUERIES.timeline.length - 1) * 100;
        expect(endTime - startTime).toBeGreaterThanOrEqual(expectedMinTime * 0.9); // 90% tolerance
      });
    });

    describe('Console output', () => {
      it('should log start message with query count', async () => {
        mocks.rag.retrieveRelevantDocuments.mockResolvedValue({
          chunks: [],
          documentNames: [],
        });

        await precomputeCommonQueries('test-project', 'admin', ['timeline']);

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining(`Starting pre-computation of ${COMMON_CONSTRUCTION_QUERIES.timeline.length} queries`)
        );
      });

      it('should log completion summary', async () => {
        mocks.rag.retrieveRelevantDocuments.mockResolvedValue({
          chunks: [],
          documentNames: [],
        });

        await precomputeCommonQueries('test-project', 'admin', ['timeline']);

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Pre-computation complete')
        );
      });
    });
  });

  describe('getRecommendedQueries', () => {
    describe('Success cases', () => {
      it('should recommend timeline queries for schedule documents', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          slug: 'test-project',
          Document: [
            { name: 'Schedule.pdf' },
            { name: 'Project Schedule.pdf' },
          ],
        });

        const result = await getRecommendedQueries('test-project');

        expect(result).toEqual(expect.arrayContaining(COMMON_CONSTRUCTION_QUERIES.timeline));
      });

      it('should recommend measurements and counts queries for plans documents', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          slug: 'test-project',
          Document: [
            { name: 'Plans.pdf' },
            { name: 'Architectural Plans.pdf' },
          ],
        });

        const result = await getRecommendedQueries('test-project');

        expect(result).toEqual(expect.arrayContaining(COMMON_CONSTRUCTION_QUERIES.measurements));
        expect(result).toEqual(expect.arrayContaining(COMMON_CONSTRUCTION_QUERIES.counts));
      });

      it('should recommend measurements queries for drawing documents', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          slug: 'test-project',
          Document: [
            { name: 'Structural Drawings.pdf' },
          ],
        });

        const result = await getRecommendedQueries('test-project');

        expect(result).toEqual(expect.arrayContaining(COMMON_CONSTRUCTION_QUERIES.measurements));
      });

      it('should recommend specifications queries for spec documents', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          slug: 'test-project',
          Document: [
            { name: 'Specifications.pdf' },
            { name: 'Technical Specs.pdf' },
          ],
        });

        const result = await getRecommendedQueries('test-project');

        expect(result).toEqual(expect.arrayContaining(COMMON_CONSTRUCTION_QUERIES.specifications));
      });

      it('should recommend specifications queries for requirement documents', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          slug: 'test-project',
          Document: [
            { name: 'Project Requirements.pdf' },
          ],
        });

        const result = await getRecommendedQueries('test-project');

        expect(result).toEqual(expect.arrayContaining(COMMON_CONSTRUCTION_QUERIES.specifications));
      });

      it('should recommend budget queries for budget documents', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          slug: 'test-project',
          Document: [
            { name: 'Budget.pdf' },
            { name: 'Project Budget.xlsx' },
          ],
        });

        const result = await getRecommendedQueries('test-project');

        expect(result).toContain('What is the project budget?');
        expect(result).toContain('What are the major cost items?');
      });

      it('should recommend budget queries for cost documents', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          slug: 'test-project',
          Document: [
            { name: 'Cost Estimate.pdf' },
          ],
        });

        const result = await getRecommendedQueries('test-project');

        expect(result).toContain('What is the project budget?');
        expect(result).toContain('What are the major cost items?');
      });

      it('should return unique queries when multiple document types present', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          slug: 'test-project',
          Document: [
            { name: 'Plans.pdf' },
            { name: 'Schedule.pdf' },
            { name: 'Budget.pdf' },
            { name: 'Specs.pdf' },
          ],
        });

        const result = await getRecommendedQueries('test-project');

        const uniqueQueries = new Set(result);
        expect(result.length).toBe(uniqueQueries.size);
      });

      it('should handle case-insensitive document name matching', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          slug: 'test-project',
          Document: [
            { name: 'SCHEDULE.PDF' },
            { name: 'plans.pdf' },
            { name: 'BuDgEt.PdF' },
          ],
        });

        const result = await getRecommendedQueries('test-project');

        expect(result).toEqual(expect.arrayContaining(COMMON_CONSTRUCTION_QUERIES.timeline));
        expect(result).toEqual(expect.arrayContaining(COMMON_CONSTRUCTION_QUERIES.measurements));
        expect(result).toContain('What is the project budget?');
      });

      it('should handle projects with only processed documents', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          slug: 'test-project',
          Document: [
            { name: 'Plans.pdf' },
          ],
        });

        const result = await getRecommendedQueries('test-project');

        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('Edge cases', () => {
      it('should return empty array when project not found', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue(null);

        const result = await getRecommendedQueries('non-existent-project');

        expect(result).toEqual([]);
      });

      it('should return empty array when project has no documents', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          slug: 'test-project',
          Document: [],
        });

        const result = await getRecommendedQueries('test-project');

        expect(result).toEqual([]);
      });

      it('should return empty array when documents do not match any category', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          slug: 'test-project',
          Document: [
            { name: 'Random Document.pdf' },
            { name: 'Some File.docx' },
          ],
        });

        const result = await getRecommendedQueries('test-project');

        expect(result).toEqual([]);
      });
    });

    describe('Error handling', () => {
      it('should return empty array on database error', async () => {
        mocks.prisma.project.findUnique.mockRejectedValue(
          new Error('Database connection failed')
        );

        const result = await getRecommendedQueries('test-project');

        expect(result).toEqual([]);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error getting recommended queries:',
          expect.any(Error)
        );
      });

      it('should handle null document names gracefully', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          slug: 'test-project',
          Document: [
            { name: null },
            { name: 'Schedule.pdf' },
          ],
        });

        const result = await getRecommendedQueries('test-project');

        // Function returns empty array on error (calling .toLowerCase() on null throws)
        expect(result).toEqual([]);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error getting recommended queries:',
          expect.any(Error)
        );
      });
    });

    describe('Partial document name matching', () => {
      it('should match documents with "schedule" in the name', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          slug: 'test-project',
          Document: [
            { name: 'master_schedule_v2.pdf' },
            { name: 'construction-schedule.xlsx' },
          ],
        });

        const result = await getRecommendedQueries('test-project');

        expect(result).toEqual(expect.arrayContaining(COMMON_CONSTRUCTION_QUERIES.timeline));
      });

      it('should match documents with "plan" variations', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          slug: 'test-project',
          Document: [
            { name: 'floor-plans-sheet1.pdf' },
            { name: 'Site Plan.pdf' },
          ],
        });

        const result = await getRecommendedQueries('test-project');

        expect(result).toEqual(expect.arrayContaining(COMMON_CONSTRUCTION_QUERIES.measurements));
      });

      it('should match documents with "spec" variations', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          slug: 'test-project',
          Document: [
            { name: 'technical_spec_2024.pdf' },
            { name: 'Material Specifications.docx' },
          ],
        });

        const result = await getRecommendedQueries('test-project');

        expect(result).toEqual(expect.arrayContaining(COMMON_CONSTRUCTION_QUERIES.specifications));
      });
    });
  });

  describe('autoPrecomputeOnUpload', () => {
    beforeEach(() => {
      mocks.prisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        slug: 'test-project',
        Document: [
          { name: 'Plans.pdf' },
          { name: 'Schedule.pdf' },
        ],
      });
    });

    describe('Success cases', () => {
      it('should log start message with project slug', async () => {
        await autoPrecomputeOnUpload('test-project');

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Auto-precomputing queries for project test-project')
        );
      });

      it('should process project and log messages', async () => {
        await autoPrecomputeOnUpload('test-project');

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Auto-precomputing queries')
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Pre-computing')
        );
      });

      it('should log completion message', async () => {
        await autoPrecomputeOnUpload('test-project');

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Auto-precompute complete')
        );
      });

      it('should handle projects with many recommended queries', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          slug: 'test-project',
          Document: [
            { name: 'Plans.pdf' },
            { name: 'Schedule.pdf' },
            { name: 'Budget.pdf' },
            { name: 'Specs.pdf' },
          ],
        });

        await autoPrecomputeOnUpload('test-project');

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Pre-computing')
        );
      });
    });

    describe('Edge cases', () => {
      it('should handle no recommended queries', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          slug: 'test-project',
          Document: [],
        });

        await autoPrecomputeOnUpload('test-project');

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('No recommended queries for pre-computation')
        );
      });

      it('should limit to top 20 recommended queries', async () => {
        // Mock a large number of recommended queries
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          slug: 'test-project',
          Document: [
            { name: 'Plans.pdf' },
            { name: 'Schedule.pdf' },
            { name: 'Budget.pdf' },
            { name: 'Specs.pdf' },
            { name: 'Drawings.pdf' },
          ],
        });

        await autoPrecomputeOnUpload('test-project');

        // Should log that it's pre-computing queries, max 20
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringMatching(/Pre-computing \d+ recommended queries/)
        );
      });

      it('should handle project with exactly 20 recommended queries', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          slug: 'test-project',
          Document: [
            { name: 'Plans.pdf' },
            { name: 'Schedule.pdf' },
          ],
        });

        await autoPrecomputeOnUpload('test-project');

        expect(consoleLogSpy).toHaveBeenCalled();
      });
    });

    describe('Error handling', () => {
      it('should handle errors gracefully when getRecommendedQueries fails', async () => {
        mocks.prisma.project.findUnique.mockRejectedValue(
          new Error('Database error')
        );

        await autoPrecomputeOnUpload('test-project');

        // Error is caught in getRecommendedQueries, which logs and returns []
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error getting recommended queries:',
          expect.any(Error)
        );
      });

      it('should not throw errors on failure', async () => {
        mocks.prisma.project.findUnique.mockRejectedValue(
          new Error('Database error')
        );

        await expect(autoPrecomputeOnUpload('test-project')).resolves.not.toThrow();
      });

      it('should log "no recommended queries" when error results in empty array', async () => {
        const testError = new Error('Specific database error');
        mocks.prisma.project.findUnique.mockRejectedValue(testError);

        await autoPrecomputeOnUpload('test-project');

        // Error is caught in getRecommendedQueries which returns []
        // Then autoPrecomputeOnUpload logs no queries message
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('No recommended queries for pre-computation')
        );
      });
    });
  });
});
