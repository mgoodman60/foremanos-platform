import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { processUploadedBudgetDocument, compareTakeoffsToBudget } from '@/lib/budget-auto-sync';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_BUDGET_AUTO_SYNC');

// POST /api/projects/[slug]/budget/auto-sync - Manually trigger budget sync from documents
export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Find budget documents
    const budgetDocs = await prisma.document.findMany({
      where: {
        projectId: project.id,
        OR: [
          { category: 'budget_cost' },
          { fileName: { contains: 'budget', mode: 'insensitive' } },
          { fileName: { contains: 'Budget', mode: 'insensitive' } },
        ],
        processed: true,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    if (budgetDocs.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No processed budget documents found',
      });
    }

    let totalItems = 0;

    for (const doc of budgetDocs) {
      const result = await processUploadedBudgetDocument(doc.id, project.id);
      if (result.success) {
        totalItems += result.itemsProcessed;
      }
    }

    // Get comparison
    const comparison = await compareTakeoffsToBudget(project.id);

    return NextResponse.json({
      success: true,
      documentsProcessed: budgetDocs.length,
      itemsExtracted: totalItems,
      comparison: {
        matches: comparison.matches,
        overBudget: comparison.overBudget,
        underBudget: comparison.underBudget,
        missing: comparison.missing,
        variances: comparison.variances.slice(0, 10),
      },
    });
  } catch (error) {
    logger.error('[Budget Auto-Sync API] Error', error);
    return NextResponse.json(
      { error: 'Failed to sync budget' },
      { status: 500 }
    );
  }
}

// GET /api/projects/[slug]/budget/auto-sync - Get budget vs takeoff comparison
export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const comparison = await compareTakeoffsToBudget(project.id);

    // Get budget summary
    const budget = await prisma.projectBudget.findUnique({
      where: { projectId: project.id },
      include: {
        BudgetItem: {
          select: {
            id: true,
            phaseCode: true,
            phaseName: true,
            name: true,
            budgetedAmount: true,
            actualCost: true,
          },
        },
      },
    });

    // Get takeoff summary
    const takeoffs = await prisma.materialTakeoff.findMany({
      where: { projectId: project.id },
      select: {
        id: true,
        name: true,
        totalCost: true,
        _count: { select: { TakeoffLineItem: true } },
      },
    });

    const takeoffTotal = takeoffs.reduce((sum, t) => sum + (t.totalCost || 0), 0);
    const budgetTotal = budget?.totalBudget || 0;

    return NextResponse.json({
      budget: {
        total: budgetTotal,
        itemCount: budget?.BudgetItem.length || 0,
        byPhase: budget?.BudgetItem.reduce((acc, item) => {
          const phase = item.phaseName || 'Other';
          acc[phase] = (acc[phase] || 0) + (item.budgetedAmount || 0);
          return acc;
        }, {} as Record<string, number>),
      },
      takeoff: {
        total: takeoffTotal,
        count: takeoffs.length,
        byTakeoff: takeoffs.map(t => ({
          name: t.name,
          total: t.totalCost,
          items: t._count.TakeoffLineItem,
        })),
      },
      comparison: {
        budgetTotal,
        takeoffTotal,
        variance: takeoffTotal - budgetTotal,
        variancePercent: budgetTotal > 0 ? ((takeoffTotal - budgetTotal) / budgetTotal) * 100 : 0,
        ...comparison,
      },
    });
  } catch (error) {
    logger.error('[Budget Auto-Sync API] Error', error);
    return NextResponse.json(
      { error: 'Failed to get comparison' },
      { status: 500 }
    );
  }
}
