/**
 * Scope Gap Analysis API
 * Analyzes gaps between project requirements and subcontractor quotes
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { 
  analyzeScopeGaps, 
  analyzeTradeGaps,
  getProjectGapSummary 
} from '@/lib/scope-gap-analysis-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_QUOTES_SCOPE_GAPS');

// GET - Fetch gap summary or analysis for specific trade
export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const tradeType = searchParams.get('tradeType');
    const summaryOnly = searchParams.get('summary') === 'true';

    if (summaryOnly) {
      // Return summary of gaps by trade
      const summary = await getProjectGapSummary(project.id);
      return NextResponse.json(summary);
    }

    if (tradeType) {
      // Analyze specific trade
      const analysis = await analyzeTradeGaps(project.id, tradeType);
      return NextResponse.json(analysis);
    }

    // Full project analysis
    const analysis = await analyzeScopeGaps(project.id);
    return NextResponse.json(analysis);

  } catch (error) {
    logger.error('[SCOPE-GAP-API] Error', error);
    return NextResponse.json(
      { error: 'Failed to analyze scope gaps' },
      { status: 500 }
    );
  }
}

// POST - Run analysis with specific options
export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const { tradeType, quoteIds } = body;

    const analysis = await analyzeScopeGaps(project.id, {
      tradeType,
      quoteIds,
    });

    return NextResponse.json(analysis);

  } catch (error) {
    logger.error('[SCOPE-GAP-API] Error', error);
    return NextResponse.json(
      { error: 'Failed to analyze scope gaps' },
      { status: 500 }
    );
  }
}
