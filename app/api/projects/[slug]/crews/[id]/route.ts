import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_CREWS');

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, id } = params;

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get crew with full details
    const crew = await prisma.crew.findFirst({
      where: {
        id,
        projectId: project.id,
      },
      include: {
        Subcontractor: true,
        CrewAssignment: {
          include: {
            ScheduleTask: {
              select: {
                id: true,
                taskId: true,
                name: true,
                status: true,
                startDate: true,
                endDate: true,
                percentComplete: true,
              },
            },
          },
          orderBy: {
            assignedDate: 'desc',
          },
        },
        CrewPerformance: {
          orderBy: {
            date: 'desc',
          },
          take: 30, // Last 30 days
        },
      },
    });

    if (!crew) {
      return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
    }

    return NextResponse.json({ crew });
  } catch (error) {
    logger.error('Error fetching crew', error);
    return NextResponse.json(
      { error: 'Failed to fetch crew' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, id } = params;
    const body = await request.json();

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check permissions
    const user = session.user as any;
    const canEdit = project.ownerId === user.id || user.role === 'admin';

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Only project owners and admins can update crews' },
        { status: 403 }
      );
    }

    // Update crew
    const crew = await prisma.crew.update({
      where: { id },
      data: {
        name: body.name,
        tradeType: body.tradeType,
        subcontractorId: body.SubcontractorId,
        foremanName: body.foremanName,
        foremanPhone: body.foremanPhone,
        averageSize: body.averageSize,
        isActive: body.isActive,
        productivityScore: body.productivityScore,
        safetyScore: body.safetyScore,
        qualityScore: body.qualityScore,
      },
      include: {
        Subcontractor: true,
      },
    });

    return NextResponse.json({ crew });
  } catch (error: unknown) {
    logger.error('Error updating crew', error);

    if (error instanceof Error && 'code' in error && (error as any).code === 'P2025') {
      return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to update crew' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, id } = params;

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check permissions
    const user = session.user as any;
    const canDelete = project.ownerId === user.id || user.role === 'admin';

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Only project owners and admins can delete crews' },
        { status: 403 }
      );
    }

    // Delete crew (cascade will handle assignments and performance records)
    await prisma.crew.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Error deleting crew', error);

    if (error instanceof Error && 'code' in error && (error as any).code === 'P2025') {
      return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to delete crew' },
      { status: 500 }
    );
  }
}
