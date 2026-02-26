import { auth } from '@/auth';
import { NextRequest } from 'next/server';
import { getClientIp, getRateLimitIdentifier } from '@/lib/rate-limiter';
import type { AuthCheckResult } from '@/types/chat';

/**
 * Check authentication and extract user info
 * Extracted from app/api/chat/route.ts lines 77-102
 */
export async function checkAuth(request: NextRequest): Promise<AuthCheckResult> {
  const session = await auth();
  const userId = session?.user?.id || null;
  const clientIp = getClientIp(request);
  const rateLimitId = getRateLimitIdentifier(userId, clientIp);
  const userRole = (session?.user?.role || 'guest') as 'admin' | 'client' | 'guest' | 'pending';

  return {
    session,
    userId,
    userRole,
    clientIp: clientIp || 'unknown',
    rateLimitId,
  };
}
