/**
 * RAG System Enhancements for Construction Document Analysis
 *
 * Barrel re-export file. Implementation split into focused modules in lib/rag/.
 *
 * Modules:
 * - types: Type definitions and interfaces
 * - mep-entities: MEP entity reference data
 * - abbreviations: Construction abbreviation dictionary
 * - query-classification: Query intent classification
 * - measurement-extraction: OCR validation and measurement extraction
 * - retrieval-strategies: Two-pass retrieval and cross-reference bundling
 * - context-generation: Enhanced context generation
 * - takeoff-extraction: Takeoff item extraction and rollup
 * - symbol-legend: Symbol legend parsing
 * - mep-coordination: MEP conflict detection
 * - diagram-analysis: Diagram element analysis
 * - compliance-checking: Code library and compliance checking
 * - export-utilities: CSV export and highlight metadata
 * - takeoff-verification: Takeoff verification
 * - scale-detection: Multi-scale detection and scale bar analysis
 * - spatial-analysis: Grid reference extraction and spatial context
 * - system-topology: System topology reconstruction
 * - isometric-views: Isometric view interpretation
 * - advanced-conflicts: Advanced conflict detection
 * - symbol-learning: Project symbol learning
 */

// Types
export type {
  EnhancedChunkMetadata,
  EnhancedChunk,
  MeasurementInfo,
  ValidationResult,
  TakeoffItem,
  TakeoffRollup,
  TakeoffResult,
  SymbolLegendItem,
  SymbolLegend,
  CoordinationConflict,
  DiagramElement,
  DiagramAnalysis,
  CodeReference,
  CodeLibrary,
  ComplianceIssue,
  ComplianceReport,
  ExportOptions,
  HighlightRegion,
  LengthCalculation,
  VerificationResult,
  AbbreviationDictionary,
  GridReference,
  SpatialLocation,
  ScaleInfo,
  MultiScaleDocument,
  ScaleBar,
  SystemNode,
  SystemConnection,
  SystemTopology,
  IsometricElement,
  IsometricView,
  AdvancedConflict,
  LearnedSymbol,
  SymbolLibrary,
} from './rag/types';

// MEP entity reference data
export { MEP_ENTITIES } from './rag/mep-entities';

// Abbreviations
export {
  CONSTRUCTION_ABBREVIATIONS,
  buildProjectAbbreviationDictionary,
  expandAbbreviations,
} from './rag/abbreviations';

// Query classification
export { classifyQueryIntent } from './rag/query-classification';

// Measurement extraction and OCR validation
export {
  extractMeasurement,
  validateOCR,
  validateBeforeResponse,
} from './rag/measurement-extraction';

// Retrieval strategies
export {
  twoPassRetrieval,
  bundleCrossReferences,
  mepRetrievalOrder,
} from './rag/retrieval-strategies';

// Context generation
export { generateEnhancedContext } from './rag/context-generation';

// Takeoff extraction
export {
  extractTakeoffItems,
  generateRollups,
  generateTakeoffExport,
} from './rag/takeoff-extraction';

// Symbol legend parsing
export { parseSymbolLegend } from './rag/symbol-legend';

// MEP coordination
export { detectMEPConflicts } from './rag/mep-coordination';

// Diagram analysis
export { analyzeDiagram } from './rag/diagram-analysis';

// Compliance checking
export {
  loadCodeLibrary,
  findRelevantCodes,
  checkCompliance,
} from './rag/compliance-checking';

// Export utilities
export {
  generateTakeoffCSV,
  generateHighlightMetadata,
  calculateDuctPipeLength,
} from './rag/export-utilities';

// Takeoff verification
export { verifyTakeoff } from './rag/takeoff-verification';

// Scale detection
export {
  detectMultipleScales,
  inferScaleFromDimensions,
  detectScaleBar,
  calculateWithScaleBar,
} from './rag/scale-detection';

// Spatial analysis
export {
  extractGridReferences,
  calculateGridDistance,
  findElementsInGridArea,
  generateSpatialContext,
} from './rag/spatial-analysis';

// System topology
export { reconstructSystemTopology } from './rag/system-topology';

// Isometric views
export {
  interpretIsometricView,
  extractSpatialRelationships,
} from './rag/isometric-views';

// Advanced conflicts
export { detectAdvancedConflicts } from './rag/advanced-conflicts';

// Symbol learning
export {
  learnProjectSymbols,
  applyLearnedSymbols,
  generateSymbolReport,
} from './rag/symbol-learning';
