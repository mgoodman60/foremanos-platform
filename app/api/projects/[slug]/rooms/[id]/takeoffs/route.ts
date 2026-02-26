import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_ROOMS_TAKEOFFS');

/**
 * GET /api/projects/[slug]/rooms/[id]/takeoffs
 * 
 * Fetches all takeoff line items associated with a specific room.
 * Matches takeoffs by:
 * 1. Exact room name match in location field
 * 2. Room number match in location field
 * 3. Fuzzy location matching (contains room name/number)
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ slug: string; id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, id: roomId } = params;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get room details
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        name: true,
        roomNumber: true,
        type: true,
        area: true,
        floorNumber: true,
        projectId: true,
      },
    });

    if (!room || room.projectId !== project.id) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Get all material takeoffs for this project
    const takeoffs = await prisma.materialTakeoff.findMany({
      where: { projectId: project.id },
      select: { id: true },
    });

    const takeoffIds = takeoffs.map((t) => t.id);

    if (takeoffIds.length === 0) {
      return NextResponse.json({
        room: {
          id: room.id,
          name: room.name,
          number: room.roomNumber,
          type: room.type,
          area: room.area,
          floor: room.floorNumber,
        },
        takeoffItems: [],
        summary: {
          totalItems: 0,
          totalCost: 0,
          categories: {},
        },
      });
    }

    // Build location matching conditions
    const locationMatches: string[] = [];
    
    // Add room name variations
    if (room.name) {
      locationMatches.push(room.name);
      locationMatches.push(room.name.toLowerCase());
      locationMatches.push(room.name.toUpperCase());
    }
    
    // Add room number variations
    if (room.roomNumber) {
      locationMatches.push(room.roomNumber);
      locationMatches.push(`Room ${room.roomNumber}`);
      locationMatches.push(`Rm ${room.roomNumber}`);
      locationMatches.push(`#${room.roomNumber}`);
      // Handle room numbers like "101" -> "Room 101", "101A", etc.
      if (/^\d+[A-Za-z]?$/.test(room.roomNumber)) {
        locationMatches.push(`Room ${room.roomNumber}`);
      }
    }

    // Query takeoff line items that match this room's location
    const takeoffItems = await prisma.takeoffLineItem.findMany({
      where: {
        takeoffId: { in: takeoffIds },
        OR: [
          // Exact matches
          { location: { in: locationMatches } },
          // Partial matches (contains room name or number)
          ...(room.name ? [{ location: { contains: room.name, mode: 'insensitive' as const } }] : []),
          ...(room.roomNumber ? [{ location: { contains: room.roomNumber, mode: 'insensitive' as const } }] : []),
        ],
      },
      orderBy: [
        { category: 'asc' },
        { itemName: 'asc' },
      ],
    });

    // Calculate summary statistics
    const summary = {
      totalItems: takeoffItems.length,
      totalCost: takeoffItems.reduce((sum, item) => sum + (item.totalCost || 0), 0),
      categories: {} as Record<string, { count: number; cost: number; items: string[] }>,
    };

    // Group by category
    for (const item of takeoffItems) {
      const category = item.category || 'Uncategorized';
      if (!summary.categories[category]) {
        summary.categories[category] = { count: 0, cost: 0, items: [] };
      }
      summary.categories[category].count++;
      summary.categories[category].cost += item.totalCost || 0;
      if (!summary.categories[category].items.includes(item.itemName)) {
        summary.categories[category].items.push(item.itemName);
      }
    }

    return NextResponse.json({
      room: {
        id: room.id,
        name: room.name,
        number: room.roomNumber,
        type: room.type,
        area: room.area,
        floor: room.floorNumber,
      },
      takeoffItems: takeoffItems.map((item) => ({
        id: item.id,
        category: item.category,
        itemName: item.itemName,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitCost: item.unitCost,
        totalCost: item.totalCost,
        location: item.location,
        sheetNumber: item.sheetNumber,
        gridLocation: item.gridLocation,
        confidence: item.confidence,
        verified: item.verified,
        verificationStatus: item.verificationStatus,
        sourceType: item.sourceType,
        level: item.level,
        material: item.material,
      })),
      summary,
    });
  } catch (error) {
    logger.error('Error fetching room takeoffs', error);
    return NextResponse.json(
      { error: 'Failed to fetch room takeoffs' },
      { status: 500 }
    );
  }
}
