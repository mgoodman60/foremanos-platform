import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_ROOMS_BULK_DELETE');

// POST /api/projects/[slug]/rooms/bulk-delete - Delete multiple rooms
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();
    const { roomIds } = body;

    if (!Array.isArray(roomIds) || roomIds.length === 0) {
      return NextResponse.json(
        { error: 'Room IDs must be a non-empty array' },
        { status: 400 }
      );
    }

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        User_Project_ownerIdToUser: true,
        ProjectMember: { include: { User: true } }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify access
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = (project as any).ownerId === (user as any).id;
    const isAdmin = (user as any).role === 'admin' || (user as any).role === 'client';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Delete finish schedule items first
    await prisma.finishScheduleItem.deleteMany({
      where: {
        roomId: {
          in: roomIds
        }
      }
    });

    // Delete rooms
    const result = await prisma.room.deleteMany({
      where: {
        id: {
          in: roomIds
        },
        projectId: project.id
      }
    });

    logger.info('Bulk deleted rooms from project', { count: result.count, project: project.name });

    return NextResponse.json({ 
      success: true,
      deleted: result.count 
    });
  } catch (error: unknown) {
    logger.error('Error bulk deleting rooms', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to delete rooms', details: errMsg },
      { status: 500 }
    );
  }
}
