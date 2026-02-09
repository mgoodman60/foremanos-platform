import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';

// Mock logger
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

import {
  convertPdfToImages,
  convertSinglePage,
  getPdfPageCount,
  type ConvertOptions,
  type ConvertResult,
} from '@/lib/pdf-to-image';

// ============================================
// Test Helpers
// ============================================

async function createTestPDF(pageCount: number = 1): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = pdfDoc.addPage([612, 792]); // Standard letter size
    // Add some content to make the page non-empty
    page.drawText(`Page ${i + 1}`, { x: 50, y: 750, size: 12 });
  }
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function createInvalidPDFBuffer(): Buffer {
  return Buffer.from('This is not a valid PDF file');
}

async function verifyPDFBuffer(buffer: Buffer): Promise<boolean> {
  try {
    await PDFDocument.load(new Uint8Array(buffer));
    return true;
  } catch {
    return false;
  }
}

async function getPDFPageCountFromBuffer(buffer: Buffer): Promise<number> {
  const doc = await PDFDocument.load(new Uint8Array(buffer));
  return doc.getPageCount();
}

// ============================================
// convertPdfToImages Tests
// ============================================

describe('convertPdfToImages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('success cases', () => {
    it('should convert all pages when no options specified', async () => {
      const pdfBuffer = await createTestPDF(3);
      const results = await convertPdfToImages(pdfBuffer);

      expect(results).toHaveLength(3);
      expect(results[0].pageNumber).toBe(1);
      expect(results[1].pageNumber).toBe(2);
      expect(results[2].pageNumber).toBe(3);

      // Verify each result has required fields
      results.forEach((result) => {
        expect(result).toHaveProperty('pageNumber');
        expect(result).toHaveProperty('base64');
        expect(result).toHaveProperty('buffer');
        expect(typeof result.base64).toBe('string');
        expect(Buffer.isBuffer(result.buffer)).toBe(true);
      });
    });

    it('should convert single page when page option specified', async () => {
      const pdfBuffer = await createTestPDF(5);
      const results = await convertPdfToImages(pdfBuffer, { page: 3 });

      expect(results).toHaveLength(1);
      expect(results[0].pageNumber).toBe(3);
    });

    it('should convert page range when startPage and endPage specified', async () => {
      const pdfBuffer = await createTestPDF(10);
      const results = await convertPdfToImages(pdfBuffer, {
        startPage: 3,
        endPage: 6,
      });

      expect(results).toHaveLength(4);
      expect(results[0].pageNumber).toBe(3);
      expect(results[1].pageNumber).toBe(4);
      expect(results[2].pageNumber).toBe(5);
      expect(results[3].pageNumber).toBe(6);
    });

    it('should convert from startPage to end when only startPage specified', async () => {
      const pdfBuffer = await createTestPDF(5);
      const results = await convertPdfToImages(pdfBuffer, { startPage: 3 });

      expect(results).toHaveLength(3);
      expect(results[0].pageNumber).toBe(3);
      expect(results[1].pageNumber).toBe(4);
      expect(results[2].pageNumber).toBe(5);
    });

    it('should convert from start to endPage when only endPage specified', async () => {
      const pdfBuffer = await createTestPDF(7);
      const results = await convertPdfToImages(pdfBuffer, { endPage: 4 });

      expect(results).toHaveLength(4);
      expect(results[0].pageNumber).toBe(1);
      expect(results[1].pageNumber).toBe(2);
      expect(results[2].pageNumber).toBe(3);
      expect(results[3].pageNumber).toBe(4);
    });

    it('should handle single page PDF', async () => {
      const pdfBuffer = await createTestPDF(1);
      const results = await convertPdfToImages(pdfBuffer);

      expect(results).toHaveLength(1);
      expect(results[0].pageNumber).toBe(1);
    });

    it('should return valid single-page PDF buffers', async () => {
      const pdfBuffer = await createTestPDF(3);
      const results = await convertPdfToImages(pdfBuffer);

      // Each result buffer should be a valid PDF with exactly 1 page
      for (const result of results) {
        const isValid = await verifyPDFBuffer(result.buffer);
        expect(isValid).toBe(true);

        const pageCount = await getPDFPageCountFromBuffer(result.buffer);
        expect(pageCount).toBe(1);
      }
    });

    it('should convert base64 correctly', async () => {
      const pdfBuffer = await createTestPDF(1);
      const results = await convertPdfToImages(pdfBuffer);

      // Base64 should decode back to the buffer
      const decodedBuffer = Buffer.from(results[0].base64, 'base64');
      expect(decodedBuffer.equals(results[0].buffer)).toBe(true);
    });

    it('should handle width option (for API compatibility)', async () => {
      const pdfBuffer = await createTestPDF(2);
      const results = await convertPdfToImages(pdfBuffer, { width: 1500 });

      // Width is accepted but not used for PDF extraction
      expect(results).toHaveLength(2);
      expect(results[0].pageNumber).toBe(1);
      expect(results[1].pageNumber).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should skip out-of-range page numbers when page specified', async () => {
      const pdfBuffer = await createTestPDF(3);
      const results = await convertPdfToImages(pdfBuffer, { page: 10 });

      // Page 10 doesn't exist in 3-page PDF, should return empty array
      expect(results).toHaveLength(0);
    });

    it('should skip page 0 or negative page numbers', async () => {
      const pdfBuffer = await createTestPDF(3);
      const results = await convertPdfToImages(pdfBuffer, { page: 0 });

      expect(results).toHaveLength(0);
    });

    it('should handle endPage greater than total pages', async () => {
      const pdfBuffer = await createTestPDF(5);
      const results = await convertPdfToImages(pdfBuffer, {
        startPage: 3,
        endPage: 100,
      });

      // Should only return pages 3-5 (capped at total pages)
      expect(results).toHaveLength(3);
      expect(results[0].pageNumber).toBe(3);
      expect(results[1].pageNumber).toBe(4);
      expect(results[2].pageNumber).toBe(5);
    });

    it('should handle startPage greater than total pages', async () => {
      const pdfBuffer = await createTestPDF(3);
      const results = await convertPdfToImages(pdfBuffer, {
        startPage: 10,
        endPage: 20,
      });

      // Start page beyond total, should return empty array
      expect(results).toHaveLength(0);
    });

    it('should handle startPage > endPage', async () => {
      const pdfBuffer = await createTestPDF(5);
      const results = await convertPdfToImages(pdfBuffer, {
        startPage: 4,
        endPage: 2,
      });

      // Invalid range, should return empty array
      expect(results).toHaveLength(0);
    });

    it('should handle empty options object', async () => {
      const pdfBuffer = await createTestPDF(2);
      const results = await convertPdfToImages(pdfBuffer, {});

      // Should convert all pages
      expect(results).toHaveLength(2);
    });

    it('should prioritize page option over range options', async () => {
      const pdfBuffer = await createTestPDF(5);
      const results = await convertPdfToImages(pdfBuffer, {
        page: 2,
        startPage: 1,
        endPage: 5,
      });

      // page option takes precedence
      expect(results).toHaveLength(1);
      expect(results[0].pageNumber).toBe(2);
    });

    it('should handle very large PDFs efficiently', async () => {
      const pdfBuffer = await createTestPDF(50);
      const results = await convertPdfToImages(pdfBuffer, {
        startPage: 20,
        endPage: 25,
      });

      expect(results).toHaveLength(6);
      expect(results[0].pageNumber).toBe(20);
      expect(results[5].pageNumber).toBe(25);
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid PDF buffer', async () => {
      const invalidBuffer = createInvalidPDFBuffer();

      await expect(convertPdfToImages(invalidBuffer)).rejects.toThrow(
        /PDF page extraction failed/
      );
    });

    it('should throw error for empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);

      await expect(convertPdfToImages(emptyBuffer)).rejects.toThrow(
        /PDF page extraction failed/
      );
    });

    it('should throw error for corrupted PDF', async () => {
      // Create a buffer that starts like a PDF but is corrupted
      const corruptedBuffer = Buffer.from('%PDF-1.4\nCorrupted content here');

      await expect(convertPdfToImages(corruptedBuffer)).rejects.toThrow(
        /PDF page extraction failed/
      );
    });

    it('should include original error message in thrown error', async () => {
      const invalidBuffer = createInvalidPDFBuffer();

      try {
        await convertPdfToImages(invalidBuffer);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('PDF page extraction failed:');
      }
    });

    it('should log error to logger on failure', async () => {
      const invalidBuffer = createInvalidPDFBuffer();

      await expect(convertPdfToImages(invalidBuffer)).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('data integrity', () => {
    it('should preserve page content in extracted PDFs', async () => {
      const pdfBuffer = await createTestPDF(3);
      const results = await convertPdfToImages(pdfBuffer);

      // Each extracted page should be a valid PDF
      for (let i = 0; i < results.length; i++) {
        const extractedPdf = await PDFDocument.load(new Uint8Array(results[i].buffer));
        expect(extractedPdf.getPageCount()).toBe(1);

        // Verify page dimensions are preserved
        const page = extractedPdf.getPage(0);
        expect(page.getWidth()).toBe(612);
        expect(page.getHeight()).toBe(792);
      }
    });

    it('should maintain page order', async () => {
      const pdfBuffer = await createTestPDF(10);
      const results = await convertPdfToImages(pdfBuffer);

      for (let i = 0; i < results.length; i++) {
        expect(results[i].pageNumber).toBe(i + 1);
      }
    });

    it('should generate unique buffers for each page', async () => {
      const pdfBuffer = await createTestPDF(3);
      const results = await convertPdfToImages(pdfBuffer);

      // Each buffer should be unique
      expect(results[0].buffer.equals(results[1].buffer)).toBe(false);
      expect(results[1].buffer.equals(results[2].buffer)).toBe(false);
      expect(results[0].buffer.equals(results[2].buffer)).toBe(false);
    });
  });
});

// ============================================
// convertSinglePage Tests
// ============================================

describe('convertSinglePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('success cases', () => {
    it('should convert first page by default', async () => {
      const pdfBuffer = await createTestPDF(3);
      const result = await convertSinglePage(pdfBuffer);

      expect(result).toHaveProperty('base64');
      expect(result).toHaveProperty('buffer');
      expect(typeof result.base64).toBe('string');
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
    });

    it('should convert specified page number', async () => {
      const pdfBuffer = await createTestPDF(5);
      const result = await convertSinglePage(pdfBuffer, 3);

      // Verify it's a valid single-page PDF
      const isValid = await verifyPDFBuffer(result.buffer);
      expect(isValid).toBe(true);

      const pageCount = await getPDFPageCountFromBuffer(result.buffer);
      expect(pageCount).toBe(1);
    });

    it('should convert last page', async () => {
      const pdfBuffer = await createTestPDF(4);
      const result = await convertSinglePage(pdfBuffer, 4);

      expect(result.base64).toBeTruthy();
      expect(result.buffer).toBeTruthy();
    });

    it('should handle width parameter (for API compatibility)', async () => {
      const pdfBuffer = await createTestPDF(2);
      const result = await convertSinglePage(pdfBuffer, 1, 2000);

      // Width parameter is kept for compatibility but not used
      expect(result.base64).toBeTruthy();
      expect(result.buffer).toBeTruthy();
    });

    it('should return valid PDF buffer', async () => {
      const pdfBuffer = await createTestPDF(3);
      const result = await convertSinglePage(pdfBuffer, 2);

      const isValid = await verifyPDFBuffer(result.buffer);
      expect(isValid).toBe(true);
    });

    it('should match base64 to buffer', async () => {
      const pdfBuffer = await createTestPDF(2);
      const result = await convertSinglePage(pdfBuffer, 1);

      const decodedBuffer = Buffer.from(result.base64, 'base64');
      expect(decodedBuffer.equals(result.buffer)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should default to page 1 when pageNumber is 1', async () => {
      const pdfBuffer = await createTestPDF(3);
      const result = await convertSinglePage(pdfBuffer, 1);

      expect(result.base64).toBeTruthy();
      expect(result.buffer).toBeTruthy();
    });

    it('should handle single-page PDF', async () => {
      const pdfBuffer = await createTestPDF(1);
      const result = await convertSinglePage(pdfBuffer);

      expect(result.base64).toBeTruthy();
      expect(result.buffer).toBeTruthy();
    });
  });

  describe('error handling', () => {
    it('should throw error when page does not exist', async () => {
      const pdfBuffer = await createTestPDF(3);

      await expect(convertSinglePage(pdfBuffer, 10)).rejects.toThrow(
        /Failed to extract page 10/
      );
    });

    it('should throw error for page 0', async () => {
      const pdfBuffer = await createTestPDF(3);

      await expect(convertSinglePage(pdfBuffer, 0)).rejects.toThrow(
        /Failed to extract page 0/
      );
    });

    it('should throw error for negative page number', async () => {
      const pdfBuffer = await createTestPDF(3);

      await expect(convertSinglePage(pdfBuffer, -5)).rejects.toThrow(
        /Failed to extract page -5/
      );
    });

    it('should throw error for invalid PDF buffer', async () => {
      const invalidBuffer = createInvalidPDFBuffer();

      await expect(convertSinglePage(invalidBuffer)).rejects.toThrow(
        /PDF page extraction failed/
      );
    });

    it('should throw error for empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);

      await expect(convertSinglePage(emptyBuffer)).rejects.toThrow(
        /PDF page extraction failed/
      );
    });

    it('should throw specific error message when extraction fails', async () => {
      const pdfBuffer = await createTestPDF(2);

      try {
        await convertSinglePage(pdfBuffer, 100);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('Failed to extract page 100');
      }
    });
  });
});

// ============================================
// getPdfPageCount Tests
// ============================================

describe('getPdfPageCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('success cases', () => {
    it('should return correct page count for single-page PDF', async () => {
      const pdfBuffer = await createTestPDF(1);
      const count = await getPdfPageCount(pdfBuffer);

      expect(count).toBe(1);
    });

    it('should return correct page count for multi-page PDF', async () => {
      const pdfBuffer = await createTestPDF(10);
      const count = await getPdfPageCount(pdfBuffer);

      expect(count).toBe(10);
    });

    it('should return correct page count for large PDF', async () => {
      const pdfBuffer = await createTestPDF(50);
      const count = await getPdfPageCount(pdfBuffer);

      expect(count).toBe(50);
    });

    it('should return correct page count for small PDF', async () => {
      const pdfBuffer = await createTestPDF(3);
      const count = await getPdfPageCount(pdfBuffer);

      expect(count).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('should handle PDF with many pages', async () => {
      const pdfBuffer = await createTestPDF(100);
      const count = await getPdfPageCount(pdfBuffer);

      expect(count).toBe(100);
    });

    it('should return positive integer', async () => {
      const pdfBuffer = await createTestPDF(5);
      const count = await getPdfPageCount(pdfBuffer);

      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid PDF buffer', async () => {
      const invalidBuffer = createInvalidPDFBuffer();

      await expect(getPdfPageCount(invalidBuffer)).rejects.toThrow(
        /Failed to get PDF page count/
      );
    });

    it('should throw error for empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);

      await expect(getPdfPageCount(emptyBuffer)).rejects.toThrow(
        /Failed to get PDF page count/
      );
    });

    it('should throw error for corrupted PDF', async () => {
      const corruptedBuffer = Buffer.from('%PDF-1.4\nInvalid structure');

      await expect(getPdfPageCount(corruptedBuffer)).rejects.toThrow(
        /Failed to get PDF page count/
      );
    });

    it('should include original error message in thrown error', async () => {
      const invalidBuffer = createInvalidPDFBuffer();

      try {
        await getPdfPageCount(invalidBuffer);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Failed to get PDF page count:');
      }
    });

    it('should log error to logger on failure', async () => {
      const invalidBuffer = createInvalidPDFBuffer();

      await expect(getPdfPageCount(invalidBuffer)).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});

// ============================================
// Integration Tests
// ============================================

describe('PDF Utilities - Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should work together: count pages, convert all, convert single', async () => {
    const pdfBuffer = await createTestPDF(5);

    // Get page count
    const pageCount = await getPdfPageCount(pdfBuffer);
    expect(pageCount).toBe(5);

    // Convert all pages
    const allPages = await convertPdfToImages(pdfBuffer);
    expect(allPages).toHaveLength(pageCount);

    // Convert single page
    const singlePage = await convertSinglePage(pdfBuffer, 3);
    expect(singlePage.base64).toBeTruthy();
  });

  it('should extract and re-validate PDF pages', async () => {
    const originalPdf = await createTestPDF(3);
    const results = await convertPdfToImages(originalPdf);

    // Each extracted page should be queryable
    for (const result of results) {
      const extractedPageCount = await getPdfPageCount(result.buffer);
      expect(extractedPageCount).toBe(1);
    }
  });

  it('should handle partial range extraction', async () => {
    const pdfBuffer = await createTestPDF(20);

    // Get total count
    const totalPages = await getPdfPageCount(pdfBuffer);
    expect(totalPages).toBe(20);

    // Extract middle pages
    const middlePages = await convertPdfToImages(pdfBuffer, {
      startPage: 8,
      endPage: 12,
    });
    expect(middlePages).toHaveLength(5);

    // Extract single page from same range
    const singlePage = await convertSinglePage(pdfBuffer, 10);
    expect(singlePage.buffer).toBeTruthy();
  });

  it('should handle sequential single page extractions', async () => {
    const pdfBuffer = await createTestPDF(5);

    // Extract each page individually
    const pages: { base64: string; buffer: Buffer }[] = [];
    for (let i = 1; i <= 5; i++) {
      const page = await convertSinglePage(pdfBuffer, i);
      pages.push(page);
    }

    expect(pages).toHaveLength(5);

    // Each should be unique
    for (let i = 0; i < pages.length - 1; i++) {
      expect(pages[i].buffer.equals(pages[i + 1].buffer)).toBe(false);
    }
  });
});

// ============================================
// Type Safety Tests
// ============================================

describe('PDF Utilities - Type Safety', () => {
  it('should enforce ConvertOptions interface', async () => {
    const pdfBuffer = await createTestPDF(3);

    const validOptions: ConvertOptions = {
      page: 1,
      startPage: 1,
      endPage: 3,
      width: 1500,
    };

    const results = await convertPdfToImages(pdfBuffer, validOptions);
    expect(results).toBeDefined();
  });

  it('should enforce ConvertResult interface', async () => {
    const pdfBuffer = await createTestPDF(1);
    const results = await convertPdfToImages(pdfBuffer);

    const result: ConvertResult = results[0];
    expect(result.pageNumber).toBeTypeOf('number');
    expect(result.base64).toBeTypeOf('string');
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
  });

  it('should accept partial ConvertOptions', async () => {
    const pdfBuffer = await createTestPDF(3);

    const partialOptions: ConvertOptions = {
      page: 2,
    };

    const results = await convertPdfToImages(pdfBuffer, partialOptions);
    expect(results).toHaveLength(1);
  });

  it('should accept undefined options', async () => {
    const pdfBuffer = await createTestPDF(2);
    const results = await convertPdfToImages(pdfBuffer, undefined);

    expect(results).toHaveLength(2);
  });
});
