import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_DOCUMENTS');

/**
 * GET /api/projects/[slug]/documents
 * Get all documents for a project (for annotations page)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check for optional category filter
    const url = new URL(request.url);
    const categoryFilter = url.searchParams.get('category');

    // Get documents
    const documents = await prisma.document.findMany({
      where: {
        projectId: project.id,
        deletedAt: null,
        ...(categoryFilter && { category: categoryFilter as any })
      },
      select: {
        id: true,
        name: true,
        fileName: true,
        fileType: true,
        category: true,
        processed: true,
        queueStatus: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ documents });
  } catch (error: unknown) {
    logger.error('Error fetching documents', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
