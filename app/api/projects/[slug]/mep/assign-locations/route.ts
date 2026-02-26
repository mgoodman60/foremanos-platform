import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEP_ASSIGN_LOCATIONS');

export const dynamic = 'force-dynamic';

// POST /api/projects/[slug]/mep/assign-locations
// Assigns location data to MEP equipment items
export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();
    const { assignments } = body;

    // Validate input
    if (!assignments || !Array.isArray(assignments)) {
      return NextResponse.json(
        { error: 'Invalid input: assignments array required' },
        { status: 400 }
      );
    }

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

    // Check if user has access
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

    // Process assignments
    const results = {
      updated: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const assignment of assignments) {
      const { itemId, roomId, location, level, gridLocation } = assignment;

      if (!itemId) {
        results.failed++;
        results.errors.push(`Missing itemId in assignment`);
        continue;
      }

      try {
        // Get the room details if roomId provided
        let locationStr = location;
        let levelStr = level;
        let gridStr = gridLocation;

        if (roomId) {
          const room = await prisma.room.findUnique({
            where: { id: roomId },
            select: {
              name: true,
              roomNumber: true,
              floorNumber: true,
              gridLocation: true
            }
          });

          if (room) {
            locationStr = room.roomNumber ? `Room ${room.roomNumber} - ${room.name}` : room.name;
            levelStr = room.floorNumber?.toString() || level;
            gridStr = room.gridLocation || gridLocation;
          }
        }

        // Update the takeoff line item
        await prisma.takeoffLineItem.update({
          where: { id: itemId },
          data: {
            location: locationStr || null,
            level: levelStr || null,
            gridLocation: gridStr || null,
            updatedAt: new Date()
          }
        });

        results.updated++;
      } catch (error: unknown) {
        results.failed++;
        const errMsg = error instanceof Error ? error.message : String(error);
        results.errors.push(`Failed to update ${itemId}: ${errMsg}`);
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'mep_locations_assigned',
        resource: 'takeoff',
        resourceId: project.id,
        details: { 
          projectSlug: slug,
          updated: results.updated, 
          failed: results.failed 
        }
      }
    });

    return NextResponse.json({
      success: true,
      ...results
    });
  } catch (error: unknown) {
    logger.error('Error assigning MEP locations', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to assign locations', details: errMsg },
      { status: 500 }
    );
  }
}

// PUT /api/projects/[slug]/mep/assign-locations
// Auto-assign locations to MEP items based on room types
export async function PUT(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

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

    // Check access
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

    // Get MEP items without locations
    const MEP_CATEGORIES = ['Electrical', 'electrical', 'Plumbing', 'plumbing', 'HVAC', 'hvac', 'Fire Alarm', 'fire_alarm', 'Fire Protection', 'fire_protection'];
    
    const mepItems = await prisma.takeoffLineItem.findMany({
      where: {
        MaterialTakeoff: { projectId: project.id },
        category: { in: MEP_CATEGORIES },
        location: null
      },
      select: {
        id: true,
        itemName: true,
        description: true,
        category: true,
        quantity: true
      }
    });

    // Get rooms
    const rooms = await prisma.room.findMany({
      where: { projectId: project.id },
      select: {
        id: true,
        name: true,
        roomNumber: true,
        type: true,
        floorNumber: true,
        gridLocation: true,
        area: true
      }
    });

    if (rooms.length === 0) {
      return NextResponse.json({ 
        error: 'No rooms available for assignment. Please add rooms first.' 
      }, { status: 400 });
    }

    // Smart equipment-to-room matching based on equipment keywords
    // Priority 10 = exact match required, 8-9 = strong preference, 5-7 = general fit
    const equipmentRoomRules: { keywords: string[]; roomKeywords: string[]; priority: number }[] = [
      // === PLUMBING FIXTURES (specific to room types) ===
      // Toilets/Water Closets - ONLY in toilet/bathroom rooms
      { keywords: ['water_closet', 'water closet', 'wc', 'toilet', 'urinal', 'bidet'], roomKeywords: ['toilet', 'bath', 'restroom'], priority: 10 },
      
      // Lavatories - toilets, bathrooms, exam rooms with sinks
      { keywords: ['lavatory', 'ada_lavatory', 'lav', 'hand sink'], roomKeywords: ['toilet', 'bath', 'exam', 'med room', 'lab'], priority: 10 },
      
      // Kitchen sinks - catering/kitchen areas only
      { keywords: ['kitchen_sink', 'kitchen sink', 'stainless sink', 'prep sink'], roomKeywords: ['catering', 'serving', 'pantry', 'break', 'kitchen'], priority: 10 },
      
      // Mop/Service sinks - janitorial, laundry
      { keywords: ['mop_sink', 'mop sink', 'service sink', 'utility sink'], roomKeywords: ['laundry', 'janitor', 'storage', 'mechanical'], priority: 10 },
      
      // Floor drains - wet areas, mechanical
      { keywords: ['floor_drain', 'floor drain', 'trench drain'], roomKeywords: ['mechanical', 'laundry', 'toilet', 'bath', 'catering'], priority: 8 },
      
      // Water heaters - mechanical only
      { keywords: ['water_heater', 'water heater', 'hot water'], roomKeywords: ['mechanical'], priority: 10 },
      
      // Grease traps - kitchen/catering only
      { keywords: ['grease_trap', 'grease trap', 'grease interceptor'], roomKeywords: ['catering', 'serving', 'pantry'], priority: 10 },
      
      // Backflow/Cleanouts - mechanical, utility
      { keywords: ['backflow', 'cleanout', 'prv', 'pressure reducing'], roomKeywords: ['mechanical', 'utility'], priority: 9 },
      
      // Piping - distributed but weighted to mechanical
      { keywords: ['domestic_water', 'waste_pipe', 'vent_pipe', 'cw_', 'hw_', 'waste_', 'vent_'], roomKeywords: ['mechanical', 'toilet', 'bath', 'laundry', 'catering'], priority: 6 },
      
      // === HVAC EQUIPMENT ===
      // RTUs - mechanical/roof only
      { keywords: ['rtu', 'rooftop', '10ton', '5ton', '10-ton', '5-ton'], roomKeywords: ['mechanical'], priority: 10 },
      
      // VAV boxes - offices, exam, program rooms
      { keywords: ['vav', 'vav_box', 'variable air'], roomKeywords: ['office', 'exam', 'program', 'therapy', 'multipurpose', 'reception'], priority: 9 },
      
      // Exhaust fans - toilet, laundry, kitchen
      { keywords: ['exhaust', 'exhaust_fan', 'ef-'], roomKeywords: ['toilet', 'bath', 'laundry', 'catering', 'janitor'], priority: 10 },
      
      // Supply diffusers - all occupied spaces
      { keywords: ['diffuser', 'supply diffuser'], roomKeywords: ['office', 'exam', 'program', 'multipurpose', 'corridor', 'reception', 'therapy'], priority: 7 },
      
      // Return grilles - occupied spaces
      { keywords: ['return_grille', 'return grille', 'return air'], roomKeywords: ['corridor', 'office', 'exam', 'program', 'multipurpose'], priority: 7 },
      
      // Thermostats - one per zone (offices, exam, common)
      { keywords: ['thermostat', 'tstat', 'temperature'], roomKeywords: ['office', 'exam', 'program', 'reception', 'nurse', 'therapy'], priority: 9 },
      
      // Ductwork - distributed
      { keywords: ['duct_', 'ductwork', 'flex duct'], roomKeywords: ['corridor', 'mechanical', 'office'], priority: 5 },
      
      // === ELECTRICAL FIXTURES ===
      // GFCI outlets - wet locations only
      { keywords: ['gfci', 'gfci_outlet'], roomKeywords: ['toilet', 'bath', 'catering', 'serving', 'laundry', 'janitor', 'pantry', 'break'], priority: 10 },
      
      // Duplex outlets - offices, exam, common
      { keywords: ['duplex', 'duplex_outlet', 'receptacle'], roomKeywords: ['office', 'exam', 'reception', 'nurse', 'program', 'it', 'idt'], priority: 7 },
      
      // Floor boxes - open offices, reception
      { keywords: ['floor_outlet', 'floor box', 'floor_box'], roomKeywords: ['reception', 'multipurpose', 'office', 'program'], priority: 8 },
      
      // Switches - entry points to rooms
      { keywords: ['switch', 'single_pole', 'dimmer'], roomKeywords: ['office', 'exam', 'toilet', 'corridor', 'reception', 'storage'], priority: 6 },
      
      // Troffers/Lights - based on ceiling type
      { keywords: ['troffer', '2x4', '1x4', 'led'], roomKeywords: ['office', 'corridor', 'exam', 'program', 'reception', 'therapy'], priority: 6 },
      
      // Downlights - lobbies, common areas
      { keywords: ['downlight', 'recessed'], roomKeywords: ['reception', 'corridor', 'lobby', 'vest', 'multipurpose'], priority: 7 },
      
      // Wall packs - exterior, corridors
      { keywords: ['wall_pack', 'wall pack'], roomKeywords: ['vest', 'corridor', 'mechanical'], priority: 8 },
      
      // Exit signs/Emergency - egress paths
      { keywords: ['exit', 'exit_sign', 'emergency', 'emergency_light'], roomKeywords: ['corridor', 'circulation', 'vest', 'stair'], priority: 10 },
      
      // Data outlets - offices, IT, nurse stations
      { keywords: ['data', 'data_outlet', 'cat6', 'network'], roomKeywords: ['office', 'it', 'idt', 'nurse', 'reception', 'exam'], priority: 8 },
      
      // Panels - electrical/mechanical rooms
      { keywords: ['panel', '200a', '100a', 'panelboard'], roomKeywords: ['mechanical', 'electrical', 'it'], priority: 10 },
      
      // Disconnect switches - mechanical equipment
      { keywords: ['disconnect', 'fused'], roomKeywords: ['mechanical'], priority: 10 },
      
      // Conduit - mechanical, IT
      { keywords: ['conduit', 'emt'], roomKeywords: ['mechanical', 'it', 'corridor'], priority: 6 },
      
      // === FIRE ALARM ===
      { keywords: ['smoke', 'smoke_detector'], roomKeywords: ['corridor', 'office', 'mechanical', 'storage', 'program'], priority: 7 },
      { keywords: ['pull_station', 'pull station'], roomKeywords: ['corridor', 'circulation', 'vest', 'lobby'], priority: 10 },
      { keywords: ['horn_strobe', 'horn', 'strobe'], roomKeywords: ['corridor', 'toilet', 'program', 'multipurpose', 'office'], priority: 7 },
      
      // === HEALTHCARE SPECIFIC ===
      { keywords: ['nurse call', 'call station'], roomKeywords: ['exam', 'toilet', 'bath', 'obs', 'triage'], priority: 10 },
      { keywords: ['med gas', 'oxygen', 'vacuum'], roomKeywords: ['exam', 'med room', 'obs', 'triage'], priority: 10 },
      
      // === BATHROOM ACCESSORIES & SPECIALTIES ===
      // Showers - PC Bath, bathrooms only
      { keywords: ['shower', 'shower valve', 'shower head', 'hand_held', 'hand-held'], roomKeywords: ['pc bath', 'bath', 'shower'], priority: 10 },
      
      // Grab bars - ADA bathrooms, toilets
      { keywords: ['grab_bar', 'grab bar', 'grab bars', 'ada grab'], roomKeywords: ['pc bath', 'bath', 'toilet'], priority: 10 },
      
      // Toilet accessories (dispensers, hooks, etc.)
      { keywords: ['toilet_acc', 'toilet accessories', 'toilet accessory', 'bath accessories'], roomKeywords: ['toilet', 'pc bath', 'bath'], priority: 10 },
      
      // Toilet partitions - multi-stall toilets
      { keywords: ['toilet_part', 'toilet partition', 'partition'], roomKeywords: ['toilet'], priority: 10 },
      
      // Mirrors - toilets and bathrooms
      { keywords: ['mirror', 'mirrors'], roomKeywords: ['toilet', 'pc bath', 'bath'], priority: 10 },
      
      // Toilet/bathroom doors
      { keywords: ['toilet_door', 'toilet door', 'bathroom door', 'frp'], roomKeywords: ['toilet', 'pc bath', 'bath'], priority: 10 },
      
      // Paper dispensers, soap dispensers
      { keywords: ['dispenser', 'paper towel', 'soap', 'sanitizer'], roomKeywords: ['toilet', 'pc bath', 'bath', 'janitor'], priority: 9 },
      
      // Handrails - corridors, stairs, circulation
      { keywords: ['handrail', 'ext_handrail', 'interior handrail', 'railing'], roomKeywords: ['corridor', 'circulation', 'vest', 'stair'], priority: 9 },
      
      // === LIGHT FIXTURES (by type) ===
      // Troffers (2x4, 1x4) - offices, corridors, exam rooms with ACT ceilings
      { keywords: ['troffer', '2x4_troffer', '1x4_troffer', '2x4 led', '1x4 led'], roomKeywords: ['office', 'corridor', 'exam', 'program', 'reception', 'therapy', 'idt', 'it', 'nurse'], priority: 8 },
      
      // Downlights/Recessed - lobbies, reception, common areas
      { keywords: ['downlight', 'recessed', 'can light', '6" led', '4" led'], roomKeywords: ['reception', 'vest', 'lobby', 'corridor', 'multipurpose', 'quiet'], priority: 8 },
      
      // Wall sconces - corridors, lobbies
      { keywords: ['sconce', 'wall light', 'wall mount'], roomKeywords: ['corridor', 'vest', 'lobby', 'reception'], priority: 8 },
      
      // Pendants - dining, reception, multipurpose
      { keywords: ['pendant', 'hanging', 'chandelier'], roomKeywords: ['reception', 'multipurpose', 'program', 'lobby'], priority: 8 },
      
      // Under-cabinet lights - catering, pantry, lab
      { keywords: ['under cabinet', 'undercabinet', 'task light'], roomKeywords: ['catering', 'pantry', 'lab', 'med room', 'nurse'], priority: 9 },
      
      // Wall packs - vestibules, exterior, mechanical
      { keywords: ['wall_pack', 'wall pack', 'wallpack'], roomKeywords: ['vest', 'mechanical', 'storage'], priority: 8 },
      
      // Emergency/Exit lights - egress paths
      { keywords: ['exit_sign', 'exit sign', 'emergency_light', 'emergency light', 'egress'], roomKeywords: ['corridor', 'circulation', 'vest', 'stair'], priority: 10 },
      
      // Bathroom/Wet area lights - vapor-tight
      { keywords: ['vapor tight', 'wet location', 'shower light'], roomKeywords: ['toilet', 'pc bath', 'bath', 'laundry', 'janitor'], priority: 9 },
      
      // === CASEWORK & MILLWORK ===
      // Base cabinets - kitchens, labs, nurse stations
      { keywords: ['casework_base', 'base cabinet', 'base cabinets', 'lower cabinet'], roomKeywords: ['catering', 'pantry', 'lab', 'med room', 'nurse', 'break'], priority: 10 },
      
      // Upper cabinets - same locations
      { keywords: ['casework_upper', 'upper cabinet', 'upper cabinets', 'wall cabinet'], roomKeywords: ['catering', 'pantry', 'lab', 'med room', 'nurse', 'break'], priority: 10 },
      
      // Countertops - kitchens, labs, nurse stations, reception
      { keywords: ['countertop', 'countertops_lam', 'countertops_ss', 'solid surface', 'laminate top'], roomKeywords: ['catering', 'pantry', 'lab', 'med room', 'nurse', 'reception', 'break'], priority: 10 },
      
      // Reception desk/workstation
      { keywords: ['reception_desk', 'reception desk', 'work station', 'workstation'], roomKeywords: ['reception', 'lobby'], priority: 10 },
      
      // Shelving - storage, clean linen, janitor
      { keywords: ['shelving', 'wire shelving', 'adjustable shelving'], roomKeywords: ['storage', 'clean linen', 'janitor', 'laundry'], priority: 9 },
      
      // === DOORS & FRAMES ===
      // Exterior doors - vestibules, entries
      { keywords: ['ext_hm', 'exterior door', 'entry door', 'auto_entry', 'automatic', 'sliding entry'], roomKeywords: ['vest', 'lobby', 'reception'], priority: 10 },
      
      // Interior wood doors - offices, exam, program rooms
      { keywords: ['int_wood', 'interior wood', 'wood door'], roomKeywords: ['office', 'exam', 'program', 'therapy', 'quiet'], priority: 8 },
      
      // Fire-rated doors - corridors, mechanical, storage
      { keywords: ['fire_door', 'fire door', 'fire-rated', 'rated door'], roomKeywords: ['corridor', 'mechanical', 'storage', 'stair'], priority: 10 },
      
      // === WINDOWS ===
      // Standard windows - offices, common areas
      { keywords: ['window_std', 'window_lg', 'window 3', 'window 5', 'aluminum window'], roomKeywords: ['office', 'program', 'multipurpose', 'therapy', 'reception'], priority: 7 },
      
      // === ROOFING (all to mechanical/roof) ===
      { keywords: ['roof_', 'roof insulation', 'roof membrane', 'tpo', 'roof drain', 'roof curb', 'coverboard', 'flashing', 'coping'], roomKeywords: ['mechanical'], priority: 10 },
      
      // === CONCRETE/STRUCTURAL ===
      { keywords: ['slab', 'footing', 'foundation', 'equip_pad', 'equipment pad', 'anchor bolt'], roomKeywords: ['mechanical'], priority: 8 },
      
      // === SITEWORK (exterior - no room assignment needed, but fallback to general) ===
      { keywords: ['asphalt', 'sidewalk', 'curb', 'storm', 'sanitary', 'water main', 'fire hydrant', 'irrigation', 'parking', 'striping', 'bollard', 'dumpster_enc'], roomKeywords: ['vest', 'mechanical'], priority: 5 },
    ];

    // Type definitions
    type RoomType = typeof rooms[number];
    type MepItemType = typeof mepItems[number];

    // Function to find best room match for an item
    function findBestRoom(item: MepItemType, roomList: RoomType[]): RoomType | null {
      const itemText = `${item.itemName || ''} ${item.description || ''}`.toLowerCase();
      const category = (item.category || '').toLowerCase();
      
      let bestRoom: RoomType | null = null;
      let bestScore = 0;

      for (const room of roomList) {
        const roomText = `${room.name} ${room.type || ''}`.toLowerCase();
        let score = 0;

        // Check equipment-to-room rules
        for (const rule of equipmentRoomRules) {
          const hasEquipmentKeyword = rule.keywords.some(kw => itemText.includes(kw));
          const hasRoomKeyword = rule.roomKeywords.some(kw => roomText.includes(kw));
          
          if (hasEquipmentKeyword && hasRoomKeyword) {
            score += rule.priority * 10;
          }
        }

        // Category-based scoring
        if (category.includes('plumbing')) {
          if (roomText.match(/toilet|restroom|bathroom|bath|shower|kitchen|laundry|janitor/)) score += 50;
          if (roomText.match(/mechanical|utility/)) score += 30;
        }
        if (category.includes('hvac')) {
          if (roomText.match(/mechanical|hvac|utility|boiler/)) score += 50;
          if (roomText.match(/office|conference|lobby|dining|activity/)) score += 20;
        }
        if (category.includes('electrical')) {
          if (roomText.match(/electrical|it|server|idt|telecom|mechanical/)) score += 40;
          if (roomText.match(/office|conference|lobby/)) score += 20;
        }
        if (category.includes('fire')) {
          if (roomText.match(/corridor|hallway|lobby|stair/)) score += 40;
          if (roomText.match(/office|storage|mechanical/)) score += 20;
        }
        // Specialties (bathroom accessories, grab bars, mirrors, partitions)
        if (category.includes('specialt')) {
          if (roomText.match(/toilet|bath|pc bath|restroom/)) score += 60;
          if (roomText.match(/corridor|circulation|vest/)) score += 25;
        }
        // Doors & Windows
        if (category.includes('door') || category.includes('window')) {
          if (roomText.match(/toilet|bath/)) score += 40;
          if (roomText.match(/vest|lobby|reception/)) score += 35;
          if (roomText.match(/office|exam|program/)) score += 20;
        }
        // Woods & Plastics (casework, millwork)
        if (category.includes('wood') || category.includes('plastic')) {
          if (roomText.match(/catering|pantry|kitchen|break/)) score += 60;
          if (roomText.match(/lab|med room|nurse/)) score += 50;
          if (roomText.match(/reception|lobby/)) score += 40;
          if (roomText.match(/storage|janitor|laundry/)) score += 30;
        }
        // Roofing - mechanical rooms only
        if (category.includes('roof')) {
          if (roomText.match(/mechanical/)) score += 80;
        }
        // Concrete - mechanical, exterior
        if (category.includes('concrete')) {
          if (roomText.match(/mechanical/)) score += 50;
        }
        // Metals (handrails, structural)
        if (category.includes('metal')) {
          if (roomText.match(/corridor|circulation|stair/)) score += 40;
          if (roomText.match(/mechanical/)) score += 30;
        }
        // Sitework - low priority, prefer vestibule as entry point
        if (category.includes('site')) {
          if (roomText.match(/vest/)) score += 20;
        }

        // Direct text matching - equipment name contains room reference
        const roomWords = roomText.split(/\s+/).filter(w => w.length > 3);
        for (const word of roomWords) {
          if (itemText.includes(word)) {
            score += 25;
          }
        }

        // Room number in equipment description (e.g., "Room 101" or "101")
        const roomNumMatch = room.roomNumber ? new RegExp(`\\b${room.roomNumber}\\b`, 'i') : null;
        if (roomNumMatch && itemText.match(roomNumMatch)) {
          score += 100; // Strong match
        }

        // Area-based scoring - larger rooms need more equipment
        if (room.area && room.area > 500) score += 5;
        if (room.area && room.area > 1000) score += 5;

        if (score > bestScore) {
          bestScore = score;
          bestRoom = room;
        }
      }

      return bestRoom;
    }

    // Group rooms by type for fallback distribution
    const roomsByType: Record<string, RoomType[]> = {};
    for (const room of rooms) {
      const roomText = `${room.name} ${room.type || ''}`.toLowerCase();
      
      // Categorize rooms based on actual project room types
      let roomCategory = 'general';
      if (roomText.match(/toilet|restroom|bath|pc bath/)) roomCategory = 'wet';
      else if (roomText.match(/catering|serving|pantry|break/)) roomCategory = 'kitchen';
      else if (roomText.match(/mechanical|utility/)) roomCategory = 'mechanical';
      else if (roomText.match(/office|reception|nurse|admin/)) roomCategory = 'office';
      else if (roomText.match(/corridor|circulation|vest|lobby/)) roomCategory = 'circulation';
      else if (roomText.match(/exam|med room|obs|triage|therapy|lab/)) roomCategory = 'medical';
      else if (roomText.match(/it|idt|server|telecom/)) roomCategory = 'it';
      else if (roomText.match(/storage|clean linen|janitor/)) roomCategory = 'storage';
      else if (roomText.match(/program|multipurpose|quiet|common|activity/)) roomCategory = 'common';
      else if (roomText.match(/laundry/)) roomCategory = 'laundry';
      
      if (!roomsByType[roomCategory]) roomsByType[roomCategory] = [];
      roomsByType[roomCategory].push(room);
    }

    // Fallback room selection by MEP category - prioritized list
    const categoryFallback: Record<string, string[]> = {
      'plumbing': ['wet', 'laundry', 'kitchen', 'mechanical', 'medical', 'general'],
      'electrical': ['office', 'it', 'medical', 'circulation', 'common', 'general'],
      'hvac': ['mechanical', 'office', 'common', 'medical', 'circulation', 'general'],
      'fire_alarm': ['circulation', 'common', 'office', 'storage', 'general'],
      'fire_protection': ['circulation', 'common', 'office', 'storage', 'general'],
      'specialties': ['wet', 'circulation', 'common', 'general'],
      'metals': ['circulation', 'mechanical', 'common', 'general'],
      'doors': ['wet', 'office', 'circulation', 'common', 'general'],
      'windows': ['office', 'common', 'medical', 'general'],
      'woods': ['kitchen', 'medical', 'office', 'storage', 'general'],
      'plastics': ['kitchen', 'medical', 'office', 'storage', 'general'],
      'roofing': ['mechanical', 'general'],
      'concrete': ['mechanical', 'general'],
      'sitework': ['circulation', 'general'],
      'general': ['mechanical', 'storage', 'general'],
    };

    // Auto-assign items with intelligent matching
    const assignments: { itemId: string; roomId: string; location: string; level?: string; gridLocation?: string; confidence: string }[] = [];
    const usedRoomCounts: Record<string, number> = {};

    for (const item of mepItems) {
      let selectedRoom = findBestRoom(item, rooms);
      let confidence = 'high';

      // If no strong match, use category-based fallback with load balancing
      if (!selectedRoom) {
        const category = (item.category || '').toLowerCase();
        const fallbackTypes = categoryFallback[category] || ['general'];
        
        // Find room type with lowest usage
        let bestFallbackRoom: RoomType | null = null;
        let lowestUsage = Infinity;

        for (const roomType of fallbackTypes) {
          const typeRooms = roomsByType[roomType] || [];
          for (const room of typeRooms) {
            const usage = usedRoomCounts[room.id] || 0;
            if (usage < lowestUsage) {
              lowestUsage = usage;
              bestFallbackRoom = room;
            }
          }
          if (bestFallbackRoom) break;
        }

        selectedRoom = bestFallbackRoom || rooms[0];
        confidence = 'medium';
      }

      if (selectedRoom) {
        usedRoomCounts[selectedRoom.id] = (usedRoomCounts[selectedRoom.id] || 0) + 1;
        
        assignments.push({
          itemId: item.id,
          roomId: selectedRoom.id,
          location: selectedRoom.roomNumber ? `Room ${selectedRoom.roomNumber} - ${selectedRoom.name}` : selectedRoom.name,
          level: selectedRoom.floorNumber?.toString() || undefined,
          gridLocation: selectedRoom.gridLocation || undefined,
          confidence
        });
      }
    }

    // Apply assignments in batch
    let updated = 0;
    let failed = 0;

    for (const assignment of assignments) {
      try {
        await prisma.takeoffLineItem.update({
          where: { id: assignment.itemId },
          data: {
            location: assignment.location,
            level: assignment.level || null,
            gridLocation: assignment.gridLocation || null,
            updatedAt: new Date()
          }
        });
        updated++;
      } catch (error) {
        failed++;
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'mep_auto_assign',
        resource: 'takeoff',
        resourceId: project.id,
        details: { 
          projectSlug: slug,
          updated, 
          failed,
          roomsUsed: rooms.length
        }
      }
    });

    return NextResponse.json({
      success: true,
      updated,
      failed,
      message: `Auto-assigned ${updated} MEP items to ${rooms.length} rooms`
    });
  } catch (error: unknown) {
    logger.error('Error auto-assigning MEP locations', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to auto-assign locations', details: errMsg },
      { status: 500 }
    );
  }
}

// GET /api/projects/[slug]/mep/assign-locations
// Get MEP items with their current location assignments
export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get MEP takeoff items
    const MEP_CATEGORIES = ['Electrical', 'electrical', 'Plumbing', 'plumbing', 'HVAC', 'hvac', 'Fire Alarm', 'fire_alarm', 'Fire Protection', 'fire_protection'];
    
    const mepItems = await prisma.takeoffLineItem.findMany({
      where: {
        MaterialTakeoff: { projectId: project.id },
        category: { in: MEP_CATEGORIES }
      },
      select: {
        id: true,
        itemName: true,
        description: true,
        category: true,
        quantity: true,
        unit: true,
        location: true,
        level: true,
        gridLocation: true
      },
      orderBy: [{ category: 'asc' }, { itemName: 'asc' }]
    });

    // Get rooms for assignment options
    const rooms = await prisma.room.findMany({
      where: { projectId: project.id },
      select: {
        id: true,
        name: true,
        roomNumber: true,
        type: true,
        floorNumber: true,
        gridLocation: true
      },
      orderBy: [{ floorNumber: 'asc' }, { roomNumber: 'asc' }]
    });

    // Count items with/without locations
    const withLocation = mepItems.filter(item => item.location || item.level || item.gridLocation).length;
    const withoutLocation = mepItems.length - withLocation;

    return NextResponse.json({
      items: mepItems,
      rooms,
      stats: {
        total: mepItems.length,
        withLocation,
        withoutLocation
      }
    });
  } catch (error: unknown) {
    logger.error('Error fetching MEP location data', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to fetch MEP location data', details: errMsg },
      { status: 500 }
    );
  }
}
