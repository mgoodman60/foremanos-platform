"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFile = exports.generatePresignedUploadUrl = exports.getFileUrl = exports.uploadFile = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const aws_config_1 = require("./aws-config");
const s3Client = (0, aws_config_1.createS3Client)();
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
async function uploadFile(buffer, fileName, isPublic = false, timeoutMs = 120000, retries = 2) {
    const { bucketName, folderPrefix } = (0, aws_config_1.getBucketConfig)();
    // Generate S3 key based on public/private access
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const cloud_storage_path = isPublic
        ? `${folderPrefix}public/uploads/${timestamp}-${sanitizedFileName}`
        : `${folderPrefix}uploads/${timestamp}-${sanitizedFileName}`;
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            console.log(`[S3 UPLOAD] Attempt ${attempt + 1}/${retries + 1} for ${fileName} (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);
            // Upload to S3 with timeout protection
            const command = new client_s3_1.PutObjectCommand({
                Bucket: bucketName,
                Key: cloud_storage_path,
                Body: buffer,
                ContentType: getContentType(fileName),
            });
            // Create timeout promise
            const timeoutPromise = new Promise((_, reject) => {
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
        }
        catch (error) {
            lastError = error;
            console.error(`[S3 UPLOAD ERROR] Attempt ${attempt + 1} failed for ${fileName}:`, error.message);
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
exports.uploadFile = uploadFile;
/**
 * Get URL for accessing a file (public or signed)
 * @param cloud_storage_path - S3 key
 * @param isPublic - Whether to generate public URL or signed URL
 * @param expiresIn - Expiry time in seconds for signed URLs (default: 3600)
 * @returns URL to access the file
 */
async function getFileUrl(cloud_storage_path, isPublic, expiresIn = 3600) {
    const { bucketName } = (0, aws_config_1.getBucketConfig)();
    if (isPublic) {
        // Return public URL
        return `https://${bucketName}.s3.${AWS_REGION}.amazonaws.com/${cloud_storage_path}`;
    }
    else {
        // Generate signed URL
        const command = new client_s3_1.GetObjectCommand({
            Bucket: bucketName,
            Key: cloud_storage_path,
        });
        return await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn });
    }
}
exports.getFileUrl = getFileUrl;
/**
 * Generate presigned URL for uploading a file directly to S3
 * @param fileName - Original file name
 * @param contentType - MIME type of the file
 * @param isPublic - Whether the file should be publicly accessible
 * @param expiresIn - URL expiry time in seconds (default: 3600 = 1 hour)
 * @returns Object with uploadUrl and cloud_storage_path
 */
async function generatePresignedUploadUrl(fileName, contentType, isPublic = false, expiresIn = 3600) {
    const { bucketName, folderPrefix } = (0, aws_config_1.getBucketConfig)();
    // Generate S3 key based on public/private access
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const cloud_storage_path = isPublic
        ? `${folderPrefix}public/uploads/${timestamp}-${sanitizedFileName}`
        : `${folderPrefix}uploads/${timestamp}-${sanitizedFileName}`;
    const command = new client_s3_1.PutObjectCommand({
        Bucket: bucketName,
        Key: cloud_storage_path,
        ContentType: contentType,
    });
    const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn });
    return { uploadUrl, cloud_storage_path };
}
exports.generatePresignedUploadUrl = generatePresignedUploadUrl;
/**
 * Delete a file from S3
 * @param cloud_storage_path - S3 key
 */
async function deleteFile(cloud_storage_path) {
    const { bucketName } = (0, aws_config_1.getBucketConfig)();
    const command = new client_s3_1.DeleteObjectCommand({
        Bucket: bucketName,
        Key: cloud_storage_path,
    });
    await s3Client.send(command);
}
exports.deleteFile = deleteFile;
/**
 * Get content type based on file extension
 */
function getContentType(fileName) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const contentTypes = {
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
