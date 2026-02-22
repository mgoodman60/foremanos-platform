/**
 * Multi-Provider Image Generation Abstraction
 *
 * Provides image generation with automatic fallback across multiple providers:
 * 1. Flux 2 Pro (Black Forest Labs) - Max quality for client presentation renders
 * 2. GPT Image 1.5 (OpenAI) - High quality for iterative refinement
 * 3. GPT Image 1 Mini (OpenAI) - Draft quality for quick wizard previews
 *
 * Features:
 * - Quality tier routing (draft / high / max)
 * - Automatic fallback when a provider is unavailable or fails
 * - Retry with exponential backoff (max 2 retries per provider)
 * - Duration and cost tracking
 */

import { createScopedLogger } from '@/lib/logger';

const log = createScopedLogger('RENDER_PROVIDER');

// Types
export type RenderQualityTier = 'draft' | 'high' | 'max';
export type ImageProvider = 'flux-2-pro' | 'gpt-image-1.5' | 'gpt-image-1-mini';

export interface RenderProviderConfig {
  id: ImageProvider;
  displayName: string;
  qualityTier: RenderQualityTier;
  maxRetries: number;
  baseDelayMs: number;
  costPerImage: number;
  supportsSizes: string[];
  supportsReferenceImages: boolean;
  maxPromptLength: number;
  envKeyName: string;
}

export interface ImageGenerationRequest {
  prompt: string;
  qualityTier: RenderQualityTier;
  size?: string;
  style?: string;
  sitePhotoBase64?: string;  // Base64-encoded site photo for compositing
  placementBounds?: { x: number; y: number; width: number; height: number }; // % of image
}

export interface ImageGenerationResponse {
  success: boolean;
  provider: ImageProvider;
  imageBase64?: string;
  imageUrl?: string;
  revisedPrompt?: string;
  error?: string;
  errorCode?: string;
  attempts: number;
  durationMs: number;
  estimatedCostUsd: number;
}

// Provider configurations
const PROVIDERS: RenderProviderConfig[] = [
  {
    id: 'flux-2-pro',
    displayName: 'Flux 2 Pro (Black Forest Labs)',
    qualityTier: 'max',
    maxRetries: 2,
    baseDelayMs: 1000,
    costPerImage: 0.04,
    supportsSizes: ['1024x1024', '1536x1024', '1024x1536'],
    supportsReferenceImages: false,
    maxPromptLength: 4096,
    envKeyName: 'BFL_API_KEY',
  },
  {
    id: 'gpt-image-1.5',
    displayName: 'GPT Image 1.5 (OpenAI)',
    qualityTier: 'high',
    maxRetries: 2,
    baseDelayMs: 1000,
    costPerImage: 0.04,
    supportsSizes: ['1024x1024', '1536x1024', '1024x1536'],
    supportsReferenceImages: true,
    maxPromptLength: 32000,
    envKeyName: 'OPENAI_API_KEY',
  },
  {
    id: 'gpt-image-1-mini',
    displayName: 'GPT Image 1 Mini (OpenAI)',
    qualityTier: 'draft',
    maxRetries: 2,
    baseDelayMs: 500,
    costPerImage: 0.01,
    supportsSizes: ['1024x1024', '1536x1024', '1024x1536'],
    supportsReferenceImages: false,
    maxPromptLength: 16000,
    envKeyName: 'OPENAI_API_KEY',
  },
];

// Fallback chain: max -> high -> draft
const FALLBACK_ORDER: RenderQualityTier[] = ['max', 'high', 'draft'];

const DEFAULT_SIZE = '1536x1024';

/**
 * Parse a size string like '1536x1024' into width and height
 */
function parseSize(size: string): { width: number; height: number } {
  const [w, h] = size.split('x').map(Number);
  return { width: w || 1024, height: h || 1024 };
}

/**
 * Get the provider config for a given provider ID
 */
function getConfig(id: ImageProvider): RenderProviderConfig {
  return PROVIDERS.find(p => p.id === id)!;
}

/**
 * Call Black Forest Labs Flux 2 Pro API
 */
export async function callFlux2Pro(
  prompt: string,
  size: string
): Promise<ImageGenerationResponse> {
  const config = getConfig('flux-2-pro');
  const apiKey = process.env.BFL_API_KEY;
  const start = Date.now();

  if (!apiKey) {
    return {
      success: false,
      provider: 'flux-2-pro',
      errorCode: 'not_configured',
      error: 'BFL_API_KEY not configured',
      attempts: 0,
      durationMs: Date.now() - start,
      estimatedCostUsd: 0,
    };
  }

  const { width, height } = parseSize(size);

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = config.baseDelayMs * Math.pow(2, attempt - 1);
        log.info(`Flux 2 Pro retry ${attempt}/${config.maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      log.info('Calling Flux 2 Pro', { width, height, attempt: attempt + 1 });

      const response = await fetch('https://api.bfl.ml/v1/flux-2-pro', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Key': apiKey,
        },
        body: JSON.stringify({ prompt, width, height, steps: 50 }),
      });

      if (!response.ok) {
        const text = await response.text();
        if (response.status === 429) {
          throw Object.assign(new Error(`Rate limited: ${text}`), { isRateLimit: true });
        }
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const data = await response.json();

      // Flux returns a task ID — poll for result
      const taskId = data.id;
      if (!taskId) {
        throw new Error('No task ID returned from Flux API');
      }

      // Poll for result (max 60s)
      let resultUrl: string | undefined;
      const pollStart = Date.now();
      while (Date.now() - pollStart < 60000) {
        const pollResponse = await fetch(`https://api.bfl.ml/v1/get_result?id=${taskId}`, {
          headers: { 'X-Key': apiKey },
        });

        if (!pollResponse.ok) {
          throw new Error(`Poll failed: HTTP ${pollResponse.status}`);
        }

        const pollData = await pollResponse.json();

        if (pollData.status === 'Ready' && pollData.result?.sample) {
          resultUrl = pollData.result.sample;
          break;
        } else if (pollData.status === 'Error') {
          throw new Error(`Flux generation failed: ${pollData.error || 'Unknown error'}`);
        }

        // Wait 1s between polls
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!resultUrl) {
        throw new Error('Flux generation timed out after 60s');
      }

      // Fetch the image and convert to base64
      const imageResponse = await fetch(resultUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch generated image: HTTP ${imageResponse.status}`);
      }

      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const imageBase64 = imageBuffer.toString('base64');

      log.info('Flux 2 Pro succeeded', { durationMs: Date.now() - start });

      return {
        success: true,
        provider: 'flux-2-pro',
        imageBase64,
        imageUrl: resultUrl,
        attempts: attempt + 1,
        durationMs: Date.now() - start,
        estimatedCostUsd: config.costPerImage,
      };
    } catch (err: unknown) {
      const isRateLimit = err instanceof Object && 'isRateLimit' in err && err.isRateLimit === true;
      const errMsg = err instanceof Error ? err.message : String(err);
      log.warn(`Flux 2 Pro attempt ${attempt + 1} failed`, {
        error: errMsg,
        isRateLimit,
      });

      if (attempt === config.maxRetries) {
        return {
          success: false,
          provider: 'flux-2-pro',
          error: errMsg,
          errorCode: isRateLimit ? 'rate_limit' : 'api_error',
          attempts: attempt + 1,
          durationMs: Date.now() - start,
          estimatedCostUsd: 0,
        };
      }
    }
  }

  // Unreachable, but TypeScript needs it
  return {
    success: false,
    provider: 'flux-2-pro',
    error: 'Unexpected failure',
    errorCode: 'api_error',
    attempts: config.maxRetries + 1,
    durationMs: Date.now() - start,
    estimatedCostUsd: 0,
  };
}

/**
 * Call OpenAI GPT Image generation API
 */
export async function callGPTImage(
  prompt: string,
  size: string,
  model: 'gpt-image-1.5' | 'gpt-image-1-mini'
): Promise<ImageGenerationResponse> {
  const config = getConfig(model);
  const apiKey = process.env.OPENAI_API_KEY;
  const start = Date.now();

  if (!apiKey) {
    return {
      success: false,
      provider: model,
      errorCode: 'not_configured',
      error: 'OPENAI_API_KEY not configured',
      attempts: 0,
      durationMs: Date.now() - start,
      estimatedCostUsd: 0,
    };
  }

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = config.baseDelayMs * Math.pow(2, attempt - 1);
        log.info(`${config.displayName} retry ${attempt}/${config.maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      log.info(`Calling ${config.displayName}`, { size, attempt: attempt + 1 });

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          size,
          quality: model === 'gpt-image-1.5' ? 'high' : 'low',
        }),
      });

      if (!response.ok) {
        const text = await response.text();

        // Parse OpenAI error for specific error codes
        let errorCode = 'api_error';
        try {
          const errBody = JSON.parse(text);
          const code = errBody.error?.code;
          if (code === 'content_policy_violation') {
            errorCode = 'content_policy';
          } else if (response.status === 429) {
            errorCode = 'rate_limit';
          }
        } catch {
          if (response.status === 429) {
            errorCode = 'rate_limit';
          }
        }

        // Content policy violations should not be retried
        if (errorCode === 'content_policy') {
          return {
            success: false,
            provider: model,
            error: `Content policy violation: ${text}`,
            errorCode: 'content_policy',
            attempts: attempt + 1,
            durationMs: Date.now() - start,
            estimatedCostUsd: 0,
          };
        }

        throw Object.assign(new Error(`HTTP ${response.status}: ${text}`), {
          errorCode,
        });
      }

      const data = await response.json();
      const imageData = data.data?.[0];
      const imageBase64 = imageData?.b64_json;
      const revisedPrompt = imageData?.revised_prompt;

      if (!imageBase64) {
        throw new Error('No image data returned from OpenAI');
      }

      log.info(`${config.displayName} succeeded`, { durationMs: Date.now() - start });

      return {
        success: true,
        provider: model,
        imageBase64,
        revisedPrompt,
        attempts: attempt + 1,
        durationMs: Date.now() - start,
        estimatedCostUsd: config.costPerImage,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const errCode = err instanceof Object && 'errorCode' in err ? (err as { errorCode?: string }).errorCode : undefined;
      log.warn(`${config.displayName} attempt ${attempt + 1} failed`, {
        error: errMsg,
      });

      if (attempt === config.maxRetries) {
        return {
          success: false,
          provider: model,
          error: errMsg,
          errorCode: errCode || 'api_error',
          attempts: attempt + 1,
          durationMs: Date.now() - start,
          estimatedCostUsd: 0,
        };
      }
    }
  }

  return {
    success: false,
    provider: model,
    error: 'Unexpected failure',
    errorCode: 'api_error',
    attempts: config.maxRetries + 1,
    durationMs: Date.now() - start,
    estimatedCostUsd: 0,
  };
}

/**
 * Returns only providers whose API keys are configured
 */
export function getAvailableProviders(): RenderProviderConfig[] {
  return PROVIDERS.filter(p => !!process.env[p.envKeyName]);
}

/**
 * Returns the best available provider for the requested tier.
 * Falls back down the chain if the preferred provider is not configured.
 */
export function getProviderForTier(tier: RenderQualityTier): ImageProvider | null {
  const startIndex = FALLBACK_ORDER.indexOf(tier);
  if (startIndex === -1) return null;

  for (let i = startIndex; i < FALLBACK_ORDER.length; i++) {
    const candidate = PROVIDERS.find(p => p.qualityTier === FALLBACK_ORDER[i]);
    if (candidate && process.env[candidate.envKeyName]) {
      return candidate.id;
    }
  }

  return null;
}

/**
 * Returns estimated cost for the given tier
 */
export function getCostEstimate(tier: RenderQualityTier): number {
  const provider = PROVIDERS.find(p => p.qualityTier === tier);
  return provider?.costPerImage ?? 0;
}

/**
 * Main entry point. Routes by qualityTier to the right provider.
 * If the primary provider fails, falls back to the next tier down.
 */
export async function generateImage(
  request: ImageGenerationRequest
): Promise<ImageGenerationResponse> {
  const { prompt, qualityTier, size = DEFAULT_SIZE, style } = request;
  const start = Date.now();

  log.info('Image generation requested', { qualityTier, size });

  // Build the prompt to send (include style if provided)
  const fullPrompt = style ? `${prompt}\n\nStyle: ${style}` : prompt;

  // Determine fallback chain starting from the requested tier
  const startIndex = FALLBACK_ORDER.indexOf(qualityTier);
  const tiersToTry = FALLBACK_ORDER.slice(startIndex >= 0 ? startIndex : 0);

  for (const tier of tiersToTry) {
    const provider = PROVIDERS.find(p => p.qualityTier === tier);
    if (!provider || !process.env[provider.envKeyName]) {
      log.info(`Skipping ${tier} tier — provider not configured`);
      continue;
    }

    // Truncate prompt to provider max length
    const truncatedPrompt =
      fullPrompt.length > provider.maxPromptLength
        ? fullPrompt.slice(0, provider.maxPromptLength)
        : fullPrompt;

    let result: ImageGenerationResponse;

    if (provider.id === 'flux-2-pro') {
      result = await callFlux2Pro(truncatedPrompt, size);
    } else {
      result = await callGPTImage(truncatedPrompt, size, provider.id as 'gpt-image-1.5' | 'gpt-image-1-mini');
    }

    if (result.success) {
      result.durationMs = Date.now() - start;
      log.info('Image generation succeeded', {
        provider: result.provider,
        tier,
        durationMs: result.durationMs,
        cost: result.estimatedCostUsd,
      });
      return result;
    }

    // Don't fall back on content policy — the prompt itself is the problem
    if (result.errorCode === 'content_policy') {
      log.warn('Content policy violation — not falling back', { provider: result.provider });
      result.durationMs = Date.now() - start;
      return result;
    }

    log.warn(`${provider.displayName} failed, trying next tier`, {
      error: result.error,
      errorCode: result.errorCode,
    });
  }

  // All providers exhausted
  log.error('All providers failed');
  return {
    success: false,
    provider: PROVIDERS[PROVIDERS.length - 1].id,
    error: 'All image generation providers failed',
    errorCode: 'api_error',
    attempts: 0,
    durationMs: Date.now() - start,
    estimatedCostUsd: 0,
  };
}

/**
 * Generate a render composited onto a site photo.
 * Uses OpenAI's image editing API to place the rendered building onto the real site.
 *
 * Flow:
 * 1. If placementBounds provided, create a mask from the bounds
 * 2. Call OpenAI's image edit API with the site photo + mask + prompt
 * 3. If no bounds, use "auto" placement (AI determines best placement)
 *
 * Only GPT-Image-1.5 supports image editing — falls back to standalone if unavailable.
 */
export async function generateWithSitePhoto(
  request: ImageGenerationRequest & {
    sitePhotoBase64: string;
    placementBounds?: { x: number; y: number; width: number; height: number };
  }
): Promise<ImageGenerationResponse> {
  const { prompt, sitePhotoBase64, placementBounds, size = DEFAULT_SIZE } = request;
  const start = Date.now();
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    log.warn('OpenAI API key not configured — falling back to standalone generation');
    return generateImage(request);
  }

  log.info('Site photo composite requested', {
    hasPlacement: !!placementBounds,
    size,
  });

  try {
    // Build the composite prompt
    const compositePrompt = `Place the following building onto this construction site photo, maintaining the existing site context (trees, terrain, surroundings). ${prompt}. The rendering should look naturally integrated with the site — matching lighting, perspective, and scale. Keep existing landscape elements visible.`;

    // Create mask if placement bounds provided
    let maskBase64: string | undefined;
    if (placementBounds) {
      // Create a simple mask: white rectangle at placement bounds, black elsewhere
      // We'll create a basic PNG mask using canvas-like approach
      maskBase64 = createPlacementMask(placementBounds, size);
    }

    // Use OpenAI's image edit endpoint
    const formData = new FormData();

    // Convert base64 site photo to blob
    const sitePhotoBuffer = Buffer.from(sitePhotoBase64, 'base64');
    const sitePhotoBlob = new Blob([sitePhotoBuffer], { type: 'image/png' });
    formData.append('image', sitePhotoBlob, 'site.png');

    if (maskBase64) {
      const maskBuffer = Buffer.from(maskBase64, 'base64');
      const maskBlob = new Blob([maskBuffer], { type: 'image/png' });
      formData.append('mask', maskBlob, 'mask.png');
    }

    formData.append('prompt', compositePrompt);
    formData.append('model', 'gpt-image-1.5');
    formData.append('n', '1');
    formData.append('size', size);

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.warn('Site composite API call failed', { status: response.status, error: errorText });

      // Check for content policy
      try {
        const errBody = JSON.parse(errorText);
        if (errBody.error?.code === 'content_policy_violation') {
          return {
            success: false,
            provider: 'gpt-image-1.5',
            error: 'Content policy violation during site compositing',
            errorCode: 'content_policy',
            attempts: 1,
            durationMs: Date.now() - start,
            estimatedCostUsd: 0,
          };
        }
      } catch { /* ignore parse error */ }

      // Fallback to standalone generation
      log.info('Falling back to standalone generation after composite failure');
      return generateImage(request);
    }

    const data = await response.json();
    const imageData = data.data?.[0];
    const imageBase64 = imageData?.b64_json;

    if (!imageBase64) {
      log.warn('No image data in composite response — falling back to standalone');
      return generateImage(request);
    }

    log.info('Site composite succeeded', { durationMs: Date.now() - start });

    return {
      success: true,
      provider: 'gpt-image-1.5',
      imageBase64,
      revisedPrompt: imageData?.revised_prompt,
      attempts: 1,
      durationMs: Date.now() - start,
      estimatedCostUsd: 0.08, // Image edits cost ~2x standard generation
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error('Site composite failed', { error: errMsg });

    // Graceful fallback to standalone
    log.info('Falling back to standalone generation');
    return generateImage(request);
  }
}

/**
 * Create a simple placement mask from bounds (white = edit area, transparent = keep).
 * Creates a minimal valid PNG with the placement rectangle.
 * Uses raw PNG encoding to avoid canvas dependencies.
 */
function createPlacementMask(
  bounds: { x: number; y: number; width: number; height: number },
  sizeStr: string
): string {
  const { width: imgW, height: imgH } = parseSize(sizeStr);

  // Calculate pixel bounds from percentage bounds
  const px = Math.round((bounds.x / 100) * imgW);
  const py = Math.round((bounds.y / 100) * imgH);
  const pw = Math.round((bounds.width / 100) * imgW);
  const ph = Math.round((bounds.height / 100) * imgH);

  // Create RGBA pixel data (4 bytes per pixel)
  // Black (transparent) everywhere, white (opaque) in the placement area
  const pixels = Buffer.alloc(imgW * imgH * 4, 0); // All zeros = transparent black

  for (let y = py; y < Math.min(py + ph, imgH); y++) {
    for (let x = px; x < Math.min(px + pw, imgW); x++) {
      const offset = (y * imgW + x) * 4;
      pixels[offset] = 255;     // R
      pixels[offset + 1] = 255; // G
      pixels[offset + 2] = 255; // B
      pixels[offset + 3] = 255; // A
    }
  }

  // Encode as minimal PNG
  // PNG header
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(imgW, 0);
  ihdrData.writeUInt32BE(imgH, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = createPNGChunk('IHDR', ihdrData);

  // IDAT chunk - raw pixel data with filter bytes
  const rawData = Buffer.alloc(imgH * (1 + imgW * 4)); // +1 filter byte per row
  for (let y = 0; y < imgH; y++) {
    const rowOffset = y * (1 + imgW * 4);
    rawData[rowOffset] = 0; // No filter
    pixels.copy(rawData, rowOffset + 1, y * imgW * 4, (y + 1) * imgW * 4);
  }

  // Use zlib to deflate
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(rawData);
  const idat = createPNGChunk('IDAT', compressed);

  // IEND chunk
  const iend = createPNGChunk('IEND', Buffer.alloc(0));

  const png = Buffer.concat([pngSignature, ihdr, idat, iend]);
  return png.toString('base64');
}

/**
 * Create a PNG chunk with CRC
 */
function createPNGChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  // CRC32 of type + data
  const crcInput = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

/**
 * Simple CRC32 implementation for PNG chunks
 */
function crc32(buf: Buffer): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
