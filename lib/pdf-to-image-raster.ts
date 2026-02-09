/**
 * PDF to Image Rasterization Service
 *
 * Converts PDF pages for vision AI processing.
 *
 * ARCHITECTURE DECISION (Feb 2026):
 * - Removed canvas/pdf-img-convert dependency (179 MB) to meet Vercel 250 MB limit
 * - Uses pdf-lib for PDF manipulation (pure JS, ~3 MB)
 * - Uses sharp for image processing (already installed, ~32 MB)
 *
 * Two modes available:
 * 1. PDF Native Mode (default): Extracts individual PDF pages
 *    - Best for Claude, GPT-4V, and other vision APIs with native PDF support
 *    - Preserves full visual fidelity of construction drawings
 *
 * 2. Placeholder Mode: Creates dimension-accurate white images
 *    - For APIs that require image input but don't support PDF
 *    - Not suitable for actual visual analysis - use PDF native mode instead
 *
 * For construction drawings, PDF native mode is strongly recommended as it:
 * - Maintains exact vector graphics quality
 * - Preserves text/dimension readability at any zoom
 * - Supports Claude's excellent PDF understanding capabilities
 */

import { PDFDocument } from 'pdf-lib';
import { logger } from './logger';

// Dynamic import for sharp
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sharpFn: any = null;

async function getSharp() {
  if (!sharpFn) {
    const mod = await import('sharp');
    sharpFn = mod.default;
  }
  return sharpFn;
}

export interface RasterizationOptions {
  /** DPI for rasterization (default: 150 for balance of quality/size) */
  dpi?: number;
  /** Maximum width in pixels (default: 2000) */
  maxWidth?: number;
  /** Maximum height in pixels (default: 2000) */
  maxHeight?: number;
  /** Output format (default: 'png') */
  format?: 'png' | 'jpeg';
  /** JPEG quality if format is jpeg (default: 90) */
  quality?: number;
  /** Page number to convert (1-indexed). If not specified, converts all pages */
  page?: number;
  /** Start page (1-indexed) for range conversion */
  startPage?: number;
  /** End page (1-indexed) for range conversion */
  endPage?: number;
  /**
   * Output mode:
   * - 'pdf': Extract as single-page PDFs (recommended for vision APIs)
   * - 'placeholder': Create white placeholder images with correct dimensions
   */
  mode?: 'pdf' | 'placeholder';
}

export interface RasterizedPage {
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Base64 encoded data (PDF or image depending on mode) */
  base64: string;
  /** Buffer data */
  buffer: Buffer;
  /** Width in pixels (calculated from PDF dimensions at given DPI) */
  width: number;
  /** Height in pixels (calculated from PDF dimensions at given DPI) */
  height: number;
  /** MIME type of the output */
  mimeType: string;
  /** Whether this is native PDF output vs rasterized image */
  isPdfNative: boolean;
}

/**
 * Convert PDF pages for vision AI processing
 * @param pdfBuffer PDF file as Buffer
 * @param options Rasterization options
 * @returns Array of processed page results
 */
export async function rasterizePdfToImages(
  pdfBuffer: Buffer,
  options: RasterizationOptions = {}
): Promise<RasterizedPage[]> {
  const {
    dpi = 150,  // Good balance for construction drawings
    maxWidth = 2000,
    maxHeight = 2000,
    format = 'png',
    quality = 90,
    page,
    startPage,
    endPage,
    mode = 'pdf', // Default to PDF native mode
  } = options;

  try {
    logger.info('PDF_RASTER', `Starting PDF processing`, { mode });

    // Load PDF document
    const pdfDoc = await PDFDocument.load(new Uint8Array(pdfBuffer));
    const totalPages = pdfDoc.getPageCount();
    logger.info('PDF_RASTER', `PDF has ${totalPages} pages`);

    // Determine which pages to convert
    let pagesToConvert: number[] = [];

    if (page !== undefined) {
      pagesToConvert = [page];
    } else if (startPage !== undefined || endPage !== undefined) {
      const start = startPage || 1;
      const end = Math.min(endPage || totalPages, totalPages);
      pagesToConvert = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    } else {
      pagesToConvert = Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    logger.info('PDF_RASTER', `Converting pages: ${pagesToConvert.join(', ')}`);

    const results: RasterizedPage[] = [];

    for (const pageNum of pagesToConvert) {
      if (pageNum < 1 || pageNum > totalPages) {
        continue;
      }

      try {
        // Get page dimensions from PDF
        const pdfPage = pdfDoc.getPage(pageNum - 1); // 0-indexed
        const { width: pdfWidth, height: pdfHeight } = pdfPage.getSize();

        // Calculate pixel dimensions at requested DPI
        // PDF dimensions are in points (72 points per inch)
        const scale = dpi / 72;
        let pixelWidth = Math.round(pdfWidth * scale);
        let pixelHeight = Math.round(pdfHeight * scale);

        // Apply max constraints while maintaining aspect ratio
        if (pixelWidth > maxWidth || pixelHeight > maxHeight) {
          const aspectRatio = pixelWidth / pixelHeight;
          if (pixelWidth > maxWidth) {
            pixelWidth = maxWidth;
            pixelHeight = Math.round(maxWidth / aspectRatio);
          }
          if (pixelHeight > maxHeight) {
            pixelHeight = maxHeight;
            pixelWidth = Math.round(maxHeight * aspectRatio);
          }
        }

        if (mode === 'pdf') {
          // PDF Native Mode: Extract as single-page PDF
          const newDoc = await PDFDocument.create();
          const [copiedPage] = await newDoc.copyPages(pdfDoc, [pageNum - 1]);
          newDoc.addPage(copiedPage);
          const pdfBytes = await newDoc.save();
          const buffer = Buffer.from(pdfBytes);

          results.push({
            pageNumber: pageNum,
            base64: buffer.toString('base64'),
            buffer,
            width: pixelWidth,
            height: pixelHeight,
            mimeType: 'application/pdf',
            isPdfNative: true,
          });

          logger.info('PDF_RASTER', `Page ${pageNum}: ${pixelWidth}x${pixelHeight} (PDF native)`);
        } else {
          // Placeholder Mode: Create white image with correct dimensions
          const sharp = await getSharp();

          // Create white image at calculated dimensions
          let sharpInstance = sharp({
            create: {
              width: pixelWidth,
              height: pixelHeight,
              channels: 4,
              background: { r: 255, g: 255, b: 255, alpha: 1 },
            },
          });

          // Convert to desired format
          let finalBuffer: Buffer;
          let mimeType: string;

          if (format === 'jpeg') {
            finalBuffer = await sharpInstance.jpeg({ quality }).toBuffer();
            mimeType = 'image/jpeg';
          } else {
            finalBuffer = await sharpInstance.png({ compressionLevel: 6 }).toBuffer();
            mimeType = 'image/png';
          }

          // Get final dimensions from metadata
          const finalMetadata = await sharp(finalBuffer).metadata();

          results.push({
            pageNumber: pageNum,
            base64: finalBuffer.toString('base64'),
            buffer: finalBuffer,
            width: finalMetadata.width || pixelWidth,
            height: finalMetadata.height || pixelHeight,
            mimeType,
            isPdfNative: false,
          });

          logger.info('PDF_RASTER', `Page ${pageNum}: ${finalMetadata.width}x${finalMetadata.height} ${format} (placeholder)`);
        }
      } catch (pageError: any) {
        logger.error('PDF_RASTER', `Error processing page ${pageNum}`, undefined, { error: pageError.message });
        // Continue with other pages
      }
    }

    return results;
  } catch (error: any) {
    logger.error('PDF_RASTER', 'Processing error', undefined, { error: error.message });
    throw new Error(`PDF processing failed: ${error.message}`);
  }
}

/**
 * Convert a single PDF page for vision AI processing
 * @param pdfBuffer PDF file as Buffer
 * @param pageNumber Page to convert (1-indexed)
 * @param options Processing options
 * @returns Single processed page
 */
export async function rasterizeSinglePage(
  pdfBuffer: Buffer,
  pageNumber: number = 1,
  options: Omit<RasterizationOptions, 'page' | 'startPage' | 'endPage'> = {}
): Promise<RasterizedPage> {
  const results = await rasterizePdfToImages(pdfBuffer, {
    ...options,
    page: pageNumber,
  });

  if (results.length === 0) {
    throw new Error(`Failed to process page ${pageNumber}`);
  }

  return results[0];
}

/**
 * Get the number of pages in a PDF without processing
 */
export async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  try {
    const doc = await PDFDocument.load(new Uint8Array(pdfBuffer));
    return doc.getPageCount();
  } catch (error: any) {
    logger.error('PDF_RASTER', 'Error getting page count', undefined, { error: error.message });
    throw new Error(`Failed to get PDF page count: ${error.message}`);
  }
}

/**
 * Optimize an existing image for vision AI processing
 * Useful for processing uploaded images before sending to AI
 */
export async function optimizeImageForVision(
  imageBuffer: Buffer,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    format?: 'png' | 'jpeg';
    quality?: number;
  } = {}
): Promise<{ base64: string; buffer: Buffer; mimeType: string }> {
  const {
    maxWidth = 2000,
    maxHeight = 2000,
    format = 'png',
    quality = 90,
  } = options;

  const sharp = await getSharp();
  let sharpInstance = sharp(imageBuffer);
  const metadata = await sharpInstance.metadata();

  // Resize if needed
  if ((metadata.width && metadata.width > maxWidth) ||
      (metadata.height && metadata.height > maxHeight)) {
    sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  let finalBuffer: Buffer;
  let mimeType: string;

  if (format === 'jpeg') {
    finalBuffer = await sharpInstance.jpeg({ quality }).toBuffer();
    mimeType = 'image/jpeg';
  } else {
    finalBuffer = await sharpInstance.png({ compressionLevel: 6 }).toBuffer();
    mimeType = 'image/png';
  }

  return {
    base64: finalBuffer.toString('base64'),
    buffer: finalBuffer,
    mimeType,
  };
}

/**
 * Check if PDF native processing is available (always true now)
 */
export async function isPdfProcessingAvailable(): Promise<boolean> {
  return true;
}

/**
 * Check if sharp is available for image processing
 */
export async function isSharpAvailable(): Promise<boolean> {
  try {
    await getSharp();
    return true;
  } catch {
    return false;
  }
}
