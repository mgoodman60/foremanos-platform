/**
 * MEP Takeoff Generator - Extraction Functions
 */

import { prisma } from '../db';
import { createScopedLogger } from '../logger';
import type { MEPExtractionResult, MEPItem } from './types';
import { MEP_PRICING, MEP_PATTERNS } from './pricing-database';

const log = createScopedLogger('MEP_TAKEOFF');

// ============================================================================
// MAIN EXTRACTION FUNCTIONS
// ============================================================================

export async function extractMEPTakeoffs(projectSlug: string): Promise<MEPExtractionResult> {
  const result: MEPExtractionResult = {
    success: true,
    electrical: [],
    plumbing: [],
    hvac: [],
    fire_protection: [],
    totalCost: 0,
    itemsCreated: 0,
    errors: [],
  };

  try {
    // Get project
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      include: {
        Document: {
          where: { deletedAt: null },
          include: { DocumentChunk: true },
        },
      },
    });

    if (!project) {
      result.success = false;
      result.errors.push('Project not found');
      return result;
    }

    log.info('Starting MEP extraction', { projectName: project.name });

    // Categorize documents by MEP type
    const electricalDocs = project.Document.filter(d => 
      d.name.match(/\b(E[\-\s]?\d|electrical|power|lighting)\b/i) ||
      d.category === 'plans_drawings'
    );
    
    const plumbingDocs = project.Document.filter(d => 
      d.name.match(/\b(P[\-\s]?\d|plumbing|sanitary|domestic)\b/i) ||
      d.category === 'plans_drawings'
    );
    
    const hvacDocs = project.Document.filter(d => 
      d.name.match(/\b(M[\-\s]?\d|mechanical|hvac|duct)\b/i) ||
      d.category === 'plans_drawings'
    );

    // Extract from each category
    log.info('Found MEP documents', { electrical: electricalDocs.length, plumbing: plumbingDocs.length, hvac: hvacDocs.length });

    // Extract electrical items
    for (const doc of electricalDocs) {
      const items = await extractFromDocument(doc, 'electrical');
      result.electrical.push(...items);
    }

    // Extract plumbing items
    for (const doc of plumbingDocs) {
      const items = await extractFromDocument(doc, 'plumbing');
      result.plumbing.push(...items);
    }

    // Extract HVAC items
    for (const doc of hvacDocs) {
      const items = await extractFromDocument(doc, 'hvac');
      result.hvac.push(...items);
    }

    // Consolidate and deduplicate
    result.electrical = consolidateItems(result.electrical);
    result.plumbing = consolidateItems(result.plumbing);
    result.hvac = consolidateItems(result.hvac);

    // If no items found from documents, use AI-based estimation from room data
    if (result.electrical.length === 0 && result.plumbing.length === 0 && result.hvac.length === 0) {
      log.info('No items from documents, using room-based estimation');
      const estimatedItems = await estimateMEPFromRooms(project.id);
      result.electrical = estimatedItems.electrical;
      result.plumbing = estimatedItems.plumbing;
      result.hvac = estimatedItems.hvac;
    }

    // Calculate totals
    const allItems = [...result.electrical, ...result.plumbing, ...result.hvac];
    result.totalCost = allItems.reduce((sum, item) => sum + item.totalCost, 0);

    // Create takeoff records in database
    const createResult = await createMEPTakeoffRecords(project.id, result);
    result.itemsCreated = createResult.itemsCreated;
    if (createResult.error) result.errors.push(createResult.error);

    log.info('MEP extraction complete', { itemCount: allItems.length, totalCost: result.totalCost });

  } catch (error) {
    result.success = false;
    result.errors.push(`MEP extraction failed: ${error}`);
    log.error('MEP extraction error', error as Error);
  }

  return result;
}

// Price info type for type safety
type PriceInfo = { price: number; unit: string; description: string };

/**
 * Extract MEP items from a single document
 */
async function extractFromDocument(
  doc: { id: string; name: string; DocumentChunk: Array<{ content: string; pageNumber: number | null }> },
  category: 'electrical' | 'plumbing' | 'hvac'
): Promise<MEPItem[]> {
  const items: MEPItem[] = [];
  const patterns = MEP_PATTERNS[category];
  const pricing = MEP_PRICING[category] as Record<string, PriceInfo>;

  // Extract from document text content
  for (const chunk of doc.DocumentChunk) {
    const content = chunk.content || '';
    
    for (const { pattern, item } of patterns) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        const priceInfo = pricing[item];
        if (priceInfo) {
          items.push({
            itemKey: item,
            description: priceInfo.description,
            quantity: matches.length,
            unit: priceInfo.unit,
            unitCost: priceInfo.price,
            totalCost: priceInfo.price * matches.length,
            source: `${doc.name} (Page ${chunk.pageNumber || '?'})`,
            confidence: 75, // Text-based extraction
          });
        }
      }
    }
  }

  return items;
}

/**
 * Consolidate duplicate items and sum quantities
 */
function consolidateItems(items: MEPItem[]): MEPItem[] {
  const consolidated = new Map<string, MEPItem>();
  
  for (const item of items) {
    const existing = consolidated.get(item.itemKey);
    if (existing) {
      existing.quantity += item.quantity;
      existing.totalCost = existing.unitCost * existing.quantity;
      existing.source += `, ${item.source}`;
      existing.confidence = Math.max(existing.confidence, item.confidence);
    } else {
      consolidated.set(item.itemKey, { ...item });
    }
  }
  
  return Array.from(consolidated.values());
}

/**
 * Estimate MEP items based on room data when no documents available
 * Uses healthcare facility standards for Senior Care facility
 */
async function estimateMEPFromRooms(projectId: string): Promise<{
  electrical: MEPItem[];
  plumbing: MEPItem[];
  hvac: MEPItem[];
}> {
  const result = {
    electrical: [] as MEPItem[],
    plumbing: [] as MEPItem[],
    hvac: [] as MEPItem[],
  };

  // Get rooms with areas
  const rooms = await prisma.room.findMany({
    where: { projectId },
  });

  if (rooms.length === 0) {
    return result;
  }

  // Calculate total area
  const totalArea = rooms.reduce((sum, r) => sum + (r.area || 0), 0);
  const roomCount = rooms.length;

  log.info('Room-based MEP estimation', { roomCount, totalAreaSF: Math.round(totalArea) });

  // Count room types - broader detection for healthcare facilities
  const toiletCount = rooms.filter(r => 
    r.type?.toLowerCase().includes('toilet') || 
    r.type?.toLowerCase().includes('bath') ||
    r.type?.toLowerCase().includes('restroom') ||
    r.name.toLowerCase().includes('toilet') ||
    r.name.toLowerCase().includes('bath') ||
    r.name.toLowerCase().includes('restroom')
  ).length;

  const kitchenCount = rooms.filter(r => 
    r.type?.toLowerCase().includes('kitchen') ||
    r.type?.toLowerCase().includes('break') ||
    r.type?.toLowerCase().includes('catering') ||
    r.type?.toLowerCase().includes('pantry') ||
    r.name.toLowerCase().includes('kitchen') ||
    r.name.toLowerCase().includes('break') ||
    r.name.toLowerCase().includes('catering') ||
    r.name.toLowerCase().includes('pantry')
  ).length;

  const examCount = rooms.filter(r => 
    r.type?.toLowerCase().includes('exam') ||
    r.name.toLowerCase().includes('exam')
  ).length;

  const mechCount = rooms.filter(r => 
    r.type?.toLowerCase().includes('mech') ||
    r.name.toLowerCase().includes('mech')
  ).length;

  const laundryCount = rooms.filter(r => 
    r.type?.toLowerCase().includes('laundry') ||
    r.name.toLowerCase().includes('laundry')
  ).length;

  log.info('Room type counts', { toilets: toiletCount, kitchens: kitchenCount, exam: examCount, mech: mechCount, laundry: laundryCount });

  // ============================================================================
  // ELECTRICAL ESTIMATES (Healthcare-appropriate density)
  // ============================================================================
  const eP = MEP_PRICING.electrical;

  // Outlets: Healthcare needs 1 per 50 SF
  const outletCount = Math.ceil(totalArea / 50);
  result.electrical.push({
    itemKey: 'duplex_outlet',
    description: eP.duplex_outlet.description,
    quantity: outletCount,
    unit: 'EA',
    unitCost: eP.duplex_outlet.price,
    totalCost: eP.duplex_outlet.price * outletCount,
    source: 'Healthcare standard 1 per 50 SF',
    confidence: 70,
  });

  // GFCI: Wet areas - 2 per toilet, 4 per kitchen
  const gfciCount = (toiletCount * 2) + (kitchenCount * 4);
  if (gfciCount > 0) {
    result.electrical.push({
      itemKey: 'gfci_outlet',
      description: eP.gfci_outlet.description,
      quantity: gfciCount,
      unit: 'EA',
      unitCost: eP.gfci_outlet.price,
      totalCost: eP.gfci_outlet.price * gfciCount,
      source: 'Wet area GFCI requirements',
      confidence: 75,
    });
  }

  // Dedicated circuits for medical equipment - 2 per exam room
  const dedicatedCount = examCount * 2;
  if (dedicatedCount > 0) {
    result.electrical.push({
      itemKey: 'dedicated_outlet',
      description: eP.dedicated_outlet.description,
      quantity: dedicatedCount,
      unit: 'EA',
      unitCost: eP.dedicated_outlet.price,
      totalCost: eP.dedicated_outlet.price * dedicatedCount,
      source: 'Medical equipment circuits',
      confidence: 75,
    });
  }

  // Switches: 2 per room for healthcare
  const switchCount = roomCount * 2;
  result.electrical.push({
    itemKey: 'single_pole_switch',
    description: eP.single_pole_switch.description,
    quantity: switchCount,
    unit: 'EA',
    unitCost: eP.single_pole_switch.price,
    totalCost: eP.single_pole_switch.price * switchCount,
    source: 'Healthcare standard 2 per room',
    confidence: 70,
  });

  // Lighting: Healthcare needs 1 per 50 SF
  const lightCount = Math.ceil(totalArea / 50);
  result.electrical.push({
    itemKey: '2x4_troffer',
    description: eP['2x4_troffer'].description,
    quantity: lightCount,
    unit: 'EA',
    unitCost: eP['2x4_troffer'].price,
    totalCost: eP['2x4_troffer'].price * lightCount,
    source: 'Healthcare lighting 1 per 50 SF',
    confidence: 70,
  });

  // Downlights: 15% of total lights
  const downlightCount = Math.ceil(lightCount * 0.15);
  result.electrical.push({
    itemKey: 'recessed_downlight',
    description: eP.recessed_downlight.description,
    quantity: downlightCount,
    unit: 'EA',
    unitCost: eP.recessed_downlight.price,
    totalCost: eP.recessed_downlight.price * downlightCount,
    source: 'Corridor/accent lighting',
    confidence: 65,
  });

  // Exit signs with emergency
  const exitCount = Math.ceil(roomCount * 0.3);
  result.electrical.push({
    itemKey: 'exit_sign',
    description: eP.exit_sign.description,
    quantity: exitCount,
    unit: 'EA',
    unitCost: eP.exit_sign.price,
    totalCost: eP.exit_sign.price * exitCount,
    source: 'Egress requirements',
    confidence: 70,
  });

  // Emergency lights - paired with exits
  result.electrical.push({
    itemKey: 'emergency_light',
    description: eP.emergency_light.description,
    quantity: exitCount,
    unit: 'EA',
    unitCost: eP.emergency_light.price,
    totalCost: eP.emergency_light.price * exitCount,
    source: 'Emergency egress lighting',
    confidence: 70,
  });

  // Exterior wall packs
  result.electrical.push({
    itemKey: 'exterior_light',
    description: eP.exterior_light.description,
    quantity: 8,
    unit: 'EA',
    unitCost: eP.exterior_light.price,
    totalCost: eP.exterior_light.price * 8,
    source: 'Building perimeter lighting',
    confidence: 65,
  });

  // Parking lot pole lights
  result.electrical.push({
    itemKey: 'pole_light',
    description: eP.pole_light.description,
    quantity: 6,
    unit: 'EA',
    unitCost: eP.pole_light.price,
    totalCost: eP.pole_light.price * 6,
    source: 'Parking lot lighting',
    confidence: 65,
  });

  // Main panel (400A) + subpanels (2x 200A)
  result.electrical.push({
    itemKey: 'panel_400a',
    description: eP.panel_400a.description,
    quantity: 1,
    unit: 'EA',
    unitCost: eP.panel_400a.price,
    totalCost: eP.panel_400a.price,
    source: 'Main electrical panel',
    confidence: 80,
  });
  result.electrical.push({
    itemKey: 'panel_200a',
    description: eP.panel_200a.description,
    quantity: 2,
    unit: 'EA',
    unitCost: eP.panel_200a.price,
    totalCost: eP.panel_200a.price * 2,
    source: 'Sub panels',
    confidence: 75,
  });

  // Data outlets: 1 per 100 SF
  const dataCount = Math.ceil(totalArea / 100);
  result.electrical.push({
    itemKey: 'data_outlet',
    description: eP.data_outlet.description,
    quantity: dataCount,
    unit: 'EA',
    unitCost: eP.data_outlet.price,
    totalCost: eP.data_outlet.price * dataCount,
    source: 'Data/network infrastructure',
    confidence: 70,
  });

  // Fire alarm - smoke detectors (1 per room)
  result.electrical.push({
    itemKey: 'smoke_detector',
    description: eP.smoke_detector.description,
    quantity: roomCount,
    unit: 'EA',
    unitCost: eP.smoke_detector.price,
    totalCost: eP.smoke_detector.price * roomCount,
    source: 'Fire alarm code requirement',
    confidence: 80,
  });

  // Horn/strobes: 1 per 3 rooms
  const hsCount = Math.ceil(roomCount / 3);
  result.electrical.push({
    itemKey: 'horn_strobe',
    description: eP.horn_strobe.description,
    quantity: hsCount,
    unit: 'EA',
    unitCost: eP.horn_strobe.price,
    totalCost: eP.horn_strobe.price * hsCount,
    source: 'Fire alarm notification',
    confidence: 75,
  });

  // Fire alarm panel
  result.electrical.push({
    itemKey: 'fire_alarm_panel',
    description: eP.fire_alarm_panel.description,
    quantity: 1,
    unit: 'EA',
    unitCost: eP.fire_alarm_panel.price,
    totalCost: eP.fire_alarm_panel.price,
    source: 'Fire alarm control panel',
    confidence: 85,
  });

  // ============================================================================
  // PLUMBING ESTIMATES (Healthcare facility)
  // ============================================================================
  const pP = MEP_PRICING.plumbing;

  // Water closets: 1 per toilet/bath room
  if (toiletCount > 0) {
    result.plumbing.push({
      itemKey: 'water_closet',
      description: pP.water_closet.description,
      quantity: toiletCount,
      unit: 'EA',
      unitCost: pP.water_closet.price,
      totalCost: pP.water_closet.price * toiletCount,
      source: 'Toilet/bath room fixtures',
      confidence: 75,
    });
  }

  // Lavatories: 1 per toilet/bath room
  if (toiletCount > 0) {
    result.plumbing.push({
      itemKey: 'lavatory',
      description: pP.lavatory.description,
      quantity: toiletCount,
      unit: 'EA',
      unitCost: pP.lavatory.price,
      totalCost: pP.lavatory.price * toiletCount,
      source: 'Toilet/bath room fixtures',
      confidence: 75,
    });
  }

  // Kitchen sinks
  if (kitchenCount > 0) {
    result.plumbing.push({
      itemKey: 'kitchen_sink',
      description: pP.kitchen_sink.description,
      quantity: kitchenCount,
      unit: 'EA',
      unitCost: pP.kitchen_sink.price,
      totalCost: pP.kitchen_sink.price * kitchenCount,
      source: 'Kitchen/catering areas',
      confidence: 80,
    });
  }

  // Mop sinks: 2 per building
  result.plumbing.push({
    itemKey: 'mop_sink',
    description: pP.mop_sink.description,
    quantity: 2,
    unit: 'EA',
    unitCost: pP.mop_sink.price,
    totalCost: pP.mop_sink.price * 2,
    source: 'Janitorial requirements',
    confidence: 75,
  });

  // Bottle fillers/drinking fountains
  result.plumbing.push({
    itemKey: 'bottle_filler',
    description: pP.bottle_filler.description,
    quantity: 2,
    unit: 'EA',
    unitCost: pP.bottle_filler.price,
    totalCost: pP.bottle_filler.price * 2,
    source: 'ADA/code requirements',
    confidence: 80,
  });

  // Floor drains: All wet areas
  const floorDrainCount = toiletCount + kitchenCount + laundryCount + mechCount;
  if (floorDrainCount > 0) {
    result.plumbing.push({
      itemKey: 'floor_drain',
      description: pP.floor_drain.description,
      quantity: floorDrainCount,
      unit: 'EA',
      unitCost: pP.floor_drain.price,
      totalCost: pP.floor_drain.price * floorDrainCount,
      source: 'Wet area floor drains',
      confidence: 70,
    });
  }

  // Cleanouts
  result.plumbing.push({
    itemKey: 'cleanout',
    description: pP.cleanout.description,
    quantity: 4,
    unit: 'EA',
    unitCost: pP.cleanout.price,
    totalCost: pP.cleanout.price * 4,
    source: 'Code required cleanouts',
    confidence: 70,
  });

  // Water heaters: 2x 80 gal for healthcare
  result.plumbing.push({
    itemKey: 'water_heater_80',
    description: pP.water_heater_80.description,
    quantity: 2,
    unit: 'EA',
    unitCost: pP.water_heater_80.price,
    totalCost: pP.water_heater_80.price * 2,
    source: 'Hot water for healthcare',
    confidence: 80,
  });

  // Backflow preventer
  result.plumbing.push({
    itemKey: 'backflow_preventer',
    description: pP.backflow_preventer.description,
    quantity: 1,
    unit: 'EA',
    unitCost: pP.backflow_preventer.price,
    totalCost: pP.backflow_preventer.price,
    source: 'Code requirement',
    confidence: 85,
  });

  // PIPING (0.5 LF per SF of building)
  const pipingLF = Math.ceil(totalArea * 0.5);
  
  // Domestic water piping (40% of total)
  const domesticWaterLF = Math.ceil(pipingLF * 0.4);
  result.plumbing.push({
    itemKey: 'domestic_water',
    description: pP.domestic_water.description,
    quantity: domesticWaterLF,
    unit: 'LF',
    unitCost: pP.domestic_water.price,
    totalCost: pP.domestic_water.price * domesticWaterLF,
    source: 'Domestic water distribution',
    confidence: 65,
  });

  // Waste piping (35% of total)
  const wastePipeLF = Math.ceil(pipingLF * 0.35);
  result.plumbing.push({
    itemKey: 'waste_pipe',
    description: pP.waste_pipe.description,
    quantity: wastePipeLF,
    unit: 'LF',
    unitCost: pP.waste_pipe.price,
    totalCost: pP.waste_pipe.price * wastePipeLF,
    source: 'Sanitary waste system',
    confidence: 65,
  });

  // Vent piping (25% of total)
  const ventPipeLF = Math.ceil(pipingLF * 0.25);
  result.plumbing.push({
    itemKey: 'vent_pipe',
    description: pP.vent_pipe.description,
    quantity: ventPipeLF,
    unit: 'LF',
    unitCost: pP.vent_pipe.price,
    totalCost: pP.vent_pipe.price * ventPipeLF,
    source: 'Vent system',
    confidence: 65,
  });

  // ============================================================================
  // HVAC ESTIMATES (Healthcare facility with ductwork)
  // ============================================================================
  const hP = MEP_PRICING.hvac;

  // RTU sizing: Healthcare needs ~450 SF per ton
  const tonnage = Math.ceil(totalArea / 450);
  const rtuCount = Math.max(1, Math.ceil(tonnage / 15)); // Use 15-ton units
  
  result.hvac.push({
    itemKey: 'rtu_15ton',
    description: hP.rtu_15ton.description,
    quantity: rtuCount,
    unit: 'EA',
    unitCost: hP.rtu_15ton.price,
    totalCost: hP.rtu_15ton.price * rtuCount,
    source: `${tonnage} tons cooling (${rtuCount}x 15-ton units)`,
    confidence: 70,
  });

  // Exhaust fans: All wet areas need exhaust
  const efCount = toiletCount + kitchenCount + laundryCount + mechCount;
  if (efCount > 0) {
    result.hvac.push({
      itemKey: 'exhaust_fan',
      description: hP.exhaust_fan.description,
      quantity: efCount,
      unit: 'EA',
      unitCost: hP.exhaust_fan.price,
      totalCost: hP.exhaust_fan.price * efCount,
      source: 'Exhaust for wet/service areas',
      confidence: 75,
    });
  }

  // Supply diffusers: Healthcare needs 1 per 100 SF
  const diffuserCount = Math.ceil(totalArea / 100);
  result.hvac.push({
    itemKey: 'supply_diffuser',
    description: hP.supply_diffuser.description,
    quantity: diffuserCount,
    unit: 'EA',
    unitCost: hP.supply_diffuser.price,
    totalCost: hP.supply_diffuser.price * diffuserCount,
    source: 'Healthcare air distribution 1 per 100 SF',
    confidence: 65,
  });

  // Return grilles: 1 per 200 SF
  const returnCount = Math.ceil(totalArea / 200);
  result.hvac.push({
    itemKey: 'return_grille',
    description: hP.return_grille.description,
    quantity: returnCount,
    unit: 'EA',
    unitCost: hP.return_grille.price,
    totalCost: hP.return_grille.price * returnCount,
    source: 'Return air distribution',
    confidence: 65,
  });

  // VAV boxes for zone control
  const vavCount = Math.ceil(totalArea / 1500);
  result.hvac.push({
    itemKey: 'vav_box',
    description: hP.vav_box.description,
    quantity: vavCount,
    unit: 'EA',
    unitCost: hP.vav_box.price,
    totalCost: hP.vav_box.price * vavCount,
    source: 'Zone control boxes',
    confidence: 65,
  });

  // Thermostats: 1 per zone
  result.hvac.push({
    itemKey: 'thermostat',
    description: hP.thermostat.description,
    quantity: vavCount,
    unit: 'EA',
    unitCost: hP.thermostat.price,
    totalCost: hP.thermostat.price * vavCount,
    source: 'Zone thermostats',
    confidence: 70,
  });

  // DUCTWORK (1.5 LF per SF for healthcare)
  const ductLF = Math.ceil(totalArea * 1.5);

  // Rectangular duct (30%)
  const rectDuctLF = Math.ceil(ductLF * 0.3);
  result.hvac.push({
    itemKey: 'rect_duct_small',
    description: hP.rect_duct_small.description,
    quantity: rectDuctLF,
    unit: 'LF',
    unitCost: 45, // Avg for mixed sizes
    totalCost: 45 * rectDuctLF,
    source: 'Main trunk ductwork',
    confidence: 60,
  });

  // Round/spiral duct (40%)
  const roundDuctLF = Math.ceil(ductLF * 0.4);
  result.hvac.push({
    itemKey: 'round_duct',
    description: hP.round_duct.description,
    quantity: roundDuctLF,
    unit: 'LF',
    unitCost: hP.round_duct.price,
    totalCost: hP.round_duct.price * roundDuctLF,
    source: 'Branch ductwork',
    confidence: 60,
  });

  // Flex duct (30%)
  const flexDuctLF = Math.ceil(ductLF * 0.3);
  result.hvac.push({
    itemKey: 'flex_duct',
    description: hP.flex_duct.description,
    quantity: flexDuctLF,
    unit: 'LF',
    unitCost: hP.flex_duct.price,
    totalCost: hP.flex_duct.price * flexDuctLF,
    source: 'Diffuser connections',
    confidence: 60,
  });

  // Fire/smoke dampers
  const damperCount = Math.ceil(roomCount / 5);
  result.hvac.push({
    itemKey: 'damper',
    description: hP.damper.description,
    quantity: damperCount,
    unit: 'EA',
    unitCost: hP.damper.price,
    totalCost: hP.damper.price * damperCount,
    source: 'Fire/smoke dampers',
    confidence: 70,
  });

  return result;
}

/**
 * Create takeoff records in database
 */
async function createMEPTakeoffRecords(
  projectId: string,
  extraction: MEPExtractionResult
): Promise<{ itemsCreated: number; error?: string }> {
  try {
    // Get or create system user for auto-extraction
    let systemUser = await prisma.user.findFirst({
      where: { email: 'system@foremanos.ai' },
    });

    if (!systemUser) {
      systemUser = await prisma.user.findFirst({
        where: { role: 'admin' },
      });
    }

    if (!systemUser) {
      return { itemsCreated: 0, error: 'No user found to create takeoffs' };
    }

    // Get or create MEP takeoff record
    let takeoff = await prisma.materialTakeoff.findFirst({
      where: {
        projectId,
        name: 'MEP Auto-Extracted Takeoff',
      },
    });

    if (!takeoff) {
      takeoff = await prisma.materialTakeoff.create({
        data: {
          projectId,
          name: 'MEP Auto-Extracted Takeoff',
          description: 'Automatically extracted MEP items from project documents',
          status: 'draft',
          createdBy: systemUser.id,
        },
      });
    }

    // Clear existing MEP items for fresh extraction
    await prisma.takeoffLineItem.deleteMany({
      where: {
        takeoffId: takeoff.id,
        category: { in: ['Electrical', 'Plumbing', 'HVAC'] },
      },
    });

    let itemsCreated = 0;

    // Create electrical items
    for (const item of extraction.electrical) {
      await prisma.takeoffLineItem.create({
        data: {
          takeoffId: takeoff.id,
          category: 'Electrical',
          itemName: item.description,
          description: `${item.itemKey} - ${item.source}`,
          quantity: item.quantity,
          unit: item.unit,
          unitCost: item.unitCost,
          totalCost: item.totalCost,
          confidence: item.confidence,
          extractedFrom: item.source,
          sourceType: 'auto',
          calculationMethod: 'MEP extraction',
        },
      });
      itemsCreated++;
    }

    // Create plumbing items
    for (const item of extraction.plumbing) {
      await prisma.takeoffLineItem.create({
        data: {
          takeoffId: takeoff.id,
          category: 'Plumbing',
          itemName: item.description,
          description: `${item.itemKey} - ${item.source}`,
          quantity: item.quantity,
          unit: item.unit,
          unitCost: item.unitCost,
          totalCost: item.totalCost,
          confidence: item.confidence,
          extractedFrom: item.source,
          sourceType: 'auto',
          calculationMethod: 'MEP extraction',
        },
      });
      itemsCreated++;
    }

    // Create HVAC items
    for (const item of extraction.hvac) {
      await prisma.takeoffLineItem.create({
        data: {
          takeoffId: takeoff.id,
          category: 'HVAC',
          itemName: item.description,
          description: `${item.itemKey} - ${item.source}`,
          quantity: item.quantity,
          unit: item.unit,
          unitCost: item.unitCost,
          totalCost: item.totalCost,
          confidence: item.confidence,
          extractedFrom: item.source,
          sourceType: 'auto',
          calculationMethod: 'MEP extraction',
        },
      });
      itemsCreated++;
    }

    // Update takeoff total
    await prisma.materialTakeoff.update({
      where: { id: takeoff.id },
      data: { totalCost: extraction.totalCost },
    });

    log.info('Created takeoff line items', { itemsCreated });
    return { itemsCreated };

  } catch (error) {
    log.error('Database error creating takeoff records', error as Error);
    return { itemsCreated: 0, error: `${error}` };
  }
}
