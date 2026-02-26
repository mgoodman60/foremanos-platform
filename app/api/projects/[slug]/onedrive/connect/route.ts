import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { OneDriveService } from '@/lib/onedrive-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_ONEDRIVE_CONNECT');

export const dynamic = 'force-dynamic';

// Initiate OneDrive OAuth flow
export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
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
      select: { id: true, ownerId: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user is project owner
    if (project.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only project owners can connect OneDrive' },
        { status: 403 }
      );
    }

    // Generate OAuth URL
    const authUrl = OneDriveService.getAuthUrl(slug);

    return NextResponse.json({ authUrl });
  } catch (error) {
    logger.error('Error initiating OneDrive connection', error);
    return NextResponse.json(
      { error: 'Failed to initiate OneDrive connection' },
      { status: 500 }
    );
  }
}
