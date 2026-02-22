/**
 * Document Intelligence API
 * Aggregates all extracted intelligence data for a document (Phase A/B/C results)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { createLogger } from '@/lib/logger';
const logger = createLogger('DOCUMENTS_INTELLIGENCE');

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(`api:${session.user.id}`, RATE_LIMITS.API);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: rateLimitResult.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter || 60) } }
      );
    }

    const documentId = params.id;

    // Fetch document with project
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        Project: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Verify user has access to this project
    const userId = session.user.id;
    const userRole = (session.user as any).role;
    const isAdmin = userRole === 'admin';

    if (!isAdmin && document.Project) {
      const projectAccess = await prisma.project.findFirst({
        where: {
          id: document.projectId,
          OR: [
            { ownerId: userId },
            { ProjectMember: { some: { userId } } },
          ],
        },
        select: { id: true },
      });

      if (!projectAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Parallel data fetching for all intelligence types
    const [
      chunks,
      drawingTypes,
      dimensions,
      detailCallouts,
      legends,
      annotations,
      rooms,
      doors,
      windows,
      materialTakeoffs,
    ] = await Promise.all([
      prisma.documentChunk.findMany({
        where: { documentId },
        orderBy: { pageNumber: 'asc' },
        take: 500,
      }),
      prisma.drawingType.findMany({
        where: { documentId },
        orderBy: { extractedAt: 'desc' },
        take: 500,
      }),
      prisma.dimensionAnnotation.findMany({
        where: { documentId },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.detailCallout.findMany({
        where: { documentId },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.sheetLegend.findMany({
        where: { documentId },
        orderBy: { extractedAt: 'desc' },
        take: 500,
      }),
      prisma.enhancedAnnotation.findMany({
        where: { documentId },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.room.findMany({
        where: { sourceDocumentId: documentId },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.doorScheduleItem.findMany({
        where: { sourceDocumentId: documentId },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.windowScheduleItem.findMany({
        where: { sourceDocumentId: documentId },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.materialTakeoff.findMany({
        where: { documentId },
        include: { TakeoffLineItem: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    ]);

    // Build sheets array from chunks
    const sheets = chunks.map((chunk) => {
      const metadata = chunk.metadata as any;
      const scaleData = chunk.scaleData as any;

      return {
        sheetNumber: chunk.sheetNumber,
        pageNumber: chunk.pageNumber,
        discipline: chunk.discipline,
        scale: scaleData?.scale || null,
        titleBlockData: metadata?.titleBlockData || null,
        spatialData: metadata?.spatialData || null,
        visualMaterials: metadata?.visualMaterials || null,
        plumbingFixtures: metadata?.plumbingFixtures || null,
        electricalDevices: metadata?.electricalDevices || null,
        drawingScheduleTables: metadata?.drawingScheduleTables || null,
        constructionIntel: metadata?.constructionIntel || null,
        symbolData: metadata?.symbolData || null,
        lineTypeAnalysis: metadata?.lineTypeAnalysis || null,
        hvacData: metadata?.hvacData || null,
        fireProtection: metadata?.fireProtection || null,
        siteAndConcrete: metadata?.siteAndConcrete || null,
        references: metadata?.references || null,
        enhancedScaleData: metadata?.enhancedScaleData || null,
        specialDrawingData: metadata?.specialDrawingData || null,
        finishColors: metadata?.finishColors || null,
        keynotes: metadata?.keynotes || null,
        scheduleData: metadata?.scheduleData || null,
        csiReferences: metadata?.csiReferences || null,
        ductSizing: metadata?.ductSizing || null,
        pipeSizing: metadata?.pipeSizing || null,
        noteClauses: metadata?.noteClauses || null,
      };
    });

    // Build summary stats
    const summary = {
      totalSheets: sheets.length,
      disciplineBreakdown: sheets.reduce((acc, s) => {
        if (s.discipline) {
          acc[s.discipline] = (acc[s.discipline] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>),
      drawingTypeBreakdown: drawingTypes.reduce((acc, dt) => {
        acc[dt.type] = (acc[dt.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      averageConfidence:
        drawingTypes.length > 0
          ? drawingTypes.reduce((sum, dt) => sum + (dt.confidence || 0), 0) /
            drawingTypes.length
          : chunks.some((c: any) => c.drawingTypeConfidence != null)
          ? chunks.filter((c: any) => c.drawingTypeConfidence != null)
              .reduce((sum: number, c: any) => sum + (c.drawingTypeConfidence || 0), 0) /
            chunks.filter((c: any) => c.drawingTypeConfidence != null).length
          : null,
      lowConfidenceCount: drawingTypes.filter((dt) => (dt.confidence || 0) < 0.5)
        .length,
      fixtureCount: sheets.reduce(
        (sum, s) =>
          sum +
          (s.plumbingFixtures?.length || 0) +
          (s.electricalDevices?.length || 0),
        0
      ),
      roomCount: rooms.length,
    };

    // Build processing log (handle optional fields safely)
    const docWithProcessing = document as any;
    const processingLog = {
      phasesCompleted: docWithProcessing.processedPhases || [],
      totalDuration: docWithProcessing.processingDuration || null,
      pagesProcessed: chunks.length,
      processingDate: docWithProcessing.processedAt || null,
      errors: [],
      cost: docWithProcessing.processingCost || null,
    };

    // Aggregate vision pipeline tier data from chunk metadata
    const tierBreakdown: Record<string, number> = {};
    for (const chunk of chunks) {
      const meta = chunk.metadata as any;
      const tier = meta?.processingTier || 'unknown';
      tierBreakdown[tier] = (tierBreakdown[tier] || 0) + 1;
    }
    const visionPipeline = {
      tierBreakdown,
      totalPages: chunks.length,
    };

    // Return aggregated intelligence data
    return NextResponse.json({
      document: {
        id: document.id,
        name: document.name,
        fileName: document.fileName,
        category: document.category,
        pageCount: document.pagesProcessed || 0,
        processed: document.processed,
        sheetIndex: document.sheetIndex,
      },
      sheets,
      drawingTypes,
      dimensions,
      detailCallouts,
      legends,
      enhancedAnnotations: annotations,
      rooms,
      doors,
      windows,
      materialTakeoffs,
      summary,
      processingLog,
      visionPipeline,
    });
  } catch (error) {
    logger.error('Error fetching document intelligence', error);
    return NextResponse.json(
      { error: 'Failed to fetch document intelligence' },
      { status: 500 }
    );
  }
}
