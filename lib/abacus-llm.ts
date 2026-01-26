/**
 * Abacus LLM API Helper
 * 
 * Provides a simple interface for calling the Abacus LLM API
 * from server-side code.
 */

export interface LLMMessageContent {
  type: string;
  text?: string;
  image_url?: { url: string };
  // Claude document format for PDFs
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
  web_search?: boolean;
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
 * Call the Abacus LLM API with the given messages
 */
export async function callAbacusLLM(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<LLMResponse> {
  const apiKey = process.env.ABACUSAI_API_KEY;
  if (!apiKey) {
    throw new Error('ABACUSAI_API_KEY environment variable is not set');
  }

  const {
    model = 'gpt-4o',
    temperature = 0.3,
    max_tokens = 4000,
    web_search = false,
    response_format,
  } = options;

  const requestBody: any = {
    model,
    messages,
    temperature,
    max_tokens,
    web_search,
  };

  if (response_format) {
    requestBody.response_format = response_format;
  }

  const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'No error details available');
    throw new Error(`LLM API request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  
  return {
    content: data.choices?.[0]?.message?.content || '',
    model: data.model || model,
    usage: data.usage,
  };
}

/**
 * Call the Abacus LLM API with vision (image analysis)
 */
export async function callAbacusLLMWithVision(
  textPrompt: string,
  imageBase64: string,
  options: LLMOptions = {}
): Promise<LLMResponse> {
  const messages: LLMMessage[] = [
    {
      role: 'user',
      content: `${textPrompt}\n\n[Image: data:image/jpeg;base64,${imageBase64}]`,
    },
  ];

  return callAbacusLLM(messages, { ...options, model: options.model || 'gpt-4o' });
}
