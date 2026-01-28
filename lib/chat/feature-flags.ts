/**
 * Feature flags for gradual rollout of refactored chat API
 * Set via environment variables: USE_NEW_CHAT_MIDDLEWARE, USE_NEW_CHAT_PROCESSORS, USE_NEW_CHAT_ROUTE
 */
export const CHAT_REFACTOR_FLAGS = {
  USE_NEW_MIDDLEWARE: process.env.USE_NEW_CHAT_MIDDLEWARE === 'true',
  USE_NEW_PROCESSORS: process.env.USE_NEW_CHAT_PROCESSORS === 'true',
  USE_NEW_ROUTE: process.env.USE_NEW_CHAT_ROUTE === 'true',
  PARALLEL_EXECUTION: process.env.CHAT_PARALLEL_EXECUTION === 'true',
  PERCENTAGE_ROLLOUT: parseInt(process.env.CHAT_ROLLOUT_PERCENTAGE || '0'),
} as const;

/**
 * Check if new route should be used based on rollout percentage
 */
export function shouldUseNewRoute(userId?: string | null): boolean {
  if (!CHAT_REFACTOR_FLAGS.USE_NEW_ROUTE) return false;
  if (CHAT_REFACTOR_FLAGS.PERCENTAGE_ROLLOUT >= 100) return true;
  if (CHAT_REFACTOR_FLAGS.PERCENTAGE_ROLLOUT <= 0) return false;

  // Simple hash-based percentage rollout
  if (userId) {
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return (hash % 100) < CHAT_REFACTOR_FLAGS.PERCENTAGE_ROLLOUT;
  }

  return false;
}

/**
 * Check if new middleware should be used
 */
export function shouldUseNewMiddleware(): boolean {
  return CHAT_REFACTOR_FLAGS.USE_NEW_MIDDLEWARE;
}

/**
 * Check if new processors should be used
 */
export function shouldUseNewProcessors(): boolean {
  return CHAT_REFACTOR_FLAGS.USE_NEW_PROCESSORS;
}

/**
 * Check if parallel execution is enabled (for comparing old vs new)
 */
export function isParallelExecutionEnabled(): boolean {
  return CHAT_REFACTOR_FLAGS.PARALLEL_EXECUTION;
}
