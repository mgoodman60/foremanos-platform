/**
 * OpenAI LLM API Helper
 *
 * Provides a simple interface for calling OpenAI's API directly.
 * Updated Feb 2026: Switched from Abacus AI proxy to direct OpenAI.
 */

import { EXTRACTION_MODEL } from '@/lib/model-config';

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
 * Call OpenAI's API with the given messages
 * @deprecated Use callOpenAILLM instead - this alias kept for backwards compatibility
 */
export async function callAbacusLLM(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<LLMResponse> {
  return callOpenAILLM(messages, options);
}

/**
 * Convert messages with document content to OpenAI-compatible format
 */
function convertMessagesForOpenAI(messages: LLMMessage[]): LLMMessage[] {
  return messages.map(msg => {
    if (typeof msg.content === 'string') {
      return msg;
    }

    // Convert array content to OpenAI format
    const convertedContent: LLMMessageContent[] = msg.content.map(item => {
      // Handle document type (Claude format) - convert to base64 data URL
      if (item.type === 'document' && item.source) {
        const mediaType = item.source.media_type || 'application/pdf';
        const base64Data = item.source.data;
        // OpenAI can process PDFs as images with vision models
        return {
          type: 'image_url',
          image_url: { url: `data:${mediaType};base64,${base64Data}` }
        };
      }
      // Pass through other types unchanged
      return item;
    });

    return { ...msg, content: convertedContent };
  });
}

/**
 * Call OpenAI's API with the given messages
 */
export async function callOpenAILLM(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const {
    model = EXTRACTION_MODEL,
    temperature = 0.3,
    max_tokens = 4000,
    response_format,
  } = options;

  // Convert document content to OpenAI-compatible format
  const convertedMessages = convertMessagesForOpenAI(messages);

  const requestBody: {
    model: string;
    messages: LLMMessage[];
    temperature: number;
    max_tokens: number;
    response_format?: { type: string };
  } = {
    model,
    messages: convertedMessages,
    temperature,
    max_tokens,
  };

  if (response_format) {
    requestBody.response_format = response_format;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
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
 * Call OpenAI's API with vision (image analysis)
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
 * Call OpenAI's API with vision (image analysis)
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
