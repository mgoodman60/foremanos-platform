import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Hoisted mocks (must be before imports)
// ============================================

const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockProcessQueuedDocument = vi.hoisted(() => vi.fn());
const mockRecoverAllOrphanedDocuments = vi.hoisted(() => vi.fn().mockResolvedValue(0));
const mockPrisma = vi.hoisted(() => ({
  processingQueue: {
    groupBy: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  document: {
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
}));

vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }));
vi.mock('@/lib/auth-options', () => ({ authOptions: {} }));
vi.mock('@/lib/document-processing-queue', () => ({
  processQueuedDocument: mockProcessQueuedDocument,
}));
vi.mock('@/lib/orphaned-document-recovery', () => ({
  recoverAllOrphanedDocuments: mockRecoverAllOrphanedDocuments,
}));
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

// ============================================
// Import route handlers (after mocks)
// ============================================

import { POST, GET } from '@/app/api/admin/process-queue/route';

// ============================================
// Test helpers
// ============================================

const adminSession = {
  user: { id: 'admin-1', email: 'admin@example.com', username: 'admin', role: 'admin' },
  expires: new Date(Date.now() + 86400000).toISOString(),
};

const clientSession = {
  user: { id: 'user-1', email: 'user@example.com', username: 'user', role: 'client' },
  expires: new Date(Date.now() + 86400000).toISOString(),
};

// ============================================
// Tests
// ============================================

describe('POST /api/admin/process-queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
    mockPrisma.processingQueue.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.document.updateMany.mockResolvedValue({ count: 0 });
    mockRecoverAllOrphanedDocuments.mockResolvedValue(0);
  });

  it('should process documents when admin triggers manually', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);
    mockPrisma.processingQueue.findMany.mockResolvedValue([
      { documentId: 'doc-1', id: 'q-1', currentBatch: 0, totalBatches: 3 },
      { documentId: 'doc-2', id: 'q-2', currentBatch: 1, totalBatches: 4 },
    ]);
    mockProcessQueuedDocument.mockResolvedValue(undefined);

    const request = new Request('http://localhost/api/admin/process-queue', { method: 'POST' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.documentsProcessed).toBe(2);
    expect(mockProcessQueuedDocument).toHaveBeenCalledTimes(2);
    expect(mockProcessQueuedDocument).toHaveBeenCalledWith('doc-1');
    expect(mockProcessQueuedDocument).toHaveBeenCalledWith('doc-2');
  });

  it('should process documents when valid cron secret is provided via query param', async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockPrisma.processingQueue.findMany.mockResolvedValue([
      { documentId: 'doc-1', id: 'q-1', currentBatch: 0, totalBatches: 5 },
    ]);
    mockProcessQueuedDocument.mockResolvedValue(undefined);

    const request = new Request('http://localhost/api/admin/process-queue?secret=test-cron-secret', { method: 'POST' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.documentsProcessed).toBe(1);
  });

  it('should return 401 when no admin session and no valid cron secret', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = new Request('http://localhost/api/admin/process-queue', { method: 'POST' });
    const response = await POST(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 401 for non-admin user without cron secret', async () => {
    mockGetServerSession.mockResolvedValue(clientSession);

    const request = new Request('http://localhost/api/admin/process-queue', { method: 'POST' });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it('should return documentsProcessed: 0 when queue is empty', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);

    const request = new Request('http://localhost/api/admin/process-queue', { method: 'POST' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.documentsProcessed).toBe(0);
  });

  it('should limit to 5 documents per call', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);
    // findMany has take: 5, so at most 5 entries returned
    const entries = Array.from({ length: 5 }, (_, i) => ({
      documentId: `doc-${i}`, id: `q-${i}`, currentBatch: 0, totalBatches: 3,
    }));
    mockPrisma.processingQueue.findMany.mockResolvedValue(entries);
    mockProcessQueuedDocument.mockResolvedValue(undefined);

    const request = new Request('http://localhost/api/admin/process-queue', { method: 'POST' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.documentsProcessed).toBe(5);
    expect(mockProcessQueuedDocument).toHaveBeenCalledTimes(5);
  });

  it('should continue processing other documents when one fails', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);
    mockPrisma.processingQueue.findMany.mockResolvedValue([
      { documentId: 'doc-1', id: 'q-1', currentBatch: 0, totalBatches: 3 },
      { documentId: 'doc-2', id: 'q-2', currentBatch: 0, totalBatches: 2 },
    ]);
    mockProcessQueuedDocument
      .mockRejectedValueOnce(new Error('Vision API error'))
      .mockResolvedValueOnce(undefined);

    const request = new Request('http://localhost/api/admin/process-queue', { method: 'POST' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.documentsProcessed).toBe(1); // Only second doc succeeded
    expect(mockProcessQueuedDocument).toHaveBeenCalledTimes(2);
  });

  it('should filter out entries where all batches are already done', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);
    mockPrisma.processingQueue.findMany.mockResolvedValue([
      { documentId: 'doc-1', id: 'q-1', currentBatch: 3, totalBatches: 3 }, // already done
      { documentId: 'doc-2', id: 'q-2', currentBatch: 1, totalBatches: 4 }, // has pending batches
    ]);
    mockProcessQueuedDocument.mockResolvedValue(undefined);

    const request = new Request('http://localhost/api/admin/process-queue', { method: 'POST' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.documentsProcessed).toBe(1);
    expect(mockProcessQueuedDocument).toHaveBeenCalledWith('doc-2');
  });

  it('should reset stale processing documents using 3-minute threshold', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);

    const request = new Request('http://localhost/api/admin/process-queue', { method: 'POST' });
    await POST(request);

    // Verify stale reset was called with correct threshold
    expect(mockPrisma.document.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          queueStatus: 'processing',
          processed: false,
          updatedAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      })
    );
  });
});

describe('GET /api/admin/process-queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
    mockPrisma.processingQueue.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.document.updateMany.mockResolvedValue({ count: 0 });
    mockRecoverAllOrphanedDocuments.mockResolvedValue(0);
  });

  describe('Cron auth', () => {
    it('should trigger processing when Authorization header matches cron secret', async () => {
      mockPrisma.processingQueue.findMany.mockResolvedValue([
        { documentId: 'doc-1', id: 'q-1', currentBatch: 0, totalBatches: 3 },
        { documentId: 'doc-2', id: 'q-2', currentBatch: 1, totalBatches: 5 },
      ]);
      mockProcessQueuedDocument.mockResolvedValue(undefined);

      const request = new Request('http://localhost/api/admin/process-queue', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.documentsProcessed).toBe(2);
      expect(data.message).toContain('Cron processed 2 document(s)');
    });

    it('should return 401 when no session and missing Authorization header', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = new Request('http://localhost/api/admin/process-queue', { method: 'GET' });
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when Authorization header has invalid secret', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = new Request('http://localhost/api/admin/process-queue', {
        method: 'GET',
        headers: { Authorization: 'Bearer wrong-secret' },
      });
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe('Cron processing', () => {
    it('should process documents and return count when queued items exist', async () => {
      mockPrisma.processingQueue.findMany.mockResolvedValue([
        { documentId: 'doc-1', id: 'q-1', currentBatch: 0, totalBatches: 3 },
        { documentId: 'doc-2', id: 'q-2', currentBatch: 0, totalBatches: 4 },
        { documentId: 'doc-3', id: 'q-3', currentBatch: 2, totalBatches: 5 },
      ]);
      mockProcessQueuedDocument.mockResolvedValue(undefined);

      const request = new Request('http://localhost/api/admin/process-queue', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.documentsProcessed).toBe(3);
      expect(data.message).toContain('Cron processed 3 document(s)');
    });

    it('should return documentsProcessed: 0 when queue is empty', async () => {
      mockPrisma.processingQueue.findMany.mockResolvedValue([]);

      const request = new Request('http://localhost/api/admin/process-queue', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.documentsProcessed).toBe(0);
    });
  });

  describe('Admin stats', () => {
    it('should return queue stats when admin session without cron header', async () => {
      mockGetServerSession.mockResolvedValue(adminSession);
      mockPrisma.processingQueue.groupBy.mockResolvedValue([
        { status: 'PENDING', _count: 5 },
        { status: 'PROCESSING', _count: 2 },
        { status: 'COMPLETED', _count: 10 },
      ]);

      const request = new Request('http://localhost/api/admin/process-queue', { method: 'GET' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.stats).toBeDefined();
      expect(data.stats).toHaveLength(3);
      expect(mockPrisma.processingQueue.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        _count: true,
      });
    });

    it('should return 401 for non-admin session without cron header', async () => {
      mockGetServerSession.mockResolvedValue(clientSession);

      const request = new Request('http://localhost/api/admin/process-queue', { method: 'GET' });
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });
});
