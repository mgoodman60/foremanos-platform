import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('FEEDBACK_CORRECTIONS');

export const dynamic = 'force-dynamic';

// GET /api/feedback/corrections - List all admin corrections (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectSlug = searchParams.get('projectSlug');
    const onlyActive = searchParams.get('onlyActive') === 'true';

    const whereClause: any = {};
    
    if (onlyActive) {
      whereClause.isActive = true;
    }

    if (projectSlug) {
      const project = await prisma.project.findUnique({
        where: { slug: projectSlug },
        select: { id: true }
      });
      
      if (project) {
        whereClause.OR = [
          { projectId: project.id },
          { projectId: null }
        ];
      }
    }

    const corrections = await prisma.adminCorrection.findMany({
      where: whereClause,
      include: {
        User: {
          select: {
            id: true,
            username: true,
            email: true
          }
        },
        Project: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        MessageFeedback: {
          include: {
            ChatMessage: {
              select: {
                id: true,
                message: true,
                response: true,
                createdAt: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ corrections });
  } catch (error) {
    logger.error('Error fetching corrections', error);
    return NextResponse.json(
      { error: 'Failed to fetch corrections' },
      { status: 500 }
    );
  }
}

// POST /api/feedback/corrections - Create a new admin correction (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      feedbackId, 
      correctedAnswer, 
      adminNotes, 
      keywords,
      projectSlug 
    } = await request.json();

    if (!feedbackId || !correctedAnswer || !keywords || keywords.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get the feedback and related message
    const feedback = await prisma.messageFeedback.findUnique({
      where: { id: feedbackId },
      include: {
        ChatMessage: {
          include: {
            Conversation: {
              include: {
                Project: true
              }
            }
          }
        }
      }
    });

    if (!feedback) {
      return NextResponse.json(
        { error: 'Feedback not found' },
        { status: 404 }
      );
    }

    // Get project ID
    let projectId = null;
    if (projectSlug) {
      const project = await prisma.project.findUnique({
        where: { slug: projectSlug },
        select: { id: true }
      });
      projectId = project?.id || null;
    } else if (feedback.ChatMessage?.Conversation?.Project) {
      projectId = feedback.ChatMessage.Conversation.Project.id;
    }

    // Create the correction
    const correction = await prisma.adminCorrection.create({
      data: {
        feedbackId,
        projectId,
        originalQuestion: feedback.ChatMessage?.message || '',
        originalAnswer: feedback.ChatMessage?.response || '',
        correctedAnswer,
        adminNotes,
        keywords,
        createdBy: session.user.id
      },
      include: {
        User: {
          select: {
            username: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json({ correction }, { status: 201 });
  } catch (error: any) {
    logger.error('Error creating correction', error);
    
    // Handle unique constraint violation (correction already exists for this feedback)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Correction already exists for this feedback' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create correction' },
      { status: 500 }
    );
  }
}
