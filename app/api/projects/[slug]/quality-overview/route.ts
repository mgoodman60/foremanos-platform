import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { getProjectIntelligenceMetrics, calculateIntelligenceScore } from '@/lib/intelligence-score-calculator';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, props: { params: Promise<{ slug: string }> }) {
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

    // Get intelligence score
    const metrics = await getProjectIntelligenceMetrics(project.id);
    const intelligenceScore = calculateIntelligenceScore(metrics);

    // Get per-document quality data
    const documents = await prisma.document.findMany({
      where: { projectId: project.id, processed: true },
      select: {
        id: true, name: true, category: true, avgQualityScore: true,
        pagesProcessed: true, lowQualityPageCount: true, deadLetterPageCount: true,
        correctionPassesRun: true, processedAt: true, pendingQuestionCount: true,
      },
      orderBy: { name: 'asc' },
    });

    // Aggregate totals
    const docsWithScores = documents.filter(d => d.avgQualityScore != null);
    const totals = {
      totalDocuments: documents.length,
      totalPages: documents.reduce((sum, d) => sum + (d.pagesProcessed || 0), 0),
      avgQualityScore: docsWithScores.length > 0
        ? docsWithScores.reduce((sum, d) => sum + (d.avgQualityScore || 0), 0) / docsWithScores.length
        : 0,
      totalLowQuality: documents.reduce((sum, d) => sum + (d.lowQualityPageCount || 0), 0),
      totalDeadLetter: documents.reduce((sum, d) => sum + (d.deadLetterPageCount || 0), 0),
      totalCorrections: documents.reduce((sum, d) => sum + (d.correctionPassesRun || 0), 0),
      totalPendingQuestions: documents.reduce((sum, d) => sum + (d.pendingQuestionCount || 0), 0),
    };

    return NextResponse.json({
      projectId: project.id,
      intelligenceScore,
      documents: documents.map(d => ({
        id: d.id,
        name: d.name,
        category: d.category,
        avgQualityScore: d.avgQualityScore,
        totalPages: d.pagesProcessed || 0,
        lowQualityCount: d.lowQualityPageCount,
        deadLetterCount: d.deadLetterPageCount,
        correctionPassesRun: d.correctionPassesRun,
        processedAt: d.processedAt?.toISOString() || null,
        pendingQuestionCount: d.pendingQuestionCount,
      })),
      totals,
    });
  } catch (error) {
    logger.error('QUALITY_OVERVIEW', 'Error fetching quality overview', error as Error);
    return NextResponse.json({ error: 'Failed to fetch quality overview' }, { status: 500 });
  }
}
