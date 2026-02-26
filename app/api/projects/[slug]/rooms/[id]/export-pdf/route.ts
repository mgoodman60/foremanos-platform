/**
 * Room Sheet PDF Export API
 * Generates a comprehensive single-page PDF with all room data (server-side)
 * Supports ?format=json for DOCX export consumers
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateRoomSheetPDF } from '@/lib/room-pdf-generator';
import { createScopedLogger } from '@/lib/logger';

const log = createScopedLogger('ROOM_EXPORT');

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string; id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, id: roomId } = params;
    const format = req.nextUrl.searchParams.get('format');

    // Get project with clientName and projectAddress
    const project = await prisma.project.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        clientName: true,
        projectAddress: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get room with all related data
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        FinishScheduleItem: true,
      },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Get MEP equipment for this room
    const mepEquipment = await prisma.mEPEquipment.findMany({
      where: {
        projectId: project.id,
        OR: [
          { room: { contains: room.name, mode: 'insensitive' } },
          { room: { contains: room.roomNumber || '', mode: 'insensitive' } },
        ],
      },
    });

    // Get takeoff items for this room - first try room-specific, then all project items
    let takeoffItems = await prisma.takeoffLineItem.findMany({
      where: {
        MaterialTakeoff: {
          projectId: project.id,
        },
        OR: [
          { location: { contains: room.name, mode: 'insensitive' } },
          { location: { contains: room.roomNumber || '', mode: 'insensitive' } },
        ],
      },
      include: {
        MaterialTakeoff: true,
      },
    });

    // If no room-specific takeoffs found, include ALL project takeoffs
    if (takeoffItems.length === 0) {
      takeoffItems = await prisma.takeoffLineItem.findMany({
        where: {
          MaterialTakeoff: {
            projectId: project.id,
          },
        },
        include: {
          MaterialTakeoff: true,
        },
        orderBy: [
          { category: 'asc' },
          { itemName: 'asc' },
        ],
      });
    }

    // Group finish schedule items by category and de-duplicate
    const finishesByCategory: Record<string, any[]> = {};
    const seenFinishes = new Set<string>();

    (room.FinishScheduleItem || []).forEach((item: any) => {
      const category = item.category || 'Other';

      // Create a unique key based on item properties to detect duplicates
      const uniqueKey = [
        item.finishType || '',
        item.material || '',
        item.manufacturer || '',
        item.modelNumber || '',
        item.code || ''
      ].join('|').toLowerCase().trim();

      // Skip if we've already seen this exact item
      if (seenFinishes.has(uniqueKey) && uniqueKey !== '||||') {
        return;
      }
      seenFinishes.add(uniqueKey);

      if (!finishesByCategory[category]) {
        finishesByCategory[category] = [];
      }

      // Clean up item names (remove underscores)
      const cleanedItem = {
        ...item,
        finishType: item.finishType?.replace(/_/g, ' ')?.trim(),
        material: item.material?.replace(/_/g, ' ')?.trim(),
        manufacturer: item.manufacturer?.replace(/_/g, ' ')?.trim(),
        modelNumber: item.modelNumber?.replace(/_/g, ' ')?.trim(),
        notes: item.notes?.replace(/_/g, ' ')?.trim(),
      };

      finishesByCategory[category].push(cleanedItem);
    });

    // Group MEP by equipment type
    const mepBySystem: Record<string, any[]> = {};
    mepEquipment.forEach((item) => {
      const system = item.equipmentType || 'Other';
      if (!mepBySystem[system]) {
        mepBySystem[system] = [];
      }
      mepBySystem[system].push(item);
    });

    // Group takeoff items by category with cleaned names
    const takeoffByCategory: Record<string, any[]> = {};
    takeoffItems.forEach((item) => {
      const category = (item.category || 'Other').replace(/_/g, ' ').trim();
      if (!takeoffByCategory[category]) {
        takeoffByCategory[category] = [];
      }
      // Clean up item names (remove underscores)
      const cleanedItem = {
        ...item,
        itemName: item.itemName?.replace(/_/g, ' ')?.trim(),
        description: item.description?.replace(/_/g, ' ')?.trim(),
        notes: item.notes?.replace(/_/g, ' ')?.trim(),
      };
      takeoffByCategory[category].push(cleanedItem);
    });

    // Build comprehensive room data
    const roomData = {
      project: {
        name: project.name,
        slug: project.slug,
        clientName: project.clientName || undefined,
        address: project.projectAddress || undefined,
      },
      room: {
        id: room.id,
        name: room.name,
        roomNumber: room.roomNumber,
        type: room.type,
        floorNumber: room.floorNumber,
        area: room.area,
        gridLocation: room.gridLocation,
        status: room.status,
        percentComplete: room.percentComplete,
        notes: room.notes,
        tradeType: room.tradeType,
        assignedTo: room.assignedTo,
      },
      finishSchedule: {
        categories: Object.keys(finishesByCategory),
        items: finishesByCategory,
        totalItems: room.FinishScheduleItem?.length || 0,
      },
      mepEquipment: {
        systems: Object.keys(mepBySystem),
        items: mepBySystem,
        totalItems: mepEquipment.length,
      },
      takeoffItems: {
        categories: Object.keys(takeoffByCategory),
        items: takeoffByCategory,
        totalItems: takeoffItems.length,
        totalCost: takeoffItems.reduce((sum, item) => sum + (item.totalCost || 0), 0),
      },
      exportedAt: new Date().toISOString(),
      appUrl: `${req.nextUrl.origin}/project/${slug}/rooms`,
    };

    // Return JSON when ?format=json is specified (for DOCX export)
    if (format === 'json') {
      return NextResponse.json(roomData);
    }

    // Default: generate PDF server-side and return binary
    // @ts-expect-error strictNullChecks migration
    const pdfBlob = await generateRoomSheetPDF(roomData);
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const roomLabel = room.roomNumber || room.name;
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${roomLabel}-room-sheet-${dateStr}.pdf`;

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    log.error('Failed to export room data', error as Error);
    return NextResponse.json(
      { error: 'Failed to export room data' },
      { status: 500 }
    );
  }
}
