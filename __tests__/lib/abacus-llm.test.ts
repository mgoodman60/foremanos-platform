import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock fetch globally
const fetchMock = vi.fn();
global.fetch = fetchMock;

// Store original env
const originalOpenAIKey = process.env.OPENAI_API_KEY;
const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;

// Import after mocking
import {
  callAbacusLLM,
  callAbacusLLMWithVision,
  type LLMMessage,
  type LLMOptions,
  type LLMResponse,
} from '@/lib/abacus-llm';

describe('Abacus LLM', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    // Set API keys for tests (default model is Claude, so Anthropic key is needed)
    process.env.OPENAI_API_KEY = 'test-openai-api-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-api-key';
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Restore original env
    if (originalOpenAIKey !== undefined) {
      process.env.OPENAI_API_KEY = originalOpenAIKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
    if (originalAnthropicKey !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  describe('callAbacusLLM', () => {
    describe('Success cases', () => {
      it('should route to Anthropic API with default model (Claude)', async () => {
        const mockResponse = {
          content: [{ text: 'This is a test response' }],
          model: 'claude-sonnet-4-5-20250929',
          usage: {
            input_tokens: 50,
            output_tokens: 100,
          },
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const messages: LLMMessage[] = [
          { role: 'user', content: 'Hello, how are you?' },
        ];

        const result = await callAbacusLLM(messages);

        expect(result.content).toBe('This is a test response');
        expect(result.model).toBe('claude-sonnet-4-5-20250929');
        expect(result.usage).toEqual({
          prompt_tokens: 50,
          completion_tokens: 100,
          total_tokens: 150,
        });

        expect(fetchMock).toHaveBeenCalledWith(
          'https://api.anthropic.com/v1/messages',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'x-api-key': 'test-anthropic-api-key',
              'anthropic-version': '2023-06-01',
            }),
          })
        );

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.model).toBe('claude-sonnet-4-5-20250929');
        expect(callBody.temperature).toBe(0.3);
        expect(callBody.max_tokens).toBe(4000);
      });

      it('should route to OpenAI API with explicit OpenAI model', async () => {
        const mockResponse = {
          choices: [
            {
              message: {
                content: 'Custom response',
              },
            },
          ],
          model: 'gpt-4-turbo',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const messages: LLMMessage[] = [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'What is the weather?' },
        ];

        const options: LLMOptions = {
          model: 'gpt-4-turbo',
          temperature: 0.7,
          max_tokens: 2000,
        };

        const result = await callAbacusLLM(messages, options);

        expect(result.content).toBe('Custom response');
        expect(result.model).toBe('gpt-4-turbo');

        expect(fetchMock).toHaveBeenCalledWith(
          'https://api.openai.com/v1/chat/completions',
          expect.any(Object)
        );

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.model).toBe('gpt-4-turbo');
        expect(callBody.temperature).toBe(0.7);
        expect(callBody.max_tokens).toBe(2000);
      });

      it('should handle response_format with Claude by adding JSON instruction', async () => {
        const mockResponse = {
          content: [{ text: '{"result": "json response"}' }],
          model: 'claude-sonnet-4-5-20250929',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const messages: LLMMessage[] = [
          { role: 'user', content: 'Return JSON' },
        ];

        const options: LLMOptions = {
          response_format: { type: 'json_object' },
        };

        await callAbacusLLM(messages, options);

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        // Claude doesn't have response_format; instead, JSON instruction is added to system
        expect(callBody.system).toContain('You must respond with valid JSON only');
      });

      it('should not include response_format when not provided', async () => {
        const mockResponse = {
          content: [{ text: 'response' }],
          model: 'claude-sonnet-4-5-20250929',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const messages: LLMMessage[] = [
          { role: 'user', content: 'Hello' },
        ];

        await callAbacusLLM(messages);

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.response_format).toBeUndefined();
        expect(callBody.system).toBeUndefined();
      });

      it('should handle messages with complex content', async () => {
        const mockResponse = {
          content: [{ text: 'Analyzed image' }],
          model: 'claude-sonnet-4-5-20250929',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const messages: LLMMessage[] = [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is in this image?' },
              { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,abc123' } },
            ],
          },
        ];

        const result = await callAbacusLLM(messages);

        expect(result.content).toBe('Analyzed image');
        // Content blocks are converted to Claude format
        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        const imageBlock = callBody.messages[0].content.find((b: any) => b.type === 'image');
        expect(imageBlock).toBeDefined();
        expect(imageBlock.source.media_type).toBe('image/jpeg');
      });

      it('should handle messages with PDF document source', async () => {
        const mockResponse = {
          content: [{ text: 'Analyzed PDF' }],
          model: 'claude-sonnet-4-5-20250929',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const messages: LLMMessage[] = [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this document' },
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: 'base64pdfdata',
                },
              },
            ],
          },
        ];

        const result = await callAbacusLLM(messages);

        expect(result.content).toBe('Analyzed PDF');
        // Document/source blocks pass through natively to Claude
        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        const docBlock = callBody.messages[0].content.find((b: any) => b.type === 'document');
        expect(docBlock).toBeDefined();
        expect(docBlock.source.media_type).toBe('application/pdf');
      });

      it('should handle empty content in response', async () => {
        const mockResponse = {
          content: [{ text: '' }],
          model: 'claude-sonnet-4-5-20250929',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const messages: LLMMessage[] = [
          { role: 'user', content: 'Hello' },
        ];

        const result = await callAbacusLLM(messages);

        expect(result.content).toBe('');
      });

      it('should handle missing content array', async () => {
        const mockResponse = {
          model: 'claude-sonnet-4-5-20250929',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const messages: LLMMessage[] = [
          { role: 'user', content: 'Hello' },
        ];

        const result = await callAbacusLLM(messages);

        expect(result.content).toBe('');
        expect(result.model).toBe('claude-sonnet-4-5-20250929');
      });

      it('should handle missing usage data', async () => {
        const mockResponse = {
          content: [{ text: 'response' }],
          model: 'claude-sonnet-4-5-20250929',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const messages: LLMMessage[] = [
          { role: 'user', content: 'Hello' },
        ];

        const result = await callAbacusLLM(messages);

        expect(result.usage).toBeUndefined();
      });

      it('should fallback to options model when response model missing', async () => {
        const mockResponse = {
          choices: [
            {
              message: {
                content: 'response',
              },
            },
          ],
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const messages: LLMMessage[] = [
          { role: 'user', content: 'Hello' },
        ];

        const result = await callAbacusLLM(messages, { model: 'gpt-3.5-turbo' });

        expect(result.model).toBe('gpt-3.5-turbo');
      });
    });

    describe('Error cases', () => {
      it('should throw error when ANTHROPIC_API_KEY is not set for Claude models', async () => {
        delete process.env.ANTHROPIC_API_KEY;

        const messages: LLMMessage[] = [
          { role: 'user', content: 'Hello' },
        ];

        await expect(callAbacusLLM(messages)).rejects.toThrow(
          'ANTHROPIC_API_KEY environment variable is not set'
        );

        expect(fetchMock).not.toHaveBeenCalled();
      });

      it('should throw error when API returns 400 status', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: async () => 'Bad request - invalid model',
        });

        const messages: LLMMessage[] = [
          { role: 'user', content: 'Hello' },
        ];

        await expect(callAbacusLLM(messages)).rejects.toThrow(
          'Anthropic API request failed (400): Bad request - invalid model'
        );
      });

      it('should throw error when API returns 401 status', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => 'Invalid API key',
        });

        const messages: LLMMessage[] = [
          { role: 'user', content: 'Hello' },
        ];

        await expect(callAbacusLLM(messages)).rejects.toThrow(
          'Anthropic API request failed (401): Invalid API key'
        );
      });

      it('should throw error when API returns 429 status', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => 'Rate limit exceeded',
        });

        const messages: LLMMessage[] = [
          { role: 'user', content: 'Hello' },
        ];

        await expect(callAbacusLLM(messages)).rejects.toThrow(
          'Anthropic API request failed (429): Rate limit exceeded'
        );
      });

      it('should throw error when API returns 500 status', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal server error',
        });

        const messages: LLMMessage[] = [
          { role: 'user', content: 'Hello' },
        ];

        await expect(callAbacusLLM(messages)).rejects.toThrow(
          'Anthropic API request failed (500): Internal server error'
        );
      });

      it('should handle error when text() fails', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: async () => {
            throw new Error('Failed to read response');
          },
        });

        const messages: LLMMessage[] = [
          { role: 'user', content: 'Hello' },
        ];

        await expect(callAbacusLLM(messages)).rejects.toThrow(
          'Anthropic API request failed (503): No error details available'
        );
      });

      it('should handle network error', async () => {
        fetchMock.mockRejectedValueOnce(new Error('Network error'));

        const messages: LLMMessage[] = [
          { role: 'user', content: 'Hello' },
        ];

        await expect(callAbacusLLM(messages)).rejects.toThrow('Network error');
      });

      it('should handle JSON parse error', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => {
            throw new Error('Invalid JSON');
          },
        });

        const messages: LLMMessage[] = [
          { role: 'user', content: 'Hello' },
        ];

        await expect(callAbacusLLM(messages)).rejects.toThrow('Invalid JSON');
      });
    });

    describe('Edge cases', () => {
      it('should handle empty messages array', async () => {
        const mockResponse = {
          content: [{ text: 'response' }],
          model: 'claude-sonnet-4-5-20250929',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const messages: LLMMessage[] = [];

        const result = await callAbacusLLM(messages);

        expect(result.content).toBe('response');
        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.messages).toEqual([]);
      });

      it('should handle temperature of 0', async () => {
        const mockResponse = {
          content: [{ text: 'response' }],
          model: 'claude-sonnet-4-5-20250929',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const messages: LLMMessage[] = [
          { role: 'user', content: 'Hello' },
        ];

        await callAbacusLLM(messages, { temperature: 0 });

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.temperature).toBe(0);
      });

      it('should handle temperature of 1', async () => {
        const mockResponse = {
          content: [{ text: 'response' }],
          model: 'claude-sonnet-4-5-20250929',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const messages: LLMMessage[] = [
          { role: 'user', content: 'Hello' },
        ];

        await callAbacusLLM(messages, { temperature: 1 });

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.temperature).toBe(1);
      });

      it('should handle max_tokens of 1', async () => {
        const mockResponse = {
          content: [{ text: 'x' }],
          model: 'claude-sonnet-4-5-20250929',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const messages: LLMMessage[] = [
          { role: 'user', content: 'Hello' },
        ];

        await callAbacusLLM(messages, { max_tokens: 1 });

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.max_tokens).toBe(1);
      });

      it('should handle very large max_tokens', async () => {
        const mockResponse = {
          content: [{ text: 'response' }],
          model: 'claude-sonnet-4-5-20250929',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const messages: LLMMessage[] = [
          { role: 'user', content: 'Hello' },
        ];

        await callAbacusLLM(messages, { max_tokens: 100000 });

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.max_tokens).toBe(100000);
      });

      it('should handle very long message content', async () => {
        const mockResponse = {
          content: [{ text: 'response' }],
          model: 'claude-sonnet-4-5-20250929',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const longContent = 'a'.repeat(50000);
        const messages: LLMMessage[] = [
          { role: 'user', content: longContent },
        ];

        const result = await callAbacusLLM(messages);

        expect(result.content).toBe('response');
        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.messages[0].content).toBe(longContent);
      });

      it('should handle special characters in content', async () => {
        const mockResponse = {
          content: [{ text: 'response' }],
          model: 'claude-sonnet-4-5-20250929',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const messages: LLMMessage[] = [
          { role: 'user', content: 'Hello "world" \n\t Special chars: <>&\'" ' },
        ];

        const result = await callAbacusLLM(messages);

        expect(result.content).toBe('response');
      });

      it('should handle multiple message roles with system extraction', async () => {
        const mockResponse = {
          content: [{ text: 'response' }],
          model: 'claude-sonnet-4-5-20250929',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const messages: LLMMessage[] = [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
          { role: 'user', content: 'How are you?' },
        ];

        const result = await callAbacusLLM(messages);

        expect(result.content).toBe('response');
        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        // System message should be extracted for Anthropic format
        expect(callBody.system).toBe('You are helpful');
        expect(callBody.messages).toEqual([
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
          { role: 'user', content: 'How are you?' },
        ]);
      });
    });
  });

  describe('callAbacusLLMWithVision', () => {
    describe('Success cases', () => {
      it('should call API with vision format', async () => {
        const mockResponse = {
          content: [{ text: 'I see a construction site' }],
          model: 'claude-sonnet-4-5-20250929',
          usage: {
            input_tokens: 100,
            output_tokens: 50,
          },
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const textPrompt = 'What do you see in this image?';
        const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

        const result = await callAbacusLLMWithVision(textPrompt, imageBase64);

        expect(result.content).toBe('I see a construction site');
        expect(result.model).toBe('claude-sonnet-4-5-20250929');
        expect(result.usage?.total_tokens).toBe(150);

        // Routed to Anthropic since default model is Claude
        expect(fetchMock).toHaveBeenCalledWith(
          'https://api.anthropic.com/v1/messages',
          expect.any(Object)
        );

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.model).toBe('claude-sonnet-4-5-20250929');
        // Image should be converted to Claude native format
        const imageBlock = callBody.messages[0].content.find((b: any) => b.type === 'image');
        expect(imageBlock).toBeDefined();
        expect(imageBlock.source.type).toBe('base64');
        expect(imageBlock.source.media_type).toBe('image/jpeg');
      });

      it('should use custom OpenAI model when provided', async () => {
        const mockResponse = {
          choices: [
            {
              message: {
                content: 'Analysis result',
              },
            },
          ],
          model: 'gpt-4-turbo',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const textPrompt = 'Analyze this blueprint';
        const imageBase64 = 'base64imagedata';

        const result = await callAbacusLLMWithVision(
          textPrompt,
          imageBase64,
          { model: 'gpt-4-turbo' }
        );

        expect(result.content).toBe('Analysis result');
        expect(fetchMock).toHaveBeenCalledWith(
          'https://api.openai.com/v1/chat/completions',
          expect.any(Object)
        );
        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.model).toBe('gpt-4-turbo');
      });

      it('should pass through custom options', async () => {
        const mockResponse = {
          content: [{ text: 'response' }],
          model: 'claude-sonnet-4-5-20250929',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const textPrompt = 'Describe this';
        const imageBase64 = 'imagedata';

        await callAbacusLLMWithVision(
          textPrompt,
          imageBase64,
          {
            temperature: 0.8,
            max_tokens: 1000,
          }
        );

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.temperature).toBe(0.8);
        expect(callBody.max_tokens).toBe(1000);
      });

      it('should handle empty image data', async () => {
        const mockResponse = {
          content: [{ text: 'No image detected' }],
          model: 'claude-sonnet-4-5-20250929',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await callAbacusLLMWithVision('What is this?', '');

        expect(result.content).toBe('No image detected');
      });

      it('should handle very long image base64 data', async () => {
        const mockResponse = {
          content: [{ text: 'Large image processed' }],
          model: 'claude-sonnet-4-5-20250929',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const longBase64 = 'a'.repeat(100000);
        const result = await callAbacusLLMWithVision('Analyze', longBase64);

        expect(result.content).toBe('Large image processed');
      });
    });

    describe('Error cases', () => {
      it('should throw error when ANTHROPIC_API_KEY is not set for default model', async () => {
        delete process.env.ANTHROPIC_API_KEY;

        await expect(
          callAbacusLLMWithVision('What is this?', 'imagedata')
        ).rejects.toThrow('ANTHROPIC_API_KEY environment variable is not set');
      });

      it('should propagate API errors', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: async () => 'Invalid image format',
        });

        await expect(
          callAbacusLLMWithVision('Describe', 'badimage')
        ).rejects.toThrow('Anthropic API request failed (400): Invalid image format');
      });

      it('should handle network errors', async () => {
        fetchMock.mockRejectedValueOnce(new Error('Connection timeout'));

        await expect(
          callAbacusLLMWithVision('Analyze', 'image')
        ).rejects.toThrow('Connection timeout');
      });
    });

    describe('Edge cases', () => {
      it('should handle empty text prompt', async () => {
        const mockResponse = {
          content: [{ text: 'Image analyzed' }],
          model: 'claude-sonnet-4-5-20250929',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await callAbacusLLMWithVision('', 'imagedata');

        expect(result.content).toBe('Image analyzed');
        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        const textBlock = callBody.messages[0].content.find((b: any) => b.type === 'text');
        expect(textBlock.text).toBe('');
      });

      it('should handle special characters in text prompt', async () => {
        const mockResponse = {
          content: [{ text: 'Processed' }],
          model: 'claude-sonnet-4-5-20250929',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const prompt = 'What are these symbols: <>&"\'?';
        const result = await callAbacusLLMWithVision(prompt, 'imagedata');

        expect(result.content).toBe('Processed');
        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        const textBlock = callBody.messages[0].content.find((b: any) => b.type === 'text');
        expect(textBlock.text).toBe(prompt);
      });

      it('should handle multiline text prompt', async () => {
        const mockResponse = {
          content: [{ text: 'Response' }],
          model: 'claude-sonnet-4-5-20250929',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const prompt = 'First line\nSecond line\nThird line';
        const result = await callAbacusLLMWithVision(prompt, 'imagedata');

        expect(result.content).toBe('Response');
        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        const textBlock = callBody.messages[0].content.find((b: any) => b.type === 'text');
        expect(textBlock.text).toBe(prompt);
      });

      it('should default to EXTRACTION_MODEL (Claude) when no model specified', async () => {
        const mockResponse = {
          content: [{ text: 'Response' }],
          model: 'claude-sonnet-4-5-20250929',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        await callAbacusLLMWithVision('Analyze', 'imagedata', {});

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.model).toBe('claude-sonnet-4-5-20250929');
      });

      it('should preserve existing options when merging', async () => {
        const mockResponse = {
          content: [{ text: 'Response' }],
          model: 'claude-sonnet-4-5-20250929',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        await callAbacusLLMWithVision(
          'Analyze',
          'imagedata',
          {
            temperature: 0.5,
            response_format: { type: 'json_object' },
          }
        );

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.temperature).toBe(0.5);
        // JSON instruction added to system for Claude
        expect(callBody.system).toContain('You must respond with valid JSON only');
        expect(callBody.model).toBe('claude-sonnet-4-5-20250929');
      });
    });
  });

  describe('Type definitions', () => {
    it('should accept LLMMessage with string content', () => {
      const message: LLMMessage = {
        role: 'user',
        content: 'Hello',
      };
      expect(message.content).toBe('Hello');
    });

    it('should accept LLMMessage with array content', () => {
      const message: LLMMessage = {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          { type: 'image_url', image_url: { url: 'http://example.com/image.jpg' } },
        ],
      };
      expect(Array.isArray(message.content)).toBe(true);
    });

    it('should accept all role types', () => {
      const systemMsg: LLMMessage = { role: 'system', content: 'System' };
      const userMsg: LLMMessage = { role: 'user', content: 'User' };
      const assistantMsg: LLMMessage = { role: 'assistant', content: 'Assistant' };

      expect(systemMsg.role).toBe('system');
      expect(userMsg.role).toBe('user');
      expect(assistantMsg.role).toBe('assistant');
    });

    it('should return properly typed LLMResponse', async () => {
      const mockResponse = {
        content: [{ text: 'test' }],
        model: 'claude-sonnet-4-5-20250929',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
        },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const messages: LLMMessage[] = [{ role: 'user', content: 'test' }];
      const result: LLMResponse = await callAbacusLLM(messages);

      expect(typeof result.content).toBe('string');
      expect(typeof result.model).toBe('string');
      expect(result.usage?.prompt_tokens).toBe(10);
      expect(result.usage?.completion_tokens).toBe(20);
      expect(result.usage?.total_tokens).toBe(30);
    });
  });
});
