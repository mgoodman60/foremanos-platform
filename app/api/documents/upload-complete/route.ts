import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { createS3Client, getBucketConfig, validateS3Config } from '@/lib/aws-config';
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/db';
import crypto from 'crypto';
import { requireProjectPermission } from '@/lib/project-permissions';
import { canProcessDocument, getProcessingLimits } from '@/lib/processing-limits';
import { classifyDocument } from '@/lib/document-classifier';
import { suggestDocumentCategory } from '@/lib/document-categorizer';
import { markDocumentUploaded } from '@/lib/onboarding-tracker';
import { processDocument } from '@/lib/document-processor';
import { logger } from '@/lib/logger';
import { DocumentCategory } from '@prisma/client';
import { waitUntil } from '@vercel/functions';

const VALID_CATEGORIES: readonly string[] = [
  'budget_cost', 'schedule', 'plans_drawings', 'specifications',
  'contracts', 'daily_reports', 'photos', 'other',
] as const;

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface CompleteUploadRequest {
  uploadId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  projectId: string;
  category?: string;
}

function calculateFileHash(buffer: Buffer): string {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

export async function POST(request: Request) {
  const startTime = Date.now();
  console.log('[COMPLETE] Starting chunk assembly...');

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const s3Check = validateS3Config();
    if (!s3Check.valid) {
      return NextResponse.json(
        { error: 'File storage is not configured. Please contact your administrator.' },
        { status: 503 }
      );
    }

    const body: CompleteUploadRequest = await request.json();
    const { uploadId, fileName, fileSize, totalChunks, projectId, category } = body;

    // Validate category against Prisma enum
    let validatedCategory: DocumentCategory = VALID_CATEGORIES.includes(category as string)
      ? (category as DocumentCategory)
      : DocumentCategory.other;

    if (!category || !VALID_CATEGORIES.includes(category as string)) {
      logger.warn('UPLOAD_COMPLETE', 'Category defaulted to other', { provided: category, fileName });
    }

    // Auto-categorize if category resolved to 'other'
    if (validatedCategory === DocumentCategory.other) {
      try {
        const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'pdf';
        const suggestion = await suggestDocumentCategory(fileName, fileExtension);
        if (suggestion.confidence >= 0.8) {
          logger.info('UPLOAD_COMPLETE', 'Auto-categorized document', {
            fileName,
            from: 'other',
            to: suggestion.suggestedCategory,
            confidence: suggestion.confidence,
          });
          validatedCategory = suggestion.suggestedCategory as DocumentCategory;
        }
      } catch (error) {
        logger.warn('UPLOAD_COMPLETE', 'Auto-categorization failed, keeping other', { fileName });
      }
    }

    // Verify project access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const userId = session.user.id;
    const userRole = session.user.role;

    if (userRole !== 'admin') {
      const { allowed } = await requireProjectPermission(userId, project.slug, 'upload');
      if (!allowed) {
        return NextResponse.json(
          { error: 'You do not have permission to upload documents' },
          { status: 403 }
        );
      }
    }

    // Retrieve and combine all chunks from S3
    const s3Client = createS3Client();
    const { bucketName, folderPrefix } = getBucketConfig();

    console.log(`[COMPLETE] Retrieving ${totalChunks} chunks...`);
    const chunkBuffers: Buffer[] = [];
    
    for (let i = 0; i < totalChunks; i++) {
      const chunkKey = `${folderPrefix}chunks/${uploadId}/${i}`;
      try {
        const response = await s3Client.send(new GetObjectCommand({
          Bucket: bucketName,
          Key: chunkKey,
        }));
        
        const chunkData = await response.Body?.transformToByteArray();
        if (chunkData) {
          chunkBuffers.push(Buffer.from(chunkData));
        }
      } catch (error) {
        console.error(`[COMPLETE ERROR] Failed to retrieve chunk ${i}:`, error);
        throw new Error(`Failed to retrieve chunk ${i}`);
      }
    }

    // Combine all chunks
    console.log('[COMPLETE] Combining chunks...');
    const completeBuffer = Buffer.concat(chunkBuffers);
    console.log(`[COMPLETE] File assembled: ${(completeBuffer.length / 1024 / 1024).toFixed(2)}MB`);

    // Verify file size matches
    if (completeBuffer.length !== fileSize) {
      throw new Error(`File size mismatch: expected ${fileSize}, got ${completeBuffer.length}`);
    }

    // Calculate file hash for duplicate detection
    const fileHash = calculateFileHash(completeBuffer);
    
    // Check for duplicates using oneDriveHash field
    const existingDoc = await prisma.document.findFirst({
      where: {
        projectId,
        oneDriveHash: fileHash,
      },
    });

    if (existingDoc) {
      // Clean up chunks
      await cleanupChunks(s3Client, bucketName, folderPrefix, uploadId, totalChunks);
      
      return NextResponse.json(
        { error: 'This document has already been uploaded to this project' },
        { status: 409 }
      );
    }

    // Upload complete file to S3
    const s3Key = `${folderPrefix}uploads/${Date.now()}-${fileName}`;
    
    console.log('[COMPLETE] Uploading complete file to S3...');
    const fileExt = fileName.split('.').pop()?.toLowerCase() || 'pdf';
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: completeBuffer,
      ContentType: fileExt === 'pdf' ? 'application/pdf' : 'application/octet-stream',
    }));

    // Clean up temporary chunks
    await cleanupChunks(s3Client, bucketName, folderPrefix, uploadId, totalChunks);

    // Check processing quota
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        subscriptionTier: true,
        pagesProcessedThisMonth: true,
        processingResetAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const estimatedPages = 50; // Assume 50 pages max for quota check
    const canProcessResult = await canProcessDocument(
      user.id,
      estimatedPages
    );

    // Classify document to determine processor type
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'pdf';
    const classification = await classifyDocument(fileName, fileExtension, completeBuffer);

    // Create document record
    const document = await prisma.document.create({
      data: {
        name: fileName,
        fileName: fileName,
        fileType: fileExtension,
        cloud_storage_path: s3Key,
        isPublic: false,
        oneDriveHash: fileHash,
        fileSize: fileSize,
        syncSource: 'manual_upload',
        projectId,
        category: validatedCategory,
        processed: false,
        processorType: classification.processorType,
        tags: [],
        accessLevel: 'admin',
      },
    });

    const uploadTime = Date.now() - startTime;
    console.log(`[COMPLETE] Upload completed in ${uploadTime}ms`);

    // Track onboarding progress - document uploaded
    try {
      await markDocumentUploaded(session.user.id, projectId);
    } catch (error) {
      // Silently fail - don't block upload
      console.error('Failed to track onboarding progress:', error);
    }

    // Trigger document processing if allowed
    if (canProcessResult.allowed) {
      console.log(`[COMPLETE] Starting document processing for ${document.id}...`);
      waitUntil(
        processDocument(document.id, classification)
          .then(() => {
            console.log(`[COMPLETE] ✅ Processing completed for document ${document.id}`);
          })
          .catch(async (error) => {
            console.error(`[COMPLETE ERROR] ❌ Processing failed for document ${document.id}:`, error);

            // Mark document as failed
            await prisma.document.update({
              where: { id: document.id },
              data: {
                queueStatus: 'failed',
                lastProcessingError: error.message || 'Processing initialization failed',
              },
            }).catch((updateError: any) => {
              console.error('[COMPLETE ERROR] Failed to update document status:', updateError);
            });
          })
      );
    } else {
      console.log(`[COMPLETE] Document ${document.id} not processed - quota exceeded`);
    }

    return NextResponse.json({
      success: true,
      Document: {
        id: document.id,
        name: document.name,
        tags: document.tags,
      },
      uploadTime,
      canProcess: canProcessResult.allowed,
      message: canProcessResult.allowed
        ? 'Document uploaded successfully and will be processed'
        : 'Document uploaded but quota exceeded - document will not be processed',
    });
  } catch (error: any) {
    const s3Meta = error.$metadata;
    logger.error('UPLOAD_COMPLETE', 'Failed to complete upload', error, {
      errorCode: error.Code || error.name,
      httpStatus: s3Meta?.httpStatusCode,
      requestId: s3Meta?.requestId,
    });

    let statusCode = 500;
    let errorMessage = 'Failed to complete upload';

    if (error.name === 'InvalidAccessKeyId' || error.name === 'SignatureDoesNotMatch' || error.name === 'AccessDenied' || error.$metadata?.httpStatusCode === 403) {
      errorMessage = 'Storage authentication failed. Please contact your administrator.';
      statusCode = 503;
    }

    return NextResponse.json(
      { error: errorMessage, details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: statusCode }
    );
  }
}

async function cleanupChunks(
  s3Client: any,
  bucketName: string,
  folderPrefix: string,
  uploadId: string,
  totalChunks: number
) {
  console.log(`[CLEANUP] Removing ${totalChunks} temporary chunks...`);
  for (let i = 0; i < totalChunks; i++) {
    const chunkKey = `${folderPrefix}chunks/${uploadId}/${i}`;
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: bucketName,
        Key: chunkKey,
      }));
    } catch (error) {
      console.error(`[CLEANUP] Failed to delete chunk ${i}:`, error);
    }
  }
  console.log('[CLEANUP] Cleanup complete');
}
