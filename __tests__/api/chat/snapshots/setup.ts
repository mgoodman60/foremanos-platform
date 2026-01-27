import { NextRequest } from 'next/server';

/**
 * Helper to create mock NextRequest.
 */
export function createMockRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Helper to extract response data for snapshot.
 */
export async function extractResponseData(response: Response) {
  const data = await response.json();
  return {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    body: data,
  };
}
