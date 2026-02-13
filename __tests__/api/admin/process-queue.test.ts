import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Hoisted mocks (must be before imports)
// ============================================

const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  processingQueue: {
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
  document: {
    findMany: vi.fn(),
  },
}));

vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }));
vi.mock('@/lib/auth-options', () => ({ authOptions: {} }));
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ============================================
// Import route handler (after mocks)
// ============================================

import { GET } from '@/app/api/admin/process-queue/route';

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

// POST handler was removed during Trigger.dev migration
// The route now only provides queue stats via GET
// Processing is handled by:
// 1. Trigger.dev tasks (for new uploads)
// 2. Legacy cron job calling processNextQueuedBatch (to be deprecated)

describe('GET /api/admin/process-queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = new Request('http://localhost/api/admin/process-queue', { method: 'GET' });
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 401 for non-admin session', async () => {
    mockGetServerSession.mockResolvedValue(clientSession);

    const request = new Request('http://localhost/api/admin/process-queue', { method: 'GET' });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('should return queue stats when admin session', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);
    mockPrisma.processingQueue.groupBy.mockResolvedValue([
      { status: 'queued', _count: 5 },
      { status: 'processing', _count: 2 },
      { status: 'completed', _count: 10 },
    ]);

    mockPrisma.processingQueue.findMany.mockResolvedValue([
      {
        id: 'q-1',
        documentId: 'doc-1',
        status: 'queued',
        totalPages: 10,
        pagesProcessed: 5,
        currentBatch: 5,
        totalBatches: 10,
        lastError: null,
        retriesCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    mockPrisma.document.findMany.mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Test Document',
        fileName: 'test.pdf',
        queueStatus: 'queued',
      },
    ]);

    const request = new Request('http://localhost/api/admin/process-queue', { method: 'GET' });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.stats).toBeDefined();
    expect(data.stats).toHaveLength(3);
    expect(data.queue).toBeDefined();
    expect(data.queue).toHaveLength(1);
    expect(data.timestamp).toBeDefined();
  });

  it('should include document details in queue entries', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);
    mockPrisma.processingQueue.groupBy.mockResolvedValue([]);

    mockPrisma.processingQueue.findMany.mockResolvedValue([
      {
        id: 'q-1',
        documentId: 'doc-1',
        status: 'queued',
        totalPages: 25,
        pagesProcessed: 10,
        currentBatch: 10,
        totalBatches: 25,
        lastError: null,
        retriesCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    mockPrisma.document.findMany.mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Floor Plan',
        fileName: 'floor-plan.pdf',
        queueStatus: 'queued',
      },
    ]);

    const request = new Request('http://localhost/api/admin/process-queue', { method: 'GET' });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.queue[0].document).toMatchObject({
      id: 'doc-1',
      name: 'Floor Plan',
      fileName: 'floor-plan.pdf',
    });
  });

  it('should limit queue entries to 20', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);
    mockPrisma.processingQueue.groupBy.mockResolvedValue([]);
    mockPrisma.processingQueue.findMany.mockResolvedValue([]);
    mockPrisma.document.findMany.mockResolvedValue([]);

    const request = new Request('http://localhost/api/admin/process-queue', { method: 'GET' });
    await GET(request);

    expect(mockPrisma.processingQueue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
      })
    );
  });
});
