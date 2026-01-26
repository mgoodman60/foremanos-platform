/**
 * Daily Report Sync API
 * 
 * Syncs daily report data to budget and schedule
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { syncDailyReportFull } from '@/lib/daily-report-sync-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    console.error('[DailyReportSync API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync daily report' },
      { status: 500 }
    );
  }
}
