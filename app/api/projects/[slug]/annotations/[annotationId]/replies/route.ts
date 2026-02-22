/**
 * Annotation Replies API
 * GET: List all replies for an annotation
 * POST: Create a new reply
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_ANNOTATIONS_REPLIES');

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; annotationId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const replies = await prisma.annotationReply.findMany({
      where: { annotationId: params.annotationId },
      include: {
        User: {
          select: { id: true, email: true, username: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const formattedReplies = replies.map(r => ({
      id: r.id,
      content: r.content,
      createdBy: {
        id: r.User.id,
        email: r.User.email,
        username: r.User.username
      },
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }));

    return NextResponse.json({ replies: formattedReplies });
  } catch (error) {
    logger.error('[Annotation Replies GET Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch replies' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; annotationId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify annotation exists
    const annotation = await prisma.visualAnnotation.findUnique({
      where: { id: params.annotationId },
      select: { id: true, projectId: true }
    });

    if (!annotation) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Create the reply
    const reply = await prisma.annotationReply.create({
      data: {
        annotationId: params.annotationId,
        content: content.trim(),
        createdBy: session.user.id,
      },
      include: {
        User: {
          select: { id: true, email: true, username: true }
        }
      }
    });

    // Update the annotation's updatedAt timestamp
    await prisma.visualAnnotation.update({
      where: { id: params.annotationId },
      data: { updatedAt: new Date() }
    });

    return NextResponse.json({
      reply: {
        id: reply.id,
        content: reply.content,
        createdBy: {
          id: reply.User.id,
          email: reply.User.email,
          username: reply.User.username
        },
        createdAt: reply.createdAt.toISOString(),
        updatedAt: reply.updatedAt.toISOString()
      }
    }, { status: 201 });
  } catch (error) {
    logger.error('[Annotation Replies POST Error]', error);
    return NextResponse.json(
      { error: 'Failed to create reply' },
      { status: 500 }
    );
  }
}
