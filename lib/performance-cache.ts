/**
 * Performance Caching System
 * In-memory LRU cache with optional Redis backend for multi-instance deployments
 * Implements intelligent cache invalidation and size management
 */

import { RedisCacheAdapter } from './redis-cache-adapter';
import { connectRedis, isRedisConnected } from './redis-client';
import { logger } from '@/lib/logger';

interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  hits: number;
  size: number; // Approximate size in bytes
}

interface CacheStats {
  size: number;
  maxSize?: number;
  entries: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

export class PerformanceCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>>;
  private accessOrder: string[]; // For LRU eviction
  private maxSize: number; // Maximum cache size in bytes
  private currentSize: number;
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
  };

  constructor(maxSizeMB: number = 50) {
    this.cache = new Map();
    this.accessOrder = [];
    this.maxSize = maxSizeMB * 1024 * 1024; // Convert MB to bytes
    this.currentSize = 0;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }

  /**
   * Estimate size of data in bytes
   */
  private estimateSize(data: T): number {
    const json = JSON.stringify(data);
    return new Blob([json]).size;
  }

  /**
   * Update access order for LRU
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Evict least recently used entries to free space
   */
  private evictLRU(requiredSpace: number): void {
    while (this.currentSize + requiredSpace > this.maxSize && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey) {
        const entry = this.cache.get(oldestKey);
        if (entry) {
          this.currentSize -= entry.size;
          this.cache.delete(oldestKey);
          this.stats.evictions++;
        }
      }
    }
  }

  /**
   * Set a value in cache
   */
  set(key: string, value: T, ttl: number = 3600000): void {
    // Default TTL: 1 hour
    const size = this.estimateSize(value);

    // Check if we need to evict
    if (size > this.maxSize) {
      logger.warn('PERFORMANCE_CACHE', 'Cache entry too large', { size, maxSize: this.maxSize });
      return;
    }

    // Remove existing entry if present
    if (this.cache.has(key)) {
      const oldEntry = this.cache.get(key)!;
      this.currentSize -= oldEntry.size;
    }

    // Evict if necessary
    this.evictLRU(size);

    // Add new entry
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      size
    };

    this.cache.set(key, entry);
    this.currentSize += size;
    this.updateAccessOrder(key);
  }

  /**
   * Get a value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update stats and access order
    entry.hits++;
    this.stats.hits++;
    this.updateAccessOrder(key);

    return entry.value;
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      const accessIndex = this.accessOrder.indexOf(key);
      if (accessIndex !== -1) {
        this.accessOrder.splice(accessIndex, 1);
      }
    }
    return this.cache.delete(key);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.currentSize = 0;
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidatePattern(pattern: string | RegExp): number {
    let invalidated = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key);
        invalidated++;
      }
    }

    return invalidated;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.currentSize,
      maxSize: this.maxSize,
      entries: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
      evictions: this.stats.evictions
    };
  }

  /**
   * Get all keys in cache
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size in MB
   */
  getSizeMB(): number {
    return this.currentSize / (1024 * 1024);
  }
}

// Global cache instances
/**
 * Hybrid Cache - Uses Redis when available, falls back to in-memory
 */
export class HybridCache<T = unknown> {
  private memoryCache: PerformanceCache<T>;
  private redisCache: RedisCacheAdapter | null = null;
  private useRedis: boolean = false;

  constructor(prefix: string, maxSizeMB: number = 50, ttl: number = 3600000) {
    this.memoryCache = new PerformanceCache<T>(maxSizeMB);
    
    // Try to initialize Redis
    this.initRedis(prefix, ttl);
  }

  private async initRedis(prefix: string, ttl: number) {
    try {
      const redis = await connectRedis();
      if (redis && isRedisConnected()) {
        this.redisCache = new RedisCacheAdapter(prefix, ttl);
        this.useRedis = true;
        if (!(process.env.__NEXT_TEST_MODE === '1' || process.env.NODE_ENV === 'production')) logger.info('PERFORMANCE_CACHE', 'Cache using Redis backend', { prefix });
      } else {
        if (!(process.env.__NEXT_TEST_MODE === '1' || process.env.NODE_ENV === 'production')) logger.info('PERFORMANCE_CACHE', 'Cache using in-memory fallback', { prefix });
      }
    } catch (error) {
      if (!(process.env.__NEXT_TEST_MODE === '1' || process.env.NODE_ENV === 'production')) logger.warn('PERFORMANCE_CACHE', 'Redis unavailable, using in-memory cache', { prefix });
      this.useRedis = false;
    }
  }

  /**
   * Set a value in cache
   */
  async set(key: string, value: T, ttl?: number): Promise<void> {
    if (this.useRedis && this.redisCache) {
      await this.redisCache.set(key, value, ttl);
    } else {
      this.memoryCache.set(key, value, ttl);
    }
  }

  /**
   * Get a value from cache
   */
  async get(key: string): Promise<T | null> {
    if (this.useRedis && this.redisCache) {
      return await this.redisCache.get<T>(key);
    } else {
      return this.memoryCache.get(key);
    }
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    if (this.useRedis && this.redisCache) {
      return await this.redisCache.has(key);
    } else {
      return this.memoryCache.has(key);
    }
  }

  /**
   * Delete a key
   */
  async delete(key: string): Promise<boolean> {
    if (this.useRedis && this.redisCache) {
      return await this.redisCache.delete(key);
    } else {
      return this.memoryCache.delete(key);
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    if (this.useRedis && this.redisCache) {
      await this.redisCache.clear();
    } else {
      this.memoryCache.clear();
    }
  }

  /**
   * Invalidate by pattern
   */
  async invalidatePattern(pattern: string | RegExp): Promise<void> {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    
    if (this.useRedis && this.redisCache) {
      await this.redisCache.invalidatePattern(regex);
    } else {
      this.memoryCache.invalidatePattern(pattern);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    if (this.useRedis && this.redisCache) {
      return await this.redisCache.getStats();
    } else {
      return this.memoryCache.getStats();
    }
  }

  /**
   * Check if using Redis
   */
  isUsingRedis(): boolean {
    return this.useRedis;
  }
}

// Global cache instances - now hybrid (Redis + in-memory fallback)
export const responseCache = new HybridCache('response', 30, 3600000); // 30MB for API responses
export const documentCache = new HybridCache('document', 50, 3600000); // 50MB for document chunks
export const queryCache = new HybridCache('query', 20, 1800000); // 20MB for query results, 30min TTL

/**
 * Cache wrapper for async functions
 */
export async function withCache<T>(
  cache: HybridCache<T>,
  key: string,
  fn: () => Promise<T>,
  ttl: number = 3600000
): Promise<T> {
  // Check cache first
  const cached = await cache.get(key);
  if (cached !== null) {
    return cached;
  }

  // Execute function and cache result
  const result = await fn();
  await cache.set(key, result, ttl);
  return result;
}

/**
 * Invalidate all caches related to a project
 */
export async function invalidateProjectCache(projectSlug: string): Promise<void> {
  await responseCache.invalidatePattern(`^${projectSlug}:`);
  await documentCache.invalidatePattern(`^${projectSlug}:`);
  await queryCache.invalidatePattern(`^${projectSlug}:`);
}

/**
 * Invalidate all caches related to a document
 */
export async function invalidateDocumentCache(documentId: string): Promise<void> {
  await documentCache.invalidatePattern(`:${documentId}:`);
  await queryCache.invalidatePattern(`:${documentId}:`);
}
