import './mocks';
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/chat/route';
import { createMockRequest, extractResponseData } from './setup';

describe('Chat API Snapshot Tests - Text Queries', () => {
  it('should match snapshot for general text query', async () => {
    const request = createMockRequest({
      message: 'What is the project schedule?',
      projectSlug: 'test-project',
    });

    const response = await POST(request);
    const data = await extractResponseData(response);

    expect(data).toMatchSnapshot('general-text-query');
  });

  it('should match snapshot for counting query', async () => {
    const request = createMockRequest({
      message: 'How many windows are in the building?',
      projectSlug: 'test-project',
    });

    const response = await POST(request);
    const data = await extractResponseData(response);

    expect(data).toMatchSnapshot('counting-query');
  });

  it('should match snapshot for measurement query', async () => {
    const request = createMockRequest({
      message: 'What is the height of the building?',
      projectSlug: 'test-project',
    });

    const response = await POST(request);
    const data = await extractResponseData(response);

    expect(data).toMatchSnapshot('measurement-query');
  });

  it('should match snapshot for calculation query', async () => {
    const request = createMockRequest({
      message: 'Calculate the total volume of concrete needed',
      projectSlug: 'test-project',
    });

    const response = await POST(request);
    const data = await extractResponseData(response);

    expect(data).toMatchSnapshot('calculation-query');
  });
});
