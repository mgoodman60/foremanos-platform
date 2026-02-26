import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { processDocument } from '@/lib/document-processor';
import { classifyDocument } from '@/lib/document-classifier';
import { waitUntil } from '@vercel/functions';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/documents/retry-failed
 * Retries processing for failed documents
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can trigger retries
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can retry failed processing' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { projectId, documentId, maxRetries = 3 } = body;

    // Build where clause
    const whereClause: any = {
      queueStatus: 'failed',
      deletedAt: null,
      processingRetries: { lt: maxRetries },
    };

    if (projectId) {
      whereClause.projectId = projectId;
    }

    if (documentId) {
      whereClause.id = documentId;
    }

    // Find failed documents that can be retried
    const failedDocs = await prisma.document.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        fileName: true,
        processingRetries: true,
        lastProcessingError: true,
      },
      take: 10, // Limit to 10 documents at a time
    });

    if (failedDocs.length === 0) {
      return NextResponse.json({
        message: 'No failed documents found that can be retried',
        retried: 0,
      });
    }

    logger.info('RETRY_FAILED', `Found ${failedDocs.length} documents to retry`);

    const results: { id: string; name: string; status: string; retryAttempt?: number; error?: string }[] = [];

    // Retry each document
    for (const doc of failedDocs) {
      try {
        logger.info('RETRY_FAILED', `Retrying document ${doc.id} (${doc.name})`, { attempt: doc.processingRetries + 1 });

        // Clean up old ProcessingQueue entries to prevent conflicts
        await prisma.processingQueue.deleteMany({ where: { documentId: doc.id } });

        // Reset status and increment retry counter
        await prisma.document.update({
          where: { id: doc.id },
          data: {
            queueStatus: 'queued',
            processed: false,
            processingRetries: doc.processingRetries + 1,
          },
        });

        // Classify document
        const fileExtension = doc.fileName.split('.').pop()?.toLowerCase() || '';
        const classification = await classifyDocument(doc.fileName, fileExtension);

        // Start processing asynchronously
        waitUntil(
          processDocument(doc.id, classification)
            .then(() => {
              logger.info('RETRY_FAILED', `Document ${doc.id} processing completed successfully`);
            })
            .catch(async (error) => {
              logger.error('RETRY_FAILED', `Document ${doc.id} retry failed`, error as Error);

              // Update with new error
              await prisma.document.update({
                where: { id: doc.id },
                data: {
                  queueStatus: 'failed',
                  lastProcessingError: `Retry ${doc.processingRetries + 1} failed: ${error?.message || String(error)}`,
                },
              }).catch((e: any) => logger.error('RETRY_FAILED', 'Failed to update document status', e));
            })
        );

        results.push({
          id: doc.id,
          name: doc.name,
          status: 'queued',
          retryAttempt: doc.processingRetries + 1,
        });
      } catch (error: unknown) {
        logger.error('RETRY_FAILED', `Error retrying document ${doc.id}`, error);
        results.push({
          id: doc.id,
          name: doc.name,
          status: 'error',
          error: 'Retry failed',
        });
      }
    }

    return NextResponse.json({
      message: `Retrying ${results.length} documents`,
      retried: results.length,
      results,
    });
  } catch (error: unknown) {
    logger.error('RETRY_FAILED', 'Error in retry-failed endpoint', error);
    return NextResponse.json(
      { error: 'Failed to retry documents' },
      { status: 500 }
    );
  }
}
