import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getProgressTrends } from '@/lib/analytics-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_ANALYTICS_TRENDS');

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as 'weekly' | 'monthly') || 'weekly';
    const lookback = parseInt(searchParams.get('lookback') || '12');

    const project = await prisma.project.findUnique({
      where: { slug: params.slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const trends = await getProgressTrends(project.id, period, lookback);
    return NextResponse.json(trends);
  } catch (error) {
    logger.error('[Analytics Trends] Error', error);
    return NextResponse.json(
      { error: 'Failed to fetch trends' },
      { status: 500 }
    );
  }
}
