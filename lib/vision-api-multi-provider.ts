/**
 * Multi-Provider Vision API Wrapper
 *
 * Provides resilient vision processing with automatic fallback across multiple providers:
 * 1. Claude Opus 4.6 (Anthropic) - Primary, highest quality for construction drawings
 * 2. GPT-5.2 (OpenAI) - Fallback, excellent quality
 * 3. Claude Sonnet 4.5 (Anthropic) - Secondary fallback
 *
 * Features:
 * - Automatic provider switching on errors
 * - Quality validation with confidence scoring
 * - Provider performance tracking
 * - Per-provider rate limiting
 *
 * Updated Feb 2026: Claude Opus 4.6 primary, gpt-4o removed
 */

import fs from 'fs';
import { logger } from '@/lib/logger';
import { VISION_MODEL, FALLBACK_MODEL, GEMINI_PRIMARY_MODEL, GEMINI_SECONDARY_MODEL } from '@/lib/model-config';

// Provider types (Claude Opus primary, OpenAI + Claude fallbacks, Gemini for two-tier extraction)
export type VisionProvider = 'gemini-3-pro-preview' | 'gemini-2.5-pro' | 'claude-opus-4-6' | 'gpt-5.2' | 'claude-sonnet-4-5';

interface ProviderConfig {
  name: VisionProvider;
  displayName: string;
  maxRetries: number;
  baseDelay: number; // milliseconds
}

interface VisionResponse {
  success: boolean;
  content: string;
  provider: VisionProvider;
  attempts: number;
  error?: string;
  confidenceScore?: number;
  interpretationProvider?: VisionProvider;
  pass2Provider?: VisionProvider;
  processingTier?: string;
}

interface QualityMetrics {
  hasSheetNumber: boolean;
  hasContent: boolean;
  hasStructuredData: boolean;
  contentLength: number;
  score: number; // 0-100
}

// Provider configurations (Updated Feb 2026 - Claude Opus primary)
const PROVIDERS: ProviderConfig[] = [
  {
    name: 'claude-opus-4-6',
    displayName: 'Claude Opus 4.6 (Anthropic)',
    maxRetries: 3,
    baseDelay: 1000,
  },
  {
    name: 'gpt-5.2',
    displayName: 'GPT-5.2 (OpenAI)',
    maxRetries: 3,
    baseDelay: 1000,
  },
  {
    name: 'claude-sonnet-4-5',
    displayName: 'Claude Sonnet 4.5 (Anthropic)',
    maxRetries: 3,
    baseDelay: 1000,
  },
];

// Circuit breaker state — prevents wasting time on providers that are clearly down
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
}
const circuitBreaker = new Map<VisionProvider, CircuitBreakerState>();
const CIRCUIT_BREAKER_THRESHOLD = 3; // consecutive failures to trip
const CIRCUIT_BREAKER_COOLDOWN = 5 * 60 * 1000; // 5 minutes before retrying a tripped provider

function isCircuitOpen(provider: VisionProvider): boolean {
  const state = circuitBreaker.get(provider);
  if (!state || state.failures < CIRCUIT_BREAKER_THRESHOLD) return false;
  if (Date.now() - state.lastFailure > CIRCUIT_BREAKER_COOLDOWN) {
    // Cooldown expired, allow retry (half-open)
    circuitBreaker.delete(provider);
    return false;
  }
  return true;
}

function recordProviderFailure(provider: VisionProvider): void {
  const state = circuitBreaker.get(provider) || { failures: 0, lastFailure: 0 };
  state.failures++;
  state.lastFailure = Date.now();
  circuitBreaker.set(provider, state);
}

function recordProviderSuccess(provider: VisionProvider): void {
  circuitBreaker.delete(provider);
}

/** Reset all circuit breaker state (exported for testing) */
export function resetCircuitBreakers(): void {
  circuitBreaker.clear();
}

// Load API secrets - checks environment variables first, then falls back to secrets file
function getApiSecrets() {
  // Priority 1: Environment variables (works in production)
  const envAnthropicKey = process.env.ANTHROPIC_API_KEY;
  const envOpenaiKey = process.env.OPENAI_API_KEY;
  const envGoogleKey = process.env.GOOGLE_API_KEY;

  if (envAnthropicKey || envOpenaiKey || envGoogleKey) {
    logger.info('API_SECRETS', 'Using environment variables');
    return {
      anthropic: envAnthropicKey || null,
      openai: envOpenaiKey || null,
      google: envGoogleKey || null,
    };
  }

  // Priority 2: Secrets file (works in development)
  try {
    const secretsPath = '/home/ubuntu/.config/abacusai_auth_secrets.json';
    if (!fs.existsSync(secretsPath)) {
      logger.warn('API_SECRETS', 'No env vars and secrets file not found');
      return { anthropic: null, openai: null, google: null };
    }
    logger.info('API_SECRETS', 'Using secrets file');
    const secretsData = JSON.parse(fs.readFileSync(secretsPath, 'utf-8'));

    const anthropicKey = secretsData?.anthropic?.secrets?.api_key?.value;
    const openaiKey = secretsData?.openai?.secrets?.api_key?.value;

    // Detect Anthropic key by prefix (sk-ant-)
    let anthropicActual = null;
    if (anthropicKey && anthropicKey.startsWith('sk-ant-')) {
      anthropicActual = anthropicKey;
    }

    return {
      anthropic: anthropicActual,
      openai: openaiKey,
      google: null,
    };
  } catch (error) {
    logger.error('API_SECRETS', 'Error loading API secrets', error);
    return { anthropic: null, openai: null, google: null };
  }
}

// Detect Cloudflare block in response
function isCloudflareBlock(response: any, text?: string): boolean {
  if (!response) return false;
  
  // Check status codes
  if (response.status === 403 || response.status === 429) return true;
  
  // Check response text for Cloudflare signatures
  if (text) {
    const cloudflareSignatures = [
      'cloudflare',
      'cf-ray',
      'attention required',
      'challenge',
      'just a moment',
    ];
    const lowerText = text.toLowerCase();
    return cloudflareSignatures.some(sig => lowerText.includes(sig));
  }
  
  return false;
}

// Detect if content is a PDF (base64 encoded)
export function isPdfContent(base64: string): boolean {
  // PDF magic number in base64: "JVBERi" which is %PDF-
  return base64.startsWith('JVBERi') || base64.substring(0, 20).includes('JVBERi');
}

// Call Claude Opus 4.6 (primary vision model)
async function callClaudeOpusVision(
  imageBase64: string,
  prompt: string,
  retryCount: number = 0
): Promise<VisionResponse> {
  const config = PROVIDERS[0];
  const secrets = getApiSecrets();
  const apiKey = secrets.anthropic;

  if (!apiKey) {
    return {
      success: false,
      content: '',
      provider: 'claude-opus-4-6',
      attempts: retryCount + 1,
      error: 'Anthropic API key not configured',
    };
  }

  if (isCircuitOpen('claude-opus-4-6')) {
    logger.warn('VISION_API', 'Circuit breaker tripped for claude-opus-4-6, skipping');
    return { success: false, content: '', provider: 'claude-opus-4-6', attempts: 0, error: 'Circuit breaker open' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000); // 180s - 3 minutes for dense construction PDFs

  try {
    // Detect content type - PDF or image
    const isPdf = isPdfContent(imageBase64);

    // Build content array based on content type
    const contentArray: any[] = [];

    if (isPdf) {
      // For PDFs, use document type
      contentArray.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: imageBase64,
        },
      });
    } else {
      // For images, use image type
      contentArray.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: imageBase64,
        },
      });
    }

    contentArray.push({
      type: 'text',
      text: prompt,
    });

    const requestBody = JSON.stringify({
      model: VISION_MODEL,
      max_tokens: 8000,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: contentArray,
        },
      ],
    });
    const payloadSizeMB = (requestBody.length / (1024 * 1024)).toFixed(2);
    logger.info('VISION_API', `${config.displayName}: Sending request`, { payloadSizeMB, model: VISION_MODEL });

    const fetchStart = Date.now();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: requestBody,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseText = await response.text();

    // Check for Cloudflare block or rate limit
    if (isCloudflareBlock(response, responseText)) {
      logger.info('VISION_API', `${config.displayName}: Cloudflare/rate-limit block detected, switching provider`);
      return {
        success: false,
        content: '',
        provider: 'claude-opus-4-6',
        attempts: retryCount + 1,
        error: 'CLOUDFLARE_BLOCK',
      };
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    const content = data.content?.[0]?.text || '';

    // Detect error responses that masquerade as success
    const errorPatterns = ['error:terminated', 'error: terminated', 'internal error', 'service unavailable'];
    const isErrorResponse = errorPatterns.some(p => content.toLowerCase().startsWith(p));
    if (!content || isErrorResponse) {
      throw new Error(isErrorResponse ? `API returned error response: ${content.substring(0, 100)}` : 'Empty response from API');
    }

    const elapsedMs = Date.now() - fetchStart;
    logger.info('VISION_API', `${config.displayName}: Response received`, { elapsedMs, status: response.status, contentLength: content.length });

    recordProviderSuccess('claude-opus-4-6');
    return {
      success: true,
      content,
      provider: 'claude-opus-4-6',
      attempts: retryCount + 1,
    };
  } catch (error: unknown) {
    clearTimeout(timeout);

    // Retry Opus on timeout for PDFs (once), otherwise fall through
    if (error instanceof Error && error.name === 'AbortError') {
      const isPdf = isPdfContent(imageBase64);
      if (isPdf && retryCount < 1) {
        logger.warn('VISION_API', `${config.displayName}: timeout after 180s, retrying Opus (attempt ${retryCount + 2})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return callClaudeOpusVision(imageBase64, prompt, retryCount + 1);
      }
      logger.info('VISION_API', `${config.displayName}: timeout after 180s`);
      recordProviderFailure('claude-opus-4-6');
      return {
        success: false,
        content: '',
        provider: 'claude-opus-4-6',
        attempts: retryCount + 1,
        error: 'TIMEOUT',
      };
    }

    const errMsg = error instanceof Error ? error.message : String(error);
    // Retry on other errors
    if (retryCount < config.maxRetries) {
      const delay = config.baseDelay * Math.pow(2, retryCount);
      logger.info('VISION_API', `${config.displayName}: Retry ${retryCount + 1}/${config.maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callClaudeOpusVision(imageBase64, prompt, retryCount + 1);
    }

    recordProviderFailure('claude-opus-4-6');
    return {
      success: false,
      content: '',
      provider: 'claude-opus-4-6',
      attempts: retryCount + 1,
      error: errMsg,
    };
  }
}

// Call Claude Sonnet 4.5 (secondary fallback)
async function _callClaudeSonnetVision(
  imageBase64: string,
  prompt: string,
  retryCount: number = 0
): Promise<VisionResponse> {
  const config = PROVIDERS[2];
  const secrets = getApiSecrets();
  const apiKey = secrets.anthropic;

  if (!apiKey) {
    return {
      success: false,
      content: '',
      provider: 'claude-sonnet-4-5',
      attempts: retryCount + 1,
      error: 'Anthropic API key not configured',
    };
  }

  if (isCircuitOpen('claude-sonnet-4-5')) {
    logger.warn('VISION_API', 'Circuit breaker tripped for claude-sonnet-4-5, skipping');
    return { success: false, content: '', provider: 'claude-sonnet-4-5', attempts: 0, error: 'Circuit breaker open' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000); // 45s - reduced from 60s to limit stall time per page

  try {
    // Detect content type - PDF or image
    const isPdf = isPdfContent(imageBase64);
    const contentArray: any[] = [];

    if (isPdf) {
      contentArray.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: imageBase64,
        },
      });
    } else {
      contentArray.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: imageBase64,
        },
      });
    }
    contentArray.push({ type: 'text', text: prompt });

    const requestBody = JSON.stringify({
      model: VISION_MODEL,
      max_tokens: 6000,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: contentArray,
        },
      ],
    });
    const payloadSizeMB = (requestBody.length / (1024 * 1024)).toFixed(2);
    logger.info('VISION_API', `${config.displayName}: Sending request`, { payloadSizeMB, model: VISION_MODEL });

    const fetchStart = Date.now();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: requestBody,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    const content = data.content?.[0]?.text || '';

    // Detect error responses that masquerade as success
    const errorPatterns = ['error:terminated', 'error: terminated', 'internal error', 'service unavailable'];
    const isErrorResponse = errorPatterns.some(p => content.toLowerCase().startsWith(p));
    if (!content || isErrorResponse) {
      throw new Error(isErrorResponse ? `API returned error response: ${content.substring(0, 100)}` : 'Empty response from API');
    }

    const elapsedMs = Date.now() - fetchStart;
    logger.info('VISION_API', `${config.displayName}: Response received`, { elapsedMs, status: response.status, contentLength: content.length });

    recordProviderSuccess('claude-sonnet-4-5');
    return {
      success: true,
      content,
      provider: 'claude-sonnet-4-5',
      attempts: retryCount + 1,
    };
  } catch (error: unknown) {
    clearTimeout(timeout);

    // Don't retry on timeout — immediately fall through to next provider
    if (error instanceof Error && error.name === 'AbortError') {
      logger.info('VISION_API', `${config.displayName}: timeout after 45s, switching provider`);
      recordProviderFailure('claude-sonnet-4-5');
      return {
        success: false,
        content: '',
        provider: 'claude-sonnet-4-5',
        attempts: retryCount + 1,
        error: 'TIMEOUT',
      };
    }

    const errMsg = error instanceof Error ? error.message : String(error);
    // Retry on other errors
    if (retryCount < config.maxRetries) {
      const delay = config.baseDelay * Math.pow(2, retryCount);
      logger.info('VISION_API', `${config.displayName}: Retry ${retryCount + 1}/${config.maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return _callClaudeSonnetVision(imageBase64, prompt, retryCount + 1);
    }

    recordProviderFailure('claude-sonnet-4-5');
    return {
      success: false,
      content: '',
      provider: 'claude-sonnet-4-5',
      attempts: retryCount + 1,
      error: errMsg,
    };
  }
}

// Call GPT-5.2 (OpenAI fallback)
async function callGPT52Vision(
  imageBase64: string,
  prompt: string,
  retryCount: number = 0
): Promise<VisionResponse> {
  const config = PROVIDERS[1];
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      content: '',
      provider: 'gpt-5.2',
      attempts: retryCount + 1,
      error: 'OpenAI API key not configured',
    };
  }

  if (isCircuitOpen('gpt-5.2')) {
    logger.warn('VISION_API', 'Circuit breaker tripped for gpt-5.2, skipping');
    return { success: false, content: '', provider: 'gpt-5.2', attempts: 0, error: 'Circuit breaker open' };
  }

  // GPT-5.2 cannot handle PDF native content — fail fast
  if (isPdfContent(imageBase64)) {
    return {
      success: false,
      content: '',
      provider: 'gpt-5.2',
      attempts: 0,
      error: 'GPT-5.2 does not support PDF native content',
    };
  }

  try {
    // Add timeout for faster failover in dev environment
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000); // 90s timeout

    const requestBody = JSON.stringify({
      model: FALLBACK_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
          ],
        },
      ],
      max_completion_tokens: 8000,
      temperature: 0.1,
    });
    const payloadSizeMB = (requestBody.length / (1024 * 1024)).toFixed(2);
    logger.info('VISION_API', `${config.displayName}: Sending request`, { payloadSizeMB, model: FALLBACK_MODEL });

    const fetchStart = Date.now();
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: requestBody,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseText = await response.text();

    // Check for Cloudflare block
    if (isCloudflareBlock(response, responseText)) {
      throw new Error('CLOUDFLARE_BLOCK');
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    const content = data.choices?.[0]?.message?.content || '';

    // Detect error responses that masquerade as success
    const errorPatterns = ['error:terminated', 'error: terminated', 'internal error', 'service unavailable'];
    const isErrorResponse = errorPatterns.some(p => content.toLowerCase().startsWith(p));
    if (!content || isErrorResponse) {
      throw new Error(isErrorResponse ? `API returned error response: ${content.substring(0, 100)}` : 'Empty response from API');
    }

    const elapsedMs = Date.now() - fetchStart;
    logger.info('VISION_API', `${config.displayName}: Response received`, { elapsedMs, status: response.status, contentLength: content.length });

    logger.warn('VISION_API', 'GPT-5.2 FALLBACK USED — page processed by OpenAI, not Claude Opus', {
      elapsedMs,
      contentLength: content.length,
    });

    recordProviderSuccess('gpt-5.2');
    return {
      success: true,
      content,
      provider: 'gpt-5.2',
      attempts: retryCount + 1,
    };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const isCloudflare = errMsg === 'CLOUDFLARE_BLOCK';
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    const isNetworkError = errMsg.includes('fetch failed') || errMsg.includes('ENOTFOUND');

    // Don't retry on Cloudflare blocks - immediately switch provider
    if (isCloudflare) {
      logger.info('VISION_API', `${config.displayName}: Cloudflare block detected, switching provider`);
      recordProviderFailure('gpt-5.2');
      return {
        success: false,
        content: '',
        provider: 'gpt-5.2',
        attempts: retryCount + 1,
        error: 'CLOUDFLARE_BLOCK',
      };
    }

    // Don't retry on network errors/timeouts in dev - immediately switch to fallback
    if (isTimeout || isNetworkError) {
      const errorType = isTimeout ? 'timeout' : 'network error';
      logger.info('VISION_API', `${config.displayName}: ${errorType} detected (expected in dev), switching provider`);
      recordProviderFailure('gpt-5.2');
      return {
        success: false,
        content: '',
        provider: 'gpt-5.2',
        attempts: retryCount + 1,
        error: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      };
    }

    // Retry on other errors
    if (retryCount < config.maxRetries) {
      const delay = config.baseDelay * Math.pow(2, retryCount);
      logger.info('VISION_API', `${config.displayName}: Retry ${retryCount + 1}/${config.maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callGPT52Vision(imageBase64, prompt, retryCount + 1);
    }

    recordProviderFailure('gpt-5.2');
    return {
      success: false,
      content: '',
      provider: 'gpt-5.2',
      attempts: retryCount + 1,
      error: errMsg,
    };
  }
}

// Call Gemini 3 Pro Preview (Google — primary extraction for three-pass pipeline)
export async function callGeminiPro3Vision(
  imageBase64: string,
  prompt: string,
  retryCount: number = 0
): Promise<VisionResponse> {
  const { GoogleGenAI, ThinkingLevel } = await import('@google/genai');
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      content: '',
      provider: 'gemini-3-pro-preview',
      attempts: retryCount + 1,
      error: 'Google API key not configured',
    };
  }

  const isPdf = isPdfContent(imageBase64);
  const timeoutMs = isPdf ? 300000 : 90000; // 300s for PDFs, 90s for images
  const maxRetries = 3;
  const baseDelay = 1000;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const mimeType = isPdf ? 'application/pdf' : 'image/jpeg';
    const inlineData = {
      inlineData: {
        mimeType,
        data: imageBase64,
      },
    };

    const geminiCall = async () => {
      const response = await ai.models.generateContent({
        model: GEMINI_PRIMARY_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              inlineData,
              { text: prompt },
            ],
          },
        ],
        config: {
          maxOutputTokens: 8192,
          temperature: 0.1,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });
      return response;
    };

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini Pro 3 vision timeout')), timeoutMs)
    );

    logger.info('GEMINI_PRO3_VISION', 'Sending request', {
      model: GEMINI_PRIMARY_MODEL,
      contentType: isPdf ? 'PDF' : 'image',
      attempt: retryCount + 1,
    });

    const fetchStart = Date.now();
    const result = await Promise.race([geminiCall(), timeoutPromise]);
    const content = result.text || '';

    if (!content) {
      throw new Error('Empty response from Gemini Pro 3');
    }

    const elapsedMs = Date.now() - fetchStart;
    logger.info('GEMINI_PRO3_VISION', 'Response received', {
      elapsedMs,
      contentLength: content.length,
    });

    return {
      success: true,
      content,
      provider: 'gemini-3-pro-preview',
      attempts: retryCount + 1,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Check for timeout
    if (errorMsg === 'Gemini Pro 3 vision timeout') {
      logger.warn('GEMINI_PRO3_VISION', `Timeout after ${timeoutMs}ms`, { attempt: retryCount + 1 });
      return {
        success: false,
        content: '',
        provider: 'gemini-3-pro-preview',
        attempts: retryCount + 1,
        error: 'TIMEOUT',
      };
    }

    // Check for rate limiting (429 / RESOURCE_EXHAUSTED)
    const isRateLimited =
      errorMsg.includes('429') ||
      errorMsg.includes('RESOURCE_EXHAUSTED') ||
      errorMsg.includes('quota');

    // Check for safety filter
    const isSafetyBlock = errorMsg.includes('SAFETY');

    if (isSafetyBlock) {
      logger.warn('GEMINI_PRO3_VISION', 'Content blocked by safety filter', { attempt: retryCount + 1 });
      return {
        success: false,
        content: '',
        provider: 'gemini-3-pro-preview',
        attempts: retryCount + 1,
        error: 'SAFETY_BLOCK',
      };
    }

    // Retry on rate limits and transient errors
    if (retryCount < maxRetries - 1) {
      const delay = baseDelay * Math.pow(2, retryCount);
      const reason = isRateLimited ? 'rate limited' : 'error';
      logger.info('GEMINI_PRO3_VISION', `Retry ${retryCount + 1}/${maxRetries} (${reason}) after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callGeminiPro3Vision(imageBase64, prompt, retryCount + 1);
    }

    logger.error('GEMINI_PRO3_VISION', 'All retries exhausted', error);
    return {
      success: false,
      content: '',
      provider: 'gemini-3-pro-preview',
      attempts: retryCount + 1,
      error: errorMsg,
    };
  }
}

// Call Gemini 2.5 Pro (Google — secondary validation for three-pass pipeline)
export async function callGeminiVision(
  imageBase64: string,
  prompt: string,
  retryCount: number = 0
): Promise<VisionResponse> {
  const { GoogleGenAI } = await import('@google/genai');
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      content: '',
      provider: 'gemini-2.5-pro',
      attempts: retryCount + 1,
      error: 'Google API key not configured',
    };
  }

  const isPdf = isPdfContent(imageBase64);
  const timeoutMs = isPdf ? 120000 : 90000; // 120s for PDFs, 90s for images
  const maxRetries = 3;
  const baseDelay = 1000;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const mimeType = isPdf ? 'application/pdf' : 'image/jpeg';
    const inlineData = {
      inlineData: {
        mimeType,
        data: imageBase64,
      },
    };

    const geminiCall = async () => {
      const response = await ai.models.generateContent({
        model: GEMINI_SECONDARY_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              inlineData,
              { text: prompt },
            ],
          },
        ],
        config: {
          maxOutputTokens: 8192,
          temperature: 0.1,
          thinkingConfig: {
            thinkingBudget: 1024,
          },
        },
      });
      return response;
    };

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini vision timeout')), timeoutMs)
    );

    logger.info('GEMINI_VISION', 'Sending request', {
      model: GEMINI_SECONDARY_MODEL,
      contentType: isPdf ? 'PDF' : 'image',
      attempt: retryCount + 1,
    });

    const fetchStart = Date.now();
    const result = await Promise.race([geminiCall(), timeoutPromise]);
    const content = result.text || '';

    if (!content) {
      throw new Error('Empty response from Gemini');
    }

    const elapsedMs = Date.now() - fetchStart;
    logger.info('GEMINI_VISION', 'Response received', {
      elapsedMs,
      contentLength: content.length,
    });

    return {
      success: true,
      content,
      provider: 'gemini-2.5-pro',
      attempts: retryCount + 1,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Check for timeout
    if (errorMsg === 'Gemini vision timeout') {
      logger.warn('GEMINI_VISION', `Timeout after ${timeoutMs}ms`, { attempt: retryCount + 1 });
      return {
        success: false,
        content: '',
        provider: 'gemini-2.5-pro',
        attempts: retryCount + 1,
        error: 'TIMEOUT',
      };
    }

    // Check for rate limiting (429 / RESOURCE_EXHAUSTED)
    const isRateLimited =
      errorMsg.includes('429') ||
      errorMsg.includes('RESOURCE_EXHAUSTED') ||
      errorMsg.includes('quota');

    // Check for safety filter
    const isSafetyBlock = errorMsg.includes('SAFETY');

    if (isSafetyBlock) {
      logger.warn('GEMINI_VISION', 'Content blocked by safety filter', { attempt: retryCount + 1 });
      return {
        success: false,
        content: '',
        provider: 'gemini-2.5-pro',
        attempts: retryCount + 1,
        error: 'SAFETY_BLOCK',
      };
    }

    // Retry on rate limits and transient errors
    if (retryCount < maxRetries - 1) {
      const delay = baseDelay * Math.pow(2, retryCount);
      const reason = isRateLimited ? 'rate limited' : 'error';
      logger.info('GEMINI_VISION', `Retry ${retryCount + 1}/${maxRetries} (${reason}) after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callGeminiVision(imageBase64, prompt, retryCount + 1);
    }

    logger.error('GEMINI_VISION', 'All retries exhausted', error);
    return {
      success: false,
      content: '',
      provider: 'gemini-2.5-pro',
      attempts: retryCount + 1,
      error: errorMsg,
    };
  }
}

// Quality validation
function validateQuality(content: string): QualityMetrics {
  const metrics: QualityMetrics = {
    hasSheetNumber: false,
    hasContent: false,
    hasStructuredData: false,
    contentLength: content.length,
    score: 0,
  };

  // Check for sheet number
  if (/sheet[\s-]*\w+/i.test(content) || /drawing[\s-]*\w+/i.test(content)) {
    metrics.hasSheetNumber = true;
    metrics.score += 30;
  }

  // Check for substantial content
  if (content.length > 200) {
    metrics.hasContent = true;
    metrics.score += 30;
  } else if (content.length > 50) {
    metrics.hasContent = true;
    metrics.score += 15;
  }

  // Check for structured data (JSON-like or key-value pairs)
  const hasStructured = 
    content.includes(':') && 
    (content.includes('{') || content.includes('\n') || content.includes(','));
  
  if (hasStructured) {
    metrics.hasStructuredData = true;
    metrics.score += 40;
  }

  return metrics;
}

// Main multi-provider vision analysis function
// Load balancer state - distributes work across providers
let providerRoundRobinIndex = 0;

/**
 * Get next provider index using round-robin
 */
function getNextProviderIndex(): number {
  const availableProviders = PROVIDERS.length;
  const index = providerRoundRobinIndex % availableProviders;
  providerRoundRobinIndex = (providerRoundRobinIndex + 1) % availableProviders;
  return index;
}

/**
 * Analyze image with load balancing across multiple providers
 * Uses round-robin to distribute work evenly
 */
export async function analyzeWithLoadBalancing(
  imageBase64: string,
  prompt: string,
  pageNumber?: number,
  minQualityScore: number = 50
): Promise<VisionResponse> {
  logger.info('VISION_API', `Load-Balanced Vision Analysis Started`, { pageNumber: pageNumber || 'N/A' });

  const providerFunctions = [
    callClaudeOpusVision,
    callGPT52Vision,
  ];

  // Get primary provider using round-robin (PDFs always use Claude Opus)
  const isPdf = isPdfContent(imageBase64);
  const primaryIndex = isPdf ? 0 : getNextProviderIndex();
  if (isPdf) {
    logger.info('VISION_API', 'PDF native content — using Claude Opus as primary (skipping round-robin)');
  }
  const primaryConfig = PROVIDERS[primaryIndex];
  const primaryFn = providerFunctions[primaryIndex];

  logger.info('VISION_API', `Primary provider selected`, { provider: primaryConfig.displayName, index: primaryIndex });
  
  // Try primary provider first
  try {
    const result = await primaryFn(imageBase64, prompt);
    
    if (result.success && result.content) {
      const quality = validateQuality(result.content);
      result.confidenceScore = quality.score;

      logger.info('VISION_API', `${primaryConfig.displayName} succeeded`, { confidence: quality.score });

      if (quality.score >= minQualityScore) {
        logger.info('VISION_API', 'Quality check passed - Load-Balanced Analysis Complete');
        return result;
      } else {
        logger.warn('VISION_API', `Quality score ${quality.score} below threshold ${minQualityScore}`);
      }
    } else {
      logger.warn('VISION_API', `${primaryConfig.displayName} failed`, { error: result.error });
    }
  } catch (error: unknown) {
    logger.error('VISION_API', `${primaryConfig.displayName} error`, error);
  }

  // Primary failed - check if PDF (no fallback for PDFs)
  if (isPdf) {
    logger.warn('VISION_API', 'Opus failed for PDF content — no fallback available');
    return {
      success: false,
      content: '',
      provider: 'claude-opus-4-6',
      attempts: 2,
      error: 'Opus failed for PDF content after retries',
      confidenceScore: 0,
    };
  }
  logger.info('VISION_API', 'Primary provider failed, falling back to sequential failover');
  return analyzeWithMultiProvider(imageBase64, prompt, minQualityScore);
}

/**
 * Analyze image with sequential failover (original behavior)
 * Tries each provider in order until one succeeds
 */
export async function analyzeWithMultiProvider(
  imageBase64: string,
  prompt: string,
  _minQualityScore: number = 50
): Promise<VisionResponse> {
  logger.info('VISION_API', 'Multi-Provider Vision Analysis Started');

  const isPdf = isPdfContent(imageBase64);
  const providerFunctions = isPdf
    ? [callClaudeOpusVision]                              // Opus only for PDFs — no fallback
    : [callClaudeOpusVision, callGPT52Vision];             // GPT-5.2 fallback for images only, no Sonnet
  const providerConfigs = isPdf
    ? [PROVIDERS[0]]
    : [PROVIDERS[0], PROVIDERS[1]];

  if (isPdf) {
    logger.info('VISION_API', 'PDF content — Opus only (no fallback)');
  }

  let lastError = '';
  let totalAttempts = 0;

  for (let i = 0; i < providerFunctions.length; i++) {
    const providerFn = providerFunctions[i];
    const config = providerConfigs[i];

    logger.info('VISION_API', `Trying provider ${i + 1}/${providerFunctions.length}`, { provider: config.displayName });
    
    try {
      const result = await providerFn(imageBase64, prompt);
      totalAttempts += result.attempts;

      if (result.success && result.content) {
        // Validate quality (logged for diagnostics, not used as a gate)
        const quality = validateQuality(result.content);
        result.confidenceScore = quality.score;

        logger.info('VISION_API', `${providerConfigs[i].displayName} succeeded`, {
          confidence: quality.score,
          hasSheetNumber: quality.hasSheetNumber,
          hasContent: quality.hasContent,
          contentLength: quality.contentLength,
          hasStructuredData: quality.hasStructuredData,
        });

        if (providerConfigs[i].name === 'gpt-5.2') {
          logger.warn('VISION_API', 'GPT-5.2 FALLBACK USED in sequential failover', { provider: providerConfigs[i].displayName });
        }

        logger.info('VISION_API', `Using ${providerConfigs[i].displayName} response - Analysis Complete`);
        return result;
      } else {
        logger.warn('VISION_API', `${providerConfigs[i].displayName} failed`, { error: result.error });
        lastError = result.error || 'Unknown error';

        // If Cloudflare block, immediately try next provider
        if (result.error === 'CLOUDFLARE_BLOCK') {
          continue;
        }
      }
    } catch (error: unknown) {
      logger.error('VISION_API', `${providerConfigs[i].displayName} threw error`, error);
      lastError = error instanceof Error ? error.message : String(error);
    }

    // Add delay between provider switches (except on Cloudflare block)
    if (i < providerFunctions.length - 1 && lastError !== 'CLOUDFLARE_BLOCK') {
      const switchDelay = 2000;
      logger.info('VISION_API', `Waiting ${switchDelay}ms before trying next provider`);
      await new Promise(resolve => setTimeout(resolve, switchDelay));
    }
  }

  // All providers failed
  logger.error('VISION_API', 'All providers failed - Multi-Provider Vision Analysis Failed');

  return {
    success: false,
    content: '',
    provider: 'claude-opus-4-6', // Last attempted
    attempts: totalAttempts,
    error: `All providers failed. Last error: ${lastError}`,
    confidenceScore: 0,
  };
}

// Helper function to get provider display name
export function getProviderDisplayName(provider: VisionProvider): string {
  if (provider === 'gemini-3-pro-preview') return 'Gemini Pro 3 (Google)';
  if (provider === 'gemini-2.5-pro') return 'Gemini 2.5 Pro (Google)';
  const config = PROVIDERS.find(p => p.name === provider);
  return config?.displayName || provider;
}

/**
 * Process PDF directly using Claude's native document capability
 * This is more accurate than converting PDF to images first
 * @param pdfBase64 Base64 encoded PDF content
 * @param prompt Extraction prompt
 * @param startPage Optional start page for multi-page PDFs
 * @param endPage Optional end page for multi-page PDFs
 */
export async function analyzeWithDirectPdf(
  pdfBase64OrBuffer: string | Buffer,
  prompt: string,
  startPage?: number,
  endPage?: number,
  model?: string,  // Override model (default: VISION_MODEL / claude-opus-4-6)
  maxAttempts?: number
): Promise<VisionResponse> {
  logger.info('VISION_API', 'Direct PDF Analysis Started', { startPage: startPage || 1, endPage: endPage || 'all' });

  const secrets = getApiSecrets();
  const apiKey = secrets.anthropic;

  if (!apiKey) {
    logger.warn('VISION_API', 'Anthropic API key not configured, falling back to image-based processing');
    return {
      success: false,
      content: '',
      provider: ((model || VISION_MODEL) as VisionProvider),
      attempts: 1,
      error: 'Anthropic API key not configured for direct PDF processing',
    };
  }

  const maxRetries = maxAttempts ?? 3;
  let lastError = '';
  
  // Extract single page if processing a specific page (better results)
  let pdfBase64 = typeof pdfBase64OrBuffer === 'string' 
    ? pdfBase64OrBuffer 
    : pdfBase64OrBuffer.toString('base64');
  
  // If a specific page is requested, extract just that page for better processing
  if (startPage !== undefined && startPage === endPage) {
    try {
      const { extractPageAsPdf } = await import('./pdf-to-image-serverless');
      const pdfBuffer = typeof pdfBase64OrBuffer === 'string'
        ? Buffer.from(pdfBase64OrBuffer, 'base64')
        : pdfBase64OrBuffer;
      
      const { base64: singlePageBase64, pageCount } = await extractPageAsPdf(pdfBuffer, startPage);
      pdfBase64 = singlePageBase64;
      logger.info('DIRECT_PDF', `Extracted page ${startPage}/${pageCount} for focused processing`);
    } catch (extractError: unknown) {
      const errMsg = extractError instanceof Error ? extractError.message : String(extractError);
      logger.warn('DIRECT_PDF', `Could not extract single page, using full PDF`, { error: errMsg });
    }
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 120s - Opus for construction PDFs — 120s timeout

    try {
      logger.info('DIRECT_PDF', `Attempt ${attempt + 1}/${maxRetries} using ${model || VISION_MODEL}`);

      // Enhanced page instruction
      let pageInstruction = '';
      if (startPage !== undefined && endPage !== undefined && startPage !== endPage) {
        pageInstruction = `\n\nFocus specifically on page ${startPage} to ${endPage} of this document.`;
      }

      const requestBody = JSON.stringify({
        model: model || VISION_MODEL,
        max_tokens: 8000,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBase64,
                },
              },
              {
                type: 'text',
                text: prompt + pageInstruction,
              },
            ],
          },
        ],
      });
      const payloadSizeMB = (requestBody.length / (1024 * 1024)).toFixed(2);
      logger.info('DIRECT_PDF', `Sending request`, { payloadSizeMB, model: model || VISION_MODEL, attempt: attempt + 1 });

      const fetchStart = Date.now();
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: requestBody,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const responseText = await response.text();

      if (!response.ok) {
        // Parse error message for better diagnostics
        let errorDetail = responseText;
        try {
          const errorJson = JSON.parse(responseText);
          errorDetail = errorJson.error?.message || errorJson.message || responseText;
        } catch { /* use raw text */ }
        throw new Error(`HTTP ${response.status}: ${errorDetail}`);
      }

      const data = JSON.parse(responseText);
      const content = data.content?.[0]?.text || '';

      // Detect error responses that masquerade as success
      const errorPatterns = ['error:terminated', 'error: terminated', 'internal error', 'service unavailable'];
      const isErrorResponse = errorPatterns.some(p => content.toLowerCase().startsWith(p));
      if (!content || isErrorResponse) {
        throw new Error(isErrorResponse ? `API returned error response: ${content.substring(0, 100)}` : 'Empty response from API');
      }

      // Validate quality
      const quality = validateQuality(content);

      const elapsedMs = Date.now() - fetchStart;
      logger.info('DIRECT_PDF', `Analysis succeeded - Direct PDF Analysis Complete`, { confidence: quality.score, elapsedMs, contentLength: content.length });

      return {
        success: true,
        content,
        provider: ((model || VISION_MODEL) as VisionProvider),
        attempts: attempt + 1,
        confidenceScore: quality.score,
      };
    } catch (error: unknown) {
      clearTimeout(timeout);
      const errMsg = error instanceof Error ? error.message : String(error);
      lastError = errMsg;

      // Don't retry on timeout — immediately return failure
      if (error instanceof Error && error.name === 'AbortError') {
        logger.info('DIRECT_PDF', `timeout after 120s on attempt ${attempt + 1}`);
        return {
          success: false,
          content: '',
          provider: ((model || VISION_MODEL) as VisionProvider),
          attempts: attempt + 1,
          error: 'TIMEOUT',
          confidenceScore: 0,
        };
      }

      logger.error('DIRECT_PDF', `Attempt ${attempt + 1} failed`, error);

      // Check if this is an unrecoverable error
      const isUnrecoverable =
        errMsg.includes('invalid_request') ||
        errMsg.includes('document') ||
        errMsg.includes('too large') ||
        errMsg.includes('413');

      if (isUnrecoverable) {
        logger.warn('DIRECT_PDF', 'PDF processing error - document may be too large or in unsupported format');
        break; // Don't retry for format/size issues
      }

      if (attempt < maxRetries - 1) {
        const delay = 2000 * Math.pow(2, attempt);
        logger.info('DIRECT_PDF', `Waiting ${delay}ms before retry`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  logger.error('DIRECT_PDF', 'Direct PDF Analysis Failed');
  return {
    success: false,
    content: '',
    provider: ((model || VISION_MODEL) as VisionProvider),
    attempts: maxRetries,
    error: `Direct PDF processing failed: ${lastError}`,
    confidenceScore: 0,
  };
}

// Document type classification for smart routing
export type DocumentProcessingType = 'visual' | 'text-heavy' | 'mixed';

/**
 * Determine optimal processing method based on document classification
 */
export function getProcessingType(processorType: string): DocumentProcessingType {
  switch (processorType) {
    case 'claude-opus-vision':
    case 'vision-ai':
      // Architectural plans, site photos, drawings - need visual processing
      return 'visual';
    case 'claude-haiku-ocr':
    case 'basic-ocr':
      // Text-heavy specs, schedules, regulatory docs - direct PDF is better
      return 'text-heavy';
    default:
      return 'mixed';
  }
}

/**
 * Analyze PDF with automatic method selection
 * Tries direct PDF first, falls back to image-based processing
 */
export async function analyzeDocumentSmart(
  pdfBuffer: Buffer,
  prompt: string,
  pageNumber?: number,
  minQualityScore: number = 50
): Promise<VisionResponse> {
  const pdfBase64 = pdfBuffer.toString('base64');

  // For single-page or small documents, try direct PDF first
  // Claude's document type works best for PDFs under 100 pages
  logger.info('SMART_ANALYSIS', 'Attempting direct PDF processing first');
  
  const directResult = await analyzeWithDirectPdf(pdfBase64, prompt, pageNumber, pageNumber);
  
  if (directResult.success && directResult.content) {
    logger.info('SMART_ANALYSIS', `Direct PDF succeeded`, { quality: directResult.confidenceScore });
    return directResult;
  }

  // If direct PDF failed, fall back to true image rasterization
  logger.info('SMART_ANALYSIS', 'Direct PDF failed, falling back to image rasterization');
  
  // Use true image rasterization for better vision AI compatibility
  try {
    const { rasterizeSinglePage } = await import('./pdf-to-image-raster');
    const rasterized = await rasterizeSinglePage(pdfBuffer, pageNumber || 1, { dpi: 150, maxWidth: 2000 });
    
    return analyzeWithLoadBalancing(rasterized.base64, prompt, pageNumber, minQualityScore);
  } catch (rasterError: unknown) {
    // Canvas/native module not available - return direct result
    const rasterErrMsg = rasterError instanceof Error ? rasterError.message : String(rasterError);
    logger.warn('SMART_ANALYSIS', 'Rasterization unavailable, returning direct result', { error: rasterErrMsg.substring(0, 50) });
    return directResult;
  }
}

/**
 * Smart routing based on document classification
 * Routes visual documents to image processing, text-heavy to direct PDF
 * 
 * @param pdfBuffer PDF file buffer
 * @param prompt Extraction prompt
 * @param processorType Document classification from document-classifier.ts
 * @param pageNumber Optional page number for multi-page PDFs
 * @param minQualityScore Minimum quality threshold
 */
export async function analyzeWithSmartRouting(
  pdfBuffer: Buffer,
  prompt: string,
  processorType: string,
  pageNumber?: number,
  minQualityScore: number = 50
): Promise<VisionResponse> {
  const processingType = getProcessingType(processorType);
  const pdfBase64 = pdfBuffer.toString('base64');

  logger.info('SMART_ROUTING', 'Smart Routing Analysis Started', { documentType: processorType, processingMode: processingType, page: pageNumber || 'all' });
  
  if (processingType === 'text-heavy') {
    // TEXT-HEAVY DOCUMENTS: Direct PDF first (better for schedules, specs, regulatory)
    logger.info('SMART_ROUTING', 'Text-heavy document - Direct PDF processing');

    const directResult = await analyzeWithDirectPdf(pdfBase64, prompt, pageNumber, pageNumber);

    if (directResult.success && directResult.content) {
      logger.info('SMART_ROUTING', 'Direct PDF succeeded', { quality: directResult.confidenceScore });
      return directResult;
    }

    // Fallback to image if direct PDF fails
    logger.warn('SMART_ROUTING', 'Direct PDF failed, falling back to image rasterization');
    try {
      const { rasterizeSinglePage } = await import('./pdf-to-image-raster');
      const rasterized = await rasterizeSinglePage(pdfBuffer, pageNumber || 1, { dpi: 150, maxWidth: 2000 });
      return analyzeWithLoadBalancing(rasterized.base64, prompt, pageNumber, minQualityScore);
    } catch (rasterError: unknown) {
      // Canvas/native module not available - return direct result or empty
      const rasterErrMsg = rasterError instanceof Error ? rasterError.message : String(rasterError);
      logger.warn('SMART_ROUTING', 'Rasterization unavailable, returning direct result', { error: rasterErrMsg.substring(0, 50) });
      return directResult;
    }

  } else if (processingType === 'visual') {
    // VISUAL DOCUMENTS: Image processing first (better for drawings, plans, photos)
    logger.info('SMART_ROUTING', 'Visual document - Image-based processing');

    // Try true image rasterization for construction drawings (requires canvas native module)
    try {
      const { rasterizeSinglePage } = await import('./pdf-to-image-raster');
      const rasterized = await rasterizeSinglePage(pdfBuffer, pageNumber || 1, { dpi: 150, maxWidth: 2000 });

      const imageResult = await analyzeWithLoadBalancing(rasterized.base64, prompt, pageNumber, minQualityScore);

      if (imageResult.success && imageResult.content) {
        logger.info('SMART_ROUTING', 'Image processing succeeded', { quality: imageResult.confidenceScore });
        return imageResult;
      }

      // Fallback to direct PDF if image processing fails
      logger.warn('SMART_ROUTING', 'Image processing failed, trying direct PDF');
      return analyzeWithDirectPdf(pdfBase64, prompt, pageNumber, pageNumber, VISION_MODEL);
    } catch (rasterError: unknown) {
      // Canvas/native module not available (common in production/serverless)
      const rasterErrMsg = rasterError instanceof Error ? rasterError.message : String(rasterError);
      logger.warn('SMART_ROUTING', 'Rasterization unavailable, using direct PDF', { error: rasterErrMsg.substring(0, 50) });
      return analyzeWithDirectPdf(pdfBase64, prompt, pageNumber, pageNumber, VISION_MODEL);
    }

  } else {
    // MIXED/UNKNOWN: Try both methods, use best result
    logger.info('SMART_ROUTING', 'Mixed document - Trying both methods');

    // Try direct PDF first (faster, lower cost)
    const directResult = await analyzeWithDirectPdf(pdfBase64, prompt, pageNumber, pageNumber);

    if (directResult.success && directResult.content) {
      logger.info('SMART_ROUTING', 'Direct PDF succeeded', { quality: directResult.confidenceScore });
      return directResult;
    }

    // Direct PDF failed, try image-based processing with true rasterization
    logger.warn('SMART_ROUTING', 'Direct PDF failed, trying image rasterization');
    try {
      const { rasterizeSinglePage } = await import('./pdf-to-image-raster');
      const rasterized = await rasterizeSinglePage(pdfBuffer, pageNumber || 1, { dpi: 150, maxWidth: 2000 });

      const imageResult = await analyzeWithLoadBalancing(rasterized.base64, prompt, pageNumber, minQualityScore);

      // Return best result
      if (imageResult.success && (imageResult.confidenceScore || 0) > (directResult.confidenceScore || 0)) {
        logger.info('SMART_ROUTING', 'Image processing better', { imageQuality: imageResult.confidenceScore, directQuality: directResult.confidenceScore });
        return imageResult;
      }

      // Return direct result if image didn't improve
      return directResult.success ? directResult : imageResult;
    } catch (rasterError: unknown) {
      // Canvas/native module not available - return direct result
      const rasterErrMsg = rasterError instanceof Error ? rasterError.message : String(rasterError);
      logger.warn('SMART_ROUTING', 'Rasterization unavailable, returning direct result', { error: rasterErrMsg.substring(0, 50) });
      return directResult;
    }
  }
}

/**
 * Lightweight Opus-only fallback for the discipline pipeline.
 * Called after Gemini 2.5 Pro and GPT-5.2 have both failed.
 * Tries Opus twice (native PDF then rasterized image) and gives up.
 *
 * Unlike analyzeWithSmartRouting, this function:
 * - Does NOT retry GPT-5.2 (already tried in the discipline pipeline)
 * - Does NOT re-rasterize redundantly
 * - Limits Opus to 2 total attempts (not 9)
 */
export async function analyzeWithOpusFallback(
  pdfBuffer: Buffer,
  prompt: string,
  pageNumber?: number
): Promise<VisionResponse> {
  if (isCircuitOpen('claude-opus-4-6')) {
    logger.warn('VISION_API', 'Circuit breaker tripped for claude-opus-4-6, skipping Opus fallback');
    return { success: false, content: '', provider: 'claude-opus-4-6' as VisionProvider, attempts: 0, error: 'Circuit breaker open' };
  }

  logger.info('OPUS_FALLBACK', 'Opus-only fallback started (post Gemini + GPT-5.2 failure)', { pageNumber });

  // Attempt 1: Opus with native PDF (single attempt, 120s timeout)
  const pdfBase64 = pdfBuffer.toString('base64');
  const directResult = await analyzeWithDirectPdf(pdfBase64, prompt, pageNumber, pageNumber, undefined, 1);

  if (directResult.success && directResult.content) {
    logger.info('OPUS_FALLBACK', 'Opus native PDF succeeded', {
      confidence: directResult.confidenceScore,
      pageNumber,
    });
    return directResult;
  }

  logger.warn('OPUS_FALLBACK', 'Opus native PDF failed, trying rasterized image', {
    error: directResult.error,
    pageNumber,
  });

  // Attempt 2: Opus with rasterized image (single attempt)
  try {
    const { rasterizeSinglePage } = await import('./pdf-to-image-raster');
    const rasterized = await rasterizeSinglePage(pdfBuffer, pageNumber || 1, { dpi: 150, maxWidth: 2000 });

    const imageResult = await callClaudeOpusVision(rasterized.base64, prompt, 0);

    if (imageResult.success && imageResult.content) {
      const quality = validateQuality(imageResult.content);
      imageResult.confidenceScore = quality.score;

      logger.info('OPUS_FALLBACK', 'Opus rasterized image succeeded', {
        confidence: quality.score,
        pageNumber,
      });
      return imageResult;
    }

    logger.warn('OPUS_FALLBACK', 'Opus rasterized image also failed', {
      error: imageResult.error,
      pageNumber,
    });
    return imageResult;
  } catch (rasterError: unknown) {
    const errMsg = rasterError instanceof Error ? rasterError.message : String(rasterError);
    logger.error('OPUS_FALLBACK', 'Rasterization failed in fallback', rasterError as Error, { pageNumber });

    return {
      success: false,
      content: '',
      provider: 'claude-opus-4-6' as VisionProvider,
      attempts: 2,
      error: `Opus fallback failed: native PDF error: ${directResult.error}; rasterization error: ${errMsg}`,
      confidenceScore: 0,
    };
  }
}
