import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { processDocument } from '@/lib/document-processor';

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

    console.log(`[Reprocess] Starting reprocessing for document: ${document.name} (${id})`);

    // Delete existing chunks
    await prisma.documentChunk.deleteMany({
      where: { documentId: id },
    });
    console.log(`[Reprocess] Deleted existing chunks`);

    // Reset document processing status
    await prisma.document.update({
      where: { id },
      data: {
        processed: false,
        pagesProcessed: 0,
      },
    });
    console.log(`[Reprocess] Reset processing status`);

    // Trigger reprocessing (processDocument handles fetching from S3)
    await processDocument(id);
    console.log(`[Reprocess] Document reprocessing initiated`);

    return NextResponse.json({
      success: true,
      message: 'Document reprocessing started',
      documentId: id,
    });
  } catch (error: any) {
    console.error('[Reprocess] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reprocess document' },
      { status: 500 }
    );
  }
}
