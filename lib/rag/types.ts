/**
 * RAG System Types for Construction Document Analysis
 *
 * Extracted from lib/rag-enhancements.ts — all type/interface exports
 * used across the RAG pipeline.
 */

/**
 * Extended metadata interface for EnhancedChunk
 * Includes all possible metadata properties that may be added during processing
 */
export interface EnhancedChunkMetadata {
  // Base document metadata
  documentName?: string;
  accessLevel?: string;
  category?: string;
  sheetNumber?: string;
  scale?: string;
  projectName?: string;
  architect?: string;
  engineer?: string;
  issueDate?: string;

  // Spatial and location metadata
  room_number?: string;
  spatial_context?: string;
  grid_references?: string[];

  // System topology metadata (for MEP queries)
  system_topology?: {
    nodes: number;
    connections: number;
    flow: string;
  };

  // Isometric view metadata
  isometric_view?: {
    discipline: string;
    elements: number;
    levels: number;
  };

  // Conflict detection metadata
  conflicts_detected?: {
    total: number;
    critical: number;
    major: number;
    types: string[];
  };

  // Additional metadata fields
  labeled_dimensions?: string[];
  derived_dimensions?: string[];
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

  // Allow additional properties
  [key: string]: unknown;
}

export interface EnhancedChunk {
  id: string;
  content: string;
  documentId: string | null;
  regulatoryDocumentId?: string | null;
  pageNumber: number | null;
  metadata: EnhancedChunkMetadata;
  isRegulatory?: boolean;
  chunkType?: 'page_overview' | 'detail_callout' | 'zone_area' | 'room_space' | 'schedule_row' | 'note' | 'legend';
  retrievalMethod?: 'precision' | 'context' | 'notes_first' | 'cross_reference';
  sourceReference?: string;
  // Additional properties that may be populated from document data
  documentName?: string;
  sheetNumber?: string;
}

export interface MeasurementInfo {
  value: string;
  unit: string;
  method: 'explicit' | 'scaled' | 'unavailable';
  source: string;
  isLegible: boolean;
  confidence: 'high' | 'medium' | 'low';
}

export interface ValidationResult {
  passed: boolean;
  issues: string[];
  warnings: string[];
}

/**
 * Material Takeoff Interfaces
 */
export interface TakeoffItem {
  trade: string;
  system: string;
  itemType: string;
  itemTagOrId: string;
  description: string;
  quantity: number | string;
  unit: string;
  sizeOrRating: string;
  method: 'counted' | 'dimensioned' | 'scaled' | 'not_quantified';
  sourceRefs: string[];
  exclusionsOrNotes: string;
  confidence: 'high' | 'medium' | 'low';
  confidenceBasis: string;
}

export interface TakeoffRollup {
  trade: string;
  system?: string;
  groupBy: 'trade' | 'system' | 'size' | 'area' | 'item_type';
  groupValue: string;
  totalQuantity: number;
  unit: string;
  itemCount: number;
  confidence: 'high' | 'medium' | 'low';
  confidenceBasis: string;
  items: TakeoffItem[];
}

export interface TakeoffResult {
  projectName: string;
  generatedDate: string;
  requestedBy: string;
  scope: string;
  items: TakeoffItem[];
  rollups?: TakeoffRollup[];
  warnings: string[];
  disclaimers: string[];
  totalItems: number;
  countedItems: number;
  measuredItems: number;
  notQuantifiedItems: number;
}

/**
 * Symbol Legend Parsing Types
 */
export interface SymbolLegendItem {
  symbol: string;
  description: string;
  trade: 'hvac' | 'plumbing' | 'electrical' | 'fire_alarm';
  category: string;
  size?: string;
  sourceSheet: string;
}

export interface SymbolLegend {
  symbols: SymbolLegendItem[];
  sheet: string;
  trade: string;
  lastUpdated: Date;
}

/**
 * MEP Coordination Conflict Detection Types
 */
export interface CoordinationConflict {
  type: 'clash' | 'clearance' | 'access' | 'sequencing' | 'load';
  severity: 'critical' | 'major' | 'minor';
  systems: string[];
  location: string;
  description: string;
  recommendations: string[];
  sourceSheets: string[];
}

/**
 * Enhanced Diagram Understanding Types
 */
export interface DiagramElement {
  type: 'equipment' | 'connection' | 'label' | 'annotation';
  id: string;
  description: string;
  connections: string[];
  properties: Record<string, string>;
  location?: {
    x?: number;
    y?: number;
    floor?: string;
  };
}

export interface DiagramAnalysis {
  diagramType: 'one_line' | 'riser' | 'flow' | 'schematic' | 'logic';
  trade: string;
  elements: DiagramElement[];
  systemFlow: string[];
  notes: string[];
  sourceSheet: string;
}

/**
 * Code Library Integration Types
 */
export interface CodeReference {
  standard: string; // 'IBC', 'NEC', 'IPC', 'IMC', 'NFPA', 'ADA'
  version: string;
  section: string;
  title: string;
  text: string;
  applicability: string[];
  keywords: string[];
}

export interface CodeLibrary {
  standards: Map<string, CodeReference[]>;
  lastUpdated: Date;
}

/**
 * Compliance Checking Types
 */
export interface ComplianceIssue {
  severity: 'violation' | 'warning' | 'recommendation';
  code: string; // e.g., "IBC 1010.1.1"
  requirement: string;
  finding: string;
  location: string;
  recommendation: string;
  sourceSheet: string;
}

export interface ComplianceReport {
  projectName: string;
  checkDate: Date;
  codesChecked: string[];
  issues: ComplianceIssue[];
  summary: {
    violations: number;
    warnings: number;
    recommendations: number;
    compliant: number;
    totalChecks: number;
  };
}

/**
 * CSV/Excel Export Types
 */
export interface ExportOptions {
  format: 'csv' | 'excel';
  includeRollups: boolean;
  includeMetadata: boolean;
  groupBy?: 'trade' | 'system' | 'area';
}

/**
 * Visual Takeoff Highlighting Types
 */
export interface HighlightRegion {
  itemId: string;
  sheet: string;
  pageNumber: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  color: string;
  label: string;
  category: string;
}

/**
 * Automatic Duct/Pipe Length Calculation Types
 */
export interface LengthCalculation {
  system: string;
  tag: string;
  calculatedLength: number;
  unit: string;
  method: 'scaled' | 'additive' | 'estimated';
  confidence: 'high' | 'medium' | 'low';
  segments: Array<{
    from: string;
    to: string;
    length: number;
    sheet: string;
  }>;
  notes: string[];
}

/**
 * AI-Assisted Verification Types
 */
export interface VerificationResult {
  passed: boolean;
  score: number; // 0-100
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
  suggestions: string[];
}

/**
 * Abbreviation Dictionary Type
 */
export interface AbbreviationDictionary {
  [key: string]: {
    expansion: string;
    category: 'general' | 'hvac' | 'plumbing' | 'electrical' | 'structural' | 'architectural';
    context?: string;
    alternatives?: string[];
  };
}

/**
 * Grid-Based Spatial Referencing Types
 */
export interface GridReference {
  gridId: string;                   // e.g., "A.1", "3/B", "C-4"
  gridType: 'structural' | 'area' | 'room' | 'detail';
  coordinates?: {
    x: string;                      // horizontal grid line (e.g., "A", "1")
    y: string;                      // vertical grid line (e.g., "3", "B")
  };
  description?: string;             // e.g., "Between grids A and B"
  confidence: 'high' | 'medium' | 'low';
}

export interface SpatialLocation {
  gridReferences: GridReference[];
  roomNumber?: string;
  areaDescription?: string;
}

/**
 * Scale Detection Types (Phase 3A)
 */
export interface ScaleInfo {
  scale: string;                    // e.g., "1/4\" = 1'-0\"", "1:100"
  scaleType: 'architectural' | 'engineering' | 'metric' | 'graphic' | 'unknown';
  scaleFactor: number;              // numerical conversion factor
  applicableArea?: {                // area where this scale applies
    sheetArea: string;              // e.g., "Detail A", "Plan View", "Entire Sheet"
    gridBounds?: string[];          // e.g., ["A.1", "C.5"]
    confidence: 'high' | 'medium' | 'low';
  };
  source: 'title_block' | 'detail_callout' | 'scale_bar' | 'inferred';
  confidence: 'high' | 'medium' | 'low';
}

export interface MultiScaleDocument {
  documentId: string;
  sheetNumber: string;
  defaultScale: ScaleInfo;
  additionalScales: ScaleInfo[];
  scaleWarnings: string[];
}

export interface ScaleBar {
  detected: boolean;
  units: string[];                  // e.g., ["0", "10", "20", "40 FT"]
  pixelWidth?: number;              // visual width of scale bar
  realWorldDistance?: number;       // corresponding real distance
  scaleFactor?: number;             // calculated conversion factor
  location: string;                 // where on sheet (e.g., "bottom right")
  confidence: 'high' | 'medium' | 'low';
}

/**
 * System Topology Types (Phase 3C)
 */
export interface SystemNode {
  id: string;                       // Equipment/device ID
  type: 'equipment' | 'device' | 'junction' | 'endpoint';
  name: string;
  properties: {
    [key: string]: string | number;
  };
  location?: {
    gridRef?: string;
    room?: string;
    floor?: string;
  };
}

export interface SystemConnection {
  from: string;                     // Source node ID
  to: string;                       // Target node ID
  connectionType: 'supply' | 'return' | 'power' | 'control' | 'data' | 'drain' | 'vent';
  properties?: {
    size?: string;
    capacity?: string;
    material?: string;
  };
  confidence: 'high' | 'medium' | 'low';
}

export interface SystemTopology {
  systemName: string;
  systemType: 'hvac' | 'plumbing' | 'electrical' | 'fire_alarm';
  nodes: SystemNode[];
  connections: SystemConnection[];
  flow: string[];                   // Ordered sequence of node IDs showing flow path
  warnings: string[];
}

/**
 * Isometric View Types (Phase 3C)
 */
export interface IsometricElement {
  id: string;
  elementType: 'pipe' | 'duct' | 'conduit' | 'fitting' | 'equipment' | 'support';
  geometry: {
    startPoint?: { x: number; y: number; z: number };
    endPoint?: { x: number; y: number; z: number };
    orientation?: 'horizontal' | 'vertical' | 'angled';
    elevation?: number;
  };
  properties: {
    size?: string;
    material?: string;
    slope?: string;
  };
  connections: string[];           // IDs of connected elements
}

export interface IsometricView {
  viewName: string;
  discipline: 'plumbing' | 'hvac' | 'electrical' | 'structural';
  elements: IsometricElement[];
  spatialHierarchy: {
    level: number;
    elements: string[];
  }[];
  warnings: string[];
}

/**
 * Advanced Conflict Detection Types (Phase 3C)
 */
export interface AdvancedConflict {
  conflictId: string;
  severity: 'critical' | 'major' | 'minor' | 'warning';
  conflictType:
    | 'spatial_clash'
    | 'code_violation'
    | 'clearance_issue'
    | 'access_problem'
    | 'load_conflict'
    | 'incompatible_materials'
    | 'coordination_gap';
  location: {
    gridRef?: string;
    room?: string;
    floor?: string;
    elevation?: number;
  };
  description: string;
  affectedSystems: string[];
  affectedElements: string[];
  codeReference?: string;
  recommendations: string[];
  estimatedCost?: {
    min: number;
    max: number;
    currency: string;
  };
}

/**
 * Adaptive Symbol Learning Types (Phase 3C)
 */
export interface LearnedSymbol {
  symbolId: string;
  symbolType: string;
  category: 'hvac' | 'plumbing' | 'electrical' | 'architectural' | 'structural';
  appearances: {
    documentId: string;
    pageNumber: number;
    context: string;
    confidence: number;
  }[];
  variations: string[];             // Different representations of same symbol
  standardMapping?: string;          // Maps to standard symbol
  learningConfidence: number;        // 0-1 score
}

export interface SymbolLibrary {
  projectId: string;
  symbols: LearnedSymbol[];
  lastUpdated: Date;
  totalAppearances: number;
}
