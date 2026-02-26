import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { downloadFile, getFileUrl } from '@/lib/s3';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_PLANS_IMAGE');

export const dynamic = 'force-dynamic';

// GET /api/projects/[slug]/plans/[documentId]/image?page=1
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ slug: string; documentId: string }> }
) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, documentId } = params;
    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get('page');
    const pageNumber = pageParam ? parseInt(pageParam, 10) : 1;
    const fallback = searchParams.get('fallback') === 'true';

    // Get project and verify access
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        User_Project_ownerIdToUser: true,
        ProjectMember: {
          include: { User: true }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user has access
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = project.ownerId === user.id;
    const isMember = project.ProjectMember.some((m: any) => m.userId === user.id);

    if (!isOwner && !isMember && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get document
    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });

    if (!document || document.projectId !== project.id) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Only process PDFs
    if (document.fileType !== 'pdf') {
      return NextResponse.json(
        { error: 'Only PDF documents are supported' },
        { status: 400 }
      );
    }

    // If fallback mode, return PDF URL for client-side rendering
    if (fallback) {
      let pdfUrl: string | null = null;
      
      // Try to get a URL for the PDF
      if (document.cloud_storage_path) {
        try {
          pdfUrl = await getFileUrl(document.cloud_storage_path, document.isPublic || false);
        } catch (e) {
          logger.error('[Document Viewer] Failed to get S3 URL', e);
        }
      }
      
      if (!pdfUrl && document.fileUrl) {
        pdfUrl = document.fileUrl;
      }
      
      if (pdfUrl) {
        return NextResponse.json({ 
          type: 'pdf_url',
          url: pdfUrl,
          page: pageNumber
        });
      }
      
      return NextResponse.json({ error: 'No PDF URL available' }, { status: 404 });
    }

    // Try to get PDF buffer from multiple sources
    let pdfBuffer: Buffer | null = null;

    // Option 1: Download from S3 if cloud_storage_path exists (preferred)
    if (document.cloud_storage_path) {
      try {
        logger.info('[Document Viewer] Downloading from S3', { path: document.cloud_storage_path });
        pdfBuffer = await downloadFile(document.cloud_storage_path);
        logger.info('[Document Viewer] Downloaded from S3');
      } catch (s3Error: unknown) {
        logger.error('S3 download failed', s3Error);
      }
    }

    // Option 2: Try to fetch from fileUrl if available
    if (!pdfBuffer && document.fileUrl) {
      try {
        logger.info('[Document Viewer] Fetching from fileUrl', { fileUrl: document.fileUrl });
        const response = await fetch(document.fileUrl);
        if (response.ok) {
          pdfBuffer = Buffer.from(await response.arrayBuffer());
          logger.info('[Document Viewer] Downloaded from fileUrl');
        }
      } catch (urlError: unknown) {
        logger.error('fileUrl fetch failed', urlError);
      }
    }

    // Since canvas dependency was removed (Feb 2026) for Vercel compatibility,
    // we now return PDF URLs for client-side rendering instead of server-side rasterization.
    // This provides better quality anyway since the client can render at any resolution.
    // The rasterizeSinglePage function now returns PDF pages by default.
    if (pdfBuffer) {
      logger.info('[Document Viewer] PDF rasterization not available (canvas removed). Using PDF URL fallback.');
      // Fall through to PDF URL fallback below
    }

    // Fallback: Return PDF URL for client-side rendering
    let pdfUrl: string | null = null;
    
    if (document.cloud_storage_path) {
      try {
        pdfUrl = await getFileUrl(document.cloud_storage_path, document.isPublic || false);
      } catch (e) {
        logger.error('[Document Viewer] Failed to get S3 URL for fallback', e);
      }
    }
    
    if (!pdfUrl && document.fileUrl) {
      pdfUrl = document.fileUrl;
    }
    
    if (pdfUrl) {
      // Return redirect to use client-side PDF rendering
      return NextResponse.json({
        type: 'pdf_url',
        url: pdfUrl,
        page: pageNumber,
        reason: 'conversion_failed'
      });
    }

    // If no file found or conversion failed, return error
    return NextResponse.json(
      { error: 'Unable to generate document image. Document may need to be re-uploaded.' },
      { status: 500 }
    );
  } catch (error: unknown) {
    logger.error('[Document Viewer] Error', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to generate document image', details: errMsg },
      { status: 500 }
    );
  }
}
