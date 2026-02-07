import { S3Client } from "@aws-sdk/client-s3";

export function getBucketConfig() {
  return {
    bucketName: process.env.AWS_BUCKET_NAME ?? "",
    folderPrefix: process.env.AWS_FOLDER_PREFIX ?? ""
  };
}

export function createS3Client() {
  const endpoint = process.env.S3_ENDPOINT;
  return new S3Client({
    region: process.env.AWS_REGION || 'auto',
    ...(endpoint && { endpoint, forcePathStyle: true }),
  });
}

export function validateS3Config(): { valid: boolean; missing: string[] } {
  const required = ['S3_ENDPOINT', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_BUCKET_NAME'];
  const missing = required.filter(key => !process.env[key]);
  return { valid: missing.length === 0, missing };
}
