/**
 * Bulk Room Export API
 * POST /api/projects/[slug]/rooms/bulk-export
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  fetchRoomsForExport,
  generateBulkPDF,
  generateBulkDOCX,
} from '@/lib/room-bulk-export';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_ROOMS_BULK_EXPORT');

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();
    const {
      roomIds,
      format = 'pdf',
      includeFinishSchedule = true,
      includeMEP = true,
      includePhotos = false,
    } = body;

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch rooms
    const rooms = await fetchRoomsForExport(project.id, roomIds);

    if (rooms.length === 0) {
      return NextResponse.json(
        { error: 'No rooms found to export' },
        { status: 400 }
      );
    }

    const options = {
      projectId: project.id,
      format,
      includeFinishSchedule,
      includeMEP,
      includePhotos,
    };

    let blob: Blob;
    let contentType: string;
    let filename: string;

    const dateStr = new Date().toISOString().split('T')[0];

    if (format === 'docx') {
      blob = await generateBulkDOCX(project.name, rooms, options);
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      filename = `room-schedule-${slug}-${dateStr}.docx`;
    } else {
      blob = await generateBulkPDF(project.name, rooms, options);
      contentType = 'application/pdf';
      filename = `room-schedule-${slug}-${dateStr}.pdf`;
    }

    const arrayBuffer = await blob.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    logger.error('[Bulk Export API] Error', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: errMsg || 'Failed to generate export' },
      { status: 500 }
    );
  }
}
