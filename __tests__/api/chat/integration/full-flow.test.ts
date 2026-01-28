import '../snapshots/mocks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/chat/route';
import { getServerSession } from 'next-auth';
import { getCachedResponse } from '@/lib/query-cache';
import { checkRateLimit, createRateLimitHeaders } from '@/lib/rate-limiter';
import { checkQueryLimit } from '@/lib/subscription';

const featureFlagMock = vi.fn(() => true);
const restrictedMock = vi.fn(() => ({ isRestricted: false, denialMessage: '' }));

vi.mock('@/lib/chat/feature-flags', () => ({
  shouldUseNewRoute: featureFlagMock,
}));

vi.mock('@/lib/chat/utils/restricted-query-check', () => ({
  checkRestrictedQuery: restrictedMock,
}));

describe('Chat API Full Request Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    featureFlagMock.mockReturnValue(true);
    restrictedMock.mockReturnValue({ isRestricted: false, denialMessage: '' });
    process.env.ABACUSAI_API_KEY = 'test-key';

    vi.mocked(getCachedResponse).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should handle complete request flow for a text query', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream, { status: 200 })));

    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'What is the project schedule?',
        projectSlug: 'test-project',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
  });

  it('should handle complete request flow for an image query', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Image response"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream, { status: 200 })));

    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        image: 'base64-encoded-image',
        imageName: 'test.png',
        projectSlug: 'test-project',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('should surface rate limit errors with headers', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({
      success: false,
      remaining: 0,
      limit: 10,
      retryAfter: 30,
    } as never);
    vi.mocked(createRateLimitHeaders).mockReturnValue({
      'X-RateLimit-Limit': '10',
      'X-RateLimit-Remaining': '0',
      'Retry-After': '30',
    });

    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Test',
        projectSlug: 'test-project',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('30');
  });

  it('should surface query limit errors with tier metadata', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user-1', role: 'client' },
    } as never);
    vi.mocked(checkQueryLimit).mockResolvedValue({
      allowed: false,
      limit: 5,
      remaining: 0,
      tier: 'pro',
    } as never);

    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Test',
        projectSlug: 'test-project',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data).toHaveProperty('tier', 'pro');
    expect(data).toHaveProperty('limit', 5);
    expect(data).toHaveProperty('remaining', 0);
  });

  it('should enforce restricted query responses for guests', async () => {
    restrictedMock.mockReturnValue({
      isRestricted: true,
      denialMessage: 'Access denied (mock).',
    });

    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: "What's the budget?",
        projectSlug: 'test-project',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('response');
    expect(String(data.response)).toContain('Access denied');
  });
});
