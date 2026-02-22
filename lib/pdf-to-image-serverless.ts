/**
 * Serverless-Compatible PDF to Image Conversion
 * 
 * Provides multiple strategies for PDF processing in serverless environments:
 * 1. Claude PDF Document API (native PDF support with visual understanding)
 * 2. PDF.js text extraction with enhanced AI prompting
 * 3. Page-by-page base64 encoding for vision APIs
 * 
 * For construction documents, visual processing gives significantly better results:
 * - Floor plans maintain spatial relationships
 * - Symbols and legends are properly interpreted
 * - Dimensions and callouts are understood in context
 */

import { PDFDocument } from 'pdf-lib';
import { logger } from '@/lib/logger';

export interface PageImage {
  pageNumber: number;
  base64: string;
  mimeType: string;
  width?: number;
  height?: number;
  source: 'pdf-native' | 'rasterized' | 'extracted';
}

export interface RenderOptions {
  dpi?: number;
  maxWidth?: number;
  maxHeight?: number;
  format?: 'png' | 'jpeg';
  quality?: number;
}

/**
 * Extract single page from PDF as base64-encoded PDF
 * This allows vision APIs to process individual pages with full visual fidelity
 */
export async function extractPageAsPdf(
  pdfBuffer: Buffer,
  pageNumber: number
): Promise<{ base64: string; pageCount: number }> {
  try {
    const srcDoc = await PDFDocument.load(new Uint8Array(pdfBuffer));
    const pageCount = srcDoc.getPageCount();
    
    if (pageNumber < 1 || pageNumber > pageCount) {
      throw new Error(`Page ${pageNumber} out of range (1-${pageCount})`);
    }
    
    // Create new PDF with just the target page
    const newDoc = await PDFDocument.create();
    const [copiedPage] = await newDoc.copyPages(srcDoc, [pageNumber - 1]);
    newDoc.addPage(copiedPage);
    
    const singlePagePdf = await newDoc.save();
    
    return {
      base64: Buffer.from(singlePagePdf).toString('base64'),
      pageCount,
    };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('PDF_SERVERLESS', 'Error extracting page', undefined, { message: errMsg });
    throw error;
  }
}

/**
 * Get PDF page dimensions and metadata
 */
export async function getPageInfo(
  pdfBuffer: Buffer,
  pageNumber: number = 1
): Promise<{ width: number; height: number; rotation: number; pageCount: number }> {
  const doc = await PDFDocument.load(new Uint8Array(pdfBuffer));
  const pageCount = doc.getPageCount();
  
  if (pageNumber < 1 || pageNumber > pageCount) {
    throw new Error(`Page ${pageNumber} out of range`);
  }
  
  const page = doc.getPage(pageNumber - 1);
  const { width, height } = page.getSize();
  const rotation = page.getRotation().angle;
  
  return { width, height, rotation, pageCount };
}

/**
 * Estimate if a page is likely a drawing vs text document
 * Uses page dimensions and aspect ratio heuristics
 */
export async function estimatePageType(
  pdfBuffer: Buffer,
  pageNumber: number = 1
): Promise<'drawing' | 'text' | 'mixed'> {
  try {
    const info = await getPageInfo(pdfBuffer, pageNumber);
    const aspectRatio = Math.max(info.width, info.height) / Math.min(info.width, info.height);
    
    // Large format pages (>11x17 at 72dpi) are likely drawings
    // Standard paper is ~612x792 (8.5x11 at 72dpi)
    const isLargeFormat = info.width > 1200 || info.height > 1200;
    const isLandscape = info.width > info.height;
    const isWideAspect = aspectRatio > 1.5;
    
    // Construction drawings are typically:
    // - Large format (24x36, 30x42, etc.)
    // - Landscape orientation
    // - Wide aspect ratio (for arch/eng sheets)
    if (isLargeFormat || (isLandscape && isWideAspect)) {
      return 'drawing';
    }
    
    // Portrait standard size is likely text spec
    if (!isLandscape && info.width < 700) {
      return 'text';
    }
    
    return 'mixed';
  } catch {
    return 'mixed';
  }
}

/**
 * Split PDF into individual page PDFs for processing
 * Returns base64 encoded single-page PDFs
 */
export async function splitPdfIntoPages(
  pdfBuffer: Buffer,
  startPage: number = 1,
  endPage?: number
): Promise<PageImage[]> {
  const srcDoc = await PDFDocument.load(new Uint8Array(pdfBuffer));
  const pageCount = srcDoc.getPageCount();
  const lastPage = endPage ? Math.min(endPage, pageCount) : pageCount;
  
  const pages: PageImage[] = [];
  
  for (let i = startPage; i <= lastPage; i++) {
    try {
      const { base64 } = await extractPageAsPdf(pdfBuffer, i);
      const pageType = await estimatePageType(pdfBuffer, i);
      
      pages.push({
        pageNumber: i,
        base64,
        mimeType: 'application/pdf',
        source: 'pdf-native',
      });
      
      logger.info('PDF_SERVERLESS', 'Extracted page', { page: i, totalPages: lastPage, pageType });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('PDF_SERVERLESS', 'Error extracting page', undefined, { page: i, message: errMsg });
    }
  }
  
  return pages;
}

/**
 * Get optimized vision prompt for construction drawings
 * Includes specific instructions for visual analysis
 */
export function getConstructionDrawingPrompt(
  fileName: string,
  pageNumber: number,
  pageType: 'drawing' | 'text' | 'mixed' = 'drawing'
): string {
  const baseInstructions = `You are analyzing page ${pageNumber} of a construction document: ${fileName}.

IMPORTANT VISUAL ANALYSIS INSTRUCTIONS:
- Carefully examine ALL visual elements on the page
- Look at symbols, lines, dimensions, annotations, and their spatial relationships
- Note any legends, title blocks, or reference callouts
- Pay attention to scale indicators and north arrows
- Identify room names/numbers from within the drawing areas
- Extract dimension strings exactly as shown
- Note any revision clouds or recent changes marked
`;

  const drawingPrompt = `${baseInstructions}
This appears to be a CONSTRUCTION DRAWING. Focus on:

1. **Title Block Info**:
   - Sheet number (e.g., A-101, M-201)
   - Sheet title/description
   - Scale(s) shown
   - Date and revision info

2. **Drawing Content**:
   - Type of drawing (floor plan, elevation, section, detail, schedule)
   - Key elements shown (rooms, equipment, systems)
   - Grid lines and reference marks
   - Dimension callouts

3. **Symbols & Annotations**:
   - Door/window types and marks
   - Equipment tags
   - Section/detail references
   - Specification references
   - Notes and general notes

4. **Spatial Information**:
   - Room names and numbers
   - Areas and dimensions
   - Adjacencies and relationships
   - North orientation`;

  const textPrompt = `${baseInstructions}
This appears to be a TEXT DOCUMENT (specification/schedule). Focus on:

1. **Document Info**:
   - Document title
   - Section numbers (CSI format if applicable)
   - Revision/issue dates

2. **Content Structure**:
   - Main headings and sections
   - Subsections and paragraphs
   - Tables and schedules
   - Referenced standards

3. **Key Data**:
   - Product specifications
   - Quantities and dimensions
   - Submittal requirements
   - Quality standards`;

  const prompt = pageType === 'text' ? textPrompt : drawingPrompt;
  
  return `${prompt}

Respond with a valid JSON object containing the extracted information.
Structure your response as:
{
  "sheet_info": { "number": "", "title": "", "scale": "", "date": "" },
  "document_type": "",
  "main_content": "",
  "key_elements": [],
  "dimensions": [],
  "room_info": [],
  "notes": [],
  "references": [],
  "symbols": [],
  "text_content": ""
}`;
}

/**
 * Enhanced visual analysis prompt for GPT-4V/Claude Vision
 * Designed to maximize extraction from construction drawings
 */
export function getEnhancedVisualPrompt(
  fileName: string,
  pageNumber: number
): string {
  return `VISUAL ANALYSIS TASK - Construction Document Page ${pageNumber}
File: ${fileName}

You are viewing a construction document page. This could be:
- Architectural floor plan/elevation/section
- Structural drawing
- MEP (Mechanical/Electrical/Plumbing) drawing
- Site plan or civil drawing
- Detail sheet
- Specification page
- Schedule sheet

CRITICAL INSTRUCTIONS FOR VISUAL ANALYSIS:

1. EXAMINE THE ENTIRE PAGE systematically:
   - Start with title block (usually bottom right or along border)
   - Scan the main drawing area from left to right, top to bottom
   - Note any legends, keynotes, or symbol lists
   - Look for general notes sections

2. FOR CONSTRUCTION DRAWINGS:
   - Identify ALL room names/numbers visible in the plan
   - Note ALL dimension strings (e.g., "15'-6\"", "4570mm")
   - List ALL door/window tags (D1, W2, etc.)
   - Record equipment/fixture tags
   - Note section cuts and detail references (circles with numbers)
   - Identify gridline references (A, B, C / 1, 2, 3)

3. FOR TEXT/SPECIFICATION PAGES:
   - Extract section numbers (CSI format: 01 00 00, 03 30 00, etc.)
   - List product specifications
   - Note referenced standards (ASTM, ANSI, UL, etc.)
   - Extract quantities from schedules

4. ALWAYS CAPTURE:
   - Sheet number exactly as shown
   - Drawing scale(s)
   - Revision information
   - Any warnings or critical notes
   - Cross-references to other sheets

RESPOND WITH JSON containing all extracted data:
{
  "page_type": "floor_plan|elevation|section|detail|schedule|specification|titlesheet|other",
  "sheet_number": "",
  "sheet_title": "",
  "scale": "",
  "revision": "",
  "date": "",
  "discipline": "architectural|structural|mechanical|electrical|plumbing|civil|other",
  "rooms": [{"name": "", "number": "", "area": ""}],
  "dimensions": [],
  "door_schedule": [],
  "window_schedule": [],
  "equipment": [],
  "notes": [],
  "references": [{"type": "section|detail|elevation", "number": "", "sheet": ""}],
  "grid_lines": [],
  "legend_items": [],
  "text_content": "",
  "key_observations": []
}`;
}

/**
 * Check if sharp is available for image processing
 */
export async function isSharpAvailable(): Promise<boolean> {
  try {
    const sharp = await import('sharp');
    return !!sharp.default;
  } catch {
    return false;
  }
}

/**
 * Check if PDF processing is available (always true - uses pdf-lib)
 */
export async function isPdfProcessingAvailable(): Promise<boolean> {
  return true;
}

/**
 * @deprecated Use isPdfProcessingAvailable instead. Canvas is no longer used.
 */
export async function isCanvasAvailable(): Promise<boolean> {
  // Canvas was removed to reduce bundle size (179 MB savings)
  // Use native PDF processing instead, which works better with modern vision APIs
  return false;
}

/**
 * Get the best available PDF processing strategy
 * Always returns 'native-pdf' as this works with Claude/GPT-4V and preserves quality
 */
export async function getBestStrategy(): Promise<'native-pdf' | 'canvas-raster' | 'text-only'> {
  // Native PDF works best for modern vision APIs (Claude, GPT-4V)
  // Canvas was removed to meet Vercel serverless function size limits
  logger.info('PDF_SERVERLESS', 'Using native PDF strategy (Claude/GPT document support)');
  return 'native-pdf';
}
