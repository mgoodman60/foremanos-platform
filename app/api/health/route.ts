import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/lib/db-helpers';
import { checkS3Health } from '@/lib/s3-health';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [dbHealthy, s3Status] = await Promise.all([
      checkDatabaseHealth(),
      checkS3Health(),
    ]);

    const s3Degraded = s3Status === 'error';
    const isHealthy = dbHealthy && !s3Degraded;

    const health = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealthy ? 'ok' : 'error',
        s3: s3Status,
        api: 'ok',
      },
    };

    return NextResponse.json(health, {
      status: isHealthy ? 200 : 503,
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
