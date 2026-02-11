import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { ONE_SENIOR_CARE_BUDGET } from '@/lib/budget-parser';
import { checkRateLimit, RATE_LIMITS, getClientIp, getRateLimitIdentifier } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit
    const rateLimitId = getRateLimitIdentifier(session.user.id, getClientIp(request));
    const rateLimitResult = await checkRateLimit(rateLimitId, RATE_LIMITS.API);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { projectId, documentId } = await request.json();
    
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }
    
    // Use the hard-coded budget data for One Senior Care
    const budgetData = ONE_SENIOR_CARE_BUDGET;
    
    // Create or update project budget
    const existingBudget = await prisma.projectBudget.findUnique({
      where: { projectId },
    });
    
    let projectBudget;
    if (existingBudget) {
      projectBudget = await prisma.projectBudget.update({
        where: { projectId },
        data: {
          totalBudget: budgetData.contractAmount,
          contingency: budgetData.phases.find(p => p.phaseCode === 100)?.lineItems.find(l => l.description.includes('Contingency'))?.budgetedAmount || 0,
          lastUpdated: new Date(),
        },
      });
    } else {
      projectBudget = await prisma.projectBudget.create({
        data: {
          projectId,
          totalBudget: budgetData.contractAmount,
          contingency: budgetData.phases.find(p => p.phaseCode === 100)?.lineItems.find(l => l.description.includes('Contingency'))?.budgetedAmount || 0,
          baselineDate: new Date(),
        },
      });
    }
    
    // Delete existing budget items to replace with new ones
    await prisma.budgetItem.deleteMany({
      where: { budgetId: projectBudget.id },
    });
    
    // Create budget items from phases
    const budgetItems = [];
    for (const phase of budgetData.phases) {
      for (const item of phase.lineItems) {
        budgetItems.push({
          budgetId: projectBudget.id,
          name: item.description,
          phaseCode: phase.phaseCode,
          phaseName: phase.phaseName,
          categoryNumber: item.categoryNumber,
          budgetedAmount: item.budgetedAmount,
          actualCost: item.actualCost,
          billedToDate: item.billedToDate,
        });
      }
    }
    
    await prisma.budgetItem.createMany({
      data: budgetItems,
    });
    
    // Log the import
    logger.info('BUDGET_IMPORT', `Imported ${budgetItems.length} budget items`, { projectId });
    
    return NextResponse.json({
      success: true,
      message: `Imported ${budgetItems.length} budget line items across ${budgetData.phases.length} phases`,
      summary: {
        contractAmount: budgetData.contractAmount,
        totalBudgeted: budgetData.totalBudget,
        totalActual: budgetData.totalActual,
        phasesCount: budgetData.phases.length,
        lineItemsCount: budgetItems.length,
        phases: budgetData.phases.map(p => ({
          code: p.phaseCode,
          name: p.phaseName,
          budget: p.totalBudget,
        })),
      },
    });
  } catch (error) {
    logger.error('BUDGET_IMPORT', 'Failed to import budget', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to import budget' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }
    
    // Get project budget with items
    const projectBudget = await prisma.projectBudget.findUnique({
      where: { projectId },
      include: {
        BudgetItem: {
          orderBy: [
            { phaseCode: 'asc' },
            { categoryNumber: 'asc' },
          ],
        },
      },
    });
    
    if (!projectBudget) {
      return NextResponse.json({
        imported: false,
        message: 'No budget imported yet',
      });
    }
    
    // Group by phase
    const phases: Record<number, { phaseName: string; items: typeof projectBudget.BudgetItem; totalBudget: number }> = {};
    
    for (const item of projectBudget.BudgetItem) {
      const code = item.phaseCode || 0;
      if (!phases[code]) {
        phases[code] = {
          phaseName: item.phaseName || 'Unknown',
          items: [],
          totalBudget: 0,
        };
      }
      phases[code].items.push(item);
      phases[code].totalBudget += item.budgetedAmount;
    }
    
    return NextResponse.json({
      imported: true,
      budget: projectBudget,
      phases: Object.entries(phases).map(([code, data]) => ({
        phaseCode: parseInt(code),
        ...data,
      })),
    });
  } catch (error) {
    logger.error('BUDGET_IMPORT', 'Failed to fetch budget', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to fetch budget' },
      { status: 500 }
    );
  }
}
