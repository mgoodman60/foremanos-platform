import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getQuickFollowUps as generateQuickFollowUps } from '@/lib/follow-up-generator';
import { validateBeforeResponse, EnhancedChunk } from '@/lib/rag-enhancements';
import { cacheResponse, analyzeQueryComplexity } from '@/lib/query-cache';
import { logger } from '@/lib/logger';
import type { StreamResponseOptions, LLMResponse, ConversationResult, BuiltContext } from '@/types/chat';

/**
 * Stream LLM response to client with metadata injection
 * Extracted from app/api/chat/route.ts lines 1250-1407
 */
export function streamResponse(options: StreamResponseOptions): Response {
  const { llmResponse, conversation, context, message, userId, userRole } = options;

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = llmResponse.stream.getReader();
      let fullResponse = '';
      let partialRead = '';

      // Send conversation ID as first event
      if (conversation.id) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ conversationId: conversation.id })}\n\n`));
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          partialRead += decoder.decode(value, { stream: true });
          let lines = partialRead.split('\n');
          partialRead = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                // Validate response before saving
                const validation = validateBeforeResponse(message || '', context.chunks, fullResponse);

                if (!validation.passed) {
                  logger.warn('RESPONSE_STREAMER', 'Response validation failed', { issues: validation.issues });
                }

                if (validation.warnings.length > 0) {
                  logger.warn('RESPONSE_STREAMER', 'Response warnings', { warnings: validation.warnings });
                }

                if (validation.passed || validation.warnings.length === 0) {
                  logger.info('RESPONSE_STREAMER', 'Response passed validation checks');
                }

                // Save complete chat message to database
                try {
                  const usedDocIds = [
                    ...new Set(context.chunks.filter((c) => c.documentId).map((c) => c.documentId as string)),
                  ];

                  await prisma.chatMessage.create({
                    data: {
                      conversationId: conversation.id || null,
                      userId: userId || null,
                      userRole,
                      message: message || '[Image uploaded]',
                      response: fullResponse,
                      documentsUsed: usedDocIds,
                      hasImage: options.llmResponse.model === 'gpt-5.2', // Images use GPT-5.2
                    },
                  });

                  // Update conversation timestamp
                  if (conversation.id) {
                    await prisma.conversation.update({
                      where: { id: conversation.id },
                      data: {
                        updatedAt: new Date(),
                        lastActivityAt: new Date(),
                      },
                    });
                  }

                  // Cache the response (only text, not images)
                  if (message && fullResponse && !options.llmResponse.cached) {
                    const documentIds = context.chunks.filter((c) => c.documentId).map((c) => c.documentId as string);
                    const complexityAnalysis = analyzeQueryComplexity(message);
                    await cacheResponse(
                      message,
                      fullResponse,
                      '', // projectSlug would need to be passed
                      documentIds,
                      complexityAnalysis.complexity,
                      llmResponse.model
                    );
                    logger.info('RESPONSE_STREAMER', 'Cached query response', { complexity: complexityAnalysis.complexity, model: llmResponse.model });
                  }

                  // Send citations and follow-up suggestions
                  try {
                    const citations = context.chunks.slice(0, 5).map((chunk: EnhancedChunk) => ({
                      id: chunk.id,
                      documentName: chunk.documentName || 'Unknown Document',
                      documentId: chunk.documentId,
                      pageNumber: chunk.pageNumber,
                      sheetNumber: chunk.sheetNumber,
                      excerpt: chunk.content?.slice(0, 100),
                    }));

                    const followUpSuggestions = generateQuickFollowUps(message || '');

                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          metadata: {
                            citations,
                            followUpSuggestions,
                            documentsUsed: usedDocIds.length,
                          },
                        })}\n\n`
                      )
                    );
                  } catch (metaError) {
                    logger.error('RESPONSE_STREAMER', 'Error sending metadata', metaError as Error);
                  }
                } catch (dbError) {
                  logger.error('RESPONSE_STREAMER', 'Error saving chat message', dbError as Error);
                }

                controller.close();
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || '';
                if (content) {
                  fullResponse += content;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      } catch (error) {
        logger.error('CHAT_API', 'Stream processing error', error as Error, {
          userId,
          conversationId: conversation.id,
          hasMessage: !!message,
          responseLength: fullResponse.length,
        });
        controller.error(error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

/**
 * Create error response for chat API
 */
export function createErrorResponse(error: unknown): NextResponse {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  const errorWithStatus = error as Error & { status?: number };
  const statusCode = errorWithStatus.status || 500;

  // Extract detailed error message from API errors
  let userFriendlyMessage = 'Failed to process chat request';
  let technicalDetails = errorObj.message;

  // Parse API errors for better user feedback
  if (errorObj.message.includes('OPENAI_API_KEY') || errorObj.message.includes('ANTHROPIC_API_KEY')) {
    userFriendlyMessage = 'AI service configuration error. Please contact support.';
    technicalDetails = 'API key not configured';
  } else if (errorObj.message.includes('API request failed')) {
    // Extract status code and error details from API error message
    const match = errorObj.message.match(/failed \((\d+)\): (.+)/);
    if (match) {
      const [, apiStatus, apiError] = match;
      userFriendlyMessage = `AI service error (${apiStatus})`;
      technicalDetails = apiError;

      // Provide specific messages for common API errors
      if (apiStatus === '401') {
        userFriendlyMessage = 'AI service authentication failed. Please contact support.';
      } else if (apiStatus === '429') {
        userFriendlyMessage = 'AI service rate limit exceeded. Please try again in a moment.';
      } else if (apiStatus === '500' || apiStatus === '503') {
        userFriendlyMessage = 'AI service is temporarily unavailable. Please try again later.';
      }
    }
  } else if (errorObj.message.includes('timeout') || errorObj.message.includes('ECONNREFUSED')) {
    userFriendlyMessage = 'Connection to AI service timed out. Please try again.';
  } else if (errorObj.message.includes('network') || errorObj.message.includes('fetch')) {
    userFriendlyMessage = 'Network error connecting to AI service. Please check your connection.';
  } else if (errorObj.message) {
    // Use the original error message if it's user-friendly
    userFriendlyMessage = errorObj.message;
  }

  // Log with structured logger
  logger.error('CHAT_API', 'Chat request failed', errorObj, {
    statusCode,
    userFriendlyMessage,
    technicalDetails,
    errorType: errorObj.constructor.name,
  });

  return NextResponse.json(
    {
      error: userFriendlyMessage,
      details: technicalDetails,
    },
    { status: statusCode }
  );
}

/**
 * Create cached response for cache hits (non-streaming)
 */
export function createCachedResponse(
  cachedResult: string,
  conversationId: string | null
): NextResponse {
  return NextResponse.json({
    response: cachedResult,
    cached: true,
    conversationId,
  });
}
