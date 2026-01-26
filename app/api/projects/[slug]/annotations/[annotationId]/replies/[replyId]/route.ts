/**
 * Single Annotation Reply API
 * PATCH: Update a reply
 * DELETE: Delete a reply
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string; annotationId: string; replyId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the reply and check ownership
    const existing = await prisma.annotationReply.findUnique({
      where: { id: params.replyId },
      select: { createdBy: true }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Reply not found' }, { status: 404 });
    }

    // Only the creator can edit (or admin)
    const userRole = (session.user as any).role;
    if (existing.createdBy !== session.user.id && userRole !== 'admin') {
      return NextResponse.json({ error: 'Not authorized to edit this reply' }, { status: 403 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const reply = await prisma.annotationReply.update({
      where: { id: params.replyId },
      data: { content: content.trim() },
      include: {
        User: {
          select: { id: true, email: true, username: true }
        }
      }
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
    });
  } catch (error) {
    console.error('[Annotation Reply PATCH Error]:', error);
    return NextResponse.json(
      { error: 'Failed to update reply' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string; annotationId: string; replyId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the reply and check ownership
    const existing = await prisma.annotationReply.findUnique({
      where: { id: params.replyId },
      select: { createdBy: true }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Reply not found' }, { status: 404 });
    }

    // Only the creator can delete (or admin)
    const userRole = (session.user as any).role;
    if (existing.createdBy !== session.user.id && userRole !== 'admin') {
      return NextResponse.json({ error: 'Not authorized to delete this reply' }, { status: 403 });
    }

    await prisma.annotationReply.delete({
      where: { id: params.replyId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Annotation Reply DELETE Error]:', error);
    return NextResponse.json(
      { error: 'Failed to delete reply' },
      { status: 500 }
    );
  }
}
