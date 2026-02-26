/**
 * SWR fetcher with error handling for ForemanOS API routes.
 */

export class FetchError extends Error {
  status: number;
  info: unknown;

  constructor(message: string, status: number, info?: unknown) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
    this.info = info;
  }
}

/**
 * Default fetcher for SWR. Handles JSON responses and throws FetchError on non-OK status.
 */
export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);

  if (!res.ok) {
    let info: unknown;
    try {
      info = await res.json();
    } catch {
      info = await res.text();
    }
    throw new FetchError(
      `API error: ${res.status} ${res.statusText}`,
      res.status,
      info
    );
  }

  return res.json();
}

/**
 * Fetcher that includes credentials and standard headers.
 */
export async function authFetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    let info: unknown;
    try {
      info = await res.json();
    } catch {
      info = await res.text();
    }
    throw new FetchError(
      `API error: ${res.status} ${res.statusText}`,
      res.status,
      info
    );
  }

  return res.json();
}
