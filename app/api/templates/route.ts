import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/templates
 * List all templates (project-specific or global)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const projectSlug = searchParams.get('projectSlug');
    const templateType = searchParams.get('templateType');

    const where: any = {};
    
    // If projectSlug is provided, look up project
    let resolvedProjectId = projectId;
    if (projectSlug && !projectId) {
      const project = await prisma.project.findUnique({
        where: { slug: projectSlug },
        select: { id: true },
      });
      resolvedProjectId = project?.id || null;
    }
    
    // Filter by project or get global templates
    if (resolvedProjectId) {
      where.OR = [
        { projectId: resolvedProjectId },
        { projectId: null } // Include global templates
      ];
    } else {
      where.projectId = null; // Only global templates
    }

    // Filter by template type if specified
    if (templateType) {
      where.templateType = templateType;
    }

    const templates = await prisma.documentTemplate.findMany({
      where,
      include: {
        User: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        Project: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('[TEMPLATES_API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/templates
 * Upload a new template
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      templateType,
      fileFormat,
      cloud_storage_path,
      isPublic,
      fileSize,
      projectId,
      projectSlug,
    } = body;

    // Resolve projectId from projectSlug if provided
    let resolvedProjectId = projectId;
    if (projectSlug && !projectId) {
      const project = await prisma.project.findUnique({
        where: { slug: projectSlug },
        select: { id: true },
      });
      resolvedProjectId = project?.id || null;
    }

    // Validate required fields
    if (!name || !templateType || !fileFormat || !cloud_storage_path) {
      return NextResponse.json(
        {
          error: 'Missing required fields: name, templateType, fileFormat, cloud_storage_path',
        },
        { status: 400 }
      );
    }

    // Validate template type
    const validTypes = ['daily_report', 'schedule', 'budget', 'rfi', 'custom'];
    if (!validTypes.includes(templateType)) {
      return NextResponse.json(
        { error: `Invalid template type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file format
    const validFormats = ['docx', 'xlsx', 'pdf'];
    if (!validFormats.includes(fileFormat)) {
      return NextResponse.json(
        { error: `Invalid file format. Must be one of: ${validFormats.join(', ')}` },
        { status: 400 }
      );
    }

    // If projectId is provided, verify the user has access
    if (resolvedProjectId) {
      const project = await prisma.project.findUnique({
        where: { id: resolvedProjectId },
        include: {
          ProjectMember: {
            where: { userId: session.user.id },
          },
        },
      });

      if (!project) {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }

      const isOwner = project.ownerId === session.user.id;
      const isMember = project.ProjectMember.length > 0;
      const isAdmin = session.user.role === 'admin';

      if (!isOwner && !isMember && !isAdmin) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    // Create template
    const template = await prisma.documentTemplate.create({
      data: {
        name,
        description,
        templateType,
        fileFormat,
        cloud_storage_path,
        isPublic: isPublic || false,
        fileSize,
        projectId: resolvedProjectId || null,
        uploadedBy: session.user.id,
      },
      include: {
        User: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        Project: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return NextResponse.json(
      { template, message: 'Template uploaded successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[TEMPLATES_API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to upload template' },
      { status: 500 }
    );
  }
}
