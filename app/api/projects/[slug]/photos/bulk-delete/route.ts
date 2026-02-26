import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { deleteFile } from '@/lib/s3';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_PHOTOS_BULK_DELETE');

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { photoIds } = await req.json();

    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return NextResponse.json(
        { error: 'Photo IDs are required' },
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

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email },
      select: { id: true, role: true },
    });

    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can delete photos' },
        { status: 403 }
      );
    }

    // Get all conversations for the project
    const conversations = await prisma.conversation.findMany({
      where: { projectId: project.id },
      select: { id: true, photos: true, photoCount: true },
    });

    // Delete photos from S3 and conversations
    let deletedCount = 0;
    const s3PathsToDelete = new Set<string>();

    for (const conversation of conversations) {
      const photos = (conversation.photos as any[]) || [];
      const initialLength = photos.length;

      // Collect S3 paths and filter out photos
      const remainingPhotos = photos.filter((photo: any) => {
        if (photoIds.includes(photo.id)) {
          if (photo.cloud_storage_path) {
            s3PathsToDelete.add(photo.cloud_storage_path);
          }
          deletedCount++;
          return false; // Remove from array
        }
        return true; // Keep in array
      });

      // Update conversation if photos were deleted
      if (remainingPhotos.length < initialLength) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            photos: remainingPhotos,
            photoCount: remainingPhotos.length,
          },
        });
      }
    }

    // Delete from S3
    for (const s3Path of s3PathsToDelete) {
      try {
        await deleteFile(s3Path);
      } catch (error) {
        logger.error('Error deleting file from S3', error, { s3Path });
        // Continue with other deletions
      }
    }

    return NextResponse.json({ 
      success: true,
      deletedCount,
    });
  } catch (error) {
    logger.error('Error bulk deleting photos', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
