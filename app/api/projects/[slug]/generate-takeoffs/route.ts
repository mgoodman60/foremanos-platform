import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { safeErrorMessage } from '@/lib/api-error';
import {
  calculateProjectTakeoffs,
  aggregateTakeoffs,
  saveTakeoffsToDatabase,
} from '@/lib/takeoff-calculator';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_GENERATE_TAKEOFFS');

interface RouteContext {
  params: Promise<{
    slug: string;
  }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    // Authentication
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const { slug } = params;

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Authorization check
    const isOwner = project.ownerId === user.id;
    const isMember = await prisma.projectMember.findFirst({
      where: {
        projectId: project.id,
        userId: user.id,
      },
    });

    if (!isOwner && !isMember && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'You do not have permission to generate takeoffs for this project' },
        { status: 403 }
      );
    }

    // Parse request body for optional ceiling height
    let ceilingHeight = 9; // Default
    try {
      const body = await request.json();
      if (body.ceilingHeight && typeof body.ceilingHeight === 'number') {
        ceilingHeight = body.ceilingHeight;
      }
    } catch {
      // Use default if no body or parsing fails
    }

    // Calculate takeoffs for all rooms
    logger.info('Calculating takeoffs for project', { slug: project.slug });
    const calculations = await calculateProjectTakeoffs(project.id, ceilingHeight);

    if (calculations.length === 0) {
      return NextResponse.json(
        {
          error: 'No rooms with finish schedules found',
          message:
            'Make sure rooms have been extracted and finish schedules have been populated',
        },
        { status: 400 }
      );
    }

    // Aggregate by material
    const summary = aggregateTakeoffs(calculations);

    // Save to database
    const takeoffId = await saveTakeoffsToDatabase(
      project.id,
      calculations,
      user.id,
      `Automatic Takeoff - ${new Date().toLocaleDateString()}`
    );

    logger.info('Created takeoff', { takeoffId, lineItems: calculations.length });

    return NextResponse.json({
      success: true,
      takeoffId,
      lineItemCount: calculations.length,
      roomCount: new Set(calculations.map((c) => c.roomId)).size,
      summary,
      message: `Generated ${calculations.length} takeoff line items from ${new Set(calculations.map((c) => c.roomId)).size} rooms`,
    });
  } catch (error: unknown) {
    logger.error('Generation failed', error);
    return NextResponse.json(
      { error: 'Failed to generate takeoffs', details: safeErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    // Authentication
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const { slug } = params;

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Authorization check
    const isOwner = project.ownerId === user.id;
    const isMember = await prisma.projectMember.findFirst({
      where: {
        projectId: project.id,
        userId: user.id,
      },
    });

    if (!isOwner && !isMember && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'You do not have permission to view takeoffs for this project' },
        { status: 403 }
      );
    }

    // Get all takeoffs for the project
    const takeoffs = await prisma.materialTakeoff.findMany({
      where: {
        projectId: project.id,
      },
      include: {
        TakeoffLineItem: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      takeoffs,
    });
  } catch (error: unknown) {
    logger.error('Fetch failed', error);
    return NextResponse.json(
      { error: 'Failed to fetch takeoffs', details: safeErrorMessage(error) },
      { status: 500 }
    );
  }
}
