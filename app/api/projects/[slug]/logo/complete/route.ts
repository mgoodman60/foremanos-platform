import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { deleteFile, getFileUrl } from '@/lib/s3';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_LOGO_COMPLETE');

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[slug]/logo/complete
 * Complete logo upload and update project record
 * Only Project Owner or Admin can upload logo
 */
export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user?.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the project
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        ownerId: true,
        logoUrl: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check permissions: Only Project Owner or Admin can upload logo
    const isOwner = project.ownerId === user.id;
    const isAdmin = user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Only project owners and admins can upload project logos' },
        { status: 403 }
      );
    }

    // Parse request body
    const { cloud_storage_path } = await request.json();

    if (!cloud_storage_path) {
      return NextResponse.json(
        { error: 'cloud_storage_path is required' },
        { status: 400 }
      );
    }

    // Delete old logo if it exists
    if (project.logoUrl) {
      try {
        await deleteFile(project.logoUrl);
      } catch (error) {
        logger.error('', error);
        // Continue even if delete fails
      }
    }

    // Update project with new logo
    const updatedProject = await prisma.project.update({
      where: { id: project.id },
      data: {
        logoUrl: cloud_storage_path,
        logoUploadedBy: user.id,
        logoUploadedAt: new Date(),
      },
      select: {
        id: true,
        slug: true,
        name: true,
        logoUrl: true,
        logoUploadedAt: true,
      },
    });

    // Generate public URL for the logo
    const logoPublicUrl = await getFileUrl(cloud_storage_path, true);

    // Log the change in ReportChangeLog (if this is part of daily report)
    // This can be used for audit trail
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Find today's daily report chat if it exists
    const dailyReportChat = await prisma.conversation.findFirst({
      where: {
        projectId: project.id,
        conversationType: 'daily_report',
        dailyReportDate: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      select: { id: true },
    });

    if (dailyReportChat) {
      await prisma.reportChangeLog.create({
        data: {
          conversationId: dailyReportChat.id,
          userId: user.id,
          projectId: project.id,
          reportDate: today,
          changeType: 'logo_uploaded',
          description: `${user.email} uploaded a new project logo`,
          metadata: {
            logoUrl: cloud_storage_path,
            fileName: cloud_storage_path.split('/').pop(),
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      project: updatedProject,
      logoUrl: logoPublicUrl,
    });
  } catch (error: any) {
    logger.error('', error);
    return NextResponse.json(
      { error: 'Failed to complete logo upload' },
      { status: 500 }
    );
  }
}
