/**
 * Project-level rescan endpoint
 * Re-processes all documents in a project and regenerates takeoffs
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { downloadFile } from '@/lib/s3';
import { getDocumentMetadata } from '@/lib/document-processor';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limiter';
import { tasks } from '@trigger.dev/sdk/v3';
import type { processDocumentTask } from '@/src/trigger/process-document';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    // 1. Auth check
    const session = await auth();
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
      select: { id: true, name: true, fileName: true, cloud_storage_path: true, processedAt: true },
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
        // Get document metadata before resetting
        let totalPages = 1;
        let processorType: 'vision-ai' | 'claude-haiku-ocr' | 'basic-ocr' = 'vision-ai';

        if (doc.cloud_storage_path) {
          try {
            const buffer = await downloadFile(doc.cloud_storage_path);
            const fileExtension = doc.fileName.split('.').pop()?.toLowerCase() || 'pdf';
            const metadata = await getDocumentMetadata(buffer, doc.fileName, fileExtension);
            totalPages = metadata.totalPages;
            processorType = metadata.processorType;
            logger.info('RESCAN', 'Document metadata retrieved', { documentId: doc.id, totalPages, processorType });
          } catch (metadataError) {
            logger.warn('RESCAN', `Failed to get metadata for ${doc.id}, using defaults`, {
              error: metadataError instanceof Error ? metadataError.message : String(metadataError),
            });
          }
        }

        // Reset document and trigger processing
        await prisma.$transaction([
          prisma.documentChunk.deleteMany({ where: { documentId: doc.id } }),
          prisma.processingQueue.deleteMany({ where: { documentId: doc.id } }),
          prisma.document.update({
            where: { id: doc.id },
            data: { processed: false, pagesProcessed: 0, queueStatus: 'queued', processorType },
          }),
        ]);

        // Trigger via Trigger.dev
        const handle = await tasks.trigger<typeof processDocumentTask>('process-document', {
          documentId: doc.id,
          totalPages,
          processorType,
        });
        logger.info('RESCAN', 'Trigger.dev task triggered', { documentId: doc.id, runId: handle.id });

        queued++;
      } catch (err) {
        skipped++;
        errors.push(doc.name || doc.id);
        logger.warn('RESCAN', `Failed to queue document ${doc.id}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
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
