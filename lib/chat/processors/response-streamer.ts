import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getQuickFollowUps as generateQuickFollowUps } from '@/lib/follow-up-generator';
import { validateBeforeResponse, EnhancedChunk } from '@/lib/rag-enhancements';
import { cacheResponse, analyzeQueryComplexity } from '@/lib/query-cache';
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
                  console.warn(`⚠️ [VALIDATION] Response validation failed:`);
                  validation.issues.forEach((issue) => console.warn(`   ❌ ${issue}`));
                }

                if (validation.warnings.length > 0) {
                  console.warn(`⚠️ [VALIDATION] Response warnings:`);
                  validation.warnings.forEach((warning) => console.warn(`   ⚠️ ${warning}`));
                }

                if (validation.passed || validation.warnings.length === 0) {
                  console.log(`✅ [VALIDATION] Response passed validation checks`);
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
                    console.log(`💾 [CACHE SAVE] Cached ${complexityAnalysis.complexity} query response (${llmResponse.model})`);
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
                    console.error('Error sending metadata:', metaError);
                  }
                } catch (dbError) {
                  console.error('Error saving chat message:', dbError);
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
        console.error('Stream error:', error);
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
  console.error('Chat API error:', error);
  console.error('Error details:', error instanceof Error ? error.message : String(error));
  console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

  const errorWithStatus = error as Error & { status?: number };
  const statusCode = errorWithStatus.status || 500;

  return NextResponse.json(
    {
      error: 'Failed to process chat request',
      details: error instanceof Error ? error.message : String(error),
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
