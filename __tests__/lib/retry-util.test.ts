import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

import {
  withRetry,
  fetchWithRetry,
  withDatabaseRetry,
  type RetryOptions
} from '@/lib/retry-util';

describe('retry-util', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================
  // withRetry - Success Cases
  // ============================================
  describe('withRetry - success cases', () => {
    it('should return result on first successful attempt', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');

      const result = await withRetry(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should return result after one retry', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          throw new Error('connect timeout');
        }
        return Promise.resolve('success');
      });

      const resultPromise = withRetry(mockFn);
      await vi.advanceTimersByTimeAsync(500); // First retry delay

      const result = await resultPromise;
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should return result after multiple retries', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('upstream error');
        }
        return Promise.resolve({ data: 'result' });
      });

      const resultPromise = withRetry(mockFn);
      await vi.advanceTimersByTimeAsync(500); // First retry
      await vi.advanceTimersByTimeAsync(1000); // Second retry

      const result = await resultPromise;
      expect(result).toEqual({ data: 'result' });
      expect(attempts).toBe(3);
    });

    it('should handle successful async function returning object', async () => {
      const mockFn = vi.fn().mockResolvedValue({ id: 1, name: 'test' });

      const result = await withRetry(mockFn);

      expect(result).toEqual({ id: 1, name: 'test' });
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should handle successful async function returning array', async () => {
      const mockFn = vi.fn().mockResolvedValue([1, 2, 3]);

      const result = await withRetry(mockFn);

      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle successful async function returning null', async () => {
      const mockFn = vi.fn().mockResolvedValue(null);

      const result = await withRetry(mockFn);

      expect(result).toBeNull();
    });
  });

  // ============================================
  // withRetry - Default shouldRetry Logic
  // ============================================
  describe('withRetry - default shouldRetry logic', () => {
    it('should retry on connection errors', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          throw new Error('connect refused'); // Changed to lowercase 'connect' to match shouldRetry pattern
        }
        return Promise.resolve('success');
      });

      const resultPromise = withRetry(mockFn);
      await vi.advanceTimersByTimeAsync(500);

      const result = await resultPromise;
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should retry on timeout errors', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          throw new Error('Request timeout');
        }
        return Promise.resolve('success');
      });

      const resultPromise = withRetry(mockFn);
      await vi.advanceTimersByTimeAsync(500);

      const result = await resultPromise;
      expect(result).toBe('success');
    });

    it('should retry on ECONNREFUSED errors', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          throw new Error('ECONNREFUSED');
        }
        return Promise.resolve('success');
      });

      const resultPromise = withRetry(mockFn);
      await vi.advanceTimersByTimeAsync(500);

      const result = await resultPromise;
      expect(result).toBe('success');
    });

    it('should retry on upstream errors', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          throw new Error('upstream connect error or disconnect/reset before headers');
        }
        return Promise.resolve('success');
      });

      const resultPromise = withRetry(mockFn);
      await vi.advanceTimersByTimeAsync(500);

      const result = await resultPromise;
      expect(result).toBe('success');
    });

    it('should retry on HTTP 500 errors', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          const error = new Error('Server error') as Error & { status: number };
          error.status = 500;
          throw error;
        }
        return Promise.resolve('success');
      });

      const resultPromise = withRetry(mockFn);
      await vi.advanceTimersByTimeAsync(500);

      const result = await resultPromise;
      expect(result).toBe('success');
    });

    it('should retry on HTTP 503 errors', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          const error = new Error('Service unavailable') as Error & { status: number };
          error.status = 503;
          throw error;
        }
        return Promise.resolve('success');
      });

      const resultPromise = withRetry(mockFn);
      await vi.advanceTimersByTimeAsync(500);

      const result = await resultPromise;
      expect(result).toBe('success');
    });

    it('should retry on HTTP 599 errors (boundary)', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          const error = new Error('Server error') as Error & { status: number };
          error.status = 599;
          throw error;
        }
        return Promise.resolve('success');
      });

      const resultPromise = withRetry(mockFn);
      await vi.advanceTimersByTimeAsync(500);

      const result = await resultPromise;
      expect(result).toBe('success');
    });

    it('should retry on NetworkError', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          const error = new Error('Network error');
          error.name = 'NetworkError';
          throw error;
        }
        return Promise.resolve('success');
      });

      const resultPromise = withRetry(mockFn);
      await vi.advanceTimersByTimeAsync(500);

      const result = await resultPromise;
      expect(result).toBe('success');
    });

    it('should retry on TypeError', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          const error = new Error('Type error');
          error.name = 'TypeError';
          throw error;
        }
        return Promise.resolve('success');
      });

      const resultPromise = withRetry(mockFn);
      await vi.advanceTimersByTimeAsync(500);

      const result = await resultPromise;
      expect(result).toBe('success');
    });

    it('should NOT retry on HTTP 400 errors', async () => {
      const mockFn = vi.fn().mockImplementation(() => {
        const error = new Error('Bad request') as Error & { status: number };
        error.status = 400;
        throw error;
      });

      await expect(withRetry(mockFn)).rejects.toThrow('Bad request');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on HTTP 404 errors', async () => {
      const mockFn = vi.fn().mockImplementation(() => {
        const error = new Error('Not found') as Error & { status: number };
        error.status = 404;
        throw error;
      });

      await expect(withRetry(mockFn)).rejects.toThrow('Not found');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on validation errors', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Validation failed'));

      await expect(withRetry(mockFn)).rejects.toThrow('Validation failed');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on authentication errors', async () => {
      const mockFn = vi.fn().mockImplementation(() => {
        const error = new Error('Unauthorized') as Error & { status: number };
        error.status = 401;
        throw error;
      });

      await expect(withRetry(mockFn)).rejects.toThrow('Unauthorized');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================
  // withRetry - Exponential Backoff
  // ============================================
  describe('withRetry - exponential backoff', () => {
    it('should use default backoff pattern (500ms, 1000ms, 2000ms)', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts <= 3) {
          throw new Error('connect error');
        }
        return Promise.resolve('success');
      });

      const resultPromise = withRetry(mockFn);

      // First retry: 500ms * 2^0 = 500ms
      await vi.advanceTimersByTimeAsync(500);
      expect(attempts).toBe(2);

      // Second retry: 500ms * 2^1 = 1000ms
      await vi.advanceTimersByTimeAsync(1000);
      expect(attempts).toBe(3);

      // Third retry: 500ms * 2^2 = 2000ms
      await vi.advanceTimersByTimeAsync(2000);
      expect(attempts).toBe(4);

      const result = await resultPromise;
      expect(result).toBe('success');
    });

    it('should respect custom initialDelay', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          throw new Error('timeout');
        }
        return Promise.resolve('success');
      });

      const resultPromise = withRetry(mockFn, { initialDelay: 1000 });

      // First retry: 1000ms * 2^0 = 1000ms
      await vi.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;
      expect(result).toBe('success');
    });

    it('should respect custom backoffFactor', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts <= 2) {
          throw new Error('timeout');
        }
        return Promise.resolve('success');
      });

      const resultPromise = withRetry(mockFn, {
        initialDelay: 100,
        backoffFactor: 3
      });

      // First retry: 100ms * 3^0 = 100ms
      await vi.advanceTimersByTimeAsync(100);
      expect(attempts).toBe(2);

      // Second retry: 100ms * 3^1 = 300ms
      await vi.advanceTimersByTimeAsync(300);
      expect(attempts).toBe(3);

      const result = await resultPromise;
      expect(result).toBe('success');
    });

    it('should cap delay at maxDelay', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts <= 3) {
          throw new Error('timeout');
        }
        return Promise.resolve('success');
      });

      const resultPromise = withRetry(mockFn, {
        initialDelay: 1000,
        maxDelay: 1500,
        backoffFactor: 2
      });

      // First retry: 1000ms (within maxDelay)
      await vi.advanceTimersByTimeAsync(1000);
      expect(attempts).toBe(2);

      // Second retry: would be 2000ms but capped at 1500ms
      await vi.advanceTimersByTimeAsync(1500);
      expect(attempts).toBe(3);

      // Third retry: would be 4000ms but capped at 1500ms
      await vi.advanceTimersByTimeAsync(1500);
      expect(attempts).toBe(4);

      const result = await resultPromise;
      expect(result).toBe('success');
    });

    it('should use default maxDelay of 5000ms', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts <= 5) {
          throw new Error('timeout');
        }
        return Promise.resolve('success');
      });

      const resultPromise = withRetry(mockFn, {
        initialDelay: 2000,
        maxRetries: 5
      });

      // Delays: 2000, 4000, 5000 (capped), 5000 (capped), 5000 (capped)
      await vi.advanceTimersByTimeAsync(2000);
      expect(attempts).toBe(2);

      await vi.advanceTimersByTimeAsync(4000);
      expect(attempts).toBe(3);

      // Rest capped at 5000ms
      await vi.advanceTimersByTimeAsync(5000);
      expect(attempts).toBe(4);

      await vi.advanceTimersByTimeAsync(5000);
      expect(attempts).toBe(5);

      await vi.advanceTimersByTimeAsync(5000);
      expect(attempts).toBe(6);

      const result = await resultPromise;
      expect(result).toBe('success');
    });
  });

  // ============================================
  // withRetry - Custom Options
  // ============================================
  describe('withRetry - custom options', () => {
    it('should respect custom maxRetries', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('connect error'));

      const resultPromise = withRetry(mockFn, { maxRetries: 1 });

      let caughtError: Error | null = null;
      resultPromise.catch((e) => {
        caughtError = e;
      });

      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(100);

      expect(caughtError).toBeInstanceOf(Error);
      // @ts-expect-error strictNullChecks migration
      expect((caughtError as Error).message).toBe('connect error');
      expect(mockFn).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    it('should respect custom shouldRetry function', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        throw new Error('Custom error');
      });

      const customShouldRetry = (error: unknown) => {
        return (error as Error).message === 'Custom error';
      };

      const resultPromise = withRetry(mockFn, {
        maxRetries: 2,
        shouldRetry: customShouldRetry
      });

      let caughtError: Error | null = null;
      resultPromise.catch((e) => {
        caughtError = e;
      });

      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(100);

      expect(caughtError).toBeInstanceOf(Error);
      expect(attempts).toBe(3); // Initial + 2 retries
    });

    it('should use custom shouldRetry to prevent retries', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Do not retry'));

      const customShouldRetry = () => false;

      await expect(
        withRetry(mockFn, { shouldRetry: customShouldRetry })
      ).rejects.toThrow('Do not retry');

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should call custom onRetry callback', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts <= 2) {
          throw new Error('connect error'); // Changed to retryable error pattern
        }
        return Promise.resolve('success');
      });

      const onRetrySpy = vi.fn();

      const resultPromise = withRetry(mockFn, { onRetry: onRetrySpy });

      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(1000);

      await resultPromise;

      expect(onRetrySpy).toHaveBeenCalledTimes(2);
      expect(onRetrySpy).toHaveBeenNthCalledWith(1, 1, expect.any(Error));
      expect(onRetrySpy).toHaveBeenNthCalledWith(2, 2, expect.any(Error));
    });

    it('should call onRetry with correct attempt numbers', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts <= 3) {
          throw new Error('timeout');
        }
        return Promise.resolve('success');
      });

      const attemptNumbers: number[] = [];
      const onRetry = (attempt: number) => {
        attemptNumbers.push(attempt);
      };

      const resultPromise = withRetry(mockFn, { onRetry });

      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);

      await resultPromise;

      expect(attemptNumbers).toEqual([1, 2, 3]);
    });
  });

  // ============================================
  // withRetry - Error Handling
  // ============================================
  describe('withRetry - error handling', () => {
    it('should throw after exhausting all retries', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('connect error')); // Changed to retryable error

      const resultPromise = withRetry(mockFn, { maxRetries: 2 });

      let caughtError: Error | null = null;
      resultPromise.catch((e) => {
        caughtError = e;
      });

      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(100);

      expect(caughtError).toBeInstanceOf(Error);
      // @ts-expect-error strictNullChecks migration
      expect((caughtError as Error).message).toBe('connect error');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should throw immediately on non-retryable error', async () => {
      const mockFn = vi.fn().mockImplementation(() => {
        const error = new Error('Bad request') as Error & { status: number };
        error.status = 400;
        throw error;
      });

      await expect(withRetry(mockFn)).rejects.toThrow('Bad request');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should handle errors with no message', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error());

      await expect(withRetry(mockFn)).rejects.toThrow();
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should handle non-Error objects thrown', async () => {
      const mockFn = vi.fn().mockRejectedValue('string error');

      await expect(withRetry(mockFn)).rejects.toBe('string error');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should handle null thrown as error', async () => {
      const mockFn = vi.fn().mockRejectedValue(null);

      await expect(withRetry(mockFn)).rejects.toBeNull();
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================
  // fetchWithRetry
  // ============================================
  describe('fetchWithRetry', () => {
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockFetch = vi.fn();
      global.fetch = mockFetch;
    });

    it('should successfully fetch on first attempt', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        ok: true
      } as Response;
      mockFetch.mockResolvedValue(mockResponse);

      const result = await fetchWithRetry('https://api.example.com/data');

      expect(result).toBe(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', undefined);
    });

    it('should pass RequestInit options to fetch', async () => {
      const mockResponse = { status: 200, ok: true } as Response;
      mockFetch.mockResolvedValue(mockResponse);

      const init: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      };

      await fetchWithRetry('https://api.example.com/data', init);

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', init);
    });

    it('should retry on 5xx errors', async () => {
      let attempts = 0;
      mockFetch.mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          return Promise.resolve({
            status: 500,
            statusText: 'Internal Server Error',
            ok: false
          } as Response);
        }
        return Promise.resolve({ status: 200, ok: true } as Response);
      });

      const resultPromise = fetchWithRetry('https://api.example.com/data');
      await vi.advanceTimersByTimeAsync(500);

      const result = await resultPromise;
      expect(result.status).toBe(200);
      expect(attempts).toBe(2);
    });

    it('should throw error with status on 5xx', async () => {
      mockFetch.mockResolvedValue({
        status: 503,
        statusText: 'Service Unavailable',
        ok: false
      } as Response);

      const resultPromise = fetchWithRetry('https://api.example.com/data');

      let caughtError: (Error & { status?: number }) | null = null;
      resultPromise.catch((e) => {
        caughtError = e;
      });

      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(100);

      expect(caughtError).toBeInstanceOf(Error);
      // @ts-expect-error strictNullChecks migration
      expect(caughtError?.message).toContain('503');
      // @ts-expect-error strictNullChecks migration
      expect(caughtError?.status).toBe(503);
    });

    it('should NOT retry on 4xx errors', async () => {
      mockFetch.mockResolvedValue({
        status: 404,
        statusText: 'Not Found',
        ok: false
      } as Response);

      const result = await fetchWithRetry('https://api.example.com/data');

      expect(result.status).toBe(404);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on 2xx success', async () => {
      mockFetch.mockResolvedValue({
        status: 201,
        statusText: 'Created',
        ok: true
      } as Response);

      const result = await fetchWithRetry('https://api.example.com/data');

      expect(result.status).toBe(201);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on network errors', async () => {
      let attempts = 0;
      mockFetch.mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          return Promise.reject(new Error('Network timeout'));
        }
        return Promise.resolve({ status: 200, ok: true } as Response);
      });

      const resultPromise = fetchWithRetry('https://api.example.com/data');
      await vi.advanceTimersByTimeAsync(500);

      const result = await resultPromise;
      expect(result.status).toBe(200);
      expect(attempts).toBe(2);
    });

    it('should accept custom retry options', async () => {
      let attempts = 0;
      mockFetch.mockImplementation(() => {
        attempts++;
        if (attempts <= 1) {
          return Promise.resolve({
            status: 502,
            statusText: 'Bad Gateway',
            ok: false
          } as Response);
        }
        return Promise.resolve({ status: 200, ok: true } as Response);
      });

      const resultPromise = fetchWithRetry(
        'https://api.example.com/data',
        undefined,
        { initialDelay: 1000, maxRetries: 2 }
      );

      await vi.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;
      expect(result.status).toBe(200);
    });

    it('should handle HTTP 599 (boundary)', async () => {
      let attempts = 0;
      mockFetch.mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          return Promise.resolve({
            status: 599,
            statusText: 'Network Error',
            ok: false
          } as Response);
        }
        return Promise.resolve({ status: 200, ok: true } as Response);
      });

      const resultPromise = fetchWithRetry('https://api.example.com/data');
      await vi.advanceTimersByTimeAsync(500);

      const result = await resultPromise;
      expect(result.status).toBe(200);
    });

    it('should NOT retry on HTTP 600 (outside 5xx range)', async () => {
      mockFetch.mockResolvedValue({
        status: 600,
        statusText: 'Unknown',
        ok: false
      } as Response);

      const result = await fetchWithRetry('https://api.example.com/data');

      expect(result.status).toBe(600);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================
  // withDatabaseRetry
  // ============================================
  describe('withDatabaseRetry', () => {
    it('should successfully execute database operation', async () => {
      const mockOp = vi.fn().mockResolvedValue({ id: 1, name: 'test' });

      const result = await withDatabaseRetry(mockOp, 'findUser');

      expect(result).toEqual({ id: 1, name: 'test' });
      expect(mockOp).toHaveBeenCalledTimes(1);
    });

    it('should retry on Prisma P1001 error (cannot reach database)', async () => {
      let attempts = 0;
      const mockOp = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          const error = new Error('Cannot reach database') as Error & { code: string };
          error.code = 'P1001';
          throw error;
        }
        return Promise.resolve({ success: true });
      });

      const resultPromise = withDatabaseRetry(mockOp, 'createUser');
      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;
      expect(result).toEqual({ success: true });
      expect(attempts).toBe(2);
    });

    it('should retry on Prisma P1002 error (timeout)', async () => {
      let attempts = 0;
      const mockOp = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          const error = new Error('Database timeout') as Error & { code: string };
          error.code = 'P1002';
          throw error;
        }
        return Promise.resolve({ success: true });
      });

      const resultPromise = withDatabaseRetry(mockOp);
      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;
      expect(result).toEqual({ success: true });
    });

    it('should retry on Prisma P1017 error (connection lost)', async () => {
      let attempts = 0;
      const mockOp = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          const error = new Error('Server has closed the connection') as Error & { code: string };
          error.code = 'P1017';
          throw error;
        }
        return Promise.resolve({ success: true });
      });

      const resultPromise = withDatabaseRetry(mockOp);
      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;
      expect(result).toEqual({ success: true });
    });

    it('should retry on connection error messages', async () => {
      let attempts = 0;
      const mockOp = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          throw new Error('Connection pool timeout');
        }
        return Promise.resolve({ success: true });
      });

      const resultPromise = withDatabaseRetry(mockOp);
      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;
      expect(result).toEqual({ success: true });
    });

    it('should retry on timeout error messages', async () => {
      let attempts = 0;
      const mockOp = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          throw new Error('Query timeout exceeded');
        }
        return Promise.resolve({ success: true });
      });

      const resultPromise = withDatabaseRetry(mockOp);
      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;
      expect(result).toEqual({ success: true });
    });

    it('should NOT retry on Prisma validation errors', async () => {
      const mockOp = vi.fn().mockImplementation(() => {
        const error = new Error('Unique constraint violation') as Error & { code: string };
        error.code = 'P2002';
        throw error;
      });

      await expect(withDatabaseRetry(mockOp)).rejects.toThrow('Unique constraint violation');
      expect(mockOp).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on foreign key constraint errors', async () => {
      const mockOp = vi.fn().mockImplementation(() => {
        const error = new Error('Foreign key constraint failed') as Error & { code: string };
        error.code = 'P2003';
        throw error;
      });

      await expect(withDatabaseRetry(mockOp)).rejects.toThrow('Foreign key constraint failed');
      expect(mockOp).toHaveBeenCalledTimes(1);
    });

    it('should use default operation name', async () => {
      const mockOp = vi.fn().mockResolvedValue('success');

      await withDatabaseRetry(mockOp);

      expect(mockOp).toHaveBeenCalledTimes(1);
    });

    it('should use custom operation name in logs', async () => {
      let attempts = 0;
      const mockOp = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          const error = new Error('Connection lost') as Error & { code: string };
          error.code = 'P1017';
          throw error;
        }
        return Promise.resolve('success');
      });

      const resultPromise = withDatabaseRetry(mockOp, 'Custom DB Operation');
      await vi.advanceTimersByTimeAsync(1000);

      await resultPromise;

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RETRY_UTIL',
        expect.stringContaining('Custom DB Operation'),
        expect.objectContaining({ error: 'Connection lost' })
      );
    });

    it('should use exponential backoff starting at 1000ms', async () => {
      let attempts = 0;
      const mockOp = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts <= 3) {
          const error = new Error('timeout') as Error & { code: string };
          error.code = 'P1002';
          throw error;
        }
        return Promise.resolve('success');
      });

      const resultPromise = withDatabaseRetry(mockOp);

      // First retry: 1000ms
      await vi.advanceTimersByTimeAsync(1000);
      expect(attempts).toBe(2);

      // Second retry: 2000ms
      await vi.advanceTimersByTimeAsync(2000);
      expect(attempts).toBe(3);

      // Third retry: 4000ms
      await vi.advanceTimersByTimeAsync(4000);
      expect(attempts).toBe(4);

      const result = await resultPromise;
      expect(result).toBe('success');
    });

    it('should retry up to 3 times', async () => {
      const mockOp = vi.fn().mockImplementation(() => {
        const error = new Error('Connection timeout') as Error & { code: string };
        error.code = 'P1002';
        throw error;
      });

      const resultPromise = withDatabaseRetry(mockOp);

      let caughtError: Error | null = null;
      resultPromise.catch((e) => {
        caughtError = e;
      });

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);
      await vi.advanceTimersByTimeAsync(100);

      expect(caughtError).toBeInstanceOf(Error);
      expect(mockOp).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should handle non-Error objects', async () => {
      const mockOp = vi.fn().mockRejectedValue('string error');

      await expect(withDatabaseRetry(mockOp)).rejects.toBe('string error');
      expect(mockOp).toHaveBeenCalledTimes(1);
    });

    it('should handle errors without code property', async () => {
      let attempts = 0;
      const mockOp = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          throw new Error('Database connection failed');
        }
        return Promise.resolve('success');
      });

      const resultPromise = withDatabaseRetry(mockOp);
      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;
      expect(result).toBe('success');
    });
  });

  // ============================================
  // Edge Cases
  // ============================================
  describe('edge cases', () => {
    it('should handle maxRetries = 0', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Immediate fail'));

      await expect(
        withRetry(mockFn, { maxRetries: 0 })
      ).rejects.toThrow('Immediate fail');

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should handle very large maxRetries', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          throw new Error('connect error');
        }
        return Promise.resolve('success');
      });

      const resultPromise = withRetry(mockFn, { maxRetries: 100 });
      await vi.advanceTimersByTimeAsync(500);

      const result = await resultPromise;
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should handle initialDelay = 0', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          throw new Error('timeout');
        }
        return Promise.resolve('success');
      });

      // With initialDelay = 0, the retry happens immediately without timer advancement
      const resultPromise = withRetry(mockFn, { initialDelay: 0 });
      // Advance timers to ensure any pending promises resolve
      await vi.advanceTimersByTimeAsync(0);
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should handle maxDelay smaller than initialDelay', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          throw new Error('timeout');
        }
        return Promise.resolve('success');
      });

      const resultPromise = withRetry(mockFn, {
        initialDelay: 1000,
        maxDelay: 500
      });

      // Should be capped at 500ms
      await vi.advanceTimersByTimeAsync(500);

      const result = await resultPromise;
      expect(result).toBe('success');
    });

    it('should handle backoffFactor = 1 (no exponential growth)', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts <= 2) {
          throw new Error('timeout');
        }
        return Promise.resolve('success');
      });

      const resultPromise = withRetry(mockFn, {
        initialDelay: 100,
        backoffFactor: 1
      });

      // All delays should be 100ms
      await vi.advanceTimersByTimeAsync(100);
      expect(attempts).toBe(2);

      await vi.advanceTimersByTimeAsync(100);
      expect(attempts).toBe(3);

      const result = await resultPromise;
      expect(result).toBe('success');
    });

    it('should handle errors with only status property', async () => {
      const mockFn = vi.fn().mockImplementation(() => {
        const error = { status: 500 } as Error & { status: number };
        throw error;
      });

      // Object with status 500 should trigger retries according to shouldRetry logic
      const resultPromise = withRetry(mockFn, { maxRetries: 2 });

      let caughtError: unknown = null;
      resultPromise.catch((e) => {
        caughtError = e;
      });

      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(100);

      expect(caughtError).toEqual({ status: 500 });
      expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should handle undefined error', async () => {
      const mockFn = vi.fn().mockImplementation(() => {
        throw undefined;
      });

      await expect(withRetry(mockFn)).rejects.toBeUndefined();
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });
});
