/**
 * Electrical Panel Schedule Extractor
 * Extracts electrical panels and equipment from schedules for submittal quantity verification
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

export interface ElectricalPanel {
  id: string;
  panelTag: string;          // LP-1, MDP, PP-1, etc.
  panelType: string;         // Main Distribution, Lighting, Power, etc.
  manufacturer?: string;
  voltage: string;           // 120/208V, 277/480V, etc.
  phase: string;             // 1PH, 3PH
  amperage: number;          // 100A, 200A, 400A, etc.
  mainBreaker?: string;      // MLO, MB
  mounting: string;          // Surface, Flush, NEMA
  enclosure?: string;        // NEMA 1, NEMA 3R, etc.
  circuits?: number;         // Number of circuits/spaces
  fedFrom?: string;          // Source panel
  location?: string;
  wireSize?: string;
  conduitSize?: string;
  quantity: number;
  notes?: string;
}

export interface LightingFixture {
  id: string;
  fixtureTag: string;        // A, B, C, etc.
  fixtureType: string;       // LED Troffer, Pendant, Wall Sconce, etc.
  manufacturer?: string;
  catalog?: string;          // Catalog/model number
  wattage?: number;
  lumens?: number;
  colorTemp?: string;        // 3000K, 4000K, etc.
  voltage?: string;
  mounting: string;          // Recessed, Surface, Pendant, etc.
  dimming?: string;          // 0-10V, DALI, etc.
  emergencyBattery?: boolean;
  wetLocation?: boolean;
  quantity: number;
  notes?: string;
}

export interface ElectricalSchedule {
  projectId: string;
  documentId?: string;
  panels: ElectricalPanel[];
  lightingFixtures: LightingFixture[];
  extractedAt: Date;
  totalPanels: number;
  totalLightFixtures: number;
  totalConnectedLoad?: number;
}

/**
 * Extract electrical panels from document chunks using AI
 */
export async function extractElectricalPanels(
  projectId: string,
  documentId?: string
): Promise<ElectricalPanel[]> {
  try {
    const whereClause: any = {
      projectId,
      OR: [
        { content: { contains: 'PANEL SCHEDULE', mode: 'insensitive' } },
        { content: { contains: 'ELECTRICAL PANEL', mode: 'insensitive' } },
        { content: { contains: 'MDP', mode: 'insensitive' } },
        { content: { contains: 'DISTRIBUTION PANEL', mode: 'insensitive' } },
        { content: { contains: '120/208V', mode: 'insensitive' } },
        { content: { contains: '277/480V', mode: 'insensitive' } },
      ]
    };

    if (documentId) whereClause.documentId = documentId;

    const chunks = await prisma.documentChunk.findMany({
      where: whereClause,
      orderBy: { pageNumber: 'asc' },
      take: 20,
    });

    if (chunks.length === 0) return [];

    const combinedContent = chunks.map(c => c.content).join('\n\n');

    const prompt = `Extract ALL electrical panels from this schedule. Return JSON array:

${combinedContent}

For each panel include:
- panelTag: Panel designation (LP-1, MDP, PP-1, etc.)
- panelType: Type (Main Distribution, Lighting, Power, Branch, Motor Control Center, etc.)
- manufacturer: Brand if specified
- voltage: Voltage rating (120/208V, 277/480V, etc.)
- phase: 1PH or 3PH
- amperage: Main breaker/bus amperage (number only)
- mainBreaker: MLO or MB rating if specified
- mounting: Surface, Flush, NEMA type
- enclosure: NEMA rating if specified
- circuits: Number of circuits/spaces
- fedFrom: Source panel if specified
- location: Room/area if specified
- wireSize: Feeder wire size if specified
- conduitSize: Conduit size if specified
- quantity: 1 unless multiple identical panels specified
- notes: Any notes

Return ONLY valid JSON array, no markdown.`;

    const response = await getOpenAI().chat.completions.create({
      model: EXTRACTION_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || '[]';
    const cleaned = content.replace(/```json\n?|```\n?/g, '').trim();
    const panels: ElectricalPanel[] = JSON.parse(cleaned);

    return panels.map((p, idx) => ({
      ...p,
      id: `panel-${projectId}-${idx}`,
      quantity: p.quantity || 1,
    }));
  } catch (error) {
    logger.error('ELECTRICAL_PANEL', 'Panel extraction error', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Extract lighting fixtures from document chunks using AI
 */
export async function extractLightingFixtures(
  projectId: string,
  documentId?: string
): Promise<LightingFixture[]> {
  try {
    const whereClause: any = {
      projectId,
      OR: [
        { content: { contains: 'LIGHTING FIXTURE SCHEDULE', mode: 'insensitive' } },
        { content: { contains: 'LUMINAIRE SCHEDULE', mode: 'insensitive' } },
        { content: { contains: 'FIXTURE TYPE', mode: 'insensitive' } },
        { content: { contains: 'LED TROFFER', mode: 'insensitive' } },
        { content: { contains: 'LUMENS', mode: 'insensitive' } },
      ]
    };

    if (documentId) whereClause.documentId = documentId;

    const chunks = await prisma.documentChunk.findMany({
      where: whereClause,
      orderBy: { pageNumber: 'asc' },
      take: 20,
    });

    if (chunks.length === 0) return [];

    const combinedContent = chunks.map(c => c.content).join('\n\n');

    const prompt = `Extract ALL lighting fixtures from this schedule. Return JSON array:

${combinedContent}

For each fixture include:
- fixtureTag: Type designation (A, B, C, A1, etc.)
- fixtureType: Description (LED Troffer, Pendant, Wall Sconce, Downlight, Strip, Exit Sign, etc.)
- manufacturer: Brand if specified
- catalog: Catalog/model number
- wattage: Wattage (number only)
- lumens: Lumen output (number only)
- colorTemp: Color temperature (3000K, 4000K, etc.)
- voltage: Voltage if specified
- mounting: Mounting type (Recessed, Surface, Pendant, Wall, etc.)
- dimming: Dimming type if specified (0-10V, DALI, etc.)
- emergencyBattery: true if EM battery backup
- wetLocation: true if wet/damp rated
- quantity: Total count of this fixture type in project
- notes: Any notes

Return ONLY valid JSON array, no markdown.`;

    const response = await getOpenAI().chat.completions.create({
      model: EXTRACTION_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || '[]';
    const cleaned = content.replace(/```json\n?|```\n?/g, '').trim();
    const fixtures: LightingFixture[] = JSON.parse(cleaned);

    return fixtures.map((f, idx) => ({
      ...f,
      id: `light-${projectId}-${idx}`,
      quantity: f.quantity || 1,
    }));
  } catch (error) {
    logger.error('ELECTRICAL_PANEL', 'Lighting fixture extraction error', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Extract full electrical schedule
 */
export async function extractElectricalSchedule(
  projectId: string,
  documentId?: string
): Promise<ElectricalSchedule | null> {
  try {
    const [panels, lightingFixtures] = await Promise.all([
      extractElectricalPanels(projectId, documentId),
      extractLightingFixtures(projectId, documentId),
    ]);

    if (panels.length === 0 && lightingFixtures.length === 0) {
      return null;
    }

    const schedule: ElectricalSchedule = {
      projectId,
      documentId,
      panels,
      lightingFixtures,
      extractedAt: new Date(),
      totalPanels: panels.reduce((sum, p) => sum + p.quantity, 0),
      totalLightFixtures: lightingFixtures.reduce((sum, f) => sum + f.quantity, 0),
    };

    logger.info('ELECTRICAL_PANEL', `Extracted ${panels.length} panel types, ${lightingFixtures.length} fixture types`, { panelCount: panels.length, fixtureCount: lightingFixtures.length });
    return schedule;
  } catch (error) {
    logger.error('ELECTRICAL_PANEL', 'Error in extractElectricalSchedule', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Get electrical context for RAG
 */
export async function getElectricalContext(projectSlug: string): Promise<string | null> {
  try {
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true }
    });

    if (!project) return null;

    const schedule = await extractElectricalSchedule(project.id);
    if (!schedule) return null;

    let context = 'ELECTRICAL SCHEDULE:\n\n';

    if (schedule.panels.length > 0) {
      context += `PANELS (${schedule.totalPanels} total):\n`;
      schedule.panels.forEach(p => {
        context += `  - ${p.panelTag}: ${p.panelType}, ${p.voltage}, ${p.phase}, ${p.amperage}A`;
        if (p.manufacturer) context += `, ${p.manufacturer}`;
        if (p.circuits) context += `, ${p.circuits} circuits`;
        if (p.fedFrom) context += ` (fed from ${p.fedFrom})`;
        context += '\n';
      });
      context += '\n';
    }

    if (schedule.lightingFixtures.length > 0) {
      context += `LIGHTING FIXTURES (${schedule.totalLightFixtures} total):\n`;
      schedule.lightingFixtures.forEach(f => {
        context += `  - Type ${f.fixtureTag}: ${f.fixtureType} (Qty: ${f.quantity})`;
        if (f.manufacturer) context += `, ${f.manufacturer}`;
        if (f.catalog) context += ` ${f.catalog}`;
        if (f.wattage) context += `, ${f.wattage}W`;
        if (f.colorTemp) context += `, ${f.colorTemp}`;
        if (f.emergencyBattery) context += ' [EM]';
        context += '\n';
      });
    }

    return context;
  } catch (error) {
    logger.error('ELECTRICAL_PANEL', 'Context error', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Get electrical equipment formatted for submittal requirements
 */
export async function getElectricalRequirements(projectId: string): Promise<{
  panels: Array<{
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
  lightingFixtures: Array<{
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
  const schedule = await extractElectricalSchedule(projectId);
  if (!schedule) return { panels: [], lightingFixtures: [] };

  const panels = schedule.panels.map(p => ({
    productName: `${p.panelType} Panel ${p.panelTag} - ${p.amperage}A ${p.voltage} ${p.phase}`,
    manufacturer: p.manufacturer,
    model: undefined,
    requiredQty: p.quantity,
    unit: 'EA',
    specSection: '26 24 00', // Switchboards and Panelboards
    tradeCategory: 'electrical',
    linkedSourceType: 'electrical_schedule',
    linkedSourceIds: [p.id],
  }));

  const lightingFixtures = schedule.lightingFixtures.map(f => ({
    productName: `${f.fixtureType} - Type ${f.fixtureTag}`,
    manufacturer: f.manufacturer,
    model: f.catalog,
    requiredQty: f.quantity,
    unit: 'EA',
    specSection: '26 51 00', // Interior Lighting
    tradeCategory: 'electrical',
    linkedSourceType: 'lighting_schedule',
    linkedSourceIds: [f.id],
  }));

  return { panels, lightingFixtures };
}
