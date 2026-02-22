/**
 * Project Summary Report API
 * GET - Generate project summary report in PDF or DOCX
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  gatherProjectSummaryData,
  generateProjectSummaryPDF,
  generateProjectSummaryDOCX,
} from '@/lib/project-summary-report';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SUMMARY_REPORT');

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'pdf';

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Gather data
    const data = await gatherProjectSummaryData(project.id);

    // Generate report
    let blob: Blob;
    let contentType: string;
    let filename: string;
    const dateStr = new Date().toISOString().split('T')[0];

    if (format === 'docx') {
      blob = await generateProjectSummaryDOCX(data);
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      filename = `${slug}-summary-${dateStr}.docx`;
    } else {
      blob = await generateProjectSummaryPDF(data);
      contentType = 'application/pdf';
      filename = `${slug}-summary-${dateStr}.pdf`;
    }

    const arrayBuffer = await blob.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    logger.error('[Summary Report API] Error', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate report' },
      { status: 500 }
    );
  }
}
