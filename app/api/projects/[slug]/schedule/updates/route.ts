import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SCHEDULE_UPDATES');

export const dynamic = 'force-dynamic';

// interface ScheduleUpdateHistoryRequest {
//   scheduleId?: string;
//   status?: 'pending' | 'approved' | 'rejected' | 'auto_applied';
//   limit?: number;
//   offset?: number;
// }

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { slug } = params;
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const scheduleId = searchParams.get('scheduleId') || undefined;
    const status = searchParams.get('status') as 'pending' | 'approved' | 'rejected' | 'auto_applied' || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get project and verify permissions
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        ProjectMember: {
          where: { userId: session.user.id },
          select: { role: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if user has access to project
    const isOwner = project.ownerId === session.user.id;
    const isMember = project.ProjectMember.length > 0;
    const isAdmin = session.user.role === 'admin';

    if (!isOwner && !isMember && !isAdmin) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Build where clause
    const where: any = {
      projectId: project.id,
    };

    if (scheduleId) {
      where.scheduleId = scheduleId;
    }

    if (status) {
      where.status = status;
    }

    // Get total count
    const total = await prisma.scheduleUpdate.count({ where });

    // Get updates
    const updates = await prisma.scheduleUpdate.findMany({
      where,
      include: {
        User_appliedBy: {
          select: {
            id: true,
            username: true,
          },
        },
        User_rejectedBy: {
          select: {
            id: true,
            username: true,
          },
        },
        User_createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
        Schedule: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    return NextResponse.json({
      updates,
      total,
      hasMore: offset + limit < total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Error', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
