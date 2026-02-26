import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('FEEDBACK_REVIEW');

export const dynamic = 'force-dynamic';

// GET /api/feedback/review - Get feedback needing admin review (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectSlug = searchParams.get('projectSlug');
    const onlyNegative = searchParams.get('onlyNegative') === 'true';
    const needsCorrection = searchParams.get('needsCorrection') === 'true';

    const whereClause: any = {};
    
    // Filter for negative feedback
    if (onlyNegative) {
      whereClause.rating = -1;
    }

    // Filter for feedback without corrections
    if (needsCorrection) {
      whereClause.AdminCorrection = null;
    }

    const feedback = await prisma.messageFeedback.findMany({
      where: whereClause,
      include: {
        ChatMessage: {
          select: {
            id: true,
            message: true,
            response: true,
            createdAt: true,
            Conversation: {
              select: {
                id: true,
                title: true,
                Project: {
                  select: {
                    id: true,
                    name: true,
                    slug: true
                  }
                }
              }
            },
            User: {
              select: {
                id: true,
                username: true,
                email: true,
                role: true
              }
            }
          }
        },
        AdminCorrection: {
          select: {
            id: true,
            correctedAnswer: true,
            isActive: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Filter by project if specified
    let filteredFeedback = feedback;
    if (projectSlug) {
      filteredFeedback = feedback.filter(
        (f: any) => f.ChatMessage?.Conversation?.Project?.slug === projectSlug
      );
    }

    return NextResponse.json({ feedback: filteredFeedback });
  } catch (error) {
    logger.error('Error fetching feedback for review', error);
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    );
  }
}
