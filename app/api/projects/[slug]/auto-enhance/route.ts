import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { runAutoMEPExtraction, extractDoorScheduleFromChunks, countDoorsByType } from '@/lib/auto-mep-extractor';

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
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

    console.log(`[Auto-Enhance] Starting for project: ${project.name}`);

    // Run MEP extraction and room linking
    const mepResult = await runAutoMEPExtraction(project.id);
    console.log(`[Auto-Enhance] MEP: ${mepResult.roomsUpdated} rooms updated`);

    // Get door counts
    const doorCounts = await countDoorsByType(project.id);
    console.log(`[Auto-Enhance] Doors: ${doorCounts.total} found (from schedule: ${doorCounts.fromSchedule})`);

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
    console.error('[Auto-Enhance] Error:', error);
    return NextResponse.json(
      { error: 'Failed to run auto-enhancement' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request, { params }: { params: { slug: string } }) {
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
    console.error('[Auto-Enhance] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get enhancement status' },
      { status: 500 }
    );
  }
}
