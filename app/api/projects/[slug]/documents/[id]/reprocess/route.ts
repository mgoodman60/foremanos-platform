import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { processDocument } from '@/lib/document-processor';
import { waitUntil } from '@vercel/functions';
import { logger } from '@/lib/logger';

/**
 * API endpoint to reprocess a document
 * Useful when vision API was misconfigured and document needs to be re-extracted
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
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

    // Reset document processing status
    await prisma.document.update({
      where: { id },
      data: {
        processed: false,
        pagesProcessed: 0,
        queueStatus: 'queued',
      },
    });

    // Trigger reprocessing asynchronously to avoid Vercel timeout for large docs
    waitUntil(
      processDocument(id)
        .then(() => {
          logger.info('REPROCESS', `Document ${id} reprocessing completed`);
        })
        .catch(async (error) => {
          logger.error('REPROCESS', `Document ${id} reprocessing failed`, error);
          await prisma.document.update({
            where: { id },
            data: {
              queueStatus: 'failed',
              lastProcessingError: error?.message || 'Reprocessing failed',
            },
          }).catch(() => {});
        })
    );

    return NextResponse.json({
      success: true,
      message: 'Document reprocessing started',
      documentId: id,
    });
  } catch (error: any) {
    logger.error('REPROCESS', 'Error initiating reprocess', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reprocess document' },
      { status: 500 }
    );
  }
}
