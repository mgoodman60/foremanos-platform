/**
 * MEP Path Tracing API (Legacy compatibility)
 * Redirects to the new trace-path endpoint
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEP_PATH_TRACING');

export async function POST(
  _request: NextRequest,
  { params: _params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      message: 'This endpoint has been moved. Please use /api/projects/[slug]/mep/trace-path instead.'
    }, { status: 301 });
  } catch (error) {
    logger.error('Path tracing error', error);
    return NextResponse.json(
      { error: 'Failed to trace path' },
      { status: 500 }
    );
  }
}
