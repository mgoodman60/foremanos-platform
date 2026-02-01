import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setTimeout } from 'timers/promises';

// Mock fetch globally
const fetchMock = vi.fn();
global.fetch = fetchMock;

// Mock setTimeout from timers/promises
vi.mock('timers/promises', () => ({
  setTimeout: vi.fn().mockResolvedValue(undefined),
}));

// Set environment variables before importing
process.env.ABACUSAI_API_KEY = 'test-abacus-key';

// Import after mocks are set up
import {
  callVisionAPIWithRetry,
  visionRateLimiter,
} from '@/lib/vision-api-wrapper';

describe('Vision API Wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    // Reset the setTimeout mock
    (setTimeout as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('callVisionAPIWithRetry - Success Cases', () => {
    it('should successfully call vision API with gpt-5.2 on first attempt', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [{
            message: {
              content: 'This is the extracted content from the image',
            },
          }],
        }),
      });

      const result = await callVisionAPIWithRetry(
        'base64ImageData',
        'Extract content from this image'
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('This is the extracted content from the image');
      expect(result.retriesUsed).toBe(0);
      expect(result.usedFallback).toBeUndefined();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://routellm.abacus.ai/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-abacus-key',
          },
        })
      );
    });

    it('should include image base64 data in request body', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [{ message: { content: 'content' } }],
        }),
      });

      await callVisionAPIWithRetry('testImageBase64', 'test prompt');

      const callArgs = fetchMock.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.messages[0].content[1].image_url.url).toBe('data:image/jpeg;base64,testImageBase64');
    });

    it('should use custom model when specified in options', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [{ message: { content: 'content' } }],
        }),
      });

      await callVisionAPIWithRetry('base64', 'prompt', { model: 'gpt-4o-vision' });

      const callArgs = fetchMock.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.model).toBe('gpt-4o-vision');
    });

    it('should set correct temperature and max_tokens', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [{ message: { content: 'content' } }],
        }),
      });

      await callVisionAPIWithRetry('base64', 'prompt');

      const callArgs = fetchMock.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.temperature).toBe(0.1);
      expect(body.max_tokens).toBe(4000);
    });
  });

  describe('callVisionAPIWithRetry - Cloudflare Detection', () => {
    it('should detect Cloudflare block from HTML DOCTYPE', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => '<!DOCTYPE html><html>Cloudflare protection</html>',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            choices: [{ message: { content: 'success' } }],
          }),
        });

      const result = await callVisionAPIWithRetry('base64', 'prompt', {
        maxRetries: 2,
        retryDelay: 100,
      });

      expect(result.success).toBe(true);
      expect(setTimeout).toHaveBeenCalled();
    });

    it('should detect Cloudflare block from cloudflare keyword', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => 'This page is protected by cloudflare',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            choices: [{ message: { content: 'success' } }],
          }),
        });

      const result = await callVisionAPIWithRetry('base64', 'prompt', {
        maxRetries: 2,
        retryDelay: 100,
      });

      expect(result.success).toBe(true);
    });

    it('should detect Cloudflare block from browser verification message', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => 'cf-browser-verification required',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            choices: [{ message: { content: 'success' } }],
          }),
        });

      const result = await callVisionAPIWithRetry('base64', 'prompt', {
        maxRetries: 2,
        retryDelay: 100,
      });

      expect(result.success).toBe(true);
    });

    it('should detect Cloudflare block from "Just a moment" message', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => 'Just a moment... verifying your browser',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            choices: [{ message: { content: 'success' } }],
          }),
        });

      const result = await callVisionAPIWithRetry('base64', 'prompt', {
        maxRetries: 2,
        retryDelay: 100,
      });

      expect(result.success).toBe(true);
    });

    it('should detect Cloudflare block from "Checking your browser" message', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => 'Checking your browser before accessing',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            choices: [{ message: { content: 'success' } }],
          }),
        });

      const result = await callVisionAPIWithRetry('base64', 'prompt', {
        maxRetries: 2,
        retryDelay: 100,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('callVisionAPIWithRetry - Exponential Backoff', () => {
    it('should use exponential backoff with base delay', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => '<!DOCTYPE html>Cloudflare</html>',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => '<!DOCTYPE html>Cloudflare</html>',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            choices: [{ message: { content: 'success' } }],
          }),
        });

      await callVisionAPIWithRetry('base64', 'prompt', {
        maxRetries: 3,
        retryDelay: 1000,
      });

      // First retry: 1000 * 2^0 = 1000ms
      expect(setTimeout).toHaveBeenNthCalledWith(1, 1000);
      // Second retry: 1000 * 2^1 = 2000ms
      expect(setTimeout).toHaveBeenNthCalledWith(2, 2000);
    });

    it('should cap backoff delay at 16 seconds', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => '<!DOCTYPE html>Cloudflare</html>',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => '<!DOCTYPE html>Cloudflare</html>',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => '<!DOCTYPE html>Cloudflare</html>',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => '<!DOCTYPE html>Cloudflare</html>',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => '<!DOCTYPE html>Cloudflare</html>',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            choices: [{ message: { content: 'success' } }],
          }),
        });

      await callVisionAPIWithRetry('base64', 'prompt', {
        maxRetries: 6,
        retryDelay: 1000,
      });

      // Should be capped at 16000ms (16 seconds)
      const calls = (setTimeout as any).mock.calls;
      const lastDelay = calls[calls.length - 1][0];
      expect(lastDelay).toBeLessThanOrEqual(16000);
    });

    it('should respect custom retry delay', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => '<!DOCTYPE html>Cloudflare</html>',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            choices: [{ message: { content: 'success' } }],
          }),
        });

      await callVisionAPIWithRetry('base64', 'prompt', {
        maxRetries: 2,
        retryDelay: 500,
      });

      expect(setTimeout).toHaveBeenCalledWith(500);
    });
  });

  describe('callVisionAPIWithRetry - Retry Logic', () => {
    it('should retry up to maxRetries times on Cloudflare blocks', async () => {
      for (let i = 0; i < 3; i++) {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => '<!DOCTYPE html>Cloudflare</html>',
        });
      }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [{ message: { content: 'success after retries' } }],
        }),
      });

      const result = await callVisionAPIWithRetry('base64', 'prompt', {
        maxRetries: 4,
        retryDelay: 100,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('success after retries');
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it('should retry on network errors', async () => {
      fetchMock
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            choices: [{ message: { content: 'success' } }],
          }),
        });

      const result = await callVisionAPIWithRetry('base64', 'prompt', {
        maxRetries: 2,
        retryDelay: 100,
      });

      expect(result.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should track number of retries used', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => '<!DOCTYPE html>Cloudflare</html>',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => '<!DOCTYPE html>Cloudflare</html>',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            choices: [{ message: { content: 'success' } }],
          }),
        });

      const result = await callVisionAPIWithRetry('base64', 'prompt', {
        maxRetries: 3,
        retryDelay: 100,
      });

      expect(result.success).toBe(true);
      expect(result.retriesUsed).toBe(2);
    });
  });

  describe('callVisionAPIWithRetry - Error Handling', () => {
    it('should handle invalid JSON response structure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          invalid: 'structure',
        }),
      });

      const result = await callVisionAPIWithRetry('base64', 'prompt', {
        maxRetries: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API response structure');
    });

    it('should handle missing message content', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [{ message: {} }],
        }),
      });

      const result = await callVisionAPIWithRetry('base64', 'prompt', {
        maxRetries: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API response structure');
    });

    it('should handle malformed JSON', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '{invalid json',
      });

      const result = await callVisionAPIWithRetry('base64', 'prompt', {
        maxRetries: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('JSON parse error');
    });

    it('should return error when all retries exhausted', async () => {
      for (let i = 0; i < 5; i++) {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => '<!DOCTYPE html>Cloudflare</html>',
        });
      }

      const result = await callVisionAPIWithRetry('base64', 'prompt', {
        maxRetries: 5,
        retryDelay: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cloudflare rate limit detected');
      expect(result.retriesUsed).toBe(5);
    });

    it('should handle fetch errors with proper error message', async () => {
      fetchMock.mockRejectedValue(new Error('Connection timeout'));

      const result = await callVisionAPIWithRetry('base64', 'prompt', {
        maxRetries: 1,
        retryDelay: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection timeout');
    });

    it('should handle errors without message property', async () => {
      fetchMock.mockRejectedValue('Unknown error');

      const result = await callVisionAPIWithRetry('base64', 'prompt', {
        maxRetries: 1,
        retryDelay: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('callVisionAPIWithRetry - Claude Haiku Fallback', () => {
    it('should fall back to Claude Haiku after primary model exhausts retries', async () => {
      // Primary model (gpt-5.2) fails all retries
      for (let i = 0; i < 3; i++) {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => '<!DOCTYPE html>Cloudflare</html>',
        });
      }
      // Claude Haiku succeeds
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [{ message: { content: 'Claude Haiku success' } }],
        }),
      });

      const result = await callVisionAPIWithRetry('base64', 'prompt', {
        model: 'gpt-5.2',
        maxRetries: 3,
        retryDelay: 100,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('Claude Haiku success');
      expect(result.usedFallback).toBe(true);
      expect(result.fallbackMethod).toBe('claude-haiku');
      expect(fetchMock).toHaveBeenCalledTimes(4); // 3 for primary + 1 for fallback
    });

    it('should not fall back to Claude Haiku if already using Claude Haiku', async () => {
      for (let i = 0; i < 3; i++) {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => '<!DOCTYPE html>Cloudflare</html>',
        });
      }

      const result = await callVisionAPIWithRetry('base64', 'prompt', {
        model: 'claude-haiku',
        maxRetries: 3,
        retryDelay: 100,
      });

      expect(result.success).toBe(false);
      expect(result.usedFallback).toBeUndefined();
      expect(fetchMock).toHaveBeenCalledTimes(3); // Only primary attempts, no fallback
    });

    it('should use different retry settings for Claude Haiku fallback', async () => {
      // Primary fails
      for (let i = 0; i < 2; i++) {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => '<!DOCTYPE html>Cloudflare</html>',
        });
      }
      // Fallback succeeds
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [{ message: { content: 'success' } }],
        }),
      });

      const result = await callVisionAPIWithRetry('base64', 'prompt', {
        maxRetries: 2,
        retryDelay: 1000,
      });

      expect(result.success).toBe(true);
      expect(result.usedFallback).toBe(true);
    });

    it('should return failure if both primary and fallback fail', async () => {
      // Primary fails
      for (let i = 0; i < 2; i++) {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => '<!DOCTYPE html>Cloudflare</html>',
        });
      }
      // Fallback also fails
      for (let i = 0; i < 3; i++) {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => '<!DOCTYPE html>Cloudflare</html>',
        });
      }

      const result = await callVisionAPIWithRetry('base64', 'prompt', {
        maxRetries: 2,
        retryDelay: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cloudflare rate limit detected');
    });
  });

  describe('callVisionAPIWithRetry - Default Options', () => {
    it('should use default model gpt-5.2', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [{ message: { content: 'success' } }],
        }),
      });

      await callVisionAPIWithRetry('base64', 'prompt');

      const callArgs = fetchMock.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.model).toBe('gpt-5.2');
    });

    it('should use default maxRetries of 5', async () => {
      // Mock 5 failures for primary model + 3 for fallback
      for (let i = 0; i < 8; i++) {
        fetchMock.mockRejectedValueOnce(new Error('fail'));
      }

      const result = await callVisionAPIWithRetry('base64', 'prompt');

      expect(result.success).toBe(false);
      // Should be called 5 times for primary + 3 times for claude-haiku fallback
      expect(fetchMock).toHaveBeenCalledTimes(8);
    });

    it('should use default retryDelay of 1000ms', async () => {
      fetchMock
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            choices: [{ message: { content: 'success' } }],
          }),
        });

      await callVisionAPIWithRetry('base64', 'prompt');

      expect(setTimeout).toHaveBeenCalledWith(1000);
    });
  });

  describe('VisionAPIRateLimiter', () => {
    let originalDateNow: () => number;
    let currentTime: number;

    beforeEach(() => {
      // Mock Date.now()
      currentTime = 1700000000000;
      originalDateNow = Date.now;
      Date.now = vi.fn(() => currentTime);

      // Reset the rate limiter's internal state by creating a new instance
      // We need to clear the timestamps array
      (visionRateLimiter as any).requestTimestamps = [];
    });

    afterEach(() => {
      Date.now = originalDateNow;
    });

    describe('waitIfNeeded - 1 minute window', () => {
      it('should not wait when under 1-minute limit', async () => {
        // Add 9 requests (under limit of 10)
        for (let i = 0; i < 9; i++) {
          (visionRateLimiter as any).requestTimestamps.push(currentTime - 30000);
        }

        await visionRateLimiter.waitIfNeeded();

        expect(setTimeout).not.toHaveBeenCalled();
      });

      it('should wait when 1-minute limit is reached', async () => {
        // Add 10 requests within last minute
        for (let i = 0; i < 10; i++) {
          (visionRateLimiter as any).requestTimestamps.push(currentTime - 30000);
        }

        await visionRateLimiter.waitIfNeeded();

        // Should wait until oldest request is > 60s old, plus 1s buffer
        expect(setTimeout).toHaveBeenCalled();
        const waitTime = (setTimeout as any).mock.calls[0][0];
        expect(waitTime).toBeGreaterThan(0);
      });

      it('should calculate correct wait time for 1-minute window', async () => {
        const oldestRequestTime = currentTime - 40000; // 40 seconds ago
        for (let i = 0; i < 10; i++) {
          (visionRateLimiter as any).requestTimestamps.push(oldestRequestTime);
        }

        await visionRateLimiter.waitIfNeeded();

        // Wait time = 60000 - (now - oldest) + 1000 buffer
        // = 60000 - 40000 + 1000 = 21000
        expect(setTimeout).toHaveBeenCalledWith(21000);
      });
    });

    describe('waitIfNeeded - 5 minute window', () => {
      it('should not wait when under 5-minute limit', async () => {
        // Add 39 requests (under limit of 40)
        for (let i = 0; i < 39; i++) {
          (visionRateLimiter as any).requestTimestamps.push(currentTime - 60000);
        }

        await visionRateLimiter.waitIfNeeded();

        expect(setTimeout).not.toHaveBeenCalled();
      });

      it('should wait when 5-minute limit is reached', async () => {
        // Add 40 requests within last 5 minutes
        for (let i = 0; i < 40; i++) {
          (visionRateLimiter as any).requestTimestamps.push(currentTime - 120000);
        }

        await visionRateLimiter.waitIfNeeded();

        expect(setTimeout).toHaveBeenCalled();
        const waitTime = (setTimeout as any).mock.calls[0][0];
        expect(waitTime).toBeGreaterThan(0);
      });

      it('should calculate correct wait time for 5-minute window', async () => {
        const oldestRequestTime = currentTime - 180000; // 3 minutes ago
        for (let i = 0; i < 40; i++) {
          (visionRateLimiter as any).requestTimestamps.push(oldestRequestTime);
        }

        await visionRateLimiter.waitIfNeeded();

        // Wait time = 300000 - (now - oldest) + 1000 buffer
        // = 300000 - 180000 + 1000 = 121000
        expect(setTimeout).toHaveBeenCalledWith(121000);
      });
    });

    describe('waitIfNeeded - timestamp cleanup', () => {
      it('should clean old timestamps older than 5 minutes', async () => {
        // Add old timestamps (>5 minutes old)
        (visionRateLimiter as any).requestTimestamps = [
          currentTime - 400000, // 6.67 minutes ago
          currentTime - 350000, // 5.83 minutes ago
          currentTime - 310000, // 5.17 minutes ago
        ];

        // Add recent timestamps
        (visionRateLimiter as any).requestTimestamps.push(
          currentTime - 60000,
          currentTime - 30000
        );

        await visionRateLimiter.waitIfNeeded();

        // Should have cleaned old timestamps
        const timestamps = (visionRateLimiter as any).requestTimestamps;
        expect(timestamps.length).toBeLessThan(5);
        expect(timestamps.every((ts: number) => currentTime - ts < 5 * 60 * 1000)).toBe(true);
      });
    });

    describe('waitIfNeeded - request recording', () => {
      it('should record new request timestamp', async () => {
        const initialLength = (visionRateLimiter as any).requestTimestamps.length;

        await visionRateLimiter.waitIfNeeded();

        expect((visionRateLimiter as any).requestTimestamps.length).toBe(initialLength + 1);
      });

      it('should record timestamp with current time', async () => {
        await visionRateLimiter.waitIfNeeded();

        const timestamps = (visionRateLimiter as any).requestTimestamps;
        const lastTimestamp = timestamps[timestamps.length - 1];
        expect(lastTimestamp).toBe(currentTime);
      });
    });

    describe('waitIfNeeded - edge cases', () => {
      it('should handle exactly at 1-minute limit', async () => {
        for (let i = 0; i < 10; i++) {
          (visionRateLimiter as any).requestTimestamps.push(currentTime - 59999);
        }

        await visionRateLimiter.waitIfNeeded();

        expect(setTimeout).toHaveBeenCalled();
      });

      it('should handle exactly at 5-minute limit', async () => {
        for (let i = 0; i < 40; i++) {
          (visionRateLimiter as any).requestTimestamps.push(currentTime - 299999);
        }

        await visionRateLimiter.waitIfNeeded();

        expect(setTimeout).toHaveBeenCalled();
      });

      it('should handle empty timestamp array', async () => {
        (visionRateLimiter as any).requestTimestamps = [];

        await visionRateLimiter.waitIfNeeded();

        expect(setTimeout).not.toHaveBeenCalled();
        expect((visionRateLimiter as any).requestTimestamps.length).toBe(1);
      });
    });
  });

  describe('Integration - Rate Limiter with API Calls', () => {
    it('should work together in a realistic scenario', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [{ message: { content: 'success' } }],
        }),
      });

      // Reset rate limiter
      (visionRateLimiter as any).requestTimestamps = [];

      // Make a call through the rate limiter and API wrapper
      await visionRateLimiter.waitIfNeeded();
      const result = await callVisionAPIWithRetry('base64', 'prompt');

      expect(result.success).toBe(true);
      expect((visionRateLimiter as any).requestTimestamps.length).toBe(1);
    });
  });
});
