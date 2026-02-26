import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('WEATHER_SNAPSHOTS');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/weather/snapshots?projectId=xxx&days=7
 * Get weather snapshots for a project
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const days = parseInt(searchParams.get('days') || '7', 10);

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    // Verify user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: session.user.id },
          {
            ProjectMember: {
              some: {
                userId: session.user.id,
              },
            },
          },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    // Get snapshots
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const snapshots = await prisma.weatherSnapshot.findMany({
      where: {
        projectId,
        snapshotTime: {
          gte: startDate,
        },
      },
      orderBy: {
        snapshotTime: 'desc',
      },
    });

    return NextResponse.json({ snapshots });
  } catch (error) {
    logger.error('Error fetching weather snapshots', error);
    return NextResponse.json(
      { error: 'Failed to fetch snapshots' },
      { status: 500 }
    );
  }
}
