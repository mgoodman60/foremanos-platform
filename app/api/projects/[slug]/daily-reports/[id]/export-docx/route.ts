/**
 * Daily Report DOCX Export API
 * Generates editable Word document for daily field reports
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  generateDailyReportDOCX,
  formatDailyReportForExport,
} from '@/lib/daily-report-docx-generator';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_DAILY_REPORTS_EXPORT_DOCX');

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ slug: string; id: string }> }
) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check membership — any role can export
    const { getDailyReportRole } = await import('@/lib/daily-report-permissions');
    const role = await getDailyReportRole(session.user.id, project.id);
    if (!role) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch the daily report with all related data
    const report = await prisma.dailyReport.findFirst({
      where: {
        id: params.id,
        projectId: project.id,
      },
      include: {
        createdByUser: {
          select: { username: true },
        },
        laborEntries: true,
        equipmentEntries: true,
        progressEntries: true,
      },
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Format data for export
    const reportWithRelations = report as any;
    const exportData = formatDailyReportForExport(
      reportWithRelations,
      // @ts-expect-error strictNullChecks migration
      project,
      reportWithRelations.laborEntries || [],
      reportWithRelations.equipmentEntries || [],
      reportWithRelations.progressEntries || []
    );

    // Generate DOCX
    const docxBlob = await generateDailyReportDOCX(exportData);
    const arrayBuffer = await docxBlob.arrayBuffer();

    // Format filename
    const dateStr = new Date(report.reportDate).toISOString().split('T')[0];
    const filename = `daily-report-${report.reportNumber}-${dateStr}.docx`;

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error('Export error', error);
    return NextResponse.json(
      { error: 'Failed to generate DOCX' },
      { status: 500 }
    );
  }
}
