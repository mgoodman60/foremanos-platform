/**
 * LLM Provider Abstraction
 *
 * Routes LLM calls to the correct provider based on model prefix:
 * - gpt-* / o3-* / o4-* → OpenAI
 * - claude-* → Anthropic
 *
 * Replaces Abacus AI middleware for direct API access (Jan 2026)
 */

import { logger } from '@/lib/logger';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  reasoning_effort?: 'light' | 'medium' | 'high' | 'xhigh';
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Call OpenAI API directly
 */
export async function callOpenAI(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const {
    model = 'gpt-4o-mini',
    temperature = 0.3,
    max_tokens = 4000,
    stream = false,
  } = options;

  const requestBody: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens,
    stream,
  };

  // Add reasoning_effort for o3/o4 models
  if (options.reasoning_effort && (model.startsWith('o3') || model.startsWith('o4'))) {
    requestBody.reasoning_effort = options.reasoning_effort;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'No error details available');
    throw new Error(`OpenAI API request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  return {
    content: data.choices?.[0]?.message?.content || '',
    model: data.model || model,
    usage: data.usage,
  };
}

/**
 * Call Anthropic Claude API directly
 */
export async function callAnthropic(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const {
    model = 'claude-sonnet-4-5-20251101',
    temperature = 0.3,
    max_tokens = 4000,
  } = options;

  // Convert messages format for Anthropic
  // Extract system message if present
  let systemMessage = '';
  const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string | Array<unknown> }> = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemMessage = typeof msg.content === 'string' ? msg.content : '';
    } else {
      anthropicMessages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }
  }

  const requestBody: Record<string, unknown> = {
    model,
    max_tokens,
    temperature,
    messages: anthropicMessages,
  };

  if (systemMessage) {
    requestBody.system = systemMessage;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'No error details available');
    throw new Error(`Anthropic API request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  return {
    content: data.content?.[0]?.text || '',
    model: data.model || model,
    usage: data.usage
      ? {
          prompt_tokens: data.usage.input_tokens || 0,
          completion_tokens: data.usage.output_tokens || 0,
          total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
        }
      : undefined,
  };
}

/**
 * Auto-route to correct provider based on model prefix
 */
export async function callLLM(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<LLMResponse> {
  const model = options.model || 'gpt-4o-mini';

  // Route based on model prefix
  if (model.startsWith('claude-')) {
    console.log(`[LLM] Routing to Anthropic: ${model}`);
    return callAnthropic(messages, options);
  }

  // Default to OpenAI (gpt-*, o3-*, o4-*, etc.)
  console.log(`[LLM] Routing to OpenAI: ${model}`);
  return callOpenAI(messages, options);
}

/**
 * Stream LLM response (OpenAI only for now)
 * Returns a ReadableStream for streaming responses
 */
export async function streamLLM(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  const model = options.model || 'gpt-4o-mini';

  // For Claude models, we need to use the Anthropic streaming endpoint
  if (model.startsWith('claude-')) {
    return streamAnthropic(messages, options);
  }

  return streamOpenAI(messages, options);
}

async function streamOpenAI(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const {
    model = 'gpt-4o-mini',
    temperature = 0.3,
    max_tokens = 4000,
  } = options;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'No error details available');
    const errorMessage = `OpenAI API request failed (${response.status}): ${errorText}`;

    logger.error('CHAT_API', 'OpenAI streaming API error', new Error(errorMessage), {
      statusCode: response.status,
      statusText: response.statusText,
      model,
      errorBody: errorText.substring(0, 500), // Log first 500 chars of error
    });

    throw new Error(errorMessage);
  }

  return response.body as ReadableStream<Uint8Array>;
}

async function streamAnthropic(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const {
    model = 'claude-sonnet-4-5-20251101',
    temperature = 0.3,
    max_tokens = 4000,
  } = options;

  // Convert messages format for Anthropic
  let systemMessage = '';
  const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string | Array<unknown> }> = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemMessage = typeof msg.content === 'string' ? msg.content : '';
    } else {
      anthropicMessages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }
  }

  const requestBody: Record<string, unknown> = {
    model,
    max_tokens,
    temperature,
    messages: anthropicMessages,
    stream: true,
  };

  if (systemMessage) {
    requestBody.system = systemMessage;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'No error details available');
    const errorMessage = `Anthropic API request failed (${response.status}): ${errorText}`;

    logger.error('CHAT_API', 'Anthropic streaming API error', new Error(errorMessage), {
      statusCode: response.status,
      statusText: response.statusText,
      model,
      errorBody: errorText.substring(0, 500), // Log first 500 chars of error
    });

    throw new Error(errorMessage);
  }

  return response.body as ReadableStream<Uint8Array>;
}
