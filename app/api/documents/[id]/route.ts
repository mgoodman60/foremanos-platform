import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { convertDocxToPdf, isConversionSupported } from '@/lib/docx-converter';
import { getFileUrl, deleteFile } from '@/lib/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createS3Client, getBucketConfig } from '@/lib/aws-config';
import { handleDocumentDeletion } from '@/lib/document-auto-sync';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role;
    const documentId = params.id;

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
        { error: 'Document not found' },
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
        { error: 'Access denied. This document requires admin or client access.' },
        { status: 403 }
      );
    }

    // Check if user wants to download or view
    const url = new URL(req.url);
    const download = url.searchParams.get('download') === 'true';

    let fileBuffer: Buffer;

    // Handle S3-based documents (new approach)
    if (document.cloud_storage_path) {
      // For explicit downloads only, return JSON with URL
      if (download) {
        const fileUrl = await getFileUrl(
          document.cloud_storage_path,
          document.isPublic || false,
          3600 // 1 hour expiry
        );
        
        // Return URL for download (anchor tag will handle it)
        return NextResponse.json({
          url: fileUrl,
          fileName: document.fileName,
        });
      }

      // For viewing (iframe/embed), stream the file content directly
      const s3Client = createS3Client();
      const { bucketName } = getBucketConfig();
      
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: document.cloud_storage_path,
      });

      const response = await s3Client.send(command);
      const chunks: Uint8Array[] = [];
      
      if (response.Body) {
        for await (const chunk of response.Body as any) {
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

      // Ensure resolved path is within public directory
      if (!filePath.startsWith(publicDir + path.sep)) {
        return NextResponse.json(
          { error: 'Invalid file path' },
          { status: 400 }
        );
      }

      if (!fs.existsSync(filePath)) {
        return NextResponse.json(
          { error: 'Document file not found on server' },
          { status: 404 }
        );
      }

      fileBuffer = fs.readFileSync(filePath);
    } 
    else {
      return NextResponse.json(
        { error: 'Document storage path not configured' },
        { status: 404 }
      );
    }
    
    // Determine content type
    const contentTypeMap: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      txt: 'text/plain',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel'
    };

    let contentType = contentTypeMap[document.fileType.toLowerCase()] || 'application/octet-stream';
    let fileName = document.fileName;

    // Convert DOCX to PDF for viewing (but not for download)
    if (await isConversionSupported(document.fileType)) {
      try {
        console.log(`Converting ${document.fileName} to PDF for viewing...`);
        fileBuffer = await convertDocxToPdf(fileBuffer);
        contentType = 'application/pdf';
        fileName = document.fileName.replace(/\\.(docx?|DOCX?)$/, '.pdf');
        console.log(`Successfully converted ${document.fileName} to PDF`);
      } catch (error) {
        console.error('Conversion failed, serving original file:', error);
        // Fall back to original file if conversion fails
      }
    }

    // Create response with file (for inline viewing only)
    const response = new NextResponse(fileBuffer);
    response.headers.set('Content-Type', contentType);
    response.headers.set('Content-Length', fileBuffer.length.toString());
    response.headers.set('Cache-Control', 'public, max-age=3600');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set(
      'Content-Disposition',
      `inline; filename="${fileName}"`
    );
    
    return response;
  } catch (error) {
    console.error('Error serving document:', error);
    return NextResponse.json(
      { error: 'Failed to serve document' },
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
    // Allow: admins, project owners (clients)
    const isAdmin = userRole === 'admin';
    const isProjectOwner = document.Project.ownerId === userId;

    if (!isAdmin && !isProjectOwner) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this document' },
        { status: 403 }
      );
    }

    console.log(`[Document Delete] Starting deletion of ${document.fileName} (${documentId})`);

    // IMPORTANT: Handle auto-sync cascade BEFORE deleting the document
    // This re-syncs affected features from remaining documents or clears them
    let syncResult = null;
    try {
      syncResult = await handleDocumentDeletion(documentId, document.projectId);
      console.log(`[Document Delete] Auto-sync cascade complete:`, syncResult);
    } catch (error) {
      console.error('[Document Delete] Auto-sync cascade error:', error);
      // Continue with deletion even if sync fails
    }

    // Delete the document file from S3 or filesystem
    if (document.cloud_storage_path) {
      // Delete from S3
      try {
        await deleteFile(document.cloud_storage_path);
        console.log(`Deleted file from S3: ${document.cloud_storage_path}`);
      } catch (error) {
        console.error('Error deleting file from S3:', error);
        // Continue with database deletion even if S3 deletion fails
      }
    } else if (document.filePath) {
      // Delete legacy local file
      // Security: Prevent path traversal attacks
      const publicDir = path.resolve(process.cwd(), 'public');
      const filePath = path.resolve(publicDir, document.filePath);

      // Ensure resolved path is within public directory before deleting
      if (filePath.startsWith(publicDir + path.sep) && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted legacy local file: ${filePath}`);
      } else if (!filePath.startsWith(publicDir + path.sep)) {
        console.warn(`[Document Delete] Blocked path traversal attempt: ${document.filePath}`);
      }
    }

    // Delete associated document chunks
    await prisma.documentChunk.deleteMany({
      where: { documentId },
    });

    // Clean up any remaining ProjectDataSource records
    // (handleDocumentDeletion may have already cleaned some during resync)
    const deletedDataSources = await prisma.projectDataSource.deleteMany({
      where: { documentId },
    });
    
    if (deletedDataSources.count > 0) {
      console.log(`[Document Delete] Cleaned up ${deletedDataSources.count} remaining data source(s) for document ${documentId}`);
    }

    // Delete the document record
    await prisma.document.delete({
      where: { id: documentId },
    });

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
      dataSourcesCleaned: deletedDataSources.count,
      autoSync: syncResult ? {
        featuresAffected: syncResult.featuresAffected,
        featuresResynced: syncResult.featuresResynced,
        featuresCleared: syncResult.featuresCleared,
      } : null,
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}