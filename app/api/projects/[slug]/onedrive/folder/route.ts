import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/audit-log';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_ONEDRIVE_FOLDER');

export const dynamic = 'force-dynamic';

// Set OneDrive folder for project
export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();
    const { folderId, folderPath } = body;

    if (!folderId || !folderPath) {
      return NextResponse.json(
        { error: 'Folder ID and path are required' },
        { status: 400 }
      );
    }

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true, ownerId: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user is project owner
    if (project.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only project owners can configure OneDrive sync' },
        { status: 403 }
      );
    }

    // Update project with folder selection
    await prisma.project.update({
      where: { id: project.id },
      data: {
        oneDriveFolderId: folderId,
        oneDriveFolderPath: folderPath,
      },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'onedrive_folder_configured',
      resource: 'project',
      resourceId: project.id,
      details: { folderId, folderPath },
      request,
    });

    return NextResponse.json({
      success: true,
      message: 'OneDrive folder configured successfully',
    });
  } catch (error) {
    logger.error('Error setting OneDrive folder', error);
    return NextResponse.json(
      { error: 'Failed to configure OneDrive folder' },
      { status: 500 }
    );
  }
}

// Enable/disable OneDrive sync
export async function PATCH(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();
    const { syncEnabled } = body;

    if (typeof syncEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'syncEnabled must be a boolean' },
        { status: 400 }
      );
    }

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true, ownerId: true, oneDriveFolderId: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user is project owner
    if (project.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only project owners can toggle OneDrive sync' },
        { status: 403 }
      );
    }

    // Check if folder is configured
    if (syncEnabled && !project.oneDriveFolderId) {
      return NextResponse.json(
        { error: 'OneDrive folder must be configured before enabling sync' },
        { status: 400 }
      );
    }

    // Update sync status
    await prisma.project.update({
      where: { id: project.id },
      data: { syncEnabled },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: syncEnabled ? 'onedrive_sync_enabled' : 'onedrive_sync_disabled',
      resource: 'project',
      resourceId: project.id,
      details: { syncEnabled },
      request,
    });

    return NextResponse.json({
      success: true,
      message: `OneDrive sync ${syncEnabled ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error) {
    logger.error('Error toggling OneDrive sync', error);
    return NextResponse.json(
      { error: 'Failed to toggle OneDrive sync' },
      { status: 500 }
    );
  }
}
