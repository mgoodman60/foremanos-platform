/**
 * Vision API Wrapper with Cloudflare Protection
 * Handles rate limiting, retries, and fallback strategies
 */

import { setTimeout } from 'timers/promises';
import { VISION_MODEL, FALLBACK_MODEL } from '@/lib/model-config';

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
 * Detect if response is a Cloudflare block
 */
function isCloudflareBlock(response: string): boolean {
  return (
    response.includes('<!DOCTYPE html>') ||
    response.includes('cloudflare') ||
    response.includes('cf-browser-verification') ||
    response.includes('Just a moment...') ||
    response.includes('Checking your browser')
  );
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt: number, baseDelay: number): number {
  // Exponential: 1s, 2s, 4s, 8s, 16s (max 16s)
  return Math.min(baseDelay * Math.pow(2, attempt), 16000);
}

/**
 * Call vision API with retry logic
 */
export async function callVisionAPIWithRetry(
  imageBase64: string,
  prompt: string,
  options: VisionAPIOptions = {}
): Promise<VisionAPIResponse> {
  const {
    model = VISION_MODEL,
    maxRetries = 5,
    retryDelay = 1000,
  } = options;

  let lastError = '';
  let retriesUsed = 0;

  // Try primary model with retries
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[VISION] Attempt ${attempt + 1}/${maxRetries} with ${model}`);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 4000,
          temperature: 0.1,
        }),
      });

      const responseText = await response.text();

      // Check for Cloudflare block
      if (isCloudflareBlock(responseText)) {
        lastError = 'Cloudflare rate limit detected';
        retriesUsed = attempt + 1;
        
        if (attempt < maxRetries - 1) {
          const delay = getBackoffDelay(attempt, retryDelay);
          console.log(`[VISION] Cloudflare block detected, retrying in ${delay}ms...`);
          await setTimeout(delay);
          continue;
        }
      } else {
        // Parse JSON response
        try {
          const data = JSON.parse(responseText);
          
          if (data.choices?.[0]?.message?.content) {
            return {
              success: true,
              data: data.choices[0].message.content,
              retriesUsed: attempt,
            };
          } else {
            lastError = 'Invalid API response structure';
          }
        } catch (parseError) {
          lastError = `JSON parse error: ${parseError}`;
        }
      }
    } catch (error: any) {
      lastError = error.message || 'Unknown error';
      console.error(`[VISION] Attempt ${attempt + 1} failed:`, lastError);
      
      if (attempt < maxRetries - 1) {
        const delay = getBackoffDelay(attempt, retryDelay);
        await setTimeout(delay);
      }
    }
  }

  // All retries failed - try fallback model
  if (model !== FALLBACK_MODEL) {
    console.log(`[VISION] Primary model exhausted, trying ${FALLBACK_MODEL} fallback...`);

    try {
      const fallbackResult = await callVisionAPIWithRetry(
        imageBase64,
        prompt,
        { model: FALLBACK_MODEL, maxRetries: 3, retryDelay: 2000 }
      );

      if (fallbackResult.success) {
        return {
          ...fallbackResult,
          usedFallback: true,
          fallbackMethod: FALLBACK_MODEL as any,
        };
      }
    } catch (fallbackError) {
      console.error(`[VISION] ${FALLBACK_MODEL} fallback also failed:`, fallbackError);
    }
  }

  // Return failure - caller should use text extraction
  return {
    success: false,
    error: lastError,
    retriesUsed,
  };
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
      console.log(`[RATE LIMIT] Waiting ${Math.ceil(waitTime / 1000)}s before next request`);
      await setTimeout(waitTime);
    }

    // Check 5-minute window
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const requests5min = this.requestTimestamps.filter(ts => ts > fiveMinutesAgo);
    
    if (requests5min.length >= this.maxRequestsPer5Minutes) {
      const oldest = Math.min(...requests5min);
      const waitTime = 5 * 60000 - (now - oldest) + 1000;
      console.log(`[RATE LIMIT] 5-min limit reached, waiting ${Math.ceil(waitTime / 1000)}s`);
      await setTimeout(waitTime);
    }

    // Record this request
    this.requestTimestamps.push(Date.now());
  }
}

export const visionRateLimiter = new VisionAPIRateLimiter();
