import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeExtractedData } from '@/lib/data-normalizer';
import type { ExtractedData } from '@/lib/vision-api-quality';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function make(overrides: Record<string, unknown> = {}): ExtractedData {
  return overrides as ExtractedData;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('normalizeExtractedData', () => {
  beforeEach(() => {
    // Pure functions — nothing to reset
  });

  describe('return shape', () => {
    it('returns normalizedData, changesApplied, and fieldsFixed', () => {
      const result = normalizeExtractedData(make({ sheetNumber: 'A-101' }), 'Architectural');

      expect(result).toHaveProperty('normalizedData');
      expect(result).toHaveProperty('changesApplied');
      expect(result).toHaveProperty('fieldsFixed');
      expect(Array.isArray(result.changesApplied)).toBe(true);
      expect(typeof result.fieldsFixed).toBe('number');
    });

    it('does not mutate the original input object', () => {
      const input = make({ sheetNumber: 'A-101', date: '01/15/2024' });
      const inputCopy = JSON.parse(JSON.stringify(input));

      normalizeExtractedData(input, 'Architectural');

      expect(input).toEqual(inputCopy);
    });
  });

  // N7 — Date normalization
  describe('N7: date normalization to ISO 8601', () => {
    it('converts M/D/YYYY format to ISO 8601', () => {
      const data = make({ date: '1/15/2024' });
      const { normalizedData, changesApplied } = normalizeExtractedData(data, 'Architectural');

      expect((normalizedData as Record<string, unknown>).date).toBe('2024-01-15');
      expect(changesApplied.some(c => c.includes('N7') && c.includes('date'))).toBe(true);
    });

    it('converts M/D/YY format (post-2000 years) to ISO 8601', () => {
      const data = make({ date: '3/5/24' });
      const { normalizedData } = normalizeExtractedData(data, 'Architectural');

      expect((normalizedData as Record<string, unknown>).date).toBe('2024-03-05');
    });

    it('converts M/D/YY format (pre-2000 years) to ISO 8601', () => {
      const data = make({ date: '6/10/95' });
      const { normalizedData } = normalizeExtractedData(data, 'Architectural');

      expect((normalizedData as Record<string, unknown>).date).toBe('1995-06-10');
    });

    it('converts M-D-YYYY dash format to ISO 8601', () => {
      const data = make({ revisionDate: '12-31-2023' });
      const { normalizedData } = normalizeExtractedData(data, 'Architectural');

      expect((normalizedData as Record<string, unknown>).revisionDate).toBe('2023-12-31');
    });

    it('leaves already-ISO-8601 dates unchanged', () => {
      const data = make({ date: '2024-07-04' });
      const { normalizedData, changesApplied } = normalizeExtractedData(data, 'Architectural');

      expect((normalizedData as Record<string, unknown>).date).toBe('2024-07-04');
      expect(changesApplied.filter(c => c.includes('date'))).toHaveLength(0);
    });

    it('normalizes dates inside titleBlock', () => {
      const data = make({ titleBlock: { date: '2/28/2025', revisionDate: 'N/A' } });
      const { normalizedData, changesApplied } = normalizeExtractedData(data, 'Architectural');

      const tb = (normalizedData as Record<string, unknown>).titleBlock as Record<string, unknown>;
      expect(tb.date).toBe('2025-02-28');
      expect(changesApplied.some(c => c.includes('titleBlock'))).toBe(true);
    });

    it('skips N/A date values without change', () => {
      const data = make({ date: 'N/A' });
      const { changesApplied } = normalizeExtractedData(data, 'Architectural');

      expect(changesApplied.filter(c => c.includes('N7') && c.includes('date'))).toHaveLength(0);
    });
  });

  // N1 — Unit standardization
  describe('N1: measurement unit standardization', () => {
    it('converts "ft" notation to architectural feet/inches format', () => {
      const data = make({ dimensions: [{ value: '12ft 6in' }] });
      const { normalizedData, changesApplied } = normalizeExtractedData(data, 'Architectural');

      const dims = (normalizedData as Record<string, unknown>).dimensions as { value: string }[];
      expect(dims[0].value).toBe("12'-6\"");
      expect(changesApplied.some(c => c.includes('N1'))).toBe(true);
    });

    it('converts "feet" notation to feet-inches format', () => {
      const data = make({ dimensions: [{ value: '10feet 3inches' }] });
      const { normalizedData } = normalizeExtractedData(data, 'Architectural');

      const dims = (normalizedData as Record<string, unknown>).dimensions as { value: string }[];
      expect(dims[0].value).toBe("10'-3\"");
    });

    it('normalizes scale field measurement units', () => {
      const data = make({ scale: '3in = 1ft' });
      const { normalizedData, changesApplied } = normalizeExtractedData(data, 'Architectural');

      // The scale is passed through normalizeMeasurement
      expect(changesApplied.some(c => c.includes('N1') && c.includes('scale'))).toBe(true);
      expect((normalizedData as Record<string, unknown>).scale).toBeDefined();
    });

    it('leaves dimensions already in feet/inches format unchanged', () => {
      const data = make({ dimensions: [{ value: "10'-6\"" }] });
      const { changesApplied } = normalizeExtractedData(data, 'Architectural');

      // No N1 changes expected for dimensions already correct
      expect(changesApplied.filter(c => c.includes('N1') && c.includes('dimension'))).toHaveLength(0);
    });
  });

  // N8 — Deduplication
  describe('N8: array deduplication', () => {
    it('removes exact duplicate entries from rooms array', () => {
      const room = { number: '101', name: 'Office' };
      const data = make({ rooms: [room, room, { number: '102', name: 'Lobby' }] });

      const { normalizedData, changesApplied } = normalizeExtractedData(data, 'Architectural');

      const rooms = (normalizedData as Record<string, unknown>).rooms as unknown[];
      expect(rooms).toHaveLength(2);
      expect(changesApplied.some(c => c.includes('N8') && c.includes('rooms'))).toBe(true);
    });

    it('removes duplicate string entries from doors array', () => {
      const data = make({ doors: ['D1', 'D2', 'D1', 'D3', 'D2'] });

      const { normalizedData } = normalizeExtractedData(data, 'Architectural');

      const doors = (normalizedData as Record<string, unknown>).doors as unknown[];
      expect(doors).toHaveLength(3);
    });

    it('removes duplicate plumbingFixtures entries', () => {
      const fixture = { type: 'WC', room: '101' };
      const data = make({ plumbingFixtures: [fixture, fixture] });

      const { normalizedData } = normalizeExtractedData(data, 'Architectural');

      const fixtures = (normalizedData as Record<string, unknown>).plumbingFixtures as unknown[];
      expect(fixtures).toHaveLength(1);
    });

    it('does not change arrays with all unique entries', () => {
      const data = make({ windows: ['W1', 'W2', 'W3'] });
      const { normalizedData, changesApplied } = normalizeExtractedData(data, 'Architectural');

      const windows = (normalizedData as Record<string, unknown>).windows as unknown[];
      expect(windows).toHaveLength(3);
      expect(changesApplied.filter(c => c.includes('N8') && c.includes('windows'))).toHaveLength(0);
    });

    it('handles single-element arrays without change', () => {
      const data = make({ dimensions: [{ value: '10ft' }] });
      const { changesApplied } = normalizeExtractedData(data, 'Architectural');

      expect(changesApplied.filter(c => c.includes('N8'))).toHaveLength(0);
    });
  });

  // N4 — Discipline backfill
  describe('N4: discipline backfill from sheet number', () => {
    it('infers Architectural discipline from A- sheet prefix', () => {
      const data = make({ sheetNumber: 'A-101', discipline: 'Unknown' });
      const { normalizedData, changesApplied } = normalizeExtractedData(data, 'Unknown');

      expect((normalizedData as Record<string, unknown>).discipline).toBe('Architectural');
      expect(changesApplied.some(c => c.includes('N4') && c.includes('Architectural'))).toBe(true);
    });

    it('infers Structural discipline from S- sheet prefix', () => {
      const data = make({ sheetNumber: 'S-201', discipline: 'Unknown' });
      const { normalizedData } = normalizeExtractedData(data, 'Unknown');

      expect((normalizedData as Record<string, unknown>).discipline).toBe('Structural');
    });

    it('infers Mechanical discipline from M- sheet prefix', () => {
      const data = make({ sheetNumber: 'M-301', discipline: '' });
      const { normalizedData } = normalizeExtractedData(data, 'Unknown');

      expect((normalizedData as Record<string, unknown>).discipline).toBe('Mechanical');
    });

    it('infers Electrical discipline from E- sheet prefix', () => {
      const data = make({ sheetNumber: 'E-401', discipline: 'N/A' });
      const { normalizedData } = normalizeExtractedData(data, 'Unknown');

      expect((normalizedData as Record<string, unknown>).discipline).toBe('Electrical');
    });

    it('infers Plumbing discipline from P- sheet prefix', () => {
      const data = make({ sheetNumber: 'P-501', discipline: 'Unknown' });
      const { normalizedData } = normalizeExtractedData(data, 'Unknown');

      expect((normalizedData as Record<string, unknown>).discipline).toBe('Plumbing');
    });

    it('uses passed discipline as fallback when sheet number has no match', () => {
      const data = make({ sheetNumber: 'G-001', discipline: 'Unknown' });
      const { normalizedData, changesApplied } = normalizeExtractedData(data, 'Architectural');

      expect((normalizedData as Record<string, unknown>).discipline).toBe('Architectural');
      expect(changesApplied.some(c => c.includes('N4'))).toBe(true);
    });

    it('does not overwrite a valid existing discipline', () => {
      const data = make({ sheetNumber: 'A-101', discipline: 'Architectural' });
      const { normalizedData, changesApplied } = normalizeExtractedData(data, 'Structural');

      expect((normalizedData as Record<string, unknown>).discipline).toBe('Architectural');
      expect(changesApplied.filter(c => c.includes('N4'))).toHaveLength(0);
    });
  });

  // N2 — Counter reconciliation
  describe('N2: counter reconciliation', () => {
    it('fixes roomsCount when it does not match rooms array length', () => {
      const data = make({
        rooms: [{ number: '101' }, { number: '102' }, { number: '103' }],
        roomsCount: 5,
      });

      const { normalizedData, changesApplied } = normalizeExtractedData(data, 'Architectural');

      expect((normalizedData as Record<string, unknown>).roomsCount).toBe(3);
      expect(changesApplied.some(c => c.includes('N2') && c.includes('roomsCount'))).toBe(true);
    });

    it('fixes doorsCount when mismatched', () => {
      const data = make({ doors: ['D1', 'D2'], doorsCount: 4 });

      const { normalizedData } = normalizeExtractedData(data, 'Architectural');

      expect((normalizedData as Record<string, unknown>).doorsCount).toBe(2);
    });

    it('fixes windowsCount when mismatched', () => {
      const data = make({ windows: ['W1', 'W2', 'W3'], windowsCount: 1 });

      const { normalizedData, changesApplied } = normalizeExtractedData(data, 'Architectural');

      expect((normalizedData as Record<string, unknown>).windowsCount).toBe(3);
      expect(changesApplied.some(c => c.includes('N2') && c.includes('windowsCount'))).toBe(true);
    });

    it('fixes fixturesCount when mismatched with plumbingFixtures', () => {
      const data = make({
        plumbingFixtures: [{ type: 'WC' }, { type: 'LAV' }],
        fixturesCount: 10,
      });

      const { normalizedData } = normalizeExtractedData(data, 'Plumbing');

      expect((normalizedData as Record<string, unknown>).fixturesCount).toBe(2);
    });

    it('does not modify counters that are already correct', () => {
      const data = make({ rooms: [{ number: '101' }, { number: '102' }], roomsCount: 2 });

      const { normalizedData, changesApplied } = normalizeExtractedData(data, 'Architectural');

      expect((normalizedData as Record<string, unknown>).roomsCount).toBe(2);
      expect(changesApplied.filter(c => c.includes('N2'))).toHaveLength(0);
    });
  });

  // N6 — Computed totals
  describe('N6: computed total area', () => {
    it('computes totalArea from room areas when totalArea is missing', () => {
      const data = make({
        rooms: [{ number: '101', area: 200 }, { number: '102', area: 300 }],
      });

      const { normalizedData, changesApplied } = normalizeExtractedData(data, 'Architectural');

      expect((normalizedData as Record<string, unknown>).totalArea).toBe(500);
      expect(changesApplied.some(c => c.includes('N6'))).toBe(true);
    });

    it('recomputes totalArea when existing value is significantly off', () => {
      const data = make({
        rooms: [{ number: '101', area: 150 }, { number: '102', area: 250 }],
        totalArea: 500, // should be 400
      });

      const { normalizedData, changesApplied } = normalizeExtractedData(data, 'Architectural');

      expect((normalizedData as Record<string, unknown>).totalArea).toBe(400);
      expect(changesApplied.some(c => c.includes('N6'))).toBe(true);
    });

    it('does not recompute when totalArea is already accurate (within 1 sf)', () => {
      const data = make({
        rooms: [{ number: '101', area: 200 }, { number: '102', area: 300 }],
        totalArea: 500,
      });

      const { changesApplied } = normalizeExtractedData(data, 'Architectural');

      expect(changesApplied.filter(c => c.includes('N6'))).toHaveLength(0);
    });

    it('handles rooms with string area values by parsing them', () => {
      const data = make({
        rooms: [{ number: '101', area: '150' }, { number: '102', area: '250' }],
      });

      const { normalizedData } = normalizeExtractedData(data, 'Architectural');

      expect((normalizedData as Record<string, unknown>).totalArea).toBe(400);
    });

    it('skips rooms with non-numeric area values gracefully', () => {
      const data = make({
        rooms: [{ number: '101', area: 'unknown' }, { number: '102', area: 300 }],
      });

      const { normalizedData } = normalizeExtractedData(data, 'Architectural');

      expect((normalizedData as Record<string, unknown>).totalArea).toBe(300);
    });
  });

  // N5 — Schema compliance
  describe('N5: schema compliance (field name aliases)', () => {
    it('renames snake_case aliases to camelCase canonical names', () => {
      const data = make({ sheet_number: 'A-101' });

      const { normalizedData, changesApplied } = normalizeExtractedData(data, 'Architectural');

      expect((normalizedData as Record<string, unknown>).sheetNumber).toBe('A-101');
      expect((normalizedData as Record<string, unknown>).sheet_number).toBeUndefined();
      expect(changesApplied.some(c => c.includes('N5') && c.includes('sheet_number'))).toBe(true);
    });

    it('renames "gridlines" to "gridLines"', () => {
      const data = make({ gridlines: ['A', 'B', 'C'] });

      const { normalizedData } = normalizeExtractedData(data, 'Architectural');

      expect((normalizedData as Record<string, unknown>).gridLines).toEqual(['A', 'B', 'C']);
      expect((normalizedData as Record<string, unknown>).gridlines).toBeUndefined();
    });

    it('renames "door_schedule" to "doors"', () => {
      const data = make({ door_schedule: [{ id: 'D1' }] });

      const { normalizedData } = normalizeExtractedData(data, 'Architectural');

      expect((normalizedData as Record<string, unknown>).doors).toBeDefined();
      expect((normalizedData as Record<string, unknown>).door_schedule).toBeUndefined();
    });

    it('does not overwrite an existing canonical field with its alias', () => {
      const data = make({ gridLines: ['A', 'B'], gridlines: ['X', 'Y'] });

      const { normalizedData } = normalizeExtractedData(data, 'Architectural');

      // canonical already exists — alias rename should not clobber it
      expect((normalizedData as Record<string, unknown>).gridLines).toEqual(['A', 'B']);
    });
  });

  describe('edge cases', () => {
    it('handles empty data object without throwing', () => {
      expect(() => normalizeExtractedData(make(), 'Architectural')).not.toThrow();
    });

    it('returns empty changesApplied when data is already clean', () => {
      const data = make({
        sheetNumber: 'A-101',
        sheetTitle: 'Floor Plan',
        scale: '1/4"=1\'-0"',
        discipline: 'Architectural',
        date: '2024-01-15',
      });

      const { changesApplied } = normalizeExtractedData(data, 'Architectural');

      // Most passes should produce no changes on already-clean data
      expect(changesApplied.filter(c => c.includes('N2'))).toHaveLength(0);
      expect(changesApplied.filter(c => c.includes('N4'))).toHaveLength(0);
    });

    it('handles null/undefined array fields without throwing', () => {
      const data = make({ rooms: null, doors: undefined });

      expect(() => normalizeExtractedData(data, 'Architectural')).not.toThrow();
    });
  });
});
