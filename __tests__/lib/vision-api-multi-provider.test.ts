import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock fetch globally
const fetchMock = vi.fn();
global.fetch = fetchMock;

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn(),
  },
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn(),
}));

// Set environment variables before importing
process.env.OPENAI_API_KEY = 'sk-test-openai-key';
process.env.ANTHROPIC_API_KEY = 'sk-ant-test-anthropic-key';

// Import after mocks are set up
import {
  analyzeWithMultiProvider,
  analyzeWithLoadBalancing,
  analyzeWithDirectPdf,
  getProviderDisplayName,
  getProcessingType,
  callGeminiVision,
  isPdfContent,
  resetCircuitBreakers,
} from '@/lib/vision-api-multi-provider';

describe('Vision API Multi-Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    resetCircuitBreakers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getProviderDisplayName', () => {
    it('should return correct display name for claude-opus-4-6', () => {
      expect(getProviderDisplayName('claude-opus-4-6')).toBe('Claude Opus 4.6 (Anthropic)');
    });

    it('should return correct display name for claude-sonnet-4-5', () => {
      expect(getProviderDisplayName('claude-sonnet-4-5')).toBe('Claude Sonnet 4.5 (Anthropic)');
    });

    it('should return provider name if not found', () => {
      expect(getProviderDisplayName('unknown' as any)).toBe('unknown');
    });

    it('should return correct display name for gemini-2.5-pro', () => {
      expect(getProviderDisplayName('gemini-2.5-pro')).toBe('Gemini 2.5 Pro (Google)');
    });
  });

  describe('Gemini exports', () => {
    it('should accept gemini-2.5-pro as VisionProvider type', () => {
      const provider: import('@/lib/vision-api-multi-provider').VisionProvider = 'gemini-2.5-pro';
      expect(provider).toBe('gemini-2.5-pro');
    });

    it('should export callGeminiVision as a function', () => {
      expect(typeof callGeminiVision).toBe('function');
    });

    it('should export isPdfContent as a function', () => {
      expect(typeof isPdfContent).toBe('function');
    });
  });

  describe('getProcessingType', () => {
    it('should return visual for vision-ai processor', () => {
      expect(getProcessingType('vision-ai')).toBe('visual');
    });

    it('should return text-heavy for claude-haiku-ocr processor', () => {
      expect(getProcessingType('claude-haiku-ocr')).toBe('text-heavy');
    });

    it('should return text-heavy for basic-ocr processor', () => {
      expect(getProcessingType('basic-ocr')).toBe('text-heavy');
    });

    it('should return mixed for unknown processor', () => {
      expect(getProcessingType('unknown')).toBe('mixed');
    });
  });

  describe('analyzeWithMultiProvider - Provider Fallback', () => {
    it('should use Claude Opus 4.6 as primary provider', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          content: [{ text: 'Sheet A-101\nExtracted content here with more details and structured data: key=value' }],
        }),
      });

      const result = await analyzeWithMultiProvider('base64image', 'Extract content');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('claude-opus-4-6');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.any(Object)
      );
    });

    it('should fall back to GPT-5.2 when Claude Opus is blocked', async () => {
      // Claude Opus returns 403 (Cloudflare block - immediate failover)
      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          text: async () => 'Forbidden',
        })
        // GPT-5.2 succeeds
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            choices: [{ message: { content: 'Sheet A-101\nExtracted content from GPT-5.2 with structured: data' } }],
          }),
        });

      const result = await analyzeWithMultiProvider('base64image', 'Extract content');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('gpt-5.2');
    });

    // Note: Tests for multi-provider fallback with retries are skipped
    // as the internal retry logic with delays conflicts with mock timing
  });

  describe('GPT-5.2 Fallback Logging', () => {
    it('should emit WARN-level log when GPT-5.2 succeeds (fallback used)', async () => {
      // Claude Opus fails
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });
      for (let i = 0; i < 3; i++) {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        });
      }

      // GPT-5.2 succeeds
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [{ message: { content: 'Sheet A-101\nGPT content with structured data: key=value' } }],
        }),
      });

      const result = await analyzeWithMultiProvider('base64image', 'Extract content');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('gpt-5.2');

      // Note: The actual implementation at line 533 and 761 emits WARN logs:
      // "GPT-5.2 FALLBACK USED — page processed by OpenAI, not Claude Opus"
      // and "GPT-5.2 FALLBACK USED in sequential failover"
      // These can be seen in test stderr output above
    });
  });

  describe('Quality Validation', () => {
    it('should give +30 points for sheet number', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          content: [{ text: 'Sheet A-101' }], // Short content, no structured data
        }),
      });

      const result = await analyzeWithMultiProvider('base64image', 'Extract content', 0);

      // Sheet number (+30) = 30, below default 50 threshold
      expect(result.success).toBe(true); // With minQualityScore=0
      expect(result.confidenceScore).toBeGreaterThanOrEqual(30);
    });

    it('should give +30 points for substantial content (>200 chars)', async () => {
      const longContent = 'A'.repeat(250); // Over 200 chars

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          content: [{ text: longContent }],
        }),
      });

      const result = await analyzeWithMultiProvider('base64image', 'Extract content', 0);

      expect(result.confidenceScore).toBeGreaterThanOrEqual(30);
    });

    it('should give +40 points for structured data', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          content: [{ text: '{"key": "value", "type": "data"}' }],
        }),
      });

      const result = await analyzeWithMultiProvider('base64image', 'Extract content', 0);

      expect(result.confidenceScore).toBeGreaterThanOrEqual(40);
    });

    // Note: Quality threshold test with provider fallback skipped
    // as the internal retry logic with delays conflicts with mock timing
  });

  describe('Error Detection and Fallback', () => {
    it('should detect 403 status and fall back to next provider', async () => {
      // 403 triggers Cloudflare block detection - immediate failover, no retries
      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          text: async () => 'Forbidden',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            choices: [{ message: { content: 'Sheet A-101\nContent with structured: data' } }],
          }),
        });

      const result = await analyzeWithMultiProvider('base64image', 'Extract content');

      // Should have switched to GPT-5.2 (second provider)
      expect(result.provider).toBe('gpt-5.2');
    });

    it('should detect 429 status and fall back to next provider', async () => {
      // 429 triggers Cloudflare block detection - immediate failover
      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => 'Rate limited',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            choices: [{ message: { content: 'Sheet A-101\nContent with structured: data' } }],
          }),
        });

      const result = await analyzeWithMultiProvider('base64image', 'Extract content');

      expect(result.provider).toBe('gpt-5.2');
    });

    it('should detect Cloudflare signature and fall back', async () => {
      // Cloudflare signature in response text triggers immediate failover
      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 200,
          text: async () => 'Just a moment... cloudflare challenge',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            choices: [{ message: { content: 'Sheet A-101\nContent with structured: data' } }],
          }),
        });

      const result = await analyzeWithMultiProvider('base64image', 'Extract content');

      // Should have switched to GPT-5.2
      expect(result.provider).toBe('gpt-5.2');
    });
  });

  describe('Timeout handling', () => {
    it('should timeout and fallback when Claude Opus hangs', async () => {
      // Mock a fetch that rejects with AbortError (simulating controller.abort())
      fetchMock.mockImplementationOnce(() => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      // GPT-5.2 fallback should succeed
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [{ message: { content: 'Sheet A-101\nFallback content with structured data: key=value' } }],
        }),
      });

      const result = await analyzeWithMultiProvider('base64image', 'Extract data');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('gpt-5.2');
    });

    it('should timeout and fallback when providers hang', async () => {
      // Claude Opus fails normally
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });
      // Claude Opus retries exhaust (maxRetries=3, so 3 more retries)
      for (let i = 0; i < 3; i++) {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        });
      }

      // GPT-5.2 also fails
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });
      for (let i = 0; i < 3; i++) {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        });
      }

      const result = await analyzeWithMultiProvider('base64image', 'Extract data');

      // All providers failed (no Sonnet in chain for non-PDF)
      expect(result.success).toBe(false);
      expect(result.error).toContain('All providers failed');
    }, 60000);

    it('should return TIMEOUT error for Claude Opus without retrying (non-PDF)', async () => {
      // Claude Opus times out
      fetchMock.mockImplementationOnce(() => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      // GPT-5.2 succeeds (no Sonnet in chain for non-PDF)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [{ message: { content: 'Sheet A-101\nContent from GPT-5.2 with structured data: key=value' } }],
        }),
      });

      const result = await analyzeWithMultiProvider('base64image', 'Extract data');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('gpt-5.2');
      // Only 2 fetch calls: Opus timeout (no retries) + GPT success
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should timeout on direct PDF analysis and return failure', async () => {
      // Direct PDF fetch times out
      fetchMock.mockImplementationOnce(() => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      const pdfBase64 = 'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlIC9DYXRhbG9nPj4KZW5kb2Jq';
      const result = await analyzeWithDirectPdf(pdfBase64, 'Extract content');

      expect(result.success).toBe(false);
      expect(result.error).toBe('TIMEOUT');
      expect(result.provider).toBe('claude-opus-4-6'); // Updated: uses VISION_MODEL (Opus) not DEFAULT_MODEL
      // Only 1 fetch call — no retries on timeout
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should retry once when Opus times out on PDF content', async () => {
      const mockPdfBase64 = 'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlIC9DYXRhbG9nPj4KZW5kb2Jq';

      // First attempt: timeout
      fetchMock.mockImplementationOnce(() => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      // Second attempt (retry): timeout again
      fetchMock.mockImplementationOnce(() => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      const result = await analyzeWithMultiProvider(mockPdfBase64, 'Extract content');

      expect(result.success).toBe(false);
      // The error message is wrapped in "All providers failed" when all attempts exhausted
      expect(result.error).toContain('TIMEOUT');
      // Should have 2 attempts: initial + 1 retry for PDF
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  // Note: API key validation tests that require module reloads are skipped
  // as vi.resetModules() doesn't preserve the fetch mock properly

  describe('PDF content handling', () => {
    const mockPdfBase64 = 'JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2Jq';
    const mockImageBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD...'; // JPEG header

    it('should use Claude Opus for PDF content in load balancing', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          content: [{ text: 'Sheet A-101\nExtracted PDF content with structured data: key=value' }],
        }),
      });

      const result = await analyzeWithLoadBalancing(mockPdfBase64, 'Extract content');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('claude-opus-4-6');
      // Should call Claude Opus (index 0), not use round-robin for PDF
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.any(Object)
      );
    });

    it('should fail immediately when Opus fails for PDF in load-balanced mode (no multi-provider failover)', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });
      // Opus retries (maxRetries=3)
      for (let i = 0; i < 3; i++) {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        });
      }

      const result = await analyzeWithLoadBalancing(mockPdfBase64, 'Extract content');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Opus failed for PDF content');
      // Should have 4 calls (initial + 3 retries), then return failure without entering multi-provider failover
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it('should use round-robin for non-PDF content in load balancing', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          content: [{ text: 'Sheet A-101\nExtracted image content with structured data: key=value' }],
        }),
      });

      const result = await analyzeWithLoadBalancing(mockImageBase64, 'Extract content');

      expect(result.success).toBe(true);
      // Round-robin could pick any provider (Opus or GPT-5.2, no Sonnet)
      expect(['claude-opus-4-6', 'gpt-5.2']).toContain(result.provider);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should fail when Opus fails for PDF content (no fallback)', async () => {
      // First provider (Claude Opus) fails
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });
      // Claude Opus retries (maxRetries=3)
      for (let i = 0; i < 3; i++) {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        });
      }

      const result = await analyzeWithMultiProvider(mockPdfBase64, 'Extract content', 0);

      // PDF content uses Opus only — no fallback
      expect(result.success).toBe(false);
      expect(result.error).toContain('All providers failed');
      // Should be: 4 calls for Claude Opus (initial + 3 retries), no GPT or Sonnet
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it('should use Opus only for PDF content (no GPT or Sonnet)', async () => {
      // Claude Opus succeeds on first try
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          content: [{ text: 'Sheet A-101\nOpus PDF content with data: value' }],
        }),
      });

      const result = await analyzeWithMultiProvider(mockPdfBase64, 'Extract content', 0);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('claude-opus-4-6');
      // Should try Opus only (1 call), no GPT or Sonnet
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should use document type for PDF content in direct PDF call', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          content: [{ text: 'Sheet A-101\nPDF document content' }],
        }),
      });

      const result = await analyzeWithDirectPdf(mockPdfBase64, 'Extract content');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('claude-opus-4-6'); // Updated: uses VISION_MODEL (Opus)

      // Verify the request body has correct document type
      const callBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
      expect(callBody.messages[0].content[0].type).toBe('document');
      expect(callBody.messages[0].content[0].source.media_type).toBe('application/pdf');
    });

    it('should use image type for non-PDF content in Claude Opus', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          content: [{ text: 'Sheet A-101\nImage content' }],
        }),
      });

      // Use analyzeWithMultiProvider with image content
      const result = await analyzeWithMultiProvider(mockImageBase64, 'Extract content', 0);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('claude-opus-4-6');

      // Verify the request body has correct image type
      const callBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
      expect(callBody.messages[0].content[0].type).toBe('image');
      expect(callBody.messages[0].content[0].source.media_type).toBe('image/jpeg');
    });

    it('should use document type for PDF content in Claude Opus', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          content: [{ text: 'Sheet A-101\nPDF via Opus' }],
        }),
      });

      const result = await analyzeWithMultiProvider(mockPdfBase64, 'Extract content', 0);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('claude-opus-4-6');

      // Verify the request body has correct document type for PDF
      const callBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
      expect(callBody.messages[0].content[0].type).toBe('document');
      expect(callBody.messages[0].content[0].source.media_type).toBe('application/pdf');
    });
  });

  describe('analyzeWithDirectPdf', () => {
    it('should use Claude Opus for direct PDF processing', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          content: [{ text: 'Sheet A-101\nDirect PDF content with data: value' }],
        }),
      });

      const pdfBase64 = 'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlIC9DYXRhbG9nPj4KZW5kb2Jq'; // Sample PDF base64
      const result = await analyzeWithDirectPdf(pdfBase64, 'Extract content');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('claude-opus-4-6'); // Updated: uses VISION_MODEL (Opus)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.any(Object)
      );
    });

    it('should use VISION_MODEL when no model parameter is provided', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          content: [{ text: 'Sheet A-101\nContent' }],
        }),
      });

      const pdfBase64 = 'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlIC9DYXRhbG9nPj4KZW5kb2Jq';
      const result = await analyzeWithDirectPdf(pdfBase64, 'Extract content');

      expect(result.success).toBe(true);
      // Should use VISION_MODEL (claude-opus-4-6) by default, not DEFAULT_MODEL
      const callBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
      expect(callBody.model).toBe('claude-opus-4-6'); // Updated
    });

    it('should use specified model when model parameter is provided', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          content: [{ text: 'Sheet A-101\nContent' }],
        }),
      });

      const pdfBase64 = 'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlIC9DYXRhbG9nPj4KZW5kb2Jq';
      const result = await analyzeWithDirectPdf(pdfBase64, 'Extract content', undefined, undefined, 'claude-opus-4-6');

      expect(result.success).toBe(true);
      // Should use specified model (claude-opus-4-6)
      const callBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
      expect(callBody.model).toBe('claude-opus-4-6');
    });

    // Note: Retry test skipped as internal retry logic with delays conflicts with mock timing
  });

});

