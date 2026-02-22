import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { createS3Client, getBucketConfig, validateS3Config } from '@/lib/aws-config';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '@/lib/logger';

const logger = createLogger('DOCUMENTS_UPLOAD_CHUNK');

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ChunkMetadata {
  uploadId: string;
  fileName: string;
  fileSize: number;
  chunkIndex: number;
  totalChunks: number;
  projectId: string;
}

export async function POST(request: Request) {
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

    const formData = await request.formData();
    const chunk = formData.get('chunk') as Blob;
    const metadata = JSON.parse(formData.get('metadata') as string) as ChunkMetadata;

    if (!chunk || !metadata) {
      return NextResponse.json(
        { error: 'Missing chunk or metadata' },
        { status: 400 }
      );
    }

    const { uploadId, fileName, chunkIndex, totalChunks } = metadata;
    
    // Store chunk in S3 temporarily
    const s3Client = createS3Client();
    const { bucketName, folderPrefix } = getBucketConfig();
    const chunkKey = `${folderPrefix}chunks/${uploadId}/${chunkIndex}`;

    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: chunkKey,
      Body: chunkBuffer,
    }));

    logger.info('Uploaded chunk', { chunk: chunkIndex + 1, totalChunks, fileName });

    return NextResponse.json({
      success: true,
      chunkIndex,
      message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded`,
    });
  } catch (error: any) {
    const s3Meta = error.$metadata;
    logger.error('CHUNK_UPLOAD', 'Failed to upload chunk', error, {
      errorCode: error.Code || error.name,
      httpStatus: s3Meta?.httpStatusCode,
      requestId: s3Meta?.requestId,
    });

    let statusCode = 500;
    let errorMessage = 'Failed to upload chunk';

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
