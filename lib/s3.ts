import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createS3Client, getBucketConfig } from "./aws-config";

// Re-export for use by other modules
export { createS3Client, getBucketConfig };

const s3Client = createS3Client();
const AWS_REGION = process.env.AWS_REGION || "us-east-1";

/**
 * Upload a file to S3 with timeout and retry logic
 * @param buffer - File buffer to upload
 * @param fileName - Original file name
 * @param isPublic - Whether the file should be publicly accessible
 * @param timeoutMs - Timeout in milliseconds (default: 120000 = 2 minutes)
 * @param retries - Number of retry attempts (default: 2)
 * @returns S3 key (cloud_storage_path)
 */
export async function uploadFile(
  buffer: Buffer,
  fileName: string,
  isPublic: boolean = false,
  timeoutMs: number = 120000,
  retries: number = 2
): Promise<string> {
  const { bucketName, folderPrefix } = getBucketConfig();

  // Generate S3 key based on public/private access
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const cloud_storage_path = isPublic
    ? `${folderPrefix}public/uploads/${timestamp}-${sanitizedFileName}`
    : `${folderPrefix}uploads/${timestamp}-${sanitizedFileName}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`[S3 UPLOAD] Attempt ${attempt + 1}/${retries + 1} for ${fileName} (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);
      
      // Upload to S3 with timeout protection
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: cloud_storage_path,
        Body: buffer,
        ContentType: getContentType(fileName),
      });

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`S3 upload timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      // Race between upload and timeout
      await Promise.race([
        s3Client.send(command),
        timeoutPromise,
      ]);

      console.log(`[S3 UPLOAD] Successfully uploaded ${fileName} to ${cloud_storage_path}`);
      return cloud_storage_path;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[S3 UPLOAD ERROR] Attempt ${attempt + 1} failed for ${fileName}:`, lastError.message);
      
      // If this is not the last attempt, wait before retrying
      if (attempt < retries) {
        const waitTime = (attempt + 1) * 1000; // Exponential backoff: 1s, 2s
        console.log(`[S3 UPLOAD] Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // All retries failed
  throw new Error(`S3 upload failed after ${retries + 1} attempts: ${lastError?.message}`);
}

/**
 * Get URL for accessing a file (public or signed)
 * @param cloud_storage_path - S3 key
 * @param isPublic - Whether to generate public URL or signed URL
 * @param expiresIn - Expiry time in seconds for signed URLs (default: 3600)
 * @returns URL to access the file
 */
export async function getFileUrl(
  cloud_storage_path: string,
  isPublic: boolean,
  expiresIn: number = 3600
): Promise<string> {
  const { bucketName } = getBucketConfig();

  if (isPublic) {
    // Return public URL
    return `https://${bucketName}.s3.${AWS_REGION}.amazonaws.com/${cloud_storage_path}`;
  } else {
    // Generate signed URL
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: cloud_storage_path,
    });
    return await getSignedUrl(s3Client, command, { expiresIn });
  }
}

/**
 * Generate presigned URL for uploading a file directly to S3
 * @param fileName - Original file name
 * @param contentType - MIME type of the file
 * @param isPublic - Whether the file should be publicly accessible
 * @param expiresIn - URL expiry time in seconds (default: 3600 = 1 hour)
 * @returns Object with uploadUrl and cloud_storage_path
 */
export async function generatePresignedUploadUrl(
  fileName: string,
  contentType: string,
  isPublic: boolean = false,
  expiresIn: number = 3600
): Promise<{ uploadUrl: string; cloud_storage_path: string }> {
  const { bucketName, folderPrefix } = getBucketConfig();

  // Generate S3 key based on public/private access
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const cloud_storage_path = isPublic
    ? `${folderPrefix}public/uploads/${timestamp}-${sanitizedFileName}`
    : `${folderPrefix}uploads/${timestamp}-${sanitizedFileName}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

  return { uploadUrl, cloud_storage_path };
}

/**
 * Delete a file from S3
 * @param cloud_storage_path - S3 key
 */
export async function deleteFile(cloud_storage_path: string): Promise<void> {
  const { bucketName } = getBucketConfig();

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
  });

  await s3Client.send(command);
}

/**
 * Download a file from S3 and return as Buffer
 * @param cloud_storage_path - S3 key
 * @returns Buffer containing the file data
 */
export async function downloadFile(cloud_storage_path: string): Promise<Buffer> {
  const { bucketName } = getBucketConfig();

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
  });

  const response = await s3Client.send(command);
  
  if (!response.Body) {
    throw new Error('Empty response body from S3');
  }

  // Convert the readable stream to a buffer
  const chunks: Uint8Array[] = [];
  const stream = response.Body as NodeJS.ReadableStream;
  
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/**
 * Get content type based on file extension
 */
function getContentType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const contentTypes: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    txt: "text/plain",
    csv: "text/csv",
  };
  return contentTypes[ext || ""] || "application/octet-stream";
}
