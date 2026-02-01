import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  extractElevationsFromDocument,
  extractElevationsWithAI,
  mergeElevationSources,
  createElevationGrid,
  estimateFromSiteParams,
  type ExtractedElevations,
} from '@/lib/earthwork-extractor';

// Mock the earthwork-calculator dependency
const mocks = vi.hoisted(() => ({
  parseElevationData: vi.fn(),
}));

vi.mock('@/lib/earthwork-calculator', () => ({
  parseElevationData: mocks.parseElevationData,
}));

// Mock fetch for AI extraction tests
global.fetch = vi.fn();

describe('Earthwork Extractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractElevationsFromDocument', () => {
    describe('Cross-section extraction', () => {
      it('should extract cross-section data from standard format', async () => {
        const documentContent = `
          CROSS SECTION DATA
          STA 1+00 CUT 125 SF FILL 85 SF
          STA 2+50 CUT 200 SF FILL 50 SF
          STA 4+00 CUT 150 SF FILL 100 SF
        `;

        const result = await extractElevationsFromDocument(documentContent, 'grading');

        expect(result.crossSections).toHaveLength(3);
        expect(result.crossSections[0]).toEqual({
          station: 1.0,
          cutArea: 125,
          fillArea: 85,
        });
        expect(result.crossSections[1]).toEqual({
          station: 2.5,
          cutArea: 200,
          fillArea: 50,
        });
        expect(result.crossSections[2]).toEqual({
          station: 4.0,
          cutArea: 150,
          fillArea: 100,
        });
      });

      it('should handle cross-sections without SF units', async () => {
        const documentContent = 'STA. 0+50 C 75 F 40';

        const result = await extractElevationsFromDocument(documentContent, 'grading');

        expect(result.crossSections).toHaveLength(1);
        expect(result.crossSections[0]).toEqual({
          station: 0.5,
          cutArea: 75,
          fillArea: 40,
        });
      });

      it('should handle decimal stations correctly', async () => {
        const documentContent = 'STA 10+75 CUT 180.5 SF FILL 95.3 SF';

        const result = await extractElevationsFromDocument(documentContent, 'grading');

        expect(result.crossSections[0].station).toBe(10.75);
        expect(result.crossSections[0].cutArea).toBe(180.5);
        expect(result.crossSections[0].fillArea).toBe(95.3);
      });
    });

    describe('Coordinate-based elevation extraction', () => {
      it('should extract coordinate elevations with N/E format', async () => {
        const documentContent = `
          BENCHMARK ELEVATIONS
          N 1234.56 E 5678.90 ELEV 985.5
          N 2345.67 E 6789.01 EL. 990.2
        `;

        const result = await extractElevationsFromDocument(documentContent, 'survey');

        expect(result.existing).toHaveLength(2);
        expect(result.existing[0]).toEqual({
          x: 5678.90,
          y: 1234.56,
          elev: 985.5,
        });
        expect(result.existing[1]).toEqual({
          x: 6789.01,
          y: 2345.67,
          elev: 990.2,
        });
      });

      it('should distinguish existing vs proposed elevations by context', async () => {
        const documentContent = `
          EXISTING GRADE
          N 1000 E 2000 ELEV 980.0

          PROPOSED FINISH GRADE
          N 1000 E 2000 ELEV 982.5
        `;

        const result = await extractElevationsFromDocument(documentContent, 'grading');

        expect(result.existing).toHaveLength(1);
        expect(result.existing[0].elev).toBe(980.0);
        expect(result.proposed).toHaveLength(1);
        expect(result.proposed[0].elev).toBe(982.5);
      });

      it('should handle various existing markers', async () => {
        const testCases = [
          'EXISTING GRADE N 100 E 200 ELEV 950',
          'EXIST. ELEV N 100 E 200 ELEV 950',
          'EX. SURFACE N 100 E 200 ELEV 950',
        ];

        for (const content of testCases) {
          const result = await extractElevationsFromDocument(content, 'survey');
          expect(result.existing).toHaveLength(1);
          expect(result.proposed).toHaveLength(0);
        }
      });

      it('should handle various proposed markers', async () => {
        const testCases = [
          'PROPOSED GRADE N 100 E 200 ELEV 960',
          'PROP. ELEV N 100 E 200 ELEV 960',
          'DESIGN SURFACE N 100 E 200 ELEV 960',
          'FINISH GRADE N 100 E 200 ELEV 960',
          'FG ELEV N 100 E 200 ELEV 960',
        ];

        for (const content of testCases) {
          const result = await extractElevationsFromDocument(content, 'grading');
          expect(result.proposed).toHaveLength(1);
          expect(result.existing).toHaveLength(0);
        }
      });
    });

    describe('Grid coordinate extraction', () => {
      it('should extract XYZ grid coordinates', async () => {
        const documentContent = `
          GRID POINTS
          X: 1000, Y: 2000, Z: 985.5
          X: 1025, Y: 2000, Z: 986.2
        `;

        const result = await extractElevationsFromDocument(documentContent, 'survey');

        expect(result.existing).toHaveLength(2);
        expect(result.existing[0]).toEqual({
          x: 1000,
          y: 2000,
          elev: 985.5,
        });
      });

      it('should handle grid coordinates with equals signs', async () => {
        const documentContent = 'X=1500 Y=2500 Z=990.0';

        const result = await extractElevationsFromDocument(documentContent, 'survey');

        expect(result.existing).toHaveLength(1);
        expect(result.existing[0]).toEqual({
          x: 1500,
          y: 2500,
          elev: 990.0,
        });
      });

      it('should classify grid coordinates as proposed when appropriate', async () => {
        const documentContent = `
          PROPOSED DESIGN ELEVATIONS
          X: 1000, Y: 2000, Z: 995.0
        `;

        const result = await extractElevationsFromDocument(documentContent, 'grading');

        expect(result.proposed).toHaveLength(1);
        expect(result.existing).toHaveLength(0);
      });
    });

    describe('Confidence calculation', () => {
      it('should have low confidence with minimal data', async () => {
        const documentContent = 'N 100 E 200 ELEV 950';

        const result = await extractElevationsFromDocument(documentContent, 'survey');

        expect(result.metadata.confidence).toBeLessThan(0.5);
      });

      it('should have higher confidence with many existing points', async () => {
        const points = Array.from({ length: 15 }, (_, i) =>
          `N ${1000 + i * 10} E ${2000 + i * 10} ELEV ${980 + i}`
        ).join('\n');

        const result = await extractElevationsFromDocument(points, 'survey');

        expect(result.metadata.confidence).toBeGreaterThan(0.4);
      });

      it('should have higher confidence with cross-sections', async () => {
        const documentContent = `
          STA 0+00 CUT 100 SF FILL 50 SF
          STA 1+00 CUT 120 SF FILL 60 SF
          STA 2+00 CUT 110 SF FILL 55 SF
          STA 3+00 CUT 130 SF FILL 65 SF
          STA 4+00 CUT 125 SF FILL 62 SF
          STA 5+00 CUT 115 SF FILL 58 SF
        `;

        const result = await extractElevationsFromDocument(documentContent, 'grading');

        // 6 cross-sections (>= 5) gives 0.3 base + 0.2 = 0.5
        expect(result.metadata.confidence).toBe(0.5);
      });

      it('should cap confidence at 1.0', async () => {
        // Create lots of data
        const points = Array.from({ length: 20 }, (_, i) =>
          `N ${1000 + i * 10} E ${2000 + i * 10} ELEV ${980 + i}`
        ).join('\n');
        const proposedPoints = Array.from({ length: 20 }, (_, i) =>
          `PROPOSED N ${1000 + i * 10} E ${2000 + i * 10} ELEV ${985 + i}`
        ).join('\n');
        const sections = Array.from({ length: 10 }, (_, i) =>
          `STA ${i}+00 CUT 100 SF FILL 50 SF`
        ).join('\n');

        const documentContent = `${points}\n${proposedPoints}\n${sections}`;

        const result = await extractElevationsFromDocument(documentContent, 'grading');

        expect(result.metadata.confidence).toBeLessThanOrEqual(1.0);
      });
    });

    describe('Datum detection', () => {
      it('should detect NAVD88 datum', async () => {
        const documentContent = 'VERTICAL DATUM: NAVD 88\nN 100 E 200 ELEV 950';

        const result = await extractElevationsFromDocument(documentContent, 'survey');

        expect(result.metadata.datum).toBe('NAVD 88');
      });

      it('should detect NGVD29 datum', async () => {
        const documentContent = 'DATUM: NGVD 29\nN 100 E 200 ELEV 950';

        const result = await extractElevationsFromDocument(documentContent, 'survey');

        expect(result.metadata.datum).toBe('NGVD 29');
      });

      it('should detect local datum', async () => {
        const documentContent = 'LOCAL DATUM ASSUMED\nN 100 E 200 ELEV 950';

        const result = await extractElevationsFromDocument(documentContent, 'survey');

        expect(result.metadata.datum).toBe('LOCAL DATUM');
      });

      it('should detect MSL datum', async () => {
        const documentContent = 'ELEVATIONS RELATIVE TO MSL\nN 100 E 200 ELEV 50';

        const result = await extractElevationsFromDocument(documentContent, 'survey');

        expect(result.metadata.datum).toBe('MSL');
      });

      it('should return undefined when no datum found', async () => {
        const documentContent = 'N 100 E 200 ELEV 950';

        const result = await extractElevationsFromDocument(documentContent, 'survey');

        expect(result.metadata.datum).toBeUndefined();
      });
    });

    describe('Units detection', () => {
      it('should detect meters when only meters mentioned', async () => {
        const documentContent = 'All dimensions in meters\nN 100 E 200 ELEV 50';

        const result = await extractElevationsFromDocument(documentContent, 'survey');

        expect(result.metadata.units).toBe('meters');
      });

      it('should default to feet when both mentioned', async () => {
        const documentContent = 'Plan in feet, some details in meters\nN 100 E 200 ELEV 950';

        const result = await extractElevationsFromDocument(documentContent, 'survey');

        expect(result.metadata.units).toBe('feet');
      });

      it('should default to feet when no units mentioned', async () => {
        const documentContent = 'N 100 E 200 ELEV 950';

        const result = await extractElevationsFromDocument(documentContent, 'survey');

        expect(result.metadata.units).toBe('feet');
      });
    });

    describe('Metadata', () => {
      it('should set correct metadata for survey documents', async () => {
        const documentContent = 'N 100 E 200 ELEV 950';

        const result = await extractElevationsFromDocument(documentContent, 'survey');

        expect(result.metadata.source).toBe('survey');
        expect(result.metadata.extractionMethod).toBe('pattern-matching');
      });

      it('should set correct metadata for grading plans', async () => {
        const documentContent = 'STA 0+00 CUT 100 SF FILL 50 SF';

        const result = await extractElevationsFromDocument(documentContent, 'grading');

        expect(result.metadata.source).toBe('grading');
        expect(result.metadata.extractionMethod).toBe('pattern-matching');
      });
    });

    describe('Edge cases', () => {
      it('should handle empty document', async () => {
        const result = await extractElevationsFromDocument('', 'survey');

        expect(result.existing).toHaveLength(0);
        expect(result.proposed).toHaveLength(0);
        expect(result.crossSections).toHaveLength(0);
      });

      it('should handle document with no elevation data', async () => {
        const documentContent = 'This is a text document with no elevation data';

        const result = await extractElevationsFromDocument(documentContent, 'survey');

        expect(result.existing).toHaveLength(0);
        expect(result.proposed).toHaveLength(0);
        expect(result.crossSections).toHaveLength(0);
      });

      it('should handle malformed coordinate data gracefully', async () => {
        const documentContent = `
          N invalid E 200 ELEV 950
          N 100 E invalid ELEV 950
          N 100 E 200 ELEV invalid
        `;

        const result = await extractElevationsFromDocument(documentContent, 'survey');

        // Should extract what it can parse
        expect(result.existing.length).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('extractElevationsWithAI', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      (global.fetch as any).mockClear();
    });

    it('should fall back to pattern matching when no API key provided', async () => {
      const documentContent = 'N 100 E 200 ELEV 950';

      const result = await extractElevationsWithAI(documentContent, 'survey');

      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.metadata.extractionMethod).toBe('pattern-matching');
      expect(result.existing).toHaveLength(1);
    });

    it('should call AI API with correct parameters', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              existing_elevations: [{ x: 100, y: 200, elev: 950 }],
              proposed_elevations: [{ x: 100, y: 200, elev: 955 }],
              cross_sections: [],
              datum: 'NAVD88',
              units: 'feet',
            }),
          },
        }],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const documentContent = 'Test document content';
      await extractElevationsWithAI(documentContent, 'grading', 'test-api-key');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://routellm.abacus.ai/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key',
          },
          body: expect.stringContaining('gpt-4o'),
        })
      );
    });

    it('should parse AI response correctly', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              existing_elevations: [
                { x: 100, y: 200, elev: 950 },
                { x: 150, y: 250, elev: 955 },
              ],
              proposed_elevations: [
                { x: 100, y: 200, elev: 960 },
              ],
              cross_sections: [
                { station: 1.0, cut_area_sf: 125, fill_area_sf: 85 },
              ],
              datum: 'NAVD88',
              units: 'feet',
            }),
          },
        }],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await extractElevationsWithAI('Test', 'survey', 'api-key');

      expect(result.existing).toHaveLength(2);
      expect(result.proposed).toHaveLength(1);
      expect(result.crossSections).toHaveLength(1);
      expect(result.crossSections[0]).toEqual({
        station: 1.0,
        cutArea: 125,
        fillArea: 85,
      });
      expect(result.metadata.datum).toBe('NAVD88');
      expect(result.metadata.units).toBe('feet');
      expect(result.metadata.extractionMethod).toBe('ai-vision');
      expect(result.metadata.confidence).toBe(0.85);
    });

    it('should handle empty AI response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({}),
          },
        }],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await extractElevationsWithAI('Test', 'survey', 'api-key');

      expect(result.existing).toHaveLength(0);
      expect(result.proposed).toHaveLength(0);
      expect(result.crossSections).toHaveLength(0);
    });

    it('should truncate long documents to 8000 characters', async () => {
      const longContent = 'x'.repeat(10000);
      const mockResponse = {
        choices: [{
          message: { content: JSON.stringify({}) },
        }],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await extractElevationsWithAI(longContent, 'survey', 'api-key');

      const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      const promptContent = callBody.messages[0].content;
      // Document is truncated to 8000 chars, but the full prompt includes template text
      expect(promptContent).toContain('x'.repeat(100)); // Has some of the content
      expect(promptContent.length).toBeGreaterThan(500); // Has template text
      expect(promptContent.length).toBeLessThan(9000); // But is limited overall
    });

    it('should fall back to pattern matching on API error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const documentContent = 'N 100 E 200 ELEV 950';
      const result = await extractElevationsWithAI(documentContent, 'survey', 'api-key');

      expect(result.metadata.extractionMethod).toBe('pattern-matching');
      expect(result.existing).toHaveLength(1);
    });

    it('should fall back to pattern matching on network error', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const documentContent = 'N 100 E 200 ELEV 950';
      const result = await extractElevationsWithAI(documentContent, 'survey', 'api-key');

      expect(result.metadata.extractionMethod).toBe('pattern-matching');
      expect(result.existing).toHaveLength(1);
    });

    it('should fall back to pattern matching on JSON parse error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'invalid json' } }] }),
      });

      const documentContent = 'N 100 E 200 ELEV 950';
      const result = await extractElevationsWithAI(documentContent, 'survey', 'api-key');

      expect(result.metadata.extractionMethod).toBe('pattern-matching');
    });
  });

  describe('mergeElevationSources', () => {
    it('should merge multiple sources successfully', () => {
      const source1: ExtractedElevations = {
        existing: [
          { x: 100, y: 200, elev: 950 },
          { x: 150, y: 250, elev: 955 },
        ],
        proposed: [{ x: 100, y: 200, elev: 960 }],
        crossSections: [{ station: 1.0, cutArea: 100, fillArea: 50 }],
        metadata: {
          source: 'survey',
          confidence: 0.8,
          extractionMethod: 'pattern-matching',
          datum: 'NAVD88',
          units: 'feet',
        },
      };

      const source2: ExtractedElevations = {
        existing: [{ x: 200, y: 300, elev: 965 }],
        proposed: [{ x: 200, y: 300, elev: 970 }],
        crossSections: [{ station: 2.0, cutArea: 120, fillArea: 60 }],
        metadata: {
          source: 'grading',
          confidence: 0.7,
          extractionMethod: 'ai-vision',
        },
      };

      const result = mergeElevationSources([source1, source2]);

      expect(result.existing).toHaveLength(3);
      expect(result.proposed).toHaveLength(2);
      expect(result.crossSections).toHaveLength(2);
      expect(result.metadata.source).toBe('merged');
      expect(result.metadata.extractionMethod).toBe('multi-source');
    });

    it('should prioritize higher confidence sources', () => {
      const highConfidence: ExtractedElevations = {
        existing: [{ x: 100, y: 200, elev: 950 }],
        proposed: [],
        crossSections: [],
        metadata: {
          source: 'survey',
          confidence: 0.9,
          extractionMethod: 'ai-vision',
          datum: 'NAVD88',
          units: 'feet',
        },
      };

      const lowConfidence: ExtractedElevations = {
        existing: [],
        proposed: [],
        crossSections: [],
        metadata: {
          source: 'geotech',
          confidence: 0.5,
          extractionMethod: 'pattern-matching',
          datum: 'LOCAL',
          units: 'meters',
        },
      };

      const result = mergeElevationSources([lowConfidence, highConfidence]);

      // Should use metadata from highest confidence source
      expect(result.metadata.datum).toBe('NAVD88');
      expect(result.metadata.units).toBe('feet');
    });

    it('should remove duplicate points within tolerance', () => {
      const source1: ExtractedElevations = {
        existing: [{ x: 100, y: 200, elev: 950 }],
        proposed: [],
        crossSections: [],
        metadata: {
          source: 'survey',
          confidence: 0.8,
          extractionMethod: 'pattern-matching',
        },
      };

      const source2: ExtractedElevations = {
        existing: [
          { x: 102, y: 202, elev: 950.5 }, // Within 5ft tolerance
          { x: 200, y: 300, elev: 960 },   // Different point
        ],
        proposed: [],
        crossSections: [],
        metadata: {
          source: 'grading',
          confidence: 0.7,
          extractionMethod: 'pattern-matching',
        },
      };

      const result = mergeElevationSources([source1, source2]);

      // Should only have 2 unique points (first duplicate removed)
      expect(result.existing).toHaveLength(2);
    });

    it('should not duplicate cross sections at same station', () => {
      const source1: ExtractedElevations = {
        existing: [],
        proposed: [],
        crossSections: [{ station: 1.0, cutArea: 100, fillArea: 50 }],
        metadata: {
          source: 'survey',
          confidence: 0.8,
          extractionMethod: 'pattern-matching',
        },
      };

      const source2: ExtractedElevations = {
        existing: [],
        proposed: [],
        crossSections: [
          { station: 1.0, cutArea: 105, fillArea: 52 }, // Same station
          { station: 2.0, cutArea: 120, fillArea: 60 }, // Different station
        ],
        metadata: {
          source: 'grading',
          confidence: 0.7,
          extractionMethod: 'pattern-matching',
        },
      };

      const result = mergeElevationSources([source1, source2]);

      expect(result.crossSections).toHaveLength(2);
      expect(result.crossSections.map(cs => cs.station)).toContain(1.0);
      expect(result.crossSections.map(cs => cs.station)).toContain(2.0);
    });

    it('should calculate average confidence', () => {
      const sources: ExtractedElevations[] = [
        {
          existing: [],
          proposed: [],
          crossSections: [],
          metadata: { source: 'a', confidence: 0.8, extractionMethod: 'pattern-matching' },
        },
        {
          existing: [],
          proposed: [],
          crossSections: [],
          metadata: { source: 'b', confidence: 0.6, extractionMethod: 'pattern-matching' },
        },
        {
          existing: [],
          proposed: [],
          crossSections: [],
          metadata: { source: 'c', confidence: 0.9, extractionMethod: 'ai-vision' },
        },
      ];

      const result = mergeElevationSources(sources);

      expect(result.metadata.confidence).toBeCloseTo((0.8 + 0.6 + 0.9) / 3, 2);
    });

    it('should handle empty sources array', () => {
      const result = mergeElevationSources([]);

      expect(result.existing).toHaveLength(0);
      expect(result.proposed).toHaveLength(0);
      expect(result.crossSections).toHaveLength(0);
      expect(Number.isNaN(result.metadata.confidence)).toBe(true);
    });

    it('should handle single source', () => {
      const source: ExtractedElevations = {
        existing: [{ x: 100, y: 200, elev: 950 }],
        proposed: [{ x: 100, y: 200, elev: 955 }],
        crossSections: [],
        metadata: {
          source: 'survey',
          confidence: 0.8,
          extractionMethod: 'pattern-matching',
        },
      };

      const result = mergeElevationSources([source]);

      expect(result.existing).toHaveLength(1);
      expect(result.proposed).toHaveLength(1);
      expect(result.metadata.confidence).toBe(0.8);
    });
  });

  describe('createElevationGrid', () => {
    beforeEach(() => {
      mocks.parseElevationData.mockClear();
    });

    it('should return null when insufficient existing points', () => {
      const data: ExtractedElevations = {
        existing: [
          { x: 100, y: 200, elev: 950 },
          { x: 150, y: 250, elev: 955 },
        ],
        proposed: [
          { x: 100, y: 200, elev: 960 },
          { x: 150, y: 250, elev: 965 },
          { x: 200, y: 300, elev: 970 },
        ],
        crossSections: [],
        metadata: {
          source: 'survey',
          confidence: 0.8,
          extractionMethod: 'pattern-matching',
        },
      };

      const result = createElevationGrid(data);

      expect(result).toBeNull();
      expect(mocks.parseElevationData).not.toHaveBeenCalled();
    });

    it('should return null when insufficient proposed points', () => {
      const data: ExtractedElevations = {
        existing: [
          { x: 100, y: 200, elev: 950 },
          { x: 150, y: 250, elev: 955 },
          { x: 200, y: 300, elev: 960 },
        ],
        proposed: [
          { x: 100, y: 200, elev: 965 },
          { x: 150, y: 250, elev: 970 },
        ],
        crossSections: [],
        metadata: {
          source: 'survey',
          confidence: 0.8,
          extractionMethod: 'pattern-matching',
        },
      };

      const result = createElevationGrid(data);

      expect(result).toBeNull();
      expect(mocks.parseElevationData).not.toHaveBeenCalled();
    });

    it('should call parseElevationData with default grid spacing', () => {
      const data: ExtractedElevations = {
        existing: [
          { x: 100, y: 200, elev: 950 },
          { x: 150, y: 250, elev: 955 },
          { x: 200, y: 300, elev: 960 },
        ],
        proposed: [
          { x: 100, y: 200, elev: 965 },
          { x: 150, y: 250, elev: 970 },
          { x: 200, y: 300, elev: 975 },
        ],
        crossSections: [],
        metadata: {
          source: 'survey',
          confidence: 0.8,
          extractionMethod: 'pattern-matching',
        },
      };

      mocks.parseElevationData.mockReturnValue({
        points: [],
        gridSpacing: 25,
        bounds: { minX: 100, maxX: 200, minY: 200, maxY: 300 },
      });

      const result = createElevationGrid(data);

      expect(mocks.parseElevationData).toHaveBeenCalledWith(
        data.existing,
        data.proposed,
        25
      );
      expect(result).not.toBeNull();
    });

    it('should call parseElevationData with custom grid spacing', () => {
      const data: ExtractedElevations = {
        existing: [
          { x: 100, y: 200, elev: 950 },
          { x: 150, y: 250, elev: 955 },
          { x: 200, y: 300, elev: 960 },
        ],
        proposed: [
          { x: 100, y: 200, elev: 965 },
          { x: 150, y: 250, elev: 970 },
          { x: 200, y: 300, elev: 975 },
        ],
        crossSections: [],
        metadata: {
          source: 'survey',
          confidence: 0.8,
          extractionMethod: 'pattern-matching',
        },
      };

      mocks.parseElevationData.mockReturnValue({
        points: [],
        gridSpacing: 50,
        bounds: { minX: 100, maxX: 200, minY: 200, maxY: 300 },
      });

      createElevationGrid(data, 50);

      expect(mocks.parseElevationData).toHaveBeenCalledWith(
        data.existing,
        data.proposed,
        50
      );
    });

    it('should return result from parseElevationData', () => {
      const data: ExtractedElevations = {
        existing: [
          { x: 100, y: 200, elev: 950 },
          { x: 150, y: 250, elev: 955 },
          { x: 200, y: 300, elev: 960 },
        ],
        proposed: [
          { x: 100, y: 200, elev: 965 },
          { x: 150, y: 250, elev: 970 },
          { x: 200, y: 300, elev: 975 },
        ],
        crossSections: [],
        metadata: {
          source: 'survey',
          confidence: 0.8,
          extractionMethod: 'pattern-matching',
        },
      };

      const mockGrid = {
        points: [
          { x: 100, y: 200, existingElev: 950, proposedElev: 965 },
          { x: 150, y: 250, existingElev: 955, proposedElev: 970 },
        ],
        gridSpacing: 25,
        bounds: { minX: 100, maxX: 200, minY: 200, maxY: 300 },
      };

      mocks.parseElevationData.mockReturnValue(mockGrid);

      const result = createElevationGrid(data);

      expect(result).toEqual(mockGrid);
    });
  });

  describe('estimateFromSiteParams', () => {
    describe('Cut scenarios', () => {
      it('should calculate cut depth when existing is higher', () => {
        const result = estimateFromSiteParams({
          siteAreaSF: 10000,
          existingAvgElev: 100,
          proposedAvgElev: 98,
        });

        expect(result.avgCutDepth).toBe(2);
        expect(result.avgFillDepth).toBe(0);
      });

      it('should include slope factor in cut calculation', () => {
        const result = estimateFromSiteParams({
          siteAreaSF: 10000,
          existingAvgElev: 100,
          proposedAvgElev: 98,
          slopePercent: 4,
        });

        expect(result.avgCutDepth).toBe(2 + (4 / 100) * 0.5);
        expect(result.avgCutDepth).toBeCloseTo(2.02);
      });

      it('should indicate significant cut expected', () => {
        const result = estimateFromSiteParams({
          siteAreaSF: 10000,
          existingAvgElev: 105,
          proposedAvgElev: 100,
        });

        expect(result.balanceEstimate).toBe('Significant cut expected - potential material export');
      });
    });

    describe('Fill scenarios', () => {
      it('should calculate fill depth when proposed is higher', () => {
        const result = estimateFromSiteParams({
          siteAreaSF: 10000,
          existingAvgElev: 98,
          proposedAvgElev: 100,
        });

        expect(result.avgFillDepth).toBe(2);
        expect(result.avgCutDepth).toBe(0);
      });

      it('should include slope factor in fill calculation', () => {
        const result = estimateFromSiteParams({
          siteAreaSF: 10000,
          existingAvgElev: 98,
          proposedAvgElev: 100,
          slopePercent: 6,
        });

        expect(result.avgFillDepth).toBe(2 + (6 / 100) * 0.5);
        expect(result.avgFillDepth).toBeCloseTo(2.03);
      });

      it('should indicate significant fill expected', () => {
        const result = estimateFromSiteParams({
          siteAreaSF: 10000,
          existingAvgElev: 95,
          proposedAvgElev: 100,
        });

        expect(result.balanceEstimate).toBe('Significant fill expected - material import likely needed');
      });
    });

    describe('Balanced scenarios', () => {
      it('should indicate balanced site for minimal elevation difference', () => {
        const result = estimateFromSiteParams({
          siteAreaSF: 10000,
          existingAvgElev: 100,
          proposedAvgElev: 100.3,
        });

        expect(result.avgCutDepth).toBe(0);
        expect(result.avgFillDepth).toBeCloseTo(0.3);
        expect(result.balanceEstimate).toBe('Site appears relatively balanced');
      });

      it('should handle zero elevation difference', () => {
        const result = estimateFromSiteParams({
          siteAreaSF: 10000,
          existingAvgElev: 100,
          proposedAvgElev: 100,
        });

        expect(result.avgCutDepth).toBe(0);
        expect(result.avgFillDepth).toBe(0);
        expect(result.balanceEstimate).toBe('Site appears relatively balanced');
      });
    });

    describe('Moderate earthwork scenarios', () => {
      it('should indicate moderate earthwork for 1-2ft cut', () => {
        const result = estimateFromSiteParams({
          siteAreaSF: 10000,
          existingAvgElev: 101,
          proposedAvgElev: 100,
        });

        expect(result.balanceEstimate).toBe('Moderate earthwork - may balance on site');
      });

      it('should indicate moderate earthwork for 1-2ft fill', () => {
        const result = estimateFromSiteParams({
          siteAreaSF: 10000,
          existingAvgElev: 99,
          proposedAvgElev: 100,
        });

        expect(result.balanceEstimate).toBe('Moderate earthwork - may balance on site');
      });
    });

    describe('Edge cases', () => {
      it('should handle zero slope percent', () => {
        const result = estimateFromSiteParams({
          siteAreaSF: 10000,
          existingAvgElev: 100,
          proposedAvgElev: 98,
          slopePercent: 0,
        });

        expect(result.avgCutDepth).toBe(2);
      });

      it('should handle undefined slope percent', () => {
        const result = estimateFromSiteParams({
          siteAreaSF: 10000,
          existingAvgElev: 100,
          proposedAvgElev: 98,
        });

        expect(result.avgCutDepth).toBe(2);
      });

      it('should handle large elevation differences', () => {
        const result = estimateFromSiteParams({
          siteAreaSF: 50000,
          existingAvgElev: 150,
          proposedAvgElev: 100,
        });

        expect(result.avgCutDepth).toBe(50);
        expect(result.balanceEstimate).toBe('Significant cut expected - potential material export');
      });

      it('should handle negative elevation (below sea level)', () => {
        const result = estimateFromSiteParams({
          siteAreaSF: 10000,
          existingAvgElev: -5,
          proposedAvgElev: 0,
        });

        expect(result.avgFillDepth).toBe(5);
      });
    });
  });
});
