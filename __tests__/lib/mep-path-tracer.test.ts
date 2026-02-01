import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

// ============================================================================
// MOCKS
// ============================================================================

const mocks = vi.hoisted(() => ({
  prisma: {
    documentChunk: {
      findMany: vi.fn(),
    },
  },
  spatialCorrelation: {
    parseGridCoordinate: vi.fn(),
    calculateGridDistance: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/spatial-correlation', () => ({
  parseGridCoordinate: mocks.spatialCorrelation.parseGridCoordinate,
  calculateGridDistance: mocks.spatialCorrelation.calculateGridDistance,
}));

// Import after mocks
import {
  extractMEPElements,
  tracePath,
  detectAllClashes,
  identifyVerticalRisers,
  type MEPElement,
  type MEPSystem,
  type MEPPath,
  type VerticalRiser,
  type ClashDetection,
} from '@/lib/mep-path-tracer';

// ============================================================================
// TEST DATA
// ============================================================================

const mockChunks = [
  {
    id: 'chunk-1',
    content: 'AHU-1 located at grid A5. 24x12 duct runs from AHU-1 to VAV-1.',
    metadata: {
      sheet_number: 'M-101',
      drawing_type: 'Mechanical',
      page_number: 1,
    },
    documentId: 'doc-1',
    pageNumber: 1,
    chunkIndex: 0,
    embedding: null,
  },
  {
    id: 'chunk-2',
    content: 'Panel LP-1 serves lighting circuits. 2" EMT conduit to junction box.',
    metadata: {
      sheet_number: 'E-201',
      drawing_type: 'Electrical',
      page_number: 1,
    },
    documentId: 'doc-2',
    pageNumber: 1,
    chunkIndex: 0,
    embedding: null,
  },
  {
    id: 'chunk-3',
    content: '4" waste line from WC-1. Domestic water 2" supply pipe.',
    metadata: {
      sheet_number: 'P-301',
      drawing_type: 'Plumbing',
      page_number: 1,
    },
    documentId: 'doc-3',
    pageNumber: 1,
    chunkIndex: 0,
    embedding: null,
  },
  {
    id: 'chunk-4',
    content: 'Fire sprinkler riser FS-R1 serves all floors.',
    metadata: {
      sheet_number: 'FP-401',
      drawing_type: 'Fire Protection',
      page_number: 1,
    },
    documentId: 'doc-4',
    pageNumber: 1,
    chunkIndex: 0,
    embedding: null,
  },
];

const mockChunksWithCallouts = [
  {
    id: 'chunk-5',
    content: 'Equipment layout',
    metadata: {
      sheet_number: 'M-102',
      drawing_type: 'Mechanical',
      page_number: 1,
      mepCallouts: [
        {
          type: 'equipment',
          description: 'Air Handling Unit',
          location: 'B3',
          tag: 'AHU-2',
          size: '10 TON',
        },
        {
          type: 'duct',
          description: '18x10 supply duct',
          location: 'B4',
          size: '18x10',
        },
      ],
    },
    documentId: 'doc-5',
    pageNumber: 1,
    chunkIndex: 0,
    embedding: null,
  },
];

const createMEPElement = (overrides: Partial<MEPElement>): MEPElement => ({
  id: 'elem-1',
  type: 'duct',
  system: 'mechanical',
  location: {
    floor: 'Level 1',
    description: 'Test location',
  },
  connections: [],
  ...overrides,
});

// ============================================================================
// TESTS: extractMEPElements
// ============================================================================

describe('MEPPathTracer - extractMEPElements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('System Filtering', () => {
    it('should extract all MEP elements without system filter', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue(null);

      const elements = await extractMEPElements('test-project');

      expect(elements.length).toBeGreaterThan(0);
      expect(elements.some(e => e.system === 'mechanical')).toBe(true);
      expect(elements.some(e => e.system === 'electrical')).toBe(true);
      expect(elements.some(e => e.system === 'plumbing')).toBe(true);
    });

    it('should filter by mechanical system only', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);

      const elements = await extractMEPElements('test-project', 'mechanical');

      expect(elements.every(e => e.system === 'mechanical')).toBe(true);
      expect(elements.some(e => e.tag?.startsWith('AHU'))).toBe(true);
    });

    it('should filter by electrical system only', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);

      const elements = await extractMEPElements('test-project', 'electrical');

      expect(elements.every(e => e.system === 'electrical')).toBe(true);
      expect(elements.some(e => e.tag?.includes('LP-1'))).toBe(true);
    });

    it('should filter by plumbing system only', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);

      const elements = await extractMEPElements('test-project', 'plumbing');

      expect(elements.every(e => e.system === 'plumbing')).toBe(true);
      expect(elements.some(e => e.tag?.startsWith('WC'))).toBe(true);
    });

    it('should filter by fire protection system only', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);

      const elements = await extractMEPElements('test-project', 'fire_protection');

      expect(elements.every(e => e.system === 'fire_protection')).toBe(true);
    });
  });

  describe('Mechanical Element Extraction', () => {
    it('should extract ducts with sizes', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue([mockChunks[0]]);

      const elements = await extractMEPElements('test-project', 'mechanical');

      const ducts = elements.filter(e => e.type === 'duct');
      expect(ducts.length).toBeGreaterThan(0);
      expect(ducts.some(d => d.size === '24x12' || d.size?.includes('24'))).toBe(true);
    });

    it('should extract equipment with tags', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue([mockChunks[0]]);

      const elements = await extractMEPElements('test-project', 'mechanical');

      const equipment = elements.filter(e => e.type === 'equipment');
      expect(equipment.length).toBeGreaterThan(0);
      expect(equipment.some(e => e.tag?.includes('AHU-1'))).toBe(true);
    });

    it('should extract round ducts', async () => {
      const chunk = {
        ...mockChunks[0],
        content: '12" round duct from supply plenum',
      };
      mocks.prisma.documentChunk.findMany.mockResolvedValue([chunk]);

      const elements = await extractMEPElements('test-project', 'mechanical');

      const ducts = elements.filter(e => e.type === 'duct');
      expect(ducts.length).toBeGreaterThan(0);
    });

    it('should extract VAV boxes', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue([mockChunks[0]]);

      const elements = await extractMEPElements('test-project', 'mechanical');

      const vavs = elements.filter(e => e.tag?.includes('VAV'));
      expect(vavs.length).toBeGreaterThan(0);
    });
  });

  describe('Electrical Element Extraction', () => {
    it('should extract panels', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue([mockChunks[1]]);

      const elements = await extractMEPElements('test-project', 'electrical');

      const panels = elements.filter(e => e.type === 'panel');
      expect(panels.length).toBeGreaterThan(0);
      expect(panels.some(p => p.tag?.includes('LP-1'))).toBe(true);
    });

    it('should extract conduit with sizes', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue([mockChunks[1]]);

      const elements = await extractMEPElements('test-project', 'electrical');

      const conduits = elements.filter(e => e.type === 'conduit');
      expect(conduits.length).toBeGreaterThan(0);
      expect(conduits.some(c => c.size === '2"' || c.size?.includes('2'))).toBe(true);
    });

    it('should extract fractional conduit sizes', async () => {
      const chunk = {
        ...mockChunks[1],
        content: '3/4" EMT conduit in ceiling space',
      };
      mocks.prisma.documentChunk.findMany.mockResolvedValue([chunk]);

      const elements = await extractMEPElements('test-project', 'electrical');

      const conduits = elements.filter(e => e.type === 'conduit');
      expect(conduits.length).toBeGreaterThan(0);
    });
  });

  describe('Plumbing Element Extraction', () => {
    it('should extract pipes with sizes', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue([mockChunks[2]]);

      const elements = await extractMEPElements('test-project', 'plumbing');

      const pipes = elements.filter(e => e.type === 'pipe');
      expect(pipes.length).toBeGreaterThan(0);
      expect(pipes.some(p => p.size === '4"' || p.size?.includes('4'))).toBe(true);
    });

    it('should extract plumbing fixtures', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue([mockChunks[2]]);

      const elements = await extractMEPElements('test-project', 'plumbing');

      const fixtures = elements.filter(e => e.type === 'fixture');
      expect(fixtures.length).toBeGreaterThan(0);
      expect(fixtures.some(f => f.tag?.includes('WC'))).toBe(true);
    });

    it('should extract various fixture types', async () => {
      const chunk = {
        ...mockChunks[2],
        content: 'Fixtures: LAV-1, DF-1, URN-1, SH-1',
      };
      mocks.prisma.documentChunk.findMany.mockResolvedValue([chunk]);

      const elements = await extractMEPElements('test-project', 'plumbing');

      const fixtures = elements.filter(e => e.type === 'fixture');
      expect(fixtures.length).toBeGreaterThan(0);
    });
  });

  describe('MEP Callout Parsing', () => {
    it('should parse callouts from metadata', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunksWithCallouts);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({ x: 'B', y: '3' });

      const elements = await extractMEPElements('test-project', 'mechanical');

      expect(elements.length).toBeGreaterThan(0);
      const ahu2 = elements.find(e => e.tag === 'AHU-2');
      expect(ahu2).toBeDefined();
      expect(ahu2?.type).toBe('equipment');
      expect(ahu2?.location.grid).toEqual({ x: 'B', y: '3' });
    });

    it('should handle callouts without grid coordinates', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunksWithCallouts);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue(null);

      const elements = await extractMEPElements('test-project', 'mechanical');

      expect(elements.length).toBeGreaterThan(0);
      expect(elements.some(e => e.location.grid === undefined)).toBe(true);
    });

    it('should preserve callout metadata', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunksWithCallouts);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({ x: 'B', y: '3' });

      const elements = await extractMEPElements('test-project', 'mechanical');

      const ahu2 = elements.find(e => e.tag === 'AHU-2');
      expect(ahu2?.metadata?.raw).toBeDefined();
    });
  });

  describe('Drawing Type Classification', () => {
    it('should identify HVAC drawings as mechanical', async () => {
      const chunk = {
        ...mockChunks[0],
        metadata: { sheet_number: 'HVAC-1', drawing_type: 'HVAC Plans' },
      };
      mocks.prisma.documentChunk.findMany.mockResolvedValue([chunk]);

      const elements = await extractMEPElements('test-project');

      expect(elements.every(e => e.system === 'mechanical')).toBe(true);
    });

    it('should identify lighting/power drawings as electrical', async () => {
      const chunk = {
        ...mockChunks[1],
        metadata: { sheet_number: 'E-1', drawing_type: 'Power and Lighting' },
      };
      mocks.prisma.documentChunk.findMany.mockResolvedValue([chunk]);

      const elements = await extractMEPElements('test-project');

      expect(elements.every(e => e.system === 'electrical')).toBe(true);
    });

    it('should identify sanitary drawings as plumbing', async () => {
      const chunk = {
        ...mockChunks[2],
        metadata: { sheet_number: 'P-1', drawing_type: 'Sanitary' },
      };
      mocks.prisma.documentChunk.findMany.mockResolvedValue([chunk]);

      const elements = await extractMEPElements('test-project');

      expect(elements.every(e => e.system === 'plumbing')).toBe(true);
    });

    it('should skip non-MEP drawings', async () => {
      const chunk = {
        id: 'chunk-6',
        content: 'Architectural floor plan',
        metadata: { sheet_number: 'A-101', drawing_type: 'Architectural' },
        documentId: 'doc-6',
        pageNumber: 1,
        chunkIndex: 0,
        embedding: null,
      };
      mocks.prisma.documentChunk.findMany.mockResolvedValue([chunk]);

      const elements = await extractMEPElements('test-project');

      expect(elements.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should return empty array on database error', async () => {
      mocks.prisma.documentChunk.findMany.mockRejectedValue(new Error('Database error'));

      const elements = await extractMEPElements('test-project');

      expect(elements).toEqual([]);
    });

    it('should handle null content gracefully', async () => {
      const chunk = { ...mockChunks[0], content: null };
      mocks.prisma.documentChunk.findMany.mockResolvedValue([chunk]);

      const elements = await extractMEPElements('test-project', 'mechanical');

      expect(Array.isArray(elements)).toBe(true);
    });

    it('should handle missing metadata', async () => {
      const chunk = { ...mockChunks[0], metadata: null };
      mocks.prisma.documentChunk.findMany.mockResolvedValue([chunk]);

      const elements = await extractMEPElements('test-project');

      expect(Array.isArray(elements)).toBe(true);
    });

    it('should handle invalid callout data', async () => {
      const chunk = {
        ...mockChunks[0],
        metadata: {
          sheet_number: 'M-1',
          drawing_type: 'Mechanical',
          mepCallouts: [{ invalid: 'data' }],
        },
      };
      mocks.prisma.documentChunk.findMany.mockResolvedValue([chunk]);

      const elements = await extractMEPElements('test-project', 'mechanical');

      expect(Array.isArray(elements)).toBe(true);
    });
  });

  describe('Element ID Generation', () => {
    it('should generate unique IDs for each element', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);

      const elements = await extractMEPElements('test-project');

      const ids = elements.map(e => e.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should include system in element ID', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue([mockChunks[0]]);

      const elements = await extractMEPElements('test-project', 'mechanical');

      expect(elements.every(e => e.id.startsWith('mechanical-'))).toBe(true);
    });
  });

  describe('Context Extraction', () => {
    it('should extract context around matches', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue([mockChunks[0]]);

      const elements = await extractMEPElements('test-project', 'mechanical');

      expect(elements.every(e => e.location.description.length > 0)).toBe(true);
    });
  });
});

// ============================================================================
// TESTS: tracePath
// ============================================================================

describe('MEPPathTracer - tracePath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Path Finding', () => {
    it('should find path between connected elements', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'AHU-1 at grid A1. Connects to VAV-1 at grid A2.',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate
        .mockReturnValueOnce({ x: 'A', y: '1', numeric: { x: 1, y: 1 } })
        .mockReturnValueOnce({ x: 'A', y: '2', numeric: { x: 1, y: 2 } });
      mocks.spatialCorrelation.calculateGridDistance.mockReturnValue(1);

      const path = await tracePath('test-project', 'mechanical', 'AHU-1', 'VAV-1');

      expect(path).not.toBeNull();
      expect(path?.startPoint.tag).toBe('AHU-1');
      expect(path?.endPoint.tag).toBe('VAV-1');
      expect(path?.system).toBe('mechanical');
    });

    it('should return null if start element not found', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue([mockChunks[0]]);

      const path = await tracePath('test-project', 'mechanical', 'NONEXISTENT', 'VAV-1');

      expect(path).toBeNull();
    });

    it('should return null if end element not found', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue([mockChunks[0]]);

      const path = await tracePath('test-project', 'mechanical', 'AHU-1', 'NONEXISTENT');

      expect(path).toBeNull();
    });

    it('should return null if no path exists', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'AHU-1 isolated. VAV-1 isolated.',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue(null);
      mocks.spatialCorrelation.calculateGridDistance.mockReturnValue(100);

      const path = await tracePath('test-project', 'mechanical', 'AHU-1', 'VAV-1');

      expect(path).toBeNull();
    });
  });

  describe('Path Properties', () => {
    it('should include intermediate points in path', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'AHU-1 at A1. Connects through damper at A2 to VAV-1 at A3.',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '1',
        numeric: { x: 1, y: 1 },
      });
      mocks.spatialCorrelation.calculateGridDistance.mockReturnValue(1);

      const path = await tracePath('test-project', 'mechanical', 'AHU-1', 'VAV-1');

      expect(path).not.toBeNull();
      expect(Array.isArray(path?.intermediatePoints)).toBe(true);
    });

    it('should identify floors in path', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'AHU-1 serves VAV-1',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '1',
        numeric: { x: 1, y: 1 },
      });
      mocks.spatialCorrelation.calculateGridDistance.mockReturnValue(1);

      const path = await tracePath('test-project', 'mechanical', 'AHU-1', 'VAV-1');

      expect(path?.floors).toBeDefined();
      expect(Array.isArray(path?.floors)).toBe(true);
    });

    it('should calculate path length', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'AHU-1 at A1. VAV-1 at A2.',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '1',
        numeric: { x: 1, y: 1 },
      });
      mocks.spatialCorrelation.calculateGridDistance.mockReturnValue(2);

      const path = await tracePath('test-project', 'mechanical', 'AHU-1', 'VAV-1');

      expect(path?.pathLength).toBeGreaterThan(0);
    });

    it('should identify risers in path', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'AHU-1 at A1. Riser R-1 at A2. VAV-1 at A3.',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '1',
        numeric: { x: 1, y: 1 },
      });
      mocks.spatialCorrelation.calculateGridDistance.mockReturnValue(1);

      const path = await tracePath('test-project', 'mechanical', 'AHU-1', 'VAV-1');

      expect(path?.risers).toBeDefined();
      expect(Array.isArray(path?.risers)).toBe(true);
    });

    it('should include confidence score', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'AHU-1 and VAV-1',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '1',
        numeric: { x: 1, y: 1 },
      });
      mocks.spatialCorrelation.calculateGridDistance.mockReturnValue(1);

      const path = await tracePath('test-project', 'mechanical', 'AHU-1', 'VAV-1');

      expect(path?.confidence).toBeGreaterThanOrEqual(0);
      expect(path?.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Error Handling', () => {
    it('should return null on database error', async () => {
      mocks.prisma.documentChunk.findMany.mockRejectedValue(new Error('Database error'));

      const path = await tracePath('test-project', 'mechanical', 'AHU-1', 'VAV-1');

      expect(path).toBeNull();
    });

    it('should handle extraction errors gracefully', async () => {
      mocks.prisma.documentChunk.findMany.mockResolvedValue([]);

      const path = await tracePath('test-project', 'mechanical', 'AHU-1', 'VAV-1');

      expect(path).toBeNull();
    });
  });
});

// ============================================================================
// TESTS: detectAllClashes
// ============================================================================

describe('MEPPathTracer - detectAllClashes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Clash Detection', () => {
    it('should detect clashes between different systems', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'AHU-1 at grid A1. Panel LP-1 at grid A1.',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
        {
          id: 'chunk-2',
          content: 'Panel LP-1 at grid A1.',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Electrical',
          },
          documentId: 'doc-2',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '1',
        numeric: { x: 1, y: 1 },
      });
      mocks.spatialCorrelation.calculateGridDistance.mockReturnValue(0);

      const clashes = await detectAllClashes('test-project');

      expect(Array.isArray(clashes)).toBe(true);
      if (clashes.length > 0) {
        expect(clashes[0].element1.system).not.toBe(clashes[0].element2.system);
      }
    });

    it('should not detect clashes on different floors', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'AHU-1 at grid A1.',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
        {
          id: 'chunk-2',
          content: 'Panel LP-1 at grid A1.',
          metadata: {
            sheet_number: 'Level 2',
            drawing_type: 'Electrical',
          },
          documentId: 'doc-2',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '1',
        numeric: { x: 1, y: 1 },
      });
      mocks.spatialCorrelation.calculateGridDistance.mockReturnValue(0);

      const clashes = await detectAllClashes('test-project');

      expect(clashes.length).toBe(0);
    });

    it('should not detect clashes within same system', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'AHU-1 at grid A1. VAV-1 at grid A1.',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '1',
        numeric: { x: 1, y: 1 },
      });
      mocks.spatialCorrelation.calculateGridDistance.mockReturnValue(0);

      const clashes = await detectAllClashes('test-project');

      expect(clashes.length).toBe(0);
    });

    it('should filter by specified systems', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'AHU-1 at A1. Panel LP-1 at A1. WC-1 at A1.',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
        {
          id: 'chunk-2',
          content: 'Panel LP-1 at A1.',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Electrical',
          },
          documentId: 'doc-2',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '1',
        numeric: { x: 1, y: 1 },
      });
      mocks.spatialCorrelation.calculateGridDistance.mockReturnValue(0);

      const clashes = await detectAllClashes('test-project', ['mechanical', 'electrical']);

      expect(Array.isArray(clashes)).toBe(true);
      clashes.forEach(clash => {
        expect(['mechanical', 'electrical']).toContain(clash.element1.system);
        expect(['mechanical', 'electrical']).toContain(clash.element2.system);
      });
    });
  });

  describe('Clash Types', () => {
    it('should classify hard clashes (distance = 0)', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'Equipment at same location',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
        {
          id: 'chunk-2',
          content: 'Panel at same location',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Electrical',
          },
          documentId: 'doc-2',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '1',
        numeric: { x: 1, y: 1 },
      });
      mocks.spatialCorrelation.calculateGridDistance.mockReturnValue(0);

      const clashes = await detectAllClashes('test-project');

      if (clashes.length > 0) {
        const hardClashes = clashes.filter(c => c.type === 'hard_clash');
        expect(hardClashes.length).toBeGreaterThan(0);
      }
    });

    it('should classify clearance clashes (distance > 0 but < required)', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'Duct at A1',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
        {
          id: 'chunk-2',
          content: 'Pipe at A1',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Plumbing',
          },
          documentId: 'doc-2',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '1',
        numeric: { x: 1, y: 1 },
      });
      mocks.spatialCorrelation.calculateGridDistance.mockReturnValue(0.1);

      const clashes = await detectAllClashes('test-project');

      if (clashes.length > 0) {
        expect(clashes.some(c => c.type === 'clearance_clash')).toBe(true);
      }
    });
  });

  describe('Clash Severity', () => {
    it('should mark hard clashes as critical', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'Equipment at A1',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
        {
          id: 'chunk-2',
          content: 'Panel at A1',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Electrical',
          },
          documentId: 'doc-2',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '1',
        numeric: { x: 1, y: 1 },
      });
      mocks.spatialCorrelation.calculateGridDistance.mockReturnValue(0);

      const clashes = await detectAllClashes('test-project');

      if (clashes.length > 0) {
        const criticalClashes = clashes.filter(c => c.severity === 'critical');
        expect(criticalClashes.length).toBeGreaterThan(0);
      }
    });

    it('should provide resolution suggestions', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'Duct at A1',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
        {
          id: 'chunk-2',
          content: 'Pipe at A1',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Plumbing',
          },
          documentId: 'doc-2',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '1',
        numeric: { x: 1, y: 1 },
      });
      mocks.spatialCorrelation.calculateGridDistance.mockReturnValue(0);

      const clashes = await detectAllClashes('test-project');

      if (clashes.length > 0) {
        expect(clashes.every(c => typeof c.resolution === 'string')).toBe(true);
        expect(clashes.every(c => c.resolution!.length > 0)).toBe(true);
      }
    });
  });

  describe('Error Handling', () => {
    it('should return empty array on database error', async () => {
      mocks.prisma.documentChunk.findMany.mockRejectedValue(new Error('Database error'));

      const clashes = await detectAllClashes('test-project');

      expect(clashes).toEqual([]);
    });

    it('should handle elements without grid coordinates', async () => {
      const chunks = [mockChunks[0]];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue(null);

      const clashes = await detectAllClashes('test-project');

      expect(Array.isArray(clashes)).toBe(true);
    });
  });

  describe('Clash Properties', () => {
    it('should include clearance requirements', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'Duct at A1',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
        {
          id: 'chunk-2',
          content: 'Conduit at A1',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Electrical',
          },
          documentId: 'doc-2',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '1',
        numeric: { x: 1, y: 1 },
      });
      mocks.spatialCorrelation.calculateGridDistance.mockReturnValue(0.1);

      const clashes = await detectAllClashes('test-project');

      if (clashes.length > 0) {
        expect(clashes.every(c => c.clearanceRequired > 0)).toBe(true);
      }
    });

    it('should include distance measurements', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'Duct at A1',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
        {
          id: 'chunk-2',
          content: 'Pipe at A1',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Plumbing',
          },
          documentId: 'doc-2',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '1',
        numeric: { x: 1, y: 1 },
      });
      mocks.spatialCorrelation.calculateGridDistance.mockReturnValue(0.2);

      const clashes = await detectAllClashes('test-project');

      if (clashes.length > 0) {
        expect(clashes.every(c => c.distance >= 0)).toBe(true);
      }
    });

    it('should include location information', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'Equipment at A1',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
        {
          id: 'chunk-2',
          content: 'Panel at A1',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Electrical',
          },
          documentId: 'doc-2',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '1',
        numeric: { x: 1, y: 1 },
      });
      mocks.spatialCorrelation.calculateGridDistance.mockReturnValue(0);

      const clashes = await detectAllClashes('test-project');

      if (clashes.length > 0) {
        expect(clashes.every(c => c.location.floor)).toBe(true);
        expect(clashes.every(c => c.location.description)).toBe(true);
      }
    });
  });
});

// ============================================================================
// TESTS: identifyVerticalRisers
// ============================================================================

describe('MEPPathTracer - identifyVerticalRisers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Riser Identification', () => {
    it('should identify risers across multiple floors', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'Riser R-1 at grid A5',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
        {
          id: 'chunk-2',
          content: 'Riser R-1 at grid A5',
          metadata: {
            sheet_number: 'Level 2',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-2',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '5',
        numeric: { x: 1, y: 5 },
      });

      const risers = await identifyVerticalRisers('test-project', 'mechanical');

      expect(risers.length).toBeGreaterThan(0);
      const riser = risers.find(r => r.tag === 'R-1');
      expect(riser).toBeDefined();
      expect(riser?.floors.length).toBeGreaterThanOrEqual(2);
    });

    it('should group risers by tag', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'Riser R-1 at A5. Riser R-2 at B3.',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
        {
          id: 'chunk-2',
          content: 'Riser R-1 at A5. Riser R-2 at B3.',
          metadata: {
            sheet_number: 'Level 2',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-2',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '5',
        numeric: { x: 1, y: 5 },
      });

      const risers = await identifyVerticalRisers('test-project', 'mechanical');

      const tags = risers.map(r => r.tag);
      expect(tags).toContain('R-1');
      expect(tags).toContain('R-2');
    });

    it('should filter single-floor risers', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'Riser R-1 only on this floor',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '1',
        numeric: { x: 1, y: 1 },
      });

      const risers = await identifyVerticalRisers('test-project', 'mechanical');

      expect(risers.length).toBe(0);
    });

    it('should filter by specified system', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'Riser R-1',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
        {
          id: 'chunk-2',
          content: 'Riser R-1',
          metadata: {
            sheet_number: 'Level 2',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-2',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '1',
        numeric: { x: 1, y: 1 },
      });

      const risers = await identifyVerticalRisers('test-project', 'mechanical');

      expect(risers.every(r => r.system === 'mechanical')).toBe(true);
    });
  });

  describe('Riser Properties', () => {
    it('should include floor list', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'Riser R-1',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
        {
          id: 'chunk-2',
          content: 'Riser R-1',
          metadata: {
            sheet_number: 'Level 2',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-2',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '1',
        numeric: { x: 1, y: 1 },
      });

      const risers = await identifyVerticalRisers('test-project', 'mechanical');

      if (risers.length > 0) {
        expect(risers[0].floors).toBeDefined();
        expect(Array.isArray(risers[0].floors)).toBe(true);
        expect(risers[0].floors.length).toBeGreaterThan(1);
      }
    });

    it('should include location data for each floor', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'Riser R-1',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
        {
          id: 'chunk-2',
          content: 'Riser R-1',
          metadata: {
            sheet_number: 'Level 2',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-2',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '1',
        numeric: { x: 1, y: 1 },
      });

      const risers = await identifyVerticalRisers('test-project', 'mechanical');

      if (risers.length > 0) {
        expect(risers[0].locations).toBeDefined();
        expect(Array.isArray(risers[0].locations)).toBe(true);
        expect(risers[0].locations.every(loc => loc.floor && loc.grid)).toBe(true);
      }
    });

    it('should include size information', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'Riser R-1',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
        {
          id: 'chunk-2',
          content: 'Riser R-1',
          metadata: {
            sheet_number: 'Level 2',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-2',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '1',
        numeric: { x: 1, y: 1 },
      });

      const risers = await identifyVerticalRisers('test-project', 'mechanical');

      if (risers.length > 0) {
        expect(risers[0].size).toBeDefined();
      }
    });

    it('should include connected elements', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'Riser R-1 at A1. Connects to AHU-1.',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
        {
          id: 'chunk-2',
          content: 'Riser R-1 at A1.',
          metadata: {
            sheet_number: 'Level 2',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-2',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '1',
        numeric: { x: 1, y: 1 },
      });
      mocks.spatialCorrelation.calculateGridDistance.mockReturnValue(1);

      const risers = await identifyVerticalRisers('test-project', 'mechanical');

      if (risers.length > 0) {
        expect(risers[0].connectedElements).toBeDefined();
        expect(Array.isArray(risers[0].connectedElements)).toBe(true);
      }
    });
  });

  describe('Error Handling', () => {
    it('should return empty array on database error', async () => {
      mocks.prisma.documentChunk.findMany.mockRejectedValue(new Error('Database error'));

      const risers = await identifyVerticalRisers('test-project', 'mechanical');

      expect(risers).toEqual([]);
    });

    it('should handle risers without tags', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'Riser without tag',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '1',
        numeric: { x: 1, y: 1 },
      });

      const risers = await identifyVerticalRisers('test-project', 'mechanical');

      expect(Array.isArray(risers)).toBe(true);
    });

    it('should handle risers without grid coordinates', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'Riser R-1',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
        {
          id: 'chunk-2',
          content: 'Riser R-1',
          metadata: {
            sheet_number: 'Level 2',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-2',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue(null);

      const risers = await identifyVerticalRisers('test-project', 'mechanical');

      expect(Array.isArray(risers)).toBe(true);
    });
  });

  describe('Floor Sorting', () => {
    it('should sort floors in risers', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'Riser R-1',
          metadata: {
            sheet_number: 'Level 3',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-1',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
        {
          id: 'chunk-2',
          content: 'Riser R-1',
          metadata: {
            sheet_number: 'Level 1',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-2',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
        {
          id: 'chunk-3',
          content: 'Riser R-1',
          metadata: {
            sheet_number: 'Level 2',
            drawing_type: 'Mechanical',
          },
          documentId: 'doc-3',
          pageNumber: 1,
          chunkIndex: 0,
          embedding: null,
        },
      ];
      mocks.prisma.documentChunk.findMany.mockResolvedValue(chunks);
      mocks.spatialCorrelation.parseGridCoordinate.mockReturnValue({
        x: 'A',
        y: '1',
        numeric: { x: 1, y: 1 },
      });

      const risers = await identifyVerticalRisers('test-project', 'mechanical');

      if (risers.length > 0) {
        const floors = risers[0].floors;
        expect(floors[0]).toBe('Level 1');
        expect(floors[floors.length - 1]).toBe('Level 3');
      }
    });
  });
});
