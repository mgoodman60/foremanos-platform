import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Hoisted mocks
// ============================================

const mockPrisma = vi.hoisted(() => ({
  processingQueue: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  document: {
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
}));

const mockProcessDocumentBatch = vi.hoisted(() => vi.fn());
const mockTriggerEnhancement = vi.hoisted(() => vi.fn());
const mockGetFileUrl = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/document-processor-batch', () => ({
  processDocumentBatch: mockProcessDocumentBatch,
}));
vi.mock('@/lib/project-data-enhancer', () => ({
  triggerEnhancementAfterProcessing: mockTriggerEnhancement,
}));
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock('@/lib/s3', () => ({
  getFileUrl: mockGetFileUrl,
}));
vi.mock('@/lib/intelligence-orchestrator', () => ({
  runIntelligenceExtraction: vi.fn().mockResolvedValue({ phasesRun: [] }),
}));
vi.mock('@/lib/qstash-client', () => ({
  scheduleProcessingContinuation: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/lib/room-extractor', () => ({
  extractRoomsFromDocuments: vi.fn().mockResolvedValue({ rooms: [] }),
  saveExtractedRooms: vi.fn().mockResolvedValue({ created: 0, updated: 0 }),
}));
vi.mock('@/lib/takeoff-extractor', () => ({
  autoExtractTakeoffs: vi.fn().mockResolvedValue({ success: true, itemCount: 0 }),
}));

// Import after mocks
import { processNextQueuedBatch, queueDocumentForProcessing, processQueuedDocument } from '@/lib/document-processing-queue';

// ============================================
// Tests
// ============================================

describe('Document Processing Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('queueDocumentForProcessing', () => {
    it('should create a queue entry with correct batch calculations', async () => {
      mockPrisma.processingQueue.create.mockResolvedValue({ id: 'queue-1' });

      await queueDocumentForProcessing('doc-1', 25, 1, 'vision-ai');

      expect(mockPrisma.processingQueue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          documentId: 'doc-1',
          status: 'queued',
          totalPages: 25,
          pagesProcessed: 0,
          currentBatch: 0,
          totalBatches: 25, // ceil(25/1)
          retriesCount: 0,
        }),
      });
    });
  });

  describe('processNextQueuedBatch', () => {
    it('should return false when queue is empty', async () => {
      mockPrisma.processingQueue.findMany.mockResolvedValue([]);

      const result = await processNextQueuedBatch();

      expect(result).toBe(false);
    });

    it('should return false when optimistic lock fails (another process claimed the entry)', async () => {
      // A queue entry exists and has pending batches
      mockPrisma.processingQueue.findMany.mockResolvedValue([
        {
          id: 'queue-1',
          documentId: 'doc-1',
          status: 'queued',
          currentBatch: 0,
          totalBatches: 25,
          totalPages: 25,
          pagesProcessed: 0,
          retriesCount: 0,
          metadata: { batchSize: 1, processorType: 'vision-ai' },
        },
      ]);

      // Simulate another process already claimed this entry
      mockPrisma.processingQueue.updateMany.mockResolvedValue({ count: 0 });

      const result = await processNextQueuedBatch();

      expect(result).toBe(false);
      // Should NOT have called processDocumentBatch since the lock failed
      expect(mockProcessDocumentBatch).not.toHaveBeenCalled();
    });

    it('should process batch successfully when lock is acquired', async () => {
      mockPrisma.processingQueue.findMany.mockResolvedValue([
        {
          id: 'queue-1',
          documentId: 'doc-1',
          status: 'queued',
          currentBatch: 0,
          totalBatches: 25,
          totalPages: 25,
          pagesProcessed: 0,
          retriesCount: 0,
          metadata: { batchSize: 1, processorType: 'vision-ai' },
        },
      ]);

      // Lock succeeds
      mockPrisma.processingQueue.updateMany.mockResolvedValue({ count: 1 });

      // Batch processing succeeds
      mockProcessDocumentBatch.mockResolvedValue({
        success: true,
        pagesProcessed: 1,
      });

      mockPrisma.processingQueue.update.mockResolvedValue({});

      const result = await processNextQueuedBatch();

      expect(result).toBe(true);
      expect(mockProcessDocumentBatch).toHaveBeenCalledWith('doc-1', 1, 1, 'vision-ai');
    });

    it('should skip entries where all batches are already done', async () => {
      mockPrisma.processingQueue.findMany.mockResolvedValue([
        {
          id: 'queue-1',
          documentId: 'doc-1',
          status: 'queued',
          currentBatch: 25, // equals totalBatches, meaning all done
          totalBatches: 25,
          totalPages: 25,
          pagesProcessed: 25,
          retriesCount: 0,
          metadata: { batchSize: 1, processorType: 'vision-ai' },
        },
      ]);

      const result = await processNextQueuedBatch();

      expect(result).toBe(false);
    });

    // C1: After a successful non-final batch, status should be set back to 'queued' (not 'processing')
    it('should set status to queued (not processing) after a successful non-final batch', async () => {
      mockPrisma.processingQueue.findMany.mockResolvedValue([
        {
          id: 'queue-1',
          documentId: 'doc-1',
          status: 'queued',
          currentBatch: 1, // batch 1 of 25 - not the last batch
          totalBatches: 25,
          totalPages: 25,
          pagesProcessed: 1,
          retriesCount: 0,
          metadata: { batchSize: 1, processorType: 'vision-ai' },
        },
      ]);

      // Lock succeeds
      mockPrisma.processingQueue.updateMany.mockResolvedValue({ count: 1 });

      // Batch processing succeeds
      mockProcessDocumentBatch.mockResolvedValue({
        success: true,
        pagesProcessed: 1,
      });

      mockPrisma.processingQueue.update.mockResolvedValue({});

      await processNextQueuedBatch();

      // Verify status is 'queued', not 'processing'
      expect(mockPrisma.processingQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'queue-1' },
          data: expect.objectContaining({
            status: 'queued',
            currentBatch: 2,
            pagesProcessed: 2,
          }),
        })
      );
    });

    // C1: After the final batch, status should be 'completed'
    it('should set status to completed after the final batch', async () => {
      mockPrisma.processingQueue.findMany.mockResolvedValue([
        {
          id: 'queue-1',
          documentId: 'doc-1',
          status: 'queued',
          currentBatch: 24, // batch 24 of 25 - the last batch
          totalBatches: 25,
          totalPages: 25,
          pagesProcessed: 24,
          retriesCount: 0,
          metadata: { batchSize: 1, processorType: 'vision-ai' },
        },
      ]);

      // Lock succeeds
      mockPrisma.processingQueue.updateMany.mockResolvedValue({ count: 1 });

      // Batch processing succeeds
      mockProcessDocumentBatch.mockResolvedValue({
        success: true,
        pagesProcessed: 1,
      });

      mockPrisma.processingQueue.update.mockResolvedValue({});
      // Atomic claim for intelligence extraction
      mockPrisma.document.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        processed: false,
        Project: { slug: 'test-project' },
      });
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });

      await processNextQueuedBatch();

      // Verify status is 'completed'
      expect(mockPrisma.processingQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'queue-1' },
          data: expect.objectContaining({
            status: 'completed',
            currentBatch: 25,
            pagesProcessed: 25,
          }),
        })
      );
    });

    // C3: Atomic dedup - only one caller wins the updateMany claim
    it('should skip intelligence extraction when document is already processed (atomic dedup)', async () => {
      mockPrisma.processingQueue.findMany.mockResolvedValue([
        {
          id: 'queue-1',
          documentId: 'doc-1',
          status: 'queued',
          currentBatch: 24,
          totalBatches: 25,
          totalPages: 25,
          pagesProcessed: 24,
          retriesCount: 0,
          metadata: { batchSize: 1, processorType: 'vision-ai' },
        },
      ]);

      // Lock succeeds
      mockPrisma.processingQueue.updateMany.mockResolvedValue({ count: 1 });

      // Batch processing succeeds (final batch)
      mockProcessDocumentBatch.mockResolvedValue({
        success: true,
        pagesProcessed: 1,
      });

      mockPrisma.processingQueue.update.mockResolvedValue({});

      // Atomic claim fails - another process already set processed: true
      mockPrisma.document.updateMany.mockResolvedValue({ count: 0 });

      await processNextQueuedBatch();

      // Verify document.findUnique was NOT called for intelligence extraction
      // (since the claim failed, we skip the entire extraction block)
      expect(mockPrisma.document.findUnique).not.toHaveBeenCalled();
    });

    // C3: Atomic dedup - when claim succeeds, intelligence extraction runs
    it('should run intelligence extraction when atomic claim succeeds', async () => {
      mockPrisma.processingQueue.findMany.mockResolvedValue([
        {
          id: 'queue-1',
          documentId: 'doc-1',
          status: 'queued',
          currentBatch: 24,
          totalBatches: 25,
          totalPages: 25,
          pagesProcessed: 24,
          retriesCount: 0,
          metadata: { batchSize: 1, processorType: 'vision-ai' },
        },
      ]);

      mockPrisma.processingQueue.updateMany.mockResolvedValue({ count: 1 });
      mockProcessDocumentBatch.mockResolvedValue({
        success: true,
        pagesProcessed: 1,
      });
      mockPrisma.processingQueue.update.mockResolvedValue({});

      // Atomic claim succeeds
      mockPrisma.document.updateMany.mockResolvedValue({ count: 1 });
      // Intelligence extraction looks up the document
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        processed: true,
        Project: { slug: 'test-project' },
      });
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });

      await processNextQueuedBatch();

      // Verify the atomic claim was called with correct params
      expect(mockPrisma.document.updateMany).toHaveBeenCalledWith({
        where: { id: 'doc-1', processed: false },
        data: { processed: true, pagesProcessed: 25 },
      });

      // Verify document was looked up for intelligence extraction
      expect(mockPrisma.document.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doc-1' },
          include: { Project: true },
        })
      );
    });
  });

  // Stale batch recovery in processNextQueuedBatch
  describe('stale batch recovery', () => {
    it('should reset ProcessingQueue entries stuck in processing for >5 minutes', async () => {
      // Simulate a stale entry stuck in 'processing' for 10 minutes
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      mockPrisma.processingQueue.findMany
        .mockResolvedValueOnce([
          { documentId: 'stuck-doc', status: 'processing', updatedAt: tenMinutesAgo },
        ]) // stale check
        .mockResolvedValueOnce([]); // no queued entries after reset

      // Reset succeeds
      mockPrisma.processingQueue.updateMany.mockResolvedValue({ count: 1 });

      await processNextQueuedBatch();

      // Verify updateMany was called to reset stale entries
      expect(mockPrisma.processingQueue.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            documentId: 'stuck-doc',
            status: 'processing',
            updatedAt: expect.objectContaining({ lt: expect.any(Date) }),
          }),
          data: expect.objectContaining({
            status: 'queued',
          }),
        })
      );
    });

    it('should not reset entries that are recently updated (within 5 minutes)', async () => {
      // No stale entries
      mockPrisma.processingQueue.findMany
        .mockResolvedValueOnce([]) // no stale processing entries
        .mockResolvedValueOnce([]); // no queued entries

      await processNextQueuedBatch();

      // Only the stale check findMany should have been called
      expect(mockPrisma.processingQueue.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('processQueuedDocument concurrent dispatch', () => {
    const mockPdfBuffer = Buffer.from('fake-pdf-content');

    beforeEach(() => {
      // Mock PDF download
      mockGetFileUrl.mockResolvedValue('https://fake-url.com/doc.pdf');
      global.fetch = vi.fn().mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockPdfBuffer.buffer),
      }) as any;
    });

    it('should skip processing when document is already completed', async () => {
      mockPrisma.processingQueue.findFirst.mockResolvedValue({
        id: 'queue-1',
        documentId: 'doc-1',
        status: 'completed',
        currentBatch: 5,
        totalBatches: 5,
        totalPages: 25,
        pagesProcessed: 25,
        retriesCount: 0,
        metadata: { batchSize: 5 },
      });

      // Stale batch reset (no stale entries)
      mockPrisma.processingQueue.updateMany.mockResolvedValue({ count: 0 });

      await processQueuedDocument('doc-1');

      // Should NOT try to claim or process
      expect(mockProcessDocumentBatch).not.toHaveBeenCalled();
    });

    it('should dispatch batches concurrently and aggregate results', async () => {
      const queueEntry = {
        id: 'queue-1',
        documentId: 'doc-1',
        status: 'queued',
        currentBatch: 0,
        totalBatches: 2,
        totalPages: 10,
        pagesProcessed: 0,
        retriesCount: 0,
        metadata: { batchSize: 5, processorType: 'vision-ai' },
      };

      mockPrisma.processingQueue.findFirst.mockResolvedValue(queueEntry);
      // Stale reset: no stale entries
      mockPrisma.processingQueue.updateMany
        .mockResolvedValueOnce({ count: 0 }) // stale reset
        .mockResolvedValueOnce({ count: 1 }); // claim succeeds

      mockPrisma.document.update.mockResolvedValue({});
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        cloud_storage_path: 'docs/test.pdf',
        isPublic: false,
        Project: { slug: 'test-project' },
        name: 'test.pdf',
      });

      // Both batches succeed
      mockProcessDocumentBatch
        .mockResolvedValueOnce({ success: true, pagesProcessed: 5, providerStats: {} })
        .mockResolvedValueOnce({ success: true, pagesProcessed: 5, providerStats: {} });

      mockPrisma.processingQueue.update.mockResolvedValue({});
      mockPrisma.document.updateMany.mockResolvedValue({ count: 1 }); // post-processing claim
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      mockTriggerEnhancement.mockResolvedValue(undefined);

      await processQueuedDocument('doc-1');

      // Both batches should have been called with the preloaded buffer
      expect(mockProcessDocumentBatch).toHaveBeenCalledTimes(2);
      expect(mockProcessDocumentBatch).toHaveBeenCalledWith(
        'doc-1', 1, 5, 'vision-ai', expect.any(Buffer)
      );
      expect(mockProcessDocumentBatch).toHaveBeenCalledWith(
        'doc-1', 6, 10, 'vision-ai', expect.any(Buffer)
      );

      // Queue should be updated with completed status and concurrency metadata
      expect(mockPrisma.processingQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'completed',
            pagesProcessed: 10,
            currentBatch: 2,
            metadata: expect.objectContaining({
              concurrency: 1,
              processingMode: 'concurrent',
            }),
          }),
        })
      );
    });

    it('should handle partial failure: save successful batches and record failed ranges', async () => {
      const queueEntry = {
        id: 'queue-1',
        documentId: 'doc-1',
        status: 'queued',
        currentBatch: 0,
        totalBatches: 2,
        totalPages: 10,
        pagesProcessed: 0,
        retriesCount: 0,
        metadata: { batchSize: 5, processorType: 'vision-ai' },
      };

      mockPrisma.processingQueue.findFirst.mockResolvedValue(queueEntry);
      mockPrisma.processingQueue.updateMany
        .mockResolvedValueOnce({ count: 0 }) // stale reset
        .mockResolvedValueOnce({ count: 1 }); // claim

      mockPrisma.document.update.mockResolvedValue({});
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        cloud_storage_path: 'docs/test.pdf',
        isPublic: false,
      });

      // Batch 1 succeeds, batch 2 fails
      mockProcessDocumentBatch
        .mockResolvedValueOnce({ success: true, pagesProcessed: 5, providerStats: {} })
        .mockResolvedValueOnce({ success: false, pagesProcessed: 0, error: 'Vision API timeout' });

      mockPrisma.processingQueue.update.mockResolvedValue({});

      await processQueuedDocument('doc-1');

      // Should be queued (not completed or failed) for retry
      expect(mockPrisma.processingQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'queued', // Partial success — queued for retry
            pagesProcessed: 5,
            metadata: expect.objectContaining({
              failedBatchRanges: expect.arrayContaining([
                expect.objectContaining({
                  startPage: 6,
                  endPage: 10,
                  error: 'Vision API timeout',
                }),
              ]),
            }),
          }),
        })
      );
    });

    it('should store concurrency and processingMode in metadata', async () => {
      const queueEntry = {
        id: 'queue-1',
        documentId: 'doc-1',
        status: 'queued',
        currentBatch: 0,
        totalBatches: 1,
        totalPages: 5,
        pagesProcessed: 0,
        retriesCount: 0,
        metadata: { batchSize: 5, processorType: 'vision-ai' },
      };

      mockPrisma.processingQueue.findFirst.mockResolvedValue(queueEntry);
      mockPrisma.processingQueue.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 });

      mockPrisma.document.update.mockResolvedValue({});
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        cloud_storage_path: 'docs/test.pdf',
        isPublic: false,
        Project: { slug: 'test-project' },
        name: 'test.pdf',
      });
      mockProcessDocumentBatch.mockResolvedValue({ success: true, pagesProcessed: 5, providerStats: {} });
      mockPrisma.processingQueue.update.mockResolvedValue({});
      mockPrisma.document.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      mockTriggerEnhancement.mockResolvedValue(undefined);

      await processQueuedDocument('doc-1');

      expect(mockPrisma.processingQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              concurrency: 1,
              processingMode: 'concurrent',
            }),
          }),
        })
      );
    });
  });
});
