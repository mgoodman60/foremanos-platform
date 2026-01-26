import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/lib/db-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dbHealthy = await checkDatabaseHealth();
    
    const health = {
      status: dbHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealthy ? 'ok' : 'error',
        api: 'ok',
      },
    };
    
    return NextResponse.json(health, {
      status: dbHealthy ? 200 : 503,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      },
      { status: 503 }
    );
  }
}
