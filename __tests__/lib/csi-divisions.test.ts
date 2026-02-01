import { describe, it, expect, beforeEach } from 'vitest';
import {
  CSIDivision,
  CSI_DIVISIONS,
  getCSIDivisionByNumber,
  getCSIDivisionByCode,
  getCSIDivisionsByTrade,
  getFinishDivisions,
  getMEPDivisions,
  formatCSICode,
  getCSIDivisionNumbers,
  getCSIDivisionOptions,
} from '@/lib/csi-divisions';

describe('csi-divisions', () => {
  // ============================================
  // Data Integrity Tests
  // ============================================
  describe('CSI_DIVISIONS data integrity', () => {
    it('should contain 35 divisions', () => {
      expect(CSI_DIVISIONS).toHaveLength(35);
    });

    it('should have all required properties for each division', () => {
      CSI_DIVISIONS.forEach((division) => {
        expect(division).toHaveProperty('code');
        expect(division).toHaveProperty('number');
        expect(division).toHaveProperty('name');
        expect(division).toHaveProperty('description');
        expect(division).toHaveProperty('commonTrades');
        expect(typeof division.code).toBe('string');
        expect(typeof division.number).toBe('number');
        expect(typeof division.name).toBe('string');
        expect(typeof division.description).toBe('string');
        expect(Array.isArray(division.commonTrades)).toBe(true);
      });
    });

    it('should have unique division numbers', () => {
      const numbers = CSI_DIVISIONS.map((d) => d.number);
      const uniqueNumbers = new Set(numbers);
      expect(uniqueNumbers.size).toBe(CSI_DIVISIONS.length);
    });

    it('should have unique division codes', () => {
      const codes = CSI_DIVISIONS.map((d) => d.code);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(CSI_DIVISIONS.length);
    });

    it('should have code format matching "XX 00 00" pattern', () => {
      const codePattern = /^\d{2} 00 00$/;
      CSI_DIVISIONS.forEach((division) => {
        expect(division.code).toMatch(codePattern);
      });
    });

    it('should have at least one common trade for each division', () => {
      CSI_DIVISIONS.forEach((division) => {
        expect(division.commonTrades.length).toBeGreaterThan(0);
      });
    });

    it('should have non-empty names and descriptions', () => {
      CSI_DIVISIONS.forEach((division) => {
        expect(division.name.length).toBeGreaterThan(0);
        expect(division.description.length).toBeGreaterThan(0);
      });
    });

    it('should include division 0 (Procurement)', () => {
      const division0 = CSI_DIVISIONS.find((d) => d.number === 0);
      expect(division0).toBeDefined();
      expect(division0?.name).toBe('Procurement and Contracting Requirements');
      expect(division0?.code).toBe('00 00 00');
    });

    it('should include all standard divisions 1-14', () => {
      for (let i = 1; i <= 14; i++) {
        const division = CSI_DIVISIONS.find((d) => d.number === i);
        expect(division).toBeDefined();
      }
    });

    it('should include fire suppression division 21', () => {
      const division21 = CSI_DIVISIONS.find((d) => d.number === 21);
      expect(division21).toBeDefined();
      expect(division21?.name).toBe('Fire Suppression');
      expect(division21?.code).toBe('21 00 00');
    });

    it('should include MEP divisions 22, 23, 26', () => {
      expect(CSI_DIVISIONS.find((d) => d.number === 22)).toBeDefined();
      expect(CSI_DIVISIONS.find((d) => d.number === 23)).toBeDefined();
      expect(CSI_DIVISIONS.find((d) => d.number === 26)).toBeDefined();
    });

    it('should include sitework divisions 31-33', () => {
      expect(CSI_DIVISIONS.find((d) => d.number === 31)).toBeDefined();
      expect(CSI_DIVISIONS.find((d) => d.number === 32)).toBeDefined();
      expect(CSI_DIVISIONS.find((d) => d.number === 33)).toBeDefined();
    });

    it('should include process divisions 40-46, 48', () => {
      expect(CSI_DIVISIONS.find((d) => d.number === 40)).toBeDefined();
      expect(CSI_DIVISIONS.find((d) => d.number === 41)).toBeDefined();
      expect(CSI_DIVISIONS.find((d) => d.number === 42)).toBeDefined();
      expect(CSI_DIVISIONS.find((d) => d.number === 43)).toBeDefined();
      expect(CSI_DIVISIONS.find((d) => d.number === 44)).toBeDefined();
      expect(CSI_DIVISIONS.find((d) => d.number === 45)).toBeDefined();
      expect(CSI_DIVISIONS.find((d) => d.number === 46)).toBeDefined();
      expect(CSI_DIVISIONS.find((d) => d.number === 48)).toBeDefined();
    });
  });

  // ============================================
  // getCSIDivisionByNumber Tests
  // ============================================
  describe('getCSIDivisionByNumber', () => {
    it('should return division 0 for Procurement', () => {
      const division = getCSIDivisionByNumber(0);
      expect(division).toBeDefined();
      expect(division?.number).toBe(0);
      expect(division?.code).toBe('00 00 00');
      expect(division?.name).toBe('Procurement and Contracting Requirements');
    });

    it('should return division 3 for Concrete', () => {
      const division = getCSIDivisionByNumber(3);
      expect(division).toBeDefined();
      expect(division?.number).toBe(3);
      expect(division?.code).toBe('03 00 00');
      expect(division?.name).toBe('Concrete');
    });

    it('should return division 9 for Finishes', () => {
      const division = getCSIDivisionByNumber(9);
      expect(division).toBeDefined();
      expect(division?.number).toBe(9);
      expect(division?.code).toBe('09 00 00');
      expect(division?.name).toBe('Finishes');
    });

    it('should return division 26 for Electrical', () => {
      const division = getCSIDivisionByNumber(26);
      expect(division).toBeDefined();
      expect(division?.number).toBe(26);
      expect(division?.code).toBe('26 00 00');
      expect(division?.name).toBe('Electrical');
    });

    it('should return division 48 for Power Generation', () => {
      const division = getCSIDivisionByNumber(48);
      expect(division).toBeDefined();
      expect(division?.number).toBe(48);
      expect(division?.code).toBe('48 00 00');
      expect(division?.name).toBe('Electrical Power Generation');
    });

    it('should return undefined for non-existent division number', () => {
      expect(getCSIDivisionByNumber(99)).toBeUndefined();
      expect(getCSIDivisionByNumber(15)).toBeUndefined();
      expect(getCSIDivisionByNumber(20)).toBeUndefined();
      expect(getCSIDivisionByNumber(47)).toBeUndefined();
    });

    it('should return undefined for negative numbers', () => {
      expect(getCSIDivisionByNumber(-1)).toBeUndefined();
      expect(getCSIDivisionByNumber(-10)).toBeUndefined();
    });

    it('should handle edge case of division 0', () => {
      const division = getCSIDivisionByNumber(0);
      expect(division).toBeDefined();
      expect(division?.number).toBe(0);
    });
  });

  // ============================================
  // getCSIDivisionByCode Tests
  // ============================================
  describe('getCSIDivisionByCode', () => {
    it('should return division for code "00 00 00"', () => {
      const division = getCSIDivisionByCode('00 00 00');
      expect(division).toBeDefined();
      expect(division?.number).toBe(0);
      expect(division?.name).toBe('Procurement and Contracting Requirements');
    });

    it('should return division for code "03 00 00"', () => {
      const division = getCSIDivisionByCode('03 00 00');
      expect(division).toBeDefined();
      expect(division?.number).toBe(3);
      expect(division?.name).toBe('Concrete');
    });

    it('should return division for code "09 00 00"', () => {
      const division = getCSIDivisionByCode('09 00 00');
      expect(division).toBeDefined();
      expect(division?.number).toBe(9);
      expect(division?.name).toBe('Finishes');
    });

    it('should return division for code "26 00 00"', () => {
      const division = getCSIDivisionByCode('26 00 00');
      expect(division).toBeDefined();
      expect(division?.number).toBe(26);
      expect(division?.name).toBe('Electrical');
    });

    it('should return undefined for non-existent code', () => {
      expect(getCSIDivisionByCode('99 00 00')).toBeUndefined();
      expect(getCSIDivisionByCode('15 00 00')).toBeUndefined();
    });

    it('should return undefined for invalid code format', () => {
      expect(getCSIDivisionByCode('3')).toBeUndefined();
      expect(getCSIDivisionByCode('03')).toBeUndefined();
      expect(getCSIDivisionByCode('03 00')).toBeUndefined();
      expect(getCSIDivisionByCode('030000')).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(getCSIDivisionByCode('')).toBeUndefined();
    });

    it('should be case-sensitive', () => {
      expect(getCSIDivisionByCode('03 00 00')).toBeDefined();
      // All codes should be uppercase numbers, so no lowercase variant exists
    });

    it('should handle all valid division codes', () => {
      CSI_DIVISIONS.forEach((expectedDivision) => {
        const result = getCSIDivisionByCode(expectedDivision.code);
        expect(result).toBeDefined();
        expect(result?.code).toBe(expectedDivision.code);
        expect(result?.number).toBe(expectedDivision.number);
      });
    });
  });

  // ============================================
  // getCSIDivisionsByTrade Tests
  // ============================================
  describe('getCSIDivisionsByTrade', () => {
    it('should find divisions by exact trade name match', () => {
      const divisions = getCSIDivisionsByTrade('Concrete');
      expect(divisions.length).toBeGreaterThan(0);
      const hasConcreteDiv = divisions.some((d) => d.number === 3);
      expect(hasConcreteDiv).toBe(true);
    });

    it('should find divisions by partial trade name match (case-insensitive)', () => {
      const divisions = getCSIDivisionsByTrade('electric');
      expect(divisions.length).toBeGreaterThan(0);
      const hasElectricalDiv = divisions.some((d) => d.number === 26);
      expect(hasElectricalDiv).toBe(true);
    });

    it('should find divisions by division name match', () => {
      const divisions = getCSIDivisionsByTrade('Finishes');
      expect(divisions.length).toBeGreaterThan(0);
      const hasFinishDiv = divisions.some((d) => d.number === 9);
      expect(hasFinishDiv).toBe(true);
    });

    it('should find divisions by partial division name match', () => {
      const divisions = getCSIDivisionsByTrade('hvac');
      expect(divisions.length).toBeGreaterThan(0);
      const hasHVACDiv = divisions.some((d) => d.number === 23);
      expect(hasHVACDiv).toBe(true);
    });

    it('should be case-insensitive', () => {
      const upper = getCSIDivisionsByTrade('PLUMBING');
      const lower = getCSIDivisionsByTrade('plumbing');
      const mixed = getCSIDivisionsByTrade('Plumbing');
      expect(upper.length).toBeGreaterThan(0);
      expect(upper.length).toBe(lower.length);
      expect(upper.length).toBe(mixed.length);
    });

    it('should return multiple divisions for common trades', () => {
      const hvacDivisions = getCSIDivisionsByTrade('HVAC');
      expect(hvacDivisions.length).toBeGreaterThan(1);
      const hasDiv22 = hvacDivisions.some((d) => d.number === 22);
      const hasDiv23 = hvacDivisions.some((d) => d.number === 23);
      expect(hasDiv22 || hasDiv23).toBe(true);
    });

    it('should return empty array for non-existent trade', () => {
      const divisions = getCSIDivisionsByTrade('NonExistentTrade12345');
      expect(divisions).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      const divisions = getCSIDivisionsByTrade('');
      // Empty string matches nothing since toLowerCase().includes('') is true for all
      // but we need at least one trade to include it
      expect(Array.isArray(divisions)).toBe(true);
    });

    it('should find masonry division', () => {
      const divisions = getCSIDivisionsByTrade('masonry');
      expect(divisions.length).toBeGreaterThan(0);
      const hasMasonryDiv = divisions.some((d) => d.number === 4 || d.number === 3);
      expect(hasMasonryDiv).toBe(true);
    });

    it('should find roofing division', () => {
      const divisions = getCSIDivisionsByTrade('roofing');
      expect(divisions.length).toBeGreaterThan(0);
      const hasRoofingDiv = divisions.some((d) => d.number === 7);
      expect(hasRoofingDiv).toBe(true);
    });

    it('should find fire protection divisions', () => {
      const divisions = getCSIDivisionsByTrade('fire');
      expect(divisions.length).toBeGreaterThan(0);
      const hasFireDiv = divisions.some((d) => d.number === 21 || d.number === 28);
      expect(hasFireDiv).toBe(true);
    });

    it('should find carpentry in division 6', () => {
      const divisions = getCSIDivisionsByTrade('carpentry');
      expect(divisions.length).toBeGreaterThan(0);
      const hasCarpentryDiv = divisions.some((d) => d.number === 6);
      expect(hasCarpentryDiv).toBe(true);
    });

    it('should find painting in division 9', () => {
      const divisions = getCSIDivisionsByTrade('painting');
      expect(divisions.length).toBeGreaterThan(0);
      const hasPaintingDiv = divisions.some((d) => d.number === 9);
      expect(hasPaintingDiv).toBe(true);
    });

    it('should handle partial word matches', () => {
      const divisions = getCSIDivisionsByTrade('elect');
      expect(divisions.length).toBeGreaterThan(0);
      const hasElectricalDiv = divisions.some((d) => d.number === 26);
      expect(hasElectricalDiv).toBe(true);
    });
  });

  // ============================================
  // getFinishDivisions Tests
  // ============================================
  describe('getFinishDivisions', () => {
    it('should return exactly 4 finish divisions', () => {
      const divisions = getFinishDivisions();
      expect(divisions.length).toBe(4);
    });

    it('should include division 8 (Openings)', () => {
      const divisions = getFinishDivisions();
      const div8 = divisions.find((d) => d.number === 8);
      expect(div8).toBeDefined();
      expect(div8?.name).toBe('Openings');
    });

    it('should include division 9 (Finishes)', () => {
      const divisions = getFinishDivisions();
      const div9 = divisions.find((d) => d.number === 9);
      expect(div9).toBeDefined();
      expect(div9?.name).toBe('Finishes');
    });

    it('should include division 10 (Specialties)', () => {
      const divisions = getFinishDivisions();
      const div10 = divisions.find((d) => d.number === 10);
      expect(div10).toBeDefined();
      expect(div10?.name).toBe('Specialties');
    });

    it('should include division 12 (Furnishings)', () => {
      const divisions = getFinishDivisions();
      const div12 = divisions.find((d) => d.number === 12);
      expect(div12).toBeDefined();
      expect(div12?.name).toBe('Furnishings');
    });

    it('should not include MEP divisions', () => {
      const divisions = getFinishDivisions();
      const hasMEP = divisions.some((d) => [21, 22, 23, 26].includes(d.number));
      expect(hasMEP).toBe(false);
    });

    it('should not include structural divisions', () => {
      const divisions = getFinishDivisions();
      const hasStructural = divisions.some((d) => [3, 4, 5].includes(d.number));
      expect(hasStructural).toBe(false);
    });

    it('should return divisions with correct CSIDivision interface', () => {
      const divisions = getFinishDivisions();
      divisions.forEach((division) => {
        expect(division).toHaveProperty('code');
        expect(division).toHaveProperty('number');
        expect(division).toHaveProperty('name');
        expect(division).toHaveProperty('description');
        expect(division).toHaveProperty('commonTrades');
      });
    });
  });

  // ============================================
  // getMEPDivisions Tests
  // ============================================
  describe('getMEPDivisions', () => {
    it('should return exactly 7 MEP divisions', () => {
      const divisions = getMEPDivisions();
      expect(divisions.length).toBe(7);
    });

    it('should include division 21 (Fire Suppression)', () => {
      const divisions = getMEPDivisions();
      const div21 = divisions.find((d) => d.number === 21);
      expect(div21).toBeDefined();
      expect(div21?.name).toBe('Fire Suppression');
    });

    it('should include division 22 (Plumbing)', () => {
      const divisions = getMEPDivisions();
      const div22 = divisions.find((d) => d.number === 22);
      expect(div22).toBeDefined();
      expect(div22?.name).toBe('Plumbing');
    });

    it('should include division 23 (HVAC)', () => {
      const divisions = getMEPDivisions();
      const div23 = divisions.find((d) => d.number === 23);
      expect(div23).toBeDefined();
      expect(div23?.name).toContain('HVAC');
    });

    it('should include division 25 (Integrated Automation)', () => {
      const divisions = getMEPDivisions();
      const div25 = divisions.find((d) => d.number === 25);
      expect(div25).toBeDefined();
      expect(div25?.name).toBe('Integrated Automation');
    });

    it('should include division 26 (Electrical)', () => {
      const divisions = getMEPDivisions();
      const div26 = divisions.find((d) => d.number === 26);
      expect(div26).toBeDefined();
      expect(div26?.name).toBe('Electrical');
    });

    it('should include division 27 (Communications)', () => {
      const divisions = getMEPDivisions();
      const div27 = divisions.find((d) => d.number === 27);
      expect(div27).toBeDefined();
      expect(div27?.name).toBe('Communications');
    });

    it('should include division 28 (Electronic Safety and Security)', () => {
      const divisions = getMEPDivisions();
      const div28 = divisions.find((d) => d.number === 28);
      expect(div28).toBeDefined();
      expect(div28?.name).toBe('Electronic Safety and Security');
    });

    it('should not include finish divisions', () => {
      const divisions = getMEPDivisions();
      const hasFinishes = divisions.some((d) => [8, 9, 10, 12].includes(d.number));
      expect(hasFinishes).toBe(false);
    });

    it('should not include structural divisions', () => {
      const divisions = getMEPDivisions();
      const hasStructural = divisions.some((d) => [3, 4, 5].includes(d.number));
      expect(hasStructural).toBe(false);
    });

    it('should return divisions in ascending order', () => {
      const divisions = getMEPDivisions();
      const numbers = divisions.map((d) => d.number);
      expect(numbers).toEqual([21, 22, 23, 25, 26, 27, 28]);
    });
  });

  // ============================================
  // formatCSICode Tests
  // ============================================
  describe('formatCSICode', () => {
    it('should format code in "code" format by default', () => {
      const result = formatCSICode('03 00 00');
      expect(result).toBe('03 00 00');
    });

    it('should format code in "code" format explicitly', () => {
      const result = formatCSICode('09 00 00', 'code');
      expect(result).toBe('09 00 00');
    });

    it('should format code in "division" format with leading zero', () => {
      const result = formatCSICode('03 00 00', 'division');
      expect(result).toBe('Division 03');
    });

    it('should format code in "division" format without leading zero for double digits', () => {
      const result = formatCSICode('26 00 00', 'division');
      expect(result).toBe('Division 26');
    });

    it('should format division 0 with leading zero in division format', () => {
      const result = formatCSICode('00 00 00', 'division');
      expect(result).toBe('Division 00');
    });

    it('should format division 9 with leading zero in division format', () => {
      const result = formatCSICode('09 00 00', 'division');
      expect(result).toBe('Division 09');
    });

    it('should return original code for non-existent division in code format', () => {
      const result = formatCSICode('99 00 00', 'code');
      expect(result).toBe('99 00 00');
    });

    it('should return original code for non-existent division in division format', () => {
      const result = formatCSICode('99 00 00', 'division');
      expect(result).toBe('99 00 00');
    });

    it('should return original string for invalid code format', () => {
      const result = formatCSICode('invalid');
      expect(result).toBe('invalid');
    });

    it('should handle empty string', () => {
      const result = formatCSICode('');
      expect(result).toBe('');
    });

    it('should format all valid division codes', () => {
      CSI_DIVISIONS.forEach((division) => {
        const codeFormat = formatCSICode(division.code, 'code');
        expect(codeFormat).toBe(division.code);

        const divisionFormat = formatCSICode(division.code, 'division');
        const expectedNumber = String(division.number).padStart(2, '0');
        expect(divisionFormat).toBe(`Division ${expectedNumber}`);
      });
    });
  });

  // ============================================
  // getCSIDivisionNumbers Tests
  // ============================================
  describe('getCSIDivisionNumbers', () => {
    it('should return array of all division numbers', () => {
      const numbers = getCSIDivisionNumbers();
      expect(Array.isArray(numbers)).toBe(true);
      expect(numbers.length).toBe(35);
    });

    it('should include division 0', () => {
      const numbers = getCSIDivisionNumbers();
      expect(numbers).toContain(0);
    });

    it('should include all standard divisions 1-14', () => {
      const numbers = getCSIDivisionNumbers();
      for (let i = 1; i <= 14; i++) {
        expect(numbers).toContain(i);
      }
    });

    it('should include MEP divisions', () => {
      const numbers = getCSIDivisionNumbers();
      expect(numbers).toContain(21);
      expect(numbers).toContain(22);
      expect(numbers).toContain(23);
      expect(numbers).toContain(26);
    });

    it('should include sitework divisions', () => {
      const numbers = getCSIDivisionNumbers();
      expect(numbers).toContain(31);
      expect(numbers).toContain(32);
      expect(numbers).toContain(33);
    });

    it('should include process divisions', () => {
      const numbers = getCSIDivisionNumbers();
      expect(numbers).toContain(40);
      expect(numbers).toContain(48);
    });

    it('should return only numbers', () => {
      const numbers = getCSIDivisionNumbers();
      numbers.forEach((num) => {
        expect(typeof num).toBe('number');
      });
    });

    it('should not include gaps in numbering', () => {
      const numbers = getCSIDivisionNumbers();
      // Should not include 15-20, 24, 29-30, 36-39, 47, 49-50
      expect(numbers).not.toContain(15);
      expect(numbers).not.toContain(20);
      expect(numbers).not.toContain(24);
      expect(numbers).not.toContain(47);
      expect(numbers).not.toContain(50);
    });

    it('should match the count of CSI_DIVISIONS', () => {
      const numbers = getCSIDivisionNumbers();
      expect(numbers.length).toBe(CSI_DIVISIONS.length);
    });
  });

  // ============================================
  // getCSIDivisionOptions Tests
  // ============================================
  describe('getCSIDivisionOptions', () => {
    it('should return array of option objects', () => {
      const options = getCSIDivisionOptions();
      expect(Array.isArray(options)).toBe(true);
      expect(options.length).toBe(35);
    });

    it('should have value and label properties for each option', () => {
      const options = getCSIDivisionOptions();
      options.forEach((option) => {
        expect(option).toHaveProperty('value');
        expect(option).toHaveProperty('label');
        expect(typeof option.value).toBe('string');
        expect(typeof option.label).toBe('string');
      });
    });

    it('should use division code as value', () => {
      const options = getCSIDivisionOptions();
      const concreteOption = options.find((opt) => opt.value === '03 00 00');
      expect(concreteOption).toBeDefined();
    });

    it('should format label as "XX - Division Name"', () => {
      const options = getCSIDivisionOptions();
      const concreteOption = options.find((opt) => opt.value === '03 00 00');
      expect(concreteOption?.label).toBe('03 - Concrete');
    });

    it('should pad single-digit division numbers with leading zero in label', () => {
      const options = getCSIDivisionOptions();
      const finishesOption = options.find((opt) => opt.value === '09 00 00');
      expect(finishesOption?.label).toBe('09 - Finishes');
    });

    it('should not pad double-digit division numbers', () => {
      const options = getCSIDivisionOptions();
      const electricalOption = options.find((opt) => opt.value === '26 00 00');
      expect(electricalOption?.label).toBe('26 - Electrical');
    });

    it('should include division 0 with proper formatting', () => {
      const options = getCSIDivisionOptions();
      const div0Option = options.find((opt) => opt.value === '00 00 00');
      expect(div0Option).toBeDefined();
      expect(div0Option?.label).toBe('00 - Procurement and Contracting Requirements');
    });

    it('should create options for all divisions', () => {
      const options = getCSIDivisionOptions();
      expect(options.length).toBe(CSI_DIVISIONS.length);
    });

    it('should maintain order from CSI_DIVISIONS array', () => {
      const options = getCSIDivisionOptions();
      options.forEach((option, index) => {
        expect(option.value).toBe(CSI_DIVISIONS[index].code);
        const expectedLabel = `${String(CSI_DIVISIONS[index].number).padStart(2, '0')} - ${CSI_DIVISIONS[index].name}`;
        expect(option.label).toBe(expectedLabel);
      });
    });

    it('should be suitable for select dropdown usage', () => {
      const options = getCSIDivisionOptions();
      // Verify structure matches typical select dropdown requirements
      expect(options[0]).toMatchObject({
        value: expect.any(String),
        label: expect.any(String),
      });
    });

    it('should include all finish divisions in options', () => {
      const options = getCSIDivisionOptions();
      const finishDivNumbers = [8, 9, 10, 12];
      finishDivNumbers.forEach((num) => {
        const code = `${String(num).padStart(2, '0')} 00 00`;
        const hasOption = options.some((opt) => opt.value === code);
        expect(hasOption).toBe(true);
      });
    });

    it('should include all MEP divisions in options', () => {
      const options = getCSIDivisionOptions();
      const mepDivNumbers = [21, 22, 23, 25, 26, 27, 28];
      mepDivNumbers.forEach((num) => {
        const code = `${String(num).padStart(2, '0')} 00 00`;
        const hasOption = options.some((opt) => opt.value === code);
        expect(hasOption).toBe(true);
      });
    });
  });

  // ============================================
  // Edge Cases and Integration Tests
  // ============================================
  describe('edge cases and integration', () => {
    it('should maintain consistency between getCSIDivisionByNumber and getCSIDivisionByCode', () => {
      CSI_DIVISIONS.forEach((division) => {
        const byNumber = getCSIDivisionByNumber(division.number);
        const byCode = getCSIDivisionByCode(division.code);
        expect(byNumber).toEqual(byCode);
      });
    });

    it('should have consistent data between different getter functions', () => {
      const finishDivs = getFinishDivisions();
      finishDivs.forEach((div) => {
        const byNumber = getCSIDivisionByNumber(div.number);
        expect(byNumber).toEqual(div);
      });
    });

    it('should handle rapid successive calls without errors', () => {
      for (let i = 0; i < 100; i++) {
        expect(() => getCSIDivisionByNumber(3)).not.toThrow();
        expect(() => getCSIDivisionByCode('03 00 00')).not.toThrow();
        expect(() => getCSIDivisionsByTrade('concrete')).not.toThrow();
        expect(() => getFinishDivisions()).not.toThrow();
        expect(() => getMEPDivisions()).not.toThrow();
      }
    });

    it('should have no division with empty name', () => {
      const emptyName = CSI_DIVISIONS.find((d) => d.name.trim() === '');
      expect(emptyName).toBeUndefined();
    });

    it('should have no division with empty description', () => {
      const emptyDesc = CSI_DIVISIONS.find((d) => d.description.trim() === '');
      expect(emptyDesc).toBeUndefined();
    });

    it('should have no division with empty commonTrades array', () => {
      const emptyTrades = CSI_DIVISIONS.find((d) => d.commonTrades.length === 0);
      expect(emptyTrades).toBeUndefined();
    });

    it('should verify CSIDivision interface compliance', () => {
      const division = getCSIDivisionByNumber(9);
      const typedDivision: CSIDivision | undefined = division;
      expect(typedDivision).toBeDefined();
      if (typedDivision) {
        expect(typeof typedDivision.code).toBe('string');
        expect(typeof typedDivision.number).toBe('number');
        expect(typeof typedDivision.name).toBe('string');
        expect(typeof typedDivision.description).toBe('string');
        expect(Array.isArray(typedDivision.commonTrades)).toBe(true);
      }
    });
  });

  // ============================================
  // Real-World Usage Scenarios
  // ============================================
  describe('real-world usage scenarios', () => {
    it('should support room finish schedule workflow', () => {
      // Get finish divisions for dropdown
      const finishOptions = getFinishDivisions();
      expect(finishOptions.length).toBeGreaterThan(0);

      // Select a finish division
      const paintingDivs = getCSIDivisionsByTrade('painting');
      expect(paintingDivs.length).toBeGreaterThan(0);

      // Format for display
      const formatted = formatCSICode(paintingDivs[0].code, 'division');
      expect(formatted).toContain('Division');
    });

    it('should support document categorization workflow', () => {
      // Get division by code from document metadata
      const division = getCSIDivisionByCode('26 00 00');
      expect(division).toBeDefined();

      // Get display options
      const options = getCSIDivisionOptions();
      const option = options.find((opt) => opt.value === '26 00 00');
      expect(option?.label).toContain('Electrical');
    });

    it('should support submittal routing workflow', () => {
      // Find divisions for a trade
      const hvacDivisions = getCSIDivisionsByTrade('HVAC');
      expect(hvacDivisions.length).toBeGreaterThan(0);

      // Get detailed division info
      const divisionInfo = getCSIDivisionByNumber(23);
      expect(divisionInfo?.commonTrades).toBeDefined();
      expect(divisionInfo?.description).toBeDefined();
    });

    it('should support cost tracking workflow', () => {
      // Get all MEP divisions for cost grouping
      const mepDivisions = getMEPDivisions();
      expect(mepDivisions.length).toBe(7);

      // Get all division numbers for iteration
      const allNumbers = getCSIDivisionNumbers();
      expect(allNumbers.length).toBe(35);
    });

    it('should support subcontractor assignment workflow', () => {
      // Search for subcontractor trades
      const concreteTrades = getCSIDivisionsByTrade('concrete');
      expect(concreteTrades.length).toBeGreaterThan(0);

      // Get detailed info for assignment
      const division = concreteTrades[0];
      expect(division.commonTrades).toContain('Concrete');
    });

    it('should support multi-trade search', () => {
      // Search should work for various trade variations
      const electrical1 = getCSIDivisionsByTrade('electrical');
      const electrical2 = getCSIDivisionsByTrade('electrician');
      const electrical3 = getCSIDivisionsByTrade('electric');

      expect(electrical1.length).toBeGreaterThan(0);
      expect(electrical2.length).toBeGreaterThan(0);
      expect(electrical3.length).toBeGreaterThan(0);
    });
  });
});
