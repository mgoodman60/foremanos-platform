import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { uploadFile, getFileUrl } from '@/lib/s3';
import { requireProjectPermission } from '@/lib/project-permissions';
import { processDocument } from '@/lib/document-processor';
import { calculateFileHash, isDuplicate } from '@/lib/duplicate-detector';
import { sendDocumentUploadNotification } from '@/lib/email-service';
import { classifyDocument } from '@/lib/document-classifier';
import { getProcessingLimits, canProcessDocument, getRemainingPages, shouldResetQuota, getNextResetDate } from '@/lib/processing-limits';
import { withDatabaseRetry } from '@/lib/retry-util';
import { markDocumentUploaded } from '@/lib/onboarding-tracker';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max for upload

export async function POST(request: Request) {
  const startTime = Date.now();
  console.log('[UPLOAD START]', new Date().toISOString());
  
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[UPLOAD] Parsing form data...');
    let formData: FormData;
    try {
      formData = await request.formData();
      console.log('[UPLOAD] Form data parsed successfully');
    } catch (error: any) {
      console.error('[UPLOAD ERROR] Failed to parse form data:', error);
      return NextResponse.json(
        { 
          error: 'Failed to read upload data. Connection may have timed out.',
          details: error.message 
        },
        { status: 400 }
      );
    }
    
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const category = formData.get('category') as string || 'other';

    if (!file || !projectId) {
      return NextResponse.json(
        { error: 'File and project ID are required' },
        { status: 400 }
      );
    }

    // Verify project exists and get slug
    const project = await withDatabaseRetry(
      () => prisma.project.findUnique({
        where: { id: projectId },
      }),
      'Find project for upload'
    ) as any;

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const userId = session.user.id;
    const userRole = session.user.role;

    // Check upload permission (admins bypass, others need owner/editor role)
    if (userRole !== 'admin') {
      const { allowed, access } = await requireProjectPermission(userId, project.slug, 'upload');
      
      if (!allowed) {
        return NextResponse.json(
          { 
            error: 'You do not have permission to upload documents. Only project owners and editors can upload.',
            yourRole: access.role 
          },
          { status: 403 }
        );
      }
    }

    // Get file data
    const fileName = file.name;
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'pdf';
    const fileSize = file.size;
    console.log(`[UPLOAD] Reading file data: ${fileName}, Expected size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
    
    // Check file size before reading
    if (fileSize > 209715200) { // 200MB
      return NextResponse.json(
        { error: 'File too large. Maximum size is 200MB.' },
        { status: 413 }
      );
    }
    
    let buffer: Buffer;
    try {
      console.log('[UPLOAD] Converting file to buffer...');
      const bytes = await file.arrayBuffer();
      buffer = Buffer.from(bytes);
      console.log(`[UPLOAD] Buffer created successfully: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
    } catch (error: any) {
      console.error('[UPLOAD ERROR] Failed to read file:', error);
      throw new Error(`Failed to read file: ${error.message}`);
    }

    // Calculate file hash for duplicate detection
    console.log('[UPLOAD] Calculating file hash...');
    const fileHash = calculateFileHash(buffer);

    // Check for duplicates
    console.log('[UPLOAD] Checking for duplicates...');
    const hasDuplicate = await isDuplicate(projectId, fileName, buffer.length, fileHash);
    
    if (hasDuplicate) {
      return NextResponse.json(
        { 
          error: 'Duplicate document detected',
          message: 'A document with the same name and content already exists in this project.',
        },
        { status: 409 } // Conflict status code
      );
    }

    // Get user subscription info for quota checking
    let user: any = await withDatabaseRetry(
      () => prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          subscriptionTier: true,
          pagesProcessedThisMonth: true,
          processingResetAt: true,
        },
      }),
      'Find user for quota checking'
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // CRITICAL FIX: Check if quota needs to be reset before validation
    if (await shouldResetQuota(user)) {
      console.log(`[QUOTA RESET] Resetting quota for user ${userId} (was ${user.pagesProcessedThisMonth} pages)`);
      
      // Reset quota and update reset date
      await withDatabaseRetry(
        () => prisma.user.update({
          where: { id: userId },
          data: {
            pagesProcessedThisMonth: 0,
            processingResetAt: getNextResetDate(),
          },
        }),
        'Reset user quota'
      );

      // Update local user object
      user = {
        ...user,
        pagesProcessedThisMonth: 0,
        processingResetAt: getNextResetDate(),
      };
      
      console.log(`[QUOTA RESET] User ${userId} quota reset to 0, next reset: ${user.processingResetAt}`);
    }

    // Classify document to estimate pages
    const classification = await classifyDocument(fileName, fileExtension);
    const estimatedPages = Math.ceil(buffer.length / (100 * 1024)); // Rough estimate: 100KB per page

    // Check if user can process this document (after quota reset if needed)
    // Admins have unlimited access - they bypass all quota checks
    const { allowed, reason } = await canProcessDocument(
      user.id,
      estimatedPages
    );

    if (!allowed) {
      const remainingPages = await getRemainingPages(user.pagesProcessedThisMonth, user.subscriptionTier);
      return NextResponse.json(
        {
          error: 'Processing quota exceeded',
          message: reason,
          remainingPages,
          tier: user.subscriptionTier,
          classification: classification.processorType,
        },
        { status: 403 }
      );
    }

    // Determine if file should be public or private
    // For construction documents, most should be private (signed URLs)
    // Only marketing materials or publicly shared docs should be public
    const isPublic = false; // Default to private for construction documents

    // Upload to S3
    console.log('[UPLOAD] Uploading to S3...');
    const s3UploadStart = Date.now();
    const cloud_storage_path = await uploadFile(buffer, fileName, isPublic);
    const s3UploadTime = Date.now() - s3UploadStart;
    console.log(`[UPLOAD] S3 upload completed in ${s3UploadTime}ms, path: ${cloud_storage_path}`);

    // Create document record with cloud storage path and processor info
    console.log('[UPLOAD] Creating database record...');
    const document: any = await withDatabaseRetry(
      () => prisma.document.create({
        data: {
          name: fileName.replace(/\.(pdf|docx?)$/i, ''),
          fileName: fileName,
          fileType: fileExtension,
          projectId: projectId,
          accessLevel: 'guest', // Default to guest-accessible
          category: category as any, // User-selected or AI-suggested category
          cloud_storage_path: cloud_storage_path,
          isPublic: isPublic,
          fileSize: buffer.length,
          oneDriveHash: fileHash, // Store hash for duplicate detection
          syncSource: 'manual_upload',
          processed: false,
          processorType: classification.processorType, // Store processor type
          pagesProcessed: 0, // Will be updated after processing
          processingCost: 0, // Will be updated after processing
        },
      }),
      'Create document record'
    );

    // Trigger vision processing asynchronously with classification info
    console.log('[UPLOAD] Triggering async document processing...');
    processDocument(document.id, classification)
      .then(() => {
        console.log(`[UPLOAD] ✅ Processing started successfully for document ${document.id}`);
      })
      .catch(async (error) => {
        console.error(`[UPLOAD ERROR] ❌ Processing failed for document ${document.id}:`, error);
        
        // Update document with error status and message
        try {
          await withDatabaseRetry(
            () => prisma.document.update({
              where: { id: document.id },
              data: {
                queueStatus: 'failed',
                processed: false, // Mark as not processed
                lastProcessingError: error?.message || String(error),
                processingRetries: 0, // Reset retry count
              },
            }),
            'Mark document as failed'
          );
          console.error(`[UPLOAD ERROR] Marked document ${document.id} as failed in database`);
        } catch (updateError) {
          console.error(`[UPLOAD ERROR] Failed to update document status:`, updateError);
        }
      });

    // Send document upload notification to project owner (async, don't wait)
    sendDocumentUploadNotification(
      projectId,
      document.name,
      session.user.username || session.user?.email || 'A user'
    ).catch(error => {
      console.error('[UPLOAD ERROR] Error sending document upload notification:', error);
    });

    // Track first document upload for onboarding (async, don't wait)
    markDocumentUploaded(userId, projectId).catch(error => {
      console.error('[UPLOAD] Error tracking onboarding progress:', error);
    });

    // Get updated remaining pages after queuing for processing (estimate minus the document)
    const updatedRemainingPages = getRemainingPages(user.pagesProcessedThisMonth, user.subscriptionTier);

    const totalTime = Date.now() - startTime;
    console.log(`[UPLOAD COMPLETE] Total time: ${totalTime}ms, Document ID: ${document.id}`);

    return NextResponse.json(
      {
        Document: {
          id: document.id,
          name: document.name,
          fileName: document.fileName,
        },
        message: 'Document uploaded successfully. Processing in background...',
        processingInfo: {
          estimatedPages,
          processorType: classification.processorType,
          remainingPages: updatedRemainingPages,
          tier: user.subscriptionTier,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`[UPLOAD ERROR] Failed after ${totalTime}ms:`, error);
    console.error('[UPLOAD ERROR] Stack:', error.stack);
    console.error('[UPLOAD ERROR] Error name:', error.name);
    console.error('[UPLOAD ERROR] Error code:', error.code);
    
    // Return more specific error messages
    let errorMessage = 'Upload failed. Please try again.';
    let statusCode = 500;
    
    if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
      errorMessage = 'Upload timed out. The file may be too large or network connection is slow. Please try again or contact support.';
      statusCode = 504; // Gateway Timeout
    } else if (error.message?.includes('S3') || error.message?.includes('upload')) {
      errorMessage = 'Storage upload failed. Please check your network connection and try again.';
      statusCode = 503; // Service Unavailable
    } else if (error.message?.includes('Prisma') || error.message?.includes('database')) {
      errorMessage = 'Database error while saving document. Please try again.';
      statusCode = 503;
    } else if (error.message?.includes('network') || error.message?.includes('ECONNREFUSED')) {
      errorMessage = 'Network connection error. Please check your internet connection and try again.';
      statusCode = 503;
    } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Connection lost during upload. Please try again with a stable network connection.';
      statusCode = 503;
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      technicalDetails: process.env.NODE_ENV === 'development' ? error.message : undefined,
      uploadTime: `${totalTime}ms`,
      retryAdvice: 'If the issue persists, try uploading a smaller file or contact support.'
    }, { status: statusCode });
  }
}
