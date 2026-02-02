/**
 * Multi-Provider Vision API Wrapper
 *
 * Provides resilient vision processing with automatic fallback across multiple providers:
 * 1. GPT-4o (OpenAI) - Primary, highest quality
 * 2. Claude 4.5 Sonnet (Anthropic) - Equal/better quality, different infrastructure
 *
 * Features:
 * - Automatic provider switching on errors
 * - Quality validation with confidence scoring
 * - Provider performance tracking
 * - Per-provider rate limiting
 *
 * Updated Feb 2026: Switched from Abacus AI proxy to direct OpenAI API
 */

import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';

// Provider types (using direct OpenAI + Anthropic)
export type VisionProvider = 'gpt-4o' | 'claude-3.5-sonnet';

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
}

interface QualityMetrics {
  hasSheetNumber: boolean;
  hasContent: boolean;
  hasStructuredData: boolean;
  contentLength: number;
  score: number; // 0-100
}

// Provider configurations (Updated Feb 2026 - direct OpenAI)
const PROVIDERS: ProviderConfig[] = [
  {
    name: 'gpt-4o',
    displayName: 'GPT-4o (OpenAI)',
    maxRetries: 3,
    baseDelay: 1000,
  },
  {
    name: 'claude-3.5-sonnet',
    displayName: 'Claude Sonnet 4.5 (Anthropic)',
    maxRetries: 3,
    baseDelay: 1000,
  },
];

// Load API secrets - checks environment variables first, then falls back to secrets file
// Note: Gemini removed (Jan 2026) - OpenAI + Anthropic provide complete coverage
function getApiSecrets() {
  // Priority 1: Environment variables (works in production)
  const envAnthropicKey = process.env.ANTHROPIC_API_KEY;
  const envOpenaiKey = process.env.OPENAI_API_KEY;

  if (envAnthropicKey || envOpenaiKey) {
    logger.info('API_SECRETS', 'Using environment variables');
    return {
      anthropic: envAnthropicKey || null,
      openai: envOpenaiKey || null,
    };
  }

  // Priority 2: Secrets file (works in development)
  try {
    const secretsPath = '/home/ubuntu/.config/abacusai_auth_secrets.json';
    if (!fs.existsSync(secretsPath)) {
      logger.warn('API_SECRETS', 'No env vars and secrets file not found');
      return {};
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
    };
  } catch (error) {
    logger.error('API_SECRETS', 'Error loading API secrets', error);
    return {};
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
function isPdfContent(base64: string): boolean {
  // PDF magic number in base64: "JVBERi" which is %PDF-
  return base64.startsWith('JVBERi') || base64.substring(0, 20).includes('JVBERi');
}

// Call OpenAI GPT-4o (primary vision model)
async function callOpenAIVision(
  imageBase64: string,
  prompt: string,
  retryCount: number = 0
): Promise<VisionResponse> {
  const config = PROVIDERS[0];
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      content: '',
      provider: 'gpt-4o',
      attempts: retryCount + 1,
      error: 'OPENAI_API_KEY not configured',
    };
  }

  try {
    // Detect content type - PDF or image
    const isPdf = isPdfContent(imageBase64);
    const mimeType = isPdf ? 'application/pdf' : 'image/jpeg';
    
    // Add timeout for faster failover in dev environment (where Abacus AI may not be accessible)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout for PDFs
    
    // Build the content array based on content type
    const contentArray: any[] = [{ type: 'text', text: prompt }];
    
    if (isPdf) {
      // For PDFs, use file content type
      contentArray.push({
        type: 'file',
        file: {
          filename: 'page.pdf',
          file_data: `data:application/pdf;base64,${imageBase64}`,
        },
      });
    } else {
      // For images, use image_url type
      contentArray.push({
        type: 'image_url',
        image_url: { url: `data:${mimeType};base64,${imageBase64}` },
      });
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: contentArray,
          },
        ],
        max_tokens: 4000,
        temperature: 0.1,
      }),
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

    if (!content) {
      throw new Error('Empty response from API');
    }

    return {
      success: true,
      content,
      provider: 'gpt-4o',
      attempts: retryCount + 1,
    };
  } catch (error: any) {
    const isCloudflare = error.message === 'CLOUDFLARE_BLOCK';
    const isTimeout = error.name === 'AbortError';
    const isNetworkError = error.message?.includes('fetch failed') || error.message?.includes('ENOTFOUND');
    
    // Don't retry on Cloudflare blocks - immediately switch provider
    if (isCloudflare) {
      logger.info('VISION_API', `${config.displayName}: Cloudflare block detected, switching provider`);
      return {
        success: false,
        content: '',
        provider: 'gpt-4o',
        attempts: retryCount + 1,
        error: 'CLOUDFLARE_BLOCK',
      };
    }
    
    // Don't retry on network errors/timeouts in dev - immediately switch to fallback
    if (isTimeout || isNetworkError) {
      const errorType = isTimeout ? 'timeout' : 'network error';
      logger.info('VISION_API', `${config.displayName}: ${errorType} detected (expected in dev), switching provider`);
      return {
        success: false,
        content: '',
        provider: 'gpt-4o',
        attempts: retryCount + 1,
        error: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      };
    }

    // Retry on other errors
    if (retryCount < config.maxRetries) {
      const delay = config.baseDelay * Math.pow(2, retryCount);
      logger.info('VISION_API', `${config.displayName}: Retry ${retryCount + 1}/${config.maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callOpenAIVision(imageBase64, prompt, retryCount + 1);
    }

    return {
      success: false,
      content: '',
      provider: 'gpt-4o',
      attempts: retryCount + 1,
      error: error.message,
    };
  }
}

// Call Anthropic Claude
async function callAnthropic(
  imageBase64: string,
  prompt: string,
  retryCount: number = 0
): Promise<VisionResponse> {
  const config = PROVIDERS[1];
  const secrets = getApiSecrets();
  const apiKey = secrets.anthropic;
  
  if (!apiKey) {
    return {
      success: false,
      content: '',
      provider: 'claude-3.5-sonnet',
      attempts: retryCount + 1,
      error: 'Anthropic API key not configured',
    };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20251101', // Claude Sonnet 4.5 - Latest & Best
        max_tokens: 4000,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    const content = data.content?.[0]?.text || '';

    if (!content) {
      throw new Error('Empty response from API');
    }

    return {
      success: true,
      content,
      provider: 'claude-3.5-sonnet',
      attempts: retryCount + 1,
    };
  } catch (error: any) {
    // Retry on errors
    if (retryCount < config.maxRetries) {
      const delay = config.baseDelay * Math.pow(2, retryCount);
      logger.info('VISION_API', `${config.displayName}: Retry ${retryCount + 1}/${config.maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callAnthropic(imageBase64, prompt, retryCount + 1);
    }

    return {
      success: false,
      content: '',
      provider: 'claude-3.5-sonnet',
      attempts: retryCount + 1,
      error: error.message,
    };
  }
}

// Call OpenAI GPT-4 Vision (Gemini removed Jan 2026)
async function callOpenAI(
  imageBase64: string,
  prompt: string,
  retryCount: number = 0
): Promise<VisionResponse> {
  const config = PROVIDERS[2]; // Updated index after Gemini removal
  const secrets = getApiSecrets();
  const apiKey = secrets.openai;
  
  if (!apiKey) {
    return {
      success: false,
      content: '',
      provider: 'gpt-4o',
      attempts: retryCount + 1,
      error: 'OpenAI API key not configured',
    };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Updated from deprecated gpt-4-vision-preview
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
        max_tokens: 4000,
        temperature: 0.1,
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    const content = data.choices?.[0]?.message?.content || '';

    if (!content) {
      throw new Error('Empty response from API');
    }

    return {
      success: true,
      content,
      provider: 'gpt-4o',
      attempts: retryCount + 1,
    };
  } catch (error: any) {
    // Retry on errors
    if (retryCount < config.maxRetries) {
      const delay = config.baseDelay * Math.pow(2, retryCount);
      logger.info('VISION_API', `${config.displayName}: Retry ${retryCount + 1}/${config.maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callOpenAI(imageBase64, prompt, retryCount + 1);
    }

    return {
      success: false,
      content: '',
      provider: 'gpt-4o',
      attempts: retryCount + 1,
      error: error.message,
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
    callOpenAIVision,
    callAnthropic,
    callOpenAI,
  ];

  // Get primary provider using round-robin
  const primaryIndex = getNextProviderIndex();
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
  } catch (error: any) {
    logger.error('VISION_API', `${primaryConfig.displayName} error`, error);
  }

  // Primary failed - fall back to sequential failover
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
  minQualityScore: number = 50
): Promise<VisionResponse> {
  logger.info('VISION_API', 'Multi-Provider Vision Analysis Started');

  const providerFunctions = [
    callOpenAIVision,
    callAnthropic,
    callOpenAI,
  ];

  let lastError = '';
  let totalAttempts = 0;

  for (let i = 0; i < providerFunctions.length; i++) {
    const providerFn = providerFunctions[i];
    const config = PROVIDERS[i];

    logger.info('VISION_API', `Trying provider ${i + 1}/${providerFunctions.length}`, { provider: config.displayName });
    
    try {
      const result = await providerFn(imageBase64, prompt);
      totalAttempts += result.attempts;

      if (result.success && result.content) {
        // Validate quality
        const quality = validateQuality(result.content);
        result.confidenceScore = quality.score;

        logger.info('VISION_API', `${config.displayName} succeeded`, {
          confidence: quality.score,
          hasSheetNumber: quality.hasSheetNumber,
          hasContent: quality.hasContent,
          contentLength: quality.contentLength,
          hasStructuredData: quality.hasStructuredData,
        });

        // Check if quality meets threshold
        if (quality.score >= minQualityScore) {
          logger.info('VISION_API', `Quality check passed, using ${config.displayName} response - Analysis Complete`);
          return result;
        } else {
          logger.warn('VISION_API', `Quality score ${quality.score} below threshold ${minQualityScore}, trying next provider`);
          lastError = `Low quality response (score: ${quality.score})`;
        }
      } else {
        logger.warn('VISION_API', `${config.displayName} failed`, { error: result.error });
        lastError = result.error || 'Unknown error';

        // If Cloudflare block, immediately try next provider
        if (result.error === 'CLOUDFLARE_BLOCK') {
          continue;
        }
      }
    } catch (error: any) {
      logger.error('VISION_API', `${config.displayName} threw error`, error);
      lastError = error.message;
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
    provider: 'gpt-4o', // Last attempted
    attempts: totalAttempts,
    error: `All providers failed. Last error: ${lastError}`,
    confidenceScore: 0,
  };
}

// Helper function to get provider display name
export function getProviderDisplayName(provider: VisionProvider): string {
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
  endPage?: number
): Promise<VisionResponse> {
  logger.info('VISION_API', 'Direct PDF Analysis Started', { startPage: startPage || 1, endPage: endPage || 'all' });

  const secrets = getApiSecrets();
  const apiKey = secrets.anthropic;

  if (!apiKey) {
    logger.warn('VISION_API', 'Anthropic API key not configured, falling back to image-based processing');
    return {
      success: false,
      content: '',
      provider: 'claude-3.5-sonnet',
      attempts: 1,
      error: 'Anthropic API key not configured for direct PDF processing',
    };
  }

  const maxRetries = 3;
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
    } catch (extractError: any) {
      logger.warn('DIRECT_PDF', `Could not extract single page, using full PDF`, { error: extractError.message });
    }
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      logger.info('DIRECT_PDF', `Attempt ${attempt + 1}/${maxRetries} using Claude Sonnet 4`);
      
      // Enhanced page instruction
      let pageInstruction = '';
      if (startPage !== undefined && endPage !== undefined && startPage !== endPage) {
        pageInstruction = `\n\nFocus specifically on page ${startPage} to ${endPage} of this document.`;
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20251101',
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
        }),
      });

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

      if (!content) {
        throw new Error('Empty response from API');
      }

      // Validate quality
      const quality = validateQuality(content);

      logger.info('DIRECT_PDF', `Analysis succeeded - Direct PDF Analysis Complete`, { confidence: quality.score });

      return {
        success: true,
        content,
        provider: 'claude-3.5-sonnet',
        attempts: attempt + 1,
        confidenceScore: quality.score,
      };
    } catch (error: any) {
      lastError = error.message;
      logger.error('DIRECT_PDF', `Attempt ${attempt + 1} failed`, error);

      // Check if this is an unrecoverable error
      const isUnrecoverable =
        error.message.includes('invalid_request') ||
        error.message.includes('document') ||
        error.message.includes('too large') ||
        error.message.includes('413');

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
    provider: 'claude-3.5-sonnet',
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
    case 'gpt-4o-vision':
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
  
  if (directResult.success && (directResult.confidenceScore || 0) >= minQualityScore) {
    logger.info('SMART_ANALYSIS', `Direct PDF succeeded`, { quality: directResult.confidenceScore });
    return directResult;
  }

  // If direct PDF failed or low quality, fall back to true image rasterization
  logger.info('SMART_ANALYSIS', 'Direct PDF failed or low quality, falling back to image rasterization');
  
  // Use true image rasterization for better vision AI compatibility
  try {
    const { rasterizeSinglePage } = await import('./pdf-to-image-raster');
    const rasterized = await rasterizeSinglePage(pdfBuffer, pageNumber || 1, { dpi: 150, maxWidth: 2000 });
    
    return analyzeWithLoadBalancing(rasterized.base64, prompt, pageNumber, minQualityScore);
  } catch (rasterError: any) {
    // Canvas/native module not available - return direct result
    logger.warn('SMART_ANALYSIS', 'Rasterization unavailable, returning direct result', { error: rasterError.message?.substring(0, 50) });
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

    if (directResult.success && (directResult.confidenceScore || 0) >= minQualityScore) {
      logger.info('SMART_ROUTING', 'Direct PDF succeeded', { quality: directResult.confidenceScore });
      return directResult;
    }

    // Fallback to image if direct PDF fails - use true image rasterization
    logger.warn('SMART_ROUTING', 'Direct PDF failed/low quality, falling back to image rasterization');
    try {
      const { rasterizeSinglePage } = await import('./pdf-to-image-raster');
      const rasterized = await rasterizeSinglePage(pdfBuffer, pageNumber || 1, { dpi: 150, maxWidth: 2000 });
      return analyzeWithLoadBalancing(rasterized.base64, prompt, pageNumber, minQualityScore);
    } catch (rasterError: any) {
      // Canvas/native module not available - return direct result or empty
      logger.warn('SMART_ROUTING', 'Rasterization unavailable, returning direct result', { error: rasterError.message?.substring(0, 50) });
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

      if (imageResult.success && (imageResult.confidenceScore || 0) >= minQualityScore) {
        logger.info('SMART_ROUTING', 'Image processing succeeded', { quality: imageResult.confidenceScore });
        return imageResult;
      }

      // Fallback to direct PDF if image processing fails
      logger.warn('SMART_ROUTING', 'Image processing failed/low quality, trying direct PDF');
      return analyzeWithDirectPdf(pdfBase64, prompt, pageNumber, pageNumber);
    } catch (rasterError: any) {
      // Canvas/native module not available (common in production/serverless)
      logger.warn('SMART_ROUTING', 'Rasterization unavailable, using direct PDF', { error: rasterError.message?.substring(0, 50) });
      return analyzeWithDirectPdf(pdfBase64, prompt, pageNumber, pageNumber);
    }

  } else {
    // MIXED/UNKNOWN: Try both methods, use best result
    logger.info('SMART_ROUTING', 'Mixed document - Trying both methods');

    // Try direct PDF first (faster, lower cost)
    const directResult = await analyzeWithDirectPdf(pdfBase64, prompt, pageNumber, pageNumber);

    if (directResult.success && (directResult.confidenceScore || 0) >= minQualityScore) {
      logger.info('SMART_ROUTING', 'Direct PDF succeeded', { quality: directResult.confidenceScore });
      return directResult;
    }

    // Try image-based processing with true rasterization
    logger.warn('SMART_ROUTING', 'Direct PDF insufficient, trying image rasterization');
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
    } catch (rasterError: any) {
      // Canvas/native module not available - return direct result
      logger.warn('SMART_ROUTING', 'Rasterization unavailable, returning direct result', { error: rasterError.message?.substring(0, 50) });
      return directResult;
    }
  }
}
