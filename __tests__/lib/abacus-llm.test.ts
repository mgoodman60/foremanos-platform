import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock fetch globally
const fetchMock = vi.fn();
global.fetch = fetchMock;

// Store original env
const originalEnv = process.env.ABACUSAI_API_KEY;

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
    // Set API key for tests
    process.env.ABACUSAI_API_KEY = 'test-abacus-api-key';
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.ABACUSAI_API_KEY = originalEnv;
    } else {
      delete process.env.ABACUSAI_API_KEY;
    }
  });

  describe('callAbacusLLM', () => {
    describe('Success cases', () => {
      it('should call Abacus API with default options', async () => {
        const mockResponse = {
          choices: [
            {
              message: {
                content: 'This is a test response',
              },
            },
          ],
          model: 'gpt-4o',
          usage: {
            prompt_tokens: 50,
            completion_tokens: 100,
            total_tokens: 150,
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
        expect(result.model).toBe('gpt-4o');
        expect(result.usage).toEqual({
          prompt_tokens: 50,
          completion_tokens: 100,
          total_tokens: 150,
        });

        expect(fetchMock).toHaveBeenCalledWith(
          'https://apps.abacus.ai/v1/chat/completions',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-abacus-api-key',
            },
          })
        );

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody).toEqual({
          model: 'gpt-4o',
          messages,
          temperature: 0.3,
          max_tokens: 4000,
          web_search: false,
        });
      });

      it('should call Abacus API with custom options', async () => {
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
          web_search: true,
        };

        const result = await callAbacusLLM(messages, options);

        expect(result.content).toBe('Custom response');
        expect(result.model).toBe('gpt-4-turbo');

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody).toEqual({
          model: 'gpt-4-turbo',
          messages,
          temperature: 0.7,
          max_tokens: 2000,
          web_search: true,
        });
      });

      it('should include response_format when provided', async () => {
        const mockResponse = {
          choices: [
            {
              message: {
                content: '{"result": "json response"}',
              },
            },
          ],
          model: 'gpt-4o',
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
        expect(callBody.response_format).toEqual({ type: 'json_object' });
      });

      it('should not include response_format when not provided', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'response' } }],
          model: 'gpt-4o',
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
      });

      it('should handle messages with complex content', async () => {
        const mockResponse = {
          choices: [
            {
              message: {
                content: 'Analyzed image',
              },
            },
          ],
          model: 'gpt-4o',
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
        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.messages).toEqual(messages);
      });

      it('should handle messages with PDF document source', async () => {
        const mockResponse = {
          choices: [
            {
              message: {
                content: 'Analyzed PDF',
              },
            },
          ],
          model: 'gpt-4o',
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
      });

      it('should handle empty content in response', async () => {
        const mockResponse = {
          choices: [
            {
              message: {
                content: '',
              },
            },
          ],
          model: 'gpt-4o',
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

      it('should handle missing choices array', async () => {
        const mockResponse = {
          model: 'gpt-4o',
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
        expect(result.model).toBe('gpt-4o');
      });

      it('should handle missing usage data', async () => {
        const mockResponse = {
          choices: [
            {
              message: {
                content: 'response',
              },
            },
          ],
          model: 'gpt-4o',
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
      it('should throw error when ABACUSAI_API_KEY is not set', async () => {
        delete process.env.ABACUSAI_API_KEY;

        const messages: LLMMessage[] = [
          { role: 'user', content: 'Hello' },
        ];

        await expect(callAbacusLLM(messages)).rejects.toThrow(
          'ABACUSAI_API_KEY environment variable is not set'
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
          'LLM API request failed (400): Bad request - invalid model'
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
          'LLM API request failed (401): Invalid API key'
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
          'LLM API request failed (429): Rate limit exceeded'
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
          'LLM API request failed (500): Internal server error'
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
          'LLM API request failed (503): No error details available'
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
          choices: [
            {
              message: {
                content: 'response',
              },
            },
          ],
          model: 'gpt-4o',
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
          choices: [{ message: { content: 'response' } }],
          model: 'gpt-4o',
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
          choices: [{ message: { content: 'response' } }],
          model: 'gpt-4o',
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
          choices: [{ message: { content: 'x' } }],
          model: 'gpt-4o',
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
          choices: [{ message: { content: 'response' } }],
          model: 'gpt-4o',
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
          choices: [{ message: { content: 'response' } }],
          model: 'gpt-4o',
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
          choices: [{ message: { content: 'response' } }],
          model: 'gpt-4o',
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

      it('should handle multiple message roles', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'response' } }],
          model: 'gpt-4o',
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
        expect(callBody.messages).toEqual(messages);
      });
    });
  });

  describe('callAbacusLLMWithVision', () => {
    describe('Success cases', () => {
      it('should call Abacus API with vision format', async () => {
        const mockResponse = {
          choices: [
            {
              message: {
                content: 'I see a construction site',
              },
            },
          ],
          model: 'gpt-4o',
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
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
        expect(result.model).toBe('gpt-4o');
        expect(result.usage?.total_tokens).toBe(150);

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.model).toBe('gpt-4o');
        expect(callBody.messages).toEqual([
          {
            role: 'user',
            content: `${textPrompt}\n\n[Image: data:image/jpeg;base64,${imageBase64}]`,
          },
        ]);
      });

      it('should use custom model when provided', async () => {
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
        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.model).toBe('gpt-4-turbo');
      });

      it('should pass through custom options', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'response' } }],
          model: 'gpt-4o',
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
            web_search: true,
          }
        );

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.temperature).toBe(0.8);
        expect(callBody.max_tokens).toBe(1000);
        expect(callBody.web_search).toBe(true);
      });

      it('should handle empty image data', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'No image detected' } }],
          model: 'gpt-4o',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await callAbacusLLMWithVision('What is this?', '');

        expect(result.content).toBe('No image detected');
        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.messages[0].content).toContain('[Image: data:image/jpeg;base64,]');
      });

      it('should handle very long image base64 data', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Large image processed' } }],
          model: 'gpt-4o',
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
      it('should throw error when ABACUSAI_API_KEY is not set', async () => {
        delete process.env.ABACUSAI_API_KEY;

        await expect(
          callAbacusLLMWithVision('What is this?', 'imagedata')
        ).rejects.toThrow('ABACUSAI_API_KEY environment variable is not set');
      });

      it('should propagate API errors', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: async () => 'Invalid image format',
        });

        await expect(
          callAbacusLLMWithVision('Describe', 'badimage')
        ).rejects.toThrow('LLM API request failed (400): Invalid image format');
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
          choices: [{ message: { content: 'Image analyzed' } }],
          model: 'gpt-4o',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await callAbacusLLMWithVision('', 'imagedata');

        expect(result.content).toBe('Image analyzed');
        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.messages[0].content).toContain('\n\n[Image: data:image/jpeg;base64,imagedata]');
      });

      it('should handle special characters in text prompt', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Processed' } }],
          model: 'gpt-4o',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const prompt = 'What are these symbols: <>&"\'?';
        const result = await callAbacusLLMWithVision(prompt, 'imagedata');

        expect(result.content).toBe('Processed');
        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.messages[0].content).toContain(prompt);
      });

      it('should handle multiline text prompt', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Response' } }],
          model: 'gpt-4o',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const prompt = 'First line\nSecond line\nThird line';
        const result = await callAbacusLLMWithVision(prompt, 'imagedata');

        expect(result.content).toBe('Response');
        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.messages[0].content).toContain(prompt);
      });

      it('should default to gpt-4o when no model specified', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Response' } }],
          model: 'gpt-4o',
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        await callAbacusLLMWithVision('Analyze', 'imagedata', {});

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.model).toBe('gpt-4o');
      });

      it('should preserve existing options when merging', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Response' } }],
          model: 'gpt-4o',
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
        expect(callBody.response_format).toEqual({ type: 'json_object' });
        expect(callBody.model).toBe('gpt-4o');
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
        choices: [{ message: { content: 'test' } }],
        model: 'gpt-4o',
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
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
