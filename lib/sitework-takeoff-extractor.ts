/**
 * Sitework/Exterior Takeoff Extractor
 *
 * This module has been split into focused sub-modules under lib/sitework/.
 * This file re-exports everything for backward compatibility.
 *
 * Sub-modules:
 * - lib/sitework/patterns.ts          - Pattern definitions (EARTHWORK/PAVING/UTILITY)
 * - lib/sitework/unit-conversion.ts   - Unit normalization and conversion
 * - lib/sitework/drawing-classification.ts - Drawing type classification
 * - lib/sitework/extraction.ts        - Core extraction logic
 * - lib/sitework/quantity-derivation.ts - Quantity calculation functions
 * - lib/sitework/geotech-integration.ts - Geotechnical data extraction
 * - lib/sitework/cad-integration.ts   - DWG/CAD file integration
 */

export {
  // patterns
  EARTHWORK_PATTERNS,
  PAVING_PATTERNS,
  UTILITY_PATTERNS,
  ALL_SITEWORK_PATTERNS,
  // unit-conversion
  SITEWORK_UNIT_CONVERSIONS,
  normalizeUnit,
  convertUnits,
  getStandardUnit,
  // drawing-classification
  classifyDrawingType,
  // extraction
  extractByDrawingType,
  consolidateResults,
  // quantity-derivation
  calculateCutFill,
  calculateTrenchVolume,
  calculateAsphaltTonnage,
  calculateAggregateVolume,
  calculatePipeBedding,
  // geotech-integration
  extractGeotechData,
  adjustForGeotechConditions,
  // cad-integration
  CAD_LAYER_PATTERNS,
  parseCADLayerName,
  convertCADToTakeoff,
  extractFromDWG,
  extractSiteworkFromProjectModels,
  // orchestrator
  extractSiteworkTakeoff,
} from './sitework/index';

export type {
  SiteworkPattern,
  UnitConversion,
  DrawingType,
  SiteworkExtractionResult,
  DerivedQuantity,
  GeotechData,
  CADEntity,
  CADLayerData,
  CADExtractionResult,
} from './sitework/index';

export { default } from './sitework/index';
