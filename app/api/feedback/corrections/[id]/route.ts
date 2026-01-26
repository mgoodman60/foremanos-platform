import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// PATCH /api/feedback/corrections/[id] - Update a correction (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const correctionId = params.id;
    const { correctedAnswer, adminNotes, keywords, isActive } = await request.json();

    // Check if correction exists
    const existingCorrection = await prisma.adminCorrection.findUnique({
      where: { id: correctionId }
    });

    if (!existingCorrection) {
      return NextResponse.json(
        { error: 'Correction not found' },
        { status: 404 }
      );
    }

    // Update the correction
    const correction = await prisma.adminCorrection.update({
      where: { id: correctionId },
      data: {
        ...(correctedAnswer !== undefined && { correctedAnswer }),
        ...(adminNotes !== undefined && { adminNotes }),
        ...(keywords !== undefined && { keywords }),
        ...(isActive !== undefined && { isActive })
      },
      include: {
        User: {
          select: {
            username: true,
            email: true
          }
        },
        Project: {
          select: {
            name: true,
            slug: true
          }
        }
      }
    });

    return NextResponse.json({ correction });
  } catch (error) {
    console.error('Error updating correction:', error);
    return NextResponse.json(
      { error: 'Failed to update correction' },
      { status: 500 }
    );
  }
}

// DELETE /api/feedback/corrections/[id] - Delete a correction (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const correctionId = params.id;

    // Check if correction exists
    const existingCorrection = await prisma.adminCorrection.findUnique({
      where: { id: correctionId }
    });

    if (!existingCorrection) {
      return NextResponse.json(
        { error: 'Correction not found' },
        { status: 404 }
      );
    }

    // Delete the correction
    await prisma.adminCorrection.delete({
      where: { id: correctionId }
    });

    return NextResponse.json(
      { success: true, message: 'Correction deleted successfully' }
    );
  } catch (error) {
    console.error('Error deleting correction:', error);
    return NextResponse.json(
      { error: 'Failed to delete correction' },
      { status: 500 }
    );
  }
}
