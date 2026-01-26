/**
 * API endpoint to get the status of all regulatory documents
 * 
 * GET /api/regulatory-documents/status
 * 
 * Returns the cache status of all available regulatory documents
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getRegulatoryDocumentsStatus } from '@/lib/regulatory-documents';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can view regulatory document status
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const status = await getRegulatoryDocumentsStatus();

    return NextResponse.json({
      success: true,
      documents: status,
      summary: {
        total: status.length,
        cached: status.filter((d) => d.cached).length,
        needsProcessing: status.filter((d) => !d.cached).length,
        totalChunks: status.reduce((sum, d) => sum + d.chunkCount, 0),
      },
    });
  } catch (error) {
    console.error('Error fetching regulatory documents status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}
