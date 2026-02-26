import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getFileUrl, deleteFile } from '@/lib/s3';
import { createLogger } from '@/lib/logger';
const logger = createLogger('TEMPLATES');

export const dynamic = 'force-dynamic';

/**
 * GET /api/templates/[id]
 * Get a specific template
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;

    const template = await prisma.documentTemplate.findUnique({
      where: { id },
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

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Check access permissions
    if (template.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: template.projectId },
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

    // Get file URL
    const fileUrl = await getFileUrl(template.cloud_storage_path, template.isPublic);

    return NextResponse.json({
      template: {
        ...template,
        fileUrl,
      },
    });
  } catch (error) {
    logger.error('Error', error);
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/templates/[id]
 * Delete a template
 */
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;

    const template = await prisma.documentTemplate.findUnique({
      where: { id },
      include: {
        Project: {
          select: {
            id: true,
            ownerId: true,
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Check permissions (owner or admin)
    const isUploader = template.uploadedBy === session.user.id;
    const isProjectOwner = template.Project?.ownerId === session.user.id;
    const isAdmin = session.user.role === 'admin';

    if (!isUploader && !isProjectOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete this template' },
        { status: 403 }
      );
    }

    // Delete file from S3
    try {
      await deleteFile(template.cloud_storage_path);
    } catch (error) {
      logger.error('Error deleting file from S3', error);
      // Continue with database deletion even if S3 deletion fails
    }

    // Delete from database
    await prisma.documentTemplate.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Template deleted successfully',
    });
  } catch (error) {
    logger.error('Error', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
