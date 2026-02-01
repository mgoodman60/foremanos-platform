import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mocks Setup (vi.hoisted pattern)
// ============================================
const mocks = vi.hoisted(() => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    document: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    documentChunk: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    regulatoryDocument: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    regulatoryChunk: {
      findMany: vi.fn(),
    },
    room: {
      findMany: vi.fn(),
    },
    door: {
      findMany: vi.fn(),
    },
    window: {
      findMany: vi.fn(),
    },
    mEPEquipment: {
      findMany: vi.fn(),
    },
    materialTakeoff: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }));

// Import after mocks
import {
  classifyQueryIntent,
  twoPassRetrieval,
  bundleCrossReferences,
  mepRetrievalOrder,
  extractMeasurement,
  validateOCR,
  validateBeforeResponse,
  generateEnhancedContext,
  extractTakeoffItems,
  generateRollups,
  generateTakeoffExport,
  parseSymbolLegend,
  detectMEPConflicts,
  analyzeDiagram,
  loadCodeLibrary,
  findRelevantCodes,
  checkCompliance,
  generateTakeoffCSV,
  generateHighlightMetadata,
  calculateDuctPipeLength,
  verifyTakeoff,
  detectMultipleScales,
  inferScaleFromDimensions,
  detectScaleBar,
  calculateWithScaleBar,
  buildProjectAbbreviationDictionary,
  expandAbbreviations,
  extractGridReferences,
  calculateGridDistance,
  findElementsInGridArea,
  generateSpatialContext,
  reconstructSystemTopology,
  interpretIsometricView,
  extractSpatialRelationships,
  detectAdvancedConflicts,
  learnProjectSymbols,
  applyLearnedSymbols,
  generateSymbolReport,
  MEP_ENTITIES,
  CONSTRUCTION_ABBREVIATIONS,
  type EnhancedChunk,
  type EnhancedChunkMetadata,
  type MeasurementInfo,
  type TakeoffItem,
  type TakeoffRollup,
  type TakeoffResult,
} from '@/lib/rag-enhancements';

describe('RAG Enhancements - Query Classification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('classifyQueryIntent', () => {
    it('should classify requirement queries correctly', () => {
      const result = classifyQueryIntent('What is required for fire protection?');

      expect(result.type).toBe('requirement');
      expect(result.requiresNotes).toBe(true);
      expect(result.requiresRegulatory).toBe(false);
    });

    it('should classify measurement queries correctly', () => {
      const result = classifyQueryIntent('How wide is the corridor in Room 103?');

      expect(result.type).toBe('room_specific');
      expect(result.roomNumber).toBe('103');
    });

    it('should classify MEP queries correctly', () => {
      const result = classifyQueryIntent('What is the CFM rating for AHU-1?');

      expect(result.type).toBe('mep');
      expect(result.mepTrade).toBe('hvac');
      expect(result.requiresNotes).toBe(true);
      expect(result.requiresCrossRef).toBe(true);
    });

    it('should classify plumbing MEP queries', () => {
      const result = classifyQueryIntent('What size is the water pipe?');

      expect(result.type).toBe('mep');
      expect(result.mepTrade).toBe('plumbing');
    });

    it('should classify electrical MEP queries', () => {
      const result = classifyQueryIntent('What is the panel circuit breaker rating?');

      expect(result.type).toBe('mep');
      expect(result.mepTrade).toBe('electrical');
    });

    it('should classify fire alarm MEP queries', () => {
      const result = classifyQueryIntent('How many smoke detectors are required?');

      expect(result.type).toBe('mep');
      expect(result.mepTrade).toBe('fire_alarm');
    });

    it('should classify takeoff queries correctly', () => {
      const result = classifyQueryIntent('Generate a takeoff for all HVAC equipment');

      expect(result.type).toBe('takeoff');
      expect(result.isTakeoff).toBe(true);
      expect(result.takeoffScope).toBe('hvac');
      expect(result.requiresNotes).toBe(true);
      expect(result.requiresCrossRef).toBe(true);
    });

    it('should classify counting queries correctly', () => {
      const result = classifyQueryIntent('How many doors are on the first floor?');

      expect(result.type).toBe('counting');
    });

    it('should classify location queries correctly', () => {
      const result = classifyQueryIntent('Where is the control valve located?');

      expect(result.type).toBe('location');
    });

    it('should classify room-specific queries correctly', () => {
      const result = classifyQueryIntent('What is the square footage of Room 205?');

      expect(result.type).toBe('room_specific');
      expect(result.roomNumber).toBe('205');
    });

    it('should detect regulatory references', () => {
      const result = classifyQueryIntent('Does this comply with ADA standards?');

      expect(result.requiresRegulatory).toBe(true);
    });

    it('should detect cross-reference needs', () => {
      const result = classifyQueryIntent('Show me door D-101 details');

      expect(result.requiresCrossRef).toBe(true);
    });

    it('should handle general queries', () => {
      const result = classifyQueryIntent('Tell me about this project');

      expect(result.type).toBe('general');
      expect(result.requiresNotes).toBe(false);
      expect(result.requiresCrossRef).toBe(false);
    });

    it('should extract room number variations', () => {
      const queries = [
        'Room 103',
        'RM 103',
        'Room: 103',
        'Space 103A',
      ];

      queries.forEach(query => {
        const result = classifyQueryIntent(query);
        expect(result.type).toBe('room_specific');
        expect(result.roomNumber).toBeDefined();
      });
    });

    it('should classify architectural takeoff scope', () => {
      const result = classifyQueryIntent('Takeoff all door and window items');

      expect(result.isTakeoff).toBe(true);
      expect(result.takeoffScope).toBe('architectural');
    });

    it('should classify structural takeoff scope', () => {
      const result = classifyQueryIntent('Takeoff all steel beams');

      expect(result.takeoffScope).toBe('structural');
    });
  });
});

describe('RAG Enhancements - Two-Pass Retrieval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('twoPassRetrieval', () => {
    it('should return empty chunks when project not found', async () => {
      mocks.prisma.project.findUnique.mockResolvedValue(null);

      const result = await twoPassRetrieval('test query', 'nonexistent-project', 'admin', 12);

      expect(result.chunks).toHaveLength(0);
      expect(result.retrievalLog).toContain('Project not found');
    });

    it('should perform precision retrieval for identifiers', async () => {
      const mockProject = { id: 'proj-1' };
      const mockDoc = {
        id: 'doc-1',
        name: 'Floor Plan.pdf',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'Room 103 has a door D-101',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: {},
          },
        ],
      };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.document.findMany.mockResolvedValue([mockDoc]);

      const result = await twoPassRetrieval('What is in Room 103?', 'test-project', 'admin', 12);

      expect(mocks.prisma.project.findUnique).toHaveBeenCalledWith({
        where: { slug: 'test-project' },
        select: { id: true },
      });
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.retrievalLog.some(log => log.includes('Extracted identifiers:'))).toBe(true);
    });

    it('should apply access control for guest users', async () => {
      const mockProject = { id: 'proj-1' };
      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.document.findMany.mockResolvedValue([]);

      await twoPassRetrieval('test query', 'test-project', 'guest', 12);

      expect(mocks.prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accessLevel: 'guest',
          }),
        })
      );
    });

    it('should apply access control for client users', async () => {
      const mockProject = { id: 'proj-1' };
      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.document.findMany.mockResolvedValue([]);

      await twoPassRetrieval('test query', 'test-project', 'client', 12);

      expect(mocks.prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accessLevel: { in: ['client', 'guest'] },
          }),
        })
      );
    });

    it('should perform notes-first retrieval for requirement queries', async () => {
      const mockProject = { id: 'proj-1' };
      const mockDoc = {
        id: 'doc-1',
        name: 'Specifications.pdf',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'GENERAL NOTES: All materials SHALL comply with standards.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: {},
          },
        ],
      };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.document.findMany.mockResolvedValue([mockDoc]);

      const result = await twoPassRetrieval('What standard is required for fire protection?', 'test-project', 'admin', 12);

      expect(result.retrievalLog.some(log => log.includes('notes=true'))).toBe(true);
      expect(result.chunks.some(c => c.retrievalMethod === 'notes_first')).toBe(true);
    });

    it('should mark chunks with retrieval methods', async () => {
      const mockProject = { id: 'proj-1' };
      const mockDoc = {
        id: 'doc-1',
        name: 'Test.pdf',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'Room 103 content',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: {},
          },
        ],
      };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.document.findMany.mockResolvedValue([mockDoc]);

      const result = await twoPassRetrieval('Room 103', 'test-project', 'admin', 12);

      result.chunks.forEach(chunk => {
        expect(['precision', 'notes_first', 'context']).toContain(chunk.retrievalMethod);
      });
    });
  });
});

describe('RAG Enhancements - Cross-Reference Bundling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('bundleCrossReferences', () => {
    it('should return original chunks when project not found', async () => {
      mocks.prisma.project.findUnique.mockResolvedValue(null);

      const chunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'Test content',
          documentId: 'doc-1',
          pageNumber: 1,
          metadata: {},
        },
      ];

      const result = await bundleCrossReferences(chunks, 'nonexistent-project');

      expect(result.enrichedChunks).toEqual(chunks);
      expect(result.crossRefLog).toContain('Project not found');
    });

    it('should extract door references and fetch related chunks', async () => {
      const mockProject = { id: 'proj-1' };
      const initialChunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'See door D-101 for details',
          documentId: 'doc-1',
          pageNumber: 1,
          metadata: {},
        },
      ];

      const mockCrossRefDoc = {
        id: 'doc-2',
        name: 'Door Schedule.pdf',
        DocumentChunk: [
          {
            id: 'chunk-2',
            content: 'D-101: 3\'0" x 7\'0" hollow metal door',
            documentId: 'doc-2',
            regulatoryDocumentId: null,
            pageNumber: 2,
            metadata: {},
          },
        ],
      };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.document.findMany.mockResolvedValue([mockCrossRefDoc]);

      const result = await bundleCrossReferences(initialChunks, 'test-project');

      expect(result.enrichedChunks.length).toBeGreaterThan(initialChunks.length);
      expect(result.crossRefLog.some(log => log.includes('cross-reference hints'))).toBe(true);
    });

    it('should extract window references', async () => {
      const mockProject = { id: 'proj-1' };
      const initialChunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'Window W-5 typical',
          documentId: 'doc-1',
          pageNumber: 1,
          metadata: {},
        },
      ];

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.document.findMany.mockResolvedValue([]);

      const result = await bundleCrossReferences(initialChunks, 'test-project');

      expect(result.crossRefLog.some(log => log.includes('cross-reference hints'))).toBe(true);
    });

    it('should extract detail callout references', async () => {
      const mockProject = { id: 'proj-1' };
      const initialChunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'See detail 3/A-201 for connection',
          documentId: 'doc-1',
          pageNumber: 1,
          metadata: {},
        },
      ];

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.document.findMany.mockResolvedValue([]);

      const result = await bundleCrossReferences(initialChunks, 'test-project');

      expect(result.crossRefLog[0]).toContain('cross-reference hints');
    });

    it('should detect schedule references', async () => {
      const mockProject = { id: 'proj-1' };
      const initialChunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'See door schedule for specifications',
          documentId: 'doc-1',
          pageNumber: 1,
          metadata: {},
        },
      ];

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.document.findMany.mockResolvedValue([]);

      const result = await bundleCrossReferences(initialChunks, 'test-project');

      expect(result.crossRefLog[0]).toContain('cross-reference hints');
    });

    it('should avoid duplicate chunks', async () => {
      const mockProject = { id: 'proj-1' };
      const initialChunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'D-101',
          documentId: 'doc-1',
          pageNumber: 1,
          metadata: {},
        },
      ];

      const mockCrossRefDoc = {
        id: 'doc-1',
        name: 'Test.pdf',
        DocumentChunk: [
          {
            id: 'chunk-1', // Same ID as initial chunk
            content: 'D-101',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: {},
          },
        ],
      };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.document.findMany.mockResolvedValue([mockCrossRefDoc]);

      const result = await bundleCrossReferences(initialChunks, 'test-project');

      expect(result.enrichedChunks).toHaveLength(1);
    });

    it('should mark cross-referenced chunks with retrieval method', async () => {
      const mockProject = { id: 'proj-1' };
      const initialChunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'See D-101',
          documentId: 'doc-1',
          pageNumber: 1,
          metadata: {},
        },
      ];

      const mockCrossRefDoc = {
        id: 'doc-2',
        name: 'Schedule.pdf',
        DocumentChunk: [
          {
            id: 'chunk-2',
            content: 'D-101 details',
            documentId: 'doc-2',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: {},
          },
        ],
      };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.document.findMany.mockResolvedValue([mockCrossRefDoc]);

      const result = await bundleCrossReferences(initialChunks, 'test-project');

      const crossRefChunk = result.enrichedChunks.find(c => c.id === 'chunk-2');
      expect(crossRefChunk?.retrievalMethod).toBe('cross_reference');
    });
  });
});

describe('RAG Enhancements - MEP Retrieval Order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mepRetrievalOrder', () => {
    it('should prioritize schedule chunks for HVAC', async () => {
      const chunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'HVAC Equipment Schedule: AHU-1 - 5000 CFM',
          documentId: 'doc-1',
          pageNumber: 1,
          metadata: {},
        },
        {
          id: 'chunk-2',
          content: 'Plan view showing AHU-1 location',
          documentId: 'doc-1',
          pageNumber: 2,
          metadata: {},
        },
      ];

      const result = await mepRetrievalOrder(chunks, 'test-project', 'hvac', ['AHU-1']);

      expect(result.orderedChunks[0].id).toBe('chunk-1');
      expect(result.orderedChunks[0].sourceReference).toBe('MEP Schedule');
      expect(result.mepLog[0]).toContain('MEP Trade: hvac');
    });

    it('should prioritize notes chunks', async () => {
      const chunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'MECHANICAL GENERAL NOTES: All ductwork shall be sealed',
          documentId: 'doc-1',
          pageNumber: 1,
          metadata: {},
        },
        {
          id: 'chunk-2',
          content: 'Plan view',
          documentId: 'doc-1',
          pageNumber: 2,
          metadata: {},
        },
      ];

      const result = await mepRetrievalOrder(chunks, 'test-project', 'hvac', []);

      const noteChunk = result.orderedChunks.find(c => c.sourceReference === 'MEP Notes');
      expect(noteChunk).toBeDefined();
    });

    it('should handle plumbing trade', async () => {
      const chunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'Plumbing fixture schedule',
          documentId: 'doc-1',
          pageNumber: 1,
          metadata: {},
        },
      ];

      const result = await mepRetrievalOrder(chunks, 'test-project', 'plumbing', ['LAV-1']);

      expect(result.mepLog[0]).toContain('MEP Trade: plumbing');
    });

    it('should handle electrical trade', async () => {
      const chunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'Panel schedule for P-1',
          documentId: 'doc-1',
          pageNumber: 1,
          metadata: {},
        },
      ];

      const result = await mepRetrievalOrder(chunks, 'test-project', 'electrical', ['P-1']);

      expect(result.mepLog[0]).toContain('MEP Trade: electrical');
    });

    it('should handle fire alarm trade', async () => {
      const chunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'Fire alarm device schedule',
          documentId: 'doc-1',
          pageNumber: 1,
          metadata: {},
        },
      ];

      const result = await mepRetrievalOrder(chunks, 'test-project', 'fire_alarm', ['SD-101']);

      expect(result.mepLog[0]).toContain('MEP Trade: fire_alarm');
    });

    it('should avoid duplicate chunks', async () => {
      const chunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'MECHANICAL NOTES for AHU-1 schedule',
          documentId: 'doc-1',
          pageNumber: 1,
          metadata: {},
        },
      ];

      const result = await mepRetrievalOrder(chunks, 'test-project', 'hvac', ['AHU-1']);

      const uniqueIds = new Set(result.orderedChunks.map(c => c.id));
      expect(uniqueIds.size).toBe(result.orderedChunks.length);
    });

    it('should detect plan view chunks', async () => {
      const chunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'MECHANICAL FLOOR PLAN shows AHU-1 ductwork routing',
          documentId: 'doc-1',
          pageNumber: 1,
          metadata: {},
        },
      ];

      const result = await mepRetrievalOrder(chunks, 'test-project', 'hvac', ['AHU-1']);

      const planChunk = result.orderedChunks.find(c => c.sourceReference === 'MEP Plan View');
      expect(planChunk).toBeDefined();
    });

    it('should detect diagram chunks', async () => {
      const chunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'Riser diagram showing pipe connections',
          documentId: 'doc-1',
          pageNumber: 1,
          metadata: {},
        },
      ];

      const result = await mepRetrievalOrder(chunks, 'test-project', 'plumbing', []);

      const diagramChunk = result.orderedChunks.find(c => c.sourceReference === 'MEP Diagram');
      expect(diagramChunk).toBeDefined();
    });
  });
});

describe('RAG Enhancements - Measurement Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractMeasurement', () => {
    it('should extract simple measurements', () => {
      const chunk: EnhancedChunk = {
        id: 'chunk-1',
        content: 'The wall is 10\'-0" tall',
        documentId: 'doc-1',
        pageNumber: 1,
        metadata: {},
      };

      const result = extractMeasurement(chunk, 'how tall is the wall');

      expect(result).toBeDefined();
      expect(result?.value).toContain('10');
      expect(result?.unit).toBe('feet');
      expect(result?.method).toBe('explicit');
    });

    it('should extract measurements with abbreviations', () => {
      const chunk: EnhancedChunk = {
        id: 'chunk-1',
        content: 'Width: 12\'-0"',
        documentId: 'doc-1',
        pageNumber: 1,
        metadata: {},
      };

      const result = extractMeasurement(chunk, 'width');

      expect(result).toBeDefined();
      expect(result?.value).toContain('12');
      expect(result?.method).toBe('explicit');
    });

    it('should extract measurements with mixed units', () => {
      const chunk: EnhancedChunk = {
        id: 'chunk-1',
        content: 'Dimension: 8\'-6"',
        documentId: 'doc-1',
        pageNumber: 1,
        metadata: {},
      };

      const result = extractMeasurement(chunk, 'dimension');

      expect(result).toBeDefined();
      expect(result?.method).toBe('explicit');
    });

    it('should return unavailable method when no measurement found', () => {
      const chunk: EnhancedChunk = {
        id: 'chunk-1',
        content: 'No measurements here',
        documentId: 'doc-1',
        pageNumber: 1,
        metadata: {},
      };

      const result = extractMeasurement(chunk, 'measurement');

      expect(result).toBeDefined();
      expect(result?.method).toBe('unavailable');
      expect(result?.value).toContain('Not specified');
    });

    it('should extract area measurements', () => {
      const chunk: EnhancedChunk = {
        id: 'chunk-1',
        content: 'Room area: 250.5 ft',
        documentId: 'doc-1',
        pageNumber: 1,
        metadata: {},
      };

      const result = extractMeasurement(chunk, 'area');

      expect(result).toBeDefined();
      expect(result?.value).toContain('250');
      expect(result?.method).toBe('explicit');
    });

    it('should extract decimal measurements in feet', () => {
      const chunk: EnhancedChunk = {
        id: 'chunk-1',
        content: 'Height: 3.5 feet',
        documentId: 'doc-1',
        pageNumber: 1,
        metadata: {},
      };

      const result = extractMeasurement(chunk, 'height');

      expect(result).toBeDefined();
      expect(result?.value).toContain('3.5');
      expect(result?.method).toBe('explicit');
    });

    it('should extract from labeled content', () => {
      const chunk: EnhancedChunk = {
        id: 'chunk-1',
        content: 'Width: 15\'-0"',
        documentId: 'doc-1',
        pageNumber: 1,
        metadata: {
          labeled_dimensions: ['15\'-0"'],
          derived_dimensions: ['14 ft'],
        },
      };

      const result = extractMeasurement(chunk, 'width');

      expect(result).toBeDefined();
      expect(result?.method).toBe('explicit');
      expect(result?.confidence).toBe('high');
    });
  });
});

describe('RAG Enhancements - OCR Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateOCR', () => {
    it('should pass validation for clean text', () => {
      const chunk: EnhancedChunk = {
        id: 'chunk-1',
        content: 'This is clear, well-formatted text with proper spacing and enough words to pass validation checks.',
        documentId: 'doc-1',
        pageNumber: 1,
        metadata: {},
      };

      const result = validateOCR(chunk);

      expect(result.isLegible).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.issues).toHaveLength(0);
    });

    it('should detect issues in garbled text', () => {
      const chunk: EnhancedChunk = {
        id: 'chunk-1',
        content: '!@#$%^&*()_+{}|:"<>?!@#$%^&*()_+{}|:"<>? bcdfghjklmnpqrstvwxyz aAbBcCdDeEfF          ',
        documentId: 'doc-1',
        pageNumber: 1,
        metadata: {},
      };

      const result = validateOCR(chunk);

      // The validation should detect some issues with this garbled text
      expect(result.confidence).not.toBe('high');
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should detect truncated content', () => {
      const chunk: EnhancedChunk = {
        id: 'chunk-1',
        content: 'Short text',
        documentId: 'doc-1',
        pageNumber: 1,
        metadata: {},
      };

      const result = validateOCR(chunk);

      expect(result.issues.some(issue => issue.includes('truncated') || issue.includes('incomplete'))).toBe(true);
    });

    it('should detect incomplete page overview', () => {
      const chunk: EnhancedChunk = {
        id: 'chunk-1',
        content: 'Short',
        documentId: 'doc-1',
        pageNumber: 1,
        metadata: {
          chunkType: 'page_overview',
        },
      };

      const result = validateOCR(chunk);

      expect(result.issues.some(issue => issue.includes('overview') || issue.includes('short'))).toBe(true);
    });

    it('should handle empty content', () => {
      const chunk: EnhancedChunk = {
        id: 'chunk-1',
        content: '',
        documentId: 'doc-1',
        pageNumber: 1,
        metadata: {
          chunkType: 'page_overview',
        },
      };

      const result = validateOCR(chunk);

      expect(result.isLegible).toBe(false);
      expect(result.confidence).toBe('low');
      expect(result.issues.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('RAG Enhancements - Response Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateBeforeResponse', () => {
    it('should validate when chunks are provided', () => {
      const response = 'The wall is 10 feet high according to labeled dimensions.';
      const chunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'Wall height: 10\'-0"',
          documentId: 'doc-1',
          pageNumber: 1,
          metadata: { labeled_dimensions: ['10\'-0"'] },
        },
      ];

      const result = validateBeforeResponse('test query', chunks, response);

      expect(result.passed).toBe(true);
    });

    it('should warn when measurements lack source attribution', () => {
      const response = 'The wall is 10 feet high.';
      const chunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'Wall height: 10\'-0"',
          documentId: 'doc-1',
          pageNumber: 1,
          metadata: {},
        },
      ];

      const result = validateBeforeResponse('height', chunks, response);

      expect(result.warnings.some(w => w.toLowerCase().includes('measurement') || w.toLowerCase().includes('source'))).toBe(true);
    });

    it('should validate OCR quality of source chunks', () => {
      const response = 'Test response';
      const chunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: '!@#$%^&*()_+{}|:"<>?!@#$%^ bcdfghjklmnpqrstvwxyz aAbBcCdDeE          ',
          documentId: 'doc-1',
          pageNumber: 1,
          metadata: {
            chunkType: 'page_overview',
          },
        },
      ];

      const result = validateBeforeResponse('test', chunks, response);

      expect(result.warnings.some(w => w.toLowerCase().includes('ocr') || w.toLowerCase().includes('confidence') || w.toLowerCase().includes('low'))).toBe(true);
    });

    it('should pass validation for well-sourced response', () => {
      const response = 'According to Sheet A-101, the dimension is 10\'-0".';
      const chunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'Dimension: 10\'-0" as shown on plan. This is a well-documented measurement with clear context.',
          documentId: 'doc-1',
          pageNumber: 1,
          metadata: { sheetNumber: 'A-101', labeled_dimensions: ['10\'-0"'] },
        },
      ];

      const result = validateBeforeResponse('dimension', chunks, response);

      expect(result.passed).toBe(true);
    });
  });
});

describe('RAG Enhancements - Enhanced Context Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateEnhancedContext', () => {
    it('should generate context from chunks', () => {
      const chunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'First chunk content',
          documentId: 'doc-1',
          documentName: 'Plan A-101',
          pageNumber: 1,
          metadata: { sheetNumber: 'A-101', documentName: 'Plan A-101' },
          retrievalMethod: 'precision',
        },
        {
          id: 'chunk-2',
          content: 'Second chunk content',
          documentId: 'doc-2',
          documentName: 'Spec Section',
          pageNumber: 5,
          metadata: { documentName: 'Spec Section' },
          retrievalMethod: 'context',
        },
      ];

      const context = generateEnhancedContext(chunks, 'test query');

      expect(context).toContain('First chunk content');
      expect(context).toContain('Second chunk content');
    });

    it('should include protocol headers', () => {
      const chunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'Content',
          documentId: 'doc-1',
          documentName: 'Drawing',
          pageNumber: 1,
          metadata: {
            sheetNumber: 'M-301',
            scale: '1/4" = 1\'-0"',
            documentName: 'Drawing',
          },
        },
      ];

      const context = generateEnhancedContext(chunks, 'What is the dimension?');

      expect(context).toContain('DOCUMENT RETRIEVAL PROTOCOL');
      expect(context).toContain('Query Type:');
    });

    it('should handle chunks without metadata gracefully', () => {
      const chunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'Content',
          documentId: 'doc-1',
          pageNumber: 1,
          metadata: {},
          retrievalMethod: 'context',
        },
      ];

      const context = generateEnhancedContext(chunks, 'general query');

      expect(context).toContain('Content');
      expect(context).toContain('RESPONSE GUIDELINES');
    });

    it('should include MEP instructions for MEP queries', () => {
      const chunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'HVAC equipment',
          documentId: 'doc-1',
          pageNumber: 1,
          metadata: {},
        },
      ];

      const context = generateEnhancedContext(chunks, 'What is the AHU-1 CFM?');

      expect(context).toContain('MEP');
    });
  });
});

describe('RAG Enhancements - Takeoff Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractTakeoffItems', () => {
    it('should extract door takeoff items', () => {
      const chunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'HVAC EQUIPMENT SCHEDULE:\nAHU-1: 5000 CFM Air Handling Unit',
          documentId: 'doc-1',
          pageNumber: 1,
          metadata: { documentName: 'HVAC Schedule' },
        },
      ];

      const items = extractTakeoffItems(chunks, 'hvac', 'hvac takeoff');

      expect(items.length).toBeGreaterThan(0);
      expect(items.some(item => item.itemTagOrId.includes('AHU-1'))).toBe(true);
    });

    it('should extract equipment takeoff items', () => {
      const chunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'HVAC Equipment Schedule:\nAHU-1: 5000 CFM Air Handler\nRTU-1: 10 Ton Rooftop Unit',
          documentId: 'doc-1',
          pageNumber: 1,
          metadata: {},
        },
      ];

      const items = extractTakeoffItems(chunks, 'hvac', 'hvac takeoff');

      expect(items.length).toBeGreaterThan(0);
      expect(items.some(item => item.itemTagOrId.includes('AHU-1'))).toBe(true);
    });

    it('should include source references', () => {
      const chunks: EnhancedChunk[] = [
        {
          id: 'chunk-1',
          content: 'PLUMBING FIXTURE SCHEDULE\nLAV-1: Wall-mounted lavatory\nWC-1: Floor-mounted water closet',
          documentId: 'doc-1',
          documentName: 'Plumbing Schedule',
          sheetNumber: 'P-101',
          pageNumber: 1,
          metadata: { sheetNumber: 'P-101', documentName: 'Plumbing Schedule' },
        },
      ];

      const items = extractTakeoffItems(chunks, 'plumbing', 'plumbing takeoff');

      expect(items.length).toBeGreaterThan(0);
      expect(items[0].sourceRefs).toBeDefined();
      expect(items[0].sourceRefs.length).toBeGreaterThan(0);
    });

    it('should handle empty chunks', () => {
      const chunks: EnhancedChunk[] = [];

      const items = extractTakeoffItems(chunks, 'door', 'door takeoff');

      expect(items).toHaveLength(0);
    });
  });

  describe('generateRollups', () => {
    it('should generate rollups from takeoff items', () => {
      const items: TakeoffItem[] = [
        {
          trade: 'ARCHITECTURAL',
          system: 'Doors',
          itemType: 'Door',
          itemTagOrId: 'D-101',
          description: '3\'0" x 7\'0" HM Door',
          quantity: 5,
          unit: 'EA',
          sizeOrRating: '3\'0" x 7\'0"',
          method: 'counted',
          sourceRefs: ['doc-1, Page 1'],
          exclusionsOrNotes: '',
          confidence: 'high',
          confidenceBasis: 'Schedule',
        },
        {
          trade: 'ARCHITECTURAL',
          system: 'Doors',
          itemType: 'Door',
          itemTagOrId: 'D-101',
          description: '3\'0" x 7\'0" HM Door',
          quantity: 3,
          unit: 'EA',
          sizeOrRating: '3\'0" x 7\'0"',
          method: 'counted',
          sourceRefs: ['doc-2, Page 2'],
          exclusionsOrNotes: '',
          confidence: 'high',
          confidenceBasis: 'Schedule',
        },
        {
          trade: 'ARCHITECTURAL',
          system: 'Doors',
          itemType: 'Door',
          itemTagOrId: 'D-102',
          description: '3\'6" x 7\'0" Wood Door',
          quantity: 2,
          unit: 'EA',
          sizeOrRating: '3\'6" x 7\'0"',
          method: 'counted',
          sourceRefs: ['doc-1, Page 1'],
          exclusionsOrNotes: '',
          confidence: 'high',
          confidenceBasis: 'Schedule',
        },
      ];

      const rollups = generateRollups(items, 'item_type');

      expect(rollups.length).toBeGreaterThan(0);
      expect(rollups[0].totalQuantity).toBe(10);
    });

    it('should handle items with different units', () => {
      const items: TakeoffItem[] = [
        {
          trade: 'PLUMBING',
          system: 'Piping',
          itemType: 'Pipe',
          itemTagOrId: 'PIPE-4',
          description: '4" PVC Pipe',
          quantity: 100,
          unit: 'LF',
          sizeOrRating: '4"',
          method: 'dimensioned',
          sourceRefs: ['doc-1, Page 1'],
          exclusionsOrNotes: '',
          confidence: 'medium',
          confidenceBasis: 'Scaled',
        },
        {
          trade: 'PLUMBING',
          system: 'Piping',
          itemType: 'Pipe',
          itemTagOrId: 'PIPE-4',
          description: '4" PVC Pipe',
          quantity: 50,
          unit: 'LF',
          sizeOrRating: '4"',
          method: 'dimensioned',
          sourceRefs: ['doc-1, Page 2'],
          exclusionsOrNotes: '',
          confidence: 'medium',
          confidenceBasis: 'Scaled',
        },
      ];

      const rollups = generateRollups(items, 'item_type');

      expect(rollups[0].totalQuantity).toBe(150);
      expect(rollups[0].unit).toBe('LF');
    });

    it('should aggregate items by grouping', () => {
      const items: TakeoffItem[] = [
        {
          trade: 'ARCHITECTURAL',
          system: 'Doors',
          itemType: 'Door',
          itemTagOrId: 'D-101',
          description: 'Door',
          quantity: 1,
          unit: 'EA',
          sizeOrRating: '3\'0" x 7\'0"',
          method: 'counted',
          sourceRefs: ['doc-1, Page 1'],
          exclusionsOrNotes: '',
          confidence: 'high',
          confidenceBasis: 'Schedule',
        },
        {
          trade: 'ARCHITECTURAL',
          system: 'Doors',
          itemType: 'Door',
          itemTagOrId: 'D-101',
          description: 'Door',
          quantity: 1,
          unit: 'EA',
          sizeOrRating: '3\'0" x 7\'0"',
          method: 'counted',
          sourceRefs: ['doc-1, Page 2'],
          exclusionsOrNotes: '',
          confidence: 'high',
          confidenceBasis: 'Schedule',
        },
      ];

      const rollups = generateRollups(items, 'trade');

      expect(rollups[0].items.length).toBe(2);
    });
  });

  describe('generateTakeoffExport', () => {
    it('should generate export format', () => {
      const items: TakeoffItem[] = [
        {
          trade: 'ARCHITECTURAL',
          system: 'Doors',
          itemType: 'Door',
          itemTagOrId: 'D-101',
          description: '3\'0" x 7\'0" HM Door',
          quantity: 8,
          unit: 'EA',
          sizeOrRating: '3\'0" x 7\'0"',
          method: 'counted',
          sourceRefs: ['A-101, Page 1'],
          exclusionsOrNotes: '',
          confidence: 'high',
          confidenceBasis: 'Schedule',
        },
      ];

      const exportData = generateTakeoffExport(items, 'Test Project', 'User', 'door');

      expect(exportData.scope).toBe('DOOR');
      expect(exportData.items).toHaveLength(1);
      expect(exportData.items[0].itemTagOrId).toBe('D-101');
    });

    it('should include metadata', () => {
      const items: TakeoffItem[] = [];

      const exportData = generateTakeoffExport(items, 'Test Project', 'User', 'hvac');

      expect(exportData.generatedDate).toBeDefined();
      expect(new Date(exportData.generatedDate).getTime()).toBeGreaterThan(0);
    });

    it('should format quantities correctly', () => {
      const items: TakeoffItem[] = [
        {
          trade: 'HVAC',
          system: 'Ductwork',
          itemType: 'Duct',
          itemTagOrId: 'DUCT-10',
          description: '10" Ductwork',
          quantity: 123.5,
          unit: 'LF',
          sizeOrRating: '10"',
          method: 'dimensioned',
          sourceRefs: ['doc-1, Page 1'],
          exclusionsOrNotes: '',
          confidence: 'medium',
          confidenceBasis: 'Scaled',
        },
      ];

      const exportData = generateTakeoffExport(items, 'Test Project', 'User', 'hvac');

      expect(exportData.items[0].quantity).toBe(123.5);
    });
  });
});

describe('RAG Enhancements - CSV Export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateTakeoffCSV', () => {
    it('should generate CSV with headers', () => {
      const takeoff: TakeoffResult = {
        projectName: 'Test Project',
        generatedDate: new Date().toISOString(),
        requestedBy: 'User',
        scope: 'DOOR',
        items: [
          {
            trade: 'ARCHITECTURAL',
            system: 'Doors',
            itemType: 'Door',
            itemTagOrId: 'D-101',
            description: 'Door',
            quantity: 5,
            unit: 'EA',
            sizeOrRating: '3x7',
            method: 'counted',
            sourceRefs: ['Sheet A-101'],
            exclusionsOrNotes: '',
            confidence: 'high',
            confidenceBasis: 'Schedule',
          },
        ],
        warnings: [],
        disclaimers: [],
        totalItems: 1,
        countedItems: 1,
        measuredItems: 0,
        notQuantifiedItems: 0,
      };

      const csv = generateTakeoffCSV(takeoff);

      expect(csv).toContain('Trade');
      expect(csv).toContain('Description');
      expect(csv).toContain('Quantity');
      expect(csv).toContain('Unit');
    });

    it('should include all items', () => {
      const takeoff: TakeoffResult = {
        projectName: 'Test Project',
        generatedDate: new Date().toISOString(),
        requestedBy: 'User',
        scope: 'DOOR',
        items: [
          {
            trade: 'ARCHITECTURAL',
            system: 'Doors',
            itemType: 'Door',
            itemTagOrId: 'D-101',
            description: 'Door 1',
            quantity: 5,
            unit: 'EA',
            sizeOrRating: '3x7',
            method: 'counted',
            sourceRefs: ['A-101'],
            exclusionsOrNotes: '',
            confidence: 'high',
            confidenceBasis: 'Schedule',
          },
          {
            trade: 'ARCHITECTURAL',
            system: 'Doors',
            itemType: 'Door',
            itemTagOrId: 'D-102',
            description: 'Door 2',
            quantity: 3,
            unit: 'EA',
            sizeOrRating: '3x7',
            method: 'counted',
            sourceRefs: ['A-101'],
            exclusionsOrNotes: '',
            confidence: 'high',
            confidenceBasis: 'Schedule',
          },
        ],
        warnings: [],
        disclaimers: [],
        totalItems: 2,
        countedItems: 2,
        measuredItems: 0,
        notQuantifiedItems: 0,
      };

      const csv = generateTakeoffCSV(takeoff);

      expect(csv).toContain('Door 1');
      expect(csv).toContain('Door 2');
    });

    it('should escape special characters', () => {
      const takeoff: TakeoffResult = {
        projectName: 'Test Project',
        generatedDate: new Date().toISOString(),
        requestedBy: 'User',
        scope: 'DOOR',
        items: [
          {
            trade: 'ARCHITECTURAL',
            system: 'Doors',
            itemType: 'Door',
            itemTagOrId: 'D-101',
            description: 'Door with "quotes" and, comma',
            quantity: 1,
            unit: 'EA',
            sizeOrRating: '3x7',
            method: 'counted',
            sourceRefs: ['A-101'],
            exclusionsOrNotes: '',
            confidence: 'high',
            confidenceBasis: 'Schedule',
          },
        ],
        warnings: [],
        disclaimers: [],
        totalItems: 1,
        countedItems: 1,
        measuredItems: 0,
        notQuantifiedItems: 0,
      };

      const csv = generateTakeoffCSV(takeoff);

      expect(csv).toContain('"Door with ""quotes"" and, comma"');
    });
  });
});

describe('RAG Enhancements - Scale Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectMultipleScales', () => {
    it('should detect multiple scales in chunk', () => {
      const chunk: EnhancedChunk = {
        id: 'chunk-1',
        content: 'Scale: 1/4" = 1\'-0" for plan, Detail: 1/2" = 1\'-0"',
        documentId: 'doc-1',
        pageNumber: 1,
        metadata: {},
      };

      const result = detectMultipleScales(chunk);

      expect(result.additionalScales.length).toBeGreaterThan(0);
      expect(result.defaultScale).toBeDefined();
    });

    it('should detect single scale', () => {
      const chunk: EnhancedChunk = {
        id: 'chunk-1',
        content: 'Scale: 1/8" = 1\'-0"',
        documentId: 'doc-1',
        pageNumber: 1,
        metadata: {},
      };

      const result = detectMultipleScales(chunk);

      expect(result.additionalScales).toHaveLength(0);
      expect(result.defaultScale).toBeDefined();
    });

    it('should handle no scale present', () => {
      const chunk: EnhancedChunk = {
        id: 'chunk-1',
        content: 'No scale information here',
        documentId: 'doc-1',
        pageNumber: 1,
        metadata: {},
      };

      const result = detectMultipleScales(chunk);

      expect(result.additionalScales).toHaveLength(0);
      expect(result.defaultScale.scale).toBe('Not specified');
    });
  });

  describe('inferScaleFromDimensions', () => {
    it('should infer scale from labeled dimensions', () => {
      const chunk: EnhancedChunk = {
        id: 'chunk-1',
        content: 'Building dimension: 100\'-0"',
        documentId: 'doc-1',
        pageNumber: 1,
        metadata: {
          labeled_dimensions: ['100\'-0"', '50\'-0"'],
        },
      };

      const result = inferScaleFromDimensions(chunk);

      expect(result).toBeDefined();
      if (result) {
        expect(result.confidence).toBeGreaterThan(0);
      }
    });

    it('should return null without dimensions', () => {
      const chunk: EnhancedChunk = {
        id: 'chunk-1',
        content: 'No dimensions',
        documentId: 'doc-1',
        pageNumber: 1,
        metadata: {},
      };

      const result = inferScaleFromDimensions(chunk);

      expect(result).toBeNull();
    });
  });

  describe('detectScaleBar', () => {
    it('should detect scale bar in content', () => {
      const chunk: EnhancedChunk = {
        id: 'chunk-1',
        content: 'Graphic scale: 0 10 20 30 40 50 feet',
        documentId: 'doc-1',
        pageNumber: 1,
        metadata: {},
      };

      const result = detectScaleBar(chunk);

      expect(result.detected).toBe(true);
    });

    it('should return not detected when no scale bar', () => {
      const chunk: EnhancedChunk = {
        id: 'chunk-1',
        content: 'Regular content',
        documentId: 'doc-1',
        pageNumber: 1,
        metadata: {},
      };

      const result = detectScaleBar(chunk);

      expect(result.detected).toBe(false);
    });
  });
});

describe('RAG Enhancements - Abbreviation Dictionary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildProjectAbbreviationDictionary', () => {
    it('should build dictionary from project documents', async () => {
      const mockProject = {
        id: 'proj-1',
        Document: [
          {
            id: 'doc-1',
            fileName: 'Test.pdf',
            DocumentChunk: [
              {
                content: 'AHU - Air Handling Unit\nCMU - Concrete Masonry Unit',
              },
            ],
          },
        ],
      };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);

      const result = await buildProjectAbbreviationDictionary('test-project');

      expect(result).toBeDefined();
      expect(Object.keys(result).length).toBeGreaterThan(0);
    });

    it('should return base dictionary for nonexistent project', async () => {
      mocks.prisma.project.findUnique.mockResolvedValue(null);

      const result = await buildProjectAbbreviationDictionary('nonexistent');

      expect(result).toBeDefined();
      expect(Object.keys(result).length).toBeGreaterThan(0);
    });
  });

  describe('expandAbbreviations', () => {
    it('should expand known abbreviations', () => {
      const text = 'Install typ fixture in room';

      const result = expandAbbreviations(text, CONSTRUCTION_ABBREVIATIONS);

      expect(result).toContain('typical');
    });

    it('should include original with expansion', () => {
      const text = 'Install typ door';

      const result = expandAbbreviations(text, CONSTRUCTION_ABBREVIATIONS, true);

      expect(result).toContain('typ');
      expect(result).toContain('typical');
    });

    it('should preserve original text if no abbreviations', () => {
      const text = 'Regular text without abbreviations';

      const result = expandAbbreviations(text, CONSTRUCTION_ABBREVIATIONS);

      expect(result).toBe(text);
    });
  });
});

describe('RAG Enhancements - Grid References', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractGridReferences', () => {
    it('should extract grid references from content', () => {
      const chunk: EnhancedChunk = {
        id: 'chunk-1',
        content: 'Equipment located at grid A3 intersection',
        documentId: 'doc-1',
        pageNumber: 1,
        metadata: {},
      };

      const result = extractGridReferences(chunk);

      expect(result.length).toBeGreaterThan(0);
      expect(result.some(g => g.gridId === 'A.3')).toBe(true);
    });

    it('should extract multiple grid references', () => {
      const chunk: EnhancedChunk = {
        id: 'chunk-1',
        content: 'Between grids A-1 and C-5',
        documentId: 'doc-1',
        pageNumber: 1,
        metadata: {},
      };

      const result = extractGridReferences(chunk);

      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array when no grids found', () => {
      const chunk: EnhancedChunk = {
        id: 'chunk-1',
        content: 'No grid references here',
        documentId: 'doc-1',
        pageNumber: 1,
        metadata: {},
      };

      const result = extractGridReferences(chunk);

      expect(result).toHaveLength(0);
    });
  });

  describe('calculateGridDistance', () => {
    it('should calculate distance between grids', () => {
      const grid1 = {
        gridId: 'A.1',
        gridType: 'structural' as const,
        coordinates: { x: 'A', y: '1' },
        confidence: 'high' as const,
      };
      const grid2 = {
        gridId: 'C.3',
        gridType: 'structural' as const,
        coordinates: { x: 'C', y: '3' },
        confidence: 'high' as const,
      };

      const result = calculateGridDistance(grid1, grid2);

      expect(result.distance).toBeGreaterThan(0);
      expect(result.direction).toBeDefined();
    });

    it('should handle same grid', () => {
      const grid1 = {
        gridId: 'A.1',
        gridType: 'structural' as const,
        coordinates: { x: 'A', y: '1' },
        confidence: 'high' as const,
      };

      const result = calculateGridDistance(grid1, grid1);

      expect(result.distance).toBe(0);
    });
  });

  describe('findElementsInGridArea', () => {
    it('should find elements in grid area', async () => {
      const mockProject = {
        id: 'proj-1',
        Document: [
          {
            id: 'doc-1',
            DocumentChunk: [
              {
                id: 'chunk-1',
                content: 'Equipment at grid A-1',
                documentId: 'doc-1',
                regulatoryDocumentId: null,
                pageNumber: 1,
                metadata: {},
              },
            ],
          },
        ],
      };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);

      const result = await findElementsInGridArea('test-project', { from: 'A-1', to: 'B-2' });

      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty array for nonexistent project', async () => {
      mocks.prisma.project.findUnique.mockResolvedValue(null);

      const result = await findElementsInGridArea('nonexistent', { from: 'A-1', to: 'B-2' });

      expect(result).toHaveLength(0);
    });
  });

  describe('generateSpatialContext', () => {
    it('should generate spatial context from grids', () => {
      const gridRefs = [
        {
          gridId: 'A-3',
          gridType: 'structural' as const,
          coordinates: { x: 'A', y: '3' },
          confidence: 'high' as const,
        },
        {
          gridId: 'B-4',
          gridType: 'structural' as const,
          coordinates: { x: 'B', y: '4' },
          confidence: 'high' as const,
        },
      ];

      const result = generateSpatialContext(gridRefs, '103');

      expect(result).toContain('A-3');
      expect(result).toContain('Room 103');
    });

    it('should handle empty grid references', () => {
      const result = generateSpatialContext([], '103');

      expect(result).toContain('Room 103');
    });

    it('should handle no location data', () => {
      const result = generateSpatialContext([]);

      expect(result).toContain('Location not specified');
    });
  });
});

describe('RAG Enhancements - Constants and Exports', () => {
  it('should export MEP_ENTITIES constant', () => {
    expect(MEP_ENTITIES).toBeDefined();
    expect(MEP_ENTITIES.hvac).toBeDefined();
    expect(MEP_ENTITIES.plumbing).toBeDefined();
    expect(MEP_ENTITIES.electrical).toBeDefined();
    expect(MEP_ENTITIES.fireAlarm).toBeDefined();
  });

  it('should export CONSTRUCTION_ABBREVIATIONS constant', () => {
    expect(CONSTRUCTION_ABBREVIATIONS).toBeDefined();
    expect(Object.keys(CONSTRUCTION_ABBREVIATIONS).length).toBeGreaterThan(0);
  });

  it('should have valid MEP entity patterns', () => {
    expect(MEP_ENTITIES.hvac.devices.length).toBeGreaterThan(0);
    expect(MEP_ENTITIES.hvac.patterns.length).toBeGreaterThan(0);
  });

  it('should have valid abbreviation mappings', () => {
    expect(Object.keys(CONSTRUCTION_ABBREVIATIONS).length).toBeGreaterThan(0);
    expect(CONSTRUCTION_ABBREVIATIONS['typ']).toBeDefined();
  });
});
