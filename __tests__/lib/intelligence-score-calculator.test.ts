/**
 * Intelligence Score Calculator Tests
 * Tests scoring logic, checklist generation, and database metric fetching
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  documentChunk: { findMany: vi.fn() },
  room: { count: vi.fn() },
  dimensionAnnotation: { count: vi.fn() },
  detailCallout: { count: vi.fn() },
  drawingType: { findMany: vi.fn() },
  doorScheduleItem: { count: vi.fn() },
  windowScheduleItem: { count: vi.fn() },
  takeoffLineItem: { count: vi.fn() },
  document: { count: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  calculateIntelligenceScore,
  getProjectIntelligenceMetrics,
  type IntelligenceMetrics,
  type IntelligenceScoreResult,
} from '@/lib/intelligence-score-calculator';

function makeMetrics(overrides: Partial<IntelligenceMetrics> = {}): IntelligenceMetrics {
  return {
    totalSheets: 0,
    averageConfidence: 0,
    lowConfidenceSheetCount: 0,
    roomsExtracted: 0,
    fixturesExtracted: 0,
    dimensionsExtracted: 0,
    crossReferencesResolved: 0,
    totalCrossReferences: 0,
    drawingTypesClassified: 0,
    averageClassificationConfidence: 0,
    doorScheduleItems: 0,
    windowScheduleItems: 0,
    materialTakeoffItems: 0,
    documentsProcessed: 0,
    documentsTotal: 0,
    ...overrides,
  };
}

describe('calculateIntelligenceScore', () => {
  describe('empty project (all zeros)', () => {
    it('returns score 0 for empty metrics', () => {
      const result = calculateIntelligenceScore(makeMetrics());
      expect(result.overall).toBe(0);
      expect(result.extractionQuality).toBe(0);
      expect(result.entityCompleteness).toBe(0);
      expect(result.classificationAccuracy).toBe(0);
      expect(result.enrichmentSuccess).toBe(0);
      expect(result.pipelineCoverage).toBe(0);
    });

    it('all checklist items are missing when empty', () => {
      const result = calculateIntelligenceScore(makeMetrics());
      const missingItems = result.checklist.filter((item) => item.status === 'missing');
      expect(missingItems.length).toBeGreaterThanOrEqual(7);
    });
  });

  describe('extraction quality (30% weight)', () => {
    it('high confidence yields high extraction score', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({ totalSheets: 20, averageConfidence: 0.95, lowConfidenceSheetCount: 0 })
      );
      expect(result.extractionQuality).toBe(95);
    });

    it('penalizes when >20% low-confidence sheets', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({
          totalSheets: 10,
          averageConfidence: 0.8,
          lowConfidenceSheetCount: 3, // 30% low confidence
        })
      );
      // 80 - 20 = 60
      expect(result.extractionQuality).toBe(60);
    });

    it('penalizes more when >50% low-confidence sheets', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({
          totalSheets: 10,
          averageConfidence: 0.7,
          lowConfidenceSheetCount: 6, // 60% low confidence
        })
      );
      // 70 - 40 = 30
      expect(result.extractionQuality).toBe(30);
    });

    it('returns 0 when no sheets exist', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({ totalSheets: 0, averageConfidence: 0.9 })
      );
      expect(result.extractionQuality).toBe(0);
    });

    it('clamps to 0 when penalty exceeds base score', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({
          totalSheets: 4,
          averageConfidence: 0.3,
          lowConfidenceSheetCount: 3, // 75% low confidence
        })
      );
      // 30 - 40 = -10, clamped to 0
      expect(result.extractionQuality).toBe(0);
    });
  });

  describe('entity completeness (25% weight)', () => {
    it('rooms add up to 40 points', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({ roomsExtracted: 25 })
      );
      // base 20 + min(20, 25) = 40
      expect(result.entityCompleteness).toBe(40);
    });

    it('fixtures add up to 20 points', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({ fixturesExtracted: 15 })
      );
      // base 10 + min(10, 15) = 20
      expect(result.entityCompleteness).toBe(20);
    });

    it('dimensions add up to 20 points', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({ dimensionsExtracted: 15 })
      );
      // base 10 + min(10, 15) = 20
      expect(result.entityCompleteness).toBe(20);
    });

    it('cross-reference resolution contributes up to 20 points', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({
          crossReferencesResolved: 10,
          totalCrossReferences: 10,
        })
      );
      // 100% resolution rate * 20 = 20
      expect(result.entityCompleteness).toBe(20);
    });

    it('partial cross-reference resolution gives proportional score', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({
          crossReferencesResolved: 5,
          totalCrossReferences: 10,
        })
      );
      // 50% * 20 = 10
      expect(result.entityCompleteness).toBe(10);
    });

    it('maxes at 100 with all entities present', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({
          roomsExtracted: 50,
          fixturesExtracted: 20,
          dimensionsExtracted: 20,
          crossReferencesResolved: 20,
          totalCrossReferences: 20,
        })
      );
      // 40 + 20 + 20 + 20 = 100
      expect(result.entityCompleteness).toBe(100);
    });
  });

  describe('classification accuracy (15% weight)', () => {
    it('returns 0 when no types classified', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({ drawingTypesClassified: 0 })
      );
      expect(result.classificationAccuracy).toBe(0);
    });

    it('returns confidence * 100 when types classified', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({
          drawingTypesClassified: 10,
          averageClassificationConfidence: 0.85,
        })
      );
      expect(result.classificationAccuracy).toBe(85);
    });

    it('clamps at 100', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({
          drawingTypesClassified: 5,
          averageClassificationConfidence: 1.1, // hypothetical
        })
      );
      expect(result.classificationAccuracy).toBe(100);
    });
  });

  describe('enrichment success (15% weight)', () => {
    it('adds 20 for each enrichment source', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({
          doorScheduleItems: 5,
          windowScheduleItems: 3,
          materialTakeoffItems: 10,
          drawingTypesClassified: 8,
          totalSheets: 15, // > 10
        })
      );
      // 20 + 20 + 20 + 20 + 20 = 100
      expect(result.enrichmentSuccess).toBe(100);
    });

    it('only counts sources that have data', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({
          doorScheduleItems: 5,
          windowScheduleItems: 0,
          materialTakeoffItems: 0,
          drawingTypesClassified: 0,
          totalSheets: 3, // <= 10
        })
      );
      // Only doorScheduleItems = 20
      expect(result.enrichmentSuccess).toBe(20);
    });

    it('returns 0 when nothing is enriched', () => {
      const result = calculateIntelligenceScore(makeMetrics());
      expect(result.enrichmentSuccess).toBe(0);
    });
  });

  describe('pipeline coverage (15% weight)', () => {
    it('100% when all documents processed', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({ documentsProcessed: 10, documentsTotal: 10 })
      );
      expect(result.pipelineCoverage).toBe(100);
    });

    it('partial coverage when some documents remain', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({ documentsProcessed: 7, documentsTotal: 10 })
      );
      expect(result.pipelineCoverage).toBe(70);
    });

    it('returns 0 when no documents exist', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({ documentsProcessed: 0, documentsTotal: 0 })
      );
      expect(result.pipelineCoverage).toBe(0);
    });

    it('returns 0 when no documents are processed', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({ documentsProcessed: 0, documentsTotal: 5 })
      );
      expect(result.pipelineCoverage).toBe(0);
    });
  });

  describe('overall weighted sum', () => {
    it('calculates correct weighted average', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({
          totalSheets: 20,
          averageConfidence: 1.0,
          lowConfidenceSheetCount: 0,
          roomsExtracted: 50,
          fixturesExtracted: 20,
          dimensionsExtracted: 20,
          crossReferencesResolved: 20,
          totalCrossReferences: 20,
          drawingTypesClassified: 10,
          averageClassificationConfidence: 1.0,
          doorScheduleItems: 5,
          windowScheduleItems: 5,
          materialTakeoffItems: 10,
          documentsProcessed: 10,
          documentsTotal: 10,
        })
      );
      // extraction: 100*0.30 = 30
      // entity: 100*0.25 = 25
      // classification: 100*0.15 = 15
      // enrichment: 100*0.15 = 15
      // coverage: 100*0.15 = 15
      // total = 100
      expect(result.overall).toBe(100);
    });

    it('produces rounded integer', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({
          totalSheets: 5,
          averageConfidence: 0.73,
          lowConfidenceSheetCount: 0,
          roomsExtracted: 5,
          documentsProcessed: 3,
          documentsTotal: 5,
        })
      );
      expect(Number.isInteger(result.overall)).toBe(true);
    });
  });

  describe('checklist generation', () => {
    it('returns 9 checklist items', () => {
      const result = calculateIntelligenceScore(makeMetrics());
      expect(result.checklist).toHaveLength(9);
    });

    it('marks upload-drawings as missing when no sheets', () => {
      const result = calculateIntelligenceScore(makeMetrics({ totalSheets: 0 }));
      const item = result.checklist.find((i) => i.id === 'upload-drawings');
      expect(item?.status).toBe('missing');
    });

    it('marks upload-drawings as partial when few sheets', () => {
      const result = calculateIntelligenceScore(makeMetrics({ totalSheets: 3 }));
      const item = result.checklist.find((i) => i.id === 'upload-drawings');
      expect(item?.status).toBe('partial');
    });

    it('marks upload-drawings as complete when enough sheets', () => {
      const result = calculateIntelligenceScore(makeMetrics({ totalSheets: 10 }));
      const item = result.checklist.find((i) => i.id === 'upload-drawings');
      expect(item?.status).toBe('complete');
    });

    it('marks process-documents as complete at 100% coverage', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({ documentsProcessed: 5, documentsTotal: 5 })
      );
      const item = result.checklist.find((i) => i.id === 'process-documents');
      expect(item?.status).toBe('complete');
    });

    it('marks process-documents as partial when some unprocessed', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({ documentsProcessed: 3, documentsTotal: 5 })
      );
      const item = result.checklist.find((i) => i.id === 'process-documents');
      expect(item?.status).toBe('partial');
    });

    it('marks extraction-confidence as complete when >= 0.7', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({ totalSheets: 5, averageConfidence: 0.8 })
      );
      const item = result.checklist.find((i) => i.id === 'extraction-confidence');
      expect(item?.status).toBe('complete');
    });

    it('marks extraction-confidence as partial when < 0.7', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({ totalSheets: 5, averageConfidence: 0.5 })
      );
      const item = result.checklist.find((i) => i.id === 'extraction-confidence');
      expect(item?.status).toBe('partial');
    });

    it('marks extract-rooms as missing when 0 rooms', () => {
      const result = calculateIntelligenceScore(makeMetrics({ roomsExtracted: 0 }));
      const item = result.checklist.find((i) => i.id === 'extract-rooms');
      expect(item?.status).toBe('missing');
    });

    it('marks extract-rooms as complete when rooms exist', () => {
      const result = calculateIntelligenceScore(makeMetrics({ roomsExtracted: 5 }));
      const item = result.checklist.find((i) => i.id === 'extract-rooms');
      expect(item?.status).toBe('complete');
    });

    it('marks resolve-cross-refs as partial when low resolution rate', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({ crossReferencesResolved: 2, totalCrossReferences: 10 })
      );
      const item = result.checklist.find((i) => i.id === 'resolve-cross-refs');
      expect(item?.status).toBe('partial');
    });

    it('marks resolve-cross-refs as complete when high resolution rate', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({ crossReferencesResolved: 8, totalCrossReferences: 10 })
      );
      const item = result.checklist.find((i) => i.id === 'resolve-cross-refs');
      expect(item?.status).toBe('complete');
    });

    it('marks schedules as partial when only doors extracted', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({ doorScheduleItems: 5, windowScheduleItems: 0 })
      );
      const item = result.checklist.find((i) => i.id === 'extract-schedules');
      expect(item?.status).toBe('partial');
    });

    it('marks schedules as complete when both doors and windows extracted', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({ doorScheduleItems: 5, windowScheduleItems: 3 })
      );
      const item = result.checklist.find((i) => i.id === 'extract-schedules');
      expect(item?.status).toBe('complete');
    });

    it('includes action labels for non-complete items', () => {
      const result = calculateIntelligenceScore(makeMetrics());
      const actionableItems = result.checklist.filter(
        (i) => i.status !== 'complete' && i.actionLabel
      );
      expect(actionableItems.length).toBeGreaterThan(0);
      for (const item of actionableItems) {
        expect(item.actionHref).toBeTruthy();
      }
    });

    it('each item has required fields', () => {
      const result = calculateIntelligenceScore(makeMetrics());
      for (const item of result.checklist) {
        expect(item.id).toBeTruthy();
        expect(item.category).toBeTruthy();
        expect(item.label).toBeTruthy();
        expect(['complete', 'partial', 'missing']).toContain(item.status);
        expect(item.weight).toBeGreaterThan(0);
      }
    });
  });

  describe('division-by-zero guards', () => {
    it('handles 0 total cross-references', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({ totalCrossReferences: 0, crossReferencesResolved: 0 })
      );
      expect(result.entityCompleteness).toBeGreaterThanOrEqual(0);
    });

    it('handles 0 total documents', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({ documentsTotal: 0, documentsProcessed: 0 })
      );
      expect(result.pipelineCoverage).toBe(0);
    });

    it('handles 0 total sheets', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({ totalSheets: 0 })
      );
      expect(result.extractionQuality).toBe(0);
    });

    it('handles 0 drawing types classified', () => {
      const result = calculateIntelligenceScore(
        makeMetrics({ drawingTypesClassified: 0 })
      );
      expect(result.classificationAccuracy).toBe(0);
    });
  });
});

describe('getProjectIntelligenceMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns complete metrics from successful queries', async () => {
    mockPrisma.documentChunk.findMany.mockResolvedValue([
      {
        metadata: { confidence: 0.9, sheet_number: 'A1.01' },
        sheetNumber: 'A1.01',
        drawingTypeConfidence: 0.85,
      },
      {
        metadata: { confidence: 0.7, sheet_number: 'M1.01' },
        sheetNumber: 'M1.01',
        drawingTypeConfidence: 0.75,
      },
    ]);
    mockPrisma.room.count.mockResolvedValue(5);
    mockPrisma.dimensionAnnotation.count.mockResolvedValue(12);
    mockPrisma.detailCallout.count
      .mockResolvedValueOnce(8)   // total
      .mockResolvedValueOnce(5);  // resolved
    mockPrisma.drawingType.findMany.mockResolvedValue([
      { confidence: 0.9 },
      { confidence: 0.85 },
    ]);
    mockPrisma.doorScheduleItem.count.mockResolvedValue(10);
    mockPrisma.windowScheduleItem.count.mockResolvedValue(6);
    mockPrisma.takeoffLineItem.count.mockResolvedValue(25);
    mockPrisma.document.count
      .mockResolvedValueOnce(8)   // processed
      .mockResolvedValueOnce(10); // total

    const metrics = await getProjectIntelligenceMetrics('proj-1');

    expect(metrics.totalSheets).toBe(2);
    expect(metrics.averageConfidence).toBeCloseTo(0.8, 1);
    expect(metrics.roomsExtracted).toBe(5);
    expect(metrics.dimensionsExtracted).toBe(12);
    expect(metrics.totalCrossReferences).toBe(8);
    expect(metrics.crossReferencesResolved).toBe(5);
    expect(metrics.drawingTypesClassified).toBe(2);
    expect(metrics.averageClassificationConfidence).toBeCloseTo(0.875, 2);
    expect(metrics.doorScheduleItems).toBe(10);
    expect(metrics.windowScheduleItems).toBe(6);
    expect(metrics.materialTakeoffItems).toBe(25);
    expect(metrics.documentsProcessed).toBe(8);
    expect(metrics.documentsTotal).toBe(10);
  });

  it('handles failed queries gracefully with fallbacks', async () => {
    mockPrisma.documentChunk.findMany.mockRejectedValue(new Error('DB error'));
    mockPrisma.room.count.mockRejectedValue(new Error('DB error'));
    mockPrisma.dimensionAnnotation.count.mockRejectedValue(new Error('DB error'));
    mockPrisma.detailCallout.count.mockRejectedValue(new Error('DB error'));
    mockPrisma.drawingType.findMany.mockRejectedValue(new Error('DB error'));
    mockPrisma.doorScheduleItem.count.mockRejectedValue(new Error('DB error'));
    mockPrisma.windowScheduleItem.count.mockRejectedValue(new Error('DB error'));
    mockPrisma.takeoffLineItem.count.mockRejectedValue(new Error('DB error'));
    mockPrisma.document.count.mockRejectedValue(new Error('DB error'));

    const metrics = await getProjectIntelligenceMetrics('proj-1');

    expect(metrics.totalSheets).toBe(0);
    expect(metrics.averageConfidence).toBe(0);
    expect(metrics.roomsExtracted).toBe(0);
    expect(metrics.dimensionsExtracted).toBe(0);
    expect(metrics.totalCrossReferences).toBe(0);
    expect(metrics.crossReferencesResolved).toBe(0);
    expect(metrics.drawingTypesClassified).toBe(0);
    expect(metrics.doorScheduleItems).toBe(0);
    expect(metrics.windowScheduleItems).toBe(0);
    expect(metrics.materialTakeoffItems).toBe(0);
    expect(metrics.documentsProcessed).toBe(0);
    expect(metrics.documentsTotal).toBe(0);
  });

  it('counts unique sheet numbers', async () => {
    mockPrisma.documentChunk.findMany.mockResolvedValue([
      { metadata: {}, sheetNumber: 'A1.01', drawingTypeConfidence: null },
      { metadata: {}, sheetNumber: 'A1.01', drawingTypeConfidence: null }, // duplicate
      { metadata: {}, sheetNumber: 'A1.02', drawingTypeConfidence: null },
    ]);
    mockPrisma.room.count.mockResolvedValue(0);
    mockPrisma.dimensionAnnotation.count.mockResolvedValue(0);
    mockPrisma.detailCallout.count.mockResolvedValue(0);
    mockPrisma.drawingType.findMany.mockResolvedValue([]);
    mockPrisma.doorScheduleItem.count.mockResolvedValue(0);
    mockPrisma.windowScheduleItem.count.mockResolvedValue(0);
    mockPrisma.takeoffLineItem.count.mockResolvedValue(0);
    mockPrisma.document.count.mockResolvedValue(0);

    const metrics = await getProjectIntelligenceMetrics('proj-1');
    expect(metrics.totalSheets).toBe(2);
  });

  it('handles chunks with null metadata', async () => {
    mockPrisma.documentChunk.findMany.mockResolvedValue([
      { metadata: null, sheetNumber: 'A1.01', drawingTypeConfidence: 0.8 },
    ]);
    mockPrisma.room.count.mockResolvedValue(0);
    mockPrisma.dimensionAnnotation.count.mockResolvedValue(0);
    mockPrisma.detailCallout.count.mockResolvedValue(0);
    mockPrisma.drawingType.findMany.mockResolvedValue([]);
    mockPrisma.doorScheduleItem.count.mockResolvedValue(0);
    mockPrisma.windowScheduleItem.count.mockResolvedValue(0);
    mockPrisma.takeoffLineItem.count.mockResolvedValue(0);
    mockPrisma.document.count.mockResolvedValue(0);

    const metrics = await getProjectIntelligenceMetrics('proj-1');
    expect(metrics.totalSheets).toBe(1);
    expect(metrics.lowConfidenceSheetCount).toBe(0);
  });

  it('identifies low-confidence chunks from metadata', async () => {
    mockPrisma.documentChunk.findMany.mockResolvedValue([
      { metadata: { confidence: 0.3 }, sheetNumber: 'A1.01', drawingTypeConfidence: null },
      { metadata: { confidence: 0.2 }, sheetNumber: 'A1.02', drawingTypeConfidence: null },
      { metadata: { confidence: 0.9 }, sheetNumber: 'A1.03', drawingTypeConfidence: null },
    ]);
    mockPrisma.room.count.mockResolvedValue(0);
    mockPrisma.dimensionAnnotation.count.mockResolvedValue(0);
    mockPrisma.detailCallout.count.mockResolvedValue(0);
    mockPrisma.drawingType.findMany.mockResolvedValue([]);
    mockPrisma.doorScheduleItem.count.mockResolvedValue(0);
    mockPrisma.windowScheduleItem.count.mockResolvedValue(0);
    mockPrisma.takeoffLineItem.count.mockResolvedValue(0);
    mockPrisma.document.count.mockResolvedValue(0);

    const metrics = await getProjectIntelligenceMetrics('proj-1');
    expect(metrics.lowConfidenceSheetCount).toBe(2);
    expect(metrics.averageConfidence).toBeCloseTo(0.467, 2);
  });
});
