import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal('fetch', mockFetch);

import { classifyPage, HAIKU_CLASSIFICATION_COST } from '@/lib/discipline-classifier';

describe('discipline-classifier', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: 'test-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('exports HAIKU_CLASSIFICATION_COST constant', () => {
    expect(HAIKU_CLASSIFICATION_COST).toBe(0.0002);
  });

  it('returns default result when ANTHROPIC_API_KEY is not set', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const result = await classifyPage('base64data');

    expect(result).toEqual({
      discipline: 'General',
      drawingType: 'unknown',
      sheetNumber: '',
      confidence: 0,
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('parses valid classification response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sheetNumber: 'A-201',
              discipline: 'Architectural',
              drawingType: 'floor_plan',
              confidence: 0.95,
            }),
          },
        ],
      }),
    });

    const result = await classifyPage('base64data');

    expect(result).toEqual({
      discipline: 'Architectural',
      drawingType: 'floor_plan',
      sheetNumber: 'A-201',
      confidence: 0.95,
    });
    expect(mockLogger.info).toHaveBeenCalledWith(
      'DISCIPLINE_CLASSIFIER',
      'Page classified',
      expect.objectContaining({ discipline: 'Architectural' })
    );
  });

  it('handles JSON embedded in surrounding text', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: 'Here is the classification:\n{"sheetNumber": "S-101", "discipline": "Structural", "drawingType": "foundation_plan", "confidence": 0.88}\nDone.',
          },
        ],
      }),
    });

    const result = await classifyPage('base64data');

    expect(result.discipline).toBe('Structural');
    expect(result.drawingType).toBe('foundation_plan');
    expect(result.sheetNumber).toBe('S-101');
    expect(result.confidence).toBe(0.88);
  });

  it('clamps confidence to [0, 1] range', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: '{"sheetNumber": "", "discipline": "General", "drawingType": "cover", "confidence": 1.5}',
          },
        ],
      }),
    });

    const result = await classifyPage('base64data');
    expect(result.confidence).toBe(1);
  });

  it('returns default when response has no JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: 'I could not classify this page.',
          },
        ],
      }),
    });

    const result = await classifyPage('base64data');

    expect(result).toEqual({
      discipline: 'General',
      drawingType: 'unknown',
      sheetNumber: '',
      confidence: 0,
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'DISCIPLINE_CLASSIFIER',
      'No JSON found in response',
      expect.any(Object)
    );
  });

  it('returns default on API error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Rate limited',
    });

    const result = await classifyPage('base64data');

    expect(result).toEqual({
      discipline: 'General',
      drawingType: 'unknown',
      sheetNumber: '',
      confidence: 0,
    });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'DISCIPLINE_CLASSIFIER',
      'API request failed',
      undefined,
      expect.objectContaining({ status: 429 })
    );
  });

  it('returns default on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await classifyPage('base64data');

    expect(result).toEqual({
      discipline: 'General',
      drawingType: 'unknown',
      sheetNumber: '',
      confidence: 0,
    });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'DISCIPLINE_CLASSIFIER',
      'Classification failed',
      expect.any(Error)
    );
  });

  it('handles missing fields in parsed JSON gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: '{"discipline": "Electrical"}',
          },
        ],
      }),
    });

    const result = await classifyPage('base64data');

    expect(result.discipline).toBe('Electrical');
    expect(result.drawingType).toBe('unknown');
    expect(result.sheetNumber).toBe('');
    expect(result.confidence).toBe(0);
  });

  it('sends correct request structure to Anthropic API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: '{"sheetNumber": "", "discipline": "General", "drawingType": "unknown", "confidence": 0.5}',
          },
        ],
      }),
    });

    await classifyPage('testbase64');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'test-key',
          'anthropic-version': '2023-06-01',
        }),
      })
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe('claude-haiku-4-5-20251001');
    expect(body.max_tokens).toBe(256);
    expect(body.messages[0].content[0].type).toBe('image');
    expect(body.messages[0].content[0].source.data).toBe('testbase64');
    expect(body.messages[0].content[1].type).toBe('text');
  });
});
