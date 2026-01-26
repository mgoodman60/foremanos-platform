import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import {
  recoverAllOrphanedDocuments,
  getOrphanedDocumentStats,
} from '@/lib/orphaned-document-recovery';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/recover-orphaned-documents
 * Manually trigger orphaned document recovery
 * Admin only
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Run recovery
    const recoveredCount = await recoverAllOrphanedDocuments();

    return NextResponse.json({
      success: true,
      recoveredCount,
      message: `Recovery complete: ${recoveredCount} document(s) recovered`,
    });
  } catch (error: any) {
    console.error('[ADMIN RECOVERY] Error:', error);
    return NextResponse.json(
      { error: 'Failed to recover orphaned documents' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/recover-orphaned-documents
 * Get orphaned document statistics
 * Admin only
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get stats
    const stats = await getOrphanedDocumentStats();

    return NextResponse.json({
      success: true,
      ...stats,
    });
  } catch (error: any) {
    console.error('[ADMIN RECOVERY STATS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get orphaned document stats' },
      { status: 500 }
    );
  }
}
