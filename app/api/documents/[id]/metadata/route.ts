import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/audit-log';
import { createLogger } from '@/lib/logger';
const logger = createLogger('DOCUMENTS_METADATA');

export const dynamic = 'force-dynamic';

// PATCH /api/documents/[id]/metadata - Update document metadata
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only clients and admins can edit metadata
    if (session.user.role !== 'client' && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = params;
    const body = await request.json();
    const { description, tags } = body;

    // Find document
    const document = await prisma.document.findUnique({
      where: { id },
      include: { Project: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check if user has access to this document's project
    if (session.user.role === 'client' && document.Project?.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update document metadata
    const updatedDocument = await prisma.document.update({
      where: { id },
      data: {
        description: description !== undefined ? description : document.description,
        tags: tags !== undefined ? tags : document.tags,
        updatedBy: session.user.id,
        updatedAt: new Date(),
      },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'document_metadata_updated',
      resource: 'document',
      resourceId: document.id,
      details: {
        documentName: document.name,
        projectName: document.Project?.name,
        changes: { description, tags },
      },
    });

    return NextResponse.json({
      success: true,
      document: {
        id: updatedDocument.id,
        name: updatedDocument.name,
        description: updatedDocument.description,
        tags: updatedDocument.tags,
        updatedAt: updatedDocument.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error updating document metadata', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
