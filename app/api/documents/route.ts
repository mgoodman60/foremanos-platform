import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { withDatabaseRetry } from '@/lib/retry-util';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await withDatabaseRetry(
      () => getServerSession(authOptions),
      'Get server session (documents)'
    );
    const userRole = session?.user?.role || 'guest';
    
    // Get projectId from query params
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Fetch documents based on user's access level and project
    let accessLevelFilter: any;
    if (userRole === 'admin') {
      // Admin can see all documents (no filter)
      accessLevelFilter = {};
    } else if (userRole === 'client') {
      // Clients can see 'client' and 'guest' documents
      accessLevelFilter = { accessLevel: { in: ['client', 'guest'] } };
    } else {
      // Guests can only see 'guest' documents
      accessLevelFilter = { accessLevel: 'guest' };
    }

    const documents = await withDatabaseRetry(
      () => prisma.document.findMany({
        where: {
          projectId,
          deletedAt: null,
          ...accessLevelFilter
        },
        select: {
          id: true,
          name: true,
          fileName: true,
          fileType: true,
          accessLevel: true,
          category: true,
          filePath: true,
          fileSize: true,
          lastModified: true,
          updatedAt: true,
          queueStatus: true,
          processed: true,
        },
        orderBy: {
          name: 'asc'
        }
      }),
      'Fetch project documents'
    );

    // Also fetch all documents for the project to show counts
    const allDocuments = await withDatabaseRetry(
      () => prisma.document.findMany({
        where: {
          projectId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          fileName: true,
          fileType: true,
          accessLevel: true,
          category: true,
          filePath: true,
          fileSize: true,
          lastModified: true,
          updatedAt: true,
          queueStatus: true,
          processed: true,
        },
        orderBy: {
          name: 'asc'
        }
      }),
      'Fetch all project documents'
    );

    return NextResponse.json({ 
      documents: allDocuments,
      accessible: documents,
      userRole 
    });
  } catch (error: any) {
    console.error('[API] Error fetching documents:', error);
    
    // Return more specific error messages
    if (error?.code?.startsWith('P1')) {
      return NextResponse.json({ 
        error: 'Database connection error. Please try again.' 
      }, { status: 503 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}