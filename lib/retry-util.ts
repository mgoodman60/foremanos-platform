/**
 * Retry Utility with Exponential Backoff
 * 
 * Prevents "upstream connect error" by automatically retrying failed requests
 * with increasing delays between attempts.
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  shouldRetry?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 500,
  maxDelay: 5000,
  backoffFactor: 2,
  shouldRetry: (error: any) => {
    // Retry on connection errors, timeouts, and 5xx errors
    if (error?.message?.includes('connect') || 
        error?.message?.includes('timeout') ||
        error?.message?.includes('ECONNREFUSED') ||
        error?.message?.includes('upstream')) {
      return true;
    }
    
    // Retry on HTTP 5xx errors
    if (error?.status >= 500 && error?.status < 600) {
      return true;
    }
    
    // Retry on network errors
    if (error?.name === 'NetworkError' || error?.name === 'TypeError') {
      return true;
    }
    
    return false;
  },
  onRetry: (attempt, error) => {
    console.log(`[Retry] Attempt ${attempt} failed:`, error.message);
  },
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry if we've exhausted attempts or error is not retryable
      if (attempt === opts.maxRetries || !opts.shouldRetry(error)) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffFactor, attempt),
        opts.maxDelay
      );
      
      opts.onRetry(attempt + 1, error);
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Retry fetch requests with better error handling
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  return withRetry(
    async () => {
      const response = await fetch(url, init);
      
      // Throw on 5xx errors so they can be retried
      if (response.status >= 500 && response.status < 600) {
        const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        throw error;
      }
      
      return response;
    },
    retryOptions
  );
}

/**
 * Retry database operations with connection error handling
 */
export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  operationName: string = 'Database operation'
): Promise<T> {
  return withRetry(
    operation,
    {
      maxRetries: 3,
      initialDelay: 1000,
      shouldRetry: (error: any) => {
        // Retry on Prisma connection errors
        if (error?.code === 'P1001' || // Can't reach database
            error?.code === 'P1002' || // Timeout
            error?.code === 'P1017' || // Connection lost
            error?.message?.includes('connect') ||
            error?.message?.includes('timeout')) {
          return true;
        }
        return false;
      },
      onRetry: (attempt, error) => {
        console.log(`[DB Retry] ${operationName} - Attempt ${attempt} failed:`, error.message);
      },
    }
  );
}
