/**
 * Budget Items API
 * 
 * Returns list of budget items for linking
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_BUDGET_ITEMS');

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const budget = await prisma.projectBudget.findFirst({
      where: { projectId: project.id },
      include: {
        BudgetItem: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            costCode: true,
            budgetedAmount: true,
            phaseName: true,
            phaseCode: true
          },
          orderBy: [{ phaseCode: 'asc' }, { categoryNumber: 'asc' }]
        }
      }
    });

    return NextResponse.json({
      items: budget?.BudgetItem || []
    });

  } catch (error) {
    logger.error('[BudgetItems API] Error', error);
    return NextResponse.json(
      { error: 'Failed to fetch budget items' },
      { status: 500 }
    );
  }
}
