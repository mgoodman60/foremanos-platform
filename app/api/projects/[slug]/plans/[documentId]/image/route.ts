import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { downloadFile, getFileUrl } from '@/lib/s3';
import { rasterizeSinglePage } from '@/lib/pdf-to-image-raster';

export const dynamic = 'force-dynamic';

// GET /api/projects/[slug]/plans/[documentId]/image?page=1
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; documentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
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
          console.error('[Document Viewer] Failed to get S3 URL:', e);
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
        console.log(`[Document Viewer] Downloading from S3: ${document.cloud_storage_path}`);
        pdfBuffer = await downloadFile(document.cloud_storage_path);
        console.log(`[Document Viewer] Downloaded from S3`);
      } catch (s3Error: any) {
        console.error(`[Document Viewer] S3 download failed:`, s3Error.message);
      }
    }

    // Option 2: Try to fetch from fileUrl if available
    if (!pdfBuffer && document.fileUrl) {
      try {
        console.log(`[Document Viewer] Fetching from fileUrl: ${document.fileUrl}`);
        const response = await fetch(document.fileUrl);
        if (response.ok) {
          pdfBuffer = Buffer.from(await response.arrayBuffer());
          console.log(`[Document Viewer] Downloaded from fileUrl`);
        }
      } catch (urlError: any) {
        console.error(`[Document Viewer] fileUrl fetch failed:`, urlError.message);
      }
    }

    // If we have a PDF buffer, convert it to PNG using serverless-compatible rasterization
    if (pdfBuffer) {
      try {
        console.log(`[Document Viewer] Converting page ${pageNumber} to image...`);
        const rasterResult = await rasterizeSinglePage(pdfBuffer, pageNumber, {
          dpi: 150,
          maxWidth: 2048,
          maxHeight: 2048,
          format: 'png'
        });

        return new NextResponse(rasterResult.buffer, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=3600'
          }
        });
      } catch (error) {
        console.error('[Document Viewer] Error converting PDF to image:', error);
      }
    }

    // Fallback: Return PDF URL for client-side rendering
    let pdfUrl: string | null = null;
    
    if (document.cloud_storage_path) {
      try {
        pdfUrl = await getFileUrl(document.cloud_storage_path, document.isPublic || false);
      } catch (e) {
        console.error('[Document Viewer] Failed to get S3 URL for fallback:', e);
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
  } catch (error: any) {
    console.error('[Document Viewer] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate document image', details: error.message },
      { status: 500 }
    );
  }
}
