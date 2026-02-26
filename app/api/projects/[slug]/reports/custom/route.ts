import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { generateCustomReport, reportToCSV, ReportConfig } from '@/lib/report-generator';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_REPORTS_CUSTOM');

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const { title, sections, format, dateRange } = body;

    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json(
        { error: 'At least one section is required' },
        { status: 400 }
      );
    }

    const config: ReportConfig = {
      type: 'CUSTOM',
      projectId: project.id,
      title: title || `Custom Report - ${project.name}`,
      sections,
      format: format || 'JSON',
      dateRange: dateRange ? {
        start: new Date(dateRange.start),
        end: new Date(dateRange.end)
      } : undefined
    };

    const report = await generateCustomReport(config);

    // Add CSV content if requested
    if (format === 'CSV') {
      (report as any).csvContent = reportToCSV(report);
    }

    return NextResponse.json(report);
  } catch (error) {
    logger.error('[Reports Custom] Error', error);
    return NextResponse.json(
      { error: 'Failed to generate custom report' },
      { status: 500 }
    );
  }
}
