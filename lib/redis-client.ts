/**
 * Redis Connection Manager
 * Manages Redis connection lifecycle for multi-instance deployments
 */

import Redis from 'ioredis';

let redisClient: Redis | null = null;
let isConnected = false;

/**
 * Get Redis client configuration from environment
 */
function getRedisConfig() {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    lazyConnect: true, // Don't connect immediately
  };
}

/**
 * Initialize Redis connection
 */
export async function connectRedis(): Promise<Redis | null> {
  if (redisClient && isConnected) {
    return redisClient;
  }

  try {
    const config = getRedisConfig();
    redisClient = new Redis(config);

    // Silent mode during build/test
    const isBuild = process.env.__NEXT_TEST_MODE === '1' || process.env.NODE_ENV === 'production';

    // Set up event handlers
    redisClient.on('connect', () => {
      if (!isBuild) console.log('✅ Redis connected');
      isConnected = true;
    });

    redisClient.on('error', (error) => {
      // Silent during build - fallback to in-memory cache is automatic
      if (!isBuild) console.error('❌ Redis connection error:', error);
      isConnected = false;
    });

    redisClient.on('close', () => {
      if (!isBuild) console.log('🔌 Redis connection closed');
      isConnected = false;
    });

    redisClient.on('reconnecting', () => {
      if (!isBuild) console.log('🔄 Redis reconnecting...');
    });

    // Try to connect
    await redisClient.connect();
    
    // Test connection
    await redisClient.ping();
    
    return redisClient;
  } catch (error) {
    // Silent during build
    const isBuild = process.env.__NEXT_TEST_MODE === '1' || process.env.NODE_ENV === 'production';
    if (!isBuild) console.error('❌ Failed to connect to Redis:', error);
    redisClient = null;
    isConnected = false;
    return null;
  }
}

/**
 * Get existing Redis client (without connecting)
 */
export function getRedisClient(): Redis | null {
  return isConnected ? redisClient : null;
}

/**
 * Check if Redis is connected
 */
export function isRedisConnected(): boolean {
  return isConnected && redisClient !== null;
}

/**
 * Disconnect from Redis
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isConnected = false;
  }
}

/**
 * Redis health check
 */
export async function checkRedisHealth(): Promise<{
  connected: boolean;
  latency?: number;
  error?: string;
}> {
  if (!redisClient || !isConnected) {
    return { connected: false, error: 'Not connected' };
  }

  try {
    const start = Date.now();
    await redisClient.ping();
    const latency = Date.now() - start;
    
    return { connected: true, latency };
  } catch (error: unknown) {
    return { connected: false, error: error.message };
  }
}
