/**
 * Tests for lib/render-provider.ts
 *
 * Covers provider config helpers, OpenAI GPT-Image calls, Flux 2 Pro calls,
 * fallback chain, retry logic, cost tracking, and duration tracking.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal('fetch', mockFetch);

// Reset modules between tests so env var changes take effect
beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// Helper to load the module fresh (picks up env stubs)
async function loadModule() {
  return await import('@/lib/render-provider');
}

// ─── Provider Config ────────────────────────────────────────────────────────

describe('getAvailableProviders', () => {
  it('returns empty when no API keys are set', async () => {
    const mod = await loadModule();
    expect(mod.getAvailableProviders()).toEqual([]);
  });

  it('returns OpenAI providers when OPENAI_API_KEY is set', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
    const mod = await loadModule();
    const available = mod.getAvailableProviders();
    const ids = available.map(p => p.id);
    expect(ids).toContain('gpt-image-1.5');
    expect(ids).toContain('gpt-image-1-mini');
    expect(ids).not.toContain('flux-2-pro');
  });

  it('returns Flux provider when BFL_API_KEY is set', async () => {
    vi.stubEnv('BFL_API_KEY', 'test-bfl-key');
    const mod = await loadModule();
    const available = mod.getAvailableProviders();
    const ids = available.map(p => p.id);
    expect(ids).toContain('flux-2-pro');
    expect(ids).not.toContain('gpt-image-1.5');
  });

  it('returns all providers when both keys are set', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
    vi.stubEnv('BFL_API_KEY', 'test-bfl-key');
    const mod = await loadModule();
    expect(mod.getAvailableProviders()).toHaveLength(3);
  });
});

describe('getProviderForTier', () => {
  it('returns null when no providers are configured', async () => {
    const mod = await loadModule();
    expect(mod.getProviderForTier('max')).toBeNull();
    expect(mod.getProviderForTier('high')).toBeNull();
    expect(mod.getProviderForTier('draft')).toBeNull();
  });

  it('returns flux-2-pro for max tier when BFL key is set', async () => {
    vi.stubEnv('BFL_API_KEY', 'test-bfl-key');
    const mod = await loadModule();
    expect(mod.getProviderForTier('max')).toBe('flux-2-pro');
  });

  it('falls back to gpt-image-1.5 for max tier when BFL key is missing', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
    const mod = await loadModule();
    expect(mod.getProviderForTier('max')).toBe('gpt-image-1.5');
  });

  it('returns gpt-image-1.5 for high tier', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
    const mod = await loadModule();
    expect(mod.getProviderForTier('high')).toBe('gpt-image-1.5');
  });

  it('returns gpt-image-1-mini for draft tier', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
    const mod = await loadModule();
    expect(mod.getProviderForTier('draft')).toBe('gpt-image-1-mini');
  });
});

describe('getCostEstimate', () => {
  it('returns correct cost for each tier', async () => {
    const mod = await loadModule();
    expect(mod.getCostEstimate('max')).toBe(0.04);
    expect(mod.getCostEstimate('high')).toBe(0.04);
    expect(mod.getCostEstimate('draft')).toBe(0.01);
  });
});

// ─── GPT Image Calls ────────────────────────────────────────────────────────

describe('callGPTImage', () => {
  it('returns not_configured when OPENAI_API_KEY is missing', async () => {
    const mod = await loadModule();
    const result = await mod.callGPTImage('test prompt', '1024x1024', 'gpt-image-1.5');
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('not_configured');
    expect(result.attempts).toBe(0);
  });

  it('returns image on success', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ b64_json: 'base64imagedata', revised_prompt: 'improved prompt' }],
      }),
    });

    const mod = await loadModule();
    const result = await mod.callGPTImage('a house', '1024x1024', 'gpt-image-1.5');

    expect(result.success).toBe(true);
    expect(result.provider).toBe('gpt-image-1.5');
    expect(result.imageBase64).toBe('base64imagedata');
    expect(result.revisedPrompt).toBe('improved prompt');
    expect(result.attempts).toBe(1);
    expect(result.estimatedCostUsd).toBe(0.04);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns content_policy error without retrying', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: { code: 'content_policy_violation', message: 'blocked' } }),
    });

    const mod = await loadModule();
    const result = await mod.callGPTImage('bad prompt', '1024x1024', 'gpt-image-1.5');

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('content_policy');
    expect(result.attempts).toBe(1);
    // Should NOT have retried — only 1 fetch call
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries on rate limit then fails', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');

    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ error: { code: 'rate_limit', message: 'too many' } }),
    });

    const mod = await loadModule();
    const result = await mod.callGPTImage('prompt', '1024x1024', 'gpt-image-1.5');

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('rate_limit');
    // Initial + 2 retries = 3 total
    expect(result.attempts).toBe(3);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('retries on API error and succeeds on second attempt', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');

    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ b64_json: 'recovered', revised_prompt: null }],
        }),
      });

    const mod = await loadModule();
    const result = await mod.callGPTImage('prompt', '1024x1024', 'gpt-image-1-mini');

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.provider).toBe('gpt-image-1-mini');
    expect(result.estimatedCostUsd).toBe(0.01);
  });

  it('sends correct quality param for each model', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: 'img' }] }),
    });

    const mod = await loadModule();

    await mod.callGPTImage('p', '1024x1024', 'gpt-image-1.5');
    const call1Body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(call1Body.quality).toBe('high');

    mockFetch.mockClear();

    await mod.callGPTImage('p', '1024x1024', 'gpt-image-1-mini');
    const call2Body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(call2Body.quality).toBe('low');
  });
});

// ─── Flux 2 Pro Calls ───────────────────────────────────────────────────────

describe('callFlux2Pro', () => {
  it('returns not_configured when BFL_API_KEY is missing', async () => {
    const mod = await loadModule();
    const result = await mod.callFlux2Pro('test prompt', '1024x1024');
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('not_configured');
    expect(result.attempts).toBe(0);
  });

  it('returns image on success with polling', async () => {
    vi.stubEnv('BFL_API_KEY', 'test-bfl-key');

    // 1st call: POST to start generation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'task-123' }),
    });

    // 2nd call: poll — not ready yet
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'Pending' }),
    });

    // 3rd call: poll — ready
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'Ready', result: { sample: 'https://cdn.bfl.ml/image.png' } }),
    });

    // 4th call: fetch the image
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode('fakepngbytes').buffer,
    });

    const mod = await loadModule();
    const result = await mod.callFlux2Pro('architectural render', '1536x1024');

    expect(result.success).toBe(true);
    expect(result.provider).toBe('flux-2-pro');
    expect(result.imageBase64).toBeTruthy();
    expect(result.imageUrl).toBe('https://cdn.bfl.ml/image.png');
    expect(result.estimatedCostUsd).toBe(0.04);
    expect(result.attempts).toBe(1);
  });

  it('handles Flux API error', async () => {
    vi.stubEnv('BFL_API_KEY', 'test-bfl-key');

    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Server Error',
    });

    const mod = await loadModule();
    const result = await mod.callFlux2Pro('prompt', '1024x1024');

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('api_error');
    // Initial + 2 retries = 3
    expect(result.attempts).toBe(3);
  });

  it('handles Flux generation error during polling', async () => {
    vi.stubEnv('BFL_API_KEY', 'test-bfl-key');

    // Each retry attempt: POST to start, then poll returns Error
    // Attempt 1
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'task-456' }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'Error', error: 'NSFW content detected' }),
    });
    // Attempt 2 (retry 1)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'task-457' }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'Error', error: 'NSFW content detected' }),
    });
    // Attempt 3 (retry 2)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'task-458' }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'Error', error: 'NSFW content detected' }),
    });

    const mod = await loadModule();
    const result = await mod.callFlux2Pro('prompt', '1024x1024');

    expect(result.success).toBe(false);
    expect(result.error).toContain('NSFW content detected');
  });
});

// ─── Fallback Chain (generateImage) ─────────────────────────────────────────

describe('generateImage', () => {
  it('falls back from max to high when BFL is not configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ b64_json: 'fallback-img' }] }),
    });

    const mod = await loadModule();
    const result = await mod.generateImage({
      prompt: 'render',
      qualityTier: 'max',
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('gpt-image-1.5');
  });

  it('falls back from high to draft when gpt-image-1.5 fails', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');

    // gpt-image-1.5 fails (3 attempts: initial + 2 retries)
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'error' })
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'error' })
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'error' });

    // gpt-image-1-mini succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ b64_json: 'draft-img' }] }),
    });

    const mod = await loadModule();
    const result = await mod.generateImage({
      prompt: 'render',
      qualityTier: 'high',
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('gpt-image-1-mini');
  });

  it('does not fall back on content_policy error', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: { code: 'content_policy_violation', message: 'blocked' } }),
    });

    const mod = await loadModule();
    const result = await mod.generateImage({
      prompt: 'inappropriate content',
      qualityTier: 'high',
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('content_policy');
    // Should not have tried gpt-image-1-mini
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns failure when all providers fail', async () => {
    // No keys configured
    const mod = await loadModule();
    const result = await mod.generateImage({
      prompt: 'render',
      qualityTier: 'draft',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('All image generation providers failed');
  });

  it('uses default landscape size when none specified', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ b64_json: 'img' }] }),
    });

    const mod = await loadModule();
    await mod.generateImage({ prompt: 'render', qualityTier: 'draft' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.size).toBe('1536x1024');
  });

  it('includes style in prompt when provided', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ b64_json: 'img' }] }),
    });

    const mod = await loadModule();
    await mod.generateImage({
      prompt: 'modern kitchen',
      qualityTier: 'draft',
      style: 'photorealistic',
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.prompt).toContain('modern kitchen');
    expect(body.prompt).toContain('Style: photorealistic');
  });

  it('tracks total duration across fallback attempts', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
    vi.stubEnv('BFL_API_KEY', 'test-bfl-key');

    // Flux fails
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'err' });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'err' });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'err' });

    // GPT-Image-1.5 succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ b64_json: 'img' }] }),
    });

    const mod = await loadModule();
    const result = await mod.generateImage({ prompt: 'render', qualityTier: 'max' });

    expect(result.success).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
