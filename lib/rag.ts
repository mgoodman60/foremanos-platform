/**
 * RAG (Retrieval Augmented Generation) System for Construction Documents
 *
 * Barrel re-export file. Implementation split into focused modules in lib/rag/.
 *
 * Modules:
 * - core-types: Type definitions (DocumentChunk, ScoredChunk, Phase3ContextData, etc.)
 * - document-retrieval: Document retrieval and context prompt generation
 * - regulatory-retrieval: Regulatory chunk retrieval and corrections
 * - phase3-context: Phase 3 context retrieval and generation
 * - intelligence-queries: Phase A/B intelligence query functions
 */

// Core types
export type {
  ZoneInfo,
  TitleBlockData,
  ScaleInfo,
  ScaleData,
  DimensionItem,
  CalloutItem,
  AnnotationItem,
  ChunkMetadata,
  ScoredChunk,
  DocumentWithChunks,
  DetailCalloutWithDocument,
  DimensionAnnotationWithDocument,
  EnhancedAnnotationWithDocument,
  RegulatoryChunk,
  AdminCorrection,
  ScoredCorrection,
  DocumentChunk,
  PathEquipmentItem,
  PathConflict,
  CriticalPath,
  Phase3ContextData,
  DimensionData,
  TitleBlockChunk,
} from './rag/core-types';

// Document retrieval
export {
  retrieveRelevantDocuments,
  generateContextPrompt,
} from './rag/document-retrieval';

// Regulatory retrieval
export {
  retrieveRegulatoryChunks,
  retrieveRelevantCorrections,
  generateContextWithCorrections,
} from './rag/regulatory-retrieval';

// Phase 3 context
export {
  retrievePhase3Context,
  generateContextWithPhase3,
} from './rag/phase3-context';

// Intelligence queries (Phase A/B)
export {
  isSymbolQuery,
  getLegendContext,
  getSymbolLibrarySummary,
  isScaleQuery,
  getScaleContext,
  isDrawingTypeQuery,
  getDrawingTypeContext,
  retrievePhaseBContext,
  enrichWithPhaseAMetadata,
  getPhaseARAGInstructions,
  getPhaseBRAGInstructions,
  isCalloutQuery,
  getCalloutContext,
  isDimensionQuery,
  getDimensionContext,
  isAnnotationQuery,
  getAnnotationContext,
  enhanceSymbolContextWithStandardLibrary,
  generateEnhancedContext,
} from './rag/intelligence-queries';
