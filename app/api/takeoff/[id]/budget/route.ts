/**
 * Takeoff-Budget Integration API
 * 
 * GET: Get budget summary from takeoff
 * POST: Sync takeoff to budget or create new budget
 */

import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  prepareTakeoffForBudget,
  syncTakeoffToBudget,
  createBudgetFromTakeoff,
  getTakeoffBudgetSummary,
  generateVarianceReport,
  updateBudgetFromTakeoff,
} from '@/lib/takeoff-budget-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('TAKEOFF_BUDGET');

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'summary';
    const budgetId = searchParams.get('budgetId');
    const region = searchParams.get('region') || 'default';

    // Verify takeoff exists
    const takeoff = await prisma.materialTakeoff.findUnique({
      where: { id: params.id },
      include: {
        TakeoffLineItem: true,
        Project: {
          include: {
            ProjectBudget: true,
          },
        },
      },
    });

    if (!takeoff) {
      return NextResponse.json({ error: 'Takeoff not found' }, { status: 404 });
    }

    // Get project budget (there's only one per project)
    const projectBudget = takeoff.Project.ProjectBudget;

    switch (action) {
      case 'summary':
        const summary = await getTakeoffBudgetSummary(params.id, region);
        return NextResponse.json({
          success: true,
          summary,
          availableBudgets: projectBudget ? [{
            id: projectBudget.id,
            name: `Project Budget`,
            totalBudget: projectBudget.totalBudget,
            createdAt: projectBudget.createdAt,
          }] : [],
        });

      case 'preview':
        const previewItems = await prepareTakeoffForBudget(params.id, region);
        return NextResponse.json({
          success: true,
          items: previewItems,
          totalCount: previewItems.length,
          totals: {
            material: previewItems.reduce((s, i) => s + i.materialCost, 0),
            labor: previewItems.reduce((s, i) => s + i.laborCost, 0),
            total: previewItems.reduce((s, i) => s + i.totalCost, 0),
          },
        });

      case 'variance':
        if (!budgetId) {
          return NextResponse.json({ error: 'budgetId required for variance report' }, { status: 400 });
        }
        const varianceReport = await generateVarianceReport(params.id, budgetId);
        return NextResponse.json({
          success: true,
          report: varianceReport,
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    logger.error('[Takeoff Budget API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      action = 'sync',
      budgetId,
      budgetName,
      region = 'default',
      contingencyPercent = 10,
      overwriteExisting = false,
      updateMode = 'add-new',
    } = body;

    // Verify takeoff exists
    const takeoff = await prisma.materialTakeoff.findUnique({
      where: { id: params.id },
      include: {
        Project: true,
        TakeoffLineItem: true,
      },
    });

    if (!takeoff) {
      return NextResponse.json({ error: 'Takeoff not found' }, { status: 404 });
    }

    switch (action) {
      case 'create-budget':
        // Create a new budget from takeoff
        if (!budgetName) {
          return NextResponse.json(
            { error: 'budgetName required for creating budget' },
            { status: 400 }
          );
        }

        const createResult = await createBudgetFromTakeoff(
          params.id,
          takeoff.projectId,
          budgetName,
          { region, contingencyPercent }
        );

        return NextResponse.json({
          success: true,
          action: 'create-budget',
          budgetId: createResult.budgetId,
          syncResult: createResult.syncResult,
        });

      case 'sync':
        // Sync to existing budget
        if (!budgetId) {
          return NextResponse.json(
            { error: 'budgetId required for sync' },
            { status: 400 }
          );
        }

        const syncResult = await syncTakeoffToBudget(params.id, budgetId, {
          overwriteExisting,
          region,
          linkItems: true,
        });

        return NextResponse.json({
          success: syncResult.success,
          action: 'sync',
          result: syncResult,
        });

      case 'update':
        // Update existing budget from takeoff changes
        if (!budgetId) {
          return NextResponse.json(
            { error: 'budgetId required for update' },
            { status: 400 }
          );
        }

        const updateResult = await updateBudgetFromTakeoff(params.id, budgetId, {
          region,
          updateMode,
        });

        return NextResponse.json({
          success: updateResult.success,
          action: 'update',
          result: updateResult,
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    logger.error('[Takeoff Budget API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}
