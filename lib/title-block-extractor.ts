/**
 * Title Block Intelligence System
 * Extracts project metadata from construction drawing title blocks
 *
 * Capabilities:
 * - Sheet number and title extraction
 * - Revision tracking
 * - Scale detection
 * - Date and authorship information
 * - Discipline classification
 * - Project metadata
 *
 * NOTE: Updated Feb 2026 to support both image and PDF input.
 * PDF input is automatically detected and handled by vision APIs.
 */

import { PrismaClient } from '@prisma/client';
import { parseScaleString } from './scale-detector';
import { classifyDrawingWithPatterns, type DrawingClassification } from './drawing-classifier';
import { analyzeWithMultiProvider } from '@/lib/vision-api-multi-provider';
import { logger } from '@/lib/logger';

const prisma = new PrismaClient();

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface TitleBlockData {
  projectName: string;
  projectNumber: string;
  sheetNumber: string;
  sheetTitle: string;
  dateIssued: string | null;
  revision: string;
  revisionDate: string | null;
  drawnBy: string;
  checkedBy: string;
  scale: string;
  discipline: DisciplineCode;
  confidence: number; // 0-1
}

export enum DisciplineCode {
  ARCHITECTURAL = 'A',
  STRUCTURAL = 'S',
  MECHANICAL = 'M',
  ELECTRICAL = 'E',
  PLUMBING = 'P',
  FIRE_PROTECTION = 'FP',
  CIVIL = 'C',
  LANDSCAPE = 'L',
  GENERAL = 'G',
  UNKNOWN = 'UNKNOWN'
}

export interface TitleBlockExtractionResult {
  success: boolean;
  data?: TitleBlockData;
  error?: string;
  confidence: number;
  extractionMethod: 'vision' | 'pattern' | 'fallback';
}

export interface SheetIndexEntry {
  sheetNumber: string;
  sheetTitle: string;
  discipline: DisciplineCode;
  revision: string;
  dateIssued: string | null;
  documentId: string;
  documentName: string;
  pageNumber?: number;
}

// ============================================================================
// TITLE BLOCK EXTRACTION
// ============================================================================

/**
 * Extract title block data using GPT-4 Vision
 * Supports both image and PDF input (auto-detected)
 */
export async function extractTitleBlockWithVision(
  base64Data: string,
  fileName: string
): Promise<TitleBlockExtractionResult> {
  try {
    const prompt = generateTitleBlockPrompt();

    const result = await analyzeWithMultiProvider(base64Data, prompt);

    if (!result.success || !result.content) {
      throw new Error(result.error || 'No content in vision response');
    }

    const content = result.content;

    // Parse JSON response
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const extractedData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    const titleBlockData = validateAndNormalizeTitleBlock(extractedData, fileName);

    return {
      success: true,
      data: titleBlockData,
      confidence: extractedData.confidence || 0.85,
      extractionMethod: 'vision'
    };
  } catch (error) {
    logger.error('TITLE_BLOCK', 'Title block vision extraction error', error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      confidence: 0,
      extractionMethod: 'vision'
    };
  }
}

/**
 * Extract title block using text pattern matching (fallback)
 */
export function extractTitleBlockWithPatterns(
  text: string,
  fileName: string
): TitleBlockExtractionResult {
  try {
    const data: Partial<TitleBlockData> = {};

    // Sheet number patterns
    const sheetPatterns = [
      /sheet\s*(?:no\.?|number|#)?\s*:?\s*([A-Z]?\d+(?:\.\d+)?)/i,
      /sheet\s+([A-Z]\d+\.\d+)/i,
      /([A-Z]-\d+\.\d+)/,
      /([A-Z]\d{3})/
    ];
    
    for (const pattern of sheetPatterns) {
      const match = text.match(pattern);
      if (match) {
        data.sheetNumber = match[1].toUpperCase();
        break;
      }
    }

    // Discipline from sheet number
    if (data.sheetNumber) {
      data.discipline = getDisciplineFromSheetNumber(data.sheetNumber);
    }

    // Scale patterns
    const scalePatterns = [
      /scale:\s*([\d\/"'-]+\s*=\s*[\d'-]+)/i,
      /(\d+\/\d+"\s*=\s*\d+'-\d+")/,
      /(\d+"\s*=\s*\d+'-\d+")/,
      /1:[\d,]+/
    ];

    for (const pattern of scalePatterns) {
      const match = text.match(pattern);
      if (match) {
        data.scale = match[1] || match[0];
        break;
      }
    }

    // Date patterns
    const datePatterns = [
      /date:\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
      /issued:\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        data.dateIssued = match[1];
        break;
      }
    }

    // Revision patterns
    const revisionPatterns = [
      /revision:\s*([A-Z0-9]+)/i,
      /rev\.?\s*:?\s*([A-Z0-9]+)/i,
      /\brev\s+([A-Z0-9])\b/i
    ];

    for (const pattern of revisionPatterns) {
      const match = text.match(pattern);
      if (match) {
        data.revision = match[1];
        break;
      }
    }

    // Project name (usually at top)
    const projectPatterns = [
      /project:\s*([^\n]{5,100})/i,
      /project\s+name:\s*([^\n]{5,100})/i
    ];

    for (const pattern of projectPatterns) {
      const match = text.match(pattern);
      if (match) {
        data.projectName = match[1].trim();
        break;
      }
    }

    // Calculate confidence based on how many fields we found
    const fieldsFound = Object.keys(data).length;
    const confidence = Math.min(fieldsFound / 8, 0.7); // Max 0.7 for pattern matching

    if (fieldsFound < 2) {
      return {
        success: false,
        error: 'Insufficient data extracted',
        confidence: 0,
        extractionMethod: 'pattern'
      };
    }

    const titleBlockData = validateAndNormalizeTitleBlock(data as any, fileName);

    return {
      success: true,
      data: titleBlockData,
      confidence,
      extractionMethod: 'pattern'
    };
  } catch (error) {
    logger.error('TITLE_BLOCK', 'Pattern extraction error', error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      confidence: 0,
      extractionMethod: 'pattern'
    };
  }
}

/**
 * Main extraction function with fallback logic
 */
export async function extractTitleBlock(
  imageBase64: string,
  text: string,
  fileName: string
): Promise<TitleBlockExtractionResult> {
  // Try vision first (most accurate)
  const visionResult = await extractTitleBlockWithVision(imageBase64, fileName);
  
  if (visionResult.success && visionResult.confidence > 0.7) {
    return visionResult;
  }

  // Fall back to pattern matching
  const patternResult = extractTitleBlockWithPatterns(text, fileName);
  
  if (patternResult.success) {
    return patternResult;
  }

  // Return best attempt
  return visionResult.confidence > patternResult.confidence ? visionResult : patternResult;
}

// ============================================================================
// VALIDATION & NORMALIZATION
// ============================================================================

function validateAndNormalizeTitleBlock(
  data: any,
  fileName: string
): TitleBlockData {
  return {
    projectName: data.projectName || data.project_name || extractProjectFromFileName(fileName),
    projectNumber: data.projectNumber || data.project_number || '',
    sheetNumber: normalizeSheetNumber(data.sheetNumber || data.sheet_number || ''),
    sheetTitle: data.sheetTitle || data.sheet_title || '',
    dateIssued: normalizeDate(data.dateIssued || data.date_issued || data.date),
    revision: data.revision || data.rev || '0',
    revisionDate: normalizeDate(data.revisionDate || data.revision_date),
    drawnBy: data.drawnBy || data.drawn_by || '',
    checkedBy: data.checkedBy || data.checked_by || '',
    scale: normalizeScale(data.scale || ''),
    discipline: data.discipline || getDisciplineFromSheetNumber(data.sheetNumber) || DisciplineCode.UNKNOWN,
    confidence: data.confidence || 0.8
  };
}

function normalizeSheetNumber(sheetNumber: string): string {
  if (!sheetNumber) return '';
  
  // Remove common prefixes
  const cleaned = sheetNumber.replace(/^sheet\s*/i, '').trim();
  
  // Standardize format (e.g., A-1.1 or A1.1 or A101)
  return cleaned.toUpperCase();
}

function normalizeScale(scale: string): string {
  if (!scale) return '';
  
  // Common scale formats:
  // 1/4"=1'-0", 1:100, 1/8" = 1'-0"
  return scale.trim();
}

function normalizeDate(date: string | null): string | null {
  if (!date) return null;
  
  try {
    // Try to parse and format consistently
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) return date; // Keep original if can't parse
    
    return parsed.toISOString().split('T')[0]; // YYYY-MM-DD
  } catch {
    return date; // Keep original on error
  }
}

function extractProjectFromFileName(fileName: string): string {
  // Try to extract project name from file name
  const cleaned = fileName
    .replace(/\.[^.]+$/, '') // Remove extension
    .replace(/[-_]/g, ' ') // Replace separators
    .replace(/\d{8,}/g, '') // Remove long numbers
    .trim();
  
  return cleaned || 'Unknown Project';
}

// ============================================================================
// DISCIPLINE DETECTION
// ============================================================================

export function getDisciplineFromSheetNumber(sheetNumber: string): DisciplineCode {
  if (!sheetNumber) return DisciplineCode.UNKNOWN;
  
  const upper = sheetNumber.toUpperCase();
  
  // Check first character or prefix
  if (upper.startsWith('A')) return DisciplineCode.ARCHITECTURAL;
  if (upper.startsWith('S')) return DisciplineCode.STRUCTURAL;
  if (upper.startsWith('M')) return DisciplineCode.MECHANICAL;
  if (upper.startsWith('E')) return DisciplineCode.ELECTRICAL;
  if (upper.startsWith('P')) return DisciplineCode.PLUMBING;
  if (upper.startsWith('FP')) return DisciplineCode.FIRE_PROTECTION;
  if (upper.startsWith('C')) return DisciplineCode.CIVIL;
  if (upper.startsWith('L')) return DisciplineCode.LANDSCAPE;
  if (upper.startsWith('G')) return DisciplineCode.GENERAL;
  
  return DisciplineCode.UNKNOWN;
}

export function getDisciplineName(code: DisciplineCode): string {
  const names: Record<DisciplineCode, string> = {
    [DisciplineCode.ARCHITECTURAL]: 'Architectural',
    [DisciplineCode.STRUCTURAL]: 'Structural',
    [DisciplineCode.MECHANICAL]: 'Mechanical',
    [DisciplineCode.ELECTRICAL]: 'Electrical',
    [DisciplineCode.PLUMBING]: 'Plumbing',
    [DisciplineCode.FIRE_PROTECTION]: 'Fire Protection',
    [DisciplineCode.CIVIL]: 'Civil',
    [DisciplineCode.LANDSCAPE]: 'Landscape',
    [DisciplineCode.GENERAL]: 'General',
    [DisciplineCode.UNKNOWN]: 'Unknown'
  };
  
  return names[code];
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Store title block data in database
 */
export async function storeTitleBlockData(
  documentId: string,
  chunkId: string,
  titleBlockData: TitleBlockData
): Promise<void> {
  try {
    // Extract scale information if available
    let scaleData = null;
    let primaryScale = null;
    let scaleRatio = null;
    let scaleType: string | null = null;
    let hasMultipleScales = false;

    if (titleBlockData.scale) {
      const parsedScale = parseScaleString(titleBlockData.scale);
      if (parsedScale.ratio > 0) {
        primaryScale = titleBlockData.scale;
        scaleRatio = parsedScale.ratio;
        scaleType = parsedScale.format === 'architectural' ? 'architectural_imperial' : 
                     parsedScale.format === 'engineering' ? 'engineering' :
                     parsedScale.format === 'metric' ? 'metric_standard' : null;
        hasMultipleScales = false; // Single scale from title block
      }
    }

    // Classify drawing type (Phase A.4)
    let drawingType: string | null = null;
    let drawingTypeConfidence: number | null = null;
    let isCompositeDrawing = false;

    // Get chunk content for classification
    const chunk = await prisma.documentChunk.findUnique({
      where: { id: chunkId },
      select: { content: true },
    });

    if (chunk) {
      const classification = classifyDrawingWithPatterns(
        titleBlockData.sheetNumber || '',
        titleBlockData.sheetTitle || (titleBlockData as any).title || ''
      );

      drawingType = classification.type;
      drawingTypeConfidence = classification.confidence;
      isCompositeDrawing = false; // Will be determined by context
    }

    await prisma.documentChunk.update({
      where: { id: chunkId },
      data: {
        titleBlockData: titleBlockData as any,
        sheetNumber: titleBlockData.sheetNumber,
        revision: titleBlockData.revision,
        dateIssued: titleBlockData.dateIssued ? new Date(titleBlockData.dateIssued) : null,
        discipline: titleBlockData.discipline,
        // Scale information (Phase A.3)
        scaleData: scaleData as any,
        primaryScale,
        scaleRatio,
        scaleType,
        hasMultipleScales,
        // Drawing type classification (Phase A.4)
        drawingType,
        drawingTypeConfidence,
        isCompositeDrawing,
      }
    });

    logger.info('TITLE_BLOCK', `Title block data stored for sheet ${titleBlockData.sheetNumber}`, {
      scale: primaryScale ? `${primaryScale} (1:${scaleRatio})` : undefined,
      drawingType: drawingType ? `${drawingType} (${Math.round(drawingTypeConfidence! * 100)}%)` : undefined,
    });
  } catch (error) {
    logger.error('TITLE_BLOCK', 'Error storing title block data', error as Error);
    throw error;
  }
}

/**
 * Get sheet index for a project
 */
export async function getSheetIndex(projectSlug: string): Promise<SheetIndexEntry[]> {
  try {
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      include: {
        Document: {
          include: {
            DocumentChunk: {
              where: {
                sheetNumber: { not: null }
              },
              distinct: ['sheetNumber'],
              orderBy: { sheetNumber: 'asc' }
            }
          }
        }
      }
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const sheets: SheetIndexEntry[] = [];

    for (const document of project.Document) {
      for (const chunk of document.DocumentChunk) {
        if (chunk.sheetNumber) {
          const titleBlock = chunk.titleBlockData as any;
          
          sheets.push({
            sheetNumber: chunk.sheetNumber,
            sheetTitle: titleBlock?.sheetTitle || '',
            discipline: (chunk.discipline as DisciplineCode) || DisciplineCode.UNKNOWN,
            revision: chunk.revision || '0',
            dateIssued: chunk.dateIssued ? chunk.dateIssued.toISOString().split('T')[0] : null,
            documentId: document.id,
            documentName: document.name,
            pageNumber: chunk.pageNumber || undefined
          });
        }
      }
    }

    // Sort by discipline and sheet number
    sheets.sort((a, b) => {
      if (a.discipline !== b.discipline) {
        return a.discipline.localeCompare(b.discipline);
      }
      return a.sheetNumber.localeCompare(b.sheetNumber);
    });

    return sheets;
  } catch (error) {
    logger.error('TITLE_BLOCK', 'Error getting sheet index', error as Error);
    throw error;
  }
}

// ============================================================================
// PROMPT GENERATION
// ============================================================================

function generateTitleBlockPrompt(): string {
  return `You are analyzing a construction drawing to extract title block information.

Title blocks are typically located in the bottom-right corner and contain critical project metadata.

Extract the following information and return as JSON:

{
  "projectName": "Full project name",
  "projectNumber": "Project ID or number",
  "sheetNumber": "Sheet identifier (e.g., A-101, S2.1, M-301)",
  "sheetTitle": "Sheet description or title",
  "dateIssued": "Date in MM/DD/YYYY format",
  "revision": "Revision letter or number",
  "revisionDate": "Revision date if different from issue date",
  "drawnBy": "Person who drew the sheet",
  "checkedBy": "Person who checked/approved",
  "scale": "Drawing scale (e.g., 1/4\"=1'-0\", 1:100)",
  "discipline": "Discipline code (A, S, M, E, P, FP, C, L, G)",
  "confidence": 0.95
}

Rules:
1. Look for the title block in the bottom-right corner first
2. Sheet numbers follow patterns like: A-101, S2.1, M-301, E-201
3. Discipline codes:
   - A = Architectural
   - S = Structural  
   - M = Mechanical
   - E = Electrical
   - P = Plumbing
   - FP = Fire Protection
   - C = Civil
   - L = Landscape
   - G = General
4. Scale is usually near the sheet number
5. Revisions are letters (A, B, C) or numbers
6. Set confidence 0-1 based on clarity

If any field is not found, use empty string "" for text fields, null for dates.
Return ONLY the JSON object, no additional text.`;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function isTitleBlockExtracted(chunk: any): boolean {
  return !!chunk.titleBlockData || !!chunk.sheetNumber;
}

export function getTitleBlockSummary(titleBlock: TitleBlockData): string {
  const parts = [
    titleBlock.sheetNumber,
    titleBlock.sheetTitle,
    `Rev ${titleBlock.revision}`,
    titleBlock.scale
  ].filter(Boolean);
  
  return parts.join(' - ');
}
