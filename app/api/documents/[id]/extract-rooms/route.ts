import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { extractRoomsFromDocument, createRoomsFromExtraction } from '@/lib/location-detector';
import { safeErrorMessage } from '@/lib/api-error';
import { createLogger } from '@/lib/logger';
const logger = createLogger('DOCUMENTS_EXTRACT_ROOMS');

// POST /api/documents/[id]/extract-rooms - Extract rooms from floor plan
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Get document
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        Project: {
          include: {
            User_Project_ownerIdToUser: true,
            ProjectMember: { include: { User: true } }
          }
        }
      }
    });

    if (!document || !document.Project) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Verify user access
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = document.Project.ownerId === user.id;
    const isMember = document.Project.ProjectMember.some((m: any) => m.userId === user.id);

    if (!isOwner && !isMember && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if document has been processed
    if (!document.processed) {
      return NextResponse.json(
        { error: 'Document must be processed for OCR before room extraction' },
        { status: 400 }
      );
    }

    logger.info('Starting extraction for document', { document: document.name });

    // Extract rooms
    const rooms = await extractRoomsFromDocument(id, document.Project.id);

    if (rooms.length === 0) {
      return NextResponse.json(
        { message: 'No rooms found in document', rooms: [] },
        { status: 200 }
      );
    }

    // Create rooms in database
    const created = await createRoomsFromExtraction(
      document.Project.id,
      rooms,
      user.id
    );

    logger.info('Extraction complete', { roomsFound: rooms.length, created });

    return NextResponse.json({
      message: `Successfully extracted ${rooms.length} rooms, created ${created} new entries`,
      extracted: rooms.length,
      created,
      rooms
    }, { status: 201 });
  } catch (error: unknown) {
    logger.error('Error', error);
    return NextResponse.json(
      { error: 'Failed to extract rooms', details: safeErrorMessage(error) },
      { status: 500 }
    );
  }
}
