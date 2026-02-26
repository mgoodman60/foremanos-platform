import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ProcessingQueueStatus } from '@prisma/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('PROCESSING_ACTIVE');

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all active processing queue entries
    const activeEntries = await prisma.processingQueue.findMany({
      where: {
        status: {
          in: [ProcessingQueueStatus.queued, ProcessingQueueStatus.processing],
        },
      },
      include: {
        Document: {
          select: {
            name: true,
            fileName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const activeProcessing = activeEntries.map((entry: any) => ({
      documentId: entry.documentId,
      documentName: entry.Document.name || entry.Document.fileName || 'Unknown',
      status: entry.status,
    }));

    return NextResponse.json(activeProcessing);
  } catch (error: unknown) {
    logger.error('Failed to fetch active processing', error);
    return NextResponse.json(
      { error: 'Failed to fetch active processing' },
      { status: 500 }
    );
  }
}
