/**
 * Daily Report Finalization Service (Phase 6)
 *
 * This file is a barrel re-export for the report-finalization module.
 * See lib/report-finalization/ directory for implementation.
 */

// Re-export types
export type { FinalizationOptions, FinalizationResult } from './report-finalization/types';

// Re-export validation functions
export { hasReportData, isUserActive, updateLastActivity, toZonedTime, fromZonedTime } from './report-finalization/validation';

// Re-export orchestrator functions (main entry points)
export { finalizeReport, getReportsReadyForFinalization, getFinalizationStatus } from './report-finalization/orchestrator';
