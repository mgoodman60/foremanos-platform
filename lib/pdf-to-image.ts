/**
 * Pure JavaScript PDF Utilities
 * Uses pdf-lib (pure JS) - no system binaries or native modules required
 * Works in serverless environments
 */

import { PDFDocument } from 'pdf-lib';
import { logger } from '@/lib/logger';

export interface ConvertOptions {
  /** Page number to convert (1-indexed). If not specified, converts all pages */
  page?: number;
  /** Start page (1-indexed) for range conversion */
  startPage?: number;
  /** End page (1-indexed) for range conversion */
  endPage?: number;
  /** Output width in pixels (maintained for API compatibility, not used for PDF extraction) */
  width?: number;
}

export interface ConvertResult {
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Base64 encoded PDF page data (single page PDF) */
  base64: string;
  /** PDF page buffer */
  buffer: Buffer;
}

/**
 * Extract PDF pages as individual single-page PDFs
 * Vision models can process PDF pages directly without image conversion
 * @param pdfBuffer PDF file as Buffer
 * @param options Conversion options
 * @returns Array of single-page PDF results
 */
export async function convertPdfToImages(
  pdfBuffer: Buffer,
  options: ConvertOptions = {}
): Promise<ConvertResult[]> {
  const {
    page,
    startPage,
    endPage,
  } = options;

  try {
    // Convert Buffer to Uint8Array for pdf-lib compatibility
    const pdfArray = new Uint8Array(pdfBuffer);
    const srcDoc = await PDFDocument.load(pdfArray);
    const totalPages = srcDoc.getPageCount();
    
    // Determine which pages to extract
    let pagesToExtract: number[] = [];
    
    if (page !== undefined) {
      pagesToExtract = [page];
    } else if (startPage !== undefined || endPage !== undefined) {
      const start = startPage || 1;
      const end = Math.min(endPage || totalPages, totalPages);
      pagesToExtract = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    } else {
      pagesToExtract = Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const results: ConvertResult[] = [];

    for (const pageNum of pagesToExtract) {
      if (pageNum < 1 || pageNum > totalPages) continue;
      
      // Create a new document with just this page
      const newDoc = await PDFDocument.create();
      const [copiedPage] = await newDoc.copyPages(srcDoc, [pageNum - 1]);
      newDoc.addPage(copiedPage);
      
      const pdfBytes = await newDoc.save();
      const buffer = Buffer.from(pdfBytes);
      
      results.push({
        pageNumber: pageNum,
        base64: buffer.toString('base64'),
        buffer,
      });
    }

    return results;
  } catch (error: any) {
    logger.error('PDF_TO_IMAGE', 'Page extraction error', error as Error);
    throw new Error(`PDF page extraction failed: ${error.message}`);
  }
}

/**
 * Extract a single PDF page as a new PDF
 * @param pdfBuffer Full PDF buffer
 * @param pageNumber Page to extract (1-indexed)
 * @returns Single-page PDF as base64 and buffer
 */
export async function convertSinglePage(
  pdfBuffer: Buffer,
  pageNumber: number = 1,
  _width: number = 1500 // Kept for API compatibility
): Promise<{ base64: string; buffer: Buffer }> {
  const results = await convertPdfToImages(pdfBuffer, {
    page: pageNumber,
  });

  if (results.length === 0) {
    throw new Error(`Failed to extract page ${pageNumber}`);
  }

  return {
    base64: results[0].base64,
    buffer: results[0].buffer,
  };
}

/**
 * Get the number of pages in a PDF
 */
export async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  try {
    // Convert Buffer to Uint8Array for pdf-lib compatibility
    const pdfArray = new Uint8Array(pdfBuffer);
    const doc = await PDFDocument.load(pdfArray);
    return doc.getPageCount();
  } catch (error: any) {
    logger.error('PDF_TO_IMAGE', 'Error getting page count', error as Error);
    throw new Error(`Failed to get PDF page count: ${error.message}`);
  }
}
