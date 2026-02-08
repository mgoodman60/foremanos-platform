import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/documents/processing-status
 * Returns processing status for all documents in a project
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    // Get processing status for all documents
    const documents = await prisma.document.findMany({
      where: {
        projectId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        fileName: true,
        category: true,
        processed: true,
        pagesProcessed: true,
        processingCost: true,
        queueStatus: true,
        lastProcessingError: true,
        processingRetries: true,
        processedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get queue entries for documents in processing
    const queueEntries = await prisma.processingQueue.findMany({
      where: {
        documentId: { in: documents.map((d: any) => d.id) },
      },
      select: {
        documentId: true,
        status: true,
        totalPages: true,
        pagesProcessed: true,
        currentBatch: true,
        totalBatches: true,
        lastError: true,
        retriesCount: true,
        updatedAt: true,
        metadata: true,
      },
    });

    // Create a map of queue status by document ID, enriching with metadata fields
    const queueStatusMap = new Map(
      queueEntries.map((entry: any) => {
        const meta = entry.metadata as any;
        return [entry.documentId, {
          documentId: entry.documentId,
          status: entry.status,
          totalPages: entry.totalPages,
          pagesProcessed: entry.pagesProcessed,
          currentBatch: entry.currentBatch,
          totalBatches: entry.totalBatches,
          lastError: entry.lastError,
          retriesCount: entry.retriesCount,
          updatedAt: entry.updatedAt,
          concurrency: meta?.concurrency || 3,
          activeBatches: entry.status === 'processing' ? Math.min(entry.totalBatches - entry.currentBatch, meta?.concurrency || 3) : 0,
          failedBatchRanges: meta?.failedBatchRanges || [],
          processingMode: meta?.concurrency > 1 || entry.totalBatches > 1 ? 'concurrent' : 'sequential',
        }];
      })
    );

    // Enhance documents with queue information
    const enhancedDocuments = documents.map((doc: any) => ({
      ...doc,
      queueInfo: queueStatusMap.get(doc.id) || null,
    }));

    // Calculate statistics
    const stats = {
      total: documents.length,
      completed: documents.filter((d: any) => d.processed && d.queueStatus === 'completed').length,
      processing: documents.filter((d: any) => d.queueStatus === 'processing' || d.queueStatus === 'queued').length,
      failed: documents.filter((d: any) => d.queueStatus === 'failed').length,
      pending: documents.filter((d: any) => !d.processed && d.queueStatus === 'none').length,
      totalPages: documents.reduce((sum: number, d: any) => sum + (d.pagesProcessed || 0), 0),
      totalCost: documents.reduce((sum: number, d: any) => sum + (d.processingCost || 0), 0),
    };

    return NextResponse.json({
      documents: enhancedDocuments,
      stats,
    });
  } catch (error: any) {
    console.error('[API] Error fetching processing status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch processing status' },
      { status: 500 }
    );
  }
}
