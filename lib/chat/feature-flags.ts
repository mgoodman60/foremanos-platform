/**
 * Chat API Feature Flags
 *
 * Note: The legacy chat implementation was removed in Jan 2026.
 * The modular pipeline (middleware + processors) is now the only implementation.
 *
 * These flags are kept for backwards compatibility with tests and potential
 * future A/B testing. All flags default to true (new implementation).
 */

export const CHAT_FEATURE_FLAGS = {
  /** Always true - modular middleware is the standard implementation */
  USE_MODULAR_MIDDLEWARE: true,

  /** Always true - modular processors are the standard implementation */
  USE_MODULAR_PROCESSORS: true,
} as const;

/**
 * @deprecated No longer used - legacy route was removed.
 * Kept for backwards compatibility with tests.
 */
export function shouldUseNewRoute(__userId?: string | null): boolean {
  return true;
}

/**
 * @deprecated No longer used - middleware is always modular.
 */
export function shouldUseNewMiddleware(): boolean {
  return true;
}

/**
 * @deprecated No longer used - processors are always modular.
 */
export function shouldUseNewProcessors(): boolean {
  return true;
}
