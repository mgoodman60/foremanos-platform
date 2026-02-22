import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { deleteFile } from '@/lib/s3';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_PHOTOS');

/**
 * GET /api/projects/[slug]/photos/[id]
 * 
 * Get a single photo with full details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, id } = params;

    // Get photo with all relations
    const photo = await prisma.roomPhoto.findUnique({
      where: { id },
      include: {
        Room: true,
        User: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        FinishScheduleItem: true,
      },
    });

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Verify photo belongs to the project
    const project = await prisma.project.findUnique({
      where: { slug },
    });

    if (!project || photo.projectId !== project.id) {
      return NextResponse.json(
        { error: 'Photo not found in this project' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      photo,
    });
  } catch (error: any) {
    logger.error('[Photo Get] Error', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch photo',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/[slug]/photos/[id]
 * 
 * Update photo metadata (reassign room, update caption, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, id } = params;
    const body = await request.json();

    const {
      roomId,
      caption,
      tradeType,
      location,
      finishItemId,
      capturedAt,
    } = body;

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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

    // If roomId is being changed, verify new room exists
    if (roomId && roomId !== photo.roomId) {
      const newRoom = await prisma.room.findFirst({
        where: {
          id: roomId,
          projectId: project.id,
        },
      });

      if (!newRoom) {
        return NextResponse.json(
          { error: 'Target room not found' },
          { status: 404 }
        );
      }
    }

    // Build update data
    const updateData: any = {};
    if (roomId !== undefined) updateData.roomId = roomId;
    if (caption !== undefined) {
      updateData.caption = caption;
      updateData.aiGenerated = false; // Mark as user-edited
    }
    if (tradeType !== undefined) updateData.tradeType = tradeType;
    if (location !== undefined) updateData.location = location;
    if (finishItemId !== undefined) updateData.FinishScheduleItemId = finishItemId;
    if (capturedAt !== undefined) updateData.capturedAt = new Date(capturedAt);

    // Update photo
    const updatedPhoto = await prisma.roomPhoto.update({
      where: { id },
      data: updateData,
      include: {
        Room: true,
        FinishScheduleItem: true,
      },
    });

    logger.info('[Photo Update] Updated photo', { photoId: id });

    return NextResponse.json({
      success: true,
      photo: updatedPhoto,
    });
  } catch (error: any) {
    logger.error('[Photo Update] Error', error);
    return NextResponse.json(
      {
        error: 'Failed to update photo',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[slug]/photos/[id]
 * 
 * Delete a photo
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, id } = params;

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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

    // Check permissions (admin, project owner, or photo uploader)
    const isAdmin = user.role === 'admin';
    const isOwner = project.ownerId === user.id;
    const isUploader = photo.uploadedById === user.id;

    if (!isAdmin && !isOwner && !isUploader) {
      return NextResponse.json(
        { error: 'Not authorized to delete this photo' },
        { status: 403 }
      );
    }

    // Delete from S3
    try {
      await deleteFile(photo.cloud_storage_path);
      if (photo.thumbnailPath) {
        await deleteFile(photo.thumbnailPath);
      }
    } catch (s3Error) {
      logger.error('Error deleting from S3', s3Error);
      // Continue with database deletion even if S3 deletion fails
    }

    // Delete from database
    await prisma.roomPhoto.delete({
      where: { id },
    });

    logger.info('[Photo Delete] Deleted photo', { photoId: id });

    return NextResponse.json({
      success: true,
      message: 'Photo deleted successfully',
    });
  } catch (error: any) {
    logger.error('[Photo Delete] Error', error);
    return NextResponse.json(
      {
        error: 'Failed to delete photo',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
