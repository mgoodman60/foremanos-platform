import { getCachedResponse, cacheResponse, analyzeQueryComplexity } from '@/lib/query-cache';
import { prisma } from '@/lib/db';
import { streamLLM, type LLMMessage } from '@/lib/llm-providers';
import { logger } from '@/lib/logger';
import { VISION_MODEL } from '@/lib/model-config';

import type { LLMHandlerOptions, LLMResponse } from '@/types/chat';

/**
 * Message content types for LLM API
 * Updated Jan 2026: Now uses direct OpenAI/Anthropic APIs via llm-providers.ts
 */
type TextContent = { type: 'text'; text: string };
type ImageContent = { type: 'image_url'; image_url: { url: string } };
type MessageContent = string | Array<TextContent | ImageContent>;
type ChatMessage = { role: 'user' | 'system'; content: MessageContent };

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
    logger.info('LLM_HANDLER', 'Cache hit - returning cached response');
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
  await cacheResponse(message, response, projectSlug, documentIds, complexity as "medium" | "simple" | "complex", model);
  logger.info('LLM_HANDLER', 'Cached query response', { complexity, model });
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
    : { complexity: 'complex' as "medium" | "simple" | "complex", reason: `Image analysis requires ${VISION_MODEL} vision`, model: VISION_MODEL };

  // Images always use vision model (Claude Opus 4.6)
  const selectedModel = image ? VISION_MODEL : complexityAnalysis.model;

  // Complexity-based routing only — no tier downgrades
  const effectiveModel = selectedModel;

  logger.info('LLM_HANDLER', 'Model selected', { model: effectiveModel, reason: complexityAnalysis.reason });

  // Determine if web search should be enabled
  const _useWebSearch = !!image || (context.webSearchResults && context.webSearchResults.length > 0);

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

  // Build messages array for LLM
  const messages: LLMMessage[] = [
    { role: 'system', content: context.contextPrompt },
    userMessage as LLMMessage,
  ];

  // Call LLM API via provider abstraction (routes to OpenAI or Anthropic)
  // Note: Abacus AI removed (Jan 2026) - using direct APIs now
  try {
    const stream = await streamLLM(messages, {
      model: effectiveModel,
      max_tokens: 2000,
      temperature: 0.3,
    });

    // Return the response body as a readable stream
    return {
      stream,
      model: effectiveModel,
      cached: false,
    };
  } catch (error: unknown) {
    const err = error as Error & { status?: number };

    // Log detailed error information
    logger.error('CHAT_API', 'LLM API call failed', err, {
      model: effectiveModel,
      hasImage: !!image,
      messageLength: message?.length || 0,
      contextChunks: context.chunks.length,
      projectSlug,
      userRole,
      errorMessage: err.message,
      statusCode: err.status,
    });

    // Re-throw to propagate to error handler
    throw err;
  }
}

/**
 * Create a cached response object (for cache hits)
 */
export function createCachedLLMResponse(
  cachedResponse: string,
  conversationId: string | null,
  _userId: string | null,
  _userRole: string,
  _message: string,
  _documentIds: string[]
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
