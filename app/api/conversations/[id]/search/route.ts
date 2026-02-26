import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit, getRateLimitIdentifier, getClientIp, createRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limiter';
import { createLogger } from '@/lib/logger';
const logger = createLogger('CONVERSATIONS_SEARCH');

export const dynamic = 'force-dynamic';

/**
 * GET /api/conversations/[id]/search?q=query
 * Search messages within a specific conversation
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const ip = getClientIp(request);
    const rateLimitId = getRateLimitIdentifier(session.user.id, ip);
    const rateLimit = await checkRateLimit(rateLimitId, RATE_LIMITS.API);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: createRateLimitHeaders(rateLimit)
        }
      );
    }

    const { id: conversationId } = params;
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query is required' },
        {
          status: 400,
          headers: createRateLimitHeaders(rateLimit)
        }
      );
    }

    // Verify conversation exists and user has access
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { userId: true, projectId: true },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        {
          status: 404,
          headers: createRateLimitHeaders(rateLimit)
        }
      );
    }

    // Verify user owns this conversation
    if (conversation.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        {
          status: 403,
          headers: createRateLimitHeaders(rateLimit)
        }
      );
    }

    // Search for messages (case-insensitive)
    // Search in both 'message' (user) and 'response' (assistant) fields
    const messages = await prisma.chatMessage.findMany({
      where: {
        conversationId,
        OR: [
          {
            message: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            response: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
      },
      select: {
        id: true,
        message: true,
        response: true,
        createdAt: true,
        hasImage: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Limit to 50 most recent matches
    });

    // Format results with highlights
    const results = messages.flatMap((msg) => {
      const matches: { id: string; messageId: string; role: string; content: string; createdAt: Date; hasImage: boolean }[] = [];

      // Check user message
      if (msg.message && msg.message.toLowerCase().includes(query.toLowerCase())) {
        matches.push({
          id: `${msg.id}-user`,
          messageId: msg.id,
          role: 'user',
          content: msg.message,
          createdAt: msg.createdAt,
          hasImage: msg.hasImage,
        });
      }

      // Check assistant response
      if (msg.response && msg.response.toLowerCase().includes(query.toLowerCase())) {
        matches.push({
          id: `${msg.id}-assistant`,
          messageId: msg.id,
          role: 'assistant',
          content: msg.response,
          createdAt: msg.createdAt,
          hasImage: false,
        });
      }

      return matches;
    });

    return NextResponse.json(
      {
        query,
        totalMatches: results.length,
        results,
      },
      {
        headers: createRateLimitHeaders(rateLimit),
      }
    );
  } catch (error) {
    logger.error('Error searching conversation', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
