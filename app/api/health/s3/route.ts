import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { createS3Client, getBucketConfig, validateS3Config } from '@/lib/aws-config';
import { HeadBucketCommand } from '@aws-sdk/client-s3';

export async function GET() {
  // Admin-only endpoint
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { bucketName, folderPrefix } = getBucketConfig();
  const validation = validateS3Config();

  const result: Record<string, unknown> = {
    status: 'checking',
    bucketName: bucketName || '(not set)',
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || '(not set)',
    folderPrefix: folderPrefix || '(none)',
    credentialsSet: validation.valid,
    missingVars: validation.missing,
  };

  if (!validation.valid) {
    result.status = 'misconfigured';
    result.bucketAccessible = false;
    return NextResponse.json(result, { status: 503 });
  }

  try {
    const client = createS3Client();
    await client.send(new HeadBucketCommand({ Bucket: bucketName }));
    result.status = 'healthy';
    result.bucketAccessible = true;
  } catch (error: unknown) {
    result.status = 'error';
    result.bucketAccessible = false;
    result.error = error instanceof Error ? error.message : 'Unknown error';
  }

  const statusCode = result.status === 'healthy' ? 200 : 503;
  return NextResponse.json(result, { status: statusCode });
}
