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

describe('Processing Queue Cleanup Cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete old completed and failed entries', async () => {
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 5 });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.deletedCount).toBe(5);
    expect(body.threshold).toBeDefined();
    expect(mockPrisma.processingQueue.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('should handle errors gracefully', async () => {
    mockPrisma.processingQueue.deleteMany.mockRejectedValue(new Error('DB error'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Cleanup failed');
  });

  it('should use 30-day threshold', async () => {
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 0 });
    const beforeCall = Date.now();

    await GET();

    const callArgs = mockPrisma.processingQueue.deleteMany.mock.calls[0][0];
    const threshold = new Date(callArgs.where.updatedAt.lt);
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const expectedThreshold = beforeCall - thirtyDaysMs;

    // The threshold should be approximately 30 days ago (within 5 seconds tolerance)
    expect(Math.abs(threshold.getTime() - expectedThreshold)).toBeLessThan(5000);
  });

  it('should filter by completed and failed statuses', async () => {
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 0 });

    await GET();

    const callArgs = mockPrisma.processingQueue.deleteMany.mock.calls[0][0];
    expect(callArgs.where.status.in).toContain('completed');
    expect(callArgs.where.status.in).toContain('failed');
  });

  it('should return zero count when no entries match', async () => {
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 0 });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.deletedCount).toBe(0);
  });
});
