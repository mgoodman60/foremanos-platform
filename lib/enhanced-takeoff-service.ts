/**
 * Enhanced Takeoff Service with Vision AI and Confidence Scoring
 * 
 * This module provides accurate material quantity extraction using:
 * - Direct vision analysis of plan images
 * - Multi-source cross-validation
 * - Intelligent confidence scoring
 * - Scale-aware calculations
 */

import { prisma } from './db';
import { callAbacusLLM } from './abacus-llm';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createS3Client, getBucketConfig } from './aws-config';

// Confidence scoring factors
const CONFIDENCE_FACTORS = {
  EXPLICIT_DIMENSION: 25,      // Dimension clearly shown on drawing
  SCHEDULE_MATCH: 20,          // Matches entry in schedule
  SPECIFICATION_MATCH: 15,     // Matches specification document
  CROSS_SHEET_VERIFIED: 15,    // Same info on multiple sheets
  SCALE_VERIFIED: 10,          // Scale confirmed and applied
  CALCULATION_SHOWN: 10,       // Calculation method documented
  AI_HIGH_CONFIDENCE: 5,       // AI reports high confidence
};

// Minimum confidence thresholds
const CONFIDENCE_THRESHOLDS = {
  AUTO_APPROVE: 90,
  NEEDS_REVIEW: 70,
  LOW_CONFIDENCE: 50,
  REJECT: 30,
};

export interface EnhancedTakeoffItem {
  itemName: string;
  description?: string;
  quantity: number;
  unit: string;
  category: string;
  location?: string;
  sheetNumber?: string;
  gridLocation?: string;
  notes?: string;
  confidence: number;
  confidenceBreakdown: ConfidenceBreakdown;
  extractedFrom: string;
  calculationMethod?: string;
  verificationStatus: 'auto_approved' | 'needs_review' | 'low_confidence' | 'rejected';
  sources: TakeoffSource[];
  scaleUsed?: string;
}

export interface ConfidenceBreakdown {
  factors: { name: string; score: number; reason: string }[];
  totalScore: number;
  warnings: string[];
  suggestions: string[];
}

export interface TakeoffSource {
  type: 'plan' | 'schedule' | 'specification' | 'detail';
  documentId: string;
  documentName: string;
  pageNumber?: number;
  sheetNumber?: string;
  extractedValue: string;
}

interface VisionExtractionResult {
  items: RawTakeoffItem[];
  scaleDetected?: string;
  sheetType?: string;
  warnings: string[];
}

interface RawTakeoffItem {
  itemName: string;
  quantity: number;
  unit: string;
  category: string;
  location?: string;
  sheetNumber?: string;
  extractedFrom: string;
  calculationMethod?: string;
  dimensionsUsed?: string[];
  aiConfidence: number;
}

/**
 * Enhanced quantity extraction with vision analysis
 */
export async function extractTakeoffsWithVision(
  projectId: string,
  documentId: string,
  userId: string,
  options: {
    useVision?: boolean;
    crossValidate?: boolean;
    includeSchedules?: boolean;
  } = {}
): Promise<EnhancedTakeoffItem[]> {
  const { 
    useVision = true, 
    crossValidate = true,
    includeSchedules = true 
  } = options;

  console.log(`[ENHANCED-TAKEOFF] Starting extraction for document ${documentId}`);

  // Get the document and its chunks
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      Project: true,
    },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  // Get document chunks with page images
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId },
    orderBy: { pageNumber: 'asc' },
    include: {
      Document: {
        select: {
          cloud_storage_path: true,
        },
      },
    },
  });

  if (chunks.length === 0) {
    throw new Error('Document has not been processed for extraction');
  }

  // Get all project documents for cross-validation
  const projectDocuments = crossValidate ? await prisma.document.findMany({
    where: { projectId },
    include: {
      DocumentChunk: {
        take: 5, // First 5 chunks per doc for metadata
      },
    },
  }) : [];

  // Collect all extracted items
  const allItems: RawTakeoffItem[] = [];
  const sources: Map<string, TakeoffSource[]> = new Map();
  const warnings: string[] = [];

  // Get project scale information
  const scaleInfo = await getProjectScaleInfo(projectId);

  // Process each page with vision if available
  for (const chunk of chunks) {
    const metadata = chunk.metadata as Record<string, unknown> | null;
    const pageNum = chunk.pageNumber || 0;

    console.log(`[ENHANCED-TAKEOFF] Processing page ${pageNum}`);

    let extractionResult: VisionExtractionResult;
    const cloudStoragePath = (chunk as { Document?: { cloud_storage_path?: string | null } }).Document?.cloud_storage_path;

    if (useVision && cloudStoragePath) {
      // Use vision AI on actual page image
      extractionResult = await extractWithVisionAI(
        cloudStoragePath,
        chunk.content || '',
        metadata,
        scaleInfo,
        pageNum
      );
    } else {
      // Fall back to text-based extraction
      extractionResult = await extractFromText(
        chunk.content || '',
        metadata,
        scaleInfo,
        pageNum
      );
    }

    // Store results and sources
    for (const item of extractionResult.items) {
      const key = normalizeItemKey(item);
      const source: TakeoffSource = {
        type: detectSourceType(metadata),
        documentId,
        documentName: document.name,
        pageNumber: pageNum,
        sheetNumber: item.sheetNumber || (metadata as Record<string, unknown>)?.sheet_number as string,
        extractedValue: `${item.quantity} ${item.unit}`,
      };

      if (!sources.has(key)) {
        sources.set(key, []);
      }
      sources.get(key)!.push(source);
      allItems.push(item);
    }

    warnings.push(...extractionResult.warnings);
  }

  // Cross-validate with schedules if enabled
  let scheduleData: Map<string, ScheduleEntry> = new Map();
  if (includeSchedules) {
    scheduleData = await getScheduleData(projectId);
  }

  // Cross-validate with specifications
  const specData = crossValidate ? await getSpecificationData(projectId) : new Map();

  // Group and deduplicate items
  const groupedItems = groupAndDeduplicateItems(allItems);

  // Calculate confidence for each item
  const enhancedItems: EnhancedTakeoffItem[] = [];

  for (const [key, items] of groupedItems) {
    const primaryItem = items[0];
    const itemSources = sources.get(key) || [];

    // Calculate confidence
    const confidenceResult = calculateConfidence(
      primaryItem,
      items,
      itemSources,
      scheduleData,
      specData,
      scaleInfo
    );

    // Determine verification status
    const verificationStatus = getVerificationStatus(confidenceResult.totalScore);

    // Build enhanced item
    enhancedItems.push({
      itemName: primaryItem.itemName,
      description: generateDescription(primaryItem, items),
      quantity: calculateBestQuantity(items),
      unit: primaryItem.unit,
      category: primaryItem.category,
      location: primaryItem.location,
      sheetNumber: primaryItem.sheetNumber,
      notes: generateNotes(items, confidenceResult),
      confidence: confidenceResult.totalScore,
      confidenceBreakdown: confidenceResult,
      extractedFrom: primaryItem.extractedFrom,
      calculationMethod: primaryItem.calculationMethod,
      verificationStatus,
      sources: itemSources,
      scaleUsed: scaleInfo.primaryScale,
    });
  }

  // Sort by confidence (lowest first for review)
  enhancedItems.sort((a, b) => a.confidence - b.confidence);

  console.log(`[ENHANCED-TAKEOFF] Extracted ${enhancedItems.length} items`);
  console.log(`[ENHANCED-TAKEOFF] Auto-approved: ${enhancedItems.filter(i => i.verificationStatus === 'auto_approved').length}`);
  console.log(`[ENHANCED-TAKEOFF] Needs review: ${enhancedItems.filter(i => i.verificationStatus === 'needs_review').length}`);
  console.log(`[ENHANCED-TAKEOFF] Low confidence: ${enhancedItems.filter(i => i.verificationStatus === 'low_confidence').length}`);

  return enhancedItems;
}

/**
 * Extract quantities using vision AI on actual plan images
 */
async function extractWithVisionAI(
  cloudStoragePath: string,
  textContent: string,
  metadata: Record<string, unknown> | null,
  scaleInfo: ScaleInfo,
  pageNumber: number
): Promise<VisionExtractionResult> {
  try {
    // Fetch the image from S3
    const imageBase64 = await fetchImageAsBase64(cloudStoragePath);
    
    if (!imageBase64) {
      console.log(`[ENHANCED-TAKEOFF] Could not fetch image, falling back to text extraction`);
      return extractFromText(textContent, metadata, scaleInfo, pageNumber);
    }

    const sheetNumber = (metadata?.sheet_number as string) || `Page ${pageNumber}`;
    const sheetType = detectSheetType(metadata, textContent);

    // Build vision prompt
    const prompt = buildVisionExtractionPrompt(sheetType, scaleInfo, textContent, metadata);

    const messages = [
      {
        role: 'user' as const,
        content: [
          {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: 'image/png' as const,
              data: imageBase64,
            },
          },
          {
            type: 'text' as const,
            text: prompt,
          },
        ],
      },
    ];

    const response = await callAbacusLLM(messages, {
      model: 'claude-sonnet-4-20250514',
      temperature: 0.1,
      max_tokens: 4000,
    });

    return parseVisionResponse(response.content, sheetNumber, pageNumber);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ENHANCED-TAKEOFF] Vision extraction failed:`, errorMessage);
    return extractFromText(textContent, metadata, scaleInfo, pageNumber);
  }
}

/**
 * Build the vision extraction prompt
 */
function buildVisionExtractionPrompt(
  sheetType: string,
  scaleInfo: ScaleInfo,
  textContent: string,
  metadata: Record<string, unknown> | null
): string {
  return `You are an expert construction estimator performing a comprehensive quantity takeoff from this ${sheetType} drawing.

## Drawing Scale Information:
${scaleInfo.primaryScale ? `Primary Scale: ${scaleInfo.primaryScale}` : 'Scale not confirmed - USE EXTREME CAUTION with measurements'}
${scaleInfo.scaleRatio ? `Scale Ratio: 1" = ${scaleInfo.scaleRatio}'` : ''}

## Your Task:
Extract ALL measurable quantities from this drawing with HIGH PRECISION. Be thorough - capture EVERYTHING visible.

## Critical Instructions:
1. ONLY extract quantities you can DIRECTLY measure or calculate from dimensions shown
2. For EACH item, provide your calculation method showing the math
3. Apply the drawing scale to convert drawing measurements to real dimensions
4. Assign a confidence score (0-100) based on:
   - 90-100: Dimension clearly labeled with units
   - 75-89: Dimension readable but needs scale conversion
   - 50-74: Dimension estimated from drawing proportions
   - Below 50: Quantity uncertain or assumed
5. Flag items where you had to estimate or make assumptions
6. Extract COUNTS of equipment, fixtures, symbols shown on plan

## OCR Text for Reference:
${textContent.substring(0, 2000)}

## COMPREHENSIVE EXTRACTION CATEGORIES:

### STRUCTURAL (CSI 03-06)
- **Concrete**: Slabs on grade, footings, foundation walls, columns, beams, elevated slabs, curbs/pads, formwork (CY, SFCA)
- **Rebar/Reinforcing**: #3-#11 bars, welded wire fabric, dowels (TON, SF, EA)
- **Masonry**: CMU block, brick, grout fill (SF, CF)
- **Structural Steel**: Wide flange beams, tube steel, angles, channels, metal deck (TON, LF, SF)
- **Wood/Lumber**: Studs, joists, rafters, trusses, beams (LVL/glulam), sheathing, blocking (LF, EA, SF)

### MEP - MECHANICAL (CSI 23)
- **HVAC Ductwork**: Rectangular duct, spiral/round duct (LBS, LF)
- **HVAC Equipment**: AHUs, RTUs, VAV boxes, exhaust fans - COUNT ALL EQUIPMENT SHOWN (EA)
- **Diffusers/Grilles**: All supply/return diffusers, registers, louvers (EA)
- **Duct Insulation**: Wrapped ducts, lined ducts (SF)

### MEP - PLUMBING (CSI 22)
- **Piping**: Copper, PVC/CPVC, cast iron - note diameter (LF)
- **Fixtures**: Toilets, sinks, lavatories, urinals, floor drains - COUNT ALL (EA)
- **Equipment**: Water heaters, pumps, tanks (EA)
- **Valves**: Gate, ball, check valves (EA)

### MEP - ELECTRICAL (CSI 26)
- **Conduit**: EMT, rigid, PVC, flex - note size (LF)
- **Wire/Cable**: THHN, MC cable (LF)
- **Panels**: Panelboards, switchboards, transformers - COUNT ALL (EA)
- **Devices**: Receptacles, switches, sensors - COUNT ALL (EA)
- **Lighting**: All light fixtures shown - COUNT EACH TYPE (EA)
- **Fire Alarm**: Smoke detectors, pull stations, horn/strobes (EA)

### FINISHES (CSI 09)
- **Drywall/Framing**: Metal studs, track, gypsum board, finishing (LF, SF)
- **Flooring**: Carpet, VCT, LVP, ceramic tile, hardwood, polished concrete, wall base (SF, SY, LF)
- **Ceilings**: ACT, ceiling grid, gypsum ceiling (SF)
- **Wall Finishes**: Paint, wall tile, wallcovering, FRP (SF)

### DOORS & WINDOWS (CSI 08)
- **Doors**: Hollow metal, wood, specialty - COUNT WITH SIZES (EA)
- **Hardware**: Locksets, closers, hinges (SET)
- **Windows**: Aluminum, curtain wall, glass (SF, EA)

### ROOFING & INSULATION (CSI 07)
- **Roofing**: Membrane (TPO/EPDM/PVC), built-up, metal, shingles (SQ)
- **Roof Insulation**: Polyiso, tapered insulation (SF)
- **Flashing**: Drip edge, counter flashing (LF)
- **Wall Insulation**: Batt, spray foam, rigid, blown-in (SF)

### SITEWORK (CSI 31-33)
- **Earthwork**: Excavation, backfill, grading, import/export (CY, SY)
- **Paving**: Asphalt, concrete, pavers, base course, striping (SY, SF, LF)
- **Site Utilities**: Storm pipe, sanitary sewer, water main (LF)
- **Structures**: Manholes, catch basins, fire hydrants (EA)

## Output Format (JSON):
{
  "items": [
    {
      "itemName": "4\" Concrete Slab on Grade",
      "quantity": 148.5,
      "unit": "CY",
      "category": "concrete",
      "subCategory": "slab-on-grade",
      "location": "Building Foundation",
      "extractedFrom": "Foundation Plan dimensions 80' x 50' x 4\"",
      "calculationMethod": "80' × 50' × (4/12)' ÷ 27 = 148.5 CY",
      "dimensionsUsed": ["80'-0\"", "50'-0\"", "4\" THK"],
      "aiConfidence": 92
    },
    {
      "itemName": "2x4 VAV Terminal Units",
      "quantity": 12,
      "unit": "EA",
      "category": "hvac",
      "subCategory": "vav",
      "location": "Ceiling Plenum",
      "extractedFrom": "Counted from mechanical plan symbols",
      "calculationMethod": "Direct count of VAV symbols on plan",
      "aiConfidence": 95
    }
  ],
  "scaleDetected": "1/4\" = 1'-0\"",
  "sheetType": "${sheetType}",
  "warnings": ["North wall dimension unclear - estimated from grid spacing"],
  "equipmentCounts": {
    "ahu": 2,
    "vav": 12,
    "exhaustFans": 4,
    "lightFixtures": 45,
    "receptacles": 32
  }
}

Return ONLY valid JSON.`;
}

/**
 * Extract from text content (fallback when vision not available)
 */
async function extractFromText(
  textContent: string,
  metadata: Record<string, unknown> | null,
  scaleInfo: ScaleInfo,
  pageNumber: number
): Promise<VisionExtractionResult> {
  const items: RawTakeoffItem[] = [];
  const warnings: string[] = [];

  // Extract from labeled dimensions in metadata
  if (metadata?.labeled_dimensions && Array.isArray(metadata.labeled_dimensions)) {
    for (const dim of metadata.labeled_dimensions as string[]) {
      const parsed = parseDimension(dim, metadata, scaleInfo);
      if (parsed) {
        items.push(parsed);
      }
    }
  }

  // Extract from notes
  if (metadata?.notes && Array.isArray(metadata.notes)) {
    for (const note of metadata.notes as string[]) {
      const parsed = parseQuantityNote(note, metadata);
      if (parsed) {
        items.push(parsed);
      }
    }
  }

  // Extract from structural callouts
  if (metadata?.structuralCallouts && Array.isArray(metadata.structuralCallouts)) {
    for (const callout of metadata.structuralCallouts as string[]) {
      const parsed = parseStructuralCallout(callout, metadata);
      if (parsed) {
        items.push(parsed);
      }
    }
  }

  // Use AI for text analysis if we have substantial content
  if (textContent.length > 200 && items.length < 3) {
    const aiItems = await extractWithTextAI(textContent, metadata, scaleInfo);
    items.push(...aiItems);
    if (aiItems.length === 0) {
      warnings.push('AI text extraction found no quantifiable items');
    }
  }

  // Add warning if using text-only extraction
  if (!metadata?.labeled_dimensions) {
    warnings.push('No dimension labels found - quantities may be incomplete');
  }

  return {
    items,
    sheetType: detectSheetType(metadata, textContent),
    warnings,
  };
}

/**
 * Use AI for text-only analysis
 */
async function extractWithTextAI(
  textContent: string,
  metadata: Record<string, unknown> | null,
  scaleInfo: ScaleInfo
): Promise<RawTakeoffItem[]> {
  const prompt = `Extract material quantities from this construction document text. Only include items with explicit quantities or dimensions.

Text content:
${textContent.substring(0, 3000)}

${metadata?.dimensions ? `Dimensions found: ${JSON.stringify(metadata.dimensions)}` : ''}
${scaleInfo.primaryScale ? `Scale: ${scaleInfo.primaryScale}` : ''}

Return JSON array of items:
[
  {
    "itemName": "Item name",
    "quantity": 100,
    "unit": "SF",
    "category": "category",
    "extractedFrom": "source text",
    "aiConfidence": 70
  }
]

Return ONLY the JSON array.`;

  try {
    const response = await callAbacusLLM(
      [{ role: 'user', content: prompt }],
      { model: 'claude-sonnet-4-20250514', temperature: 0.1, max_tokens: 2000 }
    );

    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return Array.isArray(parsed) ? parsed.map((item: RawTakeoffItem) => ({
        ...item,
        aiConfidence: Math.min(item.aiConfidence || 60, 75), // Cap text-only at 75
      })) : [];
    }
  } catch (error) {
    console.error('[ENHANCED-TAKEOFF] Text AI extraction failed:', error);
  }

  return [];
}

/**
 * Calculate confidence score for an item
 */
function calculateConfidence(
  primaryItem: RawTakeoffItem,
  allItems: RawTakeoffItem[],
  sources: TakeoffSource[],
  scheduleData: Map<string, ScheduleEntry>,
  specData: Map<string, SpecEntry>,
  scaleInfo: ScaleInfo
): ConfidenceBreakdown {
  const factors: { name: string; score: number; reason: string }[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let totalScore = 0;

  // Factor 1: AI base confidence
  const aiConfidence = primaryItem.aiConfidence || 50;
  if (aiConfidence >= 85) {
    factors.push({ name: 'AI Extraction', score: CONFIDENCE_FACTORS.AI_HIGH_CONFIDENCE, reason: `AI confidence: ${aiConfidence}%` });
    totalScore += CONFIDENCE_FACTORS.AI_HIGH_CONFIDENCE;
  }

  // Factor 2: Explicit dimension found
  if (primaryItem.dimensionsUsed && primaryItem.dimensionsUsed.length > 0) {
    factors.push({ name: 'Explicit Dimensions', score: CONFIDENCE_FACTORS.EXPLICIT_DIMENSION, reason: `Dimensions: ${primaryItem.dimensionsUsed.join(', ')}` });
    totalScore += CONFIDENCE_FACTORS.EXPLICIT_DIMENSION;
  } else {
    warnings.push('No explicit dimensions found - quantity may be estimated');
    suggestions.push('Verify quantity against plan dimensions');
  }

  // Factor 3: Cross-sheet verification
  const uniqueSheets = new Set(sources.map(s => s.sheetNumber).filter(Boolean));
  if (uniqueSheets.size >= 2) {
    factors.push({ name: 'Cross-Sheet Verified', score: CONFIDENCE_FACTORS.CROSS_SHEET_VERIFIED, reason: `Found on ${uniqueSheets.size} sheets: ${Array.from(uniqueSheets).join(', ')}` });
    totalScore += CONFIDENCE_FACTORS.CROSS_SHEET_VERIFIED;
  }

  // Factor 4: Schedule match
  const scheduleKey = normalizeForScheduleLookup(primaryItem.itemName, primaryItem.category);
  const scheduleMatch = scheduleData.get(scheduleKey);
  if (scheduleMatch) {
    const quantityMatch = Math.abs(scheduleMatch.quantity - primaryItem.quantity) / Math.max(scheduleMatch.quantity, 1) < 0.1;
    if (quantityMatch) {
      factors.push({ name: 'Schedule Match', score: CONFIDENCE_FACTORS.SCHEDULE_MATCH, reason: `Matches schedule: ${scheduleMatch.quantity} ${scheduleMatch.unit}` });
      totalScore += CONFIDENCE_FACTORS.SCHEDULE_MATCH;
    } else {
      warnings.push(`Schedule shows ${scheduleMatch.quantity} ${scheduleMatch.unit} vs extracted ${primaryItem.quantity} ${primaryItem.unit}`);
      suggestions.push('Reconcile with schedule data');
    }
  }

  // Factor 5: Specification match
  const specMatch = specData.get(primaryItem.category);
  if (specMatch && specMatch.materials.some(m => primaryItem.itemName.toLowerCase().includes(m.toLowerCase()))) {
    factors.push({ name: 'Specification Match', score: CONFIDENCE_FACTORS.SPECIFICATION_MATCH, reason: 'Material type matches specifications' });
    totalScore += CONFIDENCE_FACTORS.SPECIFICATION_MATCH;
  }

  // Factor 6: Scale verification
  if (scaleInfo.verified && primaryItem.calculationMethod?.includes(scaleInfo.primaryScale || '')) {
    factors.push({ name: 'Scale Verified', score: CONFIDENCE_FACTORS.SCALE_VERIFIED, reason: `Scale ${scaleInfo.primaryScale} verified and applied` });
    totalScore += CONFIDENCE_FACTORS.SCALE_VERIFIED;
  } else if (!scaleInfo.verified) {
    warnings.push('Drawing scale not verified - measurements may be inaccurate');
    suggestions.push('Confirm scale from drawing title block');
  }

  // Factor 7: Calculation method provided
  if (primaryItem.calculationMethod && primaryItem.calculationMethod.length > 10) {
    factors.push({ name: 'Calculation Documented', score: CONFIDENCE_FACTORS.CALCULATION_SHOWN, reason: primaryItem.calculationMethod });
    totalScore += CONFIDENCE_FACTORS.CALCULATION_SHOWN;
  }

  // Add base AI confidence score (scaled)
  const scaledAiScore = Math.round((aiConfidence / 100) * 30); // Max 30 points from AI
  totalScore += scaledAiScore;

  // Cap at 100
  totalScore = Math.min(totalScore, 100);

  return {
    factors,
    totalScore,
    warnings,
    suggestions,
  };
}

/**
 * Get verification status based on confidence score
 */
function getVerificationStatus(score: number): EnhancedTakeoffItem['verificationStatus'] {
  if (score >= CONFIDENCE_THRESHOLDS.AUTO_APPROVE) return 'auto_approved';
  if (score >= CONFIDENCE_THRESHOLDS.NEEDS_REVIEW) return 'needs_review';
  if (score >= CONFIDENCE_THRESHOLDS.LOW_CONFIDENCE) return 'low_confidence';
  return 'rejected';
}

// Helper functions

interface ScaleInfo {
  primaryScale?: string;
  scaleRatio?: number;
  verified: boolean;
  multipleScales: boolean;
}

interface ScheduleEntry {
  quantity: number;
  unit: string;
  material: string;
}

interface SpecEntry {
  materials: string[];
  requirements: string[];
}

async function getProjectScaleInfo(projectId: string): Promise<ScaleInfo> {
  // First get all chunks for this project, then filter for those with scale data
  const allChunks = await prisma.documentChunk.findMany({
    where: {
      Document: { projectId },
    },
    take: 50,
  });
  
  const scaleChunks = allChunks.filter((c: { scaleData: unknown }) => c.scaleData !== null);

  const scales = scaleChunks
    .map((c: { scaleData: unknown }) => (c.scaleData as Record<string, unknown>)?.scale as string)
    .filter(Boolean);

  const uniqueScales = [...new Set(scales)];

  return {
    primaryScale: uniqueScales[0] as string | undefined,
    scaleRatio: parseScaleRatio(uniqueScales[0] as string | undefined),
    verified: scales.length > 0,
    multipleScales: uniqueScales.length > 1,
  };
}

/**
 * Safely parse a fraction string like "1/4" or "3/8" without eval()
 */
function parseFraction(str: string): number {
  const trimmed = str.trim();
  if (trimmed.includes('/')) {
    const [num, denom] = trimmed.split('/').map(s => parseFloat(s.trim()));
    return denom !== 0 ? num / denom : 0;
  }
  return parseFloat(trimmed) || 0;
}

function parseScaleRatio(scale?: string): number | undefined {
  if (!scale) return undefined;
  // Parse scales like "1/4" = 1'-0"", "1" = 20'-0""
  const match = scale.match(/(\d+(?:\/\d+)?)["']?\s*=\s*(\d+)['-]/);
  if (match) {
    const left = parseFraction(match[1]); // e.g., 1/4 = 0.25 (safe parsing)
    const right = parseFloat(match[2]); // e.g., 1
    return left > 0 ? right / left : undefined; // feet per inch
  }
  return undefined;
}

async function getScheduleData(projectId: string): Promise<Map<string, ScheduleEntry>> {
  const scheduleMap = new Map<string, ScheduleEntry>();
  
  // Get finish schedules
  const finishItems = await prisma.finishScheduleItem.findMany({
    where: { Room: { Project: { id: projectId } } },
    include: { Room: true },
  });

  for (const item of finishItems) {
    const key = normalizeForScheduleLookup(item.material || '', item.category);
    const existing = scheduleMap.get(key);
    const area = item.Room.area || 0;
    
    if (existing) {
      existing.quantity += area;
    } else {
      scheduleMap.set(key, {
        quantity: area,
        unit: 'SF',
        material: item.material || '',
      });
    }
  }

  return scheduleMap;
}

async function getSpecificationData(projectId: string): Promise<Map<string, SpecEntry>> {
  const specMap = new Map<string, SpecEntry>();
  
  // Get specification documents
  const specDocs = await prisma.document.findMany({
    where: {
      projectId,
      OR: [
        { name: { contains: 'spec', mode: 'insensitive' } },
        { category: 'specifications' },
      ],
    },
  });

  for (const doc of specDocs) {
    // Fetch chunks for this document
    const chunks = await prisma.documentChunk.findMany({
      where: { documentId: doc.id },
      take: 3,
    });
    
    for (const chunk of chunks) {
      const content = chunk.content?.toLowerCase() || '';
      
      // Extract material references
      if (content.includes('concrete')) {
        const existing = specMap.get('concrete') || { materials: [], requirements: [] };
        existing.materials.push('concrete', 'cement', 'rebar');
        specMap.set('concrete', existing);
      }
      // Add more categories as needed
    }
  }

  return specMap;
}

function normalizeItemKey(item: RawTakeoffItem): string {
  return `${item.category}-${item.itemName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${item.unit}`;
}

function normalizeForScheduleLookup(name: string, category: string): string {
  return `${category.toLowerCase()}-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

function detectSourceType(metadata: Record<string, unknown> | null): TakeoffSource['type'] {
  const sheetNum = (metadata?.sheet_number as string)?.toUpperCase() || '';
  if (sheetNum.startsWith('A')) return 'plan';
  if (sheetNum.startsWith('S')) return 'plan';
  if (sheetNum.match(/SCHEDULE/i)) return 'schedule';
  if (sheetNum.match(/DETAIL/i)) return 'detail';
  return 'plan';
}

function detectSheetType(metadata: Record<string, unknown> | null, content: string): string {
  const sheetNum = (metadata?.sheet_number as string)?.toUpperCase() || '';
  const lowerContent = content.toLowerCase();
  
  if (sheetNum.startsWith('A1') || lowerContent.includes('floor plan')) return 'Architectural Floor Plan';
  if (sheetNum.startsWith('A2') || lowerContent.includes('elevation')) return 'Architectural Elevation';
  if (sheetNum.startsWith('S') || lowerContent.includes('structural')) return 'Structural Plan';
  if (sheetNum.startsWith('E') || lowerContent.includes('electrical')) return 'Electrical Plan';
  if (sheetNum.startsWith('P') || lowerContent.includes('plumbing')) return 'Plumbing Plan';
  if (sheetNum.startsWith('M') || lowerContent.includes('mechanical') || lowerContent.includes('hvac')) return 'Mechanical Plan';
  if (lowerContent.includes('site') || lowerContent.includes('civil')) return 'Site Plan';
  
  return 'Construction Drawing';
}

function groupAndDeduplicateItems(items: RawTakeoffItem[]): Map<string, RawTakeoffItem[]> {
  const groups = new Map<string, RawTakeoffItem[]>();
  
  for (const item of items) {
    const key = normalizeItemKey(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }
  
  return groups;
}

function calculateBestQuantity(items: RawTakeoffItem[]): number {
  if (items.length === 1) return items[0].quantity;
  
  // Weight by confidence
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const item of items) {
    const weight = item.aiConfidence || 50;
    weightedSum += item.quantity * weight;
    totalWeight += weight;
  }
  
  return Math.round(weightedSum / totalWeight * 100) / 100;
}

function generateDescription(primary: RawTakeoffItem, all: RawTakeoffItem[]): string {
  const parts: string[] = [];
  if (primary.location) parts.push(`Location: ${primary.location}`);
  if (primary.calculationMethod) parts.push(`Calc: ${primary.calculationMethod}`);
  if (all.length > 1) parts.push(`Aggregated from ${all.length} sources`);
  return parts.join(' | ');
}

function generateNotes(items: RawTakeoffItem[], confidence: ConfidenceBreakdown): string {
  const notes: string[] = [];
  
  if (confidence.warnings.length > 0) {
    notes.push(`⚠️ ${confidence.warnings[0]}`);
  }
  
  if (items.length > 1) {
    const quantities = items.map(i => i.quantity);
    const variance = Math.max(...quantities) - Math.min(...quantities);
    if (variance > 0.1 * Math.min(...quantities)) {
      notes.push(`📊 Quantity variance: ${Math.min(...quantities).toFixed(1)} - ${Math.max(...quantities).toFixed(1)}`);
    }
  }
  
  return notes.join(' | ');
}

async function fetchImageAsBase64(cloudStoragePath: string): Promise<string | null> {
  try {
    const s3 = createS3Client();
    const { bucketName } = getBucketConfig();
    
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: cloudStoragePath,
    });
    
    const response = await s3.send(command);
    const chunks: Uint8Array[] = [];
    
    if (response.Body) {
      const stream = response.Body as AsyncIterable<Uint8Array>;
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
    }
    
    const buffer = Buffer.concat(chunks);
    return buffer.toString('base64');
  } catch (error) {
    console.error('[ENHANCED-TAKEOFF] Failed to fetch image:', error);
    return null;
  }
}

function parseVisionResponse(response: string, sheetNumber: string, pageNumber: number): VisionExtractionResult {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { items: [], warnings: ['Failed to parse AI response'] };
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    const items: RawTakeoffItem[] = (parsed.items || []).map((item: RawTakeoffItem) => ({
      ...item,
      sheetNumber: item.sheetNumber || sheetNumber,
    }));
    
    return {
      items,
      scaleDetected: parsed.scaleDetected,
      sheetType: parsed.sheetType,
      warnings: parsed.warnings || [],
    };
  } catch (error) {
    console.error('[ENHANCED-TAKEOFF] Failed to parse vision response:', error);
    return { items: [], warnings: ['Failed to parse AI vision response'] };
  }
}

function parseDimension(dim: string, metadata: Record<string, unknown> | null, scaleInfo: ScaleInfo): RawTakeoffItem | null {
  const match = dim.match(/([\d.]+)['"]?\s*[x×]\s*([\d.]+)['"]?/i);
  if (!match) return null;
  
  const length = parseFloat(match[1]);
  const width = parseFloat(match[2]);
  const area = length * width;
  
  return {
    itemName: `Area: ${length}' x ${width}'`,
    quantity: area,
    unit: 'SF',
    category: 'general',
    sheetNumber: metadata?.sheet_number as string,
    extractedFrom: dim,
    calculationMethod: `${length}' × ${width}' = ${area} SF`,
    dimensionsUsed: [dim],
    aiConfidence: 70,
  };
}

function parseQuantityNote(note: string, metadata: Record<string, unknown> | null): RawTakeoffItem | null {
  const match = note.match(/([\d,]+\.?\d*)\s*(EA|LF|SF|CY|TON|LBS)/i);
  if (!match) return null;
  
  return {
    itemName: note.replace(match[0], '').trim() || 'Material',
    quantity: parseFloat(match[1].replace(/,/g, '')),
    unit: match[2].toUpperCase(),
    category: 'general',
    sheetNumber: metadata?.sheet_number as string,
    extractedFrom: note,
    aiConfidence: 80,
  };
}

function parseStructuralCallout(callout: string, metadata: Record<string, unknown> | null): RawTakeoffItem | null {
  // Rebar: #4 @ 12" O.C.
  const rebarMatch = callout.match(/#(\d+)\s*@\s*([\d]+)["']?\s*O\.?C\.?/i);
  if (rebarMatch) {
    return {
      itemName: `#${rebarMatch[1]} Rebar @ ${rebarMatch[2]}" O.C.`,
      quantity: 1,
      unit: 'TON',
      category: 'steel',
      sheetNumber: metadata?.sheet_number as string,
      extractedFrom: callout,
      aiConfidence: 85,
    };
  }
  
  return null;
}

/**
 * Save enhanced takeoff items to database
 */
export async function saveEnhancedTakeoff(
  projectId: string,
  documentId: string,
  userId: string,
  items: EnhancedTakeoffItem[],
  name?: string
): Promise<string> {
  const takeoff = await prisma.materialTakeoff.create({
    data: {
      name: name || `Enhanced Takeoff - ${new Date().toLocaleDateString()}`,
      projectId,
      createdBy: userId,
      documentId,
      extractedBy: 'enhanced_vision',
      extractedAt: new Date(),
      status: 'draft',
    },
  });

  // Create line items
  for (const item of items) {
    await prisma.takeoffLineItem.create({
      data: {
        takeoffId: takeoff.id,
        category: item.category,
        itemName: item.itemName,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        location: item.location,
        sheetNumber: item.sheetNumber,
        gridLocation: item.gridLocation,
        notes: item.notes,
        confidence: item.confidence,
        extractedFrom: item.extractedFrom,
        verified: item.verificationStatus === 'auto_approved',
        verificationStatus: item.verificationStatus,
        confidenceBreakdown: item.confidenceBreakdown as object,
      },
    });
  }

  console.log(`[ENHANCED-TAKEOFF] Saved takeoff ${takeoff.id} with ${items.length} items`);
  return takeoff.id;
}
