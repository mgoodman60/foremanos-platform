/**
 * Presigned Upload URL Endpoint
 *
 * Generates a presigned PUT URL for direct-to-R2 uploads,
 * bypassing the Vercel 4.5MB body size limit. Validates metadata
 * only — no file body is received by this endpoint.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { generatePresignedUploadUrl } from '@/lib/s3';
import { requireProjectPermission } from '@/lib/project-permissions';
import { classifyDocument } from '@/lib/document-classifier';
import { canProcessDocument, getRemainingPages, shouldResetQuota, getNextResetDate } from '@/lib/processing-limits';
import { withDatabaseRetry } from '@/lib/retry-util';
import { checkRateLimit, getClientIp, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { getBucketConfig, validateS3Config } from '@/lib/aws-config';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

const MAX_FILE_SIZE = 209715200; // 200MB

export async function POST(request: Request) {
  try {
    // 1. Rate limit
    const ip = getClientIp(request);
    const rateLimitResult = await checkRateLimit(ip, RATE_LIMITS.UPLOAD);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many upload attempts. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    // 2. Auth check
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Parse and validate request body
    let body: { fileName?: string; fileSize?: number; contentType?: string; projectId?: string; category?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body' },
        { status: 400 }
      );
    }

    const { fileName, fileSize, contentType, projectId, category } = body;

    if (!fileName || typeof fileName !== 'string') {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
    }
    if (fileSize == null || typeof fileSize !== 'number' || fileSize <= 0) {
      return NextResponse.json({ error: 'fileSize must be a positive number' }, { status: 400 });
    }
    if (!contentType || typeof contentType !== 'string') {
      return NextResponse.json({ error: 'contentType is required' }, { status: 400 });
    }
    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // 4. S3 config validation
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
          details: process.env.NODE_ENV === 'development' ? { missing: s3Validation.missing } : undefined,
        },
        { status: 503 }
      );
    }

    // 5. MIME type validation
    if (!ALLOWED_MIME_TYPES.includes(contentType)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 415 });
    }

    // 6. File size check
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 200MB.' },
        { status: 413 }
      );
    }

    // 7. Project existence + permission check
    const project = await withDatabaseRetry(
      () => prisma.project.findUnique({
        where: { id: projectId },
      }),
      'Find project for presign'
    ) as any;

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const userId = session.user.id;
    const userRole = session.user.role;

    if (userRole !== 'admin') {
      const { allowed, access } = await requireProjectPermission(userId, project.slug, 'upload');

      if (!allowed) {
        return NextResponse.json(
          {
            error: 'You do not have permission to upload documents. Only project owners and editors can upload.',
            yourRole: access.role,
          },
          { status: 403 }
        );
      }
    }

    // 8. Subscription quota check
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

    if (await shouldResetQuota(user)) {
      logger.info('PRESIGN', `Resetting quota for user ${userId} (was ${user.pagesProcessedThisMonth} pages)`);

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

    const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'pdf';
    const classification = await classifyDocument(fileName, fileExtension);
    const estimatedPages = Math.ceil(fileSize / (100 * 1024)); // ~100KB per page

    const { allowed: quotaAllowed, reason } = await canProcessDocument(
      user.id,
      estimatedPages
    );

    if (!quotaAllowed) {
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

    // 9. Generate presigned URL
    const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(
      fileName,
      contentType,
      false,
      3600
    );

    logger.info('PRESIGN', `Generated presigned URL for ${fileName}`, {
      projectId,
      userId,
      fileSize,
      cloudStoragePath: cloud_storage_path,
    });

    // 10. Return response
    return NextResponse.json({
      uploadUrl,
      cloudStoragePath: cloud_storage_path,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    });
  } catch (error: any) {
    logger.error('PRESIGN', 'Failed to generate presigned URL', error);

    return NextResponse.json(
      { error: 'Failed to generate upload URL. Please try again.' },
      { status: 500 }
    );
  }
}
