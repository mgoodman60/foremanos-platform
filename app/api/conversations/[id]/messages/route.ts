import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { createLogger } from '@/lib/logger';
const logger = createLogger('CONVERSATIONS_MESSAGES');

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = await checkRateLimit(`api:${session.user?.id || 'anonymous'}`, RATE_LIMITS.API);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter || 60) } }
      );
    }

    const { id } = params;

    // Get conversation and verify ownership
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        ChatMessage: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        Project: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Verify user owns this conversation
    if (conversation.userId !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        projectName: conversation.Project?.name,
        projectSlug: conversation.Project?.slug,
        conversationType: conversation.conversationType,
        isSystemManaged: conversation.isSystemManaged,
        isPinned: conversation.isPinned,
        dailyReportDate: conversation.dailyReportDate,
        isReadOnly: conversation.isReadOnly,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
      messages: conversation.ChatMessage.map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        message: msg.message,
        response: msg.response,
        hasImage: msg.hasImage,
        createdAt: msg.createdAt,
      })),
    });
  } catch (error) {
    logger.error('Error fetching conversation messages', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
