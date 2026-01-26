/**
 * Detail Callout & Cross-Reference System
 * 
 * Extracts detail callouts from construction drawings and builds
 * cross-reference graphs for navigation between related sheets.
 * 
 * Phase B.1 - Document Intelligence Roadmap
 */

import { prisma } from './db';
import { Prisma } from '@prisma/client';
import { callAbacusLLM } from './abacus-llm';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface DetailCallout {
  type: 'detail' | 'section' | 'elevation' | 'enlarged_plan' | 'isometric' | 'schedule';
  number: string;              // Detail number (e.g., "3", "A", "2A")
  sheetReference: string;      // Target sheet (e.g., "A-401", "S-201")
  sourceSheet: string;         // Sheet where callout appears
  sourceLocation?: string;     // Description of location (e.g., "Grid Line B/3")
  description?: string;        // Callout description
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;          // 0-1 extraction confidence
}

export interface CrossReference {
  fromSheet: string;
  toSheet: string;
  calloutType: string;
  calloutNumber: string;
  bidirectional: boolean;      // If target sheet references back
  confidence: number;
}

export interface CalloutGraph {
  nodes: Map<string, {
    sheetNumber: string;
    incomingRefs: number;
    outgoingRefs: number;
    callouts: DetailCallout[];
  }>;
  edges: CrossReference[];
}

// ============================================================================
// CALLOUT PATTERNS
// ============================================================================

const CALLOUT_PATTERNS = [
  // Standard detail callouts: "3/A-401", "2/S-201"
  /(?:detail|det\.?|dtl\.?)\s*#?([0-9A-Z]+)\s*\/\s*([A-Z]-?[0-9]+(?:\.[0-9]+)?)/gi,
  
  // Section references: "Section A-A", "SECT 2"
  /(?:section|sect\.?|sec\.?)\s*([A-Z0-9-]+)(?:\s*\/\s*([A-Z]-?[0-9]+))?/gi,
  
  // Elevation callouts: "Elevation 3/A-301"
  /(?:elevation|elev\.?)\s*#?([0-9A-Z]+)\s*\/\s*([A-Z]-?[0-9]+)/gi,
  
  // Enlarged plan references: "Enlarged Plan 1/A-102"
  /(?:enlarged plan|enl\. plan)\s*#?([0-9A-Z]+)\s*\/\s*([A-Z]-?[0-9]+)/gi,
  
  // Schedule references: "See Schedule on A-801"
  /(?:see schedule|schedule|sched\.?)\s*(?:on)?\s*([A-Z]-?[0-9]+)/gi,
  
  // Generic "See Detail" references
  /(?:see|refer to|ref\.?)\s+(?:detail|dtl|section|elev)\s*#?([0-9A-Z]+)\s*(?:on|@)?\s*(?:sheet)?\s*([A-Z]-?[0-9]+)?/gi,
  
  // Typical section: "1/A-401"
  /([0-9A-Z]+)\s*\/\s*([A-Z]-?[0-9]+(?:\.[0-9]+)?)/g,
];

// ============================================================================
// CORE EXTRACTION FUNCTIONS
// ============================================================================

/**
 * Extract detail callouts from text using pattern matching
 */
export function extractCalloutsFromText(text: string, sourceSheet: string): DetailCallout[] {
  const callouts: DetailCallout[] = [];
  const seen = new Set<string>();

  for (const pattern of CALLOUT_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(text)) !== null) {
      const [fullMatch, number, sheetRef] = match;
      
      // Skip if no sheet reference or same as source
      if (!sheetRef || sheetRef === sourceSheet) continue;
      
      // Create unique key to avoid duplicates
      const key = `${number}/${sheetRef}`;
      if (seen.has(key)) continue;
      seen.add(key);
      
      // Determine callout type from pattern
      const type = determineCalloutType(fullMatch.toLowerCase());
      
      callouts.push({
        type,
        number,
        sheetReference: normalizeSheetNumber(sheetRef),
        sourceSheet: normalizeSheetNumber(sourceSheet),
        description: fullMatch.trim(),
        confidence: 0.85, // Pattern-based confidence
      });
    }
  }

  return callouts;
}

/**
 * Extract callouts using GPT-4o Vision analysis
 */
export async function extractCalloutsWithVision(
  imageBase64: string,
  sheetNumber: string
): Promise<DetailCallout[]> {
  const prompt = `Analyze this construction drawing and extract ALL detail callouts and cross-references.

Look for:
1. Detail bubbles/circles with numbers and sheet references (e.g., "3/A-401")
2. Section cut symbols with labels (e.g., "Section A-A / Sheet S-201")
3. Elevation markers referencing other sheets
4. "See Detail" or "Refer to" notes
5. Schedule references
6. Enlarged plan callouts

For EACH callout found, provide:
- Type (detail/section/elevation/enlarged_plan/schedule)
- Number/label
- Target sheet reference
- Location description (e.g., "Near Grid B/3", "North Wall")
- Brief description

Return as JSON array:
{
  "callouts": [
    {
      "type": "detail",
      "number": "3",
      "sheetReference": "A-401",
      "sourceLocation": "Grid B/3 intersection",
      "description": "Roof parapet detail",
      "confidence": 0.95
    }
  ]
}`;

  try {
    const response = await callAbacusLLM(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${imageBase64}` }
            }
          ]
        }
      ],
      {
        response_format: { type: 'json_object' },
        max_tokens: 2000,
      }
    );

    // Strip markdown code blocks if present (Claude sometimes wraps JSON in ```json ... ```)
    let contentToParse = response.content;
    const jsonMatch = contentToParse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      contentToParse = jsonMatch[1].trim();
    }

    const result = JSON.parse(contentToParse);
    
    return (result.callouts || []).map((c: any) => ({
      type: c.type || 'detail',
      number: c.number || '',
      sheetReference: normalizeSheetNumber(c.sheetReference || ''),
      sourceSheet: normalizeSheetNumber(sheetNumber),
      sourceLocation: c.sourceLocation,
      description: c.description,
      boundingBox: c.boundingBox,
      confidence: c.confidence || 0.8,
    }));
  } catch (error) {
    console.error('Vision extraction failed:', error);
    return [];
  }
}

/**
 * Build cross-reference graph for a project
 */
export async function buildCalloutGraph(projectId: string): Promise<CalloutGraph> {
  // Fetch all callouts for the project
  const callouts = await prisma.detailCallout.findMany({
    where: { projectId },
    orderBy: { sourceSheet: 'asc' },
  });

  const nodes = new Map<string, {
    sheetNumber: string;
    incomingRefs: number;
    outgoingRefs: number;
    callouts: DetailCallout[];
  }>();

  const edges: CrossReference[] = [];

  // Build nodes
  for (const callout of callouts) {
    const sourceSheet = callout.sourceSheet;
    const targetSheet = callout.sheetReference;

    // Initialize source node
    if (!nodes.has(sourceSheet)) {
      nodes.set(sourceSheet, {
        sheetNumber: sourceSheet,
        incomingRefs: 0,
        outgoingRefs: 0,
        callouts: [],
      });
    }

    // Initialize target node
    if (!nodes.has(targetSheet)) {
      nodes.set(targetSheet, {
        sheetNumber: targetSheet,
        incomingRefs: 0,
        outgoingRefs: 0,
        callouts: [],
      });
    }

    // Add callout to source node
    nodes.get(sourceSheet)!.callouts.push(callout as any);
    nodes.get(sourceSheet)!.outgoingRefs++;
    nodes.get(targetSheet)!.incomingRefs++;

    // Create edge
    edges.push({
      fromSheet: sourceSheet,
      toSheet: targetSheet,
      calloutType: callout.type,
      calloutNumber: callout.number,
      bidirectional: false, // Will update in next pass
      confidence: callout.confidence,
    });
  }

  // Check for bidirectional references
  for (const edge of edges) {
    const reverseEdge = edges.find(
      e => e.fromSheet === edge.toSheet && e.toSheet === edge.fromSheet
    );
    if (reverseEdge) {
      edge.bidirectional = true;
      reverseEdge.bidirectional = true;
    }
  }

  return { nodes, edges };
}

/**
 * Find all sheets that reference a specific sheet
 */
export async function findReferencesToSheet(
  projectId: string,
  sheetNumber: string
): Promise<DetailCallout[]> {
  return await prisma.detailCallout.findMany({
    where: {
      projectId,
      sheetReference: normalizeSheetNumber(sheetNumber),
    },
    orderBy: { sourceSheet: 'asc' },
  }) as any;
}

/**
 * Find all sheets referenced from a specific sheet
 */
export async function findReferencesFromSheet(
  projectId: string,
  sheetNumber: string
): Promise<DetailCallout[]> {
  return await prisma.detailCallout.findMany({
    where: {
      projectId,
      sourceSheet: normalizeSheetNumber(sheetNumber),
    },
    orderBy: { sheetReference: 'asc' },
  }) as any;
}

/**
 * Validate cross-references and find broken links
 */
export async function validateCrossReferences(
  projectId: string
): Promise<{
  valid: number;
  broken: Array<{ callout: DetailCallout; reason: string }>;
  orphaned: string[]; // Sheets with no references in or out
}> {
  const callouts = await prisma.detailCallout.findMany({
    where: { projectId },
  });

  // Get all sheet numbers in project
  const sheets = await prisma.documentChunk.findMany({
    where: { Document: { projectId } },
    select: { sheetNumber: true },
    distinct: ['sheetNumber'],
  });

  const validSheets = new Set(
    sheets.map((s: any) => normalizeSheetNumber(s.sheetNumber || '')).filter(Boolean)
  );

  const broken: Array<{ callout: DetailCallout; reason: string }> = [];
  let valid = 0;

  // Check each callout
  for (const callout of callouts) {
    const targetSheet = normalizeSheetNumber(callout.sheetReference);
    
    if (!validSheets.has(targetSheet)) {
      broken.push({
        callout: callout as any,
        reason: `Target sheet ${targetSheet} not found in project`,
      });
    } else {
      valid++;
    }
  }

  // Find orphaned sheets (no references in or out)
  const referencedSheets = new Set<string>();
  callouts.forEach((c: any) => {
    referencedSheets.add(normalizeSheetNumber(c.sourceSheet));
    referencedSheets.add(normalizeSheetNumber(c.sheetReference));
  });

  const orphaned = (Array.from(validSheets) as string[]).filter((s: any) => !referencedSheets.has(s as string));

  return { valid, broken, orphaned };
}

/**
 * Store callouts in database
 */
export async function storeCallouts(
  projectId: string,
  documentId: string,
  sheetNumber: string,
  callouts: DetailCallout[]
): Promise<void> {
  // Delete existing callouts for this sheet
  await prisma.detailCallout.deleteMany({
    where: {
      projectId,
      sourceSheet: normalizeSheetNumber(sheetNumber),
    },
  });

  // Insert new callouts
  if (callouts.length > 0) {
    await prisma.detailCallout.createMany({
      data: callouts.map(c => ({
        projectId,
        documentId,
        sourceSheet: normalizeSheetNumber(c.sourceSheet),
        sheetReference: normalizeSheetNumber(c.sheetReference),
        type: c.type,
        number: c.number,
        sourceLocation: c.sourceLocation,
        description: c.description,
        boundingBox: c.boundingBox as any || undefined,
        confidence: c.confidence,
      })),
    });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function determineCalloutType(text: string): DetailCallout['type'] {
  if (text.includes('section') || text.includes('sect')) return 'section';
  if (text.includes('elevation') || text.includes('elev')) return 'elevation';
  if (text.includes('enlarged plan') || text.includes('enl')) return 'enlarged_plan';
  if (text.includes('schedule') || text.includes('sched')) return 'schedule';
  if (text.includes('isometric') || text.includes('iso')) return 'isometric';
  return 'detail';
}

function normalizeSheetNumber(sheet: string): string {
  return sheet.toUpperCase().replace(/\s+/g, '').replace(/^SHEET/, '');
}

/**
 * Get callout statistics for a project
 */
export async function getCalloutStats(projectId: string) {
  const [totalCallouts, uniqueSheets, byType] = await Promise.all([
    prisma.detailCallout.count({ where: { projectId } }),
    prisma.detailCallout.findMany({
      where: { projectId },
      select: { sourceSheet: true },
      distinct: ['sourceSheet'],
    }),
    prisma.detailCallout.groupBy({
      by: ['type'],
      where: { projectId },
      _count: true,
    }),
  ]);

  return {
    totalCallouts,
    sheetsWithCallouts: uniqueSheets.length,
    byType: byType.map((t: any) => ({ type: t.type, count: t._count })),
  };
}

/**
 * Get all callouts for a project
 */
export async function getProjectCallouts(projectId: string, filters?: {
  type?: string;
  validOnly?: boolean;
}) {
  const where: any = { projectId };
  
  if (filters?.type) {
    where.type = filters.type;
  }
  
  if (filters?.validOnly) {
    where.confidence = { gte: 0.7 };
  }
  
  const callouts = await prisma.detailCallout.findMany({
    where,
    orderBy: [
      { sourceSheet: 'asc' },
      { type: 'asc' },
      { number: 'asc' },
    ],
  });
  
  return callouts;
}

/**
 * Get callouts for a specific sheet
 */
export async function getSheetCallouts(projectId: string, sheetNumber: string) {
  const callouts = await prisma.detailCallout.findMany({
    where: {
      projectId,
      sourceSheet: sheetNumber,
    },
    orderBy: [
      { type: 'asc' },
      { number: 'asc' },
    ],
  });
  
  return callouts;
}

/**
 * Search callouts with advanced filters
 */
export async function searchCallouts(
  projectId: string,
  filters: {
    type?: string;
    targetSheet?: string;
    validOnly?: boolean;
    query?: string;
  }
) {
  const where: any = { projectId };
  
  if (filters.type) {
    where.type = filters.type;
  }
  
  if (filters.targetSheet) {
    where.sheetReference = filters.targetSheet;
  }
  
  if (filters.validOnly) {
    where.confidence = { gte: 0.7 };
  }
  
  if (filters.query) {
    where.OR = [
      { sourceSheet: { contains: filters.query, mode: 'insensitive' } },
      { sheetReference: { contains: filters.query, mode: 'insensitive' } },
      { description: { contains: filters.query, mode: 'insensitive' } },
      { sourceLocation: { contains: filters.query, mode: 'insensitive' } },
    ];
  }
  
  const callouts = await prisma.detailCallout.findMany({
    where,
    orderBy: [
      { sourceSheet: 'asc' },
      { type: 'asc' },
    ],
  });
  
  return callouts;
}
