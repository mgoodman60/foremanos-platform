/**
 * Budget Items API
 * 
 * Returns list of budget items for linking
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
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
    console.error('[BudgetItems API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch budget items' },
      { status: 500 }
    );
  }
}
