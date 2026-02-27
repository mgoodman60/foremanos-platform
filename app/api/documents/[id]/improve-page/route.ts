import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { checkRateLimit } from '@/lib/rate-limiter';
import { correctExtraction } from '@/lib/extraction-corrector';
import { performQualityCheck, type ExtractedData } from '@/lib/vision-api-quality';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitCheck = await checkRateLimit(`improve:${session.user.id}`, { maxRequests: 10, windowSeconds: 3600 });
    if (!rateLimitCheck.success) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const body = await req.json();
    const { pageNumber } = body;
    if (!pageNumber || typeof pageNumber !== 'number') {
      return NextResponse.json({ error: 'pageNumber required' }, { status: 400 });
    }

    const documentId = params.id;
    const chunk = await prisma.documentChunk.findFirst({
      where: { documentId, pageNumber },
    });

    if (!chunk) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    let existingData: ExtractedData;
    try {
      existingData = JSON.parse(chunk.content);
    } catch {
      return NextResponse.json({ error: 'Cannot parse existing page data' }, { status: 400 });
    }

    const beforeQuality = performQualityCheck(existingData, pageNumber);

    const correction = await correctExtraction(
      existingData, beforeQuality, pageNumber,
      chunk.discipline || 'Unknown',
      { timeout: 30000 }
    );

    const afterQuality = performQualityCheck(correction.correctedData, pageNumber);

    // Update chunk
    const history = (chunk.qualityHistory as unknown[] || []);
    history.push({
      attempt: 'manual-improve',
      score: afterQuality.score,
      provider: correction.correctionProvider,
      timestamp: new Date().toISOString(),
    });

    await prisma.documentChunk.update({
      where: { id: chunk.id },
      data: {
        content: JSON.stringify(correction.correctedData),
        qualityScore: afterQuality.score,
        qualityPassed: afterQuality.passed,
        correctionAttempts: { increment: 1 },
        isDeadLetter: afterQuality.score < 40 ? true : false,
        deadLetterReason: afterQuality.score < 40 ? `Still below threshold after manual retry` : null,
        qualityHistory: history as unknown as Prisma.InputJsonValue,
        correctionCost: { increment: correction.estimatedCost },
      },
    });

    return NextResponse.json({
      pageNumber,
      scoreBefore: beforeQuality.score,
      scoreAfter: afterQuality.score,
      improved: correction.improved,
      provider: correction.correctionProvider,
    });
  } catch (error) {
    logger.error('IMPROVE_PAGE', 'Error improving page', error as Error);
    return NextResponse.json({ error: 'Failed to improve page' }, { status: 500 });
  }
}
