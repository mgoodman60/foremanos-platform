import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

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

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');

    const where: any = { projectId: project.id };
    
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
    });

    return NextResponse.json({ reports });
  } catch (error) {
    console.error('[Daily Reports API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch daily reports' },
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

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
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
        weatherNotes,
        workPerformed,
        workPlanned,
        delaysEncountered,
        delayHours,
        delayReason,
        safetyIncidents: safetyIncidents || 0,
        safetyNotes,
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
  } catch (error: any) {
    console.error('[Daily Reports API] Create error:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A report for this date already exists' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create daily report' },
      { status: 500 }
    );
  }
}
