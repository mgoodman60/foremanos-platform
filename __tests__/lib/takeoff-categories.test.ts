import { describe, it, expect, beforeEach } from 'vitest';
import {
  TAKEOFF_CATEGORIES,
  getCategoryById,
  getAllCategoryIds,
  matchItemToCategory,
  getWasteFactor,
  getLaborHoursPerUnit,
  getComprehensiveExtractionPrompt,
  type TakeoffCategory,
  type SubCategory,
} from '@/lib/takeoff-categories';

describe('takeoff-categories', () => {
  // ============================================
  // TAKEOFF_CATEGORIES Data Validation
  // ============================================
  describe('TAKEOFF_CATEGORIES', () => {
    it('should export a non-empty array of categories', () => {
      expect(TAKEOFF_CATEGORIES).toBeInstanceOf(Array);
      expect(TAKEOFF_CATEGORIES.length).toBeGreaterThan(0);
    });

    it('should have all required fields for each category', () => {
      TAKEOFF_CATEGORIES.forEach(category => {
        expect(category).toHaveProperty('id');
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('csiDivision');
        expect(category).toHaveProperty('subCategories');
        expect(category).toHaveProperty('icon');
        expect(category).toHaveProperty('color');

        expect(typeof category.id).toBe('string');
        expect(typeof category.name).toBe('string');
        expect(typeof category.csiDivision).toBe('string');
        expect(Array.isArray(category.subCategories)).toBe(true);
        expect(typeof category.icon).toBe('string');
        expect(typeof category.color).toBe('string');
      });
    });

    it('should have unique category IDs', () => {
      const ids = TAKEOFF_CATEGORIES.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid CSI divisions', () => {
      TAKEOFF_CATEGORIES.forEach(category => {
        expect(category.csiDivision).toMatch(/^\d{2}$/);
        const divisionNumber = parseInt(category.csiDivision);
        expect(divisionNumber).toBeGreaterThanOrEqual(0);
        expect(divisionNumber).toBeLessThanOrEqual(99);
      });
    });

    it('should have valid color hex codes', () => {
      TAKEOFF_CATEGORIES.forEach(category => {
        expect(category.color).toMatch(/^#[0-9A-F]{6}$/i);
      });
    });

    it('should have at least one subcategory per category', () => {
      TAKEOFF_CATEGORIES.forEach(category => {
        expect(category.subCategories.length).toBeGreaterThan(0);
      });
    });

    it('should have all required fields for subcategories', () => {
      TAKEOFF_CATEGORIES.forEach(category => {
        category.subCategories.forEach(sub => {
          expect(sub).toHaveProperty('id');
          expect(sub).toHaveProperty('name');
          expect(sub).toHaveProperty('defaultUnit');
          expect(sub).toHaveProperty('wasteFactorPercent');
          expect(sub).toHaveProperty('laborHoursPerUnit');
          expect(sub).toHaveProperty('keywords');

          expect(typeof sub.id).toBe('string');
          expect(typeof sub.name).toBe('string');
          expect(typeof sub.defaultUnit).toBe('string');
          expect(typeof sub.wasteFactorPercent).toBe('number');
          expect(typeof sub.laborHoursPerUnit).toBe('number');
          expect(Array.isArray(sub.keywords)).toBe(true);
        });
      });
    });

    it('should have valid waste factor percentages', () => {
      TAKEOFF_CATEGORIES.forEach(category => {
        category.subCategories.forEach(sub => {
          expect(sub.wasteFactorPercent).toBeGreaterThanOrEqual(0);
          expect(sub.wasteFactorPercent).toBeLessThanOrEqual(100);
        });
      });
    });

    it('should have positive labor hours per unit', () => {
      TAKEOFF_CATEGORIES.forEach(category => {
        category.subCategories.forEach(sub => {
          expect(sub.laborHoursPerUnit).toBeGreaterThanOrEqual(0);
        });
      });
    });

    it('should have at least one keyword per subcategory', () => {
      TAKEOFF_CATEGORIES.forEach(category => {
        category.subCategories.forEach(sub => {
          expect(sub.keywords.length).toBeGreaterThan(0);
        });
      });
    });

    it('should have valid unit codes', () => {
      const validUnits = ['CY', 'SF', 'LF', 'EA', 'TON', 'LBS', 'SY', 'SFCA', 'CF', 'SET', 'SQ', 'FLR'];
      TAKEOFF_CATEGORIES.forEach(category => {
        category.subCategories.forEach(sub => {
          expect(validUnits).toContain(sub.defaultUnit);
        });
      });
    });

    it('should include expected structural categories', () => {
      const categoryIds = TAKEOFF_CATEGORIES.map(c => c.id);
      expect(categoryIds).toContain('concrete');
      expect(categoryIds).toContain('rebar');
      expect(categoryIds).toContain('masonry');
      expect(categoryIds).toContain('steel');
      expect(categoryIds).toContain('lumber');
    });

    it('should include expected MEP categories', () => {
      const categoryIds = TAKEOFF_CATEGORIES.map(c => c.id);
      expect(categoryIds).toContain('hvac');
      expect(categoryIds).toContain('plumbing');
      expect(categoryIds).toContain('electrical');
    });

    it('should include expected finish categories', () => {
      const categoryIds = TAKEOFF_CATEGORIES.map(c => c.id);
      expect(categoryIds).toContain('drywall');
      expect(categoryIds).toContain('flooring');
      expect(categoryIds).toContain('ceiling');
      expect(categoryIds).toContain('walls');
    });

    it('should have unique subcategory IDs within each category', () => {
      TAKEOFF_CATEGORIES.forEach(category => {
        const subIds = category.subCategories.map(s => s.id);
        const uniqueSubIds = new Set(subIds);
        expect(uniqueSubIds.size).toBe(subIds.length);
      });
    });
  });

  // ============================================
  // getCategoryById Tests
  // ============================================
  describe('getCategoryById', () => {
    it('should return category when valid ID is provided', () => {
      const category = getCategoryById('concrete');
      expect(category).toBeDefined();
      expect(category?.id).toBe('concrete');
      expect(category?.name).toBe('Concrete');
    });

    it('should return undefined for invalid ID', () => {
      const category = getCategoryById('invalid-category-id');
      expect(category).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const category = getCategoryById('');
      expect(category).toBeUndefined();
    });

    it('should be case-sensitive', () => {
      const category = getCategoryById('CONCRETE');
      expect(category).toBeUndefined();
    });

    it('should return correct category for hvac', () => {
      const category = getCategoryById('hvac');
      expect(category).toBeDefined();
      expect(category?.csiDivision).toBe('23');
    });

    it('should return correct category for electrical', () => {
      const category = getCategoryById('electrical');
      expect(category).toBeDefined();
      expect(category?.csiDivision).toBe('26');
    });

    it('should return correct category for plumbing', () => {
      const category = getCategoryById('plumbing');
      expect(category).toBeDefined();
      expect(category?.csiDivision).toBe('22');
    });

    it('should return category with all subcategories', () => {
      const category = getCategoryById('concrete');
      expect(category?.subCategories).toBeDefined();
      expect(category?.subCategories.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // getAllCategoryIds Tests
  // ============================================
  describe('getAllCategoryIds', () => {
    it('should return array of category IDs', () => {
      const ids = getAllCategoryIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids.length).toBeGreaterThan(0);
    });

    it('should include all expected category IDs', () => {
      const ids = getAllCategoryIds();
      expect(ids).toContain('concrete');
      expect(ids).toContain('rebar');
      expect(ids).toContain('hvac');
      expect(ids).toContain('plumbing');
      expect(ids).toContain('electrical');
    });

    it('should return only strings', () => {
      const ids = getAllCategoryIds();
      ids.forEach(id => {
        expect(typeof id).toBe('string');
      });
    });

    it('should match the number of categories', () => {
      const ids = getAllCategoryIds();
      expect(ids.length).toBe(TAKEOFF_CATEGORIES.length);
    });

    it('should return unique IDs', () => {
      const ids = getAllCategoryIds();
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should not include empty strings', () => {
      const ids = getAllCategoryIds();
      ids.forEach(id => {
        expect(id.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================
  // matchItemToCategory Tests
  // ============================================
  describe('matchItemToCategory', () => {
    describe('success cases - concrete', () => {
      it('should match "slab" to concrete category', () => {
        const result = matchItemToCategory('slab');
        expect(result).not.toBeNull();
        expect(result?.categoryId).toBe('concrete');
      });

      it('should match "SOG" to slab on grade', () => {
        const result = matchItemToCategory('SOG');
        expect(result).not.toBeNull();
        expect(result?.categoryId).toBe('concrete');
        expect(result?.subCategoryId).toBe('slab-on-grade');
      });

      it('should match "footing" to concrete footings', () => {
        const result = matchItemToCategory('footing');
        expect(result).not.toBeNull();
        expect(result?.categoryId).toBe('concrete');
        expect(result?.subCategoryId).toBe('footings');
      });

      it('should match "foundation wall" to concrete', () => {
        const result = matchItemToCategory('foundation wall');
        expect(result).not.toBeNull();
        expect(result?.categoryId).toBe('concrete');
      });

      it('should be case-insensitive', () => {
        const result = matchItemToCategory('SLAB');
        expect(result).not.toBeNull();
        expect(result?.categoryId).toBe('concrete');
      });
    });

    describe('success cases - rebar', () => {
      it('should match "#4 rebar" to rebar category', () => {
        const result = matchItemToCategory('#4 rebar');
        expect(result).not.toBeNull();
        expect(result?.categoryId).toBe('rebar');
        expect(result?.subCategoryId).toBe('rebar-light');
      });

      it('should match "#8" to heavy rebar', () => {
        const result = matchItemToCategory('#8');
        expect(result).not.toBeNull();
        expect(result?.categoryId).toBe('rebar');
        expect(result?.subCategoryId).toBe('rebar-heavy');
      });

      it('should match "WWF" to welded wire fabric', () => {
        const result = matchItemToCategory('WWF');
        expect(result).not.toBeNull();
        expect(result?.categoryId).toBe('rebar');
        expect(result?.subCategoryId).toBe('wwf');
      });
    });

    describe('success cases - MEP', () => {
      it('should match "duct" to HVAC', () => {
        const result = matchItemToCategory('duct');
        expect(result).not.toBeNull();
        expect(result?.categoryId).toBe('hvac');
      });

      it('should match "copper pipe" to plumbing', () => {
        const result = matchItemToCategory('copper pipe');
        expect(result).not.toBeNull();
        expect(result?.categoryId).toBe('plumbing');
      });

      it('should match "EMT conduit" to electrical or site-electrical', () => {
        const result = matchItemToCategory('EMT conduit');
        expect(result).not.toBeNull();
        // EMT conduit exists in both electrical and site-electrical categories
        expect(['electrical', 'site-electrical']).toContain(result?.categoryId);
      });

      it('should match "VAV box" to HVAC equipment', () => {
        const result = matchItemToCategory('VAV box');
        expect(result).not.toBeNull();
        expect(result?.categoryId).toBe('hvac');
        expect(result?.subCategoryId).toBe('vav');
      });

      it('should match "PVC drain" to plumbing', () => {
        const result = matchItemToCategory('PVC drain');
        expect(result).not.toBeNull();
        expect(result?.categoryId).toBe('plumbing');
      });
    });

    describe('success cases - finishes', () => {
      it('should match "drywall" to drywall category', () => {
        const result = matchItemToCategory('drywall');
        expect(result).not.toBeNull();
        expect(result?.categoryId).toBe('drywall');
      });

      it('should match "carpet" to flooring', () => {
        const result = matchItemToCategory('carpet');
        expect(result).not.toBeNull();
        expect(result?.categoryId).toBe('flooring');
      });

      it('should match "paint" to wall finishes', () => {
        const result = matchItemToCategory('paint');
        expect(result).not.toBeNull();
        expect(result?.categoryId).toBe('walls');
      });
    });

    describe('confidence scoring', () => {
      it('should return confidence score', () => {
        const result = matchItemToCategory('slab');
        expect(result).not.toBeNull();
        expect(result?.confidence).toBeGreaterThan(0);
        expect(result?.confidence).toBeLessThanOrEqual(100);
      });

      it('should have higher confidence for multiple keyword matches', () => {
        const singleMatch = matchItemToCategory('slab');
        const multiMatch = matchItemToCategory('concrete floor slab');

        expect(singleMatch).not.toBeNull();
        expect(multiMatch).not.toBeNull();
        expect(multiMatch!.confidence).toBeGreaterThanOrEqual(singleMatch!.confidence);
      });

      it('should cap confidence at 100', () => {
        const result = matchItemToCategory('concrete slab floor SOG');
        expect(result).not.toBeNull();
        expect(result?.confidence).toBeLessThanOrEqual(100);
      });

      it('should prefer longer keyword matches', () => {
        const result = matchItemToCategory('foundation wall');
        expect(result).not.toBeNull();
        // Longer keywords should increase the score
        expect(result?.confidence).toBeGreaterThan(50);
      });
    });

    describe('edge cases and errors', () => {
      it('should return null for no matches', () => {
        const result = matchItemToCategory('99999 88888 77777 66666 55555');
        expect(result).toBeNull();
      });

      it('should return null for empty string', () => {
        const result = matchItemToCategory('');
        expect(result).toBeNull();
      });

      it('should handle special characters', () => {
        const result = matchItemToCategory('#4 rebar @ 12" o.c.');
        expect(result).not.toBeNull();
        expect(result?.categoryId).toBe('rebar');
      });

      it('should handle whitespace', () => {
        const result = matchItemToCategory('  slab  ');
        expect(result).not.toBeNull();
        expect(result?.categoryId).toBe('concrete');
      });

      it('should handle mixed case', () => {
        const result = matchItemToCategory('SlAb On GrAdE');
        expect(result).not.toBeNull();
        expect(result?.categoryId).toBe('concrete');
      });
    });

    describe('best match selection', () => {
      it('should select best match when multiple categories match', () => {
        const result = matchItemToCategory('copper pipe water');
        expect(result).not.toBeNull();
        // Should match plumbing or HVAC, whichever has better score
        expect(['plumbing', 'hvac']).toContain(result?.categoryId);
      });

      it('should prioritize specific matches over general ones', () => {
        const result = matchItemToCategory('spiral duct');
        expect(result).not.toBeNull();
        expect(result?.categoryId).toBe('hvac');
        expect(result?.subCategoryId).toBe('ductwork-round');
      });
    });
  });

  // ============================================
  // getWasteFactor Tests
  // ============================================
  describe('getWasteFactor', () => {
    describe('with subcategory', () => {
      it('should return correct waste factor for concrete slab', () => {
        const wasteFactor = getWasteFactor('concrete', 'slab-on-grade');
        expect(wasteFactor).toBe(5);
      });

      it('should return correct waste factor for rebar', () => {
        const wasteFactor = getWasteFactor('rebar', 'rebar-light');
        expect(wasteFactor).toBe(5);
      });

      it('should return correct waste factor for WWF', () => {
        const wasteFactor = getWasteFactor('rebar', 'wwf');
        expect(wasteFactor).toBe(10);
      });

      it('should return average waste factor if subcategory not found', () => {
        const wasteFactor = getWasteFactor('concrete', 'invalid-subcategory');
        expect(wasteFactor).toBeGreaterThan(0);
      });
    });

    describe('without subcategory', () => {
      it('should return average waste factor for category', () => {
        const wasteFactor = getWasteFactor('concrete');
        expect(wasteFactor).toBeGreaterThan(0);
        expect(wasteFactor).toBeLessThanOrEqual(100);
      });

      it('should return rounded average', () => {
        const wasteFactor = getWasteFactor('concrete');
        expect(Number.isInteger(wasteFactor)).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should return default 10% for invalid category', () => {
        const wasteFactor = getWasteFactor('invalid-category');
        expect(wasteFactor).toBe(10);
      });

      it('should return default 10% for empty string category', () => {
        const wasteFactor = getWasteFactor('');
        expect(wasteFactor).toBe(10);
      });

      it('should handle case-sensitive category IDs', () => {
        const wasteFactor = getWasteFactor('CONCRETE', 'slab-on-grade');
        expect(wasteFactor).toBe(10); // Should fall back to default
      });
    });

    describe('all categories', () => {
      it('should return valid waste factors for all categories', () => {
        const categoryIds = getAllCategoryIds();
        categoryIds.forEach(categoryId => {
          const wasteFactor = getWasteFactor(categoryId);
          expect(wasteFactor).toBeGreaterThanOrEqual(0);
          expect(wasteFactor).toBeLessThanOrEqual(100);
        });
      });
    });
  });

  // ============================================
  // getLaborHoursPerUnit Tests
  // ============================================
  describe('getLaborHoursPerUnit', () => {
    describe('with subcategory', () => {
      it('should return correct labor hours for concrete slab', () => {
        const laborHours = getLaborHoursPerUnit('concrete', 'slab-on-grade');
        expect(laborHours).toBe(0.8);
      });

      it('should return correct labor hours for concrete beams', () => {
        const laborHours = getLaborHoursPerUnit('concrete', 'beams');
        expect(laborHours).toBe(2.5);
      });

      it('should return correct labor hours for rebar', () => {
        const laborHours = getLaborHoursPerUnit('rebar', 'rebar-light');
        expect(laborHours).toBe(20);
      });

      it('should return average if subcategory not found', () => {
        const laborHours = getLaborHoursPerUnit('concrete', 'invalid-subcategory');
        expect(laborHours).toBeGreaterThan(0);
      });
    });

    describe('without subcategory', () => {
      it('should return average labor hours for category', () => {
        const laborHours = getLaborHoursPerUnit('concrete');
        expect(laborHours).toBeGreaterThan(0);
      });

      it('should calculate correct average', () => {
        const category = getCategoryById('concrete');
        const totalHours = category!.subCategories.reduce((sum, s) => sum + s.laborHoursPerUnit, 0);
        const expected = totalHours / category!.subCategories.length;

        const laborHours = getLaborHoursPerUnit('concrete');
        expect(laborHours).toBe(expected);
      });
    });

    describe('edge cases', () => {
      it('should return default 0.1 for invalid category', () => {
        const laborHours = getLaborHoursPerUnit('invalid-category');
        expect(laborHours).toBe(0.1);
      });

      it('should return default 0.1 for empty string category', () => {
        const laborHours = getLaborHoursPerUnit('');
        expect(laborHours).toBe(0.1);
      });

      it('should handle case-sensitive category IDs', () => {
        const laborHours = getLaborHoursPerUnit('CONCRETE', 'slab-on-grade');
        expect(laborHours).toBe(0.1); // Should fall back to default
      });
    });

    describe('all categories', () => {
      it('should return positive labor hours for all categories', () => {
        const categoryIds = getAllCategoryIds();
        categoryIds.forEach(categoryId => {
          const laborHours = getLaborHoursPerUnit(categoryId);
          expect(laborHours).toBeGreaterThan(0);
        });
      });

      it('should have realistic labor hours ranges', () => {
        const categoryIds = getAllCategoryIds();
        categoryIds.forEach(categoryId => {
          const laborHours = getLaborHoursPerUnit(categoryId);
          // Labor hours should be reasonable (0-100 hours per unit)
          expect(laborHours).toBeLessThan(100);
        });
      });
    });
  });

  // ============================================
  // getComprehensiveExtractionPrompt Tests
  // ============================================
  describe('getComprehensiveExtractionPrompt', () => {
    it('should return a non-empty string', () => {
      const prompt = getComprehensiveExtractionPrompt();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should include header text', () => {
      const prompt = getComprehensiveExtractionPrompt();
      expect(prompt).toContain('COMPREHENSIVE MATERIAL CATEGORIES');
    });

    it('should include all category names', () => {
      const prompt = getComprehensiveExtractionPrompt();
      TAKEOFF_CATEGORIES.forEach(category => {
        expect(prompt).toContain(category.name);
      });
    });

    it('should include CSI divisions', () => {
      const prompt = getComprehensiveExtractionPrompt();
      TAKEOFF_CATEGORIES.forEach(category => {
        expect(prompt).toContain(`CSI ${category.csiDivision}`);
      });
    });

    it('should include subcategory names', () => {
      const prompt = getComprehensiveExtractionPrompt();
      const concreteCategory = getCategoryById('concrete');
      concreteCategory?.subCategories.forEach(sub => {
        expect(prompt).toContain(sub.name);
      });
    });

    it('should include default units', () => {
      const prompt = getComprehensiveExtractionPrompt();
      expect(prompt).toContain('CY');
      expect(prompt).toContain('SF');
      expect(prompt).toContain('LF');
      expect(prompt).toContain('EA');
    });

    it('should include keywords for subcategories', () => {
      const prompt = getComprehensiveExtractionPrompt();
      // Check for some common keywords
      expect(prompt).toContain('slab');
      expect(prompt).toContain('footing');
    });

    it('should format subcategories with unit and keywords', () => {
      const prompt = getComprehensiveExtractionPrompt();
      // Should have format: "Name (UNIT): keyword1, keyword2, keyword3"
      expect(prompt).toMatch(/\w+\s+\([A-Z]+\):/);
    });

    it('should limit keywords to first 3', () => {
      const prompt = getComprehensiveExtractionPrompt();
      const lines = prompt.split('\n');

      // Find a subcategory line with keywords
      const subCategoryLine = lines.find(line => line.includes('(CY):') || line.includes('(SF):'));
      expect(subCategoryLine).toBeDefined();

      if (subCategoryLine) {
        const keywordsPart = subCategoryLine.split(':')[1];
        if (keywordsPart) {
          const keywords = keywordsPart.split(',');
          expect(keywords.length).toBeLessThanOrEqual(3);
        }
      }
    });

    it('should have consistent structure', () => {
      const prompt = getComprehensiveExtractionPrompt();
      expect(prompt).toContain('###');
      expect(prompt).toContain('##');
    });

    it('should be formatted with newlines', () => {
      const prompt = getComprehensiveExtractionPrompt();
      expect(prompt).toContain('\n');
      const lines = prompt.split('\n');
      expect(lines.length).toBeGreaterThan(10);
    });
  });

  // ============================================
  // Integration Tests
  // ============================================
  describe('integration tests', () => {
    it('should work end-to-end: match item, get category, get waste factor', () => {
      const match = matchItemToCategory('concrete slab');
      expect(match).not.toBeNull();

      const category = getCategoryById(match!.categoryId);
      expect(category).toBeDefined();

      const wasteFactor = getWasteFactor(match!.categoryId, match!.subCategoryId);
      expect(wasteFactor).toBeGreaterThan(0);
    });

    it('should work end-to-end: match item, get labor hours', () => {
      const match = matchItemToCategory('rebar #4');
      expect(match).not.toBeNull();

      const laborHours = getLaborHoursPerUnit(match!.categoryId, match!.subCategoryId);
      expect(laborHours).toBeGreaterThan(0);
    });

    it('should handle full workflow for MEP items', () => {
      const items = ['EMT conduit', 'copper pipe', 'rectangular duct'];

      items.forEach(item => {
        const match = matchItemToCategory(item);
        expect(match).not.toBeNull();

        const category = getCategoryById(match!.categoryId);
        expect(category).toBeDefined();
        // EMT conduit can match either electrical or site-electrical
        expect(['hvac', 'plumbing', 'electrical', 'site-electrical']).toContain(category!.id);

        const wasteFactor = getWasteFactor(match!.categoryId, match!.subCategoryId);
        expect(wasteFactor).toBeGreaterThanOrEqual(0);

        const laborHours = getLaborHoursPerUnit(match!.categoryId, match!.subCategoryId);
        expect(laborHours).toBeGreaterThan(0);
      });
    });

    it('should verify all category IDs can be retrieved', () => {
      const ids = getAllCategoryIds();

      ids.forEach(id => {
        const category = getCategoryById(id);
        expect(category).toBeDefined();
        expect(category?.id).toBe(id);
      });
    });

    it('should ensure prompt includes all retrievable categories', () => {
      const prompt = getComprehensiveExtractionPrompt();
      const ids = getAllCategoryIds();

      ids.forEach(id => {
        const category = getCategoryById(id);
        expect(prompt).toContain(category!.name);
      });
    });
  });

  // ============================================
  // Real-world Construction Item Tests
  // ============================================
  describe('real-world construction items', () => {
    const testCases: Array<{ item: string; expectedCategory: string }> = [
      // Concrete
      { item: '4" concrete slab on grade', expectedCategory: 'concrete' },
      { item: 'strip footings 24" x 12"', expectedCategory: 'concrete' },
      { item: 'concrete foundation wall', expectedCategory: 'concrete' },
      { item: 'elevated concrete deck', expectedCategory: 'concrete' },

      // Rebar
      { item: '#4 rebar @ 12" o.c.', expectedCategory: 'rebar' },
      { item: '6x6 WWF', expectedCategory: 'rebar' },
      { item: '#8 rebar vertical', expectedCategory: 'rebar' },

      // Masonry
      { item: '8" CMU block', expectedCategory: 'masonry' },
      { item: 'face brick veneer', expectedCategory: 'masonry' },

      // Steel
      { item: 'W12x26 wide flange beam', expectedCategory: 'steel' },
      { item: 'HSS 4x4x1/4 tube steel', expectedCategory: 'steel' },
      { item: '1.5" metal deck', expectedCategory: 'steel' },

      // Lumber
      { item: '2x4 wall studs', expectedCategory: 'lumber' },
      { item: '2x10 floor joists', expectedCategory: 'lumber' },
      { item: 'roof trusses', expectedCategory: 'lumber' },
      { item: '3/4" plywood sheathing', expectedCategory: 'lumber' },

      // HVAC
      { item: 'rectangular supply duct', expectedCategory: 'hvac' },
      { item: '12" spiral duct', expectedCategory: 'hvac' },
      { item: 'supply diffuser', expectedCategory: 'hvac' },
      { item: 'fire damper', expectedCategory: 'hvac' },
      { item: 'VAV terminal unit', expectedCategory: 'hvac' },
      { item: 'rooftop unit 10 ton', expectedCategory: 'hvac' },

      // Plumbing
      { item: '1" copper type L pipe', expectedCategory: 'plumbing' },
      { item: '4" PVC drain pipe', expectedCategory: 'plumbing' },
      { item: 'water closet wall hung', expectedCategory: 'plumbing' },
      { item: 'lavatory with faucet', expectedCategory: 'plumbing' },
      { item: 'ball valve 2"', expectedCategory: 'plumbing' },

      // Electrical
      { item: '3/4" EMT conduit', expectedCategory: 'site-electrical' },
      { item: '#12 THHN wire', expectedCategory: 'electrical' },
      { item: 'duplex receptacle', expectedCategory: 'electrical' },
      { item: '2x4 LED troffer', expectedCategory: 'electrical' },
      { item: 'panelboard 225A', expectedCategory: 'electrical' },

      // Finishes
      { item: 'gypsum board 5/8"', expectedCategory: 'drywall' },
      { item: 'carpet tile', expectedCategory: 'flooring' },
      { item: 'VCT flooring', expectedCategory: 'flooring' },
      { item: 'ceramic wall tile', expectedCategory: 'walls' },
      { item: 'acoustic ceiling tile', expectedCategory: 'ceiling' },
      { item: 'latex paint', expectedCategory: 'walls' },
    ];

    testCases.forEach(({ item, expectedCategory }) => {
      it(`should correctly match "${item}" to ${expectedCategory}`, () => {
        const result = matchItemToCategory(item);
        expect(result).not.toBeNull();
        expect(result?.categoryId).toBe(expectedCategory);
      });
    });
  });
});
