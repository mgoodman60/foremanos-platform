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
vi.mock('@/lib/intelligence-orchestrator', () => ({
  runIntelligenceExtraction: vi.fn().mockResolvedValue({ phasesRun: [] }),
}));
vi.mock('@/lib/room-extractor', () => ({
  extractRoomsFromDocuments: vi.fn().mockResolvedValue({ rooms: [] }),
  saveExtractedRooms: vi.fn().mockResolvedValue({ created: 0, updated: 0 }),
}));
vi.mock('@/lib/takeoff-extractor', () => ({
  autoExtractTakeoffs: vi.fn().mockResolvedValue({ success: true, itemCount: 0 }),
}));

// Import after mocks
import { processNextQueuedBatch, queueDocumentForProcessing } from '@/lib/document-processing-queue';

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

      await queueDocumentForProcessing('doc-1', 25, 5, 'vision-ai');

      expect(mockPrisma.processingQueue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          documentId: 'doc-1',
          status: 'queued',
          totalPages: 25,
          pagesProcessed: 0,
          currentBatch: 0,
          totalBatches: 5, // ceil(25/5)
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
          totalBatches: 5,
          totalPages: 25,
          pagesProcessed: 0,
          retriesCount: 0,
          metadata: { batchSize: 5, processorType: 'vision-ai' },
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
          totalBatches: 5,
          totalPages: 25,
          pagesProcessed: 0,
          retriesCount: 0,
          metadata: { batchSize: 5, processorType: 'vision-ai' },
        },
      ]);

      // Lock succeeds
      mockPrisma.processingQueue.updateMany.mockResolvedValue({ count: 1 });

      // Batch processing succeeds
      mockProcessDocumentBatch.mockResolvedValue({
        success: true,
        pagesProcessed: 5,
      });

      mockPrisma.processingQueue.update.mockResolvedValue({});

      const result = await processNextQueuedBatch();

      expect(result).toBe(true);
      expect(mockProcessDocumentBatch).toHaveBeenCalledWith('doc-1', 1, 5, 'vision-ai');
    });

    it('should skip entries where all batches are already done', async () => {
      mockPrisma.processingQueue.findMany.mockResolvedValue([
        {
          id: 'queue-1',
          documentId: 'doc-1',
          status: 'queued',
          currentBatch: 5, // equals totalBatches, meaning all done
          totalBatches: 5,
          totalPages: 25,
          pagesProcessed: 25,
          retriesCount: 0,
          metadata: { batchSize: 5, processorType: 'vision-ai' },
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
          currentBatch: 1, // batch 1 of 5 - not the last batch
          totalBatches: 5,
          totalPages: 25,
          pagesProcessed: 5,
          retriesCount: 0,
          metadata: { batchSize: 5, processorType: 'vision-ai' },
        },
      ]);

      // Lock succeeds
      mockPrisma.processingQueue.updateMany.mockResolvedValue({ count: 1 });

      // Batch processing succeeds
      mockProcessDocumentBatch.mockResolvedValue({
        success: true,
        pagesProcessed: 5,
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
            pagesProcessed: 10,
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
          currentBatch: 4, // batch 4 of 5 - the last batch
          totalBatches: 5,
          totalPages: 25,
          pagesProcessed: 20,
          retriesCount: 0,
          metadata: { batchSize: 5, processorType: 'vision-ai' },
        },
      ]);

      // Lock succeeds
      mockPrisma.processingQueue.updateMany.mockResolvedValue({ count: 1 });

      // Batch processing succeeds
      mockProcessDocumentBatch.mockResolvedValue({
        success: true,
        pagesProcessed: 5,
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
            currentBatch: 5,
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
          currentBatch: 4,
          totalBatches: 5,
          totalPages: 25,
          pagesProcessed: 20,
          retriesCount: 0,
          metadata: { batchSize: 5, processorType: 'vision-ai' },
        },
      ]);

      // Lock succeeds
      mockPrisma.processingQueue.updateMany.mockResolvedValue({ count: 1 });

      // Batch processing succeeds (final batch)
      mockProcessDocumentBatch.mockResolvedValue({
        success: true,
        pagesProcessed: 5,
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
          currentBatch: 4,
          totalBatches: 5,
          totalPages: 25,
          pagesProcessed: 20,
          retriesCount: 0,
          metadata: { batchSize: 5, processorType: 'vision-ai' },
        },
      ]);

      mockPrisma.processingQueue.updateMany.mockResolvedValue({ count: 1 });
      mockProcessDocumentBatch.mockResolvedValue({
        success: true,
        pagesProcessed: 5,
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

  // C4: triggerAutoTakeoffAfterProcessing is no longer called from processQueuedDocument
  describe('processQueuedDocument', () => {
    it('should not call triggerAutoTakeoffAfterProcessing after completion (C4 dedup)', async () => {
      const { processQueuedDocument } = await import('@/lib/document-processing-queue');

      const completedEntry = {
        id: 'queue-1',
        documentId: 'doc-1',
        status: 'completed',
        currentBatch: 5,
        totalBatches: 5,
        totalPages: 25,
        pagesProcessed: 25,
        retriesCount: 0,
        lastError: null,
        metadata: { batchSize: 5 },
      };

      // findFirst is called 3 times:
      // 1. Initial entry lookup
      // 2. Inside while loop - sees completed, breaks
      // 3. Final status check
      mockPrisma.processingQueue.findFirst
        .mockResolvedValueOnce(completedEntry)  // initial
        .mockResolvedValueOnce(completedEntry)  // while loop
        .mockResolvedValueOnce(completedEntry); // final status

      mockPrisma.document.update.mockResolvedValue({});
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        Project: { slug: 'test-project' },
        name: 'test-doc.pdf',
      });
      mockTriggerEnhancement.mockResolvedValue(undefined);

      await processQueuedDocument('doc-1');

      // Verify enhancement was triggered (replaces old takeoff trigger)
      expect(mockTriggerEnhancement).toHaveBeenCalledWith('test-project', 'test-doc.pdf');

      // The module no longer imports triggerAutoTakeoffAfterProcessing at all
      // This is verified by the removal of the import in the source file
    });
  });
});
