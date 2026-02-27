import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResult = await checkRateLimit(`api:${session.user.id}`, RATE_LIMITS.API);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const documentId = params.id;
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true, name: true, avgQualityScore: true, pagesProcessed: true,
        lowQualityPageCount: true, deadLetterPageCount: true, correctionPassesRun: true,
        lastQualityCheckAt: true, projectId: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const chunks = await prisma.documentChunk.findMany({
      where: { documentId },
      select: {
        pageNumber: true, qualityScore: true, qualityPassed: true,
        correctionAttempts: true, isDeadLetter: true, deadLetterReason: true,
        discipline: true, sheetNumber: true, metadata: true, qualityHistory: true,
        correctionCost: true,
      },
      orderBy: { pageNumber: 'asc' },
    });

    const totalCorrectionCost = chunks.reduce((sum, c) => sum + (c.correctionCost || 0), 0);

    return NextResponse.json({
      documentId,
      documentName: document.name,
      avgQualityScore: document.avgQualityScore,
      totalPages: chunks.length,
      pagesProcessed: document.pagesProcessed || 0,
      lowQualityCount: document.lowQualityPageCount,
      deadLetterCount: document.deadLetterPageCount,
      correctionPassesRun: document.correctionPassesRun,
      totalCorrectionCost,
      pages: chunks.map(c => ({
        pageNumber: c.pageNumber,
        qualityScore: c.qualityScore,
        qualityPassed: c.qualityPassed,
        correctionAttempts: c.correctionAttempts,
        isDeadLetter: c.isDeadLetter,
        deadLetterReason: c.deadLetterReason,
        discipline: c.discipline,
        sheetNumber: c.sheetNumber,
        provider: (c.metadata as Record<string, unknown>)?.provider || null,
        qualityHistory: c.qualityHistory || [],
      })),
    });
  } catch (error) {
    logger.error('QUALITY_REPORT', 'Error fetching quality report', error as Error);
    return NextResponse.json({ error: 'Failed to fetch quality report' }, { status: 500 });
  }
}
