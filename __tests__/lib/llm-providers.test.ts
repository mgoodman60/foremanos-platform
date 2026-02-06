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
