import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import {
  findSymbolByCode,
  searchSymbols,
  getSymbolsByTrade,
  getLibraryStats,
  ALL_STANDARD_SYMBOLS,
  Trade
} from '@/lib/symbol-libraries';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SYMBOLS');

/**
 * GET /api/projects/[slug]/symbols
 * Symbol library lookup and search
 */
export async function GET(req: NextRequest, { params: _params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'list';
    const query = searchParams.get('query') || '';
    const code = searchParams.get('code') || '';
    const trade = searchParams.get('trade') || '';

    switch (action) {
      case 'list': {
        return NextResponse.json({
          success: true,
          symbols: ALL_STANDARD_SYMBOLS,
          total: ALL_STANDARD_SYMBOLS.length
        });
      }

      case 'search': {
        if (!query) {
          return NextResponse.json({ error: 'Query required' }, { status: 400 });
        }
        const results = searchSymbols(query);
        return NextResponse.json({
          success: true,
          results,
          count: results.length
        });
      }

      case 'code': {
        if (!code) {
          return NextResponse.json({ error: 'Code required' }, { status: 400 });
        }
        const symbol = findSymbolByCode(code);
        return NextResponse.json({
          success: true,
          symbol
        });
      }

      case 'trade': {
        if (!trade) {
          return NextResponse.json({ error: 'Trade required' }, { status: 400 });
        }
        const symbols = getSymbolsByTrade(trade as Trade);
        return NextResponse.json({
          success: true,
          symbols,
          count: symbols.length
        });
      }

      case 'stats': {
        const stats = getLibraryStats();
        return NextResponse.json({
          success: true,
          stats
        });
      }

      default: {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
      }
    }

  } catch (error) {
    logger.error('Failed to get symbols', error);
    return NextResponse.json(
      { error: 'Failed to get symbols' },
      { status: 500 }
    );
  }
}
