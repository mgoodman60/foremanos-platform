import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mocks Setup - Using vi.hoisted pattern
// ============================================

const mocks = vi.hoisted(() => ({
  callAbacusLLM: vi.fn(),
  extractScalesWithPatterns: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@/lib/abacus-llm', () => ({
  callAbacusLLM: mocks.callAbacusLLM,
}));

vi.mock('@/lib/scale-detector', () => ({
  extractScalesWithPatterns: mocks.extractScalesWithPatterns,
}));

// Mock global fetch
global.fetch = mocks.fetch as any;

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

import { extractScaleData, type ScaleData } from '@/lib/scale-data-extractor';

describe('ScaleDataExtractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractScaleData', () => {
    describe('Success Cases - Base64 Input', () => {
      it('should extract primary architectural scale from base64 image', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: '1/4"=1\'-0"',
              location: 'title block',
              confidence: 0.95,
            },
            confidence: 0.95,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.found).toBe(true);
        expect(result.primary).toBeDefined();
        expect(result.primary?.scaleString).toBe('1/4"=1\'-0"');
        expect(result.primary?.scaleRatio).toBe(48);
        expect(result.primary?.format).toBe('architectural');
        expect(result.hasMultipleScales).toBe(false);
        expect(result.confidence).toBe(0.95);
      });

      it('should extract primary metric scale from base64 image', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: '1:100',
              location: 'title block',
              confidence: 0.92,
            },
            confidence: 0.92,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.found).toBe(true);
        expect(result.primary?.scaleString).toBe('1:100');
        expect(result.primary?.scaleRatio).toBe(100);
        expect(result.primary?.format).toBe('metric');
      });

      it('should extract primary engineering scale from base64 image', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: '1"=10\'',
              location: 'title block',
              confidence: 0.90,
            },
            confidence: 0.90,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.found).toBe(true);
        expect(result.primary?.scaleString).toBe('1"=10\'');
        expect(result.primary?.scaleRatio).toBe(120);
        expect(result.primary?.format).toBe('engineering');
      });

      it('should extract multiple scales from base64 image', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: '1/4"=1\'-0"',
              location: 'title block',
              confidence: 0.95,
            },
            secondaryScales: [
              {
                scaleString: '3/8"=1\'-0"',
                viewportName: 'Detail A',
                confidence: 0.90,
              },
              {
                scaleString: '1/8"=1\'-0"',
                viewportName: 'Detail B',
                confidence: 0.88,
              },
            ],
            confidence: 0.91,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.found).toBe(true);
        expect(result.primary?.scaleString).toBe('1/4"=1\'-0"');
        expect(result.hasMultipleScales).toBe(true);
        expect(result.secondary).toHaveLength(2);
        expect(result.secondary?.[0].scaleString).toBe('3/8"=1\'-0"');
        expect(result.secondary?.[0].viewportName).toBe('Detail A');
        expect(result.secondary?.[0].scaleRatio).toBe(32);
        expect(result.secondary?.[1].scaleString).toBe('1/8"=1\'-0"');
        expect(result.secondary?.[1].scaleRatio).toBe(96);
      });

      it('should handle NTS (Not To Scale) detection', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: 'NTS',
              location: 'annotation',
              confidence: 1.0,
            },
            confidence: 1.0,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.found).toBe(true);
        expect(result.primary?.scaleString).toBe('NTS');
        expect(result.primary?.scaleRatio).toBe(1);
        expect(result.primary?.format).toBe('custom');
      });

      it('should handle AS NOTED detection', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: 'AS NOTED',
              location: 'annotation',
              confidence: 1.0,
            },
            confidence: 1.0,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.found).toBe(true);
        expect(result.primary?.scaleString).toBe('AS NOTED');
        expect(result.primary?.scaleRatio).toBe(1);
        expect(result.primary?.format).toBe('custom');
      });

      it('should use default confidence when not provided', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: '1/4"=1\'-0"',
              location: 'title block',
            },
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.found).toBe(true);
        expect(result.primary?.confidence).toBe(0.8);
        expect(result.confidence).toBe(0.8);
      });

      it('should handle viewport name from response', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: '1/4"=1\'-0"',
              viewport: 'Main Plan',
              confidence: 0.95,
            },
            confidence: 0.95,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.found).toBe(true);
        expect(result.primary?.viewportName).toBe('Main Plan');
      });
    });

    describe('Success Cases - URL Input', () => {
      it('should fetch and convert URL to base64 before processing', async () => {
        const mockImageBuffer = Buffer.from('fake-image-data');
        mocks.fetch.mockResolvedValueOnce({
          arrayBuffer: vi.fn().mockResolvedValue(mockImageBuffer.buffer),
        });

        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: '1/4"=1\'-0"',
              location: 'title block',
              confidence: 0.95,
            },
            confidence: 0.95,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('https://example.com/image.jpg', 1);

        expect(mocks.fetch).toHaveBeenCalledWith('https://example.com/image.jpg');
        expect(result.found).toBe(true);
        expect(result.primary?.scaleString).toBe('1/4"=1\'-0"');
      });

      it('should handle URL with multiple scales', async () => {
        const mockImageBuffer = Buffer.from('fake-image-data');
        mocks.fetch.mockResolvedValueOnce({
          arrayBuffer: vi.fn().mockResolvedValue(mockImageBuffer.buffer),
        });

        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: '1:50',
              location: 'title block',
              confidence: 0.92,
            },
            secondaryScales: [
              {
                scaleString: '1:25',
                viewportName: 'Detail',
                confidence: 0.90,
              },
            ],
            confidence: 0.91,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('http://example.com/drawing.png', 1);

        expect(result.found).toBe(true);
        expect(result.hasMultipleScales).toBe(true);
        expect(result.secondary).toHaveLength(1);
      });
    });

    describe('Response Parsing', () => {
      it('should strip markdown code blocks from JSON response', async () => {
        const mockLLMResponse = {
          content: '```json\n{"found": true, "primaryScale": {"scaleString": "1/4\\"=1\'-0\\"", "confidence": 0.95}, "confidence": 0.95}\n```',
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.found).toBe(true);
        expect(result.primary?.scaleString).toBe('1/4"=1\'-0"');
      });

      it('should strip markdown code blocks without json label', async () => {
        const mockLLMResponse = {
          content: '```\n{"found": true, "primaryScale": {"scaleString": "1:100", "confidence": 0.90}, "confidence": 0.90}\n```',
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.found).toBe(true);
        expect(result.primary?.scaleString).toBe('1:100');
      });

      it('should handle plain JSON without markdown', async () => {
        const mockLLMResponse = {
          content: '{"found": true, "primaryScale": {"scaleString": "1\\"=10\'", "confidence": 0.88}, "confidence": 0.88}',
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.found).toBe(true);
        expect(result.primary?.scaleString).toBe('1"=10\'');
      });

      it('should handle alternative scale field names', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              text: '1/4"=1\'-0"',
              confidence: 0.95,
            },
            confidence: 0.95,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.found).toBe(true);
        expect(result.primary?.scaleString).toBe('1/4"=1\'-0"');
      });

      it('should handle viewportName alternative field', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: '1/4"=1\'-0"',
              viewportName: 'Floor Plan',
              confidence: 0.95,
            },
            confidence: 0.95,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.found).toBe(true);
        expect(result.primary?.viewportName).toBe('Floor Plan');
      });
    });

    describe('No Scale Found Cases', () => {
      it('should return not found when found is false', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: false,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.found).toBe(false);
        expect(result.primary).toBeUndefined();
        expect(result.secondary).toBeUndefined();
        expect(result.hasMultipleScales).toBe(false);
        expect(result.confidence).toBe(0);
      });

      it('should return not found when primaryScale is missing', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.found).toBe(false);
        expect(result.primary).toBeUndefined();
        expect(result.hasMultipleScales).toBe(false);
        expect(result.confidence).toBe(0);
      });

      it('should handle empty secondaryScales array', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: '1/4"=1\'-0"',
              confidence: 0.95,
            },
            secondaryScales: [],
            confidence: 0.95,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.found).toBe(true);
        expect(result.hasMultipleScales).toBe(false);
        expect(result.secondary).toBeUndefined();
      });
    });

    describe('Error Handling', () => {
      it('should handle LLM API errors gracefully', async () => {
        mocks.callAbacusLLM.mockRejectedValueOnce(new Error('API Error'));

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.found).toBe(false);
        expect(result.hasMultipleScales).toBe(false);
        expect(result.confidence).toBe(0);
      });

      it('should handle invalid JSON response', async () => {
        const mockLLMResponse = {
          content: 'This is not valid JSON',
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.found).toBe(false);
        expect(result.hasMultipleScales).toBe(false);
        expect(result.confidence).toBe(0);
      });

      it('should handle malformed markdown JSON', async () => {
        const mockLLMResponse = {
          content: '```json\n{invalid json}\n```',
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 2);

        expect(result.found).toBe(false);
      });

      it('should handle fetch errors for URL input', async () => {
        mocks.fetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await extractScaleData('https://example.com/image.jpg', 1);

        expect(result.found).toBe(false);
        expect(result.hasMultipleScales).toBe(false);
        expect(result.confidence).toBe(0);
      });

      it('should handle arrayBuffer conversion errors', async () => {
        mocks.fetch.mockResolvedValueOnce({
          arrayBuffer: vi.fn().mockRejectedValue(new Error('Buffer error')),
        });

        const result = await extractScaleData('http://example.com/image.png', 1);

        expect(result.found).toBe(false);
      });

      it('should log errors with page number', async () => {
        mocks.callAbacusLLM.mockRejectedValueOnce(new Error('Test error'));

        await extractScaleData('base64ImageData', 5);

        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe('Scale Ratio Parsing', () => {
      it('should parse 1/8" architectural scale correctly', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: '1/8"=1\'-0"',
              confidence: 0.95,
            },
            confidence: 0.95,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.primary?.scaleRatio).toBe(96);
      });

      it('should parse 3/16" architectural scale correctly', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: '3/16"=1\'-0"',
              confidence: 0.95,
            },
            confidence: 0.95,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.primary?.scaleRatio).toBe(64);
      });

      it('should parse 3/8" architectural scale correctly', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: '3/8"=1\'-0"',
              confidence: 0.95,
            },
            confidence: 0.95,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.primary?.scaleRatio).toBe(32);
      });

      it('should parse 1" architectural scale correctly', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: '1"=1\'-0"',
              confidence: 0.95,
            },
            confidence: 0.95,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.primary?.scaleRatio).toBe(12);
      });

      it('should parse 1"=20\' engineering scale correctly', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: '1"=20\'',
              confidence: 0.90,
            },
            confidence: 0.90,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.primary?.scaleRatio).toBe(240);
      });

      it('should parse 1:50 metric scale correctly', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: '1:50',
              confidence: 0.92,
            },
            confidence: 0.92,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.primary?.scaleRatio).toBe(50);
      });

      it('should parse 1:200 metric scale correctly', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: '1:200',
              confidence: 0.90,
            },
            confidence: 0.90,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.primary?.scaleRatio).toBe(200);
      });

      it('should default to ratio 1 for unparseable scales', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: 'UNKNOWN SCALE',
              confidence: 0.50,
            },
            confidence: 0.50,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.primary?.scaleRatio).toBe(1);
        expect(result.primary?.format).toBe('custom');
      });
    });

    describe('Scale Format Detection', () => {
      it('should detect architectural format with inch and foot marks', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: '1/4"=1\'-0"',
              confidence: 0.95,
            },
            confidence: 0.95,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.primary?.format).toBe('architectural');
      });

      it('should detect engineering format without fraction', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: '1"=10\'',
              confidence: 0.90,
            },
            confidence: 0.90,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.primary?.format).toBe('engineering');
      });

      it('should detect metric format with colon', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: '1:100',
              confidence: 0.92,
            },
            confidence: 0.92,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.primary?.format).toBe('metric');
      });

      it('should detect custom format for NTS', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: 'NTS',
              confidence: 1.0,
            },
            confidence: 1.0,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.primary?.format).toBe('custom');
      });
    });

    describe('Vision API Integration', () => {
      it('should send correct message format to LLM for base64', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: '1/4"=1\'-0"',
              confidence: 0.95,
            },
            confidence: 0.95,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        await extractScaleData('testBase64Data', 1);

        expect(mocks.callAbacusLLM).toHaveBeenCalledWith(
          [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: 'data:image/jpeg;base64,testBase64Data' },
                },
                {
                  type: 'text',
                  text: expect.stringContaining('You are analyzing a construction drawing'),
                },
              ],
            },
          ],
          {
            response_format: { type: 'json_object' },
            max_tokens: 1000,
          }
        );
      });

      it('should include scale extraction prompt in request', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: false,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        await extractScaleData('base64ImageData', 1);

        const call = mocks.callAbacusLLM.mock.calls[0][0];
        const textContent = call[0].content.find((c: any) => c.type === 'text');

        expect(textContent.text).toContain('Extract ALL drawing scales');
        expect(textContent.text).toContain('Title block');
        expect(textContent.text).toContain('Architectural: "1/4"=1\'-0"');
        expect(textContent.text).toContain('Engineering: "1"=10\'');
        expect(textContent.text).toContain('Metric: "1:100"');
        expect(textContent.text).toContain('NTS');
      });

      it('should request JSON object response format', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: false,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        await extractScaleData('base64ImageData', 1);

        const options = mocks.callAbacusLLM.mock.calls[0][1];
        expect(options.response_format).toEqual({ type: 'json_object' });
        expect(options.max_tokens).toBe(1000);
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty string as image data', async () => {
        mocks.callAbacusLLM.mockRejectedValueOnce(new Error('Empty input'));

        const result = await extractScaleData('', 1);

        expect(result.found).toBe(false);
      });

      it('should handle null secondaryScales in response', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: '1/4"=1\'-0"',
              confidence: 0.95,
            },
            secondaryScales: null,
            confidence: 0.95,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.found).toBe(true);
        expect(result.secondary).toBeUndefined();
        expect(result.hasMultipleScales).toBe(false);
      });

      it('should handle very high page numbers', async () => {
        mocks.callAbacusLLM.mockRejectedValueOnce(new Error('Test'));

        await extractScaleData('base64ImageData', 9999);

        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should handle response with extra whitespace in JSON', async () => {
        const mockLLMResponse = {
          content: '  \n  {"found": true, "primaryScale": {"scaleString": "1:100", "confidence": 0.90}, "confidence": 0.90}  \n  ',
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.found).toBe(true);
      });

      it('should handle multiple secondary scales with missing confidence', async () => {
        const mockLLMResponse = {
          content: JSON.stringify({
            found: true,
            primaryScale: {
              scaleString: '1/4"=1\'-0"',
              confidence: 0.95,
            },
            secondaryScales: [
              {
                scaleString: '1:50',
                viewportName: 'Detail',
              },
            ],
            confidence: 0.90,
          }),
          model: 'gpt-4o',
        };

        mocks.callAbacusLLM.mockResolvedValueOnce(mockLLMResponse);

        const result = await extractScaleData('base64ImageData', 1);

        expect(result.found).toBe(true);
        expect(result.secondary?.[0].confidence).toBe(0.8);
      });
    });
  });
});
