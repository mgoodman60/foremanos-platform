/**
 * Intelligence Queries Module — Phase A/B RAG Integrations
 *
 * Contains all Phase A and Phase B query detection and context retrieval
 * functions for the intelligence pipeline.
 *
 * Phase A queries:
 * - isSymbolQuery, getLegendContext, getSymbolLibrarySummary
 * - isScaleQuery, getScaleContext
 * - isDrawingTypeQuery, getDrawingTypeContext, formatScaleType
 *
 * Phase B queries:
 * - retrievePhaseBContext
 * - enrichWithPhaseAMetadata
 * - getPhaseARAGInstructions, getPhaseBRAGInstructions
 * - isCalloutQuery, getCalloutContext
 * - isDimensionQuery, getDimensionContext
 * - isAnnotationQuery, getAnnotationContext
 * - enhanceSymbolContextWithStandardLibrary
 *
 * Phase C:
 * - generateEnhancedContext (rag.ts version)
 * - isSpatialQuery, isMEPQuery
 * - getSpatialIntelligence, getMEPIntelligence
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { buildProjectLegendLibrary, searchSymbol, type LegendEntry } from '@/lib/legend-extractor';
import { logger } from '@/lib/logger';
import type {
  AdminCorrection,
  AnnotationItem,
  ChunkMetadata,
  DimensionData,
  DimensionItem,
  DocumentChunk,
  ScaleData,
  TitleBlockData,
} from './core-types';
import { generateContextWithCorrections } from './regulatory-retrieval';

// ============================================================================
// LEGEND CONTEXT (Phase A.2)
// ============================================================================

/**
 * Detect if a query is asking about symbols or abbreviations
 */
export function isSymbolQuery(query: string): boolean {
  const symbolKeywords = [
    'symbol', 'legend', 'key', 'abbreviation', 'code',
    'what does', 'what is', 'meaning of', 'definition',
    'represent', 'indicate', 'denote', 'stand for'
  ];

  const queryLower = query.toLowerCase();
  return symbolKeywords.some(keyword => queryLower.includes(keyword));
}

/**
 * Get legend context for a query
 */
export async function getLegendContext(
  query: string,
  projectSlug: string
): Promise<string> {
  try {
    // Search for relevant symbols
    const searchResults = await searchSymbol(projectSlug, query);

    if (searchResults.length === 0) {
      return '';
    }

    let context = '\n\n=== LEGEND/SYMBOL DEFINITIONS ===\n';
    context += `Found ${searchResults.length} matching symbol(s) in project legends:\n\n`;

    searchResults.forEach((entry: LegendEntry, idx: number) => {
      context += `${idx + 1}. ${entry.symbolCode}: ${entry.symbolDescription}\n`;
      if (entry.category) {
        context += `   Category: ${entry.category}\n`;
      }
      if (entry.discipline) {
        context += `   Discipline: ${entry.discipline}\n`;
      }
      context += '\n';
    });

    return context;
  } catch (error) {
    logger.error('RAG', 'Error getting legend context', error as Error);
    return '';
  }
}

/**
 * Get symbol library summary for a project
 */
export async function getSymbolLibrarySummary(
  projectSlug: string
): Promise<string> {
  try {
    const library = await buildProjectLegendLibrary(projectSlug);

    if (library.totalSymbols === 0) {
      return '';
    }

    let summary = '\n\n=== PROJECT SYMBOL LIBRARY ===\n';
    summary += `Total symbols defined: ${library.totalSymbols}\n\n`;

    // Categories
    summary += 'Symbols by category:\n';
    Object.entries(library.byCategory).forEach(([category, entries]) => {
      summary += `  \u2022 ${category}: ${entries.length} symbols\n`;
    });

    // Disciplines
    if (Object.keys(library.byDiscipline).length > 0) {
      summary += '\nSymbols by discipline:\n';
      Object.entries(library.byDiscipline).forEach(([discipline, entries]) => {
        summary += `  \u2022 ${discipline}: ${entries.length} symbols\n`;
      });
    }

    return summary;
  } catch (error) {
    logger.error('RAG', 'Error getting symbol library summary', error as Error);
    return '';
  }
}


// ============================================================================
// SCALE & DIMENSION INTELLIGENCE (Phase A.3)
// ============================================================================

/**
 * Detect if query is related to scales or dimensions
 */
export function isScaleQuery(query: string): boolean {
  const scaleKeywords = [
    'scale', 'dimension', 'measurement', 'distance', 'length',
    'width', 'height', 'area', 'volume', 'size', 'footage',
    'square feet', 'cubic', 'how big', 'how large', 'how long',
    'how wide', 'how tall', 'quantity', 'takeoff', 'calculation'
  ];

  const queryLower = query.toLowerCase();
  return scaleKeywords.some(keyword => queryLower.includes(keyword));
}

/**
 * Get scale context for dimension-related queries
 */
export async function getScaleContext(
  query: string,
  projectSlug: string
): Promise<string> {
  try {
    // Get project
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
    });

    if (!project) return '';

    // Extract sheet number from query if present
    const sheetMatch = query.match(/(?:sheet|drawing|plan)\s*[#\-]?\s*([A-Z]-?\d+(?:\.\d+)?)/i);
    const sheetNumber = sheetMatch ? sheetMatch[1] : null;

    // Get scales for the project
    const whereClause: Prisma.DocumentChunkWhereInput = {
      Document: { projectId: project.id },
      scaleData: { not: Prisma.DbNull },
    };

    if (sheetNumber) {
      whereClause.sheetNumber = sheetNumber;
    }

    const chunks = await prisma.documentChunk.findMany({
      where: whereClause,
      select: {
        sheetNumber: true,
        scaleData: true,
      },
      distinct: ['sheetNumber'],
      take: 10,
    });

    if (chunks.length === 0) {
      return '';
    }

    let context = '\n\n=== SCALE INFORMATION ===\n';

    if (sheetNumber) {
      context += `Scale information for sheet ${sheetNumber}:\n\n`;
    } else {
      context += `Available scales in project (${chunks.length} sheets):\n\n`;
    }

    chunks.forEach((chunk) => {
      if (!chunk.scaleData) return;

      const scaleData = chunk.scaleData as ScaleData;
      context += `Sheet ${chunk.sheetNumber}:\n`;
      context += `  Scale: ${scaleData.primaryScale?.scaleString || 'Unknown'}\n`;
      context += `  Ratio: ${scaleData.primaryScale?.scaleRatio || 'N/A'}\n`;
      context += `  Format: ${scaleData.primaryScale?.format || 'N/A'}\n`;
      if (scaleData.hasMultipleScales) {
        context += `  \u26A0\uFE0F  Multiple scales on this sheet (${scaleData.scaleCount} total)\n`;
        if (scaleData.secondaryScales && scaleData.secondaryScales.length > 0) {
          scaleData.secondaryScales.forEach((s) => {
            context += `     - ${s.scaleString} ${s.viewportName ? `(${s.viewportName})` : ''}\n`;
          });
        }
      }
      context += '\n';
    });

    context += '\n\u{1F4A1} SCALE USAGE GUIDELINES:\n';
    context += '\u2022 Use the scale ratio for accurate dimension calculations\n';
    context += '\u2022 For sheets with multiple scales, verify which viewport/detail applies\n';
    context += '\u2022 NTS (Not To Scale) drawings cannot be measured accurately\n';
    context += '\u2022 Always include units (feet, inches, meters) in your responses\n';

    return context;
  } catch (error) {
    logger.error('RAG', 'Error getting scale context', error as Error);
    return '';
  }
}

/**
 * Detect if query is related to drawing types or needs drawing type context
 */
export function isDrawingTypeQuery(query: string): boolean {
  const drawingTypeKeywords = [
    'floor plan', 'elevation', 'section', 'detail', 'schedules',
    'what sheet', 'which drawing', 'what type', 'drawing type',
    'plan shows', 'drawing shows', 'sheet shows',
    'architectural', 'structural', 'mechanical', 'electrical', 'plumbing',
    'hvac', 'mep', 'site plan', 'roof plan', 'ceiling plan',
    'framing plan', 'foundation plan', 'civil', 'landscape'
  ];

  const queryLower = query.toLowerCase();
  return drawingTypeKeywords.some(keyword => queryLower.includes(keyword));
}

/**
 * Get drawing type context for RAG (Phase A.4)
 * Helps AI understand what type of drawing is being referenced
 */
export async function getDrawingTypeContext(
  query: string,
  projectSlug: string
): Promise<string> {
  try {
    // Get project
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
    });

    if (!project) return '';

    // Extract sheet number from query if present
    const sheetMatch = query.match(/(?:sheet|drawing|plan)\s*[#\-]?\s*([A-Z]-?\d+(?:\.\d+)?)/i);
    const sheetNumber = sheetMatch ? sheetMatch[1] : null;

    // Detect drawing type keywords in query
    const queryLower = query.toLowerCase();
    const drawingTypeKeywords: Record<string, string[]> = {
      floor_plan: ['floor plan', 'floor layout', 'level', 'typical floor'],
      elevation: ['elevation', 'exterior view', 'building elevation'],
      section: ['section', 'wall section', 'building section'],
      detail: ['detail', 'enlarged', 'connection detail'],
      schedule: ['schedules', 'door schedule', 'window schedule', 'finish schedule'],
      mechanical: ['hvac', 'mechanical', 'ductwork', 'air handling'],
      electrical: ['electrical', 'power', 'lighting', 'panel'],
      plumbing: ['plumbing', 'water', 'sanitary', 'waste'],
      site_plan: ['site plan', 'site layout', 'grading'],
      roof_plan: ['roof', 'roofing'],
    };

    let matchedType: string | null = null;
    for (const [type, keywords] of Object.entries(drawingTypeKeywords)) {
      if (keywords.some(kw => queryLower.includes(kw))) {
        matchedType = type.toUpperCase();
        break;
      }
    }

    // Build query for drawing types
    const drawingTypeWhere: Prisma.DrawingTypeWhereInput = { projectId: project.id };
    if (sheetNumber) {
      drawingTypeWhere.sheetNumber = sheetNumber;
    } else if (matchedType) {
      drawingTypeWhere.type = matchedType;
    }

    const drawingTypes = await prisma.drawingType.findMany({
      where: drawingTypeWhere,
      select: {
        sheetNumber: true,
        type: true,
        subtype: true,
        confidence: true,
        features: true,
        reasoning: true,
      },
      orderBy: { confidence: 'desc' },
      take: 10,
    });

    if (drawingTypes.length === 0) {
      return '';
    }

    // Format drawing type labels
    const typeLabels: Record<string, string> = {
      FLOOR_PLAN: 'Floor Plan',
      ELEVATION: 'Elevation',
      SECTION: 'Section',
      DETAIL: 'Detail',
      SCHEDULE: 'Schedule',
      SITE_PLAN: 'Site Plan',
      ROOF_PLAN: 'Roof Plan',
      REFLECTED_CEILING: 'Reflected Ceiling Plan',
      MECHANICAL: 'Mechanical/HVAC',
      ELECTRICAL: 'Electrical',
      PLUMBING: 'Plumbing',
      FIRE_PROTECTION: 'Fire Protection',
      STRUCTURAL: 'Structural',
      CIVIL: 'Civil',
    };

    const subtypeLabels: Record<string, string> = {
      ARCHITECTURAL: 'Architectural',
      STRUCTURAL: 'Structural',
      MECHANICAL: 'Mechanical',
      ELECTRICAL: 'Electrical',
      PLUMBING: 'Plumbing',
      FIRE_PROTECTION: 'Fire Protection',
      CIVIL: 'Civil',
      GENERAL: 'General',
    };

    let context = '\n\n=== DRAWING TYPE INFORMATION ===\n';

    if (sheetNumber) {
      context += `Drawing type for sheet ${sheetNumber}:\n\n`;
    } else {
      context += `Available drawing types in project (${drawingTypes.length} sheets):\n\n`;
    }

    drawingTypes.forEach((dt) => {
      const typeLabel = typeLabels[dt.type] || dt.type;
      const subtypeLabel = subtypeLabels[dt.subtype] || dt.subtype;
      const confidence = (dt.confidence * 100).toFixed(0);

      context += `Sheet ${dt.sheetNumber}:\n`;
      context += `  Type: ${typeLabel}\n`;
      context += `  Discipline: ${subtypeLabel}\n`;
      context += `  Confidence: ${confidence}%\n`;

      if (dt.features && (dt.features as string[]).length > 0) {
        context += `  Key Features: ${(dt.features as string[]).slice(0, 3).join(', ')}\n`;
      }

      if (dt.reasoning) {
        context += `  Classification: ${dt.reasoning}\n`;
      }
      context += '\n';
    });

    context += '\n\u{1F4A1} DRAWING TYPE USAGE GUIDELINES:\n';
    context += '\u2022 Floor Plans: Show room layouts, doors, windows, and spatial relationships\n';
    context += '\u2022 Elevations: Show exterior/interior vertical views and heights\n';
    context += '\u2022 Sections: Show cut-through views with construction details\n';
    context += '\u2022 Details: Show enlarged views of specific connections or assemblies\n';
    context += '\u2022 Schedules: List specifications for doors, windows, finishes, equipment\n';
    context += '\u2022 MEP Drawings: Show mechanical, electrical, and plumbing systems\n';
    context += '\u2022 Consider drawing type when interpreting symbols and annotations\n';

    return context;
  } catch (error) {
    logger.error('RAG', 'Error getting drawing type context', error as Error);
    return '';
  }
}

/**
 * Format scale type for display
 */
export function formatScaleType(type: string): string {
  const labels: Record<string, string> = {
    architectural_imperial: 'Architectural (Imperial)',
    architectural_metric: 'Architectural (Metric)',
    engineering: 'Engineering',
    metric_standard: 'Metric Standard',
    full_size: 'Full Size (1:1)',
    not_to_scale: 'Not To Scale (NTS)',
  };
  return labels[type] || type;
}

/**
 * Retrieve Phase B Intelligence Context from Database
 *
 * Fetches detail callouts, dimensions, annotations, and symbols from the database
 * based on the query type and provides enriched context for RAG responses.
 */
export async function retrievePhaseBContext(
  query: string,
  projectSlug: string,
  chunks: DocumentChunk[]
): Promise<string> {
  try {
    const lower = query.toLowerCase();
    let context = '';

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true }
    });

    if (!project) return '';

    // Check if query is about cross-references, details, or callouts
    const isCalloutQueryLocal =
      lower.includes('detail') ||
      lower.includes('section') ||
      lower.includes('reference') ||
      lower.includes('see sheet') ||
      lower.includes('refer to') ||
      lower.includes('callout') ||
      lower.includes('elevation') ||
      lower.includes('isometric');

    // Check if query is about dimensions or measurements
    const isDimensionQueryLocal =
      lower.includes('dimension') ||
      lower.includes('measurement') ||
      lower.includes('how long') ||
      lower.includes('how wide') ||
      lower.includes('how tall') ||
      lower.includes('height') ||
      lower.includes('length') ||
      lower.includes('width') ||
      lower.includes('thickness') ||
      lower.includes('clearance') ||
      lower.includes('distance') ||
      lower.includes('spacing');

    // Check if query is about notes, warnings, or annotations
    const isAnnotationQueryLocal =
      lower.includes('note') ||
      lower.includes('warning') ||
      lower.includes('caution') ||
      lower.includes('requirement') ||
      lower.includes('specification') ||
      lower.includes('code') ||
      lower.includes('instruction') ||
      lower.includes('material') ||
      lower.includes('shall') ||
      lower.includes('must');

    // Check if query is about symbols or legend
    const isSymbolQueryLocal =
      lower.includes('symbol') ||
      lower.includes('legend') ||
      lower.includes('what is') ||
      lower.includes('what does') ||
      lower.includes('means');

    // Add callout/cross-reference context
    if (isCalloutQueryLocal) {
      const callouts = await prisma.detailCallout.findMany({
        where: { projectId: project.id },
        include: {
          Document: {
            select: { name: true }
          }
        },
        take: 20,
        orderBy: { confidence: 'desc' }
      });

      if (callouts.length > 0) {
        context += '\n=== DETAIL CALLOUTS & CROSS-REFERENCES ===\n';

        // Group by source sheet
        type CalloutWithDocument = typeof callouts[number];
        const bySheet = callouts.reduce<Record<string, CalloutWithDocument[]>>((acc, callout) => {
          const sheet = callout.sourceSheet || 'Unknown';
          if (!acc[sheet]) acc[sheet] = [];
          acc[sheet].push(callout);
          return acc;
        }, {});

        Object.entries(bySheet).slice(0, 5).forEach(([sheet, sheetCallouts]) => {
          context += `\nSheet ${sheet} (${sheetCallouts[0].Document?.name || 'Unknown'}):\n`;
          sheetCallouts.slice(0, 15).forEach((callout) => {
            context += `  \u2022 ${callout.type?.toUpperCase() || 'DETAIL'}: ${callout.number || ''} `;
            if (callout.sheetReference) {
              context += `\u2192 See Sheet ${callout.sheetReference}`;
            }
            if (callout.description) {
              context += `\n    ${callout.description}`;
            }
            context += `\n`;
          });
        });
        context += '\n';
      }
    }

    // Add dimension context
    if (isDimensionQueryLocal) {
      const dimensions = await prisma.dimensionAnnotation.findMany({
        where: { projectId: project.id },
        include: {
          Document: {
            select: { name: true }
          }
        },
        take: 15,
        orderBy: { confidence: 'desc' }
      });

      if (dimensions.length > 0) {
        context += '\n=== EXTRACTED DIMENSIONS ===\n';

        // Extract keywords from query
        const queryWords = query.toLowerCase().split(/\s+/);

        // Helper to parse dimension data
        const parseDimensionData = (data: Prisma.JsonValue): DimensionItem[] => {
          return Array.isArray(data) ? data as DimensionItem[] : (data ? [data as DimensionItem] : []);
        };

        // Filter dimensions relevant to query
        type DimensionWithDocument = typeof dimensions[number];
        const relevantDims = dimensions.filter((dim) => {
          const dimArray = parseDimensionData(dim.dimensions);
          const text = dimArray.map((item) => [
            item.originalText || '',
            item.context || '',
            item.type || '',
            dim.sheetNumber || ''
          ].join(' ')).join(' ').toLowerCase();

          return queryWords.some(word => text.includes(word)) || dimArray.some((item) => item.critical);
        }).slice(0, 10);

        // Group by sheet
        const dimsBySheet = relevantDims.reduce<Record<string, DimensionWithDocument[]>>((acc, dim) => {
          const sheet = dim.sheetNumber || 'Unknown';
          if (!acc[sheet]) acc[sheet] = [];
          acc[sheet].push(dim);
          return acc;
        }, {});

        Object.entries(dimsBySheet).slice(0, 5).forEach(([sheet, sheetDims]) => {
          context += `\nSheet ${sheet}:\n`;
          sheetDims.forEach((dim) => {
            const dimArray = parseDimensionData(dim.dimensions);
            dimArray.slice(0, 3).forEach((item) => {
              context += `  \u2022 ${item.originalText || ''}`;
              if (item.context) {
                context += ` - ${item.context}`;
              }
              if (item.critical) {
                context += ` [CRITICAL]`;
              }
              context += ` (${Math.round((item.confidence || dim.confidence) * 100)}% confidence)\n`;
            });
          });
        });
        context += '\n';
      }
    }

    // Add annotation context
    if (isAnnotationQueryLocal) {
      const annotations = await prisma.enhancedAnnotation.findMany({
        where: { projectId: project.id },
        include: {
          Document: {
            select: { name: true }
          }
        },
        take: 20,
        orderBy: { confidence: 'desc' }
      });

      if (annotations.length > 0) {
        context += '\n=== ANNOTATIONS & REQUIREMENTS ===\n';

        // Helper to parse annotation data
        const parseAnnotationData = (data: Prisma.JsonValue): AnnotationItem[] => {
          return Array.isArray(data) ? data as AnnotationItem[] : (data ? [data as AnnotationItem] : []);
        };

        // Helper to check priority
        const hasPriority = (data: Prisma.JsonValue, priority: string): boolean => {
          const parsed = parseAnnotationData(data);
          if (!Array.isArray(data) && data && typeof data === 'object' && 'priority' in data) {
            return (data as AnnotationItem).priority === priority;
          }
          return parsed.some((d) => d.priority === priority);
        };

        // Separate by priority
        const critical = annotations.filter((a) => hasPriority(a.annotations, 'critical'));
        const important = annotations.filter((a) => hasPriority(a.annotations, 'important'));
        const informational = annotations.filter((a) => hasPriority(a.annotations, 'informational'));

        if (critical.length > 0) {
          context += '\n\u26A0\uFE0F  CRITICAL ANNOTATIONS:\n';
          critical.slice(0, 5).forEach((ann) => {
            const annArray = parseAnnotationData(ann.annotations);
            annArray.slice(0, 2).forEach((item) => {
              context += `  \u2022 [${item.type?.toUpperCase() || 'NOTE'}] ${item.text || ''}\n`;
              if (item.requirements && item.requirements.length > 0) {
                item.requirements.slice(0, 2).forEach((req) => {
                  context += `    \u2713 ${req}\n`;
                });
              }
            });
          });
        }

        if (important.length > 0) {
          context += '\n\u26A1 IMPORTANT ANNOTATIONS:\n';
          important.slice(0, 5).forEach((ann) => {
            const annArray = parseAnnotationData(ann.annotations);
            annArray.slice(0, 2).forEach((item) => {
              context += `  \u2022 [${item.type?.toUpperCase() || 'NOTE'}] ${item.text || ''}\n`;
            });
          });
        }

        if (informational.length > 0 && !critical.length && !important.length) {
          context += '\n\u{1F4DD} INFORMATIONAL NOTES:\n';
          informational.slice(0, 5).forEach((ann) => {
            const annArray = parseAnnotationData(ann.annotations);
            annArray.slice(0, 3).forEach((item) => {
              context += `  \u2022 ${item.text || ''}\n`;
            });
          });
        }
        context += '\n';
      }
    }

    // Add symbol context
    if (isSymbolQueryLocal) {
      // Extract potential symbol code from query
      const symbolMatch = query.match(/\b([A-Z]{1,3}[0-9-]+|[A-Z]+)\b/);
      if (symbolMatch) {
        const code = symbolMatch[1];
        const symbols = await searchSymbol(projectSlug, code);
        if (symbols && symbols.length > 0) {
          context += '\n=== SYMBOL DEFINITION ===\n';
          symbols.slice(0, 3).forEach(symbol => {
            context += `Symbol ${symbol.symbolCode}: ${symbol.symbolDescription}\n`;
            context += `Category: ${symbol.category}`;
            if (symbol.discipline) {
              context += ` | Discipline: ${symbol.discipline}`;
            }
            context += `\n`;
            context += `Confidence: ${Math.round(symbol.confidence * 100)}%\n\n`;
          });
        }
      }
    }

    return context;
  } catch (error) {
    logger.error('RAG', 'Error retrieving Phase B context', error as Error);
    return '';
  }
}

/**
 * Enrich document chunks with Phase A & B intelligence (Title Blocks, Legends, Dimensions)
 * @param chunks The document chunks to enrich
 * @param projectSlug The project slug for context
 * @returns Enriched chunks with title block, legend, and dimension metadata
 */
export async function enrichWithPhaseAMetadata(
  chunks: DocumentChunk[],
  projectSlug: string
): Promise<DocumentChunk[]> {
  try {
    // Get project ID
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true },
    });

    if (!project) {
      return chunks;
    }

    // Get document IDs from chunks (filter out null values)
    const documentIds = [...new Set(chunks.map(c => c.documentId).filter(Boolean))] as string[];

    // Fetch title block, dimension data, and other metadata for these documents
    const allChunks = await prisma.documentChunk.findMany({
      where: {
        documentId: { in: documentIds },
      },
      select: {
        id: true,
        documentId: true,
        sheetNumber: true,
        titleBlockData: true,
        revision: true,
        dateIssued: true,
        discipline: true,
        dimensions: true,
        dimensionCount: true,
        dimensionSummary: true,
      },
    });

    // Filter to only chunks with title block data
    const titleBlocksByDoc = allChunks.filter((chunk) => chunk.titleBlockData !== null);

    // Create dimension lookup by chunk ID
    const dimensionMap = new Map<string, DimensionData>(
      allChunks
        .filter((c) => c.dimensions && c.dimensionCount && c.dimensionCount > 0)
        .map((c) => [c.id, {
          dimensions: c.dimensions,
          dimensionCount: c.dimensionCount!,
          dimensionSummary: c.dimensionSummary,
        }])
    );

    // Fetch legend data for this project
    const legends = await prisma.sheetLegend.findMany({
      where: {
        projectId: project.id,
        documentId: { in: documentIds },
      },
      select: {
        sheetNumber: true,
        legendEntries: true,
        discipline: true,
      },
    });

    // Create lookup maps
    type TitleBlockEntry = typeof allChunks[number];
    const titleBlockMap = new Map<string, TitleBlockEntry>(
      titleBlocksByDoc.map((tb) => [tb.sheetNumber || '', tb])
    );

    const legendMap = new Map<string, Prisma.JsonValue>(
      legends.map((l) => [l.sheetNumber || '', l.legendEntries])
    );

    // Enrich chunks with Phase A metadata
    return chunks.map(chunk => {
      const meta: ChunkMetadata & Record<string, unknown> = { ...(chunk.metadata || {}) };
      const sheetNumber = meta.sheetNumber || chunk.sheetNumber;

      // Add title block data if available
      if (sheetNumber && titleBlockMap.has(sheetNumber)) {
        const titleBlock = titleBlockMap.get(sheetNumber);
        if (titleBlock && titleBlock.titleBlockData) {
          const tbData = titleBlock.titleBlockData as TitleBlockData;
          (meta as Record<string, unknown>).titleBlock = {
            projectName: tbData.projectName,
            projectNumber: tbData.projectNumber,
            sheetTitle: tbData.sheetTitle,
            dateIssued: tbData.issueDate,
            revision: tbData.revision,
            drawnBy: tbData.drawnBy,
            checkedBy: tbData.checkedBy,
            scale: tbData.scale,
          };
          (meta as Record<string, unknown>).hasTitleBlock = true;
        }
      }

      // Add legend data if available
      if (sheetNumber && legendMap.has(sheetNumber)) {
        const legendEntries = legendMap.get(sheetNumber);
        if (legendEntries && Array.isArray(legendEntries) && legendEntries.length > 0) {
          (meta as Record<string, unknown>).legendEntries = legendEntries;
          meta.hasLegend = true;
          meta.legendEntriesCount = legendEntries.length;
        }
      }

      // Add dimension data if available (Phase B.2)
      if (chunk.id && dimensionMap.has(chunk.id)) {
        const dimData = dimensionMap.get(chunk.id);
        if (dimData) {
          (meta as Record<string, unknown>).dimensions = dimData.dimensions;
          (meta as Record<string, unknown>).dimensionCount = dimData.dimensionCount;
          (meta as Record<string, unknown>).dimensionSummary = dimData.dimensionSummary;
          (meta as Record<string, unknown>).hasDimensions = true;
        }
      }

      return {
        ...chunk,
        metadata: meta as ChunkMetadata,
      };
    });
  } catch (error) {
    logger.error('RAG', 'Error enriching with Phase A metadata', error as Error);
    return chunks;
  }
}

/**
 * Phase A RAG Instructions - Title Block & Legend Intelligence
 */
export function getPhaseARAGInstructions(): string {
  return `
30. TITLE BLOCK INTELLIGENCE:
   - Always check title block metadata first when answering sheet-related questions
   - Use sheet numbers, disciplines, and revision info to provide accurate context
   - Reference the correct sheet title, project name, and dates from title blocks
   - When user asks "which sheet shows X", use discipline and sheet title to guide them
   - Format: "See Sheet [SHEET_NUMBER] - [SHEET_TITLE] ([DISCIPLINE])"

31. LEGEND & SYMBOL RECOGNITION:
   - When user asks about symbols, check extracted legend data first
   - Use legend entries to explain symbols, materials, and patterns
   - If symbol not in legend, mention "Symbol not found in project legend"
   - Provide category (Electrical, Mechanical, Plumbing, etc.) when known
   - Format symbol explanations as: "[SYMBOL_CODE]: [DESCRIPTION] ([CATEGORY])"

32. SHEET ORGANIZATION & NAVIGATION:
   - Use title block data to help users find information quickly
   - Group related sheets by discipline when listing multiple sheets
   - Mention revision info if user asks about latest version
   - Example: "The latest electrical plans are in sheets E-101 through E-105 (Revision 2, dated 2024-03-15)"

`;
}

/**
 * Enhanced RAG Instructions with Phase B Features
 */
export function getPhaseBRAGInstructions(): string {
  return `
33. DETAIL CALLOUTS & CROSS-REFERENCES:
   - When user asks about details, sections, or references to other sheets
   - Use extracted cross-reference data to identify related sheets
   - Always cite the specific sheet numbers referenced
   - Embed callout visualization cards using:
     \`\`\`json:callout-card
     {"callouts":[{"type":"detail","detailNumber":"3","sheetReference":"A-201","description":"Foundation detail","sheetNumber":"A-101","confidence":0.95}]}
     \`\`\`

34. DIMENSION INTELLIGENCE:
   - Use extracted dimensions when answering measurement questions
   - If dimension conflicts exist, note them explicitly
   - Always include confidence levels for critical dimensions
   - Embed dimension visualization cards using:
     \`\`\`json:dimension-card
     {"dimensions":[{"originalText":"12'-6\\"","value":12.5,"unit":"ft","type":"linear","context":"Wall height","critical":true,"confidence":0.92,"sheetNumber":"A-101"}]}
     \`\`\`

35. ENHANCED ANNOTATIONS:
   - Prioritize warnings and code references in responses
   - Reference keynotes by number when relevant
   - Always highlight critical safety warnings
   - Embed annotation visualization cards using:
     \`\`\`json:annotation-card
     {"annotations":[{"type":"warning","text":"All penetrations through fire-rated assemblies must be firestopped per IBC Section 714","priority":"critical","keywords":["firestopping","IBC 714"],"requirements":["Use approved firestopping materials","Maintain fire rating"],"sheetNumber":"A-101","confidence":0.95}]}
     \`\`\`

36. SYMBOL LIBRARY INTEGRATION:
   - Use industry standard symbol definitions when explaining drawings
   - Reference symbol variations when user asks about unfamiliar symbols
   - Embed symbol definition cards using:
     \`\`\`json:symbol-card
     {"code":"GFI","name":"Ground Fault Circuit Interrupter","category":"power","trade":"Electrical","standard":"NEC","alternativeCodes":["GFCI"],"description":"A safety device that protects against electrical shock","specReference":"NEC Article 210.8"}
     \`\`\`

37. PHASE B VISUALIZATION BEST PRACTICES:
   - Use dimension cards when user asks about sizes, clearances, or measurements
   - Use annotation cards when discussing requirements, warnings, or code references
   - Use callout cards when explaining cross-references or detail locations
   - Use symbol cards when defining or explaining construction symbols
   - Keep visualizations focused: max 5 items per card for readability
   - Always provide context around visualizations, don't just embed them alone
`;
}

// ============================================================
// PHASE B: ADVANCED INTELLIGENCE RAG INTEGRATIONS
// ============================================================

/**
 * Phase B.1: Detail Callout Detection
 */
export function isCalloutQuery(query: string): boolean {
  const keywords = [
    'detail', 'section', 'elevation', 'callout',
    'reference', 'see sheet', 'see drawing', 'refer to',
    'where is', 'what sheet', 'cross reference',
    'detail bubble', 'section cut', 'view', 'typical'
  ];
  const lower = query.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

export async function getCalloutContext(query: string, projectSlug: string): Promise<string> {
  try {
    const { getProjectCallouts } = await import('@/lib/detail-callout-extractor');
    const project = await prisma.project.findUnique({ where: { slug: projectSlug } });
    if (!project) return '';

    const callouts = await getProjectCallouts(project.id);
    if (callouts.length === 0) return '';

    let context = '=== DETAIL CALLOUTS & CROSS-REFERENCES ===\n\n';
    context += `Total Callouts: ${callouts.length}\n\n`;

    // Group by type
    type ProjectCallout = typeof callouts[number];
    const byType: Record<string, ProjectCallout[]> = {};
    for (const callout of callouts) {
      if (!byType[callout.type]) byType[callout.type] = [];
      byType[callout.type].push(callout);
    }

    for (const type in byType) {
      context += `${type.toUpperCase()} Callouts (${byType[type].length}):\n`;
      for (const callout of byType[type].slice(0, 10)) {
        context += `  \u2022 ${callout.number} \u2192 ${callout.sheetReference}`;
        if (callout.description) context += ` (${callout.description})`;
        if (callout.sourceLocation) context += ` [${callout.sourceLocation}]`;
        context += '\n';
      }
      context += '\n';
    }

    context += '\u{1F4A1} CALLOUT USAGE GUIDELINES:\n';
    context += '  \u2022 Detail numbers reference enlarged views on target sheets\n';
    context += '  \u2022 Section cuts show slice through building at indicated line\n';
    context += '  \u2022 Always check target sheet for complete information\n';
    context += '  \u2022 Multiple callouts may reference same detail from different locations\n';

    return context;
  } catch (error) {
    logger.error('RAG', 'Error getting callout context', error as Error);
    return '';
  }
}

/**
 * Phase B.2: Dimension Intelligence Detection
 */
export function isDimensionQuery(query: string): boolean {
  const keywords = [
    'dimension', 'measurement', 'how big', 'how wide', 'how tall',
    'length', 'width', 'height', 'size', 'distance',
    'clearance', 'opening', 'spacing', 'depth',
    'feet', 'inches', 'meters', 'millimeters'
  ];
  const lower = query.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

export async function getDimensionContext(query: string, projectSlug: string): Promise<string> {
  try {
    const { getProjectDimensions } = await import('@/lib/dimension-intelligence');
    const project = await prisma.project.findUnique({ where: { slug: projectSlug } });
    if (!project) return '';

    const dimensions = await getProjectDimensions(project.id);
    if (dimensions.length === 0) return '';

    let context = '=== DIMENSION INTELLIGENCE ===\n\n';
    context += `Total Dimensions: ${dimensions.length}\n\n`;

    // Show first 10 dimensions
    const dimSample = dimensions.slice(0, 10);
    if (dimSample.length > 0) {
      context += 'DIMENSIONS:\n';
      for (const dim of dimSample) {
        context += `  \u2022 ${dim.label || 'Unknown'} (${dim.type || 'linear'})`;
        if (dim.location) context += ` - ${dim.location}`;
        if (dim.sheetNumber) context += ` [Sheet ${dim.sheetNumber}]`;
        context += '\n';
      }
      context += '\n';
    }

    context += '\u{1F4A1} DIMENSION USAGE GUIDELINES:\n';
    context += '  \u2022 Use scale ratios for accurate calculations\n';
    context += '  \u2022 Check dimension chains for mathematical consistency\n';
    context += '  \u2022 Critical dimensions are structural or code-required\n';
    context += '  \u2022 Always verify dimensions match drawing scale\n';
    context += '  \u2022 Tolerance requirements vary by material and code\n';

    return context;
  } catch (error) {
    logger.error('RAG', 'Error getting dimension context', error as Error);
    return '';
  }
}

/**
 * Phase B.3: Annotation Intelligence Detection
 */
export function isAnnotationQuery(query: string): boolean {
  const keywords = [
    'note', 'annotation', 'spec', 'specification',
    'code', 'requirement', 'shall', 'must',
    'warning', 'caution', 'material', 'product',
    'manufacturer', 'model', 'install', 'provide'
  ];
  const lower = query.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

export async function getAnnotationContext(query: string, projectSlug: string): Promise<string> {
  try {
    const { getAnnotationSummary } = await import('@/lib/annotation-processor');
    const project = await prisma.project.findUnique({ where: { slug: projectSlug } });
    if (!project) return '';

    const summary = await getAnnotationSummary(project.id);
    if (summary.totalAnnotations === 0) return '';

    let context = '=== ENHANCED ANNOTATIONS ===\n\n';
    context += `Total Annotations: ${summary.totalAnnotations}\n`;
    context += `Critical: ${summary.byPriority.critical}\n`;
    context += `Important: ${summary.byPriority.important}\n`;
    context += `Info: ${summary.byPriority.info}\n`;
    context += `By Category:\n`;
    Object.entries(summary.byCategory).forEach(([cat, count]) => {
      context += `  - ${cat}: ${count}\n`;
    });
    context += '\n';

    // Show critical annotations
    if (summary.criticalAlerts.length > 0) {
      context += 'CRITICAL ANNOTATIONS:\n';
      for (const ann of summary.criticalAlerts.slice(0, 10)) {
        context += `  \u26A0\uFE0F [${ann.type.toUpperCase()}] ${ann.text.substring(0, 80)}${ann.text.length > 80 ? '...' : ''}\n`;
      }
      context += '\n';
    }

    context += '\u{1F4A1} ANNOTATION USAGE GUIDELINES:\n';
    context += '  \u2022 Critical annotations contain code requirements\n';
    context += '  \u2022 Material specifications define required products\n';
    context += '  \u2022 Code references indicate regulatory compliance\n';
    context += '  \u2022 Warnings highlight safety or quality concerns\n';
    context += '  \u2022 Instructions detail construction sequence\n';

    return context;
  } catch (error) {
    logger.error('RAG', 'Error getting annotation context', error as Error);
    return '';
  }
}

/**
 * Phase B.4: Standard Symbol Library Integration
 */
export function enhanceSymbolContextWithStandardLibrary(symbolContext: string): string {
  try {
    const { getLibraryStats, getTotalSymbolCount } = require('@/lib/symbol-library-manager');
    const stats = getLibraryStats();

    let enhanced = symbolContext;
    enhanced += '\n\n=== STANDARD SYMBOL LIBRARIES ===\n\n';
    enhanced += `Total Standard Symbols: ${getTotalSymbolCount()}\n`;
    enhanced += `Libraries Loaded: ${stats.totalLibraries}\n\n`;

    enhanced += 'AVAILABLE LIBRARIES:\n';
    for (const lib of stats.byCategory) {
      enhanced += `  \u2022 ${lib.library} (${lib.category}): ${lib.count} symbols\n`;
    }

    enhanced += '\n\u{1F4A1} STANDARD SYMBOL GUIDELINES:\n';
    enhanced += '  \u2022 Standard symbols follow industry conventions (ANSI, ASHRAE, ASME, NFPA)\n';
    enhanced += '  \u2022 Project-specific legends override standard definitions\n';
    enhanced += '  \u2022 Symbol variations exist for regional practices\n';
    enhanced += '  \u2022 Always reference project legend first, standards second\n';

    return enhanced;
  } catch (error) {
    return symbolContext;
  }
}

// ============================================================================
// PHASE C INTELLIGENCE INTEGRATION
// ============================================================================

/**
 * Enhanced context generation with Phase C spatial and MEP intelligence
 */
export async function generateEnhancedContext(
  query: string,
  projectSlug: string,
  chunks: DocumentChunk[],
  corrections: AdminCorrection[]
): Promise<string> {
  let context = await generateContextWithCorrections(chunks, corrections);

  // Add spatial correlation context if relevant
  if (isSpatialQuery(query)) {
    const spatialContext = await getSpatialIntelligence(query, projectSlug);
    if (spatialContext) {
      context += `\n\n${spatialContext}`;
    }
  }

  // Add MEP intelligence if relevant
  if (isMEPQuery(query)) {
    const mepContext = await getMEPIntelligence(query, projectSlug);
    if (mepContext) {
      context += `\n\n${mepContext}`;
    }
  }

  return context;
}

/**
 * Check if query relates to spatial/location concerns
 */
function isSpatialQuery(query: string): boolean {
  const spatialKeywords = [
    'location', 'where', 'grid', 'coordinate', 'floor', 'sheet',
    'cross-reference', 'which sheet', 'drawing', 'plan'
  ];
  const lowerQuery = query.toLowerCase();
  return spatialKeywords.some(kw => lowerQuery.includes(kw));
}

/**
 * Check if query relates to MEP systems
 */
function isMEPQuery(query: string): boolean {
  const mepKeywords = [
    'mechanical', 'electrical', 'plumbing', 'hvac', 'duct', 'pipe',
    'conduit', 'panel', 'equipment', 'clash', 'conflict', 'path',
    'routing', 'riser', 'vertical'
  ];
  const lowerQuery = query.toLowerCase();
  return mepKeywords.some(kw => lowerQuery.includes(kw));
}

/**
 * Get spatial intelligence context
 */
async function getSpatialIntelligence(
  query: string,
  projectSlug: string
): Promise<string | null> {
  try {
    // Import spatial correlation functions
    const { findSheetsAtLocation, parseGridCoordinate } = await import('@/lib/spatial-correlation');

    // Try to extract location from query
    const gridCoord = parseGridCoordinate(query);

    if (gridCoord) {
      const matches = await findSheetsAtLocation(projectSlug, {
        location: query,
        includeRelated: true
      });

      if (matches.length > 0) {
        let context = '\n=== SPATIAL INTELLIGENCE ===\n';
        context += `Location: Grid ${gridCoord.x}-${gridCoord.y}\n`;
        context += `Found on ${matches.length} sheet(s):\n`;

        for (const match of matches.slice(0, 5)) {
          context += `- Sheet ${match.sourceSheet}: ${match.matchType} match (${Math.round(match.confidence * 100)}% confidence)\n`;
        }

        return context;
      }
    }

    return null;
  } catch (error) {
    logger.error('RAG', 'Error getting spatial intelligence', error as Error);
    return null;
  }
}

/**
 * Get MEP intelligence context
 */
async function getMEPIntelligence(
  query: string,
  projectSlug: string
): Promise<string | null> {
  try {
    // Import MEP functions
    const { extractMEPElements } = await import('@/lib/mep-path-tracer');

    const elements = await extractMEPElements(projectSlug);

    if (elements.length > 0) {
      let context = '\n=== MEP INTELLIGENCE ===\n';

      const mech = elements.filter(e => e.system === 'mechanical').length;
      const elec = elements.filter(e => e.system === 'electrical').length;
      const plumb = elements.filter(e => e.system === 'plumbing').length;

      context += `MEP Systems Detected:\n`;
      if (mech > 0) context += `- Mechanical: ${mech} elements\n`;
      if (elec > 0) context += `- Electrical: ${elec} elements\n`;
      if (plumb > 0) context += `- Plumbing: ${plumb} elements\n`;

      // Find relevant elements for this query
      const queryLower = query.toLowerCase();
      const relevantElements = elements.filter(e => {
        const desc = (e.location.description || '').toLowerCase();
        const tag = (e.tag || '').toLowerCase();
        return desc.includes(queryLower) || queryLower.includes(tag);
      });

      if (relevantElements.length > 0) {
        context += `\nRelevant Elements:\n`;
        for (const elem of relevantElements.slice(0, 5)) {
          context += `- ${elem.system} ${elem.type}${elem.tag ? ` (${elem.tag})` : ''} at ${elem.location.floor}\n`;
        }
      }

      return context;
    }

    return null;
  } catch (error) {
    logger.error('RAG', 'Error getting MEP intelligence', error as Error);
    return null;
  }
}
