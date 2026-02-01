import { describe, it, expect, vi, beforeEach } from 'vitest';

// No external dependencies to mock for this file - it's a pure data/utility module
// All functions are self-contained and don't require database or API calls

import {
  // Types and Enums
  Trade,
  Standard,
  // Symbol Arrays
  ELECTRICAL_SYMBOLS,
  MECHANICAL_SYMBOLS,
  PLUMBING_SYMBOLS,
  FIRE_PROTECTION_SYMBOLS,
  ARCHITECTURAL_SYMBOLS,
  ALL_STANDARD_SYMBOLS,
  // Functions
  findSymbolByCode,
  searchSymbols,
  getSymbolsByTrade,
  getSymbolsByCategory,
  matchSymbol,
  getLibraryStats,
  type StandardSymbol,
} from '@/lib/symbol-libraries';

import { SymbolCategory } from '@/lib/legend-extractor';

describe('SymbolLibraries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // DATA INTEGRITY TESTS
  // ============================================================================

  describe('Symbol Data Arrays', () => {
    it('should have electrical symbols with correct structure', () => {
      expect(ELECTRICAL_SYMBOLS.length).toBeGreaterThan(0);

      const symbol = ELECTRICAL_SYMBOLS[0];
      expect(symbol).toHaveProperty('code');
      expect(symbol).toHaveProperty('description');
      expect(symbol).toHaveProperty('category');
      expect(symbol).toHaveProperty('trade');
      expect(symbol).toHaveProperty('standard');
      expect(symbol).toHaveProperty('alternativeCodes');
      expect(Array.isArray(symbol.alternativeCodes)).toBe(true);
    });

    it('should have mechanical symbols with correct structure', () => {
      expect(MECHANICAL_SYMBOLS.length).toBeGreaterThan(0);

      const symbol = MECHANICAL_SYMBOLS[0];
      expect(symbol.category).toBe(SymbolCategory.MECHANICAL);
      expect(symbol.trade).toBe(Trade.MECHANICAL);
    });

    it('should have plumbing symbols with correct structure', () => {
      expect(PLUMBING_SYMBOLS.length).toBeGreaterThan(0);

      const symbol = PLUMBING_SYMBOLS[0];
      expect(symbol.category).toBe(SymbolCategory.PLUMBING);
      expect(symbol.trade).toBe(Trade.PLUMBING);
    });

    it('should have fire protection symbols with correct structure', () => {
      expect(FIRE_PROTECTION_SYMBOLS.length).toBeGreaterThan(0);

      const symbol = FIRE_PROTECTION_SYMBOLS[0];
      expect(symbol.category).toBe(SymbolCategory.FIRE_PROTECTION);
      expect(symbol.trade).toBe(Trade.FIRE_PROTECTION);
    });

    it('should have architectural symbols with correct structure', () => {
      expect(ARCHITECTURAL_SYMBOLS.length).toBeGreaterThan(0);

      const symbol = ARCHITECTURAL_SYMBOLS[0];
      expect(symbol.category).toBe(SymbolCategory.ARCHITECTURAL);
      expect(symbol.trade).toBe(Trade.ARCHITECTURAL);
    });

    it('should combine all symbols in ALL_STANDARD_SYMBOLS', () => {
      const totalSymbols =
        ELECTRICAL_SYMBOLS.length +
        MECHANICAL_SYMBOLS.length +
        PLUMBING_SYMBOLS.length +
        FIRE_PROTECTION_SYMBOLS.length +
        ARCHITECTURAL_SYMBOLS.length;

      expect(ALL_STANDARD_SYMBOLS.length).toBe(totalSymbols);
    });

    it('should have unique codes across all symbols', () => {
      const codes = ALL_STANDARD_SYMBOLS.map(s => s.code);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it('should have all required fields for each symbol', () => {
      ALL_STANDARD_SYMBOLS.forEach((symbol) => {
        expect(symbol.code).toBeTruthy();
        expect(symbol.description).toBeTruthy();
        expect(symbol.category).toBeTruthy();
        expect(symbol.trade).toBeTruthy();
        expect(symbol.standard).toBeTruthy();
        expect(Array.isArray(symbol.alternativeCodes)).toBe(true);
      });
    });
  });

  // ============================================================================
  // findSymbolByCode TESTS
  // ============================================================================

  describe('findSymbolByCode', () => {
    describe('exact code matches', () => {
      it('should find electrical symbol by exact code', () => {
        const result = findSymbolByCode('E-1');
        expect(result).toBeTruthy();
        expect(result?.code).toBe('E-1');
        expect(result?.description).toBe('Duplex Receptacle');
      });

      it('should find mechanical symbol by exact code', () => {
        const result = findSymbolByCode('M-1');
        expect(result).toBeTruthy();
        expect(result?.code).toBe('M-1');
        expect(result?.description).toBe('Supply Air Diffuser');
      });

      it('should find plumbing symbol by exact code', () => {
        const result = findSymbolByCode('P-1');
        expect(result).toBeTruthy();
        expect(result?.code).toBe('P-1');
        expect(result?.description).toBe('Water Closet');
      });

      it('should find fire protection symbol by exact code', () => {
        const result = findSymbolByCode('FP-1');
        expect(result).toBeTruthy();
        expect(result?.code).toBe('FP-1');
        expect(result?.description).toBe('Fire Alarm Pull Station');
      });

      it('should find architectural symbol by exact code', () => {
        const result = findSymbolByCode('A-1');
        expect(result).toBeTruthy();
        expect(result?.code).toBe('A-1');
        expect(result?.description).toBe('Door, Single Swing');
      });
    });

    describe('case insensitivity', () => {
      it('should find symbol with lowercase code', () => {
        const result = findSymbolByCode('e-1');
        expect(result).toBeTruthy();
        expect(result?.code).toBe('E-1');
      });

      it('should find symbol with mixed case code', () => {
        const result = findSymbolByCode('Fp-1');
        expect(result).toBeTruthy();
        expect(result?.code).toBe('FP-1');
      });

      it('should find symbol with uppercase code', () => {
        const result = findSymbolByCode('M-1');
        expect(result).toBeTruthy();
        expect(result?.code).toBe('M-1');
      });
    });

    describe('alternative codes', () => {
      it('should find symbol by alternative code', () => {
        const result = findSymbolByCode('RECEP');
        expect(result).toBeTruthy();
        expect(result?.code).toBe('E-1');
        expect(result?.description).toBe('Duplex Receptacle');
      });

      it('should find symbol by special character alternative code', () => {
        const result = findSymbolByCode('⊗');
        expect(result).toBeTruthy();
        expect(result?.code).toBe('E-1');
      });

      it('should find symbol by alternative code (GFCI)', () => {
        const result = findSymbolByCode('GFI');
        expect(result).toBeTruthy();
        expect(result?.code).toBe('E-2');
        expect(result?.description).toBe('GFCI Receptacle');
      });

      it('should find symbol by alternative code (switch)', () => {
        const result = findSymbolByCode('SW');
        expect(result).toBeTruthy();
        expect(result?.code).toBe('E-3');
      });

      it('should find symbol by alternative code case insensitive', () => {
        const result = findSymbolByCode('gfi');
        expect(result).toBeTruthy();
        expect(result?.code).toBe('E-2');
      });
    });

    describe('whitespace handling', () => {
      it('should trim whitespace from code', () => {
        const result = findSymbolByCode('  E-1  ');
        expect(result).toBeTruthy();
        expect(result?.code).toBe('E-1');
      });

      it('should handle code with leading whitespace', () => {
        const result = findSymbolByCode('  M-1');
        expect(result).toBeTruthy();
        expect(result?.code).toBe('M-1');
      });

      it('should handle code with trailing whitespace', () => {
        const result = findSymbolByCode('P-1  ');
        expect(result).toBeTruthy();
        expect(result?.code).toBe('P-1');
      });
    });

    describe('edge cases', () => {
      it('should return null for non-existent code', () => {
        const result = findSymbolByCode('XYZ-999');
        expect(result).toBeNull();
      });

      it('should return null for empty string', () => {
        const result = findSymbolByCode('');
        expect(result).toBeNull();
      });

      it('should return null for whitespace only', () => {
        const result = findSymbolByCode('   ');
        expect(result).toBeNull();
      });

      it('should handle special characters that do not match', () => {
        const result = findSymbolByCode('###');
        expect(result).toBeNull();
      });
    });
  });

  // ============================================================================
  // searchSymbols TESTS
  // ============================================================================

  describe('searchSymbols', () => {
    describe('description search', () => {
      it('should find symbols by description keyword', () => {
        const results = searchSymbols('receptacle');
        expect(results.length).toBeGreaterThan(0);
        expect(results.some(s => s.description.toLowerCase().includes('receptacle'))).toBe(true);
      });

      it('should find symbols by partial description', () => {
        const results = searchSymbols('light');
        expect(results.length).toBeGreaterThan(0);
        expect(results.some(s => s.description.toLowerCase().includes('light'))).toBe(true);
      });

      it('should find symbols by description case insensitive', () => {
        const results = searchSymbols('SWITCH');
        expect(results.length).toBeGreaterThan(0);
        expect(results.some(s => s.description.toLowerCase().includes('switch'))).toBe(true);
      });

      it('should find plumbing fixtures', () => {
        const results = searchSymbols('toilet');
        expect(results.length).toBeGreaterThan(0);
        expect(results.some(s => s.code === 'P-1')).toBe(true);
      });

      it('should find mechanical equipment', () => {
        const results = searchSymbols('thermostat');
        expect(results.length).toBeGreaterThan(0);
        expect(results.some(s => s.code === 'M-4')).toBe(true);
      });
    });

    describe('code search', () => {
      it('should find symbols by code', () => {
        const results = searchSymbols('E-1');
        expect(results.length).toBeGreaterThan(0);
        expect(results.some(s => s.code === 'E-1')).toBe(true);
      });

      it('should find symbols by partial code', () => {
        const results = searchSymbols('E-');
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(s => s.code.startsWith('E-'))).toBe(true);
      });

      it('should find symbols by code prefix', () => {
        const results = searchSymbols('FP');
        expect(results.length).toBeGreaterThan(0);
        expect(results.some(s => s.code.startsWith('FP-'))).toBe(true);
      });
    });

    describe('alternative code search', () => {
      it('should find symbols by alternative code', () => {
        const results = searchSymbols('GFCI');
        expect(results.length).toBeGreaterThan(0);
        expect(results.some(s => s.code === 'E-2')).toBe(true);
      });

      it('should find symbols by alternative code abbreviation', () => {
        const results = searchSymbols('VAV');
        expect(results.length).toBeGreaterThan(0);
        expect(results.some(s => s.code === 'M-5')).toBe(true);
      });

      it('should find symbols by alternative code case insensitive', () => {
        const results = searchSymbols('ahu');
        expect(results.length).toBeGreaterThan(0);
        expect(results.some(s => s.code === 'M-6')).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should return empty array for non-matching query', () => {
        const results = searchSymbols('xyznonexistent');
        expect(results).toEqual([]);
      });

      it('should return all symbols for empty string', () => {
        // Empty string matches all symbols (everything includes empty string)
        const results = searchSymbols('');
        expect(results.length).toBe(ALL_STANDARD_SYMBOLS.length);
      });

      it('should handle single character search', () => {
        const results = searchSymbols('T');
        expect(results.length).toBeGreaterThan(0);
      });

      it('should handle special characters in search', () => {
        const results = searchSymbols('3-Way');
        expect(results.length).toBeGreaterThan(0);
      });
    });

    describe('multiple results', () => {
      it('should return multiple symbols for common term', () => {
        const results = searchSymbols('door');
        expect(results.length).toBeGreaterThan(1);
        // Most door symbols are architectural, but some may have "door" in alternative codes
        const architecturalDoors = results.filter(s => s.trade === Trade.ARCHITECTURAL);
        expect(architecturalDoors.length).toBeGreaterThan(1);
      });

      it('should return multiple symbols for fire', () => {
        const results = searchSymbols('fire');
        expect(results.length).toBeGreaterThan(1);
      });

      it('should return multiple symbols for window', () => {
        const results = searchSymbols('window');
        expect(results.length).toBeGreaterThan(1);
      });
    });
  });

  // ============================================================================
  // getSymbolsByTrade TESTS
  // ============================================================================

  describe('getSymbolsByTrade', () => {
    it('should return all electrical symbols', () => {
      const results = getSymbolsByTrade(Trade.ELECTRICAL);
      expect(results.length).toBe(ELECTRICAL_SYMBOLS.length);
      expect(results.every(s => s.trade === Trade.ELECTRICAL)).toBe(true);
    });

    it('should return all mechanical symbols', () => {
      const results = getSymbolsByTrade(Trade.MECHANICAL);
      expect(results.length).toBe(MECHANICAL_SYMBOLS.length);
      expect(results.every(s => s.trade === Trade.MECHANICAL)).toBe(true);
    });

    it('should return all plumbing symbols', () => {
      const results = getSymbolsByTrade(Trade.PLUMBING);
      expect(results.length).toBe(PLUMBING_SYMBOLS.length);
      expect(results.every(s => s.trade === Trade.PLUMBING)).toBe(true);
    });

    it('should return all fire protection symbols', () => {
      const results = getSymbolsByTrade(Trade.FIRE_PROTECTION);
      expect(results.length).toBe(FIRE_PROTECTION_SYMBOLS.length);
      expect(results.every(s => s.trade === Trade.FIRE_PROTECTION)).toBe(true);
    });

    it('should return all architectural symbols', () => {
      const results = getSymbolsByTrade(Trade.ARCHITECTURAL);
      expect(results.length).toBe(ARCHITECTURAL_SYMBOLS.length);
      expect(results.every(s => s.trade === Trade.ARCHITECTURAL)).toBe(true);
    });

    it('should return empty array for trade with no symbols', () => {
      const results = getSymbolsByTrade(Trade.STRUCTURAL);
      expect(results).toEqual([]);
    });

    it('should return empty array for civil trade', () => {
      const results = getSymbolsByTrade(Trade.CIVIL);
      expect(results).toEqual([]);
    });

    it('should return empty array for landscape trade', () => {
      const results = getSymbolsByTrade(Trade.LANDSCAPE);
      expect(results).toEqual([]);
    });
  });

  // ============================================================================
  // getSymbolsByCategory TESTS
  // ============================================================================

  describe('getSymbolsByCategory', () => {
    it('should return all electrical category symbols', () => {
      const results = getSymbolsByCategory(SymbolCategory.ELECTRICAL);
      expect(results.length).toBe(ELECTRICAL_SYMBOLS.length);
      expect(results.every(s => s.category === SymbolCategory.ELECTRICAL)).toBe(true);
    });

    it('should return all mechanical category symbols', () => {
      const results = getSymbolsByCategory(SymbolCategory.MECHANICAL);
      expect(results.length).toBe(MECHANICAL_SYMBOLS.length);
      expect(results.every(s => s.category === SymbolCategory.MECHANICAL)).toBe(true);
    });

    it('should return all plumbing category symbols', () => {
      const results = getSymbolsByCategory(SymbolCategory.PLUMBING);
      expect(results.length).toBe(PLUMBING_SYMBOLS.length);
      expect(results.every(s => s.category === SymbolCategory.PLUMBING)).toBe(true);
    });

    it('should return all fire protection category symbols', () => {
      const results = getSymbolsByCategory(SymbolCategory.FIRE_PROTECTION);
      expect(results.length).toBe(FIRE_PROTECTION_SYMBOLS.length);
      expect(results.every(s => s.category === SymbolCategory.FIRE_PROTECTION)).toBe(true);
    });

    it('should return all architectural category symbols', () => {
      const results = getSymbolsByCategory(SymbolCategory.ARCHITECTURAL);
      expect(results.length).toBe(ARCHITECTURAL_SYMBOLS.length);
      expect(results.every(s => s.category === SymbolCategory.ARCHITECTURAL)).toBe(true);
    });

    it('should return empty array for structural category', () => {
      const results = getSymbolsByCategory(SymbolCategory.STRUCTURAL);
      expect(results).toEqual([]);
    });

    it('should return empty array for civil category', () => {
      const results = getSymbolsByCategory(SymbolCategory.CIVIL);
      expect(results).toEqual([]);
    });

    it('should return empty array for general category', () => {
      const results = getSymbolsByCategory(SymbolCategory.GENERAL);
      expect(results).toEqual([]);
    });

    it('should return empty array for unknown category', () => {
      const results = getSymbolsByCategory(SymbolCategory.UNKNOWN);
      expect(results).toEqual([]);
    });
  });

  // ============================================================================
  // matchSymbol TESTS
  // ============================================================================

  describe('matchSymbol', () => {
    describe('exact code match', () => {
      it('should match by exact code with high confidence', () => {
        const result = matchSymbol('E-1');
        expect(result.match).toBeTruthy();
        expect(result.match?.code).toBe('E-1');
        expect(result.confidence).toBe(0.95);
      });

      it('should match by alternative code with high confidence', () => {
        const result = matchSymbol('GFCI');
        expect(result.match).toBeTruthy();
        expect(result.match?.code).toBe('E-2');
        expect(result.confidence).toBe(0.95);
      });

      it('should match case insensitive', () => {
        const result = matchSymbol('fp-1');
        expect(result.match).toBeTruthy();
        expect(result.match?.code).toBe('FP-1');
        expect(result.confidence).toBe(0.95);
      });
    });

    describe('description match', () => {
      it('should match by description with medium confidence', () => {
        const result = matchSymbol('UNKNOWN', 'duplex receptacle');
        expect(result.match).toBeTruthy();
        expect(result.match?.code).toBe('E-1');
        expect(result.confidence).toBe(0.85);
      });

      it('should match by partial description', () => {
        const result = matchSymbol('UNKNOWN', 'light switch');
        expect(result.match).toBeTruthy();
        expect(result.match?.description).toContain('Light Switch');
        expect(result.confidence).toBe(0.85);
      });

      it('should prioritize exact code match over description', () => {
        const result = matchSymbol('E-1', 'something else');
        expect(result.match).toBeTruthy();
        expect(result.match?.code).toBe('E-1');
        expect(result.confidence).toBe(0.95);
      });
    });

    describe('category filtering', () => {
      it('should filter by category when provided', () => {
        const result = matchSymbol(
          'UNKNOWN',
          'receptacle',
          SymbolCategory.ELECTRICAL
        );
        expect(result.match).toBeTruthy();
        expect(result.match?.category).toBe(SymbolCategory.ELECTRICAL);
        expect(result.confidence).toBe(0.85);
      });

      it('should not match if category does not match', () => {
        const result = matchSymbol(
          'UNKNOWN',
          'duplex receptacle',
          SymbolCategory.MECHANICAL
        );
        expect(result.match).toBeNull();
        expect(result.confidence).toBe(0);
      });

      it('should match first result in category', () => {
        const result = matchSymbol(
          'UNKNOWN',
          'door',
          SymbolCategory.ARCHITECTURAL
        );
        expect(result.match).toBeTruthy();
        expect(result.match?.category).toBe(SymbolCategory.ARCHITECTURAL);
        expect(result.match?.description).toContain('Door');
      });

      it('should work without category filter', () => {
        const result = matchSymbol('UNKNOWN', 'door');
        expect(result.match).toBeTruthy();
        expect(result.confidence).toBe(0.85);
      });
    });

    describe('no match cases', () => {
      it('should return null match for non-existent code and no description', () => {
        const result = matchSymbol('XYZ-999');
        expect(result.match).toBeNull();
        expect(result.confidence).toBe(0);
      });

      it('should return null match for non-matching description', () => {
        const result = matchSymbol('UNKNOWN', 'nonexistent symbol');
        expect(result.match).toBeNull();
        expect(result.confidence).toBe(0);
      });

      it('should return null match for empty code and no description', () => {
        const result = matchSymbol('');
        expect(result.match).toBeNull();
        expect(result.confidence).toBe(0);
      });

      it('should return null match for empty code and empty description', () => {
        const result = matchSymbol('', '');
        expect(result.match).toBeNull();
        expect(result.confidence).toBe(0);
      });
    });

    describe('edge cases', () => {
      it('should handle whitespace in code', () => {
        const result = matchSymbol('  E-1  ', 'test');
        expect(result.match).toBeTruthy();
        expect(result.match?.code).toBe('E-1');
      });

      it('should handle multiple matching descriptions', () => {
        const result = matchSymbol('UNKNOWN', 'fire');
        expect(result.match).toBeTruthy();
        expect(result.confidence).toBe(0.85);
      });

      it('should return first match when multiple descriptions match', () => {
        const result = matchSymbol('UNKNOWN', 'window');
        expect(result.match).toBeTruthy();
        expect(result.match?.description).toContain('Window');
      });
    });
  });

  // ============================================================================
  // getLibraryStats TESTS
  // ============================================================================

  describe('getLibraryStats', () => {
    it('should return correct total count', () => {
      const stats = getLibraryStats();
      expect(stats.total).toBe(ALL_STANDARD_SYMBOLS.length);
    });

    it('should count symbols by trade', () => {
      const stats = getLibraryStats();
      expect(stats.byTrade[Trade.ELECTRICAL]).toBe(ELECTRICAL_SYMBOLS.length);
      expect(stats.byTrade[Trade.MECHANICAL]).toBe(MECHANICAL_SYMBOLS.length);
      expect(stats.byTrade[Trade.PLUMBING]).toBe(PLUMBING_SYMBOLS.length);
      expect(stats.byTrade[Trade.FIRE_PROTECTION]).toBe(FIRE_PROTECTION_SYMBOLS.length);
      expect(stats.byTrade[Trade.ARCHITECTURAL]).toBe(ARCHITECTURAL_SYMBOLS.length);
    });

    it('should count symbols by category', () => {
      const stats = getLibraryStats();
      expect(stats.byCategory[SymbolCategory.ELECTRICAL]).toBe(ELECTRICAL_SYMBOLS.length);
      expect(stats.byCategory[SymbolCategory.MECHANICAL]).toBe(MECHANICAL_SYMBOLS.length);
      expect(stats.byCategory[SymbolCategory.PLUMBING]).toBe(PLUMBING_SYMBOLS.length);
      expect(stats.byCategory[SymbolCategory.FIRE_PROTECTION]).toBe(FIRE_PROTECTION_SYMBOLS.length);
      expect(stats.byCategory[SymbolCategory.ARCHITECTURAL]).toBe(ARCHITECTURAL_SYMBOLS.length);
    });

    it('should count symbols by standard', () => {
      const stats = getLibraryStats();
      expect(stats.byStandard).toBeDefined();
      expect(stats.byStandard[Standard.CSI]).toBeGreaterThan(0);
      expect(stats.byStandard[Standard.AIA]).toBeGreaterThan(0);
      expect(stats.byStandard[Standard.NFPA]).toBeGreaterThan(0);
    });

    it('should have total equal to sum of trade counts', () => {
      const stats = getLibraryStats();
      const tradeSum = Object.values(stats.byTrade).reduce((a, b) => a + b, 0);
      expect(stats.total).toBe(tradeSum);
    });

    it('should have total equal to sum of category counts', () => {
      const stats = getLibraryStats();
      const categorySum = Object.values(stats.byCategory).reduce((a, b) => a + b, 0);
      expect(stats.total).toBe(categorySum);
    });

    it('should have total equal to sum of standard counts', () => {
      const stats = getLibraryStats();
      const standardSum = Object.values(stats.byStandard).reduce((a, b) => a + b, 0);
      expect(stats.total).toBe(standardSum);
    });

    it('should return stats object with all expected properties', () => {
      const stats = getLibraryStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('byTrade');
      expect(stats).toHaveProperty('byCategory');
      expect(stats).toHaveProperty('byStandard');
    });

    it('should have non-zero counts for all defined trades', () => {
      const stats = getLibraryStats();
      expect(stats.byTrade[Trade.ELECTRICAL]).toBeGreaterThan(0);
      expect(stats.byTrade[Trade.MECHANICAL]).toBeGreaterThan(0);
      expect(stats.byTrade[Trade.PLUMBING]).toBeGreaterThan(0);
      expect(stats.byTrade[Trade.FIRE_PROTECTION]).toBeGreaterThan(0);
      expect(stats.byTrade[Trade.ARCHITECTURAL]).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // SPECIFIC SYMBOL CONTENT TESTS
  // ============================================================================

  describe('Specific Symbol Verification', () => {
    describe('Electrical symbols', () => {
      it('should have E-1 as duplex receptacle', () => {
        const symbol = findSymbolByCode('E-1');
        expect(symbol?.description).toBe('Duplex Receptacle');
        expect(symbol?.specification).toBe('26 27 26');
      });

      it('should have E-2 as GFCI receptacle', () => {
        const symbol = findSymbolByCode('E-2');
        expect(symbol?.description).toBe('GFCI Receptacle');
        expect(symbol?.alternativeCodes).toContain('GFI');
      });

      it('should have E-3 as single pole switch', () => {
        const symbol = findSymbolByCode('E-3');
        expect(symbol?.description).toBe('Light Switch, Single Pole');
        expect(symbol?.alternativeCodes).toContain('S');
      });

      it('should have smoke detector in electrical', () => {
        const symbol = findSymbolByCode('E-18');
        expect(symbol?.description).toBe('Smoke Detector');
        expect(symbol?.specification).toBe('28 31 11');
      });
    });

    describe('Mechanical symbols', () => {
      it('should have M-1 as supply air diffuser', () => {
        const symbol = findSymbolByCode('M-1');
        expect(symbol?.description).toBe('Supply Air Diffuser');
        expect(symbol?.specification).toBe('23 37 13');
      });

      it('should have M-4 as thermostat', () => {
        const symbol = findSymbolByCode('M-4');
        expect(symbol?.description).toBe('Thermostat');
        expect(symbol?.alternativeCodes).toContain('TSTAT');
      });

      it('should have M-6 as AHU', () => {
        const symbol = findSymbolByCode('M-6');
        expect(symbol?.description).toBe('Air Handling Unit');
        expect(symbol?.alternativeCodes).toContain('AHU');
      });
    });

    describe('Plumbing symbols', () => {
      it('should have P-1 as water closet', () => {
        const symbol = findSymbolByCode('P-1');
        expect(symbol?.description).toBe('Water Closet');
        expect(symbol?.alternativeCodes).toContain('WC');
      });

      it('should have P-2 as lavatory', () => {
        const symbol = findSymbolByCode('P-2');
        expect(symbol?.description).toBe('Lavatory');
        expect(symbol?.alternativeCodes).toContain('LAV');
      });

      it('should have P-10 as water heater', () => {
        const symbol = findSymbolByCode('P-10');
        expect(symbol?.description).toBe('Water Heater');
        expect(symbol?.alternativeCodes).toContain('WH');
      });
    });

    describe('Fire protection symbols', () => {
      it('should have FP-1 as pull station', () => {
        const symbol = findSymbolByCode('FP-1');
        expect(symbol?.description).toBe('Fire Alarm Pull Station');
        expect(symbol?.standard).toBe(Standard.NFPA);
      });

      it('should have FP-3 as sprinkler head', () => {
        const symbol = findSymbolByCode('FP-3');
        expect(symbol?.description).toBe('Sprinkler Head');
        expect(symbol?.specification).toBe('21 13 13');
      });

      it('should have FP-10 as FDC', () => {
        const symbol = findSymbolByCode('FP-10');
        expect(symbol?.description).toBe('Fire Department Connection');
        expect(symbol?.alternativeCodes).toContain('FDC');
      });
    });

    describe('Architectural symbols', () => {
      it('should have A-1 as single swing door', () => {
        const symbol = findSymbolByCode('A-1');
        expect(symbol?.description).toBe('Door, Single Swing');
        expect(symbol?.standard).toBe(Standard.AIA);
      });

      it('should have A-15 as elevator', () => {
        const symbol = findSymbolByCode('A-15');
        expect(symbol?.description).toBe('Elevator');
        expect(symbol?.specification).toBe('14 21 00');
      });

      it('should have A-22 as north arrow', () => {
        const symbol = findSymbolByCode('A-22');
        expect(symbol?.description).toBe('North Arrow');
        expect(symbol?.specification).toBe('Drawing Annotation');
      });
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration scenarios', () => {
    it('should find symbol by code then get all in same trade', () => {
      const symbol = findSymbolByCode('E-1');
      expect(symbol).toBeTruthy();

      const tradeSymbols = getSymbolsByTrade(symbol!.trade);
      expect(tradeSymbols.length).toBeGreaterThan(1);
      expect(tradeSymbols.some(s => s.code === 'E-1')).toBe(true);
    });

    it('should search and then filter by trade', () => {
      const searchResults = searchSymbols('switch');
      expect(searchResults.length).toBeGreaterThan(0);

      const electricalSwitches = searchResults.filter(
        s => s.trade === Trade.ELECTRICAL
      );
      expect(electricalSwitches.length).toBeGreaterThan(0);
    });

    it('should match symbol and verify category', () => {
      const match = matchSymbol('RECEP', undefined, SymbolCategory.ELECTRICAL);
      expect(match.match).toBeTruthy();
      expect(match.match?.category).toBe(SymbolCategory.ELECTRICAL);

      const categorySymbols = getSymbolsByCategory(match.match!.category);
      expect(categorySymbols.some(s => s.code === match.match!.code)).toBe(true);
    });

    it('should get stats and verify counts', () => {
      const stats = getLibraryStats();

      const electricalSymbols = getSymbolsByTrade(Trade.ELECTRICAL);
      expect(stats.byTrade[Trade.ELECTRICAL]).toBe(electricalSymbols.length);

      const mechanicalSymbols = getSymbolsByTrade(Trade.MECHANICAL);
      expect(stats.byTrade[Trade.MECHANICAL]).toBe(mechanicalSymbols.length);
    });

    it('should search, match, and verify consistency', () => {
      const searchResults = searchSymbols('GFCI');
      expect(searchResults.length).toBeGreaterThan(0);

      const matchResult = matchSymbol('GFCI');
      expect(matchResult.match).toBeTruthy();

      expect(searchResults.some(s => s.code === matchResult.match!.code)).toBe(true);
    });
  });

  // ============================================================================
  // PERFORMANCE TESTS
  // ============================================================================

  describe('Performance', () => {
    it('should handle multiple sequential searches efficiently', () => {
      const queries = ['switch', 'door', 'light', 'valve', 'detector'];

      queries.forEach(query => {
        const results = searchSymbols(query);
        expect(Array.isArray(results)).toBe(true);
      });
    });

    it('should handle multiple code lookups efficiently', () => {
      const codes = ['E-1', 'M-1', 'P-1', 'FP-1', 'A-1'];

      codes.forEach(code => {
        const result = findSymbolByCode(code);
        expect(result).toBeTruthy();
      });
    });

    it('should handle multiple trade queries efficiently', () => {
      const trades = [
        Trade.ELECTRICAL,
        Trade.MECHANICAL,
        Trade.PLUMBING,
        Trade.FIRE_PROTECTION,
        Trade.ARCHITECTURAL
      ];

      trades.forEach(trade => {
        const results = getSymbolsByTrade(trade);
        expect(results.length).toBeGreaterThan(0);
      });
    });

    it('should handle stats calculation repeatedly', () => {
      for (let i = 0; i < 10; i++) {
        const stats = getLibraryStats();
        expect(stats.total).toBe(ALL_STANDARD_SYMBOLS.length);
      }
    });
  });
});
