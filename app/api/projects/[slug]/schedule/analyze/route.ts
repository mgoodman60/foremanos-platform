import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { analyzeScheduleForImprovements } from '@/lib/schedule-improvement-analyzer';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SCHEDULE_ANALYZE');

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[slug]/schedule/analyze
 * Analyze a schedule and provide improvement recommendations
 * 
 * Body:
 * - scheduleId: ID of the schedule to analyze
 */
export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();
    const { scheduleId } = body;

    // Get project
    const project = await prisma.project.findFirst({
      where: { slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // If no scheduleId provided, get the active schedule
    let targetScheduleId = scheduleId;
    if (!targetScheduleId) {
      const activeSchedule = await prisma.schedule.findFirst({
        where: { projectId: project.id, isActive: true },
        orderBy: { createdAt: 'desc' }
      });
      if (!activeSchedule) {
        return NextResponse.json({ error: 'No active schedule found' }, { status: 404 });
      }
      targetScheduleId = activeSchedule.id;
    }

    // Run analysis
    const analysis = await analyzeScheduleForImprovements(targetScheduleId);

    return NextResponse.json({
      success: true,
      analysis
    });
  } catch (error) {
    logger.error('Error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze schedule' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[slug]/schedule/analyze
 * Get analysis for the active schedule
 */
export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('scheduleId');

    // Get project
    const project = await prisma.project.findFirst({
      where: { slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get schedule
    let targetScheduleId = scheduleId;
    if (!targetScheduleId) {
      const activeSchedule = await prisma.schedule.findFirst({
        where: { projectId: project.id, isActive: true },
        orderBy: { createdAt: 'desc' }
      });
      if (!activeSchedule) {
        return NextResponse.json({ 
          error: 'No active schedule found',
          canAnalyze: false 
        }, { status: 200 });
      }
      targetScheduleId = activeSchedule.id;
    }

    // Run analysis
    const analysis = await analyzeScheduleForImprovements(targetScheduleId);

    return NextResponse.json({
      success: true,
      analysis
    });
  } catch (error) {
    logger.error('Error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze schedule' },
      { status: 500 }
    );
  }
}
