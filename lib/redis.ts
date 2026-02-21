import Redis from 'ioredis';
import { logger } from './logger';

let redis: Redis | null = null;
let redisAvailable = false;

/**
 * Initialize Redis client with graceful fallback
 * App continues to work even if Redis is unavailable
 */
function createRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) {
    logger.warn('REDIS', 'REDIS_URL not configured - running without Redis caching');
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
      logger.error('REDIS', 'Connection error', err, { message: err.message });
      redisAvailable = false;
    });

    client.on('connect', () => {
      logger.info('REDIS', 'Connected successfully');
      redisAvailable = true;
    });

    client.on('ready', () => {
      logger.info('REDIS', 'Client ready');
      redisAvailable = true;
    });

    client.on('close', () => {
      logger.warn('REDIS', 'Connection closed');
      redisAvailable = false;
    });

    return client;
  } catch (error) {
    logger.error('REDIS', 'Failed to create client', error as Error);
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
    logger.error('REDIS', 'GET error', error as Error, { key });
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
    logger.error('REDIS', 'SET error', error as Error, { key });
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
    logger.error('REDIS', 'DEL error', error as Error, { key });
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
    let deleted = 0;
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
        deleted += keys.length;
      }
    } while (cursor !== '0');

    return deleted;
  } catch (error) {
    logger.error('REDIS', 'Clear pattern error', error as Error, { pattern });
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
    logger.error('REDIS', 'INCR error', error as Error, { key });
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
    logger.error('REDIS', 'GET counter error', error as Error, { key });
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
      logger.info('REDIS', 'Disconnected gracefully');
    } catch (error) {
      logger.error('REDIS', 'Error disconnecting', error as Error);
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
