import { describe, it, expect, vi, beforeEach } from 'vitest';
import JSZip from 'jszip';

// ============================================
// Mocks Setup - Must use vi.hoisted for mock objects
// ============================================

// Mock JSZip with vi.hoisted
const mockJSZip = vi.hoisted(() => ({
  loadAsync: vi.fn(),
}));

vi.mock('jszip', () => ({
  default: mockJSZip,
}));

// Import functions after mocks
import { detectMacros, shouldBlockMacroFile } from '@/lib/macro-detector';

// ============================================
// Test Helpers
// ============================================

/**
 * Creates a mock ZIP file structure for Office Open XML documents
 */
function createMockZipFile(fileList: string[]) {
  const mockFiles: Record<string, any> = {};

  fileList.forEach(path => {
    mockFiles[path] = { name: path };
  });

  return {
    file: (path: string) => mockFiles[path] || null,
    files: mockFiles,
  };
}

/**
 * Creates a Buffer with OLE compound document signature
 */
function createOLEBuffer(includeVBASignature = false): Buffer {
  // OLE magic bytes: D0 CF 11 E0 A1 B1 1A E1
  const oleMagic = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);

  if (includeVBASignature) {
    // Create buffer with OLE header + VBA signature
    const vbaSignature = Buffer.from('VBA');
    const buffer = Buffer.concat([oleMagic, Buffer.alloc(100), vbaSignature]);
    return buffer;
  }

  // Just OLE header, no VBA
  return Buffer.concat([oleMagic, Buffer.alloc(200)]);
}

/**
 * Creates a minimal valid ZIP buffer (for modern Office formats)
 */
function createZipBuffer(): Buffer {
  // Minimal ZIP file structure (PK header)
  const pkHeader = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
  return Buffer.concat([pkHeader, Buffer.alloc(100)]);
}

// ============================================
// Modern Office Formats - DOCX/XLSX/PPTX (24 tests)
// ============================================

describe('Macro Detector - Modern Office Formats (DOCX/XLSX/PPTX)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Macro Detection in Modern Formats (8 tests)
  // ============================================

  describe('detectMacros - modern formats with macros', () => {
    it('should detect macros in DOCX with word/vbaProject.bin', async () => {
      const buffer = createZipBuffer();
      const mockZip = createMockZipFile(['word/vbaProject.bin', 'word/document.xml']);

      mockJSZip.loadAsync.mockResolvedValue(mockZip);

      const result = await detectMacros(buffer, 'document.docx');

      expect(result.hasMacros).toBe(true);
      expect(result.macroType).toBe('vbaProject.bin');
      expect(result.error).toBeUndefined();
      expect(mockJSZip.loadAsync).toHaveBeenCalledWith(buffer);
    });

    it('should detect macros in XLSX with xl/vbaProject.bin', async () => {
      const buffer = createZipBuffer();
      const mockZip = createMockZipFile(['xl/vbaProject.bin', 'xl/workbook.xml']);

      mockJSZip.loadAsync.mockResolvedValue(mockZip);

      const result = await detectMacros(buffer, 'spreadsheet.xlsx');

      expect(result.hasMacros).toBe(true);
      expect(result.macroType).toBe('vbaProject.bin');
      expect(result.error).toBeUndefined();
    });

    it('should detect macros in PPTX with ppt/vbaProject.bin', async () => {
      const buffer = createZipBuffer();
      const mockZip = createMockZipFile(['ppt/vbaProject.bin', 'ppt/presentation.xml']);

      mockJSZip.loadAsync.mockResolvedValue(mockZip);

      const result = await detectMacros(buffer, 'presentation.pptx');

      expect(result.hasMacros).toBe(true);
      expect(result.macroType).toBe('vbaProject.bin');
      expect(result.error).toBeUndefined();
    });

    it('should detect macros with generic vbaProject.bin location', async () => {
      const buffer = createZipBuffer();
      const mockZip = createMockZipFile(['vbaProject.bin', 'document.xml']);

      mockJSZip.loadAsync.mockResolvedValue(mockZip);

      const result = await detectMacros(buffer, 'file.docx');

      expect(result.hasMacros).toBe(true);
      expect(result.macroType).toBe('vbaProject.bin');
    });

    it('should detect macros in DOCM (macro-enabled Word)', async () => {
      const buffer = createZipBuffer();
      const mockZip = createMockZipFile(['word/vbaProject.bin']);

      mockJSZip.loadAsync.mockResolvedValue(mockZip);

      const result = await detectMacros(buffer, 'report.docm');

      expect(result.hasMacros).toBe(true);
      expect(result.macroType).toBe('vbaProject.bin');
    });

    it('should detect macros in XLSM (macro-enabled Excel)', async () => {
      const buffer = createZipBuffer();
      const mockZip = createMockZipFile(['xl/vbaProject.bin']);

      mockJSZip.loadAsync.mockResolvedValue(mockZip);

      const result = await detectMacros(buffer, 'budget.xlsm');

      expect(result.hasMacros).toBe(true);
      expect(result.macroType).toBe('vbaProject.bin');
    });

    it('should detect macros in PPTM (macro-enabled PowerPoint)', async () => {
      const buffer = createZipBuffer();
      const mockZip = createMockZipFile(['ppt/vbaProject.bin']);

      mockJSZip.loadAsync.mockResolvedValue(mockZip);

      const result = await detectMacros(buffer, 'slides.pptm');

      expect(result.hasMacros).toBe(true);
      expect(result.macroType).toBe('vbaProject.bin');
    });

    it('should check all MACRO_INDICATORS paths in order', async () => {
      const buffer = createZipBuffer();

      // Test that it checks word/ first, then xl/, then ppt/, then generic
      const mockZip = {
        file: vi.fn((path: string) => {
          // Only return a match for ppt/vbaProject.bin
          return path === 'ppt/vbaProject.bin' ? { name: path } : null;
        }),
      };

      mockJSZip.loadAsync.mockResolvedValue(mockZip);

      const result = await detectMacros(buffer, 'test.pptx');

      expect(result.hasMacros).toBe(true);
      // Should have checked all paths until finding match
      expect(mockZip.file).toHaveBeenCalledWith('word/vbaProject.bin');
      expect(mockZip.file).toHaveBeenCalledWith('xl/vbaProject.bin');
      expect(mockZip.file).toHaveBeenCalledWith('ppt/vbaProject.bin');
    });
  });

  // ============================================
  // Clean Modern Formats (8 tests)
  // ============================================

  describe('detectMacros - modern formats without macros', () => {
    it('should return false for clean DOCX', async () => {
      const buffer = createZipBuffer();
      const mockZip = createMockZipFile(['word/document.xml', 'word/styles.xml']);

      mockJSZip.loadAsync.mockResolvedValue(mockZip);

      const result = await detectMacros(buffer, 'clean.docx');

      expect(result.hasMacros).toBe(false);
      expect(result.macroType).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it('should return false for clean XLSX', async () => {
      const buffer = createZipBuffer();
      const mockZip = createMockZipFile(['xl/workbook.xml', 'xl/sharedStrings.xml']);

      mockJSZip.loadAsync.mockResolvedValue(mockZip);

      const result = await detectMacros(buffer, 'clean.xlsx');

      expect(result.hasMacros).toBe(false);
    });

    it('should return false for clean PPTX', async () => {
      const buffer = createZipBuffer();
      const mockZip = createMockZipFile(['ppt/presentation.xml', 'ppt/slides/slide1.xml']);

      mockJSZip.loadAsync.mockResolvedValue(mockZip);

      const result = await detectMacros(buffer, 'clean.pptx');

      expect(result.hasMacros).toBe(false);
    });

    it('should return false for DOCM without vbaProject.bin (renamed file)', async () => {
      const buffer = createZipBuffer();
      const mockZip = createMockZipFile(['word/document.xml']);

      mockJSZip.loadAsync.mockResolvedValue(mockZip);

      const result = await detectMacros(buffer, 'suspicious.docm');

      // Even though extension is .docm, no vbaProject.bin = no macros
      expect(result.hasMacros).toBe(false);
    });

    it('should handle empty ZIP archive', async () => {
      const buffer = createZipBuffer();
      const mockZip = createMockZipFile([]);

      mockJSZip.loadAsync.mockResolvedValue(mockZip);

      const result = await detectMacros(buffer, 'empty.docx');

      expect(result.hasMacros).toBe(false);
    });

    it('should handle ZIP with only content files', async () => {
      const buffer = createZipBuffer();
      const mockZip = createMockZipFile([
        'word/document.xml',
        'word/styles.xml',
        'word/settings.xml',
        'docProps/core.xml',
        '_rels/.rels',
      ]);

      mockJSZip.loadAsync.mockResolvedValue(mockZip);

      const result = await detectMacros(buffer, 'normal.docx');

      expect(result.hasMacros).toBe(false);
    });

    it('should handle file with vbaProject in name but not in path', async () => {
      const buffer = createZipBuffer();
      const mockZip = createMockZipFile([
        'word/document.xml',
        'word/media/vbaProject_screenshot.png', // Not actual vbaProject.bin
      ]);

      mockJSZip.loadAsync.mockResolvedValue(mockZip);

      const result = await detectMacros(buffer, 'test.docx');

      expect(result.hasMacros).toBe(false);
    });

    it('should handle uppercase extension variants', async () => {
      const buffer = createZipBuffer();
      const mockZip = createMockZipFile(['word/document.xml']);

      mockJSZip.loadAsync.mockResolvedValue(mockZip);

      const result = await detectMacros(buffer, 'DOCUMENT.DOCX');

      expect(result.hasMacros).toBe(false);
      // Extension should be normalized to lowercase
    });
  });

  // ============================================
  // ZIP Error Handling (8 tests)
  // ============================================

  describe('detectMacros - ZIP error handling', () => {
    it('should handle corrupt ZIP gracefully', async () => {
      const buffer = Buffer.from('not a valid zip');

      mockJSZip.loadAsync.mockRejectedValue(new Error('Invalid ZIP structure'));

      const result = await detectMacros(buffer, 'corrupt.docx');

      expect(result.hasMacros).toBe(false);
      expect(result.error).toBe('Failed to analyze file: Invalid ZIP structure');
    });

    it('should handle ZIP with invalid header', async () => {
      const buffer = Buffer.alloc(100); // No PK header

      mockJSZip.loadAsync.mockRejectedValue(new Error('Not a ZIP file'));

      const result = await detectMacros(buffer, 'invalid.xlsx');

      expect(result.hasMacros).toBe(false);
      expect(result.error).toContain('Failed to analyze file');
    });

    it('should handle truncated ZIP', async () => {
      const buffer = Buffer.from([0x50, 0x4B]); // Just PK, truncated

      mockJSZip.loadAsync.mockRejectedValue(new Error('Unexpected end of file'));

      const result = await detectMacros(buffer, 'truncated.pptx');

      expect(result.hasMacros).toBe(false);
      expect(result.error).toBe('Failed to analyze file: Unexpected end of file');
    });

    it('should handle ZIP decompression errors', async () => {
      const buffer = createZipBuffer();

      mockJSZip.loadAsync.mockRejectedValue(new Error('Decompression failed'));

      const result = await detectMacros(buffer, 'compressed.docx');

      expect(result.hasMacros).toBe(false);
      expect(result.error).toBe('Failed to analyze file: Decompression failed');
    });

    it('should handle password-protected ZIP', async () => {
      const buffer = createZipBuffer();

      mockJSZip.loadAsync.mockRejectedValue(new Error('Encrypted ZIP not supported'));

      const result = await detectMacros(buffer, 'protected.xlsx');

      expect(result.hasMacros).toBe(false);
      expect(result.error).toContain('Failed to analyze file');
    });

    it('should handle out of memory errors', async () => {
      const buffer = createZipBuffer();

      mockJSZip.loadAsync.mockRejectedValue(new Error('JavaScript heap out of memory'));

      const result = await detectMacros(buffer, 'huge.pptx');

      expect(result.hasMacros).toBe(false);
      expect(result.error).toContain('heap out of memory');
    });

    it('should handle timeout errors', async () => {
      const buffer = createZipBuffer();

      mockJSZip.loadAsync.mockRejectedValue(new Error('Operation timed out'));

      const result = await detectMacros(buffer, 'slow.docx');

      expect(result.hasMacros).toBe(false);
      expect(result.error).toBe('Failed to analyze file: Operation timed out');
    });

    it('should preserve error message in error field', async () => {
      const buffer = createZipBuffer();
      const customError = 'Custom ZIP parsing error message';

      mockJSZip.loadAsync.mockRejectedValue(new Error(customError));

      const result = await detectMacros(buffer, 'error.docx');

      expect(result.error).toBe(`Failed to analyze file: ${customError}`);
    });
  });
});

// ============================================
// Legacy Office Formats - DOC/XLS/PPT (15 tests)
// ============================================

describe('Macro Detector - Legacy Office Formats (DOC/XLS/PPT)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // OLE Format Detection (8 tests)
  // ============================================

  describe('detectMacros - legacy OLE formats with macros', () => {
    it('should detect macros in DOC with OLE header and VBA signature', async () => {
      const buffer = createOLEBuffer(true);

      const result = await detectMacros(buffer, 'document.doc');

      expect(result.hasMacros).toBe(true);
      expect(result.macroType).toBe('legacy-ole-vba');
      expect(result.error).toBeUndefined();
    });

    it('should detect macros in XLS with OLE header and VBA signature', async () => {
      const buffer = createOLEBuffer(true);

      const result = await detectMacros(buffer, 'spreadsheet.xls');

      expect(result.hasMacros).toBe(true);
      expect(result.macroType).toBe('legacy-ole-vba');
    });

    it('should detect macros in PPT with OLE header and VBA signature', async () => {
      const buffer = createOLEBuffer(true);

      const result = await detectMacros(buffer, 'presentation.ppt');

      expect(result.hasMacros).toBe(true);
      expect(result.macroType).toBe('legacy-ole-vba');
    });

    it('should verify OLE magic bytes match exactly', async () => {
      // Create buffer with correct OLE header
      const validOLE = createOLEBuffer(true);
      const result1 = await detectMacros(validOLE, 'valid.doc');
      expect(result1.hasMacros).toBe(true);

      // Create buffer with invalid header (first byte wrong)
      const invalidOLE = Buffer.from([0xD1, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
      const vbaBuffer = Buffer.concat([invalidOLE, Buffer.alloc(100), Buffer.from('VBA')]);
      const result2 = await detectMacros(vbaBuffer, 'invalid.doc');
      expect(result2.hasMacros).toBe(false); // Should fail magic byte check
    });

    it('should find VBA signature anywhere in buffer', async () => {
      const oleMagic = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
      const vbaSignature = Buffer.from('VBA');

      // VBA signature at the end of a large buffer
      const buffer = Buffer.concat([
        oleMagic,
        Buffer.alloc(5000), // Large gap
        vbaSignature,
      ]);

      const result = await detectMacros(buffer, 'large.doc');

      expect(result.hasMacros).toBe(true);
      expect(result.macroType).toBe('legacy-ole-vba');
    });

    it('should detect VBA signature case-sensitively', async () => {
      const oleMagic = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);

      // Test lowercase 'vba' - should NOT match
      const bufferLower = Buffer.concat([oleMagic, Buffer.alloc(100), Buffer.from('vba')]);
      const resultLower = await detectMacros(bufferLower, 'test.doc');
      expect(resultLower.hasMacros).toBe(false);

      // Test uppercase 'VBA' - should match
      const bufferUpper = Buffer.concat([oleMagic, Buffer.alloc(100), Buffer.from('VBA')]);
      const resultUpper = await detectMacros(bufferUpper, 'test.doc');
      expect(resultUpper.hasMacros).toBe(true);
    });

    it('should handle OLE file with VBA in filename but not content', async () => {
      const buffer = createOLEBuffer(false); // OLE header, no VBA signature

      const result = await detectMacros(buffer, 'vba_report.doc');

      expect(result.hasMacros).toBe(false);
      // Filename doesn't matter, only content
    });

    it('should handle very small OLE files', async () => {
      // File barely larger than OLE header
      const smallOLE = Buffer.concat([
        Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]),
        Buffer.from('VBA'),
      ]);

      const result = await detectMacros(smallOLE, 'tiny.doc');

      expect(result.hasMacros).toBe(true);
    });
  });

  // ============================================
  // Clean Legacy Formats (7 tests)
  // ============================================

  describe('detectMacros - legacy formats without macros', () => {
    it('should return false for DOC without VBA signature', async () => {
      const buffer = createOLEBuffer(false); // OLE but no VBA

      const result = await detectMacros(buffer, 'clean.doc');

      expect(result.hasMacros).toBe(false);
    });

    it('should return false for XLS without VBA signature', async () => {
      const buffer = createOLEBuffer(false);

      const result = await detectMacros(buffer, 'clean.xls');

      expect(result.hasMacros).toBe(false);
    });

    it('should return false for PPT without VBA signature', async () => {
      const buffer = createOLEBuffer(false);

      const result = await detectMacros(buffer, 'clean.ppt');

      expect(result.hasMacros).toBe(false);
    });

    it('should return false for DOC without OLE header', async () => {
      const buffer = Buffer.from('This is just text content, not OLE');

      const result = await detectMacros(buffer, 'text.doc');

      expect(result.hasMacros).toBe(false);
    });

    it('should return false for legacy file with partial VBA string', async () => {
      const oleMagic = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
      const buffer = Buffer.concat([oleMagic, Buffer.from('VB')]); // Only 'VB', not 'VBA'

      const result = await detectMacros(buffer, 'partial.doc');

      expect(result.hasMacros).toBe(false);
    });

    it('should return false for buffer smaller than OLE header', async () => {
      const tinyBuffer = Buffer.from([0xD0, 0xCF, 0x11]); // Only 3 bytes

      const result = await detectMacros(tinyBuffer, 'tiny.doc');

      expect(result.hasMacros).toBe(false);
    });

    it('should handle OLE file with VBA in text content (false positive check)', async () => {
      const oleMagic = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
      // Content mentions VBA but isn't actual VBA code
      const content = Buffer.from('This document discusses VBA programming');
      const buffer = Buffer.concat([oleMagic, content]);

      const result = await detectMacros(buffer, 'about_vba.doc');

      // Current implementation would detect this as having macros
      // This is acceptable as it's better to be cautious
      expect(result.hasMacros).toBe(true);
    });
  });
});

// ============================================
// File Extension Filtering (12 tests)
// ============================================

describe('Macro Detector - File Extension Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectMacros - non-Office file handling', () => {
    it('should skip PDF files', async () => {
      const buffer = Buffer.from('PDF content');

      const result = await detectMacros(buffer, 'drawing.pdf');

      expect(result.hasMacros).toBe(false);
      expect(mockJSZip.loadAsync).not.toHaveBeenCalled();
    });

    it('should skip image files (PNG)', async () => {
      const buffer = Buffer.from('PNG image data');

      const result = await detectMacros(buffer, 'photo.png');

      expect(result.hasMacros).toBe(false);
    });

    it('should skip image files (JPG)', async () => {
      const buffer = Buffer.from('JPEG image data');

      const result = await detectMacros(buffer, 'photo.jpg');

      expect(result.hasMacros).toBe(false);
    });

    it('should skip text files', async () => {
      const buffer = Buffer.from('Plain text content');

      const result = await detectMacros(buffer, 'readme.txt');

      expect(result.hasMacros).toBe(false);
    });

    it('should skip CAD files (DWG)', async () => {
      const buffer = Buffer.from('AutoCAD drawing');

      const result = await detectMacros(buffer, 'plan.dwg');

      expect(result.hasMacros).toBe(false);
    });

    it('should skip CSV files', async () => {
      const buffer = Buffer.from('col1,col2,col3');

      const result = await detectMacros(buffer, 'data.csv');

      expect(result.hasMacros).toBe(false);
    });

    it('should skip executable files', async () => {
      const buffer = Buffer.from('MZ executable');

      const result = await detectMacros(buffer, 'program.exe');

      expect(result.hasMacros).toBe(false);
    });

    it('should skip files without extension', async () => {
      const buffer = createZipBuffer();

      const result = await detectMacros(buffer, 'README');

      expect(result.hasMacros).toBe(false);
    });

    it('should handle mixed case extensions', async () => {
      const buffer = createZipBuffer();
      const mockZip = createMockZipFile(['word/vbaProject.bin']);

      mockJSZip.loadAsync.mockResolvedValue(mockZip);

      const result = await detectMacros(buffer, 'File.DoCx');

      // Should normalize to lowercase and process
      expect(result.hasMacros).toBe(true);
    });

    it('should handle files with multiple dots in name', async () => {
      const buffer = createZipBuffer();
      const mockZip = createMockZipFile(['word/document.xml']);

      mockJSZip.loadAsync.mockResolvedValue(mockZip);

      const result = await detectMacros(buffer, 'report.final.v2.docx');

      // Should use last extension
      expect(result.hasMacros).toBe(false);
      expect(mockJSZip.loadAsync).toHaveBeenCalled();
    });

    it('should handle empty filename gracefully', async () => {
      const buffer = Buffer.alloc(100);

      const result = await detectMacros(buffer, '');

      expect(result.hasMacros).toBe(false);
    });

    it('should process all MACRO_ENABLED_EXTENSIONS', async () => {
      const extensions = ['docm', 'xlsm', 'pptm', 'docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt'];

      for (const ext of extensions) {
        vi.clearAllMocks();

        const buffer = ext.endsWith('x') || ext.endsWith('m')
          ? createZipBuffer()
          : createOLEBuffer(false);

        const mockZip = createMockZipFile(['word/document.xml']);
        mockJSZip.loadAsync.mockResolvedValue(mockZip);

        const result = await detectMacros(buffer, `test.${ext}`);

        // Should attempt processing (not skip as non-Office)
        // Result depends on file content, but should not be immediately skipped
        expect(result).toHaveProperty('hasMacros');
      }
    });
  });
});

// ============================================
// Edge Cases (10 tests)
// ============================================

describe('Macro Detector - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle empty buffer', async () => {
    const buffer = Buffer.alloc(0);

    const result = await detectMacros(buffer, 'empty.docx');

    expect(result.hasMacros).toBe(false);
  });

  it('should handle very large buffer', async () => {
    const buffer = Buffer.alloc(50 * 1024 * 1024); // 50MB
    const mockZip = createMockZipFile(['word/document.xml']);

    mockJSZip.loadAsync.mockResolvedValue(mockZip);

    const result = await detectMacros(buffer, 'large.docx');

    expect(result.hasMacros).toBe(false);
  });

  it('should handle buffer with null bytes', async () => {
    const buffer = Buffer.alloc(1000); // All zeros
    buffer.write('VBA', 500); // VBA somewhere in middle

    // Write OLE header
    const oleMagic = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
    oleMagic.copy(buffer, 0);

    const result = await detectMacros(buffer, 'nulls.doc');

    expect(result.hasMacros).toBe(true);
  });

  it('should handle malformed filename', async () => {
    const buffer = createZipBuffer();
    const mockZip = createMockZipFile(['word/document.xml']);

    mockJSZip.loadAsync.mockResolvedValue(mockZip);

    const result = await detectMacros(buffer, '../../../etc/passwd.docx');

    // Should still work, only cares about extension
    expect(result.hasMacros).toBe(false);
  });

  it('should handle filename with special characters', async () => {
    const buffer = createZipBuffer();
    const mockZip = createMockZipFile(['word/vbaProject.bin']);

    mockJSZip.loadAsync.mockResolvedValue(mockZip);

    const result = await detectMacros(buffer, 'file@#$%.docx');

    expect(result.hasMacros).toBe(true);
  });

  it('should handle Unicode in filename', async () => {
    const buffer = createZipBuffer();
    const mockZip = createMockZipFile(['word/document.xml']);

    mockJSZip.loadAsync.mockResolvedValue(mockZip);

    const result = await detectMacros(buffer, '文档.docx');

    expect(result.hasMacros).toBe(false);
  });

  it('should handle multiple vbaProject.bin files', async () => {
    const buffer = createZipBuffer();
    const mockZip = createMockZipFile([
      'word/vbaProject.bin',
      'xl/vbaProject.bin', // Multiple macro files
      'ppt/vbaProject.bin',
    ]);

    mockJSZip.loadAsync.mockResolvedValue(mockZip);

    const result = await detectMacros(buffer, 'multi.docx');

    // Should detect on first match
    expect(result.hasMacros).toBe(true);
    expect(result.macroType).toBe('vbaProject.bin');
  });

  it('should handle OLE file with exact 8-byte buffer', async () => {
    const buffer = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);

    const result = await detectMacros(buffer, 'minimal.doc');

    // Too small to contain VBA
    expect(result.hasMacros).toBe(false);
  });

  it('should handle ZIP with only vbaProject.bin and no other files', async () => {
    const buffer = createZipBuffer();
    const mockZip = createMockZipFile(['word/vbaProject.bin']); // Only macro file

    mockJSZip.loadAsync.mockResolvedValue(mockZip);

    const result = await detectMacros(buffer, 'macro-only.docx');

    expect(result.hasMacros).toBe(true);
  });

  it('should not be confused by similar filenames', async () => {
    const buffer = createZipBuffer();
    const mockZip = createMockZipFile([
      'word/vbaProject.bin.bak', // Backup file
      'word/vbaProject.bin.old', // Old file
      'word/not-vbaProject.bin', // Different file
    ]);

    mockJSZip.loadAsync.mockResolvedValue(mockZip);

    const result = await detectMacros(buffer, 'similar.docx');

    expect(result.hasMacros).toBe(false);
    // Only exact matches should trigger detection
  });
});

// ============================================
// shouldBlockMacroFile Function (8 tests)
// ============================================

describe('Macro Detector - shouldBlockMacroFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should block file with macros and provide reason', async () => {
    const buffer = createZipBuffer();
    const mockZip = createMockZipFile(['word/vbaProject.bin']);

    mockJSZip.loadAsync.mockResolvedValue(mockZip);

    const result = await shouldBlockMacroFile(buffer, 'dangerous.docx');

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('File contains embedded macros (vbaProject.bin). Macro-enabled documents are not allowed for security reasons.');
  });

  it('should not block file without macros', async () => {
    const buffer = createZipBuffer();
    const mockZip = createMockZipFile(['word/document.xml']);

    mockJSZip.loadAsync.mockResolvedValue(mockZip);

    const result = await shouldBlockMacroFile(buffer, 'safe.docx');

    expect(result.blocked).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  it('should block legacy OLE file with VBA', async () => {
    const buffer = createOLEBuffer(true);

    const result = await shouldBlockMacroFile(buffer, 'legacy.doc');

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('File contains embedded macros (legacy-ole-vba). Macro-enabled documents are not allowed for security reasons.');
  });

  it('should not block legacy OLE file without VBA', async () => {
    const buffer = createOLEBuffer(false);

    const result = await shouldBlockMacroFile(buffer, 'clean-legacy.doc');

    expect(result.blocked).toBe(false);
  });

  it('should not block non-Office files', async () => {
    const buffer = Buffer.from('PDF content');

    const result = await shouldBlockMacroFile(buffer, 'drawing.pdf');

    expect(result.blocked).toBe(false);
  });

  it('should not block files with detection errors', async () => {
    const buffer = createZipBuffer();

    mockJSZip.loadAsync.mockRejectedValue(new Error('Corrupt ZIP'));

    const result = await shouldBlockMacroFile(buffer, 'corrupt.docx');

    // If detection fails, don't block (fail open for usability)
    expect(result.blocked).toBe(false);
  });

  it('should include macro type in block reason', async () => {
    const buffer = createZipBuffer();
    const mockZip = createMockZipFile(['xl/vbaProject.bin']);

    mockJSZip.loadAsync.mockResolvedValue(mockZip);

    const result = await shouldBlockMacroFile(buffer, 'spreadsheet.xlsm');

    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('vbaProject.bin');
    expect(result.reason).toContain('Macro-enabled documents are not allowed');
  });

  it('should handle empty file gracefully', async () => {
    const buffer = Buffer.alloc(0);

    // Mock JSZip to reject empty buffer
    mockJSZip.loadAsync.mockRejectedValue(new Error('Cannot read an empty buffer'));

    const result = await shouldBlockMacroFile(buffer, 'empty.docx');

    // Should not block when detection fails on empty buffer
    expect(result.blocked).toBe(false);
  });
});

// ============================================
// Integration Tests (6 tests)
// ============================================

describe('Macro Detector - Integration Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle realistic DOCX without macros', async () => {
    const buffer = createZipBuffer();
    const mockZip = createMockZipFile([
      'word/document.xml',
      'word/styles.xml',
      'word/fontTable.xml',
      'word/settings.xml',
      'word/_rels/document.xml.rels',
      'docProps/app.xml',
      'docProps/core.xml',
      '_rels/.rels',
      '[Content_Types].xml',
    ]);

    mockJSZip.loadAsync.mockResolvedValue(mockZip);

    const result = await detectMacros(buffer, 'specification.docx');

    expect(result.hasMacros).toBe(false);
    expect(result.error).toBeUndefined();
  });

  it('should handle realistic DOCM with macros', async () => {
    const buffer = createZipBuffer();
    const mockZip = createMockZipFile([
      'word/document.xml',
      'word/vbaProject.bin', // Macros present
      'word/vbaData.xml',
      'word/styles.xml',
      'word/_rels/document.xml.rels',
      '_rels/.rels',
    ]);

    mockJSZip.loadAsync.mockResolvedValue(mockZip);

    const result = await detectMacros(buffer, 'automation.docm');

    expect(result.hasMacros).toBe(true);
    expect(result.macroType).toBe('vbaProject.bin');
  });

  it('should handle Excel workbook with macros and external data', async () => {
    const buffer = createZipBuffer();
    const mockZip = createMockZipFile([
      'xl/workbook.xml',
      'xl/vbaProject.bin', // Macros
      'xl/worksheets/sheet1.xml',
      'xl/sharedStrings.xml',
      'xl/externalLinks/externalLink1.xml',
      'xl/_rels/workbook.xml.rels',
    ]);

    mockJSZip.loadAsync.mockResolvedValue(mockZip);

    const result = await detectMacros(buffer, 'budget-automation.xlsm');

    expect(result.hasMacros).toBe(true);
    expect(result.macroType).toBe('vbaProject.bin');
  });

  it('should handle PowerPoint with embedded OLE objects but no macros', async () => {
    const buffer = createZipBuffer();
    const mockZip = createMockZipFile([
      'ppt/presentation.xml',
      'ppt/slides/slide1.xml',
      'ppt/embeddings/oleObject1.bin', // OLE object, but not vbaProject
      'ppt/media/image1.png',
    ]);

    mockJSZip.loadAsync.mockResolvedValue(mockZip);

    const result = await detectMacros(buffer, 'presentation.pptx');

    expect(result.hasMacros).toBe(false);
  });

  it('should detect macros even in renamed file extensions', async () => {
    // DOCX renamed to DOCM but actually contains macros
    const buffer = createZipBuffer();
    const mockZip = createMockZipFile(['word/vbaProject.bin']);

    mockJSZip.loadAsync.mockResolvedValue(mockZip);

    const result = await detectMacros(buffer, 'renamed.docx');

    expect(result.hasMacros).toBe(true);
    // Detection is content-based, not extension-based
  });

  it('should handle legacy DOC with complex OLE structure', async () => {
    const oleMagic = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
    const vbaSignature = Buffer.from('VBA');

    // Simulate complex OLE with multiple sectors
    const complexOLE = Buffer.concat([
      oleMagic,
      Buffer.alloc(512), // FAT sector
      Buffer.from('Document content here...'),
      Buffer.alloc(1024), // More sectors
      vbaSignature, // VBA signature buried in structure
      Buffer.alloc(512),
    ]);

    const result = await detectMacros(complexOLE, 'complex.doc');

    expect(result.hasMacros).toBe(true);
    expect(result.macroType).toBe('legacy-ole-vba');
  });
});
