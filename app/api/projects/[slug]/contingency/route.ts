import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const budget = await prisma.projectBudget.findUnique({
      where: { projectId: project.id }
    });

    if (!budget) {
      return NextResponse.json({ error: 'Budget not configured' }, { status: 404 });
    }

    const usages = await prisma.contingencyUsage.findMany({
      where: { projectId: project.id },
      orderBy: { usedDate: 'desc' }
    });

    type UsageRecord = typeof usages[number];
    const totalUsed = usages.reduce((sum: number, u: UsageRecord) => sum + u.amount, 0);
    const remaining = budget.contingency - totalUsed;
    const percentUsed = budget.contingency > 0 ? (totalUsed / budget.contingency) * 100 : 0;

    return NextResponse.json({
      totalContingency: budget.contingency,
      totalUsed,
      remaining,
      percentUsed,
      usages
    });
  } catch (error) {
    console.error('[API] Error fetching contingency:', error);
    return NextResponse.json({ error: 'Failed to fetch contingency data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await req.json();
    const { amount, reason, description, changeOrderId } = body;

    const usage = await prisma.contingencyUsage.create({
      data: {
        projectId: project.id,
        amount: parseFloat(amount),
        reason,
        description,
        changeOrderId: changeOrderId || null,
        approvedBy: session.user.username
      }
    });

    return NextResponse.json(usage);
  } catch (error) {
    console.error('[API] Error recording contingency usage:', error);
    return NextResponse.json({ error: 'Failed to record contingency usage' }, { status: 500 });
  }
}
