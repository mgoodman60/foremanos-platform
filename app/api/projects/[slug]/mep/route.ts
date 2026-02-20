/**
 * MEP Dashboard Stats API
 * GET: Fetch MEP dashboard overview stats and equipment for browser
 * Fetches from both MEPEquipment table AND TakeoffLineItem for MEP categories
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getMEPDashboardStats } from '@/lib/mep-tracking-service';

// MEP categories for takeoff items (match both cases as stored in DB)
const MEP_CATEGORIES = [
  'Electrical', 'electrical',
  'Plumbing', 'plumbing', 
  'HVAC', 'hvac', 'Mechanical', 'mechanical',
  'Fire Alarm', 'fire_alarm', 'Fire Protection', 'fire_protection'
];

// Map equipment types to trade categories
function getTradeFromType(equipmentType: string): 'hvac' | 'electrical' | 'plumbing' | 'fire_alarm' {
  const typeUpper = equipmentType?.toUpperCase() || '';
  
  // HVAC types
  if (['AHU', 'RTU', 'VAV', 'FCU', 'CHILLER', 'BOILER', 'PUMP_HVAC', 'EXHAUST_FAN', 'VRF', 'HEAT_PUMP'].includes(typeUpper) ||
      typeUpper.includes('HVAC') || typeUpper.includes('HEATING') || typeUpper.includes('COOLING') || typeUpper.includes('AIR') ||
      typeUpper.includes('MECHANICAL') || typeUpper.includes('DUCTWORK') || typeUpper.includes('DIFFUSER')) {
    return 'hvac';
  }
  
  // Electrical types
  if (['TRANSFORMER', 'SWITCHGEAR', 'PANEL', 'MCC', 'VFD', 'GENERATOR', 'UPS', 'ATS', 'LIGHTING'].includes(typeUpper) ||
      typeUpper.includes('ELECTRIC') || typeUpper.includes('POWER') || typeUpper.includes('OUTLET') ||
      typeUpper.includes('SWITCH') || typeUpper.includes('RECEPTACLE') || typeUpper.includes('TROFFER') ||
      typeUpper.includes('LIGHT') || typeUpper.includes('DATA')) {
    return 'electrical';
  }
  
  // Fire protection types
  if (['FIRE_ALARM_PANEL', 'FIRE_PUMP', 'SPRINKLER', 'SMOKE_DETECTOR', 'FIRE_EXTINGUISHER'].includes(typeUpper) ||
      typeUpper.includes('FIRE') || typeUpper.includes('SMOKE') || typeUpper.includes('ALARM') ||
      typeUpper.includes('STROBE') || typeUpper.includes('PULL_STATION')) {
    return 'fire_alarm';
  }
  
  // Default to plumbing
  return 'plumbing';
}

// Map category string to trade
function getTradeFromCategory(category: string): 'hvac' | 'electrical' | 'plumbing' | 'fire_alarm' {
  const catLower = category?.toLowerCase() || '';
  if (catLower === 'electrical') return 'electrical';
  if (catLower === 'hvac' || catLower === 'mechanical') return 'hvac';
  if (catLower.includes('fire') || catLower === 'fire_alarm' || catLower === 'fire_protection') return 'fire_alarm';
  if (catLower === 'plumbing') return 'plumbing';
  return 'plumbing'; // default
}

// Map DB status to browser expected status
function mapStatus(dbStatus: string): 'installed' | 'pending' | 'ordered' {
  const statusMap: Record<string, 'installed' | 'pending' | 'ordered'> = {
    'SPECIFIED': 'pending',
    'SUBMITTED': 'pending',
    'APPROVED': 'ordered',
    'ORDERED': 'ordered',
    'DELIVERED': 'ordered',
    'INSTALLED': 'installed',
    'COMMISSIONED': 'installed'
  };
  return statusMap[dbStatus?.toUpperCase()] || 'pending';
}

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const tradeFilter = searchParams.get('trade');

    // Fetch equipment from MEPEquipment table
    const dbEquipment = await prisma.mEPEquipment.findMany({
      where: { projectId: project.id },
      include: {
        system: {
          select: { systemNumber: true, name: true, systemType: true }
        }
      },
      orderBy: { equipmentTag: 'asc' }
    });

    // Transform MEPEquipment to browser-expected format
    const equipmentFromMEP = dbEquipment.map((eq) => {
      const trade = getTradeFromType(eq.equipmentType);
      return {
        id: eq.id,
        tag: eq.equipmentTag || '',
        name: eq.name,
        type: eq.equipmentType,
        trade,
        specifications: eq.specifications || {},
        location: eq.room || eq.level || eq.gridLocation || '',
        status: mapStatus(eq.status),
        sheetReference: eq.system?.systemNumber || '',
        notes: eq.notes ? [eq.notes] : [],
        source: 'mep_equipment' as const
      };
    });

    // Also fetch from TakeoffLineItem for MEP categories
    const mepTakeoffs = await prisma.materialTakeoff.findMany({
      where: { projectId: project.id },
      include: {
        TakeoffLineItem: {
          where: {
            category: { in: MEP_CATEGORIES }
          }
        }
      }
    });
    
    console.log('[MEP API] Project:', project.id);
    console.log('[MEP API] MEP Equipment from table:', dbEquipment.length);
    console.log('[MEP API] Takeoffs found:', mepTakeoffs.length);
    const takeoffItemCount = mepTakeoffs.reduce((sum, t) => sum + t.TakeoffLineItem.length, 0);
    console.log('[MEP API] Takeoff MEP items:', takeoffItemCount);

    // Transform TakeoffLineItems to browser-expected format
    // Group items by name to aggregate quantities and create room breakdowns
    const itemGroups = new Map<string, {
      items: typeof mepTakeoffs[0]['TakeoffLineItem'],
      trade: 'hvac' | 'electrical' | 'plumbing' | 'fire_alarm',
      displayName: string,
      category: string
    }>();
    
    mepTakeoffs.forEach((takeoff) => {
      takeoff.TakeoffLineItem.forEach((item) => {
        const trade = getTradeFromCategory(item.category);
        const displayName = item.itemName || item.category;
        const key = `${trade}-${displayName.toLowerCase()}`;
        
        if (!itemGroups.has(key)) {
          itemGroups.set(key, {
            items: [],
            trade,
            displayName,
            category: item.category
          });
        }
        itemGroups.get(key)!.items.push(item);
      });
    });
    
    // Track unique items per trade for tag generation
    const tagCounters: Record<string, number> = { E: 0, H: 0, P: 0, FA: 0 };
    
    const equipmentFromTakeoff = Array.from(itemGroups.entries()).map(([, group]) => {
      const { items, trade, displayName, category } = group;
      const prefix = trade === 'electrical' ? 'E' : trade === 'hvac' ? 'H' : trade === 'plumbing' ? 'P' : 'FA';
      tagCounters[prefix]++;
      
      // Aggregate quantities and costs
      const totalQuantity = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
      const totalCost = items.reduce((sum, i) => sum + (i.totalCost || 0), 0);
      const avgUnitCost = items[0]?.unitCost || (totalQuantity > 0 ? totalCost / totalQuantity : 0);
      const avgConfidence = items.reduce((sum, i) => sum + (i.confidence || 0), 0) / items.length;
      const unit = items[0]?.unit || 'EA';
      
      // Create room breakdown
      const roomBreakdown: { room: string; quantity: number; level?: string }[] = [];
      const roomMap = new Map<string, { quantity: number; level?: string }>();
      
      items.forEach((item) => {
        const roomKey = item.location || item.gridLocation || 'General';
        if (!roomMap.has(roomKey)) {
          roomMap.set(roomKey, { quantity: 0, level: item.level || undefined });
        }
        roomMap.get(roomKey)!.quantity += item.quantity || 0;
      });
      
      roomMap.forEach((data, room) => {
        roomBreakdown.push({ room, quantity: data.quantity, level: data.level });
      });
      
      // Sort by quantity descending
      roomBreakdown.sort((a, b) => b.quantity - a.quantity);
      
      // Format sheet reference from all sources
      const allSources = items.flatMap(i => i.extractedFrom?.split(',').map(s => s.trim()) || []).filter(Boolean);
      let sheetRef = items[0]?.sheetNumber || '';
      if (!sheetRef && allSources.length > 0) {
        const uniqueSources = [...new Set(allSources)];
        if (uniqueSources.length > 3) {
          sheetRef = `${uniqueSources.length} sources`;
        } else {
          const pageNums = uniqueSources.map((s: string) => {
            const match = s.match(/page (\d+)/i);
            return match ? match[1] : null;
          }).filter(Boolean);
          if (pageNums.length > 0) {
            sheetRef = `Pages ${[...new Set(pageNums)].join(', ')}`;
          } else {
            sheetRef = uniqueSources[0] || '';
          }
        }
      }
      
      // Collect all notes
      const allNotes = items
        .filter(i => i.notes)
        .map(i => i.notes!)
        .filter((note, idx, arr) => arr.indexOf(note) === idx);
      
      return {
        id: items[0].id,
        tag: `${prefix}-${String(tagCounters[prefix]).padStart(3, '0')}`,
        name: displayName,
        type: category,
        trade,
        specifications: {
          quantity: totalQuantity,
          unit,
          unitCost: avgUnitCost,
          totalCost,
          material: items[0]?.material || undefined,
          confidence: avgConfidence
        },
        location: roomBreakdown.length > 0 ? roomBreakdown[0].room : '',
        status: items.some(i => i.verified) ? 'ordered' : 'pending' as 'installed' | 'pending' | 'ordered',
        sheetReference: sheetRef,
        notes: allNotes,
        roomBreakdown: roomBreakdown.length > 1 ? roomBreakdown : undefined,
        source: 'takeoff' as const
      };
    });

    // Combine both sources, removing duplicates by name
    const seenNames = new Set<string>();
    const allEquipment = [...equipmentFromMEP, ...equipmentFromTakeoff].filter((eq) => {
      const key = `${eq.trade}-${eq.name.toLowerCase()}`;
      if (seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    });

    // Apply trade filter
    const equipment = allEquipment.filter((eq) => !tradeFilter || eq.trade === tradeFilter);
    
    console.log('[MEP API] Total equipment after dedup:', allEquipment.length);
    console.log('[MEP API] Equipment after trade filter:', equipment.length);
    if (equipment.length > 0) {
      console.log('[MEP API] First item:', JSON.stringify(equipment[0], null, 2));
    }

    // Calculate stats for equipment browser
    const browserStats = {
      total: equipment.length,
      installed: equipment.filter(e => e.status === 'installed').length,
      pending: equipment.filter(e => e.status === 'pending').length,
      conflicts: 0 // Would need clash detection data
    };

    // Get full dashboard stats - this provides data for MEPDashboard component
    const dashboardStats = await getMEPDashboardStats(project.id);
    
    // If there's no data in MEP tables, use takeoff data counts for basic stats
    const uniqueTrades = new Set(equipment.map(e => e.trade));
    const totalSystems = dashboardStats.totalSystems || uniqueTrades.size || 0;
    const totalEquipment = dashboardStats.totalEquipment || equipment.length || 0;
    
    return NextResponse.json({
      // Data for MEP Equipment Browser
      equipment,
      conflicts: [],
      stats: browserStats,
      
      // Data for MEPDashboard - spread the dashboard stats at root level
      totalSystems,
      totalEquipment,
      totalSubmittals: dashboardStats.totalSubmittals || 0,
      pendingSubmittals: dashboardStats.pendingSubmittals || 0,
      totalMaintenanceSchedules: dashboardStats.totalMaintenanceSchedules || 0,
      upcomingMaintenance: dashboardStats.upcomingMaintenance || 0,
      overdueMaintenance: dashboardStats.overdueMaintenance || 0,
      totalCalculations: dashboardStats.totalCalculations || 0,
      equipmentByStatus: dashboardStats.equipmentByStatus || {},
      systemsByType: dashboardStats.systemsByType || {},
      
      // Also keep dashboardStats for backward compatibility
      dashboardStats
    });
  } catch (error) {
    console.error('[MEP Dashboard API Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch MEP stats' },
      { status: 500 }
    );
  }
}
