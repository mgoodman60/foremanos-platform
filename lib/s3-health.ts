import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { createS3Client, getBucketConfig } from './aws-config';

export type S3HealthStatus = 'ok' | 'not_configured' | 'error';

export async function checkS3Health(): Promise<S3HealthStatus> {
  const { bucketName } = getBucketConfig();

  if (!bucketName) {
    return 'not_configured';
  }

  try {
    const client = createS3Client();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      await client.send(
        new HeadBucketCommand({ Bucket: bucketName }),
        { abortSignal: controller.signal }
      );
      return 'ok';
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return 'error';
  }
}
