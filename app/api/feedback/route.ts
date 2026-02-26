import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const logger = createLogger('FEEDBACK');

export const dynamic = 'force-dynamic';

// POST /api/feedback - Submit feedback for a message
export async function POST(request: NextRequest) {
  try {
    const _session = await auth();
    const { messageId, rating, comment } = await request.json();

    if (!messageId || !rating) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate rating
    if (rating !== 1 && rating !== -1) {
      return NextResponse.json(
        { error: 'Rating must be 1 (thumbs up) or -1 (thumbs down)' },
        { status: 400 }
      );
    }

    // Check if message exists
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { MessageFeedback: true },
    });

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // Upsert feedback
    const feedback = await prisma.messageFeedback.upsert({
      where: { messageId },
      update: {
        rating,
        comment: comment || null,
      },
      create: {
        messageId,
        rating,
        comment: comment || null,
      },
    });

    return NextResponse.json({ feedback });
  } catch (error) {
    logger.error('Failed to submit feedback', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}
