import { NextResponse } from 'next/server';
import { checkRateLimit, createRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limiter';
import type { AuthCheckResult, RateLimitCheckResult } from '@/types/chat';

/**
 * Check rate limit for the request
 * Extracted from app/api/chat/route.ts lines 73-99
 */
export async function checkRateLimitMiddleware(
  auth: AuthCheckResult
): Promise<RateLimitCheckResult> {
  const rateLimitResult = await checkRateLimit(auth.rateLimitId, RATE_LIMITS.CHAT);

  if (!rateLimitResult.success) {
    console.warn(`[RATE LIMIT EXCEEDED] ${auth.rateLimitId} - ${rateLimitResult.limit} requests/min`);
    return {
      allowed: false,
      remaining: rateLimitResult.remaining || 0,
      limit: rateLimitResult.limit,
      retryAfter: rateLimitResult.retryAfter,
      headers: createRateLimitHeaders(rateLimitResult),
    };
  }

  console.log(`[RATE LIMIT OK] ${auth.rateLimitId} - ${rateLimitResult.remaining}/${rateLimitResult.limit} remaining`);

  return {
    allowed: true,
    remaining: rateLimitResult.remaining || 0,
    limit: rateLimitResult.limit,
    headers: createRateLimitHeaders(rateLimitResult),
  };
}

/**
 * Create rate limit exceeded response
 */
export function rateLimitResponse(rateLimit: RateLimitCheckResult): NextResponse {
  return NextResponse.json(
    {
      error: 'Too many requests. Please slow down and try again in a moment.',
      retryAfter: rateLimit.retryAfter,
    },
    {
      status: 429,
      headers: rateLimit.headers,
    }
  );
}
