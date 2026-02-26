import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('DOCUMENTS_ACCESS');

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins and clients can change document access levels
    if (session.user.role !== 'admin' && session.user.role !== 'client') {
      return NextResponse.json(
        { error: 'Only administrators and clients can change document visibility' },
        { status: 403 }
      );
    }

    const { accessLevel } = await request.json();

    // Validate access level
    const validAccessLevels = ['admin', 'client', 'guest'];
    if (!accessLevel || !validAccessLevels.includes(accessLevel)) {
      return NextResponse.json(
        { error: 'Invalid access level. Must be "admin", "client", or "guest"' },
        { status: 400 }
      );
    }

    // Get the document
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

    // For clients, verify they own the project
    if (session.user.role === 'client') {
      if (document.Project?.ownerId !== session.user.id) {
        return NextResponse.json(
          { error: 'You can only change visibility for documents in your own projects' },
          { status: 403 }
        );
      }
    }

    // Update the document access level
    const updatedDocument = await prisma.document.update({
      where: { id: params.id },
      data: {
        accessLevel,
        updatedBy: session.user.id,
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'DOCUMENT_ACCESS_CHANGED',
        details: `Changed access level for "${document.name}" to "${accessLevel}"`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      },
    });

    return NextResponse.json({
      success: true,
      document: updatedDocument,
      message: 'Document visibility updated successfully',
    });
  } catch (error) {
    logger.error('Error updating document access', error);
    return NextResponse.json(
      { error: 'Failed to update document visibility' },
      { status: 500 }
    );
  }
}
