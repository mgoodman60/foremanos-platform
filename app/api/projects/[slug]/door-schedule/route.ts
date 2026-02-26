/**
 * Door Schedule API Endpoint
 * 
 * GET - Retrieve all doors for a project
 * POST - Extract door schedule from documents
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { processDoorScheduleForProject } from '@/lib/door-schedule-extractor';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_DOOR_SCHEDULE');

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get all doors for the project
    const doors = await prisma.doorScheduleItem.findMany({
      where: { projectId: project.id },
      orderBy: { doorNumber: 'asc' },
      include: {
        Room: {
          select: {
            id: true,
            name: true,
            roomNumber: true,
            type: true,
          },
        },
      },
    });

    // Group doors by type for summary
    const doorsByType: Record<string, number> = {};
    const doorsByFireRating: Record<string, number> = {};
    
    for (const door of doors) {
      const type = door.doorType || 'Unknown';
      doorsByType[type] = (doorsByType[type] || 0) + 1;
      
      if (door.fireRating) {
        doorsByFireRating[door.fireRating] = (doorsByFireRating[door.fireRating] || 0) + 1;
      }
    }

    return NextResponse.json({
      doors,
      summary: {
        totalDoors: doors.length,
        byType: doorsByType,
        byFireRating: doorsByFireRating,
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to fetch door schedule', error);
    return NextResponse.json(
      { error: 'Failed to fetch door schedule' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    logger.info('[Door Schedule API] Starting extraction for project', { slug });

    // Extract door schedule from documents
    const result = await processDoorScheduleForProject(project.id);

    return NextResponse.json({
      success: result.success,
      doorsExtracted: result.doorsExtracted,
      errors: result.errors,
    });
  } catch (error: unknown) {
    logger.error('Extraction error', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: errMsg || 'Failed to extract door schedule' },
      { status: 500 }
    );
  }
}
