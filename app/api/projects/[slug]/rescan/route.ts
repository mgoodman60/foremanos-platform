/**
 * Project-level rescan endpoint
 * Re-processes all documents in a project and regenerates takeoffs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limiter';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Rate limit — 2 rescans per hour per project
    const rateLimitCheck = await checkRateLimit(`rescan:${params.slug}`, {
      maxRequests: 2,
      windowSeconds: 3600,
    });
    if (!rateLimitCheck.success) {
      return NextResponse.json(
        { error: 'Rate limited. Please wait before rescanning.' },
        { status: 429 }
      );
    }

    // 3. Project access check
    const project = await prisma.project.findFirst({
      where: {
        slug: params.slug,
        OR: [
          { ownerId: session.user.id },
          { ProjectMember: { some: { userId: session.user.id } } },
        ],
      },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 4. Find all processed documents in project
    const documents = await prisma.document.findMany({
      where: { projectId: project.id, processed: true },
      select: { id: true, name: true, processedAt: true },
    });

    if (documents.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No processed documents to rescan.',
        documentsQueued: 0,
      });
    }

    // 5. Queue each document for reprocessing
    let queued = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const doc of documents) {
      try {
        await prisma.$transaction([
          prisma.documentChunk.deleteMany({ where: { documentId: doc.id } }),
          prisma.document.update({
            where: { id: doc.id },
            data: { processed: false, pagesProcessed: 0, queueStatus: 'queued' },
          }),
        ]);
        queued++;
      } catch (err) {
        skipped++;
        errors.push(doc.name || doc.id);
        logger.warn('RESCAN', `Failed to queue document ${doc.id}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 6. Trigger async processing via waitUntil if available
    try {
      const { waitUntil } = await import('@vercel/functions');
      const { processDocument } = await import('@/lib/document-processor');

      for (const doc of documents) {
        waitUntil(
          processDocument(doc.id).catch((err: Error) => {
            logger.error('RESCAN', `Async processing failed for ${doc.id}`, err);
          })
        );
      }
    } catch {
      // waitUntil not available (local dev) — documents are queued for pickup
      logger.info('RESCAN', 'Documents queued but async processing unavailable (local dev)', {
        projectId: project.id,
        queued,
      });
    }

    logger.info('RESCAN', 'Project rescan initiated', {
      projectId: project.id,
      documentsQueued: queued,
      documentsSkipped: skipped,
    });

    return NextResponse.json({
      success: true,
      message: `${queued} document(s) queued for re-analysis. Results will update automatically.`,
      documentsQueued: queued,
      documentsSkipped: skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    logger.error('RESCAN', 'Error initiating project rescan', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to start rescan' },
      { status: 500 }
    );
  }
}
