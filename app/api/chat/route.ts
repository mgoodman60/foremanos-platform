import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { incrementQueryCount } from '@/lib/subscription';

// Middleware modules
import {
  checkMaintenance,
  maintenanceResponse,
  checkAuth,
  checkRateLimitMiddleware,
  rateLimitResponse,
  validateQuery,
  validationErrorResponse,
  checkQueryLimitMiddleware,
  queryLimitResponse,
} from '@/lib/chat/middleware';

// Processors
import {
  manageConversation,
  lockedReportResponse,
  buildContext,
  handleLLMRequest,
  checkCache,
  saveCachedChatMessage,
  streamResponse,
  createErrorResponse,
  createCachedResponse,
} from '@/lib/chat/processors';

// Utilities
import { checkRestrictedQuery } from '@/lib/chat/utils/restricted-query-check';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds timeout for long-running queries

/**
 * Chat API POST Handler
 *
 * 10-step modular pipeline:
 * 1. Maintenance check
 * 2. Auth check
 * 3. Rate limit check
 * 4. Query validation
 * 5. Query limit check (subscription)
 * 6. Conversation management
 * 7. Restricted query check
 * 8. Context building (RAG)
 * 9. Cache check
 * 10. LLM request & streaming
 */
export async function POST(request: NextRequest) {
  const auth = await checkAuth(request);
  try {
    // 1. Maintenance check
    const maintenance = await checkMaintenance();
    if (maintenance.isActive) {
      return maintenanceResponse();
    }

    // 2. Rate limit check
    const rateLimit = await checkRateLimitMiddleware(auth);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit);
    }

    // 3. Query validation
    const validation = await validateQuery(request);
    if (!validation.valid) {
      return validationErrorResponse(validation);
    }

    // 4. Query limit check (subscription limits)
    const queryLimit = await checkQueryLimitMiddleware(auth);
    if (!queryLimit.allowed) {
      return queryLimitResponse(queryLimit);
    }

    // 5. Conversation management
    let conversation;
    try {
      conversation = await manageConversation({
        userId: auth.userId,
        conversationId: validation.body?.conversationId || null,
        projectSlug: validation.body!.projectSlug,
        message: validation.body?.message || null,
        userRole: auth.userRole,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'REPORT_LOCKED') {
        return lockedReportResponse();
      }
      throw error;
    }

    // 6. Restricted query check
    const restricted = await checkRestrictedQuery(validation.body?.message || null, auth.userRole);
    if (restricted.isRestricted) {
      // Save denial message to database
      await prisma.chatMessage.create({
        data: {
          conversationId: conversation.id || null,
          userId: auth.userId || null,
          userRole: auth.userRole,
          message: validation.body?.message || '',
          response: restricted.denialMessage || '',
          documentsUsed: [],
        },
      });

      return NextResponse.json({ response: restricted.denialMessage });
    }

    // 7. Build context (RAG retrieval and enhancements)
    const context = await buildContext({
      message: validation.body?.message || null,
      image: validation.body?.image || null,
      projectSlug: validation.body!.projectSlug,
      userRole: auth.userRole,
    });

    // 8. Check cache (only for text queries)
    const cacheResult = await checkCache(
      validation.body?.message || null,
      validation.body?.image || null,
      validation.body!.projectSlug,
      context.chunks.filter((c) => c.documentId).map((c) => ({ documentId: c.documentId as string }))
    );

    if (cacheResult.hit && cacheResult.response) {
      // Save cached response to database
      await saveCachedChatMessage(
        conversation.id,
        auth.userId,
        auth.userRole,
        validation.body?.message || '',
        cacheResult.response,
        context.chunks.filter((c) => c.documentId).map((c) => c.documentId as string)
      );

      return createCachedResponse(cacheResult.response, conversation.id);
    }

    // 9. Handle LLM request
    const llmResponse = await handleLLMRequest({
      message: validation.body?.message || null,
      image: validation.body?.image || null,
      context,
      conversationId: conversation.id,
      projectSlug: validation.body!.projectSlug,
      userRole: auth.userRole,
    });

    // 10. Stream response
    return streamResponse({
      llmResponse,
      conversation,
      context,
      message: validation.body?.message || null,
      userId: auth.userId,
      userRole: auth.userRole,
    });
  } catch (error) {
    return createErrorResponse(error);
  } finally {
    // Increment query count for logged-in users
    if (auth.userId) {
      try {
        await incrementQueryCount(auth.userId);
      } catch (error) {
        console.error('Error incrementing query count:', error);
      }
    }
  }
}

