import Redis from 'ioredis';

let redis: Redis | null = null;
let redisAvailable = false;

/**
 * Initialize Redis client with graceful fallback
 * App continues to work even if Redis is unavailable
 */
function createRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) {
    console.warn('⚠️  REDIS_URL not configured - running without Redis caching');
    return null;
  }

  try {
    const client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError(err) {
        const targetErrors = ['READONLY', 'ETIMEDOUT'];
        if (targetErrors.some(e => err.message.includes(e))) {
          // Reconnect on specific errors
          return true;
        }
        return false;
      },
      enableOfflineQueue: false, // Fail fast if Redis is down
      lazyConnect: true, // Connect when first command is issued
    });

    // Error handling
    client.on('error', (err) => {
      console.error('❌ Redis connection error:', err.message);
      redisAvailable = false;
    });

    client.on('connect', () => {
      console.log('✅ Redis connected successfully');
      redisAvailable = true;
    });

    client.on('ready', () => {
      console.log('✅ Redis client ready');
      redisAvailable = true;
    });

    client.on('close', () => {
      console.warn('⚠️  Redis connection closed');
      redisAvailable = false;
    });

    return client;
  } catch (error) {
    console.error('❌ Failed to create Redis client:', error);
    return null;
  }
}

// Initialize singleton
if (!redis) {
  redis = createRedisClient();
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redis !== null && redisAvailable;
}

/**
 * Get cached value from Redis
 * Returns null if Redis is unavailable or key doesn't exist
 */
export async function getCached<T>(key: string): Promise<T | null> {
  if (!isRedisAvailable() || !redis) {
    return null;
  }

  try {
    const value = await redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`Redis GET error for key ${key}:`, error);
    return null;
  }
}

/**
 * Set cached value in Redis with TTL
 * Fails gracefully if Redis is unavailable
 */
export async function setCached(
  key: string,
  value: any,
  ttlSeconds: number = 3600
): Promise<boolean> {
  if (!isRedisAvailable() || !redis) {
    return false;
  }

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Redis SET error for key ${key}:`, error);
    return false;
  }
}

/**
 * Delete cached value from Redis
 */
export async function deleteCached(key: string): Promise<boolean> {
  if (!isRedisAvailable() || !redis) {
    return false;
  }

  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.error(`Redis DEL error for key ${key}:`, error);
    return false;
  }
}

/**
 * Clear all cached values matching a pattern
 */
export async function clearCachePattern(pattern: string): Promise<number> {
  if (!isRedisAvailable() || !redis) {
    return 0;
  }

  try {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;
    
    await redis.del(...keys);
    return keys.length;
  } catch (error) {
    console.error(`Redis clear pattern error for ${pattern}:`, error);
    return 0;
  }
}

/**
 * Increment a counter in Redis (used for rate limiting)
 * Returns the new count or null if Redis is unavailable
 */
export async function incrementCounter(
  key: string,
  ttlSeconds: number = 60
): Promise<number | null> {
  if (!isRedisAvailable() || !redis) {
    return null;
  }

  try {
    const count = await redis.incr(key);
    // Set TTL only on first increment
    if (count === 1) {
      await redis.expire(key, ttlSeconds);
    }
    return count;
  } catch (error) {
    console.error(`Redis INCR error for key ${key}:`, error);
    return null;
  }
}

/**
 * Get current counter value
 */
export async function getCounter(key: string): Promise<number | null> {
  if (!isRedisAvailable() || !redis) {
    return null;
  }

  try {
    const value = await redis.get(key);
    return value ? parseInt(value, 10) : 0;
  } catch (error) {
    console.error(`Redis GET counter error for key ${key}:`, error);
    return null;
  }
}

/**
 * Graceful shutdown
 */
export async function disconnectRedis(): Promise<void> {
  if (redis) {
    try {
      await redis.quit();
      console.log('✅ Redis disconnected gracefully');
    } catch (error) {
      console.error('❌ Error disconnecting Redis:', error);
    }
  }
}

// Handle process termination
if (typeof process !== 'undefined') {
  process.on('beforeExit', () => {
    disconnectRedis();
  });
}

export default redis;
