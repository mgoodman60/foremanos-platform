import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { uploadFile } from '@/lib/s3';
import { requireProjectPermission } from '@/lib/project-permissions';
import { processDocument } from '@/lib/document-processor';
import { calculateFileHash, isDuplicate } from '@/lib/duplicate-detector';
import { sendDocumentUploadNotification } from '@/lib/email-service';
import { classifyDocument } from '@/lib/document-classifier';
import { canProcessDocument, getRemainingPages, shouldResetQuota, getNextResetDate } from '@/lib/processing-limits';
import { withDatabaseRetry } from '@/lib/retry-util';
import { markDocumentUploaded } from '@/lib/onboarding-tracker';
import { checkRateLimit, getClientIp, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { scanFileBuffer, logSecurityEvent } from '@/lib/virus-scanner';
import { getBucketConfig, validateS3Config } from '@/lib/aws-config';
import { shouldBlockMacroFile } from '@/lib/macro-detector';
import { createLogger } from '@/lib/logger';

const logger = createLogger('DOCUMENTS_UPLOAD');

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max for upload

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];

export async function POST(request: Request) {
  const startTime = Date.now();
  logger.info('[UPLOAD START]', { detail: new Date().toISOString() });

  try {
    const ip = getClientIp(request);
    const rateLimitResult = await checkRateLimit(ip, RATE_LIMITS.UPLOAD);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many upload attempts. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Parsing form data...');
    let formData: FormData;
    try {
      formData = await request.formData();
      logger.info('Form data parsed successfully');
    } catch (error: unknown) {
      logger.error('[UPLOAD ERROR] Failed to parse form data', error);
      return NextResponse.json(
        { error: 'Failed to read upload data. Connection may have timed out.' },
        { status: 400 }
      );
    }
    
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const category = formData.get('category') as string || 'other';

    if (!file || !projectId) {
      return NextResponse.json(
        { error: 'File and project ID are required' },
        { status: 400 }
      );
    }

    // Check S3 configuration before attempting upload
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

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 415 });
    }

    // Verify project exists and get slug
    const project = await withDatabaseRetry(
      () => prisma.project.findUnique({
        where: { id: projectId },
      }),
      'Find project for upload'
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

    // Get file data
    const fileName = file.name;
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'pdf';
    const fileSize = file.size;
    logger.info('Reading file data', { fileName, expectedSizeMB: (fileSize / 1024 / 1024).toFixed(2) });
    
    // Check file size before reading
    if (fileSize > 209715200) { // 200MB
      return NextResponse.json(
        { error: 'File too large. Maximum size is 200MB.' },
        { status: 413 }
      );
    }
    
    let buffer: Buffer;
    try {
      logger.info('Converting file to buffer...');
      const bytes = await file.arrayBuffer();
      buffer = Buffer.from(bytes);
      logger.info('Buffer created successfully', { sizeMB: (buffer.length / 1024 / 1024).toFixed(2) });
    } catch (error: unknown) {
      logger.error('[UPLOAD ERROR] Failed to read file', error);
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Virus scan (before expensive operations like S3 upload)
    logger.info('Scanning for viruses...');
    const scanStartTime = Date.now();
    let virusStatus = 'skipped';
    let virusScanProvider = null;
    try {
      const scanResult = await scanFileBuffer(buffer, fileName, {
        timeout: 30000,
        skipIfMissingKey: true, // Graceful degradation
      });

      const scanTime = Date.now() - scanStartTime;
      logger.info('Virus scan completed', { scanTime, clean: scanResult.clean });

      if (!scanResult.clean) {
        virusStatus = 'infected';
        virusScanProvider = scanResult.engine;

        await logSecurityEvent('VIRUS_DETECTED', {
          fileName,
          threat: scanResult.threat,
          projectId,
          userId,
        });

        return NextResponse.json(
          {
            error: 'File rejected: security threat detected',
            threat: scanResult.threat,
            message: 'The uploaded file was flagged as potentially malicious and has been blocked.',
          },
          { status: 451 } // Unavailable For Legal Reasons
        );
      }

      virusStatus = 'clean';
      virusScanProvider = scanResult.engine;
    } catch (scanError: unknown) {
      logger.error('Virus scan error (non-blocking)', scanError);
      virusStatus = 'error';
      // Continue with upload - graceful degradation
    }

    // Macro detection for Office documents
    logger.info('Checking for embedded macros...');
    try {
      const macroCheck = await shouldBlockMacroFile(buffer, fileName);
      if (macroCheck.blocked) {
        await logSecurityEvent('MACRO_BLOCKED', {
          fileName,
          reason: macroCheck.reason,
          projectId,
          userId,
        });

        return NextResponse.json(
          {
            error: 'File rejected: macros detected',
            message: macroCheck.reason,
          },
          { status: 415 }
        );
      }
      logger.info('No macros detected');
    } catch (macroError: unknown) {
      logger.error('Macro detection error (non-blocking)', macroError);
      // Continue with upload - graceful degradation
    }

    // Calculate file hash for duplicate detection
    logger.info('Calculating file hash...');
    const fileHash = calculateFileHash(buffer);

    // Check for duplicates
    logger.info('Checking for duplicates...');
    const hasDuplicate = await isDuplicate(projectId, fileName, buffer.length, fileHash);

    if (hasDuplicate) {
      return NextResponse.json(
        {
          error: 'Duplicate document detected',
          message: 'A document with the same name and content already exists in this project.',
        },
        { status: 409 } // Conflict status code
      );
    }

    // Get user subscription info for quota checking
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

    // CRITICAL FIX: Check if quota needs to be reset before validation
    if (await shouldResetQuota(user)) {
      logger.info('[QUOTA RESET] Resetting quota for user', { userId, previousPages: user.pagesProcessedThisMonth });
      
      // Reset quota and update reset date
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

      // Update local user object
      user = {
        ...user,
        pagesProcessedThisMonth: 0,
        processingResetAt: getNextResetDate(),
      };
      
      logger.info('[QUOTA RESET] User quota reset to 0', { userId, nextReset: user.processingResetAt });
    }

    // Classify document to estimate pages
    const classification = await classifyDocument(fileName, fileExtension);
    const estimatedPages = Math.ceil(buffer.length / (100 * 1024)); // Rough estimate: 100KB per page

    // Check if user can process this document (after quota reset if needed)
    // Admins have unlimited access - they bypass all quota checks
    const { allowed, reason } = await canProcessDocument(
      user.id,
      estimatedPages
    );

    if (!allowed) {
      const remainingPages = await getRemainingPages(user.pagesProcessedThisMonth, user.subscriptionTier);
      return NextResponse.json(
        {
          error: 'Processing quota exceeded',
          message: reason,
          remainingPages,
          tier: user.subscriptionTier,
          classification: classification.processorType,
        },
        { status: 403 }
      );
    }

    // Determine if file should be public or private
    // For construction documents, most should be private (signed URLs)
    // Only marketing materials or publicly shared docs should be public
    const isPublic = false; // Default to private for construction documents

    // Upload to S3
    logger.info('Uploading to S3...');
    const s3UploadStart = Date.now();
    const cloud_storage_path = await uploadFile(buffer, fileName, isPublic);
    const s3UploadTime = Date.now() - s3UploadStart;
    logger.info('S3 upload completed', { durationMs: s3UploadTime, path: cloud_storage_path });

    // Create document record with cloud storage path and processor info
    logger.info('Creating database record...');
    const document: any = await withDatabaseRetry(
      () => prisma.document.create({
        data: {
          name: fileName.replace(/\.(pdf|docx?)$/i, ''),
          fileName: fileName,
          fileType: fileExtension,
          projectId: projectId,
          accessLevel: 'guest', // Default to guest-accessible
          category: category as any, // User-selected or AI-suggested category
          cloud_storage_path: cloud_storage_path,
          isPublic: isPublic,
          fileSize: buffer.length,
          oneDriveHash: fileHash, // Store hash for duplicate detection
          syncSource: 'manual_upload',
          processed: false,
          processorType: classification.processorType, // Store processor type
          pagesProcessed: 0, // Will be updated after processing
          processingCost: 0, // Will be updated after processing
          virusStatus: virusStatus, // Virus scan result
          virusScanAt: new Date(),
          virusScanProvider: virusScanProvider,
        },
      }),
      'Create document record'
    );

    // Trigger vision processing asynchronously with classification info
    logger.info('Triggering async document processing...');
    processDocument(document.id, classification)
      .then(() => {
        logger.info('Processing started successfully for document', { documentId: document.id });
      })
      .catch(async (error) => {
        logger.error('[UPLOAD ERROR] Processing failed for document', error, { documentId: document.id });
        
        // Update document with error status and message
        try {
          await withDatabaseRetry(
            () => prisma.document.update({
              where: { id: document.id },
              data: {
                queueStatus: 'failed',
                processed: false, // Mark as not processed
                lastProcessingError: error?.message || String(error),
                processingRetries: 0, // Reset retry count
              },
            }),
            'Mark document as failed'
          );
          logger.error('[UPLOAD ERROR] Marked document as failed in database', undefined, { documentId: document.id });
        } catch (updateError) {
          logger.error('[UPLOAD ERROR] Failed to update document status', updateError);
        }
      });

    // Send document upload notification to project owner (async, don't wait)
    sendDocumentUploadNotification(
      projectId,
      document.name,
      session.user.username || session.user?.email || 'A user'
    ).catch(error => {
      logger.error('[UPLOAD ERROR] Error sending document upload notification', error);
    });

    // Track first document upload for onboarding (async, don't wait)
    markDocumentUploaded(userId, projectId).catch(error => {
      logger.error('Error tracking onboarding progress', error);
    });

    // Get updated remaining pages after queuing for processing (estimate minus the document)
    const updatedRemainingPages = getRemainingPages(user.pagesProcessedThisMonth, user.subscriptionTier);

    const totalTime = Date.now() - startTime;
    logger.info('[UPLOAD COMPLETE] Upload finished', { totalTimeMs: totalTime, documentId: document.id });

    return NextResponse.json(
      {
        Document: {
          id: document.id,
          name: document.name,
          fileName: document.fileName,
        },
        message: 'Document uploaded successfully. Processing in background...',
        processingInfo: {
          estimatedPages,
          processorType: classification.processorType,
          remainingPages: updatedRemainingPages,
          tier: user.subscriptionTier,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const totalTime = Date.now() - startTime;
    const err = error as Record<string, any>;
    const s3Meta = err.$metadata;
    const errMessage = error instanceof Error ? error.message : String(error);
    const errName = error instanceof Error ? error.name : String(error);
    logger.error(`Failed after ${totalTime}ms`, error, {
      errorName: errName,
      errorCode: err.code || err.Code,
      httpStatus: s3Meta?.httpStatusCode || err.httpStatus,
      requestId: s3Meta?.requestId,
      attempts: err.attempts,
    });

    // Classify the error using structured S3 properties (from Task #1) or fallback heuristics
    const isTimeout = err.isTimeout
      || errMessage?.includes('timeout')
      || errMessage?.includes('timed out')
      || err.code === 'ETIMEDOUT';
    const isAuthError = err.isAuthError
      || errName === 'InvalidAccessKeyId'
      || errName === 'SignatureDoesNotMatch'
      || errName === 'AccessDenied'
      || s3Meta?.httpStatusCode === 403;
    const isNetworkError = err.code === 'ECONNRESET'
      || err.code === 'ECONNREFUSED'
      || err.code === 'ENOTFOUND'
      || errMessage?.includes('network')
      || errMessage?.includes('ECONNREFUSED');
    const isDbError = errMessage?.includes('Prisma')
      || errMessage?.includes('database');
    const isS3Error = errMessage?.includes('S3')
      || errMessage?.includes('upload')
      || err.code === 'NoSuchBucket'
      || !!err.httpStatus
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
      errorMessage = 'Upload timed out. The file may be too large or the connection is slow.';
      statusCode = 504;
      retryAdvice = 'The file may be too large or the connection is slow. Try again or use a smaller file.';
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
      errorMessage = 'Storage upload failed. Please check your network connection and try again.';
      statusCode = 503;
      retryAdvice = 'If the issue persists, try uploading a smaller file or contact support.';
    } else {
      errorCode = 'UPLOAD_ERROR';
      errorMessage = 'Upload failed. Please try again.';
      statusCode = 500;
      retryAdvice = 'If the issue persists, try uploading a smaller file or contact support.';
    }

    // Build sanitized technical details safe for production (no stack traces or internal paths)
    const technicalDetails: Record<string, string | number | undefined> = {
      errorCode: err.code || err.Code || errName || undefined,
      httpStatus: s3Meta?.httpStatusCode || err.httpStatus || undefined,
      attempts: err.attempts || undefined,
    };
    // Remove undefined keys
    for (const key of Object.keys(technicalDetails)) {
      if (technicalDetails[key] === undefined) delete technicalDetails[key];
    }

    return NextResponse.json({
      error: errorMessage,
      errorCode,
      technicalDetails: Object.keys(technicalDetails).length > 0 ? technicalDetails : undefined,
      uploadTime: `${totalTime}ms`,
      retryAdvice,
    }, { status: statusCode });
  }
}
