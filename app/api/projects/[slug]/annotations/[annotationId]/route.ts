import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

/**
 * PATCH /api/projects/[slug]/annotations/[annotationId]
 * Update an annotation
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string; annotationId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { annotationId } = params;
    const body = await request.json();

    const { status, priority, assignedTo, content, title } = body;

    const userId = session.user.id;

    // Prepare update data
    const updateData: any = {};

    if (status !== undefined) {
      updateData.status = status;
      if (status === 'resolved') {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = userId;
      }
    }

    if (priority !== undefined) {
      updateData.priority = priority;
    }

    if (assignedTo !== undefined) {
      updateData.assignedTo = assignedTo;
    }

    if (content !== undefined) {
      updateData.content = content;
    }

    if (title !== undefined) {
      updateData.title = title;
    }

    // Update annotation
    const annotation = await prisma.visualAnnotation.update({
      where: { id: annotationId },
      data: updateData,
      include: {
        User_VisualAnnotation_createdByToUser: {
          select: {
            email: true,
            username: true
          }
        },
        User_VisualAnnotation_assignedToToUser: {
          select: {
            email: true,
            username: true
          }
        }
      }
    });

    return NextResponse.json({
      annotation: {
        id: annotation.id,
        title: annotation.title,
        content: annotation.content,
        status: annotation.status,
        priority: annotation.priority,
        updatedAt: annotation.updatedAt.toISOString()
      }
    });
  } catch (error: any) {
    console.error('Error updating annotation:', error);
    return NextResponse.json(
      { error: 'Failed to update annotation' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[slug]/annotations/[annotationId]
 * Delete an annotation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string; annotationId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { annotationId } = params;

    // Delete annotation (cascade will delete replies)
    await prisma.visualAnnotation.delete({
      where: { id: annotationId }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting annotation:', error);
    return NextResponse.json(
      { error: 'Failed to delete annotation' },
      { status: 500 }
    );
  }
}
