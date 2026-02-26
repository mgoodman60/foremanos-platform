import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_ONEDRIVE_STATUS');

export const dynamic = 'force-dynamic';

// Get OneDrive sync status and history
export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
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
        oneDriveFolderId: true,
        oneDriveFolderPath: true,
        syncEnabled: true,
        lastSyncAt: true,
        ProjectMember: {
          where: { userId: session.user.id },
          select: { role: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user has access to project
    const isOwner = project.ownerId === session.user.id;
    const isMember = project.ProjectMember.length > 0;

    if (!isOwner && !isMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if OneDrive is connected
    const isConnected = !!project.oneDriveFolderId;

    // Get recent sync history (last 10 syncs)
    const syncHistory = await prisma.syncHistory.findMany({
      where: { projectId: project.id },
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        triggerType: true,
        status: true,
        filesAdded: true,
        filesUpdated: true,
        filesDeleted: true,
        filesSkipped: true,
        errorMessage: true,
        startedAt: true,
        completedAt: true,
      },
    });

    return NextResponse.json({
      connected: isConnected,
      folderPath: project.oneDriveFolderPath,
      syncEnabled: project.syncEnabled,
      lastSyncAt: project.lastSyncAt,
      history: syncHistory,
    });
  } catch (error) {
    logger.error('Error fetching OneDrive status', error);
    return NextResponse.json(
      { error: 'Failed to fetch OneDrive status' },
      { status: 500 }
    );
  }
}
