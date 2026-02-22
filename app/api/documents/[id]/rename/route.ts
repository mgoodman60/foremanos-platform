import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('DOCUMENTS_RENAME');

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await req.json();

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }

    // Fetch the document
    const document = await prisma.document.findUnique({
      where: { id: params.id },
      include: {
        Project: {
          include: {
            User_Project_ownerIdToUser: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Permission check: Admin or project owner (client who owns the project)
    const isAdmin = session.user.role === 'admin';
    const isProjectOwner = document.Project?.ownerId === session.user.id;

    if (!isAdmin && !isProjectOwner) {
      return NextResponse.json(
        { error: 'You do not have permission to rename this document' },
        { status: 403 }
      );
    }

    // Rename the document
    const updatedDocument = await prisma.document.update({
      where: { id: params.id },
      data: {
        name: name.trim(),
        updatedBy: session.user.id,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'DOCUMENT_RENAMED',
        resource: 'document',
        resourceId: params.id,
        details: `Renamed document from "${document.name}" to "${name.trim()}"`,
      },
    });

    return NextResponse.json({ 
      success: true, 
      document: updatedDocument 
    });
  } catch (error) {
    logger.error('Error renaming document', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
