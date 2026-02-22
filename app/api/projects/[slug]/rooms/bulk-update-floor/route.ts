import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_ROOMS_BULK_UPDATE_FLOOR');

/**
 * POST /api/projects/[slug]/rooms/bulk-update-floor
 * Bulk update floor assignment for multiple rooms
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { slug } = params;
    const body = await request.json();
    const { roomIds, floorNumber } = body;

    // Validate input
    if (!Array.isArray(roomIds) || roomIds.length === 0) {
      return NextResponse.json(
        { error: 'roomIds must be a non-empty array' },
        { status: 400 }
      );
    }

    if (typeof floorNumber !== 'number' && floorNumber !== null) {
      return NextResponse.json(
        { error: 'floorNumber must be a number or null' },
        { status: 400 }
      );
    }

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        User_Project_ownerIdToUser: true,
        ProjectMember: {
          include: {
            User: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check user access
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const isOwner = (project as any).ownerId === (user as any).id;
    const isAdmin = (user as any).role === 'admin' || (user as any).role === 'client';
    const isMember = project.ProjectMember.some(
      (member: any) => member.userId === (user as any).id
    );

    if (!isOwner && !isAdmin && !isMember) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Verify all rooms belong to this project
    const rooms = await prisma.room.findMany({
      where: {
        id: { in: roomIds },
        projectId: project.id,
      },
      select: {
        id: true,
        roomNumber: true,
        name: true,
      },
    });

    if (rooms.length !== roomIds.length) {
      return NextResponse.json(
        { error: 'Some rooms do not exist or do not belong to this project' },
        { status: 400 }
      );
    }

    logger.info('Bulk updating rooms to floor', { roomCount: roomIds.length, floorNumber, project: project.name });

    // Bulk update floor number
    const result = await prisma.room.updateMany({
      where: {
        id: { in: roomIds },
      },
      data: {
        floorNumber: floorNumber,
      },
    });

    logger.info('Successfully updated rooms', { count: result.count });

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${result.count} rooms to floor ${floorNumber ?? 'unassigned'}`,
      updated: result.count,
      rooms: rooms.map((r: any) => ({
        id: r.id,
        roomNumber: r.roomNumber,
        name: r.name,
      })),
    });
  } catch (error: any) {
    logger.error('Error bulk updating floor', error);
    return NextResponse.json(
      {
        error: 'Failed to bulk update rooms',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
