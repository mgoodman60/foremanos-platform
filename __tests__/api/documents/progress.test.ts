import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================
// Hoisted mocks
// ============================================

const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  document: {
    findUnique: vi.fn(),
  },
  processingQueue: {
    findFirst: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('@/auth', () => ({ auth: mockGetServerSession }));
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

// Import route handler after mocks
import { GET } from '@/app/api/documents/[id]/progress/route';

// ============================================
// Test helpers
// ============================================

const adminSession = {
  user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
  expires: new Date(Date.now() + 86400000).toISOString(),
};

const ownerSession = {
  user: { id: 'user-1', email: 'owner@test.com', role: 'client' },
  expires: new Date(Date.now() + 86400000).toISOString(),
};

function createRequest(documentId: string) {
  return new NextRequest(`http://localhost/api/documents/${documentId}/progress`, {
    method: 'GET',
  });
}

// ============================================
// Tests
// ============================================

describe('GET /api/documents/[id]/progress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await GET(createRequest('doc-1'), { params: Promise.resolve({ id: 'doc-1' }) });

    expect(response.status).toBe(401);
  });

  it('should return 404 when document not found', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);
    mockPrisma.document.findUnique.mockResolvedValue(null);

    const response = await GET(createRequest('doc-1'), { params: Promise.resolve({ id: 'doc-1' }) });

    expect(response.status).toBe(404);
  });

  it('should return pagesProcessed: 0 when document has zero pages processed', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      processed: false,
      pagesProcessed: 0,
      queueStatus: 'queued',
      processorType: 'vision-ai',
      Project: { ownerId: 'admin-1' },
    });
    mockPrisma.processingQueue.findFirst.mockResolvedValue({
      status: 'queued',
      totalPages: 25,
      pagesProcessed: 0,
      currentBatch: 0,
      totalBatches: 5,
      createdAt: new Date(),
      lastError: null,
    });
    mockPrisma.processingQueue.count.mockResolvedValue(0);

    const response = await GET(createRequest('doc-1'), { params: Promise.resolve({ id: 'doc-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    // pagesProcessed must be exactly 0, not a truthy fallback
    expect(data.pagesProcessed).toBe(0);
    expect(data.totalPages).toBe(25);
    expect(data.percentComplete).toBe(0);
  });

  it('should include currentBatch and totalBatches in the response', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      processed: false,
      pagesProcessed: 10,
      queueStatus: 'processing',
      processorType: 'vision-ai',
      Project: { ownerId: 'admin-1' },
    });
    mockPrisma.processingQueue.findFirst.mockResolvedValue({
      status: 'processing',
      totalPages: 25,
      pagesProcessed: 10,
      currentBatch: 2,
      totalBatches: 5,
      createdAt: new Date(),
      lastError: null,
    });

    const response = await GET(createRequest('doc-1'), { params: Promise.resolve({ id: 'doc-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.currentBatch).toBe(2);
    expect(data.totalBatches).toBe(5);
    expect(data.pagesProcessed).toBe(10);
  });

  it('should return completed phase when document is processed', async () => {
    mockGetServerSession.mockResolvedValue(ownerSession);
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      processed: true,
      pagesProcessed: 25,
      queueStatus: 'completed',
      processorType: 'vision-ai',
      Project: { ownerId: 'user-1' },
    });
    mockPrisma.processingQueue.findFirst.mockResolvedValue({
      status: 'completed',
      totalPages: 25,
      pagesProcessed: 25,
      currentBatch: 5,
      totalBatches: 5,
      createdAt: new Date(),
      lastError: null,
    });

    const response = await GET(createRequest('doc-1'), { params: Promise.resolve({ id: 'doc-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.currentPhase).toBe('completed');
    expect(data.percentComplete).toBe(100);
  });

  it('should return 403 for non-owner non-admin users', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'other-user', email: 'other@test.com', role: 'client' },
      expires: new Date(Date.now() + 86400000).toISOString(),
    });
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      processed: false,
      pagesProcessed: 0,
      queueStatus: 'queued',
      processorType: 'vision-ai',
      Project: { ownerId: 'user-1' },
    });

    const response = await GET(createRequest('doc-1'), { params: Promise.resolve({ id: 'doc-1' }) });

    expect(response.status).toBe(403);
  });

  it('should return null for currentBatch and totalBatches when no queue entry exists', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      processed: false,
      pagesProcessed: 0,
      queueStatus: null,
      processorType: null,
      Project: { ownerId: 'admin-1' },
    });
    mockPrisma.processingQueue.findFirst.mockResolvedValue(null);

    const response = await GET(createRequest('doc-1'), { params: Promise.resolve({ id: 'doc-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.currentBatch).toBeNull();
    expect(data.totalBatches).toBeNull();
    expect(data.pagesProcessed).toBe(0);
  });

  describe('concurrent processing fields', () => {
    it('should return concurrency, activeBatches, failedBatchRanges, processingMode from metadata', async () => {
      mockGetServerSession.mockResolvedValue(adminSession);
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        processed: false,
        pagesProcessed: 10,
        queueStatus: 'processing',
        processorType: 'vision-ai',
        Project: { ownerId: 'admin-1' },
      });
      mockPrisma.processingQueue.findFirst.mockResolvedValue({
        status: 'processing',
        totalPages: 50,
        pagesProcessed: 10,
        currentBatch: 2,
        totalBatches: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastError: null,
        metadata: {
          concurrency: 3,
          processingMode: 'concurrent',
          failedBatchRanges: [
            { startPage: 6, endPage: 10, error: 'Vision API timeout' },
          ],
        },
      });

      const response = await GET(createRequest('doc-1'), { params: Promise.resolve({ id: 'doc-1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.concurrency).toBe(3);
      expect(data.activeBatches).toBe(3); // min(10 - 2, 3) = 3
      expect(data.processingMode).toBe('concurrent');
      expect(data.failedBatchRanges).toEqual([
        { startPage: 6, endPage: 10, error: 'Vision API timeout' },
      ]);
    });

    it('should return defaults when metadata has no concurrency fields', async () => {
      mockGetServerSession.mockResolvedValue(adminSession);
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        processed: false,
        pagesProcessed: 5,
        queueStatus: 'processing',
        processorType: 'vision-ai',
        Project: { ownerId: 'admin-1' },
      });
      mockPrisma.processingQueue.findFirst.mockResolvedValue({
        status: 'processing',
        totalPages: 25,
        pagesProcessed: 5,
        currentBatch: 1,
        totalBatches: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastError: null,
        metadata: { batchSize: 1 }, // No concurrency fields
      });

      const response = await GET(createRequest('doc-1'), { params: Promise.resolve({ id: 'doc-1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.concurrency).toBe(1); // Default
      expect(data.failedBatchRanges).toEqual([]); // Default empty
      expect(data.processingMode).toBe('sequential'); // concurrency=1
    });

    it('should return activeBatches=0 when not actively processing', async () => {
      mockGetServerSession.mockResolvedValue(adminSession);
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        processed: true,
        pagesProcessed: 25,
        queueStatus: 'completed',
        processorType: 'vision-ai',
        Project: { ownerId: 'admin-1' },
      });
      mockPrisma.processingQueue.findFirst.mockResolvedValue({
        status: 'completed',
        totalPages: 25,
        pagesProcessed: 25,
        currentBatch: 5,
        totalBatches: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastError: null,
        metadata: { concurrency: 3, processingMode: 'concurrent' },
      });

      const response = await GET(createRequest('doc-1'), { params: Promise.resolve({ id: 'doc-1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.activeBatches).toBe(0); // Not actively processing
      expect(data.concurrency).toBe(3);
    });
  });
});
