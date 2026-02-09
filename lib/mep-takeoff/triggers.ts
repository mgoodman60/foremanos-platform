/**
 * MEP Takeoff Generator - Trigger Functions
 */

import { createScopedLogger } from '../logger';
import { extractMEPTakeoffs } from './extraction';

const log = createScopedLogger('MEP_TAKEOFF');

/**
 * Trigger MEP extraction after document processing
 */
export async function triggerMEPExtractionAfterProcessing(
  projectSlug: string,
  documentName: string
): Promise<void> {
  // Only trigger for MEP-related documents
  if (documentName.match(/\b(E[\-\s]?\d|P[\-\s]?\d|M[\-\s]?\d|electrical|plumbing|mechanical|hvac)\b/i)) {
    log.info('MEP-related document detected, triggering extraction', { documentName });

    extractMEPTakeoffs(projectSlug)
      .then(result => {
        log.info('MEP extraction triggered complete', { totalCost: result.totalCost });
      })
      .catch(error => {
        log.error('MEP extraction trigger failed', error as Error);
      });
  }
}
