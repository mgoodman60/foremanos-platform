import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Redis from 'ioredis';

// Mock redis-client module with vi.hoisted
const mockRedisClient = vi.hoisted(() => ({
  get: vi.fn(),
  setex: vi.fn(),
  exists: vi.fn(),
  del: vi.fn(),
  scan: vi.fn(),
  memory: vi.fn(),
}));

const mockRedisClientFunctions = vi.hoisted(() => ({
  getRedisClient: vi.fn(),
  isRedisConnected: vi.fn(),
}));

vi.mock('@/lib/redis-client', () => mockRedisClientFunctions);

// Import after mocks
import { RedisCacheAdapter, CacheStats, CacheEntry } from '@/lib/redis-cache-adapter';

describe('RedisCacheAdapter', () => {
  let adapter: RedisCacheAdapter;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Default: Redis is available and connected
    mockRedisClientFunctions.getRedisClient.mockReturnValue(mockRedisClient as unknown as Redis);
    mockRedisClientFunctions.isRedisConnected.mockReturnValue(true);

    // Create fresh adapter instance
    adapter = new RedisCacheAdapter('test-cache', 3600000);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with prefix and default TTL', () => {
      const customAdapter = new RedisCacheAdapter('custom', 7200000);

      // Test by setting a value and checking the key format
      customAdapter.set('key', 'value');

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'custom:key',
        7200,
        expect.any(String)
      );
    });

    it('should use default TTL of 3600000ms when not specified', () => {
      const defaultAdapter = new RedisCacheAdapter('default');

      defaultAdapter.set('key', 'value');

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'default:key',
        3600,
        expect.any(String)
      );
    });
  });

  describe('set', () => {
    it('should set value with default TTL', async () => {
      const value = { data: 'test' };
      mockRedisClient.setex.mockResolvedValue('OK');

      await adapter.set('mykey', value);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'test-cache:mykey',
        3600,
        expect.stringContaining('"data":"test"')
      );
    });

    it('should set value with custom TTL', async () => {
      const value = { data: 'test' };
      mockRedisClient.setex.mockResolvedValue('OK');

      await adapter.set('mykey', value, 7200000);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'test-cache:mykey',
        7200,
        expect.any(String)
      );
    });

    it('should store value with expiry and size metadata', async () => {
      const value = { count: 42 };
      mockRedisClient.setex.mockResolvedValue('OK');

      const beforeTime = Date.now();
      await adapter.set('mykey', value, 5000);
      const afterTime = Date.now();

      const [[, , serialized]] = mockRedisClient.setex.mock.calls;
      const entry: CacheEntry<typeof value> = JSON.parse(serialized);

      expect(entry.value).toEqual(value);
      expect(entry.expiresAt).toBeGreaterThanOrEqual(beforeTime + 5000);
      expect(entry.expiresAt).toBeLessThanOrEqual(afterTime + 5000);
      expect(typeof entry.size).toBe('number');
    });

    it('should silently return when Redis is not available', async () => {
      mockRedisClientFunctions.getRedisClient.mockReturnValue(null);

      await adapter.set('mykey', 'value');

      expect(mockRedisClient.setex).not.toHaveBeenCalled();
    });

    it('should silently return when Redis is not connected', async () => {
      mockRedisClientFunctions.isRedisConnected.mockReturnValue(false);

      await adapter.set('mykey', 'value');

      expect(mockRedisClient.setex).not.toHaveBeenCalled();
    });

    it('should handle Redis setex errors gracefully', async () => {
      mockRedisClient.setex.mockRejectedValue(new Error('Connection timeout'));

      await adapter.set('mykey', 'value');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Redis cache set error:',
        expect.any(Error)
      );
    });

    it('should handle complex nested objects', async () => {
      const complexValue = {
        user: { id: 1, name: 'John' },
        items: [1, 2, 3],
        metadata: { tags: ['a', 'b'] }
      };
      mockRedisClient.setex.mockResolvedValue('OK');

      await adapter.set('complex', complexValue);

      const [[, , serialized]] = mockRedisClient.setex.mock.calls;
      const entry = JSON.parse(serialized);
      expect(entry.value).toEqual(complexValue);
    });

    it('should convert TTL from milliseconds to seconds correctly', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      // 5500ms = 5.5 seconds = should ceil to 6 seconds
      await adapter.set('key', 'value', 5500);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'test-cache:key',
        6,
        expect.any(String)
      );
    });
  });

  describe('get', () => {
    it('should get value from cache', async () => {
      const value = { data: 'cached' };
      const entry: CacheEntry<typeof value> = {
        value,
        expiresAt: Date.now() + 3600000,
        size: 100,
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(entry));

      const result = await adapter.get<typeof value>('mykey');

      expect(result).toEqual(value);
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-cache:mykey');
    });

    it('should return null when key does not exist', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await adapter.get('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when Redis is not available', async () => {
      mockRedisClientFunctions.getRedisClient.mockReturnValue(null);

      const result = await adapter.get('mykey');

      expect(result).toBeNull();
      expect(mockRedisClient.get).not.toHaveBeenCalled();
    });

    it('should return null when Redis is not connected', async () => {
      mockRedisClientFunctions.isRedisConnected.mockReturnValue(false);

      const result = await adapter.get('mykey');

      expect(result).toBeNull();
    });

    it('should delete and return null for expired entries', async () => {
      const entry: CacheEntry<string> = {
        value: 'expired',
        expiresAt: Date.now() - 1000, // Expired 1 second ago
        size: 50,
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(entry));
      mockRedisClient.del.mockResolvedValue(1);

      const result = await adapter.get('expired-key');

      expect(result).toBeNull();
      expect(mockRedisClient.del).toHaveBeenCalledWith('test-cache:expired-key');
    });

    it('should handle Redis get errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Network error'));

      const result = await adapter.get('mykey');

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Redis cache get error:',
        expect.any(Error)
      );
    });

    it('should handle JSON parse errors gracefully', async () => {
      mockRedisClient.get.mockResolvedValue('invalid json{');

      const result = await adapter.get('corrupted');

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Redis cache get error:',
        expect.any(Error)
      );
    });

    it('should track cache hits correctly', async () => {
      const entry: CacheEntry<string> = {
        value: 'hit',
        expiresAt: Date.now() + 3600000,
        size: 10,
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(entry));

      await adapter.get('key1');
      await adapter.get('key2');

      const stats = await adapter.getStats();
      expect(stats.hits).toBe(2);
    });

    it('should track cache misses correctly', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      await adapter.get('miss1');
      await adapter.get('miss2');
      await adapter.get('miss3');

      const stats = await adapter.getStats();
      expect(stats.misses).toBe(3);
    });

    it('should track misses for expired entries', async () => {
      const entry: CacheEntry<string> = {
        value: 'expired',
        expiresAt: Date.now() - 1000,
        size: 10,
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(entry));
      mockRedisClient.del.mockResolvedValue(1);

      await adapter.get('expired');

      const stats = await adapter.getStats();
      expect(stats.misses).toBe(1);
    });

    it('should track misses on errors', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Error'));

      await adapter.get('error');

      const stats = await adapter.getStats();
      expect(stats.misses).toBe(1);
    });
  });

  describe('has', () => {
    it('should return true when key exists', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      const result = await adapter.has('existing-key');

      expect(result).toBe(true);
      expect(mockRedisClient.exists).toHaveBeenCalledWith('test-cache:existing-key');
    });

    it('should return false when key does not exist', async () => {
      mockRedisClient.exists.mockResolvedValue(0);

      const result = await adapter.has('nonexistent');

      expect(result).toBe(false);
    });

    it('should return false when Redis is not available', async () => {
      mockRedisClientFunctions.getRedisClient.mockReturnValue(null);

      const result = await adapter.has('mykey');

      expect(result).toBe(false);
      expect(mockRedisClient.exists).not.toHaveBeenCalled();
    });

    it('should return false when Redis is not connected', async () => {
      mockRedisClientFunctions.isRedisConnected.mockReturnValue(false);

      const result = await adapter.has('mykey');

      expect(result).toBe(false);
    });

    it('should handle Redis exists errors gracefully', async () => {
      mockRedisClient.exists.mockRejectedValue(new Error('Connection lost'));

      const result = await adapter.has('mykey');

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Redis cache has error:',
        expect.any(Error)
      );
    });
  });

  describe('delete', () => {
    it('should delete key successfully', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      const result = await adapter.delete('mykey');

      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith('test-cache:mykey');
    });

    it('should return false when key does not exist', async () => {
      mockRedisClient.del.mockResolvedValue(0);

      const result = await adapter.delete('nonexistent');

      expect(result).toBe(false);
    });

    it('should return false when Redis is not available', async () => {
      mockRedisClientFunctions.getRedisClient.mockReturnValue(null);

      const result = await adapter.delete('mykey');

      expect(result).toBe(false);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should return false when Redis is not connected', async () => {
      mockRedisClientFunctions.isRedisConnected.mockReturnValue(false);

      const result = await adapter.delete('mykey');

      expect(result).toBe(false);
    });

    it('should handle Redis delete errors gracefully', async () => {
      mockRedisClient.del.mockRejectedValue(new Error('Delete failed'));

      const result = await adapter.delete('mykey');

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Redis cache delete error:',
        expect.any(Error)
      );
    });
  });

  describe('clear', () => {
    it('should clear all keys with prefix using SCAN', async () => {
      // Simulate SCAN returning results in two iterations
      mockRedisClient.scan
        .mockResolvedValueOnce(['5', ['test-cache:key1', 'test-cache:key2']])
        .mockResolvedValueOnce(['0', ['test-cache:key3']]);
      mockRedisClient.del.mockResolvedValue(3);

      await adapter.clear();

      // Should scan with correct pattern
      expect(mockRedisClient.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'test-cache:*',
        'COUNT',
        100
      );

      // Should delete all found keys
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'test-cache:key1',
        'test-cache:key2'
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith('test-cache:key3');
    });

    it('should handle empty SCAN results', async () => {
      mockRedisClient.scan.mockResolvedValue(['0', []]);

      await adapter.clear();

      expect(mockRedisClient.scan).toHaveBeenCalled();
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should reset hits and misses stats', async () => {
      mockRedisClient.scan.mockResolvedValue(['0', []]);

      // Generate some stats first
      const entry: CacheEntry<string> = {
        value: 'test',
        expiresAt: Date.now() + 3600000,
        size: 10,
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(entry));
      await adapter.get('key1'); // Hit

      mockRedisClient.get.mockResolvedValue(null);
      await adapter.get('key2'); // Miss

      // Verify stats exist
      let stats = await adapter.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);

      // Clear cache
      await adapter.clear();

      // Stats should be reset
      stats = await adapter.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should do nothing when Redis is not available', async () => {
      mockRedisClientFunctions.getRedisClient.mockReturnValue(null);

      await adapter.clear();

      expect(mockRedisClient.scan).not.toHaveBeenCalled();
    });

    it('should do nothing when Redis is not connected', async () => {
      mockRedisClientFunctions.isRedisConnected.mockReturnValue(false);

      await adapter.clear();

      expect(mockRedisClient.scan).not.toHaveBeenCalled();
    });

    it('should handle Redis clear errors gracefully', async () => {
      mockRedisClient.scan.mockRejectedValue(new Error('Scan failed'));

      await adapter.clear();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Redis cache clear error:',
        expect.any(Error)
      );
    });

    it('should handle multiple SCAN iterations correctly', async () => {
      // Simulate paginated SCAN
      mockRedisClient.scan
        .mockResolvedValueOnce(['10', ['key1', 'key2']])
        .mockResolvedValueOnce(['20', ['key3', 'key4']])
        .mockResolvedValueOnce(['0', ['key5']]); // cursor='0' ends loop
      mockRedisClient.del.mockResolvedValue(1);

      await adapter.clear();

      expect(mockRedisClient.scan).toHaveBeenCalledTimes(3);
      expect(mockRedisClient.del).toHaveBeenCalledTimes(3);
    });
  });

  describe('invalidatePattern', () => {
    it('should invalidate keys matching regex pattern', async () => {
      mockRedisClient.scan.mockResolvedValue([
        '0',
        ['test-cache:user:1', 'test-cache:user:2', 'test-cache:other:3']
      ]);
      mockRedisClient.del.mockResolvedValue(2);

      const deleted = await adapter.invalidatePattern(/^user:/);

      expect(deleted).toBe(2);
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'test-cache:user:1',
        'test-cache:user:2'
      );
    });

    it('should return 0 when no keys match pattern', async () => {
      mockRedisClient.scan.mockResolvedValue([
        '0',
        ['test-cache:other:1', 'test-cache:other:2']
      ]);

      const deleted = await adapter.invalidatePattern(/^user:/);

      expect(deleted).toBe(0);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should correctly strip prefix before regex matching', async () => {
      // Keys from Redis include prefix, but pattern matches unprefixed part
      mockRedisClient.scan.mockResolvedValue([
        '0',
        ['test-cache:document:123', 'test-cache:user:456', 'test-cache:document:789']
      ]);
      mockRedisClient.del.mockResolvedValue(2);

      const deleted = await adapter.invalidatePattern(/^document:\d+$/);

      expect(deleted).toBe(2);
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'test-cache:document:123',
        'test-cache:document:789'
      );
    });

    it('should handle multiple SCAN iterations', async () => {
      mockRedisClient.scan
        .mockResolvedValueOnce(['5', ['test-cache:user:1', 'test-cache:user:2']])
        .mockResolvedValueOnce(['0', ['test-cache:user:3', 'test-cache:other:4']]);
      mockRedisClient.del
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);

      const deleted = await adapter.invalidatePattern(/^user:/);

      expect(deleted).toBe(3);
      expect(mockRedisClient.scan).toHaveBeenCalledTimes(2);
    });

    it('should return 0 when Redis is not available', async () => {
      mockRedisClientFunctions.getRedisClient.mockReturnValue(null);

      const deleted = await adapter.invalidatePattern(/test/);

      expect(deleted).toBe(0);
      expect(mockRedisClient.scan).not.toHaveBeenCalled();
    });

    it('should return 0 when Redis is not connected', async () => {
      mockRedisClientFunctions.isRedisConnected.mockReturnValue(false);

      const deleted = await adapter.invalidatePattern(/test/);

      expect(deleted).toBe(0);
    });

    it('should handle Redis invalidate errors gracefully', async () => {
      mockRedisClient.scan.mockRejectedValue(new Error('Scan error'));

      const deleted = await adapter.invalidatePattern(/test/);

      expect(deleted).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Redis cache invalidatePattern error:',
        expect.any(Error)
      );
    });

    it('should handle complex regex patterns', async () => {
      mockRedisClient.scan.mockResolvedValue([
        '0',
        [
          'test-cache:user:admin:123',
          'test-cache:user:client:456',
          'test-cache:project:789'
        ]
      ]);
      mockRedisClient.del.mockResolvedValue(2);

      const deleted = await adapter.invalidatePattern(/^user:(admin|client):/);

      expect(deleted).toBe(2);
    });

    it('should not delete keys when SCAN returns empty batches', async () => {
      mockRedisClient.scan
        .mockResolvedValueOnce(['5', []])
        .mockResolvedValueOnce(['0', []]);

      const deleted = await adapter.invalidatePattern(/test/);

      expect(deleted).toBe(0);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return stats with entries and size', async () => {
      mockRedisClient.scan.mockResolvedValue([
        '0',
        ['test-cache:key1', 'test-cache:key2', 'test-cache:key3']
      ]);
      mockRedisClient.memory
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(200)
        .mockResolvedValueOnce(150);

      const stats = await adapter.getStats();

      expect(stats.entries).toBe(3);
      expect(stats.size).toBe(450);
      expect(stats.evictions).toBe(0); // Redis handles internally
    });

    it('should calculate correct hit rate', async () => {
      mockRedisClient.scan.mockResolvedValue(['0', []]);

      // Generate hits and misses
      const entry: CacheEntry<string> = {
        value: 'hit',
        expiresAt: Date.now() + 3600000,
        size: 10,
      };
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify(entry))
        .mockResolvedValueOnce(JSON.stringify(entry))
        .mockResolvedValueOnce(JSON.stringify(entry))
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      // 3 hits, 2 misses
      await adapter.get('hit1');
      await adapter.get('hit2');
      await adapter.get('hit3');
      await adapter.get('miss1');
      await adapter.get('miss2');

      const stats = await adapter.getStats();

      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.6); // 3/5
    });

    it('should return 0 hit rate when no requests', async () => {
      mockRedisClient.scan.mockResolvedValue(['0', []]);

      const stats = await adapter.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('should handle SCAN pagination for stats', async () => {
      mockRedisClient.scan
        .mockResolvedValueOnce(['10', ['key1', 'key2']])
        .mockResolvedValueOnce(['0', ['key3']]);
      mockRedisClient.memory.mockResolvedValue(100);

      const stats = await adapter.getStats();

      expect(stats.entries).toBe(3);
      expect(mockRedisClient.scan).toHaveBeenCalledTimes(2);
    });

    it('should handle null memory usage', async () => {
      mockRedisClient.scan.mockResolvedValue(['0', ['key1', 'key2']]);
      mockRedisClient.memory
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(null); // Redis might return null

      const stats = await adapter.getStats();

      expect(stats.size).toBe(100); // Only counts non-null
      expect(stats.entries).toBe(2);
    });

    it('should return default stats when Redis is not available', async () => {
      mockRedisClientFunctions.getRedisClient.mockReturnValue(null);

      const stats = await adapter.getStats();

      expect(stats).toEqual({
        size: 0,
        entries: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        evictions: 0,
      });
      expect(mockRedisClient.scan).not.toHaveBeenCalled();
    });

    it('should return default stats when Redis is not connected', async () => {
      mockRedisClientFunctions.isRedisConnected.mockReturnValue(false);

      const stats = await adapter.getStats();

      expect(stats).toEqual({
        size: 0,
        entries: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        evictions: 0,
      });
    });

    it('should return partial stats on error', async () => {
      mockRedisClient.scan.mockRejectedValue(new Error('Stats error'));

      // Add some hits/misses before error
      mockRedisClient.get.mockResolvedValue(null);
      await adapter.get('miss');

      const stats = await adapter.getStats();

      expect(stats.size).toBe(0);
      expect(stats.entries).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Redis cache getStats error:',
        expect.any(Error)
      );
    });

    it('should accumulate size across all entries', async () => {
      mockRedisClient.scan.mockResolvedValue(['0', ['key1', 'key2', 'key3', 'key4']]);
      mockRedisClient.memory
        .mockResolvedValueOnce(250)
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(125)
        .mockResolvedValueOnce(375);

      const stats = await adapter.getStats();

      expect(stats.size).toBe(1250);
      expect(stats.entries).toBe(4);
    });
  });

  describe('estimateSize', () => {
    it('should estimate size for simple strings', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      await adapter.set('key', 'test');

      const [[, , serialized]] = mockRedisClient.setex.mock.calls;
      const entry = JSON.parse(serialized);

      expect(entry.size).toBeGreaterThan(0);
      expect(typeof entry.size).toBe('number');
    });

    it('should estimate size for objects', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      await adapter.set('key', { foo: 'bar', nested: { deep: true } });

      const [[, , serialized]] = mockRedisClient.setex.mock.calls;
      const entry = JSON.parse(serialized);

      expect(entry.size).toBeGreaterThan(0);
    });

    it('should handle values with large JSON representation', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      // Large array to test size estimation
      const largeValue = Array(1000).fill({ data: 'test', nested: { more: 'data' } });

      await adapter.set('large', largeValue);

      const [[, , serialized]] = mockRedisClient.setex.mock.calls;
      const entry = JSON.parse(serialized);

      // Should have a size > 0 for large values
      expect(entry.size).toBeGreaterThan(1000);
      expect(entry.value).toEqual(largeValue);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete cache lifecycle', async () => {
      // Set a value
      mockRedisClient.setex.mockResolvedValue('OK');
      await adapter.set('lifecycle', { data: 'test' }, 1000);
      expect(mockRedisClient.setex).toHaveBeenCalled();

      // Check it exists
      mockRedisClient.exists.mockResolvedValue(1);
      const exists = await adapter.has('lifecycle');
      expect(exists).toBe(true);

      // Get the value
      const entry: CacheEntry<any> = {
        value: { data: 'test' },
        expiresAt: Date.now() + 1000,
        size: 20,
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(entry));
      const value = await adapter.get('lifecycle');
      expect(value).toEqual({ data: 'test' });

      // Delete it
      mockRedisClient.del.mockResolvedValue(1);
      const deleted = await adapter.delete('lifecycle');
      expect(deleted).toBe(true);

      // Verify it's gone
      mockRedisClient.exists.mockResolvedValue(0);
      const stillExists = await adapter.has('lifecycle');
      expect(stillExists).toBe(false);
    });

    it('should handle multiple cache instances with different prefixes', async () => {
      const cacheA = new RedisCacheAdapter('cache-a');
      const cacheB = new RedisCacheAdapter('cache-b');

      mockRedisClient.setex.mockResolvedValue('OK');

      await cacheA.set('key', 'value-a');
      await cacheB.set('key', 'value-b');

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'cache-a:key',
        expect.any(Number),
        expect.any(String)
      );
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'cache-b:key',
        expect.any(Number),
        expect.any(String)
      );
    });

    it('should properly isolate stats between instances', async () => {
      const cacheA = new RedisCacheAdapter('cache-a');
      const cacheB = new RedisCacheAdapter('cache-b');

      const entry: CacheEntry<string> = {
        value: 'hit',
        expiresAt: Date.now() + 3600000,
        size: 10,
      };

      // Hit on cache A
      mockRedisClient.get.mockResolvedValue(JSON.stringify(entry));
      await cacheA.get('key');

      // Miss on cache B
      mockRedisClient.get.mockResolvedValue(null);
      await cacheB.get('key');

      // Check stats
      mockRedisClient.scan.mockResolvedValue(['0', []]);

      const statsA = await cacheA.getStats();
      expect(statsA.hits).toBe(1);
      expect(statsA.misses).toBe(0);

      const statsB = await cacheB.getStats();
      expect(statsB.hits).toBe(0);
      expect(statsB.misses).toBe(1);
    });

    it('should gracefully degrade when Redis becomes unavailable mid-operation', async () => {
      // Start with Redis available
      const entry: CacheEntry<string> = {
        value: 'test',
        expiresAt: Date.now() + 3600000,
        size: 10,
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(entry));

      const value1 = await adapter.get('key');
      expect(value1).toBe('test');

      // Redis becomes unavailable
      mockRedisClientFunctions.isRedisConnected.mockReturnValue(false);

      const value2 = await adapter.get('key');
      expect(value2).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle empty string values', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      await adapter.set('empty', '');

      const [[, , serialized]] = mockRedisClient.setex.mock.calls;
      const entry = JSON.parse(serialized);
      expect(entry.value).toBe('');
    });

    it('should handle null values', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      await adapter.set('null', null);

      const [[, , serialized]] = mockRedisClient.setex.mock.calls;
      const entry = JSON.parse(serialized);
      expect(entry.value).toBeNull();
    });

    it('should handle boolean values', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      await adapter.set('bool', false);

      const [[, , serialized]] = mockRedisClient.setex.mock.calls;
      const entry = JSON.parse(serialized);
      expect(entry.value).toBe(false);
    });

    it('should handle number values', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      await adapter.set('num', 12345.67);

      const [[, , serialized]] = mockRedisClient.setex.mock.calls;
      const entry = JSON.parse(serialized);
      expect(entry.value).toBe(12345.67);
    });

    it('should handle array values', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      await adapter.set('arr', [1, 'two', { three: 3 }]);

      const [[, , serialized]] = mockRedisClient.setex.mock.calls;
      const entry = JSON.parse(serialized);
      expect(entry.value).toEqual([1, 'two', { three: 3 }]);
    });

    it('should handle very small TTL values', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      // 100ms TTL should ceil to 1 second
      await adapter.set('key', 'value', 100);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'test-cache:key',
        1,
        expect.any(String)
      );
    });

    it('should handle very large TTL values', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      // 1 year in milliseconds
      const oneYear = 365 * 24 * 60 * 60 * 1000;
      await adapter.set('key', 'value', oneYear);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'test-cache:key',
        31536000, // seconds
        expect.any(String)
      );
    });

    it('should handle special characters in keys', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      await adapter.set('key:with:colons', 'value');
      await adapter.set('key/with/slashes', 'value');
      await adapter.set('key-with-dashes', 'value');

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'test-cache:key:with:colons',
        expect.any(Number),
        expect.any(String)
      );
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'test-cache:key/with/slashes',
        expect.any(Number),
        expect.any(String)
      );
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'test-cache:key-with-dashes',
        expect.any(Number),
        expect.any(String)
      );
    });

    it('should handle Unicode characters in values', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      const unicodeValue = { message: '你好世界 🚀 émojis' };
      await adapter.set('unicode', unicodeValue);

      const [[, , serialized]] = mockRedisClient.setex.mock.calls;
      const entry = JSON.parse(serialized);
      expect(entry.value).toEqual(unicodeValue);
    });
  });
});
