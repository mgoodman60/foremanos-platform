import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { BUDGET_PHASES } from '@/lib/budget-phases';

// GET /api/projects/[slug]/budget/job-cost - Get job cost report data
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findFirst({
      where: { slug: params.slug },
      include: {
        ProjectBudget: {
          include: {
            BudgetItem: {
              where: { isActive: true },
              orderBy: [
                { phaseCode: 'asc' },
                { categoryNumber: 'asc' }
              ]
            }
          }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const budget = project.ProjectBudget?.[0];
    const items = budget?.BudgetItem || [];

    // Calculate project summary
    const _totalBudget = items.reduce((sum, item) => sum + (item.budgetedAmount || 0), 0);
    const _totalActual = items.reduce((sum, item) => sum + (item.actualCost || 0), 0);
    const totalBilled = items.reduce((sum, item) => sum + (item.billedToDate || 0), 0);
    const totalContract = items.reduce((sum, item) => sum + (item.contractAmount || 0), 0);

    // Get change orders for this project
    const changeOrders = await prisma.changeOrder.findMany({
      where: {
        projectId: project.id,
        status: 'APPROVED'
      }
    });
    const changeOrdersAmount = changeOrders.reduce(
      (sum, co) => sum + (co.approvedAmount || co.proposedAmount || 0),
      0
    );

    // Use project budget amount as contract if no contract amounts on items
    const contractAmount = totalContract > 0 ? totalContract : (budget?.totalBudget || 0);
    const revisedAmount = contractAmount + changeOrdersAmount;

    return NextResponse.json({
      items: items.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        costCode: item.costCode,
        phaseCode: item.phaseCode,
        phaseName: item.phaseName,
        categoryNumber: item.categoryNumber,
        budgetedAmount: item.budgetedAmount,
        revisedBudget: item.revisedBudget,
        contractAmount: item.contractAmount || 0,
        actualCost: item.actualCost,
        committedCost: item.committedCost,
        billedToDate: item.billedToDate || 0,
        budgetedHours: item.budgetedHours || 0,
        actualHours: item.actualHours || 0
      })),
      summary: {
        contractAmount,
        changeOrdersAmount,
        revisedAmount,
        prevBilled: totalBilled,
        openAmount: revisedAmount - totalBilled
      }
    });
  } catch (error) {
    console.error('[API] Error fetching job cost:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job cost data' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[slug]/budget/job-cost - Add a budget item
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      phaseCode,
      phaseName,
      categoryNumber,
      budgetedAmount,
      contractAmount,
      budgetedHours
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({
      where: { slug: params.slug },
      include: { ProjectBudget: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get or create project budget
    let budget = project.ProjectBudget?.[0];
    if (!budget) {
      budget = await prisma.projectBudget.create({
        data: {
          projectId: project.id,
          totalBudget: 0,
          contingency: 0,
          baselineDate: new Date()
        }
      });
    }

    // Get next category number if not provided
    let catNum = categoryNumber;
    if (!catNum && phaseCode) {
      const existingItems = await prisma.budgetItem.findMany({
        where: {
          budgetId: budget.id,
          phaseCode
        },
        orderBy: { categoryNumber: 'desc' },
        take: 1
      });
      catNum = (existingItems[0]?.categoryNumber || 0) + 1;
    }

    // Get phase name from config if not provided
    const phase = BUDGET_PHASES.find(p => p.code === phaseCode);
    const finalPhaseName = phaseName || phase?.name || 'UNCATEGORIZED';

    // Generate cost code
    const costCode = `${phaseCode || 0}-${String(catNum || 1).padStart(2, '0')}`;

    const item = await prisma.budgetItem.create({
      data: {
        budgetId: budget.id,
        name,
        description: description || null,
        costCode,
        phaseCode: phaseCode || null,
        phaseName: finalPhaseName,
        categoryNumber: catNum || 1,
        budgetedAmount: budgetedAmount || 0,
        contractAmount: contractAmount || null,
        budgetedHours: budgetedHours || 0,
        actualCost: 0,
        committedCost: 0,
        billedToDate: 0,
        actualHours: 0
      }
    });

    // Update total budget
    await prisma.projectBudget.update({
      where: { id: budget.id },
      data: {
        totalBudget: {
          increment: budgetedAmount || 0
        }
      }
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error('[API] Error adding budget item:', error);
    return NextResponse.json(
      { error: 'Failed to add budget item' },
      { status: 500 }
    );
  }
}
