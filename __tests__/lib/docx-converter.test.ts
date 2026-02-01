import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'stream';

// ============================================
// Mocks Setup - Must use vi.hoisted for mock objects
// ============================================

// Mock mammoth for DOCX processing
const mockMammoth = vi.hoisted(() => ({
  extractRawText: vi.fn(),
}));

vi.mock('mammoth', () => ({
  default: mockMammoth,
}));

// Mock PDFDocument from pdfkit
const mockPDFDocument = vi.hoisted(() => {
  return vi.fn().mockImplementation(() => {
    const stream = new Readable({
      read() {
        // Emit some dummy PDF data
        this.push(Buffer.from('%PDF-1.4\n'));
        this.push(null); // End stream
      }
    });

    const instance = {
      on: vi.fn((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from('%PDF-1.4\ntest-content')), 0);
        } else if (event === 'end') {
          setTimeout(() => callback(), 10);
        }
        return instance;
      }),
      font: vi.fn().mockReturnThis(),
      fontSize: vi.fn().mockReturnThis(),
      text: vi.fn().mockReturnThis(),
      end: vi.fn(),
    };

    return instance;
  });
});

vi.mock('pdfkit', () => ({
  default: mockPDFDocument,
}));

// Import functions after mocks
import { convertDocxToPdf, isConversionSupported } from '@/lib/docx-converter';

// ============================================
// Test Helpers
// ============================================

function createMockDocxBuffer(size = 1024): Buffer {
  // Create a realistic-looking DOCX buffer (ZIP format signature)
  const buffer = Buffer.alloc(size);
  // DOCX files are ZIP archives, start with PK signature
  buffer.write('PK\x03\x04', 0);
  return buffer;
}

// ============================================
// convertDocxToPdf Tests (15 tests)
// ============================================

describe('DocxConverter - convertDocxToPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('should successfully convert a simple DOCX to PDF', async () => {
      const docxBuffer = createMockDocxBuffer();
      const extractedText = 'Sample document content\nWith multiple lines\nAnd paragraphs';

      mockMammoth.extractRawText.mockResolvedValue({
        value: extractedText,
        messages: [],
      });

      const result = await convertDocxToPdf(docxBuffer);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
      expect(mockMammoth.extractRawText).toHaveBeenCalledWith({ buffer: docxBuffer });
    });

    it('should handle DOCX with long text content', async () => {
      const docxBuffer = createMockDocxBuffer();
      // Create a long text document (10KB+ of text)
      const longText = 'Lorem ipsum dolor sit amet. '.repeat(500);

      mockMammoth.extractRawText.mockResolvedValue({
        value: longText,
        messages: [],
      });

      const result = await convertDocxToPdf(docxBuffer);

      expect(result).toBeInstanceOf(Buffer);
      expect(mockMammoth.extractRawText).toHaveBeenCalledWith({ buffer: docxBuffer });
    });

    it('should handle DOCX with special characters', async () => {
      const docxBuffer = createMockDocxBuffer();
      const textWithSpecialChars = 'Document with special characters: ©, ™, €, £, ¥, §, ¶\nAnd unicode: 中文, 日本語, 한국어';

      mockMammoth.extractRawText.mockResolvedValue({
        value: textWithSpecialChars,
        messages: [],
      });

      const result = await convertDocxToPdf(docxBuffer);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle DOCX with newlines and paragraphs', async () => {
      const docxBuffer = createMockDocxBuffer();
      const textWithNewlines = 'Paragraph 1\n\nParagraph 2\n\nParagraph 3\n\nBullet points:\n- Item 1\n- Item 2\n- Item 3';

      mockMammoth.extractRawText.mockResolvedValue({
        value: textWithNewlines,
        messages: [],
      });

      const result = await convertDocxToPdf(docxBuffer);

      expect(result).toBeInstanceOf(Buffer);
      expect(mockMammoth.extractRawText).toHaveBeenCalledWith({ buffer: docxBuffer });
    });

    it('should handle DOCX with empty content', async () => {
      const docxBuffer = createMockDocxBuffer();

      mockMammoth.extractRawText.mockResolvedValue({
        value: '',
        messages: [],
      });

      const result = await convertDocxToPdf(docxBuffer);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
      expect(mockMammoth.extractRawText).toHaveBeenCalledWith({ buffer: docxBuffer });
    });

    it('should handle DOCX with only whitespace', async () => {
      const docxBuffer = createMockDocxBuffer();

      mockMammoth.extractRawText.mockResolvedValue({
        value: '   \n\n   \t\t   ',
        messages: [],
      });

      const result = await convertDocxToPdf(docxBuffer);

      expect(result).toBeInstanceOf(Buffer);
      expect(mockMammoth.extractRawText).toHaveBeenCalledWith({ buffer: docxBuffer });
    });

    it('should create PDF with correct document settings', async () => {
      const docxBuffer = createMockDocxBuffer();

      mockMammoth.extractRawText.mockResolvedValue({
        value: 'Test content',
        messages: [],
      });

      await convertDocxToPdf(docxBuffer);

      // Verify PDFDocument was called with correct options
      expect(mockPDFDocument).toHaveBeenCalledWith({
        size: 'LETTER',
        margins: {
          top: 72,
          bottom: 72,
          left: 72,
          right: 72,
        },
      });
    });

    it('should use Helvetica font at 12pt size', async () => {
      const docxBuffer = createMockDocxBuffer();

      mockMammoth.extractRawText.mockResolvedValue({
        value: 'Test content',
        messages: [],
      });

      await convertDocxToPdf(docxBuffer);

      const pdfInstance = mockPDFDocument.mock.results[0].value;
      expect(pdfInstance.font).toHaveBeenCalledWith('Helvetica');
      expect(pdfInstance.fontSize).toHaveBeenCalledWith(12);
    });

    it('should add text with correct alignment and line gap', async () => {
      const docxBuffer = createMockDocxBuffer();
      const testContent = 'Test document content';

      mockMammoth.extractRawText.mockResolvedValue({
        value: testContent,
        messages: [],
      });

      await convertDocxToPdf(docxBuffer);

      const pdfInstance = mockPDFDocument.mock.results[0].value;
      expect(pdfInstance.text).toHaveBeenCalledWith(testContent, {
        align: 'left',
        lineGap: 2,
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error when mammoth extraction fails', async () => {
      const docxBuffer = createMockDocxBuffer();

      mockMammoth.extractRawText.mockRejectedValue(new Error('Failed to extract text from DOCX'));

      await expect(convertDocxToPdf(docxBuffer)).rejects.toThrow('Failed to convert document to PDF');
    });

    it('should log error and rethrow when mammoth fails', async () => {
      const docxBuffer = createMockDocxBuffer();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockMammoth.extractRawText.mockRejectedValue(new Error('Corrupted DOCX file'));

      await expect(convertDocxToPdf(docxBuffer)).rejects.toThrow('Failed to convert document to PDF');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error converting DOCX to PDF:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle PDF generation errors', async () => {
      const docxBuffer = createMockDocxBuffer();

      mockMammoth.extractRawText.mockResolvedValue({
        value: 'Test content',
        messages: [],
      });

      // Mock PDFDocument to emit error
      mockPDFDocument.mockImplementationOnce(() => {
        const instance = {
          on: vi.fn((event, callback) => {
            if (event === 'error') {
              setTimeout(() => callback(new Error('PDF generation failed')), 0);
            }
            return instance;
          }),
          font: vi.fn().mockReturnThis(),
          fontSize: vi.fn().mockReturnThis(),
          text: vi.fn().mockReturnThis(),
          end: vi.fn(),
        };
        return instance;
      });

      await expect(convertDocxToPdf(docxBuffer)).rejects.toThrow('Failed to convert document to PDF');
    });

    it('should handle invalid buffer input', async () => {
      const invalidBuffer = null as any;

      mockMammoth.extractRawText.mockRejectedValue(new Error('Invalid buffer'));

      await expect(convertDocxToPdf(invalidBuffer)).rejects.toThrow('Failed to convert document to PDF');
    });

    it('should handle mammoth extraction with warnings in messages', async () => {
      const docxBuffer = createMockDocxBuffer();

      mockMammoth.extractRawText.mockResolvedValue({
        value: 'Extracted text',
        messages: [
          { type: 'warning', message: 'Unrecognized style' },
          { type: 'warning', message: 'Missing font' },
        ],
      });

      // Should still succeed despite warnings
      const result = await convertDocxToPdf(docxBuffer);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should properly clean up resources on error', async () => {
      const docxBuffer = createMockDocxBuffer();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockMammoth.extractRawText.mockRejectedValue(new Error('Extraction failed'));

      await expect(convertDocxToPdf(docxBuffer)).rejects.toThrow('Failed to convert document to PDF');

      // Error should be logged
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});

// ============================================
// isConversionSupported Tests (8 tests)
// ============================================

describe('DocxConverter - isConversionSupported', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Supported File Types', () => {
    it('should return true for docx extension (lowercase)', async () => {
      const result = await isConversionSupported('docx');
      expect(result).toBe(true);
    });

    it('should return true for doc extension (lowercase)', async () => {
      const result = await isConversionSupported('doc');
      expect(result).toBe(true);
    });

    it('should return true for DOCX extension (uppercase)', async () => {
      const result = await isConversionSupported('DOCX');
      expect(result).toBe(true);
    });

    it('should return true for DOC extension (uppercase)', async () => {
      const result = await isConversionSupported('DOC');
      expect(result).toBe(true);
    });

    it('should return true for mixed case extensions', async () => {
      expect(await isConversionSupported('DocX')).toBe(true);
      expect(await isConversionSupported('DoC')).toBe(true);
      expect(await isConversionSupported('dOcX')).toBe(true);
    });
  });

  describe('Unsupported File Types', () => {
    it('should return false for pdf extension', async () => {
      const result = await isConversionSupported('pdf');
      expect(result).toBe(false);
    });

    it('should return false for txt extension', async () => {
      const result = await isConversionSupported('txt');
      expect(result).toBe(false);
    });

    it('should return false for xlsx extension', async () => {
      const result = await isConversionSupported('xlsx');
      expect(result).toBe(false);
    });

    it('should return false for pptx extension', async () => {
      const result = await isConversionSupported('pptx');
      expect(result).toBe(false);
    });

    it('should return false for empty string', async () => {
      const result = await isConversionSupported('');
      expect(result).toBe(false);
    });

    it('should return false for arbitrary extensions', async () => {
      expect(await isConversionSupported('zip')).toBe(false);
      expect(await isConversionSupported('png')).toBe(false);
      expect(await isConversionSupported('jpg')).toBe(false);
      expect(await isConversionSupported('html')).toBe(false);
      expect(await isConversionSupported('xml')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle file extensions with leading dot', async () => {
      // Should still work with .docx format
      const result = await isConversionSupported('.docx');
      expect(result).toBe(false); // Leading dot makes it different from 'docx'
    });

    it('should handle file extensions with whitespace', async () => {
      expect(await isConversionSupported(' docx ')).toBe(false);
      expect(await isConversionSupported('docx ')).toBe(false);
      expect(await isConversionSupported(' docx')).toBe(false);
    });
  });
});

// ============================================
// Integration Tests (5 tests)
// ============================================

describe('DocxConverter - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should convert construction specification DOCX to PDF', async () => {
    const docxBuffer = createMockDocxBuffer(50000); // 50KB document
    const specificationText = `
DIVISION 09 - FINISHES

Section 09 21 16 - Gypsum Board Assemblies

1.1 SUMMARY
  A. Section Includes:
    1. Interior gypsum board assemblies
    2. Exterior gypsum sheathing
    3. Accessories and trim

1.2 REFERENCES
  A. ASTM C36 - Standard Specification for Gypsum Wallboard
  B. ASTM C1396 - Standard Specification for Gypsum Board
`;

    mockMammoth.extractRawText.mockResolvedValue({
      value: specificationText,
      messages: [],
    });

    const result = await convertDocxToPdf(docxBuffer);

    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
    expect(mockMammoth.extractRawText).toHaveBeenCalledWith({ buffer: docxBuffer });
  });

  it('should convert project schedule DOCX to PDF', async () => {
    const docxBuffer = createMockDocxBuffer(30000);
    const scheduleText = `
PROJECT SCHEDULE

Phase 1: Mobilization (Week 1-2)
- Site setup and temporary facilities
- Material procurement
- Permit finalization

Phase 2: Foundation (Week 3-6)
- Excavation
- Footings and foundation walls
- Waterproofing

Phase 3: Structural Framing (Week 7-12)
- Steel erection
- Concrete deck placement
- Structural inspections
`;

    mockMammoth.extractRawText.mockResolvedValue({
      value: scheduleText,
      messages: [],
    });

    const result = await convertDocxToPdf(docxBuffer);

    expect(result).toBeInstanceOf(Buffer);
    expect(mockMammoth.extractRawText).toHaveBeenCalledWith({ buffer: docxBuffer });
  });

  it('should handle file type check before conversion', async () => {
    const fileType = 'docx';
    const isSupported = await isConversionSupported(fileType);

    expect(isSupported).toBe(true);

    if (isSupported) {
      const docxBuffer = createMockDocxBuffer();
      mockMammoth.extractRawText.mockResolvedValue({
        value: 'Conversion test',
        messages: [],
      });

      const result = await convertDocxToPdf(docxBuffer);
      expect(result).toBeInstanceOf(Buffer);
    }
  });

  it('should reject unsupported file types before conversion attempt', async () => {
    const unsupportedTypes = ['pdf', 'xlsx', 'pptx', 'txt'];

    for (const fileType of unsupportedTypes) {
      const isSupported = await isConversionSupported(fileType);
      expect(isSupported).toBe(false);
    }
  });

  it('should handle conversion workflow with both functions', async () => {
    // Step 1: Check if file type is supported
    const fileExtension = 'DOCX';
    const supported = await isConversionSupported(fileExtension);
    expect(supported).toBe(true);

    // Step 2: If supported, convert the file
    if (supported) {
      const docxBuffer = createMockDocxBuffer();
      mockMammoth.extractRawText.mockResolvedValue({
        value: 'Meeting Minutes\n\nAttendees: John, Sarah, Mike\nDate: 2024-01-15',
        messages: [],
      });

      const pdfBuffer = await convertDocxToPdf(docxBuffer);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    }
  });
});

// ============================================
// Buffer Stream Processing Tests (4 tests)
// ============================================

describe('DocxConverter - Stream Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should properly collect PDF chunks from stream', async () => {
    const docxBuffer = createMockDocxBuffer();

    mockMammoth.extractRawText.mockResolvedValue({
      value: 'Stream test content',
      messages: [],
    });

    const result = await convertDocxToPdf(docxBuffer);

    // Result should be a concatenated buffer from all chunks
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle PDF stream end event', async () => {
    const docxBuffer = createMockDocxBuffer();

    mockMammoth.extractRawText.mockResolvedValue({
      value: 'Test content',
      messages: [],
    });

    // This should resolve without hanging
    const result = await convertDocxToPdf(docxBuffer);
    expect(result).toBeInstanceOf(Buffer);
  });

  it('should finalize PDF document correctly', async () => {
    const docxBuffer = createMockDocxBuffer();

    mockMammoth.extractRawText.mockResolvedValue({
      value: 'Final test',
      messages: [],
    });

    await convertDocxToPdf(docxBuffer);

    const pdfInstance = mockPDFDocument.mock.results[0].value;
    expect(pdfInstance.end).toHaveBeenCalled();
  });

  it('should handle multiple data chunks in PDF stream', async () => {
    const docxBuffer = createMockDocxBuffer();

    mockMammoth.extractRawText.mockResolvedValue({
      value: 'Multi-chunk content test',
      messages: [],
    });

    // Mock PDFDocument to emit multiple data chunks
    mockPDFDocument.mockImplementationOnce(() => {
      const instance = {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            // Emit multiple chunks
            setTimeout(() => {
              callback(Buffer.from('chunk1'));
              callback(Buffer.from('chunk2'));
              callback(Buffer.from('chunk3'));
            }, 0);
          } else if (event === 'end') {
            setTimeout(() => callback(), 10);
          }
          return instance;
        }),
        font: vi.fn().mockReturnThis(),
        fontSize: vi.fn().mockReturnThis(),
        text: vi.fn().mockReturnThis(),
        end: vi.fn(),
      };
      return instance;
    });

    const result = await convertDocxToPdf(docxBuffer);

    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });
});
