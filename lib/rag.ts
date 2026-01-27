/**
 * RAG (Retrieval Augmented Generation) System for Construction Documents
 * 
 * This module implements an advanced relevance scoring system optimized for construction
 * documentation retrieval, with specific enhancements for Plans.pdf and technical specifications.
 * 
 * Key Features:
 * - Multi-word phrase matching for 60+ construction terminology phrases
 * - Enhanced measurement pattern detection (25+ patterns: inches, feet, PSI, PSF, spacing, depths, etc.)
 * - Keyword proximity analysis (words appearing near each other score higher)
 * - Sheet number extraction and discipline-specific boosting (S-series for structural, etc.)
 * - **NOTES SECTION PRIORITIZATION**: Major boost for GENERAL/STRUCTURAL/ARCHITECTURAL/MECHANICAL/ELECTRICAL/PLUMBING NOTES
 * - Construction note/specification pattern recognition (40+ patterns)
 * - Comprehensive synonym expansion (100+ technical term synonyms)
 * - **COUNTING QUERY OPTIMIZATION**: Special handling for "how many" questions with legend/schedule detection
 * - **SCHEDULE & LEGEND DETECTION**: Enhanced retrieval for all schedule types (door, window, fixture, equipment, panel, lighting, finish)
 * - **MEASUREMENT QUERY OPTIMIZATION**: Adaptive retrieval for dimension/measurement questions
 * - **DOUBLE-COUNTING PREVENTION**: System guides AI to use master schedules to avoid counting duplicates
 * 
 * Scoring Strategy (Maximum ~1000+ points possible):
 * - Plans.pdf receives +60 base boost
 * - Exact phrase matches: +150 points
 * - Construction phrases (60+ phrases): +40-90 points each
 *   - Foundation: "minimum depth", "bottom of footing" (+80)
 *   - Schedules: "door schedule", "fixture schedule" (+90-95)
 *   - Measurements: "floor to ceiling", "wall thickness" (+70-75)
 *   - Methods: "construction detail", "installation detail" (+65)
 * - **NOTES SECTIONS** (CRITICAL): +60-90 points
 *   - STRUCTURAL NOTES: +90 points
 *   - GENERAL NOTES: +85 points
 *   - ARCHITECTURAL NOTES: +80 points
 *   - MEP NOTES: +75 points each
 * - Measurements present: up to +150 points (25 patterns with weighted scoring)
 *   - Spacing patterns (#4 @ 12" O.C.): +30 per occurrence
 *   - Min/max measurements: +28 per occurrence
 *   - PSI/PSF/kips: +20-25 per occurrence
 * - Sheet numbers: +40 per sheet, with discipline-specific bonuses (+40-70)
 * - Proximity of keywords: up to +30 points per keyword pair
 * - Specification patterns (40+ patterns): +20-95 points
 *   - Door/window/fixture schedules: +95 points
 *   - Equipment/panel schedules: +90 points
 *   - SHALL BE/REQUIRED patterns: +30-35 points
 * - Counting query + schedule content: +100 points (major boost)
 * - Tabular data structure (for counts): +60 points
 * - High uppercase ratio (indicates critical specs): +30 points
 * 
 * Adaptive Retrieval:
 * - Calculation questions (volumes, areas): 20 chunks
 * - Counting questions: 18 chunks
 * - Measurement questions: 15 chunks
 * - General questions: 12 chunks
 */

import { prisma } from './db';
import { buildProjectLegendLibrary, searchSymbol, type LegendEntry } from './legend-extractor';
import { DrawingType, DrawingSubtype } from './drawing-classifier';
import { getTakeoffContext, detectTakeoffQuery } from './takeoff-memory-service';
import { getBIMContext } from './bim-rag-indexer';
import { getMEPScheduleContext } from './mep-schedule-extractor';
import { getDoorScheduleContext } from './door-schedule-extractor';
import { getWindowScheduleContext } from './window-schedule-extractor';
import type { Prisma, DocumentCategory } from '@prisma/client';

// ============================================================================
// TYPE DEFINITIONS FOR JSON FIELDS
// ============================================================================

/** Zone information extracted from construction plans */
interface ZoneInfo {
  name: string;
  area?: number;
  type?: string;
}

/** Title block data extracted from drawing sheets */
interface TitleBlockData {
  projectName?: string;
  architect?: string;
  engineer?: string;
  issueDate?: string;
  projectNumber?: string;
  sheetTitle?: string;
  drawnBy?: string;
  checkedBy?: string;
  scale?: string;
  revision?: string;
}

/** Scale information for a drawing */
interface ScaleInfo {
  scaleString: string;
  scaleRatio: number;
  format?: string;
  viewportName?: string;
}

/** Scale data for a document chunk */
interface ScaleData {
  primaryScale?: ScaleInfo;
  secondaryScales?: ScaleInfo[];
  hasMultipleScales?: boolean;
  scaleCount?: number;
}

/** Dimension item extracted from plans */
interface DimensionItem {
  originalText?: string;
  context?: string;
  type?: string;
  critical?: boolean;
  confidence?: number;
  value?: number;
  unit?: string;
}

/** Callout item from detail references */
interface CalloutItem {
  type?: string;
  detailNumber?: string;
  sheetReference?: string;
  description?: string;
  confidence?: number;
}

/** Annotation item from construction notes */
interface AnnotationItem {
  type?: string;
  text?: string;
  priority?: 'critical' | 'important' | 'informational';
  requirements?: string[];
  confidence?: number;
}

/** Metadata stored in DocumentChunk JSON field */
interface ChunkMetadata {
  documentName?: string;
  accessLevel?: string;
  category?: string;
  sheetNumber?: string;
  scale?: string;
  projectName?: string;
  architect?: string;
  engineer?: string;
  issueDate?: string;
  labeled_dimensions?: string[];
  derived_dimensions?: string[];
  zones?: ZoneInfo[];
  hasLegend?: boolean;
  legendEntriesCount?: number;
  hasHatchPatterns?: boolean;
  hatchPatternsCount?: number;
  notesCount?: number;
  materialQuantitiesCount?: number;
  submittalsCount?: number;
  inspectionsCount?: number;
  equipmentSpecsCount?: number;
  mepCallouts?: string[];
  regulatoryType?: string;
  standard?: string;
  jurisdiction?: string;
}

/** Scored chunk for ranking during retrieval */
interface ScoredChunk {
  chunk: DocumentChunk;
  score: number;
}

/** Prisma Document with chunks included */
interface DocumentWithChunks {
  id: string;
  name: string;
  accessLevel: string;
  category: DocumentCategory;
  DocumentChunk: Array<{
    id: string;
    content: string;
    documentId: string | null;
    regulatoryDocumentId?: string | null;
    pageNumber: number | null;
    metadata: Prisma.JsonValue;
    sheetNumber?: string | null;
    titleBlockData?: Prisma.JsonValue;
    revision?: string | null;
    dateIssued?: Date | null;
    discipline?: string | null;
  }>;
}

/** Detail callout from Prisma with document relation */
interface DetailCalloutWithDocument {
  id: string;
  projectId: string;
  sheetNumber: string | null;
  callouts: Prisma.JsonValue;
  confidence: number;
  Document: {
    name: string;
  } | null;
}

/** Dimension annotation from Prisma with document relation */
interface DimensionAnnotationWithDocument {
  id: string;
  projectId: string;
  sheetNumber: string | null;
  dimensions: Prisma.JsonValue;
  confidence: number;
  Document: {
    name: string;
  } | null;
}

/** Enhanced annotation from Prisma with document relation */
interface EnhancedAnnotationWithDocument {
  id: string;
  projectId: string;
  sheetNumber: string | null;
  annotations: Prisma.JsonValue;
  confidence: number;
  Document: {
    name: string;
  } | null;
}

/** Regulatory document chunk with metadata */
interface RegulatoryChunk {
  id: string;
  content: string;
  documentId: string | null;
  regulatoryDocumentId: string | null;
  pageNumber: number | null;
  metadata: Prisma.JsonValue;
  isRegulatory: boolean;
  score?: number;
  RegulatoryDocument?: {
    type: string;
    standard: string;
    jurisdiction: string | null;
  } | null;
}

/** Admin correction for RAG enhancement */
interface ScoredCorrection extends AdminCorrection {
  score: number;
}

// ============================================================================
// DOCUMENT CHUNK INTERFACE
// ============================================================================

interface DocumentChunk {
  id: string;
  content: string;
  documentId: string;
  regulatoryDocumentId?: string | null;
  pageNumber: number | null;
  metadata: ChunkMetadata;
  isRegulatory?: boolean;
  documentCategory?: string;
  documentName?: string;
  sheetNumber?: string | null;
  titleBlockData?: TitleBlockData;
  revision?: string | null;
  dateIssued?: Date | null;
  discipline?: string | null;
}

/** Equipment item in a critical path */
interface PathEquipmentItem {
  id: string;
  name: string;
  type?: string;
  location?: { x: number; y: number };
}

/** Conflict in MEP path analysis */
interface PathConflict {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  description?: string;
  location?: { x: number; y: number };
}

/** Critical path in MEP routing */
interface CriticalPath {
  equipment: PathEquipmentItem[];
  efficiency: number;
  conflicts: PathConflict[];
}

interface Phase3ContextData {
  rooms?: Array<{
    id: string;
    name: string;
    roomNumber?: string | null;
    type: string;
    floorNumber?: number | null;
    area?: number | null;
    status: string;
  }>;
  materials?: Array<{
    id: string;
    name: string;
    description?: string | null;
    lineItems: Array<{
      description: string | null;
      quantity: number;
      unit: string;
      unitCost?: number | null;
      totalCost?: number | null;
    }>;
  }>;
  mepEquipment?: Array<{
    callout: string;
    trade: string;
    count: number;
  }>;
  symbols?: Array<{
    id: string;
    pattern: string;
    category: string;
    confidence: number;
    occurrences: number;
    variations: string[];
  }>;
  isometricViews?: Array<{
    totalViews: number;
    bySystem: Record<string, number>;
    totalElements: number;
    criticalClearances: number;
  }>;
  pathAnalysis?: {
    trade: string;
    totalEquipment: number;
    avgDistance: number;
    totalConflicts: number;
    overallEfficiency: number;
    criticalPaths: CriticalPath[];
  };
}

interface AdminCorrection {
  id: string;
  originalQuestion: string;
  correctedAnswer: string;
  adminNotes: string | null;
  keywords: string[];
  usageCount: number;
}

/**
 * Simple keyword-based document retrieval
 * In production, this would use vector embeddings for semantic search
 */
export async function retrieveRelevantDocuments(
  query: string,
  userRole: 'admin' | 'client' | 'guest' | 'pending',
  limit: number = 5,
  projectSlug?: string
): Promise<{ chunks: DocumentChunk[]; documentNames: string[] }> {
  try {
    // CRITICAL: Filter by project FIRST to ensure complete project isolation
    const whereClause: Prisma.DocumentWhereInput = {
      processed: true,
    };

    // MUST filter by project - this ensures no cross-project document leakage
    if (projectSlug) {
      const projects = await prisma.project.findMany({
        where: { slug: projectSlug },
        select: { id: true }
      });
      whereClause.projectId = {
        in: projects.map((p) => p.id)
      };
    } else {
      // If no projectSlug provided, return empty results to prevent cross-project access
      return { chunks: [], documentNames: [] };
    }

    // Add role-based access control (secondary filter after project isolation)
    if (userRole === 'guest') {
      // Guests can only access 'guest' level documents
      whereClause.accessLevel = 'guest';
    } else if (userRole === 'client') {
      // Clients can access 'client' and 'guest' level documents
      whereClause.accessLevel = { in: ['client', 'guest'] };
    }
    // Admin users can access all documents (no accessLevel filter)

    const documents = await prisma.document.findMany({
      where: whereClause,
      include: {
        DocumentChunk: true,
      },
    });

    // Extract keywords from query
    const keywords = extractKeywords(query);

    // Detect query intent for category boosting
    const queryIntent = detectQueryIntent(query);

    // Score and rank chunks
    const scoredChunks: ScoredChunk[] = [];

    for (const doc of documents) {
      for (const chunk of doc.DocumentChunk) {
        let score = calculateRelevanceScore(chunk.content, keywords, query, doc.name);

        // Apply category boost based on query intent
        if (score > 0) {
          score = applyCategoryBoost(score, doc.category, queryIntent);

          const existingMetadata = (typeof chunk.metadata === 'object' && chunk.metadata !== null)
            ? chunk.metadata as Record<string, unknown>
            : {};

          scoredChunks.push({
            chunk: {
              ...chunk,
              documentId: chunk.documentId || '',
              documentCategory: doc.category,
              documentName: doc.name,
              metadata: {
                ...existingMetadata,
                documentName: doc.name,
                accessLevel: doc.accessLevel,
                category: doc.category,
              } as ChunkMetadata,
            },
            score,
          });
        }
      }
    }

    // Sort by score and take top results
    scoredChunks.sort((a, b) => b.score - a.score);
    const topChunks = scoredChunks.slice(0, limit).map(sc => sc.chunk);

    // Get unique document names
    const documentNames = [...new Set(
      topChunks.map(c => c.metadata?.documentName).filter(Boolean)
    )];

    return {
      chunks: topChunks,
      documentNames,
    };
  } catch (error) {
    console.error('Error retrieving documents:', error);
    return { chunks: [], documentNames: [] };
  }
}

/**
 * Detect query intent to boost relevant document categories
 */
function detectQueryIntent(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  const intents: string[] = [];

  // Budget/Cost related
  if (lowerQuery.match(/\b(cost|budget|price|pricing|estimate|bid|quote|payment|invoice|expense)\b/i)) {
    intents.push('budget_cost');
  }

  // Schedule related
  if (lowerQuery.match(/\b(schedule|timeline|deadline|milestone|duration|gantt|critical path|phase|when|date)\b/i)) {
    intents.push('schedule');
  }

  // Plans/Drawings related
  if (lowerQuery.match(/\b(plan|drawing|blueprint|sheet|elevation|section|detail|dimension|scale|layout)\b/i)) {
    intents.push('plans_drawings');
  }

  // Specifications related
  if (lowerQuery.match(/\b(spec|specification|material|product|datasheet|technical|standard|requirement)\b/i)) {
    intents.push('specifications');
  }

  // Contracts related
  if (lowerQuery.match(/\b(contract|agreement|rfi|change order|submittal|legal|proposal|addendum)\b/i)) {
    intents.push('contracts');
  }

  // Daily Reports related
  if (lowerQuery.match(/\b(daily|log|report|inspection|progress|status|field|observation|weather)\b/i)) {
    intents.push('daily_reports');
  }

  return intents;
}

/**
 * Apply category boost to relevance score based on query intent
 */
function applyCategoryBoost(score: number, documentCategory: string, queryIntents: string[]): number {
  if (!documentCategory || queryIntents.length === 0) {
    return score;
  }

  // Strong boost if document category matches query intent
  if (queryIntents.includes(documentCategory)) {
    return score * 1.5; // 50% boost for matching category
  }

  // Moderate boost for related categories
  const relatedCategories: Record<string, string[]> = {
    'budget_cost': ['contracts', 'specifications'],
    'schedule': ['contracts', 'daily_reports'],
    'plans_drawings': ['specifications', 'daily_reports'],
    'specifications': ['plans_drawings', 'budget_cost'],
    'contracts': ['budget_cost', 'schedule'],
    'daily_reports': ['schedule', 'plans_drawings'],
  };

  const related = relatedCategories[documentCategory] || [];
  if (queryIntents.some(intent => related.includes(intent))) {
    return score * 1.2; // 20% boost for related category
  }

  return score;
}

/**
 * Extract important keywords from query with comprehensive synonym expansion
 */
function extractKeywords(query: string): string[] {
  // Remove common words
  const stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with',
    'to', 'for', 'of', 'as', 'by', 'from', 'what', 'how', 'when', 'where', 'who',
    'why', 'can', 'could', 'would', 'should', 'do', 'does', 'did', 'have', 'has',
    'had', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'me', 'my', 'this',
    'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'them',
  ]);

  // Comprehensive construction term synonyms
  const synonyms: Record<string, string[]> = {
    // Foundation terms
    'footer': ['footing', 'footer', 'footers', 'footings', 'foundation', 'bottom', 'base'],
    'footing': ['footing', 'footer', 'footers', 'footings', 'foundation', 'bottom', 'base'],
    'foundation': ['foundation', 'footing', 'footer', 'base', 'bottom'],
    
    // Grade/depth terms
    'subgrade': ['subgrade', 'grade', 'below grade', 'finished grade', 'exterior grade', 'ground'],
    'grade': ['grade', 'subgrade', 'finished grade', 'exterior grade', 'ground', 'level'],
    'below': ['below', 'depth', 'under', 'beneath', 'minimum'],
    
    // Structural terms
    'rebar': ['rebar', 'reinforcement', 'reinforcing', 'steel', 'bar'],
    'reinforcement': ['reinforcement', 'rebar', 'reinforcing', 'steel'],
    'concrete': ['concrete', 'pour', 'slab', 'mix'],
    'structural': ['structural', 'structure', 'framing', 'support'],
    
    // Mechanical/Electrical
    'hvac': ['hvac', 'mechanical', 'heating', 'cooling', 'ventilation', 'air'],
    'electrical': ['electrical', 'electric', 'power', 'wiring', 'circuit'],
    'plumbing': ['plumbing', 'pipe', 'piping', 'water', 'drain', 'sewer'],
    
    // Dimensions/measurements
    'dimension': ['dimension', 'size', 'measurement', 'length', 'width', 'height'],
    
    // Specifications
    'specification': ['specification', 'spec', 'requirement', 'detail', 'note'],
    'requirement': ['requirement', 'spec', 'specification', 'code', 'standard'],
    
    // Counting & Quantity terms (for "how many" questions)
    'receptacles': ['receptacles', 'receptacle', 'outlets', 'outlet', 'duplex', 'plug'],
    'receptacle': ['receptacle', 'receptacles', 'outlet', 'outlets', 'duplex', 'plug'],
    'outlets': ['outlets', 'outlet', 'receptacles', 'receptacle', 'plug'],
    'outlet': ['outlet', 'outlets', 'receptacle', 'receptacles', 'plug'],
    'fixtures': ['fixtures', 'fixture', 'light', 'lights', 'lighting'],
    'fixture': ['fixture', 'fixtures', 'light', 'lights', 'lighting'],
    'lights': ['lights', 'light', 'fixtures', 'fixture', 'lighting', 'luminaire'],
    'light': ['light', 'lights', 'fixture', 'fixtures', 'lighting', 'luminaire'],
    'doors': ['doors', 'door', 'entry', 'entries', 'opening'],
    'door': ['door', 'doors', 'entry', 'opening'],
    'windows': ['windows', 'window', 'glazing', 'openings'],
    'window': ['window', 'windows', 'glazing', 'opening'],
    'many': ['many', 'count', 'number', 'total', 'quantity', 'amount'],
    'count': ['count', 'number', 'total', 'quantity', 'many', 'amount'],
    'schedule': ['schedule', 'table', 'list', 'legend', 'chart'],
    'legend': ['legend', 'schedule', 'key', 'symbol', 'table'],
    
    // Measurement & Dimension terms
    'depth': ['depth', 'deep', 'below', 'bottom', 'minimum', 'depth of'],
    'height': ['height', 'high', 'tall', 'elevation', 'vertical'],
    'width': ['width', 'wide', 'breadth', 'horizontal'],
    'thickness': ['thickness', 'thick', 'thk'],
    'clearance': ['clearance', 'clear', 'opening', 'space'],
    'spacing': ['spacing', 'space', 'on center', 'o.c.', 'oc'],
    'size': ['size', 'dimension', 'measurement', 'dimensions'],
    
    // Material & Finish terms
    'finish': ['finish', 'finishes', 'coating', 'surface'],
    'material': ['material', 'materials', 'construction', 'type'],
    'frame': ['frame', 'framing', 'structure', 'support'],
    'wall': ['wall', 'walls', 'partition', 'partitions'],
    'ceiling': ['ceiling', 'ceilings', 'overhead'],
    'floor': ['floor', 'floors', 'flooring', 'deck'],
    'roof': ['roof', 'roofing', 'rooftop'],
    
    // System & Equipment terms
    'system': ['system', 'systems', 'equipment', 'unit'],
    'unit': ['unit', 'units', 'equipment', 'system'],
    'panel': ['panel', 'panels', 'panelboard', 'board'],
    'duct': ['duct', 'ducts', 'ductwork', 'ducting'],
    'pipe': ['pipe', 'pipes', 'piping', 'conduit'],
    
    // Calculation & Volume terms (for extrapolation queries)
    'cubic': ['cubic', 'volume', 'cu', 'yards', 'excavation'],
    'volume': ['volume', 'cubic', 'capacity', 'cu', 'yards'],
    'yards': ['yards', 'yard', 'yd', 'cy', 'cubic yards'],
    'excavation': ['excavation', 'excavate', 'excavating', 'dig', 'remove', 'removed'],
    'removed': ['removed', 'excavation', 'excavate', 'dig', 'remove'],
    'area': ['area', 'square', 'sq', 'square feet', 'sf'],
    'square': ['square', 'area', 'sq', 'sf', 'square feet'],
    'linear': ['linear', 'length', 'lf', 'lineal', 'run'],
    'perimeter': ['perimeter', 'around', 'linear', 'length', 'total'],
  };

  const baseKeywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => {
      const cleaned = word.replace(/[^a-z0-9]/g, '');
      return cleaned.length > 2 && !stopWords.has(cleaned);
    });

  // Expand with synonyms
  const expandedKeywords = new Set<string>(baseKeywords);
  baseKeywords.forEach(keyword => {
    if (synonyms[keyword]) {
      synonyms[keyword].forEach(syn => expandedKeywords.add(syn));
    }
  });

  return Array.from(expandedKeywords);
}

/**
 * Calculate relevance score for a chunk with advanced matching
 */
function calculateRelevanceScore(
  content: string,
  keywords: string[],
  fullQuery: string,
  documentName: string
): number {
  const contentLower = content.toLowerCase();
  let score = 0;

  // PRIORITY BOOST: Plans.pdf should be prioritized for construction questions
  const isPlansDocument = documentName.toLowerCase().includes('plans.pdf');
  if (isPlansDocument) {
    score += 60; // Strong boost for Plans.pdf
  }

  // EXACT PHRASE MATCH: Highest priority
  if (contentLower.includes(fullQuery.toLowerCase())) {
    score += 150;
  }

  // COUNTING QUERY DETECTION: Boost content when user asks "how many"
  const isCountingQuery = /\b(how many|count|total|number of|quantity of)\b/i.test(fullQuery);
  if (isCountingQuery) {
    // Look for schedule/legend indicators in content
    const hasScheduleIndicators = /\b(schedule|legend|total|quantity|count|list of|table)\b/i.test(content);
    if (hasScheduleIndicators) {
      score += 100; // Major boost for schedule/legend content on counting questions
    }
    
    // Look for tabular data patterns (multiple lines with similar structure)
    const lines = content.split('\n');
    const hasTabularStructure = lines.filter(line => /\d+\s+\w+/.test(line)).length > 3;
    if (hasTabularStructure) {
      score += 60; // Boost for tabular data
    }
  }

  // MULTI-WORD PHRASE MATCHING: Detect common construction phrases
  const constructionPhrases = [
    { phrase: 'minimum depth', boost: 80 },
    { phrase: 'bottom of footing', boost: 80 },
    { phrase: 'bottom of footer', boost: 80 },
    { phrase: 'below grade', boost: 70 },
    { phrase: 'finished grade', boost: 70 },
    { phrase: 'exterior grade', boost: 70 },
    { phrase: 'interior grade', boost: 70 },
    { phrase: 'concrete strength', boost: 60 },
    { phrase: 'reinforcing steel', boost: 60 },
    { phrase: 'rebar spacing', boost: 60 },
    { phrase: 'foundation wall', boost: 60 },
    { phrase: 'slab on grade', boost: 60 },
    { phrase: 'structural steel', boost: 60 },
    { phrase: 'live load', boost: 50 },
    { phrase: 'dead load', boost: 50 },
    { phrase: 'wind load', boost: 50 },
    { phrase: 'seismic', boost: 50 },
    { phrase: 'bearing capacity', boost: 70 },
    { phrase: 'soil bearing', boost: 70 },
    { phrase: 'fire rating', boost: 50 },
    { phrase: 'exit width', boost: 50 },
    { phrase: 'occupancy', boost: 40 },
    
    // COUNTING & QUANTITY PHRASES (for "how many" questions)
    { phrase: 'fixture schedule', boost: 90 },
    { phrase: 'door schedule', boost: 90 },
    { phrase: 'window schedule', boost: 90 },
    { phrase: 'equipment schedule', boost: 90 },
    { phrase: 'symbol legend', boost: 85 },
    { phrase: 'legend', boost: 80 },
    { phrase: 'panel schedule', boost: 85 },
    { phrase: 'lighting schedule', boost: 85 },
    { phrase: 'receptacle schedule', boost: 85 },
    { phrase: 'finish schedule', boost: 80 },
    { phrase: 'total quantity', boost: 75 },
    { phrase: 'quantity', boost: 60 },
    { phrase: 'count', boost: 60 },
    { phrase: 'number of', boost: 60 },
    
    // DIMENSION & MEASUREMENT PHRASES
    { phrase: 'floor to ceiling', boost: 75 },
    { phrase: 'ceiling height', boost: 75 },
    { phrase: 'wall thickness', boost: 70 },
    { phrase: 'slab thickness', boost: 70 },
    { phrase: 'clear height', boost: 68 },
    { phrase: 'clear width', boost: 68 },
    { phrase: 'opening size', boost: 65 },
    { phrase: 'rough opening', boost: 65 },
    { phrase: 'on center', boost: 70 },
    { phrase: 'center to center', boost: 70 },
    
    // CONSTRUCTION METHOD PHRASES
    { phrase: 'construction detail', boost: 65 },
    { phrase: 'installation detail', boost: 65 },
    { phrase: 'connection detail', boost: 60 },
    { phrase: 'typical detail', boost: 58 },
    { phrase: 'cross section', boost: 60 },
    { phrase: 'wall section', boost: 60 },
    
    // MATERIAL & FINISH PHRASES
    { phrase: 'material specification', boost: 65 },
    { phrase: 'finish specification', boost: 65 },
    { phrase: 'paint finish', boost: 55 },
    { phrase: 'floor finish', boost: 55 },
    { phrase: 'wall finish', boost: 55 },
    { phrase: 'ceiling finish', boost: 55 },
  ];

  for (const { phrase, boost } of constructionPhrases) {
    if (contentLower.includes(phrase)) {
      score += boost;
    }
  }

  // ENHANCED MEASUREMENT DETECTION: Significantly boost content with dimensions/measurements
  // More comprehensive patterns with weighted scoring
  const measurementPatterns = [
    { pattern: /\d+["']\s*-?\s*\d*["']?/g, weight: 22 },                    // 24", 2'-0", 1'-6"
    { pattern: /\d+\/\d+\s*["']?/g, weight: 18 },                           // 3/4", 1/2"
    { pattern: /#\d+/g, weight: 20 },                                       // #4, #5 (rebar sizes)
    { pattern: /\d+\s*(?:inch|inches)\b/gi, weight: 22 },                   // 12 inches
    { pattern: /\d+\s*(?:foot|feet|ft)\b/gi, weight: 22 },                  // 2 feet, 10 ft
    { pattern: /\d+\s*psf\b/gi, weight: 25 },                               // pounds per square foot
    { pattern: /\d+\s*psi\b/gi, weight: 25 },                               // pounds per square inch (concrete)
    { pattern: /\d+\s*kips?\b/gi, weight: 24 },                             // structural loads
    { pattern: /\d+\s*lbs?\b/gi, weight: 18 },                              // pounds
    { pattern: /\d+\s*sf\b/gi, weight: 18 },                                // square feet
    { pattern: /\d+\s*cf\b/gi, weight: 18 },                                // cubic feet
    { pattern: /\d+\s*lf\b/gi, weight: 18 },                                // linear feet
    { pattern: /\d+\s*mph\b/gi, weight: 18 },                               // wind speed
    { pattern: /\d+\s*degrees?\b/gi, weight: 15 },                          // angles/temperature
    { pattern: /\d+\s*gauge\b/gi, weight: 18 },                             // material gauge
    { pattern: /\d+\s*@\s*\d+/gi, weight: 30 },                             // spacing (e.g., #4 @ 12" O.C.)
    { pattern: /\bo\.?c\.?\b/gi, weight: 25 },                              // on center spacing
    { pattern: /\d+\s*min\.?/gi, weight: 28 },                              // minimum measurements
    { pattern: /\d+\s*max\.?/gi, weight: 28 },                              // maximum measurements
    { pattern: /\d+\s*below/gi, weight: 26 },                               // depth below (e.g., 24" below)
    { pattern: /\d+\s*above/gi, weight: 22 },                               // height above
    { pattern: /\d+\s*thick/gi, weight: 24 },                               // thickness
    { pattern: /\d+\s*wide/gi, weight: 22 },                                // width
    { pattern: /\d+\s*high/gi, weight: 22 },                                // height
    { pattern: /\d+\s*deep/gi, weight: 24 },                                // depth
    { pattern: /\d+\s*dia\.?/gi, weight: 22 },                              // diameter
  ];

  let totalMeasurementScore = 0;
  let measurementCount = 0;
  for (const { pattern, weight } of measurementPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      measurementCount += matches.length;
      totalMeasurementScore += matches.length * weight;
    }
  }
  
  if (totalMeasurementScore > 0) {
    score += Math.min(150, totalMeasurementScore); // Increased cap from 100 to 150 points
  }

  // KEYWORD PROXIMITY ANALYSIS: Keywords appearing near each other are more relevant
  if (keywords.length >= 2) {
    const proximityBoost = calculateProximityScore(contentLower, keywords);
    score += proximityBoost;
  }

  // INDIVIDUAL KEYWORD MATCHES with context
  for (const keyword of keywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    const matches = contentLower.match(regex);
    if (matches) {
      score += matches.length * 12;
    }
  }

  // DOMAIN-SPECIFIC TERM BOOSTING (refined list)
  const domainTerms = {
    // High priority structural/foundation terms
    'footing': 25, 'footer': 25, 'foundation': 25, 'subgrade': 25,
    'excavation': 20, 'bearing': 20, 'soil': 18,
    
    // Medium priority construction terms
    'structural': 15, 'reinforcement': 15, 'rebar': 15, 'concrete': 15,
    'steel': 12, 'framing': 12, 'beam': 12, 'column': 12,
    
    // Specification terms
    'specification': 12, 'requirement': 12, 'code': 12, 'standard': 12,
    'detail': 10, 'note': 10, 'dimension': 10,
    
    // Building systems
    'mechanical': 10, 'electrical': 10, 'plumbing': 10, 'hvac': 10,
    'fire': 10, 'sprinkler': 10, 'alarm': 10,
    
    // Project management
    'schedule': 8, 'budget': 8, 'cost': 8, 'timeline': 8,
    'milestone': 8, 'phase': 8, 'contractor': 8,
    
    // Counting & Fixture terms (for "how many" questions)
    'receptacle': 20, 'receptacles': 20, 'outlet': 20, 'outlets': 20,
    'fixture': 18, 'fixtures': 18, 'light': 18, 'lights': 18,
    'door': 15, 'doors': 15, 'window': 15, 'windows': 15,
    'panel': 15, 'panels': 15, 'equipment': 15,
    'legend': 22, 'symbol': 18, 'quantity': 18, 'total': 15,
    'count': 15, 'number': 12,
  };

  for (const [term, termBoost] of Object.entries(domainTerms)) {
    if (keywords.includes(term) && contentLower.includes(term)) {
      score += termBoost;
    }
  }

  // SHEET NUMBER BOOST: Content with sheet references is authoritative
  const sheetNumberPattern = /[A-Z]-\d{3}/gi;
  const sheetMatches = content.match(sheetNumberPattern);
  if (sheetMatches && sheetMatches.length > 0) {
    score += 40 * sheetMatches.length;
    
    // DISCIPLINE-SPECIFIC BOOSTS
    const disciplineBoosts: Record<string, number> = {
      'S-': 70,  // Structural (foundations, footings, beams)
      'A-': 50,  // Architectural (walls, doors, finishes)
      'M-': 45,  // Mechanical
      'P-': 45,  // Plumbing
      'E-': 40,  // Electrical
      'C-': 40,  // Civil
      'L-': 30,  // Landscape
    };
    
    for (const sheet of sheetMatches) {
      const discipline = sheet.substring(0, 2).toUpperCase();
      const boost = disciplineBoosts[discipline];
      if (boost) {
        score += boost;
      }
    }
  }

  // CONSTRUCTION NOTES/SPECIFICATIONS BOOST - SIGNIFICANTLY INCREASED
  const specPatterns = [
    // NOTES SECTIONS (CRITICAL - MAJOR BOOST)
    { pattern: /GENERAL\s+NOTES?/gi, boost: 85 },
    { pattern: /STRUCTURAL\s+NOTES?/gi, boost: 90 },
    { pattern: /ARCHITECTURAL\s+NOTES?/gi, boost: 80 },
    { pattern: /MECHANICAL\s+NOTES?/gi, boost: 75 },
    { pattern: /ELECTRICAL\s+NOTES?/gi, boost: 75 },
    { pattern: /PLUMBING\s+NOTES?/gi, boost: 75 },
    { pattern: /DETAIL\s+NOTES?/gi, boost: 70 },
    { pattern: /CONSTRUCTION\s+NOTES?/gi, boost: 80 },
    { pattern: /\bNOTES?:/gi, boost: 60 },
    
    // SPECIFICATION LANGUAGE
    { pattern: /MINIMUM\s+\w+/gi, boost: 45 },
    { pattern: /MAXIMUM\s+\w+/gi, boost: 45 },
    { pattern: /SHALL\s+BE/gi, boost: 35 },
    { pattern: /SHALL\s+NOT/gi, boost: 35 },
    { pattern: /REQUIRED/gi, boost: 30 },
    { pattern: /AS\s+SHOWN/gi, boost: 25 },
    { pattern: /AS\s+NOTED/gi, boost: 25 },
    { pattern: /SEE\s+DETAIL/gi, boost: 25 },
    { pattern: /REFER\s+TO/gi, boost: 20 },
    { pattern: /TYPICAL/gi, boost: 20 },
    { pattern: /UNLESS\s+OTHERWISE/gi, boost: 25 },
    
    // SCHEDULE & LEGEND PATTERNS (for counting questions)
    { pattern: /\bDOOR\s+SCHEDULE\b/gi, boost: 95 },
    { pattern: /\bWINDOW\s+SCHEDULE\b/gi, boost: 95 },
    { pattern: /\bFIXTURE\s+SCHEDULE\b/gi, boost: 95 },
    { pattern: /\bEQUIPMENT\s+SCHEDULE\b/gi, boost: 90 },
    { pattern: /\bPANEL\s+SCHEDULE\b/gi, boost: 90 },
    { pattern: /\bLIGHTING\s+SCHEDULE\b/gi, boost: 90 },
    { pattern: /\bRECEPTACLE\s+SCHEDULE\b/gi, boost: 90 },
    { pattern: /\bFINISH\s+SCHEDULE\b/gi, boost: 85 },
    { pattern: /\bSCHEDULE\b/gi, boost: 65 },
    { pattern: /\bLEGEND\b/gi, boost: 65 },
    { pattern: /\bSYMBOL\s+KEY\b/gi, boost: 60 },
    { pattern: /\bEQUIPMENT\s+LIST\b/gi, boost: 60 },
    { pattern: /\bTOTAL\s*[:=]/gi, boost: 55 },
    { pattern: /\bQUANTITY\s*[:=]/gi, boost: 55 },
    { pattern: /\bQTY\s*[:=]/gi, boost: 50 },
    { pattern: /\bCOUNT\s*[:=]/gi, boost: 50 },
    { pattern: /\bNO\.\s+OF\b/gi, boost: 50 },
  ];

  for (const { pattern, boost } of specPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      score += boost * Math.min(matches.length, 3); // Cap per pattern
    }
  }

  // UPPERCASE CONTENT BOOST: All-caps sections are usually critical specs
  const uppercaseRatio = (content.match(/[A-Z]/g) || []).length / content.length;
  if (uppercaseRatio > 0.4) {
    score += 30; // This chunk likely contains important specifications
  }

  return score;
}

/**
 * Calculate proximity score for keywords appearing near each other
 */
function calculateProximityScore(content: string, keywords: string[]): number {
  let proximityScore = 0;
  const words = content.split(/\s+/);
  
  // For each pair of keywords, check if they appear within 10 words of each other
  for (let i = 0; i < keywords.length; i++) {
    for (let j = i + 1; j < keywords.length; j++) {
      const keyword1 = keywords[i];
      const keyword2 = keywords[j];
      
      // Find positions of both keywords
      const positions1: number[] = [];
      const positions2: number[] = [];
      
      words.forEach((word, index) => {
        if (word.includes(keyword1)) positions1.push(index);
        if (word.includes(keyword2)) positions2.push(index);
      });
      
      // Check for proximity
      for (const pos1 of positions1) {
        for (const pos2 of positions2) {
          const distance = Math.abs(pos1 - pos2);
          if (distance <= 10) {
            // Closer words get higher scores
            proximityScore += Math.max(0, 30 - distance * 2);
          }
        }
      }
    }
  }
  
  return proximityScore;
}

/**
 * Generate context prompt from retrieved chunks
 */
export function generateContextPrompt(chunks: DocumentChunk[]): string {
  if (chunks.length === 0) {
    return 'No specific document context available. Provide general construction industry guidance.';
  }

  let prompt = 'Based on the following project documents:\n\n';

  for (const chunk of chunks) {
    const docName = chunk.metadata?.documentName || 'Unknown Document';
    const pageRef = chunk.pageNumber ? ` (Page ${chunk.pageNumber})` : '';
    
    // Extract sheet numbers from content if this is Plans.pdf
    const isPlans = docName.toLowerCase().includes('plans.pdf');
    const sheetNumbers = isPlans ? extractSheetNumbers(chunk.content) : [];
    const sheetRef = sheetNumbers.length > 0 ? ` [Sheets: ${sheetNumbers.join(', ')}]` : '';
    
    prompt += `[${docName}${pageRef}${sheetRef}]\n${chunk.content}\n\n`;
  }

  prompt += 'IMPORTANT: When providing information from Plans.pdf, ALWAYS cite the sheet number (e.g., A-001, S-002) along with the page number. Format: "(Plans.pdf, Sheet A-001, Page X)". For other documents, cite as "(Document Name, Page X)".\n\n';
  prompt += 'Use this project-specific information to answer the question accurately. If the information is not in the provided context, say so and provide general guidance.';

  return prompt;
}

/**
 * Extract sheet numbers from content (A-001, M-001, etc.)
 */
function extractSheetNumbers(content: string): string[] {
  const sheetPattern = /[A-Z]-\d{3}/g;
  const matches = content.match(sheetPattern);
  return matches ? [...new Set(matches)] : []; // Return unique sheet numbers
}
/**
 * Classify query to determine if regulatory documents should be searched
 * Returns: "regulatory", "project_document", or "both"
 */
function classifyQueryType(query: string): 'regulatory' | 'project_document' | 'both' {
  const lowerQuery = query.toLowerCase();
  
  // Regulatory keywords that suggest code/standard questions
  const regulatoryKeywords = [
    'code', 'requirement', 'standard', 'regulation', 'compliance', 'ada', 'ibc', 'nfpa',
    'required', 'shall', 'must', 'minimum', 'maximum', 'allowed', 'permitted',
    'accessibility', 'fire', 'safety', 'egress', 'occupancy', 'building code',
    'width', 'clearance', 'height requirement', 'spacing requirement',
    'what is required', 'is this compliant', 'does this meet', 'whats required',
    'corridor width', 'door width', 'parking requirement', 'accessible',
  ];
  
  // Project-specific keywords
  const projectKeywords = [
    'plan', 'drawing', 'sheet', 'schedule', 'budget', 'cost', 'timeline',
    'contractor', 'vendor', 'material', 'equipment', 'installation',
    'phase', 'milestone', 'deliverable', 'who is', 'when is', 'where is',
  ];
  
  const hasRegulatory = regulatoryKeywords.some(keyword => lowerQuery.includes(keyword));
  const hasProject = projectKeywords.some(keyword => lowerQuery.includes(keyword));
  
  if (hasRegulatory && hasProject) return 'both';
  if (hasRegulatory) return 'regulatory';
  return 'project_document';
}

/**
 * Retrieve relevant chunks from regulatory documents
 * Uses simpler keyword matching since regulatory documents are well-structured
 */
export async function retrieveRegulatoryChunks(
  query: string,
  projectSlug: string,
  limit: number = 5
): Promise<RegulatoryChunk[]> {
  try {
    // Get project ID
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true },
    });

    if (!project) return [];

    // Get all processed regulatory documents for this project
    const regulatoryDocs = await prisma.regulatoryDocument.findMany({
      where: {
        projectId: project.id,
        processed: true,
      },
      select: { id: true, type: true, standard: true },
    });

    if (regulatoryDocs.length === 0) return [];

    // Extract keywords from query
    const keywords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2);

    // Search chunks from regulatory documents
    const chunks = await prisma.documentChunk.findMany({
      where: {
        regulatoryDocumentId: {
          in: regulatoryDocs.map((d) => d.id),
        },
        OR: keywords.map(keyword => ({
          content: {
            contains: keyword,
            mode: 'insensitive' as Prisma.QueryMode,
          },
        })),
      },
      take: limit * 2, // Get extra for scoring
      include: {
        RegulatoryDocument: {
          select: {
            type: true,
            standard: true,
            jurisdiction: true,
          },
        },
      },
    });

    // Score chunks based on keyword matches
    const scoredChunks = chunks.map((chunk) => {
      const content = chunk.content.toLowerCase();
      let score = 0;

      // Count keyword matches
      keywords.forEach(keyword => {
        const matches = (content.match(new RegExp(keyword, 'gi')) || []).length;
        score += matches * 10;
      });

      // Boost ADA standards for accessibility questions
      if (chunk.RegulatoryDocument?.type === 'ada' &&
          (query.toLowerCase().includes('accessible') ||
           query.toLowerCase().includes('ada') ||
           query.toLowerCase().includes('parking'))) {
        score += 50;
      }

      // Boost building codes for structural/safety questions
      if (chunk.RegulatoryDocument?.type === 'building_code' &&
          (query.toLowerCase().includes('code') ||
           query.toLowerCase().includes('required'))) {
        score += 40;
      }

      return {
        ...chunk,
        score,
        isRegulatory: true as const,
        // Map regulatoryDocumentId to documentId for compatibility
        documentId: chunk.regulatoryDocumentId || chunk.documentId,
      };
    });

    // Sort by score and take top chunks
    return scoredChunks
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score: _score, RegulatoryDocument, ...chunk }) => ({
        ...chunk,
        metadata: {
          ...(typeof chunk.metadata === 'object' && chunk.metadata !== null ? chunk.metadata : {}),
          regulatoryType: RegulatoryDocument?.type,
          standard: RegulatoryDocument?.standard,
          jurisdiction: RegulatoryDocument?.jurisdiction,
        },
      }));
  } catch (error) {
    console.error('Error retrieving regulatory chunks:', error);
    return [];
  }
}


/**
 * Retrieve relevant admin corrections based on query
 * Returns corrections that match query keywords and are active
 */
export async function retrieveRelevantCorrections(
  query: string,
  projectSlug?: string,
  limit: number = 3
): Promise<AdminCorrection[]> {
  try {
    // Extract keywords from query
    const queryWords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);

    if (queryWords.length === 0) {
      return [];
    }

    // Build where clause
    const whereClause: Prisma.AdminCorrectionWhereInput = {
      isActive: true,
    };

    // Filter by project if provided
    if (projectSlug) {
      const project = await prisma.project.findUnique({
        where: { slug: projectSlug },
        select: { id: true }
      });

      if (project) {
        whereClause.OR = [
          { projectId: project.id },
          { projectId: null } // Include global corrections
        ];
      }
    }

    // Fetch all active corrections
    const corrections = await prisma.adminCorrection.findMany({
      where: whereClause,
      select: {
        id: true,
        originalQuestion: true,
        correctedAnswer: true,
        adminNotes: true,
        keywords: true,
        usageCount: true,
      },
      orderBy: {
        usageCount: 'desc', // Prioritize frequently used corrections
      },
    });

    // Score and rank corrections based on keyword overlap
    const scoredCorrections: ScoredCorrection[] = corrections.map((correction) => {
      let score = 0;
      const correctionKeywords = correction.keywords.map((k) => k.toLowerCase());

      // Calculate keyword overlap
      for (const queryWord of queryWords) {
        for (const keyword of correctionKeywords) {
          if (keyword.includes(queryWord) || queryWord.includes(keyword)) {
            score += 10;
          }
        }
      }

      // Bonus for question similarity
      const questionWords = correction.originalQuestion
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/);

      const commonWords = queryWords.filter((word) =>
        questionWords.includes(word)
      );
      score += commonWords.length * 5;

      return {
        ...correction,
        score,
      };
    });

    // Return top matches
    const relevantCorrections = scoredCorrections
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Increment usage count for matched corrections
    if (relevantCorrections.length > 0) {
      await prisma.adminCorrection.updateMany({
        where: {
          id: { in: relevantCorrections.map((c) => c.id) },
        },
        data: {
          usageCount: { increment: 1 },
        },
      });
    }

    return relevantCorrections;
  } catch (error) {
    console.error('Error retrieving admin corrections:', error);
    return [];
  }
}

/**
 * Generate context prompt with admin corrections
 */
export function generateContextWithCorrections(
  chunks: DocumentChunk[],
  corrections: AdminCorrection[]
): string {
  let prompt = '';

  // Add admin corrections first (highest priority)
  if (corrections.length > 0) {
    prompt += '=== ADMIN CORRECTIONS & GUIDANCE (HIGHEST PRIORITY) ===\n\n';
    prompt += 'The following corrections were provided by project administrators based on previous similar questions. These should be considered the most accurate and authoritative information:\n\n';
    
    corrections.forEach((correction, index) => {
      prompt += `[Admin Correction ${index + 1}]\n`;
      prompt += `Similar Question: ${correction.originalQuestion}\n`;
      prompt += `Corrected Answer: ${correction.correctedAnswer}\n`;
      if (correction.adminNotes) {
        prompt += `Admin Notes: ${correction.adminNotes}\n`;
      }
      prompt += '\n';
    });
    
    prompt += '---\n\n';
  }

  // Add document context
  if (chunks.length === 0 && corrections.length === 0) {
    return 'No specific document context or admin corrections available. Provide general construction industry guidance.';
  }

  if (chunks.length > 0) {
    prompt += '=== DOCUMENT CONTEXT ===\n\n';
    prompt += 'Based on the following project documents:\n\n';

    for (const chunk of chunks) {
      // Check if this is a regulatory chunk
      if (chunk.isRegulatory || chunk.regulatoryDocumentId) {
        const standard = chunk.metadata?.standard || 'Regulatory Document';
        const jurisdiction = chunk.metadata?.jurisdiction || '';
        const regulatoryType = chunk.metadata?.regulatoryType || '';
        const pageRef = chunk.pageNumber ? ` (Page ${chunk.pageNumber})` : '';
        
        prompt += `[${standard}${jurisdiction ? ' - ' + jurisdiction : ''}${pageRef}] (${regulatoryType.toUpperCase()} CODE)\n${chunk.content}\n\n`;
      } else {
        const docName = chunk.metadata?.documentName || 'Unknown Document';
        const pageRef = chunk.pageNumber ? ` (Page ${chunk.pageNumber})` : '';
        
        const isPlans = docName.toLowerCase().includes('plans.pdf');
        const sheetNumbers = isPlans ? extractSheetNumbers(chunk.content) : [];
        const sheetRef = sheetNumbers.length > 0 ? ` [Sheets: ${sheetNumbers.join(', ')}]` : '';
        
        // ENHANCED: Extract and display OCR metadata for construction plans
        let ocrMetadata = '';
        if (chunk.metadata) {
          const meta = chunk.metadata;

          // Add scale information (critical for dimensions)
          if (meta.scale) {
            ocrMetadata += `\n  📏 Scale: ${meta.scale}`;
          }

          // Add title block information (project context)
          if (meta.projectName || meta.architect || meta.engineer) {
            ocrMetadata += `\n  📋 Title Block:`;
            if (meta.projectName) ocrMetadata += ` Project: ${meta.projectName}`;
            if (meta.architect) ocrMetadata += ` | Architect: ${meta.architect}`;
            if (meta.engineer) ocrMetadata += ` | Engineer: ${meta.engineer}`;
            if (meta.issueDate) ocrMetadata += ` | Date: ${meta.issueDate}`;
          }

          // Add dimensions (labeled and derived)
          if (meta.labeled_dimensions || meta.derived_dimensions) {
            ocrMetadata += `\n  📐 Dimensions:`;
            if (meta.labeled_dimensions && meta.labeled_dimensions.length > 0) {
              ocrMetadata += ` ${meta.labeled_dimensions.join(', ')}`;
            }
            if (meta.derived_dimensions && meta.derived_dimensions.length > 0) {
              ocrMetadata += ` (derived: ${meta.derived_dimensions.join(', ')})`;
            }
          }

          // Add zones/areas (spatial organization)
          if (meta.zones && meta.zones.length > 0) {
            const zoneNames = meta.zones.map((z) => z.name).join(', ');
            ocrMetadata += `\n  🗺️  Zones: ${zoneNames}`;
          }

          // Add legend entries (material/pattern definitions)
          if (meta.hasLegend && meta.legendEntriesCount) {
            ocrMetadata += `\n  🔑 Legend: ${meta.legendEntriesCount} entries (material/pattern definitions included)`;
          }

          // Add hatch patterns (visual material indicators)
          if (meta.hasHatchPatterns && meta.hatchPatternsCount) {
            ocrMetadata += `\n  🎨 Hatch Patterns: ${meta.hatchPatternsCount} identified (see content for details)`;
          }

          // Add note count
          if (meta.notesCount) {
            ocrMetadata += `\n  📝 Notes: ${meta.notesCount} construction notes`;
          }

          // PHASE 1: Material Quantity Takeoffs
          if (meta.materialQuantitiesCount && meta.materialQuantitiesCount > 0) {
            ocrMetadata += `\n  💰 Material Quantities: ${meta.materialQuantitiesCount} items with cost estimation data`;
          }

          // PHASE 1: Submittal Requirements
          if (meta.submittalsCount && meta.submittalsCount > 0) {
            ocrMetadata += `\n  📋 Submittal Requirements: ${meta.submittalsCount} items requiring approval`;
          }

          // PHASE 1: Inspection & Testing Requirements
          if (meta.inspectionsCount && meta.inspectionsCount > 0) {
            ocrMetadata += `\n  🔍 Inspection/Testing: ${meta.inspectionsCount} quality control requirements`;
          }

          // PHASE 1: Equipment Specifications
          if (meta.equipmentSpecsCount && meta.equipmentSpecsCount > 0) {
            ocrMetadata += `\n  ⚙️  Equipment Specs: ${meta.equipmentSpecsCount} items with detailed specifications`;
          }
        }
        
        prompt += `[${docName}${pageRef}${sheetRef}]${ocrMetadata}\n${chunk.content}\n\n`;
      }
    }

    prompt += 'IMPORTANT: When providing information from Plans.pdf, ALWAYS cite the sheet number (e.g., A-001, S-002) along with the page number. Format: "(Plans.pdf, Sheet A-001, Page X)". For other documents, cite as "(Document Name, Page X)". For regulatory codes, cite as "(Standard Name, Section/Page X)".\n\n';
  }

  prompt += '\nINSTRUCTIONS FOR GPT-5.2 / GPT-4o / Claude:\n';
  prompt += '1. Prioritize admin corrections above all other sources\n';
  prompt += '2. If admin corrections conflict with documents, favor the admin corrections and explain why\n';
  prompt += '3. Use document context to support or elaborate on admin corrections\n';
  prompt += '4. When answering code/compliance questions, cite BOTH regulatory standards AND project documents when available\n';
  prompt += '5. For regulatory information, always include the standard name (e.g., "Per ADA 2010" or "Per IBC 2021")\n';
  prompt += '6. If project documents conflict with regulatory codes, note the discrepancy and cite both sources\n';
  prompt += '7. If information is not in the provided context, say so and provide general guidance\n';
  prompt += '\n🔍 ENHANCED OCR METADATA USAGE:\n';
  prompt += '8. ALWAYS use Scale information (📏) when discussing dimensions - e.g., "per scale 1/4"=1\'-0""\n';
  prompt += '9. Reference Title Block info (📋) for project context - architect, engineer, issue dates\n';
  prompt += '10. Cite specific Dimensions (📐) with their units when answering measurement questions\n';
  prompt += '11. Use Zone information (🗺️) to provide spatial context - "in the Building Slab zone" or "Parking Lot area"\n';
  prompt += '12. Reference Legend entries (🔑) when discussing materials or hatch patterns\n';
  prompt += '13. Leverage construction Notes (📝) for specifications and installation requirements\n';
  prompt += '14. When multiple chunks provide info, synthesize across them citing each source\n';
  prompt += '\n💎 PHASE 1 METADATA USAGE (CRITICAL FOR COST & SCHEDULE):\n';
  prompt += '15. Material Quantities (💰): When answering cost/material questions, cite extracted quantities with zones - e.g., "Building Slab: 120 CY concrete" or "Parking Lot: 40 CY"\n';
  prompt += '16. Submittal Requirements (📋): When discussing approvals/timelines, reference submittal requirements with CSI sections, due dates, and approval authorities\n';
  prompt += '17. Inspection/Testing (🔍): When addressing quality control, cite specific testing standards (ASTM, ACI, AWS), frequencies, and inspector qualifications\n';
  prompt += '18. Equipment Specs (⚙️): When discussing equipment, provide manufacturer, model, capacity, electrical/mechanical specs, and location from extracted data\n';
  prompt += '19. For procurement questions, combine Material Quantities + Equipment Specs for comprehensive answers\n';
  prompt += '20. For schedule questions, reference Submittal Requirements lead times and Inspection/Testing frequencies\n';

  return prompt;
}

/**
 * Retrieve Phase 3 structured data (rooms, materials, MEP equipment)
 * to enrich the AI's contextual understanding
 */
export async function retrievePhase3Context(
  query: string,
  projectSlug: string
): Promise<Phase3ContextData> {
  try {
    // Get project
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true }
    });

    if (!project) {
      return {};
    }

    const phase3Data: Phase3ContextData = {};
    const queryLower = query.toLowerCase();

    // Detect if query is about rooms/spaces
    const roomKeywords = [
      'room', 'space', 'floor', 'area', 'location', 'where',
      'office', 'bathroom', 'mechanical', 'conference', 'storage'
    ];
    const isRoomQuery = roomKeywords.some(kw => queryLower.includes(kw));

    if (isRoomQuery) {
      const rooms = await prisma.room.findMany({
        where: { projectId: project.id },
        select: {
          id: true,
          name: true,
          roomNumber: true,
          type: true,
          floorNumber: true,
          area: true,
          status: true
        },
        take: 20 // Limit to prevent context overflow
      });
      phase3Data.rooms = rooms;
    }

    // Detect if query is about materials/costs/quantities
    const materialKeywords = [
      'material', 'cost', 'quantity', 'how much', 'how many',
      'concrete', 'steel', 'lumber', 'drywall', 'paint',
      'budget', 'estimate', 'price', 'takeoff'
    ];
    const isMaterialQuery = materialKeywords.some(kw => queryLower.includes(kw));

    if (isMaterialQuery) {
      const takeoffs = await prisma.materialTakeoff.findMany({
        where: { projectId: project.id },
        select: {
          id: true,
          name: true,
          description: true,
          TakeoffLineItem: {
            select: {
              description: true,
              quantity: true,
              unit: true,
              unitCost: true,
              totalCost: true
            }
          }
        },
        take: 10 // Limit takeoffs
      });
      phase3Data.materials = takeoffs.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        lineItems: t.TakeoffLineItem || []
      }));
    }

    // Detect if query is about MEP equipment
    const mepKeywords = [
      'hvac', 'electrical', 'plumbing', 'mechanical', 'equipment',
      'ahu', 'rtu', 'vav', 'fcu', 'panel', 'mcc', 'mdb',
      'fixture', 'sprinkler', 'pump', 'fan', 'unit'
    ];
    const isMEPQuery = mepKeywords.some(kw => queryLower.includes(kw));

    if (isMEPQuery) {
      // Get MEP data from document chunks metadata
      const mepChunks = await prisma.documentChunk.findMany({
        where: {
          Document: {
            projectId: project.id
          }
        },
        select: {
          metadata: true
        },
        take: 500
      });

      // Aggregate MEP callouts
      const mepMap = new Map<string, { trade: string; count: number }>();

      mepChunks.forEach((chunk) => {
        const metadata = chunk.metadata as ChunkMetadata | null;
        if (metadata?.mepCallouts) {
          const callouts = Array.isArray(metadata.mepCallouts)
            ? metadata.mepCallouts
            : [];

          callouts.forEach((callout) => {
            const upper = callout.toUpperCase();
            let trade = 'Other';
            
            if (upper.includes('AHU') || upper.includes('RTU') || 
                upper.includes('VAV') || upper.includes('FCU')) {
              trade = 'HVAC';
            } else if (upper.includes('MDP') || upper.includes('LP') || 
                       upper.includes('RP') || upper.includes('PANEL')) {
              trade = 'Electrical';
            } else if (upper.includes('WC') || upper.includes('LAV') || 
                       upper.includes('UR') || upper.includes('SINK')) {
              trade = 'Plumbing';
            } else if (upper.includes('FACP') || upper.includes('SD') || 
                       upper.includes('HS') || upper.includes('SPRINKLER')) {
              trade = 'Fire Protection';
            }

            const key = `${callout}|${trade}`;
            const existing = mepMap.get(key);
            if (existing) {
              existing.count++;
            } else {
              mepMap.set(key, { trade, count: 1 });
            }
          });
        }
      });

      // Convert to array
      phase3Data.mepEquipment = Array.from(mepMap.entries())
        .map(([key, data]) => ({
          callout: key.split('|')[0],
          trade: data.trade,
          count: data.count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 30); // Top 30 items
    }

    // Detect if query is about symbols/patterns/callouts
    const symbolKeywords = [
      'symbol', 'pattern', 'callout', 'legend', 'notation',
      'marking', 'designation', 'identifier', 'label'
    ];
    const isSymbolQuery = symbolKeywords.some(kw => queryLower.includes(kw));

    if (isSymbolQuery) {
      try {
        const { getSymbolStatistics } = await import('./symbol-learner');
        const symbolStats = await getSymbolStatistics(projectSlug);
        phase3Data.symbols = symbolStats.topSymbols;
      } catch (error) {
        console.error('Symbol learning error:', error);
      }
    }

    // Detect if query is about isometric/3D views/riser diagrams
    const isometricKeywords = [
      'isometric', '3d', 'riser', 'vertical', 'axonometric',
      'elevation', 'height', 'clearance', 'routing'
    ];
    const isIsometricQuery = isometricKeywords.some(kw => queryLower.includes(kw));

    if (isIsometricQuery) {
      try {
        // Isometric view detection available via API
        // Future: Integrate directly here for richer context
        phase3Data.isometricViews = [];
      } catch (error) {
        console.error('Isometric interpretation error:', error);
      }
    }

    // Detect if query is about MEP routing/paths/connections
    const pathKeywords = [
      'path', 'route', 'routing', 'connection', 'connected',
      'from', 'to', 'between', 'distance', 'conflict'
    ];
    const isPathQuery = pathKeywords.some(kw => queryLower.includes(kw)) && isMEPQuery;

    if (isPathQuery) {
      try {
        // MEP path analysis available via API
        // Future: Integrate directly here for richer context
        phase3Data.pathAnalysis = undefined;
      } catch (error) {
        console.error('Path tracing error:', error);
      }
    }

    return phase3Data;
  } catch (error) {
    console.error('Error retrieving Phase 3 context:', error);
    return {};
  }
}

/**
 * Generate enhanced context with Phase 3 structured data
 */
export async function generateContextWithPhase3(
  chunks: DocumentChunk[],
  corrections: AdminCorrection[],
  query: string,
  projectSlug: string
): Promise<string> {
  // Get base context
  let prompt = await generateContextWithCorrections(chunks, corrections);

  // Get Phase 3 data
  const phase3Data = await retrievePhase3Context(query, projectSlug);

  // Add Phase 3 context sections
  if (phase3Data.rooms && phase3Data.rooms.length > 0) {
    prompt += '\n\n=== PROJECT ROOMS & SPACES ===\n';
    prompt += 'The following rooms are tracked in this project:\n\n';
    
    phase3Data.rooms.forEach(room => {
      const roomNum = room.roomNumber ? ` [${room.roomNumber}]` : '';
      const floor = room.floorNumber ? ` (Floor ${room.floorNumber})` : '';
      const areaInfo = room.area ? ` | ${room.area.toFixed(0)} sq ft` : '';
      const statusIcon = room.status === 'completed' ? '✅' : 
                        room.status === 'in_progress' ? '🚧' : '⬜';
      
      prompt += `${statusIcon} ${room.name}${roomNum}${floor} [${room.type}]${areaInfo}\n`;
    });

    prompt += '\nℹ️ Use this room data to provide location-specific answers.\n';
    prompt += 'Mention specific rooms when relevant to the question.\n';
  }

  // Enhanced material takeoff context with comprehensive data
  const takeoffDetection = detectTakeoffQuery(query);
  if (takeoffDetection.isTakeoffQuery) {
    try {
      const takeoffContext = await getTakeoffContext(query, projectSlug);
      if (takeoffContext && takeoffContext.items.length > 0) {
        prompt += '\n\n' + takeoffContext.formattedContext;
      }
    } catch (error) {
      console.error('[RAG] Error getting takeoff context:', error);
      // Fall back to basic material data if enhanced service fails
      if (phase3Data.materials && phase3Data.materials.length > 0) {
        prompt += '\n\n=== MATERIAL TAKEOFF DATA ===\n';
        prompt += 'The following materials have been quantified for this project:\n\n';
        
        phase3Data.materials.forEach(takeoff => {
          const desc = takeoff.description ? ` - ${takeoff.description}` : '';
          prompt += `📦 ${takeoff.name}${desc}:\n`;
          
          takeoff.lineItems.forEach(item => {
            const cost = item.totalCost 
              ? ` ($${item.totalCost.toFixed(2)})` 
              : '';
            prompt += `  • ${item.description}: ${item.quantity} ${item.unit}${cost}\n`;
          });
          prompt += '\n';
        });

        prompt += 'ℹ️ Use this takeoff data for cost and quantity questions.\n';
        prompt += 'Cite specific quantities and costs when answering material-related queries.\n';
      }
    }
  } else if (phase3Data.materials && phase3Data.materials.length > 0) {
    // Non-takeoff query but materials available - provide basic summary
    prompt += '\n\n=== MATERIAL TAKEOFF DATA ===\n';
    prompt += 'The following materials have been quantified for this project:\n\n';
    
    phase3Data.materials.forEach(takeoff => {
      const desc = takeoff.description ? ` - ${takeoff.description}` : '';
      prompt += `📦 ${takeoff.name}${desc}:\n`;
      
      takeoff.lineItems.forEach(item => {
        const cost = item.totalCost 
          ? ` ($${item.totalCost.toFixed(2)})` 
          : '';
        prompt += `  • ${item.description}: ${item.quantity} ${item.unit}${cost}\n`;
      });
      prompt += '\n';
    });

    prompt += 'ℹ️ Use this takeoff data for cost and quantity questions.\n';
    prompt += 'Cite specific quantities and costs when answering material-related queries.\n';
  }

  if (phase3Data.mepEquipment && phase3Data.mepEquipment.length > 0) {
    prompt += '\n\n=== MEP EQUIPMENT INVENTORY ===\n';
    prompt += 'The following MEP equipment has been identified in the plans:\n\n';
    
    const byTrade = phase3Data.mepEquipment.reduce((acc, item) => {
      if (!acc[item.trade]) acc[item.trade] = [];
      acc[item.trade].push(item);
      return acc;
    }, {} as Record<string, typeof phase3Data.mepEquipment>);

    Object.entries(byTrade).forEach(([trade, items]) => {
      const tradeIcon = trade === 'HVAC' ? '❄️' :
                       trade === 'Electrical' ? '⚡' :
                       trade === 'Plumbing' ? '💧' :
                       trade === 'Fire Protection' ? '🔥' : '🔧';
      
      prompt += `${tradeIcon} ${trade}:\n`;
      items.forEach(item => {
        prompt += `  • ${item.callout}${item.count > 1 ? ` (${item.count} units)` : ''}\n`;
      });
      prompt += '\n';
    });

    prompt += 'ℹ️ Use this MEP data for equipment and system questions.\n';
    prompt += 'Reference specific equipment tags when discussing systems.\n';
  }

  // Add Phase 3 AI instructions
  if (Object.keys(phase3Data).length > 0) {
    prompt += '\n\n📊 PHASE 3 INTELLIGENCE USAGE:\n';
    prompt += '21. ROOM CONTEXT: When answering "where" questions, reference specific tracked rooms with their numbers and floors\n';
    prompt += '22. MATERIAL QUANTITIES: For cost/quantity questions, cite extracted takeoff data with exact quantities and costs\n';
    prompt += '23. MEP EQUIPMENT: When discussing systems, mention specific equipment tags and their counts\n';
    prompt += '24. LOCATION AWARENESS: Combine room data with document references for precise spatial context\n';
    prompt += '25. INLINE DATA CARDS: Format responses to include [ROOM:id], [MATERIAL:id], or [MEP:callout] tags for UI enhancement\n';
    prompt += '26. CROSS-REFERENCES: When mentioning rooms/materials/equipment, suggest viewing them in their respective browsers\n';
    prompt += '27. SHOW ON PLAN: For visual elements, suggest using the Plan Viewer with [SHOW_ON_PLAN:documentId:pageNumber]\n';
    
    // Add intelligence feature instructions
    if (phase3Data.symbols && phase3Data.symbols.length > 0) {
      prompt += '28. SYMBOL RECOGNITION: Reference learned construction symbols (callouts, patterns) when interpreting plans\n';
    }
    if (phase3Data.isometricViews && phase3Data.isometricViews.length > 0) {
      prompt += '29. 3D SPATIAL UNDERSTANDING: Use isometric view analysis for vertical routing, clearances, and elevation questions\n';
    }
    if (phase3Data.pathAnalysis) {
      prompt += '30. MEP ROUTING INTELLIGENCE: Cite path efficiency, conflicts, and routing distances from system analysis\n';
      prompt += '31. OPTIMIZATION INSIGHTS: Suggest path optimizations when discussing MEP routing or coordination\n';
      prompt += '32. PATH VISUALIZATION: When discussing MEP equipment paths, connections, or routing, embed a path visualization using this format:\n';
      prompt += '    ```json:mep-path\n';
      prompt += '    {"id":"path-123","equipment":[...],"segments":[...],"totalDistance":150.5,"conflicts":[...],"efficiency":75}\n';
      prompt += '    ```\n';
      prompt += '    Use the pathAnalysis data provided to construct the visualization. Include all relevant equipment, segments, conflicts, and efficiency metrics.\n';
    }
  }
  
  // Add enhanced takeoff query instructions
  if (takeoffDetection.isTakeoffQuery) {
    prompt += '\n\n🏗️ MATERIAL TAKEOFF QUERY GUIDANCE:\n';
    prompt += '33. CONFIDENCE INDICATORS: Always mention confidence levels (✓=verified, ~=moderate, ?=needs review) when citing quantities\n';
    prompt += '34. WASTE FACTORS: When providing order quantities, include waste-adjusted amounts where applicable\n';
    prompt += '35. COST DISCLAIMERS: State that cost estimates are preliminary and should be verified with current market rates\n';
    prompt += '36. CATEGORY BREAKDOWN: For general material questions, provide a summary by category before detailed items\n';
    prompt += '37. SOURCE TRACKING: Mention sheet numbers and locations when available for verification\n';
    prompt += '38. LABOR ESTIMATES: Include estimated labor hours when relevant to the question\n';
    prompt += '39. VERIFICATION REMINDER: For low-confidence items (<70%), recommend manual verification\n';
    prompt += '40. UNITS CONSISTENCY: Always include units with quantities and convert if user asks in different units\n';
  }

  // Add BIM model context for 3D/BIM-related queries
  try {
    const bimContext = await getBIMContext(projectSlug, query);
    if (bimContext) {
      prompt += bimContext;
      prompt += '\n\n🏛️ BIM MODEL GUIDANCE:\n';
      prompt += '• Use BIM data for accurate element counts and material quantities\n';
      prompt += '• BIM-extracted quantities have high confidence (0.9) from actual model data\n';
      prompt += '• Reference specific Revit categories when discussing building elements\n';
      prompt += '• For MEP questions, prioritize BIM data over PDF extraction when available\n';
    }
  } catch (error) {
    console.error('[RAG] Error getting BIM context:', error);
  }

  // Add MEP Schedule context for equipment-related queries
  try {
    const mepScheduleContext = await getMEPScheduleContext(projectSlug);
    if (mepScheduleContext) {
      prompt += '\n\n' + mepScheduleContext;
      prompt += '\n\n🔧 MEP SCHEDULE GUIDANCE:\n';
      prompt += '• Use MEP schedule data for accurate equipment specifications and counts\n';
      prompt += '• Light fixtures: reference manufacturer, model number, wattage, and mounting type\n';
      prompt += '• Plumbing fixtures: include fixture tag, manufacturer, and connection sizes\n';
      prompt += '• HVAC equipment: cite unit tags, capacities (CFM, tons), and electrical requirements\n';
      prompt += '• Use mechanical abbreviations from the project when explaining technical terms\n';
      prompt += '• For equipment questions, always check MEP schedules before giving generic answers\n';
    }
  } catch (error) {
    console.error('[RAG] Error getting MEP schedule context:', error);
  }

  // Add Door Schedule context
  try {
    const doorScheduleContext = await getDoorScheduleContext(projectSlug);
    if (doorScheduleContext) {
      prompt += '\n\n' + doorScheduleContext;
      prompt += '\n\n🚪 DOOR SCHEDULE GUIDANCE:\n';
      prompt += '• Reference door numbers, types, and dimensions from the schedule\n';
      prompt += '• Include fire ratings when discussing door requirements\n';
      prompt += '• Cite hardware sets and specific hardware components\n';
      prompt += '• Mention frame types and materials when relevant\n';
    }
  } catch (error) {
    console.error('[RAG] Error getting door schedule context:', error);
  }

  // Add Window Schedule context
  try {
    const windowScheduleContext = await getWindowScheduleContext(projectSlug);
    if (windowScheduleContext) {
      prompt += '\n\n' + windowScheduleContext;
      prompt += '\n\n🪟 WINDOW SCHEDULE GUIDANCE:\n';
      prompt += '• Reference window marks, types, and dimensions from the schedule\n';
      prompt += '• Include glazing types and performance specs (U-value, SHGC)\n';
      prompt += '• Note egress compliance status when applicable\n';
      prompt += '• Cite manufacturers and model numbers when available\n';
    }
  } catch (error) {
    console.error('[RAG] Error getting window schedule context:', error);
  }

  // Add scale context for dimension-related queries (Phase A.3)
  if (isScaleQuery(query)) {
    try {
      const scaleContext = await getScaleContext(query, projectSlug);
      prompt += scaleContext;
    } catch (error) {
      console.error('Error adding scale context:', error);
    }
  }

  // Add drawing type context for drawing-specific queries (Phase A.4)
  if (isDrawingTypeQuery(query)) {
    try {
      const drawingTypeContext = await getDrawingTypeContext(query, projectSlug);
      if (drawingTypeContext) {
        prompt += drawingTypeContext;
      }
    } catch (error) {
      console.error('Error adding drawing type context:', error);
    }
  }

  // Add legend/symbol context for symbol-related queries (Phase A.2)
  if (isSymbolQuery(query)) {
    try {
      const legendContext = await getLegendContext(query, projectSlug);
      if (legendContext) {
        prompt += legendContext;
        // Add instruction for symbol usage
        prompt += '\n💡 SYMBOL INTERPRETATION:\n';
        prompt += '• Use the legend definitions above to interpret symbols in the plans\n';
        prompt += '• Always cite the symbol code and description when answering\n';
        prompt += '• Reference sheet numbers where symbols are used\n';
        prompt += '• Note any category or discipline associations\n';
      }
    } catch (error) {
      console.error('Error adding legend context:', error);
    }
  }

  // Add drawing type context for classification-related queries (Phase A.4)
  if (isDrawingTypeQuery(query)) {
    try {
      const drawingTypeContext = await getDrawingTypeContext(query, projectSlug);
      prompt += drawingTypeContext;
    } catch (error) {
      console.error('Error adding drawing type context:', error);
    }
  }

  // Add Phase B intelligence context (callouts, dimensions, annotations, symbols)
  try {
    const phaseBContext = await retrievePhaseBContext(query, projectSlug, chunks);
    if (phaseBContext) {
      prompt += phaseBContext;
      
      // Add Phase B instructions
      prompt += getPhaseBRAGInstructions();
    }
  } catch (error) {
    console.error('Error adding Phase B context:', error);
  }

  // Add Phase 3 intelligence data sections
  if (phase3Data.symbols && phase3Data.symbols.length > 0) {
    prompt += '\n\n=== LEARNED CONSTRUCTION SYMBOLS ===\n';
    prompt += 'The following symbols have been identified in project documents:\n\n';
    phase3Data.symbols.slice(0, 20).forEach(symbol => {
      prompt += `• ${symbol.pattern} (${symbol.category}) - ${symbol.occurrences} occurrences, ${symbol.confidence.toFixed(0)}% confidence\n`;
      if (symbol.variations.length > 1) {
        prompt += `  Variations: ${symbol.variations.slice(0, 3).join(', ')}\n`;
      }
    });
  }

  if (phase3Data.isometricViews && phase3Data.isometricViews.length > 0) {
    const isoSummary = phase3Data.isometricViews[0];
    prompt += '\n\n=== ISOMETRIC VIEW ANALYSIS ===\n';
    prompt += `• ${isoSummary.totalViews} isometric/riser diagram views detected\n`;
    prompt += `• ${isoSummary.totalElements} MEP elements analyzed\n`;
    if (isoSummary.criticalClearances > 0) {
      prompt += `• ⚠️ ${isoSummary.criticalClearances} critical clearance issues identified\n`;
    }
    if (isoSummary.bySystem) {
      prompt += '\nViews by system:\n';
      Object.entries(isoSummary.bySystem).forEach(([system, count]) => {
        prompt += `  • ${system}: ${count} views\n`;
      });
    }
  }

  if (phase3Data.pathAnalysis) {
    const analysis = phase3Data.pathAnalysis;
    prompt += '\n\n=== MEP PATH ANALYSIS ===\n';
    prompt += `Trade: ${analysis.trade}\n`;
    prompt += `• ${analysis.totalEquipment} equipment items\n`;
    prompt += `• ${analysis.avgDistance.toFixed(1)} units average routing distance\n`;
    prompt += `• ${analysis.totalConflicts} potential conflicts detected\n`;
    prompt += `• ${analysis.overallEfficiency.toFixed(0)}% routing efficiency\n`;
    if (analysis.criticalPaths && analysis.criticalPaths.length > 0) {
      prompt += `\n⚠️ ${analysis.criticalPaths.length} critical paths requiring attention:\n`;
      analysis.criticalPaths.forEach((path, idx) => {
        prompt += `  ${idx + 1}. ${path.equipment.length} equipment items, ${path.efficiency.toFixed(0)}% efficiency, ${path.conflicts.length} conflicts\n`;
      });
    }
  }

  return prompt;
}

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
    console.error('Error getting legend context:', error);
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
      summary += `  • ${category}: ${entries.length} symbols\n`;
    });

    // Disciplines
    if (Object.keys(library.byDiscipline).length > 0) {
      summary += '\nSymbols by discipline:\n';
      Object.entries(library.byDiscipline).forEach(([discipline, entries]) => {
        summary += `  • ${discipline}: ${entries.length} symbols\n`;
      });
    }

    return summary;
  } catch (error) {
    console.error('Error getting symbol library summary:', error);
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
        context += `  ⚠️  Multiple scales on this sheet (${scaleData.scaleCount} total)\n`;
        if (scaleData.secondaryScales && scaleData.secondaryScales.length > 0) {
          scaleData.secondaryScales.forEach((s) => {
            context += `     - ${s.scaleString} ${s.viewportName ? `(${s.viewportName})` : ''}\n`;
          });
        }
      }
      context += '\n';
    });

    context += '\n💡 SCALE USAGE GUIDELINES:\n';
    context += '• Use the scale ratio for accurate dimension calculations\n';
    context += '• For sheets with multiple scales, verify which viewport/detail applies\n';
    context += '• NTS (Not To Scale) drawings cannot be measured accurately\n';
    context += '• Always include units (feet, inches, meters) in your responses\n';

    return context;
  } catch (error) {
    console.error('Error getting scale context:', error);
    return '';
  }
}

/**
 * Detect if query is related to drawing types or needs drawing type context
 */
export function isDrawingTypeQuery(query: string): boolean {
  const drawingTypeKeywords = [
    'floor plan', 'elevation', 'section', 'detail', 'schedule',
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
    const drawingTypeKeywords = {
      floor_plan: ['floor plan', 'floor layout', 'level', 'typical floor'],
      elevation: ['elevation', 'exterior view', 'building elevation'],
      section: ['section', 'wall section', 'building section'],
      detail: ['detail', 'enlarged', 'connection detail'],
      schedule: ['schedule', 'door schedule', 'window schedule', 'finish schedule'],
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

    context += '\n💡 DRAWING TYPE USAGE GUIDELINES:\n';
    context += '• Floor Plans: Show room layouts, doors, windows, and spatial relationships\n';
    context += '• Elevations: Show exterior/interior vertical views and heights\n';
    context += '• Sections: Show cut-through views with construction details\n';
    context += '• Details: Show enlarged views of specific connections or assemblies\n';
    context += '• Schedules: List specifications for doors, windows, finishes, equipment\n';
    context += '• MEP Drawings: Show mechanical, electrical, and plumbing systems\n';
    context += '• Consider drawing type when interpreting symbols and annotations\n';

    return context;
  } catch (error) {
    console.error('Error getting drawing type context:', error);
    return '';
  }
}

/**
 * Format scale type for display
 */
function formatScaleType(type: string): string {
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
 * Retrieve Phase B Intelligence Context
 * Adds detail callouts, dimensions, and annotations to retrieval
 */
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
    const isCalloutQuery =
      lower.includes('detail') ||
      lower.includes('section') ||
      lower.includes('reference') ||
      lower.includes('see sheet') ||
      lower.includes('refer to') ||
      lower.includes('callout') ||
      lower.includes('elevation') ||
      lower.includes('isometric');

    // Check if query is about dimensions or measurements
    const isDimensionQuery =
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
    const isAnnotationQuery =
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
    const isSymbolQuery =
      lower.includes('symbol') ||
      lower.includes('legend') ||
      lower.includes('what is') ||
      lower.includes('what does') ||
      lower.includes('means');

    // Add callout/cross-reference context
    if (isCalloutQuery) {
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

        // Group by sheet
        type CalloutWithDocument = typeof callouts[number];
        const bySheet = callouts.reduce<Record<string, CalloutWithDocument[]>>((acc, callout) => {
          const sheet = callout.sheetNumber || 'Unknown';
          if (!acc[sheet]) acc[sheet] = [];
          acc[sheet].push(callout);
          return acc;
        }, {});

        Object.entries(bySheet).slice(0, 5).forEach(([sheet, sheetCallouts]) => {
          context += `\nSheet ${sheet} (${sheetCallouts[0].Document?.name || 'Unknown'}):\n`;
          sheetCallouts.slice(0, 5).forEach((callout) => {
            const data = callout.callouts;
            const calloutArray: CalloutItem[] = Array.isArray(data) ? data as CalloutItem[] : (data ? [data as CalloutItem] : []);
            calloutArray.slice(0, 3).forEach((item) => {
              context += `  • ${item.type?.toUpperCase() || 'DETAIL'}: ${item.detailNumber || ''} `;
              if (item.sheetReference) {
                context += `→ See Sheet ${item.sheetReference}`;
              }
              if (item.description) {
                context += `\n    ${item.description}`;
              }
              context += `\n`;
            });
          });
        });
        context += '\n';
      }
    }

    // Add dimension context
    if (isDimensionQuery) {
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
              context += `  • ${item.originalText || ''}`;
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
    if (isAnnotationQuery) {
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
        type AnnotationWithDocument = typeof annotations[number];
        const critical = annotations.filter((a) => hasPriority(a.annotations, 'critical'));
        const important = annotations.filter((a) => hasPriority(a.annotations, 'important'));
        const informational = annotations.filter((a) => hasPriority(a.annotations, 'informational'));

        if (critical.length > 0) {
          context += '\n⚠️  CRITICAL ANNOTATIONS:\n';
          critical.slice(0, 5).forEach((ann) => {
            const annArray = parseAnnotationData(ann.annotations);
            annArray.slice(0, 2).forEach((item) => {
              context += `  • [${item.type?.toUpperCase() || 'NOTE'}] ${item.text || ''}\n`;
              if (item.requirements && item.requirements.length > 0) {
                item.requirements.slice(0, 2).forEach((req) => {
                  context += `    ✓ ${req}\n`;
                });
              }
            });
          });
        }

        if (important.length > 0) {
          context += '\n⚡ IMPORTANT ANNOTATIONS:\n';
          important.slice(0, 5).forEach((ann) => {
            const annArray = parseAnnotationData(ann.annotations);
            annArray.slice(0, 2).forEach((item) => {
              context += `  • [${item.type?.toUpperCase() || 'NOTE'}] ${item.text || ''}\n`;
            });
          });
        }

        if (informational.length > 0 && !critical.length && !important.length) {
          context += '\n📝 INFORMATIONAL NOTES:\n';
          informational.slice(0, 5).forEach((ann) => {
            const annArray = parseAnnotationData(ann.annotations);
            annArray.slice(0, 3).forEach((item) => {
              context += `  • ${item.text || ''}\n`;
            });
          });
        }
        context += '\n';
      }
    }

    // Add symbol context
    if (isSymbolQuery) {
      // Extract potential symbol code from query
      const symbolMatch = query.match(/\\b([A-Z]{1,3}[0-9-]+|[A-Z]+)\\b/);
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
    console.error('Error retrieving Phase B context:', error);
    return '';
  }
}

/**
 * Enrich document chunks with Phase A & B intelligence (Title Blocks, Legends, Dimensions)
 * @param chunks The document chunks to enrich
 * @param projectSlug The project slug for context
 * @returns Enriched chunks with title block, legend, and dimension metadata
 */
/** Dimension data structure for chunk enrichment */
interface DimensionData {
  dimensions: Prisma.JsonValue;
  dimensionCount: number;
  dimensionSummary: Prisma.JsonValue;
}

/** Title block chunk data */
interface TitleBlockChunk {
  id: string;
  sheetNumber: string | null;
  titleBlockData: Prisma.JsonValue;
}

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
    console.error('Error enriching with Phase A metadata:', error);
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
     {"dimensions":[{"originalText":"12'-6\"","value":12.5,"unit":"ft","type":"linear","context":"Wall height","critical":true,"confidence":0.92,"sheetNumber":"A-101"}]}
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
    const { getProjectCallouts } = await import('./detail-callout-extractor');
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
        context += `  • ${callout.number} → ${callout.sheetReference}`;
        if (callout.description) context += ` (${callout.description})`;
        if (callout.sourceLocation) context += ` [${callout.sourceLocation}]`;
        context += '\n';
      }
      context += '\n';
    }
    
    context += '💡 CALLOUT USAGE GUIDELINES:\n';
    context += '  • Detail numbers reference enlarged views on target sheets\n';
    context += '  • Section cuts show slice through building at indicated line\n';
    context += '  • Always check target sheet for complete information\n';
    context += '  • Multiple callouts may reference same detail from different locations\n';
    
    return context;
  } catch (error) {
    console.error('Error getting callout context:', error);
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
    const { getProjectDimensions } = await import('./dimension-intelligence');
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
        context += `  • ${dim.dimension || 'Unknown'} (${dim.type || 'linear'})`;
        if (dim.context) context += ` - ${dim.context}`;
        if (dim.sheetNumber) context += ` [Sheet ${dim.sheetNumber}]`;
        context += '\n';
      }
      context += '\n';
    }
    
    context += '💡 DIMENSION USAGE GUIDELINES:\n';
    context += '  • Use scale ratios for accurate calculations\n';
    context += '  • Check dimension chains for mathematical consistency\n';
    context += '  • Critical dimensions are structural or code-required\n';
    context += '  • Always verify dimensions match drawing scale\n';
    context += '  • Tolerance requirements vary by material and code\n';
    
    return context;
  } catch (error) {
    console.error('Error getting dimension context:', error);
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
    const { getAnnotationSummary } = await import('./annotation-processor');
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
        context += `  ⚠️ [${ann.type.toUpperCase()}] ${ann.text.substring(0, 80)}${ann.text.length > 80 ? '...' : ''}\n`;
      }
      context += '\n';
    }
    
    context += '💡 ANNOTATION USAGE GUIDELINES:\n';
    context += '  • Critical annotations contain code requirements\n';
    context += '  • Material specifications define required products\n';
    context += '  • Code references indicate regulatory compliance\n';
    context += '  • Warnings highlight safety or quality concerns\n';
    context += '  • Instructions detail construction sequence\n';
    
    return context;
  } catch (error) {
    console.error('Error getting annotation context:', error);
    return '';
  }
}

/**
 * Phase B.4: Standard Symbol Library Integration
 */
export function enhanceSymbolContextWithStandardLibrary(symbolContext: string): string {
  try {
    const { getLibraryStats, getTotalSymbolCount } = require('./symbol-library-manager');
    const stats = getLibraryStats();
    
    let enhanced = symbolContext;
    enhanced += '\n\n=== STANDARD SYMBOL LIBRARIES ===\n\n';
    enhanced += `Total Standard Symbols: ${getTotalSymbolCount()}\n`;
    enhanced += `Libraries Loaded: ${stats.totalLibraries}\n\n`;
    
    enhanced += 'AVAILABLE LIBRARIES:\n';
    for (const lib of stats.byCategory) {
      enhanced += `  • ${lib.library} (${lib.category}): ${lib.count} symbols\n`;
    }
    
    enhanced += '\n💡 STANDARD SYMBOL GUIDELINES:\n';
    enhanced += '  • Standard symbols follow industry conventions (ANSI, ASHRAE, ASME, NFPA)\n';
    enhanced += '  • Project-specific legends override standard definitions\n';
    enhanced += '  • Symbol variations exist for regional practices\n';
    enhanced += '  • Always reference project legend first, standards second\n';
    
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
    const { findSheetsAtLocation, parseGridCoordinate } = await import('./spatial-correlation');
    
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
    console.error('Error getting spatial intelligence:', error);
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
    const { extractMEPElements } = await import('./mep-path-tracer');
    
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
    console.error('Error getting MEP intelligence:', error);
    return null;
  }
}
