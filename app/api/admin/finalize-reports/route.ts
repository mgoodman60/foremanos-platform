/**
 * Admin Report Finalization API
 * 
 * POST /api/admin/finalize-reports
 * Manually trigger finalization for all pending reports
 * (Used by scheduled task)
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import {
  getReportsReadyForFinalization,
  finalizeReport,
} from '@/lib/report-finalization';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ADMIN_FINALIZE');

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    // Check for cron job authentication via secret header
    const cronSecret = request.headers.get('x-cron-secret');
    const isValidCronJob = cronSecret && cronSecret === process.env.CRON_SECRET;

    // If not a valid cron job, require admin authentication
    if (!isValidCronJob) {
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthenticated' },
          { status: 401 }
        );
      }

      if (session.user.role !== 'admin') {
        return NextResponse.json(
          { error: 'Admin access required' },
          { status: 403 }
        );
      }
    }

    // Get reports ready for finalization
    const conversationIds = await getReportsReadyForFinalization();

    if (conversationIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No reports ready for finalization',
        finalized: 0,
      });
    }

    // Finalize each report
    const results: Array<{ success?: boolean; finalized?: boolean; warning?: string; error?: string }> = [];
    for (const conversationId of conversationIds) {
      const result = await finalizeReport({
        conversationId,
        method: 'auto',
        skipWarning: false, // Check for user activity
      });
      results.push(result);
    }

    // Count successes
    const finalized = results.filter((r) => r.success && r.finalized).length;
    const warnings = results.filter((r) => r.warning).length;
    const errors = results.filter((r) => r.error).length;

    return NextResponse.json({
      success: true,
      total: conversationIds.length,
      finalized,
      warnings,
      errors,
      results,
    });
  } catch (error) {
    logger.error('Failed to finalize reports', error);
    return NextResponse.json(
      { error: 'Failed to finalize reports' },
      { status: 500 }
    );
  }
}
