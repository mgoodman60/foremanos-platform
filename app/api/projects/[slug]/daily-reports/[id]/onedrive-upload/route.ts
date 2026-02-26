import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createScopedLogger } from '@/lib/logger';
import { getDailyReportRole, canApproveReport } from '@/lib/daily-report-permissions';
import { retryOneDriveSync } from '@/lib/daily-report-onedrive-sync';

const log = createScopedLogger('ONEDRIVE_UPLOAD_API');

export async function POST(
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
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const role = await getDailyReportRole(session.user.id, project.id);
    if (!role || !canApproveReport(role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const report = await prisma.dailyReport.findUnique({
      where: { id: params.id },
      select: { id: true, projectId: true, status: true, deletedAt: true },
    });

    if (!report || report.projectId !== project.id || report.deletedAt) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    if (report.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Only approved reports can be uploaded to OneDrive' },
        { status: 400 }
      );
    }

    const result = await retryOneDriveSync(params.id);

    return NextResponse.json({
      success: result.success,
      docxUploaded: result.docxUploaded,
      photosUploaded: result.photosUploaded,
      exportPath: result.exportPath,
      errors: result.errors,
    });
  } catch (error) {
    log.error('Manual OneDrive upload failed', error as Error);
    return NextResponse.json({ error: 'Failed to upload to OneDrive' }, { status: 500 });
  }
}
