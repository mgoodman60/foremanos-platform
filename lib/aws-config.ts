import { S3Client } from "@aws-sdk/client-s3";

export function getBucketConfig() {
  return {
    bucketName: process.env.AWS_BUCKET_NAME ?? "",
    folderPrefix: process.env.AWS_FOLDER_PREFIX ?? ""
  };
}

export function createS3Client() {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  return new S3Client({
    region: process.env.AWS_REGION || 'auto',
    ...(endpoint && { endpoint, forcePathStyle: true }),
    ...(accessKeyId && secretAccessKey && {
      credentials: { accessKeyId, secretAccessKey },
    }),
  });
}

export function validateS3Config(): { valid: boolean; missing: string[] } {
  const required = ['S3_ENDPOINT', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_BUCKET_NAME'];
  const missing = required.filter(key => !process.env[key]);
  return { valid: missing.length === 0, missing };
}

export async function testS3Connectivity(): Promise<{ ok: boolean; error?: string; errorCode?: string; httpStatus?: number }> {
  const { bucketName } = getBucketConfig();
  if (!bucketName) {
    return { ok: false, error: 'AWS_BUCKET_NAME not configured' };
  }
  try {
    const { HeadBucketCommand } = await import('@aws-sdk/client-s3');
    const client = createS3Client();
    await client.send(new HeadBucketCommand({ Bucket: bucketName }));
    return { ok: true };
  } catch (err: unknown) {
    const error = err as Error & { name?: string; $metadata?: { httpStatusCode?: number }; Code?: string };
    return {
      ok: false,
      error: error.message,
      errorCode: error.Code || error.name,
      httpStatus: error.$metadata?.httpStatusCode,
    };
  }
}
