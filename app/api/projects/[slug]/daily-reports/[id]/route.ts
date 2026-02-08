import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createScopedLogger } from '@/lib/logger';
import {
  getDailyReportRole,
  canEditReport,
  canSubmitReport,
  canApproveReport,
  canDeleteReport,
  isValidTransition,
  sanitizeText,
} from '@/lib/daily-report-permissions';
import {
  checkRateLimit,
  RATE_LIMITS,
  getRateLimitIdentifier,
  createRateLimitHeaders,
} from '@/lib/rate-limiter';

const log = createScopedLogger('DAILY_REPORT_API');

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
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

    // Check membership
    const role = await getDailyReportRole(session.user.id, project.id);
    if (!role) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const report = await prisma.dailyReport.findUnique({
      where: { id: params.id },
      include: {
        createdByUser: { select: { id: true, username: true } },
        laborEntries: true,
        equipmentEntries: true,
        progressEntries: true,
      },
    });

    if (!report || report.projectId !== project.id) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Filter out soft-deleted reports
    if (report.deletedAt) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({ report });
  } catch (error) {
    log.error('Failed to fetch report', error as Error);
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

    // Check membership
    const role = await getDailyReportRole(session.user.id, project.id);
    if (!role) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch existing report
    const existingReport = await prisma.dailyReport.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        projectId: true,
        status: true,
        createdBy: true,
        reportNumber: true,
        deletedAt: true,
      },
    });

    if (!existingReport || existingReport.projectId !== project.id || existingReport.deletedAt) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      status,
      rejectionReason,
      rejectionNotes,
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

    // Handle status changes with validation
    if (status) {
      // Validate status transition
      if (!isValidTransition(existingReport.status, status)) {
        return NextResponse.json(
          { error: `Invalid status transition from ${existingReport.status} to ${status}` },
          { status: 400 }
        );
      }

      // Check role-based permission for the transition
      if (status === 'SUBMITTED') {
        if (!canSubmitReport(role, existingReport.createdBy, session.user.id)) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
        updateData.status = 'SUBMITTED';
        updateData.submittedAt = new Date();
        updateData.submittedBy = session.user.id;
      } else if (status === 'APPROVED') {
        if (!canApproveReport(role)) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
        updateData.status = 'APPROVED';
        updateData.approvedAt = new Date();
        updateData.approvedBy = session.user.id;
      } else if (status === 'REJECTED') {
        if (!canApproveReport(role)) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
        if (!rejectionReason) {
          return NextResponse.json(
            { error: 'Rejection reason is required' },
            { status: 400 }
          );
        }
        updateData.status = 'REJECTED';
        updateData.rejectionReason = sanitizeText(rejectionReason);
        updateData.rejectionNotes = rejectionNotes ? sanitizeText(rejectionNotes) : null;
      } else if (status === 'DRAFT') {
        // REJECTED → DRAFT (re-editing after rejection)
        if (!canEditReport(role, existingReport.createdBy, session.user.id, existingReport.status)) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
        updateData.status = 'DRAFT';
        updateData.rejectionReason = null;
        updateData.rejectionNotes = null;
        updateData.submittedAt = null;
        updateData.submittedBy = null;
      }
    } else {
      // Non-status field edits — check edit permission
      if (!canEditReport(role, existingReport.createdBy, session.user.id, existingReport.status)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Sanitize and add field updates
    if (weatherCondition !== undefined) updateData.weatherCondition = weatherCondition;
    if (temperatureHigh !== undefined) updateData.temperatureHigh = temperatureHigh;
    if (temperatureLow !== undefined) updateData.temperatureLow = temperatureLow;
    if (humidity !== undefined) updateData.humidity = humidity;
    if (precipitation !== undefined) updateData.precipitation = precipitation;
    if (windSpeed !== undefined) updateData.windSpeed = windSpeed;
    if (weatherNotes !== undefined) updateData.weatherNotes = weatherNotes ? sanitizeText(weatherNotes) : null;
    if (workPerformed !== undefined) updateData.workPerformed = workPerformed ? sanitizeText(workPerformed) : null;
    if (workPlanned !== undefined) updateData.workPlanned = workPlanned ? sanitizeText(workPlanned) : null;
    if (delaysEncountered !== undefined) updateData.delaysEncountered = delaysEncountered ? sanitizeText(delaysEncountered) : null;
    if (delayHours !== undefined) updateData.delayHours = delayHours;
    if (delayReason !== undefined) updateData.delayReason = delayReason ? sanitizeText(delayReason) : null;
    if (safetyIncidents !== undefined) updateData.safetyIncidents = safetyIncidents;
    if (safetyNotes !== undefined) updateData.safetyNotes = safetyNotes ? sanitizeText(safetyNotes) : null;
    if (visitors !== undefined) updateData.visitors = visitors;
    if (equipmentOnSite !== undefined) updateData.equipmentOnSite = equipmentOnSite;
    if (materialsReceived !== undefined) updateData.materialsReceived = materialsReceived;
    if (photoIds !== undefined) updateData.photoIds = photoIds;

    // Update labor entries if provided
    if (laborEntries) {
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
        equipmentEntries: true,
        progressEntries: true,
        createdByUser: { select: { id: true, username: true } },
      },
    });

    // Audit log
    try {
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          action: status ? `DAILY_REPORT_${status}` : 'DAILY_REPORT_UPDATED',
          resource: 'DailyReport',
          resourceId: report.id,
          details: {
            projectId: project.id,
            reportNumber: existingReport.reportNumber,
            ...(rejectionReason ? { rejectionReason } : {}),
          },
        },
      });
    } catch (auditError) {
      log.warn('Failed to create audit log', { error: auditError });
    }

    // Trigger RAG indexing for approved reports (best-effort)
    if (status === 'APPROVED') {
      try {
        const { indexDailyReport } = await import('@/lib/daily-report-indexer');
        const indexResult = await indexDailyReport(params.id);
        if (indexResult.errors.length > 0) {
          log.warn('RAG indexing warnings', { reportId: params.id, errors: indexResult.errors });
        }
      } catch (indexError) {
        log.error('RAG indexing failed (non-blocking)', indexError as Error, { reportId: params.id });
      }
    }

    return NextResponse.json({ report });
  } catch (error) {
    log.error('Failed to update report', error as Error);
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

    // Check membership — ADMIN only for delete
    const role = await getDailyReportRole(session.user.id, project.id);
    if (!role || !canDeleteReport(role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Verify report exists and belongs to this project
    const existingReport = await prisma.dailyReport.findUnique({
      where: { id: params.id },
      select: { id: true, projectId: true, reportNumber: true, deletedAt: true },
    });

    if (!existingReport || existingReport.projectId !== project.id || existingReport.deletedAt) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Soft delete
    await prisma.dailyReport.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    // Audit log
    try {
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          action: 'DAILY_REPORT_DELETED',
          resource: 'DailyReport',
          resourceId: params.id,
          details: {
            projectId: project.id,
            reportNumber: existingReport.reportNumber,
          },
        },
      });
    } catch (auditError) {
      log.warn('Failed to create audit log', { error: auditError });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Failed to delete report', error as Error);
    return NextResponse.json(
      { error: 'Failed to delete report' },
      { status: 500 }
    );
  }
}
