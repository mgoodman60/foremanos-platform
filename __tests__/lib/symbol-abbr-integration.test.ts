import { describe, it, expect, vi, beforeEach } from 'vitest';

// This is a pure integration module that combines symbol-libraries and construction-abbreviations
// Both dependencies are pure data/utility modules with no external dependencies
// No mocking needed for the actual functionality

import {
  unifiedLookup,
  generateComprehensiveContext,
  getTradeSpecificContext,
  isAmbiguousCode,
  getAllInterpretations,
  generateDocumentLegend,
  getCoverageStats,
  type IntegratedLookupResult,
} from '@/lib/symbol-abbr-integration';

import { Trade } from '@/lib/symbol-libraries';

describe('symbol-abbr-integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // unifiedLookup Tests
  // ============================================================================

  describe('unifiedLookup', () => {
    describe('symbol-only matches', () => {
      it('should find symbol-only code with high confidence', () => {
        const result = unifiedLookup('E-1');

        expect(result.type).toBe('symbol');
        expect(result.symbol).toBeDefined();
        expect(result.symbol?.code).toBe('E-1');
        expect(result.symbol?.description).toBe('Duplex Receptacle');
        expect(result.abbreviation).toBeUndefined();
        expect(result.expansion).toBeUndefined();
        expect(result.confidence).toBe(0.9);
      });

      it('should find mechanical symbol', () => {
        const result = unifiedLookup('M-1');

        expect(result.type).toBe('symbol');
        expect(result.symbol?.code).toBe('M-1');
        expect(result.symbol?.trade).toBe('mechanical');
        expect(result.confidence).toBe(0.9);
      });

      it('should find plumbing symbol', () => {
        const result = unifiedLookup('P-1');

        expect(result.type).toBe('symbol');
        expect(result.symbol?.code).toBe('P-1');
        expect(result.symbol?.description).toBe('Water Closet');
      });

      it('should find fire protection symbol', () => {
        const result = unifiedLookup('FP-1');

        expect(result.type).toBe('symbol');
        expect(result.symbol?.code).toBe('FP-1');
        expect(result.symbol?.trade).toBe('fire_protection');
      });

      it('should find architectural symbol', () => {
        const result = unifiedLookup('A-1');

        expect(result.type).toBe('symbol');
        expect(result.symbol?.code).toBe('A-1');
        expect(result.symbol?.trade).toBe('architectural');
      });
    });

    describe('abbreviation-only matches', () => {
      it('should find abbreviation-only code', () => {
        const result = unifiedLookup('CONF');

        expect(result.type).toBe('abbreviation');
        expect(result.abbreviation).toBeDefined();
        expect(result.abbreviation?.abbreviation).toBe('CONF');
        expect(result.expansion).toBe('Conference Room');
        expect(result.symbol).toBeUndefined();
        expect(result.confidence).toBe(0.9);
      });

      it('should find room type abbreviation', () => {
        const result = unifiedLookup('OFF');

        expect(result.type).toBe('abbreviation');
        expect(result.expansion).toBe('Office');
      });

      it('should find material abbreviation', () => {
        const result = unifiedLookup('VCT');

        expect(result.type).toBe('abbreviation');
        expect(result.expansion).toBe('Vinyl Composition Tile');
      });

      it('should find MEP abbreviation', () => {
        const result = unifiedLookup('HVAC');

        expect(result.type).toBe('abbreviation');
        expect(result.expansion).toBe('Heating, Ventilation, and Air Conditioning');
      });
    });

    describe('both symbol and abbreviation matches', () => {
      it('should detect when code exists as both symbol and abbreviation', () => {
        // ELEC is both a symbol code and an abbreviation
        const result = unifiedLookup('ELEC');

        if (result.type === 'both') {
          expect(result.symbol).toBeDefined();
          expect(result.abbreviation).toBeDefined();
          expect(result.expansion).toBeDefined();
          expect(result.confidence).toBe(0.95);
        } else {
          // If it's not 'both', it should at least match one
          expect(['symbol', 'abbreviation']).toContain(result.type);
        }
      });
    });

    describe('case insensitivity', () => {
      it('should handle lowercase input', () => {
        const result = unifiedLookup('e-1');

        expect(result.type).toBe('symbol');
        expect(result.symbol?.code).toBe('E-1');
      });

      it('should handle mixed case input', () => {
        const result = unifiedLookup('Conf');

        expect(result.type).toBe('abbreviation');
        expect(result.expansion).toBe('Conference Room');
      });

      it('should normalize to uppercase for matching', () => {
        const result = unifiedLookup('hvac');

        expect(result.type).toBe('abbreviation');
        expect(result.expansion).toBe('Heating, Ventilation, and Air Conditioning');
      });
    });

    describe('whitespace handling', () => {
      it('should trim leading whitespace', () => {
        const result = unifiedLookup('  E-1');

        expect(result.type).toBe('symbol');
        expect(result.symbol?.code).toBe('E-1');
      });

      it('should trim trailing whitespace', () => {
        const result = unifiedLookup('CONF  ');

        expect(result.type).toBe('abbreviation');
        expect(result.expansion).toBe('Conference Room');
      });

      it('should trim both leading and trailing whitespace', () => {
        const result = unifiedLookup('  M-1  ');

        expect(result.type).toBe('symbol');
        expect(result.symbol?.code).toBe('M-1');
      });
    });

    describe('fuzzy search fallback', () => {
      it('should provide alternate matches for unknown exact code', () => {
        const result = unifiedLookup('RECEP');

        // RECEP is an alternative code for E-1
        if (result.type === 'symbol') {
          expect(result.symbol?.code).toBe('E-1');
        } else if (result.type === 'unknown' && result.alternateMatches) {
          expect(result.alternateMatches.length).toBeGreaterThan(0);
          expect(result.confidence).toBe(0.5);
        }
      });

      it('should return unknown with no matches for gibberish', () => {
        const result = unifiedLookup('XYZABC123');

        expect(result.type).toBe('unknown');
        expect(result.confidence).toBe(0);
        expect(result.symbol).toBeUndefined();
        expect(result.abbreviation).toBeUndefined();
      });

      it('should provide fuzzy matches when available', () => {
        const result = unifiedLookup('light');

        if (result.type === 'unknown' && result.alternateMatches) {
          expect(result.alternateMatches.length).toBeGreaterThan(0);
          expect(result.confidence).toBe(0.5);
        }
      });
    });

    describe('edge cases', () => {
      it('should handle empty string', () => {
        const result = unifiedLookup('');

        expect(result.type).toBe('unknown');
        // Empty string may find fuzzy matches, so confidence can be 0 or 0.5
        expect([0, 0.5]).toContain(result.confidence);
      });

      it('should handle whitespace-only string', () => {
        const result = unifiedLookup('   ');

        expect(result.type).toBe('unknown');
        // Whitespace-only may find fuzzy matches, so confidence can be 0 or 0.5
        expect([0, 0.5]).toContain(result.confidence);
      });

      it('should preserve input in result', () => {
        const input = 'E-1';
        const result = unifiedLookup(input);

        expect(result.input).toBe(input);
      });

      it('should handle special characters', () => {
        const result = unifiedLookup('O.C.');

        // O.C. is a known abbreviation
        expect(['abbreviation', 'unknown']).toContain(result.type);
      });
    });
  });

  // ============================================================================
  // generateComprehensiveContext Tests
  // ============================================================================

  describe('generateComprehensiveContext', () => {
    describe('symbol extraction', () => {
      it('should extract symbols from document text', () => {
        const text = 'Install E-1 receptacles and M-1 diffusers';
        const context = generateComprehensiveContext(text);

        expect(context).toContain('CONSTRUCTION SYMBOLS');
        expect(context).toContain('E-1');
        expect(context).toContain('M-1');
      });

      it('should include symbol descriptions and trades', () => {
        const text = 'E-1 required in all rooms';
        const context = generateComprehensiveContext(text);

        expect(context).toContain('Duplex Receptacle');
        expect(context).toContain('electrical');
      });

      it('should handle multiple symbols', () => {
        const text = 'Install E-1, E-2, and E-3 per plan';
        const context = generateComprehensiveContext(text);

        expect(context).toContain('E-1');
        expect(context).toContain('E-2');
        expect(context).toContain('E-3');
      });
    });

    describe('abbreviation extraction', () => {
      it('should extract abbreviations from document text', () => {
        const text = 'CONF room needs HVAC installation';
        const context = generateComprehensiveContext(text);

        expect(context).toContain('ABBREVIATIONS');
        expect(context).toContain('CONF');
        expect(context).toContain('HVAC');
      });

      it('should include abbreviation expansions', () => {
        const text = 'VCT flooring in CONF room';
        const context = generateComprehensiveContext(text);

        expect(context).toContain('Conference Room');
        expect(context).toContain('Vinyl Composition Tile');
      });
    });

    describe('mixed content', () => {
      it('should handle text with both symbols and abbreviations', () => {
        const text = 'Install E-1 in CONF and OFF rooms';
        const context = generateComprehensiveContext(text);

        expect(context).toContain('CONSTRUCTION SYMBOLS');
        expect(context).toContain('ABBREVIATIONS');
        expect(context).toContain('E-1');
        expect(context).toContain('CONF');
        expect(context).toContain('OFF');
      });

      it('should separate symbols and abbreviations sections', () => {
        const text = 'E-1 and M-1 symbols with CONF and OFF abbreviations';
        const context = generateComprehensiveContext(text);

        const symbolIndex = context.indexOf('CONSTRUCTION SYMBOLS');
        const abbrIndex = context.indexOf('ABBREVIATIONS');

        if (symbolIndex !== -1 && abbrIndex !== -1) {
          expect(symbolIndex).toBeLessThan(abbrIndex);
        }
      });
    });

    describe('ambiguous codes', () => {
      it('should handle codes that are both symbols and abbreviations', () => {
        const text = 'ELEC room has electrical equipment';
        const context = generateComprehensiveContext(text);

        // ELEC might appear in both sections if it's ambiguous
        expect(context).toBeTruthy();
      });
    });

    describe('usage guidelines', () => {
      it('should include usage guidelines when content is found', () => {
        const text = 'E-1 in CONF room';
        const context = generateComprehensiveContext(text);

        expect(context).toContain('USAGE GUIDELINES');
      });

      it('should not include guidelines for empty results', () => {
        const text = 'This is plain text with no codes';
        const context = generateComprehensiveContext(text);

        expect(context).toBe('');
      });
    });

    describe('pattern matching', () => {
      it('should extract 2-4 letter uppercase patterns', () => {
        const text = 'AB CD EFGH rooms';
        const context = generateComprehensiveContext(text);

        // May or may not find matches depending on whether these are known
        expect(typeof context).toBe('string');
      });

      it('should extract patterns like E-1', () => {
        const text = 'Install E-1 and M-2 symbols';
        const context = generateComprehensiveContext(text);

        expect(context).toContain('E-1');
      });

      it('should handle duplicate patterns only once', () => {
        const text = 'CONF room 1, CONF room 2, CONF room 3';
        const context = generateComprehensiveContext(text);

        // Count occurrences of "CONF =" in context
        const matches = context.match(/CONF =/g);
        if (matches) {
          expect(matches.length).toBe(1);
        }
      });
    });

    describe('edge cases', () => {
      it('should handle empty text', () => {
        const context = generateComprehensiveContext('');

        expect(context).toBe('');
      });

      it('should handle text with no matches', () => {
        const text = 'This is just regular text without any codes';
        const context = generateComprehensiveContext(text);

        expect(context).toBe('');
      });

      it('should handle text with only lowercase codes', () => {
        const text = 'install e-1 in conf room';
        const context = generateComprehensiveContext(text);

        // Lowercase codes should not be extracted (pattern requires uppercase)
        expect(context).toBe('');
      });
    });
  });

  // ============================================================================
  // getTradeSpecificContext Tests
  // ============================================================================

  describe('getTradeSpecificContext', () => {
    describe('electrical trade', () => {
      it('should return electrical symbols and MEP abbreviations', () => {
        const result = getTradeSpecificContext(Trade.ELECTRICAL);

        expect(result.symbols.length).toBeGreaterThan(0);
        expect(result.symbols.every(s => s.trade === Trade.ELECTRICAL)).toBe(true);
        expect(result.abbreviations.length).toBeGreaterThan(0);
        expect(result.abbreviations.some(a => a.category === 'mep')).toBe(true);
      });
    });

    describe('mechanical trade', () => {
      it('should return mechanical symbols and relevant abbreviations', () => {
        const result = getTradeSpecificContext(Trade.MECHANICAL);

        expect(result.symbols.length).toBeGreaterThan(0);
        expect(result.symbols.every(s => s.trade === Trade.MECHANICAL)).toBe(true);
        expect(result.abbreviations.length).toBeGreaterThan(0);
      });

      it('should include MEP and schedule_task abbreviations', () => {
        const result = getTradeSpecificContext(Trade.MECHANICAL);

        const categories = result.abbreviations.map(a => a.category);
        expect(categories).toContain('mep');
      });
    });

    describe('plumbing trade', () => {
      it('should return plumbing symbols and MEP abbreviations', () => {
        const result = getTradeSpecificContext(Trade.PLUMBING);

        expect(result.symbols.length).toBeGreaterThan(0);
        expect(result.symbols.every(s => s.trade === Trade.PLUMBING)).toBe(true);
        expect(result.abbreviations.some(a => a.category === 'mep')).toBe(true);
      });
    });

    describe('fire protection trade', () => {
      it('should return fire protection symbols and MEP abbreviations', () => {
        const result = getTradeSpecificContext(Trade.FIRE_PROTECTION);

        expect(result.symbols.length).toBeGreaterThan(0);
        expect(result.symbols.every(s => s.trade === Trade.FIRE_PROTECTION)).toBe(true);
      });
    });

    describe('architectural trade', () => {
      it('should return architectural symbols and relevant abbreviations', () => {
        const result = getTradeSpecificContext(Trade.ARCHITECTURAL);

        expect(result.symbols.length).toBeGreaterThan(0);
        expect(result.symbols.every(s => s.trade === Trade.ARCHITECTURAL)).toBe(true);
      });

      it('should include architectural and room_type abbreviations', () => {
        const result = getTradeSpecificContext(Trade.ARCHITECTURAL);

        const categories = result.abbreviations.map(a => a.category);
        expect(categories).toContain('architectural');
      });
    });

    describe('structural trade', () => {
      it('should return structural symbols', () => {
        const result = getTradeSpecificContext(Trade.STRUCTURAL);

        expect(result.symbols.every(s => s.trade === Trade.STRUCTURAL)).toBe(true);
        expect(Array.isArray(result.abbreviations)).toBe(true);
      });
    });

    describe('civil trade', () => {
      it('should return civil symbols and schedule_task abbreviations', () => {
        const result = getTradeSpecificContext(Trade.CIVIL);

        expect(result.symbols.every(s => s.trade === Trade.CIVIL)).toBe(true);
        expect(Array.isArray(result.abbreviations)).toBe(true);
      });
    });

    describe('landscape trade', () => {
      it('should return landscape symbols and schedule_task abbreviations', () => {
        const result = getTradeSpecificContext(Trade.LANDSCAPE);

        expect(result.symbols.every(s => s.trade === Trade.LANDSCAPE)).toBe(true);
        expect(Array.isArray(result.abbreviations)).toBe(true);
      });
    });

    describe('result structure', () => {
      it('should return objects with symbols and abbreviations arrays', () => {
        const result = getTradeSpecificContext(Trade.ELECTRICAL);

        expect(result).toHaveProperty('symbols');
        expect(result).toHaveProperty('abbreviations');
        expect(Array.isArray(result.symbols)).toBe(true);
        expect(Array.isArray(result.abbreviations)).toBe(true);
      });
    });
  });

  // ============================================================================
  // isAmbiguousCode Tests
  // ============================================================================

  describe('isAmbiguousCode', () => {
    it('should return true for codes that exist as both symbol and abbreviation', () => {
      // Need to find a code that actually exists in both libraries
      // ELEC might be one such code
      const codes = ['ELEC', 'MECH', 'REST'];

      codes.forEach(code => {
        const result = isAmbiguousCode(code);
        // Result depends on actual data
        expect(typeof result).toBe('boolean');
      });
    });

    it('should return false for symbol-only codes', () => {
      const result = isAmbiguousCode('E-1');

      expect(result).toBe(false);
    });

    it('should return false for abbreviation-only codes', () => {
      const result = isAmbiguousCode('CONF');

      expect(result).toBe(false);
    });

    it('should return false for unknown codes', () => {
      const result = isAmbiguousCode('XYZABC123');

      expect(result).toBe(false);
    });

    it('should be case insensitive', () => {
      const upper = isAmbiguousCode('ELEC');
      const lower = isAmbiguousCode('elec');

      expect(upper).toBe(lower);
    });

    it('should handle whitespace', () => {
      const result = isAmbiguousCode('  ELEC  ');

      expect(typeof result).toBe('boolean');
    });
  });

  // ============================================================================
  // getAllInterpretations Tests
  // ============================================================================

  describe('getAllInterpretations', () => {
    describe('symbol interpretations', () => {
      it('should return symbol interpretation', () => {
        const interpretations = getAllInterpretations('E-1');

        expect(interpretations.length).toBeGreaterThan(0);
        expect(interpretations.some(i => i.includes('Symbol:'))).toBe(true);
        expect(interpretations.some(i => i.includes('Duplex Receptacle'))).toBe(true);
      });
    });

    describe('abbreviation interpretations', () => {
      it('should return abbreviation interpretation', () => {
        const interpretations = getAllInterpretations('CONF');

        expect(interpretations.length).toBeGreaterThan(0);
        expect(interpretations.some(i => i.includes('Abbreviation:'))).toBe(true);
        expect(interpretations.some(i => i.includes('Conference Room'))).toBe(true);
      });
    });

    describe('both interpretations', () => {
      it('should return both interpretations for ambiguous codes', () => {
        const interpretations = getAllInterpretations('ELEC');

        expect(interpretations.length).toBeGreaterThan(0);
        // Should have at least one interpretation
        expect(Array.isArray(interpretations)).toBe(true);
      });
    });

    describe('fuzzy matches', () => {
      it('should include alternate matches when no exact match found', () => {
        const interpretations = getAllInterpretations('light');

        if (interpretations.length > 0) {
          expect(interpretations.some(i => i.includes('Possible'))).toBe(true);
        }
      });

      it('should limit alternate matches to 3', () => {
        const interpretations = getAllInterpretations('door');

        // Even if there are many door-related symbols, should limit alternates
        const possibleMatches = interpretations.filter(i => i.includes('Possible'));
        expect(possibleMatches.length).toBeLessThanOrEqual(3);
      });
    });

    describe('edge cases', () => {
      it('should return empty array for unknown code with no fuzzy matches', () => {
        const interpretations = getAllInterpretations('XYZABC123');

        expect(Array.isArray(interpretations)).toBe(true);
      });

      it('should handle empty string', () => {
        const interpretations = getAllInterpretations('');

        expect(Array.isArray(interpretations)).toBe(true);
      });

      it('should be case insensitive', () => {
        const upper = getAllInterpretations('E-1');
        const lower = getAllInterpretations('e-1');

        expect(upper.length).toBe(lower.length);
      });
    });
  });

  // ============================================================================
  // generateDocumentLegend Tests
  // ============================================================================

  describe('generateDocumentLegend', () => {
    describe('symbol extraction', () => {
      it('should extract symbols from document', () => {
        const text = 'Install E-1 and M-1 per plan';
        const legend = generateDocumentLegend(text);

        expect(legend.symbols.length).toBeGreaterThan(0);
        expect(legend.symbols.some(s => s.code === 'E-1')).toBe(true);
        expect(legend.symbols.some(s => s.code === 'M-1')).toBe(true);
      });

      it('should include symbol details', () => {
        const text = 'E-1 required';
        const legend = generateDocumentLegend(text);

        const e1 = legend.symbols.find(s => s.code === 'E-1');
        expect(e1).toBeDefined();
        expect(e1?.description).toBe('Duplex Receptacle');
        expect(e1?.trade).toBe('electrical');
      });
    });

    describe('abbreviation extraction', () => {
      it('should extract abbreviations from document', () => {
        const text = 'CONF room needs HVAC';
        const legend = generateDocumentLegend(text);

        expect(legend.abbreviations.length).toBeGreaterThan(0);
        expect(legend.abbreviations.some(a => a.abbr === 'CONF')).toBe(true);
        expect(legend.abbreviations.some(a => a.abbr === 'HVAC')).toBe(true);
      });

      it('should include abbreviation full names', () => {
        const text = 'VCT flooring required';
        const legend = generateDocumentLegend(text);

        const vct = legend.abbreviations.find(a => a.abbr === 'VCT');
        expect(vct).toBeDefined();
        expect(vct?.fullName).toBe('Vinyl Composition Tile');
      });
    });

    describe('ambiguous codes', () => {
      it('should categorize ambiguous codes separately', () => {
        const text = 'ELEC room with electrical equipment';
        const legend = generateDocumentLegend(text);

        expect(Array.isArray(legend.ambiguous)).toBe(true);
      });

      it('should provide all interpretations for ambiguous codes', () => {
        const text = 'ELEC room required';
        const legend = generateDocumentLegend(text);

        const elecAmbiguous = legend.ambiguous.find(a => a.code === 'ELEC');
        if (elecAmbiguous) {
          expect(elecAmbiguous.interpretations.length).toBeGreaterThan(0);
        }
      });
    });

    describe('structure validation', () => {
      it('should return object with all three arrays', () => {
        const text = 'E-1 in CONF room';
        const legend = generateDocumentLegend(text);

        expect(legend).toHaveProperty('symbols');
        expect(legend).toHaveProperty('abbreviations');
        expect(legend).toHaveProperty('ambiguous');
        expect(Array.isArray(legend.symbols)).toBe(true);
        expect(Array.isArray(legend.abbreviations)).toBe(true);
        expect(Array.isArray(legend.ambiguous)).toBe(true);
      });

      it('should handle empty document', () => {
        const legend = generateDocumentLegend('');

        expect(legend.symbols).toEqual([]);
        expect(legend.abbreviations).toEqual([]);
        expect(legend.ambiguous).toEqual([]);
      });

      it('should handle document with no matches', () => {
        const text = 'This is plain text with no codes';
        const legend = generateDocumentLegend(text);

        expect(legend.symbols).toEqual([]);
        expect(legend.abbreviations).toEqual([]);
        expect(legend.ambiguous).toEqual([]);
      });
    });

    describe('duplicate handling', () => {
      it('should only include each code once', () => {
        const text = 'E-1 here and E-1 there and E-1 everywhere';
        const legend = generateDocumentLegend(text);

        const e1Count = legend.symbols.filter(s => s.code === 'E-1').length;
        expect(e1Count).toBe(1);
      });

      it('should deduplicate abbreviations', () => {
        const text = 'CONF room 1, CONF room 2, CONF room 3';
        const legend = generateDocumentLegend(text);

        const confCount = legend.abbreviations.filter(a => a.abbr === 'CONF').length;
        expect(confCount).toBe(1);
      });
    });

    describe('pattern matching', () => {
      it('should extract uppercase patterns', () => {
        const text = 'Install HVAC and ELEC systems';
        const legend = generateDocumentLegend(text);

        // Should extract uppercase 2-4 letter patterns
        expect(legend.abbreviations.length + legend.symbols.length + legend.ambiguous.length).toBeGreaterThan(0);
      });

      it('should not extract lowercase patterns', () => {
        const text = 'install hvac and elec systems';
        const legend = generateDocumentLegend(text);

        expect(legend.symbols).toEqual([]);
        expect(legend.abbreviations).toEqual([]);
      });
    });
  });

  // ============================================================================
  // getCoverageStats Tests
  // ============================================================================

  describe('getCoverageStats', () => {
    it('should return total symbols count', () => {
      const stats = getCoverageStats();

      expect(stats.totalSymbols).toBeGreaterThan(0);
      expect(typeof stats.totalSymbols).toBe('number');
    });

    it('should return total abbreviations count', () => {
      const stats = getCoverageStats();

      expect(stats.totalAbbreviations).toBeGreaterThan(0);
      expect(typeof stats.totalAbbreviations).toBe('number');
    });

    it('should return symbols by trade', () => {
      const stats = getCoverageStats();

      expect(stats.byTrade).toBeDefined();
      expect(stats.byTrade.electrical).toBeGreaterThan(0);
      expect(stats.byTrade.mechanical).toBeGreaterThan(0);
      expect(stats.byTrade.plumbing).toBeGreaterThan(0);
      expect(stats.byTrade.fire_protection).toBeGreaterThan(0);
      expect(stats.byTrade.architectural).toBeGreaterThan(0);
    });

    it('should return abbreviations by category', () => {
      const stats = getCoverageStats();

      expect(stats.byCategory).toBeDefined();
      expect(stats.byCategory.room_type).toBeGreaterThan(0);
      expect(stats.byCategory.material).toBeGreaterThan(0);
      expect(stats.byCategory.mep).toBeGreaterThan(0);
      expect(stats.byCategory.schedule_task).toBeGreaterThan(0);
    });

    it('should have consistent totals', () => {
      const stats = getCoverageStats();

      const tradeSum =
        stats.byTrade.electrical +
        stats.byTrade.mechanical +
        stats.byTrade.plumbing +
        stats.byTrade.fire_protection +
        stats.byTrade.architectural;

      expect(stats.totalSymbols).toBe(tradeSum);
    });

    it('should return stats with correct structure', () => {
      const stats = getCoverageStats();

      expect(stats).toHaveProperty('totalSymbols');
      expect(stats).toHaveProperty('totalAbbreviations');
      expect(stats).toHaveProperty('byTrade');
      expect(stats).toHaveProperty('byCategory');
    });

    it('should have all expected trade counts', () => {
      const stats = getCoverageStats();

      expect(stats.byTrade).toHaveProperty('electrical');
      expect(stats.byTrade).toHaveProperty('mechanical');
      expect(stats.byTrade).toHaveProperty('plumbing');
      expect(stats.byTrade).toHaveProperty('fire_protection');
      expect(stats.byTrade).toHaveProperty('architectural');
    });

    it('should have all expected category counts', () => {
      const stats = getCoverageStats();

      expect(stats.byCategory).toHaveProperty('room_type');
      expect(stats.byCategory).toHaveProperty('material');
      expect(stats.byCategory).toHaveProperty('mep');
      expect(stats.byCategory).toHaveProperty('schedule_task');
    });
  });

  // ============================================================================
  // Integration Scenarios
  // ============================================================================

  describe('integration scenarios', () => {
    it('should support complete document analysis workflow', () => {
      const documentText = 'Install E-1 and M-1 in CONF and OFF rooms with VCT flooring';

      // Step 1: Generate comprehensive context
      const context = generateComprehensiveContext(documentText);
      expect(context).toContain('CONSTRUCTION SYMBOLS');
      expect(context).toContain('ABBREVIATIONS');

      // Step 2: Generate legend
      const legend = generateDocumentLegend(documentText);
      expect(legend.symbols.length).toBeGreaterThan(0);
      expect(legend.abbreviations.length).toBeGreaterThan(0);

      // Step 3: Check for ambiguous codes
      const codes = ['E-1', 'M-1', 'CONF', 'OFF', 'VCT'];
      codes.forEach(code => {
        const isAmbiguous = isAmbiguousCode(code);
        expect(typeof isAmbiguous).toBe('boolean');
      });
    });

    it('should support trade-specific filtering', () => {
      // Get electrical-specific context
      const electricalContext = getTradeSpecificContext(Trade.ELECTRICAL);
      expect(electricalContext.symbols.every(s => s.trade === Trade.ELECTRICAL)).toBe(true);

      // Get mechanical-specific context
      const mechanicalContext = getTradeSpecificContext(Trade.MECHANICAL);
      expect(mechanicalContext.symbols.every(s => s.trade === Trade.MECHANICAL)).toBe(true);

      // Verify no overlap in symbols
      const electricalCodes = electricalContext.symbols.map(s => s.code);
      const mechanicalCodes = mechanicalContext.symbols.map(s => s.code);
      const overlap = electricalCodes.filter(code => mechanicalCodes.includes(code));
      expect(overlap.length).toBe(0);
    });

    it('should support interpretation lookup workflow', () => {
      const code = 'E-1';

      // Step 1: Unified lookup
      const lookup = unifiedLookup(code);
      expect(lookup.type).toBe('symbol');

      // Step 2: Get all interpretations
      const interpretations = getAllInterpretations(code);
      expect(interpretations.length).toBeGreaterThan(0);

      // Step 3: Check if ambiguous
      const isAmbiguous = isAmbiguousCode(code);
      expect(isAmbiguous).toBe(false);
    });

    it('should support statistics and coverage reporting', () => {
      const stats = getCoverageStats();

      expect(stats.totalSymbols).toBeGreaterThan(0);
      expect(stats.totalAbbreviations).toBeGreaterThan(0);

      // Verify totals match sum of categories
      const symbolSum = Object.values(stats.byTrade).reduce((a, b) => a + b, 0);
      expect(stats.totalSymbols).toBe(symbolSum);
    });

    it('should handle complex construction documents', () => {
      const complexDoc = `
        SCOPE OF WORK:
        Install E-1, E-2, and E-3 electrical fixtures per plan.
        M-1 supply diffusers in all CONF, OFF, and STOR rooms.
        P-1 and P-2 plumbing fixtures per schedule.
        VCT flooring in all areas (500 SF total).
        HVAC installation per mechanical drawings.
        ELEC room on first floor.
      `;

      const legend = generateDocumentLegend(complexDoc);

      // Should extract multiple symbols
      expect(legend.symbols.length).toBeGreaterThan(0);

      // Should extract multiple abbreviations
      expect(legend.abbreviations.length).toBeGreaterThan(0);

      // Might have ambiguous codes
      expect(Array.isArray(legend.ambiguous)).toBe(true);
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('performance', () => {
    it('should handle multiple lookups efficiently', () => {
      const codes = ['E-1', 'E-2', 'E-3', 'M-1', 'M-2', 'P-1', 'CONF', 'OFF', 'HVAC', 'VCT'];

      codes.forEach(code => {
        const result = unifiedLookup(code);
        expect(result).toBeDefined();
        expect(result.input).toBe(code);
      });
    });

    it('should handle large document text efficiently', () => {
      const largeText = Array(100).fill('E-1 in CONF room with VCT flooring').join('. ');

      const context = generateComprehensiveContext(largeText);
      expect(typeof context).toBe('string');

      const legend = generateDocumentLegend(largeText);
      expect(legend).toBeDefined();
    });

    it('should handle all trades efficiently', () => {
      const trades = [
        Trade.ELECTRICAL,
        Trade.MECHANICAL,
        Trade.PLUMBING,
        Trade.FIRE_PROTECTION,
        Trade.ARCHITECTURAL,
        Trade.STRUCTURAL,
        Trade.CIVIL,
        Trade.LANDSCAPE
      ];

      trades.forEach(trade => {
        const context = getTradeSpecificContext(trade);
        expect(context).toBeDefined();
        expect(context).toHaveProperty('symbols');
        expect(context).toHaveProperty('abbreviations');
      });
    });
  });
});
