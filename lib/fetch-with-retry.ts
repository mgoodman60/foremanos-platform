/**
 * Client-Side Fetch Utility with Retry Logic
 * 
 * Prevents "upstream connect error" and network failures on the client side
 * by automatically retrying failed requests with exponential backoff.
 * 
 * Usage:
 * ```typescript
 * import { fetchWithRetry } from '@/lib/fetch-with-retry';
 * 
 * const response = await fetchWithRetry('/api/projects', {
 *   method: 'GET',
 *   retryOptions: { maxRetries: 3 }
 * });
 * ```
 */

import { logger } from './logger';

export interface FetchError extends Error {
  status?: number;
  response?: Response;
}

export interface FetchRetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export interface FetchOptions extends RequestInit {
  retryOptions?: FetchRetryOptions;
}

const DEFAULT_RETRY_OPTIONS: Required<FetchRetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 5000,
  backoffFactor: 2,
  onRetry: (attempt: number, error: Error) => {
    logger.warn('FETCH_RETRY', `Attempt ${attempt} failed: ${error.message}`);
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shouldRetry(error: unknown, response?: Response): boolean {
  // Retry on network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // Retry on timeout errors
  const err = error as { name?: string; message?: string } | null;
  if (err?.name === 'AbortError' || err?.message?.includes('timeout')) {
    return true;
  }

  // Retry on connection errors
  if (err?.message?.includes('connect') ||
      err?.message?.includes('network') ||
      err?.message?.includes('upstream')) {
    return true;
  }

  // Retry on 503 Service Unavailable (database connection issues)
  if (response?.status === 503) {
    return true;
  }

  // Retry on 502 Bad Gateway or 504 Gateway Timeout
  if (response?.status === 502 || response?.status === 504) {
    return true;
  }

  return false;
}

/**
 * Fetch with automatic retry on connection errors
 */
export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { retryOptions, ...fetchOptions } = options;
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
  
  let lastError: unknown;
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);

      // If response is ok or not retryable, return it
      if (response.ok || !shouldRetry(undefined, response)) {
        return response;
      }

      // Store response for potential retry
      lastResponse = response;

      // If this is the last attempt, return the response
      if (attempt === opts.maxRetries) {
        return response;
      }

      // Calculate delay and retry
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffFactor, attempt),
        opts.maxDelay
      );

      opts.onRetry(attempt + 1, new Error(`HTTP ${response.status}: ${response.statusText}`));
      await sleep(delay);

    } catch (error: unknown) {
      lastError = error;
      const errorObj = error instanceof Error ? error : new Error(String(error));

      // Don't retry if we've exhausted attempts or error is not retryable
      if (attempt === opts.maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Calculate delay and retry
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffFactor, attempt),
        opts.maxDelay
      );

      opts.onRetry(attempt + 1, errorObj);
      await sleep(delay);
    }
  }
  
  // If we have a response, return it; otherwise throw the last error
  if (lastResponse) {
    return lastResponse;
  }
  
  throw lastError || new Error('Fetch failed after retries');
}

/**
 * Safely parse response with fallback for non-JSON errors
 */
export async function parseResponse(response: Response): Promise<{ error?: string; message?: string; [key: string]: unknown }> {
  try {
    return await response.json();
  } catch {
    // Response is not JSON, try to get text
    try {
      const text = await response.text();
      return { error: text || response.statusText };
    } catch {
      // Can't read response, use status text
      return { error: response.statusText };
    }
  }
}

/**
 * Get error message from response
 */
export async function getErrorMessage(response: Response, defaultMessage: string = 'Request failed'): Promise<string> {
  const data = await parseResponse(response);
  const error = typeof data.error === 'string' ? data.error : undefined;
  const message = typeof data.message === 'string' ? data.message : undefined;
  return error || message || defaultMessage;
}

/**
 * Fetch JSON with retry logic and safe error parsing
 */
export async function fetchJSON<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const response = await fetchWithRetry(url, options);

  if (!response.ok) {
    const errorMessage = await getErrorMessage(response, `HTTP ${response.status}: ${response.statusText}`);
    const error: FetchError = new Error(errorMessage);
    error.status = response.status;
    error.response = response;
    throw error;
  }

  return response.json();
}
