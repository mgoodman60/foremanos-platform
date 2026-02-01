/**
 * MEP Tracking Service
 * Manages equipment, systems, submittals, maintenance schedules, and load calculations
 * Includes BIM auto-population when model data is available
 */

import { prisma } from './db';
import { categorizeElement, BIMExtractionResult, ElementProperty } from './bim-metadata-extractor';

// Types
export type MEPSystemType = 'HVAC' | 'ELECTRICAL' | 'PLUMBING' | 'FIRE_PROTECTION' | 'CONTROLS' | 'LOW_VOLTAGE' | 'SPECIALTY';
export type MEPEquipmentType = 
  // HVAC
  'AHU' | 'RTU' | 'CHILLER' | 'BOILER' | 'PUMP_HVAC' | 'FAN' | 'VAV_BOX' | 'FCU' | 'EXHAUST_FAN' | 'DAMPER' |
  // Electrical
  'TRANSFORMER' | 'SWITCHGEAR' | 'MDP' | 'PANEL' | 'DISCONNECT' | 'VFD' | 'GENERATOR' | 'UPS' | 'LIGHTING_FIXTURE' |
  // Plumbing
  'WATER_HEATER' | 'PUMP_PLUMBING' | 'FIXTURE' | 'BACKFLOW' | 'PRV' |
  // Fire Protection
  'FIRE_PUMP' | 'SPRINKLER_HEAD' | 'FIRE_ALARM_PANEL' | 'SMOKE_DETECTOR' |
  // Other
  'CONTROLS' | 'SENSOR' | 'METER' | 'OTHER';

// Equipment type to system type mapping
const EQUIPMENT_TO_SYSTEM: Record<string, MEPSystemType> = {
  'AHU': 'HVAC', 'RTU': 'HVAC', 'CHILLER': 'HVAC', 'BOILER': 'HVAC',
  'PUMP_HVAC': 'HVAC', 'FAN': 'HVAC', 'VAV_BOX': 'HVAC', 'FCU': 'HVAC',
  'EXHAUST_FAN': 'HVAC', 'DAMPER': 'HVAC',
  'TRANSFORMER': 'ELECTRICAL', 'SWITCHGEAR': 'ELECTRICAL', 'MDP': 'ELECTRICAL',
  'PANEL': 'ELECTRICAL', 'DISCONNECT': 'ELECTRICAL', 'VFD': 'ELECTRICAL',
  'GENERATOR': 'ELECTRICAL', 'UPS': 'ELECTRICAL', 'LIGHTING_FIXTURE': 'ELECTRICAL',
  'WATER_HEATER': 'PLUMBING', 'PUMP_PLUMBING': 'PLUMBING', 'FIXTURE': 'PLUMBING',
  'BACKFLOW': 'PLUMBING', 'PRV': 'PLUMBING',
  'FIRE_PUMP': 'FIRE_PROTECTION', 'SPRINKLER_HEAD': 'FIRE_PROTECTION',
  'FIRE_ALARM_PANEL': 'FIRE_PROTECTION', 'SMOKE_DETECTOR': 'FIRE_PROTECTION',
  'CONTROLS': 'CONTROLS', 'SENSOR': 'CONTROLS', 'METER': 'CONTROLS',
};

// BIM category to equipment type mapping
const BIM_TO_EQUIPMENT_TYPE: Record<string, MEPEquipmentType> = {
  // HVAC
  'mechanical_equipment': 'AHU',
  'air_terminals': 'VAV_BOX',
  'ductwork': 'OTHER',
  'duct_fittings': 'OTHER',
  // Electrical
  'electrical_equipment': 'PANEL',
  'electrical_fixtures': 'LIGHTING_FIXTURE',
  'lighting': 'LIGHTING_FIXTURE',
  'cable_trays': 'OTHER',
  'conduits': 'OTHER',
  // Plumbing
  'plumbing_fixtures': 'FIXTURE',
  'piping': 'OTHER',
  'pipe_fittings': 'OTHER',
  // Fire Protection
  'fire_protection': 'SPRINKLER_HEAD',
};

/**
 * Generate next system number for a project
 */
export async function getNextSystemNumber(projectId: string, systemType: MEPSystemType): Promise<string> {
  const prefix = {
    'HVAC': 'HVAC',
    'ELECTRICAL': 'ELEC',
    'PLUMBING': 'PLMB',
    'FIRE_PROTECTION': 'FP',
    'CONTROLS': 'CTRL',
    'LOW_VOLTAGE': 'LV',
    'SPECIALTY': 'SPEC',
  }[systemType];
  
  const count = await prisma.mEPSystem.count({
    where: { projectId, systemType }
  });
  
  return `${prefix}-${String(count + 1).padStart(3, '0')}`;
}

/**
 * Generate next equipment tag for a project
 */
export async function getNextEquipmentTag(projectId: string, equipmentType: MEPEquipmentType): Promise<string> {
  const prefixes: Record<MEPEquipmentType, string> = {
    'AHU': 'AHU', 'RTU': 'RTU', 'CHILLER': 'CH', 'BOILER': 'BLR',
    'PUMP_HVAC': 'P', 'FAN': 'EF', 'VAV_BOX': 'VAV', 'FCU': 'FCU',
    'EXHAUST_FAN': 'EF', 'DAMPER': 'DMP',
    'TRANSFORMER': 'TX', 'SWITCHGEAR': 'SWG', 'MDP': 'MDP',
    'PANEL': 'PP', 'DISCONNECT': 'DISC', 'VFD': 'VFD',
    'GENERATOR': 'GEN', 'UPS': 'UPS', 'LIGHTING_FIXTURE': 'LT',
    'WATER_HEATER': 'WH', 'PUMP_PLUMBING': 'P', 'FIXTURE': 'PF',
    'BACKFLOW': 'BFP', 'PRV': 'PRV',
    'FIRE_PUMP': 'FP', 'SPRINKLER_HEAD': 'SP',
    'FIRE_ALARM_PANEL': 'FACP', 'SMOKE_DETECTOR': 'SD',
    'CONTROLS': 'CTRL', 'SENSOR': 'SNS', 'METER': 'MTR', 'OTHER': 'EQ',
  };
  
  const prefix = prefixes[equipmentType] || 'EQ';
  
  const count = await prisma.mEPEquipment.count({
    where: { projectId, equipmentType }
  });
  
  return `${prefix}-${String(count + 1).padStart(3, '0')}`;
}

/**
 * Generate next submittal number
 */
export async function getNextSubmittalNumber(projectId: string): Promise<string> {
  const count = await prisma.mEPSubmittal.count({
    where: { projectId }
  });
  
  return `SUB-MEP-${String(count + 1).padStart(3, '0')}`;
}

/**
 * Generate next maintenance schedule number
 */
export async function getNextMaintenanceNumber(projectId: string): Promise<string> {
  const count = await prisma.mEPMaintenanceSchedule.count({
    where: { projectId }
  });
  
  return `PM-${String(count + 1).padStart(3, '0')}`;
}

/**
 * Generate next load calculation number
 */
export async function getNextCalcNumber(projectId: string, calcType: string): Promise<string> {
  const prefix = calcType.startsWith('ELECTRICAL') ? 'E' : 
                 calcType.startsWith('HVAC') ? 'M' : 
                 calcType.startsWith('PLUMBING') ? 'P' : 'L';
  
  const count = await prisma.mEPLoadCalculation.count({
    where: { projectId }
  });
  
  return `CALC-${prefix}-${String(count + 1).padStart(3, '0')}`;
}

/**
 * Infer equipment type from BIM element properties
 */
function inferEquipmentType(element: ElementProperty): MEPEquipmentType {
  const name = element.name.toLowerCase();
  const category = element.category.toLowerCase();
  
  // HVAC Equipment
  if (name.includes('air handling') || name.includes('ahu')) return 'AHU';
  if (name.includes('rooftop') || name.includes('rtu')) return 'RTU';
  if (name.includes('chiller')) return 'CHILLER';
  if (name.includes('boiler')) return 'BOILER';
  if (name.includes('vav') || name.includes('variable air')) return 'VAV_BOX';
  if (name.includes('fan coil') || name.includes('fcu')) return 'FCU';
  if (name.includes('exhaust fan')) return 'EXHAUST_FAN';
  if (name.includes('pump') && category.includes('mechanical')) return 'PUMP_HVAC';
  if (name.includes('damper')) return 'DAMPER';
  if (name.includes('fan')) return 'FAN';
  
  // Electrical Equipment
  if (name.includes('transformer')) return 'TRANSFORMER';
  if (name.includes('switchgear')) return 'SWITCHGEAR';
  if (name.includes('mdp') || name.includes('main distribution')) return 'MDP';
  if (name.includes('panel')) return 'PANEL';
  if (name.includes('disconnect')) return 'DISCONNECT';
  if (name.includes('vfd') || name.includes('variable frequency')) return 'VFD';
  if (name.includes('generator')) return 'GENERATOR';
  if (name.includes('ups') || name.includes('uninterrupt')) return 'UPS';
  if (category.includes('lighting')) return 'LIGHTING_FIXTURE';
  
  // Plumbing Equipment
  if (name.includes('water heater')) return 'WATER_HEATER';
  if (name.includes('pump') && category.includes('plumbing')) return 'PUMP_PLUMBING';
  if (name.includes('backflow')) return 'BACKFLOW';
  if (name.includes('prv') || name.includes('pressure reduc')) return 'PRV';
  if (category.includes('plumbing') && category.includes('fixture')) return 'FIXTURE';
  
  // Fire Protection
  if (name.includes('fire pump')) return 'FIRE_PUMP';
  if (name.includes('sprinkler')) return 'SPRINKLER_HEAD';
  if (name.includes('fire alarm') || name.includes('facp')) return 'FIRE_ALARM_PANEL';
  if (name.includes('smoke') || name.includes('detector')) return 'SMOKE_DETECTOR';
  
  // Controls
  if (name.includes('sensor') || name.includes('thermostat')) return 'SENSOR';
  if (name.includes('meter')) return 'METER';
  if (name.includes('control')) return 'CONTROLS';
  
  // Fallback based on category
  const { subcategory } = categorizeElement(element.category);
  return BIM_TO_EQUIPMENT_TYPE[subcategory] || 'OTHER';
}

/**
 * Extract capacity/specification from BIM properties
 */
function extractCapacity(element: ElementProperty): string | null {
  const props = element.properties;
  
  // Common capacity properties
  const capacityKeys = [
    'Capacity', 'Load', 'Power', 'Rating', 'CFM', 'Tonnage',
    'BTU', 'GPM', 'Voltage', 'Amperage', 'kW', 'HP'
  ];
  
  for (const key of capacityKeys) {
    for (const [propKey, propValue] of Object.entries(props)) {
      if (propKey.toLowerCase().includes(key.toLowerCase()) && propValue) {
        return String(propValue);
      }
    }
  }
  
  return null;
}

/**
 * Auto-populate MEP equipment from BIM extraction
 */
export async function populateFromBIM(
  projectId: string,
  bimData: BIMExtractionResult,
  userId: string
): Promise<{ systems: number; equipment: number; calculations: number }> {
  let systemsCreated = 0;
  let equipmentCreated = 0;
  let calculationsCreated = 0;
  
  // Group MEP elements by system type
  const systemGroups: Map<MEPSystemType, ElementProperty[]> = new Map();
  
  for (const element of bimData.elements) {
    const { category } = categorizeElement(element.category);
    
    if (category === 'mep') {
      const eqType = inferEquipmentType(element);
      const sysType = EQUIPMENT_TO_SYSTEM[eqType] || 'SPECIALTY';
      
      if (!systemGroups.has(sysType)) {
        systemGroups.set(sysType, []);
      }
      systemGroups.get(sysType)!.push(element);
    }
  }
  
  // Create systems and equipment
  for (const [systemType, elements] of systemGroups) {
    // Only create systems for equipment (not linear elements like ducts/pipes)
    const equipmentElements = elements.filter(el => {
      const eqType = inferEquipmentType(el);
      return eqType !== 'OTHER';
    });
    
    if (equipmentElements.length === 0) continue;
    
    // Create or find system
    const systemNumber = await getNextSystemNumber(projectId, systemType);
    const systemName = {
      'HVAC': 'HVAC System',
      'ELECTRICAL': 'Electrical Distribution',
      'PLUMBING': 'Plumbing System',
      'FIRE_PROTECTION': 'Fire Protection System',
      'CONTROLS': 'Building Controls',
      'LOW_VOLTAGE': 'Low Voltage System',
      'SPECIALTY': 'Specialty Equipment',
    }[systemType];
    
    // Check if system already exists from this BIM model
    let system = await prisma.mEPSystem.findFirst({
      where: {
        projectId,
        systemType,
        bimModelUrn: bimData.modelUrn
      }
    });
    
    if (!system) {
      system = await prisma.mEPSystem.create({
        data: {
          projectId,
          systemNumber,
          name: `${systemName} (BIM)`,
          systemType,
          description: `Auto-imported from BIM model`,
          bimModelUrn: bimData.modelUrn,
          status: 'DESIGN',
          createdBy: userId,
        }
      });
      systemsCreated++;
    }
    
    // Create equipment items
    for (const element of equipmentElements) {
      const equipmentType = inferEquipmentType(element);
      
      // Check if equipment already exists (by BIM dbId)
      const existing = await prisma.mEPEquipment.findFirst({
        where: {
          projectId,
          bimDbId: element.dbId,
          bimModelUrn: bimData.modelUrn
        }
      });
      
      if (existing) continue;
      
      const equipmentTag = await getNextEquipmentTag(projectId, equipmentType);
      const capacity = extractCapacity(element);
      
      await prisma.mEPEquipment.create({
        data: {
          projectId,
          systemId: system.id,
          equipmentTag,
          name: element.name,
          equipmentType,
          capacity,
          specifications: element.properties,
          level: element.level || null,
          room: element.location || null,
          bimDbId: element.dbId,
          bimExternalId: element.externalId || null,
          bimModelUrn: bimData.modelUrn,
          extractedFromBIM: true,
          status: 'SPECIFIED',
          createdBy: userId,
        }
      });
      equipmentCreated++;
    }
  }
  
  // Generate load calculations from grouped data
  const loadCalcs = await generateLoadCalculationsFromBIM(projectId, bimData, userId, systemGroups);
  calculationsCreated = loadCalcs;
  
  return { systems: systemsCreated, equipment: equipmentCreated, calculations: calculationsCreated };
}

/**
 * Generate load calculations from BIM data
 */
async function generateLoadCalculationsFromBIM(
  projectId: string,
  bimData: BIMExtractionResult,
  userId: string,
  systemGroups: Map<MEPSystemType, ElementProperty[]>
): Promise<number> {
  let calcsCreated = 0;
  
  // Electrical load calculation
  const electricalElements = systemGroups.get('ELECTRICAL') || [];
  if (electricalElements.length > 0) {
    const calcExists = await prisma.mEPLoadCalculation.findFirst({
      where: { projectId, calcType: 'ELECTRICAL_DEMAND', bimModelUrn: bimData.modelUrn }
    });
    
    if (!calcExists) {
      let totalLoad = 0;
      const breakdown: Array<{ name: string; load: number; unit: string }> = [];
      
      for (const el of electricalElements) {
        const loadVal = extractNumericProperty(el.properties, ['load', 'power', 'watts', 'kw']);
        if (loadVal) {
          totalLoad += loadVal;
          breakdown.push({ name: el.name, load: loadVal, unit: 'W' });
        }
      }
      
      if (totalLoad > 0 || breakdown.length > 0) {
        const calcNumber = await getNextCalcNumber(projectId, 'ELECTRICAL_DEMAND');
        await prisma.mEPLoadCalculation.create({
          data: {
            projectId,
            calcNumber,
            name: 'Electrical Load Summary (BIM)',
            calcType: 'ELECTRICAL_DEMAND',
            designLoad: totalLoad / 1000, // Convert to kW
            unit: 'kW',
            connectedLoad: totalLoad / 1000,
            demandFactor: 0.8,
            breakdown,
            extractedFromBIM: true,
            bimModelUrn: bimData.modelUrn,
            status: 'DRAFT',
            createdBy: userId,
          }
        });
        calcsCreated++;
      }
    }
  }
  
  // HVAC cooling load calculation
  const hvacElements = systemGroups.get('HVAC') || [];
  if (hvacElements.length > 0) {
    const calcExists = await prisma.mEPLoadCalculation.findFirst({
      where: { projectId, calcType: 'HVAC_COOLING_LOAD', bimModelUrn: bimData.modelUrn }
    });
    
    if (!calcExists) {
      let totalTonnage = 0;
      const breakdown: Array<{ name: string; capacity: number; unit: string }> = [];
      
      for (const el of hvacElements) {
        const tonnage = extractNumericProperty(el.properties, ['tonnage', 'tons', 'capacity', 'btu']);
        if (tonnage) {
          const normalizedTons = el.properties['BTU'] ? tonnage / 12000 : tonnage;
          totalTonnage += normalizedTons;
          breakdown.push({ name: el.name, capacity: normalizedTons, unit: 'tons' });
        }
      }
      
      if (totalTonnage > 0 || breakdown.length > 0) {
        const calcNumber = await getNextCalcNumber(projectId, 'HVAC_COOLING_LOAD');
        await prisma.mEPLoadCalculation.create({
          data: {
            projectId,
            calcNumber,
            name: 'HVAC Cooling Load Summary (BIM)',
            calcType: 'HVAC_COOLING_LOAD',
            designLoad: totalTonnage,
            unit: 'tons',
            connectedLoad: totalTonnage,
            diversityFactor: 0.85,
            breakdown,
            extractedFromBIM: true,
            bimModelUrn: bimData.modelUrn,
            status: 'DRAFT',
            createdBy: userId,
          }
        });
        calcsCreated++;
      }
    }
  }
  
  return calcsCreated;
}

/**
 * Extract numeric property from element
 */
function extractNumericProperty(props: Record<string, string | number | boolean>, keys: string[]): number | null {
  for (const key of keys) {
    for (const [propKey, propValue] of Object.entries(props)) {
      if (propKey.toLowerCase().includes(key.toLowerCase())) {
        const num = typeof propValue === 'number' ? propValue : parseFloat(String(propValue));
        if (!isNaN(num)) return num;
      }
    }
  }
  return null;
}

/**
 * Get MEP dashboard stats for a project
 */
export async function getMEPDashboardStats(projectId: string) {
  const [systems, equipment, submittals, maintenance, calculations] = await Promise.all([
    prisma.mEPSystem.groupBy({
      by: ['systemType', 'status'],
      where: { projectId },
      _count: true,
    }),
    prisma.mEPEquipment.groupBy({
      by: ['equipmentType', 'status'],
      where: { projectId },
      _count: true,
    }),
    prisma.mEPSubmittal.groupBy({
      by: ['submittalType', 'status'],
      where: { projectId },
      _count: true,
    }),
    prisma.mEPMaintenanceSchedule.findMany({
      where: { projectId, isActive: true },
      select: {
        id: true,
        nextDueDate: true,
        frequency: true,
      }
    }),
    prisma.mEPLoadCalculation.groupBy({
      by: ['calcType', 'status'],
      where: { projectId },
      _count: true,
    }),
  ]);
  
  // Calculate upcoming maintenance
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingMaintenance = maintenance.filter(m =>
    m.nextDueDate && new Date(m.nextDueDate) <= weekFromNow
  ).length;

  const overdueMaintenance = maintenance.filter(m =>
    m.nextDueDate && new Date(m.nextDueDate) < now
  ).length;
  
  // Count pending submittals
  const pendingSubmittals = submittals
    .filter(s => ['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'REVISE_RESUBMIT'].includes(s.status))
    .reduce((sum, s) => sum + s._count, 0);
  
  // Count equipment by status
  const equipmentByStatus = equipment.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + e._count;
    return acc;
  }, {} as Record<string, number>);
  
  return {
    totalSystems: systems.reduce((sum, s) => sum + s._count, 0),
    totalEquipment: equipment.reduce((sum, e) => sum + e._count, 0),
    totalSubmittals: submittals.reduce((sum, s) => sum + s._count, 0),
    pendingSubmittals,
    totalMaintenanceSchedules: maintenance.length,
    upcomingMaintenance,
    overdueMaintenance,
    totalCalculations: calculations.reduce((sum, c) => sum + c._count, 0),
    equipmentByStatus,
    systemsByType: systems.reduce((acc, s) => {
      acc[s.systemType] = (acc[s.systemType] || 0) + s._count;
      return acc;
    }, {} as Record<string, number>),
  };
}

/**
 * Create default maintenance schedules for equipment type
 */
export async function createDefaultMaintenanceSchedules(
  projectId: string,
  equipmentId: string,
  equipmentType: MEPEquipmentType,
  userId: string
): Promise<number> {
  const schedules: Array<{
    name: string;
    frequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';
    description: string;
    checklist: string[];
  }> = [];
  
  // Define default schedules by equipment type
  switch (equipmentType) {
    case 'AHU':
    case 'RTU':
      schedules.push(
        {
          name: 'Filter Inspection/Replacement',
          frequency: 'MONTHLY',
          description: 'Inspect and replace air filters as needed',
          checklist: ['Check filter condition', 'Check differential pressure', 'Replace if needed', 'Log replacement date']
        },
        {
          name: 'Belt and Drive Inspection',
          frequency: 'QUARTERLY',
          description: 'Inspect belts, pulleys, and drive components',
          checklist: ['Check belt tension', 'Inspect for wear', 'Check alignment', 'Lubricate bearings']
        },
        {
          name: 'Coil Cleaning',
          frequency: 'SEMI_ANNUAL',
          description: 'Clean heating and cooling coils',
          checklist: ['Clean coils', 'Check drain pan', 'Verify condensate drain', 'Check coil fins']
        }
      );
      break;
      
    case 'CHILLER':
      schedules.push(
        {
          name: 'Chiller Operating Log',
          frequency: 'MONTHLY',
          description: 'Record operating parameters',
          checklist: ['Log temperatures', 'Log pressures', 'Check oil level', 'Check refrigerant charge']
        },
        {
          name: 'Tube Inspection',
          frequency: 'ANNUAL',
          description: 'Inspect and clean tubes',
          checklist: ['Eddy current testing', 'Clean tubes', 'Check tube sheets', 'Inspect water boxes']
        }
      );
      break;
      
    case 'PANEL':
    case 'MDP':
    case 'SWITCHGEAR':
      schedules.push(
        {
          name: 'Infrared Thermography',
          frequency: 'ANNUAL',
          description: 'Thermal imaging of electrical connections',
          checklist: ['Scan all connections', 'Document hot spots', 'Compare to baseline', 'Schedule repairs']
        },
        {
          name: 'Visual Inspection',
          frequency: 'QUARTERLY',
          description: 'Visual inspection of panel condition',
          checklist: ['Check for debris', 'Verify labeling', 'Check for corrosion', 'Verify clearances']
        }
      );
      break;
      
    case 'FIRE_PUMP':
      schedules.push(
        {
          name: 'Weekly Churn Test',
          frequency: 'MONTHLY', // Actually weekly, but using monthly as minimum
          description: 'No-flow churn test per NFPA 25',
          checklist: ['Record suction pressure', 'Record discharge pressure', 'Check for unusual noise', 'Log runtime']
        },
        {
          name: 'Annual Flow Test',
          frequency: 'ANNUAL',
          description: 'Full flow test per NFPA 25',
          checklist: ['Perform flow test', 'Record curve', 'Compare to acceptance test', 'Certify results']
        }
      );
      break;
      
    default:
      // Generic schedule
      schedules.push({
        name: 'Routine Inspection',
        frequency: 'QUARTERLY',
        description: 'General equipment inspection',
        checklist: ['Visual inspection', 'Check operation', 'Note any issues', 'Clean as needed']
      });
  }
  
  // Create schedules
  let created = 0;
  for (const schedule of schedules) {
    const scheduleNumber = await getNextMaintenanceNumber(projectId);
    const startDate = new Date();
    const nextDueDate = new Date(startDate);
    
    // Set next due date based on frequency
    switch (schedule.frequency) {
      case 'MONTHLY': nextDueDate.setMonth(nextDueDate.getMonth() + 1); break;
      case 'QUARTERLY': nextDueDate.setMonth(nextDueDate.getMonth() + 3); break;
      case 'SEMI_ANNUAL': nextDueDate.setMonth(nextDueDate.getMonth() + 6); break;
      case 'ANNUAL': nextDueDate.setFullYear(nextDueDate.getFullYear() + 1); break;
    }
    
    await prisma.mEPMaintenanceSchedule.create({
      data: {
        projectId,
        equipmentId,
        scheduleNumber,
        name: schedule.name,
        frequency: schedule.frequency,
        taskDescription: schedule.description,
        checklist: schedule.checklist,
        startDate,
        nextDueDate,
        isActive: true,
        createdBy: userId,
      }
    });
    created++;
  }
  
  return created;
}
