/**
 * Type definitions for Prisma JSON fields related to documents.
 * These interfaces provide type safety for JSON columns in the database.
 */

/**
 * Metadata stored in DocumentChunk.metadata JSON field.
 * Contains context about where the chunk came from and its content type.
 */
export interface DocumentChunkMetadata {
  /** Scheduled activities or tasks mentioned in the chunk */
  activities?: string;
  /** Associated conversation/report ID */
  conversationId?: string;
  /** Date of the report this chunk belongs to */
  reportDate?: string;
  /** Type of content (e.g., 'schedule', 'budget', 'notes') */
  type?: string;
  /** Project ID this chunk belongs to */
  projectId?: string;
  /** Page number in the source document */
  pageNumber?: number;
  /** Section or heading this chunk falls under */
  section?: string;
  /** Source document name */
  documentName?: string;
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * Metadata stored in Document.metadata JSON field.
 * Contains extracted information about the document.
 */
export interface DocumentMetadata {
  /** Document title extracted from content */
  title?: string;
  /** Document author */
  author?: string;
  /** Creation date from document properties */
  createdDate?: string;
  /** Last modified date */
  modifiedDate?: string;
  /** Number of pages (for PDFs) */
  pageCount?: number;
  /** Whether OCR was applied */
  ocrApplied?: boolean;
  /** Confidence score from OCR/extraction */
  confidence?: number;
  /** Extracted sheet number (for drawings) */
  sheetNumber?: string;
  /** Drawing scale (e.g., "1/4\" = 1'-0\"") */
  scale?: string;
  /** Drawing revision number */
  revision?: string;
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * Metadata for project data sources.
 * Tracks where extracted data came from.
 */
export interface DataSourceMetadata {
  /** Source document ID */
  documentId?: string;
  /** Extraction method used */
  extractionMethod?: 'ai' | 'ocr' | 'manual' | 'api';
  /** Confidence score of extraction */
  confidence?: number;
  /** Timestamp of extraction */
  extractedAt?: string;
  /** Version of extraction algorithm */
  extractorVersion?: string;
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * Type helper for casting Prisma JSON fields safely.
 * Use with optional chaining for null-safe access.
 *
 * @example
 * const metadata = asMetadata<DocumentChunkMetadata>(chunk.metadata);
 * const activities = metadata?.activities;
 */
export function asMetadata<T extends Record<string, unknown>>(
  value: unknown
): T | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'object') {
    return value as T;
  }
  return null;
}
