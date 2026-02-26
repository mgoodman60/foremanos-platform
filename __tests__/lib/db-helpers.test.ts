import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

// Mock prisma before importing the module
const mockPrisma = vi.hoisted(() => ({
  $connect: vi.fn(),
  $queryRaw: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

import { withRetry, withErrorHandling, checkDatabaseHealth } from '@/lib/db-helpers';

describe('db-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isRetryableError (tested via withRetry)', () => {
    it('should retry on connection errors', async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Connection refused');
        }
        return Promise.resolve('success');
      });

      mockPrisma.$connect.mockResolvedValue(undefined);

      const resultPromise = withRetry(operation, 'test-op');

      // Advance through retries
      await vi.advanceTimersByTimeAsync(1000); // First retry delay
      await vi.advanceTimersByTimeAsync(2000); // Second retry delay

      const result = await resultPromise;
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should retry on timeout errors', async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Operation timeout');
        }
        return Promise.resolve('success');
      });

      mockPrisma.$connect.mockResolvedValue(undefined);

      const resultPromise = withRetry(operation, 'test-op');
      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should retry on ECONNREFUSED errors', async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          throw new Error('ECONNREFUSED');
        }
        return Promise.resolve('success');
      });

      mockPrisma.$connect.mockResolvedValue(undefined);

      const resultPromise = withRetry(operation, 'test-op');
      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;
      expect(result).toBe('success');
    });

    it('should retry on upstream errors', async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          throw new Error('upstream server error');
        }
        return Promise.resolve('success');
      });

      mockPrisma.$connect.mockResolvedValue(undefined);

      const resultPromise = withRetry(operation, 'test-op');
      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;
      expect(result).toBe('success');
    });

    it('should retry on connection reset errors', async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Connection reset by peer');
        }
        return Promise.resolve('success');
      });

      mockPrisma.$connect.mockResolvedValue(undefined);

      const resultPromise = withRetry(operation, 'test-op');
      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;
      expect(result).toBe('success');
    });

    it('should retry on Prisma P2024 error code', async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          const error = new Error('Prisma error') as Error & { code: string };
          error.code = 'P2024';
          throw error;
        }
        return Promise.resolve('success');
      });

      mockPrisma.$connect.mockResolvedValue(undefined);

      const resultPromise = withRetry(operation, 'test-op');
      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;
      expect(result).toBe('success');
    });

    it('should retry on Prisma P1001 error code', async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          const error = new Error('Prisma error') as Error & { code: string };
          error.code = 'P1001';
          throw error;
        }
        return Promise.resolve('success');
      });

      mockPrisma.$connect.mockResolvedValue(undefined);

      const resultPromise = withRetry(operation, 'test-op');
      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;
      expect(result).toBe('success');
    });

    it('should not retry on non-retryable errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Invalid query syntax'));

      await expect(withRetry(operation, 'test-op')).rejects.toThrow('Invalid query syntax');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should not retry on validation errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Unique constraint violation'));

      await expect(withRetry(operation, 'test-op')).rejects.toThrow('Unique constraint violation');
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('withRetry', () => {
    it('should return result on first successful attempt', async () => {
      const operation = vi.fn().mockResolvedValue({ id: 1, name: 'test' });

      const result = await withRetry(operation, 'test-op');

      expect(result).toEqual({ id: 1, name: 'test' });
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff delays', async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 4) {
          throw new Error('Connection timeout');
        }
        return Promise.resolve('success');
      });

      mockPrisma.$connect.mockResolvedValue(undefined);

      const resultPromise = withRetry(operation, 'test-op');

      // First retry: 1000ms * 2^0 = 1000ms
      await vi.advanceTimersByTimeAsync(1000);
      expect(attempts).toBe(2);

      // Second retry: 1000ms * 2^1 = 2000ms
      await vi.advanceTimersByTimeAsync(2000);
      expect(attempts).toBe(3);

      // Third retry: 1000ms * 2^2 = 4000ms
      await vi.advanceTimersByTimeAsync(4000);
      expect(attempts).toBe(4);

      const result = await resultPromise;
      expect(result).toBe('success');
    });

    it('should throw after exhausting all retries', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Connection refused'));
      mockPrisma.$connect.mockResolvedValue(undefined);

      const resultPromise = withRetry(operation, 'test-op', 3);

      // Advance through all retry delays and catch errors properly
      let caughtError: Error | null = null;
      resultPromise.catch((e) => {
        caughtError = e;
      });

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);
      await vi.advanceTimersByTimeAsync(100); // Extra time to ensure all retries complete

      expect(caughtError).toBeInstanceOf(Error);
      // @ts-expect-error strictNullChecks migration
      expect((caughtError as Error).message).toBe('Connection refused');
      expect(operation).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should attempt reconnect between retries', async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Connection error');
        }
        return Promise.resolve('success');
      });

      mockPrisma.$connect.mockResolvedValue(undefined);

      const resultPromise = withRetry(operation, 'test-op');
      await vi.advanceTimersByTimeAsync(1000);

      await resultPromise;
      expect(mockPrisma.$connect).toHaveBeenCalled();
    });

    it('should continue even if reconnect fails', async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Connection error');
        }
        return Promise.resolve('success');
      });

      mockPrisma.$connect.mockRejectedValue(new Error('Reconnect failed'));

      const resultPromise = withRetry(operation, 'test-op');
      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;
      expect(result).toBe('success');
    });
  });

  describe('withErrorHandling', () => {
    it('should return result on success', async () => {
      const operation = vi.fn().mockResolvedValue({ data: 'test' });

      const result = await withErrorHandling(operation, 'test-op');

      expect(result).toEqual({ data: 'test' });
    });

    it('should return default value on error', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Database error'));

      const result = await withErrorHandling(operation, 'test-op', 'default-value');

      expect(result).toBe('default-value');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should return undefined when no default value provided', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Database error'));

      const result = await withErrorHandling(operation, 'test-op');

      expect(result).toBeUndefined();
    });

    it('should return array default value', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Database error'));

      const result = await withErrorHandling(operation, 'test-op', []);

      expect(result).toEqual([]);
    });

    it('should return null as default value', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Database error'));

      const result = await withErrorHandling(operation, 'test-op', null);

      expect(result).toBeNull();
    });

    it('should log error with operation name', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Specific error'));

      await withErrorHandling(operation, 'my-operation');

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('checkDatabaseHealth', () => {
    it('should return true when database is healthy', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await checkDatabaseHealth();

      expect(result).toBe(true);
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('should return false when database query fails', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection failed'));

      const result = await checkDatabaseHealth();

      expect(result).toBe(false);
    });

    it('should return false on timeout', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Query timeout'));

      const result = await checkDatabaseHealth();

      expect(result).toBe(false);
    });
  });
});
