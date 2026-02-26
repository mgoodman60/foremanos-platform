import '../snapshots/mocks';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { checkRateLimit, createRateLimitHeaders } from '@/lib/rate-limiter';
import { checkQueryLimit } from '@/lib/subscription';
import { checkAuth } from '@/lib/chat/middleware/auth-check';
import { checkRateLimitMiddleware, rateLimitResponse } from '@/lib/chat/middleware/rate-limit-check';
import { validateQuery, validationErrorResponse } from '@/lib/chat/middleware/query-validation';
import { checkQueryLimitMiddleware, queryLimitResponse } from '@/lib/chat/middleware/query-limit-check';
import { checkMaintenance, maintenanceResponse } from '@/lib/chat/middleware/maintenance-check';
import type { AuthCheckResult } from '@/types/chat';

describe('Chat API Middleware Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checkAuth should extract auth info from request', async () => {
    const session = { user: { id: 'user-1', role: 'client' } };
    vi.mocked(auth).mockResolvedValue(session as never);

    const request = new NextRequest('http://localhost/api/chat', { method: 'POST' });
    const result = await checkAuth(request);

    expect(result.userId).toBe('user-1');
    expect(result.userRole).toBe('client');
    expect(result.clientIp).toBe('127.0.0.1');
    expect(result.rateLimitId).toBe('rate-limit-id');
  });

  it('checkRateLimitMiddleware should apply rate limits and headers', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({
      success: true,
      remaining: 5,
      limit: 10,
      retryAfter: 0,
    } as never);
    vi.mocked(createRateLimitHeaders).mockReturnValue({
      'X-RateLimit-Remaining': '5',
      'X-RateLimit-Limit': '10',
    });

    const auth: AuthCheckResult = {
      session: null,
      userId: 'test-user',
      userRole: 'client',
      clientIp: '127.0.0.1',
      rateLimitId: 'test-user',
    };

    const result = await checkRateLimitMiddleware(auth);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5);
    expect(result.limit).toBe(10);
    expect(result.headers).toHaveProperty('X-RateLimit-Remaining', '5');
  });

  it('checkRateLimitMiddleware should return 429 response when rate limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({
      success: false,
      remaining: 0,
      limit: 10,
      retryAfter: 30,
    } as never);
    vi.mocked(createRateLimitHeaders).mockReturnValue({
      'Retry-After': '30',
    });

    const auth: AuthCheckResult = {
      session: null,
      userId: 'test-user',
      userRole: 'client',
      clientIp: '127.0.0.1',
      rateLimitId: 'test-user',
    };

    const result = await checkRateLimitMiddleware(auth);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBe(30);

    const response = rateLimitResponse(result);
    expect(response.status).toBe(429);
  });

  it('validateQuery should accept valid text requests', async () => {
    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'What is the schedule?',
        projectSlug: 'test-project',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await validateQuery(request);

    expect(result.valid).toBe(true);
    expect(result.body?.message).toBe('What is the schedule?');
    expect(result.body?.projectSlug).toBe('test-project');
  });

  it('validateQuery should reject missing message/image', async () => {
    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        projectSlug: 'test-project',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await validateQuery(request);

    expect(result.valid).toBe(false);
    expect(result.error?.message).toContain('Message or image is required');
    expect(result.error?.status).toBe(400);

    const response = validationErrorResponse(result);
    expect(response.status).toBe(400);
  });

  it('validateQuery should reject missing projectSlug', async () => {
    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'What is the schedule?',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await validateQuery(request);

    expect(result.valid).toBe(false);
    expect(result.error?.message).toContain('Project context is required');
    expect(result.error?.status).toBe(400);
  });

  it('checkQueryLimitMiddleware should block when query limit exceeded', async () => {
    vi.mocked(checkQueryLimit).mockResolvedValue({
      allowed: false,
      limit: 10,
      remaining: 0,
      tier: 'pro',
    } as never);

    const auth: AuthCheckResult = {
      session: null,
      userId: 'test-user-exceeded',
      userRole: 'client',
      clientIp: '127.0.0.1',
      rateLimitId: 'test-user-exceeded',
    };

    const result = await checkQueryLimitMiddleware(auth);

    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(10);
    expect(result.tier).toBe('pro');
    expect(result.remaining).toBe(0);

    const response = queryLimitResponse(result);
    expect(response.status).toBe(429);
  });

  it('checkQueryLimitMiddleware should allow guests without limits', async () => {
    const auth: AuthCheckResult = {
      session: null,
      userId: null,
      userRole: 'guest',
      clientIp: '127.0.0.1',
      rateLimitId: 'guest',
    };

    const result = await checkQueryLimitMiddleware(auth);

    expect(result.allowed).toBe(true);
    expect(result.tier).toBe('guest');
  });

  it('checkMaintenance should short-circuit when maintenance is active', async () => {
    const prismaMock = prisma as unknown as {
      maintenanceMode: { findUnique: ReturnType<typeof vi.fn> };
    };
    vi.mocked(prismaMock.maintenanceMode.findUnique).mockResolvedValue({ isActive: true } as never);

    const result = await checkMaintenance();

    expect(result.isActive).toBe(true);
    expect(result.message).toContain('maintenance');

    const response = maintenanceResponse();
    expect(response.status).toBe(503);
  });
});
