import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_ANNOTATIONS');

/**
 * GET /api/projects/[slug]/annotations
 * Get all annotations for a project or specific document
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const sheetNumber = searchParams.get('sheetNumber');

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Build where clause
    const where: any = {
      projectId: project.id
    };

    if (documentId) {
      where.documentId = documentId;
    }

    if (type && type !== 'all') {
      where.type = type;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (sheetNumber) {
      where.sheetNumber = sheetNumber;
    }

    // Fetch annotations
    const annotations = await prisma.visualAnnotation.findMany({
      where,
      include: {
        User_VisualAnnotation_createdByToUser: {
          select: {
            email: true,
            username: true
          }
        },
        User_VisualAnnotation_assignedToToUser: {
          select: {
            email: true,
            username: true
          }
        },
        AnnotationReply: {
          include: {
            User: {
              select: {
                email: true,
                username: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Map to response format
    const formattedAnnotations = annotations.map((a: any) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      type: a.type,
      status: a.status,
      priority: a.priority,
      xPercent: a.xPercent,
      yPercent: a.yPercent,
      gridCoordinate: a.gridCoordinate,
      sheetNumber: a.sheetNumber,
      tags: a.tags,
      createdBy: {
        email: a.User_VisualAnnotation_createdByToUser.email || '',
        username: a.User_VisualAnnotation_createdByToUser.username
      },
      assignedTo: a.User_VisualAnnotation_assignedToToUser ? {
        email: a.User_VisualAnnotation_assignedToToUser.email || '',
        username: a.User_VisualAnnotation_assignedToToUser.username
      } : null,
      replies: a.AnnotationReply.map((r: any) => ({
        id: r.id,
        content: r.content,
        createdBy: {
          email: r.User?.email || '',
          username: r.User?.username || 'Unknown'
        },
        createdAt: r.createdAt.toISOString()
      })),
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      resolvedAt: a.resolvedAt?.toISOString() || null
    }));

    return NextResponse.json({ annotations: formattedAnnotations });
  } catch (error: unknown) {
    logger.error('Error fetching annotations', error);
    return NextResponse.json(
      { error: 'Failed to fetch annotations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[slug]/annotations
 * Create a new annotation
 */
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

    const {
      documentId,
      title,
      content,
      type = 'general',
      priority = 'medium',
      xPercent,
      yPercent,
      sheetNumber,
      gridCoordinate,
      tags = [],
      assignedTo
    } = body;

    // Validate required fields
    if (!documentId || !title || !content || xPercent === undefined || yPercent === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const userId = session.user.id;

    // Create annotation
    const annotation = await prisma.visualAnnotation.create({
      data: {
        projectId: project.id,
        documentId,
        title,
        content,
        type,
        priority,
        status: 'open',
        xPercent,
        yPercent,
        sheetNumber: sheetNumber || null,
        gridCoordinate: gridCoordinate || null,
        tags: tags || [],
        createdBy: userId,
        assignedTo: assignedTo || null
      },
      include: {
        User_VisualAnnotation_createdByToUser: {
          select: {
            email: true,
            username: true
          }
        }
      }
    });

    return NextResponse.json({
      annotation: {
        id: annotation.id,
        title: annotation.title,
        content: annotation.content,
        type: annotation.type,
        status: annotation.status,
        priority: annotation.priority,
        xPercent: annotation.xPercent,
        yPercent: annotation.yPercent,
        createdBy: {
          email: annotation.User_VisualAnnotation_createdByToUser.email || '',
          username: annotation.User_VisualAnnotation_createdByToUser.username
        },
        createdAt: annotation.createdAt.toISOString()
      }
    });
  } catch (error: unknown) {
    logger.error('Error creating annotation', error);
    return NextResponse.json(
      { error: 'Failed to create annotation' },
      { status: 500 }
    );
  }
}
