import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// ============================================
// Mocks Setup - Must use vi.hoisted for mock objects
// ============================================

// Mock logger
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

// Mock prisma with vi.hoisted to ensure it's available before mock calls
const mockPrisma = vi.hoisted(() => ({
  document: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Import functions after mocks
import {
  calculateFileHash,
  findDuplicates,
  removeDuplicates,
  isDuplicate,
} from '@/lib/duplicate-detector';

// ============================================
// Test Helpers
// ============================================

function createMockDocument(overrides = {}) {
  return {
    id: `doc-${Math.random().toString(36).substr(2, 9)}`,
    fileName: 'test.pdf',
    fileSize: 1024,
    oneDriveHash: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    projectId: 'project-1',
    deletedAt: null,
    DocumentChunk: [],
    ...overrides,
  };
}

// ============================================
// calculateFileHash Tests (5 tests)
// ============================================

describe('Duplicate Detector - calculateFileHash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate SHA-256 hash of buffer', () => {
    const buffer = Buffer.from('test content');
    const expectedHash = crypto.createHash('sha256').update(buffer).digest('hex');

    const hash = calculateFileHash(buffer);

    expect(hash).toBe(expectedHash);
    expect(hash).toHaveLength(64); // SHA-256 produces 64 hex characters
  });

  it('should produce different hashes for different content', () => {
    const buffer1 = Buffer.from('content A');
    const buffer2 = Buffer.from('content B');

    const hash1 = calculateFileHash(buffer1);
    const hash2 = calculateFileHash(buffer2);

    expect(hash1).not.toBe(hash2);
  });

  it('should produce identical hashes for identical content', () => {
    const content = 'identical content';
    const buffer1 = Buffer.from(content);
    const buffer2 = Buffer.from(content);

    const hash1 = calculateFileHash(buffer1);
    const hash2 = calculateFileHash(buffer2);

    expect(hash1).toBe(hash2);
  });

  it('should handle empty buffers', () => {
    const emptyBuffer = Buffer.from('');
    const hash = calculateFileHash(emptyBuffer);

    expect(hash).toBe(crypto.createHash('sha256').update(emptyBuffer).digest('hex'));
    expect(hash).toHaveLength(64);
  });

  it('should handle large buffers', () => {
    // Create a 10MB buffer
    const largeBuffer = Buffer.alloc(10 * 1024 * 1024);
    largeBuffer.fill('a');

    const hash = calculateFileHash(largeBuffer);

    expect(hash).toBeDefined();
    expect(hash).toHaveLength(64);
  });
});

// ============================================
// findDuplicates Tests (15 tests)
// ============================================

describe('Duplicate Detector - findDuplicates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Hash-based duplicate detection', () => {
    it('should find duplicates by file hash', async () => {
      const sharedHash = 'abc123hash';
      const docs = [
        createMockDocument({ id: 'doc-1', oneDriveHash: sharedHash, createdAt: new Date('2024-01-01') }),
        createMockDocument({ id: 'doc-2', oneDriveHash: sharedHash, createdAt: new Date('2024-01-02') }),
        createMockDocument({ id: 'doc-3', oneDriveHash: sharedHash, createdAt: new Date('2024-01-03') }),
      ];

      mockPrisma.document.findMany.mockResolvedValue(docs);

      const duplicates = await findDuplicates('project-1');

      // First document (oldest) should be kept, others are duplicates
      expect(duplicates).toEqual(['doc-2', 'doc-3']);
      expect(duplicates).toHaveLength(2);
    });

    it('should find duplicates matching provided file hash', async () => {
      const targetHash = 'target-hash-123';
      const docs = [
        createMockDocument({ id: 'doc-1', oneDriveHash: targetHash, createdAt: new Date('2024-01-01') }),
        createMockDocument({ id: 'doc-2', oneDriveHash: 'different-hash', createdAt: new Date('2024-01-02') }),
        createMockDocument({ id: 'doc-3', oneDriveHash: targetHash, createdAt: new Date('2024-01-03') }),
      ];

      mockPrisma.document.findMany.mockResolvedValue(docs);

      const duplicates = await findDuplicates('project-1', targetHash);

      // Second occurrence of targetHash should be marked as duplicate
      expect(duplicates).toEqual(['doc-3']);
    });

    it('should keep oldest document by createdAt when duplicates found', async () => {
      const sharedHash = 'shared-hash';
      // Documents ordered by createdAt asc (as the query specifies)
      const docs = [
        createMockDocument({ id: 'doc-oldest', oneDriveHash: sharedHash, createdAt: new Date('2024-01-01') }),
        createMockDocument({ id: 'doc-middle', oneDriveHash: sharedHash, createdAt: new Date('2024-01-03') }),
        createMockDocument({ id: 'doc-new', oneDriveHash: sharedHash, createdAt: new Date('2024-01-05') }),
      ];

      mockPrisma.document.findMany.mockResolvedValue(docs);

      const duplicates = await findDuplicates('project-1');

      // Oldest (doc-oldest) is kept, others are duplicates
      expect(duplicates).toContain('doc-middle');
      expect(duplicates).toContain('doc-new');
      expect(duplicates).not.toContain('doc-oldest');
    });

    it('should handle multiple different hashes without false positives', async () => {
      const docs = [
        createMockDocument({ id: 'doc-1', oneDriveHash: 'hash-a', createdAt: new Date('2024-01-01') }),
        createMockDocument({ id: 'doc-2', oneDriveHash: 'hash-b', createdAt: new Date('2024-01-02') }),
        createMockDocument({ id: 'doc-3', oneDriveHash: 'hash-c', createdAt: new Date('2024-01-03') }),
      ];

      mockPrisma.document.findMany.mockResolvedValue(docs);

      const duplicates = await findDuplicates('project-1');

      expect(duplicates).toEqual([]);
    });
  });

  describe('Filename + size based duplicate detection', () => {
    it('should find duplicates by fileName and fileSize when no hash available', async () => {
      const docs = [
        createMockDocument({ id: 'doc-1', fileName: 'plan.pdf', fileSize: 2048, oneDriveHash: null, createdAt: new Date('2024-01-01') }),
        createMockDocument({ id: 'doc-2', fileName: 'plan.pdf', fileSize: 2048, oneDriveHash: null, createdAt: new Date('2024-01-02') }),
      ];

      mockPrisma.document.findMany.mockResolvedValue(docs);

      const duplicates = await findDuplicates('project-1');

      expect(duplicates).toEqual(['doc-2']);
    });

    it('should not mark as duplicate if fileName matches but fileSize differs', async () => {
      const docs = [
        createMockDocument({ id: 'doc-1', fileName: 'plan.pdf', fileSize: 2048, oneDriveHash: null }),
        createMockDocument({ id: 'doc-2', fileName: 'plan.pdf', fileSize: 4096, oneDriveHash: null }),
      ];

      mockPrisma.document.findMany.mockResolvedValue(docs);

      const duplicates = await findDuplicates('project-1');

      expect(duplicates).toEqual([]);
    });

    it('should not mark as duplicate if fileSize matches but fileName differs', async () => {
      const docs = [
        createMockDocument({ id: 'doc-1', fileName: 'plan-a.pdf', fileSize: 2048, oneDriveHash: null }),
        createMockDocument({ id: 'doc-2', fileName: 'plan-b.pdf', fileSize: 2048, oneDriveHash: null }),
      ];

      mockPrisma.document.findMany.mockResolvedValue(docs);

      const duplicates = await findDuplicates('project-1');

      expect(duplicates).toEqual([]);
    });

    it('should find duplicates matching provided fileName and fileSize', async () => {
      const docs = [
        createMockDocument({ id: 'doc-1', fileName: 'spec.pdf', fileSize: 1024, oneDriveHash: null, createdAt: new Date('2024-01-01') }),
        createMockDocument({ id: 'doc-2', fileName: 'plan.pdf', fileSize: 2048, oneDriveHash: null, createdAt: new Date('2024-01-02') }),
        createMockDocument({ id: 'doc-3', fileName: 'spec.pdf', fileSize: 1024, oneDriveHash: null, createdAt: new Date('2024-01-03') }),
      ];

      mockPrisma.document.findMany.mockResolvedValue(docs);

      const duplicates = await findDuplicates('project-1', undefined, 'spec.pdf', 1024);

      expect(duplicates).toEqual(['doc-3']);
    });

    it('should handle null fileSize as 0 for signature matching', async () => {
      const docs = [
        createMockDocument({ id: 'doc-1', fileName: 'test.pdf', fileSize: null, oneDriveHash: null, createdAt: new Date('2024-01-01') }),
        createMockDocument({ id: 'doc-2', fileName: 'test.pdf', fileSize: null, oneDriveHash: null, createdAt: new Date('2024-01-02') }),
      ];

      mockPrisma.document.findMany.mockResolvedValue(docs);

      const duplicates = await findDuplicates('project-1');

      // Both have null fileSize, which becomes 0 in signature, so doc-2 is duplicate
      expect(duplicates).toEqual(['doc-2']);
    });
  });

  describe('Edge cases and data integrity', () => {
    it('should exclude soft-deleted documents from duplicate detection', async () => {
      const docs = [
        createMockDocument({ id: 'doc-1', oneDriveHash: 'hash-1', deletedAt: null }),
        createMockDocument({ id: 'doc-2', oneDriveHash: 'hash-1', deletedAt: new Date('2024-01-15') }),
      ];

      // Query filters out deletedAt documents, so only return non-deleted
      mockPrisma.document.findMany.mockResolvedValue([docs[0]]);

      const duplicates = await findDuplicates('project-1');

      expect(duplicates).toEqual([]);
    });

    it('should handle empty project (no documents)', async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);

      const duplicates = await findDuplicates('project-1');

      expect(duplicates).toEqual([]);
    });

    it('should handle project with single document', async () => {
      const docs = [createMockDocument({ id: 'doc-1', oneDriveHash: 'hash-1' })];

      mockPrisma.document.findMany.mockResolvedValue(docs);

      const duplicates = await findDuplicates('project-1');

      expect(duplicates).toEqual([]);
    });

    it('should prioritize hash-based detection over fileName+size', async () => {
      // Documents with hash should use hash detection even if fileName+size match
      const docs = [
        createMockDocument({ id: 'doc-1', fileName: 'plan.pdf', fileSize: 2048, oneDriveHash: 'hash-a', createdAt: new Date('2024-01-01') }),
        createMockDocument({ id: 'doc-2', fileName: 'plan.pdf', fileSize: 2048, oneDriveHash: 'hash-b', createdAt: new Date('2024-01-02') }),
      ];

      mockPrisma.document.findMany.mockResolvedValue(docs);

      const duplicates = await findDuplicates('project-1');

      // Different hashes, so not duplicates even though fileName+size match
      expect(duplicates).toEqual([]);
    });

    it('should handle mixed documents with and without hashes', async () => {
      const docs = [
        createMockDocument({ id: 'doc-1', fileName: 'a.pdf', fileSize: 1024, oneDriveHash: 'hash-1', createdAt: new Date('2024-01-01') }),
        createMockDocument({ id: 'doc-2', fileName: 'b.pdf', fileSize: 2048, oneDriveHash: null, createdAt: new Date('2024-01-02') }),
        createMockDocument({ id: 'doc-3', fileName: 'b.pdf', fileSize: 2048, oneDriveHash: null, createdAt: new Date('2024-01-03') }),
        createMockDocument({ id: 'doc-4', fileName: 'c.pdf', fileSize: 3072, oneDriveHash: 'hash-1', createdAt: new Date('2024-01-04') }),
      ];

      mockPrisma.document.findMany.mockResolvedValue(docs);

      const duplicates = await findDuplicates('project-1');

      // doc-3 is duplicate of doc-2 (same fileName+size, no hash)
      // doc-4 is duplicate of doc-1 (same hash)
      expect(duplicates).toContain('doc-3');
      expect(duplicates).toContain('doc-4');
      expect(duplicates).toHaveLength(2);
    });
  });
});

// ============================================
// removeDuplicates Tests (12 tests)
// ============================================

describe('Duplicate Detector - removeDuplicates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Successful duplicate removal', () => {
    it('should soft delete hash-based duplicates', async () => {
      const sharedHash = 'duplicate-hash';
      const docs = [
        createMockDocument({ id: 'doc-1', oneDriveHash: sharedHash, createdAt: new Date('2024-01-01') }),
        createMockDocument({ id: 'doc-2', oneDriveHash: sharedHash, createdAt: new Date('2024-01-02') }),
        createMockDocument({ id: 'doc-3', oneDriveHash: sharedHash, createdAt: new Date('2024-01-03') }),
      ];

      mockPrisma.document.findMany.mockResolvedValue(docs);
      mockPrisma.document.updateMany.mockResolvedValue({ count: 2 });

      const result = await removeDuplicates('project-1');

      expect(result.removed).toBe(2);
      expect(result.kept).toBe(1);
      expect(result.errors).toEqual([]);

      // Verify soft delete was called with correct IDs
      expect(mockPrisma.document.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['doc-2', 'doc-3'] } },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should soft delete fileName+size based duplicates', async () => {
      const docs = [
        createMockDocument({ id: 'doc-1', fileName: 'plan.pdf', fileSize: 2048, oneDriveHash: null, createdAt: new Date('2024-01-01') }),
        createMockDocument({ id: 'doc-2', fileName: 'plan.pdf', fileSize: 2048, oneDriveHash: null, createdAt: new Date('2024-01-02') }),
      ];

      mockPrisma.document.findMany.mockResolvedValue(docs);
      mockPrisma.document.updateMany.mockResolvedValue({ count: 1 });

      const result = await removeDuplicates('project-1');

      expect(result.removed).toBe(1);
      expect(result.kept).toBe(1);
      expect(result.errors).toEqual([]);
    });

    it('should keep oldest document and remove newer duplicates', async () => {
      // Documents ordered by createdAt asc (as the query specifies)
      const docs = [
        createMockDocument({ id: 'doc-oldest', fileName: 'test.pdf', fileSize: 1024, oneDriveHash: null, createdAt: new Date('2024-01-01') }),
        createMockDocument({ id: 'doc-middle', fileName: 'test.pdf', fileSize: 1024, oneDriveHash: null, createdAt: new Date('2024-01-03') }),
        createMockDocument({ id: 'doc-newest', fileName: 'test.pdf', fileSize: 1024, oneDriveHash: null, createdAt: new Date('2024-01-05') }),
      ];

      mockPrisma.document.findMany.mockResolvedValue(docs);
      mockPrisma.document.updateMany.mockResolvedValue({ count: 2 });

      const result = await removeDuplicates('project-1');

      expect(result.removed).toBe(2);
      expect(result.kept).toBe(1);

      // Verify correct duplicates were removed (not the oldest)
      const updateCall = mockPrisma.document.updateMany.mock.calls[0][0];
      expect(updateCall.where.id.in).toContain('doc-middle');
      expect(updateCall.where.id.in).toContain('doc-newest');
      expect(updateCall.where.id.in).not.toContain('doc-oldest');
    });

    it('should return zero counts when no duplicates found', async () => {
      const docs = [
        createMockDocument({ id: 'doc-1', oneDriveHash: 'hash-a' }),
        createMockDocument({ id: 'doc-2', oneDriveHash: 'hash-b' }),
        createMockDocument({ id: 'doc-3', oneDriveHash: 'hash-c' }),
      ];

      mockPrisma.document.findMany.mockResolvedValue(docs);

      const result = await removeDuplicates('project-1');

      expect(result.removed).toBe(0);
      expect(result.kept).toBe(3);
      expect(result.errors).toEqual([]);
      expect(mockPrisma.document.updateMany).not.toHaveBeenCalled();
    });

    it('should handle empty project gracefully', async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);

      const result = await removeDuplicates('project-1');

      expect(result.removed).toBe(0);
      expect(result.kept).toBe(0);
      expect(result.errors).toEqual([]);
      expect(mockPrisma.document.updateMany).not.toHaveBeenCalled();
    });

    it('should handle projects with only unique documents', async () => {
      const docs = [
        createMockDocument({ id: 'doc-1', fileName: 'a.pdf', fileSize: 1024, oneDriveHash: null }),
        createMockDocument({ id: 'doc-2', fileName: 'b.pdf', fileSize: 2048, oneDriveHash: null }),
      ];

      mockPrisma.document.findMany.mockResolvedValue(docs);

      const result = await removeDuplicates('project-1');

      expect(result.removed).toBe(0);
      expect(result.kept).toBe(2);
      expect(mockPrisma.document.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should catch and report database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockPrisma.document.findMany.mockRejectedValue(dbError);

      const result = await removeDuplicates('project-1');

      expect(result.removed).toBe(0);
      expect(result.kept).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Database connection failed');
    });

    it('should handle updateMany failure gracefully', async () => {
      const docs = [
        createMockDocument({ id: 'doc-1', oneDriveHash: 'hash-1', createdAt: new Date('2024-01-01') }),
        createMockDocument({ id: 'doc-2', oneDriveHash: 'hash-1', createdAt: new Date('2024-01-02') }),
      ];

      mockPrisma.document.findMany.mockResolvedValue(docs);
      mockPrisma.document.updateMany.mockRejectedValue(new Error('Update failed'));

      const result = await removeDuplicates('project-1');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Update failed');
    });

    it('should handle non-Error exceptions', async () => {
      mockPrisma.document.findMany.mockRejectedValue('String error');

      const result = await removeDuplicates('project-1');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Unknown error');
    });
  });

  describe('Complex scenarios', () => {
    it('should handle multiple groups of duplicates', async () => {
      const docs = [
        // Group 1: hash-a duplicates
        createMockDocument({ id: 'doc-1', oneDriveHash: 'hash-a', createdAt: new Date('2024-01-01') }),
        createMockDocument({ id: 'doc-2', oneDriveHash: 'hash-a', createdAt: new Date('2024-01-02') }),
        // Group 2: hash-b duplicates
        createMockDocument({ id: 'doc-3', oneDriveHash: 'hash-b', createdAt: new Date('2024-01-03') }),
        createMockDocument({ id: 'doc-4', oneDriveHash: 'hash-b', createdAt: new Date('2024-01-04') }),
        // Unique document
        createMockDocument({ id: 'doc-5', oneDriveHash: 'hash-c', createdAt: new Date('2024-01-05') }),
      ];

      mockPrisma.document.findMany.mockResolvedValue(docs);
      mockPrisma.document.updateMany.mockResolvedValue({ count: 2 });

      const result = await removeDuplicates('project-1');

      expect(result.removed).toBe(2);
      expect(result.kept).toBe(3);

      const updateCall = mockPrisma.document.updateMany.mock.calls[0][0];
      expect(updateCall.where.id.in).toContain('doc-2');
      expect(updateCall.where.id.in).toContain('doc-4');
    });

    it('should handle documents with DocumentChunk relations', async () => {
      const docs = [
        createMockDocument({
          id: 'doc-1',
          oneDriveHash: 'hash-1',
          createdAt: new Date('2024-01-01'),
          DocumentChunk: [{ id: 'chunk-1' }, { id: 'chunk-2' }],
        }),
        createMockDocument({
          id: 'doc-2',
          oneDriveHash: 'hash-1',
          createdAt: new Date('2024-01-02'),
          DocumentChunk: [{ id: 'chunk-3' }],
        }),
      ];

      mockPrisma.document.findMany.mockResolvedValue(docs);
      mockPrisma.document.updateMany.mockResolvedValue({ count: 1 });

      const result = await removeDuplicates('project-1');

      expect(result.removed).toBe(1);
      expect(result.kept).toBe(1);
      // Duplicate (doc-2) should be soft deleted along with its chunks
      expect(mockPrisma.document.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['doc-2'] } },
        })
      );
    });

    it('should log duplicate findings to console', async () => {
      const docs = [
        createMockDocument({ id: 'doc-1', fileName: 'plan.pdf', oneDriveHash: 'hash-1', createdAt: new Date('2024-01-01') }),
        createMockDocument({ id: 'doc-2', fileName: 'plan.pdf', oneDriveHash: 'hash-1', createdAt: new Date('2024-01-02') }),
      ];

      mockPrisma.document.findMany.mockResolvedValue(docs);
      mockPrisma.document.updateMany.mockResolvedValue({ count: 1 });

      await removeDuplicates('project-1');

      expect(mockLogger.info).toHaveBeenCalled();
      expect(mockLogger.info.mock.calls.length).toBeGreaterThan(0);
    });
  });
});

// ============================================
// isDuplicate Tests (10 tests)
// ============================================

describe('Duplicate Detector - isDuplicate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Hash-based duplicate check', () => {
    it('should return true if document with same hash exists', async () => {
      const existingDoc = createMockDocument({ oneDriveHash: 'existing-hash' });
      mockPrisma.document.findFirst.mockResolvedValueOnce(existingDoc);

      const result = await isDuplicate('project-1', 'test.pdf', 2048, 'existing-hash');

      expect(result).toBe(true);
      expect(mockPrisma.document.findFirst).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          deletedAt: null,
          oneDriveHash: 'existing-hash',
        },
      });
    });

    it('should return false if no document with same hash exists', async () => {
      mockPrisma.document.findFirst.mockResolvedValueOnce(null);

      const result = await isDuplicate('project-1', 'test.pdf', 2048, 'unique-hash');

      expect(result).toBe(false);
    });

    it('should skip fileName+size check if hash matches', async () => {
      const existingDoc = createMockDocument({ oneDriveHash: 'hash-match' });
      mockPrisma.document.findFirst.mockResolvedValueOnce(existingDoc);

      const result = await isDuplicate('project-1', 'test.pdf', 2048, 'hash-match');

      expect(result).toBe(true);
      // Should only be called once (for hash check)
      expect(mockPrisma.document.findFirst).toHaveBeenCalledTimes(1);
    });

    it('should exclude soft-deleted documents from hash check', async () => {
      // Hash check returns null, then fileName+size check also returns null
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await isDuplicate('project-1', 'test.pdf', 2048, 'some-hash');

      // Verify both calls included deletedAt: null check
      expect(mockPrisma.document.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        })
      );
      expect(mockPrisma.document.findFirst).toHaveBeenCalledTimes(2); // Hash check + fileName/size check
    });
  });

  describe('FileName + size based duplicate check', () => {
    it('should return true if document with same fileName and fileSize exists (no hash)', async () => {
      // When no hash provided, only fileName+size check happens
      mockPrisma.document.findFirst.mockResolvedValueOnce(createMockDocument());

      const result = await isDuplicate('project-1', 'existing.pdf', 4096);

      expect(result).toBe(true);
      expect(mockPrisma.document.findFirst).toHaveBeenCalledTimes(1);
      expect(mockPrisma.document.findFirst).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          fileName: 'existing.pdf',
          fileSize: 4096,
          deletedAt: null,
        },
      });
    });

    it('should return false if fileName matches but fileSize differs', async () => {
      // No match in database
      mockPrisma.document.findFirst.mockResolvedValue(null);

      const result = await isDuplicate('project-1', 'test.pdf', 999);

      expect(result).toBe(false);
    });

    it('should return false if fileSize matches but fileName differs', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      const result = await isDuplicate('project-1', 'unique-name.pdf', 2048);

      expect(result).toBe(false);
    });

    it('should return false if no matching fileName+size found', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      const result = await isDuplicate('project-1', 'unique.pdf', 1234);

      expect(result).toBe(false);
    });

    it('should exclude soft-deleted documents from fileName+size check', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await isDuplicate('project-1', 'test.pdf', 2048);

      expect(mockPrisma.document.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        })
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined fileHash parameter', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      const result = await isDuplicate('project-1', 'test.pdf', 2048, undefined);

      expect(result).toBe(false);
      // Should only check fileName+size (no hash check)
      expect(mockPrisma.document.findFirst).toHaveBeenCalledTimes(1);
    });
  });
});
