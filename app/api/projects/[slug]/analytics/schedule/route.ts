import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getScheduleAnalytics } from '@/lib/analytics-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_ANALYTICS_SCHEDULE');

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
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

    const analytics = await getScheduleAnalytics(project.id);
    return NextResponse.json(analytics);
  } catch (error) {
    logger.error('[Analytics Schedule] Error', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedule analytics' },
      { status: 500 }
    );
  }
}
