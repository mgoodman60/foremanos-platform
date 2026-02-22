import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_PHOTOS_BULK_CAPTION');

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { photoIds, caption } = await req.json();

    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return NextResponse.json(
        { error: 'Photo IDs are required' },
        { status: 400 }
      );
    }

    if (!caption || typeof caption !== 'string') {
      return NextResponse.json(
        { error: 'Caption is required' },
        { status: 400 }
      );
    }

    const { slug } = params;

    // Get project and verify access
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get all conversations for the project
    const conversations = await prisma.conversation.findMany({
      where: { projectId: project.id },
      select: { id: true, photos: true },
    });

    // Update photos in each conversation
    let updatedCount = 0;
    for (const conversation of conversations) {
      const photos = (conversation.photos as any[]) || [];
      let modified = false;

      for (let i = 0; i < photos.length; i++) {
        if (photoIds.includes(photos[i].id)) {
          photos[i].caption = caption;
          photos[i].captionSource = 'user';
          modified = true;
          updatedCount++;
        }
      }

      if (modified) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { photos },
        });
      }
    }

    return NextResponse.json({ 
      success: true,
      updatedCount,
    });
  } catch (error) {
    logger.error('Error bulk captioning photos', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
