import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * POST /api/projects/[slug]/rooms/bulk-update-hotspots
 * Bulk update floor plan hotspot coordinates for multiple rooms
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
    const { placements } = body;

    // Validate input
    if (!Array.isArray(placements) || placements.length === 0) {
      return NextResponse.json(
        { error: 'placements must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate each placement
    for (const placement of placements) {
      const { roomId, hotspotX, hotspotY, hotspotWidth, hotspotHeight, floorPlanId } = placement;

      if (!roomId || typeof roomId !== 'string') {
        return NextResponse.json(
          { error: 'Each placement must have a valid roomId' },
          { status: 400 }
        );
      }

      if (!floorPlanId || typeof floorPlanId !== 'string') {
        return NextResponse.json(
          { error: 'Each placement must have a valid floorPlanId' },
          { status: 400 }
        );
      }

      if (typeof hotspotX !== 'number' || typeof hotspotY !== 'number' ||
          typeof hotspotWidth !== 'number' || typeof hotspotHeight !== 'number') {
        return NextResponse.json(
          { error: 'hotspotX, hotspotY, hotspotWidth, and hotspotHeight must be numbers' },
          { status: 400 }
        );
      }

      if (hotspotX < 0 || hotspotX > 100 || hotspotY < 0 || hotspotY > 100 ||
          hotspotWidth < 0 || hotspotWidth > 100 || hotspotHeight < 0 || hotspotHeight > 100) {
        return NextResponse.json(
          { error: 'Hotspot coordinates and dimensions must be between 0 and 100 (percentage)' },
          { status: 400 }
        );
      }
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

    // Extract room IDs for verification
    const roomIds = placements.map((p: any) => p.roomId);

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

    logger.info('ROOMS_API', `Bulk updating hotspots for ${placements.length} rooms in project ${project.name}`);

    // Bulk update hotspot coordinates using transaction
    const updateResults = await prisma.$transaction(
      placements.map((placement: any) =>
        prisma.room.update({
          where: { id: placement.roomId },
          data: {
            hotspotX: placement.hotspotX,
            hotspotY: placement.hotspotY,
            hotspotWidth: placement.hotspotWidth,
            hotspotHeight: placement.hotspotHeight,
            floorPlanId: placement.floorPlanId,
          },
        })
      )
    );

    logger.info('ROOMS_API', `Successfully updated ${updateResults.length} room hotspots`);

    return NextResponse.json({
      success: true,
      message: `Successfully updated hotspot coordinates for ${updateResults.length} rooms`,
      updated: updateResults.length,
      rooms: rooms.map((r: any) => ({
        id: r.id,
        roomNumber: r.roomNumber,
        name: r.name,
      })),
    });
  } catch (error: unknown) {
    logger.error('ROOMS_API', 'Error bulk updating hotspots', error as Error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: 'Failed to bulk update room hotspots',
        details: errMsg,
      },
      { status: 500 }
    );
  }
}
