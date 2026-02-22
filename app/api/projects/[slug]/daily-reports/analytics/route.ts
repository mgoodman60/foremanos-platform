/**
 * Daily Report Analytics API
 * Provides trend analytics, completeness scoring, and equipment summaries
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  calculateCompletenessScore,
  getCompletenessTrend,
  getTrendAnalytics,
  getEquipmentSummary,
} from '@/lib/daily-report-enhancements';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_DAILY_REPORTS_ANALYTICS');

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
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

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const days = parseInt(searchParams.get('days') || '30');

    const result: Record<string, unknown> = {};

    if (type === 'all' || type === 'trends') {
      result.trendAnalytics = await getTrendAnalytics(project.id, days);
    }

    if (type === 'all' || type === 'completeness') {
      result.completenessTrend = await getCompletenessTrend(project.id, days);
      
      // Get latest report's completeness score
      const latestReport = await prisma.dailyReport.findFirst({
        where: { projectId: project.id },
        include: { laborEntries: true },
        orderBy: { reportDate: 'desc' },
      });

      if (latestReport) {
        result.latestCompleteness = calculateCompletenessScore({
          weatherCondition: latestReport.weatherCondition,
          temperatureHigh: latestReport.temperatureHigh,
          workPerformed: latestReport.workPerformed,
          workPlanned: latestReport.workPlanned,
          laborEntries: latestReport.laborEntries,
          equipmentOnSite: latestReport.equipmentOnSite,
          materialsReceived: latestReport.materialsReceived,
          safetyNotes: latestReport.safetyNotes,
          safetyIncidents: latestReport.safetyIncidents,
          photoIds: latestReport.photoIds,
        });
      }
    }

    if (type === 'all' || type === 'equipment') {
      result.equipmentSummary = await getEquipmentSummary(project.id, days);
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('[Analytics API] Error', error);
    return NextResponse.json({ error: 'Failed to get analytics' }, { status: 500 });
  }
}
