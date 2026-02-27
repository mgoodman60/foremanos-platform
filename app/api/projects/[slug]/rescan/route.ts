/**
 * Project-level rescan endpoint
 * Re-processes all documents in a project and regenerates takeoffs
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { downloadFile } from '@/lib/s3';
import { getDocumentMetadata } from '@/lib/document-processor';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limiter';
import { tasks } from '@trigger.dev/sdk/v3';
import type { processDocumentTask } from '@/src/trigger/process-document';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    // 1. Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse body for mode (before rate limit so we can use mode-aware limits)
    const body = await request.json().catch(() => ({}));
    const mode = (body as Record<string, unknown>)?.mode === 'improve' ? 'improve' : 'full';
    const targetScore = typeof (body as Record<string, unknown>)?.targetScore === 'number'
      ? (body as Record<string, unknown>).targetScore as number : 60;
    const documentIds = Array.isArray((body as Record<string, unknown>)?.documentIds)
      ? (body as Record<string, unknown>).documentIds as string[] : null;
    const includeDeadLetter = !!(body as Record<string, unknown>)?.includeDeadLetter;

    // Rate limit — mode-aware (improve: 5/hour, full: 2/hour)
    const rateLimit = mode === 'improve'
      ? { maxRequests: 5, windowSeconds: 3600 }
      : { maxRequests: 2, windowSeconds: 3600 };
    const rateLimitCheck = await checkRateLimit(`rescan:${params.slug}:${mode}`, rateLimit);
    if (!rateLimitCheck.success) {
      return NextResponse.json(
        { error: 'Rate limited. Please wait before rescanning.' },
        { status: 429 }
      );
    }

    // 3. Project access check
    const project = await prisma.project.findFirst({
      where: {
        slug: params.slug,
        OR: [
          { ownerId: session.user.id },
          { ProjectMember: { some: { userId: session.user.id } } },
        ],
      },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Handle improve mode (selective re-extraction of low-quality pages)
    if (mode === 'improve') {
      const { correctExtraction } = await import('@/lib/extraction-corrector');
      const { performQualityCheck } = await import('@/lib/vision-api-quality');

      const docWhere: Record<string, unknown> = { projectId: project.id, processed: true };
      if (documentIds && Array.isArray(documentIds)) {
        docWhere.id = { in: documentIds };
      }

      const docs = await prisma.document.findMany({
        where: docWhere,
        select: { id: true, name: true },
      });

      let totalImproved = 0;
      let totalRetried = 0;

      for (const doc of docs) {
        const chunkWhere: Record<string, unknown> = { documentId: doc.id };
        if (includeDeadLetter) {
          chunkWhere.OR = [
            { qualityScore: { lt: targetScore } },
            { isDeadLetter: true },
          ];
        } else {
          chunkWhere.qualityScore = { lt: targetScore };
          chunkWhere.isDeadLetter = false;
        }

        const lowChunks = await prisma.documentChunk.findMany({
          where: chunkWhere,
          orderBy: { qualityScore: 'asc' },
          take: 50,
        });

        for (const chunk of lowChunks) {
          if (!chunk.pageNumber) continue;
          totalRetried++;
          try {
            let existingData: Record<string, unknown>;
            try { existingData = JSON.parse(chunk.content); } catch { continue; }
            const beforeQuality = performQualityCheck(existingData, chunk.pageNumber);
            const correction = await correctExtraction(
              existingData, beforeQuality, chunk.pageNumber,
              chunk.discipline || 'Unknown', { timeout: 30000 }
            );
            if (correction.improved) {
              totalImproved++;
              const history = (chunk.qualityHistory as unknown[] || []);
              history.push({
                attempt: 'improve-mode',
                score: correction.qualityAfter,
                provider: correction.correctionProvider,
                timestamp: new Date().toISOString(),
              });
              await prisma.documentChunk.update({
                where: { id: chunk.id },
                data: {
                  content: JSON.stringify(correction.correctedData),
                  qualityScore: correction.qualityAfter,
                  qualityPassed: correction.qualityAfter >= 40,
                  correctionAttempts: { increment: 1 },
                  isDeadLetter: correction.qualityAfter < 40,
                  deadLetterReason: correction.qualityAfter < 40
                    ? `Score ${correction.qualityAfter} after improve`
                    : null,
                  qualityHistory: history as unknown as Prisma.InputJsonValue,
                  correctionCost: { increment: correction.estimatedCost },
                },
              });
            }
          } catch (err) {
            logger.warn('RESCAN_IMPROVE', `Failed to improve page ${chunk.pageNumber} in doc ${doc.id}`, {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        // Update document quality stats
        const allChunks = await prisma.documentChunk.findMany({
          where: { documentId: doc.id },
          select: { qualityScore: true, isDeadLetter: true, correctionAttempts: true },
        });
        const scores = allChunks.filter(c => c.qualityScore != null).map(c => c.qualityScore!);
        const avgScore = scores.length > 0
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : null;
        await prisma.document.update({
          where: { id: doc.id },
          data: {
            avgQualityScore: avgScore,
            lowQualityPageCount: scores.filter(s => s < 40).length,
            deadLetterPageCount: allChunks.filter(c => c.isDeadLetter).length,
            correctionPassesRun: allChunks.reduce((sum, c) => sum + (c.correctionAttempts || 0), 0),
            lastQualityCheckAt: new Date(),
          },
        });
      }

      return NextResponse.json({
        success: true,
        mode: 'improve',
        documentsProcessed: docs.length,
        pagesRetried: totalRetried,
        pagesImproved: totalImproved,
      });
    }

    // 4. Find all processed documents in project
    const documents = await prisma.document.findMany({
      where: { projectId: project.id, processed: true },
      select: { id: true, name: true, fileName: true, cloud_storage_path: true, processedAt: true },
    });

    if (documents.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No processed documents to rescan.',
        documentsQueued: 0,
      });
    }

    // 5. Queue each document for reprocessing
    let queued = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const doc of documents) {
      try {
        // Get document metadata before resetting
        let totalPages = 1;
        let processorType: 'vision-ai' | 'claude-haiku-ocr' | 'basic-ocr' = 'vision-ai';

        if (doc.cloud_storage_path) {
          try {
            const buffer = await downloadFile(doc.cloud_storage_path);
            const fileExtension = doc.fileName.split('.').pop()?.toLowerCase() || 'pdf';
            const metadata = await getDocumentMetadata(buffer, doc.fileName, fileExtension);
            totalPages = metadata.totalPages;
            processorType = metadata.processorType;
            logger.info('RESCAN', 'Document metadata retrieved', { documentId: doc.id, totalPages, processorType });
          } catch (metadataError) {
            logger.warn('RESCAN', `Failed to get metadata for ${doc.id}, using defaults`, {
              error: metadataError instanceof Error ? metadataError.message : String(metadataError),
            });
          }
        }

        // Reset document and trigger processing
        await prisma.$transaction([
          prisma.documentChunk.deleteMany({ where: { documentId: doc.id } }),
          prisma.processingQueue.deleteMany({ where: { documentId: doc.id } }),
          prisma.document.update({
            where: { id: doc.id },
            data: { processed: false, pagesProcessed: 0, queueStatus: 'queued', processorType },
          }),
        ]);

        // Trigger via Trigger.dev
        const handle = await tasks.trigger<typeof processDocumentTask>('process-document', {
          documentId: doc.id,
          totalPages,
          processorType,
        });
        logger.info('RESCAN', 'Trigger.dev task triggered', { documentId: doc.id, runId: handle.id });

        queued++;
      } catch (err) {
        skipped++;
        errors.push(doc.name || doc.id);
        logger.warn('RESCAN', `Failed to queue document ${doc.id}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('RESCAN', 'Project rescan initiated', {
      projectId: project.id,
      documentsQueued: queued,
      documentsSkipped: skipped,
    });

    return NextResponse.json({
      success: true,
      message: `${queued} document(s) queued for re-analysis. Results will update automatically.`,
      documentsQueued: queued,
      documentsSkipped: skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    logger.error('RESCAN', 'Error initiating project rescan', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to start rescan' },
      { status: 500 }
    );
  }
}
