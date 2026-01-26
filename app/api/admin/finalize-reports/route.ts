/**
 * Admin Report Finalization API
 * 
 * POST /api/admin/finalize-reports
 * Manually trigger finalization for all pending reports
 * (Used by scheduled task)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import {
  getReportsReadyForFinalization,
  finalizeReport,
} from '@/lib/report-finalization';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Allow both admin users and system calls (no auth for scheduled tasks)
    const isAdmin = session?.user?.email === 'admin@construction.local';
    const isSystemCall = !session; // Scheduled task calls without auth

    if (!isAdmin && !isSystemCall) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
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
    console.error('[ADMIN_FINALIZE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to finalize reports' },
      { status: 500 }
    );
  }
}
