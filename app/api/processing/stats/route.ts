import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { ProcessingQueueStatus } from '@prisma/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('PROCESSING_STATS');

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId parameter required' },
        { status: 400 }
      );
    }

    // Get processing queue entry
    const queue = await prisma.processingQueue.findFirst({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
      include: {
        Document: {
          select: {
            name: true,
            fileName: true,
          },
        },
      },
    });

    if (!queue) {
      return NextResponse.json(
        { error: 'No processing queue found for this document' },
        { status: 404 }
      );
    }

    // Parse provider breakdown from metadata
    const metadata = queue.metadata as any;
    const providerBreakdown = metadata?.providerBreakdown || [];

    // Calculate estimated completion time
    let estimatedCompletionTime: string | undefined;
    if (queue.status === ProcessingQueueStatus.processing && providerBreakdown.length > 0) {
      // Calculate average time per page across all providers
      const totalTime = providerBreakdown.reduce(
        (sum: number, p: any) => sum + p.pagesProcessed * p.avgTimePerPage,
        0
      );
      const totalPages = providerBreakdown.reduce(
        (sum: number, p: any) => sum + p.pagesProcessed,
        0
      );
      const avgTimePerPage = totalPages > 0 ? totalTime / totalPages : 10; // Default 10s

      const remainingPages = queue.totalPages - queue.pagesProcessed;
      const estimatedSeconds = remainingPages * avgTimePerPage;
      estimatedCompletionTime = new Date(
        Date.now() + estimatedSeconds * 1000
      ).toISOString();
    }

    const stats = {
      documentId: queue.documentId,
      documentName: queue.Document.name || queue.Document.fileName || 'Unknown',
      status: queue.status,
      totalPages: queue.totalPages,
      pagesProcessed: queue.pagesProcessed,
      currentBatch: queue.currentBatch,
      totalBatches: queue.totalBatches,
      providerBreakdown: providerBreakdown.map((p: any) => ({
        provider: p.provider,
        pagesProcessed: p.pagesProcessed,
        avgTimePerPage: p.avgTimePerPage,
      })),
      startedAt: queue.createdAt.toISOString(),
      estimatedCompletionTime,
      lastError: queue.lastError || undefined,
    };

    return NextResponse.json(stats);
  } catch (error: any) {
    logger.error('Failed to fetch processing stats', error);
    return NextResponse.json(
      { error: 'Failed to fetch processing stats' },
      { status: 500 }
    );
  }
}
