/**
 * Progress Detection API
 * Analyzes photos and reports to detect schedule progress
 */

import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  detectProgressFromDailyReport,
  applyProgressUpdates,
  getSiteProgressSummary,
  analyzeConstructionPhoto,
} from '@/lib/progress-detection-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_DAILY_REPORTS_PROGRESS_DETECTION');

export async function GET(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findFirst({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check membership
    const { getDailyReportRole } = await import('@/lib/daily-report-permissions');
    const role = await getDailyReportRole(session.user.id, project.id);
    if (!role) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get site-wide progress summary
    const summary = await getSiteProgressSummary(project.id);

    return NextResponse.json(summary);
  } catch (error) {
    logger.error('[Progress Detection API] Error', error);
    return NextResponse.json({ error: 'Failed to get progress summary' }, { status: 500 });
  }
}

export async function POST(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findFirst({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check membership — REPORTER+ can use progress detection
    const { getDailyReportRole, canCreateReport } = await import('@/lib/daily-report-permissions');
    const role = await getDailyReportRole(session.user.id, project.id);
    if (!role || !canCreateReport(role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { action, reportId, photoUrl, updates } = body;

    if (action === 'analyze-report' && reportId) {
      // Detect progress from a specific daily report
      const detections = await detectProgressFromDailyReport(project.id, reportId);
      return NextResponse.json({
        success: true,
        detections,
        message: `Found ${detections.length} potential progress updates`,
      });
    }

    if (action === 'analyze-photo' && photoUrl) {
      // Analyze a single photo
      const analysis = await analyzeConstructionPhoto(photoUrl, `Project: ${project.name}`);
      return NextResponse.json({
        success: true,
        analysis,
      });
    }

    if (action === 'apply-updates' && updates) {
      // Apply progress updates to schedule
      const result = await applyProgressUpdates(updates, session.user.id);
      return NextResponse.json({
        success: true,
        updated: result.updated,
        errors: result.errors,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    logger.error('[Progress Detection API] Error', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
