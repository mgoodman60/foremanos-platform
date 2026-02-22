import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createScopedLogger } from '@/lib/logger';
import {
  getDailyReportRole,
  canCreateReport,
  canDeleteReport,
  sanitizeText,
} from '@/lib/daily-report-permissions';
import {
  checkRateLimit,
  RATE_LIMITS,
  getRateLimitIdentifier,
  createRateLimitHeaders,
} from '@/lib/rate-limiter';
import {
  recordWeatherDay,
  getCumulativeWeatherDays,
  getWeatherDayLedger,
  checkWeatherDayThreshold,
} from '@/lib/weather-day-tracker';

const log = createScopedLogger('WEATHER_DAYS_API');

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const role = await getDailyReportRole(session.user.id, project.id);
    if (!role) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'ledger';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const cursor = searchParams.get('cursor');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (type === 'cumulative') {
      const result = await getCumulativeWeatherDays(
        project.id,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );
      return NextResponse.json(result);
    }

    if (type === 'threshold') {
      const thresholdDays = parseInt(searchParams.get('thresholdDays') || '10');
      const result = await checkWeatherDayThreshold(project.id, thresholdDays);
      return NextResponse.json(result);
    }

    // Default: ledger
    const result = await getWeatherDayLedger(project.id, {
      cursor: cursor || undefined,
      limit: Math.min(limit, 100),
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    log.error('Failed to fetch weather days', error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch weather days' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResult = await checkRateLimit(
      getRateLimitIdentifier(session.user.id, null),
      RATE_LIMITS.DAILY_REPORT_WRITE
    );
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const role = await getDailyReportRole(session.user.id, project.id);
    if (!role || !canCreateReport(role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const {
      date,
      hoursLost,
      reason,
      reportId,
      weatherCondition,
      temperature,
      precipitation,
      windSpeed,
      notes,
    } = body;

    // Validation
    if (!date || !reason) {
      return NextResponse.json(
        { error: 'Date and reason are required' },
        { status: 400 }
      );
    }

    if (typeof hoursLost !== 'number' || hoursLost <= 0 || hoursLost > 24) {
      return NextResponse.json(
        { error: 'hoursLost must be between 0 and 24' },
        { status: 400 }
      );
    }

    const result = await recordWeatherDay({
      projectId: project.id,
      reportId,
      date: new Date(date),
      hoursLost,
      reason: sanitizeText(reason),
      weatherCondition,
      temperature,
      precipitation,
      windSpeed,
      flaggedBy: session.user.id,
      notes: notes ? sanitizeText(notes) : undefined,
    });

    return NextResponse.json({
      success: true,
      weatherDay: result.weatherDay,
      affectedTasks: result.affectedTasks,
      costImpact: result.costImpact,
    });
  } catch (error: unknown) {
    const errCode = error instanceof Object && 'code' in error ? (error as { code?: string }).code : undefined;
    if (errCode === 'P2002') {
      return NextResponse.json(
        { error: 'A weather day record already exists for this date' },
        { status: 400 }
      );
    }
    log.error('Failed to record weather day', error as Error);
    return NextResponse.json(
      { error: 'Failed to record weather day' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const role = await getDailyReportRole(session.user.id, project.id);
    if (!role || !canDeleteReport(role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const weatherDayId = searchParams.get('id');

    if (!weatherDayId) {
      return NextResponse.json({ error: 'Weather day ID is required' }, { status: 400 });
    }

    const weatherDay = await prisma.weatherDay.findUnique({
      where: { id: weatherDayId },
      select: { id: true, projectId: true },
    });

    if (!weatherDay || weatherDay.projectId !== project.id) {
      return NextResponse.json({ error: 'Weather day not found' }, { status: 404 });
    }

    await prisma.weatherDay.delete({ where: { id: weatherDayId } });

    // Audit log
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'WEATHER_DAY_DELETED',
        resource: 'WeatherDay',
        resourceId: weatherDayId,
        details: { projectId: project.id },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Failed to delete weather day', error as Error);
    return NextResponse.json(
      { error: 'Failed to delete weather day' },
      { status: 500 }
    );
  }
}
