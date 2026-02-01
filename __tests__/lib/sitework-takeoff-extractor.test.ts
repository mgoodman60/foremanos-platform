import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================================
// HOISTED MOCKS
// ============================================================================

const mockPrisma = vi.hoisted(() => ({
  document: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  documentChunk: {
    findMany: vi.fn(),
  },
  autodeskModel: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
}));

const mockCallAbacusLLM = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/abacus-llm', () => ({ callAbacusLLM: mockCallAbacusLLM }));

// ============================================================================
// TESTS - UNIT NORMALIZATION
// ============================================================================

describe('normalizeUnit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should normalize area units', async () => {
    const { normalizeUnit } = await import('@/lib/sitework-takeoff-extractor');

    expect(normalizeUnit('square feet')).toBe('SF');
    expect(normalizeUnit('sq ft')).toBe('SF');
    expect(normalizeUnit('sqft')).toBe('SF');
    expect(normalizeUnit('square yards')).toBe('SY');
    expect(normalizeUnit('acres')).toBe('AC');
  });

  it('should normalize linear units', async () => {
    const { normalizeUnit } = await import('@/lib/sitework-takeoff-extractor');

    expect(normalizeUnit('linear feet')).toBe('LF');
    expect(normalizeUnit('lin ft')).toBe('LF');
    expect(normalizeUnit('feet')).toBe('LF');
  });

  it('should normalize volume units', async () => {
    const { normalizeUnit } = await import('@/lib/sitework-takeoff-extractor');

    expect(normalizeUnit('cubic yards')).toBe('CY');
    expect(normalizeUnit('cu yd')).toBe('CY');
    expect(normalizeUnit('cubic feet')).toBe('CF');
  });

  it('should normalize count units', async () => {
    const { normalizeUnit } = await import('@/lib/sitework-takeoff-extractor');

    expect(normalizeUnit('each')).toBe('EA');
    expect(normalizeUnit('ea')).toBe('EA');
    expect(normalizeUnit('qty')).toBe('EA');
  });

  it('should handle case insensitivity', async () => {
    const { normalizeUnit } = await import('@/lib/sitework-takeoff-extractor');

    expect(normalizeUnit('SQUARE FEET')).toBe('SF');
    expect(normalizeUnit('Linear Feet')).toBe('LF');
  });

  it('should return uppercase unit when no match found', async () => {
    const { normalizeUnit } = await import('@/lib/sitework-takeoff-extractor');

    expect(normalizeUnit('unknown')).toBe('UNKNOWN');
  });
});

describe('convertUnits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should convert SF to SY', async () => {
    const { convertUnits } = await import('@/lib/sitework-takeoff-extractor');

    const result = convertUnits(900, 'SF', 'SY');
    expect(result).toEqual({ quantity: 100, unit: 'SY' });
  });

  it('should convert SY to SF', async () => {
    const { convertUnits } = await import('@/lib/sitework-takeoff-extractor');

    const result = convertUnits(100, 'SY', 'SF');
    expect(result).toEqual({ quantity: 900, unit: 'SF' });
  });

  it('should convert SF to AC', async () => {
    const { convertUnits } = await import('@/lib/sitework-takeoff-extractor');

    const result = convertUnits(43560, 'SF', 'AC');
    expect(result).toEqual({ quantity: 1, unit: 'AC' });
  });

  it('should convert CF to CY', async () => {
    const { convertUnits } = await import('@/lib/sitework-takeoff-extractor');

    const result = convertUnits(27, 'CF', 'CY');
    expect(result).toEqual({ quantity: 1, unit: 'CY' });
  });

  it('should return same quantity when units match', async () => {
    const { convertUnits } = await import('@/lib/sitework-takeoff-extractor');

    const result = convertUnits(100, 'SF', 'SF');
    expect(result).toEqual({ quantity: 100, unit: 'SF' });
  });

  it('should return null for unsupported conversion', async () => {
    const { convertUnits } = await import('@/lib/sitework-takeoff-extractor');

    const result = convertUnits(100, 'SF', 'LF');
    expect(result).toBeNull();
  });

  it('should round to 2 decimal places', async () => {
    const { convertUnits } = await import('@/lib/sitework-takeoff-extractor');

    const result = convertUnits(100, 'SF', 'SY');
    expect(result?.quantity).toBe(11.11);
  });
});

describe('getStandardUnit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return CY for excavation items', async () => {
    const { getStandardUnit } = await import('@/lib/sitework-takeoff-extractor');

    expect(getStandardUnit('excavation-bulk')).toBe('CY');
    expect(getStandardUnit('import-fill')).toBe('CY');
    expect(getStandardUnit('excavation-backfill')).toBe('CY');
  });

  it('should return SF for grading items', async () => {
    const { getStandardUnit } = await import('@/lib/sitework-takeoff-extractor');

    expect(getStandardUnit('grading-fine')).toBe('SF');
    expect(getStandardUnit('compaction-90')).toBe('SF');
  });

  it('should return SF for paving items', async () => {
    const { getStandardUnit } = await import('@/lib/sitework-takeoff-extractor');

    expect(getStandardUnit('asphalt-paving-4in')).toBe('SF');
    expect(getStandardUnit('concrete-sidewalk-4in')).toBe('SF');
  });

  it('should return LF for linear items', async () => {
    const { getStandardUnit } = await import('@/lib/sitework-takeoff-extractor');

    expect(getStandardUnit('curb-gutter')).toBe('LF');
    expect(getStandardUnit('pavement-marking')).toBe('LF');
  });

  it('should return LF for pipe items', async () => {
    const { getStandardUnit } = await import('@/lib/sitework-takeoff-extractor');

    expect(getStandardUnit('storm-pipe-12')).toBe('LF');
    expect(getStandardUnit('sanitary-pipe-8')).toBe('LF');
    expect(getStandardUnit('water-main-6')).toBe('LF');
  });

  it('should return EA for structure items', async () => {
    const { getStandardUnit } = await import('@/lib/sitework-takeoff-extractor');

    expect(getStandardUnit('manhole-sanitary')).toBe('EA');
    expect(getStandardUnit('catch-basin')).toBe('EA');
    expect(getStandardUnit('fire-hydrant')).toBe('EA');
  });

  it('should default to EA for unknown items', async () => {
    const { getStandardUnit } = await import('@/lib/sitework-takeoff-extractor');

    expect(getStandardUnit('unknown-item')).toBe('EA');
  });
});

// ============================================================================
// TESTS - DRAWING TYPE CLASSIFICATION
// ============================================================================

describe('classifyDrawingType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should classify grading plans', async () => {
    const { classifyDrawingType } = await import('@/lib/sitework-takeoff-extractor');

    expect(classifyDrawingType('GR-1', '')).toBe('grading');
    expect(classifyDrawingType('GRAD-01', '')).toBe('grading');
    expect(classifyDrawingType('C1.0', 'grading plan')).toBe('grading');
  });

  it('should classify utility plans', async () => {
    const { classifyDrawingType } = await import('@/lib/sitework-takeoff-extractor');

    expect(classifyDrawingType('UT-1', '')).toBe('utility');
    expect(classifyDrawingType('UTIL-01', '')).toBe('utility');
    expect(classifyDrawingType('C2.0', 'utility plan')).toBe('utility');
    expect(classifyDrawingType('C3.0', 'storm plan')).toBe('utility');
  });

  it('should classify landscape plans', async () => {
    const { classifyDrawingType } = await import('@/lib/sitework-takeoff-extractor');

    expect(classifyDrawingType('L1', '')).toBe('landscape');
    expect(classifyDrawingType('LA-01', '')).toBe('landscape');
    expect(classifyDrawingType('LP-1', '')).toBe('landscape');
    expect(classifyDrawingType('C4.0', 'landscape plan')).toBe('landscape');
  });

  it('should classify paving plans', async () => {
    const { classifyDrawingType } = await import('@/lib/sitework-takeoff-extractor');

    expect(classifyDrawingType('PV-1', '')).toBe('paving');
    expect(classifyDrawingType('PAV-01', '')).toBe('paving');
    expect(classifyDrawingType('C5.0', 'paving plan')).toBe('paving');
  });

  it('should classify erosion control plans', async () => {
    const { classifyDrawingType } = await import('@/lib/sitework-takeoff-extractor');

    expect(classifyDrawingType('EC-1', '')).toBe('erosion_control');
    expect(classifyDrawingType('ESCP-01', '')).toBe('erosion_control');
    expect(classifyDrawingType('C6.0', 'erosion control plan')).toBe('erosion_control');
  });

  it('should classify stormwater plans', async () => {
    const { classifyDrawingType } = await import('@/lib/sitework-takeoff-extractor');

    expect(classifyDrawingType('SW-1', '')).toBe('stormwater');
    expect(classifyDrawingType('C7.0', 'detention basin')).toBe('stormwater');
    expect(classifyDrawingType('C8.0', 'stormwater management')).toBe('stormwater');
  });

  it('should classify civil general for C sheets', async () => {
    const { classifyDrawingType } = await import('@/lib/sitework-takeoff-extractor');

    expect(classifyDrawingType('C1', '')).toBe('civil_general');
    expect(classifyDrawingType('C-100', '')).toBe('civil_general');
  });

  it('should return unknown for unclassified sheets', async () => {
    const { classifyDrawingType } = await import('@/lib/sitework-takeoff-extractor');

    expect(classifyDrawingType('A1', '')).toBe('unknown');
    expect(classifyDrawingType('', '')).toBe('unknown');
  });
});

// ============================================================================
// TESTS - QUANTITY CALCULATIONS
// ============================================================================

describe('calculateCutFill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate fill volume when proposed is higher', async () => {
    const { calculateCutFill } = await import('@/lib/sitework-takeoff-extractor');

    const result = calculateCutFill(100, 102, 1000, 'SF');
    expect(result.itemKey).toBe('import-fill');
    expect(result.quantity).toBe(74.1); // 1000 SF * 2 ft / 27
    expect(result.unit).toBe('CY');
  });

  it('should calculate cut volume when existing is higher', async () => {
    const { calculateCutFill } = await import('@/lib/sitework-takeoff-extractor');

    const result = calculateCutFill(102, 100, 1000, 'SF');
    expect(result.itemKey).toBe('excavation-bulk');
    expect(result.quantity).toBe(74.1);
  });

  it('should convert SY to SF before calculating', async () => {
    const { calculateCutFill } = await import('@/lib/sitework-takeoff-extractor');

    const result = calculateCutFill(100, 101, 100, 'SY');
    expect(result.quantity).toBe(33.3); // 100 SY * 9 = 900 SF * 1 ft / 27
  });

  it('should convert AC to SF before calculating', async () => {
    const { calculateCutFill } = await import('@/lib/sitework-takeoff-extractor');

    const result = calculateCutFill(100, 101, 1, 'AC');
    expect(result.quantity).toBe(1613.3); // 1 AC * 43560 = 43560 SF * 1 ft / 27
  });

  it('should include source data in result', async () => {
    const { calculateCutFill } = await import('@/lib/sitework-takeoff-extractor');

    const result = calculateCutFill(100, 102, 1000, 'SF');
    expect(result.sourceData).toEqual({
      existingGrade: 100,
      proposedGrade: 102,
      areaSF: 1000,
      gradeDiff: 2,
    });
  });
});

describe('calculateTrenchVolume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate trench volume in CY', async () => {
    const { calculateTrenchVolume } = await import('@/lib/sitework-takeoff-extractor');

    const result = calculateTrenchVolume(100, 2, 4);
    expect(result.quantity).toBe(29.6); // 100 * 2 * 4 / 27
    expect(result.unit).toBe('CY');
    expect(result.itemKey).toBe('excavation-trench');
  });

  it('should include source data', async () => {
    const { calculateTrenchVolume } = await import('@/lib/sitework-takeoff-extractor');

    const result = calculateTrenchVolume(100, 2, 4);
    expect(result.sourceData).toEqual({
      lengthLF: 100,
      widthFT: 2,
      depthFT: 4,
    });
  });
});

describe('calculateAsphaltTonnage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate asphalt tonnage from area and thickness', async () => {
    const { calculateAsphaltTonnage } = await import('@/lib/sitework-takeoff-extractor');

    const result = calculateAsphaltTonnage(1000, 4);
    // 1000 SF * 4 in / 12 = 333.33 CF * 145 lbs/CF / 2000 = 24.17 tons
    expect(result.quantity).toBe(24.2);
    expect(result.unit).toBe('TON');
  });

  it('should handle different thicknesses', async () => {
    const { calculateAsphaltTonnage } = await import('@/lib/sitework-takeoff-extractor');

    const result2in = calculateAsphaltTonnage(1000, 2);
    const result6in = calculateAsphaltTonnage(1000, 6);

    expect(result6in.quantity).toBeGreaterThan(result2in.quantity);
  });

  it('should include source data with density', async () => {
    const { calculateAsphaltTonnage } = await import('@/lib/sitework-takeoff-extractor');

    const result = calculateAsphaltTonnage(1000, 4);
    expect(result.sourceData).toEqual({
      areaSF: 1000,
      thicknessInches: 4,
      densityLbsPerCF: 145,
    });
  });
});

describe('calculateAggregateVolume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate aggregate base volume', async () => {
    const { calculateAggregateVolume } = await import('@/lib/sitework-takeoff-extractor');

    const result = calculateAggregateVolume(1000, 6);
    // 1000 SF * 6 in / 12 = 500 CF / 27 = 18.52 CY
    expect(result.quantity).toBe(18.5);
    expect(result.unit).toBe('CY');
  });

  it('should include thickness in item key', async () => {
    const { calculateAggregateVolume } = await import('@/lib/sitework-takeoff-extractor');

    const result = calculateAggregateVolume(1000, 6);
    expect(result.itemKey).toBe('aggregate-base-6in');
  });
});

describe('calculatePipeBedding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate pipe bedding volume', async () => {
    const { calculatePipeBedding } = await import('@/lib/sitework-takeoff-extractor');

    const result = calculatePipeBedding(100, 12, 2, 4);
    expect(result.unit).toBe('CY');
    expect(result.itemKey).toBe('backfill-pipe-zone');
  });

  it('should account for pipe diameter in bedding depth', async () => {
    const { calculatePipeBedding } = await import('@/lib/sitework-takeoff-extractor');

    const result12in = calculatePipeBedding(100, 12, 2, 4);
    const result24in = calculatePipeBedding(100, 24, 2, 4);

    expect(result24in.quantity).toBeGreaterThan(result12in.quantity);
  });

  it('should include source data', async () => {
    const { calculatePipeBedding } = await import('@/lib/sitework-takeoff-extractor');

    const result = calculatePipeBedding(100, 12, 2, 4);
    expect(result.sourceData).toHaveProperty('pipeLengthLF', 100);
    expect(result.sourceData).toHaveProperty('pipeDiameterInches', 12);
  });
});

// ============================================================================
// TESTS - GEOTECH DATA EXTRACTION
// ============================================================================

describe('extractGeotechData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract bearing capacity', async () => {
    const { extractGeotechData } = await import('@/lib/sitework-takeoff-extractor');

    const content = 'Allowable bearing capacity: 2,500 PSF';
    const result = extractGeotechData(content);

    expect(result.soilBearingCapacity).toBe(2500);
  });

  it('should extract soil type', async () => {
    const { extractGeotechData } = await import('@/lib/sitework-takeoff-extractor');

    const content = 'Soil classification: CL - Lean Clay';
    const result = extractGeotechData(content);

    expect(result.soilType).toBe('CL');
  });

  it('should extract water table depth', async () => {
    const { extractGeotechData } = await import('@/lib/sitework-takeoff-extractor');

    const content = 'Water table encountered at 6.5 feet';
    const result = extractGeotechData(content);

    expect(result.waterTableDepth).toBe(6.5);
    expect(result.dewateringRequired).toBe(true); // < 8 feet
  });

  it('should not require dewatering for deep water table', async () => {
    const { extractGeotechData } = await import('@/lib/sitework-takeoff-extractor');

    const content = 'Groundwater at 15 feet';
    const result = extractGeotechData(content);

    expect(result.waterTableDepth).toBe(15);
    expect(result.dewateringRequired).toBe(false);
  });

  it('should extract frost depth', async () => {
    const { extractGeotechData } = await import('@/lib/sitework-takeoff-extractor');

    const content = 'Frost depth: 42 inches';
    const result = extractGeotechData(content);

    expect(result.frostDepth).toBe(42);
  });

  it('should extract compaction requirement', async () => {
    const { extractGeotechData } = await import('@/lib/sitework-takeoff-extractor');

    const content = 'Compact to 95% of maximum dry density';
    const result = extractGeotechData(content);

    expect(result.compactionRequirement).toBe(95);
  });

  it('should extract rock encounter data', async () => {
    const { extractGeotechData } = await import('@/lib/sitework-takeoff-extractor');

    const content = 'Rock encountered at 8.5 feet below surface';
    const result = extractGeotechData(content);

    expect(result.rockEncountered).toBe(true);
    expect(result.rockDepth).toBe(8.5);
  });

  it('should extract required subbase depth', async () => {
    const { extractGeotechData } = await import('@/lib/sitework-takeoff-extractor');

    const content = 'Subbase thickness: 8 inches';
    const result = extractGeotechData(content);

    expect(result.requiredSubbaseDepth).toBe(8);
  });

  it('should return empty object when no data found', async () => {
    const { extractGeotechData } = await import('@/lib/sitework-takeoff-extractor');

    const result = extractGeotechData('No relevant geotech data');
    expect(Object.keys(result).length).toBe(0);
  });
});

describe('adjustForGeotechConditions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add rock excavation when rock encountered', async () => {
    const { adjustForGeotechConditions } = await import('@/lib/sitework-takeoff-extractor');

    const items = [
      {
        itemName: 'Bulk Excavation',
        itemKey: 'excavation-bulk',
        quantity: 1000,
        unit: 'CY',
        division: 31,
        category: 'earthwork',
        description: 'Test',
        confidence: 80,
        source: 'test',
      },
    ];

    const geotech = { rockEncountered: true, rockDepth: 8 };
    const result = adjustForGeotechConditions(items, geotech);

    const rockItem = result.find(i => i.itemKey === 'excavation-rock-mechanical');
    expect(rockItem).toBeDefined();
    expect(rockItem?.quantity).toBe(200); // 20% of 1000
  });

  it('should add dewatering when water table is shallow', async () => {
    const { adjustForGeotechConditions } = await import('@/lib/sitework-takeoff-extractor');

    const items: any[] = [];
    const geotech = { dewateringRequired: true, waterTableDepth: 5 };
    const result = adjustForGeotechConditions(items, geotech);

    const dewaterItem = result.find(i => i.itemKey === 'temporary-dewatering');
    expect(dewaterItem).toBeDefined();
    expect(dewaterItem?.unit).toBe('LS');
  });

  it('should add aggregate base for paving items', async () => {
    const { adjustForGeotechConditions } = await import('@/lib/sitework-takeoff-extractor');

    const items = [
      {
        itemName: 'Asphalt Paving',
        itemKey: 'asphalt-paving-4in',
        quantity: 1000,
        unit: 'SF',
        division: 32,
        category: 'paving',
        description: 'Test',
        confidence: 80,
        source: 'test',
      },
    ];

    const geotech = { requiredSubbaseDepth: 6 };
    const result = adjustForGeotechConditions(items, geotech);

    const subbaseItem = result.find(i => i.itemKey === 'aggregate-base-6in');
    expect(subbaseItem).toBeDefined();
  });

  it('should not modify items when no geotech conditions', async () => {
    const { adjustForGeotechConditions } = await import('@/lib/sitework-takeoff-extractor');

    const items = [
      {
        itemName: 'Test Item',
        itemKey: 'test-item',
        quantity: 100,
        unit: 'EA',
        division: 31,
        category: 'earthwork',
        description: 'Test',
        confidence: 80,
        source: 'test',
      },
    ];

    const geotech = {};
    const result = adjustForGeotechConditions(items, geotech);

    expect(result.length).toBe(1);
  });
});

// ============================================================================
// TESTS - CAD LAYER PARSING
// ============================================================================

describe('parseCADLayerName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse grading layer names', async () => {
    const { parseCADLayerName } = await import('@/lib/sitework-takeoff-extractor');

    expect(parseCADLayerName('C-GRAD')).toEqual({
      division: 31,
      category: 'earthwork',
      itemKey: 'grading-fine',
    });
    expect(parseCADLayerName('C-TOPO')).toBeDefined();
  });

  it('should parse paving layer names', async () => {
    const { parseCADLayerName } = await import('@/lib/sitework-takeoff-extractor');

    expect(parseCADLayerName('C-PAVE')).toEqual({
      division: 32,
      category: 'paving',
      itemKey: 'asphalt-paving-4in',
    });
  });

  it('should parse utility layer names', async () => {
    const { parseCADLayerName } = await import('@/lib/sitework-takeoff-extractor');

    const storm = parseCADLayerName('C-STRM');
    expect(storm?.division).toBe(33);
    expect(storm?.category).toBe('utilities');

    const water = parseCADLayerName('C-WATR');
    expect(water?.itemKey).toBe('water-main-6');
  });

  it('should parse landscape layer names', async () => {
    const { parseCADLayerName } = await import('@/lib/sitework-takeoff-extractor');

    expect(parseCADLayerName('L-PLNT')).toEqual({
      division: 32,
      category: 'landscape',
      itemKey: 'tree-2in-cal',
    });
  });

  it('should handle case insensitivity', async () => {
    const { parseCADLayerName } = await import('@/lib/sitework-takeoff-extractor');

    const upper = parseCADLayerName('C-PAVE');
    const lower = parseCADLayerName('c-pave');
    expect(upper).toEqual(lower);
  });

  it('should use keyword fallback for partial matches', async () => {
    const { parseCADLayerName } = await import('@/lib/sitework-takeoff-extractor');

    expect(parseCADLayerName('GRADING-EXISTING')).toEqual({
      division: 31,
      category: 'earthwork',
      itemKey: 'grading-fine',
    });
  });

  it('should return null for unknown layers', async () => {
    const { parseCADLayerName } = await import('@/lib/sitework-takeoff-extractor');

    expect(parseCADLayerName('A-WALL')).toBeNull();
    expect(parseCADLayerName('UNKNOWN')).toBeNull();
  });
});

describe('convertCADToTakeoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should convert linear layer data', async () => {
    const { convertCADToTakeoff } = await import('@/lib/sitework-takeoff-extractor');

    const cadData = {
      layers: [
        {
          name: 'C-CURB',
          entityCount: 10,
          totalLength: 500,
          totalArea: undefined,
          entities: [],
        },
      ],
      blocks: [],
      units: 'feet',
      extents: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    };

    const results = convertCADToTakeoff(cadData);
    expect(results).toHaveLength(1);
    expect(results[0].quantity).toBe(500);
    expect(results[0].unit).toBe('LF');
  });

  it('should convert area layer data', async () => {
    const { convertCADToTakeoff } = await import('@/lib/sitework-takeoff-extractor');

    const cadData = {
      layers: [
        {
          name: 'C-PAVE',
          entityCount: 5,
          totalLength: undefined,
          totalArea: 10000,
          entities: [],
        },
      ],
      blocks: [],
      units: 'feet',
      extents: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    };

    const results = convertCADToTakeoff(cadData);
    expect(results).toHaveLength(1);
    expect(results[0].quantity).toBe(10000);
    expect(results[0].unit).toBe('SF');
  });

  it('should convert block counts', async () => {
    const { convertCADToTakeoff } = await import('@/lib/sitework-takeoff-extractor');

    const cadData = {
      layers: [],
      blocks: [
        { name: 'MH-STANDARD', count: 5 },
        { name: 'CB-TYPE-A', count: 8 },
      ],
      units: 'feet',
      extents: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    };

    const results = convertCADToTakeoff(cadData);
    expect(results).toHaveLength(2);

    const manholes = results.find(r => r.itemKey === 'manhole-sanitary');
    expect(manholes?.quantity).toBe(5);

    const catchBasins = results.find(r => r.itemKey === 'catch-basin');
    expect(catchBasins?.quantity).toBe(8);
  });

  it('should apply scale factor to linear measurements', async () => {
    const { convertCADToTakeoff } = await import('@/lib/sitework-takeoff-extractor');

    const cadData = {
      layers: [
        {
          name: 'C-CURB',
          entityCount: 1,
          totalLength: 100,
          entities: [],
        },
      ],
      blocks: [],
      units: 'feet',
      extents: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    };

    const results = convertCADToTakeoff(cadData, 2);
    expect(results[0].quantity).toBe(200); // 100 * 2
  });

  it('should apply scale factor squared to area measurements', async () => {
    const { convertCADToTakeoff } = await import('@/lib/sitework-takeoff-extractor');

    const cadData = {
      layers: [
        {
          name: 'C-PAVE',
          entityCount: 1,
          totalArea: 100,
          entities: [],
        },
      ],
      blocks: [],
      units: 'feet',
      extents: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    };

    const results = convertCADToTakeoff(cadData, 2);
    expect(results[0].quantity).toBe(400); // 100 * 2^2
  });

  it('should skip layers with zero quantity', async () => {
    const { convertCADToTakeoff } = await import('@/lib/sitework-takeoff-extractor');

    const cadData = {
      layers: [
        {
          name: 'C-PAVE',
          entityCount: 0,
          entities: [],
        },
      ],
      blocks: [],
      units: 'feet',
      extents: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    };

    const results = convertCADToTakeoff(cadData);
    expect(results).toHaveLength(0);
  });
});

// ============================================================================
// TESTS - MAIN EXTRACTION FUNCTIONS
// ============================================================================

describe('extractFromDWG', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array when document not found', async () => {
    const { extractFromDWG } = await import('@/lib/sitework-takeoff-extractor');
    mockPrisma.document.findUnique.mockResolvedValue(null);

    const results = await extractFromDWG('doc-1', 'project-1');
    expect(results).toEqual([]);
  });

  it('should extract from CAD metadata in chunks', async () => {
    const { extractFromDWG } = await import('@/lib/sitework-takeoff-extractor');

    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Site Plan.dwg',
    });

    mockPrisma.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        metadata: {
          cadData: {
            layers: [
              { name: 'C-PAVE', totalArea: 5000, entityCount: 1, entities: [] },
            ],
            blocks: [],
            units: 'feet',
            extents: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
          },
        },
      },
    ]);

    const results = await extractFromDWG('doc-1', 'project-1');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should extract from Autodesk model metadata', async () => {
    const { extractFromDWG } = await import('@/lib/sitework-takeoff-extractor');

    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Site Plan.dwg',
    });

    mockPrisma.documentChunk.findMany.mockResolvedValue([]);

    mockPrisma.autodeskModel.findFirst.mockResolvedValue({
      id: 'model-1',
      fileName: 'Site Plan.dwg',
      extractedMetadata: {
        layers: [
          { name: 'C-STRM', totalLength: 500, entityCount: 1, entities: [] },
        ],
        blocks: [{ name: 'MH-STD', count: 3 }],
        units: 'feet',
        extents: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      },
    });

    const results = await extractFromDWG('doc-1', 'project-1');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should handle errors gracefully', async () => {
    const { extractFromDWG } = await import('@/lib/sitework-takeoff-extractor');
    mockPrisma.document.findUnique.mockRejectedValue(new Error('DB error'));

    const results = await extractFromDWG('doc-1', 'project-1');
    expect(results).toEqual([]);
  });
});

describe('extractSiteworkTakeoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw error when document not found', async () => {
    const { extractSiteworkTakeoff } = await import('@/lib/sitework-takeoff-extractor');
    mockPrisma.document.findUnique.mockResolvedValue(null);

    await expect(extractSiteworkTakeoff('doc-1', 'project-1')).rejects.toThrow(
      'Document not found'
    );
  });

  it('should process all document chunks', async () => {
    const { extractSiteworkTakeoff } = await import('@/lib/sitework-takeoff-extractor');

    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Civil Plans.pdf',
    });

    mockPrisma.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        pageNumber: 1,
        content: 'silt fence: 500 LF',
        metadata: { sheet_number: 'C1.0' },
      },
      {
        id: 'chunk-2',
        pageNumber: 2,
        content: 'asphalt paving: 10000 SF',
        metadata: { sheet_number: 'C2.0' },
      },
    ]);

    const results = await extractSiteworkTakeoff('doc-1', 'project-1');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should include CAD extraction when option enabled', async () => {
    const { extractSiteworkTakeoff } = await import('@/lib/sitework-takeoff-extractor');

    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Site.dwg',
    });

    mockPrisma.documentChunk.findMany.mockResolvedValue([]);

    mockPrisma.autodeskModel.findFirst.mockResolvedValue({
      extractedMetadata: {
        layers: [{ name: 'C-GRAD', entityCount: 10, entities: [] }],
        blocks: [],
        units: 'feet',
        extents: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      },
    });

    const results = await extractSiteworkTakeoff('doc-1', 'project-1', {
      includeCAD: true,
    });

    expect(results.length).toBeGreaterThan(0);
  });

  it('should apply geotech adjustments when enabled', async () => {
    const { extractSiteworkTakeoff } = await import('@/lib/sitework-takeoff-extractor');

    mockPrisma.document.findUnique.mockResolvedValueOnce({
      id: 'doc-1',
      name: 'Civil.pdf',
    });

    mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
      {
        id: 'chunk-1',
        pageNumber: 1,
        content: 'excavation: 1000 CY',
        metadata: {},
      },
    ]);

    // Mock geotech document
    mockPrisma.document.findUnique.mockResolvedValueOnce({
      id: 'geotech-1',
      name: 'Geotech Report.pdf',
    });

    mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
      {
        id: 'geo-chunk-1',
        content: 'Rock encountered at 8 feet. Water table at 5 feet.',
      },
    ]);

    const results = await extractSiteworkTakeoff('doc-1', 'project-1', {
      includeGeotech: true,
      geotechDocumentId: 'geotech-1',
    });

    // Should include rock excavation and dewatering
    const hasRock = results.some(r => r.itemKey.includes('rock'));
    const hasDewater = results.some(r => r.itemKey.includes('dewatering'));

    expect(hasRock || hasDewater).toBe(true);
  });

  it('should consolidate duplicate items', async () => {
    const { extractSiteworkTakeoff } = await import('@/lib/sitework-takeoff-extractor');

    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Civil.pdf',
    });

    mockPrisma.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        pageNumber: 1,
        content: 'silt fence: 300 LF',
        metadata: {},
      },
      {
        id: 'chunk-2',
        pageNumber: 2,
        content: 'silt fence: 200 LF',
        metadata: {},
      },
    ]);

    const results = await extractSiteworkTakeoff('doc-1', 'project-1');

    const siltFenceItems = results.filter(r => r.itemKey === 'silt-fence');
    expect(siltFenceItems.length).toBe(1);
    expect(siltFenceItems[0].quantity).toBe(500); // Consolidated
  });

  it('should handle extraction errors gracefully', async () => {
    const { extractSiteworkTakeoff } = await import('@/lib/sitework-takeoff-extractor');

    mockPrisma.document.findUnique.mockRejectedValue(new Error('Database error'));

    await expect(extractSiteworkTakeoff('doc-1', 'project-1')).rejects.toThrow();
  });
});

describe('extractSiteworkFromProjectModels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should find and process DWG models', async () => {
    const { extractSiteworkFromProjectModels } = await import(
      '@/lib/sitework-takeoff-extractor'
    );

    mockPrisma.autodeskModel.findMany.mockResolvedValue([
      {
        id: 'model-1',
        fileName: 'grading-plan.dwg',
        status: 'ready',
        extractedMetadata: {
          layers: [
            { name: 'C-GRAD', objectCount: 25 },
            { name: 'C-STRM', objectCount: 15 },
          ],
          blocks: [
            { name: 'MH-STD', instanceCount: 3 },
            { name: 'TREE-DEC', instanceCount: 12 },
          ],
        },
      },
    ]);

    const results = await extractSiteworkFromProjectModels('project-1');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should skip non-sitework files', async () => {
    const { extractSiteworkFromProjectModels } = await import(
      '@/lib/sitework-takeoff-extractor'
    );

    mockPrisma.autodeskModel.findMany.mockResolvedValue([
      {
        id: 'model-1',
        fileName: 'architectural-plan.dwg',
        status: 'ready',
        extractedMetadata: {
          layers: [{ name: 'A-WALL', objectCount: 50 }],
          blocks: [],
        },
      },
    ]);

    const results = await extractSiteworkFromProjectModels('project-1');
    expect(results).toHaveLength(0);
  });

  it('should process layer-based extractions', async () => {
    const { extractSiteworkFromProjectModels } = await import(
      '@/lib/sitework-takeoff-extractor'
    );

    mockPrisma.autodeskModel.findMany.mockResolvedValue([
      {
        id: 'model-1',
        fileName: 'site-civil.dwg',
        status: 'ready',
        extractedMetadata: {
          layers: [
            { name: 'C-PAVE-ASPH', objectCount: 10 },
            { name: 'C-CURB', objectCount: 5 },
          ],
          blocks: [],
        },
      },
    ]);

    const results = await extractSiteworkFromProjectModels('project-1');

    const pavingItem = results.find(r => r.category === 'paving');
    expect(pavingItem).toBeDefined();
  });

  it('should process block-based extractions', async () => {
    const { extractSiteworkFromProjectModels } = await import(
      '@/lib/sitework-takeoff-extractor'
    );

    mockPrisma.autodeskModel.findMany.mockResolvedValue([
      {
        id: 'model-1',
        fileName: 'utility-plan.dwg',
        status: 'ready',
        extractedMetadata: {
          layers: [],
          blocks: [
            { name: 'MH-STANDARD', instanceCount: 5 },
            { name: 'CB-TYPE-A', instanceCount: 8 },
            { name: 'FH-STD', instanceCount: 2 },
          ],
        },
      },
    ]);

    const results = await extractSiteworkFromProjectModels('project-1');
    expect(results.length).toBe(3);

    const manholes = results.find(r => r.itemKey.includes('manhole'));
    expect(manholes?.quantity).toBe(5);
  });

  it('should consolidate results', async () => {
    const { extractSiteworkFromProjectModels } = await import(
      '@/lib/sitework-takeoff-extractor'
    );

    mockPrisma.autodeskModel.findMany.mockResolvedValue([
      {
        id: 'model-1',
        fileName: 'site-1.dwg',
        status: 'ready',
        extractedMetadata: {
          layers: [],
          blocks: [{ name: 'TREE-OAK', instanceCount: 5 }],
        },
      },
      {
        id: 'model-2',
        fileName: 'site-2.dwg',
        status: 'ready',
        extractedMetadata: {
          layers: [],
          blocks: [{ name: 'TREE-MAPLE', instanceCount: 3 }],
        },
      },
    ]);

    const results = await extractSiteworkFromProjectModels('project-1');

    const trees = results.filter(r => r.category === 'landscape');
    expect(trees.length).toBe(1); // Consolidated
    expect(trees[0].quantity).toBe(8); // 5 + 3
  });

  it('should handle errors gracefully', async () => {
    const { extractSiteworkFromProjectModels } = await import(
      '@/lib/sitework-takeoff-extractor'
    );

    mockPrisma.autodeskModel.findMany.mockRejectedValue(new Error('DB error'));

    const results = await extractSiteworkFromProjectModels('project-1');
    expect(results).toEqual([]);
  });
});

// ============================================================================
// TESTS - PATTERN EXPORTS
// ============================================================================

describe('Pattern Exports', () => {
  it('should export EARTHWORK_PATTERNS', async () => {
    const { EARTHWORK_PATTERNS } = await import('@/lib/sitework-takeoff-extractor');

    expect(EARTHWORK_PATTERNS).toBeDefined();
    expect(Array.isArray(EARTHWORK_PATTERNS)).toBe(true);
    expect(EARTHWORK_PATTERNS.length).toBeGreaterThan(0);
  });

  it('should export PAVING_PATTERNS', async () => {
    const { PAVING_PATTERNS } = await import('@/lib/sitework-takeoff-extractor');

    expect(PAVING_PATTERNS).toBeDefined();
    expect(Array.isArray(PAVING_PATTERNS)).toBe(true);
    expect(PAVING_PATTERNS.length).toBeGreaterThan(0);
  });

  it('should export UTILITY_PATTERNS', async () => {
    const { UTILITY_PATTERNS } = await import('@/lib/sitework-takeoff-extractor');

    expect(UTILITY_PATTERNS).toBeDefined();
    expect(Array.isArray(UTILITY_PATTERNS)).toBe(true);
    expect(UTILITY_PATTERNS.length).toBeGreaterThan(0);
  });

  it('should export ALL_SITEWORK_PATTERNS', async () => {
    const { ALL_SITEWORK_PATTERNS, EARTHWORK_PATTERNS, PAVING_PATTERNS, UTILITY_PATTERNS } =
      await import('@/lib/sitework-takeoff-extractor');

    expect(ALL_SITEWORK_PATTERNS.length).toBe(
      EARTHWORK_PATTERNS.length + PAVING_PATTERNS.length + UTILITY_PATTERNS.length
    );
  });

  it('should export SITEWORK_UNIT_CONVERSIONS', async () => {
    const { SITEWORK_UNIT_CONVERSIONS } = await import('@/lib/sitework-takeoff-extractor');

    expect(SITEWORK_UNIT_CONVERSIONS).toBeDefined();
    expect(Array.isArray(SITEWORK_UNIT_CONVERSIONS)).toBe(true);
    expect(SITEWORK_UNIT_CONVERSIONS.length).toBeGreaterThan(0);
  });

  it('should export CAD_LAYER_PATTERNS', async () => {
    const { CAD_LAYER_PATTERNS } = await import('@/lib/sitework-takeoff-extractor');

    expect(CAD_LAYER_PATTERNS).toBeDefined();
    expect(typeof CAD_LAYER_PATTERNS).toBe('object');
  });
});
