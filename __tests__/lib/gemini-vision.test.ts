import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createScopedLogger: vi.fn(() => mockLogger),
}));

// Mock model-config
vi.mock('@/lib/model-config', () => ({
  VISION_MODEL: 'claude-opus-4-6',
  FALLBACK_MODEL: 'gpt-5.2',
  DEFAULT_MODEL: 'claude-sonnet-4-5-20250929',
  GEMINI_PRIMARY_MODEL: 'gemini-3-pro-preview',
  GEMINI_SECONDARY_MODEL: 'gemini-2.5-pro',
  GEMINI_EXTRACTION_MODEL: 'gemini-3-pro-preview',
}));

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn(),
  },
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn(),
}));

// Mock GoogleGenAI
const mockGenerateContent = vi.hoisted(() => vi.fn());
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

// Set env before import
process.env.GOOGLE_API_KEY = 'test-google-api-key';
process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
process.env.OPENAI_API_KEY = 'sk-test-openai-key';

import { callGeminiVision, isPdfContent } from '@/lib/vision-api-multi-provider';

describe('callGeminiVision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    process.env.GOOGLE_API_KEY = 'test-google-api-key';
  });

  afterEach(() => {
    vi.clearAllMocks();
    try { vi.runOnlyPendingTimers(); } catch { /* timers may already be real */ }
    vi.useRealTimers();
  });

  it('should call Gemini with image content (inlineData with image/jpeg)', async () => {
    const imageBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD';
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ sheetNumber: 'A-101' }),
    });

    const result = await callGeminiVision(imageBase64, 'Extract content');

    expect(result.success).toBe(true);
    expect(result.provider).toBe('gemini-2.5-pro');
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-2.5-pro',
        contents: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            parts: expect.arrayContaining([
              expect.objectContaining({
                inlineData: expect.objectContaining({
                  mimeType: 'image/jpeg',
                  data: imageBase64,
                }),
              }),
            ]),
          }),
        ]),
      })
    );
  });

  it('should call Gemini with PDF content (inlineData with application/pdf)', async () => {
    const pdfBase64 = 'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlIC9DYXRhbG9nPj4KZW5kb2Jq';
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ sheetNumber: 'A-101' }),
    });

    const result = await callGeminiVision(pdfBase64, 'Extract content');

    expect(result.success).toBe(true);
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: expect.arrayContaining([
          expect.objectContaining({
            parts: expect.arrayContaining([
              expect.objectContaining({
                inlineData: expect.objectContaining({
                  mimeType: 'application/pdf',
                }),
              }),
            ]),
          }),
        ]),
      })
    );
  });

  it('should return VisionResponse with provider gemini-2.5-pro', async () => {
    mockGenerateContent.mockResolvedValue({
      text: '{"sheetNumber": "A-101"}',
    });

    const result = await callGeminiVision('base64image', 'Extract');

    expect(result.provider).toBe('gemini-2.5-pro');
    expect(result.success).toBe(true);
    expect(result.content).toBe('{"sheetNumber": "A-101"}');
    expect(result.attempts).toBe(1);
  });

  it('should handle timeout via Promise.race (not AbortController)', async () => {
    // Mock generateContent that never resolves
    mockGenerateContent.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const resultPromise = callGeminiVision('base64image', 'Extract');

    // Advance timers past the 90s timeout for images
    await vi.advanceTimersByTimeAsync(91000);

    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.error).toBe('TIMEOUT');
  });

  it('should retry 3x with exponential backoff on failure', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(new Error('Temporary error'))
      .mockRejectedValueOnce(new Error('Temporary error'))
      .mockResolvedValueOnce({
        text: '{"sheetNumber": "A-101"}',
      });

    const result = await callGeminiVision('base64image', 'Extract');

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(3);
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
  });

  it('should handle missing GOOGLE_API_KEY gracefully', async () => {
    delete process.env.GOOGLE_API_KEY;

    const result = await callGeminiVision('base64image', 'Extract');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Google API key not configured');
    expect(result.provider).toBe('gemini-2.5-pro');
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('should handle RESOURCE_EXHAUSTED (429) error with retry', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(new Error('429 RESOURCE_EXHAUSTED'))
      .mockResolvedValueOnce({
        text: '{"sheetNumber": "A-101"}',
      });

    const result = await callGeminiVision('base64image', 'Extract');

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'GEMINI_VISION',
      'Retry 1/3 (rate limited) after 1000ms'
    );
  });

  it('should handle SAFETY content filter block without retry', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('SAFETY filter blocked'));

    const result = await callGeminiVision('base64image', 'Extract');

    expect(result.success).toBe(false);
    expect(result.error).toBe('SAFETY_BLOCK');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('should handle empty response from Gemini', async () => {
    mockGenerateContent.mockResolvedValue({
      text: '',
    });

    const result = await callGeminiVision('base64image', 'Extract');

    // Should retry on empty response since it throws 'Empty response from Gemini'
    expect(mockGenerateContent).toHaveBeenCalledTimes(3); // 3 attempts total
    expect(result.success).toBe(false);
  });

  it('should set minimal thinking with thinkingBudget: 1024', async () => {
    mockGenerateContent.mockResolvedValue({
      text: '{"data": "test"}',
    });

    await callGeminiVision('base64image', 'Extract');

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          thinkingConfig: { thinkingBudget: 1024 },
        }),
      })
    );
  });

  it('should use maxOutputTokens 8192 and temperature 0.1', async () => {
    mockGenerateContent.mockResolvedValue({
      text: '{"data": "test"}',
    });

    await callGeminiVision('base64image', 'Extract');

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          maxOutputTokens: 8192,
          temperature: 0.1,
        }),
      })
    );
  });

  it('should exhaust all retries and return failure', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(new Error('Server error'))
      .mockRejectedValueOnce(new Error('Server error'))
      .mockRejectedValueOnce(new Error('Server error'));

    const result = await callGeminiVision('base64image', 'Extract');

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3);
    expect(result.error).toBe('Server error');
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
  });
});

describe('isPdfContent', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('should detect PDF base64 content', () => {
    const pdfBase64 = 'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlIC9DYXRhbG9nPj4KZW5kb2Jq';
    expect(isPdfContent(pdfBase64)).toBe(true);
  });

  it('should return false for image content', () => {
    const imageBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD';
    expect(isPdfContent(imageBase64)).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isPdfContent('')).toBe(false);
  });
});
