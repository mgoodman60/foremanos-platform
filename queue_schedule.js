require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { queueDocumentForProcessing, processQueuedDocument } = require('./lib/document-processing-queue');
const { getPageCount } = require('./lib/pdf-utils');
const fs = require('fs');
const path = require('path');
const { createS3Client, getBucketConfig } = require('./lib/aws-config');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { Readable } = require('stream');

const prisma = new PrismaClient();

async function downloadFromS3(cloud_storage_path) {
  const s3Client = createS3Client();
  const { bucketName } = getBucketConfig();

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
  });

  const response = await s3Client.send(command);
  const stream = response.Body;
  
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

async function queueScheduleDocument() {
  try {
    const documentId = 'cmk980b410001ng08agojvsj6';
    
    // Get document details
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        name: true,
        fileName: true,
        cloud_storage_path: true,
        processed: true
      }
    });

    if (!document) {
      console.error('Document not found!');
      return;
    }

    console.log(`\nFound document: ${document.name}`);
    console.log(`  Cloud path: ${document.cloud_storage_path}`);
    console.log(`  Processed: ${document.processed}`);

    // Download file from S3
    console.log('\nDownloading file from S3...');
    const fileBuffer = await downloadFromS3(document.cloud_storage_path);
    
    // Save to temp file
    const tempPath = path.join('/tmp', document.fileName);
    fs.writeFileSync(tempPath, fileBuffer);
    console.log(`Saved to temp file: ${tempPath}`);

    // Get page count
    const pageCount = await getPageCount(tempPath);
    console.log(`Page count: ${pageCount}`);

    // Queue for processing
    console.log('\nQueueing document for processing...');
    await queueDocumentForProcessing(documentId, pageCount, 5);

    // Start processing
    console.log('Starting processing...');
    // Don't await this - let it run in background
    processQueuedDocument(documentId).catch(err => {
      console.error('Processing error:', err);
    });

    console.log('\n✅ Document queued successfully!');
    console.log('Processing will continue in the background.');

    // Clean up temp file
    fs.unlinkSync(tempPath);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

queueScheduleDocument();
