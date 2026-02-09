/**
 * Document library integration for finalized reports
 */

import { prisma } from '../db';
import { format } from 'date-fns';

/**
 * Save report to Document Library
 */
export async function saveToDocumentLibrary(
  conversationId: string,
  pdfPath: string
): Promise<string> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { Project: true },
  });

  if (!conversation?.Project) {
    throw new Error('Project not found');
  }

  // Ensure "Daily Reports" folder exists
  let folderId = conversation.Project?.dailyReportsFolderId;

  if (!folderId) {
    // Create folder if it doesn't exist
    const folder = await prisma.document.create({
      data: {
        projectId: conversation.Project?.id,
        name: 'Daily Reports',
        fileName: 'Daily Reports',
        fileType: 'folder',
        accessLevel: 'admin', // Admin-only by default
      },
    });

    folderId = folder.id;

    // Update project with folder ID
    await prisma.project.update({
      where: { id: conversation.Project?.id },
      data: { dailyReportsFolderId: folderId },
    });
  }

  // Create document entry
  const reportDate = conversation.dailyReportDate
    ? format(new Date(conversation.dailyReportDate), 'MMMM dd, yyyy')
    : format(new Date(), 'MMMM dd, yyyy');

  const fileName = `daily-report-${format(
    conversation.dailyReportDate ? new Date(conversation.dailyReportDate) : new Date(),
    'yyyy-MM-dd'
  )}.pdf`;

  const document = await prisma.document.create({
    data: {
      projectId: conversation.Project?.id,
      name: `Daily Report - ${reportDate}`,
      fileName,
      fileType: 'application/pdf',
      cloud_storage_path: pdfPath,
      isPublic: false,
      fileSize: 0, // Will be updated when actual PDF is generated
      accessLevel: 'admin',
      description: `Auto-generated daily report for ${reportDate}. Conversation ID: ${conversationId}`,
      processed: true, // Generated PDFs don't need OCR processing
      syncSource: 'workflow_generated',
    },
  });

  return document.id;
}
