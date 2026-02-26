import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { runAutoMEPExtraction, countDoorsByType } from '@/lib/auto-mep-extractor';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_AUTO_ENHANCE');

export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      include: { Room: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    logger.info('[Auto-Enhance] Starting for project', { project: project.name });

    // Run MEP extraction and room linking
    const mepResult = await runAutoMEPExtraction(project.id);
    logger.info('[Auto-Enhance] MEP extraction complete', { roomsUpdated: mepResult.roomsUpdated });

    // Get door counts
    const doorCounts = await countDoorsByType(project.id);
    logger.info('[Auto-Enhance] Doors counted', { total: doorCounts.total, fromSchedule: doorCounts.fromSchedule });

    return NextResponse.json({
      success: true,
      mep: {
        roomsUpdated: mepResult.roomsUpdated,
        totalRooms: project.Room.length
      },
      doors: {
        total: doorCounts.total,
        exterior: doorCounts.exterior,
        interior: doorCounts.interior,
        fire: doorCounts.fire,
        auto: doorCounts.auto,
        fromSchedule: doorCounts.fromSchedule
      }
    });
  } catch (error) {
    logger.error('[Auto-Enhance] Error', error);
    return NextResponse.json(
      { error: 'Failed to run auto-enhancement' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      include: { Room: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get current MEP status
    const roomsWithMEP = project.Room.filter(r => r.notes?.includes('[MEP]')).length;
    const doorCounts = await countDoorsByType(project.id);

    return NextResponse.json({
      project: project.name,
      mep: {
        roomsWithMEP,
        totalRooms: project.Room.length,
        coverage: project.Room.length > 0 ? Math.round((roomsWithMEP / project.Room.length) * 100) : 0
      },
      doors: doorCounts
    });
  } catch (error) {
    logger.error('[Auto-Enhance] Error', error);
    return NextResponse.json(
      { error: 'Failed to get enhancement status' },
      { status: 500 }
    );
  }
}
