import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Hoisted mocks (must be defined before imports)
// ============================================

const mockPrisma = vi.hoisted(() => ({
  document: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  documentChunk: {
    findMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
  processingQueue: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  processingCost: {
    create: vi.fn().mockResolvedValue({ id: 'cost-1', documentId: 'doc-456', pages: 1, cost: 1 }),
  },
  project: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  sheetLegend: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  titleBlockData: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  drawingCrossReference: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  adminCorrection: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  $transaction: vi.fn().mockImplementation(async (callback: any) => {
    return callback(mockPrisma);
  }),
}));

const mockGetFileUrl = vi.hoisted(() => vi.fn());
const mockDownloadFile = vi.hoisted(() => vi.fn());
const mockMammothExtract = vi.hoisted(() => vi.fn());
const mockClassifyDocument = vi.hoisted(() => vi.fn());
const mockCanProcessDocument = vi.hoisted(() => vi.fn());
const mockCalculateProcessingCost = vi.hoisted(() => vi.fn());
const mockExtractTitleBlock = vi.hoisted(() => vi.fn());
const mockStoreTitleBlockData = vi.hoisted(() => vi.fn());
const mockMarkDocumentProcessed = vi.hoisted(() => vi.fn());
const mockClassifyDrawingWithPatterns = vi.hoisted(() => vi.fn());
const mockStoreDrawingClassification = vi.hoisted(() => vi.fn());
const mockConvertSinglePage = vi.hoisted(() => vi.fn());
const mockConvertPdfToImages = vi.hoisted(() => vi.fn());
const mockProcessDocumentBatch = vi.hoisted(() => vi.fn());
const mockTwoPassRetrieval = vi.hoisted(() => vi.fn());
const mockBundleCrossReferences = vi.hoisted(() => vi.fn());
const mockGenerateEnhancedContext = vi.hoisted(() => vi.fn());
const mockClassifyQueryIntent = vi.hoisted(() => vi.fn());
const mockShouldUseWebSearch = vi.hoisted(() => vi.fn());
const mockPerformWebSearch = vi.hoisted(() => vi.fn());
const mockGetAccessibleDocuments = vi.hoisted(() => vi.fn());
const mockClassifyQuery = vi.hoisted(() => vi.fn());

// ============================================
// vi.mock declarations
// ============================================

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/s3', () => ({
  getFileUrl: mockGetFileUrl,
  downloadFile: mockDownloadFile,
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
}));

vi.mock('mammoth', () => ({
  default: { extractRawText: mockMammothExtract },
  extractRawText: mockMammothExtract,
}));

vi.mock('@/lib/document-classifier', () => ({
  classifyDocument: mockClassifyDocument,
  ProcessorType: { TEXT: 'text', VISION: 'vision' },
}));

vi.mock('@/lib/processing-limits', () => ({
  calculateProcessingCost: mockCalculateProcessingCost,
  canProcessDocument: mockCanProcessDocument,
  getRemainingPages: vi.fn().mockReturnValue(1000),
  shouldResetQuota: vi.fn().mockReturnValue(false),
  getNextResetDate: vi.fn().mockReturnValue(new Date()),
  getProcessingLimits: vi.fn().mockReturnValue({ pagesPerMonth: 2000 }),
}));

vi.mock('@/lib/title-block-extractor', () => ({
  extractTitleBlock: mockExtractTitleBlock,
  storeTitleBlockData: mockStoreTitleBlockData,
}));

vi.mock('@/lib/onboarding-tracker', () => ({
  markDocumentProcessed: mockMarkDocumentProcessed,
  markDocumentUploaded: vi.fn(),
}));

vi.mock('@/lib/drawing-classifier', () => ({
  classifyDrawingWithPatterns: mockClassifyDrawingWithPatterns,
  storeDrawingClassification: mockStoreDrawingClassification,
}));

vi.mock('@/lib/pdf-to-image', () => ({
  convertSinglePage: mockConvertSinglePage,
  convertPdfToImages: mockConvertPdfToImages,
}));

vi.mock('@/lib/document-processor-batch', () => ({
  processDocumentBatch: mockProcessDocumentBatch,
}));

vi.mock('@/lib/document-processing-queue', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/document-processing-queue')>();
  return {
    ...original,
    processNextQueuedBatch: vi.fn(),
  };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createScopedLogger: vi.fn(() => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  })),
}));

vi.mock('@/lib/rag-enhancements', () => ({
  twoPassRetrieval: mockTwoPassRetrieval,
  bundleCrossReferences: mockBundleCrossReferences,
  generateEnhancedContext: mockGenerateEnhancedContext,
  classifyQueryIntent: mockClassifyQueryIntent.mockReturnValue({
    type: 'general',
    confidence: 0.8,
    reasoning: 'General construction query',
  }),
  detectMultipleScales: vi.fn().mockReturnValue({
    documentId: '',
    sheetNumber: 'Unknown',
    defaultScale: { scale: 'Not specified', scaleType: 'unknown', scaleFactor: 1, source: 'title_block', confidence: 'low' },
    additionalScales: [],
    scaleWarnings: [],
  }),
  detectScaleBar: vi.fn().mockReturnValue({ detected: false }),
  expandAbbreviations: vi.fn().mockImplementation((text: string) => text),
  extractGridReferences: vi.fn().mockReturnValue([]),
  generateSpatialContext: vi.fn().mockReturnValue(''),
  CONSTRUCTION_ABBREVIATIONS: {},
  reconstructSystemTopology: vi.fn().mockReturnValue(null),
  interpretIsometricView: vi.fn().mockReturnValue(null),
  detectAdvancedConflicts: vi.fn().mockReturnValue([]),
  learnProjectSymbols: vi.fn().mockResolvedValue([]),
  applyLearnedSymbols: vi.fn().mockImplementation((chunks: any[]) => chunks),
}));

vi.mock('@/lib/rag', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/rag')>();
  return {
    ...original,
    enrichWithPhaseAMetadata: vi.fn().mockImplementation((chunks: any[]) => chunks),
    generateContextWithPhase3: vi.fn().mockReturnValue(''),
    retrieveRelevantCorrections: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('@/lib/web-search', () => ({
  shouldUseWebSearch: mockShouldUseWebSearch.mockReturnValue(false),
  performWebSearch: mockPerformWebSearch,
  formatWebResultsForContext: vi.fn().mockReturnValue(''),
}));

vi.mock('@/lib/access-control', () => ({
  getAccessibleDocuments: mockGetAccessibleDocuments,
}));

vi.mock('@/lib/chat/utils/query-classifier', () => ({
  classifyQuery: mockClassifyQuery.mockReturnValue({
    type: 'general',
    retrievalLimit: 12,
    confidence: 0.8,
  }),
}));

// ============================================
// Imports (after all mocks)
// ============================================

import { performQualityCheck, isBlankPage } from '@/lib/vision-api-quality';
import { queueDocumentForProcessing } from '@/lib/document-processing-queue';
import { retrieveRelevantDocuments } from '@/lib/rag';
import { buildContext } from '@/lib/chat/processors/context-builder';
import { processDocument } from '@/lib/document-processor';

// ============================================
// Test Data
// ============================================

const TEST_PROJECT_SLUG = 'test-project';
const TEST_PROJECT_ID = 'project-123';
const TEST_DOCUMENT_ID = 'doc-456';
const TEST_USER_ID = 'user-789';

const constructionChunks = [
  {
    id: 'chunk-1',
    documentId: TEST_DOCUMENT_ID,
    content: 'Section 03 30 00 - Cast-in-Place Concrete. Compressive strength shall be 4000 psi at 28 days.',
    chunkIndex: 0,
    pageNumber: 1,
    metadata: {},
  },
  {
    id: 'chunk-2',
    documentId: TEST_DOCUMENT_ID,
    content: 'Section 05 12 00 - Structural Steel Framing. All steel shall conform to ASTM A992 Grade 50.',
    chunkIndex: 1,
    pageNumber: 2,
    metadata: {},
  },
];

// ============================================
// Tests
// ============================================

describe('Document Content Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock global fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('fake docx content'),
    }) as any;
  });

  // ============================
  // 1. DOCX Round-Trip
  // ============================
  describe('DOCX Round-Trip', () => {
    const mockDocxDocument = {
      id: TEST_DOCUMENT_ID,
      name: 'test-spec.docx',
      projectId: TEST_PROJECT_ID,
      fileName: 'test-spec.docx',
      fileType: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileUrl: 'https://s3.example.com/test-spec.docx',
      status: 'UPLOADED',
      fileSize: 50000,
      processed: false,
      uploadedBy: TEST_USER_ID,
      pageCount: null,
      accessLevel: 'client',
      cloud_storage_path: 'projects/test/test-spec.docx',
      createdAt: new Date(),
      updatedAt: new Date(),
      Project: { ownerId: TEST_USER_ID },
    };

    it('should create DocumentChunk records when processing a DOCX with known text', async () => {
      const docxText = 'Section 03 30 00 - Cast-in-Place Concrete.\n\nCompressive strength shall be 4000 psi at 28 days. Use Type I/II Portland cement conforming to ASTM C150.';

      mockPrisma.document.findUnique.mockResolvedValue(mockDocxDocument);
      mockPrisma.document.update.mockResolvedValue({ ...mockDocxDocument, processed: true });
      mockPrisma.documentChunk.count.mockResolvedValue(0);
      mockPrisma.documentChunk.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.documentChunk.create.mockImplementation(async (args: any) => ({
        id: `chunk-${args.data.chunkIndex}`,
        ...args.data,
      }));
      mockGetFileUrl.mockResolvedValue('https://s3.example.com/test-spec.docx');
      mockDownloadFile.mockResolvedValue(Buffer.from('fake docx'));
      mockMammothExtract.mockResolvedValue({ value: docxText });
      mockClassifyDocument.mockResolvedValue({ type: 'text', confidence: 0.9, reason: 'docx' });
      mockCanProcessDocument.mockResolvedValue({ allowed: true });
      mockCalculateProcessingCost.mockReturnValue(1);
      mockExtractTitleBlock.mockResolvedValue(null);
      mockClassifyDrawingWithPatterns.mockResolvedValue(null);

      await processDocument(TEST_DOCUMENT_ID);

      // Verify chunks were created
      expect(mockPrisma.documentChunk.create).toHaveBeenCalled();
      const createCalls = mockPrisma.documentChunk.create.mock.calls;
      const allChunkContent = createCalls.map((call: any) => call[0].data.content).join(' ');
      expect(allChunkContent).toContain('Cast-in-Place Concrete');
      expect(allChunkContent).toContain('4000 psi');
    });

    it('should retrieve chunks via retrieveRelevantDocuments with a matching query', async () => {
      mockPrisma.project.findMany.mockResolvedValue([{ id: TEST_PROJECT_ID }]);
      mockPrisma.document.findMany.mockResolvedValue([{
        id: TEST_DOCUMENT_ID,
        name: 'test-spec.docx',
        processed: true,
        projectId: TEST_PROJECT_ID,
        accessLevel: 'client',
        category: 'specifications',
        DocumentChunk: constructionChunks,
      }]);

      const result = await retrieveRelevantDocuments(
        'What is the concrete compressive strength?',
        'admin',
        5,
        TEST_PROJECT_SLUG
      );

      expect(result).toBeDefined();
      expect(result.chunks).toBeDefined();
      expect(mockPrisma.document.findMany).toHaveBeenCalled();
    });

    it('should return empty results when no projectSlug provided (prevents cross-project access)', async () => {
      const result = await retrieveRelevantDocuments(
        'What is the concrete strength?',
        'admin',
        5,
        undefined // no project slug
      );

      expect(result.chunks).toEqual([]);
      expect(result.documentNames).toEqual([]);
    });
  });

  // ============================
  // 2. PDF Queue → Chunks
  // ============================
  describe('PDF Queue → Chunks', () => {
    it('should create queue entry with correct totalPages and batch count', async () => {
      const totalPages = 25;
      const batchSize = 5;

      mockPrisma.processingQueue.create.mockResolvedValue({
        id: 'queue-1',
        documentId: TEST_DOCUMENT_ID,
        status: 'queued',
        totalPages,
        pagesProcessed: 0,
        currentBatch: 0,
        totalBatches: 5,
      });

      await queueDocumentForProcessing(TEST_DOCUMENT_ID, totalPages, batchSize);

      expect(mockPrisma.processingQueue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          documentId: TEST_DOCUMENT_ID,
          status: 'queued',
          totalPages: 25,
          pagesProcessed: 0,
          currentBatch: 0,
          totalBatches: 5, // ceil(25/5)
          retriesCount: 0,
        }),
      });
    });

    it('should calculate correct batch count for non-even page counts', async () => {
      const totalPages = 12;
      const batchSize = 5;

      mockPrisma.processingQueue.create.mockResolvedValue({
        id: 'queue-2',
        documentId: TEST_DOCUMENT_ID,
        status: 'queued',
        totalPages,
        totalBatches: 3, // ceil(12/5)
      });

      await queueDocumentForProcessing(TEST_DOCUMENT_ID, totalPages, batchSize);

      expect(mockPrisma.processingQueue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          totalPages: 12,
          totalBatches: 3, // ceil(12/5) = 3
        }),
      });
    });
  });

  // ============================
  // 3. OCR/Vision Extraction Quality
  // ============================
  describe('OCR/Vision Extraction Quality', () => {
    it('should pass quality check for well-extracted construction data', () => {
      const goodData = {
        sheetNumber: 'A-101',
        sheetTitle: 'First Floor Plan',
        scale: '1/4" = 1\'-0"',
        content: 'Detailed floor plan showing room layouts, dimensions, door schedules, and window locations for the first floor. Room 101 - Lobby (450 SF), Room 102 - Conference (300 SF). Grid lines A through G, 1 through 5. General notes reference ASTM standards and local building code requirements. Door schedule includes D101 through D115 with hardware groups. Window types W1 through W8 with specifications. Ceiling heights noted at 9\'-0" throughout. Mechanical penetrations coordinated with M-101.',
        dimensions: [{ value: '15\'-6"', label: 'room width' }],
        gridLines: ['A', 'B', 'C', '1', '2', '3'],
        roomLabels: ['101', '102'],
        doors: ['D101', 'D102'],
      };

      const result = performQualityCheck(goodData, 1);

      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(50);
    });

    it('should detect near-empty vision response as blank page', () => {
      const emptyData = {
        sheetNumber: undefined,
        sheetTitle: undefined,
        scale: undefined,
        content: '   \n\n  ',
      };

      const result = isBlankPage(emptyData);
      expect(result).toBe(true);
    });

    it('should detect blank page indicators in content', () => {
      const blankPageData = {
        content: 'This is a blank page intentionally left blank',
      };

      const result = isBlankPage(blankPageData);
      expect(result).toBe(true);
    });

    it('should score low-quality extraction below threshold', () => {
      const lowQualityData = {
        sheetNumber: undefined,
        sheetTitle: undefined,
        scale: undefined,
        content: 'x x x',
      };

      const result = performQualityCheck(lowQualityData, 1, 50);

      expect(result.score).toBeLessThan(50);
      expect(result.passed).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should not flag a page with real content as blank', () => {
      const realData = {
        sheetNumber: 'S-201',
        sheetTitle: 'Foundation Plan',
        scale: '1/4" = 1\'-0"',
        content: 'Foundation plan showing footing locations, rebar details, and grade beams. Concrete strength 4000 PSI.',
      };

      const result = isBlankPage(realData);
      expect(result).toBe(false);
    });
  });

  // ============================
  // 4. RAG Context Building
  // ============================
  describe('RAG Context Building', () => {
    it('should return formatted context from construction chunks', async () => {
      mockTwoPassRetrieval.mockResolvedValue({
        chunks: constructionChunks.map(c => ({
          ...c,
          document: { name: 'test-spec.docx' },
          score: 800,
        })),
        retrievalLog: ['Retrieved 2 chunks'],
      });

      mockBundleCrossReferences.mockResolvedValue({
        enrichedChunks: constructionChunks.map(c => ({
          ...c,
          document: { name: 'test-spec.docx' },
          score: 800,
        })),
        crossRefLog: ['No cross-references found'],
      });

      mockGenerateEnhancedContext.mockReturnValue(
        'Section 03 30 00 - Cast-in-Place Concrete. 4000 psi.\nSection 05 12 00 - Structural Steel.'
      );

      const result = await buildContext({
        message: 'What concrete specs are required?',
        projectSlug: TEST_PROJECT_SLUG,
        userRole: 'admin',
      });

      expect(result).toBeDefined();
      expect(mockTwoPassRetrieval).toHaveBeenCalled();
      expect(mockBundleCrossReferences).toHaveBeenCalled();
    });

    it('should enforce access control: client role filters documents', async () => {
      mockPrisma.project.findMany.mockResolvedValue([{ id: TEST_PROJECT_ID }]);
      mockPrisma.document.findMany.mockResolvedValue([]);

      const result = await retrieveRelevantDocuments(
        'Show me budget details',
        'client',
        5,
        TEST_PROJECT_SLUG
      );

      // Verify the query included access level filtering for client role
      const findManyCall = mockPrisma.document.findMany.mock.calls[0][0];
      expect(findManyCall.where.accessLevel).toEqual({ in: ['client', 'guest'] });
    });
  });
});
