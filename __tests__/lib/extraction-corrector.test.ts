import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (vi.hoisted ensures they are hoisted before module imports)
// ---------------------------------------------------------------------------

const mockInterpretWithFallback = vi.hoisted(() => vi.fn());
const mockPerformQualityCheck = vi.hoisted(() => vi.fn());
const mockLoadValidationChecklist = vi.hoisted(() => vi.fn());
const mockGetPluginExtractionEnhancement = vi.hoisted(() => vi.fn());
const mockNormalizeExtractedData = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/interpretation-service', () => ({
  interpretWithFallback: mockInterpretWithFallback,
}));

vi.mock('@/lib/vision-api-quality', () => ({
  performQualityCheck: mockPerformQualityCheck,
}));

vi.mock('@/lib/plugin', () => ({
  loadValidationChecklist: mockLoadValidationChecklist,
  getPluginExtractionEnhancement: mockGetPluginExtractionEnhancement,
}));

vi.mock('@/lib/data-normalizer', () => ({
  normalizeExtractedData: mockNormalizeExtractedData,
}));

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

// Import after mocking
import { correctExtraction } from '@/lib/extraction-corrector';
import type { ExtractedData, QualityCheckResult } from '@/lib/vision-api-quality';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQualityResult(score: number, issues: string[] = [], suggestions: string[] = []): QualityCheckResult {
  return { passed: score >= 50, score, issues, suggestions };
}

function makeExtractedData(overrides: Partial<ExtractedData> = {}): ExtractedData {
  return {
    sheetNumber: 'A-101',
    sheetTitle: 'Ground Floor Plan',
    scale: '1/4"=1\'-0"',
    discipline: 'Architectural',
    drawingType: 'Floor Plan',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('correctExtraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default plugin mocks — return nothing so the prompt skips those sections
    mockLoadValidationChecklist.mockReturnValue(null);
    mockGetPluginExtractionEnhancement.mockReturnValue(null);
  });

  describe('success case — quality improves', () => {
    it('returns improved: true when corrected quality score exceeds original', async () => {
      const original = makeExtractedData();
      const qualityResult = makeQualityResult(40, ['Missing sheet number']);

      const correctedJson = JSON.stringify({ ...original, sheetNumber: 'A-102' });

      mockInterpretWithFallback.mockResolvedValue({
        content: correctedJson,
        interpretationProvider: 'claude-opus-4-6',
        processingTier: 'correction',
        durationMs: 1200,
        estimatedCost: 0.08,
      });

      const normalizedData = { ...original, sheetNumber: 'A-102' };
      mockNormalizeExtractedData.mockReturnValue({
        normalizedData,
        changesApplied: ['N4: Inferred discipline'],
        fieldsFixed: 1,
      });

      mockPerformQualityCheck.mockReturnValue(makeQualityResult(75));

      const result = await correctExtraction(original, qualityResult, 1, 'Architectural');

      expect(result.improved).toBe(true);
      expect(result.qualityBefore).toBe(40);
      expect(result.qualityAfter).toBe(75);
      expect(result.correctionProvider).toBe('claude-opus-4-6');
    });

    it('returns before/after quality scores in the result', async () => {
      const original = makeExtractedData();
      const qualityResult = makeQualityResult(35);

      mockInterpretWithFallback.mockResolvedValue({
        content: JSON.stringify(original),
        interpretationProvider: 'gpt-5.2',
        processingTier: 'correction-gpt-fallback',
        durationMs: 900,
        estimatedCost: 0.03,
      });

      mockNormalizeExtractedData.mockReturnValue({
        normalizedData: original,
        changesApplied: [],
        fieldsFixed: 0,
      });

      mockPerformQualityCheck.mockReturnValue(makeQualityResult(60));

      const result = await correctExtraction(original, qualityResult, 3, 'Architectural');

      expect(result.qualityBefore).toBe(35);
      expect(result.qualityAfter).toBe(60);
    });

    it('returns normalizationsApplied from the normalizer', async () => {
      const original = makeExtractedData();
      const qualityResult = makeQualityResult(30);
      const changes = ['N4: Inferred discipline from sheet A-101: Architectural', 'N7: Normalized date'];

      mockInterpretWithFallback.mockResolvedValue({
        content: JSON.stringify(original),
        interpretationProvider: 'claude-opus-4-6',
        processingTier: 'correction',
        durationMs: 800,
        estimatedCost: 0.08,
      });

      mockNormalizeExtractedData.mockReturnValue({
        normalizedData: original,
        changesApplied: changes,
        fieldsFixed: 2,
      });

      mockPerformQualityCheck.mockReturnValue(makeQualityResult(65));

      const result = await correctExtraction(original, qualityResult, 1, 'Architectural');

      expect(result.normalizationsApplied).toEqual(changes);
    });

    it('includes estimatedCost from the interpretation result', async () => {
      const original = makeExtractedData();
      const qualityResult = makeQualityResult(30);

      mockInterpretWithFallback.mockResolvedValue({
        content: JSON.stringify(original),
        interpretationProvider: 'claude-opus-4-6',
        processingTier: 'correction',
        durationMs: 500,
        estimatedCost: 0.08,
      });

      mockNormalizeExtractedData.mockReturnValue({
        normalizedData: original,
        changesApplied: [],
        fieldsFixed: 0,
      });

      mockPerformQualityCheck.mockReturnValue(makeQualityResult(70));

      const result = await correctExtraction(original, qualityResult, 1, 'Architectural');

      expect(result.estimatedCost).toBe(0.08);
    });
  });

  describe('success case — quality does not improve', () => {
    it('returns improved: false when corrected quality equals original score', async () => {
      const original = makeExtractedData();
      const qualityResult = makeQualityResult(60);

      mockInterpretWithFallback.mockResolvedValue({
        content: JSON.stringify(original),
        interpretationProvider: 'claude-opus-4-6',
        processingTier: 'correction',
        durationMs: 700,
        estimatedCost: 0.08,
      });

      mockNormalizeExtractedData.mockReturnValue({
        normalizedData: original,
        changesApplied: [],
        fieldsFixed: 0,
      });

      // Same score — not improved
      mockPerformQualityCheck.mockReturnValue(makeQualityResult(60));

      const result = await correctExtraction(original, qualityResult, 1, 'Architectural');

      expect(result.improved).toBe(false);
    });

    it('returns improved: false when corrected quality is lower', async () => {
      const original = makeExtractedData();
      const qualityResult = makeQualityResult(70);

      mockInterpretWithFallback.mockResolvedValue({
        content: JSON.stringify(original),
        interpretationProvider: 'gpt-5.2',
        processingTier: 'correction-gpt-fallback',
        durationMs: 600,
        estimatedCost: 0.03,
      });

      mockNormalizeExtractedData.mockReturnValue({
        normalizedData: original,
        changesApplied: [],
        fieldsFixed: 0,
      });

      mockPerformQualityCheck.mockReturnValue(makeQualityResult(50));

      const result = await correctExtraction(original, qualityResult, 2, 'Electrical');

      expect(result.improved).toBe(false);
      expect(result.qualityBefore).toBe(70);
      expect(result.qualityAfter).toBe(50);
    });
  });

  describe('parse failure fallback', () => {
    it('returns original data with improved: false when corrected JSON is unparseable', async () => {
      const original = makeExtractedData();
      const qualityResult = makeQualityResult(40);

      mockInterpretWithFallback.mockResolvedValue({
        content: 'not valid json {{{',
        interpretationProvider: 'claude-opus-4-6',
        processingTier: 'correction',
        durationMs: 400,
        estimatedCost: 0.08,
      });

      const result = await correctExtraction(original, qualityResult, 1, 'Architectural');

      expect(result.improved).toBe(false);
      expect(result.correctedData).toEqual(original);
      expect(result.qualityBefore).toBe(40);
      expect(result.qualityAfter).toBe(40);
      expect(result.normalizationsApplied).toEqual([]);
    });
  });

  describe('timeout handling', () => {
    it('throws an error with message "timeout" when interpretation times out', async () => {
      const original = makeExtractedData();
      const qualityResult = makeQualityResult(30);

      // The source detects abort/Abort in the message and re-throws as Error('timeout')
      const abortError = new Error('AbortError: The operation was aborted');
      mockInterpretWithFallback.mockRejectedValue(abortError);

      await expect(
        correctExtraction(original, qualityResult, 1, 'Architectural', { timeout: 1 })
      ).rejects.toThrow('timeout');
    });

    it('uses 30s timeout by default when no timeout option is provided', async () => {
      const original = makeExtractedData();
      const qualityResult = makeQualityResult(40);

      mockInterpretWithFallback.mockResolvedValue({
        content: JSON.stringify(original),
        interpretationProvider: 'claude-opus-4-6',
        processingTier: 'correction',
        durationMs: 800,
        estimatedCost: 0.08,
      });

      mockNormalizeExtractedData.mockReturnValue({
        normalizedData: original,
        changesApplied: [],
        fieldsFixed: 0,
      });

      mockPerformQualityCheck.mockReturnValue(makeQualityResult(60));

      // Should not throw — just verifying the default path works
      const result = await correctExtraction(original, qualityResult, 1, 'Architectural');
      expect(result).toBeDefined();
    });
  });

  describe('plugin validation checklist and rules', () => {
    it('loads and includes plugin validation checklist in the correction prompt', async () => {
      const original = makeExtractedData();
      const qualityResult = makeQualityResult(30, ['Missing sheet number']);

      mockLoadValidationChecklist.mockReturnValue('CHECKLIST: 1. Verify sheet number 2. Verify scale');
      mockGetPluginExtractionEnhancement.mockReturnValue(null);

      mockInterpretWithFallback.mockResolvedValue({
        content: JSON.stringify(original),
        interpretationProvider: 'claude-opus-4-6',
        processingTier: 'correction',
        durationMs: 800,
        estimatedCost: 0.08,
      });

      mockNormalizeExtractedData.mockReturnValue({
        normalizedData: original,
        changesApplied: [],
        fieldsFixed: 0,
      });

      mockPerformQualityCheck.mockReturnValue(makeQualityResult(60));

      await correctExtraction(original, qualityResult, 1, 'Architectural');

      expect(mockLoadValidationChecklist).toHaveBeenCalledOnce();
      expect(mockInterpretWithFallback).toHaveBeenCalledWith(
        expect.any(String),
        1,
        expect.objectContaining({
          additionalContext: expect.stringContaining('CHECKLIST:'),
        })
      );
    });

    it('loads and includes discipline-specific extraction rules in the correction prompt', async () => {
      const original = makeExtractedData({ discipline: 'Mechanical' });
      const qualityResult = makeQualityResult(30, ['Missing HVAC data']);

      mockLoadValidationChecklist.mockReturnValue(null);
      mockGetPluginExtractionEnhancement.mockReturnValue('MEP EXTRACTION RULES: Extract duct sizes...');

      mockInterpretWithFallback.mockResolvedValue({
        content: JSON.stringify(original),
        interpretationProvider: 'claude-opus-4-6',
        processingTier: 'correction',
        durationMs: 800,
        estimatedCost: 0.08,
      });

      mockNormalizeExtractedData.mockReturnValue({
        normalizedData: original,
        changesApplied: [],
        fieldsFixed: 0,
      });

      mockPerformQualityCheck.mockReturnValue(makeQualityResult(55));

      await correctExtraction(original, qualityResult, 2, 'Mechanical');

      expect(mockGetPluginExtractionEnhancement).toHaveBeenCalledWith('Mechanical', 'Floor Plan');
      expect(mockInterpretWithFallback).toHaveBeenCalledWith(
        expect.any(String),
        2,
        expect.objectContaining({
          additionalContext: expect.stringContaining('MEP EXTRACTION RULES:'),
        })
      );
    });

    it('passes quality issues into the correction prompt', async () => {
      const original = makeExtractedData();
      const qualityResult = makeQualityResult(25, ['Missing sheet number', 'No structural elements detected']);

      mockInterpretWithFallback.mockResolvedValue({
        content: JSON.stringify(original),
        interpretationProvider: 'claude-opus-4-6',
        processingTier: 'correction',
        durationMs: 800,
        estimatedCost: 0.08,
      });

      mockNormalizeExtractedData.mockReturnValue({
        normalizedData: original,
        changesApplied: [],
        fieldsFixed: 0,
      });

      mockPerformQualityCheck.mockReturnValue(makeQualityResult(50));

      await correctExtraction(original, qualityResult, 1, 'Architectural');

      const callArgs = mockInterpretWithFallback.mock.calls[0];
      const options = callArgs[2];
      expect(options.additionalContext).toContain('Missing sheet number');
      expect(options.additionalContext).toContain('No structural elements detected');
    });
  });

  describe('correctionDuration', () => {
    it('returns a positive correctionDuration in milliseconds', async () => {
      const original = makeExtractedData();
      const qualityResult = makeQualityResult(40);

      mockInterpretWithFallback.mockResolvedValue({
        content: JSON.stringify(original),
        interpretationProvider: 'claude-opus-4-6',
        processingTier: 'correction',
        durationMs: 500,
        estimatedCost: 0.08,
      });

      mockNormalizeExtractedData.mockReturnValue({
        normalizedData: original,
        changesApplied: [],
        fieldsFixed: 0,
      });

      mockPerformQualityCheck.mockReturnValue(makeQualityResult(65));

      const result = await correctExtraction(original, qualityResult, 1, 'Architectural');

      expect(result.correctionDuration).toBeGreaterThanOrEqual(0);
    });
  });
});
