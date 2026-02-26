/**
 * Individual Photo Management API
 * 
 * PATCH /api/conversations/[id]/photos/[photoId]
 * Update photo annotations (caption, location, trade, tags)
 * 
 * DELETE /api/conversations/[id]/photos/[photoId]
 * Delete a specific photo from a conversation
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createS3Client, getBucketConfig, validateS3Config } from '@/lib/aws-config';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { PhotoMetadata } from '@/lib/photo-analyzer';
import { createLogger } from '@/lib/logger';
const logger = createLogger('CONVERSATIONS_PHOTOS');

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string; photoId: string }> }
) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id, photoId } = params;
    const body = await request.json();
    const { caption, location, trade, tags } = body;

    // Get conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (conversation.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get current photos
    const photos = (conversation.photos as unknown as PhotoMetadata[]) || [];
    const photoIndex = photos.findIndex((p) => p.id === photoId);

    if (photoIndex === -1) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      );
    }

    // Update photo metadata
    const updatedPhoto = {
      ...photos[photoIndex],
      ...(caption !== undefined && { caption, captionSource: 'user' as const }),
      ...(location !== undefined && { location }),
      ...(trade !== undefined && { trade }),
      ...(tags !== undefined && { tags }),
    };

    photos[photoIndex] = updatedPhoto;

    // Update conversation
    await prisma.conversation.update({
      where: { id },
      data: {
        photos: photos as any,
      },
    });

    return NextResponse.json({
      success: true,
      photo: updatedPhoto,
    });
  } catch (error) {
    logger.error('Error updating photo', error);
    return NextResponse.json(
      { error: 'Failed to update photo' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string; photoId: string }> }
) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const s3Check = validateS3Config();
    if (!s3Check.valid) {
      return NextResponse.json(
        { error: 'File storage is not configured. Please contact your administrator.' },
        { status: 503 }
      );
    }

    const { id, photoId } = params;

    // Get conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (conversation.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get current photos
    const photos = (conversation.photos as unknown as PhotoMetadata[]) || [];
    const photoToDelete = photos.find((p) => p.id === photoId);

    if (!photoToDelete) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      );
    }

    // Delete from S3
    try {
      const s3Client = createS3Client();
      const { bucketName } = getBucketConfig();

      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: photoToDelete.cloud_storage_path,
        })
      );

      logger.info('Deleted from S3', { detail: photoToDelete.cloud_storage_path });
    } catch (s3Error) {
      logger.error('S3 deletion error', s3Error);
      // Continue even if S3 deletion fails
    }

    // Remove from photos array
    const updatedPhotos = photos.filter((p) => p.id !== photoId);

    // Update conversation
    await prisma.conversation.update({
      where: { id },
      data: {
        photos: updatedPhotos as any,
        photoCount: updatedPhotos.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Photo deleted successfully',
      photoCount: updatedPhotos.length,
    });
  } catch (error) {
    logger.error('Error deleting photo', error);
    return NextResponse.json(
      { error: 'Failed to delete photo' },
      { status: 500 }
    );
  }
}
