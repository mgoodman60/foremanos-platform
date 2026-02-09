import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  processingQueue: {
    deleteMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { GET } from '@/app/api/cron/processing-queue-cleanup/route';

function makeRequest(cronSecret?: string) {
  const headers = new Headers();
  if (cronSecret) {
    headers.set('authorization', `Bearer ${cronSecret}`);
  }
  return new Request('http://localhost:3000/api/cron/processing-queue-cleanup', { headers }) as any;
}

describe('Processing Queue Cleanup Cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
  });

  it('should delete old completed and failed entries', async () => {
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 5 });

    const response = await GET(makeRequest('test-cron-secret'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.deletedCount).toBe(5);
    expect(body.threshold).toBeDefined();
    expect(mockPrisma.processingQueue.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('should return 401 without CRON_SECRET', async () => {
    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  it('should return 401 with wrong CRON_SECRET', async () => {
    const response = await GET(makeRequest('wrong-secret'));
    expect(response.status).toBe(401);
  });

  it('should handle errors gracefully', async () => {
    mockPrisma.processingQueue.deleteMany.mockRejectedValue(new Error('DB error'));

    const response = await GET(makeRequest('test-cron-secret'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Cleanup failed');
  });

  it('should use 30-day threshold', async () => {
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 0 });
    const beforeCall = Date.now();

    await GET(makeRequest('test-cron-secret'));

    const callArgs = mockPrisma.processingQueue.deleteMany.mock.calls[0][0];
    const threshold = new Date(callArgs.where.updatedAt.lt);
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const expectedThreshold = beforeCall - thirtyDaysMs;

    expect(Math.abs(threshold.getTime() - expectedThreshold)).toBeLessThan(5000);
  });

  it('should filter by completed and failed statuses', async () => {
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 0 });

    await GET(makeRequest('test-cron-secret'));

    const callArgs = mockPrisma.processingQueue.deleteMany.mock.calls[0][0];
    expect(callArgs.where.status.in).toContain('completed');
    expect(callArgs.where.status.in).toContain('failed');
  });

  it('should return zero count when no entries match', async () => {
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 0 });

    const response = await GET(makeRequest('test-cron-secret'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.deletedCount).toBe(0);
  });
});
