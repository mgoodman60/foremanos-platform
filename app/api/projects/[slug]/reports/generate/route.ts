import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  generateExecutiveSummary,
  generateProgressReport,
  generateCostReport,
  generateMEPReport,
  generateResourceReport,
  ReportType
} from '@/lib/report-generator';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
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
    const { type, period } = body as { type: ReportType; period?: 'weekly' | 'monthly' };

    let report;
    switch (type) {
      case 'EXECUTIVE_SUMMARY':
        report = await generateExecutiveSummary(project.id);
        break;
      case 'PROGRESS_REPORT':
        report = await generateProgressReport(project.id, period || 'weekly');
        break;
      case 'COST_REPORT':
        report = await generateCostReport(project.id);
        break;
      case 'MEP_REPORT':
        report = await generateMEPReport(project.id);
        break;
      case 'RESOURCE_REPORT':
        report = await generateResourceReport(project.id);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        );
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('[Reports Generate] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
