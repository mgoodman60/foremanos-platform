import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseSheetNumber, matchesFloor } from '@/lib/sheet-number-parser';

// Mock logger
const mockLogger = vi.hoisted(() => ({
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createScopedLogger: vi.fn(() => mockLogger),
}));

describe('sheet-number-parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseSheetNumber', () => {
    it('should parse standard format A-101', () => {
      const result = parseSheetNumber('A-101');

      expect(result).toEqual({
        discipline: 'A',
        disciplineName: 'Architectural',
        level: '1',
        sequence: '01',
        raw: 'A-101',
      });
    });

    it('should parse mechanical sheet M-201', () => {
      const result = parseSheetNumber('M-201');

      expect(result).toEqual({
        discipline: 'M',
        disciplineName: 'Mechanical',
        level: '2',
        sequence: '01',
        raw: 'M-201',
      });
    });

    it('should parse fire protection sheet FP-301', () => {
      const result = parseSheetNumber('FP-301');

      expect(result).toEqual({
        discipline: 'FP',
        disciplineName: 'Fire Protection',
        level: '3',
        sequence: '01',
        raw: 'FP-301',
      });
    });

    it('should parse electrical sheet E-401', () => {
      const result = parseSheetNumber('E-401');

      expect(result).toEqual({
        discipline: 'E',
        disciplineName: 'Electrical',
        level: '4',
        sequence: '01',
        raw: 'E-401',
      });
    });

    it('should parse plumbing sheet P-501', () => {
      const result = parseSheetNumber('P-501');

      expect(result).toEqual({
        discipline: 'P',
        disciplineName: 'Plumbing',
        level: '5',
        sequence: '01',
        raw: 'P-501',
      });
    });

    it('should parse structural sheet S-101', () => {
      const result = parseSheetNumber('S-101');

      expect(result).toEqual({
        discipline: 'S',
        disciplineName: 'Structural',
        level: '1',
        sequence: '01',
        raw: 'S-101',
      });
    });

    it('should parse civil sheet C-201', () => {
      const result = parseSheetNumber('C-201');

      expect(result).toEqual({
        discipline: 'C',
        disciplineName: 'Civil',
        level: '2',
        sequence: '01',
        raw: 'C-201',
      });
    });

    it('should parse landscape sheet L-101', () => {
      const result = parseSheetNumber('L-101');

      expect(result).toEqual({
        discipline: 'L',
        disciplineName: 'Landscape',
        level: '1',
        sequence: '01',
        raw: 'L-101',
      });
    });

    it('should parse format without separator A101', () => {
      const result = parseSheetNumber('A101');

      expect(result).toEqual({
        discipline: 'A',
        disciplineName: 'Architectural',
        level: '1',
        sequence: '01',
        raw: 'A101',
      });
    });

    it('should parse format without separator M201', () => {
      const result = parseSheetNumber('M201');

      expect(result).toEqual({
        discipline: 'M',
        disciplineName: 'Mechanical',
        level: '2',
        sequence: '01',
        raw: 'M201',
      });
    });

    it('should parse format with dot separator A.101', () => {
      const result = parseSheetNumber('A.101');

      expect(result).toEqual({
        discipline: 'A',
        disciplineName: 'Architectural',
        level: '1',
        sequence: '01',
        raw: 'A.101',
      });
    });

    it('should parse format with space separator A 101', () => {
      const result = parseSheetNumber('A 101');

      expect(result).toEqual({
        discipline: 'A',
        disciplineName: 'Architectural',
        level: '1',
        sequence: '01',
        raw: 'A 101',
      });
    });

    it('should parse 2-digit format A-11', () => {
      const result = parseSheetNumber('A-11');

      expect(result).toEqual({
        discipline: 'A',
        disciplineName: 'Architectural',
        level: '1',
        sequence: '01',
        raw: 'A-11',
      });
    });

    it('should parse 2-digit format M-22', () => {
      const result = parseSheetNumber('M-22');

      expect(result).toEqual({
        discipline: 'M',
        disciplineName: 'Mechanical',
        level: '2',
        sequence: '02',
        raw: 'M-22',
      });
    });

    it('should parse sheet with different sequence A-105', () => {
      const result = parseSheetNumber('A-105');

      expect(result).toEqual({
        discipline: 'A',
        disciplineName: 'Architectural',
        level: '1',
        sequence: '05',
        raw: 'A-105',
      });
    });

    it('should handle lowercase input a-101', () => {
      const result = parseSheetNumber('a-101');

      expect(result).toEqual({
        discipline: 'A',
        disciplineName: 'Architectural',
        level: '1',
        sequence: '01',
        raw: 'A-101',
      });
    });

    it('should handle mixed case FP-301', () => {
      const result = parseSheetNumber('fp-301');

      expect(result).toEqual({
        discipline: 'FP',
        disciplineName: 'Fire Protection',
        level: '3',
        sequence: '01',
        raw: 'FP-301',
      });
    });

    it('should handle whitespace trimming', () => {
      const result = parseSheetNumber('  A-101  ');

      expect(result).toEqual({
        discipline: 'A',
        disciplineName: 'Architectural',
        level: '1',
        sequence: '01',
        raw: 'A-101',
      });
    });

    it('should return null for null input', () => {
      const result = parseSheetNumber(null as any);
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = parseSheetNumber('');
      expect(result).toBeNull();
    });

    it('should return null for invalid format "PLANS"', () => {
      const result = parseSheetNumber('PLANS');
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'SHEET_PARSER',
        'Invalid sheet number format',
        { sheetNumber: 'PLANS' }
      );
    });

    it('should return null for numbers only "101"', () => {
      const result = parseSheetNumber('101');
      expect(result).toBeNull();
    });

    it('should return null for invalid format "ABC"', () => {
      const result = parseSheetNumber('ABC');
      expect(result).toBeNull();
    });

    it('should return null for undefined input', () => {
      const result = parseSheetNumber(undefined as any);
      expect(result).toBeNull();
    });

    it('should return null for non-string input', () => {
      const result = parseSheetNumber(123 as any);
      expect(result).toBeNull();
    });

    it('should handle unknown discipline code', () => {
      const result = parseSheetNumber('X-101');

      expect(result).toEqual({
        discipline: 'X',
        disciplineName: 'Unknown',
        level: '1',
        sequence: '01',
        raw: 'X-101',
      });
    });

    it('should parse general sheet G-101', () => {
      const result = parseSheetNumber('G-101');

      expect(result).toEqual({
        discipline: 'G',
        disciplineName: 'General',
        level: '1',
        sequence: '01',
        raw: 'G-101',
      });
    });
  });

  describe('matchesFloor', () => {
    it('should return true for sheets on same floor A-101 and M-101', () => {
      const result = matchesFloor('A-101', 'M-101');
      expect(result).toBe(true);
    });

    it('should return true for same floor different disciplines E-201 and P-201', () => {
      const result = matchesFloor('E-201', 'P-201');
      expect(result).toBe(true);
    });

    it('should return true for same floor FP-301 and S-301', () => {
      const result = matchesFloor('FP-301', 'S-301');
      expect(result).toBe(true);
    });

    it('should return false for different floors A-101 and M-201', () => {
      const result = matchesFloor('A-101', 'M-201');
      expect(result).toBe(false);
    });

    it('should return false for different floors E-301 and P-201', () => {
      const result = matchesFloor('E-301', 'P-201');
      expect(result).toBe(false);
    });

    it('should return false for invalid first sheet', () => {
      const result = matchesFloor('INVALID', 'M-201');
      expect(result).toBe(false);
    });

    it('should return false for invalid second sheet', () => {
      const result = matchesFloor('A-101', 'INVALID');
      expect(result).toBe(false);
    });

    it('should return false for both invalid sheets', () => {
      const result = matchesFloor('INVALID', 'INVALID');
      expect(result).toBe(false);
    });

    it('should return false for null first parameter', () => {
      const result = matchesFloor(null as any, 'M-201');
      expect(result).toBe(false);
    });

    it('should return false for null second parameter', () => {
      const result = matchesFloor('A-101', null as any);
      expect(result).toBe(false);
    });

    it('should return false for empty string parameters', () => {
      const result = matchesFloor('', '');
      expect(result).toBe(false);
    });

    it('should handle different formats on same floor A-101 and M101', () => {
      const result = matchesFloor('A-101', 'M101');
      expect(result).toBe(true);
    });

    it('should handle different sequence same floor A-101 and A-105', () => {
      const result = matchesFloor('A-101', 'A-105');
      expect(result).toBe(true);
    });

    it('should handle 2-digit vs 3-digit same floor A-11 and M-101', () => {
      const result = matchesFloor('A-11', 'M-101');
      expect(result).toBe(true);
    });
  });
});
