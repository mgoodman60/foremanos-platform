import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock fetch globally
const fetchMock = vi.fn();
global.fetch = fetchMock;

// Set environment variables before importing
process.env.OPENAI_API_KEY = 'sk-test-openai-key';
process.env.ANTHROPIC_API_KEY = 'sk-ant-test-anthropic-key';

// Import after setting env vars
import {
  callOpenAI,
  callAnthropic,
  callLLM,
  streamLLM,
  type LLMMessage,
} from '@/lib/llm-providers';

describe('LLM Providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('callOpenAI', () => {
    it('should call OpenAI API with correct parameters', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello from GPT' } }],
          model: 'gpt-4o-mini',
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
      });

      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' },
      ];

      const result = await callOpenAI(messages, { model: 'gpt-4o-mini' });

      expect(result.content).toBe('Hello from GPT');
      expect(result.model).toBe('gpt-4o-mini');
      expect(result.usage?.total_tokens).toBe(30);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer sk-test-openai-key',
          }),
        })
      );
    });

    it('should include reasoning_effort for o3 models', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Reasoning response' } }],
          model: 'o3-mini',
        }),
      });

      const messages: LLMMessage[] = [{ role: 'user', content: 'Think hard' }];
      await callOpenAI(messages, { model: 'o3-mini', reasoning_effort: 'high' });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.reasoning_effort).toBe('high');
    });

    it('should throw error on API failure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      const messages: LLMMessage[] = [{ role: 'user', content: 'Hello' }];
      await expect(callOpenAI(messages)).rejects.toThrow('OpenAI API request failed (429)');
    });
  });

  describe('callAnthropic', () => {
    it('should call Anthropic API with correct parameters', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: 'Hello from Claude' }],
          model: 'claude-sonnet-4-5-20250929',
          usage: { input_tokens: 15, output_tokens: 25 },
        }),
      });

      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are a construction expert' },
        { role: 'user', content: 'Tell me about rebar' },
      ];

      const result = await callAnthropic(messages);

      expect(result.content).toBe('Hello from Claude');
      expect(result.model).toBe('claude-sonnet-4-5-20250929');
      expect(result.usage?.prompt_tokens).toBe(15);
      expect(result.usage?.completion_tokens).toBe(25);
      expect(result.usage?.total_tokens).toBe(40);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': 'sk-ant-test-anthropic-key',
            'anthropic-version': '2023-06-01',
          }),
        })
      );
    });

    it('should extract system message for Anthropic format', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: 'Response' }],
          model: 'claude-sonnet-4-5-20250929',
        }),
      });

      const messages: LLMMessage[] = [
        { role: 'system', content: 'System prompt here' },
        { role: 'user', content: 'User message' },
      ];

      await callAnthropic(messages);

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.system).toBe('System prompt here');
      expect(callBody.messages).toEqual([{ role: 'user', content: 'User message' }]);
    });

    it('should throw error on API failure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      const messages: LLMMessage[] = [{ role: 'user', content: 'Hello' }];
      await expect(callAnthropic(messages)).rejects.toThrow('Anthropic API request failed (500)');
    });
  });

  describe('callAnthropic - content block conversion', () => {
    it('should convert image_url with data URL to Claude image format', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: 'Image analyzed' }],
          model: 'claude-sonnet-4-5-20250929',
        }),
      });

      const messages: LLMMessage[] = [{
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgo=' } },
        ],
      }];

      await callAnthropic(messages);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const contentBlocks = body.messages[0].content;
      // text block should pass through
      expect(contentBlocks[0]).toEqual({ type: 'text', text: 'Analyze this' });
      // image_url should be converted to Claude image format
      expect(contentBlocks[1]).toEqual({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' },
      });
    });

    it('should convert PDF data URL to Claude document format', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: 'PDF analyzed' }],
          model: 'claude-sonnet-4-5-20250929',
        }),
      });

      const messages: LLMMessage[] = [{
        role: 'user',
        content: [
          { type: 'text', text: 'Read this' },
          { type: 'image_url', image_url: { url: 'data:application/pdf;base64,JVBERi0=' } },
        ],
      }];

      await callAnthropic(messages);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const docBlock = body.messages[0].content[1];
      expect(docBlock).toEqual({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0=' },
      });
    });

    it('should handle raw base64 without data URL prefix as image/jpeg', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: 'OK' }],
          model: 'claude-sonnet-4-5-20250929',
        }),
      });

      const messages: LLMMessage[] = [{
        role: 'user',
        content: [
          { type: 'text', text: 'Look' },
          { type: 'image_url', image_url: { url: 'rawbase64data' } },
        ],
      }];

      await callAnthropic(messages);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const imgBlock = body.messages[0].content[1];
      expect(imgBlock).toEqual({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: 'rawbase64data' },
      });
    });

    it('should pass through document/source blocks natively', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: 'OK' }],
          model: 'claude-sonnet-4-5-20250929',
        }),
      });

      const docBlock = {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: 'pdfdata' },
      };
      const messages: LLMMessage[] = [{
        role: 'user',
        content: [
          { type: 'text', text: 'Read' },
          docBlock as any,
        ],
      }];

      await callAnthropic(messages);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.messages[0].content[1]).toEqual(docBlock);
    });

    it('should convert file blocks to Claude document format', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: 'OK' }],
          model: 'claude-sonnet-4-5-20250929',
        }),
      });

      const messages: LLMMessage[] = [{
        role: 'user',
        content: [
          { type: 'text', text: 'Read' },
          { type: 'file', file: { filename: 'doc.pdf', file_data: 'filebase64' } },
        ],
      }];

      await callAnthropic(messages);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.messages[0].content[1]).toEqual({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: 'filebase64' },
      });
    });

    it('should pass through string content unchanged', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: 'OK' }],
          model: 'claude-sonnet-4-5-20250929',
        }),
      });

      const messages: LLMMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      await callAnthropic(messages);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.messages[0].content).toBe('Hello');
    });
  });

  describe('callAnthropic - response_format handling', () => {
    it('should add JSON instruction to system prompt when response_format is json_object', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: '{"key": "value"}' }],
          model: 'claude-sonnet-4-5-20250929',
        }),
      });

      const messages: LLMMessage[] = [
        { role: 'user', content: 'Give me JSON' },
      ];

      await callAnthropic(messages, { response_format: { type: 'json_object' } });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.system).toContain('valid JSON only');
      expect(body.system).toContain('No markdown');
    });

    it('should append JSON instruction to existing system message', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: '{}' }],
          model: 'claude-sonnet-4-5-20250929',
        }),
      });

      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are a construction expert' },
        { role: 'user', content: 'Give me JSON' },
      ];

      await callAnthropic(messages, { response_format: { type: 'json_object' } });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.system).toContain('construction expert');
      expect(body.system).toContain('valid JSON only');
    });

    it('should not add JSON instruction when response_format is not set', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: 'OK' }],
          model: 'claude-sonnet-4-5-20250929',
        }),
      });

      const messages: LLMMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      await callAnthropic(messages);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.system).toBeUndefined();
    });
  });

  describe('callOpenAI - response_format', () => {
    it('should include response_format in request body when provided', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"ok":true}' } }],
          model: 'gpt-4o-mini',
        }),
      });

      const messages: LLMMessage[] = [
        { role: 'user', content: 'JSON please' },
      ];

      await callOpenAI(messages, { response_format: { type: 'json_object' } });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.response_format).toEqual({ type: 'json_object' });
    });

    it('should not include response_format when not provided', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'ok' } }],
          model: 'gpt-4o-mini',
        }),
      });

      await callOpenAI([{ role: 'user', content: 'hi' }]);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.response_format).toBeUndefined();
    });
  });

  describe('callLLM - Model Routing', () => {
    it('should route claude-* models to Anthropic', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: 'Claude response' }],
          model: 'claude-3-opus-20240229',
        }),
      });

      const messages: LLMMessage[] = [{ role: 'user', content: 'Hello' }];
      const result = await callLLM(messages, { model: 'claude-3-opus-20240229' });

      expect(result.content).toBe('Claude response');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.any(Object)
      );
    });

    it('should route gpt-* models to OpenAI', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'GPT response' } }],
          model: 'gpt-4o',
        }),
      });

      const messages: LLMMessage[] = [{ role: 'user', content: 'Hello' }];
      const result = await callLLM(messages, { model: 'gpt-4o' });

      expect(result.content).toBe('GPT response');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.any(Object)
      );
    });

    it('should route o3-* models to OpenAI', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'O3 response' } }],
          model: 'o3-mini',
        }),
      });

      const messages: LLMMessage[] = [{ role: 'user', content: 'Hello' }];
      await callLLM(messages, { model: 'o3-mini' });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.any(Object)
      );
    });

    it('should route claude-opus-4-6 to Anthropic', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: 'Opus response' }],
          model: 'claude-opus-4-6',
        }),
      });

      const messages: LLMMessage[] = [{ role: 'user', content: 'Analyze this contract' }];
      const result = await callLLM(messages, { model: 'claude-opus-4-6' });

      expect(result.content).toBe('Opus response');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.any(Object)
      );
    });

    it('should default to gpt-4o-mini when no model specified', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Default response' } }],
          model: 'gpt-4o-mini',
        }),
      });

      const messages: LLMMessage[] = [{ role: 'user', content: 'Hello' }];
      await callLLM(messages);

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.model).toBe('gpt-4o-mini');
    });
  });

  describe('streamLLM', () => {
    it('should return readable stream for OpenAI', async () => {
      const mockStream = new ReadableStream();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      const messages: LLMMessage[] = [{ role: 'user', content: 'Hello' }];
      const result = await streamLLM(messages, { model: 'gpt-4o' });

      expect(result).toBe(mockStream);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.any(Object)
      );
      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.stream).toBe(true);
    });

    it('should return readable stream for Anthropic', async () => {
      const mockStream = new ReadableStream();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      const messages: LLMMessage[] = [{ role: 'user', content: 'Hello' }];
      const result = await streamLLM(messages, { model: 'claude-3-opus-20240229' });

      expect(result).toBe(mockStream);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.any(Object)
      );
      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.stream).toBe(true);
    });

    it('should return readable stream for Claude Opus 4.6', async () => {
      const mockStream = new ReadableStream();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      const messages: LLMMessage[] = [{ role: 'user', content: 'Analyze this budget' }];
      const result = await streamLLM(messages, { model: 'claude-opus-4-6' });

      expect(result).toBe(mockStream);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.any(Object)
      );
      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.stream).toBe(true);
      expect(callBody.model).toBe('claude-opus-4-6');
    });
  });
});
