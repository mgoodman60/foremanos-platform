import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';

// ============================================
// Mocks Setup - Must use vi.hoisted for mock objects
// ============================================

// Mock prisma with vi.hoisted to ensure it's available before mock calls
const mockPrisma = vi.hoisted(() => {
  const prismaClient = {
    document: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    documentChunk: {
      create: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
    },
    processingCost: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
    // Add $transaction mock that passes through the callback with the same prisma client
    $transaction: vi.fn((callback: (tx: unknown) => Promise<unknown>) => callback(prismaClient)),
  };
  return prismaClient;
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Mock S3 with vi.hoisted
const { mockGetFileUrl, mockDownloadFile } = vi.hoisted(() => ({
  mockGetFileUrl: vi.fn(),
  mockDownloadFile: vi.fn(),
}));

vi.mock('@/lib/s3', () => ({
  getFileUrl: mockGetFileUrl,
  downloadFile: mockDownloadFile,
}));

// Mock document classifier with vi.hoisted
const mockClassifyDocument = vi.hoisted(() => vi.fn());

vi.mock('@/lib/document-classifier', () => ({
  classifyDocument: mockClassifyDocument,
  ProcessorType: {},
}));

// Mock processing limits
vi.mock('@/lib/processing-limits', () => ({
  calculateProcessingCost: vi.fn().mockReturnValue(0.05),
  canProcessDocument: vi.fn().mockResolvedValue({ allowed: true }),
  canProcessPages: vi.fn().mockResolvedValue({ allowed: true, reason: null }),
  getUsageStats: vi.fn().mockResolvedValue({ dailyPages: 0, monthlyPages: 0, dailyRemaining: 1000, monthlyRemaining: 10000, nearLimit: false, atLimit: false }),
  getProjectProcessingLimits: vi.fn().mockResolvedValue({ dailyPageLimit: 1000, monthlyPageLimit: 10000 }),
  queueDocumentForProcessing: vi.fn().mockResolvedValue(undefined),
  sendLimitNotification: vi.fn().mockResolvedValue(undefined),
}));

// Mock title block extractor
vi.mock('@/lib/title-block-extractor', () => ({
  extractTitleBlock: vi.fn().mockResolvedValue({ success: false }),
  storeTitleBlockData: vi.fn(),
}));

// Mock onboarding tracker
vi.mock('@/lib/onboarding-tracker', () => ({
  markDocumentProcessed: vi.fn(),
}));

// Mock drawing classifier
vi.mock('@/lib/drawing-classifier', () => ({
  classifyDrawingWithPatterns: vi.fn().mockReturnValue({ type: 'floor_plan', confidence: 0.85 }),
  storeDrawingClassification: vi.fn(),
}));

// Mock mammoth for DOCX processing
vi.mock('mammoth', () => ({
  default: {
    extractRawText: vi.fn(),
  },
}));

// Mock pdf-to-image with vi.hoisted
const { mockConvertSinglePage, mockConvertPdfToImages, mockGetPdfPageCount } = vi.hoisted(() => ({
  mockConvertSinglePage: vi.fn(),
  mockConvertPdfToImages: vi.fn(),
  mockGetPdfPageCount: vi.fn(),
}));

vi.mock('@/lib/pdf-to-image', () => ({
  convertSinglePage: mockConvertSinglePage,
  convertPdfToImages: mockConvertPdfToImages,
  getPdfPageCount: mockGetPdfPageCount,
}));

// Mock document-processor-batch with vi.hoisted
const mockProcessDocumentBatch = vi.hoisted(() => vi.fn());

vi.mock('@/lib/document-processor-batch', () => ({
  processDocumentBatch: mockProcessDocumentBatch,
}));

// Mock dynamic imports (intelligence extraction, room extraction, etc.)
vi.mock('@/lib/intelligence-orchestrator', () => ({
  runIntelligenceExtraction: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/room-extractor', () => ({
  extractRoomsFromDocuments: vi.fn().mockResolvedValue({ rooms: [] }),
  saveExtractedRooms: vi.fn().mockResolvedValue({ created: 0, updated: 0 }),
}));

vi.mock('@/lib/document-auto-sync', () => ({
  processDocumentForSync: vi.fn().mockResolvedValue({
    featuresProcessed: [],
    featuresSkipped: [],
    errors: [],
  }),
}));

vi.mock('@/lib/schedule-extractor-ai', () => ({
  extractScheduleWithAI: vi.fn().mockResolvedValue({ totalTasks: 0, criticalPathTasks: 0 }),
}));

vi.mock('@/lib/document-processing-queue', () => ({
  queueDocumentForProcessing: vi.fn().mockResolvedValue(undefined),
  processQueuedDocument: vi.fn().mockResolvedValue(undefined),
}));

// Import functions after mocks
import {
  processDocument,
  processUnprocessedDocuments,
  extractTitleBlocksFromDocument,
  extractLegendsFromDocument,
  classifyDrawingsFromDocument,
} from '@/lib/document-processor';
import mammoth from 'mammoth';

// ============================================
// Test Helpers
// ============================================

function createMockDocument(overrides = {}) {
  return {
    id: 'doc-1',
    fileName: 'test-plan.pdf',
    cloud_storage_path: 'uploads/test-plan.pdf',
    processed: false,
    isPublic: false,
    projectId: 'project-1',
    fileSize: 1024 * 100, // 100KB
    Project: {
      ownerId: 'user-1',
      slug: 'test-project',
    },
    ...overrides,
  };
}

function createMockUser(overrides = {}) {
  return {
    id: 'user-1',
    pagesProcessedThisMonth: 50,
    totalProcessingCost: 5.0,
    processingResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

async function createSimplePDF(pageCount = 1): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    pdfDoc.addPage([612, 792]); // Standard letter size
  }
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

// ============================================
// PDF Processing Tests (5 tests)
// ============================================

describe('Document Processor - PDF Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully process a small PDF (≤10 pages)', async () => {
    const pdfBuffer = await createSimplePDF(5);
    const mockDoc = createMockDocument({ fileName: 'architectural-plan.pdf' });

    mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
    mockClassifyDocument.mockResolvedValue({
      processorType: 'vision-ai',
      confidence: 0.95,
      reason: 'Architectural plan',
    });

    mockGetFileUrl.mockResolvedValue('https://s3.example.com/test.pdf');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => pdfBuffer,
    });

    mockGetPdfPageCount.mockResolvedValue(5);
    mockProcessDocumentBatch.mockResolvedValue({
      success: true,
      pagesProcessed: 5,
    });

    mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
    mockPrisma.document.update.mockResolvedValue(mockDoc);
    mockPrisma.processingCost.create.mockResolvedValue({ id: 'cost-1' });
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'user-1' });

    await processDocument('doc-1');

    // Verify document was marked as processed
    expect(mockPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1' },
        data: expect.objectContaining({
          processed: true,
          pagesProcessed: 5,
          processorType: 'vision-ai',
        }),
      })
    );

    // Verify batch processor was called for small doc
    expect(mockProcessDocumentBatch).toHaveBeenCalledWith(
      'doc-1',
      1,
      5,
      'vision-ai'
    );
  });

  it('should queue large PDFs (>10 pages) for batch processing without inline processing', async () => {
    const pdfBuffer = await createSimplePDF(25);
    const mockDoc = createMockDocument({ fileName: 'specifications.pdf' });

    mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
    mockClassifyDocument.mockResolvedValue({
      processorType: 'claude-haiku-ocr',
      confidence: 0.90,
      reason: 'Specification document',
    });

    mockGetFileUrl.mockResolvedValue('https://s3.example.com/test.pdf');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => pdfBuffer,
    });

    mockGetPdfPageCount.mockResolvedValue(25);
    mockPrisma.document.update.mockResolvedValue(mockDoc);

    const { queueDocumentForProcessing } = await import('@/lib/document-processing-queue');

    await processDocument('doc-1');

    // Verify document was queued (batchSize 1, not 5 - changed to per-page processing)
    expect(queueDocumentForProcessing).toHaveBeenCalledWith('doc-1', 25, 1, 'claude-haiku-ocr');

    // Verify document status was set to queued
    expect(mockPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1' },
        data: expect.objectContaining({
          queueStatus: 'queued',
          pagesProcessed: 0,
          processorType: 'claude-haiku-ocr',
        }),
      })
    );
  });

  it('should handle PDF download errors gracefully', async () => {
    const mockDoc = createMockDocument();
    mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
    mockClassifyDocument.mockResolvedValue({
      processorType: 'vision-ai',
      confidence: 0.95,
    });

    mockGetFileUrl.mockResolvedValue('https://s3.example.com/test.pdf');
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    });

    mockPrisma.document.update.mockResolvedValue(mockDoc);

    await expect(processDocument('doc-1')).rejects.toThrow('Failed to download file from S3');

    // Verify error was logged to document
    expect(mockPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1' },
        data: expect.objectContaining({
          queueStatus: 'failed',
          processed: false,
        }),
      })
    );
  });

  it('should handle corrupt PDF files with graceful fallback', async () => {
    // When PDF parsing fails, implementation falls back to file size estimation
    // File size: 100KB = 1 estimated page
    const corruptBuffer = Buffer.alloc(100 * 1024); // 100KB
    const mockDoc = createMockDocument({ fileSize: 100 * 1024 });

    mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
    mockClassifyDocument.mockResolvedValue({
      processorType: 'vision-ai',
      confidence: 0.95,
    });

    mockGetFileUrl.mockResolvedValue('https://s3.example.com/test.pdf');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => corruptBuffer,
    });

    // PDF parsing fails, but implementation has fallback
    mockGetPdfPageCount.mockRejectedValue(new Error('Invalid PDF structure'));
    mockProcessDocumentBatch.mockResolvedValue({ success: true, pagesProcessed: 1 });
    mockPrisma.document.update.mockResolvedValue(mockDoc);
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.processingCost.create.mockResolvedValue({ id: 'cost-1' });
    mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'user-1' });

    // Should NOT throw - implementation gracefully falls back to file size estimation
    await processDocument('doc-1');

    // Verify document was processed (not marked as failed)
    expect(mockPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1' },
        data: expect.objectContaining({
          processed: true,
        }),
      })
    );
  });

  it('should skip already processed documents', async () => {
    const mockDoc = createMockDocument({ processed: true });
    mockPrisma.document.findUnique.mockResolvedValue(mockDoc);

    await processDocument('doc-1');

    // Should not attempt to download or process
    expect(mockGetFileUrl).not.toHaveBeenCalled();
    expect(mockProcessDocumentBatch).not.toHaveBeenCalled();
  });
});

// ============================================
// Text Extraction Tests (3 tests)
// ============================================

describe('Document Processor - Text Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract text from DOCX files', async () => {
    const mockDoc = createMockDocument({ fileName: 'specification.docx' });
    const textContent = 'Division 09 - Finishes\n\nSection 09 21 16 - Gypsum Board Assemblies\n\nThis section covers gypsum board installation...';

    mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
    mockClassifyDocument.mockResolvedValue({
      processorType: 'basic-ocr',
      confidence: 1.0,
      reason: 'Word document',
    });

    mockGetFileUrl.mockResolvedValue('https://s3.example.com/spec.docx');
    const docxBuffer = Buffer.from('mock-docx-content');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => docxBuffer,
    });

    vi.mocked(mammoth.extractRawText).mockResolvedValue({ value: textContent, messages: [] });
    mockPrisma.documentChunk.create.mockResolvedValue({ id: 'chunk-1' });
    mockPrisma.document.update.mockResolvedValue(mockDoc);
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.processingCost.create.mockResolvedValue({ id: 'cost-1' });
    mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'user-1' });

    await processDocument('doc-1');

    // Verify text extraction was called
    expect(mammoth.extractRawText).toHaveBeenCalledWith({ buffer: docxBuffer });

    // Verify chunks were created
    expect(mockPrisma.documentChunk.create).toHaveBeenCalled();

    // Verify document marked as processed
    expect(mockPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          processed: true,
        }),
      })
    );
  });

  it('should handle DOCX files with no text content', async () => {
    const mockDoc = createMockDocument({ fileName: 'empty.docx' });

    mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
    mockClassifyDocument.mockResolvedValue({
      processorType: 'basic-ocr',
      confidence: 1.0,
    });

    mockGetFileUrl.mockResolvedValue('https://s3.example.com/empty.docx');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('docx'),
    });

    vi.mocked(mammoth.extractRawText).mockResolvedValue({ value: '', messages: [] });
    mockPrisma.document.update.mockResolvedValue(mockDoc);
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.processingCost.create.mockResolvedValue({ id: 'cost-1' });
    mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'user-1' });

    await processDocument('doc-1');

    // Should still mark as processed with 1 page
    expect(mockPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          processed: true,
          pagesProcessed: 1,
        }),
      })
    );
  });

  it('should chunk DOCX text at paragraph boundaries', async () => {
    const mockDoc = createMockDocument({ fileName: 'long-spec.docx' });

    // Create text with multiple paragraphs
    const paragraphs = Array(10).fill(null).map((_, i) =>
      `Paragraph ${i + 1}: ${'Lorem ipsum dolor sit amet. '.repeat(20)}`
    );
    const textContent = paragraphs.join('\n\n');

    mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
    mockClassifyDocument.mockResolvedValue({
      processorType: 'basic-ocr',
      confidence: 1.0,
    });

    mockGetFileUrl.mockResolvedValue('https://s3.example.com/long.docx');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('docx'),
    });

    vi.mocked(mammoth.extractRawText).mockResolvedValue({ value: textContent, messages: [] });
    mockPrisma.documentChunk.create.mockResolvedValue({ id: 'chunk-1' });
    mockPrisma.document.update.mockResolvedValue(mockDoc);
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.processingCost.create.mockResolvedValue({ id: 'cost-1' });
    mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'user-1' });

    await processDocument('doc-1');

    // Verify multiple chunks were created
    const chunkCalls = vi.mocked(mockPrisma.documentChunk.create).mock.calls;
    expect(chunkCalls.length).toBeGreaterThan(1);

    // Verify chunk metadata
    chunkCalls.forEach(call => {
      const data = call[0].data;
      expect(data.metadata).toHaveProperty('source', 'docx_extraction');
      expect(data.metadata).toHaveProperty('totalChunks');
    });
  });
});

// ============================================
// Classification Pipeline Tests (4 tests)
// ============================================

describe('Document Processor - Classification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should classify architectural plans correctly', async () => {
    const mockDoc = createMockDocument({ fileName: 'A-101-Floor-Plan.pdf' });

    mockPrisma.document.findUnique.mockResolvedValue(mockDoc);

    await processDocument('doc-1', {
      processorType: 'vision-ai',
      confidence: 0.95,
      reason: 'Architectural plan',
    });

    // Classification passed as parameter, should use it
    expect(mockClassifyDocument).not.toHaveBeenCalled();
  });

  it('should classify specifications as text-heavy documents', async () => {
    const pdfBuffer = await createSimplePDF(1);
    const mockDoc = createMockDocument({ fileName: 'CSI-Division-09-Specifications.pdf' });

    mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
    mockClassifyDocument.mockResolvedValue({
      processorType: 'claude-haiku-ocr',
      confidence: 0.90,
      reason: 'Specification document (text-heavy)',
    });

    mockGetFileUrl.mockResolvedValue('https://s3.example.com/spec.pdf');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => pdfBuffer,
    });

    mockGetPdfPageCount.mockResolvedValue(1);
    mockProcessDocumentBatch.mockResolvedValue({ success: true, pagesProcessed: 1 });
    mockPrisma.document.update.mockResolvedValue(mockDoc);
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.processingCost.create.mockResolvedValue({ id: 'cost-1' });
    mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'user-1' });

    await processDocument('doc-1');

    expect(mockClassifyDocument).toHaveBeenCalledWith('CSI-Division-09-Specifications.pdf', 'pdf');
  });

  it('should assign appropriate processor types based on classification', async () => {
    const pdfBuffer = await createSimplePDF(5);

    const testCases = [
      { fileName: 'Door-Schedule.pdf', expectedProcessor: 'claude-haiku-ocr' },
      { fileName: 'Site-Plan.pdf', expectedProcessor: 'vision-ai' },
      { fileName: 'Equipment-Schedule.pdf', expectedProcessor: 'claude-haiku-ocr' },
    ];

    for (const testCase of testCases) {
      vi.clearAllMocks();

      const mockDoc = createMockDocument({ fileName: testCase.fileName });
      mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
      mockClassifyDocument.mockResolvedValue({
        processorType: testCase.expectedProcessor,
        confidence: 0.90,
        reason: 'Test classification',
      });

      mockGetFileUrl.mockResolvedValue('https://s3.example.com/test.pdf');
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => pdfBuffer,
      });

      mockGetPdfPageCount.mockResolvedValue(5);
      mockProcessDocumentBatch.mockResolvedValue({ success: true, pagesProcessed: 5 });
      mockPrisma.document.update.mockResolvedValue(mockDoc);
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.processingCost.create.mockResolvedValue({ id: 'cost-1' });
      mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'user-1' });

      await processDocument('doc-1');

      expect(mockPrisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            processorType: testCase.expectedProcessor,
          }),
        })
      );
    }
  });

  it('should handle unsupported file formats gracefully', async () => {
    const mockDoc = createMockDocument({ fileName: 'data.xlsx' });

    mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
    mockClassifyDocument.mockResolvedValue({
      processorType: 'basic-ocr',
      confidence: 0.5,
      reason: 'Unsupported format',
    });

    mockGetFileUrl.mockResolvedValue('https://s3.example.com/data.xlsx');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('excel-content'),
    });

    mockPrisma.document.update.mockResolvedValue(mockDoc);
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.processingCost.create.mockResolvedValue({ id: 'cost-1' });
    mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'user-1' });

    await processDocument('doc-1');

    // Should mark as processed with 1 page and 0 cost
    expect(mockPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          processed: true,
          pagesProcessed: 1,
          processingCost: 0,
        }),
      })
    );
  });
});

// ============================================
// Error Handling Tests (3 tests)
// ============================================

describe('Document Processor - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle document not found errors', async () => {
    mockPrisma.document.findUnique.mockResolvedValue(null);

    await expect(processDocument('nonexistent-doc')).rejects.toThrow('Document nonexistent-doc not found');
  });

  it('should handle missing cloud storage path', async () => {
    const mockDoc = createMockDocument({ cloud_storage_path: null });
    mockPrisma.document.findUnique.mockResolvedValue(mockDoc);

    await expect(processDocument('doc-1')).rejects.toThrow('has no cloud storage path');
  });

  it('should update document with error status on processing failure', async () => {
    const mockDoc = createMockDocument();
    mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
    mockClassifyDocument.mockResolvedValue({
      processorType: 'vision-ai',
      confidence: 0.95,
    });

    mockGetFileUrl.mockResolvedValue('https://s3.example.com/test.pdf');
    global.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));
    mockPrisma.document.update.mockResolvedValue(mockDoc);

    await expect(processDocument('doc-1')).rejects.toThrow('Network timeout');

    // Verify error was stored in document
    expect(mockPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1' },
        data: expect.objectContaining({
          queueStatus: 'failed',
          processed: false,
          lastProcessingError: 'Network timeout',
        }),
      })
    );
  });

  // Large documents are queued for Trigger.dev processing (no inline processing)
  it('should queue large documents without inline processing (Trigger.dev migration)', async () => {
    const pdfBuffer = await createSimplePDF(25);
    const mockDoc = createMockDocument({ fileName: 'large-plan.pdf' });

    mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
    mockClassifyDocument.mockResolvedValue({
      processorType: 'vision-ai',
      confidence: 0.95,
    });

    mockGetFileUrl.mockResolvedValue('https://s3.example.com/test.pdf');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => pdfBuffer,
    });

    mockGetPdfPageCount.mockResolvedValue(25);
    mockPrisma.document.update.mockResolvedValue(mockDoc);

    const { queueDocumentForProcessing } = await import('@/lib/document-processing-queue');

    await processDocument('doc-1');

    // Verify document was queued (batchSize 1 for per-page processing)
    expect(queueDocumentForProcessing).toHaveBeenCalledWith('doc-1', 25, 1, 'vision-ai');

    // NOTE: processQueuedDocument function was removed during Trigger.dev migration
    // Processing is now triggered by:
    // 1. Trigger.dev task (for new uploads via confirm-upload route)
    // 2. Legacy cron job (for old uploads - to be deprecated)

    // Verify document status set to queued
    expect(mockPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1' },
        data: expect.objectContaining({
          queueStatus: 'queued',
          pagesProcessed: 0,
        }),
      })
    );
  });
});

// ============================================
// Batch Processing Tests (2 tests)
// ============================================

describe('Document Processor - Batch Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process unprocessed documents in a project', async () => {
    // Mock unprocessed documents returned by findMany
    const mockDocs = [
      createMockDocument({ id: 'doc-1', processed: false, name: 'test1.pdf', Project: { queueEnabled: false } }),
      createMockDocument({ id: 'doc-2', processed: false, name: 'test2.pdf', Project: { queueEnabled: false } }),
    ];

    mockPrisma.document.findMany.mockResolvedValue(mockDocs);

    // Mock findUnique for each document when processDocument is called
    mockPrisma.document.findUnique
      .mockResolvedValueOnce(mockDocs[0])
      .mockResolvedValueOnce(mockDocs[0]) // Called again for project slug
      .mockResolvedValueOnce(mockDocs[1])
      .mockResolvedValueOnce(mockDocs[1]); // Called again for project slug

    // Mock successful processing
    const pdfBuffer = await createSimplePDF(2);
    mockGetFileUrl.mockResolvedValue('https://s3.example.com/test.pdf');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => pdfBuffer,
    });

    mockClassifyDocument.mockResolvedValue({
      processorType: 'vision-ai',
      confidence: 0.95,
    });

    mockGetPdfPageCount.mockResolvedValue(2);
    mockProcessDocumentBatch.mockResolvedValue({ success: true, pagesProcessed: 2 });
    mockPrisma.document.update.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.processingCost.create.mockResolvedValue({ id: 'cost-1' });
    mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'user-1', slug: 'test-project' });

    const result = await processUnprocessedDocuments('project-1');

    expect(result.processed).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('should handle mixed success/failure in batch processing', async () => {
    const mockDocs = [
      createMockDocument({ id: 'doc-1', processed: false, name: 'test1.pdf', Project: { queueEnabled: false } }),
      createMockDocument({ id: 'doc-2', processed: false, name: 'test2.pdf', Project: { queueEnabled: false } }),
    ];

    mockPrisma.document.findMany.mockResolvedValue(mockDocs);

    // Track which document is being processed
    let docIndex = 0;
    mockPrisma.document.findUnique.mockImplementation(() => {
      const doc = mockDocs[Math.floor(docIndex / 2)]; // Each doc is looked up twice
      docIndex++;
      return Promise.resolve(doc);
    });

    const pdfBuffer = await createSimplePDF(2);

    // First document succeeds, second fails on S3 download
    let fetchCount = 0;
    mockGetFileUrl.mockResolvedValue('https://s3.example.com/test.pdf');
    global.fetch = vi.fn().mockImplementation(() => {
      fetchCount++;
      if (fetchCount === 1) {
        return Promise.resolve({ ok: true, arrayBuffer: async () => pdfBuffer });
      } else {
        return Promise.resolve({ ok: false, statusText: 'S3 error' });
      }
    });

    mockClassifyDocument.mockResolvedValue({
      processorType: 'vision-ai',
      confidence: 0.95,
    });

    mockGetPdfPageCount.mockResolvedValue(2);
    mockProcessDocumentBatch.mockResolvedValue({ success: true, pagesProcessed: 2 });
    mockPrisma.document.update.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.processingCost.create.mockResolvedValue({ id: 'cost-1' });
    mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'user-1', slug: 'test-project' });

    const result = await processUnprocessedDocuments('project-1');

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
  });
});

// ============================================
// Title Block Extraction Tests (2 tests)
// ============================================

describe('Document Processor - Title Block Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract title blocks from first page', async () => {
    const mockDoc = createMockDocument({
      DocumentChunk: [
        {
          id: 'chunk-1',
          pageNumber: 1,
          sheetNumber: 'A-101',
          titleBlockData: null,
        },
      ],
    });

    mockPrisma.document.findUnique.mockResolvedValue(mockDoc);

    const pdfBuffer = await createSimplePDF(1);
    mockGetFileUrl.mockResolvedValue('https://s3.example.com/test.pdf');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => pdfBuffer,
    });

    mockConvertSinglePage.mockResolvedValue({
      base64: 'base64-image-data',
      buffer: Buffer.from('image'),
    });

    const { extractTitleBlock } = await import('@/lib/title-block-extractor');
    vi.mocked(extractTitleBlock).mockResolvedValue({
      success: true,
      confidence: 0.95,
      extractionMethod: 'vision',
      data: {
        sheetNumber: 'A-101',
        sheetTitle: 'First Floor Plan',
        projectName: 'Test Building',
        projectNumber: 'P-001',
        dateIssued: '2024-01-01',
        revision: '1',
        revisionDate: '2024-01-15',
        drawnBy: 'JD',
        checkedBy: 'SM',
        scale: '1/4" = 1\'-0"',
        discipline: 'A' as never, // DisciplineCode.ARCHITECTURAL
        confidence: 0.95,
      },
    });

    await extractTitleBlocksFromDocument('doc-1');

    expect(extractTitleBlock).toHaveBeenCalled();
  });

  it('should handle documents without title blocks gracefully', async () => {
    const mockDoc = createMockDocument({
      DocumentChunk: [],
    });

    mockPrisma.document.findUnique.mockResolvedValue(mockDoc);

    const pdfBuffer = await createSimplePDF(1);
    mockGetFileUrl.mockResolvedValue('https://s3.example.com/test.pdf');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => pdfBuffer,
    });

    // Should not throw error
    await expect(extractTitleBlocksFromDocument('doc-1')).resolves.not.toThrow();
  });
});

// ============================================
// Drawing Classification Tests (1 test)
// ============================================

describe('Document Processor - Drawing Classification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should classify drawings by sheet number and title', async () => {
    const mockDoc = createMockDocument({
      Project: { id: 'project-1', slug: 'test-project' },
      DocumentChunk: [
        {
          id: 'chunk-1',
          sheetNumber: 'A-101',
          titleBlockData: { sheetTitle: 'First Floor Plan' },
        },
        {
          id: 'chunk-2',
          sheetNumber: 'E-201',
          titleBlockData: { sheetTitle: 'Electrical Single Line Diagram' },
        },
      ],
    });

    mockPrisma.document.findUnique.mockResolvedValue(mockDoc);

    const { storeDrawingClassification } = await import('@/lib/drawing-classifier');

    await classifyDrawingsFromDocument('doc-1');

    expect(storeDrawingClassification).toHaveBeenCalledTimes(2);
  });
});
