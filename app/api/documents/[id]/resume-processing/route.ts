import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { resumeFailedProcessing } from '@/lib/document-processing-queue';
import { prisma } from '@/lib/db';
import { ProcessingQueueStatus } from '@prisma/client';
import { logger } from '@/lib/logger';
import { tasks } from '@trigger.dev/sdk/v3';
import type { processDocumentTask } from '@/src/trigger/process-document';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const documentId = params.id;

    // Verify document exists
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, name: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Reset ProcessingQueue entries stuck in 'processing' status back to 'queued'
    const stuckReset = await prisma.processingQueue.updateMany({
      where: {
        documentId,
        status: ProcessingQueueStatus.processing,
      },
      data: {
        status: ProcessingQueueStatus.queued,
        updatedAt: new Date(),
      },
    });

    if (stuckReset.count > 0) {
      logger.info('RESUME_PROCESSING', `Reset ${stuckReset.count} stuck processing entries`, { documentId });
    }

    // Resume failed processing (resets failed entries to queued)
    await resumeFailedProcessing(documentId);

    // Reset document-level queue status and clear error
    await prisma.document.update({
      where: { id: documentId },
      data: {
        queueStatus: 'queued',
        lastProcessingError: null,
      },
    });

    // Fetch totalPages from ProcessingQueue, processorType from Document
    const queueEntry = await prisma.processingQueue.findFirst({
      where: { documentId },
      select: { totalPages: true },
      orderBy: { createdAt: 'desc' },
    });
    const docMeta = await prisma.document.findUnique({
      where: { id: documentId },
      select: { processorType: true },
    });

    const totalPages = queueEntry?.totalPages ?? 1;
    const processorType = docMeta?.processorType ?? 'vision-ai';

    // Re-trigger the Trigger.dev task to resume processing
    try {
      const handle = await tasks.trigger<typeof processDocumentTask>('process-document', {
        documentId,
        totalPages,
        processorType,
      });
      logger.info('RESUME_PROCESSING', 'Trigger.dev task triggered', { documentId, runId: handle.id });
    } catch (triggerError) {
      logger.error('RESUME_PROCESSING', 'Failed to trigger Trigger.dev task', triggerError);
      await prisma.document.update({
        where: { id: documentId },
        data: {
          queueStatus: 'failed',
          lastProcessingError: 'Failed to start resume processing task',
        },
      }).catch(() => {});
      throw triggerError;
    }

    logger.info('RESUME_PROCESSING', `Processing resumed for ${document.name}`, { documentId });

    return NextResponse.json({
      success: true,
      message: `Processing resumed for ${document.name} — task re-triggered`,
    });
  } catch (error: unknown) {
    logger.error('RESUME_PROCESSING', 'Failed to resume processing', error);
    return NextResponse.json(
      { error: 'Failed to resume processing' },
      { status: 500 }
    );
  }
}
