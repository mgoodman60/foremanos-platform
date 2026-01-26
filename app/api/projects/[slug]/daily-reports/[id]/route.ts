import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const report = await prisma.dailyReport.findUnique({
      where: { id: params.id },
      include: {
        createdByUser: { select: { id: true, username: true } },
        laborEntries: true,
      },
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error('[Daily Report API] Get error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch report' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      status,
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

    // Build update data
    const updateData: any = {};
    if (weatherCondition !== undefined) updateData.weatherCondition = weatherCondition;
    if (temperatureHigh !== undefined) updateData.temperatureHigh = temperatureHigh;
    if (temperatureLow !== undefined) updateData.temperatureLow = temperatureLow;
    if (humidity !== undefined) updateData.humidity = humidity;
    if (precipitation !== undefined) updateData.precipitation = precipitation;
    if (windSpeed !== undefined) updateData.windSpeed = windSpeed;
    if (weatherNotes !== undefined) updateData.weatherNotes = weatherNotes;
    if (workPerformed !== undefined) updateData.workPerformed = workPerformed;
    if (workPlanned !== undefined) updateData.workPlanned = workPlanned;
    if (delaysEncountered !== undefined) updateData.delaysEncountered = delaysEncountered;
    if (delayHours !== undefined) updateData.delayHours = delayHours;
    if (delayReason !== undefined) updateData.delayReason = delayReason;
    if (safetyIncidents !== undefined) updateData.safetyIncidents = safetyIncidents;
    if (safetyNotes !== undefined) updateData.safetyNotes = safetyNotes;
    if (visitors !== undefined) updateData.visitors = visitors;
    if (equipmentOnSite !== undefined) updateData.equipmentOnSite = equipmentOnSite;
    if (materialsReceived !== undefined) updateData.materialsReceived = materialsReceived;
    if (photoIds !== undefined) updateData.photoIds = photoIds;

    // Handle status changes
    if (status === 'SUBMITTED') {
      updateData.status = 'SUBMITTED';
      updateData.submittedAt = new Date();
      updateData.submittedBy = session.user.id;
    } else if (status === 'APPROVED') {
      updateData.status = 'APPROVED';
      updateData.approvedAt = new Date();
      updateData.approvedBy = session.user.id;
    } else if (status) {
      updateData.status = status;
    }

    // Update labor entries if provided
    if (laborEntries) {
      // Delete existing and recreate
      await prisma.dailyReportLabor.deleteMany({
        where: { reportId: params.id },
      });
      
      await prisma.dailyReportLabor.createMany({
        data: laborEntries.map((entry: any) => ({
          reportId: params.id,
          tradeName: entry.tradeName,
          workerCount: entry.workerCount,
          regularHours: entry.regularHours,
          overtimeHours: entry.overtimeHours || 0,
          description: entry.description,
          crewId: entry.crewId,
        })),
      });
    }

    const report = await prisma.dailyReport.update({
      where: { id: params.id },
      data: updateData,
      include: {
        laborEntries: true,
        createdByUser: { select: { id: true, username: true } },
      },
    });

    return NextResponse.json({ report });
  } catch (error) {
    console.error('[Daily Report API] Update error:', error);
    return NextResponse.json(
      { error: 'Failed to update report' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.dailyReport.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Daily Report API] Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete report' },
      { status: 500 }
    );
  }
}
