/**
 * API Route: Industry Standard Symbol Library
 * GET /api/symbol-library
 * 
 * Provides access to industry standard construction symbol definitions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  ALL_STANDARD_SYMBOLS,
  getSymbolsByTrade,
  getSymbolsByCategory,
  searchSymbols,
  findSymbolByCode,
  getLibraryStats,
  Trade
} from '@/lib/symbol-libraries';
import { SymbolCategory } from '@/lib/legend-extractor';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'list';
    const query = searchParams.get('query') || '';
    const trade = searchParams.get('trade') || '';
    const category = searchParams.get('category') || '';
    const code = searchParams.get('code') || '';

    if (query.length > 200) {
      return NextResponse.json({ error: 'Query too long' }, { status: 400 });
    }

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

      case 'category': {
        if (!category) {
          return NextResponse.json({ error: 'Category required' }, { status: 400 });
        }
        const symbols = getSymbolsByCategory(category as SymbolCategory);
        return NextResponse.json({
          success: true,
          symbols,
          count: symbols.length
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
    logger.error('SYMBOL_LIBRARY', 'Error handling symbol library request', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to get symbols' },
      { status: 500 }
    );
  }
}
