/**
 * Daily Report Sync API
 * 
 * Syncs daily report data to budget and schedule
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { syncDailyReportFull } from '@/lib/daily-report-sync-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_DAILY_REPORTS_SYNC');

export async function POST(
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

    // Check membership — SUPERVISOR or ADMIN only for sync
    const { getDailyReportRole, canApproveReport } = await import('@/lib/daily-report-permissions');
    const role = await getDailyReportRole(session.user.id, project.id);
    if (!role || !canApproveReport(role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id } = params;

    // Perform full sync
    const result = await syncDailyReportFull(id);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Sync failed', details: result.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      laborSynced: result.laborSynced,
      equipmentSynced: result.equipmentSynced,
      progressSynced: result.progressSynced,
      totalCostSynced: result.totalCostSynced,
      budgetItemsUpdated: result.budgetItemsUpdated,
      scheduleTasksUpdated: result.scheduleTasksUpdated,
      warnings: result.warnings
    });

  } catch (error) {
    logger.error('[DailyReportSync API] Error', error);
    return NextResponse.json(
      { error: 'Failed to sync daily report' },
      { status: 500 }
    );
  }
}
