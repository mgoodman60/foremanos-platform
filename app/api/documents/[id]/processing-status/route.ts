import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getProcessingStatus } from '@/lib/document-processing-queue';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const documentId = params.id;

    // Get document with chunks count
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        name: true,
        processed: true,
        pagesProcessed: true,
        _count: {
          select: { DocumentChunk: true },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Get queue status
    const queueStatus = await getProcessingStatus(documentId);

    return NextResponse.json({
      document: {
        id: document.id,
        name: document.name,
        processed: document.processed,
        pagesProcessed: document.pagesProcessed || 0,
        chunksCreated: document._count.DocumentChunk,
      },
      queue: queueStatus ? {
        status: queueStatus.status,
        totalPages: queueStatus.totalPages,
        pagesProcessed: queueStatus.pagesProcessed,
        currentBatch: queueStatus.currentBatch,
        totalBatches: queueStatus.totalBatches,
        progress: Math.round((queueStatus.pagesProcessed / queueStatus.totalPages) * 100),
        lastError: queueStatus.lastError,
        retriesCount: queueStatus.retriesCount,
        createdAt: queueStatus.createdAt,
        updatedAt: queueStatus.updatedAt,
      } : null,
    });
  } catch (error: any) {
    console.error('[PROCESSING STATUS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get processing status' },
      { status: 500 }
    );
  }
}
