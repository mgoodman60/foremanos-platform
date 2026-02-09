import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks before imports
const mockPrisma = vi.hoisted(() => ({
  documentChunk: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mockAnalyzeWithMultiProvider = vi.hoisted(() => vi.fn());
const mockParseScaleString = vi.hoisted(() => vi.fn());
const mockClassifyDrawingWithPatterns = vi.hoisted(() => vi.fn());

// Mock all dependencies
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
}));
vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createScopedLogger: vi.fn(() => mockLogger),
}));
vi.mock('@/lib/vision-api-multi-provider', () => ({
  analyzeWithMultiProvider: mockAnalyzeWithMultiProvider,
}));
vi.mock('@/lib/scale-detector', () => ({
  parseScaleString: mockParseScaleString,
}));
vi.mock('@/lib/drawing-classifier', () => ({
  classifyDrawingWithPatterns: mockClassifyDrawingWithPatterns,
}));

// Import after mocks
import {
  DisciplineCode,
  extractTitleBlockWithVision,
  extractTitleBlockWithPatterns,
  extractTitleBlock,
  getDisciplineFromSheetNumber,
  getDisciplineName,
  storeTitleBlockData,
  getSheetIndex,
  isTitleBlockExtracted,
  getTitleBlockSummary,
} from '@/lib/title-block-extractor';

describe('title-block-extractor', () => {
  const mockTitleBlockData = {
    projectName: 'Office Building Renovation',
    projectNumber: 'PRJ-2024-001',
    sheetNumber: 'A-101',
    sheetTitle: 'First Floor Plan',
    dateIssued: '2024-01-15',
    revision: 'B',
    revisionDate: '2024-02-01',
    drawnBy: 'John Doe',
    checkedBy: 'Jane Smith',
    scale: '1/4"=1\'-0"',
    discipline: DisciplineCode.ARCHITECTURAL,
    confidence: 0.92,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma.documentChunk.findUnique.mockResolvedValue({
      id: 'chunk-123',
      content: 'Test content',
    });
    mockPrisma.documentChunk.update.mockResolvedValue({});
    mockParseScaleString.mockReturnValue({ ratio: 48, format: 'architectural' });
    mockClassifyDrawingWithPatterns.mockReturnValue({
      type: 'floor_plan',
      confidence: 0.9,
    });
  });

  describe('extractTitleBlockWithVision', () => {
    it('should extract title block data using vision API', async () => {
      mockAnalyzeWithMultiProvider.mockResolvedValue({
        success: true,
        content: JSON.stringify(mockTitleBlockData),
      });

      const result = await extractTitleBlockWithVision('base64data', 'Drawing A-101.pdf');

      expect(result.success).toBe(true);
      expect(result.data?.sheetNumber).toBe('A-101');
      expect(result.data?.discipline).toBe(DisciplineCode.ARCHITECTURAL);
      expect(result.confidence).toBe(0.92);
      expect(result.extractionMethod).toBe('vision');
    });

    it('should handle markdown wrapped JSON response', async () => {
      const jsonContent = JSON.stringify(mockTitleBlockData);
      mockAnalyzeWithMultiProvider.mockResolvedValue({
        success: true,
        content: `\`\`\`json\n${jsonContent}\n\`\`\``,
      });

      const result = await extractTitleBlockWithVision('base64data', 'test.pdf');

      expect(result.success).toBe(true);
      expect(result.data?.sheetNumber).toBe('A-101');
    });

    it('should handle plain JSON response', async () => {
      mockAnalyzeWithMultiProvider.mockResolvedValue({
        success: true,
        content: `{
          "sheetNumber": "S-201",
          "sheetTitle": "Foundation Plan",
          "discipline": "S",
          "confidence": 0.85
        }`,
      });

      const result = await extractTitleBlockWithVision('base64data', 'test.pdf');

      expect(result.success).toBe(true);
      expect(result.data?.sheetNumber).toBe('S-201');
    });

    it('should handle vision API failure', async () => {
      mockAnalyzeWithMultiProvider.mockResolvedValue({
        success: false,
        error: 'API error',
      });

      const result = await extractTitleBlockWithVision('base64data', 'test.pdf');

      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
      expect(result.confidence).toBe(0);
    });

    it('should handle missing JSON in response', async () => {
      mockAnalyzeWithMultiProvider.mockResolvedValue({
        success: true,
        content: 'No JSON here',
      });

      const result = await extractTitleBlockWithVision('base64data', 'test.pdf');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No JSON found');
    });

    it('should normalize extracted data', async () => {
      mockAnalyzeWithMultiProvider.mockResolvedValue({
        success: true,
        content: JSON.stringify({
          sheet_number: 'Sheet A-101',
          sheet_title: 'Floor Plan',
          project_name: 'Test Project',
          confidence: 0.88,
        }),
      });

      const result = await extractTitleBlockWithVision('base64data', 'test.pdf');

      expect(result.success).toBe(true);
      expect(result.data?.sheetNumber).toBe('A-101'); // Normalized
    });
  });

  describe('extractTitleBlockWithPatterns', () => {
    const sampleText = `
      PROJECT: Office Building Renovation
      SHEET NUMBER: A101
      SCALE: 1/4"=1'-0"
      DATE: 01/15/2024
      REVISION: B
    `;

    it('should extract title block using pattern matching', () => {
      const result = extractTitleBlockWithPatterns(sampleText, 'test.pdf');

      expect(result.success).toBe(true);
      expect(result.data?.sheetNumber).toBe('A101');
      expect(result.data?.scale).toContain('1/4"');
      expect(result.extractionMethod).toBe('pattern');
    });

    it('should handle various sheet number formats', () => {
      const validText = 'PROJECT: Test\nSheet No: A101\nDATE: 01/15/2024';
      const result = extractTitleBlockWithPatterns(validText, 'test.pdf');

      expect(result.success).toBe(true);
      expect(result.data?.sheetNumber).toBe('A101');
    });

    it('should extract discipline from sheet number', () => {
      const text = 'PROJECT: Test\nSHEET NUMBER: M401\nDATE: 01/15/2024';
      const result = extractTitleBlockWithPatterns(text, 'test.pdf');

      expect(result.success).toBe(true);
      expect(result.data?.discipline).toBe(DisciplineCode.MECHANICAL);
    });

    it('should handle various scale formats', () => {
      const validText = 'PROJECT: Test\nSHEET NUMBER: A101\nSCALE: 1/4"=1\'-0"\nDATE: 01/15/2024';
      const result = extractTitleBlockWithPatterns(validText, 'test.pdf');

      expect(result.success).toBe(true);
      expect(result.data?.scale).toContain('1/4"');
    });

    it('should handle various date formats', () => {
      const validText = 'PROJECT: Test\nSHEET NUMBER: A101\nDate: 01/15/2024';
      const result = extractTitleBlockWithPatterns(validText, 'test.pdf');

      expect(result.success).toBe(true);
      expect(result.data?.dateIssued).toContain('01');
    });

    it('should handle revision patterns', () => {
      const validText = 'PROJECT: Test\nSHEET NUMBER: A101\nRevision: B\nDATE: 01/15/2024';
      const result = extractTitleBlockWithPatterns(validText, 'test.pdf');

      expect(result.success).toBe(true);
      expect(result.data?.revision).toBe('B');
    });

    it('should fail if insufficient data extracted', () => {
      const result = extractTitleBlockWithPatterns('No useful data', 'test.pdf');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient data');
    });

    it('should calculate confidence based on fields found', () => {
      const fullText = `
        PROJECT: Test
        SHEET NUMBER: A101
        SCALE: 1/4"=1'-0"
        DATE: 01/15/2024
        REVISION: B
      `;

      const result = extractTitleBlockWithPatterns(fullText, 'test.pdf');

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(0.7); // Max for pattern matching
    });
  });

  describe('extractTitleBlock', () => {
    it('should use vision result if confidence is high', async () => {
      mockAnalyzeWithMultiProvider.mockResolvedValue({
        success: true,
        content: JSON.stringify({ ...mockTitleBlockData, confidence: 0.9 }),
      });

      const result = await extractTitleBlock('base64data', 'text content', 'test.pdf');

      expect(result.extractionMethod).toBe('vision');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should fallback to pattern matching if vision confidence is low', async () => {
      mockAnalyzeWithMultiProvider.mockResolvedValue({
        success: true,
        content: JSON.stringify({ ...mockTitleBlockData, confidence: 0.5 }),
      });

      const textWithPatterns = 'PROJECT: Test\nSHEET NUMBER: A101\nSCALE: 1/4"=1\'-0"\nDATE: 01/15/2024';
      const result = await extractTitleBlock('base64data', textWithPatterns, 'test.pdf');

      expect(result.success).toBe(true);
    });

    it('should return best attempt when both methods fail', async () => {
      mockAnalyzeWithMultiProvider.mockResolvedValue({
        success: false,
        error: 'Vision API error',
      });

      const result = await extractTitleBlock('base64data', 'No patterns', 'test.pdf');

      expect(result.success).toBe(false);
    });
  });

  describe('getDisciplineFromSheetNumber', () => {
    it('should extract discipline from sheet number prefix', () => {
      expect(getDisciplineFromSheetNumber('A-101')).toBe(DisciplineCode.ARCHITECTURAL);
      expect(getDisciplineFromSheetNumber('S-201')).toBe(DisciplineCode.STRUCTURAL);
      expect(getDisciplineFromSheetNumber('M-301')).toBe(DisciplineCode.MECHANICAL);
      expect(getDisciplineFromSheetNumber('E-401')).toBe(DisciplineCode.ELECTRICAL);
      expect(getDisciplineFromSheetNumber('P-501')).toBe(DisciplineCode.PLUMBING);
      expect(getDisciplineFromSheetNumber('FP-601')).toBe(DisciplineCode.FIRE_PROTECTION);
      expect(getDisciplineFromSheetNumber('C-701')).toBe(DisciplineCode.CIVIL);
      expect(getDisciplineFromSheetNumber('L-801')).toBe(DisciplineCode.LANDSCAPE);
      expect(getDisciplineFromSheetNumber('G-001')).toBe(DisciplineCode.GENERAL);
    });

    it('should be case insensitive', () => {
      expect(getDisciplineFromSheetNumber('a-101')).toBe(DisciplineCode.ARCHITECTURAL);
      expect(getDisciplineFromSheetNumber('m-301')).toBe(DisciplineCode.MECHANICAL);
    });

    it('should return UNKNOWN for unrecognized prefixes', () => {
      expect(getDisciplineFromSheetNumber('X-999')).toBe(DisciplineCode.UNKNOWN);
      expect(getDisciplineFromSheetNumber('123')).toBe(DisciplineCode.UNKNOWN);
      expect(getDisciplineFromSheetNumber('')).toBe(DisciplineCode.UNKNOWN);
    });
  });

  describe('getDisciplineName', () => {
    it('should return full discipline name', () => {
      expect(getDisciplineName(DisciplineCode.ARCHITECTURAL)).toBe('Architectural');
      expect(getDisciplineName(DisciplineCode.STRUCTURAL)).toBe('Structural');
      expect(getDisciplineName(DisciplineCode.MECHANICAL)).toBe('Mechanical');
      expect(getDisciplineName(DisciplineCode.UNKNOWN)).toBe('Unknown');
    });
  });

  describe('storeTitleBlockData', () => {
    it('should store title block data with scale information', async () => {
      await storeTitleBlockData('doc-123', 'chunk-123', mockTitleBlockData);

      expect(mockPrisma.documentChunk.update).toHaveBeenCalledWith({
        where: { id: 'chunk-123' },
        data: expect.objectContaining({
          titleBlockData: mockTitleBlockData,
          sheetNumber: 'A-101',
          revision: 'B',
          discipline: DisciplineCode.ARCHITECTURAL,
          primaryScale: '1/4"=1\'-0"',
          scaleRatio: 48,
        }),
      });
    });

    it('should classify drawing type', async () => {
      await storeTitleBlockData('doc-123', 'chunk-123', mockTitleBlockData);

      expect(mockClassifyDrawingWithPatterns).toHaveBeenCalledWith('A-101', 'First Floor Plan');
      expect(mockPrisma.documentChunk.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            drawingType: 'floor_plan',
            drawingTypeConfidence: 0.9,
          }),
        })
      );
    });

    it('should parse date issued', async () => {
      await storeTitleBlockData('doc-123', 'chunk-123', mockTitleBlockData);

      const updateCall = mockPrisma.documentChunk.update.mock.calls[0][0];
      expect(updateCall.data.dateIssued).toBeInstanceOf(Date);
    });

    it('should handle missing scale', async () => {
      const dataWithoutScale = { ...mockTitleBlockData, scale: '' };

      await storeTitleBlockData('doc-123', 'chunk-123', dataWithoutScale);

      const updateCall = mockPrisma.documentChunk.update.mock.calls[0][0];
      expect(updateCall.data.primaryScale).toBeNull();
    });

    it('should handle invalid scale', async () => {
      mockParseScaleString.mockReturnValue({ ratio: 0, format: 'unknown' });

      await storeTitleBlockData('doc-123', 'chunk-123', mockTitleBlockData);

      const updateCall = mockPrisma.documentChunk.update.mock.calls[0][0];
      expect(updateCall.data.scaleRatio).toBeNull();
    });

    it('should handle database errors', async () => {
      mockPrisma.documentChunk.update.mockRejectedValue(new Error('Database error'));

      await expect(
        storeTitleBlockData('doc-123', 'chunk-123', mockTitleBlockData)
      ).rejects.toThrow('Database error');

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getSheetIndex', () => {
    const mockProject = {
      id: 'project-123',
      slug: 'test-project',
      Document: [
        {
          id: 'doc-1',
          name: 'Architectural Plans.pdf',
          DocumentChunk: [
            {
              id: 'chunk-1',
              sheetNumber: 'A-101',
              revision: 'B',
              discipline: 'A',
              dateIssued: new Date('2024-01-15'),
              pageNumber: 1,
              titleBlockData: {
                sheetTitle: 'First Floor Plan',
              },
            },
            {
              id: 'chunk-2',
              sheetNumber: 'A-102',
              revision: 'A',
              discipline: 'A',
              dateIssued: new Date('2024-01-10'),
              pageNumber: 2,
              titleBlockData: {
                sheetTitle: 'Second Floor Plan',
              },
            },
          ],
        },
      ],
    };

    beforeEach(() => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);
    });

    it('should return sheet index for project', async () => {
      const index = await getSheetIndex('test-project');

      expect(index).toHaveLength(2);
      expect(index[0].sheetNumber).toBe('A-101');
      expect(index[0].sheetTitle).toBe('First Floor Plan');
      expect(index[0].documentId).toBe('doc-1');
    });

    it('should sort sheets by discipline and sheet number', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        ...mockProject,
        Document: [
          {
            id: 'doc-1',
            DocumentChunk: [
              { sheetNumber: 'S-201', discipline: 'S', titleBlockData: {} },
              { sheetNumber: 'A-101', discipline: 'A', titleBlockData: {} },
            ],
          },
        ],
      } as any);

      const index = await getSheetIndex('test-project');

      expect(index[0].discipline).toBe('A');
      expect(index[1].discipline).toBe('S');
    });

    it('should throw error if project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(getSheetIndex('nonexistent')).rejects.toThrow('Project not found');
    });

    it('should handle database errors', async () => {
      mockPrisma.project.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(getSheetIndex('test-project')).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('utility functions', () => {
    describe('isTitleBlockExtracted', () => {
      it('should return true if titleBlockData exists', () => {
        const chunk = { titleBlockData: { sheetNumber: 'A-101' } };
        expect(isTitleBlockExtracted(chunk)).toBe(true);
      });

      it('should return true if sheetNumber exists', () => {
        const chunk = { sheetNumber: 'A-101' };
        expect(isTitleBlockExtracted(chunk)).toBe(true);
      });

      it('should return false if neither exists', () => {
        const chunk = {};
        expect(isTitleBlockExtracted(chunk)).toBe(false);
      });
    });

    describe('getTitleBlockSummary', () => {
      it('should format summary with all fields', () => {
        const summary = getTitleBlockSummary(mockTitleBlockData);

        expect(summary).toContain('A-101');
        expect(summary).toContain('First Floor Plan');
        expect(summary).toContain('Rev B');
        expect(summary).toContain('1/4"=1\'-0"');
      });

      it('should handle missing optional fields', () => {
        const minimalData = {
          ...mockTitleBlockData,
          sheetTitle: '',
          scale: '',
        };

        const summary = getTitleBlockSummary(minimalData);

        expect(summary).toContain('A-101');
        expect(summary).toContain('Rev B');
      });
    });
  });
});
