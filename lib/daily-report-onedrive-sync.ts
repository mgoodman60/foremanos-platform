import { prisma } from '@/lib/db';
import { createScopedLogger } from '@/lib/logger';
import { OneDriveService } from '@/lib/onedrive-service';
import { generateDailyReportDOCX, formatDailyReportForExport } from '@/lib/daily-report-docx-generator';
import { downloadFile } from '@/lib/s3';

const log = createScopedLogger('DAILY_REPORT_ONEDRIVE');

export interface OneDriveSyncResult {
  success: boolean;
  pdfUploaded: boolean;
  docxUploaded: boolean;
  photosUploaded: number;
  exportPath: string;
  errors: string[];
}

/**
 * Sync an approved daily report to OneDrive (DOCX + Photos)
 * Called when a report transitions to APPROVED status.
 *
 * Folder structure: {projectName}/Daily Reports/{YYYY-MM}/
 * Photo subfolder: .../Photos/report-{number}-{date}/
 */
export async function syncDailyReportToOneDrive(
  reportId: string
): Promise<OneDriveSyncResult> {
  const errors: string[] = [];
  let pdfUploaded = false;
  let docxUploaded = false;
  let photosUploaded = 0;
  let exportPath = '';

  try {
    const report = await prisma.dailyReport.findUnique({
      where: { id: reportId },
      include: {
        project: true,
        createdByUser: { select: { username: true } },
        laborEntries: true,
        equipmentEntries: true,
        progressEntries: true,
      },
    });

    if (!report) {
      return { success: false, pdfUploaded, docxUploaded, photosUploaded, exportPath, errors: ['Report not found'] };
    }

    const project = report.project;

    // Check if OneDrive is configured
    if (!project.oneDriveAccessToken || !project.oneDriveRefreshToken || !project.oneDriveTokenExpiry) {
      log.info('OneDrive not configured for project, skipping sync', { projectId: project.id });
      return { success: true, pdfUploaded, docxUploaded, photosUploaded, exportPath, errors: ['OneDrive not configured'] };
    }

    const onedrive = new OneDriveService({
      projectId: project.id,
      accessToken: project.oneDriveAccessToken,
      refreshToken: project.oneDriveRefreshToken,
      tokenExpiry: project.oneDriveTokenExpiry,
      folderId: project.oneDriveFolderId || undefined,
    });

    const dateStr = new Date(report.reportDate).toISOString().split('T')[0];
    const monthStr = dateStr.slice(0, 7);
    const basePath = `${project.name}/Daily Reports/${monthStr}`;
    exportPath = basePath;

    // Generate and upload DOCX
    try {
      const exportData = formatDailyReportForExport(
        report as any,
        project,
        report.laborEntries || [],
        report.equipmentEntries || [],
        report.progressEntries || []
      );
      const docxBlob = await generateDailyReportDOCX(exportData);
      const docxBuffer = Buffer.from(await docxBlob.arrayBuffer());
      const docxFileName = `daily-report-${report.reportNumber}-${dateStr}.docx`;

      await onedrive.uploadFile(docxBuffer, docxFileName, basePath);
      docxUploaded = true;
      log.info('DOCX uploaded to OneDrive', { reportId, fileName: docxFileName });
    } catch (err) {
      log.error('Failed to upload DOCX', err as Error, { reportId });
      errors.push(`DOCX upload failed: ${(err as Error).message}`);
    }

    // Upload photos
    const photos = (report.photos as any[]) || [];
    if (photos.length > 0) {
      const photoPath = `${basePath}/Photos/report-${report.reportNumber}-${dateStr}`;

      for (const photo of photos) {
        try {
          const s3Key = photo.s3Key || photo.key;
          if (!s3Key) continue;

          const photoBuffer = await downloadFile(s3Key);
          if (!photoBuffer) continue;

          const photoFileName = photo.fileName || photo.name || `photo-${photosUploaded + 1}.jpg`;
          await onedrive.uploadFile(Buffer.from(photoBuffer), photoFileName, photoPath);
          photosUploaded++;
        } catch (err) {
          log.warn('Failed to upload photo', { reportId, error: err });
          errors.push(`Photo upload failed: ${photo.fileName || 'unknown'}`);
        }
      }
    }

    // Update export status
    await prisma.dailyReport.update({
      where: { id: reportId },
      data: {
        onedriveExported: true,
        onedriveExportedAt: new Date(),
        onedriveExportPath: exportPath,
      },
    });

    log.info('Daily report synced to OneDrive', { reportId, docxUploaded, photosUploaded, exportPath });
    return { success: true, pdfUploaded, docxUploaded, photosUploaded, exportPath, errors };
  } catch (error) {
    log.error('OneDrive sync failed', error as Error, { reportId });
    return { success: false, pdfUploaded, docxUploaded, photosUploaded, exportPath, errors: [(error as Error).message] };
  }
}

/**
 * Retry OneDrive upload for an approved report
 */
export async function retryOneDriveSync(reportId: string): Promise<OneDriveSyncResult> {
  await prisma.dailyReport.update({
    where: { id: reportId },
    data: {
      onedriveExported: false,
      onedriveExportedAt: null,
      onedriveExportPath: null,
    },
  });

  return syncDailyReportToOneDrive(reportId);
}
