import { NextResponse } from 'next/server';
import { checkQueryLimit } from '@/lib/subscription';
import type { AuthCheckResult, QueryLimitCheckResult } from '@/types/chat';

/**
 * Check query limits for logged-in users (subscription limits)
 * Extracted from app/api/chat/route.ts lines 122-138
 */
export async function checkQueryLimitMiddleware(
  auth: AuthCheckResult
): Promise<QueryLimitCheckResult> {
  if (!auth.userId) {
    // Guest users don't have query limits
    return {
      allowed: true,
      limit: Infinity,
      remaining: Infinity,
      tier: 'guest',
    };
  }

  const queryCheck = await checkQueryLimit(auth.userId);

  if (!queryCheck.allowed) {
    return {
      allowed: false,
      limit: queryCheck.limit,
      remaining: 0,
      tier: queryCheck.tier,
      message: `You've reached your monthly limit of ${queryCheck.limit} queries. Upgrade your plan to continue using ForemanOS.`,
    };
  }

  return {
    allowed: true,
    limit: queryCheck.limit,
    remaining: queryCheck.remaining || 0,
    tier: queryCheck.tier,
  };
}

/**
 * Create query limit exceeded response
 */
export function queryLimitResponse(queryLimit: QueryLimitCheckResult): NextResponse {
  return NextResponse.json(
    {
      error: 'Query limit reached',
      message: queryLimit.message,
      tier: queryLimit.tier,
      limit: queryLimit.limit,
      remaining: 0,
    },
    { status: 429 }
  );
}
