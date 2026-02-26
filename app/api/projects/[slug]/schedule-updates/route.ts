import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SCHEDULE_UPDATES');

// GET /api/projects/[slug]/schedule-updates - Get all schedule updates for a project
export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'all'; // pending, applied, rejected, all
    const minConfidence = searchParams.get('minConfidence') ? parseFloat(searchParams.get('minConfidence')!) : 0;

    // Fetch project
    const project = await prisma.project.findUnique({
      where: { slug },
      select: {
        id: true,
        ownerId: true,
        ProjectMember: {
          select: {
            userId: true,
            role: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user has access
    const isOwner = project.ownerId === session.user.id;
    const isMember = project.ProjectMember.some((m: any) => m.userId === session.user.id);
    const isAdmin = session.user.role === 'admin';

    if (!isOwner && !isMember && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Build where clause
    const whereClause: any = {
      projectId: project.id,
    };

    // Apply status filter
    if (statusFilter !== 'all') {
      whereClause.status = statusFilter;
    }

    // Apply confidence filter
    if (minConfidence > 0) {
      whereClause.confidence = {
        gte: minConfidence,
      };
    }

    // Fetch schedule updates
    const updates = await prisma.scheduleUpdate.findMany({
      where: whereClause,
      include: {
        Schedule: {
          select: {
            id: true,
            name: true,
          },
        },
        User_createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Count updates by status
    const statusCounts = await prisma.scheduleUpdate.groupBy({
      by: ['status'],
      where: {
        projectId: project.id,
      },
      _count: true,
    });

    const counts = {
      pending: 0,
      applied: 0,
      rejected: 0,
      all: 0,
    };

    statusCounts.forEach((item: any) => {
      counts[item.status as keyof typeof counts] = item._count;
      counts.all += item._count;
    });

    return NextResponse.json({
      updates,
      counts,
      canEdit: isOwner || isAdmin, // Only owners and admins can approve/reject
    });
  } catch (error: unknown) {
    logger.error('Error fetching schedule updates', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedule updates' },
      { status: 500 }
    );
  }
}
