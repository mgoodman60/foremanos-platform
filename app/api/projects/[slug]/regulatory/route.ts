import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  createRegulatoryDocuments,
  getProjectRegulatoryDocuments,
  getRegulatoryDocumentStats,
} from '@/lib/regulatory-documents';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_REGULATORY');

/**
 * GET /api/projects/[slug]/regulatory
 * Get all regulatory documents for a project
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

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      include: {
        ProjectMember: {
          where: { userId: session.user.id },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check access
    const isOwner = project.ownerId === session.user.id;
    const isMember = project.ProjectMember.length > 0;

    if (!isOwner && !isMember && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get regulatory documents
    const documents = await getProjectRegulatoryDocuments(project.id);
    const stats = await getRegulatoryDocumentStats(project.id);

    return NextResponse.json({ documents, stats });
  } catch (error) {
    logger.error('Error fetching regulatory documents', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[slug]/regulatory
 * Add regulatory documents to a project
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { codes } = body;

    if (!codes || !Array.isArray(codes)) {
      return NextResponse.json(
        { error: 'Invalid codes array' },
        { status: 400 }
      );
    }

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      include: {
        ProjectMember: {
          where: { userId: session.user.id },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check access (only owners can add regulatory documents)
    const isOwner = project.ownerId === session.user.id;
    const isAdmin = session.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Only project owners can add regulatory documents' },
        { status: 403 }
      );
    }

    // Create regulatory documents
    const results = await createRegulatoryDocuments(project.id, codes);

    // Count new vs existing
    const newDocs = results.filter((r: any) => !r.alreadyExists);
    const existingDocs = results.filter((r: any) => r.alreadyExists);

    return NextResponse.json({
      success: true,
      message: `Added ${newDocs.length} regulatory documents (${existingDocs.length} already existed)`,
      documents: results,
      stats: {
        added: newDocs.length,
        existing: existingDocs.length,
        total: results.length,
      },
    });
  } catch (error) {
    logger.error('Error adding regulatory documents', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
