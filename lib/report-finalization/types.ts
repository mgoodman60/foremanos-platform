/**
 * Type definitions for report finalization
 */

export interface FinalizationOptions {
  conversationId: string;
  userId?: string; // Required for manual finalization
  method: 'auto' | 'manual';
  skipWarning?: boolean; // Skip user activity warning
}

export interface FinalizationResult {
  success: boolean;
  conversationId: string;
  finalized: boolean;
  warning?: string;
  error?: string;
  documentId?: string;
  onedriveExported?: boolean;
  ragIndexed?: boolean;
}
