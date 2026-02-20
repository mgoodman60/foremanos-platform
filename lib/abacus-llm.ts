/**
 * LLM API Helper
 *
 * Provides a simple interface for calling LLM APIs.
 * Routes to the correct provider (Anthropic/OpenAI) via llm-providers.ts.
 * Updated Feb 2026: Delegates to callLLM for automatic provider routing.
 */

import { EXTRACTION_MODEL } from '@/lib/model-config';
import { callLLM } from '@/lib/llm-providers';

export interface LLMMessageContent {
  type: string;
  text?: string;
  image_url?: { url: string };
  // File content for PDFs
  file?: {
    filename: string;
    file_data: string;
  };
  // Document content (Claude-compatible format, converted for OpenAI)
  source?: {
    type: string;
    media_type: string;
    data: string;
  };
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<LLMMessageContent>;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
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
 * Call LLM API with the given messages
 * @deprecated Use callOpenAILLM instead - this alias kept for backwards compatibility
 */
export async function callAbacusLLM(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<LLMResponse> {
  return callOpenAILLM(messages, options);
}

/**
 * Call LLM API with the given messages.
 * Routes to the correct provider based on model prefix via callLLM.
 */
export async function callOpenAILLM(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<LLMResponse> {
  const {
    model = EXTRACTION_MODEL,
    temperature = 0.3,
    max_tokens = 4000,
    response_format,
  } = options;

  const result = await callLLM(messages as any, {
    model,
    temperature,
    max_tokens,
    response_format,
  });

  return result;
}

/**
 * Call LLM API with vision (image analysis)
 * @deprecated Use callOpenAILLMWithVision instead - this alias kept for backwards compatibility
 */
export async function callAbacusLLMWithVision(
  textPrompt: string,
  imageBase64: string,
  options: LLMOptions = {}
): Promise<LLMResponse> {
  return callOpenAILLMWithVision(textPrompt, imageBase64, options);
}

/**
 * Call LLM API with vision (image analysis)
 */
export async function callOpenAILLMWithVision(
  textPrompt: string,
  imageBase64: string,
  options: LLMOptions = {}
): Promise<LLMResponse> {
  const messages: LLMMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: textPrompt },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
      ],
    },
  ];

  return callOpenAILLM(messages, { ...options, model: options.model || EXTRACTION_MODEL });
}
