import './mocks';
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/chat/route';
import { createMockRequest, extractResponseData } from './setup';

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

  it.todo('should match snapshot for rate limit exceeded');
  it.todo('should match snapshot for query limit exceeded');
});
