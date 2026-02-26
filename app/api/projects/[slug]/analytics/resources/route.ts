import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getResourceUtilization, getTeamPerformance } from '@/lib/analytics-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_ANALYTICS_RESOURCES');

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
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

    const [utilization, teamPerformance] = await Promise.all([
      getResourceUtilization(project.id),
      getTeamPerformance(project.id)
    ]);

    return NextResponse.json({ utilization, teamPerformance });
  } catch (error) {
    logger.error('[Analytics Resources] Error', error);
    return NextResponse.json(
      { error: 'Failed to fetch resource analytics' },
      { status: 500 }
    );
  }
}
