import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_CREWS');

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        User_Project_ownerIdToUser: true,
        ProjectMember: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check access
    const user = session.user as any;
    const hasAccess =
      project.ownerId === user.id ||
      user.role === 'admin' ||
      project.ProjectMember.some((m: any) => m.userId === user.id);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get crews with related data
    const crews = await prisma.crew.findMany({
      where: {
        projectId: project.id,
      },
      include: {
        Subcontractor: {
          select: {
            id: true,
            companyName: true,
          },
        },
        CrewAssignment: {
          include: {
            ScheduleTask: {
              select: {
                id: true,
                taskId: true,
                name: true,
                status: true,
                percentComplete: true,
              },
            },
          },
          orderBy: {
            assignedDate: 'desc',
          },
        },
        _count: {
          select: {
            CrewAssignment: true,
            CrewPerformance: true,
          },
        },
      },
      orderBy: [
        { isActive: 'desc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({ crews });
  } catch (error) {
    logger.error('Error fetching crews', error);
    return NextResponse.json(
      { error: 'Failed to fetch crews' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.tradeType) {
      return NextResponse.json(
        { error: 'Name and trade type are required' },
        { status: 400 }
      );
    }

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        User_Project_ownerIdToUser: true,
        ProjectMember: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check permissions - only admin and project owner can create crews
    const user = session.user as any;
    const canEdit = project.ownerId === user.id || user.role === 'admin';

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Only project owners and admins can create crews' },
        { status: 403 }
      );
    }

    // Create crew
    const crew = await prisma.crew.create({
      data: {
        projectId: project.id,
        name: body.name,
        tradeType: body.tradeType,
        subcontractorId: body.SubcontractorId || null,
        foremanName: body.foremanName || null,
        foremanPhone: body.foremanPhone || null,
        averageSize: body.averageSize || 4,
        isActive: body.isActive ?? true,
      },
      include: {
        Subcontractor: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    return NextResponse.json({ crew }, { status: 201 });
  } catch (error: any) {
    logger.error('Error creating crew', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A crew with this name already exists in this project' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create crew' },
      { status: 500 }
    );
  }
}
