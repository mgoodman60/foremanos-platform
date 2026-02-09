/**
 * Daily Report Finalization Service (Phase 6)
 *
 * Handles automatic finalization of daily reports at 18:00 project time:
 * - Timezone-aware scheduling
 * - User activity detection and warnings
 * - PDF generation and locking
 * - Document library integration
 * - OneDrive export
 * - OCR and RAG indexing
 */

// Re-export types
export type { FinalizationOptions, FinalizationResult } from './types';

// Re-export validation functions
export { hasReportData, isUserActive, updateLastActivity, toZonedTime, fromZonedTime } from './validation';

// Re-export orchestrator functions (main entry points)
export { finalizeReport, getReportsReadyForFinalization, getFinalizationStatus } from './orchestrator';
