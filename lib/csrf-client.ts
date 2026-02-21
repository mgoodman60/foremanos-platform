/**
 * Client-side CSRF token utility.
 *
 * Usage:
 *   import { csrfFetch } from '@/lib/csrf-client';
 *   const res = await csrfFetch('/api/projects', { method: 'POST', body: JSON.stringify(data) });
 */

let cachedToken: string | null = null;

/**
 * Fetch a CSRF token from the server and cache it for subsequent requests.
 * Call this once on app load or lazily on the first mutation request.
 */
export async function getCsrfToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  const res = await fetch('/api/csrf');
  if (!res.ok) {
    throw new Error('Failed to fetch CSRF token');
  }

  const data = await res.json();
  cachedToken = data.csrfToken;
  return cachedToken!;
}

/**
 * Invalidate the cached token so the next call to getCsrfToken() fetches a fresh one.
 */
export function clearCsrfToken(): void {
  cachedToken = null;
}

/**
 * A drop-in wrapper around `fetch` that automatically attaches the CSRF token
 * header to mutation requests (POST, PUT, PATCH, DELETE).
 */
export async function csrfFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const method = (init?.method || 'GET').toUpperCase();
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  if (isMutation) {
    const token = await getCsrfToken();
    const headers = new Headers(init?.headers);
    headers.set('X-CSRF-Token', token);
    return fetch(input, { ...init, headers });
  }

  return fetch(input, init);
}
