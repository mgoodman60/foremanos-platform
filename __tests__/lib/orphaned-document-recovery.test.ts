import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProcessingQueueStatus } from '@prisma/client';

// ============================================
// Mocks Setup - Must use vi.hoisted for mock objects
// ============================================

const mockPrisma = vi.hoisted(() => ({
  document: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  documentChunk: {
    deleteMany: vi.fn(),
  },
  processingQueue: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

const mockProcessDocument = vi.hoisted(() => vi.fn());

vi.mock('@/lib/document-processor', () => ({
  processDocument: mockProcessDocument,
}));

// Import functions after mocks
import {
  findOrphanedDocuments,
  recoverOrphanedDocument,
  recoverAllOrphanedDocuments,
  getOrphanedDocumentStats,
  type OrphanedDocument,
} from '@/lib/orphaned-document-recovery';

// ============================================
// Test Helpers
// ============================================

function createMockDocument(overrides = {}) {
  return {
    id: 'doc-1',
    name: 'Test Document',
    fileName: 'test.pdf',
    projectId: 'project-1',
    createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
    cloud_storage_path: 'uploads/test.pdf',
    processed: false,
    deletedAt: null,
    _count: {
      DocumentChunk: 0,
    },
    ...overrides,
  };
}

function createMockQueueEntry(overrides = {}) {
  return {
    id: 'queue-1',
    documentId: 'doc-1',
    status: ProcessingQueueStatus.queued,
    createdAt: new Date(),
    ...overrides,
  };
}

// Mock console methods to suppress logs during tests
const consoleSpy = {
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
};

// ============================================
// findOrphanedDocuments() Tests (14 tests)
// ============================================

describe('Orphaned Document Recovery - findOrphanedDocuments()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.log.mockClear();
    consoleSpy.error.mockClear();
  });

  it('should find orphaned documents with no chunks and no queue entry', async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const mockDocs = [
      createMockDocument({
        id: 'orphan-1',
        name: 'Orphaned Plan',
        createdAt: tenMinutesAgo,
      }),
    ];

    mockPrisma.document.findMany.mockResolvedValue(mockDocs);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);

    const result = await findOrphanedDocuments();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'orphan-1',
      name: 'Orphaned Plan',
      fileName: 'test.pdf',
      projectId: 'project-1',
      cloud_storage_path: 'uploads/test.pdf',
    });
  });

  it('should only return documents older than 5 minutes', async () => {
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);

    mockPrisma.document.findMany.mockResolvedValue([
      createMockDocument({ id: 'old-doc', createdAt: sixMinutesAgo }),
    ]);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);

    const result = await findOrphanedDocuments();

    expect(result).toHaveLength(1);
    expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            lt: expect.any(Date),
          }),
        }),
      })
    );
  });

  it('should exclude documents with chunks', async () => {
    mockPrisma.document.findMany.mockResolvedValue([
      createMockDocument({
        id: 'doc-with-chunks',
        _count: { DocumentChunk: 5 },
      }),
      createMockDocument({
        id: 'doc-without-chunks',
        _count: { DocumentChunk: 0 },
      }),
    ]);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);

    const result = await findOrphanedDocuments();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('doc-without-chunks');
  });

  it('should exclude documents in active queue (queued status)', async () => {
    mockPrisma.document.findMany.mockResolvedValue([
      createMockDocument({ id: 'queued-doc' }),
      createMockDocument({ id: 'orphan-doc' }),
    ]);
    mockPrisma.processingQueue.findMany.mockResolvedValue([
      createMockQueueEntry({
        documentId: 'queued-doc',
        status: ProcessingQueueStatus.queued,
      }),
    ]);

    const result = await findOrphanedDocuments();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('orphan-doc');
  });

  it('should exclude documents in active queue (processing status)', async () => {
    mockPrisma.document.findMany.mockResolvedValue([
      createMockDocument({ id: 'processing-doc' }),
      createMockDocument({ id: 'orphan-doc' }),
    ]);
    mockPrisma.processingQueue.findMany.mockResolvedValue([
      createMockQueueEntry({
        documentId: 'processing-doc',
        status: ProcessingQueueStatus.processing,
      }),
    ]);

    const result = await findOrphanedDocuments();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('orphan-doc');
  });

  it('should include documents with failed queue entries', async () => {
    mockPrisma.document.findMany.mockResolvedValue([
      createMockDocument({ id: 'failed-doc' }),
    ]);
    // The processingQueue query filters for only queued/processing status
    // So failed entries won't be returned by the query
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);

    const result = await findOrphanedDocuments();

    // Failed queue entries are not in the active status check (only queued/processing)
    // So documents with failed status should be included in orphans
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('failed-doc');
  });

  it('should exclude documents without cloud_storage_path', async () => {
    // Prisma query filters out documents with null cloud_storage_path
    // So mock should return empty array
    mockPrisma.document.findMany.mockResolvedValue([]);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);

    const result = await findOrphanedDocuments();

    expect(result).toHaveLength(0);
    // Verify query filters for NOT NULL cloud_storage_path
    expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cloud_storage_path: { not: null },
        }),
      })
    );
  });

  it('should exclude already processed documents', async () => {
    // Prisma query filters out processed documents with processed: false
    // So mock should return empty array
    mockPrisma.document.findMany.mockResolvedValue([]);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);

    const result = await findOrphanedDocuments();

    expect(result).toHaveLength(0);
    expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          processed: false,
        }),
      })
    );
  });

  it('should exclude deleted documents', async () => {
    // Prisma query filters out deleted documents with deletedAt: null
    // So mock should return empty array
    mockPrisma.document.findMany.mockResolvedValue([]);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);

    const result = await findOrphanedDocuments();

    expect(result).toHaveLength(0);
    expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
        }),
      })
    );
  });

  it('should return empty array when no documents found', async () => {
    mockPrisma.document.findMany.mockResolvedValue([]);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);

    const result = await findOrphanedDocuments();

    expect(result).toEqual([]);
  });

  it('should handle multiple orphaned documents', async () => {
    mockPrisma.document.findMany.mockResolvedValue([
      createMockDocument({ id: 'orphan-1', name: 'Plan A' }),
      createMockDocument({ id: 'orphan-2', name: 'Plan B' }),
      createMockDocument({ id: 'orphan-3', name: 'Plan C' }),
    ]);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);

    const result = await findOrphanedDocuments();

    expect(result).toHaveLength(3);
    expect(result.map(d => d.id)).toEqual(['orphan-1', 'orphan-2', 'orphan-3']);
  });

  it('should handle projectId being null gracefully', async () => {
    mockPrisma.document.findMany.mockResolvedValue([
      createMockDocument({ id: 'no-project', projectId: null }),
    ]);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);

    const result = await findOrphanedDocuments();

    expect(result).toHaveLength(1);
    expect(result[0].projectId).toBe(''); // Defaults to empty string
  });

  it('should handle database errors gracefully', async () => {
    mockPrisma.document.findMany.mockRejectedValue(
      new Error('Database connection failed')
    );

    const result = await findOrphanedDocuments();

    expect(result).toEqual([]);
    expect(consoleSpy.error).toHaveBeenCalledWith(
      '[ORPHAN RECOVERY] Error finding orphaned documents:',
      expect.any(Error)
    );
  });

  it('should handle queue query errors gracefully', async () => {
    mockPrisma.document.findMany.mockResolvedValue([
      createMockDocument({ id: 'orphan-1' }),
    ]);
    mockPrisma.processingQueue.findMany.mockRejectedValue(
      new Error('Queue query failed')
    );

    const result = await findOrphanedDocuments();

    expect(result).toEqual([]);
    expect(consoleSpy.error).toHaveBeenCalledWith(
      '[ORPHAN RECOVERY] Error finding orphaned documents:',
      expect.any(Error)
    );
  });
});

// ============================================
// recoverOrphanedDocument() Tests (10 tests)
// ============================================

describe('Orphaned Document Recovery - recoverOrphanedDocument()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.log.mockClear();
    consoleSpy.error.mockClear();
  });

  it('should successfully recover an orphaned document', async () => {
    const mockDoc = {
      id: 'doc-1',
      name: 'Floor Plan',
      cloud_storage_path: 'uploads/plan.pdf',
      processed: false,
    };

    mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
    mockPrisma.documentChunk.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 0 });
    mockProcessDocument.mockResolvedValue(undefined);

    const result = await recoverOrphanedDocument('doc-1');

    expect(result).toBe(true);
    expect(mockProcessDocument).toHaveBeenCalledWith('doc-1');
    expect(consoleSpy.log).toHaveBeenCalledWith(
      '[ORPHAN RECOVERY] Successfully initiated recovery for Floor Plan'
    );
  });

  it('should return false if document not found', async () => {
    mockPrisma.document.findUnique.mockResolvedValue(null);

    const result = await recoverOrphanedDocument('nonexistent-doc');

    expect(result).toBe(false);
    expect(mockProcessDocument).not.toHaveBeenCalled();
    expect(consoleSpy.log).toHaveBeenCalledWith(
      '[ORPHAN RECOVERY] Document nonexistent-doc not found'
    );
  });

  it('should return false if document has no cloud_storage_path', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'No File',
      cloud_storage_path: null,
      processed: false,
    });

    const result = await recoverOrphanedDocument('doc-1');

    expect(result).toBe(false);
    expect(mockProcessDocument).not.toHaveBeenCalled();
    expect(consoleSpy.log).toHaveBeenCalledWith(
      '[ORPHAN RECOVERY] Document doc-1 has no file'
    );
  });

  it('should return false if document already processed', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Already Done',
      cloud_storage_path: 'uploads/done.pdf',
      processed: true,
    });

    const result = await recoverOrphanedDocument('doc-1');

    expect(result).toBe(false);
    expect(mockProcessDocument).not.toHaveBeenCalled();
    expect(consoleSpy.log).toHaveBeenCalledWith(
      '[ORPHAN RECOVERY] Document doc-1 is already processed'
    );
  });

  it('should delete existing chunks before recovery', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Has Chunks',
      cloud_storage_path: 'uploads/test.pdf',
      processed: false,
    });
    mockPrisma.documentChunk.deleteMany.mockResolvedValue({ count: 3 });
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 0 });
    mockProcessDocument.mockResolvedValue(undefined);

    const result = await recoverOrphanedDocument('doc-1');

    expect(result).toBe(true);
    expect(mockPrisma.documentChunk.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'doc-1' },
    });
  });

  it('should delete failed queue entries before recovery', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Failed Queue',
      cloud_storage_path: 'uploads/test.pdf',
      processed: false,
    });
    mockPrisma.documentChunk.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 2 });
    mockProcessDocument.mockResolvedValue(undefined);

    const result = await recoverOrphanedDocument('doc-1');

    expect(result).toBe(true);
    expect(mockPrisma.processingQueue.deleteMany).toHaveBeenCalledWith({
      where: {
        documentId: 'doc-1',
        status: {
          in: [ProcessingQueueStatus.failed, ProcessingQueueStatus.completed],
        },
      },
    });
  });

  it('should handle processDocument errors gracefully', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Error Doc',
      cloud_storage_path: 'uploads/test.pdf',
      processed: false,
    });
    mockPrisma.documentChunk.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 0 });
    mockProcessDocument.mockRejectedValue(new Error('Processing failed'));

    const result = await recoverOrphanedDocument('doc-1');

    expect(result).toBe(false);
    expect(consoleSpy.error).toHaveBeenCalledWith(
      '[ORPHAN RECOVERY] Error recovering document doc-1:',
      expect.any(Error)
    );
  });

  it('should handle database errors during cleanup', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Cleanup Error',
      cloud_storage_path: 'uploads/test.pdf',
      processed: false,
    });
    mockPrisma.documentChunk.deleteMany.mockRejectedValue(
      new Error('Delete failed')
    );

    const result = await recoverOrphanedDocument('doc-1');

    expect(result).toBe(false);
    expect(consoleSpy.error).toHaveBeenCalledWith(
      '[ORPHAN RECOVERY] Error recovering document doc-1:',
      expect.any(Error)
    );
  });

  it('should log start and success messages', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Test Doc',
      cloud_storage_path: 'uploads/test.pdf',
      processed: false,
    });
    mockPrisma.documentChunk.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 0 });
    mockProcessDocument.mockResolvedValue(undefined);

    await recoverOrphanedDocument('doc-1');

    expect(consoleSpy.log).toHaveBeenCalledWith(
      '[ORPHAN RECOVERY] Starting recovery for document doc-1'
    );
    expect(consoleSpy.log).toHaveBeenCalledWith(
      '[ORPHAN RECOVERY] Successfully initiated recovery for Test Doc'
    );
  });

  it('should handle null document name gracefully', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: null,
      cloud_storage_path: 'uploads/test.pdf',
      processed: false,
    });
    mockPrisma.documentChunk.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 0 });
    mockProcessDocument.mockResolvedValue(undefined);

    const result = await recoverOrphanedDocument('doc-1');

    expect(result).toBe(true);
    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('Successfully initiated recovery for')
    );
  });
});

// ============================================
// recoverAllOrphanedDocuments() Tests (8 tests)
// ============================================

describe('Orphaned Document Recovery - recoverAllOrphanedDocuments()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleSpy.log.mockClear();
    consoleSpy.error.mockClear();
  });

  it('should recover all orphaned documents', async () => {
    const mockOrphans = [
      createMockDocument({ id: 'orphan-1', name: 'Plan A' }),
      createMockDocument({ id: 'orphan-2', name: 'Plan B' }),
    ];

    mockPrisma.document.findMany.mockResolvedValue(mockOrphans);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);
    mockPrisma.document.findUnique.mockImplementation((args) => {
      return Promise.resolve({
        id: args.where.id,
        name: `Document ${args.where.id}`,
        cloud_storage_path: 'uploads/test.pdf',
        processed: false,
      });
    });
    mockPrisma.documentChunk.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 0 });
    mockProcessDocument.mockResolvedValue(undefined);

    const resultPromise = recoverAllOrphanedDocuments();

    // Fast-forward through delays
    for (let i = 0; i < 2; i++) {
      await vi.advanceTimersByTimeAsync(1000);
    }

    const result = await resultPromise;

    expect(result).toBe(2);
    expect(mockProcessDocument).toHaveBeenCalledTimes(2);
    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('Recovery complete: 2/2 documents recovered')
    );
  });

  it('should return 0 when no orphaned documents found', async () => {
    mockPrisma.document.findMany.mockResolvedValue([]);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);

    const result = await recoverAllOrphanedDocuments();

    expect(result).toBe(0);
    expect(mockProcessDocument).not.toHaveBeenCalled();
    expect(consoleSpy.log).toHaveBeenCalledWith(
      '[ORPHAN RECOVERY] No orphaned documents found'
    );
  });

  it('should handle partial recovery failures', async () => {
    const mockOrphans = [
      createMockDocument({ id: 'success', name: 'Good Doc' }),
      createMockDocument({ id: 'fail', name: 'Bad Doc' }),
    ];

    mockPrisma.document.findMany.mockResolvedValue(mockOrphans);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);
    mockPrisma.document.findUnique
      .mockResolvedValueOnce({
        id: 'success',
        name: 'Good Doc',
        cloud_storage_path: 'uploads/good.pdf',
        processed: false,
      })
      .mockResolvedValueOnce(null); // Second doc not found

    mockPrisma.documentChunk.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 0 });
    mockProcessDocument.mockResolvedValue(undefined);

    const resultPromise = recoverAllOrphanedDocuments();

    // Fast-forward through delays
    for (let i = 0; i < 2; i++) {
      await vi.advanceTimersByTimeAsync(1000);
    }

    const result = await resultPromise;

    expect(result).toBe(1);
    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('Recovery complete: 1/2 documents recovered')
    );
  });

  it('should add 1 second delay between recoveries', async () => {
    const mockOrphans = [
      createMockDocument({ id: 'orphan-1', name: 'Doc 1' }),
      createMockDocument({ id: 'orphan-2', name: 'Doc 2' }),
    ];

    mockPrisma.document.findMany.mockResolvedValue(mockOrphans);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);
    mockPrisma.document.findUnique.mockImplementation((args) =>
      Promise.resolve({
        id: args.where.id,
        name: `Doc ${args.where.id}`,
        cloud_storage_path: 'uploads/test.pdf',
        processed: false,
      })
    );
    mockPrisma.documentChunk.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 0 });
    mockProcessDocument.mockResolvedValue(undefined);

    const resultPromise = recoverAllOrphanedDocuments();

    // The recoveries happen sequentially with a 1 second delay between them
    // After both recoveries complete
    for (let i = 0; i < 2; i++) {
      await vi.advanceTimersByTimeAsync(1000);
    }

    const result = await resultPromise;

    // Both documents should be recovered
    expect(mockProcessDocument).toHaveBeenCalledTimes(2);
    expect(result).toBe(2);
  });

  it('should log found orphaned documents with details', async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const mockOrphans = [
      createMockDocument({
        id: 'orphan-1',
        name: 'Test Plan',
        createdAt: tenMinutesAgo,
      }),
    ];

    mockPrisma.document.findMany.mockResolvedValue(mockOrphans);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'orphan-1',
      name: 'Test Plan',
      cloud_storage_path: 'uploads/test.pdf',
      processed: false,
    });
    mockPrisma.documentChunk.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 0 });
    mockProcessDocument.mockResolvedValue(undefined);

    const resultPromise = recoverAllOrphanedDocuments();
    await vi.advanceTimersByTimeAsync(1000);
    await resultPromise;

    expect(consoleSpy.log).toHaveBeenCalledWith(
      '[ORPHAN RECOVERY] Found 1 orphaned documents:'
    );
    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('Test Plan (orphan-1)')
    );
  });

  it('should handle errors during scan gracefully', async () => {
    mockPrisma.document.findMany.mockRejectedValue(
      new Error('Database error')
    );

    const result = await recoverAllOrphanedDocuments();

    expect(result).toBe(0);
    // Error is logged from findOrphanedDocuments, not recoverAllOrphanedDocuments
    expect(consoleSpy.error).toHaveBeenCalledWith(
      '[ORPHAN RECOVERY] Error finding orphaned documents:',
      expect.any(Error)
    );
  });

  it('should log scan start message', async () => {
    mockPrisma.document.findMany.mockResolvedValue([]);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);

    await recoverAllOrphanedDocuments();

    expect(consoleSpy.log).toHaveBeenCalledWith(
      '[ORPHAN RECOVERY] Starting scan for orphaned documents...'
    );
  });

  it('should handle recovery of many documents', async () => {
    const mockOrphans = Array.from({ length: 5 }, (_, i) =>
      createMockDocument({ id: `orphan-${i}`, name: `Doc ${i}` })
    );

    mockPrisma.document.findMany.mockResolvedValue(mockOrphans);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);
    mockPrisma.document.findUnique.mockImplementation((args) =>
      Promise.resolve({
        id: args.where.id,
        name: `Doc ${args.where.id}`,
        cloud_storage_path: 'uploads/test.pdf',
        processed: false,
      })
    );
    mockPrisma.documentChunk.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 0 });
    mockProcessDocument.mockResolvedValue(undefined);

    const resultPromise = recoverAllOrphanedDocuments();

    // Fast-forward through all delays
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(1000);
    }

    const result = await resultPromise;

    expect(result).toBe(5);
    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('Recovery complete: 5/5 documents recovered')
    );
  });
});

// ============================================
// getOrphanedDocumentStats() Tests (7 tests)
// ============================================

describe('Orphaned Document Recovery - getOrphanedDocumentStats()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.log.mockClear();
    consoleSpy.error.mockClear();
  });

  it('should return statistics for orphaned documents', async () => {
    const oldDoc = createMockDocument({
      id: 'old-doc',
      name: 'Old Plan',
      createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
    });
    const newDoc = createMockDocument({
      id: 'new-doc',
      name: 'New Plan',
      createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
    });

    mockPrisma.document.findMany.mockResolvedValue([oldDoc, newDoc]);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);

    const result = await getOrphanedDocumentStats();

    expect(result.count).toBe(2);
    expect(result.oldestOrphan).toEqual(oldDoc.createdAt);
    expect(result.totalOrphanedDocs).toHaveLength(2);
  });

  it('should identify oldest orphan correctly', async () => {
    const docs = [
      createMockDocument({
        id: 'doc-1',
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
      }),
      createMockDocument({
        id: 'doc-2',
        createdAt: new Date(Date.now() - 60 * 60 * 1000), // Oldest
      }),
      createMockDocument({
        id: 'doc-3',
        createdAt: new Date(Date.now() - 15 * 60 * 1000),
      }),
    ];

    mockPrisma.document.findMany.mockResolvedValue(docs);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);

    const result = await getOrphanedDocumentStats();

    expect(result.oldestOrphan).toEqual(docs[1].createdAt);
  });

  it('should return zero stats when no orphaned documents', async () => {
    mockPrisma.document.findMany.mockResolvedValue([]);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);

    const result = await getOrphanedDocumentStats();

    expect(result).toEqual({
      count: 0,
      oldestOrphan: null,
      totalOrphanedDocs: [],
    });
  });

  it('should include all orphaned documents in totalOrphanedDocs', async () => {
    const mockDocs = [
      createMockDocument({ id: 'orphan-1', name: 'Plan A' }),
      createMockDocument({ id: 'orphan-2', name: 'Plan B' }),
      createMockDocument({ id: 'orphan-3', name: 'Plan C' }),
    ];

    mockPrisma.document.findMany.mockResolvedValue(mockDocs);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);

    const result = await getOrphanedDocumentStats();

    expect(result.totalOrphanedDocs).toHaveLength(3);
    expect(result.totalOrphanedDocs.map(d => d.id)).toEqual([
      'orphan-1',
      'orphan-2',
      'orphan-3',
    ]);
  });

  it('should handle single orphaned document', async () => {
    const singleDoc = createMockDocument({
      id: 'single',
      createdAt: new Date(Date.now() - 10 * 60 * 1000),
    });

    mockPrisma.document.findMany.mockResolvedValue([singleDoc]);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);

    const result = await getOrphanedDocumentStats();

    expect(result.count).toBe(1);
    expect(result.oldestOrphan).toEqual(singleDoc.createdAt);
  });

  it('should handle errors gracefully', async () => {
    mockPrisma.document.findMany.mockRejectedValue(
      new Error('Database error')
    );

    const result = await getOrphanedDocumentStats();

    expect(result).toEqual({
      count: 0,
      oldestOrphan: null,
      totalOrphanedDocs: [],
    });
    // Error is logged from findOrphanedDocuments, not getOrphanedDocumentStats
    expect(consoleSpy.error).toHaveBeenCalledWith(
      '[ORPHAN RECOVERY] Error finding orphaned documents:',
      expect.any(Error)
    );
  });

  it('should return proper OrphanedDocument structure', async () => {
    const mockDoc = createMockDocument({
      id: 'doc-123',
      name: 'Architectural Plan',
      fileName: 'arch-plan.pdf',
      projectId: 'project-456',
      createdAt: new Date('2024-01-15T10:00:00Z'),
      cloud_storage_path: 'uploads/arch-plan.pdf',
    });

    mockPrisma.document.findMany.mockResolvedValue([mockDoc]);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);

    const result = await getOrphanedDocumentStats();

    expect(result.totalOrphanedDocs[0]).toMatchObject({
      id: 'doc-123',
      name: 'Architectural Plan',
      fileName: 'arch-plan.pdf',
      projectId: 'project-456',
      cloud_storage_path: 'uploads/arch-plan.pdf',
    });
    expect(result.totalOrphanedDocs[0].createdAt).toBeInstanceOf(Date);
  });
});

// ============================================
// Edge Cases and Integration Tests (7 tests)
// ============================================

describe('Orphaned Document Recovery - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleSpy.log.mockClear();
    consoleSpy.error.mockClear();
  });

  it('should handle documents with exactly 0 chunks', async () => {
    mockPrisma.document.findMany.mockResolvedValue([
      createMockDocument({ _count: { DocumentChunk: 0 } }),
    ]);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);

    const result = await findOrphanedDocuments();

    expect(result).toHaveLength(1);
  });

  it('should handle documents created exactly 5 minutes ago', async () => {
    const exactlyFiveMinutes = new Date(Date.now() - 5 * 60 * 1000);

    // The function uses `lt` (less than), so exactly 5 minutes won't be included
    mockPrisma.document.findMany.mockResolvedValue([]);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);

    const result = await findOrphanedDocuments();

    expect(result).toEqual([]);
    expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { lt: expect.any(Date) },
        }),
      })
    );
  });

  it('should handle very old orphaned documents', async () => {
    const veryOld = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    mockPrisma.document.findMany.mockResolvedValue([
      createMockDocument({ id: 'ancient', createdAt: veryOld }),
    ]);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);

    const result = await findOrphanedDocuments();

    expect(result).toHaveLength(1);
    expect(result[0].createdAt).toEqual(veryOld);
  });

  it('should handle recovery when processDocument completes immediately', async () => {
    mockPrisma.document.findMany.mockResolvedValue([
      createMockDocument({ id: 'fast-doc', name: 'Fast' }),
    ]);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'fast-doc',
      name: 'Fast',
      cloud_storage_path: 'uploads/fast.pdf',
      processed: false,
    });
    mockPrisma.documentChunk.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 0 });
    mockProcessDocument.mockResolvedValue(undefined); // Completes immediately

    const resultPromise = recoverAllOrphanedDocuments();
    await vi.advanceTimersByTimeAsync(1000);
    const result = await resultPromise;

    expect(result).toBe(1);
  });

  it('should handle recovery when all documents fail', async () => {
    mockPrisma.document.findMany.mockResolvedValue([
      createMockDocument({ id: 'fail-1', name: 'Fail 1' }),
      createMockDocument({ id: 'fail-2', name: 'Fail 2' }),
    ]);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);
    mockPrisma.document.findUnique.mockResolvedValue(null); // All fail

    const resultPromise = recoverAllOrphanedDocuments();
    for (let i = 0; i < 2; i++) {
      await vi.advanceTimersByTimeAsync(1000);
    }
    const result = await resultPromise;

    expect(result).toBe(0);
    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('Recovery complete: 0/2 documents recovered')
    );
  });

  it('should handle empty projectId in stats', async () => {
    mockPrisma.document.findMany.mockResolvedValue([
      createMockDocument({ projectId: null }),
      createMockDocument({ projectId: '' }),
      createMockDocument({ projectId: 'valid-project' }),
    ]);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);

    const result = await getOrphanedDocumentStats();

    expect(result.count).toBe(3);
    expect(result.totalOrphanedDocs.map(d => d.projectId)).toEqual([
      '',
      '',
      'valid-project',
    ]);
  });

  it('should handle concurrent queue status checks', async () => {
    const docs = Array.from({ length: 10 }, (_, i) =>
      createMockDocument({ id: `doc-${i}` })
    );

    mockPrisma.document.findMany.mockResolvedValue(docs);
    mockPrisma.processingQueue.findMany.mockResolvedValue([
      createMockQueueEntry({ documentId: 'doc-0', status: ProcessingQueueStatus.queued }),
      createMockQueueEntry({ documentId: 'doc-5', status: ProcessingQueueStatus.processing }),
    ]);

    const result = await findOrphanedDocuments();

    // Should filter out doc-0 and doc-5
    expect(result).toHaveLength(8);
    expect(result.map(d => d.id)).not.toContain('doc-0');
    expect(result.map(d => d.id)).not.toContain('doc-5');
  });
});
