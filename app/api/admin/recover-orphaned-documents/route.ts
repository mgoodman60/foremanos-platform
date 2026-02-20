import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import {
  recoverAllOrphanedDocuments,
  getOrphanedDocumentStats,
} from '@/lib/orphaned-document-recovery';
import { createScopedLogger } from '@/lib/logger';
import { apiError } from '@/lib/api-error';

const log = createScopedLogger('ADMIN_RECOVERY');

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/recover-orphaned-documents
 * Manually trigger orphaned document recovery
 * Admin only
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return apiError('Admin access required', 403, 'FORBIDDEN');
    }

    // Run recovery
    const recoveredCount = await recoverAllOrphanedDocuments();

    return NextResponse.json({
      success: true,
      recoveredCount,
      message: `Recovery complete: ${recoveredCount} document(s) recovered`,
    });
  } catch (error: any) {
    log.error('Recovery failed', error);
    return apiError('Failed to recover orphaned documents', 500, 'INTERNAL_ERROR');
  }
}

/**
 * GET /api/admin/recover-orphaned-documents
 * Get orphaned document statistics
 * Admin only
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return apiError('Admin access required', 403, 'FORBIDDEN');
    }

    // Get stats
    const stats = await getOrphanedDocumentStats();

    return NextResponse.json({
      success: true,
      ...stats,
    });
  } catch (error: any) {
    log.error('Failed to get orphaned document stats', error);
    return apiError('Failed to get orphaned document stats', 500, 'INTERNAL_ERROR');
  }
}
