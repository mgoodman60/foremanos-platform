import { getCachedResponse, cacheResponse, analyzeQueryComplexity } from '@/lib/query-cache';
import { prisma } from '@/lib/db';
import type { LLMHandlerOptions, LLMResponse, BuiltContext } from '@/types/chat';

/**
 * Message content types for LLM API
 */
type TextContent = { type: 'text'; text: string };
type ImageContent = { type: 'image_url'; image_url: { url: string } };
type MessageContent = string | Array<TextContent | ImageContent>;
type ChatMessage = { role: 'user' | 'system'; content: MessageContent };

interface LLMRequestBody {
  model: string;
  messages: ChatMessage[];
  stream: boolean;
  max_tokens: number;
  web_search: boolean;
  reasoning_effort?: string;
}

interface CacheCheckResult {
  hit: boolean;
  response?: string;
}

/**
 * Check cache for existing response
 * Extracted from app/api/chat/route.ts lines 452-493
 */
export async function checkCache(
  message: string | null,
  image: string | null,
  projectSlug: string,
  chunks: { documentId: string }[]
): Promise<CacheCheckResult> {
  // Only check cache for text queries, not images
  if (image || !message) {
    return { hit: false };
  }

  const documentIds = chunks.map((c) => c.documentId);
  const cachedResult = await getCachedResponse(message, projectSlug, documentIds);

  if (cachedResult) {
    console.log(`💰 [COST SAVE] Cache hit - returning cached response`);
    return { hit: true, response: cachedResult };
  }

  return { hit: false };
}

/**
 * Save cached response for future queries
 */
export async function saveCachedResponse(
  message: string,
  response: string,
  projectSlug: string,
  documentIds: string[],
  complexity: string,
  model: string
): Promise<void> {
  await cacheResponse(message, response, projectSlug, documentIds, complexity, model);
  console.log(`💾 [CACHE SAVE] Cached ${complexity} query response (${model})`);
}

/**
 * Handle LLM request - model selection, API call, streaming
 * Extracted from app/api/chat/route.ts lines 495-1250
 */
export async function handleLLMRequest(options: LLMHandlerOptions): Promise<LLMResponse> {
  const { message, image, context, projectSlug, userRole } = options;

  // Analyze query complexity and select appropriate model
  const complexityAnalysis = message
    ? analyzeQueryComplexity(message)
    : { complexity: 'complex' as const, reason: 'Image analysis requires GPT-5.2 vision', model: 'gpt-5.2' };

  // Images always use GPT-5.2 (vision required)
  const selectedModel = image ? 'gpt-5.2' : complexityAnalysis.model;

  console.log(`🤖 [MODEL SELECTION] Using ${selectedModel} - ${complexityAnalysis.reason}`);

  // Determine if web search should be enabled
  const useWebSearch = !!image || (context.webSearchResults && context.webSearchResults.length > 0);

  // Build user message with optional image
  let userMessage: ChatMessage;
  if (image) {
    userMessage = {
      role: 'user',
      content: [
        ...(message
          ? [{ type: 'text' as const, text: message }]
          : [{ type: 'text' as const, text: 'Please analyze this image from the project.' }]),
        {
          type: 'image_url' as const,
          image_url: {
            url: image,
          },
        },
      ],
    };
  } else {
    userMessage = { role: 'user', content: message || '' };
  }

  // Build API request body
  const requestBody: LLMRequestBody = {
    model: selectedModel,
    messages: [
      { role: 'system', content: context.contextPrompt },
      userMessage,
    ],
    stream: true,
    max_tokens: 2000,
    web_search: useWebSearch,
  };

  // Add reasoning_effort for GPT-5.2 models
  if (selectedModel.includes('gpt-5.2') && complexityAnalysis.reasoning_effort) {
    requestBody.reasoning_effort = complexityAnalysis.reasoning_effort;
    console.log(`⚡ [REASONING] Using ${complexityAnalysis.reasoning_effort} reasoning for GPT-5.2`);
  }

  // Call LLM API
  const apiKey = process.env.ABACUSAI_API_KEY;
  if (!apiKey) {
    throw new Error('LLM API key not configured');
  }

  const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'No error details available');
    console.error('LLM API error status:', response.status);
    console.error('LLM API error response:', errorText);

    const error = new Error(`LLM API request failed: ${errorText}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  // Return the response body as a readable stream
  return {
    stream: response.body as ReadableStream,
    model: selectedModel,
    cached: false,
  };
}

/**
 * Create a cached response object (for cache hits)
 */
export function createCachedLLMResponse(
  cachedResponse: string,
  conversationId: string | null,
  userId: string | null,
  userRole: string,
  message: string,
  documentIds: string[]
): LLMResponse {
  // For cached responses, we create a simple stream that returns the cached content
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send conversation ID first if available
      if (conversationId) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ conversationId })}\n\n`));
      }

      // Send the cached content
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: cachedResponse })}\n\n`));

      // Signal completion
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return {
    stream,
    model: 'cached',
    cached: true,
  };
}

/**
 * Save chat message to database after cache hit
 */
export async function saveCachedChatMessage(
  conversationId: string | null,
  userId: string | null,
  userRole: string,
  message: string,
  cachedResponse: string,
  documentIds: string[]
): Promise<void> {
  await prisma.chatMessage.create({
    data: {
      conversationId: conversationId || null,
      userId: userId || null,
      userRole,
      message,
      response: cachedResponse,
      documentsUsed: documentIds,
      hasImage: false,
    },
  });

  // Update conversation timestamp if exists
  if (conversationId) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
        lastActivityAt: new Date(),
      },
    });
  }
}
