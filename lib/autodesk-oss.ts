/**
 * Autodesk Object Storage Service (OSS)
 * Handles bucket management and file uploads for Model Derivative processing
 */

import { getAccessToken } from './autodesk-auth';
import { logger } from '@/lib/logger';

const OSS_BASE_URL = 'https://developer.api.autodesk.com/oss/v2';
const BUCKET_KEY = `foremanos_${process.env.NODE_ENV || 'development'}`.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

interface BucketDetails {
  bucketKey: string;
  bucketOwner: string;
  createdDate: number;
  permissions: Array<{ authId: string; access: string }>;
  policyKey: string;
}

interface UploadedObject {
  bucketKey: string;
  objectId: string;
  objectKey: string;
  sha1: string;
  size: number;
  location: string;
}

/**
 * Ensure our storage bucket exists
 */
export async function ensureBucket(): Promise<BucketDetails> {
  const token = await getAccessToken();

  // First, try to get existing bucket
  try {
    const getResponse = await fetch(`${OSS_BASE_URL}/buckets/${BUCKET_KEY}/details`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (getResponse.ok) {
      return await getResponse.json();
    }
  } catch {
    // Bucket doesn't exist, create it
  }

  // Create new bucket
  const createResponse = await fetch(`${OSS_BASE_URL}/buckets`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bucketKey: BUCKET_KEY,
      access: 'full',
      policyKey: 'transient', // Files deleted after 24 hours
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    // Bucket might already exist (409 Conflict)
    if (createResponse.status === 409) {
      const getResponse = await fetch(`${OSS_BASE_URL}/buckets/${BUCKET_KEY}/details`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (getResponse.ok) {
        return await getResponse.json();
      }
    }
    throw new Error(`Failed to create bucket: ${errorText}`);
  }

  return await createResponse.json();
}

/**
 * Upload a file to the OSS bucket using signed S3 URLs (required for v2 API)
 * This is a 3-step process:
 * 1. Get signed upload URL
 * 2. Upload to S3
 * 3. Complete the upload
 */
export async function uploadFile(
  fileName: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<UploadedObject> {
  const token = await getAccessToken();
  await ensureBucket();

  // Generate a unique object key
  const objectKey = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  logger.info('AUTODESK_OSS', 'Getting signed upload URL', { objectKey });

  // Step 1: Get signed upload URL
  const signedUrlResponse = await fetch(
    `${OSS_BASE_URL}/buckets/${BUCKET_KEY}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!signedUrlResponse.ok) {
    const errorText = await signedUrlResponse.text();
    throw new Error(`Failed to get signed upload URL: ${errorText}`);
  }

  const signedData = await signedUrlResponse.json();
  logger.info('AUTODESK_OSS', 'Got signed URL, uploading to S3');

  // Step 2: Upload directly to S3 using signed URL
  const s3Response = await fetch(signedData.urls[0], {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: fileBuffer,
  });

  if (!s3Response.ok) {
    const errorText = await s3Response.text();
    throw new Error(`Failed to upload to S3: ${errorText}`);
  }

  logger.info('AUTODESK_OSS', 'S3 upload complete, finalizing');

  // Step 3: Complete the upload
  const completeResponse = await fetch(
    `${OSS_BASE_URL}/buckets/${BUCKET_KEY}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uploadKey: signedData.uploadKey,
      }),
    }
  );

  if (!completeResponse.ok) {
    const errorText = await completeResponse.text();
    throw new Error(`Failed to complete upload: ${errorText}`);
  }

  const result = await completeResponse.json();
  logger.info('AUTODESK_OSS', 'File uploaded successfully', { objectKey: result.objectKey });
  return result;
}

/**
 * Get the URN (unique resource name) for a file
 * This is needed for Model Derivative API
 */
export function getObjectUrn(objectId: string): string {
  // objectId is already in the format: urn:adsk.objects:os.object:bucket/objectKey
  return Buffer.from(objectId).toString('base64').replace(/=/g, '');
}

/**
 * Delete an object from the bucket
 */
export async function deleteObject(objectKey: string): Promise<void> {
  const token = await getAccessToken();

  const response = await fetch(
    `${OSS_BASE_URL}/buckets/${BUCKET_KEY}/objects/${encodeURIComponent(objectKey)}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text();
    throw new Error(`Failed to delete object: ${errorText}`);
  }
}

export { BUCKET_KEY };
