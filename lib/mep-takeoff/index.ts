/**
 * MEP Takeoff Generator - Public API
 *
 * Automatically extracts and prices Mechanical, Electrical, and Plumbing items
 * from construction documents.
 */

export { MEP_PRICING } from './pricing-database';
export type { MEPExtractionResult, MEPItem } from './types';
export { extractMEPTakeoffs } from './extraction';
export { triggerMEPExtractionAfterProcessing } from './triggers';
