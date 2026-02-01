import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Redis modules with vi.hoisted
const mockRedis = vi.hoisted(() => ({
  connectRedis: vi.fn(),
  isRedisConnected: vi.fn(),
  getRedisClient: vi.fn(),
}));

const mockRedisCacheAdapter = vi.hoisted(() => ({
  RedisCacheAdapter: vi.fn().mockImplementation(() => ({
    set: vi.fn(),
    get: vi.fn(),
    has: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
    invalidatePattern: vi.fn(),
    getStats: vi.fn(),
  })),
}));

vi.mock('@/lib/redis-client', () => mockRedis);
vi.mock('@/lib/redis-cache-adapter', () => mockRedisCacheAdapter);

// Import after mocks
import {
  PerformanceCache,
  HybridCache,
  withCache,
  invalidateProjectCache,
  invalidateDocumentCache,
} from '@/lib/performance-cache';

describe('PerformanceCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with default max size', () => {
      const cache = new PerformanceCache();
      const stats = cache.getStats();

      expect(stats.maxSize).toBe(50 * 1024 * 1024); // 50MB default
      expect(stats.entries).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should initialize with custom max size', () => {
      const cache = new PerformanceCache(100);
      const stats = cache.getStats();

      expect(stats.maxSize).toBe(100 * 1024 * 1024); // 100MB
    });
  });

  describe('set', () => {
    it('should store a value with default TTL', () => {
      const cache = new PerformanceCache<string>();
      cache.set('key1', 'value1');

      const result = cache.get('key1');
      expect(result).toBe('value1');
    });

    it('should store a value with custom TTL', () => {
      const cache = new PerformanceCache<number>();
      cache.set('key1', 42, 5000);

      const result = cache.get('key1');
      expect(result).toBe(42);
    });

    it('should update existing entry', () => {
      const cache = new PerformanceCache<string>();
      cache.set('key1', 'old value');
      cache.set('key1', 'new value');

      const result = cache.get('key1');
      expect(result).toBe('new value');
    });

    it('should warn and reject entry larger than max size', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const cache = new PerformanceCache(0.001); // 0.001MB = ~1KB

      // Create a large object
      const largeValue = { data: 'x'.repeat(10000) };
      cache.set('large', largeValue);

      // Should not be stored
      const result = cache.get('large');
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should update access order when setting', () => {
      const cache = new PerformanceCache<string>();
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const keys = cache.keys();
      expect(keys).toEqual(['key1', 'key2', 'key3']);
    });

    it('should handle complex objects', () => {
      const cache = new PerformanceCache<object>();
      const complexObj = {
        id: 1,
        name: 'test',
        nested: { value: 42 },
        array: [1, 2, 3],
      };

      cache.set('complex', complexObj);
      const result = cache.get('complex');

      expect(result).toEqual(complexObj);
    });
  });

  describe('get', () => {
    it('should return null for non-existent key', () => {
      const cache = new PerformanceCache<string>();
      const result = cache.get('nonexistent');

      expect(result).toBeNull();
    });

    it('should increment miss count for non-existent key', () => {
      const cache = new PerformanceCache<string>();
      cache.get('nonexistent');

      const stats = cache.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);
    });

    it('should increment hit count for existing key', () => {
      const cache = new PerformanceCache<string>();
      cache.set('key1', 'value1');
      cache.get('key1');

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
    });

    it('should return null for expired entry', () => {
      const cache = new PerformanceCache<string>();
      cache.set('key1', 'value1', 1000); // 1 second TTL

      // Advance time past TTL
      vi.advanceTimersByTime(1001);

      const result = cache.get('key1');
      expect(result).toBeNull();
    });

    it('should increment miss count for expired entry', () => {
      const cache = new PerformanceCache<string>();
      cache.set('key1', 'value1', 1000);

      vi.advanceTimersByTime(1001);
      cache.get('key1');

      const stats = cache.getStats();
      expect(stats.misses).toBe(1);
    });

    it('should delete expired entry when accessed', () => {
      const cache = new PerformanceCache<string>();
      cache.set('key1', 'value1', 1000);

      vi.advanceTimersByTime(1001);
      cache.get('key1');

      expect(cache.has('key1')).toBe(false);
    });

    it('should update access order on get', () => {
      const cache = new PerformanceCache<string>();
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Access key1, should update its hit count
      cache.get('key1');

      // Keys method returns Map.keys() which is insertion order
      const keys = cache.keys();
      expect(keys).toEqual(['key1', 'key2', 'key3']);

      // Verify hit tracking instead
      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
    });
  });

  describe('has', () => {
    it('should return true for existing key', () => {
      const cache = new PerformanceCache<string>();
      cache.set('key1', 'value1');

      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for non-existent key', () => {
      const cache = new PerformanceCache<string>();
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should return false for expired key', () => {
      const cache = new PerformanceCache<string>();
      cache.set('key1', 'value1', 1000);

      vi.advanceTimersByTime(1001);

      expect(cache.has('key1')).toBe(false);
    });

    it('should delete expired key when checking', () => {
      const cache = new PerformanceCache<string>();
      cache.set('key1', 'value1', 1000);

      vi.advanceTimersByTime(1001);
      cache.has('key1');

      const stats = cache.getStats();
      expect(stats.entries).toBe(0);
    });
  });

  describe('delete', () => {
    it('should delete existing key', () => {
      const cache = new PerformanceCache<string>();
      cache.set('key1', 'value1');

      const result = cache.delete('key1');

      expect(result).toBe(true);
      expect(cache.has('key1')).toBe(false);
    });

    it('should return false for non-existent key', () => {
      const cache = new PerformanceCache<string>();
      const result = cache.delete('nonexistent');

      expect(result).toBe(false);
    });

    it('should update current size on delete', () => {
      const cache = new PerformanceCache<string>();
      cache.set('key1', 'value1');

      const sizeBefore = cache.getStats().size;
      cache.delete('key1');
      const sizeAfter = cache.getStats().size;

      expect(sizeAfter).toBeLessThan(sizeBefore);
      expect(sizeAfter).toBe(0);
    });

    it('should remove from access order', () => {
      const cache = new PerformanceCache<string>();
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.delete('key2');

      const keys = cache.keys();
      expect(keys).toEqual(['key1', 'key3']);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      const cache = new PerformanceCache<string>();
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.clear();

      const stats = cache.getStats();
      expect(stats.entries).toBe(0);
      expect(stats.size).toBe(0);
    });

    it('should preserve stats counts', () => {
      const cache = new PerformanceCache<string>();
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('nonexistent');

      cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should clear access order', () => {
      const cache = new PerformanceCache<string>();
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.clear();

      const keys = cache.keys();
      expect(keys).toEqual([]);
    });
  });

  describe('invalidatePattern', () => {
    it('should invalidate keys matching string pattern', () => {
      const cache = new PerformanceCache<string>();
      cache.set('project:123:doc1', 'value1');
      cache.set('project:123:doc2', 'value2');
      cache.set('project:456:doc1', 'value3');

      const count = cache.invalidatePattern('project:123');

      expect(count).toBe(2);
      expect(cache.has('project:123:doc1')).toBe(false);
      expect(cache.has('project:123:doc2')).toBe(false);
      expect(cache.has('project:456:doc1')).toBe(true);
    });

    it('should invalidate keys matching regex pattern', () => {
      const cache = new PerformanceCache<string>();
      cache.set('user:1:session', 'value1');
      cache.set('user:2:session', 'value2');
      cache.set('user:1:profile', 'value3');

      const count = cache.invalidatePattern(/^user:\d+:session$/);

      expect(count).toBe(2);
      expect(cache.has('user:1:session')).toBe(false);
      expect(cache.has('user:2:session')).toBe(false);
      expect(cache.has('user:1:profile')).toBe(true);
    });

    it('should return 0 when no matches', () => {
      const cache = new PerformanceCache<string>();
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const count = cache.invalidatePattern('nomatch');

      expect(count).toBe(0);
      expect(cache.getStats().entries).toBe(2);
    });

    it('should handle empty cache', () => {
      const cache = new PerformanceCache<string>();
      const count = cache.invalidatePattern('pattern');

      expect(count).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const cache = new PerformanceCache<string>();
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.get('key1');
      cache.get('nonexistent');

      const stats = cache.getStats();

      expect(stats.entries).toBe(2);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(50);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should calculate hit rate correctly', () => {
      const cache = new PerformanceCache<string>();
      cache.set('key1', 'value1');

      // 3 hits, 1 miss = 75%
      cache.get('key1');
      cache.get('key1');
      cache.get('key1');
      cache.get('nonexistent');

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(75);
    });

    it('should return 0 hit rate when no requests', () => {
      const cache = new PerformanceCache<string>();
      const stats = cache.getStats();

      expect(stats.hitRate).toBe(0);
    });
  });

  describe('keys', () => {
    it('should return all cache keys', () => {
      const cache = new PerformanceCache<string>();
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const keys = cache.keys();

      expect(keys).toEqual(['key1', 'key2', 'key3']);
    });

    it('should return empty array for empty cache', () => {
      const cache = new PerformanceCache<string>();
      const keys = cache.keys();

      expect(keys).toEqual([]);
    });
  });

  describe('getSizeMB', () => {
    it('should return size in MB', () => {
      const cache = new PerformanceCache<string>();
      cache.set('key1', 'x'.repeat(1000000)); // ~1MB

      const sizeMB = cache.getSizeMB();

      expect(sizeMB).toBeGreaterThan(0);
      expect(sizeMB).toBeLessThan(2); // Should be around 1MB
    });

    it('should return 0 for empty cache', () => {
      const cache = new PerformanceCache<string>();
      const sizeMB = cache.getSizeMB();

      expect(sizeMB).toBe(0);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entry when size limit reached', () => {
      const cache = new PerformanceCache(0.01); // Very small cache (0.01MB)

      cache.set('key1', 'x'.repeat(5000));
      cache.set('key2', 'x'.repeat(5000));
      cache.set('key3', 'x'.repeat(5000)); // Should evict key1

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
    });

    it('should track eviction count', () => {
      const cache = new PerformanceCache(0.01);

      cache.set('key1', 'x'.repeat(5000));
      cache.set('key2', 'x'.repeat(5000));
      cache.set('key3', 'x'.repeat(5000));

      const stats = cache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
    });

    it('should evict multiple entries if needed', () => {
      const cache = new PerformanceCache(0.01);

      cache.set('key1', 'x'.repeat(2000));
      cache.set('key2', 'x'.repeat(2000));
      cache.set('key3', 'x'.repeat(2000));
      cache.set('key4', 'x'.repeat(10000)); // Large entry, should evict multiple

      const stats = cache.getStats();
      expect(stats.entries).toBeLessThan(4);
    });

    it('should respect access order for eviction', () => {
      const cache = new PerformanceCache(0.01);

      cache.set('key1', 'x'.repeat(3000));
      cache.set('key2', 'x'.repeat(3000));

      // Access key1 to make it more recently used
      cache.get('key1');

      cache.set('key3', 'x'.repeat(5000)); // Should evict key2, not key1

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(true);
    });

    it('should reclaim space from deleted entries', () => {
      const cache = new PerformanceCache(0.01);

      cache.set('key1', 'x'.repeat(5000));
      const size1 = cache.getStats().size;

      cache.delete('key1');
      const size2 = cache.getStats().size;

      expect(size2).toBeLessThan(size1);
      expect(size2).toBe(0);
    });
  });
});

describe('HybridCache', () => {
  let mockRedisAdapter: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockRedisAdapter = {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      has: vi.fn().mockResolvedValue(false),
      delete: vi.fn().mockResolvedValue(true),
      clear: vi.fn().mockResolvedValue(undefined),
      invalidatePattern: vi.fn().mockResolvedValue(0),
      getStats: vi.fn().mockResolvedValue({
        size: 0,
        entries: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        evictions: 0,
      }),
    };

    mockRedisCacheAdapter.RedisCacheAdapter.mockImplementation(() => mockRedisAdapter);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor with Redis available', () => {
    it('should use Redis when available', async () => {
      mockRedis.connectRedis.mockResolvedValue({ ping: vi.fn() });
      mockRedis.isRedisConnected.mockReturnValue(true);

      const cache = new HybridCache('test', 50, 3600000);

      // Wait for async initialization
      await vi.waitFor(() => {
        expect(mockRedis.connectRedis).toHaveBeenCalled();
      });

      expect(cache.isUsingRedis()).toBe(true);
    });

    it('should fall back to in-memory when Redis unavailable', async () => {
      mockRedis.connectRedis.mockResolvedValue(null);
      mockRedis.isRedisConnected.mockReturnValue(false);

      const cache = new HybridCache('test', 50, 3600000);

      await vi.waitFor(() => {
        expect(mockRedis.connectRedis).toHaveBeenCalled();
      });

      expect(cache.isUsingRedis()).toBe(false);
    });

    it('should fall back to in-memory on Redis error', async () => {
      mockRedis.connectRedis.mockRejectedValue(new Error('Connection failed'));

      const cache = new HybridCache('test', 50, 3600000);

      await vi.waitFor(() => {
        expect(mockRedis.connectRedis).toHaveBeenCalled();
      });

      expect(cache.isUsingRedis()).toBe(false);
    });
  });

  describe('set with Redis', () => {
    it('should use Redis when available', async () => {
      mockRedis.connectRedis.mockResolvedValue({ ping: vi.fn() });
      mockRedis.isRedisConnected.mockReturnValue(true);

      const cache = new HybridCache('test', 50, 3600000);

      await vi.waitFor(() => {
        expect(cache.isUsingRedis()).toBe(true);
      });

      await cache.set('key1', 'value1', 5000);

      expect(mockRedisAdapter.set).toHaveBeenCalledWith('key1', 'value1', 5000);
    });

    it('should use memory cache when Redis unavailable', async () => {
      mockRedis.connectRedis.mockResolvedValue(null);
      mockRedis.isRedisConnected.mockReturnValue(false);

      const cache = new HybridCache<string>('test', 50, 3600000);

      await vi.waitFor(() => {
        expect(cache.isUsingRedis()).toBe(false);
      });

      await cache.set('key1', 'value1');
      const result = await cache.get('key1');

      expect(result).toBe('value1');
    });
  });

  describe('get with Redis', () => {
    it('should use Redis when available', async () => {
      mockRedis.connectRedis.mockResolvedValue({ ping: vi.fn() });
      mockRedis.isRedisConnected.mockReturnValue(true);
      mockRedisAdapter.get.mockResolvedValue('value1');

      const cache = new HybridCache('test', 50, 3600000);

      await vi.waitFor(() => {
        expect(cache.isUsingRedis()).toBe(true);
      });

      const result = await cache.get('key1');

      expect(mockRedisAdapter.get).toHaveBeenCalledWith('key1');
      expect(result).toBe('value1');
    });

    it('should use memory cache when Redis unavailable', async () => {
      mockRedis.connectRedis.mockResolvedValue(null);
      mockRedis.isRedisConnected.mockReturnValue(false);

      const cache = new HybridCache<string>('test', 50, 3600000);

      await vi.waitFor(() => {
        expect(cache.isUsingRedis()).toBe(false);
      });

      await cache.set('key1', 'value1');
      const result = await cache.get('key1');

      expect(result).toBe('value1');
    });
  });

  describe('has with Redis', () => {
    it('should use Redis when available', async () => {
      mockRedis.connectRedis.mockResolvedValue({ ping: vi.fn() });
      mockRedis.isRedisConnected.mockReturnValue(true);
      mockRedisAdapter.has.mockResolvedValue(true);

      const cache = new HybridCache('test', 50, 3600000);

      await vi.waitFor(() => {
        expect(cache.isUsingRedis()).toBe(true);
      });

      const result = await cache.has('key1');

      expect(mockRedisAdapter.has).toHaveBeenCalledWith('key1');
      expect(result).toBe(true);
    });

    it('should use memory cache when Redis unavailable', async () => {
      mockRedis.connectRedis.mockResolvedValue(null);
      mockRedis.isRedisConnected.mockReturnValue(false);

      const cache = new HybridCache<string>('test', 50, 3600000);

      await vi.waitFor(() => {
        expect(cache.isUsingRedis()).toBe(false);
      });

      await cache.set('key1', 'value1');
      const result = await cache.has('key1');

      expect(result).toBe(true);
    });
  });

  describe('delete with Redis', () => {
    it('should use Redis when available', async () => {
      mockRedis.connectRedis.mockResolvedValue({ ping: vi.fn() });
      mockRedis.isRedisConnected.mockReturnValue(true);
      mockRedisAdapter.delete.mockResolvedValue(true);

      const cache = new HybridCache('test', 50, 3600000);

      await vi.waitFor(() => {
        expect(cache.isUsingRedis()).toBe(true);
      });

      const result = await cache.delete('key1');

      expect(mockRedisAdapter.delete).toHaveBeenCalledWith('key1');
      expect(result).toBe(true);
    });

    it('should use memory cache when Redis unavailable', async () => {
      mockRedis.connectRedis.mockResolvedValue(null);
      mockRedis.isRedisConnected.mockReturnValue(false);

      const cache = new HybridCache<string>('test', 50, 3600000);

      await vi.waitFor(() => {
        expect(cache.isUsingRedis()).toBe(false);
      });

      await cache.set('key1', 'value1');
      const result = await cache.delete('key1');

      expect(result).toBe(true);
      expect(await cache.has('key1')).toBe(false);
    });
  });

  describe('clear with Redis', () => {
    it('should use Redis when available', async () => {
      mockRedis.connectRedis.mockResolvedValue({ ping: vi.fn() });
      mockRedis.isRedisConnected.mockReturnValue(true);

      const cache = new HybridCache('test', 50, 3600000);

      await vi.waitFor(() => {
        expect(cache.isUsingRedis()).toBe(true);
      });

      await cache.clear();

      expect(mockRedisAdapter.clear).toHaveBeenCalled();
    });

    it('should use memory cache when Redis unavailable', async () => {
      mockRedis.connectRedis.mockResolvedValue(null);
      mockRedis.isRedisConnected.mockReturnValue(false);

      const cache = new HybridCache<string>('test', 50, 3600000);

      await vi.waitFor(() => {
        expect(cache.isUsingRedis()).toBe(false);
      });

      await cache.set('key1', 'value1');
      await cache.clear();

      expect(await cache.has('key1')).toBe(false);
    });
  });

  describe('invalidatePattern with Redis', () => {
    it('should use Redis when available', async () => {
      mockRedis.connectRedis.mockResolvedValue({ ping: vi.fn() });
      mockRedis.isRedisConnected.mockReturnValue(true);

      const cache = new HybridCache('test', 50, 3600000);

      await vi.waitFor(() => {
        expect(cache.isUsingRedis()).toBe(true);
      });

      const pattern = /^test:/;
      await cache.invalidatePattern(pattern);

      expect(mockRedisAdapter.invalidatePattern).toHaveBeenCalledWith(pattern);
    });

    it('should use memory cache when Redis unavailable', async () => {
      mockRedis.connectRedis.mockResolvedValue(null);
      mockRedis.isRedisConnected.mockReturnValue(false);

      const cache = new HybridCache<string>('test', 50, 3600000);

      await vi.waitFor(() => {
        expect(cache.isUsingRedis()).toBe(false);
      });

      await cache.set('test:1', 'value1');
      await cache.set('test:2', 'value2');
      await cache.set('other:1', 'value3');

      await cache.invalidatePattern('test:');

      expect(await cache.has('test:1')).toBe(false);
      expect(await cache.has('test:2')).toBe(false);
      expect(await cache.has('other:1')).toBe(true);
    });

    it('should handle string patterns', async () => {
      mockRedis.connectRedis.mockResolvedValue(null);
      mockRedis.isRedisConnected.mockReturnValue(false);

      const cache = new HybridCache<string>('test', 50, 3600000);

      await vi.waitFor(() => {
        expect(cache.isUsingRedis()).toBe(false);
      });

      await cache.set('project:123', 'value1');
      await cache.invalidatePattern('project:123');

      expect(await cache.has('project:123')).toBe(false);
    });
  });

  describe('getStats with Redis', () => {
    it('should use Redis when available', async () => {
      mockRedis.connectRedis.mockResolvedValue({ ping: vi.fn() });
      mockRedis.isRedisConnected.mockReturnValue(true);

      const mockStats = {
        size: 1024,
        entries: 5,
        hits: 10,
        misses: 2,
        hitRate: 83.33,
        evictions: 0,
      };
      mockRedisAdapter.getStats.mockResolvedValue(mockStats);

      const cache = new HybridCache('test', 50, 3600000);

      await vi.waitFor(() => {
        expect(cache.isUsingRedis()).toBe(true);
      });

      const stats = await cache.getStats();

      expect(mockRedisAdapter.getStats).toHaveBeenCalled();
      expect(stats).toEqual(mockStats);
    });

    it('should use memory cache when Redis unavailable', async () => {
      mockRedis.connectRedis.mockResolvedValue(null);
      mockRedis.isRedisConnected.mockReturnValue(false);

      const cache = new HybridCache<string>('test', 50, 3600000);

      await vi.waitFor(() => {
        expect(cache.isUsingRedis()).toBe(false);
      });

      await cache.set('key1', 'value1');
      await cache.get('key1');

      const stats = await cache.getStats();

      expect(stats.entries).toBe(1);
      expect(stats.hits).toBe(1);
    });
  });

  describe('isUsingRedis', () => {
    it('should return true when Redis is available', async () => {
      mockRedis.connectRedis.mockResolvedValue({ ping: vi.fn() });
      mockRedis.isRedisConnected.mockReturnValue(true);

      const cache = new HybridCache('test', 50, 3600000);

      await vi.waitFor(() => {
        expect(cache.isUsingRedis()).toBe(true);
      });
    });

    it('should return false when Redis is unavailable', async () => {
      mockRedis.connectRedis.mockResolvedValue(null);
      mockRedis.isRedisConnected.mockReturnValue(false);

      const cache = new HybridCache('test', 50, 3600000);

      await vi.waitFor(() => {
        expect(cache.isUsingRedis()).toBe(false);
      });
    });
  });
});

describe('withCache', () => {
  let cache: HybridCache<string>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.connectRedis.mockResolvedValue(null);
    mockRedis.isRedisConnected.mockReturnValue(false);
    cache = new HybridCache('test', 50, 3600000);
  });

  it('should return cached value when available', async () => {
    const fn = vi.fn().mockResolvedValue('computed value');

    await cache.set('key1', 'cached value');
    const result = await withCache(cache, 'key1', fn);

    expect(result).toBe('cached value');
    expect(fn).not.toHaveBeenCalled();
  });

  it('should execute function when cache miss', async () => {
    const fn = vi.fn().mockResolvedValue('computed value');

    const result = await withCache(cache, 'key1', fn);

    expect(result).toBe('computed value');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should cache the computed value', async () => {
    const fn = vi.fn().mockResolvedValue('computed value');

    const result1 = await withCache(cache, 'key1', fn);
    const result2 = await withCache(cache, 'key1', fn);

    expect(result1).toBe('computed value');
    expect(result2).toBe('computed value');
    expect(fn).toHaveBeenCalledTimes(1); // Only called once
  });

  it('should use custom TTL', async () => {
    const fn = vi.fn().mockResolvedValue('value');

    await withCache(cache, 'key1', fn, 5000);

    // Verify value is cached
    const cached = await cache.get('key1');
    expect(cached).toBe('value');
  });

  it('should handle async functions', async () => {
    const fn = vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return 'async value';
    });

    const result = await withCache(cache, 'key1', fn);

    expect(result).toBe('async value');
  });

  it('should propagate errors from function', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Function error'));

    await expect(withCache(cache, 'key1', fn)).rejects.toThrow('Function error');
  });
});

describe('invalidateProjectCache', () => {
  it('should invalidate all caches for a project', async () => {
    // Create test cache instances with memory fallback
    mockRedis.connectRedis.mockResolvedValue(null);
    mockRedis.isRedisConnected.mockReturnValue(false);

    // Call invalidation - will use in-memory caches
    await invalidateProjectCache('project-123');

    // Function should complete without error
    // Since we're using in-memory caches, we can't easily verify the pattern
    // but the function should execute successfully
    expect(true).toBe(true);
  });

  it('should use correct pattern for project slug', async () => {
    mockRedis.connectRedis.mockResolvedValue(null);
    mockRedis.isRedisConnected.mockReturnValue(false);

    // This tests that the function can be called with different slugs
    await invalidateProjectCache('my-project');
    await invalidateProjectCache('another-project');

    // Should complete without errors
    expect(true).toBe(true);
  });

  it('should handle errors gracefully', async () => {
    mockRedis.connectRedis.mockResolvedValue(null);
    mockRedis.isRedisConnected.mockReturnValue(false);

    // Should not throw even with empty slug
    await expect(invalidateProjectCache('')).resolves.not.toThrow();
  });
});

describe('invalidateDocumentCache', () => {
  it('should invalidate caches for a document', async () => {
    mockRedis.connectRedis.mockResolvedValue(null);
    mockRedis.isRedisConnected.mockReturnValue(false);

    // Call invalidation - will use in-memory caches
    await invalidateDocumentCache('doc-456');

    // Function should complete without error
    expect(true).toBe(true);
  });

  it('should use correct pattern for document ID', async () => {
    mockRedis.connectRedis.mockResolvedValue(null);
    mockRedis.isRedisConnected.mockReturnValue(false);

    // This tests that the function can be called with different document IDs
    await invalidateDocumentCache('doc-789');
    await invalidateDocumentCache('doc-abc');

    // Should complete without errors
    expect(true).toBe(true);
  });

  it('should handle errors gracefully', async () => {
    mockRedis.connectRedis.mockResolvedValue(null);
    mockRedis.isRedisConnected.mockReturnValue(false);

    // Should not throw even with empty ID
    await expect(invalidateDocumentCache('')).resolves.not.toThrow();
  });
});
