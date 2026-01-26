/**
 * Redis Cache Adapter
 * Implements performance cache interface using Redis backend
 * Enables multi-instance deployment with shared cache
 */

import { getRedisClient, isRedisConnected } from './redis-client';

export interface CacheStats {
  size: number;
  maxSize?: number;
  entries: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  size: number;
}

/**
 * Redis-backed cache implementation
 */
export class RedisCacheAdapter {
  private prefix: string;
  private defaultTTL: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(prefix: string, ttl: number = 3600000) {
    this.prefix = prefix;
    this.defaultTTL = ttl;
  }

  /**
   * Get cache key with prefix
   */
  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  /**
   * Get stats key for this cache
   */
  private getStatsKey(): string {
    return `${this.prefix}:stats`;
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const redis = getRedisClient();
    if (!redis || !isRedisConnected()) {
      return; // Silently fail if Redis is not available
    }

    try {
      const entry: CacheEntry<T> = {
        value,
        expiresAt: Date.now() + (ttl || this.defaultTTL),
        size: this.estimateSize(value),
      };

      const serialized = JSON.stringify(entry);
      const expirySeconds = Math.ceil((ttl || this.defaultTTL) / 1000);

      await redis.setex(this.getKey(key), expirySeconds, serialized);
    } catch (error) {
      console.error('Redis cache set error:', error);
    }
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const redis = getRedisClient();
    if (!redis || !isRedisConnected()) {
      return null;
    }

    try {
      const data = await redis.get(this.getKey(key));
      
      if (!data) {
        this.misses++;
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(data);

      // Check if expired (Redis TTL should handle this, but double-check)
      if (entry.expiresAt < Date.now()) {
        await this.delete(key);
        this.misses++;
        return null;
      }

      this.hits++;
      return entry.value;
    } catch (error) {
      console.error('Redis cache get error:', error);
      this.misses++;
      return null;
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    const redis = getRedisClient();
    if (!redis || !isRedisConnected()) {
      return false;
    }

    try {
      const exists = await redis.exists(this.getKey(key));
      return exists === 1;
    } catch (error) {
      console.error('Redis cache has error:', error);
      return false;
    }
  }

  /**
   * Delete a key from cache
   */
  async delete(key: string): Promise<boolean> {
    const redis = getRedisClient();
    if (!redis || !isRedisConnected()) {
      return false;
    }

    try {
      const deleted = await redis.del(this.getKey(key));
      return deleted > 0;
    } catch (error) {
      console.error('Redis cache delete error:', error);
      return false;
    }
  }

  /**
   * Clear all keys in this cache
   */
  async clear(): Promise<void> {
    const redis = getRedisClient();
    if (!redis || !isRedisConnected()) {
      return;
    }

    try {
      // Use SCAN to find all keys with this prefix
      const pattern = `${this.prefix}:*`;
      let cursor = '0';
      
      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        
        cursor = nextCursor;
        
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== '0');

      // Reset stats
      this.hits = 0;
      this.misses = 0;
    } catch (error) {
      console.error('Redis cache clear error:', error);
    }
  }

  /**
   * Invalidate keys matching a pattern
   */
  async invalidatePattern(pattern: RegExp): Promise<number> {
    const redis = getRedisClient();
    if (!redis || !isRedisConnected()) {
      return 0;
    }

    try {
      let deleted = 0;
      const scanPattern = `${this.prefix}:*`;
      let cursor = '0';
      
      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          'MATCH',
          scanPattern,
          'COUNT',
          100
        );
        
        cursor = nextCursor;
        
        // Filter keys by regex pattern
        const keysToDelete = keys.filter(key => {
          const unprefixed = key.substring(this.prefix.length + 1);
          return pattern.test(unprefixed);
        });
        
        if (keysToDelete.length > 0) {
          deleted += await redis.del(...keysToDelete);
        }
      } while (cursor !== '0');

      return deleted;
    } catch (error) {
      console.error('Redis cache invalidatePattern error:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const redis = getRedisClient();
    if (!redis || !isRedisConnected()) {
      return {
        size: 0,
        entries: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        evictions: 0,
      };
    }

    try {
      // Count keys with this prefix
      let entries = 0;
      let totalSize = 0;
      const pattern = `${this.prefix}:*`;
      let cursor = '0';
      
      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        
        cursor = nextCursor;
        entries += keys.length;
        
        // Estimate size (this is approximate)
        for (const key of keys) {
          const memory = await redis.memory('USAGE', key);
          totalSize += memory || 0;
        }
      } while (cursor !== '0');

      const totalRequests = this.hits + this.misses;
      const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;

      return {
        size: totalSize,
        entries,
        hits: this.hits,
        misses: this.misses,
        hitRate,
        evictions: 0, // Redis handles eviction internally
      };
    } catch (error) {
      console.error('Redis cache getStats error:', error);
      return {
        size: 0,
        entries: 0,
        hits: this.hits,
        misses: this.misses,
        hitRate: 0,
        evictions: 0,
      };
    }
  }

  /**
   * Estimate size of value in bytes
   */
  private estimateSize(value: any): number {
    try {
      return new Blob([JSON.stringify(value)]).size;
    } catch {
      return 0;
    }
  }
}
