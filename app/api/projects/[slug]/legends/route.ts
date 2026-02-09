import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  getProjectLegends,
  buildProjectLegendLibrary,
  searchSymbol,
  validateSymbolUsage,
  getLegendStatistics
} from '@/lib/legend-extractor';
import { createScopedLogger } from '@/lib/logger';

const log = createScopedLogger('LEGENDS_API');

/**
 * GET /api/projects/[slug]/legends
 *
 * Returns legends for the project
 *
 * Query params:
 * - action: 'list' | 'library' | 'search' | 'validate' | 'stats'
 * - query: search query (for action=search)
 */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'list';
    const query = searchParams.get('query') || '';

    switch (action) {
      case 'list': {
        const legends = await getProjectLegends(slug);
        return NextResponse.json({
          success: true,
          legends
        });
      }

      case 'library': {
        const library = await buildProjectLegendLibrary(slug);
        return NextResponse.json({
          success: true,
          library
        });
      }

      case 'search': {
        if (!query) {
          return NextResponse.json(
            { error: 'Query parameter required for search' },
            { status: 400 }
          );
        }
        const results = await searchSymbol(slug, query);
        return NextResponse.json({
          success: true,
          results,
          count: results.length
        });
      }

      case 'validate': {
        const validation = await validateSymbolUsage(slug);
        return NextResponse.json({
          success: true,
          validation
        });
      }

      case 'stats': {
        const legends = await getProjectLegends(slug);
        const stats = getLegendStatistics(legends);

        // Calculate coverage: sheets with legends vs total distinct sheets
        const allChunksWithSheets = await prisma.documentChunk.findMany({
          where: {
            Document: { Project: { slug } },
            sheetNumber: { not: null }
          },
          select: { sheetNumber: true },
          distinct: ['sheetNumber']
        });
        const totalSheetCount = allChunksWithSheets.length;
        const coveragePercent = totalSheetCount > 0
          ? Math.round((stats.totalLegends / totalSheetCount) * 100)
          : 0;

        return NextResponse.json({
          success: true,
          stats: { ...stats, coveragePercent }
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    log.error('Failed to process legend request', error as Error);
    return NextResponse.json(
      { error: 'Failed to process legend request' },
      { status: 500 }
    );
  }
}
