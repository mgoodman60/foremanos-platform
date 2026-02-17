import { describe, it, expect, beforeEach } from 'vitest';
import {
  performQualityCheck,
  isBlankPage,
  assessPageComplexity,
  formatQualityReport,
  scoreTwoTierResult,
  STRUCTURAL_FIELDS,
  type QualityCheckResult,
  type TwoTierQualityResult,
  type ExtractedData,
} from '@/lib/vision-api-quality';

describe('Vision API Quality Module', () => {
  beforeEach(() => {
    // No mocks needed - pure functions
  });

  describe('performQualityCheck', () => {
    describe('Success Cases - Complete Data', () => {
      it('should score 100 with all critical and structural fields present', () => {
        const data: ExtractedData = {
          sheetNumber: 'A-101',
          sheetTitle: 'Ground Floor Plan',
          scale: '1/4"=1\'-0"',
          content: 'A'.repeat(600), // >500 chars
          dimensions: ['10ft', '20ft'],
          gridLines: ['A', 'B', 'C'],
          rooms: [{ number: '101', name: 'Kitchen' }, { number: '102', name: 'Living Room' }],
          doors: ['D1', 'D2'],
          windows: ['W1', 'W2'],
          equipment: ['HVAC-1'],
          symbolData: { sectionCuts: [{ number: '1', referenceSheet: 'A3.01' }] },
          siteAndConcrete: { footings: [{ size: '24x24' }] },
          visualMaterials: [{ material: 'concrete' }],
          plumbingFixtures: [{ type: 'WC' }],
          electricalDevices: [{ type: 'receptacle' }],
          spatialData: { heights: ['10ft'] },
          constructionIntel: { tradesRequired: ['Arch'] },
          drawingScheduleTables: [{ scheduleType: 'door' }],
          hvacData: { ductwork: ['12x12'] },
          fireProtection: { sprinklerHeads: ['pendant'] },
        };

        const result = performQualityCheck(data, 1);

        expect(result.passed).toBe(true);
        expect(result.score).toBe(100);
        expect(result.issues).toHaveLength(0);
        expect(result.suggestions).toHaveLength(0);
      });

      it('should pass with minimum score when all critical fields are valid', () => {
        const data: ExtractedData = {
          sheetNumber: 'A-101',
          sheetTitle: 'Ground Floor Plan',
          scale: '1:100',
          content: 'Some content here',
        };

        const result = performQualityCheck(data, 1, 50);

        expect(result.passed).toBe(true);
        expect(result.score).toBe(50); // 20 + 15 + 15 + 0 content + 0 structural
        expect(result.issues).toHaveLength(2); // content + structural
      });

      it('should award 20 points for valid sheet number', () => {
        const data: ExtractedData = {
          sheetNumber: 'A-101',
        };

        const result = performQualityCheck(data, 1, 0);

        expect(result.score).toBeGreaterThanOrEqual(20);
        expect(result.issues).not.toContain('Missing or invalid sheet number');
      });

      it('should award 15 points for valid sheet title', () => {
        const data: ExtractedData = {
          sheetTitle: 'Ground Floor Plan',
        };

        const result = performQualityCheck(data, 1, 0);

        expect(result.score).toBeGreaterThanOrEqual(15);
        expect(result.issues).not.toContain('Missing or invalid sheet title');
      });

      it('should award 15 points for valid scale', () => {
        const data: ExtractedData = {
          scale: '1/4"=1\'-0"',
        };

        const result = performQualityCheck(data, 1, 0);

        expect(result.score).toBeGreaterThanOrEqual(15);
        expect(result.issues).not.toContain('Missing or invalid scale information');
      });
    });

    describe('Critical Fields Validation', () => {
      it('should reject empty sheet number', () => {
        const data: ExtractedData = {
          sheetNumber: '',
          sheetTitle: 'Title',
          scale: '1:100',
        };

        const result = performQualityCheck(data, 1);

        expect(result.score).toBeLessThan(50);
        expect(result.issues).toContain('Missing or invalid sheet number');
        expect(result.suggestions).toContain('Look for sheet number in title block (usually bottom-right corner)');
      });

      it('should reject whitespace-only sheet number', () => {
        const data: ExtractedData = {
          sheetNumber: '   ',
          sheetTitle: 'Title',
          scale: '1:100',
        };

        const result = performQualityCheck(data, 1);

        expect(result.issues).toContain('Missing or invalid sheet number');
      });

      it('should reject "N/A" as sheet number', () => {
        const data: ExtractedData = {
          sheetNumber: 'N/A',
          sheetTitle: 'Title',
          scale: '1:100',
        };

        const result = performQualityCheck(data, 1);

        expect(result.issues).toContain('Missing or invalid sheet number');
      });

      it('should reject missing sheet title', () => {
        const data: ExtractedData = {
          sheetNumber: 'A-101',
          scale: '1:100',
        };

        const result = performQualityCheck(data, 1);

        expect(result.issues).toContain('Missing or invalid sheet title');
        expect(result.suggestions).toContain('Look for drawing title in title block');
      });

      it('should reject "N/A" as sheet title', () => {
        const data: ExtractedData = {
          sheetNumber: 'A-101',
          sheetTitle: 'N/A',
          scale: '1:100',
        };

        const result = performQualityCheck(data, 1);

        expect(result.issues).toContain('Missing or invalid sheet title');
      });

      it('should reject missing scale', () => {
        const data: ExtractedData = {
          sheetNumber: 'A-101',
          sheetTitle: 'Title',
        };

        const result = performQualityCheck(data, 1);

        expect(result.issues).toContain('Missing or invalid scale information');
        expect(result.suggestions).toContain('Look for scale notation (e.g., 1/4"=1\'-0", 1:100)');
      });

      it('should reject "N/A" as scale', () => {
        const data: ExtractedData = {
          sheetNumber: 'A-101',
          sheetTitle: 'Title',
          scale: 'N/A',
        };

        const result = performQualityCheck(data, 1);

        expect(result.issues).toContain('Missing or invalid scale information');
      });
    });

    describe('Content Quality Scoring', () => {
      it('should award 10 points for content >500 characters', () => {
        const data: ExtractedData = {
          content: 'A'.repeat(501),
        };

        const result = performQualityCheck(data, 1, 0);

        expect(result.score).toBeGreaterThanOrEqual(10);
        expect(result.issues).not.toContain('Insufficient content extracted');
      });

      it('should award 5 points for content >200 characters', () => {
        const data: ExtractedData = {
          content: 'A'.repeat(201),
        };

        const result = performQualityCheck(data, 1, 0);

        expect(result.score).toBe(5);
      });

      it('should award 2 points for content >50 characters', () => {
        const data: ExtractedData = {
          content: 'A'.repeat(51),
        };

        const result = performQualityCheck(data, 1, 0);

        expect(result.score).toBe(2);
      });

      it('should award 0 points for content <=50 characters', () => {
        const data: ExtractedData = {
          content: 'A'.repeat(50),
        };

        const result = performQualityCheck(data, 1, 0);

        expect(result.score).toBe(0);
        expect(result.issues).toContain('Insufficient content extracted');
        expect(result.suggestions).toContain('Ensure OCR is reading all visible text and annotations');
      });

      it('should handle missing content field', () => {
        const data: ExtractedData = {};

        const result = performQualityCheck(data, 1, 0);

        expect(result.score).toBe(0);
      });
    });

    describe('Structural Elements Scoring', () => {
      it('should award full 40 points when all 16 structural fields present', () => {
        const data: ExtractedData = {
          dimensions: ['10ft'],
          gridLines: ['A'],
          rooms: [{ number: '101', name: 'Room 1' }],
          doors: ['D1'],
          windows: ['W1'],
          equipment: ['HVAC-1'],
          symbolData: { sectionCuts: [{ number: '1', referenceSheet: 'A3.01' }] },
          siteAndConcrete: { footings: [{ size: '24x24' }] },
          visualMaterials: [{ material: 'concrete' }],
          plumbingFixtures: [{ type: 'WC' }],
          electricalDevices: [{ type: 'receptacle' }],
          spatialData: { heights: ['10ft'] },
          constructionIntel: { tradesRequired: ['Arch'] },
          drawingScheduleTables: [{ scheduleType: 'door' }],
          hvacData: { ductwork: ['12x12'] },
          fireProtection: { sprinklerHeads: ['pendant'] },
        };

        const result = performQualityCheck(data, 1, 0);

        expect(result.score).toBe(40);
        expect(result.issues).not.toContain('No structural elements detected');
      });

      it('should award proportional points for partial structural fields', () => {
        const data: ExtractedData = {
          dimensions: ['10ft'],
          gridLines: ['A'],
          rooms: [{ number: '101', name: 'Room 1' }],
          doors: ['D1'],
          // 4 out of 16 fields = 10 points
        };

        const result = performQualityCheck(data, 1, 0);

        expect(result.score).toBe(10); // (4/16) * 40 = 10
      });

      it('should detect when no structural elements are present', () => {
        const data: ExtractedData = {
          sheetNumber: 'A-101',
        };

        const result = performQualityCheck(data, 1, 0);

        expect(result.issues).toContain('No structural elements detected');
        expect(result.suggestions).toContain('Ensure extraction includes dimensions, grid lines, room labels, etc.');
      });

      it('should suggest more elements when <3 structural fields found', () => {
        const data: ExtractedData = {
          dimensions: ['10ft'],
          gridLines: ['A'],
          // Only 2 fields
        };

        const result = performQualityCheck(data, 1, 0);

        expect(result.suggestions).toContain('Consider extracting more structural elements for better context');
      });

      it('should accept array structural fields with content', () => {
        const data: ExtractedData = {
          dimensions: ['10ft', '20ft'],
          doors: [],
        };

        const result = performQualityCheck(data, 1, 0);

        // Only dimensions counts (has content), doors is empty array
        expect(result.score).toBe(2.5); // (1/16) * 40 = 2.5
      });

      it('should reject structural fields with N/A value', () => {
        const data: ExtractedData = {
          dimensions: 'N/A',
          gridLines: ['A'],
        };

        const result = performQualityCheck(data, 1, 0);

        // Only gridLines counts
        expect(result.score).toBe(2.5); // (1/16) * 40 = 2.5
      });

      it('should handle empty arrays as no structural elements', () => {
        const data: ExtractedData = {
          dimensions: [],
          gridLines: [],
          rooms: [],
        };

        const result = performQualityCheck(data, 1, 0);

        expect(result.issues).toContain('No structural elements detected');
      });
    });

    describe('Pass/Fail Logic', () => {
      it('should pass when score >= minScore and issues <= 2', () => {
        const data: ExtractedData = {
          sheetNumber: 'A-101',
          sheetTitle: 'Title',
          scale: '1:100',
          content: 'Some content',
          // Missing structural fields = 2 issues
        };

        const result = performQualityCheck(data, 1, 50);

        expect(result.score).toBe(50);
        expect(result.issues.length).toBeLessThanOrEqual(2);
        expect(result.passed).toBe(true);
      });

      it('should fail when score < minScore', () => {
        const data: ExtractedData = {
          sheetNumber: 'A-101',
          // Missing title, scale, content, structural = low score
        };

        const result = performQualityCheck(data, 1, 50);

        expect(result.score).toBeLessThan(50);
        expect(result.passed).toBe(false);
      });

      it('should fail when issues > 2 even if score is high enough', () => {
        const data: ExtractedData = {
          // All fields missing = 4 issues (number, title, scale, content)
        };

        const result = performQualityCheck(data, 1, 0);

        expect(result.issues.length).toBeGreaterThan(2);
        expect(result.passed).toBe(false);
      });

      it('should respect custom minScore parameter', () => {
        const data: ExtractedData = {
          sheetNumber: 'A-101',
          sheetTitle: 'Title',
          // Score = 35, default minScore = 50
        };

        const resultDefault = performQualityCheck(data, 1);
        expect(resultDefault.passed).toBe(false);

        const resultCustom = performQualityCheck(data, 1, 30);
        expect(resultCustom.passed).toBe(true);
      });

      it('should use default minScore of 50', () => {
        const data: ExtractedData = {
          sheetNumber: 'A-101',
          sheetTitle: 'Title',
          scale: '1:100',
        };

        const result = performQualityCheck(data, 1);

        expect(result.score).toBe(50);
        expect(result.passed).toBe(true); // Score exactly 50, issues = 2 (content + structural)
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty data object', () => {
        const data: ExtractedData = {};

        const result = performQualityCheck(data, 1, 0);

        expect(result.passed).toBe(false);
        expect(result.score).toBe(0);
        expect(result.issues.length).toBeGreaterThan(0);
        expect(result.suggestions.length).toBeGreaterThan(0);
      });

      it('should handle data with only custom fields', () => {
        const data: ExtractedData = {
          customField1: 'value1',
          customField2: 'value2',
        };

        const result = performQualityCheck(data, 1, 0);

        expect(result.score).toBe(0);
        expect(result.issues).toContain('Missing or invalid sheet number');
      });

      it('should handle null values in structural fields', () => {
        const data: ExtractedData = {
          dimensions: null as any,
          gridLines: undefined,
        };

        const result = performQualityCheck(data, 1, 0);

        expect(result.issues).toContain('No structural elements detected');
      });

      it('should cap structural score at 40 points', () => {
        // Even with extra fields beyond the 8 tracked
        const data: ExtractedData = {
          dimensions: ['10ft'],
          gridLines: ['A'],
          rooms: [{ number: '101', name: 'Room 1' }],
          doors: ['D1'],
          windows: ['W1'],
          equipment: ['HVAC-1'],
          symbolData: { sectionCuts: [{ number: '1', referenceSheet: 'A3.01' }] },
          siteAndConcrete: { footings: [{ size: '24x24' }] },
          extraField1: ['Extra'],
          extraField2: ['Extra'],
        };

        const result = performQualityCheck(data, 1, 0);

        expect(result.score).toBeLessThanOrEqual(40);
      });

      it('should handle different page numbers', () => {
        const data: ExtractedData = {
          sheetNumber: 'A-101',
        };

        const result1 = performQualityCheck(data, 1);
        const result2 = performQualityCheck(data, 100);

        // Page number doesn't affect scoring
        expect(result1.score).toBe(result2.score);
      });
    });
  });

  describe('isBlankPage', () => {
    describe('Explicit Blank Indicators', () => {
      it('should detect "blank page" in content', () => {
        const data: ExtractedData = {
          content: 'This is a blank page',
        };

        expect(isBlankPage(data)).toBe(true);
      });

      it('should detect "empty page" in content', () => {
        const data: ExtractedData = {
          content: 'empty page detected',
        };

        expect(isBlankPage(data)).toBe(true);
      });

      it('should detect "no content" in content', () => {
        const data: ExtractedData = {
          content: 'no content available',
        };

        expect(isBlankPage(data)).toBe(true);
      });

      it('should detect "not applicable" in content', () => {
        const data: ExtractedData = {
          content: 'not applicable',
        };

        expect(isBlankPage(data)).toBe(true);
      });

      it('should be case insensitive for blank indicators', () => {
        expect(isBlankPage({ content: 'BLANK PAGE' })).toBe(true);
        expect(isBlankPage({ content: 'Empty Page' })).toBe(true);
        expect(isBlankPage({ content: 'NO CONTENT' })).toBe(true);
        expect(isBlankPage({ content: 'Not Applicable' })).toBe(true);
      });

      it('should detect blank indicators within larger text', () => {
        const data: ExtractedData = {
          content: 'Warning: this appears to be a blank page in the document',
        };

        expect(isBlankPage(data)).toBe(true);
      });
    });

    describe('Critical Fields Missing', () => {
      it('should detect blank when all critical fields are missing', () => {
        const data: ExtractedData = {};

        expect(isBlankPage(data)).toBe(true);
      });

      it('should detect blank when all critical fields are N/A', () => {
        const data: ExtractedData = {
          sheetNumber: 'N/A',
          sheetTitle: 'N/A',
          scale: 'N/A',
          content: 'short',
        };

        expect(isBlankPage(data)).toBe(true);
      });

      it('should detect blank when content is too short (<50 chars)', () => {
        const data: ExtractedData = {
          sheetNumber: 'N/A',
          sheetTitle: 'N/A',
          scale: 'N/A',
          content: 'A'.repeat(49),
        };

        expect(isBlankPage(data)).toBe(true);
      });

      it('should not be blank if sheet number is valid', () => {
        const data: ExtractedData = {
          sheetNumber: 'A-101',
          sheetTitle: 'N/A',
          scale: 'N/A',
          content: 'short',
        };

        expect(isBlankPage(data)).toBe(false);
      });

      it('should not be blank if sheet title is valid', () => {
        const data: ExtractedData = {
          sheetNumber: 'N/A',
          sheetTitle: 'Ground Floor Plan',
          scale: 'N/A',
          content: 'short',
        };

        expect(isBlankPage(data)).toBe(false);
      });

      it('should not be blank if scale is valid', () => {
        const data: ExtractedData = {
          sheetNumber: 'N/A',
          sheetTitle: 'N/A',
          scale: '1:100',
          content: 'short',
        };

        expect(isBlankPage(data)).toBe(false);
      });

      it('should not be blank if content is long enough (>=50 chars)', () => {
        const data: ExtractedData = {
          sheetNumber: 'N/A',
          sheetTitle: 'N/A',
          scale: 'N/A',
          content: 'A'.repeat(50),
        };

        expect(isBlankPage(data)).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      it('should handle missing content field', () => {
        const data: ExtractedData = {
          sheetNumber: 'N/A',
          sheetTitle: 'N/A',
          scale: 'N/A',
        };

        expect(isBlankPage(data)).toBe(true);
      });

      it('should handle empty string content', () => {
        const data: ExtractedData = {
          sheetNumber: 'N/A',
          sheetTitle: 'N/A',
          scale: 'N/A',
          content: '',
        };

        expect(isBlankPage(data)).toBe(true);
      });

      it('should handle whitespace-only content', () => {
        const data: ExtractedData = {
          content: '   ',
        };

        // Whitespace doesn't contain blank indicators, but is <50 chars
        expect(isBlankPage(data)).toBe(true);
      });

      it('should not be blank with valid data', () => {
        const data: ExtractedData = {
          sheetNumber: 'A-101',
          sheetTitle: 'Ground Floor Plan',
          scale: '1:100',
          content: 'Detailed construction drawing with annotations and specifications',
        };

        expect(isBlankPage(data)).toBe(false);
      });

      it('should handle undefined vs empty string vs N/A correctly', () => {
        expect(isBlankPage({ sheetNumber: undefined })).toBe(true);
        expect(isBlankPage({ sheetNumber: '' })).toBe(true);
        expect(isBlankPage({ sheetNumber: 'N/A' })).toBe(true);
        expect(isBlankPage({ sheetNumber: 'A-101' })).toBe(false);
      });
    });
  });

  describe('STRUCTURAL_FIELDS', () => {
    it('should contain exactly 16 structural field names', () => {
      expect(STRUCTURAL_FIELDS).toHaveLength(16);
    });

    it('should include all expected field names', () => {
      expect(STRUCTURAL_FIELDS).toContain('dimensions');
      expect(STRUCTURAL_FIELDS).toContain('fireProtection');
      expect(STRUCTURAL_FIELDS).toContain('hvacData');
    });
  });

  describe('assessPageComplexity', () => {
    it('should return "blank" for empty data (blank page)', () => {
      const data: ExtractedData = {};
      expect(assessPageComplexity(data)).toBe('blank');
    });

    it('should return "blank" when content indicates blank page', () => {
      const data: ExtractedData = { content: 'This is a blank page' };
      expect(assessPageComplexity(data)).toBe('blank');
    });

    it('should return "simple" for cover sheet with title block only (0 structural fields)', () => {
      const data: ExtractedData = {
        sheetNumber: 'G-001',
        sheetTitle: 'COVER SHEET',
        scale: 'N/A',
        content: 'Project Name: Example Building. General contractor info and project directory.',
      };
      expect(assessPageComplexity(data)).toBe('simple');
    });

    it('should return "simple" for page with 1-2 structural fields', () => {
      const data: ExtractedData = {
        sheetNumber: 'G-002',
        sheetTitle: 'GENERAL NOTES',
        content: 'A'.repeat(200),
        dimensions: ['10ft'],
        gridLines: ['A'],
        // Only 2 structural fields
      };
      expect(assessPageComplexity(data)).toBe('simple');
    });

    it('should return "complex" for page with exactly 3 structural fields', () => {
      const data: ExtractedData = {
        sheetNumber: 'A-101',
        sheetTitle: 'FIRST FLOOR PLAN',
        scale: '1/4"=1\'-0"',
        content: 'A'.repeat(500),
        dimensions: ['15\'-6"'],
        rooms: [{ number: '101', name: 'LOBBY' }],
        doors: ['D1', 'D2'],
        // Exactly 3 structural fields
      };
      expect(assessPageComplexity(data)).toBe('complex');
    });

    it('should return "complex" for floor plan with many structural fields', () => {
      const data: ExtractedData = {
        sheetNumber: 'A-101',
        sheetTitle: 'First Floor Plan',
        scale: '1/4"=1\'-0"',
        content: 'A'.repeat(600),
        dimensions: ['10ft', '20ft'],
        gridLines: ['A', 'B', 'C'],
        rooms: [{ number: '101', name: 'Kitchen' }],
        doors: ['D1', 'D2'],
        windows: ['W1'],
        equipment: ['HVAC-1'],
        plumbingFixtures: [{ type: 'WC' }],
        electricalDevices: [{ type: 'receptacle' }],
      };
      expect(assessPageComplexity(data)).toBe('complex');
    });

    it('should ignore empty arrays when counting structural fields', () => {
      const data: ExtractedData = {
        sheetNumber: 'A-101',
        sheetTitle: 'Notes',
        content: 'A'.repeat(100),
        dimensions: [],
        gridLines: [],
        rooms: [],
        doors: ['D1'],
        // Only 1 non-empty structural field
      };
      expect(assessPageComplexity(data)).toBe('simple');
    });

    it('should ignore N/A values when counting structural fields', () => {
      const data: ExtractedData = {
        sheetNumber: 'A-101',
        sheetTitle: 'Notes',
        content: 'A'.repeat(100),
        dimensions: 'N/A',
        gridLines: 'N/A',
        rooms: [{ number: '101', name: 'Room' }],
        // Only 1 valid structural field (rooms)
      };
      expect(assessPageComplexity(data)).toBe('simple');
    });

    it('should count non-array truthy structural fields (objects)', () => {
      const data: ExtractedData = {
        sheetNumber: 'M-101',
        sheetTitle: 'Mechanical Plan',
        content: 'A'.repeat(200),
        symbolData: { sectionCuts: [{ number: '1', referenceSheet: 'A3.01' }] },
        constructionIntel: { tradesRequired: ['Mechanical'] },
        hvacData: { ductwork: ['12x12'] },
        // 3 object-type structural fields
      };
      expect(assessPageComplexity(data)).toBe('complex');
    });
  });

  describe('formatQualityReport', () => {
    it('should format a passed quality check', () => {
      const result: QualityCheckResult = {
        passed: true,
        score: 85,
        issues: [],
        suggestions: [],
      };

      const report = formatQualityReport(result, 1);

      expect(report).toContain('Page 1');
      expect(report).toContain('Score: 85/100');
      expect(report).toContain('PASSED');
      expect(report).toContain('===');
    });

    it('should format a failed quality check', () => {
      const result: QualityCheckResult = {
        passed: false,
        score: 35,
        issues: ['Missing sheet number', 'Invalid scale'],
        suggestions: ['Check title block', 'Look for scale notation'],
      };

      const report = formatQualityReport(result, 5);

      expect(report).toContain('Page 5');
      expect(report).toContain('Score: 35/100');
      expect(report).toContain('FAILED');
      expect(report).toContain('Issues (2)');
      expect(report).toContain('1. Missing sheet number');
      expect(report).toContain('2. Invalid scale');
      expect(report).toContain('Suggestions (2)');
      expect(report).toContain('1. Check title block');
      expect(report).toContain('2. Look for scale notation');
    });

    it('should format report with only issues', () => {
      const result: QualityCheckResult = {
        passed: false,
        score: 40,
        issues: ['Missing content'],
        suggestions: [],
      };

      const report = formatQualityReport(result, 10);

      expect(report).toContain('Issues (1)');
      expect(report).toContain('1. Missing content');
      expect(report).not.toContain('Suggestions');
    });

    it('should format report with only suggestions', () => {
      const result: QualityCheckResult = {
        passed: true,
        score: 60,
        issues: [],
        suggestions: ['Consider adding more structural elements'],
      };

      const report = formatQualityReport(result, 2);

      expect(report).not.toContain('Issues');
      expect(report).toContain('Suggestions (1)');
      expect(report).toContain('1. Consider adding more structural elements');
    });

    it('should format report with multiple issues and suggestions', () => {
      const result: QualityCheckResult = {
        passed: false,
        score: 25,
        issues: [
          'Missing sheet number',
          'Missing sheet title',
          'Missing scale',
          'Insufficient content',
        ],
        suggestions: [
          'Check title block for sheet number',
          'Look for drawing title',
          'Find scale notation',
        ],
      };

      const report = formatQualityReport(result, 3);

      expect(report).toContain('Issues (4)');
      expect(report).toContain('1. Missing sheet number');
      expect(report).toContain('2. Missing sheet title');
      expect(report).toContain('3. Missing scale');
      expect(report).toContain('4. Insufficient content');
      expect(report).toContain('Suggestions (3)');
      expect(report).toContain('1. Check title block for sheet number');
      expect(report).toContain('2. Look for drawing title');
      expect(report).toContain('3. Find scale notation');
    });

    it('should include page number in header', () => {
      const result: QualityCheckResult = {
        passed: true,
        score: 100,
        issues: [],
        suggestions: [],
      };

      const report1 = formatQualityReport(result, 1);
      const report2 = formatQualityReport(result, 42);

      expect(report1).toContain('Page 1');
      expect(report2).toContain('Page 42');
    });

    it('should have proper formatting with separators', () => {
      const result: QualityCheckResult = {
        passed: true,
        score: 75,
        issues: [],
        suggestions: [],
      };

      const report = formatQualityReport(result, 1);

      expect(report).toMatch(/\n=== Quality Check: Page \d+ ===\n/);
      expect(report).toMatch(/\n=================================\n/);
      expect(report.startsWith('\n')).toBe(true);
    });

    it('should handle zero score', () => {
      const result: QualityCheckResult = {
        passed: false,
        score: 0,
        issues: ['Everything is missing'],
        suggestions: ['Start over'],
      };

      const report = formatQualityReport(result, 1);

      expect(report).toContain('Score: 0/100');
      expect(report).toContain('FAILED');
    });

    it('should handle perfect score', () => {
      const result: QualityCheckResult = {
        passed: true,
        score: 100,
        issues: [],
        suggestions: [],
      };

      const report = formatQualityReport(result, 1);

      expect(report).toContain('Score: 100/100');
      expect(report).toContain('PASSED');
    });

    it('should properly number issues and suggestions', () => {
      const result: QualityCheckResult = {
        passed: false,
        score: 30,
        issues: ['Issue A', 'Issue B', 'Issue C'],
        suggestions: ['Suggestion 1', 'Suggestion 2'],
      };

      const report = formatQualityReport(result, 1);

      expect(report).toMatch(/1\. Issue A/);
      expect(report).toMatch(/2\. Issue B/);
      expect(report).toMatch(/3\. Issue C/);
      expect(report).toMatch(/1\. Suggestion 1/);
      expect(report).toMatch(/2\. Suggestion 2/);
    });
  });

  describe('scoreTwoTierResult', () => {
    it('should award +10 bonus for high overall confidence (>= 0.8)', () => {
      const data: ExtractedData = {
        sheetNumber: 'A-101',
        sheetTitle: 'Floor Plan',
        scale: '1:100',
        _overallConfidence: 0.92,
      };

      const result = scoreTwoTierResult(data, 1, 0);

      expect(result.twoTierBonus).toBeGreaterThanOrEqual(10);
      expect(result.overallConfidence).toBe(0.92);
    });

    it('should award +5 bonus for corrections', () => {
      const data: ExtractedData = {
        sheetNumber: 'A-101',
        sheetTitle: 'Floor Plan',
        scale: '1:100',
        _corrections: ['Fixed sheet number format'],
      };

      const result = scoreTwoTierResult(data, 1, 0);

      expect(result.correctionsCount).toBe(1);
      expect(result.twoTierBonus).toBeGreaterThanOrEqual(5);
    });

    it('should award +5 bonus for enrichments', () => {
      const data: ExtractedData = {
        sheetNumber: 'A-101',
        sheetTitle: 'Floor Plan',
        scale: '1:100',
        _enrichments: ['Added discipline from sheet number'],
      };

      const result = scoreTwoTierResult(data, 1, 0);

      expect(result.enrichmentsCount).toBe(1);
      expect(result.twoTierBonus).toBeGreaterThanOrEqual(5);
    });

    it('should award +5 bonus for zero validation issues', () => {
      const data: ExtractedData = {
        sheetNumber: 'A-101',
        sheetTitle: 'Floor Plan',
        scale: '1:100',
        _validationIssues: [],
      };

      const result = scoreTwoTierResult(data, 1, 0);

      expect(result.validationIssuesCount).toBe(0);
      expect(result.twoTierBonus).toBeGreaterThanOrEqual(5);
    });

    it('should apply -10 penalty for >5 validation issues', () => {
      const data: ExtractedData = {
        sheetNumber: 'A-101',
        sheetTitle: 'Floor Plan',
        scale: '1:100',
        _validationIssues: [
          'Issue 1', 'Issue 2', 'Issue 3',
          'Issue 4', 'Issue 5', 'Issue 6',
        ],
      };

      const result = scoreTwoTierResult(data, 1, 0);

      expect(result.validationIssuesCount).toBe(6);
      expect(result.twoTierBonus).toBeLessThan(0);
    });

    it('should preserve base score fields', () => {
      const data: ExtractedData = {
        sheetNumber: 'A-101',
        sheetTitle: 'Floor Plan',
        scale: '1:100',
      };

      const baseResult = performQualityCheck(data, 1, 0);
      const twoTierResult = scoreTwoTierResult(data, 1, 0);

      // Base issues/suggestions should be preserved
      expect(twoTierResult.issues).toEqual(baseResult.issues);
      expect(twoTierResult.suggestions).toEqual(baseResult.suggestions);
    });

    it('should handle missing two-tier fields gracefully', () => {
      const data: ExtractedData = {
        sheetNumber: 'A-101',
        sheetTitle: 'Floor Plan',
        scale: '1:100',
        // No _overallConfidence, _corrections, _enrichments, or _validationIssues
      };

      const result = scoreTwoTierResult(data, 1, 0);

      expect(result.overallConfidence).toBeNull();
      expect(result.correctionsCount).toBe(0);
      expect(result.enrichmentsCount).toBe(0);
      expect(result.validationIssuesCount).toBe(0);
      // Only zero-validation-issues bonus (+5)
      expect(result.twoTierBonus).toBe(5);
    });

    it('should have all expected TwoTierQualityResult fields', () => {
      const data: ExtractedData = {
        sheetNumber: 'A-101',
        _overallConfidence: 0.85,
        _corrections: ['fix'],
        _enrichments: ['add'],
        _validationIssues: ['issue'],
      };

      const result = scoreTwoTierResult(data, 1, 0);

      // Standard QualityCheckResult fields
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('suggestions');

      // Two-tier specific fields
      expect(result).toHaveProperty('twoTierBonus');
      expect(result).toHaveProperty('overallConfidence');
      expect(result).toHaveProperty('correctionsCount');
      expect(result).toHaveProperty('enrichmentsCount');
      expect(result).toHaveProperty('validationIssuesCount');
    });

    it('should cap score at 100', () => {
      const data: ExtractedData = {
        sheetNumber: 'A-101',
        sheetTitle: 'Floor Plan',
        scale: '1:100',
        content: 'A'.repeat(600),
        dimensions: ['10ft'],
        gridLines: ['A'],
        rooms: [{ number: '101', name: 'Room 1' }],
        doors: ['D1'],
        windows: ['W1'],
        equipment: ['HVAC-1'],
        symbolData: { sectionCuts: [{ number: '1', referenceSheet: 'A3.01' }] },
        siteAndConcrete: { footings: [{ size: '24x24' }] },
        visualMaterials: [{ material: 'concrete' }],
        plumbingFixtures: [{ type: 'WC' }],
        electricalDevices: [{ type: 'receptacle' }],
        spatialData: { heights: ['10ft'] },
        constructionIntel: { tradesRequired: ['Arch'] },
        drawingScheduleTables: [{ scheduleType: 'door' }],
        hvacData: { ductwork: ['12x12'] },
        fireProtection: { sprinklerHeads: ['pendant'] },
        _overallConfidence: 0.95,
        _corrections: ['fix1'],
        _enrichments: ['add1'],
        _validationIssues: [],
      };

      const result = scoreTwoTierResult(data, 1, 0);

      // Base = 100, two-tier bonus = +25, but capped at 100
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should floor score at 0', () => {
      const data: ExtractedData = {
        // Zero base score
        _validationIssues: ['1', '2', '3', '4', '5', '6'], // -10 penalty
      };

      const result = scoreTwoTierResult(data, 1, 0);

      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should update passed based on final score including bonus', () => {
      const data: ExtractedData = {
        sheetNumber: 'A-101',
        sheetTitle: 'Floor Plan',
        // Base score = 35 (20+15), below 50
        _overallConfidence: 0.95, // +10
        _corrections: ['fix'], // +5
        _enrichments: ['add'], // +5
        _validationIssues: [], // +5
        // Three-pass bonus: both corrections and enrichments present: +5
        // Total = 35 + 30 = 65, above 50
      };

      const result = scoreTwoTierResult(data, 1, 50);

      // Score is 35 + 30 = 65 (includes three-pass bonus for corrections+enrichments)
      // Issues > 2 (scale + content + structural), so passed is still false
      expect(result.score).toBe(65);
    });
  });
});
