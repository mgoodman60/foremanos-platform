/**
 * Bulk Photo Upload API
 * 
 * POST /api/conversations/[id]/photos-bulk
 * Upload multiple photos at once for daily report chat
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
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
  validatePhotoCount,
  PhotoMetadata,
} from '@/lib/photo-analyzer';
import { randomUUID } from 'crypto';
import { createLogger } from '@/lib/logger';
const logger = createLogger('CONVERSATIONS_PHOTOS_BULK');

interface BulkUploadResult {
  success: boolean;
  uploaded: PhotoMetadata[];
  failed: Array<{ fileName: string; error: string }>;
  totalCount: number;
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
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

    // Parse form data
    const formData = await request.formData();
    const files: File[] = [];
    
    // Collect all files
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file') && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Validate total photo count
    const currentCount = conversation.photoCount;
    const countValidation = validatePhotoCount(currentCount, files.length);
    if (!countValidation.valid) {
      return NextResponse.json(
        { error: countValidation.error || 'Photo limit exceeded' },
        { status: 400 }
      );
    }

    // Process photos
    const result: BulkUploadResult = {
      success: true,
      uploaded: [],
      failed: [],
      totalCount: 0,
    };

    const currentPhotos = (conversation.photos as unknown as PhotoMetadata[]) || [];
    let sequence = conversation.photoSequence;
    const reportDate = conversation.dailyReportDate || new Date();
    const s3Client = createS3Client();
    const { bucketName, folderPrefix } = getBucketConfig();

    // Process each file
    for (const file of files) {
      try {
        // Validate file type
        if (!isValidImageType(file.name)) {
          result.failed.push({
            fileName: file.name,
            error: 'Invalid file type',
          });
          continue;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          result.failed.push({
            fileName: file.name,
            error: 'File too large (max 10MB)',
          });
          continue;
        }

        // Read file buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Extract image dimensions
        const dimensions = await getImageDimensions(buffer);

        // Extract EXIF metadata
        const exif = await extractBasicExif(buffer);

        // Generate filename
        sequence++;
        const extension = getFileExtension(file.name);
        const reportDateStr = reportDate.toISOString().split('T')[0];
        const fileName = generatePhotoFileName(reportDateStr, sequence, extension);

        // Upload to S3
        const cloudStoragePath = `${folderPrefix}daily-reports/${conversation.projectId}/${id}/${fileName}`;

        await s3Client.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: cloudStoragePath,
            Body: buffer,
            ContentType: file.type,
          })
        );

        logger.info('Uploaded to S3', { cloudStoragePath });

        // Create photo metadata
        const photoId = randomUUID();
        const photoMetadata = createPhotoMetadata(
          photoId,
          file.name,
          file.size,
          file.type,
          {
            cloudStoragePath,
            dimensions: dimensions || undefined,
            exif: exif || undefined,
          }
        );

        currentPhotos.push(photoMetadata);
        result.uploaded.push(photoMetadata);
      } catch (error) {
        logger.error('Error processing file', error, { fileName: file.name });
        result.failed.push({
          fileName: file.name,
          error: 'Processing failed',
        });
      }
    }

    // Update conversation
    if (result.uploaded.length > 0) {
      await prisma.conversation.update({
        where: { id },
        data: {
          photos: currentPhotos as any,
          photoCount: currentPhotos.length,
          photoSequence: sequence,
        },
      });
    }

    result.totalCount = currentPhotos.length;

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error uploading photos', error);
    return NextResponse.json(
      { error: 'Failed to upload photos' },
      { status: 500 }
    );
  }
}
