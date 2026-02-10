/**
 * Render Context API
 * Pre-populates wizard Step 3 data with project intelligence.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createScopedLogger } from '@/lib/logger';
import {
  calculateDataCompleteness,
  gatherRoomData,
  gatherExteriorData,
  gatherAerialData,
} from '@/lib/render-prompt-assembler';
import type { RenderViewType } from '@/lib/render-prompt-assembler';

const log = createScopedLogger('RENDER_API');

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        ownerId: true,
        ProjectMember: { select: { userId: true } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const isOwner = project.ownerId === session.user.id;
    const isMember = project.ProjectMember.some(
      (m: { userId: string }) => m.userId === session.user.id
    );
    const isAdmin = session.user.role === 'admin';

    if (!isOwner && !isMember && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const viewType = searchParams.get('viewType') as RenderViewType | null;
    const roomId = searchParams.get('roomId');

    if (!viewType) {
      return NextResponse.json(
        { error: 'viewType query parameter is required' },
        { status: 400 }
      );
    }

    // Gather data based on view type
    let dataSnapshot: Record<string, unknown> = {};
    try {
      if (viewType === 'interior' && roomId) {
        dataSnapshot = await gatherRoomData(project.id, roomId);
      } else if (viewType === 'aerial_site') {
        dataSnapshot = await gatherAerialData(project.id);
      } else {
        dataSnapshot = await gatherExteriorData(project.id);
      }
    } catch (err) {
      log.warn('Failed to gather context data', { viewType, error: err });
    }

    const dataCompleteness = await calculateDataCompleteness(
      project.id,
      viewType,
      roomId || undefined
    );

    // Fetch rooms list for the room picker (interior views)
    const rooms = await prisma.room.findMany({
      where: { projectId: project.id },
      select: {
        id: true,
        name: true,
        type: true,
        floorNumber: true,
        area: true,
      },
      orderBy: [{ floorNumber: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({
      dataSnapshot,
      dataCompleteness,
      rooms,
    });
  } catch (error) {
    log.error('Failed to gather render context', error as Error);
    return NextResponse.json(
      { error: 'Failed to gather render context' },
      { status: 500 }
    );
  }
}
