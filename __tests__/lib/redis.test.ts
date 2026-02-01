import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type Redis from 'ioredis';

// Mock ioredis module with vi.hoisted
const mockRedisInstance = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  quit: vi.fn(),
  on: vi.fn(),
}));

const mockRedisConstructor = vi.hoisted(() => vi.fn(() => mockRedisInstance));

vi.mock('ioredis', () => ({
  default: mockRedisConstructor,
}));

describe('Redis Client', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = { ...process.env };
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Reset module state
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('Redis client initialization', () => {
    it('should warn when REDIS_URL is not configured', async () => {
      delete process.env.REDIS_URL;

      const { isRedisAvailable } = await import('@/lib/redis');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '⚠️  REDIS_URL not configured - running without Redis caching'
      );
      expect(isRedisAvailable()).toBe(false);
    });

    it('should create Redis client when REDIS_URL is configured', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      await import('@/lib/redis');

      expect(mockRedisConstructor).toHaveBeenCalledWith(
        'redis://localhost:6379',
        expect.objectContaining({
          maxRetriesPerRequest: 3,
          enableOfflineQueue: false,
          lazyConnect: true,
        })
      );
    });

    it('should register error event handler', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      await import('@/lib/redis');

      expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should register connect event handler', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      await import('@/lib/redis');

      expect(mockRedisInstance.on).toHaveBeenCalledWith('connect', expect.any(Function));
    });

    it('should handle Redis client creation errors gracefully', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisConstructor.mockImplementationOnce(() => {
        throw new Error('Connection failed');
      });

      const { isRedisAvailable } = await import('@/lib/redis');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Failed to create Redis client:',
        expect.any(Error)
      );
      expect(isRedisAvailable()).toBe(false);
    });
  });

  describe('isRedisAvailable', () => {
    it('should return false when Redis is not configured', async () => {
      delete process.env.REDIS_URL;

      const { isRedisAvailable } = await import('@/lib/redis');

      expect(isRedisAvailable()).toBe(false);
    });

    it('should return false initially when Redis is configured but not connected', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      const { isRedisAvailable } = await import('@/lib/redis');

      // Initially false until connection event fires
      expect(isRedisAvailable()).toBe(false);
    });
  });

  describe('getCached', () => {
    it('should return null when Redis is unavailable', async () => {
      delete process.env.REDIS_URL;

      const { getCached } = await import('@/lib/redis');
      const result = await getCached('test-key');

      expect(result).toBeNull();
      expect(mockRedisInstance.get).not.toHaveBeenCalled();
    });

    it('should return null when key does not exist', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.get.mockResolvedValue(null);

      // Simulate Redis being available
      const redisModule = await import('@/lib/redis');
      const eventHandlers = mockRedisInstance.on.mock.calls;
      const readyHandler = eventHandlers.find(([event]) => event === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const result = await redisModule.getCached('nonexistent-key');

      expect(result).toBeNull();
      expect(mockRedisInstance.get).toHaveBeenCalledWith('nonexistent-key');
    });

    it('should return parsed JSON value when key exists', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const testData = { foo: 'bar', count: 42 };
      mockRedisInstance.get.mockResolvedValue(JSON.stringify(testData));

      const redisModule = await import('@/lib/redis');
      const eventHandlers = mockRedisInstance.on.mock.calls;
      const readyHandler = eventHandlers.find(([event]) => event === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const result = await redisModule.getCached<typeof testData>('test-key');

      expect(result).toEqual(testData);
      expect(mockRedisInstance.get).toHaveBeenCalledWith('test-key');
    });

    it('should handle Redis GET errors gracefully', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.get.mockRejectedValue(new Error('Connection timeout'));

      const redisModule = await import('@/lib/redis');
      const eventHandlers = mockRedisInstance.on.mock.calls;
      const readyHandler = eventHandlers.find(([event]) => event === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const result = await redisModule.getCached('test-key');

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Redis GET error for key test-key:',
        expect.any(Error)
      );
    });
  });

  describe('setCached', () => {
    it('should return false when Redis is unavailable', async () => {
      delete process.env.REDIS_URL;

      const { setCached } = await import('@/lib/redis');
      const result = await setCached('test-key', { data: 'value' });

      expect(result).toBe(false);
      expect(mockRedisInstance.setex).not.toHaveBeenCalled();
    });

    it('should set value with default TTL of 3600 seconds', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.setex.mockResolvedValue('OK');

      const redisModule = await import('@/lib/redis');
      const eventHandlers = mockRedisInstance.on.mock.calls;
      const readyHandler = eventHandlers.find(([event]) => event === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const testData = { foo: 'bar' };
      const result = await redisModule.setCached('test-key', testData);

      expect(result).toBe(true);
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'test-key',
        3600,
        JSON.stringify(testData)
      );
    });

    it('should set value with custom TTL', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.setex.mockResolvedValue('OK');

      const redisModule = await import('@/lib/redis');
      const eventHandlers = mockRedisInstance.on.mock.calls;
      const readyHandler = eventHandlers.find(([event]) => event === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const testData = { count: 123 };
      const result = await redisModule.setCached('test-key', testData, 7200);

      expect(result).toBe(true);
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'test-key',
        7200,
        JSON.stringify(testData)
      );
    });

    it('should handle Redis SET errors gracefully', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.setex.mockRejectedValue(new Error('Write failed'));

      const redisModule = await import('@/lib/redis');
      const eventHandlers = mockRedisInstance.on.mock.calls;
      const readyHandler = eventHandlers.find(([event]) => event === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const result = await redisModule.setCached('test-key', { data: 'value' });

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Redis SET error for key test-key:',
        expect.any(Error)
      );
    });
  });

  describe('deleteCached', () => {
    it('should return false when Redis is unavailable', async () => {
      delete process.env.REDIS_URL;

      const { deleteCached } = await import('@/lib/redis');
      const result = await deleteCached('test-key');

      expect(result).toBe(false);
      expect(mockRedisInstance.del).not.toHaveBeenCalled();
    });

    it('should delete key successfully', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.del.mockResolvedValue(1);

      const redisModule = await import('@/lib/redis');
      const eventHandlers = mockRedisInstance.on.mock.calls;
      const readyHandler = eventHandlers.find(([event]) => event === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const result = await redisModule.deleteCached('test-key');

      expect(result).toBe(true);
      expect(mockRedisInstance.del).toHaveBeenCalledWith('test-key');
    });

    it('should handle Redis DEL errors gracefully', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.del.mockRejectedValue(new Error('Delete failed'));

      const redisModule = await import('@/lib/redis');
      const eventHandlers = mockRedisInstance.on.mock.calls;
      const readyHandler = eventHandlers.find(([event]) => event === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const result = await redisModule.deleteCached('test-key');

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Redis DEL error for key test-key:',
        expect.any(Error)
      );
    });
  });

  describe('clearCachePattern', () => {
    it('should return 0 when Redis is unavailable', async () => {
      delete process.env.REDIS_URL;

      const { clearCachePattern } = await import('@/lib/redis');
      const result = await clearCachePattern('test:*');

      expect(result).toBe(0);
      expect(mockRedisInstance.keys).not.toHaveBeenCalled();
    });

    it('should return 0 when no keys match pattern', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.keys.mockResolvedValue([]);

      const redisModule = await import('@/lib/redis');
      const eventHandlers = mockRedisInstance.on.mock.calls;
      const readyHandler = eventHandlers.find(([event]) => event === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const result = await redisModule.clearCachePattern('nonexistent:*');

      expect(result).toBe(0);
      expect(mockRedisInstance.keys).toHaveBeenCalledWith('nonexistent:*');
      expect(mockRedisInstance.del).not.toHaveBeenCalled();
    });

    it('should delete all matching keys and return count', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const matchingKeys = ['user:1', 'user:2', 'user:3'];
      mockRedisInstance.keys.mockResolvedValue(matchingKeys);
      mockRedisInstance.del.mockResolvedValue(3);

      const redisModule = await import('@/lib/redis');
      const eventHandlers = mockRedisInstance.on.mock.calls;
      const readyHandler = eventHandlers.find(([event]) => event === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const result = await redisModule.clearCachePattern('user:*');

      expect(result).toBe(3);
      expect(mockRedisInstance.keys).toHaveBeenCalledWith('user:*');
      expect(mockRedisInstance.del).toHaveBeenCalledWith(...matchingKeys);
    });

    it('should handle Redis pattern clear errors gracefully', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.keys.mockRejectedValue(new Error('Keys scan failed'));

      const redisModule = await import('@/lib/redis');
      const eventHandlers = mockRedisInstance.on.mock.calls;
      const readyHandler = eventHandlers.find(([event]) => event === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const result = await redisModule.clearCachePattern('test:*');

      expect(result).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Redis clear pattern error for test:*:',
        expect.any(Error)
      );
    });
  });

  describe('incrementCounter', () => {
    it('should return null when Redis is unavailable', async () => {
      delete process.env.REDIS_URL;

      const { incrementCounter } = await import('@/lib/redis');
      const result = await incrementCounter('counter:test');

      expect(result).toBeNull();
      expect(mockRedisInstance.incr).not.toHaveBeenCalled();
    });

    it('should increment counter and set TTL on first increment', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.incr.mockResolvedValue(1);
      mockRedisInstance.expire.mockResolvedValue(1);

      const redisModule = await import('@/lib/redis');
      const eventHandlers = mockRedisInstance.on.mock.calls;
      const readyHandler = eventHandlers.find(([event]) => event === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const result = await redisModule.incrementCounter('counter:test', 120);

      expect(result).toBe(1);
      expect(mockRedisInstance.incr).toHaveBeenCalledWith('counter:test');
      expect(mockRedisInstance.expire).toHaveBeenCalledWith('counter:test', 120);
    });

    it('should increment counter without setting TTL on subsequent increments', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.incr.mockResolvedValue(5);

      const redisModule = await import('@/lib/redis');
      const eventHandlers = mockRedisInstance.on.mock.calls;
      const readyHandler = eventHandlers.find(([event]) => event === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const result = await redisModule.incrementCounter('counter:test', 120);

      expect(result).toBe(5);
      expect(mockRedisInstance.incr).toHaveBeenCalledWith('counter:test');
      expect(mockRedisInstance.expire).not.toHaveBeenCalled();
    });

    it('should use default TTL of 60 seconds', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.incr.mockResolvedValue(1);
      mockRedisInstance.expire.mockResolvedValue(1);

      const redisModule = await import('@/lib/redis');
      const eventHandlers = mockRedisInstance.on.mock.calls;
      const readyHandler = eventHandlers.find(([event]) => event === 'ready')?.[1];
      if (readyHandler) readyHandler();

      await redisModule.incrementCounter('counter:test');

      expect(mockRedisInstance.expire).toHaveBeenCalledWith('counter:test', 60);
    });

    it('should handle Redis INCR errors gracefully', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.incr.mockRejectedValue(new Error('Increment failed'));

      const redisModule = await import('@/lib/redis');
      const eventHandlers = mockRedisInstance.on.mock.calls;
      const readyHandler = eventHandlers.find(([event]) => event === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const result = await redisModule.incrementCounter('counter:test');

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Redis INCR error for key counter:test:',
        expect.any(Error)
      );
    });
  });

  describe('getCounter', () => {
    it('should return null when Redis is unavailable', async () => {
      delete process.env.REDIS_URL;

      const { getCounter } = await import('@/lib/redis');
      const result = await getCounter('counter:test');

      expect(result).toBeNull();
      expect(mockRedisInstance.get).not.toHaveBeenCalled();
    });

    it('should return 0 when counter does not exist', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.get.mockResolvedValue(null);

      const redisModule = await import('@/lib/redis');
      const eventHandlers = mockRedisInstance.on.mock.calls;
      const readyHandler = eventHandlers.find(([event]) => event === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const result = await redisModule.getCounter('counter:test');

      expect(result).toBe(0);
      expect(mockRedisInstance.get).toHaveBeenCalledWith('counter:test');
    });

    it('should return parsed counter value', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.get.mockResolvedValue('42');

      const redisModule = await import('@/lib/redis');
      const eventHandlers = mockRedisInstance.on.mock.calls;
      const readyHandler = eventHandlers.find(([event]) => event === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const result = await redisModule.getCounter('counter:test');

      expect(result).toBe(42);
      expect(mockRedisInstance.get).toHaveBeenCalledWith('counter:test');
    });

    it('should handle Redis GET counter errors gracefully', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.get.mockRejectedValue(new Error('Read failed'));

      const redisModule = await import('@/lib/redis');
      const eventHandlers = mockRedisInstance.on.mock.calls;
      const readyHandler = eventHandlers.find(([event]) => event === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const result = await redisModule.getCounter('counter:test');

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Redis GET counter error for key counter:test:',
        expect.any(Error)
      );
    });
  });

  describe('disconnectRedis', () => {
    it('should do nothing when Redis is not initialized', async () => {
      delete process.env.REDIS_URL;

      const { disconnectRedis } = await import('@/lib/redis');
      await disconnectRedis();

      expect(mockRedisInstance.quit).not.toHaveBeenCalled();
    });

    it('should disconnect Redis gracefully', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.quit.mockResolvedValue('OK');

      const redisModule = await import('@/lib/redis');
      await redisModule.disconnectRedis();

      expect(mockRedisInstance.quit).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ Redis disconnected gracefully');
    });

    it('should handle disconnect errors gracefully', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.quit.mockRejectedValue(new Error('Disconnect failed'));

      const redisModule = await import('@/lib/redis');
      await redisModule.disconnectRedis();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Error disconnecting Redis:',
        expect.any(Error)
      );
    });
  });
});
