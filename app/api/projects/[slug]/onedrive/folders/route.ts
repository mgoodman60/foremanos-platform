import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { OneDriveService } from '@/lib/onedrive-service';
import { decrypt } from '@/lib/encryption';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_ONEDRIVE_FOLDERS');

export const dynamic = 'force-dynamic';

// List OneDrive folders for project folder selection
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
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
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user is project owner
    if (project.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only project owners can browse OneDrive folders' },
        { status: 403 }
      );
    }

    // Check if OneDrive is connected
    if (!project.oneDriveAccessToken || !project.oneDriveRefreshToken) {
      return NextResponse.json(
        { error: 'OneDrive not connected for this project' },
        { status: 400 }
      );
    }

    // Create service instance (decrypt tokens from DB)
    const service = new OneDriveService({
      projectId: project.id,
      accessToken: decrypt(project.oneDriveAccessToken),
      refreshToken: decrypt(project.oneDriveRefreshToken),
      tokenExpiry: project.oneDriveTokenExpiry || new Date(),
    });

    // List folders
    const folders = await service.listFolders();

    return NextResponse.json({ folders });
  } catch (error) {
    logger.error('Error listing OneDrive folders', error);
    return NextResponse.json(
      { error: 'Failed to list OneDrive folders' },
      { status: 500 }
    );
  }
}
