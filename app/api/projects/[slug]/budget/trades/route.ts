import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getTradeBudgetBreakdown } from '@/lib/budget-extractor-ai';

/**
 * GET: Get trade-level budget breakdown
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get trade breakdown
    const breakdown = await getTradeBudgetBreakdown(project.id);

    // Get overall budget info
    const budget = await prisma.projectBudget.findUnique({
      where: { projectId: project.id },
      select: {
        totalBudget: true,
        actualCost: true,
        committedCost: true,
        contingency: true,
      },
    });

    return NextResponse.json({
      budget: budget || { totalBudget: 0, actualCost: 0, committedCost: 0, contingency: 0 },
      breakdown,
    });
  } catch (error: any) {
    console.error('[BUDGET_TRADES_API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trade breakdown' },
      { status: 500 }
    );
  }
}
