import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { processUploadedPhoto } from '@/lib/photo-analyzer';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_PHOTOS_ANALYZE');

/**
 * POST /api/projects/[slug]/photos/[id]/analyze
 * 
 * Trigger AI analysis for a photo (description, tags, OCR)
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ slug: string; id: string }> }
) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, id } = params;

    // Get photo
    const photo = await prisma.roomPhoto.findUnique({
      where: { id },
    });

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Verify project
    const project = await prisma.project.findUnique({
      where: { slug },
    });

    if (!project || photo.projectId !== project.id) {
      return NextResponse.json(
        { error: 'Photo not found in this project' },
        { status: 404 }
      );
    }

    // Process the photo
    logger.info('[Photo Analysis] Starting analysis for photo', { photoId: id });
    await processUploadedPhoto(id, slug);

    // Get updated photo
    const updatedPhoto = await prisma.roomPhoto.findUnique({
      where: { id },
      include: {
        Room: true,
        FinishScheduleItem: true,
      },
    });

    logger.info('[Photo Analysis] Completed analysis for photo', { photoId: id });

    return NextResponse.json({
      success: true,
      photo: updatedPhoto,
      message: 'Photo analysis completed',
    });
  } catch (error: unknown) {
    logger.error('[Photo Analysis] Error', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: 'Failed to analyze photo',
        message: errMsg,
      },
      { status: 500 }
    );
  }
}
