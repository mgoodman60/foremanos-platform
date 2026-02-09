/**
 * Core Type Definitions for RAG System (from lib/rag.ts)
 *
 * Internal type/interface definitions used across the RAG retrieval pipeline.
 * These are DIFFERENT from the types in types.ts (which came from rag-enhancements.ts).
 */

import { Prisma, type DocumentCategory } from '@prisma/client';

// ============================================================================
// TYPE DEFINITIONS FOR JSON FIELDS
// ============================================================================

/** Zone information extracted from construction plans */
export interface ZoneInfo {
  name: string;
  area?: number;
  type?: string;
}

/** Title block data extracted from drawing sheets */
export interface TitleBlockData {
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
export interface ScaleInfo {
  scaleString: string;
  scaleRatio: number;
  format?: string;
  viewportName?: string;
}

/** Scale data for a document chunk */
export interface ScaleData {
  primaryScale?: ScaleInfo;
  secondaryScales?: ScaleInfo[];
  hasMultipleScales?: boolean;
  scaleCount?: number;
}

/** Dimension item extracted from plans */
export interface DimensionItem {
  originalText?: string;
  context?: string;
  type?: string;
  critical?: boolean;
  confidence?: number;
  value?: number;
  unit?: string;
}

/** Callout item from detail references */
export interface CalloutItem {
  type?: string;
  detailNumber?: string;
  sheetReference?: string;
  description?: string;
  confidence?: number;
}

/** Annotation item from construction notes */
export interface AnnotationItem {
  type?: string;
  text?: string;
  priority?: 'critical' | 'important' | 'informational';
  requirements?: string[];
  confidence?: number;
}

/** Metadata stored in DocumentChunk JSON field */
export interface ChunkMetadata {
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

  // Dynamic properties added during processing
  room_number?: string;
  spatial_context?: string;
  grid_references?: string[];
  system_topology?: {
    nodes: number;
    connections: number;
    flow: string;
  };
  isometric_view?: {
    discipline: string;
    elements: number;
    levels: number;
  };
  conflicts_detected?: {
    total: number;
    critical: number;
    major: number;
    types: string[];
  };

  // Allow additional properties for extensibility
  [key: string]: unknown;
}

/** Scored chunk for ranking during retrieval */
export interface ScoredChunk {
  chunk: DocumentChunk;
  score: number;
}

/** Prisma Document with chunks included */
export interface DocumentWithChunks {
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
export interface DetailCalloutWithDocument {
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
export interface DimensionAnnotationWithDocument {
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
export interface EnhancedAnnotationWithDocument {
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
export interface RegulatoryChunk {
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
export interface AdminCorrection {
  id: string;
  originalQuestion: string;
  correctedAnswer: string;
  adminNotes: string | null;
  keywords: string[];
  usageCount: number;
}

/** Scored correction extends AdminCorrection with a score */
export interface ScoredCorrection extends AdminCorrection {
  score: number;
}

// ============================================================================
// DOCUMENT CHUNK INTERFACE
// ============================================================================

export interface DocumentChunk {
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
export interface PathEquipmentItem {
  id: string;
  name: string;
  type?: string;
  location?: { x: number; y: number };
}

/** Conflict in MEP path analysis */
export interface PathConflict {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  description?: string;
  location?: { x: number; y: number };
}

/** Critical path in MEP routing */
export interface CriticalPath {
  equipment: PathEquipmentItem[];
  efficiency: number;
  conflicts: PathConflict[];
}

export interface Phase3ContextData {
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

/** Dimension data structure for chunk enrichment */
export interface DimensionData {
  dimensions: Prisma.JsonValue;
  dimensionCount: number;
  dimensionSummary: Prisma.JsonValue;
}

/** Title block chunk data */
export interface TitleBlockChunk {
  id: string;
  sheetNumber: string | null;
  titleBlockData: Prisma.JsonValue;
}
