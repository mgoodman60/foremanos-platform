import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createScopedLogger } from '@/lib/logger';
import {
  getDailyReportRole,
  canCreateReport,
  sanitizeText,
} from '@/lib/daily-report-permissions';
import {
  checkRateLimit,
  RATE_LIMITS,
  getRateLimitIdentifier,
  createRateLimitHeaders,
} from '@/lib/rate-limiter';

const log = createScopedLogger('DAILY_REPORTS_API');

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(
      getRateLimitIdentifier(session.user.id, null),
      RATE_LIMITS.DAILY_REPORT_READ
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

    // Check membership
    const role = await getDailyReportRole(session.user.id, project.id);
    if (!role) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    const where: any = {
      projectId: project.id,
      deletedAt: null, // Filter out soft-deleted reports
    };

    if (startDate) {
      where.reportDate = { ...where.reportDate, gte: new Date(startDate) };
    }
    if (endDate) {
      where.reportDate = { ...where.reportDate, lte: new Date(endDate) };
    }
    if (status) {
      where.status = status;
    }

    const reports = await prisma.dailyReport.findMany({
      where,
      include: {
        createdByUser: { select: { id: true, username: true } },
        laborEntries: true,
      },
      orderBy: { reportDate: 'desc' },
      take: limit + 1, // Fetch one extra to determine if there are more
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = reports.length > limit;
    const results = hasMore ? reports.slice(0, limit) : reports;
    const nextCursor = hasMore ? results[results.length - 1]?.id : undefined;

    return NextResponse.json({
      reports: results,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    log.error('Failed to fetch daily reports', error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch daily reports' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
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

    // Check membership and role
    const role = await getDailyReportRole(session.user.id, project.id);
    if (!role || !canCreateReport(role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const {
      reportDate,
      weatherCondition,
      temperatureHigh,
      temperatureLow,
      humidity,
      precipitation,
      windSpeed,
      weatherNotes,
      workPerformed,
      workPlanned,
      delaysEncountered,
      delayHours,
      delayReason,
      safetyIncidents,
      safetyNotes,
      visitors,
      equipmentOnSite,
      materialsReceived,
      photoIds,
      laborEntries,
    } = body;

    // Get next report number
    const lastReport = await prisma.dailyReport.findFirst({
      where: { projectId: project.id },
      orderBy: { reportNumber: 'desc' },
    });
    const reportNumber = (lastReport?.reportNumber || 0) + 1;

    const report = await prisma.dailyReport.create({
      data: {
        projectId: project.id,
        reportNumber,
        reportDate: new Date(reportDate),
        weatherCondition,
        temperatureHigh,
        temperatureLow,
        humidity,
        precipitation,
        windSpeed,
        weatherNotes: weatherNotes ? sanitizeText(weatherNotes) : undefined,
        workPerformed: workPerformed ? sanitizeText(workPerformed) : undefined,
        workPlanned: workPlanned ? sanitizeText(workPlanned) : undefined,
        delaysEncountered: delaysEncountered ? sanitizeText(delaysEncountered) : undefined,
        delayHours,
        delayReason: delayReason ? sanitizeText(delayReason) : undefined,
        safetyIncidents: safetyIncidents || 0,
        safetyNotes: safetyNotes ? sanitizeText(safetyNotes) : undefined,
        visitors,
        equipmentOnSite,
        materialsReceived,
        photoIds: photoIds || [],
        createdBy: session.user.id,
        laborEntries: laborEntries ? {
          create: laborEntries.map((entry: any) => ({
            tradeName: entry.tradeName,
            workerCount: entry.workerCount,
            regularHours: entry.regularHours,
            overtimeHours: entry.overtimeHours || 0,
            description: entry.description,
            crewId: entry.crewId,
          })),
        } : undefined,
      },
      include: {
        laborEntries: true,
        createdByUser: { select: { id: true, username: true } },
      },
    });

    return NextResponse.json({ report });
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && (error as any).code === 'P2002') {
      return NextResponse.json(
        { error: 'A report for this date already exists' },
        { status: 400 }
      );
    }
    log.error('Failed to create daily report', error as Error);
    return NextResponse.json(
      { error: 'Failed to create daily report' },
      { status: 500 }
    );
  }
}
