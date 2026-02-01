import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';

// ============================================
// Mocks Setup - Must use vi.hoisted for mock objects
// ============================================

// Mock pdf-img-convert with vi.hoisted
const mockPdfImgConvert = vi.hoisted(() => ({
  convert: vi.fn(),
}));

// Mock sharp with vi.hoisted
const mockSharpInstance = vi.hoisted(() => ({
  metadata: vi.fn(),
  resize: vi.fn(),
  jpeg: vi.fn(),
  png: vi.fn(),
  toBuffer: vi.fn(),
}));

const mockSharp = vi.hoisted(() => {
  const sharp = vi.fn(() => mockSharpInstance);
  sharp.default = sharp;
  return sharp;
});

// Mock the dynamic imports
vi.mock('pdf-img-convert', () => ({
  default: mockPdfImgConvert,
  convert: mockPdfImgConvert.convert,
}));

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
// PDF Rasterization Tests (8 tests)
// ============================================

describe('PDF to Image Raster - rasterizePdfToImages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should rasterize a single-page PDF to PNG', async () => {
    const pdfBuffer = await createSimplePDF(1);
    const mockImageData = new Uint8Array(1000);

    mockPdfImgConvert.convert.mockResolvedValue([mockImageData]);
    setupSharpMocks(1200, 1600, Buffer.from('png-output'));

    const results = await rasterizePdfToImages(pdfBuffer);

    // Verify pdf-img-convert was called with correct params
    expect(mockPdfImgConvert.convert).toHaveBeenCalledWith(
      pdfBuffer,
      expect.objectContaining({
        scale: 150 / 96, // Default DPI 150
        page_numbers: [1],
      })
    );

    // Verify results
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      pageNumber: 1,
      width: 1200,
      height: 1600,
      mimeType: 'image/png',
    });
    expect(results[0].base64).toBe(Buffer.from('png-output').toString('base64'));
    expect(results[0].buffer).toBeInstanceOf(Buffer);
  });

  it('should rasterize multi-page PDF to multiple images', async () => {
    const pdfBuffer = await createSimplePDF(3);
    const mockImageData1 = new Uint8Array(1000);
    const mockImageData2 = new Uint8Array(1000);
    const mockImageData3 = new Uint8Array(1000);

    mockPdfImgConvert.convert.mockResolvedValue([
      mockImageData1,
      mockImageData2,
      mockImageData3,
    ]);
    setupSharpMocks(1200, 1600, Buffer.from('png-output'));

    const results = await rasterizePdfToImages(pdfBuffer);

    expect(results).toHaveLength(3);
    expect(results[0].pageNumber).toBe(1);
    expect(results[1].pageNumber).toBe(2);
    expect(results[2].pageNumber).toBe(3);

    // Verify all pages use same format
    results.forEach(page => {
      expect(page.mimeType).toBe('image/png');
      expect(page.width).toBe(1200);
      expect(page.height).toBe(1600);
    });
  });

  it('should convert to JPEG when format option is set', async () => {
    const pdfBuffer = await createSimplePDF(1);
    const mockImageData = new Uint8Array(1000);

    mockPdfImgConvert.convert.mockResolvedValue([mockImageData]);
    setupSharpMocks(1200, 1600, Buffer.from('jpeg-output'));

    const results = await rasterizePdfToImages(pdfBuffer, {
      format: 'jpeg',
      quality: 85,
    });

    expect(results[0].mimeType).toBe('image/jpeg');
    expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({ quality: 85 });
  });

  it('should use custom DPI setting', async () => {
    const pdfBuffer = await createSimplePDF(1);
    const mockImageData = new Uint8Array(1000);

    mockPdfImgConvert.convert.mockResolvedValue([mockImageData]);
    setupSharpMocks(2400, 3200);

    await rasterizePdfToImages(pdfBuffer, { dpi: 300 });

    // Verify scale calculation: 300 DPI / 96 base = 3.125
    expect(mockPdfImgConvert.convert).toHaveBeenCalledWith(
      pdfBuffer,
      expect.objectContaining({
        scale: 300 / 96,
      })
    );
  });

  it('should resize images that exceed maxWidth/maxHeight while maintaining aspect ratio', async () => {
    const pdfBuffer = await createSimplePDF(1);
    const mockImageData = new Uint8Array(1000);

    mockPdfImgConvert.convert.mockResolvedValue([mockImageData]);

    // Mock large image that needs resizing
    mockSharpInstance.metadata.mockResolvedValue({ width: 4000, height: 3000 });
    mockSharpInstance.resize.mockReturnValue(mockSharpInstance);
    mockSharpInstance.png.mockReturnValue(mockSharpInstance);
    mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('resized-output'));

    // Create new mock for final metadata check
    const mockSharpFinal = vi.fn(() => ({
      metadata: vi.fn().mockResolvedValue({ width: 2000, height: 1500 }),
    }));
    mockSharp.mockReturnValueOnce(mockSharpInstance).mockReturnValueOnce(mockSharpFinal());

    const results = await rasterizePdfToImages(pdfBuffer, {
      maxWidth: 2000,
      maxHeight: 2000,
    });

    // Verify resize was called
    expect(mockSharpInstance.resize).toHaveBeenCalledWith(
      2000,
      1500,
      expect.objectContaining({
        fit: 'inside',
        withoutEnlargement: true,
      })
    );

    expect(results[0].width).toBe(2000);
    expect(results[0].height).toBe(1500);
  });

  it('should convert specific page range with startPage and endPage', async () => {
    const pdfBuffer = await createSimplePDF(10);
    const mockImages = Array(5).fill(null).map(() => new Uint8Array(1000));

    mockPdfImgConvert.convert.mockResolvedValue(mockImages);
    setupSharpMocks(1200, 1600);

    const results = await rasterizePdfToImages(pdfBuffer, {
      startPage: 3,
      endPage: 7,
    });

    // Verify only pages 3-7 were requested
    expect(mockPdfImgConvert.convert).toHaveBeenCalledWith(
      pdfBuffer,
      expect.objectContaining({
        page_numbers: [3, 4, 5, 6, 7],
      })
    );

    expect(results).toHaveLength(5);
    expect(results[0].pageNumber).toBe(3);
    expect(results[4].pageNumber).toBe(7);
  });

  it('should convert single page when page option is specified', async () => {
    const pdfBuffer = await createSimplePDF(5);
    const mockImageData = new Uint8Array(1000);

    mockPdfImgConvert.convert.mockResolvedValue([mockImageData]);
    setupSharpMocks(1200, 1600);

    const results = await rasterizePdfToImages(pdfBuffer, {
      page: 3,
    });

    expect(mockPdfImgConvert.convert).toHaveBeenCalledWith(
      pdfBuffer,
      expect.objectContaining({
        page_numbers: [3],
      })
    );

    expect(results).toHaveLength(1);
    expect(results[0].pageNumber).toBe(3);
  });

  it('should handle PDF conversion errors gracefully', async () => {
    const pdfBuffer = await createSimplePDF(1);

    mockPdfImgConvert.convert.mockRejectedValue(new Error('Invalid PDF structure'));

    await expect(rasterizePdfToImages(pdfBuffer)).rejects.toThrow(
      'PDF rasterization failed: Invalid PDF structure'
    );
  });
});

// ============================================
// Single Page Rasterization Tests (3 tests)
// ============================================

describe('PDF to Image Raster - rasterizeSinglePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should rasterize a single page by default (page 1)', async () => {
    const pdfBuffer = await createSimplePDF(5);
    const mockImageData = new Uint8Array(1000);

    mockPdfImgConvert.convert.mockResolvedValue([mockImageData]);
    setupSharpMocks(1200, 1600);

    const result = await rasterizeSinglePage(pdfBuffer);

    expect(mockPdfImgConvert.convert).toHaveBeenCalledWith(
      pdfBuffer,
      expect.objectContaining({
        page_numbers: [1],
      })
    );

    expect(result).toMatchObject({
      pageNumber: 1,
      width: 1200,
      height: 1600,
      mimeType: 'image/png',
    });
  });

  it('should rasterize a specific page number', async () => {
    const pdfBuffer = await createSimplePDF(10);
    const mockImageData = new Uint8Array(1000);

    mockPdfImgConvert.convert.mockResolvedValue([mockImageData]);
    setupSharpMocks(1200, 1600);

    const result = await rasterizeSinglePage(pdfBuffer, 5);

    expect(mockPdfImgConvert.convert).toHaveBeenCalledWith(
      pdfBuffer,
      expect.objectContaining({
        page_numbers: [5],
      })
    );

    expect(result.pageNumber).toBe(5);
  });

  it('should throw error if page rasterization fails', async () => {
    const pdfBuffer = await createSimplePDF(1);

    // Mock empty result array (no pages converted)
    mockPdfImgConvert.convert.mockResolvedValue([]);

    await expect(rasterizeSinglePage(pdfBuffer, 1)).rejects.toThrow(
      'Failed to rasterize page 1'
    );
  });
});

// ============================================
// Page Count Tests (3 tests)
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
// Image Optimization Tests (6 tests)
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

  it('should resize image if it exceeds maxHeight', async () => {
    const imageBuffer = createMockImageBuffer(1500, 3000);

    mockSharpInstance.metadata.mockResolvedValue({ width: 1500, height: 3000 });
    mockSharpInstance.resize.mockReturnValue(mockSharpInstance);
    mockSharpInstance.png.mockReturnValue(mockSharpInstance);
    mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('resized-output'));

    await optimizeImageForVision(imageBuffer, {
      maxWidth: 2000,
      maxHeight: 2000,
    });

    expect(mockSharpInstance.resize).toHaveBeenCalled();
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

  it('should use default maxWidth and maxHeight of 2000', async () => {
    const imageBuffer = createMockImageBuffer(2500, 2500);

    mockSharpInstance.metadata.mockResolvedValue({ width: 2500, height: 2500 });
    mockSharpInstance.resize.mockReturnValue(mockSharpInstance);
    mockSharpInstance.png.mockReturnValue(mockSharpInstance);
    mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('output'));

    await optimizeImageForVision(imageBuffer);

    // Should resize to 2000x2000 by default
    expect(mockSharpInstance.resize).toHaveBeenCalledWith(
      2000,
      2000,
      expect.any(Object)
    );
  });
});

// ============================================
// Edge Cases and Error Handling Tests (5 tests)
// ============================================

describe('PDF to Image Raster - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle empty PDF (0 pages) gracefully', async () => {
    const pdfDoc = await PDFDocument.create();
    const pdfBuffer = Buffer.from(await pdfDoc.save());

    mockPdfImgConvert.convert.mockResolvedValue([]);

    const results = await rasterizePdfToImages(pdfBuffer);

    expect(results).toHaveLength(0);
  });

  it('should handle endPage exceeding total pages by clamping to page count', async () => {
    const pdfBuffer = await createSimplePDF(5);
    const mockImages = Array(5).fill(null).map(() => new Uint8Array(1000));

    mockPdfImgConvert.convert.mockResolvedValue(mockImages);
    setupSharpMocks(1200, 1600);

    const results = await rasterizePdfToImages(pdfBuffer, {
      startPage: 1,
      endPage: 100, // Exceeds actual page count
    });

    // Should only convert pages 1-5
    expect(mockPdfImgConvert.convert).toHaveBeenCalledWith(
      pdfBuffer,
      expect.objectContaining({
        page_numbers: [1, 2, 3, 4, 5],
      })
    );

    expect(results).toHaveLength(5);
  });

  it('should handle image with missing metadata dimensions', async () => {
    const pdfBuffer = await createSimplePDF(1);
    const mockImageData = new Uint8Array(1000);

    mockPdfImgConvert.convert.mockResolvedValue([mockImageData]);

    // Mock metadata with missing dimensions
    mockSharpInstance.metadata.mockResolvedValueOnce({ width: undefined, height: undefined });
    mockSharpInstance.png.mockReturnValue(mockSharpInstance);
    mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('output'));

    // Create new mock for final metadata check with valid dimensions
    const mockSharpFinal = vi.fn(() => ({
      metadata: vi.fn().mockResolvedValue({ width: 1200, height: 1600 }),
    }));
    mockSharp.mockReturnValueOnce(mockSharpInstance).mockReturnValueOnce(mockSharpFinal());

    const results = await rasterizePdfToImages(pdfBuffer, {
      maxWidth: 2000,
      maxHeight: 2000,
    });

    // Should use maxWidth/maxHeight as fallback
    expect(results[0].width).toBe(1200);
    expect(results[0].height).toBe(1600);
  });

  it('should handle sharp processing errors gracefully', async () => {
    const pdfBuffer = await createSimplePDF(1);
    const mockImageData = new Uint8Array(1000);

    mockPdfImgConvert.convert.mockResolvedValue([mockImageData]);
    mockSharpInstance.metadata.mockRejectedValue(new Error('Invalid image format'));

    await expect(rasterizePdfToImages(pdfBuffer)).rejects.toThrow(
      'PDF rasterization failed: Invalid image format'
    );
  });

  it('should handle very high DPI settings', async () => {
    const pdfBuffer = await createSimplePDF(1);
    const mockImageData = new Uint8Array(5000);

    mockPdfImgConvert.convert.mockResolvedValue([mockImageData]);
    setupSharpMocks(4800, 6400);

    await rasterizePdfToImages(pdfBuffer, { dpi: 600 });

    // Verify scale calculation: 600 DPI / 96 base = 6.25
    expect(mockPdfImgConvert.convert).toHaveBeenCalledWith(
      pdfBuffer,
      expect.objectContaining({
        scale: 600 / 96,
      })
    );
  });
});

// ============================================
// Aspect Ratio Preservation Tests (4 tests)
// ============================================

describe('PDF to Image Raster - Aspect Ratio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should maintain aspect ratio when resizing wide images', async () => {
    const pdfBuffer = await createSimplePDF(1);
    const mockImageData = new Uint8Array(1000);

    mockPdfImgConvert.convert.mockResolvedValue([mockImageData]);

    // Wide image: 3000x1500 (2:1 ratio)
    mockSharpInstance.metadata.mockResolvedValue({ width: 3000, height: 1500 });
    mockSharpInstance.resize.mockReturnValue(mockSharpInstance);
    mockSharpInstance.png.mockReturnValue(mockSharpInstance);
    mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('output'));

    const mockSharpFinal = vi.fn(() => ({
      metadata: vi.fn().mockResolvedValue({ width: 2000, height: 1000 }),
    }));
    mockSharp.mockReturnValueOnce(mockSharpInstance).mockReturnValueOnce(mockSharpFinal());

    const results = await rasterizePdfToImages(pdfBuffer, {
      maxWidth: 2000,
      maxHeight: 2000,
    });

    // Should resize to 2000x1000 to maintain 2:1 aspect ratio
    expect(mockSharpInstance.resize).toHaveBeenCalledWith(
      2000,
      1000,
      expect.objectContaining({
        fit: 'inside',
        withoutEnlargement: true,
      })
    );
  });

  it('should maintain aspect ratio when resizing tall images', async () => {
    const pdfBuffer = await createSimplePDF(1);
    const mockImageData = new Uint8Array(1000);

    mockPdfImgConvert.convert.mockResolvedValue([mockImageData]);

    // Tall image: 1200x2400 (1:2 ratio)
    mockSharpInstance.metadata.mockResolvedValue({ width: 1200, height: 2400 });
    mockSharpInstance.resize.mockReturnValue(mockSharpInstance);
    mockSharpInstance.png.mockReturnValue(mockSharpInstance);
    mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('output'));

    const mockSharpFinal = vi.fn(() => ({
      metadata: vi.fn().mockResolvedValue({ width: 1000, height: 2000 }),
    }));
    mockSharp.mockReturnValueOnce(mockSharpInstance).mockReturnValueOnce(mockSharpFinal());

    const results = await rasterizePdfToImages(pdfBuffer, {
      maxWidth: 2000,
      maxHeight: 2000,
    });

    // Should resize to 1000x2000 to maintain 1:2 aspect ratio
    expect(mockSharpInstance.resize).toHaveBeenCalledWith(
      1000,
      2000,
      expect.objectContaining({
        fit: 'inside',
        withoutEnlargement: true,
      })
    );
  });

  it('should handle square images without distortion', async () => {
    const pdfBuffer = await createSimplePDF(1);
    const mockImageData = new Uint8Array(1000);

    mockPdfImgConvert.convert.mockResolvedValue([mockImageData]);

    // Square image: 2500x2500
    mockSharpInstance.metadata.mockResolvedValue({ width: 2500, height: 2500 });
    mockSharpInstance.resize.mockReturnValue(mockSharpInstance);
    mockSharpInstance.png.mockReturnValue(mockSharpInstance);
    mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('output'));

    const mockSharpFinal = vi.fn(() => ({
      metadata: vi.fn().mockResolvedValue({ width: 2000, height: 2000 }),
    }));
    mockSharp.mockReturnValueOnce(mockSharpInstance).mockReturnValueOnce(mockSharpFinal());

    const results = await rasterizePdfToImages(pdfBuffer, {
      maxWidth: 2000,
      maxHeight: 2000,
    });

    // Should resize to 2000x2000 (maintains 1:1 ratio)
    expect(results[0].width).toBe(2000);
    expect(results[0].height).toBe(2000);
  });

  it('should not enlarge small images (withoutEnlargement option)', async () => {
    const pdfBuffer = await createSimplePDF(1);
    const mockImageData = new Uint8Array(1000);

    mockPdfImgConvert.convert.mockResolvedValue([mockImageData]);

    // Small image: 800x600
    mockSharpInstance.metadata.mockResolvedValue({ width: 800, height: 600 });
    mockSharpInstance.png.mockReturnValue(mockSharpInstance);
    mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('output'));

    const mockSharpFinal = vi.fn(() => ({
      metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
    }));
    mockSharp.mockReturnValueOnce(mockSharpInstance).mockReturnValueOnce(mockSharpFinal());

    const results = await rasterizePdfToImages(pdfBuffer, {
      maxWidth: 2000,
      maxHeight: 2000,
    });

    // Should NOT call resize since image is smaller than max dimensions
    expect(mockSharpInstance.resize).not.toHaveBeenCalled();
    expect(results[0].width).toBe(800);
    expect(results[0].height).toBe(600);
  });
});

// ============================================
// Quality and Compression Tests (3 tests)
// ============================================

describe('PDF to Image Raster - Quality Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use default JPEG quality of 90', async () => {
    const pdfBuffer = await createSimplePDF(1);
    const mockImageData = new Uint8Array(1000);

    mockPdfImgConvert.convert.mockResolvedValue([mockImageData]);
    setupSharpMocks(1200, 1600);

    await rasterizePdfToImages(pdfBuffer, { format: 'jpeg' });

    expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({ quality: 90 });
  });

  it('should use custom JPEG quality setting', async () => {
    const pdfBuffer = await createSimplePDF(1);
    const mockImageData = new Uint8Array(1000);

    mockPdfImgConvert.convert.mockResolvedValue([mockImageData]);
    setupSharpMocks(1200, 1600);

    await rasterizePdfToImages(pdfBuffer, {
      format: 'jpeg',
      quality: 75,
    });

    expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({ quality: 75 });
  });

  it('should use compression level 6 for PNG format', async () => {
    const pdfBuffer = await createSimplePDF(1);
    const mockImageData = new Uint8Array(1000);

    mockPdfImgConvert.convert.mockResolvedValue([mockImageData]);
    setupSharpMocks(1200, 1600);

    await rasterizePdfToImages(pdfBuffer, { format: 'png' });

    expect(mockSharpInstance.png).toHaveBeenCalledWith({ compressionLevel: 6 });
  });
});
