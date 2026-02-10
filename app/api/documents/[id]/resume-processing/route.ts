import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { resumeFailedProcessing } from '@/lib/document-processing-queue';
import { prisma } from '@/lib/db';
import { ProcessingQueueStatus } from '@prisma/client';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    logger.info('RESUME_PROCESSING', `Processing resumed for ${document.name}`, { documentId });

    return NextResponse.json({
      success: true,
      message: `Processing resumed for ${document.name}`,
    });
  } catch (error: any) {
    logger.error('RESUME_PROCESSING', 'Failed to resume processing', error);
    return NextResponse.json(
      { error: 'Failed to resume processing' },
      { status: 500 }
    );
  }
}
