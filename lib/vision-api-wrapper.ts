/**
 * Vision API Wrapper with Cloudflare Protection
 * Delegates to analyzeWithMultiProvider for multi-provider fallback
 * (Claude Opus → GPT-5.2 → Claude Sonnet)
 */

import { setTimeout } from 'timers/promises';
import { analyzeWithMultiProvider } from '@/lib/vision-api-multi-provider';
import { logger } from '@/lib/logger';

interface VisionAPIOptions {
  model?: string;
  maxRetries?: number;
  retryDelay?: number; // Base delay in ms
}

interface VisionAPIResponse {
  success: boolean;
  data?: any;
  error?: string;
  usedFallback?: boolean;
  fallbackMethod?: 'text-extraction' | string;
  retriesUsed?: number;
}

/**
 * Call vision API with multi-provider fallback
 * Delegates to analyzeWithMultiProvider which handles:
 * - Claude Opus 4.6 (primary) with retries
 * - GPT-5.2 fallback with retries
 * - Claude Sonnet 4.5 secondary fallback with retries
 * - Cloudflare block detection
 * - Quality validation
 */
export async function callVisionAPIWithRetry(
  imageBase64: string,
  prompt: string,
  _options: VisionAPIOptions = {}
): Promise<VisionAPIResponse> {
  try {
    const result = await analyzeWithMultiProvider(imageBase64, prompt);

    if (result.success && result.content) {
      const usedFallback = result.provider !== 'claude-opus-4-6';
      return {
        success: true,
        data: result.content,
        retriesUsed: result.attempts - 1,
        usedFallback: usedFallback || undefined,
        fallbackMethod: usedFallback ? result.provider : undefined,
      };
    }

    return {
      success: false,
      error: result.error || 'All providers failed',
      retriesUsed: result.attempts,
    };
  } catch (error: unknown) {
    logger.error('VISION_API', 'analyzeWithMultiProvider threw unexpected error', error as Error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errMsg,
      retriesUsed: 0,
    };
  }
}

/**
 * Rate limiter to prevent hitting Cloudflare limits
 */
class VisionAPIRateLimiter {
  private requestTimestamps: number[] = [];
  private readonly maxRequestsPerMinute = 10;
  private readonly maxRequestsPer5Minutes = 40;

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();

    // Clean old timestamps (older than 5 minutes)
    this.requestTimestamps = this.requestTimestamps.filter(
      ts => now - ts < 5 * 60 * 1000
    );

    // Check 1-minute window
    const oneMinuteAgo = now - 60 * 1000;
    const recentRequests = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);

    if (recentRequests.length >= this.maxRequestsPerMinute) {
      const oldestRecent = Math.min(...recentRequests);
      const waitTime = 60000 - (now - oldestRecent) + 1000; // +1s buffer
      logger.info('VISION_API', `Rate limit: waiting ${Math.ceil(waitTime / 1000)}s before next request`);
      await setTimeout(waitTime);
    }

    // Check 5-minute window
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const requests5min = this.requestTimestamps.filter(ts => ts > fiveMinutesAgo);

    if (requests5min.length >= this.maxRequestsPer5Minutes) {
      const oldest = Math.min(...requests5min);
      const waitTime = 5 * 60000 - (now - oldest) + 1000;
      logger.info('VISION_API', `5-min rate limit reached, waiting ${Math.ceil(waitTime / 1000)}s`);
      await setTimeout(waitTime);
    }

    // Record this request
    this.requestTimestamps.push(Date.now());
  }
}

export const visionRateLimiter = new VisionAPIRateLimiter();
