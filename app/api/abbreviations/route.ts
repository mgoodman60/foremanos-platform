/**
 * API Route: Construction Abbreviations
 * GET /api/abbreviations
 * 
 * Provides access to construction industry standard abbreviations.
 * Used for improving extraction accuracy and document understanding.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ALL_CONSTRUCTION_ABBREVIATIONS,
  expandAbbreviation,
  isKnownAbbreviation,
  getAbbreviationsByCategory,
  searchAbbreviations,
  getAbbreviationStats,
  AbbreviationCategory
} from '@/lib/construction-abbreviations';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'list';
    const query = searchParams.get('query') || '';
    const category = searchParams.get('category') || '';
    const abbr = searchParams.get('abbr') || '';

    switch (action) {
      case 'list': {
        return NextResponse.json({
          success: true,
          abbreviations: ALL_CONSTRUCTION_ABBREVIATIONS,
          total: ALL_CONSTRUCTION_ABBREVIATIONS.length
        });
      }

      case 'search': {
        if (!query) {
          return NextResponse.json({ error: 'Query required' }, { status: 400 });
        }
        const results = searchAbbreviations(query);
        return NextResponse.json({
          success: true,
          results,
          count: results.length
        });
      }

      case 'category': {
        if (!category) {
          return NextResponse.json({ error: 'Category required' }, { status: 400 });
        }
        const abbreviations = getAbbreviationsByCategory(category as AbbreviationCategory);
        return NextResponse.json({
          success: true,
          abbreviations,
          count: abbreviations.length
        });
      }

      case 'expand': {
        if (!abbr) {
          return NextResponse.json({ error: 'Abbreviation required' }, { status: 400 });
        }
        const expansion = expandAbbreviation(abbr);
        const known = isKnownAbbreviation(abbr);
        return NextResponse.json({
          success: true,
          abbreviation: abbr,
          expansion,
          known
        });
      }

      case 'stats': {
        const stats = getAbbreviationStats();
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
    console.error('[ABBREVIATIONS API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
