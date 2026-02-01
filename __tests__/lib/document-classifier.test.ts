import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mocks Setup - Must use vi.hoisted for mock objects
// ============================================

// Mock pdf-lib for getPdfPageCount function
const mockPDFDocument = vi.hoisted(() => ({
  load: vi.fn(),
  getPageCount: vi.fn(),
}));

vi.mock('pdf-lib', () => ({
  PDFDocument: mockPDFDocument,
}));

// Import functions after mocks
import {
  classifyDocument,
  getProcessorName,
  type ProcessorType,
  type DocumentClassification,
} from '@/lib/document-classifier';

// ============================================
// Image File Classification Tests (6 tests)
// ============================================

describe('Document Classifier - Image Files', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should classify JPG files as gpt-4o-vision with confidence 1.0', async () => {
    const result = await classifyDocument('site-photo.jpg', 'jpg');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(1.0);
    expect(result.reason).toBe('Image file - requires visual analysis');
  });

  it('should classify JPEG files as gpt-4o-vision with confidence 1.0', async () => {
    const result = await classifyDocument('progress-photo.jpeg', 'jpeg');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(1.0);
    expect(result.reason).toBe('Image file - requires visual analysis');
  });

  it('should classify PNG files as gpt-4o-vision with confidence 1.0', async () => {
    const result = await classifyDocument('screenshot.png', 'png');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(1.0);
    expect(result.reason).toBe('Image file - requires visual analysis');
  });

  it('should classify TIFF files as gpt-4o-vision with confidence 1.0', async () => {
    const result = await classifyDocument('scan.tiff', 'tiff');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(1.0);
    expect(result.reason).toBe('Image file - requires visual analysis');
  });

  it('should classify HEIC files as gpt-4o-vision with confidence 1.0', async () => {
    const result = await classifyDocument('iphone-photo.heic', 'heic');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(1.0);
    expect(result.reason).toBe('Image file - requires visual analysis');
  });

  it('should handle mixed case image file extensions', async () => {
    const result = await classifyDocument('PHOTO.JPG', 'jpg');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(1.0);
  });
});

// ============================================
// Text File Classification Tests (4 tests)
// ============================================

describe('Document Classifier - Text Files', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should classify TXT files as basic-ocr with confidence 1.0', async () => {
    const result = await classifyDocument('notes.txt', 'txt');

    expect(result.processorType).toBe('basic-ocr');
    expect(result.confidence).toBe(1.0);
    expect(result.reason).toBe('Simple text file');
  });

  it('should classify Markdown files as basic-ocr with confidence 1.0', async () => {
    const result = await classifyDocument('readme.md', 'md');

    expect(result.processorType).toBe('basic-ocr');
    expect(result.confidence).toBe(1.0);
    expect(result.reason).toBe('Simple text file');
  });

  it('should classify CSV files as basic-ocr with confidence 1.0', async () => {
    const result = await classifyDocument('budget-data.csv', 'csv');

    expect(result.processorType).toBe('basic-ocr');
    expect(result.confidence).toBe(1.0);
    expect(result.reason).toBe('Simple text file');
  });

  it('should handle mixed case text file extensions', async () => {
    const result = await classifyDocument('NOTES.TXT', 'txt');

    expect(result.processorType).toBe('basic-ocr');
    expect(result.confidence).toBe(1.0);
  });
});

// ============================================
// Word Document Classification Tests (3 tests)
// ============================================

describe('Document Classifier - Word Documents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should classify DOCX files as basic-ocr for RAG text extraction', async () => {
    const result = await classifyDocument('specifications.docx', 'docx');

    expect(result.processorType).toBe('basic-ocr');
    expect(result.confidence).toBe(1.0);
    expect(result.reason).toBe('Word document - text extraction for RAG system');
  });

  it('should classify DOC files as basic-ocr for RAG text extraction', async () => {
    const result = await classifyDocument('contract.doc', 'doc');

    expect(result.processorType).toBe('basic-ocr');
    expect(result.confidence).toBe(1.0);
    expect(result.reason).toBe('Word document - text extraction for RAG system');
  });

  it('should handle mixed case Word file extensions', async () => {
    const result = await classifyDocument('SPEC.DOCX', 'docx');

    expect(result.processorType).toBe('basic-ocr');
    expect(result.confidence).toBe(1.0);
  });
});

// ============================================
// Regulatory Document Classification Tests (15 tests)
// ============================================

describe('Document Classifier - Regulatory Documents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should classify ADA documents as claude-haiku-ocr with confidence 0.98', async () => {
    const result = await classifyDocument('ADA-Compliance-Guidelines.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.98);
    expect(result.reason).toBe('Regulatory/code document (text-heavy, no visual analysis needed)');
  });

  it('should classify IBC documents as claude-haiku-ocr', async () => {
    const result = await classifyDocument('IBC-2021-Code-Requirements.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.98);
  });

  it('should classify NFPA documents as claude-haiku-ocr', async () => {
    const result = await classifyDocument('NFPA-101-Life-Safety.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.98);
  });

  it('should classify building code documents as claude-haiku-ocr', async () => {
    const result = await classifyDocument('Building-Code-Reference.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.98);
  });

  it('should classify fire code documents as claude-haiku-ocr', async () => {
    const result = await classifyDocument('Fire-Code-Compliance.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.98);
  });

  it('should classify plumbing code documents as claude-haiku-ocr', async () => {
    const result = await classifyDocument('Plumbing-Code-Standards.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.98);
  });

  it('should classify electrical code documents as claude-haiku-ocr', async () => {
    const result = await classifyDocument('Electrical-Code-NEC.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.98);
  });

  it('should classify mechanical code documents as claude-haiku-ocr', async () => {
    const result = await classifyDocument('Mechanical-Code-IMC.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.98);
  });

  it('should classify zoning documents as claude-haiku-ocr', async () => {
    const result = await classifyDocument('Zoning-Ordinance.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.98);
  });

  it('should classify accessibility documents as claude-haiku-ocr', async () => {
    const result = await classifyDocument('Accessibility-Standards.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.98);
  });

  it('should classify energy code documents as claude-haiku-ocr', async () => {
    const result = await classifyDocument('Energy-Code-IECC.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.98);
  });

  it('should classify ASCE standards as claude-haiku-ocr', async () => {
    const result = await classifyDocument('ASCE-7-Wind-Loads.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.98);
  });

  it('should classify ASTM standards as claude-haiku-ocr', async () => {
    const result = await classifyDocument('ASTM-D1143-Testing.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.98);
  });

  it('should handle case-insensitive regulatory pattern matching', async () => {
    const result = await classifyDocument('ada-requirements.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.98);
  });

  it('should match regulatory patterns within filename', async () => {
    const result = await classifyDocument('Project-IBC-Compliance-Report.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.98);
  });
});

// ============================================
// Architectural Plan Classification Tests (10 tests)
// ============================================

describe('Document Classifier - Architectural Plans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should classify floor plan documents as gpt-4o-vision with confidence 0.95', async () => {
    const result = await classifyDocument('Floor-Plan-Level-1.pdf', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.95);
    expect(result.reason).toBe('Architectural/engineering plan with drawings');
  });

  it('should classify site plan documents as gpt-4o-vision', async () => {
    const result = await classifyDocument('Site-Plan-Main.pdf', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.95);
  });

  it('should classify elevation documents as gpt-4o-vision', async () => {
    const result = await classifyDocument('Building-Elevation-North.pdf', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.95);
  });

  it('should classify section documents as gpt-4o-vision', async () => {
    const result = await classifyDocument('Wall-Section-Detail.pdf', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.95);
  });

  it('should classify detail drawings as gpt-4o-vision', async () => {
    const result = await classifyDocument('Stair-Detail-1.pdf', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.95);
  });

  it('should classify architectural sheet numbers as gpt-4o-vision', async () => {
    const result = await classifyDocument('A-101-First-Floor.pdf', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.95);
  });

  it('should classify structural sheet numbers as gpt-4o-vision', async () => {
    const result = await classifyDocument('S-001-Foundation.pdf', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.95);
  });

  it('should classify mechanical drawings as gpt-4o-vision', async () => {
    const result = await classifyDocument('M-201-HVAC-Plan.pdf', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.95);
  });

  it('should classify electrical drawings as gpt-4o-vision', async () => {
    const result = await classifyDocument('E-301-Power-Plan.pdf', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.95);
  });

  it('should classify plumbing drawings as gpt-4o-vision', async () => {
    const result = await classifyDocument('P-101-Plumbing-Riser.pdf', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.95);
  });
});

// ============================================
// Schedule Document Classification Tests (8 tests)
// ============================================

describe('Document Classifier - Schedules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should classify door schedules as claude-haiku-ocr with confidence 0.95', async () => {
    const result = await classifyDocument('Door-Schedule.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.95);
    expect(result.reason).toBe('Schedule or equipment list (text-heavy table)');
  });

  it('should classify window schedules as claude-haiku-ocr', async () => {
    const result = await classifyDocument('Window-Schedule.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.95);
  });

  it('should classify equipment schedules as claude-haiku-ocr', async () => {
    const result = await classifyDocument('Equipment-Schedule-HVAC.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.95);
  });

  it('should classify finish schedules as claude-haiku-ocr', async () => {
    const result = await classifyDocument('Finish-Schedule.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.95);
  });

  it('should classify room schedules as claude-haiku-ocr', async () => {
    const result = await classifyDocument('Room-Schedule.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.95);
  });

  it('should classify fixture schedules as claude-haiku-ocr', async () => {
    const result = await classifyDocument('Fixture Schedule.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.95);
  });

  it('should classify lighting schedules as claude-haiku-ocr', async () => {
    const result = await classifyDocument('Lighting-Schedule.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.95);
  });

  it('should handle case-insensitive schedule pattern matching', async () => {
    const result = await classifyDocument('DOOR-SCHEDULE-FINAL.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.95);
  });
});

// ============================================
// Specification Document Classification Tests (7 tests)
// ============================================

describe('Document Classifier - Specifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should classify spec documents as claude-haiku-ocr with confidence 0.90', async () => {
    const result = await classifyDocument('Spec-Division-09.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.90);
    expect(result.reason).toBe('Specification or technical document (text-heavy)');
  });

  it('should classify full specification documents as claude-haiku-ocr', async () => {
    const result = await classifyDocument('Technical-Specification.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.90);
  });

  it('should classify submittal documents as claude-haiku-ocr', async () => {
    const result = await classifyDocument('Submittal-Package-HVAC.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.90);
  });

  it('should classify product data as claude-haiku-ocr', async () => {
    const result = await classifyDocument('Product Data.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.90);
  });

  it('should classify data sheets as claude-haiku-ocr', async () => {
    const result = await classifyDocument('DataSheet-Pumps.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.90);
  });

  it('should classify CSI division documents as claude-haiku-ocr', async () => {
    const result = await classifyDocument('CSI 09 Finishes.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.90);
  });

  it('should handle case-insensitive specification pattern matching', async () => {
    const result = await classifyDocument('technical-spec-final.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.90);
  });
});

// ============================================
// Site Photo Classification Tests (5 tests)
// ============================================

describe('Document Classifier - Site Photos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should classify site photos as gpt-4o-vision with confidence 0.90', async () => {
    const result = await classifyDocument('Site-Photo-Foundation.pdf', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.90);
    expect(result.reason).toBe('Site photo or progress documentation');
  });

  it('should classify progress reports as gpt-4o-vision', async () => {
    const result = await classifyDocument('Progress Report Week 12.pdf', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.90);
  });

  it('should classify progress photos as gpt-4o-vision', async () => {
    const result = await classifyDocument('Progress-Photo-20240115.pdf', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.90);
  });

  it('should classify inspection documents as gpt-4o-vision', async () => {
    const result = await classifyDocument('Inspection-Photos.pdf', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.90);
  });

  it('should handle case-insensitive photo pattern matching', async () => {
    const result = await classifyDocument('SITE-PHOTO-CONCRETE.pdf', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.90);
  });
});

// ============================================
// PDF Page Count Analysis Tests (8 tests)
// ============================================

describe('Document Classifier - PDF Page Count Analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should classify single-page PDFs as basic-ocr with confidence 0.70', async () => {
    const buffer = Buffer.from('mock-pdf-data');

    const mockDoc = {
      getPageCount: vi.fn().mockReturnValue(1),
    };
    mockPDFDocument.load.mockResolvedValue(mockDoc);

    const result = await classifyDocument('memo.pdf', 'pdf', buffer);

    expect(result.processorType).toBe('basic-ocr');
    expect(result.confidence).toBe(0.70);
    expect(result.reason).toBe('Single-page document (likely simple text)');
  });

  it('should classify multi-page documents with schedule keywords as claude-haiku-ocr', async () => {
    const buffer = Buffer.from('mock-pdf-data');

    const mockDoc = {
      getPageCount: vi.fn().mockReturnValue(15),
    };
    mockPDFDocument.load.mockResolvedValue(mockDoc);

    const result = await classifyDocument('Door Schedule.pdf', 'pdf', buffer);

    // Door Schedule matches the schedule pattern first (confidence 0.95)
    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.95);
    expect(result.reason).toBe('Schedule or equipment list (text-heavy table)');
  });

  it('should prioritize filename patterns over page count for architectural plans', async () => {
    const buffer = Buffer.from('mock-pdf-data');

    const mockDoc = {
      getPageCount: vi.fn().mockReturnValue(15),
    };
    mockPDFDocument.load.mockResolvedValue(mockDoc);

    const result = await classifyDocument('A-101-Floor-Plan.pdf', 'pdf', buffer);

    // Architectural pattern has higher priority than page count
    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.95);
  });

  it('should prioritize filename patterns over page count for regulatory docs', async () => {
    const buffer = Buffer.from('mock-pdf-data');

    const mockDoc = {
      getPageCount: vi.fn().mockReturnValue(1),
    };
    mockPDFDocument.load.mockResolvedValue(mockDoc);

    const result = await classifyDocument('ADA-Requirements.pdf', 'pdf', buffer);

    // Regulatory pattern has higher priority than single-page analysis
    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.98);
  });

  it('should handle PDF parsing errors gracefully and continue classification', async () => {
    const buffer = Buffer.from('invalid-pdf-data');

    mockPDFDocument.load.mockRejectedValue(new Error('Invalid PDF structure'));

    const result = await classifyDocument('unknown.pdf', 'pdf', buffer);

    // Should fallback to default vision classification
    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.60);
    expect(result.reason).toBe('Default to high-quality vision analysis');
  });

  it('should not analyze page count if buffer is not provided', async () => {
    const result = await classifyDocument('document.pdf', 'pdf');

    // Should use default classification without page analysis
    expect(mockPDFDocument.load).not.toHaveBeenCalled();
    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.60);
  });

  it('should detect multi-page schedule documents with "equipment" keyword', async () => {
    const buffer = Buffer.from('mock-pdf-data');

    const mockDoc = {
      getPageCount: vi.fn().mockReturnValue(12),
    };
    mockPDFDocument.load.mockResolvedValue(mockDoc);

    const result = await classifyDocument('equipment-list.pdf', 'pdf', buffer);

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.85);
  });

  it('should not apply multi-page schedule logic if page count is ≤10', async () => {
    const buffer = Buffer.from('mock-pdf-data');

    const mockDoc = {
      getPageCount: vi.fn().mockReturnValue(8),
    };
    mockPDFDocument.load.mockResolvedValue(mockDoc);

    const result = await classifyDocument('schedule keywords.pdf', 'pdf', buffer);

    // "schedule" keyword matches isSchedule() pattern, returns claude-haiku-ocr with 0.95
    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.95);
  });
});

// ============================================
// Default Classification Tests (5 tests)
// ============================================

describe('Document Classifier - Default Classification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should default to gpt-4o-vision for unmatched PDF filenames', async () => {
    const result = await classifyDocument('random-document.pdf', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.60);
    expect(result.reason).toBe('Default to high-quality vision analysis');
  });

  it('should default to gpt-4o-vision for unknown file types', async () => {
    const result = await classifyDocument('data.xlsx', 'xlsx');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.60);
    expect(result.reason).toBe('Default to high-quality vision analysis');
  });

  it('should handle empty filename gracefully', async () => {
    const result = await classifyDocument('', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.60);
  });

  it('should handle special characters in filename', async () => {
    const result = await classifyDocument('test@#$%.pdf', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.60);
  });

  it('should handle very long filenames', async () => {
    const longName = 'a'.repeat(500) + '.pdf';
    const result = await classifyDocument(longName, 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.60);
  });
});

// ============================================
// Priority and Precedence Tests (6 tests)
// ============================================

describe('Document Classifier - Classification Priority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should prioritize image file type over filename patterns', async () => {
    const result = await classifyDocument('door-schedule.jpg', 'jpg');

    // Image type should override schedule pattern
    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(1.0);
  });

  it('should prioritize text file type over filename patterns', async () => {
    const result = await classifyDocument('architectural-plan.txt', 'txt');

    // Text file type should override architectural pattern
    expect(result.processorType).toBe('basic-ocr');
    expect(result.confidence).toBe(1.0);
  });

  it('should prioritize regulatory patterns over other PDF patterns', async () => {
    const result = await classifyDocument('ADA-Floor-Plan.pdf', 'pdf');

    // Regulatory pattern (0.98 confidence) should win over architectural (0.95)
    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.98);
  });

  it('should prioritize architectural patterns over schedules', async () => {
    const result = await classifyDocument('A-101-Schedule.pdf', 'pdf');

    // Architectural pattern checked before schedule pattern
    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.95);
  });

  it('should prioritize schedules over specifications', async () => {
    const result = await classifyDocument('Door-Schedule-Specification.pdf', 'pdf');

    // Schedule pattern (0.95) checked before specification (0.90)
    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.95);
  });

  it('should prioritize specifications over site photos', async () => {
    const result = await classifyDocument('Submittal-Photo.pdf', 'pdf');

    // Specification pattern checked before site photo pattern
    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.90);
  });
});

// ============================================
// getProcessorName Tests (3 tests)
// ============================================

describe('Document Classifier - getProcessorName', () => {
  it('should return correct name for gpt-4o-vision processor', () => {
    const name = getProcessorName('gpt-4o-vision');
    expect(name).toBe('GPT-4o Vision (High Detail)');
  });

  it('should return correct name for claude-haiku-ocr processor', () => {
    const name = getProcessorName('claude-haiku-ocr');
    expect(name).toBe('Claude 3 Haiku + OCR (Text Analysis)');
  });

  it('should return correct name for basic-ocr processor', () => {
    const name = getProcessorName('basic-ocr');
    expect(name).toBe('Basic OCR (Simple Text)');
  });
});

// ============================================
// Edge Cases and Error Handling Tests (8 tests)
// ============================================

describe('Document Classifier - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle filename with no extension', async () => {
    const result = await classifyDocument('document', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.60);
  });

  it('should handle filename with multiple dots', async () => {
    const result = await classifyDocument('site.plan.v2.final.pdf', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.95);
  });

  it('should handle filename with dashes and underscores', async () => {
    const result = await classifyDocument('Door-Schedule-Final-Rev-2.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.95);
  });

  it('should handle mixed case in filename patterns', async () => {
    const result = await classifyDocument('FlOoR-pLaN-LeVeL-1.pdf', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.95);
  });

  it('should handle filenames with numbers only', async () => {
    const result = await classifyDocument('12345.pdf', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.60);
  });

  it('should handle filenames with unicode characters', async () => {
    const result = await classifyDocument('планы-здания.pdf', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.60);
  });

  it('should handle whitespace in filenames', async () => {
    const result = await classifyDocument('  Door Schedule  .pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.95);
  });

  it('should log errors when PDF parsing fails but continue classification', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const buffer = Buffer.from('corrupt-data');

    mockPDFDocument.load.mockRejectedValue(new Error('PDF parsing failed'));

    const result = await classifyDocument('test.pdf', 'pdf', buffer);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error analyzing PDF:', expect.any(Error));
    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.60);

    consoleErrorSpy.mockRestore();
  });
});

// ============================================
// Complex Filename Pattern Tests (10 tests)
// ============================================

describe('Document Classifier - Complex Filename Patterns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should match sheet numbers with lowercase letters (a-101)', async () => {
    const result = await classifyDocument('a-101-basement.pdf', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.95);
  });

  it('should match sheet numbers with uppercase letters (S-004)', async () => {
    const result = await classifyDocument('S-004-Structural-Detail.pdf', 'pdf');

    expect(result.processorType).toBe('gpt-4o-vision');
    expect(result.confidence).toBe(0.95);
  });

  it('should match CSI division numbers (csi-09)', async () => {
    const result = await classifyDocument('csi 09 specifications.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.90);
  });

  it('should match regulatory patterns with word boundaries', async () => {
    const result = await classifyDocument('ada-2010-standards.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.98);
  });

  it('should match compliance documents', async () => {
    const result = await classifyDocument('fire-safety-compliance-report.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.98);
  });

  it('should match life safety documents', async () => {
    const result = await classifyDocument('Life Safety Code Analysis.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.98);
  });

  it('should match ordinance documents', async () => {
    const result = await classifyDocument('Zoning Ordinance Summary.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.98);
  });

  it('should match hardware schedule documents', async () => {
    const result = await classifyDocument('hardware-schedule-doors.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.95);
  });

  it('should match material spec documents', async () => {
    const result = await classifyDocument('material-spec-concrete.pdf', 'pdf');

    expect(result.processorType).toBe('claude-haiku-ocr');
    expect(result.confidence).toBe(0.90);
  });

  it('should match multiple regulatory acronyms', async () => {
    const testCases = [
      { name: 'ieee-standard.pdf', type: 'claude-haiku-ocr' },
      { name: 'awwa-guidelines.pdf', type: 'claude-haiku-ocr' },
      { name: 'iecc-compliance.pdf', type: 'claude-haiku-ocr' },
    ];

    for (const testCase of testCases) {
      const result = await classifyDocument(testCase.name, 'pdf');
      expect(result.processorType).toBe(testCase.type);
      expect(result.confidence).toBe(0.98);
    }
  });
});
