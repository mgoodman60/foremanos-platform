import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { downloadFile } from '@/lib/s3';
import { getDocumentMetadata } from '@/lib/document-processor';
import { logger } from '@/lib/logger';
import { tasks } from '@trigger.dev/sdk/v3';
import type { processDocumentTask } from '@/src/trigger/process-document';

export const dynamic = 'force-dynamic';

/**
 * API endpoint to reprocess a document
 * Useful when vision API was misconfigured and document needs to be re-extracted
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ slug: string; id: string }> }
) {
  const params = await props.params;
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, id } = params;

    // Find the project and verify access
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        ProjectMember: {
          where: { userId: session.user.id },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user has access (owner or member or admin)
    const isOwner = project.ownerId === session.user.id;
    const isMember = project.ProjectMember.length > 0;
    const isAdmin = session.user.role === 'admin';

    if (!isOwner && !isMember && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Find the document
    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document || document.projectId !== project.id) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (!document.cloud_storage_path) {
      return NextResponse.json({ error: 'Document has no file' }, { status: 400 });
    }

    // 60-minute reprocessing cooldown to prevent duplicate processing and wasted API credits
    if (document.processedAt) {
      const cooldownMs = 60 * 60 * 1000; // 60 minutes
      const timeSinceProcessed = Date.now() - new Date(document.processedAt).getTime();
      if (timeSinceProcessed < cooldownMs) {
        const minutesRemaining = Math.ceil((cooldownMs - timeSinceProcessed) / 60000);
        return NextResponse.json(
          { error: `Document was recently processed. Please wait ${minutesRemaining} minutes before reprocessing.` },
          { status: 429 }
        );
      }
    }

    logger.info('REPROCESS', `Starting reprocessing for document: ${document.name} (${id})`);

    // Delete existing chunks
    await prisma.documentChunk.deleteMany({
      where: { documentId: id },
    });

    // Clean up old ProcessingQueue entries
    await prisma.processingQueue.deleteMany({
      where: { documentId: id },
    });

    // Download file to get metadata
    logger.info('REPROCESS', 'Downloading file for metadata extraction', { documentId: id });
    const buffer = await downloadFile(document.cloud_storage_path!);
    const fileExtension = document.fileName.split('.').pop()?.toLowerCase() || 'pdf';

    const { totalPages, processorType } = await getDocumentMetadata(buffer, document.fileName, fileExtension);
    logger.info('REPROCESS', 'Document metadata retrieved', { totalPages, processorType });

    // Reset document processing status
    await prisma.document.update({
      where: { id },
      data: {
        processed: false,
        pagesProcessed: 0,
        queueStatus: 'queued',
        processorType,
      },
    });

    // Trigger reprocessing via Trigger.dev
    logger.info('REPROCESS', 'Triggering Trigger.dev task', { documentId: id, totalPages, processorType });
    try {
      const handle = await tasks.trigger<typeof processDocumentTask>('process-document', {
        documentId: id,
        totalPages,
        processorType,
      });
      logger.info('REPROCESS', 'Trigger.dev task triggered', { documentId: id, runId: handle.id });
    } catch (triggerError) {
      logger.error('REPROCESS', 'Failed to trigger Trigger.dev task', triggerError);
      await prisma.document.update({
        where: { id },
        data: {
          queueStatus: 'failed',
          lastProcessingError: 'Failed to start reprocessing task',
        },
      }).catch(() => {});
      throw triggerError;
    }

    return NextResponse.json({
      success: true,
      message: 'Document reprocessing started',
      documentId: id,
    });
  } catch (error: unknown) {
    logger.error('REPROCESS', 'Error initiating reprocess', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: errMsg || 'Failed to reprocess document' },
      { status: 500 }
    );
  }
}
