import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { downloadFile } from '@/lib/s3';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role;

    // Get document from database
    const document = await prisma.document.findUnique({
      where: { id: params.id },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Check access - admins and clients have full access, guests need guest access level
    const hasFullAccess = userRole === 'admin' || userRole === 'client';
    const hasAccess = 
      hasFullAccess ||
      document.accessLevel === 'guest';

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Check for S3 storage (serverless compatible)
    if (document.cloud_storage_path) {
      const fileBuffer = await downloadFile(document.cloud_storage_path);

      // Create response with proper headers for PDF viewing
      const response = new NextResponse(fileBuffer);
      response.headers.set('Content-Type', 'application/pdf');
      response.headers.set('Content-Disposition', 'inline');
      response.headers.set('Content-Length', fileBuffer.length.toString());
      response.headers.set('Cache-Control', 'public, max-age=3600');
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('Accept-Ranges', 'bytes');

      return response;
    } else {
      // Legacy file without S3 - return error
      return NextResponse.json(
        { error: 'Document not available - requires migration to cloud storage' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error serving document:', error);
    return NextResponse.json(
      { error: 'Failed to serve document' },
      { status: 500 }
    );
  }
}
