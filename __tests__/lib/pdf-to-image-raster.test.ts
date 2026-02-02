import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';

// ============================================
// Mocks Setup - Must use vi.hoisted for mock objects
// ============================================

// Mock sharp with vi.hoisted
const mockSharpInstance = vi.hoisted(() => ({
  metadata: vi.fn(),
  resize: vi.fn(),
  jpeg: vi.fn(),
  png: vi.fn(),
  toBuffer: vi.fn(),
}));

const mockSharp = vi.hoisted(() => {
  const sharp = vi.fn(() => mockSharpInstance) as ReturnType<typeof vi.fn> & { default?: unknown };
  sharp.default = sharp;
  return sharp;
});

// Mock the dynamic imports
vi.mock('sharp', () => ({
  default: mockSharp,
}));

// Import functions after mocks
import {
  rasterizePdfToImages,
  rasterizeSinglePage,
  getPdfPageCount,
  optimizeImageForVision,
  type RasterizationOptions,
  type RasterizedPage,
} from '@/lib/pdf-to-image-raster';

// ============================================
// Test Helpers
// ============================================

async function createSimplePDF(pageCount = 1): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    pdfDoc.addPage([612, 792]); // Standard letter size
  }
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function createMockImageBuffer(width = 1000, height = 1000): Buffer {
  // Create a simple mock image buffer
  const size = width * height * 4; // RGBA
  return Buffer.alloc(size);
}

function setupSharpMocks(
  width: number,
  height: number,
  outputBuffer = Buffer.from('mock-image-data')
) {
  // Chain-able sharp methods
  mockSharpInstance.metadata.mockResolvedValue({ width, height });
  mockSharpInstance.resize.mockReturnValue(mockSharpInstance);
  mockSharpInstance.jpeg.mockReturnValue(mockSharpInstance);
  mockSharpInstance.png.mockReturnValue(mockSharpInstance);
  mockSharpInstance.toBuffer.mockResolvedValue(outputBuffer);

  // Return instance for chaining
  mockSharp.mockReturnValue(mockSharpInstance);
}

// ============================================
// PDF Native Mode Tests (Default)
// ============================================

describe('PDF to Image Raster - PDF Native Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract a single-page PDF as native PDF', async () => {
    const pdfBuffer = await createSimplePDF(1);

    const results = await rasterizePdfToImages(pdfBuffer, { mode: 'pdf' });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      pageNumber: 1,
      mimeType: 'application/pdf',
      isPdfNative: true,
    });
    expect(results[0].base64).toBeDefined();
    expect(results[0].buffer).toBeInstanceOf(Buffer);
    // Width/height are calculated from PDF dimensions at DPI
    expect(results[0].width).toBeGreaterThan(0);
    expect(results[0].height).toBeGreaterThan(0);
  });

  it('should extract multi-page PDF to multiple PDF pages', async () => {
    const pdfBuffer = await createSimplePDF(3);

    const results = await rasterizePdfToImages(pdfBuffer, { mode: 'pdf' });

    expect(results).toHaveLength(3);
    expect(results[0].pageNumber).toBe(1);
    expect(results[1].pageNumber).toBe(2);
    expect(results[2].pageNumber).toBe(3);

    // Verify all pages are PDF native
    results.forEach(page => {
      expect(page.mimeType).toBe('application/pdf');
      expect(page.isPdfNative).toBe(true);
    });
  });

  it('should use PDF mode by default', async () => {
    const pdfBuffer = await createSimplePDF(1);

    const results = await rasterizePdfToImages(pdfBuffer);

    expect(results[0].isPdfNative).toBe(true);
    expect(results[0].mimeType).toBe('application/pdf');
  });

  it('should calculate pixel dimensions based on DPI', async () => {
    const pdfBuffer = await createSimplePDF(1); // 612x792 points at 72 DPI

    // At 150 DPI (default), scale = 150/72 = ~2.08
    const results = await rasterizePdfToImages(pdfBuffer, { dpi: 150 });

    // 612 * (150/72) = 1275, 792 * (150/72) = 1650
    expect(results[0].width).toBeCloseTo(1275, 0);
    expect(results[0].height).toBeCloseTo(1650, 0);
  });

  it('should convert specific page range with startPage and endPage', async () => {
    const pdfBuffer = await createSimplePDF(10);

    const results = await rasterizePdfToImages(pdfBuffer, {
      mode: 'pdf',
      startPage: 3,
      endPage: 7,
    });

    expect(results).toHaveLength(5);
    expect(results[0].pageNumber).toBe(3);
    expect(results[4].pageNumber).toBe(7);
  });

  it('should convert single page when page option is specified', async () => {
    const pdfBuffer = await createSimplePDF(5);

    const results = await rasterizePdfToImages(pdfBuffer, {
      mode: 'pdf',
      page: 3,
    });

    expect(results).toHaveLength(1);
    expect(results[0].pageNumber).toBe(3);
  });

  it('should handle endPage exceeding total pages by clamping to page count', async () => {
    const pdfBuffer = await createSimplePDF(5);

    const results = await rasterizePdfToImages(pdfBuffer, {
      mode: 'pdf',
      startPage: 1,
      endPage: 100, // Exceeds actual page count
    });

    expect(results).toHaveLength(5);
  });
});

// ============================================
// Placeholder Mode Tests
// ============================================

describe('PDF to Image Raster - Placeholder Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create placeholder PNG in placeholder mode', async () => {
    const pdfBuffer = await createSimplePDF(1);
    setupSharpMocks(1275, 1650, Buffer.from('png-output'));

    const results = await rasterizePdfToImages(pdfBuffer, { mode: 'placeholder' });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      pageNumber: 1,
      mimeType: 'image/png',
      isPdfNative: false,
    });
  });

  it('should create placeholder JPEG when format is jpeg', async () => {
    const pdfBuffer = await createSimplePDF(1);
    setupSharpMocks(1275, 1650, Buffer.from('jpeg-output'));

    const results = await rasterizePdfToImages(pdfBuffer, {
      mode: 'placeholder',
      format: 'jpeg',
      quality: 85,
    });

    expect(results[0].mimeType).toBe('image/jpeg');
    expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({ quality: 85 });
  });

  it('should respect maxWidth and maxHeight in placeholder mode', async () => {
    const pdfBuffer = await createSimplePDF(1);
    // Initial dimensions would be 1275x1650 at 150 DPI
    // With maxWidth 1000, dimensions are pre-calculated before sharp.create()
    setupSharpMocks(1000, 1294, Buffer.from('output'));

    const results = await rasterizePdfToImages(pdfBuffer, {
      mode: 'placeholder',
      maxWidth: 1000,
      maxHeight: 1500,
    });

    // Dimensions should be constrained to maxWidth/maxHeight
    expect(results[0].width).toBeLessThanOrEqual(1000);
    expect(results[0].height).toBeLessThanOrEqual(1500);
  });
});

// ============================================
// Single Page Rasterization Tests
// ============================================

describe('PDF to Image Raster - rasterizeSinglePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process a single page by default (page 1)', async () => {
    const pdfBuffer = await createSimplePDF(5);

    const result = await rasterizeSinglePage(pdfBuffer);

    expect(result).toMatchObject({
      pageNumber: 1,
      isPdfNative: true,
      mimeType: 'application/pdf',
    });
  });

  it('should process a specific page number', async () => {
    const pdfBuffer = await createSimplePDF(10);

    const result = await rasterizeSinglePage(pdfBuffer, 5);

    expect(result.pageNumber).toBe(5);
  });

  it('should throw error if page rasterization fails', async () => {
    const pdfBuffer = await createSimplePDF(1);

    // Page 99 doesn't exist in a 1-page PDF
    await expect(rasterizeSinglePage(pdfBuffer, 99)).rejects.toThrow(
      'Failed to process page 99'
    );
  });
});

// ============================================
// Page Count Tests
// ============================================

describe('PDF to Image Raster - getPdfPageCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return correct page count for single-page PDF', async () => {
    const pdfBuffer = await createSimplePDF(1);
    const count = await getPdfPageCount(pdfBuffer);
    expect(count).toBe(1);
  });

  it('should return correct page count for multi-page PDF', async () => {
    const pdfBuffer = await createSimplePDF(25);
    const count = await getPdfPageCount(pdfBuffer);
    expect(count).toBe(25);
  });

  it('should handle corrupt PDF with error message', async () => {
    const corruptBuffer = Buffer.from('not-a-pdf');

    await expect(getPdfPageCount(corruptBuffer)).rejects.toThrow(
      'Failed to get PDF page count'
    );
  });
});

// ============================================
// Image Optimization Tests
// ============================================

describe('PDF to Image Raster - optimizeImageForVision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should optimize image to PNG by default', async () => {
    const imageBuffer = createMockImageBuffer(1500, 1500);
    setupSharpMocks(1500, 1500, Buffer.from('optimized-png'));

    const result = await optimizeImageForVision(imageBuffer);

    expect(mockSharpInstance.png).toHaveBeenCalledWith({ compressionLevel: 6 });
    expect(result.mimeType).toBe('image/png');
    expect(result.base64).toBe(Buffer.from('optimized-png').toString('base64'));
    expect(result.buffer).toBeInstanceOf(Buffer);
  });

  it('should optimize image to JPEG when format is specified', async () => {
    const imageBuffer = createMockImageBuffer(1500, 1500);
    setupSharpMocks(1500, 1500, Buffer.from('optimized-jpeg'));

    const result = await optimizeImageForVision(imageBuffer, {
      format: 'jpeg',
      quality: 85,
    });

    expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({ quality: 85 });
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('should resize image if it exceeds maxWidth', async () => {
    const imageBuffer = createMockImageBuffer(3000, 2000);

    mockSharpInstance.metadata.mockResolvedValue({ width: 3000, height: 2000 });
    mockSharpInstance.resize.mockReturnValue(mockSharpInstance);
    mockSharpInstance.png.mockReturnValue(mockSharpInstance);
    mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('resized-output'));

    await optimizeImageForVision(imageBuffer, {
      maxWidth: 2000,
      maxHeight: 2000,
    });

    expect(mockSharpInstance.resize).toHaveBeenCalledWith(
      2000,
      2000,
      expect.objectContaining({
        fit: 'inside',
        withoutEnlargement: true,
      })
    );
  });

  it('should not resize image if within bounds', async () => {
    const imageBuffer = createMockImageBuffer(1500, 1500);

    mockSharpInstance.metadata.mockResolvedValue({ width: 1500, height: 1500 });
    mockSharpInstance.resize.mockReturnValue(mockSharpInstance);
    mockSharpInstance.png.mockReturnValue(mockSharpInstance);
    mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('output'));

    await optimizeImageForVision(imageBuffer, {
      maxWidth: 2000,
      maxHeight: 2000,
    });

    // Resize should not be called since image is within bounds
    expect(mockSharpInstance.resize).not.toHaveBeenCalled();
  });
});

// ============================================
// Edge Cases and Error Handling Tests
// ============================================

describe('PDF to Image Raster - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle PDF with no requested pages gracefully', async () => {
    const pdfBuffer = await createSimplePDF(3);

    // Request pages that don't exist (startPage > total pages)
    const results = await rasterizePdfToImages(pdfBuffer, {
      startPage: 10,
      endPage: 15,
    });

    // Should return empty array since requested pages don't exist
    expect(results).toHaveLength(0);
  });

  it('should handle very high DPI settings with increased max dimensions', async () => {
    const pdfBuffer = await createSimplePDF(1);

    const results = await rasterizePdfToImages(pdfBuffer, {
      dpi: 600,
      maxWidth: 10000,  // Allow high resolution
      maxHeight: 10000,
    });

    // At 600 DPI, scale = 600/72 = 8.33
    // 612 * 8.33 = ~5100, 792 * 8.33 = ~6600
    expect(results[0].width).toBeGreaterThan(5000);
    expect(results[0].height).toBeGreaterThan(6000);
  });

  it('should clamp dimensions to maxWidth/maxHeight', async () => {
    const pdfBuffer = await createSimplePDF(1);

    const results = await rasterizePdfToImages(pdfBuffer, {
      dpi: 600, // Would produce very large dimensions
      maxWidth: 2000,
      maxHeight: 2000,
    });

    // Dimensions should be clamped
    expect(results[0].width).toBeLessThanOrEqual(2000);
    expect(results[0].height).toBeLessThanOrEqual(2000);
  });
});

// ============================================
// Quality and Compression Tests
// ============================================

describe('PDF to Image Raster - Quality Settings (Placeholder Mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use default JPEG quality of 90', async () => {
    const pdfBuffer = await createSimplePDF(1);
    setupSharpMocks(1200, 1600);

    await rasterizePdfToImages(pdfBuffer, { mode: 'placeholder', format: 'jpeg' });

    expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({ quality: 90 });
  });

  it('should use custom JPEG quality setting', async () => {
    const pdfBuffer = await createSimplePDF(1);
    setupSharpMocks(1200, 1600);

    await rasterizePdfToImages(pdfBuffer, {
      mode: 'placeholder',
      format: 'jpeg',
      quality: 75,
    });

    expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({ quality: 75 });
  });

  it('should use compression level 6 for PNG format', async () => {
    const pdfBuffer = await createSimplePDF(1);
    setupSharpMocks(1200, 1600);

    await rasterizePdfToImages(pdfBuffer, { mode: 'placeholder', format: 'png' });

    expect(mockSharpInstance.png).toHaveBeenCalledWith({ compressionLevel: 6 });
  });
});
