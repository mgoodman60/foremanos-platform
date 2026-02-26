import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
        createdAt: true,
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
        updatedAt: true,
        metadata: true,
      }
    });

    // Return "initializing" status for newly created documents without queue entry
    if (!queueEntry && !document.processed && document.queueStatus !== 'failed') {
      const ageMs = Date.now() - new Date(document.createdAt).getTime();
      if (ageMs < 5 * 60 * 1000) {
        return NextResponse.json({
          status: 'initializing',
          currentPhase: 'initializing',
          pagesProcessed: 0,
          totalPages: 0,
          percentComplete: 0,
          estimatedTimeRemaining: null,
          queuePosition: null,
          secondsPerPage: 8,
          elapsedSeconds: Math.round(ageMs / 1000),
        });
      }
    }

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
        currentPhase = 'analyzing';
      } else if (percentComplete < 80) {
        currentPhase = 'analyzing';
      } else {
        currentPhase = 'indexing';
      }
    } else if (document.queueStatus === 'completed') {
      currentPhase = 'completed';
    }

    // Parse metadata for timing data
    const metadata = (queueEntry?.metadata as Record<string, unknown>) ?? {};
    const queuedAt = metadata.queuedAt as string | undefined;
    const providerBreakdown = metadata.providerBreakdown as Record<string, { avgTimePerPage?: number; pagesProcessed?: number }> | undefined;

    // Calculate elapsed time
    const startTime = queuedAt ? new Date(queuedAt) : queueEntry?.createdAt;
    const elapsedMs = startTime ? Date.now() - new Date(startTime).getTime() : 0;
    const elapsedSeconds = Math.round(elapsedMs / 1000);

    // Calculate seconds per page using available data
    let secondsPerPage = 8; // default
    if (providerBreakdown) {
      // Weighted average from provider breakdown
      let totalWeightedTime = 0;
      let totalProviderPages = 0;
      for (const provider of Object.values(providerBreakdown)) {
        if (provider.avgTimePerPage && provider.pagesProcessed) {
          totalWeightedTime += provider.avgTimePerPage * provider.pagesProcessed;
          totalProviderPages += provider.pagesProcessed;
        }
      }
      if (totalProviderPages > 0) {
        secondsPerPage = Math.max(3, Math.min(30, totalWeightedTime / totalProviderPages));
      }
    } else if (pagesProcessed > 0 && elapsedSeconds > 0) {
      // Fall back to wall-clock measurement
      secondsPerPage = Math.max(3, Math.min(30, elapsedSeconds / pagesProcessed));
    }

    const remainingPages = totalPages - pagesProcessed;
    const estimatedTimeRemaining = remainingPages > 0 ? Math.round(remainingPages * secondsPerPage) : 0;

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

    // Concurrent processing metadata
    const concurrency = (metadata.concurrency as number) ?? 1;
    const failedBatchRanges = (metadata.failedBatchRanges as Array<{ startPage: number; endPage: number; error: string }>) ?? [];
    const processingMode = (metadata.processingMode as string) ?? ((concurrency > 1) ? 'concurrent' : 'sequential');
    const activeBatches = currentPhase === 'analyzing' || currentPhase === 'extracting'
      ? Math.min((queueEntry?.totalBatches ?? 0) - (queueEntry?.currentBatch ?? 0), concurrency)
      : 0;

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
      startedAt: startTime ? new Date(startTime).toISOString() : null,
      lastActivityAt: queueEntry?.updatedAt ? new Date(queueEntry.updatedAt).toISOString() : null,
      secondsPerPage: Math.round(secondsPerPage * 10) / 10,
      elapsedSeconds,
      concurrency,
      activeBatches,
      failedBatchRanges,
      processingMode,
    });
  } catch (error) {
    logger.error('DOCUMENT_PROGRESS', 'Error fetching document progress', error as Error);
    return NextResponse.json(
      { error: 'Failed to get document progress' },
      { status: 500 }
    );
  }
}
