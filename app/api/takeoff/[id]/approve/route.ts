import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('TAKEOFF_APPROVE');

// POST /api/takeoff/[id]/approve - Approve a material takeoff
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Get takeoff with project info
    const takeoff = await prisma.materialTakeoff.findUnique({
      where: { id },
      include: {
        Project: {
          include: {
            User_Project_ownerIdToUser: true,
            ProjectMember: {
              include: { User: true }
            }
          }
        }
      }
    });

    if (!takeoff) {
      return NextResponse.json({ error: 'Takeoff not found' }, { status: 404 });
    }

    // Verify user has access (owner or admin only)
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = takeoff.Project.ownerId === user.id;

    if (!isOwner && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied - only project owner or admin can approve' },
        { status: 403 }
      );
    }

    // Approve takeoff
    const approved = await prisma.materialTakeoff.update({
      where: { id },
      data: {
        status: 'approved',
        approvedBy: user.id,
        approvedAt: new Date()
      },
      include: {
        User: {
          select: {
            id: true,
            email: true,
            username: true
          }
        },
        Document: {
          select: {
            id: true,
            name: true,
            fileName: true
          }
        },
        TakeoffLineItem: true
      }
    });

    return NextResponse.json({ takeoff: approved });
  } catch (error: unknown) {
    logger.error('Error approving takeoff', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to approve takeoff', details: errMsg },
      { status: 500 }
    );
  }
}
