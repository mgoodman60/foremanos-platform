import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

// Mock PREMIUM_MODEL constant
vi.mock('@/lib/model-config', () => ({
  PREMIUM_MODEL: 'claude-opus-4-6',
}));

// ---------------------------------------------------------------------------
// Global fetch mock
// ---------------------------------------------------------------------------

// We define the mock fetch at module scope so individual tests can control it
const mockFetch = vi.fn();

// Import after mocking
import { interpretWithFallback, callOpusInterpretation, callGPT52Interpretation } from '@/lib/interpretation-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAnthropicSuccessResponse(content: string) {
  return {
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue(JSON.stringify({
      content: [{ text: content }],
    })),
  };
}

function makeOpenAISuccessResponse(content: string) {
  return {
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue(JSON.stringify({
      choices: [{ message: { content } }],
    })),
  };
}

function makeErrorResponse(status: number, body: string) {
  return {
    ok: false,
    status,
    text: vi.fn().mockResolvedValue(body),
  };
}

const VALID_JSON_CONTENT = JSON.stringify({
  sheetNumber: 'A-101',
  sheetTitle: 'Floor Plan',
  _overallConfidence: 0.85,
  _corrections: [],
  _enrichments: ['Added discipline'],
  _validationIssues: [],
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('interpretWithFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Replace global fetch with mock
    vi.stubGlobal('fetch', mockFetch);
    // Set required env vars
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  describe('Opus first path', () => {
    it('calls Opus (Anthropic) first and returns its result on success', async () => {
      mockFetch.mockResolvedValueOnce(makeAnthropicSuccessResponse(VALID_JSON_CONTENT));

      const result = await interpretWithFallback(VALID_JSON_CONTENT, 1);

      expect(result.interpretationProvider).toBe('claude-opus-4-6');
      expect(result.processingTier).toBe('correction');
      expect(result.content).toBeTruthy();
    });

    it('parses and returns the Opus JSON content', async () => {
      mockFetch.mockResolvedValueOnce(makeAnthropicSuccessResponse(VALID_JSON_CONTENT));

      const result = await interpretWithFallback(VALID_JSON_CONTENT, 2);

      const parsed = JSON.parse(result.content);
      expect(parsed.sheetNumber).toBe('A-101');
    });

    it('uses the custom tierPrefix in the processingTier', async () => {
      mockFetch.mockResolvedValueOnce(makeAnthropicSuccessResponse(VALID_JSON_CONTENT));

      const result = await interpretWithFallback(VALID_JSON_CONTENT, 1, { tierPrefix: 'trade-focused' });

      expect(result.processingTier).toBe('trade-focused');
    });

    it('passes additionalContext to the Opus prompt', async () => {
      mockFetch.mockResolvedValueOnce(makeAnthropicSuccessResponse(VALID_JSON_CONTENT));

      await interpretWithFallback(VALID_JSON_CONTENT, 1, {
        additionalContext: 'CORRECTION TASK: Fix missing sheet number',
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.messages[0].content).toContain('CORRECTION TASK: Fix missing sheet number');
    });

    it('reports estimatedCost of 0.08 for Opus interpretation', async () => {
      mockFetch.mockResolvedValueOnce(makeAnthropicSuccessResponse(VALID_JSON_CONTENT));

      const result = await interpretWithFallback(VALID_JSON_CONTENT, 1);

      expect(result.estimatedCost).toBe(0.08);
    });

    it('returns a positive durationMs', async () => {
      mockFetch.mockResolvedValueOnce(makeAnthropicSuccessResponse(VALID_JSON_CONTENT));

      const result = await interpretWithFallback(VALID_JSON_CONTENT, 1);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GPT-5.2 fallback when Opus fails', () => {
    it('falls back to GPT-5.2 when Opus returns an HTTP error', async () => {
      mockFetch
        .mockResolvedValueOnce(makeErrorResponse(500, 'Internal Server Error'))
        .mockResolvedValueOnce(makeOpenAISuccessResponse(VALID_JSON_CONTENT));

      const result = await interpretWithFallback(VALID_JSON_CONTENT, 3);

      expect(result.interpretationProvider).toBe('gpt-5.2');
      expect(result.processingTier).toContain('gpt-fallback');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'INTERPRETATION_SERVICE',
        expect.stringContaining('Opus interpretation failed'),
        expect.objectContaining({ pageNumber: 3 })
      );
    });

    it('falls back to GPT-5.2 when Opus produces invalid JSON', async () => {
      mockFetch
        .mockResolvedValueOnce(makeAnthropicSuccessResponse('This is not JSON at all'))
        .mockResolvedValueOnce(makeOpenAISuccessResponse(VALID_JSON_CONTENT));

      const result = await interpretWithFallback(VALID_JSON_CONTENT, 4);

      expect(result.interpretationProvider).toBe('gpt-5.2');
    });

    it('falls back to GPT-5.2 when ANTHROPIC_API_KEY is missing', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      mockFetch.mockResolvedValueOnce(makeOpenAISuccessResponse(VALID_JSON_CONTENT));

      const result = await interpretWithFallback(VALID_JSON_CONTENT, 1);

      expect(result.interpretationProvider).toBe('gpt-5.2');
    });

    it('passes additionalContext to GPT-5.2 fallback as well', async () => {
      mockFetch
        .mockResolvedValueOnce(makeErrorResponse(503, 'Service Unavailable'))
        .mockResolvedValueOnce(makeOpenAISuccessResponse(VALID_JSON_CONTENT));

      await interpretWithFallback(VALID_JSON_CONTENT, 1, {
        additionalContext: 'DISCIPLINE RULES: check duct sizes',
      });

      const gptFetchCall = mockFetch.mock.calls[1];
      const body = JSON.parse(gptFetchCall[1].body);
      expect(body.messages[0].content).toContain('DISCIPLINE RULES: check duct sizes');
    });

    it('reports estimatedCost of 0.03 for GPT-5.2 fallback', async () => {
      mockFetch
        .mockResolvedValueOnce(makeErrorResponse(500, 'error'))
        .mockResolvedValueOnce(makeOpenAISuccessResponse(VALID_JSON_CONTENT));

      const result = await interpretWithFallback(VALID_JSON_CONTENT, 1);

      expect(result.estimatedCost).toBe(0.03);
    });
  });

  describe('raw passthrough when both providers fail', () => {
    it('returns raw JSON when both Opus and GPT-5.2 fail', async () => {
      mockFetch
        .mockResolvedValueOnce(makeErrorResponse(500, 'Opus error'))
        .mockResolvedValueOnce(makeErrorResponse(429, 'GPT rate limit'));

      const result = await interpretWithFallback(VALID_JSON_CONTENT, 5);

      expect(result.interpretationProvider).toBeNull();
      expect(result.processingTier).toContain('raw-passthrough');
      expect(result.estimatedCost).toBe(0);
      expect(result.content).toBe(VALID_JSON_CONTENT);
    });

    it('returns raw passthrough when both API keys are missing', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const result = await interpretWithFallback(VALID_JSON_CONTENT, 6);

      expect(result.interpretationProvider).toBeNull();
      expect(result.content).toBe(VALID_JSON_CONTENT);
    });

    it('logs a warning when GPT-5.2 also fails', async () => {
      mockFetch
        .mockResolvedValueOnce(makeErrorResponse(500, 'error'))
        .mockResolvedValueOnce(makeErrorResponse(500, 'gpt error'));

      await interpretWithFallback(VALID_JSON_CONTENT, 7);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'INTERPRETATION_SERVICE',
        expect.stringContaining('GPT-5.2 interpretation also failed'),
        expect.objectContaining({ pageNumber: 7 })
      );
    });
  });

  describe('JSON stripping from markdown wrappers', () => {
    it('strips JSON code fences from Opus response', async () => {
      const wrappedContent = `\`\`\`json\n${VALID_JSON_CONTENT}\n\`\`\``;
      mockFetch.mockResolvedValueOnce(makeAnthropicSuccessResponse(wrappedContent));

      const result = await interpretWithFallback(VALID_JSON_CONTENT, 1);

      // Should parse successfully (code fences stripped)
      expect(result.interpretationProvider).toBe('claude-opus-4-6');
      expect(() => JSON.parse(result.content)).not.toThrow();
    });

    it('strips preamble text before first { brace', async () => {
      const preambleContent = `Here is the corrected JSON:\n${VALID_JSON_CONTENT}`;
      mockFetch.mockResolvedValueOnce(makeAnthropicSuccessResponse(preambleContent));

      const result = await interpretWithFallback(VALID_JSON_CONTENT, 1);

      expect(result.interpretationProvider).toBe('claude-opus-4-6');
      const parsed = JSON.parse(result.content);
      expect(parsed.sheetNumber).toBe('A-101');
    });
  });
});

describe('callOpusInterpretation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    process.env.ANTHROPIC_API_KEY = 'test-key';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('throws when ANTHROPIC_API_KEY is not set', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    await expect(callOpusInterpretation('{}', 1)).rejects.toThrow('ANTHROPIC_API_KEY not configured');
  });

  it('includes page number in the prompt sent to Anthropic', async () => {
    mockFetch.mockResolvedValueOnce(makeAnthropicSuccessResponse(VALID_JSON_CONTENT));

    await callOpusInterpretation('{}', 42);

    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.messages[0].content).toContain('Page 42');
  });

  it('includes additionalContext when provided', async () => {
    mockFetch.mockResolvedValueOnce(makeAnthropicSuccessResponse(VALID_JSON_CONTENT));

    await callOpusInterpretation('{}', 1, 'EXTRA: fix scale');

    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.messages[0].content).toContain('EXTRA: fix scale');
  });

  it('throws an HTTP error when API returns non-200', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(401, 'Unauthorized'));

    await expect(callOpusInterpretation('{}', 1)).rejects.toThrow('HTTP 401');
  });

  it('throws "Empty response from Opus" when content array is empty', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({ content: [] })),
    });

    await expect(callOpusInterpretation('{}', 1)).rejects.toThrow('Empty response from Opus interpretation');
  });

  it('calls Anthropic API endpoint', async () => {
    mockFetch.mockResolvedValueOnce(makeAnthropicSuccessResponse(VALID_JSON_CONTENT));

    await callOpusInterpretation('{}', 1);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('callGPT52Interpretation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    process.env.OPENAI_API_KEY = 'test-openai-key';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
  });

  it('throws when OPENAI_API_KEY is not set', async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(callGPT52Interpretation('{}', 1)).rejects.toThrow('OPENAI_API_KEY not configured');
  });

  it('calls the OpenAI chat completions endpoint', async () => {
    mockFetch.mockResolvedValueOnce(makeOpenAISuccessResponse(VALID_JSON_CONTENT));

    await callGPT52Interpretation('{}', 1);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('includes page number in the GPT-5.2 prompt', async () => {
    mockFetch.mockResolvedValueOnce(makeOpenAISuccessResponse(VALID_JSON_CONTENT));

    await callGPT52Interpretation('{}', 15);

    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.messages[0].content).toContain('Page 15');
  });

  it('includes additionalContext when provided', async () => {
    mockFetch.mockResolvedValueOnce(makeOpenAISuccessResponse(VALID_JSON_CONTENT));

    await callGPT52Interpretation('{}', 1, 'CHECKLIST: verify CSI codes');

    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.messages[0].content).toContain('CHECKLIST: verify CSI codes');
  });

  it('throws an HTTP error when GPT returns non-200', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(429, 'Too Many Requests'));

    await expect(callGPT52Interpretation('{}', 1)).rejects.toThrow('HTTP 429');
  });

  it('throws "Empty response from GPT-5.2" when choices are empty', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({ choices: [] })),
    });

    await expect(callGPT52Interpretation('{}', 1)).rejects.toThrow('Empty response from GPT-5.2 interpretation');
  });

  it('uses gpt-5.2 as the model name', async () => {
    mockFetch.mockResolvedValueOnce(makeOpenAISuccessResponse(VALID_JSON_CONTENT));

    await callGPT52Interpretation('{}', 1);

    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.model).toBe('gpt-5.2');
  });

  it('returns the content string from the API response', async () => {
    mockFetch.mockResolvedValueOnce(makeOpenAISuccessResponse(VALID_JSON_CONTENT));

    const result = await callGPT52Interpretation('{}', 1);

    expect(result).toBe(VALID_JSON_CONTENT);
  });
});
