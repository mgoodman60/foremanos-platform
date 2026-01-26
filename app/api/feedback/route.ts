import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST /api/feedback - Submit feedback for a message
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
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
    console.error('Error submitting feedback:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}
