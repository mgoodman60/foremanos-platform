import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getCacheStats, getTopCachedQueries, clearCache } from '@/lib/query-cache';
import { createLogger } from '@/lib/logger';

const logger = createLogger('CACHE_STATS');

/**
 * GET /api/cache/stats
 * Returns cache statistics for monitoring cost savings
 * Only accessible to admins
 */
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Only admins can view cache stats
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }
    
    const stats = getCacheStats();
    const topQueries = getTopCachedQueries(20);
    
    return NextResponse.json({
      stats,
      topQueries,
      message: 'Cache statistics retrieved successfully',
    });
  } catch (error) {
    logger.error('Failed to fetch cache stats', error);
    return NextResponse.json(
      { error: 'Failed to fetch cache statistics' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cache/stats
 * Clears the cache
 * Only accessible to admins
 */
export async function DELETE() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Only admins can clear cache
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }
    
    clearCache();
    
    return NextResponse.json({
      message: 'Cache cleared successfully',
    });
  } catch (error) {
    logger.error('Failed to clear cache', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
