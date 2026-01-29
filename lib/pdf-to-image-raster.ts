/**
 * PDF to Image Rasterization Service
 *
 * Converts PDF pages to high-quality PNG images for vision AI processing.
 * This enables accurate analysis of construction drawings including:
 * - Symbol recognition
 * - Dimension extraction
 * - Spatial relationship understanding
 * - Legend cross-referencing
 *
 * NOTE: Uses dynamic imports for pdf-img-convert and sharp to support
 * serverless environments where native modules may not be available at build time.
 */

import { PDFDocument } from 'pdf-lib';

// Dynamic imports for native modules (canvas-dependent)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfImgConvert: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sharpFn: any = null;

async function getPdfImgConvert() {
  if (!pdfImgConvert) {
    pdfImgConvert = await import('pdf-img-convert');
  }
  return pdfImgConvert;
}

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
}

export interface RasterizedPage {
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Base64 encoded image data */
  base64: string;
  /** Image buffer */
  buffer: Buffer;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** MIME type of the image */
  mimeType: string;
}

/**
 * Convert PDF pages to high-quality PNG images
 * @param pdfBuffer PDF file as Buffer
 * @param options Rasterization options
 * @returns Array of rasterized page images
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
  } = options;

  try {
    console.log('[PDF-RASTER] Starting PDF rasterization...');
    
    // Get total page count
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const totalPages = pdfDoc.getPageCount();
    console.log(`[PDF-RASTER] PDF has ${totalPages} pages`);

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

    console.log(`[PDF-RASTER] Converting pages: ${pagesToConvert.join(', ')}`);

    // Convert PDF to images using pdf-img-convert
    // Scale factor: 96 DPI is base, so scale = dpi / 96
    const scale = dpi / 96;

    const pdfConvert = await getPdfImgConvert();
    const outputImages = await pdfConvert.convert(pdfBuffer, {
      scale: scale,
      page_numbers: pagesToConvert,
    });

    console.log(`[PDF-RASTER] Converted ${outputImages.length} pages to images`);

    const results: RasterizedPage[] = [];

    for (let i = 0; i < outputImages.length; i++) {
      const imageData = outputImages[i];
      const pageNum = pagesToConvert[i];
      
      // Convert Uint8Array to Buffer
      const rawBuffer = Buffer.from(imageData);

      // Process with sharp for optimization and format conversion
      const sharp = await getSharp();
      let sharpInstance = sharp(rawBuffer);
      
      // Get image metadata
      const metadata = await sharpInstance.metadata();
      let finalWidth = metadata.width || maxWidth;
      let finalHeight = metadata.height || maxHeight;
      
      // Resize if needed while maintaining aspect ratio
      if (finalWidth > maxWidth || finalHeight > maxHeight) {
        const aspectRatio = finalWidth / finalHeight;
        if (finalWidth > maxWidth) {
          finalWidth = maxWidth;
          finalHeight = Math.round(maxWidth / aspectRatio);
        }
        if (finalHeight > maxHeight) {
          finalHeight = maxHeight;
          finalWidth = Math.round(maxHeight * aspectRatio);
        }
        sharpInstance = sharpInstance.resize(finalWidth, finalHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      // Convert to desired format
      let finalBuffer: Buffer;
      let mimeType: string;
      
      if (format === 'jpeg') {
        finalBuffer = await sharpInstance
          .jpeg({ quality })
          .toBuffer();
        mimeType = 'image/jpeg';
      } else {
        finalBuffer = await sharpInstance
          .png({ compressionLevel: 6 })
          .toBuffer();
        mimeType = 'image/png';
      }

      // Get final dimensions (sharp already loaded above)
      const finalMetadata = await sharp(finalBuffer).metadata();

      results.push({
        pageNumber: pageNum,
        base64: finalBuffer.toString('base64'),
        buffer: finalBuffer,
        width: finalMetadata.width || finalWidth,
        height: finalMetadata.height || finalHeight,
        mimeType,
      });

      console.log(`[PDF-RASTER] Page ${pageNum}: ${finalMetadata.width}x${finalMetadata.height} ${format}`);
    }

    return results;
  } catch (error: any) {
    console.error('[PDF-RASTER] Rasterization error:', error.message);
    throw new Error(`PDF rasterization failed: ${error.message}`);
  }
}

/**
 * Convert a single PDF page to a high-quality image
 * @param pdfBuffer PDF file as Buffer
 * @param pageNumber Page to convert (1-indexed)
 * @param options Rasterization options
 * @returns Single rasterized page image
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
    throw new Error(`Failed to rasterize page ${pageNumber}`);
  }

  return results[0];
}

/**
 * Get the number of pages in a PDF without full rasterization
 */
export async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  try {
    const doc = await PDFDocument.load(pdfBuffer);
    return doc.getPageCount();
  } catch (error: any) {
    console.error('[PDF-RASTER] Error getting page count:', error.message);
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
