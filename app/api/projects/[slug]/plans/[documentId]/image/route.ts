import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { downloadFile, getFileUrl } from '@/lib/s3';
import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

// Check if pdftoppm is available
function isPdftoppmAvailable(): boolean {
  try {
    const result = spawnSync('which', ['pdftoppm'], { encoding: 'utf8' });
    return result.status === 0 && result.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

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

    // Check if we have a cached image
    const cacheDir = path.join(os.tmpdir(), 'plan-images');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const cacheKey = `${documentId}-page${pageNumber}`;
    const cachedImagePath = path.join(cacheDir, `${cacheKey}.png`);

    // Return cached image if it exists and is less than 1 hour old
    if (fs.existsSync(cachedImagePath)) {
      const stats = fs.statSync(cachedImagePath);
      const ageInMs = Date.now() - stats.mtimeMs;
      const oneHourInMs = 60 * 60 * 1000;

      if (ageInMs < oneHourInMs) {
        const imageBuffer = fs.readFileSync(cachedImagePath);
        return new NextResponse(imageBuffer, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=3600'
          }
        });
      }
    }

    // Check if pdftoppm is available for image conversion
    const hasPdftoppm = isPdftoppmAvailable();
    console.log(`[Document Viewer] pdftoppm available: ${hasPdftoppm}`);

    // Try multiple sources for the PDF file
    let pdfPath: string | null = null;
    const tempPdfPath = path.join(cacheDir, `${documentId}.pdf`);

    // Option 1: Check if we have a local copy in public/documents
    const localPath = path.join(process.cwd(), 'public', 'documents', document.fileName);
    if (fs.existsSync(localPath)) {
      pdfPath = localPath;
      console.log(`[Document Viewer] Using local file: ${localPath}`);
    }
    
    // Option 2: Check uploads directory
    if (!pdfPath) {
      const uploadsPath = path.join(process.cwd(), 'uploads', document.fileName);
      if (fs.existsSync(uploadsPath)) {
        pdfPath = uploadsPath;
        console.log(`[Document Viewer] Using uploads file: ${uploadsPath}`);
      }
    }
    
    // Option 3: Download from S3 if cloud_storage_path exists
    if (!pdfPath && document.cloud_storage_path) {
      try {
        console.log(`[Document Viewer] Downloading from S3: ${document.cloud_storage_path}`);
        const pdfBuffer = await downloadFile(document.cloud_storage_path);
        fs.writeFileSync(tempPdfPath, pdfBuffer);
        pdfPath = tempPdfPath;
        console.log(`[Document Viewer] Downloaded to temp: ${tempPdfPath}`);
      } catch (s3Error: any) {
        console.error(`[Document Viewer] S3 download failed:`, s3Error.message);
      }
    }
    
    // Option 4: Try to fetch from fileUrl if available
    if (!pdfPath && document.fileUrl) {
      try {
        console.log(`[Document Viewer] Fetching from fileUrl: ${document.fileUrl}`);
        const response = await fetch(document.fileUrl);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          fs.writeFileSync(tempPdfPath, Buffer.from(arrayBuffer));
          pdfPath = tempPdfPath;
          console.log(`[Document Viewer] Downloaded from fileUrl to temp: ${tempPdfPath}`);
        }
      } catch (urlError: any) {
        console.error(`[Document Viewer] fileUrl fetch failed:`, urlError.message);
      }
    }

    // If we have a PDF and pdftoppm, convert it to PNG
    if (pdfPath && fs.existsSync(pdfPath) && hasPdftoppm) {
      try {
        // Convert PDF page to PNG using pdftoppm
        const outputPrefix = path.join(cacheDir, cacheKey);
        execSync(
          `pdftoppm -png -r 150 -f ${pageNumber} -l ${pageNumber} -singlefile "${pdfPath}" "${outputPrefix}"`,
          { stdio: 'pipe' }
        );

        // Read the generated image
        if (fs.existsSync(cachedImagePath)) {
          const imageBuffer = fs.readFileSync(cachedImagePath);
          
          // Clean up temp PDF if we downloaded it
          if (pdfPath === tempPdfPath && fs.existsSync(tempPdfPath)) {
            fs.unlinkSync(tempPdfPath);
          }

          return new NextResponse(imageBuffer, {
            headers: {
              'Content-Type': 'image/png',
              'Cache-Control': 'public, max-age=3600'
            }
          });
        }
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
        reason: hasPdftoppm ? 'conversion_failed' : 'pdftoppm_unavailable'
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
