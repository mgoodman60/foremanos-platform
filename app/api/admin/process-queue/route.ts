import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { ProcessingQueueStatus } from '@prisma/client';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Get queue statistics
 * Returns current processing queue state
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (session?.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get queue statistics
    const stats = await prisma.processingQueue.groupBy({
      by: ['status'],
      _count: true,
    });

    // Get list of queued documents with details
    const queuedEntries = await prisma.processingQueue.findMany({
      where: {
        status: {
          in: [ProcessingQueueStatus.queued, ProcessingQueueStatus.processing],
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: {
        id: true,
        documentId: true,
        status: true,
        totalPages: true,
        pagesProcessed: true,
        currentBatch: true,
        totalBatches: true,
        lastError: true,
        retriesCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Get document details for the queue
    const documentIds = queuedEntries.map(e => e.documentId);
    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds } },
      select: {
        id: true,
        name: true,
        fileName: true,
        queueStatus: true,
      },
    });

    const documentMap = new Map(documents.map(d => [d.id, d]));

    // Enrich queue entries with document details
    const enrichedQueue = queuedEntries.map(entry => ({
      ...entry,
      document: documentMap.get(entry.documentId),
    }));

    return NextResponse.json({
      stats,
      queue: enrichedQueue,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    logger.error('PROCESS_QUEUE', 'Queue stats error', error);
    return NextResponse.json(
      { error: 'Failed to get queue stats' },
      { status: 500 }
    );
  }
}
