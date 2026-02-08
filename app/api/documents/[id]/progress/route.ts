import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const documentId = params.id;

    // Get document with its project ownership info
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        processed: true,
        pagesProcessed: true,
        queueStatus: true,
        processorType: true,
        Project: {
          select: { ownerId: true }
        }
      }
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check user owns the project or is admin
    const isAdmin = session.user.role === 'admin';
    const isOwner = document.Project?.ownerId === session.user.id;
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get most recent queue entry
    const queueEntry = await prisma.processingQueue.findFirst({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
      select: {
        status: true,
        totalPages: true,
        pagesProcessed: true,
        currentBatch: true,
        totalBatches: true,
        createdAt: true,
        lastError: true,
      }
    });

    // Calculate progress
    const totalPages = queueEntry?.totalPages ?? 0;
    const pagesProcessed = queueEntry?.pagesProcessed ?? document.pagesProcessed ?? 0;
    const percentComplete = totalPages > 0 ? Math.round((pagesProcessed / totalPages) * 100) : 0;

    // Determine current phase
    let currentPhase = 'queued';
    if (document.processed) {
      currentPhase = 'completed';
    } else if (queueEntry?.status === 'failed' || queueEntry?.lastError) {
      currentPhase = 'failed';
    } else if (queueEntry?.status === 'processing') {
      if (pagesProcessed === 0) {
        currentPhase = 'extracting';
      } else if (percentComplete < 80) {
        currentPhase = 'analyzing';
      } else {
        currentPhase = 'indexing';
      }
    } else if (document.queueStatus === 'completed') {
      currentPhase = 'completed';
    }

    // Estimate time remaining (~3s per page for vision processing)
    const remainingPages = totalPages - pagesProcessed;
    const estimatedTimeRemaining = remainingPages > 0 ? remainingPages * 3 : 0;

    // Queue position (count docs ahead of this one)
    let queuePosition: number | null = null;
    if (currentPhase === 'queued' && queueEntry) {
      const aheadCount = await prisma.processingQueue.count({
        where: {
          status: 'queued',
          createdAt: { lt: queueEntry.createdAt }
        }
      });
      queuePosition = aheadCount + 1;
    }

    return NextResponse.json({
      status: currentPhase,
      pagesProcessed,
      totalPages,
      percentComplete,
      currentPhase,
      estimatedTimeRemaining,
      queuePosition,
      currentBatch: queueEntry?.currentBatch ?? null,
      totalBatches: queueEntry?.totalBatches ?? null,
      error: queueEntry?.lastError || null,
    });
  } catch (error) {
    console.error('[DOCUMENT PROGRESS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get document progress' },
      { status: 500 }
    );
  }
}
