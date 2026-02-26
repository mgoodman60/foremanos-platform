import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_BUDGET_SYNC');

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();
    const { totalBudget, recalculate } = body;

    // Find project with budget
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        ProjectBudget: {
          include: {
            BudgetItem: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.ProjectBudget) {
      return NextResponse.json({ error: 'No budget found' }, { status: 404 });
    }

    const budgetItems = project.ProjectBudget.BudgetItem;
    
    // Calculate totals from budget items
    // Use contractAmount if available, otherwise fall back to budgetedAmount
    const itemTotals = budgetItems.reduce(
      (acc, item) => {
        // For budget total: use contractAmount if set, otherwise budgetedAmount
        const itemBudget = (item.contractAmount && item.contractAmount > 0) 
          ? item.contractAmount 
          : (item.budgetedAmount || 0);
        acc.budgetTotal += itemBudget;
        acc.contractAmount += item.contractAmount || 0;
        acc.budgetedAmount += item.budgetedAmount || 0;
        acc.actualCost += item.actualCost || 0;
        acc.committedCost += item.committedCost || 0;
        return acc;
      },
      { budgetTotal: 0, contractAmount: 0, budgetedAmount: 0, actualCost: 0, committedCost: 0 }
    );

    // Calculate total: prefer contractAmount sum, fall back to budgetedAmount sum
    // This handles Walker Company format where values are in budgetedAmount
    const calculatedTotal = itemTotals.contractAmount > 0 
      ? itemTotals.contractAmount 
      : itemTotals.budgetedAmount;
    const previousTotal = project.ProjectBudget.totalBudget;
    const newTotalBudget = totalBudget !== undefined ? totalBudget : calculatedTotal;

    // Update the project budget with calculated totals
    const updatedBudget = await prisma.projectBudget.update({
      where: { id: project.ProjectBudget.id },
      data: {
        totalBudget: newTotalBudget,
        actualCost: itemTotals.actualCost,
        committedCost: itemTotals.committedCost,
        lastUpdated: new Date(),
      },
    });
    
    const totalChanged = previousTotal !== newTotalBudget;

    // If recalculate is true, update revisedBudget on items to match contractAmount
    if (recalculate) {
      // Filter items that need updating and batch the updates
      const itemsToUpdate = budgetItems.filter(
        item => item.contractAmount && !item.revisedBudget
      );

      if (itemsToUpdate.length > 0) {
        // Use Promise.all for parallel updates instead of sequential loop
        await Promise.all(
          itemsToUpdate.map(item =>
            prisma.budgetItem.update({
              where: { id: item.id },
              data: { revisedBudget: item.contractAmount },
            })
          )
        );
      }
    }

    // Determine which field was used for the calculation
    const sourceField = itemTotals.contractAmount > 0 ? 'contractAmount' : 'budgetedAmount';
    
    const changeMessage = totalChanged 
      ? `Budget total updated from $${previousTotal.toLocaleString()} to $${newTotalBudget.toLocaleString()} (calculated from ${sourceField})`
      : `Budget synced. Total: $${newTotalBudget.toLocaleString()}`;

    return NextResponse.json({
      success: true,
      budget: updatedBudget,
      itemTotals: {
        contractAmountSum: itemTotals.contractAmount,
        budgetedAmountSum: itemTotals.budgetedAmount,
        actualCost: itemTotals.actualCost,
        committedCost: itemTotals.committedCost,
      },
      previousTotal,
      calculatedTotal,
      sourceField,
      totalChanged,
      message: changeMessage,
    });
  } catch (error: unknown) {
    logger.error('Error syncing budget', error);
    return NextResponse.json(
      { error: 'Failed to sync budget' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();
    const { totalBudget, contingency } = body;

    // Find project with budget
    const project = await prisma.project.findUnique({
      where: { slug },
      include: { ProjectBudget: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.ProjectBudget) {
      return NextResponse.json({ error: 'No budget found' }, { status: 404 });
    }

    // Update the project budget total
    const updatedBudget = await prisma.projectBudget.update({
      where: { id: project.ProjectBudget.id },
      data: {
        ...(totalBudget !== undefined && { totalBudget }),
        ...(contingency !== undefined && { contingency }),
        lastUpdated: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      budget: updatedBudget,
    });
  } catch (error: unknown) {
    logger.error('Error updating budget', error);
    return NextResponse.json(
      { error: 'Failed to update budget' },
      { status: 500 }
    );
  }
}
