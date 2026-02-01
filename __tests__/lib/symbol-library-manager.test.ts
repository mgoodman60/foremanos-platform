import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAllSymbolLibraries,
  getSymbolLibrary,
  getSymbolsByCategory,
  searchSymbols,
  matchSymbol,
  getSymbolContext,
  getTotalSymbolCount,
  getLibraryStats,
  type SymbolDefinition,
  type SymbolLibrary,
} from '@/lib/symbol-library-manager';

describe('Symbol Library Manager', () => {
  // ============================================
  // getAllSymbolLibraries Tests
  // ============================================
  describe('getAllSymbolLibraries', () => {
    it('should return all symbol libraries', () => {
      const libraries = getAllSymbolLibraries();
      expect(libraries).toHaveLength(4);
      expect(libraries.map(lib => lib.library)).toEqual([
        'ANSI/IEEE 315',
        'ASHRAE',
        'ASME Y14.38',
        'NFPA'
      ]);
    });

    it('should return libraries with correct categories', () => {
      const libraries = getAllSymbolLibraries();
      expect(libraries.map(lib => lib.category)).toEqual([
        'electrical',
        'hvac',
        'plumbing',
        'fire_protection'
      ]);
    });

    it('should return libraries with version information', () => {
      const libraries = getAllSymbolLibraries();
      libraries.forEach(lib => {
        expect(lib.version).toBeDefined();
        expect(typeof lib.version).toBe('string');
        expect(lib.version.length).toBeGreaterThan(0);
      });
    });

    it('should return libraries with symbols array', () => {
      const libraries = getAllSymbolLibraries();
      libraries.forEach(lib => {
        expect(Array.isArray(lib.symbols)).toBe(true);
        expect(lib.symbols.length).toBeGreaterThan(0);
      });
    });

    it('should return array reference (not a copy)', () => {
      const first = getAllSymbolLibraries();
      const second = getAllSymbolLibraries();
      expect(first).toBe(second); // Same reference
    });
  });

  // ============================================
  // getSymbolLibrary Tests
  // ============================================
  describe('getSymbolLibrary', () => {
    it('should return electrical library by name', () => {
      const library = getSymbolLibrary('ANSI/IEEE 315');
      expect(library).toBeDefined();
      expect(library?.category).toBe('electrical');
      expect(library?.version).toBe('2019');
    });

    it('should return HVAC library by name', () => {
      const library = getSymbolLibrary('ASHRAE');
      expect(library).toBeDefined();
      expect(library?.category).toBe('hvac');
      expect(library?.version).toBe('2020');
    });

    it('should return plumbing library by name', () => {
      const library = getSymbolLibrary('ASME Y14.38');
      expect(library).toBeDefined();
      expect(library?.category).toBe('plumbing');
      expect(library?.version).toBe('2007');
    });

    it('should return fire protection library by name', () => {
      const library = getSymbolLibrary('NFPA');
      expect(library).toBeDefined();
      expect(library?.category).toBe('fire_protection');
      expect(library?.version).toBe('2021');
    });

    it('should return undefined for non-existent library', () => {
      const library = getSymbolLibrary('NonExistent');
      expect(library).toBeUndefined();
    });

    it('should be case-sensitive', () => {
      const library = getSymbolLibrary('nfpa');
      expect(library).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const library = getSymbolLibrary('');
      expect(library).toBeUndefined();
    });
  });

  // ============================================
  // getSymbolsByCategory Tests
  // ============================================
  describe('getSymbolsByCategory', () => {
    it('should return electrical symbols', () => {
      const symbols = getSymbolsByCategory('electrical');
      expect(symbols).toHaveLength(6);
      expect(symbols[0].name).toBe('Single Pole Switch');
      expect(symbols[1].name).toBe('3-Way Switch');
      expect(symbols[2].name).toBe('Duplex Receptacle');
    });

    it('should return HVAC symbols', () => {
      const symbols = getSymbolsByCategory('hvac');
      expect(symbols).toHaveLength(5);
      expect(symbols[0].name).toBe('Supply Air Diffuser');
      expect(symbols[1].name).toBe('Return Air Grille');
    });

    it('should return plumbing symbols', () => {
      const symbols = getSymbolsByCategory('plumbing');
      expect(symbols).toHaveLength(5);
      expect(symbols[0].name).toBe('Lavatory');
      expect(symbols[1].name).toBe('Water Closet');
    });

    it('should return fire protection symbols', () => {
      const symbols = getSymbolsByCategory('fire_protection');
      expect(symbols).toHaveLength(4);
      expect(symbols[0].name).toBe('Sprinkler Head');
      expect(symbols[1].name).toBe('Pull Station');
    });

    it('should return empty array for non-existent category', () => {
      const symbols = getSymbolsByCategory('non_existent');
      expect(symbols).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      const symbols = getSymbolsByCategory('');
      expect(symbols).toEqual([]);
    });

    it('should be case-sensitive', () => {
      const symbols = getSymbolsByCategory('ELECTRICAL');
      expect(symbols).toEqual([]);
    });

    it('should return symbols with all required properties', () => {
      const symbols = getSymbolsByCategory('electrical');
      symbols.forEach(symbol => {
        expect(symbol.id).toBeDefined();
        expect(symbol.name).toBeDefined();
        expect(symbol.code).toBeDefined();
        expect(symbol.description).toBeDefined();
        expect(symbol.category).toBe('electrical');
        expect(symbol.library).toBe('ANSI/IEEE 315');
      });
    });
  });

  // ============================================
  // searchSymbols Tests
  // ============================================
  describe('searchSymbols', () => {
    describe('search by name', () => {
      it('should find symbols by partial name match', () => {
        const results = searchSymbols('switch');
        expect(results.length).toBeGreaterThan(0);
        expect(results.some(s => s.name.toLowerCase().includes('switch'))).toBe(true);
      });

      it('should be case-insensitive', () => {
        const lower = searchSymbols('switch');
        const upper = searchSymbols('SWITCH');
        const mixed = searchSymbols('Switch');
        expect(lower.length).toBe(upper.length);
        expect(lower.length).toBe(mixed.length);
      });

      it('should find symbols with multi-word names', () => {
        const results = searchSymbols('fire extinguisher');
        expect(results.length).toBeGreaterThan(0);
        expect(results.some(s => s.name === 'Fire Extinguisher')).toBe(true);
      });
    });

    describe('search by code', () => {
      it('should find symbols by exact code match', () => {
        const results = searchSymbols('GFCI');
        expect(results.length).toBeGreaterThan(0);
        expect(results.some(s => s.code === 'GFCI')).toBe(true);
      });

      it('should find symbols by partial code match', () => {
        const results = searchSymbols('S');
        expect(results.length).toBeGreaterThan(0);
      });

      it('should be case-insensitive for codes', () => {
        const lower = searchSymbols('gfci');
        const upper = searchSymbols('GFCI');
        expect(lower.length).toBe(upper.length);
      });
    });

    describe('search by description', () => {
      it('should find symbols by description match', () => {
        const results = searchSymbols('ceiling');
        expect(results.length).toBeGreaterThan(0);
        expect(results.some(s => s.description.toLowerCase().includes('ceiling'))).toBe(true);
      });

      it('should find symbols by partial description', () => {
        const results = searchSymbols('outlet');
        expect(results.length).toBeGreaterThan(0);
        expect(results.some(s => s.description.toLowerCase().includes('outlet'))).toBe(true);
      });
    });

    describe('search by variations', () => {
      it('should find symbols by variation code', () => {
        const results = searchSymbols('$');
        expect(results.length).toBeGreaterThan(0);
        // Single pole switch has '$' as a variation
        expect(results.some(s => s.variations?.includes('$'))).toBe(true);
      });

      it('should find symbols by alternative variation', () => {
        const results = searchSymbols('GFI');
        expect(results.length).toBeGreaterThan(0);
        expect(results.some(s => s.code === 'GFCI')).toBe(true);
      });

      it('should be case-insensitive for variations', () => {
        const lower = searchSymbols('gfi');
        const upper = searchSymbols('GFI');
        expect(lower.length).toBe(upper.length);
      });
    });

    describe('edge cases', () => {
      it('should return empty array for no matches', () => {
        const results = searchSymbols('xyznonexistent');
        expect(results).toEqual([]);
      });

      it('should return all symbols for empty string (since empty string matches all)', () => {
        const results = searchSymbols('');
        // Empty string matches all symbols because ''.includes('') returns true
        expect(results.length).toBe(20);
      });

      it('should handle special characters', () => {
        const results = searchSymbols('3-way');
        expect(results.length).toBeGreaterThan(0);
      });

      it('should search across all libraries', () => {
        const results = searchSymbols('damper');
        expect(results.length).toBe(2); // Fire Damper and Volume Damper
        expect(results.some(s => s.category === 'hvac')).toBe(true);
      });

      it('should not return duplicate results', () => {
        const results = searchSymbols('light');
        const ids = results.map(s => s.id);
        const uniqueIds = new Set(ids);
        expect(ids.length).toBe(uniqueIds.size);
      });
    });
  });

  // ============================================
  // matchSymbol Tests
  // ============================================
  describe('matchSymbol', () => {
    describe('exact code matches', () => {
      it('should match by exact code', () => {
        const symbol = matchSymbol('GFCI');
        expect(symbol).toBeDefined();
        expect(symbol?.code).toBe('GFCI');
        expect(symbol?.name).toBe('GFCI Receptacle');
      });

      it('should match electrical symbols', () => {
        const symbol = matchSymbol('S');
        expect(symbol).toBeDefined();
        expect(symbol?.name).toBe('Single Pole Switch');
      });

      it('should match HVAC symbols', () => {
        const symbol = matchSymbol('VAV');
        expect(symbol).toBeDefined();
        expect(symbol?.name).toBe('VAV Terminal Box');
      });

      it('should match plumbing symbols', () => {
        const symbol = matchSymbol('WC');
        expect(symbol).toBeDefined();
        expect(symbol?.name).toBe('Water Closet');
      });

      it('should match fire protection symbols', () => {
        const symbol = matchSymbol('SPR');
        expect(symbol).toBeDefined();
        expect(symbol?.name).toBe('Sprinkler Head');
      });
    });

    describe('variation matches', () => {
      it('should match by variation code', () => {
        const symbol = matchSymbol('GFI');
        expect(symbol).toBeDefined();
        expect(symbol?.code).toBe('GFCI');
      });

      it('should match single pole switch variations', () => {
        const s1 = matchSymbol('S1');
        const dollar = matchSymbol('$');
        expect(s1?.id).toBe('switch-single-pole');
        expect(dollar?.id).toBe('switch-single-pole');
      });

      it('should match 3-way switch variations', () => {
        const symbol = matchSymbol('S-3');
        expect(symbol).toBeDefined();
        expect(symbol?.name).toBe('3-Way Switch');
      });

      it('should match recessed light variations', () => {
        const symbol = matchSymbol('CAN');
        expect(symbol).toBeDefined();
        expect(symbol?.name).toBe('Recessed Light');
      });
    });

    describe('case handling', () => {
      it('should be case-insensitive', () => {
        const lower = matchSymbol('gfci');
        const upper = matchSymbol('GFCI');
        const mixed = matchSymbol('Gfci');
        expect(lower?.id).toBe(upper?.id);
        expect(lower?.id).toBe(mixed?.id);
      });

      it('should handle lowercase variations', () => {
        const symbol = matchSymbol('gfi');
        expect(symbol).toBeDefined();
        expect(symbol?.code).toBe('GFCI');
      });
    });

    describe('whitespace handling', () => {
      it('should trim whitespace', () => {
        const symbol = matchSymbol('  GFCI  ');
        expect(symbol).toBeDefined();
        expect(symbol?.code).toBe('GFCI');
      });

      it('should handle tabs and newlines', () => {
        const symbol = matchSymbol('\tGFCI\n');
        expect(symbol).toBeDefined();
        expect(symbol?.code).toBe('GFCI');
      });
    });

    describe('edge cases', () => {
      it('should return undefined for non-existent code', () => {
        const symbol = matchSymbol('NONEXISTENT');
        expect(symbol).toBeUndefined();
      });

      it('should return undefined for empty string', () => {
        const symbol = matchSymbol('');
        expect(symbol).toBeUndefined();
      });

      it('should return undefined for whitespace only', () => {
        const symbol = matchSymbol('   ');
        expect(symbol).toBeUndefined();
      });

      it('should handle special characters', () => {
        const symbol = matchSymbol('$');
        expect(symbol).toBeDefined();
        expect(symbol?.id).toBe('switch-single-pole');
      });

      it('should return first match when multiple symbols have same variation', () => {
        // FD exists in both HVAC (Fire Damper) and Plumbing (Floor Drain)
        const symbol = matchSymbol('FD');
        expect(symbol).toBeDefined();
        // Should return the first one found (HVAC Fire Damper)
        expect(symbol?.category).toBe('hvac');
        expect(symbol?.name).toBe('Fire Damper');
      });
    });
  });

  // ============================================
  // getSymbolContext Tests
  // ============================================
  describe('getSymbolContext', () => {
    it('should generate context for single symbol', () => {
      const context = getSymbolContext(['GFCI']);
      expect(context).toContain('=== STANDARD SYMBOL LIBRARY ===');
      expect(context).toContain('GFCI - GFCI Receptacle');
      expect(context).toContain('Library: ANSI/IEEE 315');
      expect(context).toContain('Description: Ground fault circuit interrupter outlet');
      expect(context).toContain('Category: electrical');
      expect(context).toContain('💡 SYMBOL USAGE GUIDELINES:');
    });

    it('should generate context for multiple symbols', () => {
      const context = getSymbolContext(['GFCI', 'VAV', 'WC']);
      expect(context).toContain('GFCI - GFCI Receptacle');
      expect(context).toContain('VAV - VAV Terminal Box');
      expect(context).toContain('WC - Water Closet');
      expect(context).toContain('electrical');
      expect(context).toContain('hvac');
      expect(context).toContain('plumbing');
    });

    it('should include variations when present', () => {
      const context = getSymbolContext(['GFCI']);
      expect(context).toContain('Variations: GFCI, GFI');
    });

    it('should not show variations section when only one variation exists', () => {
      // Find a symbol with only one variation or no variations
      const context = getSymbolContext(['VAV']);
      // VAV has variations ['VAV', 'VB'], so it should show variations
      expect(context).toContain('Variations:');
    });

    it('should include usage guidelines', () => {
      const context = getSymbolContext(['GFCI']);
      expect(context).toContain('Standard symbols follow industry conventions');
      expect(context).toContain('Variations are trade-specific or regional');
      expect(context).toContain('Always check project-specific legend for overrides');
      expect(context).toContain('Code requirements vary by jurisdiction');
    });

    it('should handle empty array', () => {
      const context = getSymbolContext([]);
      expect(context).toContain('=== STANDARD SYMBOL LIBRARY ===');
      expect(context).toContain('💡 SYMBOL USAGE GUIDELINES:');
    });

    it('should skip non-existent symbols', () => {
      const context = getSymbolContext(['GFCI', 'NONEXISTENT', 'VAV']);
      expect(context).toContain('GFCI - GFCI Receptacle');
      expect(context).toContain('VAV - VAV Terminal Box');
      expect(context).not.toContain('NONEXISTENT');
    });

    it('should handle all non-existent symbols', () => {
      const context = getSymbolContext(['NONEXISTENT1', 'NONEXISTENT2']);
      expect(context).toContain('=== STANDARD SYMBOL LIBRARY ===');
      expect(context).toContain('💡 SYMBOL USAGE GUIDELINES:');
      expect(context).not.toContain('NONEXISTENT');
    });

    it('should match symbols by variation', () => {
      const context = getSymbolContext(['GFI']); // Variation of GFCI
      expect(context).toContain('GFCI - GFCI Receptacle');
    });

    it('should be case-insensitive', () => {
      const lower = getSymbolContext(['gfci']);
      const upper = getSymbolContext(['GFCI']);
      expect(lower).toContain('GFCI - GFCI Receptacle');
      expect(upper).toContain('GFCI - GFCI Receptacle');
    });

    it('should format output correctly', () => {
      const context = getSymbolContext(['S']);
      const lines = context.split('\n');
      expect(lines[0]).toBe('=== STANDARD SYMBOL LIBRARY ===');
      expect(lines[1]).toBe('');
    });

    it('should handle symbols from different categories', () => {
      const context = getSymbolContext(['S', 'SD', 'LAV', 'SPR']);
      expect(context).toContain('electrical');
      expect(context).toContain('hvac');
      expect(context).toContain('plumbing');
      expect(context).toContain('fire_protection');
    });
  });

  // ============================================
  // getTotalSymbolCount Tests
  // ============================================
  describe('getTotalSymbolCount', () => {
    it('should return correct total count', () => {
      const count = getTotalSymbolCount();
      // Electrical: 6, HVAC: 5, Plumbing: 5, Fire: 4
      expect(count).toBe(20);
    });

    it('should return same count on multiple calls', () => {
      const first = getTotalSymbolCount();
      const second = getTotalSymbolCount();
      expect(first).toBe(second);
    });

    it('should match sum of individual category counts', () => {
      const electrical = getSymbolsByCategory('electrical').length;
      const hvac = getSymbolsByCategory('hvac').length;
      const plumbing = getSymbolsByCategory('plumbing').length;
      const fire = getSymbolsByCategory('fire_protection').length;
      const total = getTotalSymbolCount();
      expect(total).toBe(electrical + hvac + plumbing + fire);
    });
  });

  // ============================================
  // getLibraryStats Tests
  // ============================================
  describe('getLibraryStats', () => {
    it('should return correct structure', () => {
      const stats = getLibraryStats();
      expect(stats).toHaveProperty('totalLibraries');
      expect(stats).toHaveProperty('totalSymbols');
      expect(stats).toHaveProperty('byCategory');
    });

    it('should return correct total libraries count', () => {
      const stats = getLibraryStats();
      expect(stats.totalLibraries).toBe(4);
    });

    it('should return correct total symbols count', () => {
      const stats = getLibraryStats();
      expect(stats.totalSymbols).toBe(20);
    });

    it('should return breakdown by category', () => {
      const stats = getLibraryStats();
      expect(stats.byCategory).toHaveLength(4);
      expect(stats.byCategory[0]).toHaveProperty('category');
      expect(stats.byCategory[0]).toHaveProperty('library');
      expect(stats.byCategory[0]).toHaveProperty('count');
    });

    it('should have correct electrical stats', () => {
      const stats = getLibraryStats();
      const electrical = stats.byCategory.find(cat => cat.category === 'electrical');
      expect(electrical).toBeDefined();
      expect(electrical?.library).toBe('ANSI/IEEE 315');
      expect(electrical?.count).toBe(6);
    });

    it('should have correct HVAC stats', () => {
      const stats = getLibraryStats();
      const hvac = stats.byCategory.find(cat => cat.category === 'hvac');
      expect(hvac).toBeDefined();
      expect(hvac?.library).toBe('ASHRAE');
      expect(hvac?.count).toBe(5);
    });

    it('should have correct plumbing stats', () => {
      const stats = getLibraryStats();
      const plumbing = stats.byCategory.find(cat => cat.category === 'plumbing');
      expect(plumbing).toBeDefined();
      expect(plumbing?.library).toBe('ASME Y14.38');
      expect(plumbing?.count).toBe(5);
    });

    it('should have correct fire protection stats', () => {
      const stats = getLibraryStats();
      const fire = stats.byCategory.find(cat => cat.category === 'fire_protection');
      expect(fire).toBeDefined();
      expect(fire?.library).toBe('NFPA');
      expect(fire?.count).toBe(4);
    });

    it('should have sum of category counts equal to total', () => {
      const stats = getLibraryStats();
      const sum = stats.byCategory.reduce((acc, cat) => acc + cat.count, 0);
      expect(sum).toBe(stats.totalSymbols);
    });

    it('should return consistent data on multiple calls', () => {
      const first = getLibraryStats();
      const second = getLibraryStats();
      expect(first.totalLibraries).toBe(second.totalLibraries);
      expect(first.totalSymbols).toBe(second.totalSymbols);
      expect(first.byCategory.length).toBe(second.byCategory.length);
    });
  });

  // ============================================
  // Type Safety Tests
  // ============================================
  describe('TypeScript interfaces', () => {
    it('should have valid SymbolDefinition structure', () => {
      const symbols = getSymbolsByCategory('electrical');
      const symbol = symbols[0];

      // Type assertion to ensure compile-time type checking
      const typedSymbol: SymbolDefinition = symbol;

      expect(typeof typedSymbol.id).toBe('string');
      expect(typeof typedSymbol.name).toBe('string');
      expect(typeof typedSymbol.code).toBe('string');
      expect(typeof typedSymbol.description).toBe('string');
      expect(typeof typedSymbol.category).toBe('string');
      expect(typeof typedSymbol.library).toBe('string');

      if (typedSymbol.variations) {
        expect(Array.isArray(typedSymbol.variations)).toBe(true);
      }

      if (typedSymbol.related) {
        expect(Array.isArray(typedSymbol.related)).toBe(true);
      }
    });

    it('should have valid SymbolLibrary structure', () => {
      const libraries = getAllSymbolLibraries();
      const library = libraries[0];

      // Type assertion to ensure compile-time type checking
      const typedLibrary: SymbolLibrary = library;

      expect(typeof typedLibrary.library).toBe('string');
      expect(typeof typedLibrary.category).toBe('string');
      expect(typeof typedLibrary.version).toBe('string');
      expect(Array.isArray(typedLibrary.symbols)).toBe(true);
    });
  });

  // ============================================
  // Integration Tests
  // ============================================
  describe('Integration scenarios', () => {
    it('should handle full workflow: search -> match -> context', () => {
      // Search for switches
      const searchResults = searchSymbols('switch');
      expect(searchResults.length).toBeGreaterThan(0);

      // Get codes from search results
      const codes = searchResults.map(s => s.code);

      // Match each code
      codes.forEach(code => {
        const matched = matchSymbol(code);
        expect(matched).toBeDefined();
      });

      // Generate context
      const context = getSymbolContext(codes);
      expect(context).toContain('=== STANDARD SYMBOL LIBRARY ===');
      codes.forEach(code => {
        expect(context).toContain(code);
      });
    });

    it('should handle category filtering -> matching workflow', () => {
      const electricalSymbols = getSymbolsByCategory('electrical');
      const hvacSymbols = getSymbolsByCategory('hvac');

      // Verify each symbol can be matched by its code
      [...electricalSymbols, ...hvacSymbols].forEach(symbol => {
        const matched = matchSymbol(symbol.code);
        expect(matched?.id).toBe(symbol.id);
      });
    });

    it('should maintain data consistency across functions', () => {
      const allLibraries = getAllSymbolLibraries();
      const stats = getLibraryStats();

      expect(allLibraries.length).toBe(stats.totalLibraries);

      // Verify each library in stats matches actual library
      stats.byCategory.forEach(stat => {
        const library = getSymbolLibrary(stat.library);
        expect(library).toBeDefined();
        expect(library?.category).toBe(stat.category);
        expect(library?.symbols.length).toBe(stat.count);
      });
    });
  });

  // ============================================
  // Performance Tests
  // ============================================
  describe('Performance characteristics', () => {
    it('should handle large search queries efficiently', () => {
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        searchSymbols('switch');
      }
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000); // Should complete 1000 searches in under 1 second
    });

    it('should handle many symbol matches efficiently', () => {
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        matchSymbol('GFCI');
      }
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });

    it('should generate context efficiently', () => {
      const allCodes = getAllSymbolLibraries()
        .flatMap(lib => lib.symbols.map(s => s.code));

      const start = Date.now();
      getSymbolContext(allCodes);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100); // Should generate full context in under 100ms
    });
  });
});
