import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createScopedLogger } from '@/lib/logger';
import {
  getDailyReportRole,
  canApproveReport,
  isValidTransition,
  sanitizeText,
} from '@/lib/daily-report-permissions';
import {
  checkRateLimit,
  RATE_LIMITS,
  getRateLimitIdentifier,
  createRateLimitHeaders,
} from '@/lib/rate-limiter';

const log = createScopedLogger('DAILY_REPORT_BULK');

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

    // Check membership — SUPERVISOR or ADMIN only
    const role = await getDailyReportRole(session.user.id, project.id);
    if (!role || !canApproveReport(role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { reportIds, action, rejectionReason, rejectionNotes } = body;

    // Validate input
    if (!Array.isArray(reportIds) || reportIds.length === 0) {
      return NextResponse.json(
        { error: 'reportIds must be a non-empty array' },
        { status: 400 }
      );
    }

    if (reportIds.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 reports per bulk operation' },
        { status: 400 }
      );
    }

    if (action !== 'APPROVED' && action !== 'REJECTED') {
      return NextResponse.json(
        { error: 'Action must be APPROVED or REJECTED' },
        { status: 400 }
      );
    }

    if (action === 'REJECTED' && !rejectionReason) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    let updated = 0;
    const failed: string[] = [];

    for (const reportId of reportIds) {
      try {
        const report = await prisma.dailyReport.findUnique({
          where: { id: reportId },
          select: {
            id: true,
            projectId: true,
            status: true,
            reportNumber: true,
            reportDate: true,
            createdBy: true,
            deletedAt: true,
          },
        });

        // Skip if report doesn't belong to this project, is deleted, or transition is invalid
        if (
          !report ||
          report.projectId !== project.id ||
          report.deletedAt ||
          !isValidTransition(report.status, action)
        ) {
          failed.push(reportId);
          continue;
        }

        const updateData: any = { status: action };

        if (action === 'APPROVED') {
          updateData.approvedAt = new Date();
          updateData.approvedBy = session.user.id;
        } else if (action === 'REJECTED') {
          updateData.rejectionReason = sanitizeText(rejectionReason);
          updateData.rejectionNotes = rejectionNotes ? sanitizeText(rejectionNotes) : null;
        }

        await prisma.dailyReport.update({
          where: { id: reportId },
          data: updateData,
        });

        // Audit log
        await prisma.activityLog.create({
          data: {
            userId: session.user.id,
            action: `DAILY_REPORT_${action}`,
            resource: 'DailyReport',
            resourceId: reportId,
            details: {
              projectId: project.id,
              reportNumber: report.reportNumber,
              bulkOperation: true,
              ...(rejectionReason ? { rejectionReason } : {}),
            },
          },
        });

        // Downstream triggers (best-effort)
        try {
          if (action === 'APPROVED') {
            // RAG indexing
            const { indexDailyReport } = await import('@/lib/daily-report-indexer');
            await indexDailyReport(reportId);

            // Budget/schedule sync
            const { syncDailyReportFull } = await import('@/lib/daily-report-sync-service');
            await syncDailyReportFull(reportId);

            // OneDrive archival
            const { syncDailyReportToOneDrive } = await import('@/lib/daily-report-onedrive-sync');
            await syncDailyReportToOneDrive(reportId);
          }

          // Email notification for both APPROVED and REJECTED
          const { sendDailyReportStatusEmail } = await import('@/lib/email-service');
          const creator = await prisma.user.findUnique({
            where: { id: report.createdBy || '' },
            select: { email: true, username: true },
          });
          const proj = await prisma.project.findUnique({
            where: { id: project.id },
            select: { name: true },
          });
          if (creator?.email) {
            await sendDailyReportStatusEmail(
              creator.email,
              creator.username || 'User',
              proj?.name || 'Project',
              report.reportNumber,
              report.reportDate ? new Date(report.reportDate).toLocaleDateString() : 'N/A',
              action as 'APPROVED' | 'REJECTED',
              action === 'REJECTED' ? (rejectionReason || undefined) : undefined,
              action === 'REJECTED' ? (rejectionNotes || undefined) : undefined,
            );
          }
        } catch (triggerError) {
          log.warn('Downstream trigger failed (non-blocking)', { reportId, error: triggerError });
        }

        updated++;
      } catch (err) {
        log.warn('Failed to process report in bulk operation', { reportId, error: err });
        failed.push(reportId);
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      failed,
    });
  } catch (error) {
    log.error('Bulk operation failed', error as Error);
    return NextResponse.json(
      { error: 'Bulk operation failed' },
      { status: 500 }
    );
  }
}
