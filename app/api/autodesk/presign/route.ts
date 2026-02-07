/**
 * Autodesk CAD Presigned Upload URL Endpoint
 *
 * Generates a presigned PUT URL for direct-to-R2 uploads of CAD/BIM files,
 * bypassing the Vercel 4.5MB body size limit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { generatePresignedUploadUrl } from '@/lib/s3';
import { validateS3Config } from '@/lib/aws-config';
import { isSupportedFormat, SUPPORTED_FORMATS } from '@/lib/autodesk-model-derivative';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { fileName, fileSize, contentType, projectSlug } = body;

    if (!fileName || !projectSlug) {
      return NextResponse.json(
        { error: 'Missing fileName or projectSlug' },
        { status: 400 }
      );
    }

    // Validate file format
    if (!isSupportedFormat(fileName)) {
      return NextResponse.json(
        { error: 'Unsupported file format', supported: SUPPORTED_FORMATS },
        { status: 400 }
      );
    }

    const s3Key = `autodesk/${projectSlug}/${Date.now()}-${fileName}`;
    const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(
      s3Key,
      contentType || 'application/octet-stream',
      false,
      3600
    );

    logger.info('AUTODESK_PRESIGN', `Generated presigned URL for ${fileName}`, {
      projectSlug,
      userId: session.user.id,
      fileSize,
    });

    return NextResponse.json({
      uploadUrl,
      cloudStoragePath: cloud_storage_path,
    });
  } catch (error) {
    logger.error('AUTODESK_PRESIGN', 'Failed to generate presigned URL', error as Error);
    return NextResponse.json(
      { error: 'Failed to generate upload URL. Please try again.' },
      { status: 500 }
    );
  }
}
