import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { generateCashFlowForecast, getCashFlowSummary, calculateCostForecast } from '@/lib/cash-flow-service';

// GET /api/projects/[slug]/cash-flow
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const periodType = (searchParams.get('periodType') || 'MONTHLY') as 'WEEKLY' | 'MONTHLY';

    const summary = await getCashFlowSummary(project.id);
    const costForecast = await calculateCostForecast(project.id);

    return NextResponse.json({
      cashFlow: summary,
      costForecast,
      periodType
    });
  } catch (error) {
    console.error('[API] Cash flow error:', error);
    return NextResponse.json({ error: 'Failed to fetch cash flow data' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/cash-flow/generate - Generate forecast
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await req.json();
    const { periodType = 'MONTHLY', periodsAhead = 12 } = body;

    const forecasts = await generateCashFlowForecast(
      project.id,
      periodType as 'WEEKLY' | 'MONTHLY',
      periodsAhead
    );

    return NextResponse.json({ forecasts });
  } catch (error) {
    console.error('[API] Generate cash flow error:', error);
    return NextResponse.json({ error: 'Failed to generate cash flow forecast' }, { status: 500 });
  }
}
