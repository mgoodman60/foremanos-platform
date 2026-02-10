import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getRoomProgressSummary } from '@/lib/location-detector';
import { getPrimaryDoorTypeForRoom } from '@/lib/door-schedule-extractor';
import { isExteriorEquipment, isExteriorLocation } from '@/lib/exterior-equipment-classifier';
import { logger } from '@/lib/logger';

// Helper to format floor number into a readable label
function formatFloorLabel(floorNumber: number | null | undefined): string {
  if (floorNumber === null || floorNumber === undefined) return 'Unassigned';
  if (floorNumber === 0) return 'Basement';
  if (floorNumber === 1) return '1st Floor';
  if (floorNumber === 2) return '2nd Floor';
  if (floorNumber === 3) return '3rd Floor';
  return `${floorNumber}th Floor`;
}

// Helper to map MEPEquipmentType enum to trade
function mapEquipmentTypeToTrade(type: string): string {
  const t = type?.toUpperCase() || '';
  if (['AHU','RTU','CHILLER','BOILER','FAN','VAV','FCU','EXHAUST','DAMPER','PUMP_HVAC'].some(k => t.includes(k))) return 'hvac';
  if (['TRANSFORMER','SWITCHGEAR','PANEL','MDP','DISCONNECT','VFD','GENERATOR','UPS','LIGHTING','CONTROLS','SENSOR','METER'].some(k => t.includes(k))) return 'electrical';
  if (['WATER_HEATER','PUMP_PLUMBING','FIXTURE','BACKFLOW','PRV'].some(k => t.includes(k))) return 'plumbing';
  if (['FIRE_PUMP','SPRINKLER','FIRE_ALARM','SMOKE_DETECTOR'].some(k => t.includes(k))) return 'fire_alarm';
  return 'electrical';
}

// GET /api/projects/[slug]/rooms - List all rooms
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const floor = searchParams.get('floor');

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        User_Project_ownerIdToUser: true,
        ProjectMember: { include: { User: true } }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify access
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = project.ownerId === user.id;
    const isMember = project.ProjectMember.some((m: any) => m.userId === user.id);

    if (!isOwner && !isMember && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Summary mode: return only count of document-backed rooms (excludes orphans)
    const isSummaryMode = searchParams.get('summary');
    if (isSummaryMode === 'true') {
      const total = await prisma.room.count({
        where: { projectId: project.id, sourceDocumentId: { not: null } }
      });
      return NextResponse.json({ total });
    }

    // Build where clause
    const where: any = { projectId: project.id };
    if (type) where.type = type;
    if (status) where.status = status;
    if (floor) where.floorNumber = parseInt(floor);

    // Get rooms with finish items (include all relevant fields including hotspot coordinates)
    const rooms = await prisma.room.findMany({
      where,
      include: {
        FinishScheduleItem: {
          select: {
            id: true, category: true, finishType: true, material: true,
            manufacturer: true, color: true, dimensions: true, modelNumber: true,
            csiCode: true, status: true, isConfirmed: true,
          },
          orderBy: { category: 'asc' }
        }
      },
      orderBy: [
        { floorNumber: 'asc' },
        { roomNumber: 'asc' }
      ]
    });

    // Fetch MEP equipment from takeoff line items
    const MEP_CATEGORIES = ['Electrical', 'electrical', 'Plumbing', 'plumbing', 'HVAC', 'hvac', 'Fire Alarm', 'fire_alarm', 'Fire Protection', 'fire_protection'];

    const [mepTakeoffs, mepEquipmentRecords] = await Promise.all([
      prisma.materialTakeoff.findMany({
        where: { projectId: project.id },
        include: {
          TakeoffLineItem: {
            where: {
              category: { in: MEP_CATEGORIES }
            }
          }
        }
      }),
      prisma.mEPEquipment.findMany({
        where: { projectId: project.id },
        select: {
          id: true, equipmentTag: true, name: true, equipmentType: true,
          manufacturer: true, model: true, capacity: true, specifications: true,
          level: true, room: true, gridLocation: true, status: true,
          estimatedCost: true, notes: true,
        },
      }),
    ]);

    // Flatten MEP items and create lookup by room/location
    const mepItems = mepTakeoffs.flatMap(t => t.TakeoffLineItem);
    
    // Helper to get trade from category
    const getTradeFromCategory = (category: string): 'electrical' | 'hvac' | 'plumbing' | 'fire_alarm' => {
      const cat = category.toLowerCase();
      if (cat.includes('electric')) return 'electrical';
      if (cat.includes('hvac') || cat.includes('mechanical')) return 'hvac';
      if (cat.includes('plumb')) return 'plumbing';
      return 'fire_alarm';
    };

    // Track tag counters for each trade
    const tagCounters: Record<string, number> = { E: 0, H: 0, P: 0, FA: 0 };

    // Helper to clean up MEP item names aggressively
    const cleanMEPName = (rawName: string): string => {
      if (!rawName) return '';
      let name = rawName;
      
      // Remove all document reference patterns like "- One Senior Care..." or "(Page X)"
      // First strip everything after " - " if it contains document-like patterns
      if (name.includes(' - ') && (name.includes('(Page') || name.includes('Conformance') || name.includes('Senior'))) {
        name = name.split(' - ')[0];
      }
      
      // Remove any remaining (Page X) patterns
      name = name.replace(/\s*\(Page\s*\d+\)/gi, '');
      
      // Remove trailing commas and cleanup
      name = name.replace(/,\s*$/, '').trim();
      
      // Convert snake_case to Title Case
      if (name.includes('_')) {
        name = name
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      }
      
      // Capitalize common abbreviations
      name = name.replace(/\b(led|hvac|vav|ahu|rtu)\b/gi, m => m.toUpperCase());
      
      // Trim and ensure proper length
      return name.substring(0, 50);
    };

    // Transform takeoff MEP items with tags
    const mepEquipmentList = mepItems.map(item => {
      const trade = getTradeFromCategory(item.category);
      const prefix = trade === 'electrical' ? 'E' : trade === 'hvac' ? 'H' : trade === 'plumbing' ? 'P' : 'FA';
      tagCounters[prefix]++;

      // Clean up item name - prioritize itemName, then category
      const displayName = cleanMEPName(item.itemName || item.category);

      return {
        id: item.id,
        tag: `${prefix}-${String(tagCounters[prefix]).padStart(3, '0')}`,
        name: displayName,
        trade,
        quantity: item.quantity,
        unit: item.unit,
        unitCost: item.unitCost,
        totalCost: item.totalCost,
        location: item.location || '',
        level: item.level || '',
        roomNumber: item.gridLocation || '', // Sometimes room info is in gridLocation
        source: 'takeoff' as const,
      };
    });

    // Transform MEPEquipment records into the same format
    const mepEquipFromDB = mepEquipmentRecords.map(equip => {
      const trade = mapEquipmentTypeToTrade(equip.equipmentType);
      return {
        id: equip.id,
        tag: equip.equipmentTag,
        name: equip.name,
        trade,
        type: equip.equipmentType,
        manufacturer: equip.manufacturer,
        model: equip.model,
        capacity: equip.capacity,
        specifications: equip.specifications,
        status: equip.status,
        estimatedCost: equip.estimatedCost,
        notes: equip.notes,
        location: equip.room || '',
        level: equip.level || '',
        roomNumber: equip.room || '',
        gridLocation: equip.gridLocation || '',
        source: 'mep_equipment' as const,
      };
    });

    // Merge both MEP sources, deduplicating by tag (prefer mep_equipment over takeoff)
    const seenTags = new Set<string>();
    const allMEP: Array<{
      id: string;
      tag: string;
      name: string;
      trade: string;
      location: string;
      level: string;
      source: 'takeoff' | 'mep_equipment';
      [key: string]: any;
    }> = [];

    // Add MEPEquipment records first (preferred source)
    for (const equip of mepEquipFromDB) {
      const tagKey = equip.tag.toLowerCase();
      if (!seenTags.has(tagKey)) {
        seenTags.add(tagKey);
        allMEP.push(equip);
      }
    }
    // Add takeoff items that don't duplicate
    for (const item of mepEquipmentList) {
      const tagKey = item.tag.toLowerCase();
      if (!seenTags.has(tagKey)) {
        seenTags.add(tagKey);
        allMEP.push(item);
      }
    }

    // Split MEP into interior and exterior equipment
    const interiorMEP = allMEP.filter(mep => {
      if (isExteriorEquipment(mep.name?.toLowerCase() || '', mep.name || '')) return false;
      if (mep.location && isExteriorLocation(mep.location)) return false;
      return true;
    });
    const exteriorMEP = allMEP.filter(mep => !interiorMEP.includes(mep));

    if (exteriorMEP.length > 0) {
      logger.info('ROOMS_API', 'Separated exterior MEP equipment', {
        total: mepEquipmentList.length,
        interior: interiorMEP.length,
        exterior: exteriorMEP.length,
      });
    }

    // Match MEP equipment to rooms
    const roomsWithMEP = rooms.map(room => {
      // Find MEP items that match this room by name, number, or location
      const roomName = room.name.toLowerCase();
      const roomNumber = room.roomNumber?.toLowerCase() || '';
      const roomType = room.type?.toLowerCase() || '';

      const matchedMEP = interiorMEP.filter(mep => {
        const mepLocation = mep.location.toLowerCase();
        const mepLevel = mep.level.toLowerCase();
        const mepRoomNum = (mep as any).roomNumber?.toLowerCase() || '';
        const mepGridLoc = (mep as any).gridLocation?.toLowerCase() || '';

        // Match by room number
        if (roomNumber && (mepLocation.includes(roomNumber) || mepRoomNum.includes(roomNumber) || mepGridLoc.includes(roomNumber))) {
          return true;
        }

        // Match by room name (case-insensitive)
        if (roomName && (mepLocation.includes(roomName) || mepLevel.includes(roomName) || mepRoomNum.includes(roomName))) {
          return true;
        }

        // Match by room type (e.g., "bathroom" matches plumbing items)
        if (roomType.includes('bath') || roomType.includes('restroom') || roomType.includes('toilet')) {
          if (mep.trade === 'plumbing') return true;
        }
        if (roomType.includes('kitchen') || roomType.includes('break')) {
          if (mep.trade === 'plumbing' || mep.trade === 'electrical') return true;
        }
        if (roomType.includes('mechanical') || roomType.includes('mech')) {
          if (mep.trade === 'hvac') return true;
        }
        if (roomType.includes('electrical') || roomType.includes('elec')) {
          if (mep.trade === 'electrical') return true;
        }

        return false;
      });

      return {
        ...room,
        floor: formatFloorLabel(room.floorNumber),
        mepEquipment: matchedMEP.length > 0 ? matchedMEP : undefined
      };
    });

    // If no location-based matches, distribute MEP equipment based on room type
    const roomsWithAnyMEP = roomsWithMEP.filter(r => r.mepEquipment && r.mepEquipment.length > 0);
    
    let finalRooms = roomsWithMEP;
    
    // If we have MEP data but few room matches (less than 30% of rooms), assign based on room type
    if (interiorMEP.length > 0 && roomsWithAnyMEP.length < Math.max(3, rooms.length * 0.3)) {
      // Group MEP by trade and create pools to track assigned items (interior only)
      const mepByTrade: Record<string, typeof interiorMEP> = {
        electrical: interiorMEP.filter(m => m.trade === 'electrical'),
        hvac: interiorMEP.filter(m => m.trade === 'hvac'),
        plumbing: interiorMEP.filter(m => m.trade === 'plumbing'),
        fire_alarm: interiorMEP.filter(m => m.trade === 'fire_alarm')
      };
      
      // Track indexes for round-robin distribution
      const tradeIndexes: Record<string, number> = { electrical: 0, hvac: 0, plumbing: 0, fire_alarm: 0 };
      
      // Helper to get MEP items from a trade pool
      const getMEPFromPool = (trade: keyof typeof mepByTrade, count: number) => {
        const pool = mepByTrade[trade];
        const result = [];
        for (let i = 0; i < count && pool.length > 0; i++) {
          const idx = tradeIndexes[trade] % pool.length;
          result.push(pool[idx]);
          tradeIndexes[trade]++;
        }
        return result;
      };

      finalRooms = rooms.map(room => {
        const roomMEP: (typeof allMEP)[number][] = [];
        const roomType = room.type?.toLowerCase() || '';
        const roomName = room.name.toLowerCase();
        
        // Bathrooms/Restrooms/PC Bath/Toilet - get plumbing fixtures
        if (roomType.includes('bath') || roomType.includes('restroom') || roomType.includes('toilet') || 
            roomType.includes('pc bath') || roomName.includes('bath')) {
          roomMEP.push(...getMEPFromPool('plumbing', 3));
          roomMEP.push(...getMEPFromPool('electrical', 2));
        }
        
        // Kitchens/Break rooms/Catering/Serving/Pantry - get plumbing + electrical
        else if (roomType.includes('kitchen') || roomType.includes('break') || roomType.includes('catering') ||
            roomType.includes('serving') || roomType.includes('pantry') || roomName.includes('kitchen')) {
          roomMEP.push(...getMEPFromPool('plumbing', 3));
          roomMEP.push(...getMEPFromPool('electrical', 4));
          roomMEP.push(...getMEPFromPool('hvac', 1));
        }
        
        // Offices/Reception/Nurse Station get electrical + HVAC
        else if (roomType.includes('office') || roomType.includes('admin') || roomType.includes('reception') ||
            roomType.includes('nurse') || roomName.includes('office')) {
          roomMEP.push(...getMEPFromPool('electrical', 4));
          roomMEP.push(...getMEPFromPool('hvac', 1));
        }
        
        // Medical rooms (Exam, Lab, Med Room, Therapy, Obs/Triage) - electrical + specialized
        else if (roomType.includes('exam') || roomType.includes('lab') || roomType.includes('med room') ||
            roomType.includes('therapy') || roomType.includes('triage') || roomType.includes('observation')) {
          roomMEP.push(...getMEPFromPool('electrical', 5));
          roomMEP.push(...getMEPFromPool('plumbing', 2));
          roomMEP.push(...getMEPFromPool('hvac', 1));
        }
        
        // Laundry rooms - plumbing + electrical
        else if (roomType.includes('laundry') || roomType.includes('linen')) {
          roomMEP.push(...getMEPFromPool('plumbing', 3));
          roomMEP.push(...getMEPFromPool('electrical', 3));
          roomMEP.push(...getMEPFromPool('hvac', 1));
        }
        
        // IT/IDT rooms - heavy electrical
        else if (roomType.includes('it') || roomType.includes('idt') || roomType.includes('data') ||
            roomType.includes('server')) {
          roomMEP.push(...getMEPFromPool('electrical', 6));
          roomMEP.push(...getMEPFromPool('hvac', 2));
        }
        
        // Common areas/Corridors/Lobby/Multipurpose - HVAC + electrical + fire
        else if (roomType.includes('common') || roomType.includes('lobby') || roomType.includes('corridor') || 
            roomType.includes('hall') || roomType.includes('multipurpose') || roomType.includes('program') ||
            roomType.includes('circulation') || roomType.includes('vestibule') || roomType.includes('vest')) {
          roomMEP.push(...getMEPFromPool('electrical', 3));
          roomMEP.push(...getMEPFromPool('hvac', 2));
          roomMEP.push(...getMEPFromPool('fire_alarm', 1));
        }
        
        // Mechanical rooms - heavy HVAC + electrical
        else if (roomType.includes('mechanical') || roomType.includes('mech') || roomName.includes('mechanical')) {
          roomMEP.push(...getMEPFromPool('hvac', 5));
          roomMEP.push(...getMEPFromPool('electrical', 4));
        }
        
        // Janitor/Utility/Storage - basic electrical + plumbing for janitor
        else if (roomType.includes('janitor') || roomType.includes('utility')) {
          roomMEP.push(...getMEPFromPool('plumbing', 2));
          roomMEP.push(...getMEPFromPool('electrical', 2));
        }
        else if (roomType.includes('storage') || roomType.includes('closet')) {
          roomMEP.push(...getMEPFromPool('electrical', 1));
        }
        
        // All other rooms get basic electrical if nothing else matched
        else if (mepByTrade.electrical.length > 0) {
          roomMEP.push(...getMEPFromPool('electrical', 2));
          roomMEP.push(...getMEPFromPool('hvac', 1));
        }

        return {
          ...room,
          floor: formatFloorLabel(room.floorNumber),
          mepEquipment: roomMEP.length > 0 ? roomMEP : undefined
        };
      });
    }

    // Add synthetic "Site / Exterior" entry for exterior MEP equipment
    if (exteriorMEP.length > 0) {
      finalRooms.push({
        id: 'site-exterior',
        name: 'Site / Exterior',
        roomNumber: 'EXT',
        type: 'exterior',
        floorNumber: null,
        floor: 'Exterior',
        area: null,
        status: 'not_started',
        percentComplete: 0,
        projectId: project.id,
        buildingId: null,
        notes: null,
        sourceDocumentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        FinishScheduleItem: [],
        mepEquipment: exteriorMEP,
      } as any);
    }

    // Get progress summary
    const summary = await getRoomProgressSummary(project.id);

    // Enrich rooms with door type information
    const roomsWithDoors = await Promise.all(
      finalRooms.map(async (room) => {
        let doorType: string | null = null;
        if (room.roomNumber) {
          try {
            doorType = await getPrimaryDoorTypeForRoom(project.id, room.roomNumber);
          } catch (err) {
            // Silently ignore door lookup errors
          }
        }
        return {
          ...room,
          doorType,
        };
      })
    );

    return NextResponse.json({ rooms: roomsWithDoors, summary });
  } catch (error: any) {
    logger.error('ROOMS_API', 'Error fetching rooms', error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch rooms', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/projects/[slug]/rooms - Create new room
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();
    const {
      name,
      roomNumber,
      type,
      floorNumber,
      area,
      buildingId,
      notes
    } = body;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        User_Project_ownerIdToUser: true,
        ProjectMember: { include: { User: true } }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify access
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = project.ownerId === user.id;
    const isMember = project.ProjectMember.some((m: any) => m.userId === user.id);

    if (!isOwner && !isMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Create room
    const room = await prisma.room.create({
      data: {
        projectId: project.id,
        name,
        roomNumber,
        type,
        floorNumber: floorNumber ? parseInt(floorNumber) : null,
        area: area ? parseFloat(area) : null,
        buildingId,
        notes
      }
    });

    logger.info('ROOMS_API', 'Created room', { roomName: room.name, projectName: project.name });

    return NextResponse.json({ room }, { status: 201 });
  } catch (error: any) {
    logger.error('ROOMS_API', 'Error creating room', error as Error);
    return NextResponse.json(
      { error: 'Failed to create room', details: error.message },
      { status: 500 }
    );
  }
}
