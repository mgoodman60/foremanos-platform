import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateCashFlowForecast, getCashFlowSummary, calculateCostForecast } from '@/lib/cash-flow-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_CASH_FLOW');

// GET /api/projects/[slug]/cash-flow
export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
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
    logger.error('Cash flow error', error);
    return NextResponse.json({ error: 'Failed to fetch cash flow data' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/cash-flow/generate - Generate forecast
export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
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
    logger.error('Generate cash flow error', error);
    return NextResponse.json({ error: 'Failed to generate cash flow forecast' }, { status: 500 });
  }
}
