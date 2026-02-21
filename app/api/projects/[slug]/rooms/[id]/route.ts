import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET /api/projects/[slug]/rooms/[id] - Get single room with finish schedules
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, id } = params;

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
    const userId = session.user.id;
    const userRole = session.user.role;

    const isOwner = project.ownerId === userId;
    const isMember = project.ProjectMember.some((m: any) => m.userId === userId);

    if (!isOwner && !isMember && userRole !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get room with finish schedules
    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        FinishScheduleItem: {
          orderBy: [
            { category: 'asc' },
            { createdAt: 'desc' }
          ]
        }
      }
    });

    if (!room || room.projectId !== project.id) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json({ room });
  } catch (error) {
    console.error('Error fetching room:', error);
    return NextResponse.json(
      { error: 'Failed to fetch room' },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[slug]/rooms/[id] - Update room
export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, id } = params;
    const body = await request.json();

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

    // Verify admin/client access
    const userId = session.user.id;
    const userRole = session.user.role;

    const isOwner = project.ownerId === userId;
    const isAdmin = userRole === 'admin' || userRole === 'client';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Update room
    const room = await prisma.room.update({
      where: { id },
      data: {
        name: body.name,
        roomNumber: body.roomNumber,
        type: body.type,
        floorNumber: body.floorNumber,
        area: body.area,
        status: body.status,
        percentComplete: body.percentComplete,
        tradeType: body.tradeType,
        assignedTo: body.assignedTo,
        notes: body.notes,
        floorPlanId: body.floorPlanId,
        hotspotX: body.hotspotX,
        hotspotY: body.hotspotY,
        hotspotWidth: body.hotspotWidth,
        hotspotHeight: body.hotspotHeight,
      },
      include: {
        FinishScheduleItem: true
      }
    });

    return NextResponse.json({ room });
  } catch (error) {
    console.error('Error updating room:', error);
    return NextResponse.json(
      { error: 'Failed to update room' },
      { status: 500 }
    );
  }
}