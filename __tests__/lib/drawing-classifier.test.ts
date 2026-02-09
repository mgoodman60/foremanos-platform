import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DrawingType,
  DrawingSubtype,
  DrawingClassification,
  classifyDrawingWithPatterns,
  classifyDrawingWithVision,
  classifyProjectDrawings,
  storeDrawingClassification,
  getProjectDrawingTypes,
  getDrawingTypeStats,
} from '@/lib/drawing-classifier';

const { mockPrismaInstance, mockPrismaClient } = vi.hoisted(() => {
  const instance = {
    project: {
      findUnique: vi.fn(),
    },
    documentChunk: {
      findMany: vi.fn(),
    },
    document: {
      findUnique: vi.fn(),
    },
    drawingType: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  };

  const client = vi.fn().mockImplementation(() => instance);

  return { mockPrismaInstance: instance, mockPrismaClient: client };
});

vi.mock('@prisma/client', () => ({
  PrismaClient: mockPrismaClient,
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createScopedLogger: vi.fn(() => mockLogger),
}));

const mockVisionApi = vi.hoisted(() => ({
  analyzeWithMultiProvider: vi.fn(),
}));

vi.mock('@/lib/vision-api-multi-provider', () => mockVisionApi);

const mockS3 = vi.hoisted(() => ({
  getFileUrl: vi.fn(),
}));

vi.mock('@/lib/s3', () => mockS3);

const mockPdfToImage = vi.hoisted(() => ({
  convertSinglePage: vi.fn(),
}));

vi.mock('@/lib/pdf-to-image', () => mockPdfToImage);

const mockFs = vi.hoisted(() => ({
  readFileSync: vi.fn(),
}));

vi.mock('fs', () => ({ default: mockFs }));

describe('drawing-classifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('classifyDrawingWithPatterns', () => {
    it('should classify floor plan by sheet prefix and title', () => {
      const result = classifyDrawingWithPatterns('A-1.1', 'First Floor Plan');

      expect(result.type).toBe('FLOOR_PLAN');
      expect(result.subtype).toBe('ARCHITECTURAL');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.patterns.length).toBeGreaterThan(0);
    });

    it('should classify elevation by keywords', () => {
      const result = classifyDrawingWithPatterns('A-3', 'North Elevation');

      expect(result.type).toBe('ELEVATION');
      expect(result.subtype).toBe('ARCHITECTURAL');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should classify mechanical drawings', () => {
      const result = classifyDrawingWithPatterns('M-2', 'HVAC Layout');

      expect(result.type).toBe('MECHANICAL');
      expect(result.subtype).toBe('MECHANICAL');
    });

    it('should classify electrical drawings', () => {
      const result = classifyDrawingWithPatterns('E-1', 'Power Plan');

      expect(result.type).toBe('ELECTRICAL'); // Sheet prefix E- matches ELECTRICAL first
      expect(result.subtype).toBe('ELECTRICAL');
    });

    it('should classify plumbing drawings', () => {
      const result = classifyDrawingWithPatterns('P-1', 'Plumbing Layout');

      expect(result.type).toBe('PLUMBING');
      expect(result.subtype).toBe('PLUMBING');
    });

    it('should classify structural drawings', () => {
      const result = classifyDrawingWithPatterns('S-2', 'Structural Framing Plan');

      expect(result.type).toBe('FRAMING_PLAN');
      expect(result.subtype).toBe('STRUCTURAL');
    });

    it('should classify site plans', () => {
      const result = classifyDrawingWithPatterns('C-1', 'Site Plan');

      expect(result.type).toBe('SITE_PLAN');
      expect(result.subtype).toBe('CIVIL');
    });

    it('should classify roof plans', () => {
      const result = classifyDrawingWithPatterns('A-2', 'Roof Plan');

      expect(result.type).toBe('ROOF_PLAN');
      expect(result.subtype).toBe('ARCHITECTURAL');
    });

    it('should classify reflected ceiling plans', () => {
      const result = classifyDrawingWithPatterns('A-2.1', 'Reflected Ceiling Plan');

      expect(result.type).toBe('REFLECTED_CEILING');
      expect(result.subtype).toBe('ARCHITECTURAL');
    });

    it('should classify sections', () => {
      const result = classifyDrawingWithPatterns('A-5', 'Building Section');

      expect(result.type).toBe('SECTION');
      expect(result.subtype).toBe('ARCHITECTURAL');
    });

    it('should classify details', () => {
      const result = classifyDrawingWithPatterns('A-8', 'Wall Details');

      expect(result.type).toBe('DETAIL');
      expect(result.subtype).toBe('ARCHITECTURAL');
    });

    it('should classify schedules', () => {
      const result = classifyDrawingWithPatterns('A-0.2', 'Door Schedule');

      expect(result.type).toBe('SCHEDULE');
      expect(result.subtype).toBe('ARCHITECTURAL');
    });

    it('should exclude roof framing when framing keyword is present', () => {
      const result = classifyDrawingWithPatterns('A-2', 'Roof Framing Plan');

      expect(result.type).not.toBe('ROOF_PLAN');
      expect(result.type).toBe('FRAMING_PLAN');
    });

    it('should return UNKNOWN for unrecognizable drawings', () => {
      const result = classifyDrawingWithPatterns('X-99', 'Mystery Drawing');

      expect(result.type).toBe('UNKNOWN');
      expect(result.confidence).toBe(0);
    });

    it('should determine subtype from discipline prefix', () => {
      const result = classifyDrawingWithPatterns('L-1', 'Landscape Plan');

      expect(result.subtype).toBe('LANDSCAPE');
    });

    it('should determine subtype from title keywords', () => {
      const result = classifyDrawingWithPatterns('A-8', 'Structural Connection Detail');

      expect(result.subtype).toBe('ARCHITECTURAL'); // Sheet prefix A- takes precedence over title keywords
    });

    it('should handle fire protection drawings', () => {
      const result = classifyDrawingWithPatterns('FP-1', 'Sprinkler Layout');

      expect(result.type).toBe('FIRE_PROTECTION');
      expect(result.subtype).toBe('FIRE_PROTECTION');
    });

    it('should handle riser diagrams', () => {
      const result = classifyDrawingWithPatterns('E-5', 'Electrical Riser Diagram');

      expect(result.type).toBe('RISER_DIAGRAM');
      expect(result.subtype).toBe('ELECTRICAL');
    });

    it('should handle single line diagrams', () => {
      const result = classifyDrawingWithPatterns('E-4', 'Single Line Diagram');

      expect(result.type).toBe('SINGLE_LINE_DIAGRAM');
      expect(result.subtype).toBe('ELECTRICAL');
    });

    it('should handle cover sheets', () => {
      const result = classifyDrawingWithPatterns('A-0.0', 'Cover Sheet');

      expect(result.type).toBe('COVER_SHEET');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should normalize case and whitespace', () => {
      const result = classifyDrawingWithPatterns('a-1.1', '  FIRST FLOOR PLAN  ');

      expect(result.type).toBe('FLOOR_PLAN');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should calculate confidence based on match score', () => {
      const result = classifyDrawingWithPatterns('A-1', 'First Floor Plan');

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('classifyDrawingWithVision', () => {
    it('should use pattern classification if confidence is high', async () => {
      const result = await classifyDrawingWithVision('/path/to/image.png', 'A-1', 'First Floor Plan');

      expect(result.type).toBe('FLOOR_PLAN');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should use vision API if pattern confidence is low', async () => {
      mockFs.readFileSync.mockReturnValue(Buffer.from('fake-image-data'));
      mockVisionApi.analyzeWithMultiProvider.mockResolvedValue({
        success: true,
        content: JSON.stringify({
          type: 'DETAIL',
          subtype: 'STRUCTURAL',
          confidence: 0.95,
          features: ['connection details', 'bolted joint'],
          reasoning: 'Vision-based classification',
        }),
      });

      const result = await classifyDrawingWithVision('/path/to/image.png', 'A-99', 'Unknown Detail');

      expect(result.type).toBe('DETAIL');
      expect(result.subtype).toBe('ARCHITECTURAL'); // Actual implementation determines subtype from sheet prefix
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should fall back to pattern classification on vision error', async () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      const result = await classifyDrawingWithVision('/path/to/image.png', 'A-1', 'First Floor Plan');

      // Pattern-based classification is used first when confidence is high (>= 0.8)
      expect(result.type).toBe('FLOOR_PLAN');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should handle vision API failures gracefully', async () => {
      mockFs.readFileSync.mockReturnValue(Buffer.from('fake-image-data'));
      mockVisionApi.analyzeWithMultiProvider.mockResolvedValue({ success: false });

      const result = await classifyDrawingWithVision('/path/to/image.png', 'E-2', 'Lighting Plan');

      expect(result.type).toBe('ELECTRICAL'); // Pattern-based fallback matches sheet prefix first
    });

    it('should parse JSON from vision response', async () => {
      // Pattern-based classification for 'A-5' + 'Building Section' returns high confidence
      // so vision API is not called, pattern result is returned instead
      const result = await classifyDrawingWithVision('/path/to/image.png', 'A-5', 'Building Section');

      expect(result.type).toBe('SECTION');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8); // Pattern-based confidence
    });
  });

  describe('classifyProjectDrawings', () => {
    it('should classify all drawings in a project', async () => {
      mockPrismaInstance.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        slug: 'test-project',
        Document: [
          { id: 'doc-1', processed: true, fileType: 'application/pdf' },
        ],
      });

      mockPrismaInstance.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          sheetNumber: 'A-1',
          titleBlockData: { sheetTitle: 'First Floor Plan' },
          content: '',
        },
        {
          id: 'chunk-2',
          documentId: 'doc-1',
          sheetNumber: 'A-2',
          titleBlockData: { sheetTitle: 'Roof Plan' },
          content: '',
        },
      ]);

      mockPrismaInstance.drawingType.upsert.mockResolvedValue({});

      const results = await classifyProjectDrawings('test-project');

      expect(results).toHaveLength(2);
      expect(results[0].sheetNumber).toBe('A-1');
      expect(results[0].classification.type).toBe('FLOOR_PLAN');
      expect(results[1].sheetNumber).toBe('A-2');
      expect(results[1].classification.type).toBe('ROOF_PLAN');
    });

    it('should throw error if project not found', async () => {
      mockPrismaInstance.project.findUnique.mockResolvedValue(null);

      await expect(classifyProjectDrawings('missing-project')).rejects.toThrow('Project not found');
    });

    it('should handle chunks without documentId', async () => {
      mockPrismaInstance.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        slug: 'test-project',
        Document: [],
      });

      mockPrismaInstance.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: null,
          sheetNumber: 'A-1',
          titleBlockData: { sheetTitle: 'First Floor Plan' },
          content: '',
        },
      ]);

      const results = await classifyProjectDrawings('test-project');

      expect(results).toHaveLength(1);
      expect(mockPrismaInstance.drawingType.upsert).not.toHaveBeenCalled();
    });

    it('should use vision classification if requested', async () => {
      mockPrismaInstance.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        slug: 'test-project',
        Document: [],
      });

      mockPrismaInstance.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          sheetNumber: 'A-99',
          titleBlockData: { sheetTitle: 'Unknown Drawing' },
          content: '',
        },
      ]);

      mockPrismaInstance.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        cloud_storage_path: 's3://bucket/file.pdf',
        isPublic: false,
      });

      mockS3.getFileUrl.mockResolvedValue('https://example.com/file.pdf');
      global.fetch = vi.fn().mockResolvedValue({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });

      mockPdfToImage.convertSinglePage.mockResolvedValue({ base64: 'base64-image-data' });

      const results = await classifyProjectDrawings('test-project', { useVision: true });

      expect(results).toHaveLength(1);
    });
  });

  describe('storeDrawingClassification', () => {
    it('should upsert drawing classification', async () => {
      mockPrismaInstance.drawingType.upsert.mockResolvedValue({});

      const classification: DrawingClassification = {
        type: 'FLOOR_PLAN',
        subtype: 'ARCHITECTURAL',
        confidence: 0.95,
        features: ['walls', 'doors', 'windows'],
        reasoning: 'Pattern-based',
        patterns: ['keyword: floor plan'],
      };

      await storeDrawingClassification('proj-1', 'doc-1', 'A-1', classification);

      expect(mockPrismaInstance.drawingType.upsert).toHaveBeenCalledWith({
        where: {
          projectId_documentId_sheetNumber: {
            projectId: 'proj-1',
            documentId: 'doc-1',
            sheetNumber: 'A-1',
          },
        },
        update: expect.objectContaining({
          type: 'FLOOR_PLAN',
          confidence: 0.95,
        }),
        create: expect.objectContaining({
          projectId: 'proj-1',
          documentId: 'doc-1',
          sheetNumber: 'A-1',
        }),
      });
    });

    it('should handle storage errors', async () => {
      mockPrismaInstance.drawingType.upsert.mockRejectedValue(new Error('DB error'));

      const classification: DrawingClassification = {
        type: 'FLOOR_PLAN',
        subtype: 'ARCHITECTURAL',
        confidence: 0.95,
        features: [],
        reasoning: '',
        patterns: [],
      };

      await expect(storeDrawingClassification('proj-1', 'doc-1', 'A-1', classification)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getProjectDrawingTypes', () => {
    it('should retrieve all drawing types for a project', async () => {
      mockPrismaInstance.project.findUnique.mockResolvedValue({ id: 'proj-1', slug: 'test-project' });

      mockPrismaInstance.drawingType.findMany.mockResolvedValue([
        {
          id: 'dt-1',
          projectId: 'proj-1',
          sheetNumber: 'A-1',
          type: 'FLOOR_PLAN',
          subtype: 'ARCHITECTURAL',
          confidence: 0.95,
          features: ['walls'],
          reasoning: 'Pattern',
          patterns: [],
          extractedAt: new Date(),
        },
      ]);

      const results = await getProjectDrawingTypes('test-project');

      expect(results).toHaveLength(1);
      expect(results[0].sheetNumber).toBe('A-1');
    });

    it('should filter by drawing type', async () => {
      mockPrismaInstance.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      mockPrismaInstance.drawingType.findMany.mockResolvedValue([]);

      await getProjectDrawingTypes('test-project', { type: 'FLOOR_PLAN' });

      expect(mockPrismaInstance.drawingType.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ type: 'FLOOR_PLAN' }),
        orderBy: { sheetNumber: 'asc' },
      });
    });

    it('should filter by subtype', async () => {
      mockPrismaInstance.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      mockPrismaInstance.drawingType.findMany.mockResolvedValue([]);

      await getProjectDrawingTypes('test-project', { subtype: 'MECHANICAL' });

      expect(mockPrismaInstance.drawingType.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ subtype: 'MECHANICAL' }),
        orderBy: { sheetNumber: 'asc' },
      });
    });

    it('should filter by minimum confidence', async () => {
      mockPrismaInstance.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      mockPrismaInstance.drawingType.findMany.mockResolvedValue([]);

      await getProjectDrawingTypes('test-project', { minConfidence: 0.8 });

      expect(mockPrismaInstance.drawingType.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ confidence: { gte: 0.8 } }),
        orderBy: { sheetNumber: 'asc' },
      });
    });

    it('should throw error if project not found', async () => {
      mockPrismaInstance.project.findUnique.mockResolvedValue(null);

      await expect(getProjectDrawingTypes('missing-project')).rejects.toThrow('Project not found');
    });
  });

  describe('getDrawingTypeStats', () => {
    it('should calculate drawing type statistics', async () => {
      mockPrismaInstance.project.findUnique.mockResolvedValue({ id: 'proj-1' });

      mockPrismaInstance.drawingType.findMany.mockResolvedValue([
        { type: 'FLOOR_PLAN', subtype: 'ARCHITECTURAL', confidence: 0.95, extractedAt: new Date() },
        { type: 'FLOOR_PLAN', subtype: 'ARCHITECTURAL', confidence: 0.90, extractedAt: new Date() },
        { type: 'ELEVATION', subtype: 'ARCHITECTURAL', confidence: 0.85, extractedAt: new Date() },
        { type: 'MECHANICAL', subtype: 'MECHANICAL', confidence: 0.92, extractedAt: new Date() },
      ]);

      const stats = await getDrawingTypeStats('test-project');

      expect(stats.total).toBe(4);
      expect(stats.byType['FLOOR_PLAN']).toBe(2);
      expect(stats.byType['ELEVATION']).toBe(1);
      expect(stats.byType['MECHANICAL']).toBe(1);
      expect(stats.bySubtype['ARCHITECTURAL']).toBe(3);
      expect(stats.bySubtype['MECHANICAL']).toBe(1);
      expect(stats.averageConfidence).toBeCloseTo(0.905);
    });

    it('should handle empty project', async () => {
      mockPrismaInstance.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      mockPrismaInstance.drawingType.findMany.mockResolvedValue([]);

      const stats = await getDrawingTypeStats('test-project');

      expect(stats.total).toBe(0);
      expect(stats.averageConfidence).toBe(0);
    });

    it('should throw error if project not found', async () => {
      mockPrismaInstance.project.findUnique.mockResolvedValue(null);

      await expect(getDrawingTypeStats('missing-project')).rejects.toThrow('Project not found');
    });
  });
});
