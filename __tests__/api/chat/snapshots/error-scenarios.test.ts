import './mocks';
import { describe, it, expect, vi } from 'vitest';
import { POST } from '@/app/api/chat/route';
import { createMockRequest, extractResponseData } from './setup';
import { checkRateLimit } from '@/lib/rate-limiter';
import { checkQueryLimit } from '@/lib/subscription';

describe('Chat API Snapshot Tests - Error Scenarios', () => {
  it('should match snapshot for missing message and image', async () => {
    const request = createMockRequest({
      projectSlug: 'test-project',
    });

    const response = await POST(request);
    const data = await extractResponseData(response);

    expect(data).toMatchSnapshot('missing-message-and-image');
  });

  it('should match snapshot for missing projectSlug', async () => {
    const request = createMockRequest({
      message: 'What is the schedule?',
    });

    const response = await POST(request);
    const data = await extractResponseData(response);

    expect(data).toMatchSnapshot('missing-project-slug');
  });

  it('should match snapshot for rate limit exceeded', async () => {
    // Override the rate limit mock to return rate limited
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      success: false,
      remaining: 0,
      limit: 20,
      reset: Date.now() + 45000,
      retryAfter: 45,
    });

    const request = createMockRequest({
      projectSlug: 'test-project',
      message: 'What is the schedule?',
    });

    const response = await POST(request);
    const data = await extractResponseData(response);

    expect(data).toMatchSnapshot('rate-limit-exceeded');
  });

  it('should match snapshot for query limit exceeded', async () => {
    // Override the query limit mock to return limit exceeded
    vi.mocked(checkQueryLimit).mockResolvedValueOnce({
      allowed: false,
      limit: 100,
      remaining: 0,
      tier: 'free',
    });

    const request = createMockRequest({
      projectSlug: 'test-project',
      message: 'What is the schedule?',
    });

    const response = await POST(request);
    const data = await extractResponseData(response);

    expect(data).toMatchSnapshot('query-limit-exceeded');
  });
});
