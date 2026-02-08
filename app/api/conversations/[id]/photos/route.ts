/**
 * Conversation Photos API
 * 
 * POST /api/conversations/[id]/photos
 * Upload and analyze photos for daily report chat
 * 
 * GET /api/conversations/[id]/photos
 * Retrieve all photos for a conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createS3Client, getBucketConfig, validateS3Config } from '@/lib/aws-config';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import {
  generatePhotoFileName,
  getFileExtension,
  isValidImageType,
  getImageDimensions,
  extractBasicExif,
  createPhotoMetadata,
  formatAutoCaption,
  validatePhotoCount,
  PhotoMetadata,
} from '@/lib/photo-analyzer';
import { randomUUID } from 'crypto';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Get conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        Project: true,
      },
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

    return NextResponse.json({
      photos: conversation.photos || [],
      photoCount: conversation.photoCount,
    });
  } catch (error) {
    console.error('[PHOTOS_API] Error fetching photos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch photos' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
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

    const { id } = params;

    // Get conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        Project: true,
      },
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

    // Verify this is a daily report chat
    if (conversation.conversationType !== 'daily_report') {
      return NextResponse.json(
        { error: 'Photos can only be uploaded to daily report chats' },
        { status: 400 }
      );
    }

    // Validate photo count
    const countValidation = validatePhotoCount(conversation.photoCount || 0, 1);
    if (!countValidation.valid) {
      return NextResponse.json(
        { error: countValidation.error || 'Invalid photo count' },
        { status: 400 }
      );
    }

    // Determine if this is a presigned URL confirmation (JSON) or legacy FormData upload
    const contentTypeHeader = request.headers.get('content-type') || '';
    const isPresignedConfirm = contentTypeHeader.includes('application/json');

    let cloudStoragePath: string;
    let fileName: string;
    let fileSize: number;
    let fileContentType: string;
    let userCaption: string | null = null;
    let location: string | null = null;

    if (isPresignedConfirm) {
      // Presigned URL flow: file already uploaded to R2, just confirm
      const body = await request.json();
      if (!body.cloudStoragePath || !body.fileName) {
        return NextResponse.json(
          { error: 'Missing cloudStoragePath or fileName' },
          { status: 400 }
        );
      }
      cloudStoragePath = body.cloudStoragePath;
      fileName = body.fileName;
      fileSize = body.fileSize || 0;
      fileContentType = body.contentType || 'image/jpeg';
      userCaption = body.caption || null;
      location = body.location || null;

      // Validate file type
      if (!isValidImageType(fileName)) {
        return NextResponse.json(
          { error: 'Invalid file type. Please upload a JPG, PNG, or HEIC image.' },
          { status: 400 }
        );
      }
    } else {
      // Legacy FormData flow (kept for backward compatibility)
      const formData = await request.formData();
      const file = (formData.get('file') || formData.get('photo')) as File | null;
      userCaption = formData.get('caption') as string | null;
      location = formData.get('location') as string | null;

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        );
      }

      // Validate file type
      if (!isValidImageType(file.name)) {
        return NextResponse.json(
          { error: 'Invalid file type. Please upload a JPG, PNG, or HEIC image.' },
          { status: 400 }
        );
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'File too large. Maximum size is 10MB.' },
          { status: 400 }
        );
      }

      // Read file buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Generate filename with date and sequence
      const reportDate = conversation.dailyReportDate || new Date();
      const sequence = conversation.photoSequence + 1;
      const extension = getFileExtension(file.name);
      const reportDateStr = reportDate.toISOString().split('T')[0];
      const generatedName = generatePhotoFileName(reportDateStr, sequence, extension);

      // Upload to S3
      const s3Client = createS3Client();
      const { bucketName, folderPrefix } = getBucketConfig();
      cloudStoragePath = `${folderPrefix}daily-reports/${conversation.projectId}/${id}/${generatedName}`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: cloudStoragePath,
          Body: buffer,
          ContentType: file.type,
        })
      );

      fileName = file.name;
      fileSize = file.size;
      fileContentType = file.type;
    }

    console.log('[PHOTOS_API] Photo uploaded to S3:', cloudStoragePath);

    // Create photo metadata using the flexible createPhotoMetadata function
    const photoId = randomUUID();
    const photoMetadata = createPhotoMetadata(
      photoId,
      fileName,
      fileSize,
      fileContentType,
      {
        cloudStoragePath,
        caption: userCaption,
        location: location || undefined,
      }
    );

    // Add to conversation photos array
    const currentPhotos = (conversation.photos as unknown as PhotoMetadata[]) || [];
    currentPhotos.push(photoMetadata);

    // Update conversation
    const nextSequence = conversation.photoSequence + 1;
    await prisma.conversation.update({
      where: { id },
      data: {
        photos: currentPhotos as any,
        photoCount: currentPhotos.length,
        photoSequence: nextSequence,
      },
    });

    // Default description (analysis is now on-demand via /photos/[photoId]/analyze)
    const aiDescription = userCaption || 'Construction progress photo';

    const responseMessage = userCaption 
      ? formatAutoCaption(userCaption)
      : formatAutoCaption(aiDescription);

    return NextResponse.json({
      success: true,
      photo: photoMetadata,
      photoCount: currentPhotos.length,
      message: responseMessage,
    });
  } catch (error) {
    console.error('[PHOTOS_API] Error uploading photo:', error);
    return NextResponse.json(
      { error: 'Failed to upload photo' },
      { status: 500 }
    );
  }
}
