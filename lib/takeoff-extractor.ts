/**
 * Quantity Calculator - Advanced Vision Extraction for Material Takeoff
 * 
 * This module uses AI Vision to extract material quantities from construction plans
 * including dimensions, areas, volumes, and material specifications.
 * 
 * FEATURES:
 * - Real measurement extraction (SF, LF, CY, EA, etc.)
 * - Scale-aware calculations
 * - Auto-run during document processing
 * - Support for all construction document types
 */

import { prisma } from './db';
import { createScopedLogger } from './logger';
import { callAbacusLLM } from './abacus-llm';

const log = createScopedLogger('TAKEOFF_EXTRACTOR');
import {
  extractSiteworkTakeoff,
  classifyDrawingType,
  extractGeotechData,
  normalizeUnit as normalizeSiteworkUnit,
  type SiteworkExtractionResult,
  type DrawingType
} from './sitework-takeoff-extractor';

interface TakeoffItem {
  itemName: string;
  description?: string;
  quantity: number;
  unit: string; // "CY", "SF", "LF", "EA", "TON", "LBS", "GAL", "CF"
  category: string;
  location?: string;
  sheetNumber?: string;
  gridLocation?: string;
  notes?: string;
  confidence: number; // 0-100
  extractedFrom: string; // Source text from plan
  calculationMethod?: string; // How quantity was derived
}

interface QuantityExtractionResult {
  category: string; // "concrete", "steel", "lumber", etc.
  items: TakeoffItem[];
}

interface MaterialTakeoffExtractionResult {
  takeoffId: string;
  documentId: string;
  totalItems: number;
  totalCost?: number;
  categories: QuantityExtractionResult[];
  processingCost: number;
  pagesProcessed: number;
}

// Standard units for construction takeoffs
const VALID_UNITS = ['SF', 'LF', 'CY', 'CF', 'EA', 'TON', 'LBS', 'GAL', 'SY', 'MBF', 'SQFT', 'LN FT'];

// Unit normalization map
const UNIT_NORMALIZE: Record<string, string> = {
  'square feet': 'SF',
  'sq ft': 'SF',
  'sqft': 'SF',
  's.f.': 'SF',
  'linear feet': 'LF',
  'lin ft': 'LF',
  'l.f.': 'LF',
  'cubic yards': 'CY',
  'cu yd': 'CY',
  'c.y.': 'CY',
  'cubic feet': 'CF',
  'cu ft': 'CF',
  'each': 'EA',
  'tons': 'TON',
  'pounds': 'LBS',
  'lbs': 'LBS',
  'gallons': 'GAL',
  'gal': 'GAL',
  'square yards': 'SY',
  'sq yd': 'SY',
};

/**
 * Extract material quantities from a construction plan using vision AI
 */
export async function extractQuantitiesFromDocument(
  documentId: string,
  projectId: string,
  userId: string,
  takeoffName?: string
): Promise<MaterialTakeoffExtractionResult> {
  try {
    // Get document
    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });

    if (!document) {
      throw new Error('Document not found');
    }

    if (document.fileType !== 'pdf') {
      throw new Error('Only PDF documents are supported for quantity extraction');
    }

    // Get the chunks that were already processed for this document
    const existingChunks = await prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { pageNumber: 'asc' }
    });

    if (existingChunks.length === 0) {
      throw new Error('Document has not been processed for OCR yet');
    }

    log.info('Processing pages for document', { pageCount: existingChunks.length, documentName: document.name });

    // Create a new material takeoff
    const takeoff = await prisma.materialTakeoff.create({
      data: {
        name: takeoffName || `Takeoff for ${document.name}`,
        projectId,
        createdBy: userId,
        documentId,
        extractedBy: 'vision_ocr',
        extractedAt: new Date(),
        status: 'draft'
      }
    });

    log.info('Created takeoff', { takeoffId: takeoff.id });

    // Process chunks and extract quantities using enhanced vision prompts
    const allExtractedItems: QuantityExtractionResult[] = [];
    let totalCost = 0;
    let totalProcessingCost = 0;

    for (const chunk of existingChunks) {
      const pageNum = chunk.pageNumber || 0;
      const metadata = chunk.metadata as any;

      log.info('Processing page', { pageNum });

      // Extract quantity-specific information from existing metadata
      const extracted = await extractQuantitiesFromChunk(chunk, document.name);
      
      if (extracted.items.length > 0) {
        allExtractedItems.push(extracted);
        log.info('Found items', { itemCount: extracted.items.length, category: extracted.category });
      }
    }

    // Group items by category and create line items
    const lineItemsCreated = [];
    for (const categoryData of allExtractedItems) {
      for (const item of categoryData.items) {
        const lineItem = await prisma.takeoffLineItem.create({
          data: {
            takeoffId: takeoff.id,
            category: categoryData.category,
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
            verified: false
          }
        });
        lineItemsCreated.push(lineItem);
      }
    }

    log.info('Created line items', { count: lineItemsCreated.length });

    // Update takeoff with totals
    await prisma.materialTakeoff.update({
      where: { id: takeoff.id },
      data: {
        totalCost: totalCost > 0 ? totalCost : null
      }
    });

    return {
      takeoffId: takeoff.id,
      documentId,
      totalItems: lineItemsCreated.length,
      totalCost: totalCost > 0 ? totalCost : undefined,
      categories: allExtractedItems,
      processingCost: totalProcessingCost,
      pagesProcessed: existingChunks.length
    };
  } catch (error) {
    log.error('Quantity extraction error', error as Error);
    throw error;
  }
}

/**
 * Extract quantities from a single chunk using existing metadata
 */
async function extractQuantitiesFromChunk(
  chunk: any,
  documentName: string
): Promise<QuantityExtractionResult> {
  const metadata = chunk.metadata as any;
  const items = [];

  // Determine category based on content and sheet type
  const category = detectCategory(chunk.content, metadata);

  // Extract dimensions and calculate quantities
  if (metadata?.labeled_dimensions) {
    const dimensions = metadata.labeled_dimensions;
    
    // Parse dimensions and create takeoff items
    for (const dim of dimensions) {
      const item = parseDimensionToTakeoffItem(dim, metadata, chunk.pageNumber);
      if (item) {
        items.push(item);
      }
    }
  }

  // Extract quantities from notes and callouts
  if (metadata?.notes) {
    const notes = metadata.notes;
    for (const note of notes) {
      const item = parseNoteToTakeoffItem(note, metadata, chunk.pageNumber);
      if (item) {
        items.push(item);
      }
    }
  }

  // Extract from material callouts
  if (metadata?.structuralCallouts) {
    for (const callout of metadata.structuralCallouts) {
      const item = parseCalloutToTakeoffItem(callout, metadata, chunk.pageNumber, 'structural');
      if (item) {
        items.push(item);
      }
    }
  }

  if (metadata?.mepCallouts) {
    for (const callout of metadata.mepCallouts) {
      const item = parseCalloutToTakeoffItem(callout, metadata, chunk.pageNumber, 'mep');
      if (item) {
        items.push(item);
      }
    }
  }

  return {
    category,
    items
  };
}

/**
 * Detect material category from content and metadata
 */
function detectCategory(content: string, metadata: any): string {
  const lowerContent = content.toLowerCase();
  
  // Check for specific material keywords - order matters for specificity
  // Foundation/Structural concrete first (more specific)
  if (lowerContent.includes('footing') || lowerContent.includes('ftg') || lowerContent.includes('f.t.g')) {
    return 'concrete'; // Footings are concrete category
  }
  if (lowerContent.includes('foundation') || lowerContent.includes('grade beam') || lowerContent.includes('pier')) {
    return 'concrete';
  }
  if (lowerContent.includes('concrete') || lowerContent.includes('slab') || lowerContent.includes('sog')) {
    return 'concrete';
  }
  if (lowerContent.includes('steel') || lowerContent.includes('rebar') || lowerContent.includes('w-shape') || lowerContent.includes('hss')) {
    return 'steel';
  }
  if (lowerContent.includes('beam') && !lowerContent.includes('grade beam')) {
    return 'steel'; // Structural beams
  }
  if (lowerContent.includes('column') && !lowerContent.includes('concrete column')) {
    return 'steel';
  }
  if (lowerContent.includes('lumber') || lowerContent.includes('framing') || lowerContent.includes('2x4') || lowerContent.includes('2x6') || lowerContent.includes('joist') || lowerContent.includes('stud')) {
    return 'lumber';
  }
  if (lowerContent.includes('electrical') || lowerContent.includes('conduit') || lowerContent.includes('wire') || lowerContent.includes('panel') || lowerContent.includes('outlet') || lowerContent.includes('switch')) {
    return 'electrical';
  }
  if (lowerContent.includes('plumbing') || lowerContent.includes('pipe') || lowerContent.includes('drain') || lowerContent.includes('water') || lowerContent.includes('fixture') || lowerContent.includes('lavatory') || lowerContent.includes('toilet')) {
    return 'plumbing';
  }
  if (lowerContent.includes('hvac') || lowerContent.includes('duct') || lowerContent.includes('mechanical') || lowerContent.includes('ahu') || lowerContent.includes('rtu') || lowerContent.includes('diffuser')) {
    return 'hvac';
  }
  if (lowerContent.includes('drywall') || lowerContent.includes('gypsum') || lowerContent.includes('sheetrock') || lowerContent.includes('gyp bd')) {
    return 'drywall';
  }
  if (lowerContent.includes('roofing') || lowerContent.includes('shingle') || lowerContent.includes('membrane') || lowerContent.includes('tpo') || lowerContent.includes('epdm')) {
    return 'roofing';
  }
  if (lowerContent.includes('masonry') || lowerContent.includes('cmu') || lowerContent.includes('brick') || lowerContent.includes('block')) {
    return 'masonry';
  }
  if (lowerContent.includes('door') || lowerContent.includes('window') || lowerContent.includes('frame') || lowerContent.includes('glazing')) {
    return 'doors_windows';
  }
  if (lowerContent.includes('flooring') || lowerContent.includes('carpet') || lowerContent.includes('tile') || lowerContent.includes('vct') || lowerContent.includes('lvt')) {
    return 'flooring';
  }
  if (lowerContent.includes('paint') || lowerContent.includes('primer') || lowerContent.includes('coating')) {
    return 'paint';
  }
  if (lowerContent.includes('insulation') || lowerContent.includes('batt') || lowerContent.includes('rigid') || lowerContent.includes('spray foam')) {
    return 'insulation';
  }
  // Division 31 - Earthwork (check before general site category)
  if (lowerContent.includes('excavation') || lowerContent.includes('cut') || lowerContent.includes('fill') ||
      lowerContent.includes('backfill') || lowerContent.includes('compaction') ||
      lowerContent.includes('proctor') || lowerContent.includes('subgrade')) {
    return 'earthwork';
  }
  // General site work (less specific, so check after earthwork)
  if (lowerContent.includes('grading') || lowerContent.includes('paving') || lowerContent.includes('asphalt') || lowerContent.includes('site')) {
    return 'site';
  }
  // Division 32 - Exterior/Paving
  if (lowerContent.includes('striping') || lowerContent.includes('marking') || lowerContent.includes('ada ramp') ||
      lowerContent.includes('curb') || lowerContent.includes('gutter') || lowerContent.includes('sidewalk')) {
    return 'paving';
  }
  // Division 33 - Utilities
  if (lowerContent.includes('storm') || lowerContent.includes('sanitary') || lowerContent.includes('sewer') ||
      lowerContent.includes('water main') || lowerContent.includes('manhole') || lowerContent.includes('catch basin') ||
      lowerContent.includes('hydrant') || lowerContent.includes('invert')) {
    return 'utilities';
  }
  // Landscape
  if (lowerContent.includes('landscape') || lowerContent.includes('planting') || lowerContent.includes('tree') ||
      lowerContent.includes('shrub') || lowerContent.includes('mulch') || lowerContent.includes('sod') ||
      lowerContent.includes('irrigation')) {
    return 'landscape';
  }
  
  return 'general';
}

/**
 * Parse dimension string to takeoff item
 */
function parseDimensionToTakeoffItem(dimension: string, metadata: any, pageNumber: number): any | null {
  // Example dimension: "100' x 50'" or "4\" thick" or "12'" diameter"
  const dimMatch = dimension.match(/([\d.]+)['"\s]*([x×])?\s*([\d.]+)?['"\s]*(.*)?/i);
  
  if (!dimMatch) return null;

  const value1 = parseFloat(dimMatch[1]);
  const value2 = dimMatch[3] ? parseFloat(dimMatch[3]) : null;
  const description = dimMatch[4] || '';

  let quantity = value1;
  let unit = 'LF'; // Linear feet default
  let itemName = dimension;

  // Detect area calculations
  if (value2 && dimMatch[2]) {
    quantity = value1 * value2;
    unit = 'SF';
    itemName = `${value1}' x ${value2}' Area`;
  }

  // Detect volume for concrete
  if (description.toLowerCase().includes('thick') || description.toLowerCase().includes('depth')) {
    const thickness = value1;
    if (value2) {
      // Calculate cubic yards for concrete
      quantity = (value1 * value2 * thickness) / 27; // Convert to CY
      unit = 'CY';
      itemName = `${value1}' x ${value2}' x ${thickness}" Concrete`;
    }
  }

  return {
    itemName,
    quantity,
    unit,
    sheetNumber: metadata?.sheet_number,
    confidence: 75,
    extractedFrom: dimension
  };
}

/**
 * Parse note to takeoff item
 */
function parseNoteToTakeoffItem(note: string, metadata: any, pageNumber: number): any | null {
  // Look for quantity patterns like "100 EA", "500 LF", "25 CY"
  const qtyMatch = note.match(/([\d,]+\.?\d*)\s*(EA|LF|SF|CY|TON|LBS|SY|CF)/i);
  
  if (!qtyMatch) return null;

  const quantity = parseFloat(qtyMatch[1].replace(/,/g, ''));
  const unit = qtyMatch[2].toUpperCase();
  const itemName = note.replace(qtyMatch[0], '').trim() || `${unit} Material`;

  return {
    itemName,
    quantity,
    unit,
    sheetNumber: metadata?.sheet_number,
    confidence: 80,
    extractedFrom: note
  };
}

/**
 * Parse callout to takeoff item
 */
function parseCalloutToTakeoffItem(callout: string, metadata: any, pageNumber: number, type: string): any | null {
  // Example callouts: "#4 @ 12\" O.C.", "2x6 @ 16\" O.C.", "3/4\" PVC"
  
  // Detect rebar callouts
  const rebarMatch = callout.match(/#(\d+)\s*@\s*([\d]+)["']?\s*(O\.?C\.?)?/i);
  if (rebarMatch) {
    return {
      itemName: `#${rebarMatch[1]} Rebar @ ${rebarMatch[2]}" O.C.`,
      quantity: 1, // Will need to calculate based on area
      unit: 'TON',
      sheetNumber: metadata?.sheet_number,
      confidence: 85,
      extractedFrom: callout
    };
  }

  // Detect lumber callouts
  const lumberMatch = callout.match(/(\d+)x(\d+)\s*@\s*([\d]+)["']?\s*(O\.?C\.?)?/i);
  if (lumberMatch) {
    return {
      itemName: `${lumberMatch[1]}x${lumberMatch[2]} @ ${lumberMatch[3]}" O.C.`,
      quantity: 1, // Will need to calculate based on length
      unit: 'LF',
      sheetNumber: metadata?.sheet_number,
      confidence: 85,
      extractedFrom: callout
    };
  }

  // Detect pipe/conduit callouts
  const pipeMatch = callout.match(/([\d\/]+)["']?\s*(PVC|CPVC|Copper|Steel|Conduit)/i);
  if (pipeMatch) {
    return {
      itemName: `${pipeMatch[1]}" ${pipeMatch[2]}`,
      quantity: 1, // Will need to calculate based on routing
      unit: 'LF',
      sheetNumber: metadata?.sheet_number,
      confidence: 80,
      extractedFrom: callout
    };
  }

  return null;
}

/**
 * AI-Powered Quantity Extraction from Document Content
 * Extracts real measurements (SF, LF, CY, etc.) using LLM analysis
 */
export async function extractQuantitiesWithAI(
  projectId: string,
  documentId: string
): Promise<TakeoffItem[]> {
  log.info('Starting AI quantity extraction', { documentId });
  
  // Get document chunks with their content
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId },
    orderBy: { pageNumber: 'asc' },
  });

  if (chunks.length === 0) {
    log.info('No chunks found for document');
    return [];
  }

  // Get scale information for the project
  const scaleData = await prisma.documentChunk.findFirst({
    where: {
      documentId,
      metadata: {
        path: ['scale'],
        not: { equals: null }
      }
    },
    select: { metadata: true }
  });

  const scale = (scaleData?.metadata as any)?.scale || 'Unknown';
  
  // Combine relevant content for analysis
  const contentSummary = chunks.map((chunk: any) => {
    const meta = chunk.metadata as any;
    return {
      page: chunk.pageNumber,
      content: chunk.content?.substring(0, 2000) || '', // Limit content size
      dimensions: meta?.dimensions || [],
      scale: meta?.scale,
      sheetNumber: meta?.sheet_number,
    };
  });

  // Build the prompt for AI extraction
  const prompt = buildTakeoffExtractionPrompt(contentSummary, scale);
  
  try {
    const messages = [
      {
        role: 'system' as const,
        content: `You are an expert construction estimator extracting material quantities from construction documents. 
Extract ONLY quantities that have explicit measurements in the documents. Do not estimate or guess.
Always include the unit of measure (SF, LF, CY, EA, etc.).
Return results as a JSON array.`
      },
      {
        role: 'user' as const,
        content: prompt
      }
    ];

    const response = await callAbacusLLM(messages, {
      model: 'claude-sonnet-4-20250514',
      temperature: 0.1,
      max_tokens: 4000,
    });

    const extractedItems = parseAITakeoffResponse(response.content, documentId);
    log.info('Extracted items from document', { count: extractedItems.length });
    return extractedItems;
    
  } catch (error: any) {
    log.error('AI extraction failed', error as Error);
    return [];
  }
}

/**
 * Build the prompt for takeoff extraction
 */
function buildTakeoffExtractionPrompt(contentSummary: any[], scale: string): string {
  let prompt = `## Construction Document Analysis for Material Takeoff

**Drawing Scale:** ${scale}

Analyze the following construction document content and extract ALL quantifiable materials with their measurements.

### Document Content by Page:
`;

  for (const page of contentSummary) {
    prompt += `\n**Page ${page.page}** (Sheet: ${page.sheetNumber || 'Unknown'}):\n`;
    if (page.dimensions?.length > 0) {
      prompt += `Dimensions found: ${JSON.stringify(page.dimensions)}\n`;
    }
    prompt += `Content:\n${page.content}\n`;
  }

  prompt += `
### Extraction Instructions:
1. Extract ALL material quantities with explicit measurements
2. Calculate areas (SF) from length × width dimensions
3. Calculate volumes (CY) from length × width × depth, divided by 27
4. Calculate linear quantities (LF) from lengths and pipe/conduit runs
5. Count items (EA) for fixtures, equipment, doors, windows
6. Include the calculation method for derived quantities

### Required Output Format (JSON Array):
[
  {
    "itemName": "Concrete Slab on Grade",
    "category": "concrete",
    "quantity": 150.5,
    "unit": "CY",
    "location": "Building A Foundation",
    "sheetNumber": "S-101",
    "calculationMethod": "50' x 80' x 4\" thick = 150.5 CY",
    "confidence": 90,
    "extractedFrom": "Foundation Plan note"
  }
]

### Categories to use:
- concrete (slabs, footings, walls, curbs, grade beams, piers)
- steel (rebar, structural steel, misc metals, anchor bolts)
- lumber (framing, sheathing, blocking, joists, studs)
- drywall (gypsum board, finishing, metal studs)
- flooring (tile, carpet, VCT, hardwood, LVT)
- roofing (shingles, membrane, metal, insulation)
- electrical (conduit, wire, panels, fixtures, outlets, switches)
- plumbing (pipe, fittings, fixtures, water heaters, pumps)
- hvac (ductwork, equipment, diffusers, thermostats, controls)
- masonry (CMU, brick, stone, mortar)
- insulation (batt, rigid, spray foam)
- paint (interior, exterior, primer)
- doors_windows (doors, frames, hardware, windows, glazing)
- site (excavation, grading, paving, utilities)

### IMPORTANT - Structural Foundation Elements:
Look carefully for ALL footing types and count each individually:
- Spread footings (square or rectangular pads under columns)
- Strip footings (continuous footings under walls)
- Combined footings (supporting multiple columns)
- Grade beams (connecting footings)
- Pier footings (deep foundation elements)
- Column footings (individual pad footings)
- Wall footings (continuous footings)

For each footing found, extract:
- Type (spread, strip, pier, etc.)
- Dimensions (L x W x D or diameter x depth)
- Quantity (count how many of each type)
- Calculate concrete volume in CY

Look for footing schedules, foundation plans, and structural notes that list multiple footings.
Count EVERY footing shown on the plans, not just unique types.

Return ONLY the JSON array, no other text.`;

  return prompt;
}

/**
 * Parse AI response into TakeoffItem array
 */
function parseAITakeoffResponse(response: string, documentId: string): TakeoffItem[] {
  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      log.warn('No JSON array found in AI response');
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item: any) => ({
      itemName: item.itemName || 'Unknown Item',
      description: item.description,
      quantity: parseFloat(item.quantity) || 0,
      unit: normalizeUnit(item.unit || 'EA'),
      category: item.category || 'general',
      location: item.location,
      sheetNumber: item.sheetNumber,
      gridLocation: item.gridLocation,
      notes: item.notes,
      confidence: item.confidence || 75,
      extractedFrom: item.extractedFrom || 'AI Extraction',
      calculationMethod: item.calculationMethod,
    })).filter((item: TakeoffItem) => item.quantity > 0);
    
  } catch (error: any) {
    log.error('Failed to parse AI response', error as Error);
    return [];
  }
}

/**
 * Normalize unit strings to standard format
 */
function normalizeUnit(unit: string): string {
  const normalized = unit.toLowerCase().trim();
  return UNIT_NORMALIZE[normalized] || unit.toUpperCase();
}

/**
 * Auto-extract takeoffs for a project after document processing
 * This is called from the document processing queue
 */
export async function autoExtractTakeoffs(
  projectId: string,
  projectSlug: string
): Promise<{ success: boolean; itemCount: number; takeoffId?: string }> {
  log.info('Starting auto-extraction', { projectSlug });
  
  try {
    // Get all processed documents for the project
    const documents = await prisma.document.findMany({
      where: {
        projectId,
        processed: true,
        deletedAt: null,
      },
      select: { id: true, name: true },
    });

    if (documents.length === 0) {
      log.info('No processed documents found');
      return { success: false, itemCount: 0 };
    }

    // Get the user (project owner)
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });

    if (!project) {
      return { success: false, itemCount: 0 };
    }

    // Extract from each document
    const allItems: TakeoffItem[] = [];
    
    // Find geotech document for cross-reference
    const geotechDoc = documents.find(d => 
      d.name.toLowerCase().includes('geotech') || 
      d.name.toLowerCase().includes('soil') ||
      d.name.toLowerCase().includes('boring')
    );
    
    for (const doc of documents) {
      // Standard AI extraction for all documents
      const items = await extractQuantitiesWithAI(projectId, doc.id);
      allItems.push(...items);
      
      // Enhanced sitework extraction for civil/site drawings
      const isSiteworkDoc = doc.name.toLowerCase().includes('civil') ||
                           doc.name.toLowerCase().includes('site') ||
                           doc.name.toLowerCase().includes('grading') ||
                           doc.name.toLowerCase().includes('utility') ||
                           doc.name.toLowerCase().includes('landscape') ||
                           doc.name.toLowerCase().includes('paving') ||
                           doc.name.toLowerCase().includes('storm') ||
                           doc.name.toLowerCase().match(/^c[-_]?\d/i); // C-1, C1, C_1 sheet patterns
      
      if (isSiteworkDoc) {
        log.info('Running enhanced sitework extraction', { documentName: doc.name });
        try {
          const siteworkItems = await extractSiteworkTakeoff(doc.id, projectId, {
            includeCAD: true,
            includeGeotech: !!geotechDoc,
            geotechDocumentId: geotechDoc?.id
          });
          
          // Convert sitework results to TakeoffItem format
          for (const sw of siteworkItems) {
            allItems.push({
              itemName: sw.itemName,
              description: sw.description,
              quantity: sw.quantity,
              unit: sw.unit,
              category: sw.category,
              sheetNumber: sw.source.split(':')[2] || undefined,
              confidence: sw.confidence,
              extractedFrom: sw.source,
              calculationMethod: sw.calculationMethod
            });
          }
        } catch (error) {
          log.error(`Sitework extraction failed for ${doc.name}`, error as Error);
        }
      }
    }

    if (allItems.length === 0) {
      log.info('No quantities extracted');
      return { success: true, itemCount: 0 };
    }

    // Create or update the auto-generated takeoff
    const existingTakeoff = await prisma.materialTakeoff.findFirst({
      where: {
        projectId,
        extractedBy: 'auto',
      },
    });

    let takeoff;
    if (existingTakeoff) {
      // Delete old line items and update
      await prisma.takeoffLineItem.deleteMany({
        where: { takeoffId: existingTakeoff.id },
      });
      takeoff = existingTakeoff;
    } else {
      // Create new takeoff
      takeoff = await prisma.materialTakeoff.create({
        data: {
          name: `Auto-Generated Takeoff - ${new Date().toLocaleDateString()}`,
          projectId,
          createdBy: project.ownerId,
          extractedBy: 'auto',
          extractedAt: new Date(),
          status: 'draft',
        },
      });
    }

    // Create line items
    for (const item of allItems) {
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
          notes: item.calculationMethod ? `Calculation: ${item.calculationMethod}` : item.notes,
          confidence: item.confidence,
          extractedFrom: item.extractedFrom,
          verified: false,
        },
      });
    }

    log.info('Created takeoff items', { count: allItems.length });
    return { success: true, itemCount: allItems.length, takeoffId: takeoff.id };
    
  } catch (error: any) {
    log.error('Auto-extraction failed', error as Error);
    return { success: false, itemCount: 0 };
  }
}
