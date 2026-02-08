import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Hoisted mocks (must be before imports)
// ============================================

const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockProcessNextQueuedBatch = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  processingQueue: {
    groupBy: vi.fn(),
  },
}));

vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }));
vi.mock('@/lib/auth-options', () => ({ authOptions: {} }));
vi.mock('@/lib/document-processing-queue', () => ({
  processNextQueuedBatch: mockProcessNextQueuedBatch,
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
  });

  it('should process batches when admin triggers manually', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);
    mockProcessNextQueuedBatch
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const request = new Request('http://localhost/api/admin/process-queue', { method: 'POST' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.batchesProcessed).toBe(2);
    expect(data.message).toBe('Processed 2 batches');
  });

  it('should process batches when valid cron secret is provided via query param', async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockProcessNextQueuedBatch
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const request = new Request('http://localhost/api/admin/process-queue?secret=test-cron-secret', { method: 'POST' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.batchesProcessed).toBe(1);
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

  it('should return batchesProcessed: 0 when queue is empty', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);
    mockProcessNextQueuedBatch.mockResolvedValue(false);

    const request = new Request('http://localhost/api/admin/process-queue', { method: 'POST' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.batchesProcessed).toBe(0);
    expect(data.message).toBe('Processed 0 batches');
  });

  it('should process max 10 batches per call', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);
    mockProcessNextQueuedBatch.mockResolvedValue(true);

    const request = new Request('http://localhost/api/admin/process-queue', { method: 'POST' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.batchesProcessed).toBe(10);
    // 10 iterations + 1 extra call that returns true but loop stops at maxIterations
    // Actually: the loop runs 10 times, each time processNextQueuedBatch returns true,
    // so totalProcessed = 10
    expect(mockProcessNextQueuedBatch).toHaveBeenCalledTimes(10);
  });

  it('should return 500 when processing throws error', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);
    mockProcessNextQueuedBatch.mockRejectedValue(new Error('Database connection failed'));

    const request = new Request('http://localhost/api/admin/process-queue', { method: 'POST' });
    const response = await POST(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Failed to process queue');
    expect(data.details).toBe('Database connection failed');
  });
});

describe('GET /api/admin/process-queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
  });

  describe('Cron auth', () => {
    it('should trigger processing when Authorization header matches cron secret', async () => {
      mockProcessNextQueuedBatch
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const request = new Request('http://localhost/api/admin/process-queue', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.batchesProcessed).toBe(2);
      expect(data.message).toBe('Cron processed 2 batches');
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
    it('should process batches and return count when queued items exist', async () => {
      mockProcessNextQueuedBatch
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const request = new Request('http://localhost/api/admin/process-queue', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.batchesProcessed).toBe(3);
      expect(data.message).toBe('Cron processed 3 batches');
    });

    it('should return batchesProcessed: 0 when queue is empty', async () => {
      mockProcessNextQueuedBatch.mockResolvedValue(false);

      const request = new Request('http://localhost/api/admin/process-queue', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.batchesProcessed).toBe(0);
      expect(data.message).toBe('Cron processed 0 batches');
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
