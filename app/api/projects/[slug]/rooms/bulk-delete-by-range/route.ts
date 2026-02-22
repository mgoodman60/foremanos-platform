import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_ROOMS_BULK_DELETE_BY_RANGE');

// POST /api/projects/[slug]/rooms/bulk-delete-by-range - Delete rooms by number range
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
    const { startNumber, endNumber, deleteUnknownTypes } = body;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug }
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

    // Build where clause
    const where: any = {
      projectId: project.id
    };

    // Add range filter if provided
    if (startNumber !== undefined || endNumber !== undefined) {
      where.OR = [];
      
      if (startNumber !== undefined && endNumber !== undefined) {
        // Delete rooms in range
        const start = parseInt(startNumber);
        const end = parseInt(endNumber);
        
        where.OR.push({
          roomNumber: {
            gte: start.toString().padStart(3, '0'),
            lte: end.toString().padStart(3, '0')
          }
        });
      } else if (startNumber !== undefined) {
        // Delete rooms >= start
        where.OR.push({
          roomNumber: {
            gte: parseInt(startNumber).toString().padStart(3, '0')
          }
        });
      } else if (endNumber !== undefined) {
        // Delete rooms <= end
        where.OR.push({
          roomNumber: {
            lte: parseInt(endNumber).toString().padStart(3, '0')
          }
        });
      }
    }

    // Add type filter if requested
    if (deleteUnknownTypes === true) {
      where.type = 'Unknown';
    }

    // Get rooms to delete
    const roomsToDelete = await prisma.room.findMany({
      where,
      select: { id: true, roomNumber: true, name: true }
    });

    if (roomsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        deleted: 0,
        message: 'No rooms matched the criteria'
      });
    }

    // Delete finish schedule items first
    await prisma.finishScheduleItem.deleteMany({
      where: {
        roomId: {
          in: roomsToDelete.map((r: any) => r.id)
        }
      }
    });

    // Delete rooms
    const result = await prisma.room.deleteMany({
      where: {
        id: {
          in: roomsToDelete.map((r: any) => r.id)
        }
      }
    });

    logger.info('Bulk deleted rooms from project', { count: result.count, project: project.name });

    return NextResponse.json({ 
      success: true,
      deleted: result.count,
      deletedRooms: roomsToDelete
    });
  } catch (error: any) {
    logger.error('Error bulk deleting rooms by range', error);
    return NextResponse.json(
      { error: 'Failed to delete rooms', details: error.message },
      { status: 500 }
    );
  }
}
