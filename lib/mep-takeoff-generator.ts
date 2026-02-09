/**
 * MEP Takeoff Generator
 *
 * Automatically extracts and prices Mechanical, Electrical, and Plumbing items
 * from construction documents.
 *
 * This file is a barrel export. Implementation is in ./mep-takeoff/ directory.
 */

export { MEP_PRICING } from './mep-takeoff/pricing-database';
export type { MEPExtractionResult, MEPItem } from './mep-takeoff/types';
export { extractMEPTakeoffs } from './mep-takeoff/extraction';
export { triggerMEPExtractionAfterProcessing } from './mep-takeoff/triggers';
