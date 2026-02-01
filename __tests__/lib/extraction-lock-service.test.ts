import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock UUID generator
const mockUuid = vi.hoisted(() => vi.fn());
vi.mock('uuid', () => ({ v4: mockUuid }));

// Mock Prisma with vi.hoisted
const mockPrisma = vi.hoisted(() => ({
  extractionLock: {
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

// Import after mocks
import {
  acquireLock,
  acquireLockWithRetry,
  releaseLock,
  releaseLockById,
  isLocked,
  getActiveLocks,
  cleanupExpiredLocks,
  extendLock,
  withLock,
  type LockResult,
  type ExtractionType,
  type ResourceType,
} from '@/lib/extraction-lock-service';

describe('Extraction Lock Service', () => {
  const mockProcessId = 'process-12345678';
  const mockLockId = 'lock-abcdefgh';
  const resourceType: ResourceType = 'document';
  const resourceId = 'doc-123';
  const extractionType: ExtractionType = 'schedule';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    mockUuid.mockReturnValue(mockProcessId);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================
  // acquireLock() - Basic Lock Acquisition
  // ============================================
  describe('acquireLock', () => {
    it('should successfully acquire lock when no existing lock exists', async () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const expiresAt = new Date('2024-01-15T12:05:00Z'); // 5 minutes later

      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.extractionLock.create.mockResolvedValue({
        id: mockLockId,
        resourceType,
        resourceId,
        extractionType,
        processId: mockProcessId,
        acquiredAt: now,
        expiresAt,
      });

      const result = await acquireLock(resourceType, resourceId, extractionType);

      expect(result.acquired).toBe(true);
      expect(result.lockId).toBe(mockLockId);
      expect(result.processId).toBe(mockProcessId);
      expect(result.existingLock).toBeUndefined();

      expect(mockPrisma.extractionLock.create).toHaveBeenCalledWith({
        data: {
          resourceType,
          resourceId,
          extractionType,
          processId: mockProcessId,
          expiresAt,
        },
      });
    });

    it('should clean up expired locks before acquiring', async () => {
      const expiresAt = new Date('2024-01-15T12:05:00Z');

      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.extractionLock.create.mockResolvedValue({
        id: mockLockId,
        resourceType,
        resourceId,
        extractionType,
        processId: mockProcessId,
        acquiredAt: new Date(),
        expiresAt,
      });

      const result = await acquireLock(resourceType, resourceId, extractionType);

      expect(result.acquired).toBe(true);
      expect(mockPrisma.extractionLock.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: new Date('2024-01-15T12:00:00Z') },
        },
      });
    });

    it('should use custom duration when provided', async () => {
      const customDuration = 10 * 60 * 1000; // 10 minutes
      const expiresAt = new Date('2024-01-15T12:10:00Z');

      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.extractionLock.create.mockResolvedValue({
        id: mockLockId,
        resourceType,
        resourceId,
        extractionType,
        processId: mockProcessId,
        acquiredAt: new Date(),
        expiresAt,
      });

      await acquireLock(resourceType, resourceId, extractionType, customDuration);

      expect(mockPrisma.extractionLock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt,
        }),
      });
    });

    it('should return existing lock when lock already exists (P2002 error)', async () => {
      const existingLock = {
        id: 'existing-lock',
        resourceType,
        resourceId,
        extractionType,
        processId: 'other-process',
        acquiredAt: new Date('2024-01-15T11:55:00Z'),
        expiresAt: new Date('2024-01-15T12:05:00Z'), // Still valid
      };

      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.extractionLock.create.mockRejectedValue({
        code: 'P2002', // Unique constraint violation
      });
      mockPrisma.extractionLock.findUnique.mockResolvedValue(existingLock);

      const result = await acquireLock(resourceType, resourceId, extractionType);

      expect(result.acquired).toBe(false);
      expect(result.lockId).toBeUndefined();
      expect(result.processId).toBeUndefined();
      expect(result.existingLock).toEqual({
        processId: 'other-process',
        acquiredAt: existingLock.acquiredAt,
        expiresAt: existingLock.expiresAt,
      });
    });

    it('should attempt to take over expired lock and retry', async () => {
      const expiredLock = {
        id: 'expired-lock',
        resourceType,
        resourceId,
        extractionType,
        processId: 'expired-process',
        acquiredAt: new Date('2024-01-15T11:50:00Z'),
        expiresAt: new Date('2024-01-15T11:55:00Z'), // Expired 5 minutes ago
      };

      const newLock = {
        id: mockLockId,
        resourceType,
        resourceId,
        extractionType,
        processId: mockProcessId,
        acquiredAt: new Date(),
        expiresAt: new Date('2024-01-15T12:05:00Z'),
      };

      // First attempt: P2002 error
      mockPrisma.extractionLock.deleteMany.mockResolvedValueOnce({ count: 0 });
      mockPrisma.extractionLock.create.mockRejectedValueOnce({
        code: 'P2002',
      });
      mockPrisma.extractionLock.findUnique.mockResolvedValueOnce(expiredLock);
      mockPrisma.extractionLock.delete.mockResolvedValueOnce(expiredLock);

      // Second attempt: Success
      mockPrisma.extractionLock.deleteMany.mockResolvedValueOnce({ count: 0 });
      mockPrisma.extractionLock.create.mockResolvedValueOnce(newLock);

      const result = await acquireLock(resourceType, resourceId, extractionType);

      expect(result.acquired).toBe(true);
      expect(result.lockId).toBe(mockLockId);
      expect(mockPrisma.extractionLock.delete).toHaveBeenCalledWith({
        where: { id: 'expired-lock' },
      });
    });

    it('should handle race condition when deleting expired lock', async () => {
      const expiredLock = {
        id: 'expired-lock',
        resourceType,
        resourceId,
        extractionType,
        processId: 'expired-process',
        acquiredAt: new Date('2024-01-15T11:50:00Z'),
        expiresAt: new Date('2024-01-15T11:55:00Z'), // Expired
      };

      // First attempt: Find expired lock, fail to delete it (another process deleted it)
      mockPrisma.extractionLock.deleteMany.mockResolvedValueOnce({ count: 0 });
      mockPrisma.extractionLock.create.mockRejectedValueOnce({ code: 'P2002' });
      mockPrisma.extractionLock.findUnique.mockResolvedValueOnce(expiredLock);
      mockPrisma.extractionLock.delete.mockRejectedValueOnce(new Error('Lock deleted by another process'));

      // Recursive call will fail because lock was already taken
      mockPrisma.extractionLock.deleteMany.mockResolvedValueOnce({ count: 0 });
      mockPrisma.extractionLock.create.mockRejectedValueOnce({ code: 'P2002' });
      mockPrisma.extractionLock.findUnique.mockResolvedValueOnce(expiredLock);

      const result = await acquireLock(resourceType, resourceId, extractionType);

      expect(result.acquired).toBe(false);
      expect(result.existingLock?.processId).toBe('expired-process');
    });

    it('should throw error for non-P2002 errors', async () => {
      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.extractionLock.create.mockRejectedValue(new Error('Database connection failed'));

      await expect(acquireLock(resourceType, resourceId, extractionType)).rejects.toThrow('Database connection failed');
    });

    it('should handle different extraction types', async () => {
      const types: ExtractionType[] = ['schedule', 'budget', 'takeoff', 'mep', 'doors', 'windows', 'room', 'sitework'];

      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 0 });

      for (const type of types) {
        mockPrisma.extractionLock.create.mockResolvedValueOnce({
          id: `lock-${type}`,
          resourceType: 'document',
          resourceId: 'doc-1',
          extractionType: type,
          processId: mockProcessId,
          acquiredAt: new Date(),
          expiresAt: new Date('2024-01-15T12:05:00Z'),
        });

        const result = await acquireLock('document', 'doc-1', type);
        expect(result.acquired).toBe(true);
      }

      expect(mockPrisma.extractionLock.create).toHaveBeenCalledTimes(types.length);
    });

    it('should handle different resource types', async () => {
      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 0 });

      // Document resource
      mockPrisma.extractionLock.create.mockResolvedValueOnce({
        id: 'lock-doc',
        resourceType: 'document',
        resourceId: 'doc-1',
        extractionType,
        processId: mockProcessId,
        acquiredAt: new Date(),
        expiresAt: new Date('2024-01-15T12:05:00Z'),
      });

      const docResult = await acquireLock('document', 'doc-1', extractionType);
      expect(docResult.acquired).toBe(true);

      // Project resource
      mockPrisma.extractionLock.create.mockResolvedValueOnce({
        id: 'lock-proj',
        resourceType: 'project',
        resourceId: 'proj-1',
        extractionType,
        processId: mockProcessId,
        acquiredAt: new Date(),
        expiresAt: new Date('2024-01-15T12:05:00Z'),
      });

      const projResult = await acquireLock('project', 'proj-1', extractionType);
      expect(projResult.acquired).toBe(true);
    });
  });

  // ============================================
  // acquireLockWithRetry() - Retry Logic
  // ============================================
  describe('acquireLockWithRetry', () => {
    it('should acquire lock on first attempt when available', async () => {
      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.extractionLock.create.mockResolvedValue({
        id: mockLockId,
        resourceType,
        resourceId,
        extractionType,
        processId: mockProcessId,
        acquiredAt: new Date(),
        expiresAt: new Date('2024-01-15T12:05:00Z'),
      });

      const result = await acquireLockWithRetry(resourceType, resourceId, extractionType);

      expect(result.acquired).toBe(true);
      expect(result.lockId).toBe(mockLockId);
      expect(mockPrisma.extractionLock.create).toHaveBeenCalledTimes(1);
    });

    it('should use custom lock duration', async () => {
      const customDuration = 15 * 60 * 1000; // 15 minutes
      const expiresAt = new Date('2024-01-15T12:15:00Z');

      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.extractionLock.create.mockResolvedValue({
        id: mockLockId,
        resourceType,
        resourceId,
        extractionType,
        processId: mockProcessId,
        acquiredAt: new Date(),
        expiresAt,
      });

      await acquireLockWithRetry(resourceType, resourceId, extractionType, {
        durationMs: customDuration,
      });

      expect(mockPrisma.extractionLock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt,
        }),
      });
    });
  });

  // ============================================
  // releaseLock() - Lock Release
  // ============================================
  describe('releaseLock', () => {
    it('should release lock by processId only', async () => {
      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 1 });

      const result = await releaseLock(mockProcessId);

      expect(result).toBe(true);
      expect(mockPrisma.extractionLock.deleteMany).toHaveBeenCalledWith({
        where: { processId: mockProcessId },
      });
    });

    it('should release lock with specific resource and extraction type', async () => {
      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 1 });

      const result = await releaseLock(mockProcessId, resourceType, resourceId, extractionType);

      expect(result).toBe(true);
      expect(mockPrisma.extractionLock.deleteMany).toHaveBeenCalledWith({
        where: {
          processId: mockProcessId,
          resourceType,
          resourceId,
          extractionType,
        },
      });
    });

    it('should return false when no locks found to release', async () => {
      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 0 });

      const result = await releaseLock(mockProcessId);

      expect(result).toBe(false);
    });

    it('should release multiple locks for same processId', async () => {
      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 3 });

      const result = await releaseLock(mockProcessId);

      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      mockPrisma.extractionLock.deleteMany.mockRejectedValue(new Error('Database error'));

      const result = await releaseLock(mockProcessId);

      expect(result).toBe(false);
    });
  });

  // ============================================
  // releaseLockById() - Release by ID
  // ============================================
  describe('releaseLockById', () => {
    it('should release lock by ID successfully', async () => {
      mockPrisma.extractionLock.delete.mockResolvedValue({
        id: mockLockId,
        resourceType,
        resourceId,
        extractionType,
        processId: mockProcessId,
        acquiredAt: new Date(),
        expiresAt: new Date(),
      });

      const result = await releaseLockById(mockLockId);

      expect(result).toBe(true);
      expect(mockPrisma.extractionLock.delete).toHaveBeenCalledWith({
        where: { id: mockLockId },
      });
    });

    it('should return false when lock not found', async () => {
      mockPrisma.extractionLock.delete.mockRejectedValue({ code: 'P2025' }); // Record not found

      const result = await releaseLockById(mockLockId);

      expect(result).toBe(false);
    });

    it('should return false on database error', async () => {
      mockPrisma.extractionLock.delete.mockRejectedValue(new Error('Database error'));

      const result = await releaseLockById(mockLockId);

      expect(result).toBe(false);
    });
  });

  // ============================================
  // isLocked() - Lock Status Check
  // ============================================
  describe('isLocked', () => {
    it('should return true when valid lock exists', async () => {
      mockPrisma.extractionLock.findUnique.mockResolvedValue({
        id: mockLockId,
        resourceType,
        resourceId,
        extractionType,
        processId: mockProcessId,
        acquiredAt: new Date('2024-01-15T11:55:00Z'),
        expiresAt: new Date('2024-01-15T12:05:00Z'), // Future expiry
      });

      const result = await isLocked(resourceType, resourceId, extractionType);

      expect(result).toBe(true);
      expect(mockPrisma.extractionLock.findUnique).toHaveBeenCalledWith({
        where: {
          resourceType_resourceId_extractionType: {
            resourceType,
            resourceId,
            extractionType,
          },
        },
      });
    });

    it('should return false when no lock exists', async () => {
      mockPrisma.extractionLock.findUnique.mockResolvedValue(null);

      const result = await isLocked(resourceType, resourceId, extractionType);

      expect(result).toBe(false);
    });

    it('should return false when lock has expired', async () => {
      mockPrisma.extractionLock.findUnique.mockResolvedValue({
        id: mockLockId,
        resourceType,
        resourceId,
        extractionType,
        processId: mockProcessId,
        acquiredAt: new Date('2024-01-15T11:50:00Z'),
        expiresAt: new Date('2024-01-15T11:55:00Z'), // Expired 5 minutes ago
      });

      const result = await isLocked(resourceType, resourceId, extractionType);

      expect(result).toBe(false);
    });

    it('should return true for lock expiring in the future', async () => {
      mockPrisma.extractionLock.findUnique.mockResolvedValue({
        id: mockLockId,
        resourceType,
        resourceId,
        extractionType,
        processId: mockProcessId,
        acquiredAt: new Date('2024-01-15T11:59:00Z'),
        expiresAt: new Date('2024-01-15T12:00:01Z'), // Expires in 1 second
      });

      const result = await isLocked(resourceType, resourceId, extractionType);

      expect(result).toBe(true);
    });
  });

  // ============================================
  // getActiveLocks() - Active Locks Retrieval
  // ============================================
  describe('getActiveLocks', () => {
    it('should return all active locks for a resource', async () => {
      const locks = [
        {
          extractionType: 'schedule',
          processId: 'process-1',
          acquiredAt: new Date('2024-01-15T11:55:00Z'),
          expiresAt: new Date('2024-01-15T12:05:00Z'),
        },
        {
          extractionType: 'budget',
          processId: 'process-2',
          acquiredAt: new Date('2024-01-15T11:58:00Z'),
          expiresAt: new Date('2024-01-15T12:08:00Z'),
        },
      ];

      mockPrisma.extractionLock.findMany.mockResolvedValue(locks);

      const result = await getActiveLocks(resourceType, resourceId);

      expect(result).toEqual(locks);
      expect(mockPrisma.extractionLock.findMany).toHaveBeenCalledWith({
        where: {
          resourceType,
          resourceId,
          expiresAt: { gt: new Date('2024-01-15T12:00:00Z') },
        },
        select: {
          extractionType: true,
          processId: true,
          acquiredAt: true,
          expiresAt: true,
        },
      });
    });

    it('should return empty array when no active locks', async () => {
      mockPrisma.extractionLock.findMany.mockResolvedValue([]);

      const result = await getActiveLocks(resourceType, resourceId);

      expect(result).toEqual([]);
    });

    it('should exclude expired locks', async () => {
      const activeLocks = [
        {
          extractionType: 'schedule',
          processId: 'process-1',
          acquiredAt: new Date('2024-01-15T11:55:00Z'),
          expiresAt: new Date('2024-01-15T12:05:00Z'), // Active
        },
      ];

      mockPrisma.extractionLock.findMany.mockResolvedValue(activeLocks);

      const result = await getActiveLocks(resourceType, resourceId);

      expect(result).toHaveLength(1);
      expect(result[0].processId).toBe('process-1');
    });
  });

  // ============================================
  // cleanupExpiredLocks() - Cleanup
  // ============================================
  describe('cleanupExpiredLocks', () => {
    it('should delete expired locks and return count', async () => {
      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 5 });

      const result = await cleanupExpiredLocks();

      expect(result).toBe(5);
      expect(mockPrisma.extractionLock.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: new Date('2024-01-15T12:00:00Z') },
        },
      });
    });

    it('should return 0 when no expired locks', async () => {
      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 0 });

      const result = await cleanupExpiredLocks();

      expect(result).toBe(0);
    });

    it('should use current time for expiry check', async () => {
      vi.setSystemTime(new Date('2024-01-15T14:30:00Z'));

      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 2 });

      await cleanupExpiredLocks();

      expect(mockPrisma.extractionLock.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: new Date('2024-01-15T14:30:00Z') },
        },
      });
    });
  });

  // ============================================
  // extendLock() - Lock Extension
  // ============================================
  describe('extendLock', () => {
    it('should extend lock expiration time', async () => {
      const existingLock = {
        id: mockLockId,
        resourceType,
        resourceId,
        extractionType,
        processId: mockProcessId,
        acquiredAt: new Date('2024-01-15T11:55:00Z'),
        expiresAt: new Date('2024-01-15T12:00:00Z'), // About to expire
      };

      const newExpiresAt = new Date('2024-01-15T12:05:00Z'); // 5 minutes from now

      mockPrisma.extractionLock.findFirst.mockResolvedValue(existingLock);
      mockPrisma.extractionLock.update.mockResolvedValue({
        ...existingLock,
        expiresAt: newExpiresAt,
      });

      const result = await extendLock(mockProcessId, resourceType, resourceId, extractionType);

      expect(result).toBe(true);
      expect(mockPrisma.extractionLock.findFirst).toHaveBeenCalledWith({
        where: {
          processId: mockProcessId,
          resourceType,
          resourceId,
          extractionType,
        },
      });
      expect(mockPrisma.extractionLock.update).toHaveBeenCalledWith({
        where: { id: mockLockId },
        data: { expiresAt: newExpiresAt },
      });
    });

    it('should use custom additional duration', async () => {
      const existingLock = {
        id: mockLockId,
        resourceType,
        resourceId,
        extractionType,
        processId: mockProcessId,
        acquiredAt: new Date('2024-01-15T11:55:00Z'),
        expiresAt: new Date('2024-01-15T12:00:00Z'),
      };

      const customDuration = 10 * 60 * 1000; // 10 minutes
      const newExpiresAt = new Date('2024-01-15T12:10:00Z');

      mockPrisma.extractionLock.findFirst.mockResolvedValue(existingLock);
      mockPrisma.extractionLock.update.mockResolvedValue({
        ...existingLock,
        expiresAt: newExpiresAt,
      });

      await extendLock(mockProcessId, resourceType, resourceId, extractionType, customDuration);

      expect(mockPrisma.extractionLock.update).toHaveBeenCalledWith({
        where: { id: mockLockId },
        data: { expiresAt: newExpiresAt },
      });
    });

    it('should return false when lock not found', async () => {
      mockPrisma.extractionLock.findFirst.mockResolvedValue(null);

      const result = await extendLock(mockProcessId, resourceType, resourceId, extractionType);

      expect(result).toBe(false);
      expect(mockPrisma.extractionLock.update).not.toHaveBeenCalled();
    });

    it('should return false on update error', async () => {
      const existingLock = {
        id: mockLockId,
        resourceType,
        resourceId,
        extractionType,
        processId: mockProcessId,
        acquiredAt: new Date(),
        expiresAt: new Date(),
      };

      mockPrisma.extractionLock.findFirst.mockResolvedValue(existingLock);
      mockPrisma.extractionLock.update.mockRejectedValue(new Error('Database error'));

      const result = await extendLock(mockProcessId, resourceType, resourceId, extractionType);

      expect(result).toBe(false);
    });
  });

  // ============================================
  // withLock() - Lock Wrapper Function
  // ============================================
  describe('withLock', () => {
    it('should execute function with acquired lock and release after', async () => {
      const mockFn = vi.fn().mockResolvedValue('success result');

      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.extractionLock.create.mockResolvedValue({
        id: mockLockId,
        resourceType,
        resourceId,
        extractionType,
        processId: mockProcessId,
        acquiredAt: new Date(),
        expiresAt: new Date('2024-01-15T12:05:00Z'),
      });
      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 1 });

      const result = await withLock(resourceType, resourceId, extractionType, mockFn);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success result');
      expect(result.skipped).toBeUndefined();
      expect(mockFn).toHaveBeenCalledTimes(1);

      // Verify lock was released
      expect(mockPrisma.extractionLock.deleteMany).toHaveBeenCalledWith({
        where: {
          processId: mockProcessId,
          resourceType,
          resourceId,
          extractionType,
        },
      });
    });

    it('should skip execution when lock not acquired and skipIfLocked is true', async () => {
      const mockFn = vi.fn();
      const existingLock = {
        id: 'other-lock',
        resourceType,
        resourceId,
        extractionType,
        processId: 'other-process',
        acquiredAt: new Date(),
        expiresAt: new Date('2024-01-15T12:05:00Z'),
      };

      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.extractionLock.create.mockRejectedValue({ code: 'P2002' });
      mockPrisma.extractionLock.findUnique.mockResolvedValue(existingLock);

      const result = await withLock(resourceType, resourceId, extractionType, mockFn, {
        skipIfLocked: true,
      });

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(mockFn).not.toHaveBeenCalled();
    });

    it('should return error when lock not acquired and skipIfLocked is false', async () => {
      const mockFn = vi.fn();
      const existingLock = {
        id: 'other-lock',
        resourceType,
        resourceId,
        extractionType,
        processId: 'other-process',
        acquiredAt: new Date(),
        expiresAt: new Date('2024-01-15T12:05:00Z'),
      };

      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.extractionLock.create.mockRejectedValue({ code: 'P2002' });
      mockPrisma.extractionLock.findUnique.mockResolvedValue(existingLock);

      const result = await withLock(resourceType, resourceId, extractionType, mockFn, {
        skipIfLocked: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Could not acquire lock');
      expect(mockFn).not.toHaveBeenCalled();
    });

    describe('with retry behavior', () => {
      beforeEach(() => {
        vi.useRealTimers();
      });

      afterEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
      });

      it('should wait for lock when waitForLock is true', async () => {
        const mockFn = vi.fn().mockResolvedValue('success');
        const existingLock = {
          id: 'other-lock',
          resourceType,
          resourceId,
          extractionType,
          processId: 'other-process',
          acquiredAt: new Date(),
          expiresAt: new Date('2024-01-15T12:05:00Z'),
        };

        // First attempt: Lock exists
        mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 0 });
        mockPrisma.extractionLock.create
          .mockRejectedValueOnce({ code: 'P2002' })
          .mockResolvedValueOnce({
            id: mockLockId,
            resourceType,
            resourceId,
            extractionType,
            processId: mockProcessId,
            acquiredAt: new Date(),
            expiresAt: new Date('2024-01-15T12:05:00Z'),
          });
        mockPrisma.extractionLock.findUnique.mockResolvedValue(existingLock);
        mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 1 });

        const result = await withLock(resourceType, resourceId, extractionType, mockFn, {
          waitForLock: true,
          maxWaitAttempts: 3,
        });

        expect(result.success).toBe(true);
        expect(result.result).toBe('success');
        expect(mockFn).toHaveBeenCalledTimes(1);
      });

      it('should respect maxWaitAttempts option when waiting for lock', async () => {
        const mockFn = vi.fn();
        const existingLock = {
          id: 'other-lock',
          resourceType,
          resourceId,
          extractionType,
          processId: 'other-process',
          acquiredAt: new Date(),
          expiresAt: new Date('2024-01-15T12:10:00Z'),
        };

        mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 0 });
        mockPrisma.extractionLock.create.mockRejectedValue({ code: 'P2002' });
        mockPrisma.extractionLock.findUnique.mockResolvedValue(existingLock);

        const result = await withLock(resourceType, resourceId, extractionType, mockFn, {
          waitForLock: true,
          maxWaitAttempts: 2,
        });

        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
        expect(mockPrisma.extractionLock.create).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle function throwing error and still release lock', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Function failed'));

      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.extractionLock.create.mockResolvedValue({
        id: mockLockId,
        resourceType,
        resourceId,
        extractionType,
        processId: mockProcessId,
        acquiredAt: new Date(),
        expiresAt: new Date('2024-01-15T12:05:00Z'),
      });
      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 1 });

      const result = await withLock(resourceType, resourceId, extractionType, mockFn);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Function failed');

      // Verify lock was still released
      expect(mockPrisma.extractionLock.deleteMany).toHaveBeenCalledWith({
        where: {
          processId: mockProcessId,
          resourceType,
          resourceId,
          extractionType,
        },
      });
    });

    it('should use custom lock duration', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      const customDuration = 10 * 60 * 1000;
      const expiresAt = new Date('2024-01-15T12:10:00Z');

      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.extractionLock.create.mockResolvedValue({
        id: mockLockId,
        resourceType,
        resourceId,
        extractionType,
        processId: mockProcessId,
        acquiredAt: new Date(),
        expiresAt,
      });
      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 1 });

      await withLock(resourceType, resourceId, extractionType, mockFn, {
        lockDurationMs: customDuration,
      });

      expect(mockPrisma.extractionLock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt,
        }),
      });
    });

    it('should handle async function results correctly', async () => {
      const asyncResult = { data: 'test', count: 42 };
      const mockFn = vi.fn().mockResolvedValue(asyncResult);

      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.extractionLock.create.mockResolvedValue({
        id: mockLockId,
        resourceType,
        resourceId,
        extractionType,
        processId: mockProcessId,
        acquiredAt: new Date(),
        expiresAt: new Date('2024-01-15T12:05:00Z'),
      });
      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 1 });

      const result = await withLock(resourceType, resourceId, extractionType, mockFn);

      expect(result.success).toBe(true);
      expect(result.result).toEqual(asyncResult);
    });

  });

  // ============================================
  // Concurrency Scenarios
  // ============================================
  describe('Concurrency scenarios', () => {
    it('should handle multiple processes trying to acquire same lock', async () => {
      const existingLock = {
        id: 'first-lock',
        resourceType,
        resourceId,
        extractionType,
        processId: 'first-process',
        acquiredAt: new Date(),
        expiresAt: new Date('2024-01-15T12:05:00Z'),
      };

      // Process 1 acquires lock
      mockPrisma.extractionLock.deleteMany.mockResolvedValueOnce({ count: 0 });
      mockPrisma.extractionLock.create.mockResolvedValueOnce(existingLock);

      const result1 = await acquireLock(resourceType, resourceId, extractionType);

      // Process 2 tries to acquire same lock
      mockPrisma.extractionLock.deleteMany.mockResolvedValueOnce({ count: 0 });
      mockPrisma.extractionLock.create.mockRejectedValueOnce({ code: 'P2002' });
      mockPrisma.extractionLock.findUnique.mockResolvedValueOnce(existingLock);

      const result2 = await acquireLock(resourceType, resourceId, extractionType);

      expect(result1.acquired).toBe(true);
      expect(result2.acquired).toBe(false);
      expect(result2.existingLock?.processId).toBe('first-process');
    });

    it('should handle lock acquisition after previous lock released', async () => {
      // First process acquires lock
      mockUuid.mockReturnValueOnce('process-1');
      mockPrisma.extractionLock.deleteMany.mockResolvedValueOnce({ count: 0 });
      mockPrisma.extractionLock.create.mockResolvedValueOnce({
        id: 'lock-1',
        resourceType,
        resourceId,
        extractionType,
        processId: 'process-1',
        acquiredAt: new Date(),
        expiresAt: new Date('2024-01-15T12:05:00Z'),
      });
      const result1 = await acquireLock(resourceType, resourceId, extractionType);

      // First process releases lock
      mockPrisma.extractionLock.deleteMany.mockResolvedValueOnce({ count: 1 });
      await releaseLock('process-1', resourceType, resourceId, extractionType);

      // Second process acquires lock
      mockUuid.mockReturnValueOnce('process-2');
      mockPrisma.extractionLock.deleteMany.mockResolvedValueOnce({ count: 0 });
      mockPrisma.extractionLock.create.mockResolvedValueOnce({
        id: 'lock-2',
        resourceType,
        resourceId,
        extractionType,
        processId: 'process-2',
        acquiredAt: new Date(),
        expiresAt: new Date('2024-01-15T12:05:00Z'),
      });
      const result2 = await acquireLock(resourceType, resourceId, extractionType);

      expect(result1.acquired).toBe(true);
      expect(result1.processId).toBe('process-1');
      expect(result2.acquired).toBe(true);
      expect(result2.processId).toBe('process-2');
    });

    it('should handle different extraction types on same resource concurrently', async () => {
      const scheduleLock = {
        id: 'lock-schedule',
        resourceType,
        resourceId,
        extractionType: 'schedule' as ExtractionType,
        processId: 'process-1',
        acquiredAt: new Date(),
        expiresAt: new Date('2024-01-15T12:05:00Z'),
      };

      const budgetLock = {
        id: 'lock-budget',
        resourceType,
        resourceId,
        extractionType: 'budget' as ExtractionType,
        processId: 'process-2',
        acquiredAt: new Date(),
        expiresAt: new Date('2024-01-15T12:05:00Z'),
      };

      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.extractionLock.create
        .mockResolvedValueOnce(scheduleLock)
        .mockResolvedValueOnce(budgetLock);

      mockUuid.mockReturnValueOnce('process-1').mockReturnValueOnce('process-2');

      const result1 = await acquireLock(resourceType, resourceId, 'schedule');
      const result2 = await acquireLock(resourceType, resourceId, 'budget');

      expect(result1.acquired).toBe(true);
      expect(result2.acquired).toBe(true);
      expect(result1.lockId).toBe('lock-schedule');
      expect(result2.lockId).toBe('lock-budget');
    });
  });

  // ============================================
  // Edge Cases
  // ============================================
  describe('Edge cases', () => {
    it('should handle very short lock durations', async () => {
      const shortDuration = 100; // 100ms
      const expiresAt = new Date(Date.now() + shortDuration);

      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.extractionLock.create.mockResolvedValue({
        id: mockLockId,
        resourceType,
        resourceId,
        extractionType,
        processId: mockProcessId,
        acquiredAt: new Date(),
        expiresAt,
      });

      const result = await acquireLock(resourceType, resourceId, extractionType, shortDuration);

      expect(result.acquired).toBe(true);
    });

    it('should handle very long lock durations', async () => {
      const longDuration = 24 * 60 * 60 * 1000; // 24 hours
      const expiresAt = new Date(Date.now() + longDuration);

      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.extractionLock.create.mockResolvedValue({
        id: mockLockId,
        resourceType,
        resourceId,
        extractionType,
        processId: mockProcessId,
        acquiredAt: new Date(),
        expiresAt,
      });

      const result = await acquireLock(resourceType, resourceId, extractionType, longDuration);

      expect(result.acquired).toBe(true);
    });

    it('should handle null processId in releaseLock gracefully', async () => {
      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 0 });

      const result = await releaseLock('');

      expect(result).toBe(false);
    });

    it('should handle cleanup when many locks have expired', async () => {
      mockPrisma.extractionLock.deleteMany.mockResolvedValue({ count: 1000 });

      const result = await cleanupExpiredLocks();

      expect(result).toBe(1000);
    });
  });
});
