import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { downloadFile } from '@/lib/s3';
import { extractPageAsPdf } from '@/lib/pdf-to-image-serverless';
import { rasterizeSinglePage } from '@/lib/pdf-to-image-raster';
import { logger } from '@/lib/logger';
import { safeErrorMessage } from '@/lib/api-error';

/**
 * GET /api/documents/[id]/page-image?page=1&maxWidth=2000
 * Returns a single PDF page as a PNG image for floor plan visualization
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const { id } = params;
    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get('page');
    const maxWidthParam = searchParams.get('maxWidth');

    // Validate page parameter
    if (!pageParam) {
      return NextResponse.json(
        { error: 'Page number is required', code: 'MISSING_PAGE_PARAM' },
        { status: 400 }
      );
    }

    const pageNumber = parseInt(pageParam);
    if (isNaN(pageNumber) || pageNumber < 1) {
      return NextResponse.json(
        { error: 'Invalid page number', code: 'INVALID_PAGE_NUMBER' },
        { status: 400 }
      );
    }

    const maxWidth = maxWidthParam ? parseInt(maxWidthParam) : 2000;
    if (isNaN(maxWidth) || maxWidth < 100 || maxWidth > 8000) {
      return NextResponse.json(
        { error: 'maxWidth must be between 100 and 8000', code: 'INVALID_MAX_WIDTH' },
        { status: 400 }
      );
    }

    // Fetch document from database
    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        cloud_storage_path: true,
        projectId: true,
        deletedAt: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found', code: 'DOCUMENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (document.deletedAt) {
      return NextResponse.json(
        { error: 'Document has been deleted', code: 'DOCUMENT_DELETED' },
        { status: 410 }
      );
    }

    if (!document.cloud_storage_path) {
      return NextResponse.json(
        { error: 'Document has no storage path', code: 'NO_STORAGE_PATH' },
        { status: 404 }
      );
    }

    // Verify user has access to the project
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: document.projectId },
      include: {
        User_Project_ownerIdToUser: true,
        ProjectMember: { include: { User: true } },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }

    const isOwner = (project as any).ownerId === (user as any).id;
    const isMember = project.ProjectMember.some((m: any) => m.userId === (user as any).id);
    const isAdmin = (user as any).role === 'admin';

    if (!isOwner && !isMember && !isAdmin) {
      return NextResponse.json(
        { error: 'Access denied', code: 'ACCESS_DENIED' },
        { status: 403 }
      );
    }

    logger.info('PAGE_IMAGE_API', `Fetching page ${pageNumber} of document ${document.name}`);

    // Download PDF from S3 with timeout
    const downloadTimeout = 30000; // 30 seconds
    const downloadPromise = downloadFile(document.cloud_storage_path);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Download timeout')), downloadTimeout);
    });

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await Promise.race([downloadPromise, timeoutPromise]);
    } catch (error: unknown) {
      logger.error('PAGE_IMAGE_API', 'Error downloading PDF from S3', error as Error);
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes('timeout')) {
        return NextResponse.json(
          { error: 'Download timeout', code: 'DOWNLOAD_TIMEOUT' },
          { status: 504 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to download document', code: 'DOWNLOAD_FAILED', details: safeErrorMessage(error) },
        { status: 500 }
      );
    }

    logger.info('PAGE_IMAGE_API', `Downloaded PDF (${(pdfBuffer.length / 1024 / 1024).toFixed(2)}MB)`);

    // Extract single page as PDF
    let base64Pdf: string;
    let pageCount: number;
    try {
      const extractResult = await extractPageAsPdf(pdfBuffer, pageNumber);
      base64Pdf = extractResult.base64;
      pageCount = extractResult.pageCount;
    } catch (error: unknown) {
      logger.error('PAGE_IMAGE_API', 'Error extracting page', error as Error);
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes('out of range')) {
        return NextResponse.json(
          { error: `Page ${pageNumber} does not exist (document has ${pageCount || 'unknown'} pages)`, code: 'PAGE_OUT_OF_RANGE' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to extract page', code: 'EXTRACT_FAILED', details: safeErrorMessage(error) },
        { status: 500 }
      );
    }

    logger.info('PAGE_IMAGE_API', `Extracted page ${pageNumber}/${pageCount}`);

    // Rasterize to PNG
    let pngBuffer: Buffer;
    try {
      const result = await rasterizeSinglePage(Buffer.from(base64Pdf, 'base64'), 1, {
        maxWidth,
        dpi: 150,
        format: 'png',
      });
      pngBuffer = result.buffer;
    } catch (error: unknown) {
      logger.error('PAGE_IMAGE_API', 'Error rasterizing page', error as Error);
      return NextResponse.json(
        { error: 'Failed to rasterize page', code: 'RASTERIZE_FAILED', details: safeErrorMessage(error) },
        { status: 500 }
      );
    }

    logger.info('PAGE_IMAGE_API', `Rasterized to PNG (${(pngBuffer.length / 1024 / 1024).toFixed(2)}MB)`);

    // Return PNG image
    return new NextResponse(pngBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400', // Cache for 1 day
      },
    });
  } catch (error: unknown) {
    logger.error('PAGE_IMAGE_API', 'Unexpected error', error as Error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR', details: safeErrorMessage(error) },
      { status: 500 }
    );
  }
}
