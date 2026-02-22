import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { extractRoomsFromDocuments, saveExtractedRooms } from '@/lib/room-extractor';
import { withDatabaseRetry } from '@/lib/retry-util';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_EXTRACT_ROOMS');

/**
 * POST /api/projects/[slug]/extract-rooms
 * 
 * Extract rooms and finish schedules from project documents
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await withDatabaseRetry(() => getServerSession(authOptions));
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Get user
    const user = await withDatabaseRetry(() =>
      prisma.user.findUnique({
        where: { email: session.user?.email },
      })
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get project with access check
    const project = await withDatabaseRetry(() =>
      prisma.project.findUnique({
        where: { slug },
      })
    );

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check permissions (admin or project owner only)
    const isOwner = (project as any).ownerId === (user as any).id;
    const isAdmin = (user as any).role === 'admin';

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: 'Only admins and project owners can extract room data' },
        { status: 403 }
      );
    }

    // Extract rooms from documents
    logger.info('[Extract Rooms] Starting extraction for project: ${slug}');
    const extractionResult = await extractRoomsFromDocuments(slug);

    if (extractionResult.rooms.length === 0) {
      return NextResponse.json({
        success: false,
        message: extractionResult.summary,
        extracted: 0,
        created: 0,
        updated: 0,
      });
    }

    // Save extracted rooms to database
    const saveResult = await saveExtractedRooms(slug, extractionResult.rooms);

    logger.info('[Extract Rooms] Completed: ${saveResult.created} created, ${saveResult.updated} updated');

    return NextResponse.json({
      success: true,
      message: `Successfully extracted ${extractionResult.rooms.length} rooms from ${extractionResult.documentsProcessed} documents.`,
      extracted: extractionResult.rooms.length,
      created: saveResult.created,
      updated: saveResult.updated,
      summary: extractionResult.summary,
    });
  } catch (error: any) {
    logger.error('[Extract Rooms] Error', error);
    
    // Check for database connection errors
    if (error.code && error.code.startsWith('P1')) {
      return NextResponse.json(
        {
          error: 'Database connection error',
          message: 'Unable to connect to database. Please try again in a moment.',
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      {
        error: 'Failed to extract rooms',
        message: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
