/**
 * Payment Application Presigned Upload URL Endpoint
 *
 * Generates a presigned PUT URL for direct-to-R2 uploads of pay app documents,
 * bypassing the Vercel 4.5MB body size limit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { generatePresignedUploadUrl } from '@/lib/s3';
import { validateS3Config } from '@/lib/aws-config';
import { logger } from '@/lib/logger';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/octet-stream',
];

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const s3Check = validateS3Config();
    if (!s3Check.valid) {
      return NextResponse.json(
        { error: 'File storage is not configured. Please contact your administrator.' },
        { status: 503 }
      );
    }

    const { slug } = params;

    const project = await prisma.project.findUnique({
      where: { slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const { fileName, fileSize, contentType } = body;

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: 'Missing fileName or contentType' },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: 'Invalid file type. Supported: PDF, Images, Excel, CSV' },
        { status: 415 }
      );
    }

    const s3Key = `projects/${project.id}/pay-apps/${Date.now()}-${fileName}`;
    const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(
      s3Key,
      contentType,
      false,
      3600
    );

    logger.info('PAY_APP_PRESIGN', `Generated presigned URL for ${fileName}`, {
      projectId: project.id,
      userId: session.user.id,
      fileSize,
    });

    return NextResponse.json({
      uploadUrl,
      cloudStoragePath: cloud_storage_path,
    });
  } catch (error) {
    logger.error('PAY_APP_PRESIGN', 'Failed to generate presigned URL', error as Error);
    return NextResponse.json(
      { error: 'Failed to generate upload URL. Please try again.' },
      { status: 500 }
    );
  }
}
