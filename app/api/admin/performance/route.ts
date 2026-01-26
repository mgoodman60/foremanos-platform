import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { responseCache, documentCache, queryCache } from '@/lib/performance-cache';
import { realtimeEvents } from '@/lib/websocket-server';
import { checkRedisHealth } from '@/lib/redis-client';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get cache statistics (now async)
    const [responseStats, documentStats, queryStats] = await Promise.all([
      responseCache.getStats(),
      documentCache.getStats(),
      queryCache.getStats()
    ]);

    const cacheStats = {
      response: {
        ...responseStats,
        backend: responseCache.isUsingRedis() ? 'redis' : 'memory'
      },
      Document: {
        ...documentStats,
        backend: documentCache.isUsingRedis() ? 'redis' : 'memory'
      },
      query: {
        ...queryStats,
        backend: queryCache.isUsingRedis() ? 'redis' : 'memory'
      },
      combined: {
        totalSize: responseStats.size + documentStats.size + queryStats.size,
        totalEntries: responseStats.entries + documentStats.entries + queryStats.entries,
        overallHitRate: (
          (responseStats.hits + documentStats.hits + queryStats.hits) /
          Math.max(1, responseStats.hits + responseStats.misses +
           documentStats.hits + documentStats.misses +
           queryStats.hits + queryStats.misses)
        ) || 0
      }
    };

    // Get Redis health check
    const redisHealth = await checkRedisHealth();

    // Get WebSocket statistics
    const realtimeStats = {
      subscriberCount: realtimeEvents.getSubscriberCount(),
      recentEvents: realtimeEvents.getRecentEvents('*', 10)
    };

    // Get memory usage (Node.js)
    const memoryUsage = process.memoryUsage();
    const memoryStats = {
      heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
      heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
      external: (memoryUsage.external / 1024 / 1024).toFixed(2) + ' MB',
      rss: (memoryUsage.rss / 1024 / 1024).toFixed(2) + ' MB'
    };

    return NextResponse.json({
      cache: cacheStats,
      realtime: realtimeStats,
      redis: redisHealth,
      memory: memoryStats,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Performance stats error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get performance stats' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'clearCache') {
      const cacheType = searchParams.get('type');
      
      if (cacheType === 'response') {
        await responseCache.clear();
      } else if (cacheType === 'document') {
        await documentCache.clear();
      } else if (cacheType === 'query') {
        await queryCache.clear();
      } else {
        // Clear all caches
        await Promise.all([
          responseCache.clear(),
          documentCache.clear(),
          queryCache.clear()
        ]);
      }

      return NextResponse.json({
        success: true,
        message: `Cache cleared: ${cacheType || 'all'}`
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Performance action error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to perform action' },
      { status: 500 }
    );
  }
}
