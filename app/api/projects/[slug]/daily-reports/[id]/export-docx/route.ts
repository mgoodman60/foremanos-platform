/**
 * Daily Report DOCX Export API
 * Generates editable Word document for daily field reports
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  generateDailyReportDOCX,
  formatDailyReportForExport,
} from '@/lib/daily-report-docx-generator';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
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
    console.error('[DailyReportDOCX] Export error:', error);
    return NextResponse.json(
      { error: 'Failed to generate DOCX' },
      { status: 500 }
    );
  }
}
