import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { removeDuplicates } from '@/lib/duplicate-detector';
import { requireProjectPermission } from '@/lib/project-permissions';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_DUPLICATES');

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[slug]/duplicates
 * Remove duplicate documents from a project
 */
export async function POST(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const userId = session.user.id;
    const userRole = session.user.role;

    // Check if user has permission (only owners and admins can remove duplicates)
    if (userRole !== 'admin') {
      const { allowed } = await requireProjectPermission(userId, slug, 'upload');
      
      if (!allowed) {
        return NextResponse.json(
          { error: 'Only project owners can remove duplicates' },
          { status: 403 }
        );
      }
    }

    // Remove duplicates
    logger.info('Removing duplicates from project', { projectId: project.id, slug });
    const result = await removeDuplicates(project.id);

    if (result.errors.length > 0) {
      logger.error('Errors during duplicate removal', undefined, { errors: result.errors });
    }

    return NextResponse.json({
      message: 'Duplicate removal complete',
      removed: result.removed,
      kept: result.kept,
      errors: result.errors,
    });
  } catch (error) {
    logger.error('Error removing duplicates', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[slug]/duplicates
 * Get count of duplicate documents in a project
 */
export async function GET(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const userId = session.user.id;
    const userRole = session.user.role;

    // Check if user has access to project
    if (userRole !== 'admin') {
      const { allowed } = await requireProjectPermission(userId, slug, 'view');
      
      if (!allowed) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    // Get all documents
    const documents = await prisma.document.findMany({
      where: {
        projectId: project.id,
        deletedAt: null,
      },
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        oneDriveHash: true,
      },
    });

    // Count duplicates
    const seenHashes = new Set<string>();
    const seenSignatures = new Set<string>();
    let duplicateCount = 0;

    for (const doc of documents) {
      if (doc.oneDriveHash) {
        if (seenHashes.has(doc.oneDriveHash)) {
          duplicateCount++;
        } else {
          seenHashes.add(doc.oneDriveHash);
        }
      } else {
        const signature = `${doc.fileName}-${doc.fileSize || 0}`;
        if (seenSignatures.has(signature)) {
          duplicateCount++;
        } else {
          seenSignatures.add(signature);
        }
      }
    }

    return NextResponse.json({
      totalDocuments: documents.length,
      duplicateCount,
      uniqueCount: documents.length - duplicateCount,
    });
  } catch (error) {
    logger.error('Error checking duplicates', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
