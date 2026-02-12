/**
 * Centralized LLM Model Configuration
 *
 * Single source of truth for all model constants used across ForemanOS.
 * All 30+ files that reference models should import from here.
 *
 * Migration (Feb 2026): Claude-primary with tier enforcement.
 * - Free tier: gpt-4o-mini only
 * - Paid tiers: Claude Sonnet 4.5 default, Opus 4.6 for complex/vision
 * - gpt-4o completely removed (deprecated Feb 13, 2026)
 * - OpenAI fallback is gpt-5.2
 */

/** Free tier model - cheapest option for simple queries */
export const DEFAULT_FREE_MODEL = 'gpt-4o-mini';

/** Default model for all paid tiers - Claude Sonnet 4.5 */
export const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

/** Premium model for Business/Enterprise and complex queries */
export const PREMIUM_MODEL = 'claude-opus-4-6';

/** Vision model - always Opus 4.6 for best accuracy on construction drawings */
export const VISION_MODEL = 'claude-opus-4-6';

/** OpenAI fallback - NOT gpt-4o (deprecated Feb 13, 2026) */
export const FALLBACK_MODEL = 'gpt-5.2';

/** Simple/cheap queries model */
export const SIMPLE_MODEL = 'gpt-4o-mini';

/** Extraction tasks (document processing, OCR, etc.) */
export const EXTRACTION_MODEL = VISION_MODEL;

/**
 * Resolve legacy model aliases to current model IDs.
 * Maps deprecated or renamed models to their current equivalents.
 * Used for backward compatibility when model strings appear in configs or cache.
 */
export function resolveModelAlias(model: string): string {
  const aliases: Record<string, string> = {
    // Deprecated - gpt-4o removed Feb 13, 2026
    'gpt-4o': FALLBACK_MODEL,
    'gpt-4o-2024-08-06': FALLBACK_MODEL,
    'gpt-4o-2024-11-20': FALLBACK_MODEL,

    // Legacy OpenAI
    'gpt-3.5-turbo': SIMPLE_MODEL,
    'gpt-3.5-turbo-0125': SIMPLE_MODEL,
    'gpt-4-turbo': FALLBACK_MODEL,
    'gpt-4-vision-preview': FALLBACK_MODEL,

    // Legacy Claude model IDs
    'claude-3-5-sonnet-20241022': DEFAULT_MODEL,
    'claude-sonnet-4-5-20251101': DEFAULT_MODEL,
    'claude-3-opus-20240229': PREMIUM_MODEL,
  };

  return aliases[model] || model;
}

/**
 * Check if a model is a Claude model (routes to Anthropic API)
 */
export function isClaudeModel(model: string): boolean {
  return model.startsWith('claude-');
}

/**
 * Check if a model is an OpenAI model (routes to OpenAI API)
 */
export function isOpenAIModel(model: string): boolean {
  return (
    model.startsWith('gpt-') ||
    model.startsWith('o3-') ||
    model.startsWith('o4-')
  );
}
