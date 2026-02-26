/**
 * Budget Import API
 * POST /api/projects/[slug]/budget/import
 * 
 * Imports the Walker Company budget data for One Senior Care - Morehead
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { importOneSeniorCareBudget, getBudgetSummaryByPhase } from '@/lib/budget-importer';
import { enhanceProjectData } from '@/lib/project-data-enhancer';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_BUDGET_IMPORT');

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    logger.info('[Budget Import API] Starting import for project', { slug });

    // Import budget
    const importResult = await importOneSeniorCareBudget(slug);
    
    if (!importResult.success) {
      return NextResponse.json({ 
        error: importResult.error || 'Import failed' 
      }, { status: 500 });
    }

    // Run enhancement after budget import
    const enhanceResult = await enhanceProjectData(slug);

    // Get summary
    const summary = await getBudgetSummaryByPhase(slug);

    return NextResponse.json({
      success: true,
      import: {
        itemsCreated: importResult.itemsCreated,
        totalBudget: importResult.totalBudget,
      },
      enhancement: enhanceResult.improvements,
      summary: summary.phases,
      totalBudgeted: summary.totalBudgeted,
      totalActual: summary.totalActual,
    });

  } catch (error) {
    logger.error('[Budget Import API] Error', error);
    return NextResponse.json(
      { error: `Import failed: ${error}` },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const summary = await getBudgetSummaryByPhase(slug);

    return NextResponse.json({
      phases: summary.phases,
      totalBudgeted: summary.totalBudgeted,
      totalActual: summary.totalActual,
      contractAmount: 2985000,
    });

  } catch (error) {
    logger.error('[Budget API] Error', error);
    return NextResponse.json(
      { error: `Failed to get budget: ${error}` },
      { status: 500 }
    );
  }
}
