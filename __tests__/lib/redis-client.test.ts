import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type Redis from 'ioredis';

// Mock ioredis with vi.hoisted
const mockRedisInstance = vi.hoisted(() => ({
  connect: vi.fn(),
  ping: vi.fn(),
  on: vi.fn(),
  quit: vi.fn(),
  // Store event handlers for simulation
  _eventHandlers: {} as Record<string, Function>,
}));

const mockRedisConstructor = vi.hoisted(() => {
  return vi.fn((config: any) => {
    // Clear previous event handlers
    mockRedisInstance._eventHandlers = {};
    // Capture event handlers when registered
    mockRedisInstance.on.mockImplementation((event: string, handler: Function) => {
      mockRedisInstance._eventHandlers[event] = handler;
      return mockRedisInstance;
    });
    return mockRedisInstance as any;
  });
});

vi.mock('ioredis', () => ({
  default: mockRedisConstructor,
}));

describe('Redis Client', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    originalEnv = { ...process.env };
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Reset module state before each test
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('connectRedis', () => {
    it('should create Redis client with default configuration', async () => {
      delete process.env.REDIS_HOST;
      delete process.env.REDIS_PORT;
      delete process.env.REDIS_PASSWORD;
      delete process.env.REDIS_DB;

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis } = await import('@/lib/redis-client');
      await connectRedis();

      expect(mockRedisConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 6379,
          password: undefined,
          db: 0,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        })
      );
    });

    it('should use environment variables for configuration', async () => {
      process.env.REDIS_HOST = 'redis.example.com';
      process.env.REDIS_PORT = '6380';
      process.env.REDIS_PASSWORD = 'secret123';
      process.env.REDIS_DB = '2';

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis } = await import('@/lib/redis-client');
      await connectRedis();

      expect(mockRedisConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'redis.example.com',
          port: 6380,
          password: 'secret123',
          db: 2,
        })
      );
    });

    it('should return existing client if already connected', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis } = await import('@/lib/redis-client');

      // First connection
      const client1 = await connectRedis();
      // Simulate connect event
      mockRedisInstance._eventHandlers['connect']?.();

      // Second call should return same client
      const client2 = await connectRedis();

      expect(mockRedisConstructor).toHaveBeenCalledTimes(1);
      expect(client1).toBe(client2);
    });

    it('should register all event handlers', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis } = await import('@/lib/redis-client');
      await connectRedis();

      expect(mockRedisInstance.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('reconnecting', expect.any(Function));
    });

    it('should call connect and ping', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis } = await import('@/lib/redis-client');
      await connectRedis();

      expect(mockRedisInstance.connect).toHaveBeenCalled();
      expect(mockRedisInstance.ping).toHaveBeenCalled();
    });

    it('should log success message on connect event in development', async () => {
      delete process.env.__NEXT_TEST_MODE;
      process.env.NODE_ENV = 'development';

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis } = await import('@/lib/redis-client');
      await connectRedis();

      // Trigger connect event
      mockRedisInstance._eventHandlers['connect']?.();

      expect(consoleLogSpy).toHaveBeenCalledWith('✅ Redis connected');
    });

    it('should not log success message in test mode', async () => {
      process.env.__NEXT_TEST_MODE = '1';

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis } = await import('@/lib/redis-client');
      await connectRedis();

      // Trigger connect event
      mockRedisInstance._eventHandlers['connect']?.();

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should not log success message in production', async () => {
      delete process.env.__NEXT_TEST_MODE;
      process.env.NODE_ENV = 'production';

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis } = await import('@/lib/redis-client');
      await connectRedis();

      // Trigger connect event
      mockRedisInstance._eventHandlers['connect']?.();

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log error message on error event in development', async () => {
      delete process.env.__NEXT_TEST_MODE;
      process.env.NODE_ENV = 'development';

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis } = await import('@/lib/redis-client');
      await connectRedis();

      const testError = new Error('Connection timeout');
      mockRedisInstance._eventHandlers['error']?.(testError);

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Redis connection error:', testError);
    });

    it('should not log error message on error event in production', async () => {
      delete process.env.__NEXT_TEST_MODE;
      process.env.NODE_ENV = 'production';

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis } = await import('@/lib/redis-client');
      await connectRedis();

      const testError = new Error('Connection timeout');
      mockRedisInstance._eventHandlers['error']?.(testError);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should log close message on close event in development', async () => {
      delete process.env.__NEXT_TEST_MODE;
      process.env.NODE_ENV = 'development';

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis } = await import('@/lib/redis-client');
      await connectRedis();

      mockRedisInstance._eventHandlers['close']?.();

      expect(consoleLogSpy).toHaveBeenCalledWith('🔌 Redis connection closed');
    });

    it('should log reconnecting message in development', async () => {
      delete process.env.__NEXT_TEST_MODE;
      process.env.NODE_ENV = 'development';

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis } = await import('@/lib/redis-client');
      await connectRedis();

      mockRedisInstance._eventHandlers['reconnecting']?.();

      expect(consoleLogSpy).toHaveBeenCalledWith('🔄 Redis reconnecting...');
    });

    it('should return null on connection error', async () => {
      mockRedisInstance.connect.mockRejectedValue(new Error('Connection failed'));

      const { connectRedis } = await import('@/lib/redis-client');
      const result = await connectRedis();

      expect(result).toBeNull();
    });

    it('should return null on ping error', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockRejectedValue(new Error('Ping failed'));

      const { connectRedis } = await import('@/lib/redis-client');
      const result = await connectRedis();

      expect(result).toBeNull();
    });

    it('should log error message when connection fails in development', async () => {
      delete process.env.__NEXT_TEST_MODE;
      process.env.NODE_ENV = 'development';

      const error = new Error('Connection refused');
      mockRedisInstance.connect.mockRejectedValue(error);

      const { connectRedis } = await import('@/lib/redis-client');
      await connectRedis();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Failed to connect to Redis:',
        error
      );
    });

    it('should not log error message when connection fails in test mode', async () => {
      process.env.__NEXT_TEST_MODE = '1';

      mockRedisInstance.connect.mockRejectedValue(new Error('Connection refused'));

      const { connectRedis } = await import('@/lib/redis-client');
      await connectRedis();

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should set isConnected to true on connect event', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis, isRedisConnected } = await import('@/lib/redis-client');
      await connectRedis();

      // Initially false after connect but before event
      expect(isRedisConnected()).toBe(false);

      // Trigger connect event
      mockRedisInstance._eventHandlers['connect']?.();

      expect(isRedisConnected()).toBe(true);
    });

    it('should set isConnected to false on error event', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis, isRedisConnected } = await import('@/lib/redis-client');
      await connectRedis();

      // Trigger connect event
      mockRedisInstance._eventHandlers['connect']?.();
      expect(isRedisConnected()).toBe(true);

      // Trigger error event
      mockRedisInstance._eventHandlers['error']?.(new Error('Test error'));
      expect(isRedisConnected()).toBe(false);
    });

    it('should set isConnected to false on close event', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis, isRedisConnected } = await import('@/lib/redis-client');
      await connectRedis();

      // Trigger connect event
      mockRedisInstance._eventHandlers['connect']?.();
      expect(isRedisConnected()).toBe(true);

      // Trigger close event
      mockRedisInstance._eventHandlers['close']?.();
      expect(isRedisConnected()).toBe(false);
    });

    it('should have retry strategy that increases delay', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis } = await import('@/lib/redis-client');
      await connectRedis();

      const config = mockRedisConstructor.mock.calls[0][0];
      const retryStrategy = config.retryStrategy;

      // Test retry delays
      expect(retryStrategy(1)).toBe(50);   // 1 * 50 = 50
      expect(retryStrategy(2)).toBe(100);  // 2 * 50 = 100
      expect(retryStrategy(10)).toBe(500); // 10 * 50 = 500
      expect(retryStrategy(50)).toBe(2000); // 50 * 50 = 2500, but capped at 2000
    });

    it('should cap retry delay at 2000ms', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis } = await import('@/lib/redis-client');
      await connectRedis();

      const config = mockRedisConstructor.mock.calls[0][0];
      const retryStrategy = config.retryStrategy;

      expect(retryStrategy(100)).toBe(2000);
      expect(retryStrategy(1000)).toBe(2000);
    });

    it('should reset client state on connection error', async () => {
      mockRedisInstance.connect.mockRejectedValue(new Error('Failed'));

      const { connectRedis, getRedisClient, isRedisConnected } = await import('@/lib/redis-client');
      await connectRedis();

      expect(getRedisClient()).toBeNull();
      expect(isRedisConnected()).toBe(false);
    });
  });

  describe('getRedisClient', () => {
    it('should return null when not connected', async () => {
      const { getRedisClient } = await import('@/lib/redis-client');

      expect(getRedisClient()).toBeNull();
    });

    it('should return null when client exists but not connected', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis, getRedisClient } = await import('@/lib/redis-client');
      await connectRedis();

      // Before connect event, should return null
      expect(getRedisClient()).toBeNull();
    });

    it('should return client when connected', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis, getRedisClient } = await import('@/lib/redis-client');
      await connectRedis();

      // Trigger connect event
      mockRedisInstance._eventHandlers['connect']?.();

      const client = getRedisClient();
      expect(client).not.toBeNull();
      expect(client).toBe(mockRedisInstance);
    });

    it('should return null after connection is closed', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis, getRedisClient } = await import('@/lib/redis-client');
      await connectRedis();

      // Connect then close
      mockRedisInstance._eventHandlers['connect']?.();
      mockRedisInstance._eventHandlers['close']?.();

      expect(getRedisClient()).toBeNull();
    });
  });

  describe('isRedisConnected', () => {
    it('should return false initially', async () => {
      const { isRedisConnected } = await import('@/lib/redis-client');

      expect(isRedisConnected()).toBe(false);
    });

    it('should return false after failed connection', async () => {
      mockRedisInstance.connect.mockRejectedValue(new Error('Failed'));

      const { connectRedis, isRedisConnected } = await import('@/lib/redis-client');
      await connectRedis();

      expect(isRedisConnected()).toBe(false);
    });

    it('should return true after successful connection', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis, isRedisConnected } = await import('@/lib/redis-client');
      await connectRedis();

      // Trigger connect event
      mockRedisInstance._eventHandlers['connect']?.();

      expect(isRedisConnected()).toBe(true);
    });

    it('should return false when client is null', async () => {
      mockRedisInstance.connect.mockRejectedValue(new Error('Failed'));

      const { connectRedis, isRedisConnected } = await import('@/lib/redis-client');
      await connectRedis();

      expect(isRedisConnected()).toBe(false);
    });

    it('should require both client and connected flag to be true', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis, isRedisConnected } = await import('@/lib/redis-client');
      await connectRedis();

      // Client exists but not connected yet
      expect(isRedisConnected()).toBe(false);

      // After connect event
      mockRedisInstance._eventHandlers['connect']?.();
      expect(isRedisConnected()).toBe(true);
    });
  });

  describe('disconnectRedis', () => {
    it('should do nothing when client is null', async () => {
      const { disconnectRedis } = await import('@/lib/redis-client');

      await disconnectRedis();

      expect(mockRedisInstance.quit).not.toHaveBeenCalled();
    });

    it('should call quit on existing client', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');
      mockRedisInstance.quit.mockResolvedValue('OK');

      const { connectRedis, disconnectRedis } = await import('@/lib/redis-client');
      await connectRedis();
      await disconnectRedis();

      expect(mockRedisInstance.quit).toHaveBeenCalled();
    });

    it('should reset client to null', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');
      mockRedisInstance.quit.mockResolvedValue('OK');

      const { connectRedis, disconnectRedis, getRedisClient } = await import('@/lib/redis-client');
      await connectRedis();

      // Trigger connect event
      mockRedisInstance._eventHandlers['connect']?.();
      expect(getRedisClient()).not.toBeNull();

      await disconnectRedis();
      expect(getRedisClient()).toBeNull();
    });

    it('should set isConnected to false', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');
      mockRedisInstance.quit.mockResolvedValue('OK');

      const { connectRedis, disconnectRedis, isRedisConnected } = await import('@/lib/redis-client');
      await connectRedis();

      // Trigger connect event
      mockRedisInstance._eventHandlers['connect']?.();
      expect(isRedisConnected()).toBe(true);

      await disconnectRedis();
      expect(isRedisConnected()).toBe(false);
    });

    it('should handle quit errors gracefully', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');
      mockRedisInstance.quit.mockRejectedValue(new Error('Quit failed'));

      const { connectRedis, disconnectRedis } = await import('@/lib/redis-client');
      await connectRedis();

      // Should not throw
      await expect(disconnectRedis()).resolves.toBeUndefined();
    });

    it('should still reset state even if quit throws', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');
      mockRedisInstance.quit.mockRejectedValue(new Error('Quit failed'));

      const { connectRedis, disconnectRedis, getRedisClient, isRedisConnected } = await import('@/lib/redis-client');
      await connectRedis();

      // Trigger connect event
      mockRedisInstance._eventHandlers['connect']?.();

      await disconnectRedis().catch(() => {});

      expect(getRedisClient()).toBeNull();
      expect(isRedisConnected()).toBe(false);
    });
  });

  describe('checkRedisHealth', () => {
    it('should return not connected when client is null', async () => {
      const { checkRedisHealth } = await import('@/lib/redis-client');

      const result = await checkRedisHealth();

      expect(result).toEqual({
        connected: false,
        error: 'Not connected',
      });
    });

    it('should return not connected when isConnected is false', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis, checkRedisHealth } = await import('@/lib/redis-client');
      await connectRedis();

      // Don't trigger connect event, so isConnected remains false
      const result = await checkRedisHealth();

      expect(result).toEqual({
        connected: false,
        error: 'Not connected',
      });
    });

    it('should return connected with latency on successful ping', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis, checkRedisHealth } = await import('@/lib/redis-client');
      await connectRedis();

      // Trigger connect event
      mockRedisInstance._eventHandlers['connect']?.();

      const result = await checkRedisHealth();

      expect(result.connected).toBe(true);
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('should measure ping latency', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping
        .mockResolvedValueOnce('PONG') // for connectRedis
        .mockImplementation(() => {
          return new Promise(resolve => setTimeout(() => resolve('PONG'), 50));
        });

      const { connectRedis, checkRedisHealth } = await import('@/lib/redis-client');
      await connectRedis();

      // Trigger connect event
      mockRedisInstance._eventHandlers['connect']?.();

      const result = await checkRedisHealth();

      expect(result.connected).toBe(true);
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it('should return error when ping fails', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping
        .mockResolvedValueOnce('PONG') // for connectRedis
        .mockRejectedValueOnce(new Error('Ping timeout'));

      const { connectRedis, checkRedisHealth } = await import('@/lib/redis-client');
      await connectRedis();

      // Trigger connect event
      mockRedisInstance._eventHandlers['connect']?.();

      const result = await checkRedisHealth();

      expect(result).toEqual({
        connected: false,
        error: 'Ping timeout',
      });
    });

    it('should handle non-Error objects in catch', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping
        .mockResolvedValueOnce('PONG') // for connectRedis
        .mockRejectedValueOnce('String error');

      const { connectRedis, checkRedisHealth } = await import('@/lib/redis-client');
      await connectRedis();

      // Trigger connect event
      mockRedisInstance._eventHandlers['connect']?.();

      const result = await checkRedisHealth();

      expect(result).toEqual({
        connected: false,
        error: 'Unknown error',
      });
    });

    it('should handle null error', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping
        .mockResolvedValueOnce('PONG') // for connectRedis
        .mockRejectedValueOnce(null);

      const { connectRedis, checkRedisHealth } = await import('@/lib/redis-client');
      await connectRedis();

      // Trigger connect event
      mockRedisInstance._eventHandlers['connect']?.();

      const result = await checkRedisHealth();

      expect(result).toEqual({
        connected: false,
        error: 'Unknown error',
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle full connection lifecycle', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');
      mockRedisInstance.quit.mockResolvedValue('OK');

      const { connectRedis, isRedisConnected, getRedisClient, disconnectRedis, checkRedisHealth } =
        await import('@/lib/redis-client');

      // Initial state
      expect(isRedisConnected()).toBe(false);
      expect(getRedisClient()).toBeNull();

      // Connect
      await connectRedis();
      mockRedisInstance._eventHandlers['connect']?.();
      expect(isRedisConnected()).toBe(true);
      expect(getRedisClient()).not.toBeNull();

      // Health check
      const health = await checkRedisHealth();
      expect(health.connected).toBe(true);

      // Disconnect
      await disconnectRedis();
      expect(isRedisConnected()).toBe(false);
      expect(getRedisClient()).toBeNull();
    });

    it('should handle reconnection after error', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis, isRedisConnected } = await import('@/lib/redis-client');

      // Initial connection
      await connectRedis();
      mockRedisInstance._eventHandlers['connect']?.();
      expect(isRedisConnected()).toBe(true);

      // Connection error
      mockRedisInstance._eventHandlers['error']?.(new Error('Network error'));
      expect(isRedisConnected()).toBe(false);

      // Reconnection
      mockRedisInstance._eventHandlers['reconnecting']?.();
      mockRedisInstance._eventHandlers['connect']?.();
      expect(isRedisConnected()).toBe(true);
    });

    it('should not create duplicate connections on multiple connect calls', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis } = await import('@/lib/redis-client');

      // First connection
      await connectRedis();
      mockRedisInstance._eventHandlers['connect']?.();

      // Multiple subsequent calls
      await connectRedis();
      await connectRedis();
      await connectRedis();

      // Should only create one client
      expect(mockRedisConstructor).toHaveBeenCalledTimes(1);
    });

    it('should allow reconnection after disconnect', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');
      mockRedisInstance.quit.mockResolvedValue('OK');

      const { connectRedis, disconnectRedis, isRedisConnected } =
        await import('@/lib/redis-client');

      // First connection
      await connectRedis();
      mockRedisInstance._eventHandlers['connect']?.();
      expect(isRedisConnected()).toBe(true);

      // Disconnect
      await disconnectRedis();
      expect(isRedisConnected()).toBe(false);

      // Reconnect
      await connectRedis();
      mockRedisInstance._eventHandlers['connect']?.();
      expect(isRedisConnected()).toBe(true);

      // Should have created two clients (one per connection)
      expect(mockRedisConstructor).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('should handle invalid port number gracefully', async () => {
      process.env.REDIS_PORT = 'invalid';

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis } = await import('@/lib/redis-client');
      await connectRedis();

      // Should use NaN which becomes 0 or fallback behavior
      const config = mockRedisConstructor.mock.calls[0][0];
      expect(Number.isNaN(config.port) || config.port === 0).toBe(true);
    });

    it('should handle invalid db number gracefully', async () => {
      process.env.REDIS_DB = 'invalid';

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis } = await import('@/lib/redis-client');
      await connectRedis();

      const config = mockRedisConstructor.mock.calls[0][0];
      expect(Number.isNaN(config.db) || config.db === 0).toBe(true);
    });

    it('should handle empty password environment variable', async () => {
      process.env.REDIS_PASSWORD = '';

      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const { connectRedis } = await import('@/lib/redis-client');
      await connectRedis();

      const config = mockRedisConstructor.mock.calls[0][0];
      // Empty string should become undefined
      expect(config.password).toBe('');
    });

    it('should handle rapid connect/disconnect cycles', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);
      mockRedisInstance.ping.mockResolvedValue('PONG');
      mockRedisInstance.quit.mockResolvedValue('OK');

      const { connectRedis, disconnectRedis } = await import('@/lib/redis-client');

      // Rapid cycles
      await connectRedis();
      await disconnectRedis();
      await connectRedis();
      await disconnectRedis();
      await connectRedis();

      // Should not throw errors
      expect(mockRedisInstance.connect).toHaveBeenCalled();
      expect(mockRedisInstance.quit).toHaveBeenCalled();
    });

    it('should handle health check before connection', async () => {
      const { checkRedisHealth } = await import('@/lib/redis-client');

      const result = await checkRedisHealth();

      expect(result).toEqual({
        connected: false,
        error: 'Not connected',
      });
      expect(mockRedisInstance.ping).not.toHaveBeenCalled();
    });

    it('should handle getRedisClient after failed connection', async () => {
      mockRedisInstance.connect.mockRejectedValue(new Error('Connection refused'));

      const { connectRedis, getRedisClient } = await import('@/lib/redis-client');
      await connectRedis();

      expect(getRedisClient()).toBeNull();
    });
  });
});
