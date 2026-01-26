import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { OneDriveService } from '@/lib/onedrive-service';

export const dynamic = 'force-dynamic';

// Initiate OneDrive OAuth flow
export async function POST(
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
    console.error('Error initiating OneDrive connection:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OneDrive connection' },
      { status: 500 }
    );
  }
}
