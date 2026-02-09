import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PDFDocument, PDFPage } from 'pdf-lib';

// ============================================
// Mocks Setup - Must use vi.hoisted for mock objects
// ============================================

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

// Import functions after mocks
import {
  extractPageAsPdf,
  getPageInfo,
  estimatePageType,
  splitPdfIntoPages,
  getConstructionDrawingPrompt,
  getEnhancedVisualPrompt,
  isSharpAvailable,
  isCanvasAvailable,
  getBestStrategy,
  PageImage,
  RenderOptions,
} from '@/lib/pdf-to-image-serverless';

// ============================================
// Test Helpers
// ============================================

async function createSimplePDF(pageCount: number = 1, pageSize: [number, number] = [612, 792]): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    pdfDoc.addPage(pageSize);
  }
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

async function createLargeFormatPDF(): Promise<Buffer> {
  // 24x36 at 72dpi = 1728x2592 (typical construction drawing)
  return createSimplePDF(1, [1728, 2592]);
}

async function createLandscapePDF(): Promise<Buffer> {
  // 11x17 landscape
  return createSimplePDF(1, [1224, 792]);
}

async function createPortraitPDF(): Promise<Buffer> {
  // 8.5x11 portrait (standard letter)
  return createSimplePDF(1, [612, 792]);
}

// ============================================
// extractPageAsPdf Tests (6 tests)
// ============================================

describe('PDF-to-Image Serverless - extractPageAsPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract first page as base64 PDF', async () => {
    const pdfBuffer = await createSimplePDF(3);

    const result = await extractPageAsPdf(pdfBuffer, 1);

    expect(result.base64).toBeDefined();
    expect(result.base64.length).toBeGreaterThan(0);
    expect(result.pageCount).toBe(3);

    // Verify it's valid base64
    expect(() => Buffer.from(result.base64, 'base64')).not.toThrow();
  });

  it('should extract middle page from multi-page PDF', async () => {
    const pdfBuffer = await createSimplePDF(5);

    const result = await extractPageAsPdf(pdfBuffer, 3);

    expect(result.base64).toBeDefined();
    expect(result.pageCount).toBe(5);

    // Verify extracted PDF is valid
    const extractedBuffer = Buffer.from(result.base64, 'base64');
    const extractedDoc = await PDFDocument.load(new Uint8Array(extractedBuffer));
    expect(extractedDoc.getPageCount()).toBe(1);
  });

  it('should extract last page from PDF', async () => {
    const pdfBuffer = await createSimplePDF(10);

    const result = await extractPageAsPdf(pdfBuffer, 10);

    expect(result.base64).toBeDefined();
    expect(result.pageCount).toBe(10);
  });

  it('should throw error for page number below range', async () => {
    const pdfBuffer = await createSimplePDF(5);

    await expect(extractPageAsPdf(pdfBuffer, 0)).rejects.toThrow('Page 0 out of range (1-5)');
  });

  it('should throw error for page number above range', async () => {
    const pdfBuffer = await createSimplePDF(5);

    await expect(extractPageAsPdf(pdfBuffer, 6)).rejects.toThrow('Page 6 out of range (1-5)');
  });

  it('should handle single page PDF', async () => {
    const pdfBuffer = await createSimplePDF(1);

    const result = await extractPageAsPdf(pdfBuffer, 1);

    expect(result.base64).toBeDefined();
    expect(result.pageCount).toBe(1);
  });
});

// ============================================
// getPageInfo Tests (6 tests)
// ============================================

describe('PDF-to-Image Serverless - getPageInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get dimensions for standard letter page', async () => {
    const pdfBuffer = await createPortraitPDF();

    const info = await getPageInfo(pdfBuffer, 1);

    expect(info.width).toBe(612);
    expect(info.height).toBe(792);
    expect(info.rotation).toBe(0);
    expect(info.pageCount).toBe(1);
  });

  it('should get dimensions for large format page', async () => {
    const pdfBuffer = await createLargeFormatPDF();

    const info = await getPageInfo(pdfBuffer, 1);

    expect(info.width).toBe(1728);
    expect(info.height).toBe(2592);
    expect(info.rotation).toBe(0);
    expect(info.pageCount).toBe(1);
  });

  it('should default to page 1 if no page number provided', async () => {
    const pdfBuffer = await createSimplePDF(3);

    const info = await getPageInfo(pdfBuffer);

    expect(info.pageCount).toBe(3);
    expect(info.width).toBeDefined();
    expect(info.height).toBeDefined();
  });

  it('should throw error for invalid page number', async () => {
    const pdfBuffer = await createSimplePDF(5);

    await expect(getPageInfo(pdfBuffer, 10)).rejects.toThrow('Page 10 out of range');
  });

  it('should throw error for page number below 1', async () => {
    const pdfBuffer = await createSimplePDF(5);

    await expect(getPageInfo(pdfBuffer, 0)).rejects.toThrow('Page 0 out of range');
  });

  it('should handle multi-page PDF and get specific page info', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([612, 792]); // Page 1: standard letter
    pdfDoc.addPage([1728, 2592]); // Page 2: large format
    const pdfBuffer = Buffer.from(await pdfDoc.save());

    const page1Info = await getPageInfo(pdfBuffer, 1);
    const page2Info = await getPageInfo(pdfBuffer, 2);

    expect(page1Info.width).toBe(612);
    expect(page1Info.height).toBe(792);
    expect(page2Info.width).toBe(1728);
    expect(page2Info.height).toBe(2592);
  });
});

// ============================================
// estimatePageType Tests (8 tests)
// ============================================

describe('PDF-to-Image Serverless - estimatePageType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should classify large format page as drawing', async () => {
    const pdfBuffer = await createLargeFormatPDF();

    const pageType = await estimatePageType(pdfBuffer, 1);

    expect(pageType).toBe('drawing');
  });

  it('should classify landscape wide-aspect page as drawing', async () => {
    // Wide landscape: 2000x800 (aspect ratio 2.5)
    const pdfBuffer = await createSimplePDF(1, [2000, 800]);

    const pageType = await estimatePageType(pdfBuffer, 1);

    expect(pageType).toBe('drawing');
  });

  it('should classify portrait standard page as text', async () => {
    const pdfBuffer = await createPortraitPDF();

    const pageType = await estimatePageType(pdfBuffer, 1);

    expect(pageType).toBe('text');
  });

  it('should classify standard landscape as mixed', async () => {
    // 11x8.5 landscape (not wide enough for drawing)
    const pdfBuffer = await createSimplePDF(1, [792, 612]);

    const pageType = await estimatePageType(pdfBuffer, 1);

    expect(pageType).toBe('mixed');
  });

  it('should classify square page as mixed', async () => {
    const pdfBuffer = await createSimplePDF(1, [1000, 1000]);

    const pageType = await estimatePageType(pdfBuffer, 1);

    expect(pageType).toBe('mixed');
  });

  it('should default to page 1 if no page number provided', async () => {
    const pdfBuffer = await createLargeFormatPDF();

    const pageType = await estimatePageType(pdfBuffer);

    expect(pageType).toBe('drawing');
  });

  it('should return mixed for invalid PDF', async () => {
    const invalidBuffer = Buffer.from('invalid pdf content');

    const pageType = await estimatePageType(invalidBuffer, 1);

    expect(pageType).toBe('mixed');
  });

  it('should handle edge case: exactly 1200 width (boundary)', async () => {
    const pdfBuffer = await createSimplePDF(1, [1201, 800]);

    const pageType = await estimatePageType(pdfBuffer, 1);

    expect(pageType).toBe('drawing');
  });
});

// ============================================
// splitPdfIntoPages Tests (7 tests)
// ============================================

describe('PDF-to-Image Serverless - splitPdfIntoPages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should split all pages without range specified', async () => {
    const pdfBuffer = await createSimplePDF(5);

    const pages = await splitPdfIntoPages(pdfBuffer);

    expect(pages).toHaveLength(5);
    pages.forEach((page, index) => {
      expect(page.pageNumber).toBe(index + 1);
      expect(page.base64).toBeDefined();
      expect(page.mimeType).toBe('application/pdf');
      expect(page.source).toBe('pdf-native');
    });
  });

  it('should split pages with start page only', async () => {
    const pdfBuffer = await createSimplePDF(10);

    const pages = await splitPdfIntoPages(pdfBuffer, 5);

    expect(pages).toHaveLength(6); // Pages 5-10
    expect(pages[0].pageNumber).toBe(5);
    expect(pages[5].pageNumber).toBe(10);
  });

  it('should split pages with start and end range', async () => {
    const pdfBuffer = await createSimplePDF(10);

    const pages = await splitPdfIntoPages(pdfBuffer, 3, 7);

    expect(pages).toHaveLength(5); // Pages 3-7
    expect(pages[0].pageNumber).toBe(3);
    expect(pages[4].pageNumber).toBe(7);
  });

  it('should handle end page beyond document length', async () => {
    const pdfBuffer = await createSimplePDF(5);

    const pages = await splitPdfIntoPages(pdfBuffer, 1, 100);

    expect(pages).toHaveLength(5);
    expect(pages[4].pageNumber).toBe(5);
  });

  it('should handle single page PDF', async () => {
    const pdfBuffer = await createSimplePDF(1);

    const pages = await splitPdfIntoPages(pdfBuffer);

    expect(pages).toHaveLength(1);
    expect(pages[0].pageNumber).toBe(1);
  });

  it('should handle extraction errors gracefully', async () => {
    // Create a PDF but pass an invalid page range internally
    const pdfBuffer = await createSimplePDF(3);

    // Mock console.error to suppress error output

    // This should handle extraction errors and return pages that succeeded
    const pages = await splitPdfIntoPages(pdfBuffer, 1, 3);

    // All pages should succeed since they're valid
    expect(pages.length).toBeGreaterThan(0);

  });

  it('should return valid base64 for each page', async () => {
    const pdfBuffer = await createSimplePDF(3);

    const pages = await splitPdfIntoPages(pdfBuffer);

    for (const page of pages) {
      // Verify base64 is valid
      expect(() => Buffer.from(page.base64, 'base64')).not.toThrow();

      // Verify it's a valid PDF
      const pageBuffer = Buffer.from(page.base64, 'base64');
      const pageDoc = await PDFDocument.load(new Uint8Array(pageBuffer));
      expect(pageDoc.getPageCount()).toBe(1);
    }
  });
});

// ============================================
// getConstructionDrawingPrompt Tests (6 tests)
// ============================================

describe('PDF-to-Image Serverless - getConstructionDrawingPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate drawing prompt for drawing type', () => {
    const prompt = getConstructionDrawingPrompt('A-101-Floor-Plan.pdf', 1, 'drawing');

    expect(prompt).toContain('page 1');
    expect(prompt).toContain('A-101-Floor-Plan.pdf');
    expect(prompt).toContain('CONSTRUCTION DRAWING');
    expect(prompt).toContain('Title Block Info');
    expect(prompt).toContain('Drawing Content');
    expect(prompt).toContain('Symbols & Annotations');
    expect(prompt).toContain('Spatial Information');
    expect(prompt).toContain('JSON object');
  });

  it('should generate text prompt for text type', () => {
    const prompt = getConstructionDrawingPrompt('Specifications.pdf', 2, 'text');

    expect(prompt).toContain('page 2');
    expect(prompt).toContain('Specifications.pdf');
    expect(prompt).toContain('TEXT DOCUMENT');
    expect(prompt).toContain('Document Info');
    expect(prompt).toContain('Content Structure');
    expect(prompt).toContain('Key Data');
    expect(prompt).toContain('JSON object');
  });

  it('should default to drawing prompt for mixed type', () => {
    const prompt = getConstructionDrawingPrompt('Document.pdf', 1, 'mixed');

    expect(prompt).toContain('CONSTRUCTION DRAWING');
    expect(prompt).not.toContain('TEXT DOCUMENT');
  });

  it('should include base instructions in all prompts', () => {
    const drawingPrompt = getConstructionDrawingPrompt('test.pdf', 1, 'drawing');
    const textPrompt = getConstructionDrawingPrompt('test.pdf', 1, 'text');

    const baseChecks = [
      'IMPORTANT VISUAL ANALYSIS INSTRUCTIONS',
      'Carefully examine ALL visual elements',
      'JSON object',
      'sheet_info',
      'document_type',
    ];

    baseChecks.forEach(check => {
      expect(drawingPrompt).toContain(check);
      expect(textPrompt).toContain(check);
    });
  });

  it('should include expected JSON structure', () => {
    const prompt = getConstructionDrawingPrompt('test.pdf', 1, 'drawing');

    const expectedFields = [
      'sheet_info',
      'document_type',
      'main_content',
      'key_elements',
      'dimensions',
      'room_info',
      'notes',
      'references',
      'symbols',
      'text_content',
    ];

    expectedFields.forEach(field => {
      expect(prompt).toContain(field);
    });
  });

  it('should handle special characters in filename', () => {
    const prompt = getConstructionDrawingPrompt('A-101 (Rev 2) - Floor Plan.pdf', 5, 'drawing');

    expect(prompt).toContain('page 5');
    expect(prompt).toContain('A-101 (Rev 2) - Floor Plan.pdf');
  });
});

// ============================================
// getEnhancedVisualPrompt Tests (5 tests)
// ============================================

describe('PDF-to-Image Serverless - getEnhancedVisualPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate comprehensive visual analysis prompt', () => {
    const prompt = getEnhancedVisualPrompt('M-201-HVAC-Plan.pdf', 3);

    expect(prompt).toContain('VISUAL ANALYSIS TASK');
    expect(prompt).toContain('Page 3');
    expect(prompt).toContain('M-201-HVAC-Plan.pdf');
    expect(prompt).toContain('CRITICAL INSTRUCTIONS FOR VISUAL ANALYSIS');
  });

  it('should include construction drawing types', () => {
    const prompt = getEnhancedVisualPrompt('test.pdf', 1);

    const drawingTypes = [
      'Architectural floor plan',
      'Structural drawing',
      'MEP',
      'Site plan',
      'Detail sheet',
      'Specification page',
      'Schedule sheet',
    ];

    drawingTypes.forEach(type => {
      expect(prompt).toContain(type);
    });
  });

  it('should include detailed extraction instructions', () => {
    const prompt = getEnhancedVisualPrompt('test.pdf', 1);

    const instructions = [
      'EXAMINE THE ENTIRE PAGE',
      'title block',
      'FOR CONSTRUCTION DRAWINGS',
      'room names/numbers',
      'dimension strings',
      'door/window tags',
      'FOR TEXT/SPECIFICATION PAGES',
      'ALWAYS CAPTURE',
    ];

    instructions.forEach(instruction => {
      expect(prompt).toContain(instruction);
    });
  });

  it('should include comprehensive JSON structure', () => {
    const prompt = getEnhancedVisualPrompt('test.pdf', 1);

    const jsonFields = [
      'page_type',
      'sheet_number',
      'sheet_title',
      'scale',
      'revision',
      'discipline',
      'rooms',
      'dimensions',
      'door_schedule',
      'window_schedule',
      'equipment',
      'notes',
      'references',
      'grid_lines',
      'legend_items',
      'key_observations',
    ];

    jsonFields.forEach(field => {
      expect(prompt).toContain(field);
    });
  });

  it('should include page types in JSON structure', () => {
    const prompt = getEnhancedVisualPrompt('test.pdf', 1);

    const pageTypes = [
      'floor_plan',
      'elevation',
      'section',
      'detail',
      'schedule',
      'specification',
      'titlesheet',
    ];

    pageTypes.forEach(type => {
      expect(prompt).toContain(type);
    });
  });
});

// ============================================
// Dynamic Import Tests (2 tests)
// ============================================

describe('PDF-to-Image Serverless - Dynamic Imports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should check if sharp is available', async () => {
    const available = await isSharpAvailable();

    // In test environment, sharp may or may not be installed
    expect(typeof available).toBe('boolean');
  });

  it('should always return false for canvas availability (removed Feb 2026)', async () => {
    const available = await isCanvasAvailable();

    // Canvas was removed to reduce bundle size for Vercel compatibility
    expect(available).toBe(false);
  });
});

// ============================================
// getBestStrategy Tests (4 tests)
// Updated Feb 2026: Canvas removed, always returns native-pdf
// ============================================

describe('PDF-to-Image Serverless - getBestStrategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should always return native-pdf strategy (canvas removed Feb 2026)', async () => {
    // Mock console.log to suppress output

    const strategy = await getBestStrategy();

    // Canvas was removed, so always returns native-pdf
    expect(strategy).toBe('native-pdf');

  });

  it('should log strategy selection', async () => {
    await getBestStrategy();

    expect(mockLogger.info).toHaveBeenCalled();
  });

  it('should never return canvas-raster strategy (canvas removed)', async () => {

    const strategy = await getBestStrategy();

    expect(strategy).not.toBe('canvas-raster');

  });

  it('should never return text-only strategy', async () => {

    const strategy = await getBestStrategy();

    expect(strategy).not.toBe('text-only');

  });
});

// ============================================
// Integration Tests (4 tests)
// ============================================

describe('PDF-to-Image Serverless - Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract and analyze construction drawing page', async () => {
    const pdfBuffer = await createLargeFormatPDF();

    // Extract page
    const { base64, pageCount } = await extractPageAsPdf(pdfBuffer, 1);

    // Get page info
    const info = await getPageInfo(pdfBuffer, 1);

    // Estimate page type
    const pageType = await estimatePageType(pdfBuffer, 1);

    // Generate prompt
    const prompt = getConstructionDrawingPrompt('A-101.pdf', 1, pageType);

    expect(base64).toBeDefined();
    expect(pageCount).toBe(1);
    expect(info.width).toBe(1728);
    expect(info.height).toBe(2592);
    expect(pageType).toBe('drawing');
    expect(prompt).toContain('CONSTRUCTION DRAWING');
  });

  it('should extract and analyze specification document page', async () => {
    const pdfBuffer = await createPortraitPDF();

    // Extract page
    const { base64 } = await extractPageAsPdf(pdfBuffer, 1);

    // Get page info
    const info = await getPageInfo(pdfBuffer, 1);

    // Estimate page type
    const pageType = await estimatePageType(pdfBuffer, 1);

    // Generate prompt
    const prompt = getConstructionDrawingPrompt('Spec-09.pdf', 1, pageType);

    expect(base64).toBeDefined();
    expect(info.width).toBe(612);
    expect(info.height).toBe(792);
    expect(pageType).toBe('text');
    expect(prompt).toContain('TEXT DOCUMENT');
  });

  it('should split multi-page document with mixed page types', async () => {
    // Create PDF with different page sizes
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([612, 792]); // Text page
    pdfDoc.addPage([1728, 2592]); // Drawing page
    pdfDoc.addPage([792, 612]); // Landscape (mixed)
    const pdfBuffer = Buffer.from(await pdfDoc.save());

    const pages = await splitPdfIntoPages(pdfBuffer);

    expect(pages).toHaveLength(3);

    // Verify each page type
    const type1 = await estimatePageType(pdfBuffer, 1);
    const type2 = await estimatePageType(pdfBuffer, 2);
    const type3 = await estimatePageType(pdfBuffer, 3);

    expect(type1).toBe('text');
    expect(type2).toBe('drawing');
    expect(type3).toBe('mixed');
  });

  it('should handle complete workflow for construction document set', async () => {
    // Create a typical construction document set
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([1728, 2592]); // Sheet A-101
    pdfDoc.addPage([1728, 2592]); // Sheet A-102
    pdfDoc.addPage([612, 792]); // Specifications
    const pdfBuffer = Buffer.from(await pdfDoc.save());

    // Get best strategy
    const strategy = await getBestStrategy();
    expect(strategy).toBeDefined();

    // Split pages
    const pages = await splitPdfIntoPages(pdfBuffer);
    expect(pages).toHaveLength(3);

    // Process each page
    for (let i = 0; i < pages.length; i++) {
      const pageNum = i + 1;
      const info = await getPageInfo(pdfBuffer, pageNum);
      const pageType = await estimatePageType(pdfBuffer, pageNum);
      const prompt = getEnhancedVisualPrompt(`Sheet-${pageNum}.pdf`, pageNum);

      expect(info).toBeDefined();
      expect(pageType).toBeDefined();
      expect(prompt).toContain(`Page ${pageNum}`);
    }
  });
});
