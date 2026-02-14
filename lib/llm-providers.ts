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
import { SIMPLE_MODEL, DEFAULT_MODEL } from '@/lib/model-config';

export interface LLMMessageContent {
  type: string;
  text?: string;
  image_url?: { url: string };
  file?: { filename: string; file_data: string };
  source?: { type: string; media_type: string; data: string };
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<LLMMessageContent>;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  reasoning_effort?: 'light' | 'medium' | 'high' | 'xhigh';
  response_format?: { type: string };
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
    model = SIMPLE_MODEL,
    temperature = 0.3,
    max_tokens = 4000,
    stream = false,
  } = options;

  const tokenKey = model.startsWith('gpt-5') || model.startsWith('o3') || model.startsWith('o4')
    ? 'max_completion_tokens'
    : 'max_tokens';

  const requestBody: Record<string, unknown> = {
    model,
    messages,
    temperature,
    [tokenKey]: max_tokens,
    stream,
  };

  // Add reasoning_effort for o3/o4 models
  if (options.reasoning_effort && (model.startsWith('o3') || model.startsWith('o4'))) {
    requestBody.reasoning_effort = options.reasoning_effort;
  }

  if (options.response_format) {
    requestBody.response_format = options.response_format;
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
 * Convert a content block from OpenAI/generic format to Claude-native format
 */
function convertContentBlockForClaude(item: LLMMessageContent): unknown {
  // image_url with data URL → Claude image or document format
  if (item.type === 'image_url' && item.image_url?.url) {
    const url = item.image_url.url;
    const dataUrlMatch = url.match(/^data:([^;]+);base64,(.+)$/);
    if (dataUrlMatch) {
      const mediaType = dataUrlMatch[1];
      const data = dataUrlMatch[2];
      // PDF data URLs → Claude document format
      if (mediaType === 'application/pdf') {
        return {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data },
        };
      }
      return {
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data },
      };
    }
    // Raw base64 (no data: prefix) → default to image/jpeg
    return {
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: url },
    };
  }

  // file blocks → Claude document format
  if (item.type === 'file' && item.file) {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: item.file.file_data },
    };
  }

  // document/source blocks → pass through natively (Claude supports these)
  if ((item.type === 'document' || item.type === 'image') && item.source) {
    return item;
  }

  // text blocks → pass through as-is
  if (item.type === 'text') {
    return { type: 'text', text: item.text || '' };
  }

  // Unknown types → pass through
  return item;
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
    model = DEFAULT_MODEL,
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
      // Convert content blocks to Claude-native format
      let convertedContent: string | Array<unknown>;
      if (Array.isArray(msg.content)) {
        convertedContent = msg.content.map(convertContentBlockForClaude);
      } else {
        convertedContent = msg.content;
      }

      anthropicMessages.push({
        role: msg.role as 'user' | 'assistant',
        content: convertedContent,
      });
    }
  }

  // Handle response_format: json_object by adding JSON instruction to system prompt
  if (options.response_format?.type === 'json_object') {
    const jsonInstruction = 'You must respond with valid JSON only. No markdown, no explanation, no code fences.';
    if (systemMessage) {
      systemMessage = `${systemMessage}\n\n${jsonInstruction}`;
    } else {
      systemMessage = jsonInstruction;
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
  const model = options.model || SIMPLE_MODEL;

  // Route based on model prefix
  if (model.startsWith('claude-')) {
    logger.info('LLM', `Routing to Anthropic: ${model}`);
    return callAnthropic(messages, options);
  }

  // Default to OpenAI (gpt-*, o3-*, o4-*, etc.)
  logger.info('LLM', `Routing to OpenAI: ${model}`);
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
  const model = options.model || SIMPLE_MODEL;

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
    model = SIMPLE_MODEL,
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
      ...(model.startsWith('gpt-5') || model.startsWith('o3') || model.startsWith('o4')
        ? { max_completion_tokens: max_tokens }
        : { max_tokens }),
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
    model = DEFAULT_MODEL,
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
