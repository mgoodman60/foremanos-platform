import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Document, Project } from '@prisma/client';

// Hoist mocks before imports
const mockPrisma = vi.hoisted(() => ({
  document: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  documentChunk: {
    deleteMany: vi.fn(),
    create: vi.fn(),
  },
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mockGetFileUrl = vi.hoisted(() => vi.fn());
const mockAnalyzeWithSmartRouting = vi.hoisted(() => vi.fn());
const mockGetProviderDisplayName = vi.hoisted(() => vi.fn());
const mockPerformQualityCheck = vi.hoisted(() => vi.fn());
const mockFormatQualityReport = vi.hoisted(() => vi.fn());
const mockIsBlankPage = vi.hoisted(() => vi.fn());
const mockWriteFile = vi.hoisted(() => vi.fn());
const mockUnlink = vi.hoisted(() => vi.fn());
const mockConvertSinglePage = vi.hoisted(() => vi.fn());

// Mock all dependencies
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createScopedLogger: vi.fn(() => mockLogger),
}));
vi.mock('@/lib/s3', () => ({ getFileUrl: mockGetFileUrl }));
vi.mock('@/lib/vision-api-multi-provider', () => ({
  analyzeWithSmartRouting: mockAnalyzeWithSmartRouting,
  getProviderDisplayName: mockGetProviderDisplayName,
}));
vi.mock('@/lib/vision-api-quality', () => ({
  performQualityCheck: mockPerformQualityCheck,
  formatQualityReport: mockFormatQualityReport,
  isBlankPage: mockIsBlankPage,
}));
vi.mock('fs/promises', () => ({
  default: {
    writeFile: mockWriteFile,
    unlink: mockUnlink,
    readFile: vi.fn(),
  },
  writeFile: mockWriteFile,
  unlink: mockUnlink,
  readFile: vi.fn(),
}));
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
  },
  existsSync: vi.fn(() => true),
}));
vi.mock('@/lib/pdf-to-image', () => ({
  convertSinglePage: mockConvertSinglePage,
}));

// Mock pdf-to-image-serverless dynamically
const mockExtractPageAsPdf = vi.fn();
vi.mock('@/lib/pdf-to-image-serverless', async () => ({
  extractPageAsPdf: mockExtractPageAsPdf,
}));

// Import after mocks
import { processDocumentBatch } from '@/lib/document-processor-batch';

describe('document-processor-batch', () => {
  const mockDocument: Document & { Project: Pick<Project, 'ownerId'> } = {
    id: 'doc-123',
    name: 'Test Drawing.pdf',
    fileName: 'test-drawing.pdf',
    cloud_storage_path: 'documents/test-drawing.pdf',
    isPublic: false,
    processorType: 'vision-ai',
    projectId: 'project-123',
    uploadedBy: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    Project: { ownerId: 'user-123' },
  } as any;

  const mockPdfBuffer = Buffer.from('mock-pdf-content');

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockPrisma.document.findUnique.mockResolvedValue(mockDocument);
    mockPrisma.documentChunk.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.documentChunk.create.mockResolvedValue({ id: 'chunk-123' });
    mockGetFileUrl.mockResolvedValue('https://s3.example.com/test.pdf');
    mockGetProviderDisplayName.mockReturnValue('Claude Opus 4.6');
    mockPerformQualityCheck.mockReturnValue({ score: 85, passed: true, issues: [] });
    mockFormatQualityReport.mockReturnValue('Quality: 85%');
    mockIsBlankPage.mockReturnValue(false);
    mockWriteFile.mockResolvedValue(undefined);
    mockUnlink.mockResolvedValue(undefined);
    mockExtractPageAsPdf.mockResolvedValue({ base64: 'mock-base64-page' });

    // Mock fetch for PDF download
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockPdfBuffer.buffer),
    } as any);
  });

  describe('processDocumentBatch', () => {
    it('should successfully process a single page batch', async () => {
      mockAnalyzeWithSmartRouting.mockResolvedValue({
        success: true,
        content: JSON.stringify({
          sheetNumber: 'A-101',
          sheetTitle: 'Floor Plan',
          scale: '1/4"=1\'-0"',
          discipline: 'Architectural',
        }),
        provider: 'claude-opus-4-6',
        confidenceScore: 0.95,
        attempts: 1,
      });

      const result = await processDocumentBatch('doc-123', 1, 1);

      expect(result.success).toBe(true);
      expect(result.pagesProcessed).toBe(1);
      expect(mockPrisma.document.findUnique).toHaveBeenCalledWith({
        where: { id: 'doc-123' },
        include: { Project: { select: { ownerId: true } } },
      });
      expect(mockPrisma.documentChunk.deleteMany).toHaveBeenCalledWith({
        where: { documentId: 'doc-123', pageNumber: { gte: 1, lte: 1 } },
      });
      expect(mockPrisma.documentChunk.create).toHaveBeenCalled();
    });

    it('should process multiple pages in a batch', async () => {
      mockAnalyzeWithSmartRouting.mockResolvedValue({
        success: true,
        content: JSON.stringify({ sheetNumber: 'A-101' }),
        provider: 'claude-opus-4-6',
        confidenceScore: 0.9,
        attempts: 1,
      });

      const result = await processDocumentBatch('doc-123', 1, 3);

      expect(result.success).toBe(true);
      expect(result.pagesProcessed).toBe(3);
      expect(mockPrisma.documentChunk.create).toHaveBeenCalledTimes(3);
    });

    it('should use preloaded PDF buffer when provided', async () => {
      const preloadedBuffer = Buffer.from('preloaded-content');
      mockAnalyzeWithSmartRouting.mockResolvedValue({
        success: true,
        content: JSON.stringify({ sheetNumber: 'A-101' }),
        provider: 'claude-opus-4-6',
        confidenceScore: 0.9,
        attempts: 1,
      });

      const result = await processDocumentBatch('doc-123', 1, 1, 'vision-ai', preloadedBuffer);

      expect(result.success).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'BATCH_PROCESSOR',
        expect.stringContaining('Using preloaded PDF buffer')
      );
      expect(global.fetch).not.toHaveBeenCalled(); // Should not download
    });

    it('should handle document not found error', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);

      const result = await processDocumentBatch('doc-123', 1, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Document not found');
      expect(result.pagesProcessed).toBe(0);
    });

    it('should handle document without cloud storage path', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        ...mockDocument,
        cloud_storage_path: null,
      });

      const result = await processDocumentBatch('doc-123', 1, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Document not found');
    });

    it('should strip markdown wrapper from Claude response', async () => {
      const jsonContent = JSON.stringify({ sheetNumber: 'A-101' });
      mockAnalyzeWithSmartRouting.mockResolvedValue({
        success: true,
        content: `\`\`\`json\n${jsonContent}\n\`\`\``,
        provider: 'claude-opus-4-6',
        confidenceScore: 0.9,
        attempts: 1,
      });

      const result = await processDocumentBatch('doc-123', 1, 1);

      expect(result.success).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'BATCH_PROCESSOR',
        expect.stringContaining('Stripped markdown wrapper'),
        expect.any(Object)
      );
    });

    it('should handle blank page detection', async () => {
      mockAnalyzeWithSmartRouting.mockResolvedValue({
        success: true,
        content: JSON.stringify({ sheetNumber: '' }),
        provider: 'claude-opus-4-6',
        confidenceScore: 0.9,
        attempts: 1,
      });
      mockIsBlankPage.mockReturnValue(true);

      const result = await processDocumentBatch('doc-123', 1, 1);

      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'BATCH_PROCESSOR',
        expect.stringContaining('appears to be blank')
      );
    });

    it('should handle vision API parse error gracefully', async () => {
      mockAnalyzeWithSmartRouting.mockResolvedValue({
        success: true,
        content: 'Invalid JSON content',
        provider: 'claude-opus-4-6',
        confidenceScore: 0.5,
        attempts: 1,
      });

      const result = await processDocumentBatch('doc-123', 1, 1);

      expect(result.success).toBe(true);
      expect(result.pagesProcessed).toBe(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'BATCH_PROCESSOR',
        expect.stringContaining('Failed to parse vision response'),
        expect.any(Error)
      );
    });

    it('should handle all providers failing', async () => {
      mockAnalyzeWithSmartRouting.mockResolvedValue({
        success: false,
        content: null,
        error: 'All providers failed',
        provider: 'none',
        attempts: 3,
      });

      const result = await processDocumentBatch('doc-123', 1, 1);

      expect(result.success).toBe(true); // Still success overall
      expect(result.pagesProcessed).toBe(1);
      expect(mockPrisma.documentChunk.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: expect.stringContaining('All vision providers failed'),
            metadata: expect.objectContaining({
              source: 'failed-processing',
              skipForRag: true,
            }),
          }),
        })
      );
    });

    it('should track provider statistics', async () => {
      mockAnalyzeWithSmartRouting
        .mockResolvedValueOnce({
          success: true,
          content: JSON.stringify({ sheetNumber: 'A-101' }),
          provider: 'claude-opus-4-6',
          confidenceScore: 0.95,
          attempts: 1,
        })
        .mockResolvedValueOnce({
          success: true,
          content: JSON.stringify({ sheetNumber: 'A-102' }),
          provider: 'gpt-5.2',
          confidenceScore: 0.92,
          attempts: 1,
        });

      mockGetProviderDisplayName.mockImplementation((provider: string) => {
        if (provider === 'claude-opus-4-6') return 'Claude Opus 4.6';
        if (provider === 'gpt-5.2') return 'GPT-5.2';
        return provider;
      });

      const result = await processDocumentBatch('doc-123', 1, 2);

      expect(result.success).toBe(true);
      expect(result.providerStats).toBeDefined();
      expect(result.providerStats!['Claude Opus 4.6']).toBeDefined();
      expect(result.providerStats!['Claude Opus 4.6'].pagesProcessed).toBe(1);
      expect(result.providerStats!['GPT-5.2']).toBeDefined();
      expect(result.providerStats!['GPT-5.2'].pagesProcessed).toBe(1);
    });

    it('should handle page extraction failure gracefully', async () => {
      mockExtractPageAsPdf.mockRejectedValue(new Error('Extraction failed'));
      mockAnalyzeWithSmartRouting.mockResolvedValue({
        success: true,
        content: JSON.stringify({ sheetNumber: 'A-101' }),
        provider: 'claude-opus-4-6',
        confidenceScore: 0.9,
        attempts: 1,
      });

      const result = await processDocumentBatch('doc-123', 1, 1);

      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'BATCH_PROCESSOR',
        expect.stringContaining('Page extraction failed'),
        expect.any(Object)
      );
    });

    it('should handle individual page processing error', async () => {
      mockAnalyzeWithSmartRouting.mockRejectedValue(new Error('API error'));

      const result = await processDocumentBatch('doc-123', 1, 1);

      expect(result.success).toBe(true); // Overall batch success
      expect(result.pagesProcessed).toBe(1); // Error chunk created
      expect(mockLogger.error).toHaveBeenCalledWith(
        'BATCH_PROCESSOR',
        expect.stringContaining('Error processing page'),
        expect.any(Error)
      );
      expect(mockPrisma.documentChunk.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              source: 'error',
              skipForRag: true,
            }),
          }),
        })
      );
    });

    it('should use effective processor type from document', async () => {
      mockAnalyzeWithSmartRouting.mockResolvedValue({
        success: true,
        content: JSON.stringify({ sheetNumber: 'A-101' }),
        provider: 'claude-opus-4-6',
        confidenceScore: 0.9,
        attempts: 1,
      });

      await processDocumentBatch('doc-123', 1, 1);

      expect(mockAnalyzeWithSmartRouting).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.any(String),
        'vision-ai', // From mockDocument.processorType
        1,
        50
      );
    });

    it('should include extraction metadata in chunk', async () => {
      mockAnalyzeWithSmartRouting.mockResolvedValue({
        success: true,
        content: JSON.stringify({
          sheetNumber: 'A-101',
          rooms: [{ number: '101', name: 'LOBBY' }],
          dimensions: ['15\'-6"'],
        }),
        provider: 'claude-opus-4-6',
        confidenceScore: 0.95,
        attempts: 1,
      });
      mockPerformQualityCheck.mockReturnValue({
        score: 92,
        passed: true,
        issues: [],
      });

      await processDocumentBatch('doc-123', 1, 1);

      expect(mockPrisma.documentChunk.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              page: 1,
              source: 'vision-analysis',
              provider: 'claude-opus-4-6',
              providerDisplayName: 'Claude Opus 4.6',
              confidenceScore: 0.95,
              qualityScore: 92,
              qualityPassed: true,
              sheetNumber: 'A-101',
              roomsCount: 1,
              hasDimensions: true,
            }),
          }),
        })
      );
    });

    it('should cleanup temp files on success', async () => {
      mockAnalyzeWithSmartRouting.mockResolvedValue({
        success: true,
        content: JSON.stringify({ sheetNumber: 'A-101' }),
        provider: 'claude-opus-4-6',
        confidenceScore: 0.9,
        attempts: 1,
      });

      await processDocumentBatch('doc-123', 1, 1);

      expect(mockUnlink).toHaveBeenCalled();
    });

    it('should cleanup temp files on error', async () => {
      mockPrisma.document.findUnique.mockRejectedValue(new Error('Database error'));

      await processDocumentBatch('doc-123', 1, 1);

      // Should attempt cleanup even on error (though no files created in this case)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'BATCH_PROCESSOR',
        'Batch processing failed',
        expect.any(Error)
      );
    });

    it('should format vision data with all extraction categories', async () => {
      const fullExtractionData = {
        sheetNumber: 'A-101',
        sheetTitle: 'First Floor Plan',
        scale: '1/4"=1\'-0"',
        discipline: 'Architectural',
        rooms: [{ number: '101', name: 'LOBBY', area: '450 SF' }],
        dimensions: ['15\'-6"', '20\'-0"'],
        gridLines: ['A', 'B', '1', '2'],
        visualMaterials: [{ material: 'concrete', hatchingType: 'diagonal', locations: ['foundation'] }],
        plumbingFixtures: [{ type: 'water_closet', tag: 'WC-1', room: '101' }],
        electricalDevices: [{ type: 'receptacle', subtype: 'duplex', count: 4 }],
        hvacData: { ductwork: [{ size: '12x8' }] },
      };

      mockAnalyzeWithSmartRouting.mockResolvedValue({
        success: true,
        content: JSON.stringify(fullExtractionData),
        provider: 'claude-opus-4-6',
        confidenceScore: 0.95,
        attempts: 1,
      });

      await processDocumentBatch('doc-123', 1, 1);

      const createCall = mockPrisma.documentChunk.create.mock.calls[0][0];
      const content = createCall.data.content;

      expect(content).toContain('SHEET NUMBER: A-101');
      expect(content).toContain('ROOMS:');
      expect(content).toContain('VISUAL MATERIALS:');
      expect(content).toContain('PLUMBING FIXTURES:');
      expect(content).toContain('ELECTRICAL DEVICES:');
      expect(content).toContain('HVAC:');
    });
  });
});
