import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { downloadFile, deleteFile } from '@/lib/s3';
import { requireProjectPermission } from '@/lib/project-permissions';
import { getDocumentMetadata } from '@/lib/document-processor';
import { calculateFileHash, isDuplicate } from '@/lib/duplicate-detector';
import { sendDocumentUploadNotification } from '@/lib/email-service';
import { canProcessDocument, getRemainingPages, shouldResetQuota, getNextResetDate } from '@/lib/processing-limits';
import { withDatabaseRetry } from '@/lib/retry-util';
import { markDocumentUploaded } from '@/lib/onboarding-tracker';
import { scanFileBuffer, logSecurityEvent } from '@/lib/virus-scanner';
import { createS3Client, getBucketConfig, validateS3Config } from '@/lib/aws-config';
import { shouldBlockMacroFile } from '@/lib/macro-detector';
import { logger } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS, getClientIp, getRateLimitIdentifier } from '@/lib/rate-limiter';
import { DocumentCategory } from '@prisma/client';
import { tasks } from '@trigger.dev/sdk/v3';
import type { processDocumentTask } from '@/src/trigger/process-document';
import { z } from 'zod';

const VALID_CATEGORIES: readonly string[] = [
  'budget_cost', 'schedule', 'plans_drawings', 'specifications',
  'contracts', 'daily_reports', 'photos', 'other',
] as const;

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for security scanning

const confirmUploadSchema = z.object({
  cloudStoragePath: z.string().min(1, 'Cloud storage path is required'),
  fileName: z.string().min(1, 'File name is required').max(500, 'File name too long'),
  fileSize: z.number().int().positive('File size must be positive'),
  projectId: z.string().min(1, 'Project ID is required'),
  category: z.string().optional().default('other'),
});

/**
 * Validate that a cloud storage path is safe (no path traversal or absolute paths).
 */
function isValidCloudStoragePath(path: string): boolean {
  if (!path || typeof path !== 'string' || path.trim().length === 0) {
    return false;
  }
  // Block path traversal
  if (path.includes('..') || path.includes('\\')) {
    return false;
  }
  // Block absolute paths (Unix or Windows style)
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) {
    return false;
  }
  // Block null bytes
  if (path.includes('\0')) {
    return false;
  }
  return true;
}

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    // 1. Auth check
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1b. Rate limit
    const rateLimitId = getRateLimitIdentifier(session.user.id, getClientIp(request));
    const rateLimitResult = await checkRateLimit(rateLimitId, RATE_LIMITS.UPLOAD);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // 2. Validate request body
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body. Expected JSON.' },
        { status: 400 }
      );
    }

    const parsed = confirmUploadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { cloudStoragePath, fileName, fileSize: _fileSize, projectId, category } = parsed.data;

    // Validate category against Prisma enum
    const validatedCategory: DocumentCategory = VALID_CATEGORIES.includes(category)
      ? (category as DocumentCategory)
      : DocumentCategory.other;

    if (!VALID_CATEGORIES.includes(category)) {
      logger.warn('CONFIRM_UPLOAD', 'Category defaulted to other', { provided: category, fileName });
    }

    if (!isValidCloudStoragePath(cloudStoragePath)) {
      return NextResponse.json(
        { error: 'Invalid cloud storage path' },
        { status: 400 }
      );
    }

    // Check S3 configuration
    const { bucketName } = getBucketConfig();
    if (!bucketName) {
      return NextResponse.json(
        { error: 'Document storage is not configured. Please contact your administrator to set up file storage.' },
        { status: 503 }
      );
    }

    const s3Validation = validateS3Config();
    if (!s3Validation.valid) {
      return NextResponse.json(
        {
          error: 'Document storage credentials are not fully configured. Please contact your administrator.',
          details: process.env.NODE_ENV === 'development' ? { missing: s3Validation.missing } : undefined
        },
        { status: 503 }
      );
    }

    // Verify project exists and get slug
    const project = await withDatabaseRetry(
      () => prisma.project.findUnique({
        where: { id: projectId },
      }),
      'Find project for confirm-upload'
    ) as any;

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const userId = session.user.id;
    const userRole = session.user.role;

    // Check upload permission (admins bypass, others need owner/editor role)
    if (userRole !== 'admin') {
      const { allowed, access } = await requireProjectPermission(userId, project.slug, 'upload');

      if (!allowed) {
        return NextResponse.json(
          {
            error: 'You do not have permission to upload documents. Only project owners and editors can upload.',
            yourRole: access.role
          },
          { status: 403 }
        );
      }
    }

    // 3. Verify file exists in R2
    logger.info('CONFIRM_UPLOAD', 'Verifying file exists in storage', { cloudStoragePath });
    try {
      const s3Client = createS3Client();
      await s3Client.send(new HeadObjectCommand({ Bucket: bucketName, Key: cloudStoragePath }));
    } catch (headError: any) {
      logger.error('CONFIRM_UPLOAD', 'File not found in storage', headError, { cloudStoragePath });
      return NextResponse.json(
        { error: 'Uploaded file not found in storage' },
        { status: 404 }
      );
    }

    // 4. Download file from R2 for security scanning
    logger.info('CONFIRM_UPLOAD', 'Downloading file for security scanning', { cloudStoragePath });
    let buffer: Buffer;
    try {
      buffer = await downloadFile(cloudStoragePath);
    } catch (downloadError: any) {
      logger.error('CONFIRM_UPLOAD', 'Failed to download file for scanning', downloadError, { cloudStoragePath });
      return NextResponse.json(
        { error: 'Failed to retrieve uploaded file for security scanning' },
        { status: 500 }
      );
    }

    const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'pdf';

    // 5. Virus scan
    logger.info('CONFIRM_UPLOAD', 'Scanning for viruses', { fileName });
    let virusStatus = 'skipped';
    let virusScanProvider = null;
    try {
      const scanResult = await scanFileBuffer(buffer, fileName, {
        timeout: 30000,
        skipIfMissingKey: true,
      });

      if (!scanResult.clean) {
        virusStatus = 'infected';
        virusScanProvider = scanResult.engine;

        await logSecurityEvent('VIRUS_DETECTED', {
          fileName,
          threat: scanResult.threat,
          projectId,
          userId,
        });

        // Delete the infected file from R2
        logger.warn('CONFIRM_UPLOAD', 'Virus detected, deleting file', { fileName, threat: scanResult.threat });
        await deleteFile(cloudStoragePath).catch((err) =>
          logger.error('CONFIRM_UPLOAD', 'Failed to delete infected file', err, { cloudStoragePath })
        );

        return NextResponse.json(
          {
            error: 'File rejected: security threat detected',
            threat: scanResult.threat,
            message: 'The uploaded file was flagged as potentially malicious and has been blocked.',
          },
          { status: 451 }
        );
      }

      virusStatus = 'clean';
      virusScanProvider = scanResult.engine;
    } catch (scanError: any) {
      logger.error('CONFIRM_UPLOAD', 'Virus scan error (non-blocking)', scanError);
      virusStatus = 'error';
    }

    // 6. Macro detection for Office documents
    logger.info('CONFIRM_UPLOAD', 'Checking for embedded macros', { fileName });
    try {
      const macroCheck = await shouldBlockMacroFile(buffer, fileName);
      if (macroCheck.blocked) {
        await logSecurityEvent('MACRO_BLOCKED', {
          fileName,
          reason: macroCheck.reason,
          projectId,
          userId,
        });

        // Delete the file with macros from R2
        logger.warn('CONFIRM_UPLOAD', 'Macros detected, deleting file', { fileName, reason: macroCheck.reason });
        await deleteFile(cloudStoragePath).catch((err) =>
          logger.error('CONFIRM_UPLOAD', 'Failed to delete macro file', err, { cloudStoragePath })
        );

        return NextResponse.json(
          {
            error: 'File rejected: macros detected',
            message: macroCheck.reason,
          },
          { status: 415 }
        );
      }
    } catch (macroError: any) {
      logger.error('CONFIRM_UPLOAD', 'Macro detection error (non-blocking)', macroError);
    }

    // 7. File hash + duplicate check
    logger.info('CONFIRM_UPLOAD', 'Calculating file hash and checking duplicates');
    const fileHash = calculateFileHash(buffer);
    const hasDuplicate = await isDuplicate(projectId, fileName, buffer.length, fileHash);

    if (hasDuplicate) {
      // Delete the duplicate file from R2
      logger.warn('CONFIRM_UPLOAD', 'Duplicate detected, deleting file', { fileName });
      await deleteFile(cloudStoragePath).catch((err) =>
        logger.error('CONFIRM_UPLOAD', 'Failed to delete duplicate file', err, { cloudStoragePath })
      );

      return NextResponse.json(
        {
          error: 'Duplicate document detected',
          message: 'A document with the same name and content already exists in this project.',
        },
        { status: 409 }
      );
    }

    // 8. Quota check
    let user: any = await withDatabaseRetry(
      () => prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          subscriptionTier: true,
          pagesProcessedThisMonth: true,
          processingResetAt: true,
        },
      }),
      'Find user for quota checking'
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if quota needs to be reset before validation
    if (await shouldResetQuota(user)) {
      logger.info('CONFIRM_UPLOAD', `Resetting quota for user ${userId}`, { was: user.pagesProcessedThisMonth });

      await withDatabaseRetry(
        () => prisma.user.update({
          where: { id: userId },
          data: {
            pagesProcessedThisMonth: 0,
            processingResetAt: getNextResetDate(),
          },
        }),
        'Reset user quota'
      );

      user = {
        ...user,
        pagesProcessedThisMonth: 0,
        processingResetAt: getNextResetDate(),
      };
    }

    // Get page count and classification
    logger.info('CONFIRM_UPLOAD', 'Getting document metadata', { fileName, fileExtension });
    const { totalPages, processorType } = await getDocumentMetadata(buffer, fileName, fileExtension);
    logger.info('CONFIRM_UPLOAD', 'Document metadata retrieved', { totalPages, processorType });

    // Check if user can process this document
    const { allowed, reason } = await canProcessDocument(user.id, totalPages);

    if (!allowed) {
      const remainingPages = await getRemainingPages(user.pagesProcessedThisMonth, user.subscriptionTier);
      return NextResponse.json(
        {
          error: 'Processing quota exceeded',
          message: reason,
          remainingPages,
          tier: user.subscriptionTier,
          classification: processorType,
        },
        { status: 403 }
      );
    }

    // 9. Create Document record
    logger.info('CONFIRM_UPLOAD', 'Creating document record', { fileName, projectId });
    const document: any = await withDatabaseRetry(
      () => prisma.document.create({
        data: {
          name: fileName.replace(/\.(pdf|docx?)$/i, ''),
          fileName,
          fileType: fileExtension,
          projectId,
          accessLevel: 'guest',
          category: validatedCategory,
          cloud_storage_path: cloudStoragePath,
          isPublic: false,
          fileSize: buffer.length,
          oneDriveHash: fileHash,
          syncSource: 'manual_upload',
          processed: false,
          processorType: processorType,
          pagesProcessed: 0,
          processingCost: 0,
          queueStatus: 'pending',
          virusStatus,
          virusScanAt: new Date(),
          virusScanProvider,
        },
      }),
      'Create document record'
    );

    // 10. Trigger async processing via Trigger.dev
    logger.info('CONFIRM_UPLOAD', 'Triggering Trigger.dev task', { documentId: document.id, totalPages, processorType });
    try {
      const handle = await tasks.trigger<typeof processDocumentTask>('process-document', {
        documentId: document.id,
        totalPages,
        processorType,
      });
      logger.info('CONFIRM_UPLOAD', 'Trigger.dev task triggered', { documentId: document.id, runId: handle.id });
    } catch (triggerError) {
      logger.error('CONFIRM_UPLOAD', 'Failed to trigger Trigger.dev task', triggerError);
      // Mark document as failed
      await withDatabaseRetry(
        () => prisma.document.update({
          where: { id: document.id },
          data: {
            queueStatus: 'failed',
            processed: false,
            lastProcessingError: 'Failed to start processing task',
          },
        }),
        'Mark document as failed after trigger error'
      );
      throw triggerError;
    }

    // 11. Send notifications (async, don't wait)
    sendDocumentUploadNotification(
      projectId,
      document.name,
      session.user.username || session.user?.email || 'A user'
    ).catch(error => {
      logger.error('CONFIRM_UPLOAD', 'Error sending document upload notification', error);
    });

    markDocumentUploaded(userId, projectId).catch(error => {
      logger.error('CONFIRM_UPLOAD', 'Error tracking onboarding progress', error);
    });

    // 12. Return response
    const updatedRemainingPages = getRemainingPages(user.pagesProcessedThisMonth, user.subscriptionTier);
    const totalTime = Date.now() - startTime;
    logger.info('CONFIRM_UPLOAD', `Completed in ${totalTime}ms`, { documentId: document.id });

    return NextResponse.json(
      {
        Document: {
          id: document.id,
          name: document.name,
          fileName: document.fileName,
        },
        message: 'Document uploaded successfully. Processing in background...',
        processingInfo: {
          estimatedPages: totalPages,
          processorType: processorType,
          remainingPages: updatedRemainingPages,
          tier: user.subscriptionTier,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    const s3Meta = error.$metadata;
    logger.error('CONFIRM_UPLOAD', `Failed after ${totalTime}ms`, error, {
      errorName: error.name,
      errorCode: error.code || error.Code,
      httpStatus: s3Meta?.httpStatusCode || error.httpStatus,
      requestId: s3Meta?.requestId,
      attempts: error.attempts,
    });

    const isTimeout = error.isTimeout
      || error.message?.includes('timeout')
      || error.message?.includes('timed out')
      || error.code === 'ETIMEDOUT';
    const isAuthError = error.isAuthError
      || error.name === 'InvalidAccessKeyId'
      || error.name === 'SignatureDoesNotMatch'
      || error.name === 'AccessDenied'
      || error.$metadata?.httpStatusCode === 403;
    const isNetworkError = error.code === 'ECONNRESET'
      || error.code === 'ECONNREFUSED'
      || error.code === 'ENOTFOUND'
      || error.message?.includes('network')
      || error.message?.includes('ECONNREFUSED');
    const isDbError = error.message?.includes('Prisma')
      || error.message?.includes('database');
    const isS3Error = error.message?.includes('S3')
      || error.message?.includes('upload')
      || error.code === 'NoSuchBucket'
      || !!error.httpStatus
      || !!s3Meta;

    let errorMessage: string;
    let errorCode: string;
    let statusCode: number;
    let retryAdvice: string;

    if (isAuthError) {
      errorCode = 'S3_AUTH_ERROR';
      errorMessage = 'Storage authentication failed. Please contact your administrator to verify storage credentials.';
      statusCode = 503;
      retryAdvice = 'Contact your administrator — storage credentials may need updating.';
    } else if (isTimeout) {
      errorCode = 'S3_TIMEOUT';
      errorMessage = 'Operation timed out. Please try again.';
      statusCode = 504;
      retryAdvice = 'Please try again in a few moments.';
    } else if (isDbError) {
      errorCode = 'DB_ERROR';
      errorMessage = 'Database error while saving document. Please try again.';
      statusCode = 503;
      retryAdvice = 'A temporary database error occurred. Please try again in a few moments.';
    } else if (isNetworkError) {
      errorCode = 'NETWORK_ERROR';
      errorMessage = 'Network connection error. Please check your internet connection and try again.';
      statusCode = 503;
      retryAdvice = 'Check your internet connection and try again.';
    } else if (isS3Error) {
      errorCode = 'S3_ERROR';
      errorMessage = 'Storage operation failed. Please try again.';
      statusCode = 503;
      retryAdvice = 'If the issue persists, contact support.';
    } else {
      errorCode = 'CONFIRM_UPLOAD_ERROR';
      errorMessage = 'Upload confirmation failed. Please try again.';
      statusCode = 500;
      retryAdvice = 'If the issue persists, contact support.';
    }

    const technicalDetails: Record<string, string | number | undefined> = {
      errorCode: error.code || error.Code || error.name || undefined,
      httpStatus: s3Meta?.httpStatusCode || error.httpStatus || undefined,
      attempts: error.attempts || undefined,
    };
    for (const key of Object.keys(technicalDetails)) {
      if (technicalDetails[key] === undefined) delete technicalDetails[key];
    }

    return NextResponse.json({
      error: errorMessage,
      errorCode,
      technicalDetails: Object.keys(technicalDetails).length > 0 ? technicalDetails : undefined,
      processingTime: `${totalTime}ms`,
      retryAdvice,
    }, { status: statusCode });
  }
}
