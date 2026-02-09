import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock autodesk-auth before importing the module
const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));
vi.mock('@/lib/autodesk-auth', () => ({
  getAccessToken: mocks.getAccessToken,
}));

import {
  REVIT_CATEGORIES,
  getModelMetadata,
  getObjectTree,
  getAllProperties,
  categorizeElement,
  extractBIMData,
  type ModelMetadata,
  type ElementProperty,
  type BIMExtractionResult,
} from '@/lib/bim-metadata-extractor';

describe('BIM Metadata Extractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAccessToken.mockResolvedValue('mock-access-token');
  });

  describe('REVIT_CATEGORIES', () => {
    it('should contain structural categories', () => {
      expect(REVIT_CATEGORIES['Revit Walls']).toEqual({
        category: 'structural',
        subcategory: 'walls',
      });
      expect(REVIT_CATEGORIES['Revit Floors']).toEqual({
        category: 'structural',
        subcategory: 'floors',
      });
      expect(REVIT_CATEGORIES['Revit Structural Columns']).toEqual({
        category: 'structural',
        subcategory: 'columns',
      });
    });

    it('should contain MEP mechanical categories', () => {
      expect(REVIT_CATEGORIES['Revit Mechanical Equipment']).toEqual({
        category: 'mep',
        subcategory: 'mechanical_equipment',
      });
      expect(REVIT_CATEGORIES['Revit Ducts']).toEqual({
        category: 'mep',
        subcategory: 'ductwork',
      });
    });

    it('should contain MEP electrical categories', () => {
      expect(REVIT_CATEGORIES['Revit Electrical Equipment']).toEqual({
        category: 'mep',
        subcategory: 'electrical_equipment',
      });
      expect(REVIT_CATEGORIES['Revit Lighting Fixtures']).toEqual({
        category: 'mep',
        subcategory: 'lighting',
      });
    });

    it('should contain MEP plumbing categories', () => {
      expect(REVIT_CATEGORIES['Revit Plumbing Fixtures']).toEqual({
        category: 'mep',
        subcategory: 'plumbing_fixtures',
      });
      expect(REVIT_CATEGORIES['Revit Pipes']).toEqual({
        category: 'mep',
        subcategory: 'piping',
      });
    });

    it('should contain architectural categories', () => {
      expect(REVIT_CATEGORIES['Revit Doors']).toEqual({
        category: 'architectural',
        subcategory: 'doors',
      });
      expect(REVIT_CATEGORIES['Revit Windows']).toEqual({
        category: 'architectural',
        subcategory: 'windows',
      });
      expect(REVIT_CATEGORIES['Revit Furniture']).toEqual({
        category: 'architectural',
        subcategory: 'furniture',
      });
    });

    it('should contain site categories', () => {
      expect(REVIT_CATEGORIES['Revit Topography']).toEqual({
        category: 'site',
        subcategory: 'topography',
      });
      expect(REVIT_CATEGORIES['Revit Planting']).toEqual({
        category: 'site',
        subcategory: 'landscaping',
      });
    });
  });

  describe('getModelMetadata', () => {
    it('should fetch model metadata successfully', async () => {
      const mockMetadata: ModelMetadata[] = [
        { guid: 'guid-1', name: '3D View', role: '3d' },
        { guid: 'guid-2', name: 'Floor Plan', role: '2d', viewableId: 'view-1' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { metadata: mockMetadata } }),
      });

      const result = await getModelMetadata('test-urn');

      expect(mocks.getAccessToken).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://developer.api.autodesk.com/modelderivative/v2/designdata/test-urn/metadata',
        {
          headers: { Authorization: 'Bearer mock-access-token' },
        }
      );
      expect(result).toEqual(mockMetadata);
    });

    it('should return empty array if no metadata exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} }),
      });

      const result = await getModelMetadata('test-urn');

      expect(result).toEqual([]);
    });

    it('should throw error on failed fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(getModelMetadata('test-urn')).rejects.toThrow(
        'Failed to get metadata: 404'
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(getModelMetadata('test-urn')).rejects.toThrow('Network error');
    });
  });

  describe('getObjectTree', () => {
    it('should fetch object tree successfully', async () => {
      const mockTree = { objects: [{ objectid: 1, name: 'Root' }] };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTree,
      });

      const result = await getObjectTree('test-urn', 'test-guid');

      expect(mocks.getAccessToken).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://developer.api.autodesk.com/modelderivative/v2/designdata/test-urn/metadata/test-guid',
        {
          headers: { Authorization: 'Bearer mock-access-token' },
        }
      );
      expect(result).toEqual(mockTree);
    });

    it('should return null when still processing (202 status)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 202,
      });

      const result = await getObjectTree('test-urn', 'test-guid');

      expect(result).toBeNull();
    });

    it('should throw error on other failed status codes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(getObjectTree('test-urn', 'test-guid')).rejects.toThrow(
        'Failed to get object tree: 500'
      );
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection timeout'));

      await expect(getObjectTree('test-urn', 'test-guid')).rejects.toThrow(
        'Connection timeout'
      );
    });
  });

  describe('getAllProperties', () => {
    it('should fetch and parse all properties successfully', async () => {
      const mockResponse = {
        data: {
          collection: [
            {
              objectid: 123,
              externalId: 'ext-123',
              name: 'Wall-1',
              category: 'Revit Walls',
              properties: {
                Dimensions: {
                  Length: 10.5,
                  Height: 3.0,
                  Area: 31.5,
                },
                Identity: {
                  Material: 'Concrete',
                  Level: 'Level 1',
                },
              },
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getAllProperties('test-urn', 'test-guid');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://developer.api.autodesk.com/modelderivative/v2/designdata/test-urn/metadata/test-guid/properties?forceget=true',
        {
          headers: { Authorization: 'Bearer mock-access-token' },
        }
      );

      expect(result).toHaveLength(1);
      expect(result[0].dbId).toBe(123);
      expect(result[0].externalId).toBe('ext-123');
      expect(result[0].name).toBe('Wall-1');
      expect(result[0].category).toBe('Revit Walls');
      expect(result[0].properties.Length).toBe(10.5);
      expect(result[0].dimensions?.length).toBe(10.5);
      expect(result[0].dimensions?.height).toBe(3.0);
      expect(result[0].dimensions?.area).toBe(31.5);
      expect(result[0].material).toBe('Concrete');
      expect(result[0].level).toBe('Level 1');
    });

    it('should return empty array when properties still being generated (202)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 202,
      });

      const result = await getAllProperties('test-urn', 'test-guid');

      expect(result).toEqual([]);
    });

    it('should handle empty collection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { collection: [] } }),
      });

      const result = await getAllProperties('test-urn', 'test-guid');

      expect(result).toEqual([]);
    });

    it('should handle missing collection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} }),
      });

      const result = await getAllProperties('test-urn', 'test-guid');

      expect(result).toEqual([]);
    });

    it('should throw error on failed fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(getAllProperties('test-urn', 'test-guid')).rejects.toThrow(
        'Failed to get properties: 404'
      );
    });

    it('should parse elements without properties gracefully', async () => {
      const mockResponse = {
        data: {
          collection: [
            {
              objectid: 456,
              name: 'Element Without Props',
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getAllProperties('test-urn', 'test-guid');

      expect(result).toHaveLength(1);
      expect(result[0].dbId).toBe(456);
      expect(result[0].name).toBe('Element Without Props');
      expect(result[0].category).toBe('Unknown');
      expect(result[0].properties).toEqual({});
      expect(result[0].dimensions).toBeUndefined();
    });

    it('should extract category from __category__ group', async () => {
      const mockResponse = {
        data: {
          collection: [
            {
              objectid: 789,
              name: 'Door-1',
              properties: {
                __category__: {
                  Category: 'Revit Doors',
                },
              },
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getAllProperties('test-urn', 'test-guid');

      expect(result[0].category).toBe('Revit Doors');
    });

    it('should handle multiple dimension properties', async () => {
      const mockResponse = {
        data: {
          collection: [
            {
              objectid: 999,
              properties: {
                Dimensions: {
                  Width: 5.0,
                  'Structural Length': 12.5,
                  'Wall Height': 3.5,
                  'Floor Area': 62.5,
                  'Room Volume': 218.75,
                },
              },
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getAllProperties('test-urn', 'test-guid');

      expect(result[0].dimensions?.width).toBe(5.0);
      expect(result[0].dimensions?.length).toBe(12.5);
      expect(result[0].dimensions?.height).toBe(3.5);
      expect(result[0].dimensions?.area).toBe(62.5);
      expect(result[0].dimensions?.volume).toBe(218.75);
    });

    it('should filter out null, undefined, and empty values', async () => {
      const mockResponse = {
        data: {
          collection: [
            {
              objectid: 111,
              properties: {
                Test: {
                  ValidProp: 'value',
                  NullProp: null,
                  UndefinedProp: undefined,
                  EmptyProp: '',
                  ZeroValue: 0,
                  FalseBool: false,
                },
              },
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getAllProperties('test-urn', 'test-guid');

      expect(result[0].properties).toHaveProperty('ValidProp', 'value');
      expect(result[0].properties).toHaveProperty('ZeroValue', 0);
      expect(result[0].properties).toHaveProperty('FalseBool', false);
      expect(result[0].properties).not.toHaveProperty('NullProp');
      expect(result[0].properties).not.toHaveProperty('UndefinedProp');
      expect(result[0].properties).not.toHaveProperty('EmptyProp');
    });

    it('should extract material information from various property names', async () => {
      const mockResponse = {
        data: {
          collection: [
            {
              objectid: 1,
              properties: { Identity: { Material: 'Steel' } },
            },
            {
              objectid: 2,
              properties: { Identity: { material: 'Wood' } },
            },
            {
              objectid: 3,
              properties: { Identity: { 'Structural Material': 'Concrete' } },
            },
            {
              objectid: 4,
              properties: {
                Identity: {
                  Material: 'Aluminum',
                  'Material Quantity': 100,
                },
              },
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getAllProperties('test-urn', 'test-guid');

      expect(result[0].material).toBe('Steel');
      expect(result[1].material).toBe('Wood');
      expect(result[2].material).toBe('Concrete');
      expect(result[3].material).toBe('Aluminum');
      expect(result[3].materialQuantity).toBe(100);
    });

    it('should extract level and location information', async () => {
      const mockResponse = {
        data: {
          collection: [
            {
              objectid: 1,
              properties: {
                Constraints: {
                  Level: 'Level 2',
                  Location: 'Building A',
                },
              },
            },
            {
              objectid: 2,
              properties: {
                Constraints: {
                  'Reference Level': 'Ground Floor',
                  Room: 'Conference Room',
                },
              },
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getAllProperties('test-urn', 'test-guid');

      expect(result[0].level).toBe('Level 2');
      expect(result[0].location).toBe('Building A');
      expect(result[1].level).toBe('Ground Floor');
      expect(result[1].location).toBe('Conference Room');
    });
  });

  describe('categorizeElement', () => {
    describe('exact matches', () => {
      it('should categorize structural elements by exact match', () => {
        expect(categorizeElement('Revit Walls')).toEqual({
          category: 'structural',
          subcategory: 'walls',
        });
        expect(categorizeElement('Revit Structural Columns')).toEqual({
          category: 'structural',
          subcategory: 'columns',
        });
      });

      it('should categorize MEP elements by exact match', () => {
        expect(categorizeElement('Revit Ducts')).toEqual({
          category: 'mep',
          subcategory: 'ductwork',
        });
        expect(categorizeElement('Revit Pipes')).toEqual({
          category: 'mep',
          subcategory: 'piping',
        });
        expect(categorizeElement('Revit Lighting Fixtures')).toEqual({
          category: 'mep',
          subcategory: 'lighting',
        });
      });

      it('should categorize architectural elements by exact match', () => {
        expect(categorizeElement('Revit Doors')).toEqual({
          category: 'architectural',
          subcategory: 'doors',
        });
        expect(categorizeElement('Revit Windows')).toEqual({
          category: 'architectural',
          subcategory: 'windows',
        });
      });

      it('should categorize site elements by exact match', () => {
        expect(categorizeElement('Revit Topography')).toEqual({
          category: 'site',
          subcategory: 'topography',
        });
      });
    });

    describe('partial matches', () => {
      it('should categorize MEP mechanical by partial match', () => {
        expect(categorizeElement('Custom Duct System')).toEqual({
          category: 'mep',
          subcategory: 'mechanical',
        });
        expect(categorizeElement('HVAC Unit')).toEqual({
          category: 'mep',
          subcategory: 'mechanical',
        });
        expect(categorizeElement('Air Handler')).toEqual({
          category: 'mep',
          subcategory: 'mechanical',
        });
      });

      it('should categorize MEP plumbing by partial match', () => {
        expect(categorizeElement('Custom Pipe')).toEqual({
          category: 'mep',
          subcategory: 'plumbing',
        });
        expect(categorizeElement('Plumbing System')).toEqual({
          category: 'mep',
          subcategory: 'plumbing',
        });
      });

      it('should categorize MEP electrical by partial match', () => {
        expect(categorizeElement('Electrical Panel')).toEqual({
          category: 'mep',
          subcategory: 'electrical',
        });
        expect(categorizeElement('Light Fixture')).toEqual({
          category: 'mep',
          subcategory: 'electrical',
        });
        expect(categorizeElement('Conduit Run')).toEqual({
          category: 'mep',
          subcategory: 'electrical',
        });
      });

      it('should categorize structural by partial match', () => {
        expect(categorizeElement('Custom Wall')).toEqual({
          category: 'structural',
          subcategory: 'general',
        });
        expect(categorizeElement('Floor Slab')).toEqual({
          category: 'structural',
          subcategory: 'general',
        });
        expect(categorizeElement('Steel Column')).toEqual({
          category: 'structural',
          subcategory: 'general',
        });
        expect(categorizeElement('Wood Beam')).toEqual({
          category: 'structural',
          subcategory: 'general',
        });
      });

      it('should categorize architectural openings by partial match', () => {
        expect(categorizeElement('Entry Door')).toEqual({
          category: 'architectural',
          subcategory: 'openings',
        });
        expect(categorizeElement('Window System')).toEqual({
          category: 'architectural',
          subcategory: 'openings',
        });
        // Note: "Curtain Wall" matches "wall" first, so it's structural
        // Use exact match "Revit Curtain Panels" for architectural curtain wall
        expect(categorizeElement('Curtain Panel')).toEqual({
          category: 'architectural',
          subcategory: 'openings',
        });
      });

      it('should categorize architectural furnishings by partial match', () => {
        expect(categorizeElement('Office Furniture')).toEqual({
          category: 'architectural',
          subcategory: 'furnishings',
        });
        expect(categorizeElement('Kitchen Casework')).toEqual({
          category: 'architectural',
          subcategory: 'furnishings',
        });
        expect(categorizeElement('Equipment Cabinet')).toEqual({
          category: 'architectural',
          subcategory: 'furnishings',
        });
      });

      it('should handle case insensitivity', () => {
        expect(categorizeElement('DUCT SYSTEM')).toEqual({
          category: 'mep',
          subcategory: 'mechanical',
        });
        expect(categorizeElement('WaLl PaNel')).toEqual({
          category: 'structural',
          subcategory: 'general',
        });
      });
    });

    describe('unknown categories', () => {
      it('should return other/unknown for unrecognized categories', () => {
        expect(categorizeElement('Random Element')).toEqual({
          category: 'other',
          subcategory: 'unknown',
        });
        expect(categorizeElement('Unknown Category')).toEqual({
          category: 'other',
          subcategory: 'unknown',
        });
        expect(categorizeElement('')).toEqual({
          category: 'other',
          subcategory: 'unknown',
        });
      });
    });
  });

  describe('extractBIMData', () => {
    it('should extract complete BIM data from a model', async () => {
      // Mock getModelMetadata
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            metadata: [
              { guid: '3d-guid', name: '3D View', role: '3d' },
              { guid: '2d-guid', name: 'Floor Plan', role: '2d' },
              { guid: 'other-guid', name: 'Section', role: 'section' },
            ],
          },
        }),
      });

      // Mock getAllProperties for 3D view
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            collection: [
              {
                objectid: 1,
                name: 'Wall-1',
                category: 'Revit Walls',
                properties: {
                  Dimensions: { Length: 10, Height: 3 },
                },
              },
              {
                objectid: 2,
                name: 'Door-1',
                category: 'Revit Doors',
              },
            ],
          },
        }),
      });

      // Mock getAllProperties for 2D view (should skip duplicate dbId=1)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            collection: [
              {
                objectid: 1,
                name: 'Wall-1',
                category: 'Revit Walls',
              },
              {
                objectid: 3,
                name: 'Window-1',
                category: 'Revit Windows',
              },
            ],
          },
        }),
      });

      const result = await extractBIMData('test-urn');

      expect(result.modelUrn).toBe('test-urn');
      expect(result.viewableGuids).toEqual(['3d-guid', '2d-guid']);
      expect(result.totalElements).toBe(3); // Wall, Door, Window (no duplicate Wall)
      expect(result.elements).toHaveLength(3);

      // Check category counts
      expect(result.categories['Revit Walls']).toBe(1);
      expect(result.categories['Revit Doors']).toBe(1);
      expect(result.categories['Revit Windows']).toBe(1);

      // Check summary
      expect(result.summary.structural).toBe(1); // Wall
      expect(result.summary.architectural).toBe(2); // Door + Window
      expect(result.summary.mep).toBe(0);
      expect(result.summary.site).toBe(0);
      expect(result.summary.other).toBe(0);

      expect(result.extractedAt).toBeDefined();
      expect(new Date(result.extractedAt)).toBeInstanceOf(Date);
    });

    it('should skip non-3d and non-2d views', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            metadata: [
              { guid: 'section-guid', name: 'Section', role: 'section' },
              { guid: 'elevation-guid', name: 'Elevation', role: 'elevation' },
            ],
          },
        }),
      });

      const result = await extractBIMData('test-urn');

      expect(result.viewableGuids).toEqual([]);
      expect(result.totalElements).toBe(0);
      expect(result.elements).toEqual([]);
    });

    it('should handle models with no metadata', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { metadata: [] } }),
      });

      const result = await extractBIMData('test-urn');

      expect(result.viewableGuids).toEqual([]);
      expect(result.totalElements).toBe(0);
      expect(result.summary).toEqual({
        structural: 0,
        mep: 0,
        architectural: 0,
        site: 0,
        other: 0,
      });
    });

    it('should continue processing if one view fails', async () => {

      // Mock getModelMetadata
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            metadata: [
              { guid: 'good-guid', name: '3D View', role: '3d' },
              { guid: 'bad-guid', name: 'Failed View', role: '3d' },
            ],
          },
        }),
      });

      // First view succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            collection: [
              {
                objectid: 1,
                name: 'Wall-1',
                category: 'Revit Walls',
              },
            ],
          },
        }),
      });

      // Second view fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await extractBIMData('test-urn');

      expect(result.totalElements).toBe(1);
      expect(result.viewableGuids).toEqual(['good-guid', 'bad-guid']);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should deduplicate elements across multiple views', async () => {
      // Mock getModelMetadata
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            metadata: [
              { guid: 'view-1', name: 'View 1', role: '3d' },
              { guid: 'view-2', name: 'View 2', role: '3d' },
            ],
          },
        }),
      });

      // Both views return the same element
      const sameElement = {
        objectid: 100,
        name: 'Shared Wall',
        category: 'Revit Walls',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { collection: [sameElement] },
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { collection: [sameElement] },
        }),
      });

      const result = await extractBIMData('test-urn');

      expect(result.totalElements).toBe(1);
      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].dbId).toBe(100);
    });

    it('should calculate correct summary for mixed element types', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            metadata: [{ guid: 'view-1', name: '3D', role: '3d' }],
          },
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            collection: [
              { objectid: 1, category: 'Revit Walls' }, // structural
              { objectid: 2, category: 'Revit Floors' }, // structural
              { objectid: 3, category: 'Revit Ducts' }, // mep
              { objectid: 4, category: 'Revit Pipes' }, // mep
              { objectid: 5, category: 'Revit Lighting Fixtures' }, // mep
              { objectid: 6, category: 'Revit Doors' }, // architectural
              { objectid: 7, category: 'Revit Windows' }, // architectural
              { objectid: 8, category: 'Revit Topography' }, // site
              { objectid: 9, category: 'Unknown Element' }, // other
            ],
          },
        }),
      });

      const result = await extractBIMData('test-urn');

      expect(result.summary).toEqual({
        structural: 2,
        mep: 3,
        architectural: 2,
        site: 1,
        other: 1,
      });
    });

    it('should handle empty views', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            metadata: [{ guid: 'empty-guid', name: 'Empty View', role: '3d' }],
          },
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { collection: [] },
        }),
      });

      const result = await extractBIMData('test-urn');

      expect(result.totalElements).toBe(0);
      expect(result.elements).toEqual([]);
    });

    it('should log extraction progress', async () => {

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            metadata: [{ guid: 'test-guid', name: 'Test View', role: '3d' }],
          },
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            collection: [{ objectid: 1, category: 'Test' }],
          },
        }),
      });

      await extractBIMData('test-urn');

      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should handle API authentication errors', async () => {
      mocks.getAccessToken.mockRejectedValueOnce(
        new Error('Autodesk credentials not configured')
      );

      await expect(extractBIMData('test-urn')).rejects.toThrow(
        'Autodesk credentials not configured'
      );
    });

    it('should count categories correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            metadata: [{ guid: 'view-1', name: 'View', role: '3d' }],
          },
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            collection: [
              { objectid: 1, category: 'Revit Walls' },
              { objectid: 2, category: 'Revit Walls' },
              { objectid: 3, category: 'Revit Walls' },
              { objectid: 4, category: 'Revit Doors' },
              { objectid: 5, category: 'Revit Doors' },
              { objectid: 6, category: 'Revit Ducts' },
            ],
          },
        }),
      });

      const result = await extractBIMData('test-urn');

      expect(result.categories).toEqual({
        'Revit Walls': 3,
        'Revit Doors': 2,
        'Revit Ducts': 1,
      });
    });
  });
});
