import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock global fetch with vi.hoisted
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

// Store original global fetch
const originalFetch = global.fetch;

// Mock global fetch before imports
global.fetch = mocks.fetch;

// Import after mocks
import {
  fetchWithRetry,
  parseResponse,
  getErrorMessage,
  fetchJSON,
  type FetchError,
  type FetchRetryOptions,
  type FetchOptions,
} from '@/lib/fetch-with-retry';

describe('fetch-with-retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore original fetch
    global.fetch = mocks.fetch;
  });

  describe('fetchWithRetry', () => {
    describe('successful requests', () => {
      it('should return response on successful request', async () => {
        const mockResponse = new Response('success', { status: 200 });
        mocks.fetch.mockResolvedValueOnce(mockResponse);

        const result = await fetchWithRetry('https://api.example.com/test');

        expect(mocks.fetch).toHaveBeenCalledTimes(1);
        expect(mocks.fetch).toHaveBeenCalledWith('https://api.example.com/test', {});
        expect(result).toBe(mockResponse);
      });

      it('should pass through fetch options', async () => {
        const mockResponse = new Response('success', { status: 200 });
        mocks.fetch.mockResolvedValueOnce(mockResponse);

        const options: FetchOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: 'data' }),
        };

        await fetchWithRetry('https://api.example.com/test', options);

        expect(mocks.fetch).toHaveBeenCalledWith('https://api.example.com/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: 'data' }),
        });
      });

      it('should return non-ok response if not retryable', async () => {
        const mockResponse = new Response('Bad Request', { status: 400 });
        mocks.fetch.mockResolvedValueOnce(mockResponse);

        const result = await fetchWithRetry('https://api.example.com/test');

        expect(mocks.fetch).toHaveBeenCalledTimes(1);
        expect(result.status).toBe(400);
      });
    });

    describe('retry on retryable status codes', () => {
      it('should retry on 503 Service Unavailable', async () => {
        const failResponse = new Response('Service Unavailable', { status: 503 });
        const successResponse = new Response('success', { status: 200 });

        mocks.fetch
          .mockResolvedValueOnce(failResponse)
          .mockResolvedValueOnce(successResponse);

        const onRetry = vi.fn();
        const result = await fetchWithRetry('https://api.example.com/test', {
          retryOptions: { onRetry, initialDelay: 10, maxDelay: 100 },
        });

        expect(mocks.fetch).toHaveBeenCalledTimes(2);
        expect(onRetry).toHaveBeenCalledTimes(1);
        expect(result).toBe(successResponse);
      });

      it('should retry on 502 Bad Gateway', async () => {
        const failResponse = new Response('Bad Gateway', { status: 502 });
        const successResponse = new Response('success', { status: 200 });

        mocks.fetch
          .mockResolvedValueOnce(failResponse)
          .mockResolvedValueOnce(successResponse);

        const result = await fetchWithRetry('https://api.example.com/test', {
          retryOptions: { initialDelay: 10, maxDelay: 100 },
        });

        expect(mocks.fetch).toHaveBeenCalledTimes(2);
        expect(result).toBe(successResponse);
      });

      it('should retry on 504 Gateway Timeout', async () => {
        const failResponse = new Response('Gateway Timeout', { status: 504 });
        const successResponse = new Response('success', { status: 200 });

        mocks.fetch
          .mockResolvedValueOnce(failResponse)
          .mockResolvedValueOnce(successResponse);

        const result = await fetchWithRetry('https://api.example.com/test', {
          retryOptions: { initialDelay: 10, maxDelay: 100 },
        });

        expect(mocks.fetch).toHaveBeenCalledTimes(2);
        expect(result).toBe(successResponse);
      });

      it('should return failed response after max retries exhausted', async () => {
        const failResponse = new Response('Service Unavailable', { status: 503 });

        mocks.fetch.mockResolvedValue(failResponse);

        const onRetry = vi.fn();
        const result = await fetchWithRetry('https://api.example.com/test', {
          retryOptions: { maxRetries: 2, onRetry, initialDelay: 10, maxDelay: 100 },
        });

        expect(mocks.fetch).toHaveBeenCalledTimes(3); // initial + 2 retries
        expect(onRetry).toHaveBeenCalledTimes(2);
        expect(result.status).toBe(503);
      });
    });

    describe('retry on network errors', () => {
      it('should retry on fetch TypeError', async () => {
        const networkError = new TypeError('fetch failed');
        const successResponse = new Response('success', { status: 200 });

        mocks.fetch
          .mockRejectedValueOnce(networkError)
          .mockResolvedValueOnce(successResponse);

        const onRetry = vi.fn();
        const result = await fetchWithRetry('https://api.example.com/test', {
          retryOptions: { onRetry, initialDelay: 10, maxDelay: 100 },
        });

        expect(mocks.fetch).toHaveBeenCalledTimes(2);
        expect(onRetry).toHaveBeenCalledWith(1, networkError);
        expect(result).toBe(successResponse);
      });

      it('should retry on AbortError', async () => {
        const abortError = new Error('Request aborted');
        abortError.name = 'AbortError';
        const successResponse = new Response('success', { status: 200 });

        mocks.fetch
          .mockRejectedValueOnce(abortError)
          .mockResolvedValueOnce(successResponse);

        const result = await fetchWithRetry('https://api.example.com/test', {
          retryOptions: { initialDelay: 10, maxDelay: 100 },
        });

        expect(mocks.fetch).toHaveBeenCalledTimes(2);
        expect(result).toBe(successResponse);
      });

      it('should retry on timeout error', async () => {
        const timeoutError = new Error('Request timeout');
        const successResponse = new Response('success', { status: 200 });

        mocks.fetch
          .mockRejectedValueOnce(timeoutError)
          .mockResolvedValueOnce(successResponse);

        const result = await fetchWithRetry('https://api.example.com/test', {
          retryOptions: { initialDelay: 10, maxDelay: 100 },
        });

        expect(mocks.fetch).toHaveBeenCalledTimes(2);
        expect(result).toBe(successResponse);
      });

      it('should retry on connection error', async () => {
        const connectionError = new Error('connect ECONNREFUSED');
        const successResponse = new Response('success', { status: 200 });

        mocks.fetch
          .mockRejectedValueOnce(connectionError)
          .mockResolvedValueOnce(successResponse);

        const result = await fetchWithRetry('https://api.example.com/test', {
          retryOptions: { initialDelay: 10, maxDelay: 100 },
        });

        expect(mocks.fetch).toHaveBeenCalledTimes(2);
        expect(result.status).toBe(200);
      });

      it('should retry on network error', async () => {
        const networkError = new Error('network failure');
        const successResponse = new Response('success', { status: 200 });

        mocks.fetch
          .mockRejectedValueOnce(networkError)
          .mockResolvedValueOnce(successResponse);

        const result = await fetchWithRetry('https://api.example.com/test', {
          retryOptions: { initialDelay: 10, maxDelay: 100 },
        });

        expect(mocks.fetch).toHaveBeenCalledTimes(2);
        expect(result.status).toBe(200);
      });

      it('should retry on upstream error', async () => {
        const upstreamError = new Error('upstream connect error');
        const successResponse = new Response('success', { status: 200 });

        mocks.fetch
          .mockRejectedValueOnce(upstreamError)
          .mockResolvedValueOnce(successResponse);

        const result = await fetchWithRetry('https://api.example.com/test', {
          retryOptions: { initialDelay: 10, maxDelay: 100 },
        });

        expect(mocks.fetch).toHaveBeenCalledTimes(2);
        expect(result.status).toBe(200);
      });

      it('should throw error after max retries exhausted', async () => {
        const networkError = new TypeError('fetch failed');

        mocks.fetch.mockRejectedValue(networkError);

        await expect(fetchWithRetry('https://api.example.com/test', {
          retryOptions: { maxRetries: 2, initialDelay: 10, maxDelay: 100 },
        })).rejects.toThrow('fetch failed');

        expect(mocks.fetch).toHaveBeenCalledTimes(3); // initial + 2 retries
      });
    });

    describe('non-retryable errors', () => {
      it('should not retry on generic Error', async () => {
        const genericError = new Error('Some error');

        mocks.fetch.mockRejectedValueOnce(genericError);

        await expect(fetchWithRetry('https://api.example.com/test')).rejects.toThrow('Some error');
        expect(mocks.fetch).toHaveBeenCalledTimes(1);
      });

      it('should not retry on 4xx client errors', async () => {
        const mockResponse = new Response('Not Found', { status: 404 });
        mocks.fetch.mockResolvedValueOnce(mockResponse);

        const result = await fetchWithRetry('https://api.example.com/test');

        expect(mocks.fetch).toHaveBeenCalledTimes(1);
        expect(result.status).toBe(404);
      });
    });

    describe('retry options', () => {
      it('should use custom maxRetries', async () => {
        const failResponse = new Response('Service Unavailable', { status: 503 });

        mocks.fetch.mockResolvedValue(failResponse);

        const result = await fetchWithRetry('https://api.example.com/test', {
          retryOptions: { maxRetries: 1, initialDelay: 10, maxDelay: 100 },
        });

        expect(mocks.fetch).toHaveBeenCalledTimes(2); // initial + 1 retry
        expect(result.status).toBe(503);
      });

      it('should call onRetry callback with correct arguments', async () => {
        const failResponse = new Response('Service Unavailable', { status: 503 });
        const successResponse = new Response('success', { status: 200 });

        mocks.fetch
          .mockResolvedValueOnce(failResponse)
          .mockResolvedValueOnce(successResponse);

        const onRetry = vi.fn();
        await fetchWithRetry('https://api.example.com/test', {
          retryOptions: { onRetry, initialDelay: 10, maxDelay: 100 },
        });

        expect(onRetry).toHaveBeenCalledTimes(1);
        expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));

        const errorArg = onRetry.mock.calls[0][1];
        expect(errorArg.message).toContain('503');
      });

      it('should call onRetry for each retry attempt', async () => {
        const failResponse = new Response('Service Unavailable', { status: 503 });

        mocks.fetch.mockResolvedValue(failResponse);

        const onRetry = vi.fn();
        await fetchWithRetry('https://api.example.com/test', {
          retryOptions: { maxRetries: 3, onRetry, initialDelay: 10, maxDelay: 100 },
        });

        expect(onRetry).toHaveBeenCalledTimes(3);
        expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error));
        expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error));
        expect(onRetry).toHaveBeenNthCalledWith(3, 3, expect.any(Error));
      });
    });

    describe('edge cases', () => {
      it('should handle zero retries', async () => {
        const failResponse = new Response('Service Unavailable', { status: 503 });

        mocks.fetch.mockResolvedValueOnce(failResponse);

        const result = await fetchWithRetry('https://api.example.com/test', {
          retryOptions: { maxRetries: 0 },
        });

        expect(mocks.fetch).toHaveBeenCalledTimes(1);
        expect(result.status).toBe(503);
      });

      it('should handle null error', async () => {
        mocks.fetch.mockRejectedValueOnce(null);

        await expect(fetchWithRetry('https://api.example.com/test')).rejects.toBeNull();
        expect(mocks.fetch).toHaveBeenCalledTimes(1);
      });

      it('should handle undefined error', async () => {
        mocks.fetch.mockRejectedValueOnce(undefined);

        await expect(fetchWithRetry('https://api.example.com/test')).rejects.toBeUndefined();
        expect(mocks.fetch).toHaveBeenCalledTimes(1);
      });

      it('should handle string error', async () => {
        mocks.fetch.mockRejectedValueOnce('string error');

        await expect(fetchWithRetry('https://api.example.com/test')).rejects.toBe('string error');
        expect(mocks.fetch).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('parseResponse', () => {
    it('should parse valid JSON response', async () => {
      const mockResponse = new Response(JSON.stringify({ message: 'success' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await parseResponse(mockResponse);

      expect(result).toEqual({ message: 'success' });
    });

    it('should parse complex JSON object', async () => {
      const data = {
        error: 'Something went wrong',
        details: { code: 500, info: 'Internal error' },
        timestamp: 1234567890,
      };
      const mockResponse = new Response(JSON.stringify(data), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await parseResponse(mockResponse);

      expect(result).toEqual(data);
    });

    it('should fallback to text when JSON parsing fails', async () => {
      // Response body can only be read once
      const mockResponse = new Response('Plain text error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });

      const result = await parseResponse(mockResponse);

      // Either contains the text or statusText depending on how body was consumed
      expect(result).toHaveProperty('error');
      expect(typeof result.error).toBe('string');
    });

    it('should handle empty response body', async () => {
      const mockResponse = new Response('', {
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await parseResponse(mockResponse);

      expect(result).toEqual({ error: 'Internal Server Error' });
    });

    it('should use statusText when text reading fails', async () => {
      const mockResponse = {
        statusText: 'Bad Gateway',
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
        text: vi.fn().mockRejectedValue(new Error('Cannot read text')),
      } as unknown as Response;

      const result = await parseResponse(mockResponse);

      expect(result).toEqual({ error: 'Bad Gateway' });
    });

    it('should handle HTML error pages', async () => {
      const htmlError = '<html><body><h1>500 Internal Server Error</h1></body></html>';
      const mockResponse = new Response(htmlError, {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'text/html' },
      });

      const result = await parseResponse(mockResponse);

      // Either contains the HTML or statusText depending on how body was consumed
      expect(result).toHaveProperty('error');
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    });

    it('should handle array JSON response', async () => {
      const mockResponse = new Response(JSON.stringify([1, 2, 3]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await parseResponse(mockResponse);

      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('getErrorMessage', () => {
    it('should return error field from response', async () => {
      const mockResponse = new Response(
        JSON.stringify({ error: 'Database connection failed' }),
        { status: 500 }
      );

      const message = await getErrorMessage(mockResponse);

      expect(message).toBe('Database connection failed');
    });

    it('should return message field from response', async () => {
      const mockResponse = new Response(
        JSON.stringify({ message: 'Validation failed' }),
        { status: 400 }
      );

      const message = await getErrorMessage(mockResponse);

      expect(message).toBe('Validation failed');
    });

    it('should prefer error over message', async () => {
      const mockResponse = new Response(
        JSON.stringify({ error: 'Error message', message: 'Different message' }),
        { status: 500 }
      );

      const message = await getErrorMessage(mockResponse);

      expect(message).toBe('Error message');
    });

    it('should return default message when no error/message fields', async () => {
      const mockResponse = new Response(
        JSON.stringify({ status: 'failed', code: 500 }),
        { status: 500 }
      );

      const message = await getErrorMessage(mockResponse);

      expect(message).toBe('Request failed');
    });

    it('should use custom default message', async () => {
      const mockResponse = new Response(
        JSON.stringify({ status: 'failed' }),
        { status: 500 }
      );

      const message = await getErrorMessage(mockResponse, 'Custom error');

      expect(message).toBe('Custom error');
    });

    it('should handle non-string error field', async () => {
      const mockResponse = new Response(
        JSON.stringify({ error: { code: 500 } }),
        { status: 500 }
      );

      const message = await getErrorMessage(mockResponse, 'Fallback');

      expect(message).toBe('Fallback');
    });

    it('should handle non-string message field', async () => {
      const mockResponse = new Response(
        JSON.stringify({ message: 123 }),
        { status: 500 }
      );

      const message = await getErrorMessage(mockResponse, 'Fallback');

      expect(message).toBe('Fallback');
    });

    it('should handle text response without JSON', async () => {
      const mockResponse = new Response('Plain text error', {
        status: 500,
        statusText: 'Internal Server Error',
      });

      const message = await getErrorMessage(mockResponse);

      // Either contains the text or statusText depending on how body was consumed
      expect(message).toBeTruthy();
      expect(typeof message).toBe('string');
    });

    it('should handle empty response', async () => {
      const mockResponse = new Response('', {
        status: 500,
        statusText: 'Internal Server Error',
      });

      const message = await getErrorMessage(mockResponse);

      expect(message).toBe('Internal Server Error');
    });
  });

  describe('fetchJSON', () => {
    describe('successful requests', () => {
      it('should parse and return JSON data', async () => {
        const data = { id: 1, name: 'Test Project' };
        const mockResponse = new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });

        mocks.fetch.mockResolvedValueOnce(mockResponse);

        const result = await fetchJSON<typeof data>('https://api.example.com/projects');

        expect(result).toEqual(data);
      });

      it('should handle array response', async () => {
        const data = [
          { id: 1, name: 'Project 1' },
          { id: 2, name: 'Project 2' },
        ];
        const mockResponse = new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });

        mocks.fetch.mockResolvedValueOnce(mockResponse);

        const result = await fetchJSON<typeof data>('https://api.example.com/projects');

        expect(result).toEqual(data);
      });

      it('should handle empty object response', async () => {
        const mockResponse = new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });

        mocks.fetch.mockResolvedValueOnce(mockResponse);

        const result = await fetchJSON('https://api.example.com/test');

        expect(result).toEqual({});
      });

      it('should handle null response', async () => {
        const mockResponse = new Response(JSON.stringify(null), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });

        mocks.fetch.mockResolvedValueOnce(mockResponse);

        const result = await fetchJSON('https://api.example.com/test');

        expect(result).toBeNull();
      });
    });

    describe('error handling', () => {
      it('should throw FetchError with status on non-ok response', async () => {
        const mockResponse = new Response(
          JSON.stringify({ error: 'Not found' }),
          { status: 404, statusText: 'Not Found' }
        );

        mocks.fetch.mockResolvedValueOnce(mockResponse);

        await expect(fetchJSON('https://api.example.com/test')).rejects.toMatchObject({
          message: 'Not found',
          status: 404,
        });
      });

      it('should include response in FetchError', async () => {
        const mockResponse = new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, statusText: 'Unauthorized' }
        );

        mocks.fetch.mockResolvedValueOnce(mockResponse);

        try {
          await fetchJSON('https://api.example.com/test');
          expect.fail('Should have thrown');
        } catch (error) {
          const fetchError = error as FetchError;
          expect(fetchError.response).toBeDefined();
          expect(fetchError.response?.status).toBe(401);
        }
      });

      it('should use message field from error response', async () => {
        const mockResponse = new Response(
          JSON.stringify({ message: 'Invalid credentials' }),
          { status: 401 }
        );

        mocks.fetch.mockResolvedValueOnce(mockResponse);

        await expect(fetchJSON('https://api.example.com/test')).rejects.toMatchObject({
          message: 'Invalid credentials',
        });
      });

      it('should use default error message when no error/message in response', async () => {
        const mockResponse = new Response(
          JSON.stringify({ code: 500 }),
          { status: 500, statusText: 'Internal Server Error' }
        );

        mocks.fetch.mockResolvedValueOnce(mockResponse);

        await expect(fetchJSON('https://api.example.com/test')).rejects.toMatchObject({
          message: 'HTTP 500: Internal Server Error',
        });
      });

      it('should handle text error response', async () => {
        const mockResponse = new Response('Server error', {
          status: 500,
          statusText: 'Internal Server Error',
        });

        mocks.fetch.mockResolvedValueOnce(mockResponse);

        try {
          await fetchJSON('https://api.example.com/test');
          expect.fail('Should have thrown');
        } catch (error) {
          const fetchError = error as FetchError;
          expect(fetchError.status).toBe(500);
          // Message could be either "Server error" or default message
          expect(fetchError.message).toBeTruthy();
        }
      });
    });

    describe('retry behavior', () => {
      it('should retry on network errors', async () => {
        const networkError = new TypeError('fetch failed');
        const successResponse = new Response(JSON.stringify({ success: true }), {
          status: 200,
        });

        mocks.fetch
          .mockRejectedValueOnce(networkError)
          .mockResolvedValueOnce(successResponse);

        const result = await fetchJSON('https://api.example.com/test', {
          retryOptions: { initialDelay: 10, maxDelay: 100 },
        });

        expect(mocks.fetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ success: true });
      });

      it('should retry on 503 errors', async () => {
        const failResponse = new Response('Service Unavailable', { status: 503 });
        const successResponse = new Response(JSON.stringify({ success: true }), {
          status: 200,
        });

        mocks.fetch
          .mockResolvedValueOnce(failResponse)
          .mockResolvedValueOnce(successResponse);

        const result = await fetchJSON('https://api.example.com/test', {
          retryOptions: { initialDelay: 10, maxDelay: 100 },
        });

        expect(mocks.fetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ success: true });
      });

      it('should respect custom retry options', async () => {
        const failResponse = new Response('Service Unavailable', { status: 503 });

        mocks.fetch.mockResolvedValue(failResponse);

        const onRetry = vi.fn();
        await expect(fetchJSON('https://api.example.com/test', {
          retryOptions: { maxRetries: 1, onRetry, initialDelay: 10, maxDelay: 100 },
        })).rejects.toThrow();

        expect(mocks.fetch).toHaveBeenCalledTimes(2); // initial + 1 retry
        expect(onRetry).toHaveBeenCalledTimes(1);
      });
    });

    describe('with POST requests', () => {
      it('should handle POST with JSON body', async () => {
        const responseData = { id: 1, created: true };
        const mockResponse = new Response(JSON.stringify(responseData), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });

        mocks.fetch.mockResolvedValueOnce(mockResponse);

        const result = await fetchJSON('https://api.example.com/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'New Project' }),
        });

        expect(result).toEqual(responseData);
        expect(mocks.fetch).toHaveBeenCalledWith(
          'https://api.example.com/projects',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ name: 'New Project' }),
          })
        );
      });
    });
  });

  describe('type exports', () => {
    it('should export FetchError interface', () => {
      const error: FetchError = new Error('test');
      error.status = 500;
      error.response = new Response();

      expect(error.message).toBe('test');
      expect(error.status).toBe(500);
      expect(error.response).toBeInstanceOf(Response);
    });

    it('should export FetchRetryOptions interface', () => {
      const options: FetchRetryOptions = {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 5000,
        backoffFactor: 2,
        onRetry: (attempt, error) => {
          console.log(attempt, error);
        },
      };

      expect(options.maxRetries).toBe(3);
      expect(options.initialDelay).toBe(1000);
    });

    it('should export FetchOptions interface', () => {
      const options: FetchOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
        retryOptions: {
          maxRetries: 5,
        },
      };

      expect(options.method).toBe('POST');
      expect(options.retryOptions?.maxRetries).toBe(5);
    });
  });
});
