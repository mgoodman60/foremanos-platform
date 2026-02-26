import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  calculateCPM,
  analyzeResourceAllocation,
  levelResources,
  generateScheduleForecast,
  createScheduleBaseline,
  compareToBaseline,
  linkTasksToBudget,
  calculateScheduleDrivenCosts
} from '@/lib/schedule-budget-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SCHEDULE_ANALYSIS');

// GET /api/projects/[slug]/schedule-analysis
export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
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

    // Get active schedule
    const schedule = await prisma.schedule.findFirst({
      where: { projectId: project.id, isActive: true }
    });

    if (!schedule) {
      return NextResponse.json({ 
        error: 'No active schedule found',
        hasSchedule: false 
      }, { status: 200 });
    }

    // Get CPM analysis
    const cpm = await calculateCPM(schedule.id);

    // Get resource allocation
    const resources = await analyzeResourceAllocation(project.id);

    // Get latest forecast
    const latestForecast = await prisma.scheduleForecast.findFirst({
      where: { projectId: project.id },
      orderBy: { forecastDate: 'desc' }
    });

    // Get baselines
    const baselines = await prisma.scheduleBaseline.findMany({
      where: { scheduleId: schedule.id },
      orderBy: { baselineNumber: 'desc' }
    });

    // Get baseline comparison if exists
    let baselineComparison = null;
    if (baselines.length > 0) {
      baselineComparison = await compareToBaseline(schedule.id);
    }

    // Get schedule-budget integration
    const scheduleDrivenCosts = await calculateScheduleDrivenCosts(project.id);

    return NextResponse.json({
      hasSchedule: true,
      schedule: {
        id: schedule.id,
        name: schedule.name,
        startDate: schedule.startDate,
        endDate: schedule.endDate
      },
      cpm,
      resources,
      forecast: latestForecast,
      baselines,
      baselineComparison,
      scheduleDrivenCosts
    });
  } catch (error) {
    logger.error('Schedule analysis error', error);
    return NextResponse.json({ error: 'Failed to fetch schedule analysis' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/schedule-analysis - Perform analysis actions
export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
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
    const { action, scheduleId, baselineName, baselineDescription } = body;

    switch (action) {
      case 'calculate_cpm': {
        const schedule = scheduleId 
          ? await prisma.schedule.findUnique({ where: { id: scheduleId } })
          : await prisma.schedule.findFirst({ where: { projectId: project.id, isActive: true } });
        
        if (!schedule) {
          return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
        }
        
        const cpm = await calculateCPM(schedule.id);
        return NextResponse.json({ cpm });
      }

      case 'level_resources': {
        const result = await levelResources(project.id);
        return NextResponse.json(result);
      }

      case 'generate_forecast': {
        const forecast = await generateScheduleForecast(project.id, scheduleId);
        return NextResponse.json({ forecast });
      }

      case 'create_baseline': {
        const schedule = scheduleId
          ? await prisma.schedule.findUnique({ where: { id: scheduleId } })
          : await prisma.schedule.findFirst({ where: { projectId: project.id, isActive: true } });
        
        if (!schedule) {
          return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
        }

        const baseline = await createScheduleBaseline(
          schedule.id,
          baselineName || `Baseline ${new Date().toISOString().split('T')[0]}`,
          session.user.id,
          baselineDescription
        );
        return NextResponse.json({ baseline });
      }

      case 'link_to_budget': {
        const result = await linkTasksToBudget(project.id);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    logger.error('Schedule analysis action error', error);
    return NextResponse.json({ error: 'Failed to perform schedule analysis' }, { status: 500 });
  }
}
