import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getSheetIndex } from '@/lib/title-block-extractor';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SHEET_INDEX');

/**
 * GET /api/projects/[slug]/sheet-index
 * 
 * Returns a complete sheet index for the project with title block metadata
 */
export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Get sheet index
    const sheets = await getSheetIndex(slug);

    // Group by discipline
    const byDiscipline = sheets.reduce((acc: any, sheet) => {
      const discipline = sheet.discipline || 'UNKNOWN';
      if (!acc[discipline]) {
        acc[discipline] = [];
      }
      acc[discipline].push(sheet);
      return acc;
    }, {});

    // Get statistics
    const stats = {
      totalSheets: sheets.length,
      byDiscipline: Object.entries(byDiscipline).map(([discipline, sheets]: [string, any]) => ({
        discipline,
        count: sheets.length
      })),
      latestRevision: sheets.reduce((max: string, sheet) => {
        return sheet.revision > max ? sheet.revision : max;
      }, '0'),
      dateRange: {
        earliest: sheets
          .filter(s => s.dateIssued)
          .sort((a, b) => (a.dateIssued! < b.dateIssued! ? -1 : 1))[0]?.dateIssued || null,
        latest: sheets
          .filter(s => s.dateIssued)
          .sort((a, b) => (a.dateIssued! > b.dateIssued! ? -1 : 1))[0]?.dateIssued || null
      }
    };

    return NextResponse.json({
      success: true,
      sheets,
      byDiscipline,
      stats
    });
  } catch (error) {
    logger.error('Sheet index error', error);
    return NextResponse.json(
      { error: 'Failed to get sheet index' },
      { status: 500 }
    );
  }
}
