import { incrementCounter, getCounter, isRedisAvailable } from './redis';

/**
 * Rate Limiter with Redis Integration
 * Prevents API abuse by limiting requests per user/IP
 * 
 * Strategy:
 * 1. Use Redis for distributed rate limiting (if available)
 * 2. Fall back to in-memory tracking if Redis unavailable
 */

interface RateLimitConfig {
  maxRequests: number;  // Maximum requests allowed
  windowSeconds: number; // Time window in seconds
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp when limit resets
  retryAfter?: number; // Seconds until user can retry
}

// In-memory fallback for when Redis is unavailable
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of inMemoryStore.entries()) {
    if (value.resetAt < now) {
      inMemoryStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Default rate limit configs by endpoint type
 */
export const RATE_LIMITS = {
  // Chat API - most expensive
  CHAT: {
    maxRequests: 20,      // 20 messages per minute
    windowSeconds: 60,
  },
  // Document upload
  UPLOAD: {
    maxRequests: 10,      // 10 uploads per minute
    windowSeconds: 60,
  },
  // General API
  API: {
    maxRequests: 60,      // 60 requests per minute
    windowSeconds: 60,
  },
  // Authentication
  AUTH: {
    maxRequests: 5,       // 5 login attempts per 5 minutes
    windowSeconds: 300,
  },
} as const;

/**
 * Check rate limit using Redis (with in-memory fallback)
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { maxRequests, windowSeconds } = config;
  const now = Math.floor(Date.now() / 1000); // Current time in seconds
  const resetAt = now + windowSeconds;
  
  // Try Redis first
  if (isRedisAvailable()) {
    try {
      const key = `ratelimit:${identifier}`;
      const count = await incrementCounter(key, windowSeconds);
      
      if (count !== null) {
        const remaining = Math.max(0, maxRequests - count);
        const success = count <= maxRequests;
        
        const result: RateLimitResult = {
          success,
          limit: maxRequests,
          remaining,
          reset: resetAt,
        };
        
        if (!success) {
          result.retryAfter = windowSeconds;
          console.warn(`[REDIS RATE LIMIT] ${identifier} exceeded limit: ${count}/${maxRequests}`);
        }
        
        return result;
      }
    } catch (error) {
      console.error('[REDIS RATE LIMIT ERROR]', error);
      // Fall through to in-memory
    }
  }
  
  // Fallback to in-memory rate limiting
  const nowMs = Date.now();
  const entry = inMemoryStore.get(identifier);
  
  // Clean up expired entry or create new one
  if (!entry || entry.resetAt < nowMs) {
    inMemoryStore.set(identifier, {
      count: 1,
      resetAt: nowMs + (windowSeconds * 1000),
    });
    
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      reset: Math.floor((nowMs + (windowSeconds * 1000)) / 1000),
    };
  }
  
  // Increment count
  entry.count++;
  const remaining = Math.max(0, maxRequests - entry.count);
  const success = entry.count <= maxRequests;
  
  const result: RateLimitResult = {
    success,
    limit: maxRequests,
    remaining,
    reset: Math.floor(entry.resetAt / 1000),
  };
  
  if (!success) {
    result.retryAfter = Math.ceil((entry.resetAt - nowMs) / 1000);
    console.warn(`[IN-MEMORY RATE LIMIT] ${identifier} exceeded limit: ${entry.count}/${maxRequests}`);
  }
  
  return result;
}

/**
 * Get current rate limit status without incrementing
 */
export async function getRateLimitStatus(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { maxRequests, windowSeconds } = config;
  const now = Math.floor(Date.now() / 1000);
  const resetAt = now + windowSeconds;
  
  // Try Redis first
  if (isRedisAvailable()) {
    try {
      const key = `ratelimit:${identifier}`;
      const count = await getCounter(key);
      
      if (count !== null) {
        const remaining = Math.max(0, maxRequests - count);
        const success = count < maxRequests;
        
        return {
          success,
          limit: maxRequests,
          remaining,
          reset: resetAt,
        };
      }
    } catch (error) {
      console.error('[REDIS RATE LIMIT STATUS ERROR]', error);
    }
  }
  
  // Fallback to in-memory
  const entry = inMemoryStore.get(identifier);
  if (!entry || entry.resetAt < Date.now()) {
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests,
      reset: resetAt,
    };
  }
  
  const remaining = Math.max(0, maxRequests - entry.count);
  return {
    success: entry.count < maxRequests,
    limit: maxRequests,
    remaining,
    reset: Math.floor(entry.resetAt / 1000),
  };
}

/**
 * Helper to get user/IP identifier for rate limiting
 */
export function getRateLimitIdentifier(
  userId: string | null,
  ip: string | null
): string {
  // Prefer user ID for authenticated requests
  if (userId) {
    return `user:${userId}`;
  }
  
  // Fall back to IP for unauthenticated requests
  if (ip) {
    return `ip:${ip}`;
  }
  
  // Fallback identifier (should rarely happen)
  return 'anonymous';
}

/**
 * Extract IP address from request headers
 */
export function getClientIp(request: Request): string | null {
  // Try various headers that proxies might use
  const headers = request.headers;
  
  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) {
    // x-forwarded-for can be a comma-separated list
    return xForwardedFor.split(',')[0].trim();
  }
  
  const xRealIp = headers.get('x-real-ip');
  if (xRealIp) {
    return xRealIp;
  }
  
  const cfConnectingIp = headers.get('cf-connecting-ip'); // Cloudflare
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  
  return null;
}

/**
 * Create rate limit response headers (for API responses)
 */
export function createRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
    ...(result.retryAfter ? { 'Retry-After': result.retryAfter.toString() } : {}),
  };
}
