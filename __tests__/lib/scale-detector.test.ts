import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// Mocks Setup - Using vi.hoisted pattern
// ============================================

const mockPrisma = vi.hoisted(() => ({
  documentChunk: {
    updateMany: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock analyzeWithMultiProvider (replaces direct fetch calls)
const mockAnalyzeWithMultiProvider = vi.hoisted(() => vi.fn());
vi.mock('@/lib/vision-api-multi-provider', () => ({
  analyzeWithMultiProvider: mockAnalyzeWithMultiProvider,
}));

import {
  detectScalesWithVision,
  extractScalesWithPatterns,
  parseScaleString,
  storeSheetScaleData,
  getSheetScaleData,
  validateProjectScales,
  getScaleStatistics,
  convertDrawingToRealWorld,
  DrawingScale,
  SheetScaleData,
  ScaleFormat,
} from '@/lib/scale-detector';

describe('ScaleDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('detectScalesWithVision', () => {
    // Helper: build a successful VisionResponse from analyzeWithMultiProvider
    function visionSuccess(content: string) {
      return {
        success: true,
        content,
        provider: 'claude-opus-4-6' as const,
        attempts: 1,
      };
    }

    // Helper: build a failed VisionResponse
    function visionFailure(error: string) {
      return {
        success: false,
        content: '',
        provider: 'claude-opus-4-6' as const,
        attempts: 3,
        error,
      };
    }

    it('should detect architectural scale from Vision API', async () => {
      const mockResponse = {
        scales: [
          {
            scaleString: '1/4"=1\'-0"',
            format: 'architectural',
            isMultiple: false,
            viewportName: null,
            confidence: 0.95,
          },
        ],
        extractedFrom: 'titleBlock',
        overallConfidence: 0.95,
      };

      mockAnalyzeWithMultiProvider.mockResolvedValueOnce(visionSuccess(JSON.stringify(mockResponse)));

      const result = await detectScalesWithVision('base64ImageData', 'A-101');

      expect(result.success).toBe(true);
      expect(result.scales).toHaveLength(1);
      expect(result.scales[0].scaleString).toBe('1/4"=1\'-0"');
      expect(result.scales[0].format).toBe('architectural');
      expect(result.scales[0].scaleRatio).toBe(48);
      expect(result.extractedFrom).toBe('titleBlock');
      expect(result.confidence).toBe(0.95);
    });

    it('should detect multiple scales from Vision API', async () => {
      const mockResponse = {
        scales: [
          {
            scaleString: '1/4"=1\'',
            format: 'architectural',
            isMultiple: true,
            viewportName: null,
            confidence: 0.95,
          },
          {
            scaleString: '1/8"=1\'',
            format: 'architectural',
            isMultiple: true,
            viewportName: 'DETAIL A',
            confidence: 0.90,
          },
        ],
        extractedFrom: 'titleBlock',
        overallConfidence: 0.92,
      };

      mockAnalyzeWithMultiProvider.mockResolvedValueOnce(visionSuccess(JSON.stringify(mockResponse)));

      const result = await detectScalesWithVision('base64ImageData');

      expect(result.success).toBe(true);
      expect(result.scales).toHaveLength(2);
      expect(result.scales[0].scaleRatio).toBe(48);
      expect(result.scales[1].scaleRatio).toBe(96);
      expect(result.scales[1].viewportName).toBe('DETAIL A');
    });

    it('should detect metric scales from Vision API', async () => {
      const mockResponse = {
        scales: [
          {
            scaleString: '1:100',
            format: 'metric',
            isMultiple: false,
            viewportName: null,
            confidence: 0.95,
          },
        ],
        extractedFrom: 'titleBlock',
        overallConfidence: 0.95,
      };

      mockAnalyzeWithMultiProvider.mockResolvedValueOnce(visionSuccess(JSON.stringify(mockResponse)));

      const result = await detectScalesWithVision('base64ImageData');

      expect(result.success).toBe(true);
      expect(result.scales[0].format).toBe('metric');
      expect(result.scales[0].scaleRatio).toBe(100);
    });

    it('should detect engineering scales from Vision API', async () => {
      const mockResponse = {
        scales: [
          {
            scaleString: '1"=10\'',
            format: 'engineering',
            isMultiple: false,
            viewportName: null,
            confidence: 0.90,
          },
        ],
        extractedFrom: 'titleBlock',
        overallConfidence: 0.90,
      };

      mockAnalyzeWithMultiProvider.mockResolvedValueOnce(visionSuccess(JSON.stringify(mockResponse)));

      const result = await detectScalesWithVision('base64ImageData');

      expect(result.success).toBe(true);
      expect(result.scales[0].format).toBe('engineering');
      expect(result.scales[0].scaleRatio).toBe(120);
    });

    it('should handle NTS (Not To Scale) detection', async () => {
      const mockResponse = {
        scales: [
          {
            scaleString: 'NTS',
            format: 'custom',
            isMultiple: false,
            viewportName: null,
            confidence: 1.0,
          },
        ],
        extractedFrom: 'annotation',
        overallConfidence: 1.0,
      };

      mockAnalyzeWithMultiProvider.mockResolvedValueOnce(visionSuccess(JSON.stringify(mockResponse)));

      const result = await detectScalesWithVision('base64ImageData');

      expect(result.success).toBe(true);
      expect(result.scales[0].scaleString).toBe('NTS');
      expect(result.scales[0].scaleRatio).toBe(0);
      expect(result.scales[0].format).toBe('custom');
    });

    it('should handle AS NOTED detection', async () => {
      const mockResponse = {
        scales: [
          {
            scaleString: 'AS NOTED',
            format: 'custom',
            isMultiple: false,
            viewportName: null,
            confidence: 1.0,
          },
        ],
        extractedFrom: 'annotation',
        overallConfidence: 1.0,
      };

      mockAnalyzeWithMultiProvider.mockResolvedValueOnce(visionSuccess(JSON.stringify(mockResponse)));

      const result = await detectScalesWithVision('base64ImageData');

      expect(result.success).toBe(true);
      expect(result.scales[0].scaleString).toBe('AS NOTED');
      expect(result.scales[0].scaleRatio).toBe(0);
    });

    it('should handle all providers failing', async () => {
      mockAnalyzeWithMultiProvider.mockResolvedValueOnce(visionFailure('All providers failed'));

      const result = await detectScalesWithVision('base64ImageData');

      expect(result.success).toBe(false);
      expect(result.scales).toHaveLength(0);
      expect(result.confidence).toBe(0);
    });

    it('should handle API error response', async () => {
      mockAnalyzeWithMultiProvider.mockResolvedValueOnce(visionFailure('Server error: 500'));

      const result = await detectScalesWithVision('base64ImageData');

      expect(result.success).toBe(false);
      expect(result.scales).toHaveLength(0);
      expect(result.confidence).toBe(0);
    });

    it('should handle empty content in response', async () => {
      mockAnalyzeWithMultiProvider.mockResolvedValueOnce(visionSuccess(''));

      const result = await detectScalesWithVision('base64ImageData');

      expect(result.success).toBe(false);
      expect(result.scales).toHaveLength(0);
    });

    it('should handle invalid JSON in response', async () => {
      mockAnalyzeWithMultiProvider.mockResolvedValueOnce(visionSuccess('Not valid JSON content'));

      const result = await detectScalesWithVision('base64ImageData');

      expect(result.success).toBe(false);
      expect(result.scales).toHaveLength(0);
    });

    it('should handle network errors', async () => {
      mockAnalyzeWithMultiProvider.mockRejectedValueOnce(new Error('Network error'));

      const result = await detectScalesWithVision('base64ImageData');

      expect(result.success).toBe(false);
      expect(result.scales).toHaveLength(0);
      expect(result.confidence).toBe(0);
    });

    it('should handle empty scales array from API', async () => {
      const mockResponse = {
        scales: [],
        extractedFrom: 'titleBlock',
        overallConfidence: 0.0,
      };

      mockAnalyzeWithMultiProvider.mockResolvedValueOnce(visionSuccess(JSON.stringify(mockResponse)));

      const result = await detectScalesWithVision('base64ImageData');

      expect(result.success).toBe(true);
      expect(result.scales).toHaveLength(0);
      expect(result.confidence).toBe(0.0);
    });
  });

  describe('extractScalesWithPatterns', () => {
    it('should extract architectural scales from text', () => {
      const text = 'SCALE: 1/4"=1\'-0"';
      const scales = extractScalesWithPatterns(text);

      expect(scales).toHaveLength(1);
      expect(scales[0].scaleString).toBe('1/4"=1\'-0"');
      expect(scales[0].format).toBe('architectural');
      expect(scales[0].scaleRatio).toBe(48);
      expect(scales[0].confidence).toBe(0.8);
    });

    it('should extract multiple architectural scales', () => {
      const text = 'PRIMARY SCALE: 1/4"=1\'-0" DETAIL SCALE: 1/8"=1\'-0"';
      const scales = extractScalesWithPatterns(text);

      expect(scales.length).toBeGreaterThanOrEqual(2);
      expect(scales.some((s) => s.scaleRatio === 48)).toBe(true);
      expect(scales.some((s) => s.scaleRatio === 96)).toBe(true);
    });

    it('should extract engineering scales from text', () => {
      const text = 'SCALE: 1"=10\'';
      const scales = extractScalesWithPatterns(text);

      expect(scales).toHaveLength(1);
      expect(scales[0].format).toBe('engineering');
      expect(scales[0].scaleRatio).toBe(120);
    });

    it('should extract metric scales from text', () => {
      const text = 'SCALE: 1:100';
      const scales = extractScalesWithPatterns(text);

      expect(scales).toHaveLength(1);
      expect(scales[0].format).toBe('metric');
      expect(scales[0].scaleRatio).toBe(100);
    });

    it('should extract multiple metric scales', () => {
      const text = 'PLAN: 1:100 DETAIL: 1:50';
      const scales = extractScalesWithPatterns(text);

      expect(scales.length).toBeGreaterThanOrEqual(2);
      expect(scales.some((s) => s.scaleRatio === 100)).toBe(true);
      expect(scales.some((s) => s.scaleRatio === 50)).toBe(true);
    });

    it('should detect NTS (Not To Scale)', () => {
      const text = 'SCALE: NTS';
      const scales = extractScalesWithPatterns(text);

      expect(scales.some((s) => s.scaleString === 'NTS')).toBe(true);
      expect(scales.some((s) => s.scaleRatio === 0)).toBe(true);
      expect(scales.some((s) => s.format === 'custom')).toBe(true);
      expect(scales.some((s) => s.confidence === 1.0)).toBe(true);
    });

    it('should detect NOT TO SCALE (case insensitive)', () => {
      const text = 'Not to Scale';
      const scales = extractScalesWithPatterns(text);

      expect(scales.some((s) => s.scaleString === 'NTS')).toBe(true);
      expect(scales.some((s) => s.scaleRatio === 0)).toBe(true);
    });

    it('should detect AS NOTED', () => {
      const text = 'SCALE: AS NOTED';
      const scales = extractScalesWithPatterns(text);

      expect(scales.some((s) => s.scaleString === 'AS NOTED')).toBe(true);
      expect(scales.some((s) => s.scaleRatio === 0)).toBe(true);
      expect(scales.some((s) => s.format === 'custom')).toBe(true);
    });

    it('should handle text with no scales', () => {
      const text = 'This is just some random text without scales';
      const scales = extractScalesWithPatterns(text);

      expect(scales).toHaveLength(0);
    });

    it('should extract 3/16" scale', () => {
      const text = 'SCALE: 3/16"=1\'-0"';
      const scales = extractScalesWithPatterns(text);

      expect(scales).toHaveLength(1);
      expect(scales[0].scaleRatio).toBe(64);
    });

    it('should extract 3/8" scale', () => {
      const text = 'SCALE: 3/8"=1\'';
      const scales = extractScalesWithPatterns(text);

      expect(scales).toHaveLength(1);
      expect(scales[0].scaleRatio).toBe(32);
    });

    it('should extract 1" scale', () => {
      const text = 'SCALE: 1"=1\'';
      const scales = extractScalesWithPatterns(text);

      expect(scales).toHaveLength(1);
      expect(scales[0].scaleRatio).toBe(12);
    });

    it('should handle whitespace variations', () => {
      const text = 'SCALE:   1/4"   =   1\'-0"';
      const scales = extractScalesWithPatterns(text);

      expect(scales).toHaveLength(1);
      expect(scales[0].scaleRatio).toBe(48);
    });

    it('should extract engineering scale 1"=50\'', () => {
      const text = 'SCALE: 1"=50\'';
      const scales = extractScalesWithPatterns(text);

      expect(scales).toHaveLength(1);
      expect(scales[0].scaleRatio).toBe(600);
    });

    it('should extract metric scale 1:200', () => {
      const text = 'SCALE: 1:200';
      const scales = extractScalesWithPatterns(text);

      expect(scales).toHaveLength(1);
      expect(scales[0].scaleRatio).toBe(200);
    });
  });

  describe('parseScaleString', () => {
    it('should parse architectural scale 1/4"=1\'', () => {
      const result = parseScaleString('1/4"=1\'');

      expect(result.ratio).toBe(48);
      expect(result.format).toBe('architectural');
    });

    it('should parse architectural scale 1/8"=1\'-0"', () => {
      const result = parseScaleString('1/8"=1\'-0"');

      expect(result.ratio).toBe(96);
      expect(result.format).toBe('architectural');
    });

    it('should parse architectural scale 3/16"=1\'', () => {
      const result = parseScaleString('3/16"=1\'');

      expect(result.ratio).toBe(64);
      expect(result.format).toBe('architectural');
    });

    it('should parse engineering scale 1"=10\'', () => {
      const result = parseScaleString('1"=10\'');

      expect(result.ratio).toBe(120);
      expect(result.format).toBe('engineering');
    });

    it('should parse engineering scale 1"=50\'', () => {
      const result = parseScaleString('1"=50\'');

      expect(result.ratio).toBe(600);
      expect(result.format).toBe('engineering');
    });

    it('should parse metric scale 1:100', () => {
      const result = parseScaleString('1:100');

      expect(result.ratio).toBe(100);
      expect(result.format).toBe('metric');
    });

    it('should parse metric scale 1:50', () => {
      const result = parseScaleString('1:50');

      expect(result.ratio).toBe(50);
      expect(result.format).toBe('metric');
    });

    it('should handle NTS', () => {
      const result = parseScaleString('NTS');

      expect(result.ratio).toBe(0);
      expect(result.format).toBe('custom');
    });

    it('should handle NOT TO SCALE', () => {
      const result = parseScaleString('NOT TO SCALE');

      expect(result.ratio).toBe(0);
      expect(result.format).toBe('custom');
    });

    it('should handle AS NOTED', () => {
      const result = parseScaleString('AS NOTED');

      expect(result.ratio).toBe(0);
      expect(result.format).toBe('custom');
    });

    it('should handle case insensitivity', () => {
      const result = parseScaleString('as noted');

      expect(result.ratio).toBe(0);
      expect(result.format).toBe('custom');
    });

    it('should handle custom architectural format', () => {
      const result = parseScaleString('1/4"=1\'');

      expect(result.ratio).toBe(48);
      expect(result.format).toBe('architectural');
    });

    it('should return custom format for unknown scales', () => {
      const result = parseScaleString('UNKNOWN SCALE');

      expect(result.ratio).toBe(0);
      expect(result.format).toBe('custom');
    });

    it('should handle whitespace', () => {
      const result = parseScaleString('  1:100  ');

      expect(result.ratio).toBe(100);
      expect(result.format).toBe('metric');
    });

    it('should parse 1"=1\' scale', () => {
      const result = parseScaleString('1"=1\'');

      expect(result.ratio).toBe(12);
      expect(result.format).toBe('architectural');
    });

    it('should parse 1/16"=1\' scale', () => {
      const result = parseScaleString('1/16"=1\'');

      expect(result.ratio).toBe(192);
      expect(result.format).toBe('architectural');
    });

    it('should parse 1:1000 metric scale', () => {
      const result = parseScaleString('1:1000');

      expect(result.ratio).toBe(1000);
      expect(result.format).toBe('metric');
    });
  });

  describe('storeSheetScaleData', () => {
    it('should store scale data successfully', async () => {
      const scaleData: SheetScaleData = {
        sheetNumber: 'A-101',
        primaryScale: {
          scaleString: '1/4"=1\'',
          scaleRatio: 48,
          format: 'architectural' as ScaleFormat,
          isMultiple: false,
          confidence: 0.95,
        },
        hasMultipleScales: false,
        scaleCount: 1,
        extractedFrom: 'titleBlock',
        confidence: 0.95,
      };

      mockPrisma.documentChunk.updateMany.mockResolvedValueOnce({ count: 1 });

      await storeSheetScaleData('project-id', 'doc-id', 'A-101', scaleData);

      expect(mockPrisma.documentChunk.updateMany).toHaveBeenCalledWith({
        where: {
          Document: { projectId: 'project-id' },
          sheetNumber: 'A-101',
        },
        data: {
          scaleData: scaleData as any,
        },
      });
    });

    it('should store scale data with multiple scales', async () => {
      const scaleData: SheetScaleData = {
        sheetNumber: 'A-201',
        primaryScale: {
          scaleString: '1/4"=1\'',
          scaleRatio: 48,
          format: 'architectural' as ScaleFormat,
          isMultiple: true,
          confidence: 0.95,
        },
        secondaryScales: [
          {
            scaleString: '1/8"=1\'',
            scaleRatio: 96,
            format: 'architectural' as ScaleFormat,
            isMultiple: true,
            viewportName: 'DETAIL A',
            confidence: 0.90,
          },
        ],
        hasMultipleScales: true,
        scaleCount: 2,
        extractedFrom: 'titleBlock',
        confidence: 0.92,
      };

      mockPrisma.documentChunk.updateMany.mockResolvedValueOnce({ count: 1 });

      await storeSheetScaleData('project-id', 'doc-id', 'A-201', scaleData);

      expect(mockPrisma.documentChunk.updateMany).toHaveBeenCalledWith({
        where: {
          Document: { projectId: 'project-id' },
          sheetNumber: 'A-201',
        },
        data: {
          scaleData: scaleData as any,
        },
      });
    });
  });

  describe('getSheetScaleData', () => {
    it('should retrieve scale data successfully', async () => {
      const mockScaleData: SheetScaleData = {
        sheetNumber: 'A-101',
        primaryScale: {
          scaleString: '1/4"=1\'',
          scaleRatio: 48,
          format: 'architectural' as ScaleFormat,
          isMultiple: false,
          confidence: 0.95,
        },
        hasMultipleScales: false,
        scaleCount: 1,
        extractedFrom: 'titleBlock',
        confidence: 0.95,
      };

      mockPrisma.documentChunk.findFirst.mockResolvedValueOnce({
        scaleData: mockScaleData,
      });

      const result = await getSheetScaleData('project-id', 'A-101');

      expect(result).toEqual(mockScaleData);
      expect(mockPrisma.documentChunk.findFirst).toHaveBeenCalledWith({
        where: {
          Document: { projectId: 'project-id' },
          sheetNumber: 'A-101',
        },
        select: {
          scaleData: true,
        },
      });
    });

    it('should return null when no scale data exists', async () => {
      mockPrisma.documentChunk.findFirst.mockResolvedValueOnce(null);

      const result = await getSheetScaleData('project-id', 'A-101');

      expect(result).toBeNull();
    });

    it('should return null when chunk exists but no scale data', async () => {
      mockPrisma.documentChunk.findFirst.mockResolvedValueOnce({
        scaleData: null,
      });

      const result = await getSheetScaleData('project-id', 'A-101');

      expect(result).toBeNull();
    });
  });

  describe('validateProjectScales', () => {
    it('should validate project with all sheets having scales', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({ id: 'project-id' });

      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
        {
          sheetNumber: 'A-101',
          scaleData: {
            sheetNumber: 'A-101',
            primaryScale: {
              scaleString: '1/4"=1\'',
              scaleRatio: 48,
              format: 'architectural',
              isMultiple: false,
              confidence: 0.95,
            },
            hasMultipleScales: false,
            scaleCount: 1,
            extractedFrom: 'titleBlock',
            confidence: 0.95,
          },
        },
        {
          sheetNumber: 'A-201',
          scaleData: {
            sheetNumber: 'A-201',
            primaryScale: {
              scaleString: '1/8"=1\'',
              scaleRatio: 96,
              format: 'architectural',
              isMultiple: false,
              confidence: 0.90,
            },
            hasMultipleScales: false,
            scaleCount: 1,
            extractedFrom: 'titleBlock',
            confidence: 0.90,
          },
        },
      ]);

      const result = await validateProjectScales('test-project');

      expect(result.totalSheets).toBe(2);
      expect(result.sheetsWithScales).toBe(2);
      expect(result.sheetsWithoutScales).toBe(0);
      expect(result.sheetsWithMultipleScales).toBe(0);
      expect(result.issues).toHaveLength(0);
    });

    it('should identify sheets without scales', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({ id: 'project-id' });

      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
        {
          sheetNumber: 'A-101',
          scaleData: null,
        },
      ]);

      const result = await validateProjectScales('test-project');

      expect(result.totalSheets).toBe(1);
      expect(result.sheetsWithScales).toBe(0);
      expect(result.sheetsWithoutScales).toBe(1);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].issueType).toBe('missing');
      expect(result.issues[0].severity).toBe('high');
    });

    it('should identify sheets with multiple scales', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({ id: 'project-id' });

      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
        {
          sheetNumber: 'A-101',
          scaleData: {
            sheetNumber: 'A-101',
            primaryScale: {
              scaleString: '1/4"=1\'',
              scaleRatio: 48,
              format: 'architectural',
              isMultiple: true,
              confidence: 0.95,
            },
            hasMultipleScales: true,
            scaleCount: 3,
            extractedFrom: 'titleBlock',
            confidence: 0.92,
          },
        },
      ]);

      const result = await validateProjectScales('test-project');

      expect(result.sheetsWithMultipleScales).toBe(1);
      expect(result.issues.some((i) => i.issueType === 'multiple')).toBe(true);
      expect(result.issues.some((i) => i.severity === 'low')).toBe(true);
    });

    it('should identify unusual scale ratios (very large)', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({ id: 'project-id' });

      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
        {
          sheetNumber: 'A-101',
          scaleData: {
            sheetNumber: 'A-101',
            primaryScale: {
              scaleString: '1:5',
              scaleRatio: 5,
              format: 'metric',
              isMultiple: false,
              confidence: 0.95,
            },
            hasMultipleScales: false,
            scaleCount: 1,
            extractedFrom: 'titleBlock',
            confidence: 0.95,
          },
        },
      ]);

      const result = await validateProjectScales('test-project');

      expect(result.issues.some((i) => i.issueType === 'unusual')).toBe(true);
      expect(result.issues.some((i) => i.severity === 'medium')).toBe(true);
      expect(result.issues.some((i) => i.description.includes('very large scale'))).toBe(true);
    });

    it('should identify unusual scale ratios (very small)', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({ id: 'project-id' });

      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
        {
          sheetNumber: 'A-101',
          scaleData: {
            sheetNumber: 'A-101',
            primaryScale: {
              scaleString: '1:2500',
              scaleRatio: 2500,
              format: 'metric',
              isMultiple: false,
              confidence: 0.95,
            },
            hasMultipleScales: false,
            scaleCount: 1,
            extractedFrom: 'titleBlock',
            confidence: 0.95,
          },
        },
      ]);

      const result = await validateProjectScales('test-project');

      expect(result.issues.some((i) => i.issueType === 'unusual')).toBe(true);
      expect(result.issues.some((i) => i.description.includes('very small scale'))).toBe(true);
    });

    it('should handle project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce(null);

      await expect(validateProjectScales('non-existent-project')).rejects.toThrow(
        'Project not found'
      );
    });

    it('should handle multiple chunks for same sheet', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({ id: 'project-id' });

      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
        {
          sheetNumber: 'A-101',
          scaleData: {
            sheetNumber: 'A-101',
            primaryScale: {
              scaleString: '1/4"=1\'',
              scaleRatio: 48,
              format: 'architectural',
              isMultiple: false,
              confidence: 0.95,
            },
            hasMultipleScales: false,
            scaleCount: 1,
            extractedFrom: 'titleBlock',
            confidence: 0.95,
          },
        },
        {
          sheetNumber: 'A-101',
          scaleData: {
            sheetNumber: 'A-101',
            primaryScale: {
              scaleString: '1/4"=1\'',
              scaleRatio: 48,
              format: 'architectural',
              isMultiple: false,
              confidence: 0.95,
            },
            hasMultipleScales: false,
            scaleCount: 1,
            extractedFrom: 'titleBlock',
            confidence: 0.95,
          },
        },
      ]);

      const result = await validateProjectScales('test-project');

      // Should count only unique sheets
      expect(result.totalSheets).toBe(1);
      expect(result.sheetsWithScales).toBe(1);
    });
  });

  describe('getScaleStatistics', () => {
    it('should calculate statistics correctly', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({ id: 'project-id' });

      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
        {
          sheetNumber: 'A-101',
          scaleData: {
            sheetNumber: 'A-101',
            primaryScale: {
              scaleString: '1/4"=1\'',
              scaleRatio: 48,
              format: 'architectural',
              isMultiple: false,
              confidence: 0.95,
            },
            hasMultipleScales: false,
            scaleCount: 1,
            extractedFrom: 'titleBlock',
            confidence: 0.95,
          },
        },
        {
          sheetNumber: 'A-201',
          scaleData: {
            sheetNumber: 'A-201',
            primaryScale: {
              scaleString: '1/4"=1\'',
              scaleRatio: 48,
              format: 'architectural',
              isMultiple: false,
              confidence: 0.90,
            },
            hasMultipleScales: false,
            scaleCount: 1,
            extractedFrom: 'titleBlock',
            confidence: 0.90,
          },
        },
      ]);

      const result = await getScaleStatistics('test-project');

      expect(result.totalSheets).toBe(2);
      expect(result.coverage).toBe(100);
      expect(result.avgConfidence).toBe(92.5);
      expect(result.scaleDistribution['1/4"=1\'']).toBe(2);
      expect(result.formatDistribution.architectural).toBe(2);
    });

    it('should handle sheets without scale data', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({ id: 'project-id' });

      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
        {
          sheetNumber: 'A-101',
          scaleData: {
            sheetNumber: 'A-101',
            primaryScale: {
              scaleString: '1/4"=1\'',
              scaleRatio: 48,
              format: 'architectural',
              isMultiple: false,
              confidence: 0.95,
            },
            hasMultipleScales: false,
            scaleCount: 1,
            extractedFrom: 'titleBlock',
            confidence: 0.95,
          },
        },
        {
          sheetNumber: 'A-201',
          scaleData: null,
        },
      ]);

      const result = await getScaleStatistics('test-project');

      expect(result.totalSheets).toBe(2);
      expect(result.coverage).toBe(50);
      expect(result.avgConfidence).toBe(95);
    });

    it('should handle mixed scale formats', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({ id: 'project-id' });

      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
        {
          sheetNumber: 'A-101',
          scaleData: {
            sheetNumber: 'A-101',
            primaryScale: {
              scaleString: '1/4"=1\'',
              scaleRatio: 48,
              format: 'architectural',
              isMultiple: false,
              confidence: 0.95,
            },
            hasMultipleScales: false,
            scaleCount: 1,
            extractedFrom: 'titleBlock',
            confidence: 0.95,
          },
        },
        {
          sheetNumber: 'C-101',
          scaleData: {
            sheetNumber: 'C-101',
            primaryScale: {
              scaleString: '1"=10\'',
              scaleRatio: 120,
              format: 'engineering',
              isMultiple: false,
              confidence: 0.90,
            },
            hasMultipleScales: false,
            scaleCount: 1,
            extractedFrom: 'titleBlock',
            confidence: 0.90,
          },
        },
        {
          sheetNumber: 'M-101',
          scaleData: {
            sheetNumber: 'M-101',
            primaryScale: {
              scaleString: '1:100',
              scaleRatio: 100,
              format: 'metric',
              isMultiple: false,
              confidence: 0.85,
            },
            hasMultipleScales: false,
            scaleCount: 1,
            extractedFrom: 'titleBlock',
            confidence: 0.85,
          },
        },
      ]);

      const result = await getScaleStatistics('test-project');

      expect(result.formatDistribution.architectural).toBe(1);
      expect(result.formatDistribution.engineering).toBe(1);
      expect(result.formatDistribution.metric).toBe(1);
      expect(result.formatDistribution.custom).toBe(0);
    });

    it('should handle empty project', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({ id: 'project-id' });

      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([]);

      const result = await getScaleStatistics('test-project');

      expect(result.totalSheets).toBe(0);
      expect(result.coverage).toBe(0);
      expect(result.avgConfidence).toBe(0);
    });

    it('should handle project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce(null);

      await expect(getScaleStatistics('non-existent-project')).rejects.toThrow(
        'Project not found'
      );
    });
  });

  describe('convertDrawingToRealWorld', () => {
    describe('inches to feet conversions', () => {
      it('should convert drawing inches to real-world feet (1/4" scale)', () => {
        const result = convertDrawingToRealWorld(1, 48, 'inches', 'feet');
        expect(result).toBe(4); // 1" on drawing = 48" real = 4 feet
      });

      it('should convert drawing inches to real-world feet (1/8" scale)', () => {
        const result = convertDrawingToRealWorld(1, 96, 'inches', 'feet');
        expect(result).toBe(8); // 1" on drawing = 96" real = 8 feet
      });

      it('should convert drawing inches to real-world inches', () => {
        const result = convertDrawingToRealWorld(1, 48, 'inches', 'inches');
        expect(result).toBe(48);
      });
    });

    describe('feet to feet conversions', () => {
      it('should convert drawing feet to real-world feet', () => {
        const result = convertDrawingToRealWorld(1, 48, 'feet', 'feet');
        expect(result).toBe(48); // 1' on drawing = 48' real
      });

      it('should convert drawing feet to real-world inches', () => {
        const result = convertDrawingToRealWorld(1, 48, 'feet', 'inches');
        expect(result).toBe(576); // 1' on drawing = 48' real = 576"
      });
    });

    describe('metric conversions', () => {
      it('should convert mm to meters (1:100 scale)', () => {
        const result = convertDrawingToRealWorld(10, 100, 'mm', 'm');
        expect(result).toBeCloseTo(1, 1); // 10mm on drawing = 1000mm real = 1m
      });

      it('should convert cm to meters (1:50 scale)', () => {
        const result = convertDrawingToRealWorld(1, 50, 'cm', 'm');
        expect(result).toBeCloseTo(0.5, 1); // 1cm on drawing = 50cm real = 0.5m
      });

      it('should convert mm to mm (1:100 scale)', () => {
        const result = convertDrawingToRealWorld(1, 100, 'mm', 'mm');
        expect(result).toBe(100);
      });
    });

    describe('mixed unit conversions', () => {
      it('should convert inches to mm', () => {
        const result = convertDrawingToRealWorld(1, 48, 'inches', 'mm');
        expect(result).toBeCloseTo(1219.2, 1); // 48" = 1219.2mm
      });

      it('should convert mm to inches', () => {
        const result = convertDrawingToRealWorld(100, 100, 'mm', 'inches');
        expect(result).toBeCloseTo(393.7, 1); // 10000mm = 393.7"
      });

      it('should convert feet to meters', () => {
        const result = convertDrawingToRealWorld(1, 48, 'feet', 'm');
        expect(result).toBeCloseTo(14.63, 1); // 48' = 14.63m
      });

      it('should convert meters to feet', () => {
        const result = convertDrawingToRealWorld(1, 100, 'm', 'feet');
        expect(result).toBeCloseTo(328.08, 1); // 100m = 328.08'
      });
    });

    describe('edge cases', () => {
      it('should handle zero measurement', () => {
        const result = convertDrawingToRealWorld(0, 48, 'inches', 'feet');
        expect(result).toBe(0);
      });

      it('should handle decimal measurements', () => {
        const result = convertDrawingToRealWorld(0.5, 48, 'inches', 'feet');
        expect(result).toBe(2);
      });

      it('should handle large measurements', () => {
        const result = convertDrawingToRealWorld(100, 48, 'inches', 'feet');
        expect(result).toBe(400);
      });

      it('should handle 1:1 scale', () => {
        const result = convertDrawingToRealWorld(10, 1, 'inches', 'inches');
        expect(result).toBe(10);
      });
    });

    describe('all unit pairs', () => {
      it('should convert cm to inches', () => {
        const result = convertDrawingToRealWorld(1, 100, 'cm', 'inches');
        expect(result).toBeCloseTo(3937, 0);
      });

      it('should convert cm to feet', () => {
        const result = convertDrawingToRealWorld(1, 100, 'cm', 'feet');
        expect(result).toBeCloseTo(328.08, 1);
      });

      it('should convert cm to cm', () => {
        const result = convertDrawingToRealWorld(1, 100, 'cm', 'cm');
        expect(result).toBe(100);
      });

      it('should convert meters to inches', () => {
        const result = convertDrawingToRealWorld(1, 100, 'm', 'inches');
        expect(result).toBeCloseTo(3937, 0);
      });

      it('should convert meters to cm', () => {
        const result = convertDrawingToRealWorld(1, 100, 'm', 'cm');
        expect(result).toBeCloseTo(10000, 0);
      });

      it('should convert meters to mm', () => {
        const result = convertDrawingToRealWorld(1, 100, 'm', 'mm');
        expect(result).toBeCloseTo(100000, 0);
      });
    });

    describe('default parameters', () => {
      it('should use default inches to feet when no units specified', () => {
        const result = convertDrawingToRealWorld(1, 48);
        expect(result).toBe(4);
      });
    });
  });
});
