import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('WEATHER_ALERTS_DISMISS');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/weather/alerts/[id]/dismiss
 * Dismiss a weather alert
 */
export async function POST(request: NextRequest, props: RouteParams) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const alertId = params.id;

    // Get alert and verify access
    const alert = await prisma.weatherAlert.findUnique({
      where: { id: alertId },
      include: {
        Project: {
          include: {
            ProjectMember: true,
          },
        },
      },
    });

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    // Verify user has access to project
    const hasAccess =
      alert.Project.ownerId === session.user.id ||
      alert.Project.ProjectMember.some((m: any) => m.userId === session.user.id);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Dismiss alert
    const updated = await prisma.weatherAlert.update({
      where: { id: alertId },
      data: {
        dismissed: true,
        dismissedAt: new Date(),
        dismissedBy: session.user.id,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Error dismissing weather alert', error);
    return NextResponse.json(
      { error: 'Failed to dismiss alert' },
      { status: 500 }
    );
  }
}
