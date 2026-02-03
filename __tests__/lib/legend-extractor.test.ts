import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DisciplineCode } from '@/lib/title-block-extractor';
import { SymbolCategory } from '@/lib/legend-extractor';

// ============================================================================
// MOCKS
// ============================================================================

// Mock fetch for Vision API calls
const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal('fetch', mockFetch);

// Mock Prisma
const prismaMock = vi.hoisted(() => ({
  sheetLegend: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

// Mock title-block-extractor
vi.mock('@/lib/title-block-extractor', async () => {
  const actual = await vi.importActual('@/lib/title-block-extractor');
  return {
    ...actual,
    getDisciplineName: vi.fn((code: string) => {
      const names: Record<string, string> = {
        'A': 'Architectural',
        'E': 'Electrical',
        'M': 'Mechanical',
        'P': 'Plumbing',
        'FP': 'Fire Protection',
        'S': 'Structural',
        'C': 'Civil',
        'L': 'Landscape',
        'G': 'General',
        'UNKNOWN': 'Unknown',
      };
      return names[code] || 'Unknown';
    }),
  };
});

// ============================================================================
// TEST DATA
// ============================================================================

const mockVisionResponse = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          found: true,
          boundingBox: { x: 85, y: 10, width: 12, height: 30 },
          confidence: 0.95,
        }),
      },
    },
  ],
};

const mockLegendExtractionResponse = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          entries: [
            {
              symbolCode: 'FA-PS',
              description: 'Fire Alarm Pull Station',
              confidence: 0.95,
            },
            {
              symbolCode: 'E-1',
              description: 'Electrical Panel 1',
              confidence: 0.90,
            },
            {
              symbolCode: 'WP',
              description: 'Water Pipe',
              confidence: 0.88,
            },
          ],
          boundingBox: { x: 85, y: 10, width: 12, height: 30 },
          confidence: 0.92,
        }),
      },
    },
  ],
};

const mockProject = {
  id: 'project-1',
  slug: 'test-project',
  name: 'Test Project',
  SheetLegend: [],
};

const mockSheetLegend = {
  id: 'legend-1',
  projectId: 'project-1',
  documentId: 'doc-1',
  sheetNumber: 'A1.1',
  legendEntries: [
    {
      id: 'A1.1-0',
      symbolCode: 'FA-PS',
      symbolDescription: 'Fire Alarm Pull Station',
      category: SymbolCategory.FIRE_PROTECTION,
      confidence: 0.95,
    },
  ],
  boundingBox: { x: 85, y: 10, width: 12, height: 30 },
  extractedAt: new Date(),
  confidence: 0.92,
  discipline: DisciplineCode.FIRE_PROTECTION,
};

// ============================================================================
// TESTS - detectLegendRegion
// ============================================================================

describe('detectLegendRegion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  it('should detect legend region successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(mockVisionResponse),
    });

    const { detectLegendRegion } = await import('@/lib/legend-extractor');
    const result = await detectLegendRegion('base64image', 'A1.1');

    expect(result.found).toBe(true);
    expect(result.boundingBox).toEqual({ x: 85, y: 10, width: 12, height: 30 });
    expect(result.confidence).toBe(0.95);
  });

  it('should call Vision API with correct parameters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(mockVisionResponse),
    });

    const { detectLegendRegion } = await import('@/lib/legend-extractor');
    await detectLegendRegion('base64image', 'A1.1');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
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

  it('should handle API error responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error',
    });

    const { detectLegendRegion } = await import('@/lib/legend-extractor');
    const result = await detectLegendRegion('base64image', 'A1.1');

    expect(result.found).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('should handle missing content in response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ choices: [] }),
    });

    const { detectLegendRegion } = await import('@/lib/legend-extractor');
    const result = await detectLegendRegion('base64image', 'A1.1');

    expect(result.found).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('should parse JSON from code blocks', async () => {
    const responseWithCodeBlock = {
      choices: [
        {
          message: {
            content: '```json\n{"found": true, "boundingBox": {"x": 10, "y": 20, "width": 30, "height": 40}, "confidence": 0.85}\n```',
          },
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(responseWithCodeBlock),
    });

    const { detectLegendRegion } = await import('@/lib/legend-extractor');
    const result = await detectLegendRegion('base64image', 'A1.1');

    expect(result.found).toBe(true);
    expect(result.boundingBox).toEqual({ x: 10, y: 20, width: 30, height: 40 });
    expect(result.confidence).toBe(0.85);
  });

  it('should parse raw JSON without code blocks', async () => {
    const responseWithRawJSON = {
      choices: [
        {
          message: {
            content: '{"found": false, "confidence": 0.1}',
          },
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(responseWithRawJSON),
    });

    const { detectLegendRegion } = await import('@/lib/legend-extractor');
    const result = await detectLegendRegion('base64image', 'A1.1');

    expect(result.found).toBe(false);
    expect(result.confidence).toBe(0.1);
  });

  it('should handle invalid JSON gracefully', async () => {
    const responseWithInvalidJSON = {
      choices: [
        {
          message: {
            content: 'This is not JSON',
          },
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(responseWithInvalidJSON),
    });

    const { detectLegendRegion } = await import('@/lib/legend-extractor');
    const result = await detectLegendRegion('base64image', 'A1.1');

    expect(result.found).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { detectLegendRegion } = await import('@/lib/legend-extractor');
    const result = await detectLegendRegion('base64image', 'A1.1');

    expect(result.found).toBe(false);
    expect(result.confidence).toBe(0);
  });
});

// ============================================================================
// TESTS - extractLegendEntries
// ============================================================================

describe('extractLegendEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  it('should extract legend entries successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(mockLegendExtractionResponse),
    });

    const { extractLegendEntries } = await import('@/lib/legend-extractor');
    const result = await extractLegendEntries('base64image', 'A1.1', DisciplineCode.FIRE_PROTECTION);

    expect(result.success).toBe(true);
    expect(result.legend?.legendEntries).toHaveLength(3);
    expect(result.legend?.sheetNumber).toBe('A1.1');
    expect(result.confidence).toBe(0.92);
    expect(result.method).toBe('vision');
  });

  it('should categorize entries based on discipline', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(mockLegendExtractionResponse),
    });

    const { extractLegendEntries } = await import('@/lib/legend-extractor');
    const result = await extractLegendEntries('base64image', 'A1.1', DisciplineCode.FIRE_PROTECTION);

    const entries = result.legend?.legendEntries || [];
    expect(entries[0].category).toBe('fire_protection');
    expect(entries[0].discipline).toBe(DisciplineCode.FIRE_PROTECTION);
  });

  it('should generate unique IDs for entries', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(mockLegendExtractionResponse),
    });

    const { extractLegendEntries } = await import('@/lib/legend-extractor');
    const result = await extractLegendEntries('base64image', 'A1.1');

    const entries = result.legend?.legendEntries || [];
    expect(entries[0].id).toBe('A1.1-0');
    expect(entries[1].id).toBe('A1.1-1');
    expect(entries[2].id).toBe('A1.1-2');
  });

  it('should handle API errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Unauthorized',
    });

    const { extractLegendEntries } = await import('@/lib/legend-extractor');
    const result = await extractLegendEntries('base64image', 'A1.1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Vision API error');
    expect(result.confidence).toBe(0);
  });

  it('should handle missing content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ choices: [] }),
    });

    const { extractLegendEntries } = await import('@/lib/legend-extractor');
    const result = await extractLegendEntries('base64image', 'A1.1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('No content in response');
  });

  it('should handle non-JSON responses', async () => {
    const responseWithText = {
      choices: [
        {
          message: {
            content: 'No legend found on this sheet',
          },
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(responseWithText),
    });

    const { extractLegendEntries } = await import('@/lib/legend-extractor');
    const result = await extractLegendEntries('base64image', 'A1.1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('No JSON found in response');
  });

  it('should use default confidence when not provided', async () => {
    const responseWithoutConfidence = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              entries: [
                {
                  symbolCode: 'TEST',
                  description: 'Test Symbol',
                },
              ],
            }),
          },
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(responseWithoutConfidence),
    });

    const { extractLegendEntries } = await import('@/lib/legend-extractor');
    const result = await extractLegendEntries('base64image', 'A1.1');

    expect(result.legend?.legendEntries[0].confidence).toBe(0.85);
    expect(result.legend?.confidence).toBe(0.8);
  });

  it('should handle exception during extraction', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

    const { extractLegendEntries } = await import('@/lib/legend-extractor');
    const result = await extractLegendEntries('base64image', 'A1.1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network timeout');
  });

  it('should include position data when provided', async () => {
    const responseWithPositions = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              entries: [
                {
                  symbolCode: 'TEST',
                  description: 'Test Symbol',
                  position: { x: 10, y: 20, width: 5, height: 5 },
                },
              ],
              confidence: 0.9,
            }),
          },
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(responseWithPositions),
    });

    const { extractLegendEntries } = await import('@/lib/legend-extractor');
    const result = await extractLegendEntries('base64image', 'A1.1');

    expect(result.legend?.legendEntries[0].position).toEqual({ x: 10, y: 20, width: 5, height: 5 });
  });
});

// ============================================================================
// TESTS - categorizeLegendEntry
// ============================================================================

describe('categorizeLegendEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should categorize based on discipline code - Electrical', async () => {
    const { categorizeLegendEntry, SymbolCategory } = await import('@/lib/legend-extractor');
    const result = categorizeLegendEntry('Generic description', DisciplineCode.ELECTRICAL);
    expect(result).toBe(SymbolCategory.ELECTRICAL);
  });

  it('should categorize based on discipline code - Mechanical', async () => {
    const { categorizeLegendEntry, SymbolCategory } = await import('@/lib/legend-extractor');
    const result = categorizeLegendEntry('Generic description', DisciplineCode.MECHANICAL);
    expect(result).toBe(SymbolCategory.MECHANICAL);
  });

  it('should categorize based on discipline code - Plumbing', async () => {
    const { categorizeLegendEntry, SymbolCategory } = await import('@/lib/legend-extractor');
    const result = categorizeLegendEntry('Generic description', DisciplineCode.PLUMBING);
    expect(result).toBe(SymbolCategory.PLUMBING);
  });

  it('should categorize based on discipline code - Fire Protection', async () => {
    const { categorizeLegendEntry, SymbolCategory } = await import('@/lib/legend-extractor');
    const result = categorizeLegendEntry('Generic description', DisciplineCode.FIRE_PROTECTION);
    expect(result).toBe(SymbolCategory.FIRE_PROTECTION);
  });

  it('should categorize based on discipline code - Structural', async () => {
    const { categorizeLegendEntry, SymbolCategory } = await import('@/lib/legend-extractor');
    const result = categorizeLegendEntry('Generic description', DisciplineCode.STRUCTURAL);
    expect(result).toBe(SymbolCategory.STRUCTURAL);
  });

  it('should categorize based on discipline code - Architectural', async () => {
    const { categorizeLegendEntry, SymbolCategory } = await import('@/lib/legend-extractor');
    const result = categorizeLegendEntry('Generic description', DisciplineCode.ARCHITECTURAL);
    expect(result).toBe(SymbolCategory.ARCHITECTURAL);
  });

  it('should categorize based on discipline code - Civil', async () => {
    const { categorizeLegendEntry, SymbolCategory } = await import('@/lib/legend-extractor');
    const result = categorizeLegendEntry('Generic description', DisciplineCode.CIVIL);
    expect(result).toBe(SymbolCategory.CIVIL);
  });

  it('should categorize electrical by keywords - outlet', async () => {
    const { categorizeLegendEntry, SymbolCategory } = await import('@/lib/legend-extractor');
    const result = categorizeLegendEntry('Wall outlet');
    expect(result).toBe(SymbolCategory.ELECTRICAL);
  });

  it('should categorize electrical by keywords - switch', async () => {
    const { categorizeLegendEntry, SymbolCategory } = await import('@/lib/legend-extractor');
    const result = categorizeLegendEntry('Light switch');
    expect(result).toBe(SymbolCategory.ELECTRICAL);
  });

  it('should categorize electrical by keywords - panel', async () => {
    const { categorizeLegendEntry, SymbolCategory } = await import('@/lib/legend-extractor');
    const result = categorizeLegendEntry('Electrical panel');
    expect(result).toBe(SymbolCategory.ELECTRICAL);
  });

  it('should categorize mechanical by keywords - duct', async () => {
    const { categorizeLegendEntry, SymbolCategory } = await import('@/lib/legend-extractor');
    const result = categorizeLegendEntry('Return air duct');
    expect(result).toBe(SymbolCategory.MECHANICAL);
  });

  it('should categorize mechanical by keywords - hvac', async () => {
    const { categorizeLegendEntry, SymbolCategory } = await import('@/lib/legend-extractor');
    const result = categorizeLegendEntry('HVAC system');
    expect(result).toBe(SymbolCategory.MECHANICAL);
  });

  it('should categorize plumbing by keywords - pipe', async () => {
    const { categorizeLegendEntry, SymbolCategory } = await import('@/lib/legend-extractor');
    const result = categorizeLegendEntry('Water pipe');
    expect(result).toBe(SymbolCategory.PLUMBING);
  });

  it('should categorize plumbing by keywords - valve', async () => {
    const { categorizeLegendEntry, SymbolCategory } = await import('@/lib/legend-extractor');
    const result = categorizeLegendEntry('Shutoff valve');
    expect(result).toBe(SymbolCategory.PLUMBING);
  });

  it('should categorize fire protection by keywords - alarm', async () => {
    const { categorizeLegendEntry, SymbolCategory } = await import('@/lib/legend-extractor');
    const result = categorizeLegendEntry('Fire alarm pull station');
    expect(result).toBe(SymbolCategory.FIRE_PROTECTION);
  });

  it('should categorize fire protection by keywords - sprinkler', async () => {
    const { categorizeLegendEntry, SymbolCategory } = await import('@/lib/legend-extractor');
    const result = categorizeLegendEntry('Sprinkler head');
    expect(result).toBe(SymbolCategory.FIRE_PROTECTION);
  });

  it('should categorize architectural by keywords - door', async () => {
    const { categorizeLegendEntry, SymbolCategory } = await import('@/lib/legend-extractor');
    const result = categorizeLegendEntry('Door type A');
    expect(result).toBe(SymbolCategory.ARCHITECTURAL);
  });

  it('should categorize architectural by keywords - window', async () => {
    const { categorizeLegendEntry, SymbolCategory } = await import('@/lib/legend-extractor');
    const result = categorizeLegendEntry('Fixed window');
    expect(result).toBe(SymbolCategory.ARCHITECTURAL);
  });

  it('should categorize structural by keywords - beam', async () => {
    const { categorizeLegendEntry, SymbolCategory } = await import('@/lib/legend-extractor');
    const result = categorizeLegendEntry('Steel beam');
    expect(result).toBe(SymbolCategory.STRUCTURAL);
  });

  it('should categorize structural by keywords - column', async () => {
    const { categorizeLegendEntry, SymbolCategory } = await import('@/lib/legend-extractor');
    const result = categorizeLegendEntry('Concrete column');
    expect(result).toBe(SymbolCategory.STRUCTURAL);
  });

  it('should return GENERAL for unknown symbols', async () => {
    const { categorizeLegendEntry, SymbolCategory } = await import('@/lib/legend-extractor');
    const result = categorizeLegendEntry('Unknown symbol');
    expect(result).toBe(SymbolCategory.GENERAL);
  });

  it('should be case-insensitive', async () => {
    const { categorizeLegendEntry, SymbolCategory } = await import('@/lib/legend-extractor');
    const result1 = categorizeLegendEntry('FIRE ALARM');
    const result2 = categorizeLegendEntry('fire alarm');
    const result3 = categorizeLegendEntry('Fire Alarm');
    expect(result1).toBe(SymbolCategory.FIRE_PROTECTION);
    expect(result2).toBe(SymbolCategory.FIRE_PROTECTION);
    expect(result3).toBe(SymbolCategory.FIRE_PROTECTION);
  });
});

// ============================================================================
// TESTS - storeLegend
// ============================================================================

describe('storeLegend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.sheetLegend.create.mockResolvedValue(mockSheetLegend);
  });

  it('should store legend in database', async () => {
    const { storeLegend } = await import('@/lib/legend-extractor');

    await storeLegend('project-1', 'doc-1', mockSheetLegend);

    expect(prismaMock.sheetLegend.create).toHaveBeenCalledWith({
      data: {
        projectId: 'project-1',
        documentId: 'doc-1',
        sheetNumber: 'A1.1',
        legendEntries: mockSheetLegend.legendEntries,
        boundingBox: mockSheetLegend.boundingBox,
        confidence: 0.92,
        discipline: DisciplineCode.FIRE_PROTECTION,
      },
    });
  });

  it('should handle null discipline', async () => {
    const { storeLegend } = await import('@/lib/legend-extractor');
    const legendWithoutDiscipline = { ...mockSheetLegend, discipline: undefined };

    await storeLegend('project-1', 'doc-1', legendWithoutDiscipline);

    const createCall = prismaMock.sheetLegend.create.mock.calls[0][0];
    expect(createCall.data.discipline).toBe(null);
  });

  it('should throw error on database failure', async () => {
    const { storeLegend } = await import('@/lib/legend-extractor');
    prismaMock.sheetLegend.create.mockRejectedValueOnce(new Error('Database error'));

    await expect(storeLegend('project-1', 'doc-1', mockSheetLegend)).rejects.toThrow('Database error');
  });
});

// ============================================================================
// TESTS - getProjectLegends
// ============================================================================

describe('getProjectLegends', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      SheetLegend: [mockSheetLegend],
    });
  });

  it('should retrieve all legends for a project', async () => {
    const { getProjectLegends } = await import('@/lib/legend-extractor');
    const result = await getProjectLegends('test-project');

    expect(result).toHaveLength(1);
    expect(result[0].sheetNumber).toBe('A1.1');
    expect(prismaMock.project.findUnique).toHaveBeenCalledWith({
      where: { slug: 'test-project' },
      include: {
        SheetLegend: {
          orderBy: { sheetNumber: 'asc' },
        },
      },
    });
  });

  it('should throw error when project not found', async () => {
    const { getProjectLegends } = await import('@/lib/legend-extractor');
    prismaMock.project.findUnique.mockResolvedValueOnce(null);

    await expect(getProjectLegends('nonexistent')).rejects.toThrow('Project not found');
  });

  it('should return empty array when no legends exist', async () => {
    const { getProjectLegends } = await import('@/lib/legend-extractor');
    prismaMock.project.findUnique.mockResolvedValueOnce({
      ...mockProject,
      SheetLegend: [],
    });

    const result = await getProjectLegends('test-project');
    expect(result).toEqual([]);
  });

  it('should map database records to SheetLegend interface', async () => {
    const { getProjectLegends } = await import('@/lib/legend-extractor');
    const result = await getProjectLegends('test-project');

    expect(result[0]).toMatchObject({
      id: mockSheetLegend.id,
      projectId: mockSheetLegend.projectId,
      documentId: mockSheetLegend.documentId,
      sheetNumber: mockSheetLegend.sheetNumber,
      legendEntries: mockSheetLegend.legendEntries,
      confidence: mockSheetLegend.confidence,
    });
  });

  it('should handle database errors', async () => {
    const { getProjectLegends } = await import('@/lib/legend-extractor');
    prismaMock.project.findUnique.mockRejectedValueOnce(new Error('Database connection failed'));

    await expect(getProjectLegends('test-project')).rejects.toThrow('Database connection failed');
  });
});

// ============================================================================
// TESTS - buildProjectLegendLibrary
// ============================================================================

describe('buildProjectLegendLibrary', () => {
  const mockLegends = [
    {
      ...mockSheetLegend,
      legendEntries: [
        {
          id: 'A1.1-0',
          symbolCode: 'FA-PS',
          symbolDescription: 'Fire Alarm Pull Station',
          category: SymbolCategory.FIRE_PROTECTION,
          discipline: DisciplineCode.FIRE_PROTECTION,
          confidence: 0.95,
        },
        {
          id: 'A1.1-1',
          symbolCode: 'E-1',
          symbolDescription: 'Electrical Panel 1',
          category: SymbolCategory.ELECTRICAL,
          discipline: DisciplineCode.ELECTRICAL,
          confidence: 0.90,
        },
      ],
    },
    {
      ...mockSheetLegend,
      id: 'legend-2',
      sheetNumber: 'A1.2',
      legendEntries: [
        {
          id: 'A1.2-0',
          symbolCode: 'WP',
          symbolDescription: 'Water Pipe',
          category: SymbolCategory.PLUMBING,
          discipline: DisciplineCode.PLUMBING,
          confidence: 0.88,
        },
        {
          id: 'A1.2-1',
          symbolCode: 'FA-PS',
          symbolDescription: 'Fire Alarm Pull Station',
          category: SymbolCategory.FIRE_PROTECTION,
          discipline: DisciplineCode.FIRE_PROTECTION,
          confidence: 0.95,
        },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock needs to return data on every call for buildProjectLegendLibrary
    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      SheetLegend: mockLegends,
    });
  });

  it('should build unified legend library', async () => {
    const { buildProjectLegendLibrary } = await import('@/lib/legend-extractor');
    const result = await buildProjectLegendLibrary('test-project');

    expect(result.projectId).toBe('project-1');
    expect(result.totalSymbols).toBe(3); // Deduplicated
    expect(result.allEntries).toHaveLength(3);
  });

  it('should deduplicate symbols by code', async () => {
    const { buildProjectLegendLibrary } = await import('@/lib/legend-extractor');
    const result = await buildProjectLegendLibrary('test-project');

    const codes = result.allEntries.map(e => e.symbolCode);
    expect(codes).toContain('FA-PS');
    expect(codes.filter(c => c === 'FA-PS')).toHaveLength(1);
  });

  it('should group symbols by category', async () => {
    const { buildProjectLegendLibrary } = await import('@/lib/legend-extractor');
    const result = await buildProjectLegendLibrary('test-project');

    expect(result.byCategory['fire_protection']).toHaveLength(1);
    expect(result.byCategory['electrical']).toHaveLength(1);
    expect(result.byCategory['plumbing']).toHaveLength(1);
  });

  it('should group symbols by discipline', async () => {
    const { buildProjectLegendLibrary } = await import('@/lib/legend-extractor');
    const result = await buildProjectLegendLibrary('test-project');

    expect(result.byDiscipline['FP']).toHaveLength(1);
    expect(result.byDiscipline['E']).toHaveLength(1);
    expect(result.byDiscipline['P']).toHaveLength(1);
  });

  it('should include timestamp', async () => {
    const { buildProjectLegendLibrary } = await import('@/lib/legend-extractor');
    const result = await buildProjectLegendLibrary('test-project');

    expect(result.lastUpdated).toBeInstanceOf(Date);
  });

  it('should handle empty legend library', async () => {
    const { buildProjectLegendLibrary } = await import('@/lib/legend-extractor');
    prismaMock.project.findUnique.mockResolvedValueOnce({
      ...mockProject,
      SheetLegend: [],
    });

    const result = await buildProjectLegendLibrary('test-project');

    expect(result.totalSymbols).toBe(0);
    expect(result.allEntries).toEqual([]);
  });

  it('should throw error when project not found', async () => {
    const { buildProjectLegendLibrary } = await import('@/lib/legend-extractor');
    prismaMock.project.findUnique.mockResolvedValueOnce(null);

    await expect(buildProjectLegendLibrary('nonexistent')).rejects.toThrow('Project not found');
  });

  it('should handle entries without disciplines', async () => {
    const { buildProjectLegendLibrary } = await import('@/lib/legend-extractor');
    const legendsWithoutDiscipline = [
      {
        ...mockSheetLegend,
        legendEntries: [
          {
            id: 'A1.1-0',
            symbolCode: 'GEN',
            symbolDescription: 'General Symbol',
            category: SymbolCategory.GENERAL,
            confidence: 0.90,
          },
        ],
      },
    ];

    prismaMock.project.findUnique.mockResolvedValueOnce({
      ...mockProject,
      SheetLegend: legendsWithoutDiscipline,
    });

    const result = await buildProjectLegendLibrary('test-project');

    expect(result.totalSymbols).toBe(1);
    expect(Object.keys(result.byDiscipline)).toHaveLength(0);
  });
});

// ============================================================================
// TESTS - searchSymbol
// ============================================================================

describe('searchSymbol', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      SheetLegend: [
        {
          ...mockSheetLegend,
          legendEntries: [
            {
              id: 'A1.1-0',
              symbolCode: 'FA-PS',
              symbolDescription: 'Fire Alarm Pull Station',
              category: SymbolCategory.FIRE_PROTECTION,
              confidence: 0.95,
            },
            {
              id: 'A1.1-1',
              symbolCode: 'E-1',
              symbolDescription: 'Electrical Panel 1',
              category: SymbolCategory.ELECTRICAL,
              confidence: 0.90,
            },
          ],
        },
      ],
    });
  });

  it('should search symbols by code', async () => {
    const { searchSymbol } = await import('@/lib/legend-extractor');
    const result = await searchSymbol('test-project', 'FA-PS');

    expect(result).toHaveLength(1);
    expect(result[0].symbolCode).toBe('FA-PS');
  });

  it('should search symbols by description', async () => {
    const { searchSymbol } = await import('@/lib/legend-extractor');
    const result = await searchSymbol('test-project', 'Fire Alarm');

    expect(result).toHaveLength(1);
    expect(result[0].symbolDescription).toContain('Fire Alarm');
  });

  it('should be case-insensitive', async () => {
    const { searchSymbol } = await import('@/lib/legend-extractor');
    const result = await searchSymbol('test-project', 'fire alarm');

    expect(result).toHaveLength(1);
  });

  it('should return partial matches', async () => {
    const { searchSymbol } = await import('@/lib/legend-extractor');
    const result = await searchSymbol('test-project', 'Panel');

    expect(result).toHaveLength(1);
    expect(result[0].symbolCode).toBe('E-1');
  });

  it('should return empty array for no matches', async () => {
    const { searchSymbol } = await import('@/lib/legend-extractor');
    const result = await searchSymbol('test-project', 'NonexistentSymbol');

    expect(result).toEqual([]);
  });

  it('should handle errors gracefully', async () => {
    const { searchSymbol } = await import('@/lib/legend-extractor');
    prismaMock.project.findUnique.mockRejectedValueOnce(new Error('Database error'));

    const result = await searchSymbol('test-project', 'FA-PS');

    expect(result).toEqual([]);
  });
});

// ============================================================================
// TESTS - validateSymbolUsage
// ============================================================================

describe('validateSymbolUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect inconsistent symbol usage', async () => {
    const { validateSymbolUsage } = await import('@/lib/legend-extractor');
    prismaMock.project.findUnique.mockResolvedValueOnce({
      ...mockProject,
      SheetLegend: [
        {
          ...mockSheetLegend,
          sheetNumber: 'A1.1',
          legendEntries: [
            {
              id: 'A1.1-0',
              symbolCode: 'FA-PS',
              symbolDescription: 'Fire Alarm Pull Station',
              category: SymbolCategory.FIRE_PROTECTION,
              confidence: 0.95,
            },
          ],
        },
        {
          ...mockSheetLegend,
          id: 'legend-2',
          sheetNumber: 'A1.2',
          legendEntries: [
            {
              id: 'A1.2-0',
              symbolCode: 'FA-PS',
              symbolDescription: 'Fire Pull Station',
              category: SymbolCategory.FIRE_PROTECTION,
              confidence: 0.90,
            },
          ],
        },
      ],
    });

    const result = await validateSymbolUsage('test-project');

    expect(result.totalSymbols).toBe(1);
    expect(result.consistentSymbols).toBe(0);
    expect(result.inconsistencies).toHaveLength(1);
    expect(result.inconsistencies[0].symbolCode).toBe('FA-PS');
    expect(result.inconsistencies[0].descriptions).toHaveLength(2);
  });

  it('should report consistent symbols', async () => {
    const { validateSymbolUsage } = await import('@/lib/legend-extractor');
    prismaMock.project.findUnique.mockResolvedValueOnce({
      ...mockProject,
      SheetLegend: [
        {
          ...mockSheetLegend,
          sheetNumber: 'A1.1',
          legendEntries: [
            {
              id: 'A1.1-0',
              symbolCode: 'FA-PS',
              symbolDescription: 'Fire Alarm Pull Station',
              category: SymbolCategory.FIRE_PROTECTION,
              confidence: 0.95,
            },
          ],
        },
        {
          ...mockSheetLegend,
          id: 'legend-2',
          sheetNumber: 'A1.2',
          legendEntries: [
            {
              id: 'A1.2-0',
              symbolCode: 'FA-PS',
              symbolDescription: 'Fire Alarm Pull Station',
              category: SymbolCategory.FIRE_PROTECTION,
              confidence: 0.95,
            },
          ],
        },
      ],
    });

    const result = await validateSymbolUsage('test-project');

    expect(result.totalSymbols).toBe(1);
    expect(result.consistentSymbols).toBe(1);
    expect(result.inconsistencies).toHaveLength(0);
  });

  it('should track sheet numbers for each symbol', async () => {
    const { validateSymbolUsage } = await import('@/lib/legend-extractor');
    prismaMock.project.findUnique.mockResolvedValueOnce({
      ...mockProject,
      SheetLegend: [
        {
          ...mockSheetLegend,
          sheetNumber: 'A1.1',
          legendEntries: [
            {
              id: 'A1.1-0',
              symbolCode: 'FA-PS',
              symbolDescription: 'Fire Alarm Pull Station',
              category: SymbolCategory.FIRE_PROTECTION,
              confidence: 0.95,
            },
          ],
        },
        {
          ...mockSheetLegend,
          id: 'legend-2',
          sheetNumber: 'A1.2',
          legendEntries: [
            {
              id: 'A1.2-0',
              symbolCode: 'FA-PS',
              symbolDescription: 'Fire Pull Station',
              category: SymbolCategory.FIRE_PROTECTION,
              confidence: 0.90,
            },
          ],
        },
      ],
    });

    const result = await validateSymbolUsage('test-project');

    expect(result.inconsistencies[0].sheets).toContain('A1.1');
    expect(result.inconsistencies[0].sheets).toContain('A1.2');
  });

  it('should handle errors gracefully', async () => {
    const { validateSymbolUsage } = await import('@/lib/legend-extractor');
    prismaMock.project.findUnique.mockRejectedValueOnce(new Error('Database error'));

    const result = await validateSymbolUsage('test-project');

    expect(result.totalSymbols).toBe(0);
    expect(result.consistentSymbols).toBe(0);
    expect(result.inconsistencies).toEqual([]);
  });

  it('should handle empty project', async () => {
    const { validateSymbolUsage } = await import('@/lib/legend-extractor');
    prismaMock.project.findUnique.mockResolvedValueOnce({
      ...mockProject,
      SheetLegend: [],
    });

    const result = await validateSymbolUsage('test-project');

    expect(result.totalSymbols).toBe(0);
    expect(result.consistentSymbols).toBe(0);
  });
});

// ============================================================================
// TESTS - mergeLegendWithSymbolLibrary
// ============================================================================

describe('mergeLegendWithSymbolLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      SheetLegend: [
        {
          ...mockSheetLegend,
          legendEntries: [
            {
              id: 'A1.1-0',
              symbolCode: 'FA-PS',
              symbolDescription: 'Fire Alarm Pull Station',
              category: SymbolCategory.FIRE_PROTECTION,
              confidence: 0.95,
            },
          ],
        },
      ],
    });
  });

  it('should return merge statistics', async () => {
    const { mergeLegendWithSymbolLibrary } = await import('@/lib/legend-extractor');
    const result = await mergeLegendWithSymbolLibrary('test-project');

    expect(result.merged).toBe(1);
    expect(result.new).toBe(1);
    expect(result.updated).toBe(0);
  });

  it('should handle errors gracefully', async () => {
    const { mergeLegendWithSymbolLibrary } = await import('@/lib/legend-extractor');
    prismaMock.project.findUnique.mockRejectedValueOnce(new Error('Database error'));

    const result = await mergeLegendWithSymbolLibrary('test-project');

    expect(result.merged).toBe(0);
    expect(result.new).toBe(0);
    expect(result.updated).toBe(0);
  });
});

// ============================================================================
// TESTS - getCategoryName
// ============================================================================

describe('getCategoryName', () => {
  it('should return correct names for all categories', async () => {
    const { getCategoryName, SymbolCategory } = await import('@/lib/legend-extractor');

    expect(getCategoryName(SymbolCategory.ELECTRICAL)).toBe('Electrical');
    expect(getCategoryName(SymbolCategory.MECHANICAL)).toBe('Mechanical');
    expect(getCategoryName(SymbolCategory.PLUMBING)).toBe('Plumbing');
    expect(getCategoryName(SymbolCategory.FIRE_PROTECTION)).toBe('Fire Protection');
    expect(getCategoryName(SymbolCategory.ARCHITECTURAL)).toBe('Architectural');
    expect(getCategoryName(SymbolCategory.STRUCTURAL)).toBe('Structural');
    expect(getCategoryName(SymbolCategory.CIVIL)).toBe('Civil');
    expect(getCategoryName(SymbolCategory.GENERAL)).toBe('General');
    expect(getCategoryName(SymbolCategory.UNKNOWN)).toBe('Unknown');
  });
});

// ============================================================================
// TESTS - getLegendStatistics
// ============================================================================

describe('getLegendStatistics', () => {
  const mockLegends = [
    {
      ...mockSheetLegend,
      legendEntries: [
        { id: '1', symbolCode: 'A', symbolDescription: 'Test', category: SymbolCategory.ELECTRICAL, confidence: 0.9 },
        { id: '2', symbolCode: 'B', symbolDescription: 'Test', category: SymbolCategory.ELECTRICAL, confidence: 0.9 },
      ],
      confidence: 0.9,
      discipline: DisciplineCode.ELECTRICAL,
    },
    {
      ...mockSheetLegend,
      id: 'legend-2',
      sheetNumber: 'A1.2',
      legendEntries: [
        { id: '3', symbolCode: 'C', symbolDescription: 'Test', category: SymbolCategory.PLUMBING, confidence: 0.8 },
      ],
      confidence: 0.8,
      discipline: DisciplineCode.PLUMBING,
    },
  ];

  it('should calculate total legends', async () => {
    const { getLegendStatistics } = await import('@/lib/legend-extractor');
    const result = getLegendStatistics(mockLegends);

    expect(result.totalLegends).toBe(2);
  });

  it('should calculate total symbols', async () => {
    const { getLegendStatistics } = await import('@/lib/legend-extractor');
    const result = getLegendStatistics(mockLegends);

    expect(result.totalSymbols).toBe(3);
  });

  it('should calculate average symbols per sheet', async () => {
    const { getLegendStatistics } = await import('@/lib/legend-extractor');
    const result = getLegendStatistics(mockLegends);

    expect(result.avgSymbolsPerSheet).toBe(1.5);
  });

  it('should calculate average confidence', async () => {
    const { getLegendStatistics } = await import('@/lib/legend-extractor');
    const result = getLegendStatistics(mockLegends);

    expect(result.avgConfidence).toBeCloseTo(0.85);
  });

  it('should group by discipline', async () => {
    const { getLegendStatistics } = await import('@/lib/legend-extractor');
    const result = getLegendStatistics(mockLegends);

    expect(result.byDiscipline['E']).toBe(2);
    expect(result.byDiscipline['P']).toBe(1);
  });

  it('should handle empty array', async () => {
    const { getLegendStatistics } = await import('@/lib/legend-extractor');
    const result = getLegendStatistics([]);

    expect(result.totalLegends).toBe(0);
    expect(result.totalSymbols).toBe(0);
    expect(result.avgSymbolsPerSheet).toBe(0);
    expect(result.avgConfidence).toBe(0);
  });

  it('should handle legends without discipline', async () => {
    const { getLegendStatistics } = await import('@/lib/legend-extractor');
    const legendsWithoutDiscipline = [
      {
        ...mockSheetLegend,
        legendEntries: [{ id: '1', symbolCode: 'A', symbolDescription: 'Test', category: SymbolCategory.GENERAL, confidence: 0.9 }],
        confidence: 0.9,
        discipline: undefined,
      },
    ];

    const result = getLegendStatistics(legendsWithoutDiscipline);

    expect(result.byDiscipline['UNKNOWN']).toBe(1);
  });
});
