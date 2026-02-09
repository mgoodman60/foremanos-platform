/**
 * MEP Equipment Schedule Extractor
 * 
 * Extracts detailed equipment data from MEP schedules in construction documents:
 * - Fans Schedule
 * - Energy Recovery Ventilators (ERV) Schedule
 * - Grilles, Registers, and Diffusers Schedule
 * - Heat Pump Split Systems Schedule
 * - Mini-Split Systems Schedule
 * - Louvers Schedule
 * - Electric Wall Heaters Schedule
 * - Plumbing Fixtures and Specialties Schedule
 * - Pumps Schedule
 * - Plumbing Equipment Schedule
 * - Light Fixture Schedule
 * - Mechanical Abbreviations
 */

import { prisma } from './db';
import { createScopedLogger } from './logger';
import { callAbacusLLM } from './abacus-llm';
import { EXTRACTION_MODEL } from '@/lib/model-config';

const log = createScopedLogger('MEP_SCHEDULE');

// ============================================================================
// INTERFACES
// ============================================================================

export interface ExtractedEquipment {
  scheduleType: string;
  tag: string;
  type: string;
  manufacturer?: string;
  model?: string;
  location?: string;
  specifications: Record<string, string>;
  notes?: string;
  sourceSheet?: string;
}

export interface MechanicalAbbreviation {
  abbreviation: string;
  meaning: string;
  category: string;
}

export interface LightFixture {
  type: string;
  symbol?: string;
  manufacturer: string;
  modelNumber: string;
  volts: number;
  description: string;
  watts?: number;
  mounting?: string;
  remarks?: string;
}

export interface PlumbingFixture {
  tag: string;
  typeOfUnit: string;
  supplyMfr?: string;
  supplyModel?: string;
  unitMfr?: string;
  unitModel?: string;
  fixtureUnits?: {
    drain?: number;
    cw?: number;
    hw?: number;
    trap?: number;
    branch?: number;
    vent?: number;
    cwSupply?: number;
    cwBranch?: number;
    hwSupply?: number;
    hwBranch?: number;
  };
  pipeSizes?: {
    cwSupply?: string;
    cwBranch?: string;
    hwSupply?: string;
    hwBranch?: string;
  };
  adaHeight?: string;
  remarks?: string;
}

export interface HVACEquipment {
  unitNo: string;
  location: string;
  type: string;
  unitServed?: string;
  manufacturer: string;
  model: string;
  weight?: string;
  performance?: {
    airflowCfm?: number;
    staticPressure?: number;
    heatingKw?: number;
    coolingTons?: number;
    voltage?: string;
    amps?: number;
    minOA?: number;
  };
  electrical?: {
    voltage: string;
    phase: string;
    mca?: number;
    mop?: number;
  };
  notes?: string;
}

export interface ElectricalEquipment {
  tag: string;
  location: string;
  type: string;
  description?: string;
  manufacturer?: string;
  model?: string;
  voltage?: string;
  phase?: string;
  amps?: number;
  watts?: number;
  circuitBreaker?: string;
  panelFed?: string;
  wireSize?: string;
  conduitSize?: string;
  notes?: string;
}

// ============================================================================
// SCHEDULE DETECTION PATTERNS
// ============================================================================

const SCHEDULE_PATTERNS = {
  fans: [
    /FAN\s*SCHEDULE/i,
    /EXHAUST\s*FAN/i,
    /SUPPLY\s*FAN/i,
    /ROOF\s*FAN/i,
    /\bEF-\d/i,
    /\bSF-\d/i,
    /\bRF-\d/i
  ],
  erv: [
    /ENERGY\s*RECOVERY\s*VENTILATOR/i,
    /ERV\s*SCHEDULE/i,
    /HEAT\s*RECOVERY\s*VENTILATOR/i,
    /\bERV-\d/i,
    /\bHRV-\d/i
  ],
  diffusers: [
    /GRILLES.*REGISTERS.*DIFFUSERS/i,
    /DIFFUSER\s*SCHEDULE/i,
    /REGISTER\s*SCHEDULE/i,
    /GRILLE\s*SCHEDULE/i,
    /SUPPLY\s*DIFFUSER/i,
    /RETURN\s*GRILLE/i
  ],
  heatPump: [
    /HEAT\s*PUMP\s*SPLIT\s*SYSTEM/i,
    /SPLIT\s*SYSTEM\s*SCHEDULE/i,
    /\bAH-\d/i,
    /\bAHU-\d/i,
    /\bHP-\d/i
  ],
  miniSplit: [
    /MINI-?SPLIT\s*SYSTEM/i,
    /DUCTLESS\s*SPLIT/i,
    /\bAC-\d/i,
    /WALL\s*MOUNTED\s*UNIT/i
  ],
  louvers: [
    /LOUVER\s*SCHEDULE/i,
    /OUTSIDE\s*AIR\s*LOUVER/i,
    /EXHAUST\s*LOUVER/i,
    /\bL-\d/i
  ],
  electricHeaters: [
    /ELECTRIC\s*WALL\s*HEATER/i,
    /UNIT\s*HEATER\s*SCHEDULE/i,
    /BASEBOARD\s*HEATER/i,
    /\bUH-\d/i,
    /\bEWH-\d/i
  ],
  plumbingFixtures: [
    /PLUMBING\s*FIXTURES?\s*(AND|&)?\s*SPECIALTIES/i,
    /FIXTURE\s*SCHEDULE/i,
    /\bWC-?\d/i,
    /\bLAV-?\d/i,
    /\bSK-?\d/i,
    /LAVATORY.*PORCELAIN/i,
    /WATER\s*CLOSET/i
  ],
  pumps: [
    /PUMP\s*SCHEDULE/i,
    /DOMESTIC\s*HOT\s*WATER.*PUMP/i,
    /CIRCULATING\s*PUMP/i,
    /\bP-\d/i,
    /\bRCP-\d/i
  ],
  plumbingEquipment: [
    /PLUMBING\s*EQUIPMENT\s*SCHEDULE/i,
    /WATER\s*HEATER\s*SCHEDULE/i,
    /\bWH-\d/i,
    /\bCWH-\d/i
  ],
  lightFixtures: [
    /LIGHT\s*FIXTURE\s*SCHEDULE/i,
    /LIGHTING\s*SCHEDULE/i,
    /FIXTURE\s*TYPE/i,
    /LUMINAIRE\s*SCHEDULE/i,
    /\bLITHONIA\b/i,
    /\bVISA\b/i
  ],
  electricalEquipment: [
    /ELECTRICAL\s*EQUIPMENT\s*SCHEDULE/i,
    /ELECTRICAL\s*PANEL\s*SCHEDULE/i,
    /PANEL\s*SCHEDULE/i,
    /ELECTRICAL\s*SCHEDULE/i,
    /POWER\s*PLAN/i,
    /ELECTRICAL\s*PLAN/i,
    /RECEPTACLE\s*SCHEDULE/i,
    /SWITCH\s*SCHEDULE/i,
    /JUNCTION\s*BOX/i,
    /\bEP-\d/i,
    /\bMDP\b/i,
    /\bMCC\b/i,
    /MOTOR\s*CONTROL\s*CENTER/i,
    /DISCONNECT\s*SWITCH/i,
    /TRANSFORMER\s*SCHEDULE/i,
    /\bXFMR-?\d/i,
    /CIRCUIT\s*BREAKER/i,
    /GENERATOR\s*SCHEDULE/i,
    /UPS\s*SCHEDULE/i,
    /\bATS\b/i,
    /AUTOMATIC\s*TRANSFER\s*SWITCH/i
  ],
  mechanicalAbbreviations: [
    /MECHANICAL\s*ABBREVIATIONS/i,
    /HVAC\s*ABBREVIATIONS/i,
    /MEP\s*ABBREVIATIONS/i,
    /\bCFM\b.*\bCUBIC\s*FEET/i,
    /\bBTU\b.*\bBRITISH\s*THERMAL/i
  ],
  ductConstruction: [
    /DUCT\s*CONSTRUCTION.*INSULATION/i,
    /DUCTWORK\s*SCHEDULE/i,
    /DUCT\s*INSULATION\s*SCHEDULE/i
  ]
};

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

export async function extractMEPSchedules(
  projectSlug: string
): Promise<{
  success: boolean;
  equipment: ExtractedEquipment[];
  lightFixtures: LightFixture[];
  plumbingFixtures: PlumbingFixture[];
  hvacEquipment: HVACEquipment[];
  abbreviations: MechanicalAbbreviation[];
  schedulesFound: string[];
  errors?: string[];
}> {
  log.info('Starting extraction', { projectSlug });
  
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    include: {
      Document: {
        where: { processed: true, deletedAt: null },
        include: { DocumentChunk: true }
      }
    }
  });

  if (!project) {
    return {
      success: false,
      equipment: [],
      lightFixtures: [],
      plumbingFixtures: [],
      hvacEquipment: [],
      abbreviations: [],
      schedulesFound: [],
      errors: ['Project not found']
    };
  }

  // Gather all document chunks
  const allChunks: { content: string; docName: string; pageNumber: number }[] = [];
  for (const doc of project.Document) {
    for (const chunk of doc.DocumentChunk || []) {
      allChunks.push({
        content: chunk.content || '',
        docName: doc.name || doc.fileName || 'Unknown',
        pageNumber: chunk.pageNumber || 0
      });
    }
  }

  log.info('Searching document chunks', { chunkCount: allChunks.length });

  // Find chunks containing each schedule type
  const scheduleChunks: Record<string, typeof allChunks> = {};
  const schedulesFound: string[] = [];

  for (const [scheduleType, patterns] of Object.entries(SCHEDULE_PATTERNS)) {
    const matchingChunks = allChunks.filter(chunk => 
      patterns.some(pattern => pattern.test(chunk.content))
    );
    
    if (matchingChunks.length > 0) {
      scheduleChunks[scheduleType] = matchingChunks;
      schedulesFound.push(scheduleType);
      log.info('Found chunks for schedule type', { scheduleType, chunkCount: matchingChunks.length });
    }
  }

  if (schedulesFound.length === 0) {
    return {
      success: false,
      equipment: [],
      lightFixtures: [],
      plumbingFixtures: [],
      hvacEquipment: [],
      abbreviations: [],
      schedulesFound: [],
      errors: ['No MEP schedules found in documents']
    };
  }

  // Extract data from each schedule type
  const results = {
    equipment: [] as ExtractedEquipment[],
    lightFixtures: [] as LightFixture[],
    plumbingFixtures: [] as PlumbingFixture[],
    hvacEquipment: [] as HVACEquipment[],
    abbreviations: [] as MechanicalAbbreviation[]
  };

  // Extract Light Fixtures
  if (scheduleChunks.lightFixtures) {
    const fixtures = await extractLightFixtureSchedule(scheduleChunks.lightFixtures);
    results.lightFixtures = fixtures;
    log.info('Extracted light fixtures', { count: fixtures.length });
  }

  // Extract Plumbing Fixtures
  if (scheduleChunks.plumbingFixtures) {
    const fixtures = await extractPlumbingFixtures(scheduleChunks.plumbingFixtures);
    results.plumbingFixtures = fixtures;
    log.info('Extracted plumbing fixtures', { count: fixtures.length });
  }

  // Extract HVAC Equipment (fans, ERVs, heat pumps, mini-splits)
  for (const hvacType of ['fans', 'erv', 'heatPump', 'miniSplit', 'electricHeaters']) {
    if (scheduleChunks[hvacType]) {
      const equipment = await extractHVACEquipment(scheduleChunks[hvacType], hvacType);
      results.hvacEquipment.push(...equipment);
      log.info('Extracted HVAC items', { hvacType, count: equipment.length });
    }
  }

  // Extract Mechanical Abbreviations
  if (scheduleChunks.mechanicalAbbreviations) {
    const abbreviations = await extractMechanicalAbbreviations(scheduleChunks.mechanicalAbbreviations);
    results.abbreviations = abbreviations;
    log.info('Extracted abbreviations', { count: abbreviations.length });
  }

  // Store extracted data in database
  await storeMEPScheduleData(project.id, results);

  return {
    success: true,
    ...results,
    schedulesFound
  };
}

// ============================================================================
// LIGHT FIXTURE EXTRACTION
// ============================================================================

async function extractLightFixtureSchedule(
  chunks: { content: string; docName: string; pageNumber: number }[]
): Promise<LightFixture[]> {
  const combinedContent = chunks
    .map(c => c.content)
    .join('\n---\n')
    .slice(0, 12000);

  const prompt = `Extract the LIGHT FIXTURE SCHEDULE from this construction document.

Document Content:
${combinedContent}

Extract each light fixture type with these fields:
- type: Fixture type letter/code (e.g., "A", "B", "C", "E", "EX", "F", "OLF2")
- symbol: The symbol shown (if any)
- manufacturer: e.g., "LITHONIA", "VISA"
- modelNumber: Full model number (e.g., "STAR-2x4-7200LM-80CRI-30K-COL-MVOLT")
- volts: Voltage (e.g., 120)
- description: Full description (e.g., "7,200 LUMEN LED @ 30K, 2x4 RECESSED CENTER ELEMENT LED")
- watts: Wattage if specified
- mounting: Mounting type (e.g., "LAY-IN", "SUSPENDED", "WALL", "SURFACE", "RECESSED")
- remarks: Any notes or special requirements

Return ONLY a valid JSON array:
[{"type": "A", "manufacturer": "LITHONIA", "modelNumber": "...", ...}]`;

  try {
    const response = await callAbacusLLM([
      { role: 'system', content: 'You extract light fixture schedule data from construction documents. Return valid JSON only.' },
      { role: 'user', content: prompt }
    ], { model: EXTRACTION_MODEL, temperature: 0.1, max_tokens: 6000 });

    const content = response.content || '';
    const jsonMatch = content.match(/\[\s*[\s\S]*\]/);
    if (!jsonMatch) return [];

    return JSON.parse(jsonMatch[0]) as LightFixture[];
  } catch (error) {
    log.error('Light fixture extraction error', error as Error);
    return [];
  }
}

// ============================================================================
// PLUMBING FIXTURE EXTRACTION
// ============================================================================

async function extractPlumbingFixtures(
  chunks: { content: string; docName: string; pageNumber: number }[]
): Promise<PlumbingFixture[]> {
  const combinedContent = chunks
    .map(c => c.content)
    .join('\n---\n')
    .slice(0, 12000);

  const prompt = `Extract the PLUMBING FIXTURES AND SPECIALTIES schedule from this construction document.

Document Content:
${combinedContent}

Extract each plumbing fixture with these fields:
- tag: Fixture tag (e.g., "WC-1", "LAV-1", "SK-1", "MS-1", "WH-1")
- typeOfUnit: Type description (e.g., "FLOOR SET WATER CLOSET FLUSH VALVE ADA")
- supplyMfr: Supply manufacturer (e.g., "SLOAN", "PROFLO")
- supplyModel: Supply model number
- unitMfr: Unit manufacturer
- unitModel: Unit model number
- fixtureUnits: Object with drain, cw, hw, trap, branch, vent values
- pipeSizes: Object with cwSupply, cwBranch, hwSupply, hwBranch sizes
- adaHeight: ADA height if specified
- remarks: Any special notes

Return ONLY a valid JSON array:
[{"tag": "WC-1", "typeOfUnit": "...", ...}]`;

  try {
    const response = await callAbacusLLM([
      { role: 'system', content: 'You extract plumbing fixture schedule data from construction documents. Return valid JSON only.' },
      { role: 'user', content: prompt }
    ], { model: EXTRACTION_MODEL, temperature: 0.1, max_tokens: 6000 });

    const content = response.content || '';
    const jsonMatch = content.match(/\[\s*[\s\S]*\]/);
    if (!jsonMatch) return [];

    return JSON.parse(jsonMatch[0]) as PlumbingFixture[];
  } catch (error) {
    log.error('Plumbing fixture extraction error', error as Error);
    return [];
  }
}

// ============================================================================
// HVAC EQUIPMENT EXTRACTION
// ============================================================================

async function extractHVACEquipment(
  chunks: { content: string; docName: string; pageNumber: number }[],
  scheduleType: string
): Promise<HVACEquipment[]> {
  const combinedContent = chunks
    .map(c => c.content)
    .join('\n---\n')
    .slice(0, 12000);

  const typePrompts: Record<string, string> = {
    fans: 'FANS (Exhaust Fans, Supply Fans, Roof Fans)',
    erv: 'ENERGY RECOVERY VENTILATORS (ERVs, HRVs)',
    heatPump: 'HEAT PUMP SPLIT SYSTEMS',
    miniSplit: 'MINI-SPLIT / DUCTLESS SPLIT SYSTEMS',
    electricHeaters: 'ELECTRIC WALL HEATERS / UNIT HEATERS'
  };

  const prompt = `Extract the ${typePrompts[scheduleType] || 'HVAC EQUIPMENT'} schedule from this construction document.

Document Content:
${combinedContent}

Extract each piece of equipment with these fields:
- unitNo: Unit tag/number (e.g., "EF-1", "ERV-1", "AH-1", "AC-1", "HP-1")
- location: Installation location
- type: Equipment type (e.g., "PROPELLER EXHAUST FAN", "VERTICAL DUCTED AHU")
- unitServed: What the unit serves
- manufacturer: e.g., "CARRIER", "GREENBACK", "DAIKIN"
- model: Full model number
- weight: Weight in LBS if specified
- performance: Object with airflowCfm, staticPressure, heatingKw, coolingTons, voltage, amps, minOA
- electrical: Object with voltage, phase, mca (minimum circuit ampacity), mop (maximum overcurrent protection)
- notes: Any special notes or remarks

Return ONLY a valid JSON array:
[{"unitNo": "EF-1", "location": "ROOF", "manufacturer": "...", ...}]`;

  try {
    const response = await callAbacusLLM([
      { role: 'system', content: 'You extract HVAC equipment schedule data from construction documents. Return valid JSON only.' },
      { role: 'user', content: prompt }
    ], { model: EXTRACTION_MODEL, temperature: 0.1, max_tokens: 6000 });

    const content = response.content || '';
    const jsonMatch = content.match(/\[\s*[\s\S]*\]/);
    if (!jsonMatch) return [];

    return JSON.parse(jsonMatch[0]) as HVACEquipment[];
  } catch (error) {
    log.error('HVAC extraction error', error as Error, { scheduleType });
    return [];
  }
}

// ============================================================================
// MECHANICAL ABBREVIATIONS EXTRACTION
// ============================================================================

async function extractMechanicalAbbreviations(
  chunks: { content: string; docName: string; pageNumber: number }[]
): Promise<MechanicalAbbreviation[]> {
  const combinedContent = chunks
    .map(c => c.content)
    .join('\n---\n')
    .slice(0, 15000);

  const prompt = `Extract the MECHANICAL ABBREVIATIONS from this construction document.

Document Content:
${combinedContent}

Extract each abbreviation with:
- abbreviation: The short form (e.g., "CFM", "BTU", "HP", "ERV")
- meaning: The full meaning (e.g., "CUBIC FEET PER MINUTE", "BRITISH THERMAL UNIT")
- category: Category (one of: "airflow", "pressure", "electrical", "plumbing", "hvac", "general", "pump", "unit")

Return ONLY a valid JSON array:
[{"abbreviation": "CFM", "meaning": "CUBIC FEET PER MINUTE", "category": "airflow"}]`;

  try {
    const response = await callAbacusLLM([
      { role: 'system', content: 'You extract mechanical abbreviations from construction documents. Return valid JSON only.' },
      { role: 'user', content: prompt }
    ], { model: EXTRACTION_MODEL, temperature: 0.1, max_tokens: 8000 });

    const content = response.content || '';
    const jsonMatch = content.match(/\[\s*[\s\S]*\]/);
    if (!jsonMatch) return [];

    return JSON.parse(jsonMatch[0]) as MechanicalAbbreviation[];
  } catch (error) {
    log.error('Abbreviations extraction error', error as Error);
    return [];
  }
}

// ============================================================================
// DATABASE STORAGE
// ============================================================================

async function storeMEPScheduleData(
  projectId: string,
  data: {
    lightFixtures: LightFixture[];
    plumbingFixtures: PlumbingFixture[];
    hvacEquipment: HVACEquipment[];
    abbreviations: MechanicalAbbreviation[];
  }
): Promise<void> {
  // Store as project data source for RAG access
  const mepScheduleData = {
    extractedAt: new Date().toISOString(),
    lightFixtures: data.lightFixtures,
    plumbingFixtures: data.plumbingFixtures,
    hvacEquipment: data.hvacEquipment,
    abbreviations: data.abbreviations,
    summary: {
      lightFixtureCount: data.lightFixtures.length,
      plumbingFixtureCount: data.plumbingFixtures.length,
      hvacEquipmentCount: data.hvacEquipment.length,
      abbreviationCount: data.abbreviations.length
    }
  };

  // Upsert project data source for MEP schedules
  // Use JSON.parse/stringify to ensure proper JSON serialization for Prisma
  const jsonData = JSON.parse(JSON.stringify(mepScheduleData));
  
  await prisma.projectDataSource.upsert({
    where: {
      projectId_featureType: {
        projectId,
        featureType: 'mep_schedules'
      }
    },
    update: {
      metadata: jsonData,
      updatedAt: new Date()
    },
    create: {
      projectId,
      featureType: 'mep_schedules',
      sourceType: 'ai_extraction',
      confidence: 85,
      metadata: jsonData
    }
  });

  log.info('Stored MEP schedule data in database');
}

// ============================================================================
// RAG CONTEXT HELPER
// ============================================================================

export async function getMEPScheduleContext(projectSlug: string): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug }
  });

  if (!project) return '';

  const dataSource = await prisma.projectDataSource.findUnique({
    where: {
      projectId_featureType: {
        projectId: project.id,
        featureType: 'mep_schedules'
      }
    }
  });

  if (!dataSource?.metadata) return '';

  const data = dataSource.metadata as {
    lightFixtures?: LightFixture[];
    plumbingFixtures?: PlumbingFixture[];
    hvacEquipment?: HVACEquipment[];
    electricalEquipment?: ElectricalEquipment[];
    abbreviations?: MechanicalAbbreviation[];
  };

  let context = '';

  // Light Fixtures
  if (data.lightFixtures && data.lightFixtures.length > 0) {
    context += '\n=== LIGHT FIXTURE SCHEDULE ===\n';
    for (const f of data.lightFixtures) {
      context += `Type ${f.type}: ${f.manufacturer} ${f.modelNumber} - ${f.description}`;
      if (f.watts) context += ` (${f.watts}W)`;
      if (f.mounting) context += ` [${f.mounting}]`;
      context += '\n';
    }
  }

  // Electrical Equipment
  if (data.electricalEquipment && data.electricalEquipment.length > 0) {
    context += '\n=== ELECTRICAL EQUIPMENT SCHEDULE ===\n';
    for (const e of data.electricalEquipment) {
      context += `${e.tag}: ${e.type}`;
      if (e.description) context += ` - ${e.description}`;
      if (e.manufacturer) context += ` (${e.manufacturer}`;
      if (e.model) context += ` ${e.model}`;
      if (e.manufacturer) context += ')';
      if (e.location) context += ` @ ${e.location}`;
      if (e.voltage) context += ` [${e.voltage}V`;
      if (e.phase) context += `/${e.phase}PH`;
      if (e.amps) context += `/${e.amps}A`;
      if (e.voltage) context += ']';
      if (e.panelFed) context += ` Fed from: ${e.panelFed}`;
      if (e.circuitBreaker) context += ` CB: ${e.circuitBreaker}`;
      context += '\n';
    }
  }

  // Plumbing Fixtures
  if (data.plumbingFixtures && data.plumbingFixtures.length > 0) {
    context += '\n=== PLUMBING FIXTURES AND SPECIALTIES ===\n';
    for (const f of data.plumbingFixtures) {
      context += `${f.tag}: ${f.typeOfUnit}`;
      if (f.supplyMfr) context += ` - Supply: ${f.supplyMfr} ${f.supplyModel || ''}`;
      if (f.unitMfr) context += ` - Unit: ${f.unitMfr} ${f.unitModel || ''}`;
      if (f.remarks) context += ` [${f.remarks}]`;
      context += '\n';
    }
  }

  // HVAC Equipment
  if (data.hvacEquipment && data.hvacEquipment.length > 0) {
    context += '\n=== HVAC EQUIPMENT SCHEDULES ===\n';
    for (const e of data.hvacEquipment) {
      context += `${e.unitNo}: ${e.type} - ${e.manufacturer} ${e.model}`;
      if (e.location) context += ` @ ${e.location}`;
      if (e.performance?.airflowCfm) context += ` (${e.performance.airflowCfm} CFM)`;
      if (e.performance?.coolingTons) context += ` (${e.performance.coolingTons} tons)`;
      if (e.electrical) context += ` [${e.electrical.voltage}V/${e.electrical.phase}PH]`;
      context += '\n';
    }
  }

  // Abbreviations (summarized)
  if (data.abbreviations && data.abbreviations.length > 0) {
    context += '\n=== MECHANICAL ABBREVIATIONS (Project-Specific) ===\n';
    const byCategory = data.abbreviations.reduce((acc, a) => {
      if (!acc[a.category]) acc[a.category] = [];
      acc[a.category].push(`${a.abbreviation} = ${a.meaning}`);
      return acc;
    }, {} as Record<string, string[]>);
    
    for (const [category, abbrs] of Object.entries(byCategory)) {
      context += `${category.toUpperCase()}: ${abbrs.slice(0, 10).join(', ')}`;
      if (abbrs.length > 10) context += ` (+${abbrs.length - 10} more)`;
      context += '\n';
    }
  }

  return context;
}
