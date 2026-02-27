import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = vi.hoisted(() => ({
  documentChunk: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  document: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

const mockInterpretWithFallback = vi.hoisted(() => vi.fn());
const mockGetPluginExtractionEnhancement = vi.hoisted(() => vi.fn());
const mockPerformQualityCheck = vi.hoisted(() => vi.fn());

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/interpretation-service', () => ({
  interpretWithFallback: mockInterpretWithFallback,
}));
vi.mock('@/lib/plugin', () => ({
  getPluginExtractionEnhancement: mockGetPluginExtractionEnhancement,
}));
vi.mock('@/lib/vision-api-quality', () => ({
  performQualityCheck: mockPerformQualityCheck,
}));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

// Import after mocking
import { runTradeFocusedExtraction } from '@/lib/trade-focused-extractor';
import type { TradeFocus } from '@/lib/trade-focused-extractor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChunk(overrides: Record<string, unknown> = {}) {
  const content = JSON.stringify({
    sheetNumber: 'M-101',
    sheetTitle: 'Mechanical Plan',
    scale: '1/4"=1\'-0"',
    discipline: 'Mechanical',
    hvacData: null,
    ...((overrides.contentData as object | undefined) || {}),
  });
  return {
    id: 'chunk-1',
    documentId: 'doc-1',
    pageNumber: 1,
    discipline: 'Mechanical',
    content,
    qualityScore: 40,
    qualityPassed: false,
    qualityHistory: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runTradeFocusedExtraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default plugin mock — no extra reference
    mockGetPluginExtractionEnhancement.mockReturnValue(null);

    // Default document update
    mockPrisma.document.findUnique.mockResolvedValue({ id: 'doc-1', tradeFocusRun: [] });
    mockPrisma.document.update.mockResolvedValue({ id: 'doc-1', tradeFocusRun: ['Mechanical'] });
    mockPrisma.documentChunk.update.mockResolvedValue({});
  });

  describe('finding matching pages by discipline', () => {
    it('queries chunks with discipline filter when trade focuses are provided', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValue([]);

      const focuses: TradeFocus[] = [{ type: 'trade', name: 'Mechanical' }];
      await runTradeFocusedExtraction('doc-1', focuses);

      expect(mockPrisma.documentChunk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            documentId: 'doc-1',
            discipline: { in: ['Mechanical'] },
          }),
        })
      );
    });

    it('queries all chunks (no discipline filter) when only aspect focuses are provided', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValue([]);

      const focuses: TradeFocus[] = [{ type: 'aspect', name: 'hvacData' }];
      await runTradeFocusedExtraction('doc-1', focuses);

      expect(mockPrisma.documentChunk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ documentId: 'doc-1' }),
        })
      );
      // No discipline filter in the where clause
      const whereClause = mockPrisma.documentChunk.findMany.mock.calls[0][0].where;
      expect(whereClause).not.toHaveProperty('discipline');
    });

    it('applies page range filter when pageRange option is provided', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValue([]);

      const focuses: TradeFocus[] = [{ type: 'trade', name: 'Electrical' }];
      await runTradeFocusedExtraction('doc-1', focuses, { pageRange: { start: 5, end: 10 } });

      const whereClause = mockPrisma.documentChunk.findMany.mock.calls[0][0].where;
      expect(whereClause.pageNumber).toEqual({ gte: 5, lte: 10 });
    });

    it('returns zero-value result when no matching chunks are found', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValue([]);

      const result = await runTradeFocusedExtraction('doc-1', [{ type: 'trade', name: 'Plumbing' }]);

      expect(result.pagesProcessed).toBe(0);
      expect(result.fieldsUpdated).toBe(0);
      expect(result.qualityBefore).toBe(0);
      expect(result.qualityAfter).toBe(0);
      expect(result.cost).toBe(0);
      expect(result.mergeReport).toEqual([]);
    });
  });

  describe('additive merge — does not overwrite existing good data', () => {
    it('keeps existing non-null fields (action: "kept") and only adds missing ones', async () => {
      const existingContent = {
        sheetNumber: 'M-101',
        sheetTitle: 'Mechanical Plan',
        scale: '1/4"=1\'-0"',
        discipline: 'Mechanical',
        hvacData: null,
      };
      const focusedContent = {
        sheetNumber: 'M-101',     // already exists — keep
        hvacData: { ductwork: ['12x12 duct'] },  // missing — add
      };

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        makeChunk({ contentData: existingContent } as Record<string, unknown>),
      ]);

      mockPerformQualityCheck
        .mockReturnValueOnce({ score: 40, passed: false, issues: [], suggestions: [] })
        .mockReturnValueOnce({ score: 65, passed: true, issues: [], suggestions: [] });

      mockInterpretWithFallback.mockResolvedValue({
        content: JSON.stringify(focusedContent),
        interpretationProvider: 'claude-opus-4-6',
        processingTier: 'trade-focused',
        durationMs: 900,
        estimatedCost: 0.08,
      });

      const result = await runTradeFocusedExtraction('doc-1', [{ type: 'trade', name: 'Mechanical' }]);

      const hvacAction = result.mergeReport.find(r => r.field === 'hvacData');
      const sheetNumAction = result.mergeReport.find(r => r.field === 'sheetNumber');

      expect(hvacAction?.action).toBe('added');
      expect(sheetNumAction?.action).toBe('kept');
    });

    it('updates array fields when focused data has more items', async () => {
      const existingContent = {
        sheetNumber: 'E-201',
        electricalDevices: [{ type: 'outlet' }],
      };
      const focusedContent = {
        sheetNumber: 'E-201',
        electricalDevices: [{ type: 'outlet' }, { type: 'switch' }, { type: 'panel' }],
      };

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          ...makeChunk(),
          content: JSON.stringify(existingContent),
          discipline: 'Electrical',
        },
      ]);

      mockPerformQualityCheck
        .mockReturnValueOnce({ score: 35, passed: false, issues: [], suggestions: [] })
        .mockReturnValueOnce({ score: 60, passed: true, issues: [], suggestions: [] });

      mockInterpretWithFallback.mockResolvedValue({
        content: JSON.stringify(focusedContent),
        interpretationProvider: 'claude-opus-4-6',
        processingTier: 'trade-focused',
        durationMs: 700,
        estimatedCost: 0.08,
      });

      const result = await runTradeFocusedExtraction('doc-1', [{ type: 'trade', name: 'Electrical' }]);

      const devicesAction = result.mergeReport.find(r => r.field === 'electricalDevices');
      expect(devicesAction?.action).toBe('updated');
      expect(result.fieldsUpdated).toBeGreaterThan(0);
    });

    it('skips internal fields starting with underscore during merge', async () => {
      const existingContent = { sheetNumber: 'A-101' };
      const focusedContent = { sheetNumber: 'A-101', _internalField: 'should-be-skipped' };

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        { ...makeChunk(), content: JSON.stringify(existingContent) },
      ]);

      mockPerformQualityCheck
        .mockReturnValueOnce({ score: 40, passed: false, issues: [], suggestions: [] })
        .mockReturnValueOnce({ score: 40, passed: false, issues: [], suggestions: [] });

      mockInterpretWithFallback.mockResolvedValue({
        content: JSON.stringify(focusedContent),
        interpretationProvider: 'claude-opus-4-6',
        processingTier: 'trade-focused',
        durationMs: 500,
        estimatedCost: 0.08,
      });

      const result = await runTradeFocusedExtraction('doc-1', [{ type: 'trade', name: 'Architectural' }]);

      // _internalField should not appear in merge report
      expect(result.mergeReport.find(r => r.field === '_internalField')).toBeUndefined();
    });
  });

  describe('quality scores after merge', () => {
    it('returns average qualityBefore and qualityAfter across processed pages', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValue([makeChunk()]);

      mockPerformQualityCheck
        .mockReturnValueOnce({ score: 40, passed: false, issues: [], suggestions: [] }) // before
        .mockReturnValueOnce({ score: 70, passed: true, issues: [], suggestions: [] });  // after

      mockInterpretWithFallback.mockResolvedValue({
        content: JSON.stringify({ sheetNumber: 'M-101', hvacData: { ductwork: ['12x12'] } }),
        interpretationProvider: 'claude-opus-4-6',
        processingTier: 'trade-focused',
        durationMs: 700,
        estimatedCost: 0.08,
      });

      const result = await runTradeFocusedExtraction('doc-1', [{ type: 'trade', name: 'Mechanical' }]);

      expect(result.qualityBefore).toBe(40);
      expect(result.qualityAfter).toBe(70);
    });

    it('rounds quality scores to nearest integer', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValue([makeChunk()]);

      mockPerformQualityCheck
        .mockReturnValueOnce({ score: 33, passed: false, issues: [], suggestions: [] })
        .mockReturnValueOnce({ score: 67, passed: true, issues: [], suggestions: [] });

      mockInterpretWithFallback.mockResolvedValue({
        content: JSON.stringify({ sheetNumber: 'M-101' }),
        interpretationProvider: 'claude-opus-4-6',
        processingTier: 'trade-focused',
        durationMs: 500,
        estimatedCost: 0.08,
      });

      const result = await runTradeFocusedExtraction('doc-1', [{ type: 'trade', name: 'Mechanical' }]);

      expect(Number.isInteger(result.qualityBefore)).toBe(true);
      expect(Number.isInteger(result.qualityAfter)).toBe(true);
    });
  });

  describe('trade focus tracking in document metadata', () => {
    it('updates document.tradeFocusRun with the processed trade names', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValue([makeChunk()]);

      mockPerformQualityCheck
        .mockReturnValue({ score: 50, passed: true, issues: [], suggestions: [] });

      mockInterpretWithFallback.mockResolvedValue({
        content: JSON.stringify({ sheetNumber: 'M-101' }),
        interpretationProvider: 'claude-opus-4-6',
        processingTier: 'trade-focused',
        durationMs: 500,
        estimatedCost: 0.08,
      });

      await runTradeFocusedExtraction('doc-1', [{ type: 'trade', name: 'Mechanical' }]);

      expect(mockPrisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doc-1' },
          data: expect.objectContaining({
            tradeFocusRun: expect.arrayContaining(['Mechanical']),
          }),
        })
      );
    });

    it('merges new trade names with existing tradeFocusRun (deduplicates)', async () => {
      // Doc already had Mechanical run
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        tradeFocusRun: ['Mechanical'],
      });
      mockPrisma.documentChunk.findMany.mockResolvedValue([makeChunk()]);

      mockPerformQualityCheck
        .mockReturnValue({ score: 50, passed: true, issues: [], suggestions: [] });

      mockInterpretWithFallback.mockResolvedValue({
        content: JSON.stringify({ sheetNumber: 'M-101' }),
        interpretationProvider: 'claude-opus-4-6',
        processingTier: 'trade-focused',
        durationMs: 500,
        estimatedCost: 0.08,
      });

      await runTradeFocusedExtraction('doc-1', [{ type: 'trade', name: 'Mechanical' }]);

      const updateCall = mockPrisma.document.update.mock.calls[0][0];
      const tradeFocusRun: string[] = updateCall.data.tradeFocusRun;
      // Mechanical should only appear once
      expect(tradeFocusRun.filter(t => t === 'Mechanical')).toHaveLength(1);
    });
  });

  describe('graceful error handling per chunk', () => {
    it('continues processing other chunks when one fails', async () => {
      const chunk1 = { ...makeChunk(), id: 'chunk-1', pageNumber: 1, content: JSON.stringify({ sheetNumber: 'M-101' }) };
      const chunk2 = { ...makeChunk(), id: 'chunk-2', pageNumber: 2, content: JSON.stringify({ sheetNumber: 'M-102' }) };

      mockPrisma.documentChunk.findMany.mockResolvedValue([chunk1, chunk2]);

      mockPerformQualityCheck.mockReturnValue({ score: 40, passed: false, issues: [], suggestions: [] });

      // First chunk fails, second succeeds
      mockInterpretWithFallback
        .mockRejectedValueOnce(new Error('API error on chunk 1'))
        .mockResolvedValueOnce({
          content: JSON.stringify({ sheetNumber: 'M-102', hvacData: { ductwork: ['12x12'] } }),
          interpretationProvider: 'claude-opus-4-6',
          processingTier: 'trade-focused',
          durationMs: 600,
          estimatedCost: 0.08,
        });

      const result = await runTradeFocusedExtraction('doc-1', [{ type: 'trade', name: 'Mechanical' }]);

      // pagesProcessed includes all found chunks regardless of errors
      expect(result.pagesProcessed).toBe(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'TRADE_FOCUSED',
        expect.stringContaining('Failed for page 1'),
        expect.any(Object)
      );
    });

    it('skips chunks with non-parseable content', async () => {
      const badChunk = { ...makeChunk(), content: 'INVALID JSON {{{' };
      mockPrisma.documentChunk.findMany.mockResolvedValue([badChunk]);

      const result = await runTradeFocusedExtraction('doc-1', [{ type: 'trade', name: 'Mechanical' }]);

      expect(result.fieldsUpdated).toBe(0);
    });

    it('handles unparseable focused data by keeping qualityBefore score for that page', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValue([makeChunk()]);

      mockPerformQualityCheck
        .mockReturnValueOnce({ score: 40, passed: false, issues: [], suggestions: [] });

      mockInterpretWithFallback.mockResolvedValue({
        content: 'not valid json',
        interpretationProvider: 'claude-opus-4-6',
        processingTier: 'trade-focused',
        durationMs: 500,
        estimatedCost: 0.08,
      });

      const result = await runTradeFocusedExtraction('doc-1', [{ type: 'trade', name: 'Mechanical' }]);

      // qualityAfter should equal qualityBefore since the result was unusable
      expect(result.qualityAfter).toBe(result.qualityBefore);
    });
  });

  describe('cost tracking', () => {
    it('accumulates cost from all processed pages', async () => {
      const chunk1 = { ...makeChunk(), id: 'chunk-1', pageNumber: 1, content: JSON.stringify({ sheetNumber: 'M-101' }) };
      const chunk2 = { ...makeChunk(), id: 'chunk-2', pageNumber: 2, content: JSON.stringify({ sheetNumber: 'M-102' }) };

      mockPrisma.documentChunk.findMany.mockResolvedValue([chunk1, chunk2]);
      mockPrisma.documentChunk.update.mockResolvedValue({});

      mockPerformQualityCheck.mockReturnValue({ score: 50, passed: true, issues: [], suggestions: [] });

      mockInterpretWithFallback.mockResolvedValue({
        content: JSON.stringify({ sheetNumber: 'M-101', hvacData: { ductwork: ['12x12'] } }),
        interpretationProvider: 'claude-opus-4-6',
        processingTier: 'trade-focused',
        durationMs: 600,
        estimatedCost: 0.08,
      });

      const result = await runTradeFocusedExtraction('doc-1', [{ type: 'trade', name: 'Mechanical' }]);

      expect(result.cost).toBeCloseTo(0.16, 5);
    });
  });

  describe('discipline-specific plugin reference', () => {
    it('loads plugin extraction enhancement for the chunk discipline', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValue([makeChunk()]);

      mockGetPluginExtractionEnhancement.mockReturnValue('HVAC EXTRACTION RULES: ...');

      mockPerformQualityCheck.mockReturnValue({ score: 50, passed: true, issues: [], suggestions: [] });

      mockInterpretWithFallback.mockResolvedValue({
        content: JSON.stringify({ sheetNumber: 'M-101', hvacData: { ductwork: ['12x12'] } }),
        interpretationProvider: 'claude-opus-4-6',
        processingTier: 'trade-focused',
        durationMs: 500,
        estimatedCost: 0.08,
      });

      await runTradeFocusedExtraction('doc-1', [{ type: 'trade', name: 'Mechanical' }]);

      expect(mockGetPluginExtractionEnhancement).toHaveBeenCalledWith('Mechanical', expect.any(String));
      // The plugin reference should be included in additionalContext
      const callArgs = mockInterpretWithFallback.mock.calls[0];
      const options = callArgs[2];
      expect(options.additionalContext).toContain('HVAC EXTRACTION RULES:');
    });
  });
});
