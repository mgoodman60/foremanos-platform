import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createScopedLogger } from '@/lib/logger';
import { cleanupExpiredPhotos, getExpirationWarnings } from '@/lib/photo-retention-service';

const log = createScopedLogger('PHOTO_CLEANUP_CRON');

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      log.warn('Cron auth failed', { hasCronSecret: !!cronSecret, hasAuthHeader: !!authHeader });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projects = await prisma.project.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, photoRetentionDays: true },
    });

    const results = [];
    for (const project of projects) {
      const cleanup = await cleanupExpiredPhotos(project.id);
      const warnings = await getExpirationWarnings(project.id);

      results.push({
        projectId: project.id,
        projectName: project.name,
        deleted: cleanup.deleted,
        skipped: cleanup.skipped,
        warnings: warnings.length,
        errors: cleanup.errors,
      });
    }

    log.info('Photo cleanup cron completed', { projectCount: projects.length });

    return NextResponse.json({
      success: true,
      projectsProcessed: projects.length,
      results,
    });
  } catch (error) {
    log.error('Photo cleanup cron failed', error as Error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
