/**
 * Plumbing Fixture Schedule Extractor
 * Extracts plumbing fixtures from schedules for submittal quantity verification
 */

import { prisma } from './db';
import OpenAI from 'openai';
import { EXTRACTION_MODEL } from '@/lib/model-config';
import { logger } from '@/lib/logger';

let openaiInstance: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }
  return openaiInstance;
}

export interface PlumbingFixture {
  id: string;
  fixtureTag: string;        // P-1, L-1, WC-1, etc.
  fixtureType: string;       // Lavatory, Water Closet, Urinal, Sink, etc.
  manufacturer?: string;
  model?: string;
  quantity: number;
  location?: string;         // Room or area
  roughInHeight?: string;
  carrierRequired?: boolean;
  adaCompliant?: boolean;
  flushType?: string;        // Manual, Sensor, etc.
  gpmGpf?: string;           // Gallons per minute/flush
  connectionSize?: string;
  notes?: string;
  roomIds?: string[];        // Linked room IDs
}

export interface PlumbingFixtureSchedule {
  projectId: string;
  documentId?: string;
  fixtures: PlumbingFixture[];
  extractedAt: Date;
  totalFixtures: number;
  byType: Record<string, number>;
}

/**
 * Extract plumbing fixtures from document chunks using AI
 */
export async function extractPlumbingFixtures(
  projectId: string,
  documentId?: string
): Promise<PlumbingFixtureSchedule | null> {
  try {
    // Find plumbing schedule documents
    const whereClause: any = {
      projectId,
      OR: [
        { content: { contains: 'PLUMBING FIXTURE SCHEDULE', mode: 'insensitive' } },
        { content: { contains: 'FIXTURE SCHEDULE', mode: 'insensitive' } },
        { content: { contains: 'P-1', mode: 'insensitive' } },
        { content: { contains: 'LAVATORY', mode: 'insensitive' } },
        { content: { contains: 'WATER CLOSET', mode: 'insensitive' } },
      ]
    };

    if (documentId) {
      whereClause.documentId = documentId;
    }

    const chunks = await prisma.documentChunk.findMany({
      where: whereClause,
      orderBy: { pageNumber: 'asc' },
      take: 20,
    });

    if (chunks.length === 0) {
      logger.info('PLUMBING_FIXTURE', 'No plumbing schedule content found');
      return null;
    }

    const combinedContent = chunks.map(c => c.content).join('\n\n');

    const prompt = `Extract ALL plumbing fixtures from this schedule. Return JSON array:

${combinedContent}

For each fixture include:
- fixtureTag: Tag/mark (P-1, L-1, WC-1, etc.)
- fixtureType: Type (Lavatory, Water Closet, Urinal, Floor Drain, Sink, Shower, Tub, Hose Bibb, etc.)
- manufacturer: Brand name if specified
- model: Model number if specified
- quantity: Count of this fixture type
- location: Room/area if specified
- roughInHeight: Rough-in dimension if specified
- carrierRequired: true if wall-hung/carrier needed
- adaCompliant: true if ADA/accessible
- flushType: Manual, Sensor, etc.
- gpmGpf: Flow rate (GPM for faucets, GPF for flush fixtures)
- connectionSize: Pipe connection size
- notes: Any additional notes

Return ONLY valid JSON array, no markdown.`;

    const response = await getOpenAI().chat.completions.create({
      model: EXTRACTION_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || '[]';
    const cleaned = content.replace(/```json\n?|```\n?/g, '').trim();
    const fixtures: PlumbingFixture[] = JSON.parse(cleaned);

    // Add IDs and normalize
    const processedFixtures = fixtures.map((f, idx) => ({
      ...f,
      id: `plumb-${projectId}-${idx}`,
      quantity: f.quantity || 1,
      fixtureType: f.fixtureType || 'Unknown',
    }));

    // Calculate summary by type
    const byType: Record<string, number> = {};
    processedFixtures.forEach(f => {
      const type = f.fixtureType;
      byType[type] = (byType[type] || 0) + f.quantity;
    });

    const schedule: PlumbingFixtureSchedule = {
      projectId,
      documentId,
      fixtures: processedFixtures,
      extractedAt: new Date(),
      totalFixtures: processedFixtures.reduce((sum, f) => sum + f.quantity, 0),
      byType,
    };

    logger.info('PLUMBING_FIXTURE', 'Extracted fixture types', { fixtureTypes: processedFixtures.length, totalFixtures: schedule.totalFixtures });
    return schedule;
  } catch (error) {
    logger.error('PLUMBING_FIXTURE', 'Error extracting fixtures', error instanceof Error ? error : undefined);
    return null;
  }
}

/**
 * Get plumbing fixture context for RAG
 */
export async function getPlumbingFixtureContext(projectSlug: string): Promise<string | null> {
  try {
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true }
    });

    if (!project) return null;

    const schedule = await extractPlumbingFixtures(project.id);
    if (!schedule || schedule.fixtures.length === 0) return null;

    let context = `PLUMBING FIXTURE SCHEDULE (${schedule.totalFixtures} total fixtures):\n\n`;

    // Group by type
    const byType: Record<string, PlumbingFixture[]> = {};
    schedule.fixtures.forEach(f => {
      const type = f.fixtureType;
      if (!byType[type]) byType[type] = [];
      byType[type].push(f);
    });

    for (const [type, fixtures] of Object.entries(byType)) {
      const totalQty = fixtures.reduce((sum, f) => sum + f.quantity, 0);
      context += `${type.toUpperCase()} (${totalQty} total):\n`;
      
      fixtures.forEach(f => {
        context += `  - ${f.fixtureTag}: ${f.manufacturer || ''} ${f.model || ''} (Qty: ${f.quantity})`;
        if (f.adaCompliant) context += ' [ADA]';
        if (f.gpmGpf) context += ` [${f.gpmGpf}]`;
        if (f.location) context += ` @ ${f.location}`;
        context += '\n';
      });
      context += '\n';
    }

    return context;
  } catch (error) {
    logger.error('PLUMBING_FIXTURE', 'Context error', error instanceof Error ? error : undefined);
    return null;
  }
}

/**
 * Get fixtures formatted for submittal requirements
 */
export async function getPlumbingRequirements(projectId: string): Promise<{
  fixtures: Array<{
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
  const schedule = await extractPlumbingFixtures(projectId);
  if (!schedule) return { fixtures: [] };

  const fixtures = schedule.fixtures.map(f => ({
    productName: `${f.fixtureType}${f.model ? ` - ${f.model}` : ''}`,
    manufacturer: f.manufacturer,
    model: f.model,
    requiredQty: f.quantity,
    unit: 'EA',
    specSection: '22 40 00', // Plumbing Fixtures
    tradeCategory: 'plumbing',
    linkedSourceType: 'plumbing_schedule',
    linkedSourceIds: [f.id],
  }));

  return { fixtures };
}
