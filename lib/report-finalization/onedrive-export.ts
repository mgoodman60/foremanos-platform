/**
 * OneDrive/SharePoint export for finalized reports
 */

import { prisma } from '../db';
import { getFileUrl } from '../s3';
import { format } from 'date-fns';
import { OneDriveService } from '../onedrive-service';
import { createScopedLogger } from '../logger';

const log = createScopedLogger('ONEDRIVE_EXPORT');

/**
 * Export PDF to OneDrive/SharePoint
 */
export async function exportToOneDrive(
  conversationId: string,
  pdfPath: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { Project: true },
    });

    if (!conversation?.Project) {
      return { success: false, error: 'Project not found' };
    }

    // Check if OneDrive sync is enabled
    if (!conversation.Project?.syncEnabled || !conversation.Project?.oneDriveAccessToken) {
      return { success: false, error: 'OneDrive sync not enabled' };
    }

    // Initialize OneDrive service
    const oneDriveService = await OneDriveService.fromProject(conversation.Project.id);
    if (!oneDriveService) {
      return { success: false, error: 'Failed to initialize OneDrive service' };
    }

    // Create "Daily Reports" folder path
    const folderPath = `${conversation.Project?.oneDriveFolderPath || 'ForemanOS'}/Daily Reports`;

    // Prepare file name
    const reportDate = conversation.dailyReportDate
      ? format(new Date(conversation.dailyReportDate), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd');

    const fileName = `Daily_Report_${reportDate}.pdf`;

    // Fetch PDF from S3 (pdfPath is an S3 key, not a filesystem path)
    const pdfUrl = await getFileUrl(pdfPath, false);
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF from S3: ${pdfResponse.statusText}`);
    }
    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

    // Upload to OneDrive
    const _uploadResult = await oneDriveService.uploadFile(
      pdfBuffer,
      fileName,
      folderPath
    );

    const uploadPath = `${folderPath}/${fileName}`;

    return {
      success: true,
      path: uploadPath,
    };
  } catch (error) {
    log.error('OneDrive export error', error, { conversationId });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
