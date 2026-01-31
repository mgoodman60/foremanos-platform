import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Redis module with vi.hoisted
const mockRedis = vi.hoisted(() => ({
  incrementCounter: vi.fn(),
  getCounter: vi.fn(),
  isRedisAvailable: vi.fn(),
}));

vi.mock('@/lib/redis', () => mockRedis);

// Import after mocks
import {
  checkRateLimit,
  getRateLimitStatus,
  getRateLimitIdentifier,
  getClientIp,
  createRateLimitHeaders,
  RATE_LIMITS,
} from '@/lib/rate-limiter';

describe('Rate Limiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('RATE_LIMITS constants', () => {
    it('should have correct CHAT limits', () => {
      expect(RATE_LIMITS.CHAT.maxRequests).toBe(20);
      expect(RATE_LIMITS.CHAT.windowSeconds).toBe(60);
    });

    it('should have correct UPLOAD limits', () => {
      expect(RATE_LIMITS.UPLOAD.maxRequests).toBe(10);
      expect(RATE_LIMITS.UPLOAD.windowSeconds).toBe(60);
    });

    it('should have correct API limits', () => {
      expect(RATE_LIMITS.API.maxRequests).toBe(60);
      expect(RATE_LIMITS.API.windowSeconds).toBe(60);
    });

    it('should have correct AUTH limits', () => {
      expect(RATE_LIMITS.AUTH.maxRequests).toBe(5);
      expect(RATE_LIMITS.AUTH.windowSeconds).toBe(300);
    });
  });

  describe('checkRateLimit with Redis', () => {
    it('should allow request when under limit', async () => {
      mockRedis.isRedisAvailable.mockReturnValue(true);
      mockRedis.incrementCounter.mockResolvedValue(5);

      const result = await checkRateLimit('user:123', RATE_LIMITS.CHAT);

      expect(result.success).toBe(true);
      expect(result.limit).toBe(20);
      expect(result.remaining).toBe(15);
      expect(result.retryAfter).toBeUndefined();
    });

    it('should block request when at limit', async () => {
      mockRedis.isRedisAvailable.mockReturnValue(true);
      mockRedis.incrementCounter.mockResolvedValue(21);

      const result = await checkRateLimit('user:123', RATE_LIMITS.CHAT);

      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBe(60);
    });

    it('should return remaining=0 when exactly at limit', async () => {
      mockRedis.isRedisAvailable.mockReturnValue(true);
      mockRedis.incrementCounter.mockResolvedValue(20);

      const result = await checkRateLimit('user:123', RATE_LIMITS.CHAT);

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('should include reset timestamp', async () => {
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
      mockRedis.isRedisAvailable.mockReturnValue(true);
      mockRedis.incrementCounter.mockResolvedValue(1);

      const result = await checkRateLimit('user:123', RATE_LIMITS.CHAT);

      // Reset should be 60 seconds in the future
      const expectedReset = Math.floor(Date.now() / 1000) + 60;
      expect(result.reset).toBe(expectedReset);
    });
  });

  describe('checkRateLimit with in-memory fallback', () => {
    it('should fall back to in-memory when Redis unavailable', async () => {
      mockRedis.isRedisAvailable.mockReturnValue(false);

      const result = await checkRateLimit('user:456', RATE_LIMITS.CHAT);

      expect(result.success).toBe(true);
      expect(result.limit).toBe(20);
      expect(result.remaining).toBe(19);
    });

    it('should fall back to in-memory when Redis returns null', async () => {
      mockRedis.isRedisAvailable.mockReturnValue(true);
      mockRedis.incrementCounter.mockResolvedValue(null);

      const result = await checkRateLimit('user:789', RATE_LIMITS.CHAT);

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(19);
    });

    it('should fall back to in-memory when Redis throws error', async () => {
      mockRedis.isRedisAvailable.mockReturnValue(true);
      mockRedis.incrementCounter.mockRejectedValue(new Error('Redis connection failed'));

      const result = await checkRateLimit('user:error', RATE_LIMITS.CHAT);

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(19);
    });

    it('should track rate limit across multiple requests', async () => {
      mockRedis.isRedisAvailable.mockReturnValue(false);
      const identifier = 'user:multi';

      // First request
      const result1 = await checkRateLimit(identifier, RATE_LIMITS.AUTH);
      expect(result1.success).toBe(true);
      expect(result1.remaining).toBe(4);

      // Second request
      const result2 = await checkRateLimit(identifier, RATE_LIMITS.AUTH);
      expect(result2.success).toBe(true);
      expect(result2.remaining).toBe(3);

      // Third request
      const result3 = await checkRateLimit(identifier, RATE_LIMITS.AUTH);
      expect(result3.success).toBe(true);
      expect(result3.remaining).toBe(2);
    });

    it('should block when in-memory limit exceeded', async () => {
      mockRedis.isRedisAvailable.mockReturnValue(false);
      const identifier = 'user:block';

      // Exhaust the limit (5 requests for AUTH)
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(identifier, RATE_LIMITS.AUTH);
      }

      // Sixth request should be blocked
      const result = await checkRateLimit(identifier, RATE_LIMITS.AUTH);
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should reset after window expires', async () => {
      mockRedis.isRedisAvailable.mockReturnValue(false);
      const identifier = 'user:reset';

      // Make a request
      await checkRateLimit(identifier, RATE_LIMITS.AUTH);

      // Advance time past the window (300 seconds for AUTH)
      vi.advanceTimersByTime(301 * 1000);

      // Next request should be fresh
      const result = await checkRateLimit(identifier, RATE_LIMITS.AUTH);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4); // 5 - 1
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return current status without incrementing (Redis)', async () => {
      mockRedis.isRedisAvailable.mockReturnValue(true);
      mockRedis.getCounter.mockResolvedValue(10);

      const result = await getRateLimitStatus('user:status', RATE_LIMITS.CHAT);

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(10);
      expect(result.limit).toBe(20);
    });

    it('should indicate blocked status when at limit', async () => {
      mockRedis.isRedisAvailable.mockReturnValue(true);
      mockRedis.getCounter.mockResolvedValue(20);

      const result = await getRateLimitStatus('user:atLimit', RATE_LIMITS.CHAT);

      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should return full quota when no data in Redis', async () => {
      mockRedis.isRedisAvailable.mockReturnValue(true);
      mockRedis.getCounter.mockResolvedValue(null);

      const result = await getRateLimitStatus('user:new', RATE_LIMITS.CHAT);

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(20);
    });

    it('should fall back to in-memory when Redis fails', async () => {
      mockRedis.isRedisAvailable.mockReturnValue(true);
      mockRedis.getCounter.mockRejectedValue(new Error('Redis error'));

      const result = await getRateLimitStatus('user:fallback', RATE_LIMITS.CHAT);

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(20);
    });
  });

  describe('getRateLimitIdentifier', () => {
    it('should prefer user ID when available', () => {
      const identifier = getRateLimitIdentifier('user-123', '192.168.1.1');
      expect(identifier).toBe('user:user-123');
    });

    it('should fall back to IP when no user ID', () => {
      const identifier = getRateLimitIdentifier(null, '192.168.1.1');
      expect(identifier).toBe('ip:192.168.1.1');
    });

    it('should return anonymous when no user or IP', () => {
      const identifier = getRateLimitIdentifier(null, null);
      expect(identifier).toBe('anonymous');
    });

    it('should handle empty string user ID as falsy', () => {
      const identifier = getRateLimitIdentifier('', '192.168.1.1');
      expect(identifier).toBe('ip:192.168.1.1');
    });
  });

  describe('getClientIp', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const request = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '1.2.3.4' },
      });

      const ip = getClientIp(request);
      expect(ip).toBe('1.2.3.4');
    });

    it('should extract first IP from comma-separated x-forwarded-for', () => {
      const request = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12' },
      });

      const ip = getClientIp(request);
      expect(ip).toBe('1.2.3.4');
    });

    it('should trim whitespace from IP', () => {
      const request = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '  1.2.3.4  ' },
      });

      const ip = getClientIp(request);
      expect(ip).toBe('1.2.3.4');
    });

    it('should extract IP from x-real-ip header', () => {
      const request = new Request('http://localhost', {
        headers: { 'x-real-ip': '10.0.0.1' },
      });

      const ip = getClientIp(request);
      expect(ip).toBe('10.0.0.1');
    });

    it('should extract IP from cf-connecting-ip header (Cloudflare)', () => {
      const request = new Request('http://localhost', {
        headers: { 'cf-connecting-ip': '203.0.113.50' },
      });

      const ip = getClientIp(request);
      expect(ip).toBe('203.0.113.50');
    });

    it('should prefer x-forwarded-for over other headers', () => {
      const request = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '1.1.1.1',
          'x-real-ip': '2.2.2.2',
          'cf-connecting-ip': '3.3.3.3',
        },
      });

      const ip = getClientIp(request);
      expect(ip).toBe('1.1.1.1');
    });

    it('should return null when no IP headers present', () => {
      const request = new Request('http://localhost');

      const ip = getClientIp(request);
      expect(ip).toBeNull();
    });
  });

  describe('createRateLimitHeaders', () => {
    it('should create standard rate limit headers', () => {
      const result = {
        success: true,
        limit: 100,
        remaining: 75,
        reset: 1705320060,
      };

      const headers = createRateLimitHeaders(result);

      expect(headers['X-RateLimit-Limit']).toBe('100');
      expect(headers['X-RateLimit-Remaining']).toBe('75');
      expect(headers['X-RateLimit-Reset']).toBe('1705320060');
    });

    it('should include Retry-After when present', () => {
      const result = {
        success: false,
        limit: 20,
        remaining: 0,
        reset: 1705320060,
        retryAfter: 45,
      };

      const headers = createRateLimitHeaders(result);

      expect(headers['Retry-After']).toBe('45');
    });

    it('should not include Retry-After when not present', () => {
      const result = {
        success: true,
        limit: 20,
        remaining: 10,
        reset: 1705320060,
      };

      const headers = createRateLimitHeaders(result);

      expect(headers['Retry-After']).toBeUndefined();
    });
  });
});
