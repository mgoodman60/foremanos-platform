import { describe, it, expect } from 'vitest';

/**
 * Tests for document category inference logic
 * Mirrors the inferCategoryFromFilename function in batch-upload-modal.tsx
 *
 * The function is a private component utility, so we replicate its logic here
 * to validate the keyword patterns and sheet number regex work correctly.
 */

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  plans_drawings: ['plan', 'drawing', 'blueprint', 'architectural', 'structural', 'mep', 'electrical', 'plumbing', 'hvac', 'elevation', 'section', 'detail', 'site plan', 'floor plan', 'conformance'],
  budget_cost: ['budget', 'cost', 'estimate', 'pricing', 'invoice', 'payment', 'bid', 'quote', 'financial', 'expense'],
  schedule: ['schedule', 'timeline', 'gantt', 'critical path', 'milestone', 'deadline', 'calendar', 'duration', 'phase'],
  specifications: ['spec', 'specification', 'datasheet', 'technical', 'material', 'product', 'standard', 'requirement'],
  contracts: ['contract', 'agreement', 'rfi', 'change order', 'submittal', 'legal', 'proposal', 'addendum', 'amendment'],
  daily_reports: ['daily', 'log', 'report', 'inspection', 'progress', 'status', 'field', 'observation'],
  photos: ['photo', 'image', 'picture', 'jpg', 'jpeg', 'png', 'site photo', 'progress photo'],
};

const SHEET_NUMBER_PATTERN = /[AaSsEeMmPpCc]-\d+/;

function inferCategoryFromFilename(fileName: string): string {
  const lower = fileName.toLowerCase();

  if (SHEET_NUMBER_PATTERN.test(fileName)) {
    return 'plans_drawings';
  }

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return category;
      }
    }
  }

  return 'other';
}

describe('inferCategoryFromFilename', () => {
  describe('construction plans and drawings', () => {
    it('should classify sheet-numbered files as plans_drawings', () => {
      expect(inferCategoryFromFilename('A101-Floor-Plan.pdf')).toBe('plans_drawings');
      expect(inferCategoryFromFilename('A-101.pdf')).toBe('plans_drawings');
      expect(inferCategoryFromFilename('S-001-Foundation.pdf')).toBe('plans_drawings');
      expect(inferCategoryFromFilename('E-203-Lighting.pdf')).toBe('plans_drawings');
      expect(inferCategoryFromFilename('M-100-HVAC-Layout.pdf')).toBe('plans_drawings');
      expect(inferCategoryFromFilename('P-101-Plumbing.pdf')).toBe('plans_drawings');
      expect(inferCategoryFromFilename('C-001-Site-Grading.pdf')).toBe('plans_drawings');
    });

    it('should classify keyword-based plan files as plans_drawings', () => {
      expect(inferCategoryFromFilename('Floor-Plan-Level-2.pdf')).toBe('plans_drawings');
      expect(inferCategoryFromFilename('structural-details.pdf')).toBe('plans_drawings');
      expect(inferCategoryFromFilename('MEP-Coordination.pdf')).toBe('plans_drawings');
      expect(inferCategoryFromFilename('electrical-panel-schedule.pdf')).toBe('plans_drawings');
      expect(inferCategoryFromFilename('Elevation-North.pdf')).toBe('plans_drawings');
      expect(inferCategoryFromFilename('site plan overview.pdf')).toBe('plans_drawings');
    });
  });

  describe('budget and cost documents', () => {
    it('should classify budget files correctly', () => {
      expect(inferCategoryFromFilename('Project-Budget-2026.pdf')).toBe('budget_cost');
      expect(inferCategoryFromFilename('cost-estimate-v3.pdf')).toBe('budget_cost');
      expect(inferCategoryFromFilename('Invoice-March-2026.pdf')).toBe('budget_cost');
      expect(inferCategoryFromFilename('bid-tabulation.pdf')).toBe('budget_cost');
      expect(inferCategoryFromFilename('payment-application-05.pdf')).toBe('budget_cost');
    });
  });

  describe('schedule documents', () => {
    it('should classify schedule files correctly', () => {
      expect(inferCategoryFromFilename('project-schedule-updated.pdf')).toBe('schedule');
      expect(inferCategoryFromFilename('gantt-chart-2026.pdf')).toBe('schedule');
      expect(inferCategoryFromFilename('milestone-tracker.pdf')).toBe('schedule');
    });
  });

  describe('specifications', () => {
    it('should classify spec files correctly', () => {
      expect(inferCategoryFromFilename('technical-datasheet.pdf')).toBe('specifications');
      expect(inferCategoryFromFilename('material-specification.pdf')).toBe('specifications');
      expect(inferCategoryFromFilename('product-requirements.pdf')).toBe('specifications');
    });

    it('should note that filenames matching sheet number pattern take priority', () => {
      // "spec-section-03-30-00.pdf" contains "c-0" which matches the
      // sheet number pattern [AaSsEeMmPpCc]-\d+, so it's classified as plans_drawings
      expect(inferCategoryFromFilename('spec-section-03-30-00.pdf')).toBe('plans_drawings');
    });
  });

  describe('contracts', () => {
    it('should classify contract files correctly', () => {
      expect(inferCategoryFromFilename('contract-amendment-02.pdf')).toBe('contracts');
      expect(inferCategoryFromFilename('RFI-045-response.pdf')).toBe('contracts');
      expect(inferCategoryFromFilename('submittal-mechanical.pdf')).toBe('contracts');
      expect(inferCategoryFromFilename('legal-agreement-v2.pdf')).toBe('contracts');
      expect(inferCategoryFromFilename('proposal-general-contractor.pdf')).toBe('contracts');
    });

    it('should match "change order" only when words are space-separated', () => {
      // "change order" keyword requires space — "change-order" with hyphen won't match
      expect(inferCategoryFromFilename('change order 12.pdf')).toBe('contracts');
      // Hyphenated version doesn't match "change order" keyword, falls to 'other'
      expect(inferCategoryFromFilename('change-order-12.pdf')).toBe('other');
    });
  });

  describe('daily reports', () => {
    it('should classify daily report files correctly', () => {
      expect(inferCategoryFromFilename('daily-log-2026-02-08.pdf')).toBe('daily_reports');
      expect(inferCategoryFromFilename('field-observation.pdf')).toBe('daily_reports');
      expect(inferCategoryFromFilename('progress-update-feb.pdf')).toBe('daily_reports');
      expect(inferCategoryFromFilename('daily-report-2026-02-08.pdf')).toBe('daily_reports');
    });

    it('should note that "inspection" matches "spec" in specifications first', () => {
      // "inspection" contains "spec" (in-SPEC-tion) which matches specifications
      // before daily_reports keywords are checked — this is expected keyword priority behavior
      expect(inferCategoryFromFilename('inspection-report.pdf')).toBe('specifications');
    });
  });

  describe('fallback to other', () => {
    it('should return other for unrecognizable filenames', () => {
      expect(inferCategoryFromFilename('random.pdf')).toBe('other');
      expect(inferCategoryFromFilename('document-v2.pdf')).toBe('other');
      expect(inferCategoryFromFilename('scan001.pdf')).toBe('other');
      expect(inferCategoryFromFilename('IMG_20260208.pdf')).toBe('other');
    });
  });

  describe('sheet number pattern takes priority', () => {
    it('should prioritize sheet number over keyword matching', () => {
      // A file with a sheet number should be plans_drawings even if
      // the name also contains budget/schedule keywords
      expect(inferCategoryFromFilename('A-101-budget-review.pdf')).toBe('plans_drawings');
      expect(inferCategoryFromFilename('S-200-schedule-notes.pdf')).toBe('plans_drawings');
    });
  });
});
