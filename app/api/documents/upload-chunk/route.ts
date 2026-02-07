import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { createS3Client, getBucketConfig, validateS3Config } from '@/lib/aws-config';
import { PutObjectCommand } from '@aws-sdk/client-s3';

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

    console.log(`[CHUNK] Uploaded chunk ${chunkIndex + 1}/${totalChunks} for ${fileName}`);

    return NextResponse.json({
      success: true,
      chunkIndex,
      message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded`,
    });
  } catch (error: any) {
    console.error('[CHUNK ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to upload chunk', details: error.message },
      { status: 500 }
    );
  }
}
