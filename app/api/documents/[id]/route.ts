import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { convertDocxToPdf, isConversionSupported } from '@/lib/docx-converter';
import { getFileUrl, deleteFile } from '@/lib/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createS3Client, getBucketConfig } from '@/lib/aws-config';
import { handleDocumentDeletion } from '@/lib/document-auto-sync';
import { logger } from '@/lib/logger';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const CONTENT_TYPE_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  txt: 'text/plain',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

function getContentType(fileType: string): string {
  return CONTENT_TYPE_MAP[fileType.toLowerCase()] || 'application/octet-stream';
}

const PREVIEWABLE_TYPES = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif']);
const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50MB

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const documentId = params.id;

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const userRole = session.user.role;

    // Fetch the document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        name: true,
        fileName: true,
        fileType: true,
        accessLevel: true,
        filePath: true,
        cloud_storage_path: true,
        isPublic: true,
        fileSize: true
      }
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check access level - admins and clients have full access, guests need guest access level
    const hasFullAccess = userRole === 'admin' || userRole === 'client';
    const hasAccess =
      hasFullAccess ||
      document.accessLevel === 'guest';

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied. This document requires admin or client access.', code: 'ACCESS_DENIED' },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const download = url.searchParams.get('download') === 'true';
    const mode = url.searchParams.get('mode');

    // Preview info mode - return metadata about whether the file can be previewed
    if (mode === 'preview-info') {
      const fileType = document.fileType.toLowerCase();
      const canPreview = PREVIEWABLE_TYPES.has(fileType);
      return NextResponse.json({
        canPreview,
        contentType: getContentType(fileType),
        fileSize: document.fileSize,
      });
    }

    // Check for storage path before proceeding
    if (!document.cloud_storage_path && !document.filePath) {
      return NextResponse.json(
        { error: 'No file path available', code: 'NO_STORAGE_PATH' },
        { status: 404 }
      );
    }

    let fileBuffer: Buffer;

    // Handle S3-based documents
    if (document.cloud_storage_path) {
      // For explicit downloads, return JSON with URL
      if (download) {
        const fileUrl = await getFileUrl(
          document.cloud_storage_path,
          document.isPublic || false,
          3600
        );

        return NextResponse.json({
          url: fileUrl,
          fileName: document.fileName,
        });
      }

      // For large files, redirect to signed URL instead of buffering
      if (document.fileSize && document.fileSize > LARGE_FILE_THRESHOLD) {
        logger.info('DOCUMENT_PREVIEW', 'Large file detected, redirecting to signed URL', {
          documentId,
          fileSize: document.fileSize,
        });
        const signedUrl = await getFileUrl(
          document.cloud_storage_path,
          document.isPublic || false,
          3600
        );
        return NextResponse.redirect(signedUrl);
      }

      // For viewing, stream the file content with timeout
      const s3Client = createS3Client();
      const { bucketName } = getBucketConfig();

      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: document.cloud_storage_path,
      });

      const s3Promise = s3Client.send(command);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('S3_TIMEOUT')), 30000)
      );

      const response = await Promise.race([s3Promise, timeoutPromise]);
      const chunks: Uint8Array[] = [];

      if (response.Body) {
        for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
          chunks.push(chunk);
        }
      }

      fileBuffer = Buffer.concat(chunks);
    }
    // Handle legacy local files (backward compatibility)
    else if (document.filePath) {
      // Security: Prevent path traversal attacks
      const publicDir = path.resolve(process.cwd(), 'public');
      const filePath = path.resolve(publicDir, document.filePath);

      if (!filePath.startsWith(publicDir + path.sep)) {
        return NextResponse.json(
          { error: 'Invalid file path', code: 'INVALID_PATH' },
          { status: 400 }
        );
      }

      if (!fs.existsSync(filePath)) {
        return NextResponse.json(
          { error: 'Document file not found on server', code: 'FILE_NOT_FOUND' },
          { status: 404 }
        );
      }

      fileBuffer = fs.readFileSync(filePath);
    }
    else {
      return NextResponse.json(
        { error: 'No file path available', code: 'NO_STORAGE_PATH' },
        { status: 404 }
      );
    }

    // Determine content type
    let contentType = getContentType(document.fileType);
    let fileName = document.fileName;

    // Convert DOCX to PDF for viewing (but not for download)
    if (await isConversionSupported(document.fileType)) {
      try {
        logger.info('DOCUMENT_PREVIEW', 'Converting document to PDF for viewing', {
          documentId,
          fileName: document.fileName,
        });
        fileBuffer = await convertDocxToPdf(fileBuffer);
        contentType = 'application/pdf';
        fileName = document.fileName.replace(/\.(docx?|DOCX?)$/, '.pdf');
        logger.info('DOCUMENT_PREVIEW', 'Document converted to PDF successfully', {
          documentId,
          fileName,
        });
      } catch (conversionError) {
        logger.warn('DOCUMENT_PREVIEW', 'DOCX conversion failed', {
          documentId,
          error: conversionError instanceof Error ? conversionError.message : String(conversionError),
        });
        return NextResponse.json(
          { error: 'Document conversion failed', code: 'CONVERSION_FAILED' },
          { status: 422 }
        );
      }
    }

    // Create response with file (for inline viewing only)
    const fileResponse = new NextResponse(fileBuffer);
    fileResponse.headers.set('Content-Type', contentType);
    fileResponse.headers.set('Content-Length', fileBuffer.length.toString());
    fileResponse.headers.set('Cache-Control', 'public, max-age=3600');
    fileResponse.headers.set('X-Content-Type-Options', 'nosniff');
    fileResponse.headers.set(
      'Content-Disposition',
      `inline; filename="${fileName}"`
    );

    return fileResponse;
  } catch (error: unknown) {
    const err = error as Error & { name?: string; Code?: string };

    // Categorized S3 errors
    if (err.name === 'NoSuchKey' || err.Code === 'NoSuchKey') {
      logger.warn('DOCUMENT_PREVIEW', 'File not found in S3', { documentId });
      return NextResponse.json(
        { error: 'File not found in storage', code: 'S3_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (err.message === 'S3_TIMEOUT') {
      logger.error('DOCUMENT_PREVIEW', 'S3 request timed out', err, { documentId });
      return NextResponse.json(
        { error: 'Storage request timed out', code: 'S3_TIMEOUT' },
        { status: 504 }
      );
    }

    if (err.name === 'CredentialsProviderError' || err.name === 'AccessDenied') {
      logger.error('DOCUMENT_PREVIEW', 'S3 authentication failed', err, { documentId });
      return NextResponse.json(
        { error: 'Storage authentication failed', code: 'S3_AUTH_ERROR' },
        { status: 503 }
      );
    }

    logger.error('DOCUMENT_PREVIEW', 'Failed to serve document', err, { documentId });
    return NextResponse.json(
      { error: 'Failed to serve document', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const documentId = params.id;
    const userRole = session.user.role;
    const userId = session.user.id;

    // Fetch the document with project info
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        fileName: true,
        filePath: true,
        cloud_storage_path: true,
        projectId: true,
        Project: {
          select: {
            id: true,
            ownerId: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (!document.Project) {
      return NextResponse.json({ error: 'Document project not found' }, { status: 404 });
    }

    // Check if user has permission to delete
    const isAdmin = userRole === 'admin';
    const isProjectOwner = document.Project.ownerId === userId;

    if (!isAdmin && !isProjectOwner) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this document' },
        { status: 403 }
      );
    }

    // Check for deep cleanup option
    const { searchParams } = new URL(req.url);
    const cleanup = searchParams.get('cleanup') === 'true';

    logger.info('DOCUMENT_DELETE', 'Starting document deletion', {
      documentId,
      fileName: document.fileName,
      cleanup,
    });

    // Deep cleanup: delete extracted/derived data sourced from this document
    let cleanupCounts = { rooms: 0, doors: 0, windows: 0, finishes: 0, floorPlans: 0, hardware: 0 };
    if (cleanup) {
      try {
        const [roomResult, doorResult, windowResult, finishResult, hardwareResult] = await prisma.$transaction([
          prisma.room.deleteMany({ where: { sourceDocumentId: documentId } }),
          prisma.doorScheduleItem.deleteMany({ where: { sourceDocumentId: documentId } }),
          prisma.windowScheduleItem.deleteMany({ where: { sourceDocumentId: documentId } }),
          prisma.finishScheduleItem.deleteMany({ where: { sourceDocumentId: documentId } }),
          prisma.hardwareSetDefinition.deleteMany({ where: { sourceDocumentId: documentId } }),
        ]);
        cleanupCounts.rooms = roomResult.count;
        cleanupCounts.doors = doorResult.count;
        cleanupCounts.windows = windowResult.count;
        cleanupCounts.finishes = finishResult.count;
        cleanupCounts.hardware = hardwareResult.count;

        // Clean up FloorPlan records and their S3 images
        const floorPlans = await prisma.floorPlan.findMany({
          where: { sourceDocumentId: documentId },
          select: { id: true, cloud_storage_path: true },
        });
        for (const fp of floorPlans) {
          if (fp.cloud_storage_path) {
            try { await deleteFile(fp.cloud_storage_path); } catch (e) {
              logger.warn('DOCUMENT_DELETE', 'Failed to delete floor plan image from S3', {
                floorPlanId: fp.id,
                error: e instanceof Error ? e.message : String(e),
              });
            }
          }
        }
        const floorPlanResult = await prisma.floorPlan.deleteMany({ where: { sourceDocumentId: documentId } });
        cleanupCounts.floorPlans = floorPlanResult.count;

        logger.info('DOCUMENT_DELETE', 'Deep cleanup complete', { documentId, cleanupCounts });
      } catch (cleanupError) {
        logger.error('DOCUMENT_DELETE', 'Deep cleanup error', cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError)), {
          documentId,
        });
        // Continue with deletion even if cleanup fails
      }
    }

    // IMPORTANT: Handle auto-sync cascade BEFORE deleting the document
    let syncResult = null;
    try {
      syncResult = await handleDocumentDeletion(documentId, document.projectId);
      logger.info('DOCUMENT_DELETE', 'Auto-sync cascade complete', {
        documentId,
        syncResult,
      });
    } catch (syncError) {
      logger.error('DOCUMENT_DELETE', 'Auto-sync cascade error', syncError instanceof Error ? syncError : new Error(String(syncError)), {
        documentId,
      });
      // Continue with deletion even if sync fails
    }

    // Delete the document file from S3 or filesystem
    if (document.cloud_storage_path) {
      try {
        await deleteFile(document.cloud_storage_path);
        logger.info('DOCUMENT_DELETE', 'Deleted file from S3', {
          documentId,
          path: document.cloud_storage_path,
        });
      } catch (s3Error) {
        logger.error('DOCUMENT_DELETE', 'Error deleting file from S3', s3Error instanceof Error ? s3Error : new Error(String(s3Error)), {
          documentId,
          path: document.cloud_storage_path,
        });
        // Continue with database deletion even if S3 deletion fails
      }
    } else if (document.filePath) {
      // Delete legacy local file
      const publicDir = path.resolve(process.cwd(), 'public');
      const filePath = path.resolve(publicDir, document.filePath);

      if (filePath.startsWith(publicDir + path.sep) && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info('DOCUMENT_DELETE', 'Deleted legacy local file', {
          documentId,
          filePath,
        });
      } else if (!filePath.startsWith(publicDir + path.sep)) {
        logger.warn('DOCUMENT_DELETE', 'Blocked path traversal attempt', {
          documentId,
          filePath: document.filePath,
        });
      }
    }

    // Delete associated records in a transaction to prevent orphans
    const [deletedChunks, deletedTakeoffs, deletedDataSources] = await prisma.$transaction([
      prisma.documentChunk.deleteMany({
        where: { documentId },
      }),
      prisma.materialTakeoff.deleteMany({
        where: { documentId },
      }),
      prisma.projectDataSource.deleteMany({
        where: { documentId },
      }),
      prisma.document.delete({
        where: { id: documentId },
      }),
    ]);

    logger.info('DOCUMENT_DELETE', 'Transaction complete', {
      documentId,
      chunksDeleted: deletedChunks.count,
      takeoffsDeleted: deletedTakeoffs.count,
      dataSourcesDeleted: deletedDataSources.count,
    });

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
      dataSourcesCleaned: deletedDataSources.count,
      takeoffsCleaned: deletedTakeoffs.count,
      autoSync: syncResult ? {
        featuresAffected: syncResult.featuresAffected,
        featuresResynced: syncResult.featuresResynced,
        featuresCleared: syncResult.featuresCleared,
      } : null,
      cleanup: cleanup ? cleanupCounts : null,
    });
  } catch (error) {
    logger.error('DOCUMENT_DELETE', 'Error deleting document', error instanceof Error ? error : new Error(String(error)), {
      documentId: params.id,
    });
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
