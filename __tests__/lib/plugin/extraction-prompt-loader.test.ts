import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── fs mock ─────────────────────────────────────────────────────────────────
const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('fs', () => ({
  default: mockFs,
  existsSync: mockFs.existsSync,
  readFileSync: mockFs.readFileSync,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  isExtractionPluginAvailable,
  getPluginExtractionEnhancement,
  loadAlertThresholds,
  loadValidationChecklist,
  loadCrossReferencePatterns,
  invalidateExtractionCache,
} from '@/lib/plugin/extraction-prompt-loader';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_EXTRACTION_RULES = `# Extraction Rules

## Core Principles
Always extract materials, dimensions, and spec references from construction drawings.

## Deep Extraction
Pay attention to revision clouds, general notes, and keynote legends.`;

const MOCK_PLANS_DEEP_EXTRACTION = `# Plans Deep Extraction Reference

## Architectural Drawing Extraction
Extract room numbers, door schedules, finish schedules, and partition types.

## Keynotes
Resolve all keynotes from the general notes sheet.`;

const MOCK_ALERT_THRESHOLDS_MD = `# Alert Thresholds

### 1.1 SPI
Schedule Performance Index thresholds.
Healthy: ≥0.95
Warning: 0.90–0.95

### 1.2 CPI
Cost Performance Index thresholds.

### 1.3 FPIR
First Pass Inspection Rate.

### 1.4 TRIR
Total Recordable Incident Rate.

### 1.5 PPC
Percent Plan Complete.`;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('extraction-prompt-loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateExtractionCache();
  });

  afterEach(() => {
    invalidateExtractionCache();
  });

  // ── isExtractionPluginAvailable ───────────────────────────────────────────────

  describe('isExtractionPluginAvailable', () => {
    it('returns true when document-intelligence references directory exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      expect(isExtractionPluginAvailable()).toBe(true);
    });

    it('returns false when the directory is missing', () => {
      mockFs.existsSync.mockReturnValue(false);
      expect(isExtractionPluginAvailable()).toBe(false);
    });
  });

  // ── getPluginExtractionEnhancement ───────────────────────────────────────────

  describe('getPluginExtractionEnhancement', () => {
    it('returns null when plugin is unavailable', () => {
      mockFs.existsSync.mockReturnValue(false);

      const enhancement = getPluginExtractionEnhancement('Architectural', 'floor_plan');
      expect(enhancement).toBeNull();
    });

    it('returns an enhancement string for Architectural discipline', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(MOCK_PLANS_DEEP_EXTRACTION);

      const enhancement = getPluginExtractionEnhancement('Architectural', 'floor_plan');
      expect(enhancement).toBeTruthy();
      expect(typeof enhancement).toBe('string');
      expect(enhancement).toContain('ENHANCED EXTRACTION RULES');
    });

    it('includes the discipline and drawing type in the enhancement header', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(MOCK_PLANS_DEEP_EXTRACTION);

      const enhancement = getPluginExtractionEnhancement('Electrical', 'one_line_diagram');
      expect(enhancement).toContain('Electrical');
      expect(enhancement).toContain('one_line_diagram');
    });

    it('returns null for a known discipline when reference file is missing', () => {
      mockFs.existsSync.mockImplementation((p: string) => {
        // plugin dir exists but the specific ref file does not
        return !String(p).includes('plans-deep-extraction.md');
      });

      const enhancement = getPluginExtractionEnhancement('Architectural', 'floor_plan');
      expect(enhancement).toBeNull();
    });

    it('falls back to master extraction rules for unmapped disciplines', () => {
      mockFs.existsSync.mockReturnValue(true);
      // existsSync returns true so the refs dir is "available"
      // readFileSync returns the master extraction rules
      mockFs.readFileSync.mockReturnValue(MOCK_EXTRACTION_RULES);

      const enhancement = getPluginExtractionEnhancement('UnknownDiscipline', 'detail');
      // Should use the master extraction rules as fallback
      expect(enhancement).not.toBeNull();
    });

    it('returns null for unmapped discipline when extraction-rules.md is also missing', () => {
      mockFs.existsSync.mockImplementation(() => false);

      const enhancement = getPluginExtractionEnhancement('UnknownDiscipline', 'detail');
      expect(enhancement).toBeNull();
    });

    it('caches the result on subsequent calls', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(MOCK_PLANS_DEEP_EXTRACTION);

      getPluginExtractionEnhancement('Architectural', 'floor_plan');
      getPluginExtractionEnhancement('Architectural', 'floor_plan');

      // readFileSync should be called once (second is cached)
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
    });
  });

  // ── loadAlertThresholds ───────────────────────────────────────────────────────

  describe('loadAlertThresholds', () => {
    it('returns null when alert-thresholds.md does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const thresholds = loadAlertThresholds();
      expect(thresholds).toBeNull();
    });

    it('returns an AlertThresholds object with expected keys', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(MOCK_ALERT_THRESHOLDS_MD);

      const thresholds = loadAlertThresholds();
      expect(thresholds).not.toBeNull();
      expect(thresholds).toHaveProperty('spi');
      expect(thresholds).toHaveProperty('cpi');
      expect(thresholds).toHaveProperty('fpir');
      expect(thresholds).toHaveProperty('trir');
      expect(thresholds).toHaveProperty('ppc');
    });

    it('returns structured tier values for SPI', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(MOCK_ALERT_THRESHOLDS_MD);

      const thresholds = loadAlertThresholds();
      expect(thresholds?.spi).not.toBeNull();
      expect(thresholds?.spi?.healthy).toHaveProperty('min');
      expect(thresholds?.spi?.healthy).toHaveProperty('max');
    });

    it('returns null when readFileSync throws an error', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => { throw new Error('Permission denied'); });

      const thresholds = loadAlertThresholds();
      expect(thresholds).toBeNull();
    });
  });

  // ── loadValidationChecklist ───────────────────────────────────────────────────

  describe('loadValidationChecklist', () => {
    it('returns checklist content when file exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('# Validation Checklist\n\n- Check rooms\n- Check dims');

      const checklist = loadValidationChecklist();
      expect(checklist).toContain('Validation Checklist');
    });

    it('returns null when checklist and fallback are both missing', () => {
      mockFs.existsSync.mockReturnValue(false);

      const checklist = loadValidationChecklist();
      expect(checklist).toBeNull();
    });
  });

  // ── loadCrossReferencePatterns ────────────────────────────────────────────────

  describe('loadCrossReferencePatterns', () => {
    it('returns cross reference patterns when file exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('# Cross Reference Patterns\n\n## Pattern 1\nMatch doors to door schedule.');

      const patterns = loadCrossReferencePatterns();
      expect(patterns).toContain('Cross Reference Patterns');
    });

    it('returns null when file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const patterns = loadCrossReferencePatterns();
      expect(patterns).toBeNull();
    });
  });

  // ── invalidateExtractionCache ─────────────────────────────────────────────────

  describe('invalidateExtractionCache', () => {
    it('forces a fresh file read after cache is cleared', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(MOCK_PLANS_DEEP_EXTRACTION);

      getPluginExtractionEnhancement('Architectural', 'floor_plan'); // populate cache
      invalidateExtractionCache();
      getPluginExtractionEnhancement('Architectural', 'floor_plan'); // should re-read

      expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });
});
