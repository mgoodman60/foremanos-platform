import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { parseSheetNumber, matchesFloor } from '@/lib/sheet-number-parser';
import { logger } from '@/lib/logger';
import { safeErrorMessage } from '@/lib/api-error';

/**
 * GET /api/projects/[slug]/floor-plans/discipline-sheets?baseSheet=A-101
 * Returns MEP sheets that match the floor level of the base architectural sheet
 * Used for overlay visualization in the floor plan viewer
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { slug } = params;
    const { searchParams } = new URL(request.url);
    const baseSheet = searchParams.get('baseSheet');

    // Validate base sheet parameter
    if (!baseSheet) {
      return NextResponse.json(
        { error: 'baseSheet parameter is required' },
        { status: 400 }
      );
    }

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        User_Project_ownerIdToUser: true,
        ProjectMember: { include: { User: true } },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Verify user access
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const isOwner = (project as any).ownerId === (user as any).id;
    const isMember = project.ProjectMember.some((m: any) => m.userId === (user as any).id);
    const isAdmin = (user as any).role === 'admin';

    if (!isOwner && !isMember && !isAdmin) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    logger.info('DISCIPLINE_SHEETS_API', `Fetching MEP sheets for base sheet ${baseSheet} in project ${project.name}`);

    // Parse base sheet to extract level information
    const parsedBase = parseSheetNumber(baseSheet);
    if (!parsedBase) {
      return NextResponse.json(
        { error: 'Invalid base sheet number format' },
        { status: 400 }
      );
    }

    // Query DocumentChunks for MEP disciplines
    const mepChunks = await prisma.documentChunk.findMany({
      where: {
        Document: {
          projectId: project.id,
          deletedAt: null,
        },
        discipline: {
          in: ['Mechanical', 'Electrical', 'Plumbing', 'Fire Protection'],
        },
        drawingType: 'floor_plan',
        sheetNumber: {
          not: null,
        },
      },
      select: {
        id: true,
        documentId: true,
        sheetNumber: true,
        discipline: true,
        scaleRatio: true,
        chunkIndex: true,
        pageNumber: true,
      },
    });

    logger.info('DISCIPLINE_SHEETS_API', `Found ${mepChunks.length} MEP floor plan chunks`);

    // Get base sheet's scale ratio
    const baseChunk = await prisma.documentChunk.findFirst({
      where: {
        Document: {
          projectId: project.id,
          deletedAt: null,
        },
        sheetNumber: baseSheet,
      },
      select: {
        scaleRatio: true,
      },
    });

    const baseScaleRatio = baseChunk?.scaleRatio || null;

    // Filter chunks that match the base sheet's floor level
    const matchingSheets = mepChunks
      .filter((chunk) => {
        if (!chunk.sheetNumber) return false;
        return matchesFloor(baseSheet, chunk.sheetNumber);
      })
      .map((chunk) => {
        // Calculate scale factor for overlay alignment
        // scaleFactor = baseScale / mepScale (how much to scale MEP to match base)
        let scaleFactor = 1.0;
        if (baseScaleRatio && chunk.scaleRatio) {
          scaleFactor = baseScaleRatio / chunk.scaleRatio;
        }

        return {
          id: chunk.id,
          documentId: chunk.documentId,
          sheetNumber: chunk.sheetNumber,
          discipline: chunk.discipline,
          pageNumber: chunk.pageNumber || chunk.chunkIndex + 1, // Use pageNumber if available, fallback to chunkIndex
          scaleRatio: chunk.scaleRatio,
          scaleFactor, // How much to scale this sheet to match base sheet
        };
      });

    logger.info('DISCIPLINE_SHEETS_API', `Found ${matchingSheets.length} matching MEP sheets for floor level`);

    return NextResponse.json({
      baseSheet,
      baseSheetInfo: parsedBase,
      baseScaleRatio,
      sheets: matchingSheets,
      total: matchingSheets.length,
    });
  } catch (error: unknown) {
    logger.error('DISCIPLINE_SHEETS_API', 'Error fetching discipline sheets', error as Error);
    return NextResponse.json(
      {
        error: 'Failed to fetch discipline sheets',
        details: safeErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
