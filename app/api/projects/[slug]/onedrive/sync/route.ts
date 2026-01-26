import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { OneDriveService } from '@/lib/onedrive-service';
import { logActivity } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for long-running sync

// Manual sync trigger
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  let syncHistoryId: string | null = null;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
      select: {
        id: true,
        ownerId: true,
        oneDriveAccessToken: true,
        oneDriveRefreshToken: true,
        oneDriveTokenExpiry: true,
        oneDriveFolderId: true,
        ProjectMember: {
          where: { userId: session.user.id },
          select: { role: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user has permission (owner or editor)
    const isOwner = project.ownerId === session.user.id;
    const member = project.ProjectMember[0];
    const isEditor = member?.role === 'editor' || member?.role === 'owner';

    if (!isOwner && !isEditor) {
      return NextResponse.json(
        { error: 'Only project owners and editors can trigger sync' },
        { status: 403 }
      );
    }

    // Check if OneDrive is configured
    if (
      !project.oneDriveAccessToken ||
      !project.oneDriveRefreshToken ||
      !project.oneDriveFolderId
    ) {
      return NextResponse.json(
        { error: 'OneDrive not fully configured for this project' },
        { status: 400 }
      );
    }

    // Create sync history record
    const syncHistory = await prisma.syncHistory.create({
      data: {
        projectId: project.id,
        triggerType: 'manual',
        status: 'in_progress',
      },
    });
    syncHistoryId = syncHistory.id;

    // Create service instance
    const service = new OneDriveService({
      projectId: project.id,
      accessToken: project.oneDriveAccessToken,
      refreshToken: project.oneDriveRefreshToken,
      tokenExpiry: project.oneDriveTokenExpiry || new Date(),
      folderId: project.oneDriveFolderId,
    });

    // Perform sync
    const result = await service.syncDocuments();

    // Update sync history
    await prisma.syncHistory.update({
      where: { id: syncHistoryId },
      data: {
        status: result.errors.length > 0 ? 'partial' : 'success',
        filesAdded: result.added,
        filesUpdated: result.updated,
        filesDeleted: result.deleted,
        filesSkipped: result.skipped,
        errorMessage: result.errors.length > 0 ? result.errors.join('\n') : null,
        completedAt: new Date(),
      },
    });

    // Update project lastSyncAt
    await prisma.project.update({
      where: { id: project.id },
      data: { lastSyncAt: new Date() },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'onedrive_sync_manual',
      resource: 'project',
      resourceId: project.id,
      details: {
        added: result.added,
        updated: result.updated,
        deleted: result.deleted,
        skipped: result.skipped,
        errors: result.errors,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      message: 'Sync completed',
      result: {
        added: result.added,
        updated: result.updated,
        deleted: result.deleted,
        skipped: result.skipped,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error('Error syncing OneDrive:', error);

    // Update sync history with error
    if (syncHistoryId) {
      await prisma.syncHistory.update({
        where: { id: syncHistoryId },
        data: {
          status: 'failed',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        },
      });
    }

    return NextResponse.json(
      {
        error: 'Failed to sync OneDrive',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
