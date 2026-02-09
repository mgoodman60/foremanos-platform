/**
 * Equipment Schedule Extractor
 * Extracts mechanical/HVAC equipment from schedules for submittal quantity verification
 */

import { prisma } from './db';
import { logger } from '@/lib/logger';
import OpenAI from 'openai';
import { EXTRACTION_MODEL } from '@/lib/model-config';

let openaiInstance: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }
  return openaiInstance;
}

export interface MechanicalEquipment {
  id: string;
  equipmentTag: string;      // AHU-1, RTU-1, FCU-1, etc.
  equipmentType: string;     // Air Handler, RTU, FCU, VAV, etc.
  manufacturer?: string;
  model?: string;
  capacity?: string;         // 5 Ton, 10,000 CFM, etc.
  capacityUnit?: string;     // Tons, CFM, MBH, etc.
  voltage?: string;
  phase?: string;
  motorHP?: number;
  refrigerant?: string;      // R-410A, R-32, etc.
  heatingType?: string;      // Electric, Gas, Hot Water
  heatingCapacity?: string;
  coolingCapacity?: string;
  efficiency?: string;       // SEER, EER, IEER
  controls?: string;         // BACnet, Modbus, etc.
  location?: string;
  servedArea?: string;
  quantity: number;
  notes?: string;
}

export interface DiffuserGrille {
  id: string;
  tag: string;               // SD-1, RG-1, etc.
  type: string;              // Supply Diffuser, Return Grille, Exhaust Grille, etc.
  manufacturer?: string;
  model?: string;
  size: string;              // 24x24, 12x12, etc.
  cfm?: number;
  neckSize?: string;
  finish?: string;           // White, Aluminum, etc.
  mounting?: string;         // Ceiling, Wall, etc.
  quantity: number;
  notes?: string;
}

export interface EquipmentSchedule {
  projectId: string;
  documentId?: string;
  equipment: MechanicalEquipment[];
  diffusers: DiffuserGrille[];
  extractedAt: Date;
  totalEquipment: number;
  totalDiffusers: number;
  totalCoolingTons?: number;
  byType: Record<string, number>;
}

/**
 * Extract mechanical equipment from document chunks using AI
 */
export async function extractMechanicalEquipment(
  projectId: string,
  documentId?: string
): Promise<MechanicalEquipment[]> {
  try {
    const whereClause: any = {
      projectId,
      OR: [
        { content: { contains: 'EQUIPMENT SCHEDULE', mode: 'insensitive' } },
        { content: { contains: 'MECHANICAL SCHEDULE', mode: 'insensitive' } },
        { content: { contains: 'HVAC SCHEDULE', mode: 'insensitive' } },
        { content: { contains: 'AHU-', mode: 'insensitive' } },
        { content: { contains: 'RTU-', mode: 'insensitive' } },
        { content: { contains: 'FCU-', mode: 'insensitive' } },
        { content: { contains: 'AIR HANDLING UNIT', mode: 'insensitive' } },
        { content: { contains: 'ROOFTOP UNIT', mode: 'insensitive' } },
      ]
    };

    if (documentId) whereClause.documentId = documentId;

    const chunks = await prisma.documentChunk.findMany({
      where: whereClause,
      orderBy: { pageNumber: 'asc' },
      take: 25,
    });

    if (chunks.length === 0) return [];

    const combinedContent = chunks.map(c => c.content).join('\n\n');

    const prompt = `Extract ALL mechanical/HVAC equipment from this schedule. Return JSON array:

${combinedContent}

For each equipment include:
- equipmentTag: Equipment designation (AHU-1, RTU-1, FCU-1, VAV-1, EF-1, HWP-1, CHP-1, etc.)
- equipmentType: Type (Air Handling Unit, Rooftop Unit, Fan Coil Unit, VAV Box, Exhaust Fan, Pump, Chiller, Boiler, Split System, Mini-Split, etc.)
- manufacturer: Brand if specified
- model: Model number if specified
- capacity: Capacity value (number with unit)
- capacityUnit: Unit (Tons, CFM, MBH, GPM, HP, etc.)
- voltage: Voltage rating
- phase: 1PH or 3PH
- motorHP: Motor horsepower (number only)
- refrigerant: Refrigerant type if specified (R-410A, etc.)
- heatingType: Heating type (Electric, Gas, Hot Water, None)
- heatingCapacity: Heating capacity if specified
- coolingCapacity: Cooling capacity if specified
- efficiency: Efficiency rating (SEER, EER, AFUE, etc.)
- controls: Control type if specified
- location: Location/room if specified
- servedArea: Area served if specified
- quantity: 1 unless multiple identical units specified
- notes: Any notes

Return ONLY valid JSON array, no markdown.`;

    const response = await getOpenAI().chat.completions.create({
      model: EXTRACTION_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || '[]';
    const cleaned = content.replace(/```json\n?|```\n?/g, '').trim();
    const equipment: MechanicalEquipment[] = JSON.parse(cleaned);

    return equipment.map((e, idx) => ({
      ...e,
      id: `equip-${projectId}-${idx}`,
      quantity: e.quantity || 1,
    }));
  } catch (error) {
    logger.error('EQUIPMENT_SCHEDULE', 'Equipment extraction error', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Extract diffusers and grilles from document chunks
 */
export async function extractDiffusers(
  projectId: string,
  documentId?: string
): Promise<DiffuserGrille[]> {
  try {
    const whereClause: any = {
      projectId,
      OR: [
        { content: { contains: 'DIFFUSER SCHEDULE', mode: 'insensitive' } },
        { content: { contains: 'GRILLE SCHEDULE', mode: 'insensitive' } },
        { content: { contains: 'SUPPLY DIFFUSER', mode: 'insensitive' } },
        { content: { contains: 'RETURN GRILLE', mode: 'insensitive' } },
        { content: { contains: 'AIR DEVICE', mode: 'insensitive' } },
      ]
    };

    if (documentId) whereClause.documentId = documentId;

    const chunks = await prisma.documentChunk.findMany({
      where: whereClause,
      orderBy: { pageNumber: 'asc' },
      take: 15,
    });

    if (chunks.length === 0) return [];

    const combinedContent = chunks.map(c => c.content).join('\n\n');

    const prompt = `Extract ALL diffusers, grilles, and registers from this schedule. Return JSON array:

${combinedContent}

For each device include:
- tag: Type designation (SD-1, RG-1, EG-1, etc.)
- type: Description (Supply Diffuser, Return Grille, Exhaust Grille, Linear Slot Diffuser, Ceiling Register, etc.)
- manufacturer: Brand if specified
- model: Model/catalog number
- size: Face size (24x24, 12x12, 2'x4', etc.)
- cfm: Airflow CFM (number only)
- neckSize: Duct connection size if specified
- finish: Finish (White, Aluminum, Bronze, Custom, etc.)
- mounting: Mounting (Ceiling, Wall, Floor, etc.)
- quantity: Total count of this type
- notes: Any notes

Return ONLY valid JSON array, no markdown.`;

    const response = await getOpenAI().chat.completions.create({
      model: EXTRACTION_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || '[]';
    const cleaned = content.replace(/```json\n?|```\n?/g, '').trim();
    const diffusers: DiffuserGrille[] = JSON.parse(cleaned);

    return diffusers.map((d, idx) => ({
      ...d,
      id: `diff-${projectId}-${idx}`,
      quantity: d.quantity || 1,
    }));
  } catch (error) {
    logger.error('EQUIPMENT_SCHEDULE', 'Diffuser extraction error', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Extract full equipment schedule
 */
export async function extractEquipmentSchedule(
  projectId: string,
  documentId?: string
): Promise<EquipmentSchedule | null> {
  try {
    const [equipment, diffusers] = await Promise.all([
      extractMechanicalEquipment(projectId, documentId),
      extractDiffusers(projectId, documentId),
    ]);

    if (equipment.length === 0 && diffusers.length === 0) {
      return null;
    }

    // Calculate summary by type
    const byType: Record<string, number> = {};
    equipment.forEach(e => {
      const type = e.equipmentType;
      byType[type] = (byType[type] || 0) + e.quantity;
    });

    // Calculate total cooling tons
    let totalCoolingTons = 0;
    equipment.forEach(e => {
      if (e.capacityUnit?.toLowerCase() === 'tons' && e.capacity) {
        const tons = parseFloat(e.capacity.replace(/[^0-9.]/g, ''));
        if (!isNaN(tons)) totalCoolingTons += tons * e.quantity;
      }
    });

    const schedule: EquipmentSchedule = {
      projectId,
      documentId,
      equipment,
      diffusers,
      extractedAt: new Date(),
      totalEquipment: equipment.reduce((sum, e) => sum + e.quantity, 0),
      totalDiffusers: diffusers.reduce((sum, d) => sum + d.quantity, 0),
      totalCoolingTons: totalCoolingTons || undefined,
      byType,
    };

    logger.info('EQUIPMENT_SCHEDULE', `Extracted ${equipment.length} equipment types, ${diffusers.length} diffuser types`, { equipmentCount: equipment.length, diffuserCount: diffusers.length });
    return schedule;
  } catch (error) {
    logger.error('EQUIPMENT_SCHEDULE', 'Error in extractEquipmentSchedule', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Get equipment context for RAG
 */
export async function getEquipmentContext(projectSlug: string): Promise<string | null> {
  try {
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true }
    });

    if (!project) return null;

    const schedule = await extractEquipmentSchedule(project.id);
    if (!schedule) return null;

    let context = 'MECHANICAL EQUIPMENT SCHEDULE:\n\n';

    if (schedule.equipment.length > 0) {
      context += `HVAC EQUIPMENT (${schedule.totalEquipment} units`;
      if (schedule.totalCoolingTons) context += `, ${schedule.totalCoolingTons} total tons`;
      context += '):\n';

      schedule.equipment.forEach(e => {
        context += `  - ${e.equipmentTag}: ${e.equipmentType}`;
        if (e.capacity) context += `, ${e.capacity} ${e.capacityUnit || ''}`;
        if (e.manufacturer) context += `, ${e.manufacturer}`;
        if (e.model) context += ` ${e.model}`;
        if (e.voltage) context += `, ${e.voltage}`;
        if (e.servedArea) context += ` (serves ${e.servedArea})`;
        context += '\n';
      });
      context += '\n';
    }

    if (schedule.diffusers.length > 0) {
      context += `DIFFUSERS & GRILLES (${schedule.totalDiffusers} total):\n`;
      schedule.diffusers.forEach(d => {
        context += `  - ${d.tag}: ${d.type}, ${d.size} (Qty: ${d.quantity})`;
        if (d.cfm) context += `, ${d.cfm} CFM`;
        if (d.manufacturer) context += `, ${d.manufacturer}`;
        context += '\n';
      });
    }

    return context;
  } catch (error) {
    logger.error('EQUIPMENT_SCHEDULE', 'Context error', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Get equipment formatted for submittal requirements
 */
export async function getEquipmentRequirements(projectId: string): Promise<{
  equipment: Array<{
    productName: string;
    manufacturer?: string;
    model?: string;
    requiredQty: number;
    unit: string;
    specSection: string;
    tradeCategory: string;
    linkedSourceType: string;
    linkedSourceIds: string[];
  }>;
  diffusers: Array<{
    productName: string;
    manufacturer?: string;
    model?: string;
    requiredQty: number;
    unit: string;
    specSection: string;
    tradeCategory: string;
    linkedSourceType: string;
    linkedSourceIds: string[];
  }>;
}> {
  const schedule = await extractEquipmentSchedule(projectId);
  if (!schedule) return { equipment: [], diffusers: [] };

  const equipment = schedule.equipment.map(e => ({
    productName: `${e.equipmentType} ${e.equipmentTag}${e.capacity ? ` - ${e.capacity} ${e.capacityUnit || ''}` : ''}`,
    manufacturer: e.manufacturer,
    model: e.model,
    requiredQty: e.quantity,
    unit: 'EA',
    specSection: getEquipmentSpecSection(e.equipmentType),
    tradeCategory: 'mechanical',
    linkedSourceType: 'equipment_schedule',
    linkedSourceIds: [e.id],
  }));

  const diffusers = schedule.diffusers.map(d => ({
    productName: `${d.type} - ${d.tag} (${d.size})`,
    manufacturer: d.manufacturer,
    model: d.model,
    requiredQty: d.quantity,
    unit: 'EA',
    specSection: '23 37 00', // Air Outlets and Inlets
    tradeCategory: 'mechanical',
    linkedSourceType: 'diffuser_schedule',
    linkedSourceIds: [d.id],
  }));

  return { equipment, diffusers };
}

function getEquipmentSpecSection(equipmentType: string): string {
  const type = equipmentType.toLowerCase();
  if (type.includes('air handling') || type.includes('ahu')) return '23 73 00';
  if (type.includes('rooftop') || type.includes('rtu')) return '23 74 00';
  if (type.includes('fan coil') || type.includes('fcu')) return '23 82 00';
  if (type.includes('vav')) return '23 36 00';
  if (type.includes('exhaust fan') || type.includes('ef-')) return '23 34 00';
  if (type.includes('pump')) return '23 21 00';
  if (type.includes('chiller')) return '23 64 00';
  if (type.includes('boiler')) return '23 52 00';
  if (type.includes('split') || type.includes('mini')) return '23 81 00';
  return '23 00 00'; // General HVAC
}
