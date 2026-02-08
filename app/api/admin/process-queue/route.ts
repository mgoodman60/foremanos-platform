import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { processNextQueuedBatch } from '@/lib/document-processing-queue';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * Admin endpoint to manually trigger queue processing
 * Can be called by cron job or manually
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    // Allow admin users or check for internal cron secret
    const { searchParams } = new URL(request.url);
    const cronSecret = searchParams.get('secret');
    
    const isAdmin = session?.user?.role === 'admin';
    const isValidCron = cronSecret === process.env.CRON_SECRET;
    
    if (!isAdmin && !isValidCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[QUEUE] Manual queue processing triggered');

    // Process batches until queue is empty or error occurs
    let totalProcessed = 0;
    let continueProcessing = true;
    const maxIterations = 10; // Process max 10 batches per call
    let iterations = 0;

    while (continueProcessing && iterations < maxIterations) {
      continueProcessing = await processNextQueuedBatch();
      if (continueProcessing) {
        totalProcessed++;
      }
      iterations++;
    }

    return NextResponse.json({
      success: true,
      batchesProcessed: totalProcessed,
      message: `Processed ${totalProcessed} batches`,
    });
  } catch (error: any) {
    console.error('[QUEUE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process queue', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Get queue statistics or process queue (when called by Vercel cron)
 */
export async function GET(request: Request) {
  try {
    // Check if this is a Vercel cron invocation
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isCronRequest = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (isCronRequest) {
      // Cron invocation: process the queue
      console.log('[QUEUE] Cron-triggered queue processing');

      let totalProcessed = 0;
      let continueProcessing = true;
      const maxIterations = 10;
      let iterations = 0;

      while (continueProcessing && iterations < maxIterations) {
        continueProcessing = await processNextQueuedBatch();
        if (continueProcessing) {
          totalProcessed++;
        }
        iterations++;
      }

      return NextResponse.json({
        success: true,
        batchesProcessed: totalProcessed,
        message: `Cron processed ${totalProcessed} batches`,
      });
    }

    // Non-cron: return stats (requires admin auth)
    const session = await getServerSession(authOptions);

    if (session?.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prisma } = await import('@/lib/db');

    const stats = await prisma.processingQueue.groupBy({
      by: ['status'],
      _count: true,
    });

    return NextResponse.json({ stats });
  } catch (error: any) {
    console.error('[QUEUE STATS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get queue stats' },
      { status: 500 }
    );
  }
}
