/**
 * Intelligence Extraction Orchestrator
 * 
 * Automatically runs Phase A, B, and C intelligence extraction on processed documents.
 * 
 * PHASE A - Foundation Intelligence:
 * - Title block extraction
 * - Scale detection
 * - Legend/symbol identification
 * 
 * PHASE B - Advanced Features:
 * - Dimension extraction and validation
 * - Visual annotations
 * - Cross-reference mapping
 * - Room/space detection
 * 
 * PHASE C - Advanced Intelligence:
 * - Multi-sheet spatial correlation
 * - MEP path tracing
 * - Adaptive symbol learning
 */

import { prisma } from './db';
import { logger } from '@/lib/logger';
import { resolveCrossReferences } from '@/lib/cross-reference-resolver';
import { parseDrawingSchedules } from '@/lib/drawing-schedule-parser';
import { extractFixtures } from '@/lib/fixture-extractor';
import { aggregateSpatialData } from '@/lib/spatial-data-aggregator';
import { buildSheetIndex } from '@/lib/sheet-index-builder';

export interface IntelligenceExtractionOptions {
  documentId: string;
  projectSlug: string;
  phases?: ('A' | 'B' | 'C')[];  // Default: all phases
  pageRange?: { start: number; end: number }; // Default: all pages
  skipExisting?: boolean; // Default: false (re-extract)
}

export interface PhaseAResult {
  titleBlocksExtracted: number;
  scalesDetected: number;
  legendsFound: number;
}

export interface PhaseBResult {
  dimensionsExtracted: number;
  annotationsFound: number;
  calloutsExtracted: number;
  roomsIdentified: number;
}

export interface PhaseCResult {
  spatialCorrelationsBuilt: number;
  mepElementsMapped: number;
  symbolsLearned: number;
}

export interface ExtractionResult {
  documentId: string;
  phasesRun: string[];
  pagesProcessed: number;
  success: boolean;
  phaseResults: {
    phaseA?: PhaseAResult;
    phaseB?: PhaseBResult;
    phaseC?: PhaseCResult;
  };
  errors: string[];
  warnings: string[];
}

// Pattern matchers for intelligence extraction
const SCALE_PATTERNS = [
  /scale[:\s]+(\d+)["\s]*=\s*(\d+)['"\s]*([-–]?\d*)/i,
  /(\d+\/\d+)["']\s*=\s*(\d+)['"][-–]?(\d+)?/i,
  /1\s*[:\s]\s*(\d+)/i,
  /(\d+)"\s*=\s*(\d+)'-?(\d+)?"/i,
  /NTS|NOT\s+TO\s+SCALE/i,
];

const DIMENSION_PATTERNS = [
  /(\d+)[''][-–](\d+)[""]?/g,  // feet-inches: 12'-6"
  /(\d+\.?\d*)[''](?:\s|$)/g,  // feet only: 25'
  /(\d+\.?\d*)\s*(?:FT|LF|SF|SY|CY)/gi, // with units
  /(\d+)\s*x\s*(\d+)/gi,  // dimensions like 4x8
];

const MEP_KEYWORDS = {
  mechanical: ['hvac', 'duct', 'diffuser', 'vav', 'ahu', 'rtu', 'fan', 'coil', 'damper', 'grille', 'louver', 'cfm', 'btu'],
  electrical: ['panel', 'circuit', 'outlet', 'switch', 'conduit', 'wire', 'amp', 'volt', 'transformer', 'disconnect', 'receptacle', 'lighting'],
  plumbing: ['pipe', 'valve', 'drain', 'fixture', 'water', 'sanitary', 'vent', 'cleanout', 'trap', 'faucet', 'toilet', 'sink', 'lavatory'],
};

const DRAWING_TYPE_PATTERNS: { [key: string]: RegExp[] } = {
  floor_plan: [/floor\s*plan/i, /\bFP\d/i, /level\s*\d/i, /ground\s*floor/i],
  elevation: [/elevation/i, /\bEL\d/i, /north\s*elev/i, /south\s*elev/i, /east\s*elev/i, /west\s*elev/i],
  section: [/section/i, /\bSC\d/i, /building\s*section/i, /wall\s*section/i],
  detail: [/detail/i, /\bDT\d/i, /typical\s*detail/i],
  site_plan: [/site\s*plan/i, /\bSP\d/i, /plot\s*plan/i, /grading/i],
  reflected_ceiling: [/reflected\s*ceiling/i, /\bRCP/i, /ceiling\s*plan/i],
  roof_plan: [/roof\s*plan/i, /\bRP\d/i],
  schedule: [/schedule/i, /door\s*schedule/i, /window\s*schedule/i, /finish\s*schedule/i],
};

/**
 * Extract scale information from content
 */
function extractScaleData(content: string): { primaryScale: string | null; scaleRatio: number | null; scaleType: string; hasMultipleScales: boolean } {
  const scales: string[] = [];
  let scaleType = 'unknown';
  
  for (const pattern of SCALE_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      if (/NTS|NOT\s+TO\s+SCALE/i.test(matches[0])) {
        scaleType = 'NTS';
        scales.push('NTS');
      } else {
        scales.push(matches[0]);
        scaleType = 'architectural';
      }
    }
  }
  
  const hasMultipleScales = scales.length > 1;
  const primaryScale = scales[0] || null;
  
  // Calculate ratio if possible
  let scaleRatio: number | null = null;
  if (primaryScale && scaleType !== 'NTS') {
    const ratioMatch = primaryScale.match(/1\s*[:\s]\s*(\d+)/);
    if (ratioMatch) {
      scaleRatio = parseInt(ratioMatch[1]);
    }
  }
  
  return { primaryScale, scaleRatio, scaleType, hasMultipleScales };
}

/**
 * Extract dimensions from content
 */
function extractDimensions(content: string): { dimensions: string[]; dimensionCount: number } {
  const dimensions: string[] = [];
  
  for (const pattern of DIMENSION_PATTERNS) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      dimensions.push(match[0]);
    }
  }
  
  return { dimensions: [...new Set(dimensions)].slice(0, 50), dimensionCount: dimensions.length };
}

/**
 * Detect MEP discipline from content
 */
function detectMEPDiscipline(content: string): string | null {
  const contentLower = content.toLowerCase();
  
  for (const [discipline, keywords] of Object.entries(MEP_KEYWORDS)) {
    for (const keyword of keywords) {
      if (contentLower.includes(keyword)) {
        return discipline;
      }
    }
  }
  return null;
}

/**
 * Detect drawing type from content
 */
function detectDrawingType(content: string, sheetNumber?: string): { drawingType: string; confidence: number } {
  let bestMatch = { drawingType: 'unknown', confidence: 0 };
  
  for (const [type, patterns] of Object.entries(DRAWING_TYPE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        const confidence = 0.8;
        if (confidence > bestMatch.confidence) {
          bestMatch = { drawingType: type, confidence };
        }
      }
    }
  }
  
  // Check sheet number prefix for hints
  if (sheetNumber) {
    const prefix = sheetNumber.substring(0, 1).toUpperCase();
    const typeMap: { [key: string]: string } = {
      'A': 'architectural',
      'S': 'structural', 
      'M': 'mechanical',
      'E': 'electrical',
      'P': 'plumbing',
      'C': 'civil',
      'L': 'landscape',
    };
    if (typeMap[prefix] && bestMatch.confidence < 0.9) {
      bestMatch = { drawingType: typeMap[prefix], confidence: 0.7 };
    }
  }
  
  return bestMatch;
}

/**
 * Extract cross-references from content
 */
function extractCrossReferences(content: string): string[] {
  const refs: string[] = [];
  
  // Sheet references like "SEE SHEET A2.1"
  const sheetRefs = content.match(/see\s+(?:sheet\s+)?([A-Z]\d+\.?\d*)/gi) || [];
  refs.push(...sheetRefs);
  
  // Detail references like "SEE DETAIL 3/A5.1"
  const detailRefs = content.match(/see\s+detail\s+(\d+\/[A-Z]\d+\.?\d*)/gi) || [];
  refs.push(...detailRefs);
  
  // Section references
  const sectionRefs = content.match(/(?:section|sect\.?)\s+([A-Z]?-?\d+)/gi) || [];
  refs.push(...sectionRefs);
  
  return [...new Set(refs)].slice(0, 20);
}

/**
 * Extract annotations and callouts from content
 */
function extractAnnotations(content: string): { annotations: string[]; callouts: string[] } {
  const annotations: string[] = [];
  const callouts: string[] = [];
  
  // Note callouts like "NOTE: ..." or numbered notes
  const noteMatches = content.match(/(?:NOTE|NB|CAUTION|WARNING)[:\s].{10,100}/gi) || [];
  callouts.push(...noteMatches.slice(0, 10));
  
  // Keyed notes like "1. ..." at start of lines
  const keyedNotes = content.match(/^\d+\.\s+.{10,80}/gm) || [];
  annotations.push(...keyedNotes.slice(0, 15));
  
  // Typical callouts
  const typicalCallouts = content.match(/TYP\.?|TYPICAL|VERIFY|VIF|UNO|NIC/gi) || [];
  annotations.push(...[...new Set(typicalCallouts)]);
  
  return { annotations, callouts };
}

/**
 * Extract sheet number from content
 */
function extractSheetNumber(content: string): string | null {
  // Common sheet number patterns
  const patterns = [
    /sheet\s*(?:no\.?|#|number)?\s*[:\s]*([A-Z]\d+\.?\d*)/i,
    /^([A-Z]\d+\.?\d*)\s*[-–]/m,
    /dwg\.?\s*(?:no\.?)?\s*[:\s]*([A-Z]\d+\.?\d*)/i,
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1].toUpperCase();
    }
  }
  return null;
}

/**
 * Main orchestration function
 */
export async function runIntelligenceExtraction(
  options: IntelligenceExtractionOptions
): Promise<ExtractionResult> {
  const { documentId, projectSlug, phases = ['A', 'B', 'C'], pageRange, skipExisting = false } = options;

  const result: ExtractionResult = {
    documentId,
    phasesRun: [],
    pagesProcessed: 0,
    success: false,
    phaseResults: {},
    errors: [],
    warnings: [],
  };

  logger.info('INTELLIGENCE_ORCHESTRATOR', 'Starting intelligence extraction', { documentId, projectSlug, phases: phases.join(', ') });

  try {
    // Get document and verify it exists
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        Project: true,
      },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Clean up stale extraction records before re-extraction
    if (!skipExisting) {
      logger.info('INTELLIGENCE', 'Cleaning up stale extraction records before re-extraction', { documentId });
      try {
        await prisma.$transaction([
          prisma.drawingType.deleteMany({ where: { documentId } }),
          prisma.sheetLegend.deleteMany({ where: { documentId } }),
          prisma.dimensionAnnotation.deleteMany({ where: { documentId } }),
          prisma.detailCallout.deleteMany({ where: { documentId } }),
          prisma.enhancedAnnotation.deleteMany({ where: { documentId } }),
        ]);
        logger.info('INTELLIGENCE', 'Stale extraction records cleaned up', { documentId });
      } catch (cleanupError) {
        logger.warn('INTELLIGENCE', 'Failed to clean up stale records, proceeding with extraction', {
          documentId,
          error: (cleanupError as Error).message
        });
        // Continue with extraction even if cleanup fails
      }
    }

    // Get chunks to process
    const whereClause: any = { documentId };
    if (pageRange) {
      whereClause.pageNumber = {
        gte: pageRange.start,
        lte: pageRange.end,
      };
    }
    
    // Skip chunks that already have data if requested
    if (skipExisting) {
      whereClause.scaleData = { equals: null };
    }

    const chunks = await prisma.documentChunk.findMany({
      where: whereClause,
      orderBy: { pageNumber: 'asc' },
    });

    if (chunks.length === 0) {
      result.warnings.push('No chunks found to process (may already be extracted)');
      result.success = true;
      return result;
    }

    logger.info('INTELLIGENCE_ORCHESTRATOR', `Found chunks to process`, { chunkCount: chunks.length });
    result.pagesProcessed = chunks.length;

    // PHASE A - Foundation Intelligence
    if (phases.includes('A')) {
      logger.info('PHASE_A', 'Starting Foundation Intelligence phase');
      result.phasesRun.push('A');
      
      const phaseAResult: PhaseAResult = {
        titleBlocksExtracted: 0,
        scalesDetected: 0,
        legendsFound: 0,
      };
      
      for (const chunk of chunks) {
        const content = chunk.content || '';
        
        // Extract sheet number (title block proxy)
        const sheetNumber = extractSheetNumber(content) || chunk.sheetNumber;
        if (sheetNumber) {
          phaseAResult.titleBlocksExtracted++;
        }
        
        // Extract scale data
        const scaleData = extractScaleData(content);
        if (scaleData.primaryScale) {
          phaseAResult.scalesDetected++;
        }

        // Extract titleBlockData from metadata if present and not already set
        const meta = chunk.metadata as Record<string, any> | null;
        const titleBlockJson = meta?.titleBlock || null;

        // Update chunk with Phase A data
        await prisma.documentChunk.update({
          where: { id: chunk.id },
          data: {
            sheetNumber: sheetNumber || chunk.sheetNumber,
            titleBlockData: titleBlockJson || chunk.titleBlockData || undefined,
            primaryScale: scaleData.primaryScale,
            scaleRatio: scaleData.scaleRatio,
            scaleType: scaleData.scaleType,
            hasMultipleScales: scaleData.hasMultipleScales,
            scaleData: scaleData.primaryScale ? scaleData : undefined,
          },
        });
      }
      
      result.phaseResults.phaseA = phaseAResult;
      logger.info('PHASE_A', 'Phase A complete', { titleBlocks: phaseAResult.titleBlocksExtracted, scales: phaseAResult.scalesDetected });
    }

    // PHASE B - Advanced Features
    if (phases.includes('B')) {
      logger.info('PHASE_B', 'Starting Advanced Features phase');
      result.phasesRun.push('B');
      
      const phaseBResult: PhaseBResult = {
        dimensionsExtracted: 0,
        annotationsFound: 0,
        calloutsExtracted: 0,
        roomsIdentified: 0,
      };
      
      for (const chunk of chunks) {
        const content = chunk.content || '';
        
        // Extract dimensions
        const { dimensions, dimensionCount } = extractDimensions(content);
        if (dimensionCount > 0) {
          phaseBResult.dimensionsExtracted += dimensionCount;
        }
        
        // Extract annotations and callouts
        const { annotations, callouts } = extractAnnotations(content);
        phaseBResult.annotationsFound += annotations.length;
        phaseBResult.calloutsExtracted += callouts.length;
        
        // Extract cross-references
        const crossRefs = extractCrossReferences(content);
        
        // Update chunk with Phase B data
        await prisma.documentChunk.update({
          where: { id: chunk.id },
          data: {
            dimensions: dimensions.length > 0 ? dimensions : undefined,
            dimensionCount: dimensionCount,
            annotations: annotations.length > 0 ? annotations : undefined,
            callouts: callouts.length > 0 ? callouts : undefined,
            crossReferences: crossRefs.length > 0 ? crossRefs : undefined,
          },
        });
      }
      
      result.phaseResults.phaseB = phaseBResult;
      logger.info('PHASE_B', 'Phase B complete', { dimensions: phaseBResult.dimensionsExtracted, annotations: phaseBResult.annotationsFound, callouts: phaseBResult.calloutsExtracted });
    }

    // PHASE C - Advanced Intelligence
    if (phases.includes('C')) {
      logger.info('PHASE_C', 'Starting Advanced Intelligence phase');
      result.phasesRun.push('C');
      
      const phaseCResult: PhaseCResult = {
        spatialCorrelationsBuilt: 0,
        mepElementsMapped: 0,
        symbolsLearned: 0,
      };
      
      // Build spatial correlation map
      const sheetMap: Map<string, string[]> = new Map();
      
      for (const chunk of chunks) {
        const content = chunk.content || '';
        
        // Detect drawing type
        const { drawingType, confidence } = detectDrawingType(content, chunk.sheetNumber || undefined);
        if (drawingType !== 'unknown') {
          phaseCResult.spatialCorrelationsBuilt++;
        }
        
        // Detect MEP discipline
        const mepDiscipline = detectMEPDiscipline(content);
        if (mepDiscipline) {
          phaseCResult.mepElementsMapped++;
        }
        
        // Track sheets for correlation
        if (chunk.sheetNumber) {
          const refs = extractCrossReferences(content);
          if (refs.length > 0) {
            sheetMap.set(chunk.sheetNumber, refs);
          }
        }
        
        // Symbol learning (count unique symbols mentioned)
        const symbolMatches = content.match(/symbol|legend|key|\/[A-Z]\d+/gi) || [];
        phaseCResult.symbolsLearned += symbolMatches.length;
        
        // Update chunk with Phase C data
        await prisma.documentChunk.update({
          where: { id: chunk.id },
          data: {
            drawingType: drawingType !== 'unknown' ? drawingType : undefined,
            drawingTypeConfidence: confidence > 0 ? confidence : undefined,
            discipline: mepDiscipline || chunk.discipline,
            drawingCategory: drawingType !== 'unknown' ? drawingType : undefined,
            metadata: {
              ...(chunk.metadata as object || {}),
              phaseCProcessed: true,
              spatialReferences: sheetMap.get(chunk.sheetNumber || '') || [],
              mepElements: mepDiscipline ? [mepDiscipline] : [],
            },
          },
        });
      }
      
      result.phaseResults.phaseC = phaseCResult;
      logger.info('PHASE_C', 'Phase C complete', { spatialCorrelations: phaseCResult.spatialCorrelationsBuilt, mepElements: phaseCResult.mepElementsMapped, symbols: phaseCResult.symbolsLearned });
    }

    // Post-extraction enrichment
    try {
      logger.info('INTELLIGENCE', 'Running post-extraction enrichment', { documentId });

      const projectId = document.projectId;

      const enrichmentResults = await Promise.allSettled([
        resolveCrossReferences(documentId),
        parseDrawingSchedules(documentId, projectId),
        extractFixtures(documentId, projectId),
        aggregateSpatialData(documentId),
      ]);

      const enrichmentNames = ['crossReferences', 'scheduleParser', 'fixtureExtractor', 'spatialAggregator'];
      enrichmentResults.forEach((result, i) => {
        if (result.status === 'rejected') {
          logger.warn('INTELLIGENCE', `Enrichment module ${enrichmentNames[i]} failed`, {
            documentId,
            error: result.reason?.message || String(result.reason),
          });
        }
      });

      // Sheet index depends on the above completing first
      await buildSheetIndex(documentId);

      // Aggregate keynotes and note clauses from chunk metadata for downstream consumers
      try {
        const enrichedChunks = await prisma.documentChunk.findMany({
          where: { documentId },
          select: { metadata: true },
        });

        let allKeynotes: any[] = [];
        let allNoteClauses: any[] = [];

        for (const chunk of enrichedChunks) {
          const meta = chunk.metadata as Record<string, any> | null;
          if (!meta) continue;
          if (meta.keynotes?.length) allKeynotes = allKeynotes.concat(meta.keynotes);
          if (meta.noteClauses?.length) allNoteClauses = allNoteClauses.concat(meta.noteClauses);
        }

        if (allKeynotes.length > 0 || allNoteClauses.length > 0) {
          // Store aggregated keynotes/notes on the document for downstream enrichment modules
          const currentDoc = await prisma.document.findUnique({
            where: { id: documentId },
            select: { sheetIndex: true }
          });
          const existingIndex = (currentDoc?.sheetIndex as Record<string, any>) || {};

          await prisma.document.update({
            where: { id: documentId },
            data: {
              sheetIndex: {
                ...existingIndex,
                aggregatedKeynotes: allKeynotes,
                aggregatedNoteClauses: allNoteClauses,
              } as any,
            },
          });
          logger.info('INTELLIGENCE', 'Aggregated keynotes and note clauses', {
            documentId,
            keynoteCount: allKeynotes.length,
            noteClauseCount: allNoteClauses.length,
          });
        }
      } catch (aggregationError) {
        logger.warn('INTELLIGENCE', 'Keynote/note clause aggregation failed (non-blocking)', {
          documentId,
          error: (aggregationError as Error).message,
        });
      }

      logger.info('INTELLIGENCE', 'Post-extraction enrichment complete', { documentId });
    } catch (enrichmentError) {
      logger.warn('INTELLIGENCE', 'Post-extraction enrichment failed (non-blocking)', {
        documentId,
        error: (enrichmentError as Error).message,
      });
      // Non-blocking: don't fail the document processing if enrichment fails
    }

    // Phase: Architectural Style Inference (for render quality)
    try {
      const chunks = await prisma.documentChunk.findMany({
        where: { documentId },
        select: { metadata: true },
      });

      const project = await prisma.project.findUnique({
        where: { id: document.projectId },
        select: { architecturalStyle: true },
      });

      // Only infer if not already set by user
      if (!project?.architecturalStyle && chunks.length > 0) {
        const styleSignals: Record<string, number> = {
          modern: 0, traditional: 0, industrial: 0, contemporary: 0,
          colonial: 0, craftsman: 0, mediterranean: 0, farmhouse: 0,
        };

        for (const chunk of chunks) {
          const meta = chunk.metadata as Record<string, any> | null;
          if (!meta) continue;

          // Analyze roof data
          const roofData = meta.specialDrawingData?.roofData;
          if (roofData?.roofType) {
            const roofType = roofData.roofType.toLowerCase();
            if (roofType.includes('flat')) { styleSignals.modern += 2; styleSignals.industrial += 1; }
            if (roofType.includes('gable')) { styleSignals.traditional += 2; styleSignals.craftsman += 1; styleSignals.farmhouse += 1; }
            if (roofType.includes('hip')) { styleSignals.traditional += 1; styleSignals.mediterranean += 1; }
            if (roofType.includes('mansard')) { styleSignals.traditional += 2; }
          }

          // Analyze exterior materials
          const elevData = meta.specialDrawingData?.exteriorElevation;
          if (elevData?.facadeMaterials) {
            for (const facade of elevData.facadeMaterials) {
              const mat = (facade.material || '').toLowerCase();
              if (mat.includes('curtain wall') || mat.includes('glass')) { styleSignals.modern += 3; styleSignals.contemporary += 2; }
              if (mat.includes('brick')) { styleSignals.traditional += 2; styleSignals.colonial += 1; }
              if (mat.includes('stone')) { styleSignals.traditional += 1; styleSignals.mediterranean += 1; }
              if (mat.includes('stucco')) { styleSignals.mediterranean += 2; }
              if (mat.includes('metal') || mat.includes('steel')) { styleSignals.industrial += 2; styleSignals.modern += 1; }
              if (mat.includes('wood') || mat.includes('cedar') || mat.includes('siding')) { styleSignals.craftsman += 2; styleSignals.farmhouse += 2; }
              if (mat.includes('fiber cement') || mat.includes('hardie')) { styleSignals.contemporary += 1; styleSignals.farmhouse += 1; }
            }
          }

          // Analyze visual materials for overall palette
          if (meta.visualMaterials) {
            for (const vm of meta.visualMaterials) {
              const mat = (vm.material || '').toLowerCase();
              if (mat.includes('exposed concrete') || mat.includes('board-form')) { styleSignals.industrial += 2; styleSignals.modern += 1; }
              if (mat.includes('timber') || mat.includes('heavy timber')) { styleSignals.craftsman += 2; }
            }
          }
        }

        // Find the style with the highest score (min threshold of 3)
        const sorted = Object.entries(styleSignals).sort((a, b) => b[1] - a[1]);
        if (sorted[0][1] >= 3) {
          const inferredStyle = sorted[0][0];
          await prisma.project.update({
            where: { id: document.projectId },
            data: { architecturalStyle: inferredStyle },
          });
          logger.info('INTELLIGENCE', 'Inferred architectural style', {
            documentId,
            projectId: document.projectId,
            inferredStyle,
            confidence: sorted[0][1],
            topStyles: sorted.slice(0, 3).map(([s, c]) => `${s}:${c}`),
          });
        }
      }
    } catch (styleError: unknown) {
      const errMsg = styleError instanceof Error ? styleError.message : String(styleError);
      logger.warn('INTELLIGENCE', 'Architectural style inference failed (non-blocking)', {
        documentId,
        error: errMsg,
      });
    }

    // Phase: Quantity Calculations (after sheet index is built)
    try {
      const { runQuantityCalculations } = await import('./quantity-calculation-orchestrator');
      await runQuantityCalculations(documentId);
      logger.info('INTELLIGENCE_ORCHESTRATOR', 'Quantity calculations completed', { documentId });
    } catch (calcError: unknown) {
      const errMsg = calcError instanceof Error ? calcError.message : String(calcError);
      logger.warn('INTELLIGENCE_ORCHESTRATOR', 'Quantity calculations failed (non-blocking)', { documentId, error: errMsg });
    }

    // Phase: Auto-generate MaterialTakeoff from calculations
    try {
      const { generateTakeoffFromCalculations } = await import('./calculated-takeoff-generator');
      await generateTakeoffFromCalculations(documentId, document.projectId, 'system');
      logger.info('INTELLIGENCE_ORCHESTRATOR', 'Calculated takeoff generation completed', { documentId });
    } catch (takeoffError: unknown) {
      const errMsg = takeoffError instanceof Error ? takeoffError.message : String(takeoffError);
      logger.warn('INTELLIGENCE_ORCHESTRATOR', 'Calculated takeoff generation failed (non-blocking)', { documentId, error: errMsg });
    }

    result.success = true;
    logger.info('INTELLIGENCE_ORCHESTRATOR', 'Intelligence extraction completed');

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(errMsg);
    logger.error('INTELLIGENCE_ORCHESTRATOR', 'Intelligence extraction failed', error);
  }

  return result;
}

/**
 * Extract all intelligence (Phase A + B + C)
 */
export async function extractAllIntelligence(documentId: string, projectSlug: string): Promise<ExtractionResult> {
  return runIntelligenceExtraction({
    documentId,
    projectSlug,
    phases: ['A', 'B', 'C'],
  });
}

/**
 * Re-extract only Phase C (useful after Phase A/B are complete)
 */
export async function extractPhaseCOnly(documentId: string, projectSlug: string): Promise<ExtractionResult> {
  return runIntelligenceExtraction({
    documentId,
    projectSlug,
    phases: ['C'],
    skipExisting: true,
  });
}

/**
 * Get extraction statistics for a document
 */
export async function getExtractionStats(documentId: string) {
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId },
    select: {
      id: true,
      pageNumber: true,
      sheetNumber: true,
      scaleData: true,
      metadata: true,
    },
  });

  const stats = {
    totalPages: chunks.length,
    withTitleBlocks: chunks.filter((c: any) => c.sheetNumber).length,
    withScales: chunks.filter((c: any) => c.scaleData).length,
    withMetadata: chunks.filter((c: any) => c.metadata && Object.keys(c.metadata as any).length > 0).length,
  };

  return stats;
}
