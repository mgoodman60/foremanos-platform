import { describe, it, expect } from 'vitest';
import { generateQualityQuestions } from '@/lib/quality-question-generator';
import type { ExtractedData, QualityCheckResult } from '@/lib/vision-api-quality';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQuality(score: number, issues: string[] = []): QualityCheckResult {
  return { passed: score >= 50, score, issues, suggestions: [] };
}

function makeData(overrides: Partial<ExtractedData> = {}): ExtractedData {
  return {
    sheetNumber: 'A-101',
    sheetTitle: 'Ground Floor Plan',
    scale: '1/4"=1\'-0"',
    discipline: 'Architectural',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateQualityQuestions', () => {
  describe('sheet number question', () => {
    it('generates a free_text question for sheet number when the issue mentions "sheet number"', () => {
      const data = makeData({ sheetNumber: '' });
      const quality = makeQuality(30, ['Missing or invalid sheet number']);

      const questions = generateQualityQuestions(data, quality, 5, 'Architectural');

      const q = questions.find(q => q.field === 'sheetNumber');
      expect(q).toBeDefined();
      expect(q!.questionType).toBe('free_text');
      expect(q!.questionText).toContain('5'); // page number
      expect(q!.generatedFrom).toBe('quality_check');
    });

    it('does not generate sheet number question when issue list does not mention it', () => {
      const data = makeData();
      const quality = makeQuality(60, ['Insufficient content extracted']);

      const questions = generateQualityQuestions(data, quality, 1, 'Architectural');

      expect(questions.find(q => q.field === 'sheetNumber')).toBeUndefined();
    });
  });

  describe('scale question', () => {
    it('generates a multiple_choice question with common scales for scale issues', () => {
      const data = makeData({ scale: '' });
      const quality = makeQuality(35, ['Missing or invalid scale information']);

      const questions = generateQualityQuestions(data, quality, 3, 'Architectural');

      const q = questions.find(q => q.field === 'scale');
      expect(q).toBeDefined();
      expect(q!.questionType).toBe('multiple_choice');
      expect(Array.isArray(q!.options)).toBe(true);
      expect(q!.options!.length).toBeGreaterThan(0);
      // Should include common drawing scales
      expect(q!.options).toContain('As Noted');
    });
  });

  describe('ambiguous discipline question', () => {
    it('generates a multiple_choice discipline question when discipline is Unknown', () => {
      const data = makeData({ discipline: 'Unknown' });
      const quality = makeQuality(60, []);

      const questions = generateQualityQuestions(data, quality, 2, 'Unknown');

      const q = questions.find(q => q.field === 'discipline');
      expect(q).toBeDefined();
      expect(q!.questionType).toBe('multiple_choice');
      expect(q!.options).toContain('Architectural');
      expect(q!.options).toContain('Mechanical');
      expect(q!.options).toContain('Electrical');
    });

    it('generates discipline question when discipline is N/A', () => {
      const data = makeData({ discipline: 'N/A' });
      const quality = makeQuality(55, []);

      const questions = generateQualityQuestions(data, quality, 4, 'Unknown');

      expect(questions.find(q => q.field === 'discipline')).toBeDefined();
    });

    it('generates discipline question when discipline is missing', () => {
      const data = makeData({ discipline: undefined });
      const quality = makeQuality(55, []);

      const questions = generateQualityQuestions(data, quality, 4, 'Unknown');

      expect(questions.find(q => q.field === 'discipline')).toBeDefined();
    });

    it('includes sheet number in discipline question text when sheetNumber is present', () => {
      const data = makeData({ discipline: 'Unknown', sheetNumber: 'M-201' });
      const quality = makeQuality(55, []);

      const questions = generateQualityQuestions(data, quality, 2, 'Unknown');

      const q = questions.find(q => q.field === 'discipline');
      expect(q!.questionText).toContain('M-201');
    });

    it('does not generate discipline question when discipline is already set', () => {
      const data = makeData({ discipline: 'Structural' });
      const quality = makeQuality(60, []);

      const questions = generateQualityQuestions(data, quality, 1, 'Structural');

      expect(questions.find(q => q.field === 'discipline')).toBeUndefined();
    });
  });

  describe('drawing type question', () => {
    it('generates multiple_choice drawingType question for structural element issues', () => {
      const data = makeData();
      const quality = makeQuality(40, ['No structural elements detected']);

      const questions = generateQualityQuestions(data, quality, 1, 'Architectural');

      const q = questions.find(q => q.field === 'drawingType');
      expect(q).toBeDefined();
      expect(q!.questionType).toBe('multiple_choice');
      expect(q!.options).toContain('Floor Plan');
      expect(q!.options).toContain('Detail');
    });
  });

  describe('max 5 questions per page', () => {
    it('limits output to 5 questions even when many issues are present', () => {
      const data = makeData({ discipline: 'Unknown', sheetNumber: '', scale: '' });
      const quality = makeQuality(0, [
        'Missing or invalid sheet number',
        'Missing or invalid sheet title',
        'Missing or invalid scale information',
        'No structural elements detected',
        'Insufficient content extracted',
        'Some other issue',
      ]);

      const questions = generateQualityQuestions(data, quality, 1, 'Unknown');

      expect(questions.length).toBeLessThanOrEqual(5);
    });

    it('never returns more than 5 questions', () => {
      const data = makeData({ discipline: 'Unknown', sheetNumber: '', scale: '' });
      const quality = makeQuality(5, [
        'Missing or invalid sheet number',
        'Missing or invalid scale information',
        'No structural elements detected',
      ]);

      // Score < 20 triggers dead_letter extra question
      const questions = generateQualityQuestions(data, quality, 1, 'Unknown');

      expect(questions.length).toBeLessThanOrEqual(5);
    });
  });

  describe('dead letter pages', () => {
    it('marks questions with generatedFrom: "dead_letter" when score < 20', () => {
      const data = makeData({ sheetNumber: '', scale: '' });
      const quality = makeQuality(10, ['Missing or invalid sheet number', 'Missing or invalid scale information']);

      const questions = generateQualityQuestions(data, quality, 1, 'Unknown');

      // All questions should be tagged dead_letter
      expect(questions.every(q => q.generatedFrom === 'dead_letter')).toBe(true);
    });

    it('adds a blank/cover page question for dead letter pages', () => {
      const data = makeData({ discipline: 'Unknown', sheetNumber: '' });
      const quality = makeQuality(5, ['Missing or invalid sheet number']);

      const questions = generateQualityQuestions(data, quality, 7, 'Unknown');

      const blankQ = questions.find(q => q.field === '_isBlankPage');
      expect(blankQ).toBeDefined();
      expect(blankQ!.questionType).toBe('multiple_choice');
      expect(blankQ!.options).toContain('Blank page');
      expect(blankQ!.options).toContain('Has drawing content');
    });

    it('does NOT add blank page question when score >= 20 (normal page)', () => {
      const data = makeData();
      const quality = makeQuality(20, []);

      const questions = generateQualityQuestions(data, quality, 1, 'Architectural');

      expect(questions.find(q => q.field === '_isBlankPage')).toBeUndefined();
    });
  });

  describe('generatedFrom tagging', () => {
    it('tags regular questions as "quality_check" when score >= 20', () => {
      const data = makeData({ sheetNumber: '' });
      const quality = makeQuality(25, ['Missing or invalid sheet number']);

      const questions = generateQualityQuestions(data, quality, 1, 'Architectural');

      const q = questions.find(q => q.field === 'sheetNumber');
      expect(q!.generatedFrom).toBe('quality_check');
    });
  });

  describe('page number in questions', () => {
    it('includes the correct page number in question text', () => {
      const data = makeData({ sheetNumber: '' });
      const quality = makeQuality(25, ['Missing or invalid sheet number']);

      const questions = generateQualityQuestions(data, quality, 42, 'Architectural');

      const q = questions.find(q => q.field === 'sheetNumber');
      expect(q!.pageNumber).toBe(42);
      expect(q!.questionText).toContain('42');
    });
  });

  describe('empty issues list', () => {
    it('returns no questions when issues are empty and discipline is known', () => {
      const data = makeData({ discipline: 'Architectural' });
      const quality = makeQuality(80, []);

      const questions = generateQualityQuestions(data, quality, 1, 'Architectural');

      expect(questions).toHaveLength(0);
    });
  });

  describe('sheet title question', () => {
    it('generates a free_text sheet title question for title issues', () => {
      const data = makeData({ sheetTitle: '' });
      const quality = makeQuality(30, ['Missing or invalid sheet title']);

      const questions = generateQualityQuestions(data, quality, 9, 'Architectural');

      const q = questions.find(q => q.field === 'sheetTitle');
      expect(q).toBeDefined();
      expect(q!.questionType).toBe('free_text');
      expect(q!.questionText).toContain('9');
    });
  });
});
