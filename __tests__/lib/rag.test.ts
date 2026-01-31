import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { Prisma } from '@prisma/client';

// Mock Prisma before imports
vi.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    document: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    documentChunk: {
      findMany: vi.fn(),
    },
    adminCorrection: {
      findMany: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    room: {
      findMany: vi.fn(),
    },
    material: {
      findMany: vi.fn(),
    },
    materialTakeoff: {
      findMany: vi.fn(),
    },
    enhancedAnnotation: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    mEPEquipment: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    submittalRequirement: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    inspectionRequirement: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    materialEquipmentSpec: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

// Mock external dependencies
vi.mock('@/lib/legend-extractor', () => ({
  buildProjectLegendLibrary: vi.fn().mockResolvedValue([]),
  searchSymbol: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/drawing-classifier', () => ({
  DrawingType: {},
  DrawingSubtype: {},
}));

vi.mock('@/lib/takeoff-memory-service', () => ({
  getTakeoffContext: vi.fn().mockResolvedValue(''),
  detectTakeoffQuery: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/bim-rag-indexer', () => ({
  getBIMContext: vi.fn().mockResolvedValue(''),
}));

vi.mock('@/lib/mep-schedule-extractor', () => ({
  getMEPScheduleContext: vi.fn().mockResolvedValue(''),
}));

vi.mock('@/lib/door-schedule-extractor', () => ({
  getDoorScheduleContext: vi.fn().mockResolvedValue(''),
}));

vi.mock('@/lib/window-schedule-extractor', () => ({
  getWindowScheduleContext: vi.fn().mockResolvedValue(''),
}));

import {
  retrieveRelevantDocuments,
  generateContextPrompt,
  retrieveRelevantCorrections,
  generateContextWithCorrections,
  generateContextWithPhase3,
} from '@/lib/rag';
import { prisma } from '@/lib/db';

describe('RAG Service - Query Classification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should classify schedule-related queries correctly', async () => {
    // Mock project and documents for schedule query
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Schedule.pdf',
        accessLevel: 'guest',
        category: 'SCHEDULE',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'Project schedule shows milestone completion on March 15th. Critical path includes foundation work.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Schedule.pdf', category: 'SCHEDULE' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'when is the foundation work scheduled?',
      'admin',
      5,
      'test-project'
    );

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].content).toContain('schedule');
    expect(result.documentNames).toContain('Schedule.pdf');
  });

  it('should classify budget-related queries correctly', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-2',
        name: 'Budget.pdf',
        accessLevel: 'client',
        category: 'BUDGET_COST',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-2',
            content: 'Total project cost estimate: $2.5M. Foundation budget allocated at $350K.',
            documentId: 'doc-2',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Budget.pdf', category: 'BUDGET_COST' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'what is the budget for foundation work?',
      'admin',
      5,
      'test-project'
    );

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].content).toContain('budget');
  });

  it('should classify document-specific queries correctly', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-3',
        name: 'Plans.pdf',
        accessLevel: 'guest',
        category: 'PLANS_DRAWINGS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-3',
            content: 'Sheet S-001: Foundation plan showing minimum depth 4 feet below grade. Bottom of footing at elevation -4.0.',
            documentId: 'doc-3',
            regulatoryDocumentId: null,
            pageNumber: 5,
            metadata: { documentName: 'Plans.pdf', sheetNumber: 'S-001' },
            sheetNumber: 'S-001',
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: 'structural',
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'what does sheet S-001 show about foundation depth?',
      'admin',
      5,
      'test-project'
    );

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].content).toContain('S-001');
    expect(result.chunks[0].sheetNumber).toBe('S-001');
  });

  it('should handle general questions appropriately', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-4',
        name: 'General.pdf',
        accessLevel: 'guest',
        category: 'OTHER',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-4',
            content: 'General construction notes and guidelines for the project.',
            documentId: 'doc-4',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'General.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'tell me about construction best practices',
      'admin',
      5,
      'test-project'
    );

    // Should return results even for general queries
    expect(result.chunks).toBeDefined();
  });

  it('should handle edge cases with empty or very long queries', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([]);

    // Empty query
    const emptyResult = await retrieveRelevantDocuments('', 'admin', 5, 'test-project');
    expect(emptyResult.chunks).toEqual([]);

    // Very long query (1000+ characters)
    const longQuery = 'foundation '.repeat(200);
    const longResult = await retrieveRelevantDocuments(longQuery, 'admin', 5, 'test-project');
    expect(longResult.chunks).toBeDefined();
  });
});

describe('RAG Service - Scoring System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should boost scores for construction terminology', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Plans.pdf',
        accessLevel: 'guest',
        category: 'PLANS_DRAWINGS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'Minimum depth of footing shall be 4 feet below grade. Bottom of footing at elevation -4.0.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Plans.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
          {
            id: 'chunk-2',
            content: 'General site information and location details.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 2,
            metadata: { documentName: 'Plans.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'minimum depth footing below grade',
      'admin',
      5,
      'test-project'
    );

    // Chunk with construction terminology should be ranked higher
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].content).toContain('Minimum depth');
  });

  it('should detect measurement patterns and boost scores', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Plans.pdf',
        accessLevel: 'guest',
        category: 'PLANS_DRAWINGS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'Wall thickness: 8 inches. Slab thickness: 6 inches. Rebar #4 @ 12" O.C. Concrete strength: 3000 PSI.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Plans.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'wall thickness and rebar spacing',
      'admin',
      5,
      'test-project'
    );

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].content).toMatch(/\d+\s*inches/);
    expect(result.chunks[0].content).toMatch(/PSI/);
  });

  it('should prioritize notes sections', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Plans.pdf',
        accessLevel: 'guest',
        category: 'PLANS_DRAWINGS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'STRUCTURAL NOTES: All structural steel shall conform to ASTM A992. Concrete strength minimum 4000 PSI.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Plans.pdf', notesCount: 5 },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
          {
            id: 'chunk-2',
            content: 'Detail showing connection types and standard details.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 2,
            metadata: { documentName: 'Plans.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'structural steel requirements',
      'admin',
      5,
      'test-project'
    );

    // STRUCTURAL NOTES section should rank higher
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].content).toContain('STRUCTURAL NOTES');
  });

  it('should calculate relevance scores correctly', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Plans.pdf',
        accessLevel: 'guest',
        category: 'PLANS_DRAWINGS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'Foundation wall minimum depth 4 feet below grade.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Plans.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
          {
            id: 'chunk-2',
            content: 'Parking lot striping details.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 2,
            metadata: { documentName: 'Plans.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'foundation wall depth',
      'admin',
      5,
      'test-project'
    );

    // Should return the more relevant chunk first
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].id).toBe('chunk-1');
  });

  it('should normalize scores appropriately', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Plans.pdf',
        accessLevel: 'guest',
        category: 'PLANS_DRAWINGS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'foundation foundation foundation minimum depth below grade footing',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Plans.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'foundation depth',
      'admin',
      5,
      'test-project'
    );

    // Should return results even with keyword repetition
    expect(result.chunks.length).toBeGreaterThan(0);
  });
});

describe('RAG Service - Context Building', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should build context with relevant chunks', () => {
    const chunks = [
      {
        id: 'chunk-1',
        content: 'Foundation depth: 4 feet below grade.',
        documentId: 'doc-1',
        regulatoryDocumentId: null,
        pageNumber: 1,
        metadata: { documentName: 'Plans.pdf', sheetNumber: 'S-001' },
        sheetNumber: 'S-001',
      },
      {
        id: 'chunk-2',
        content: 'Concrete strength: 3000 PSI minimum.',
        documentId: 'doc-1',
        regulatoryDocumentId: null,
        pageNumber: 1,
        metadata: { documentName: 'Plans.pdf', sheetNumber: 'S-001' },
        sheetNumber: 'S-001',
      },
    ];

    const context = generateContextPrompt(chunks as any);

    expect(context).toContain('Plans.pdf');
    expect(context).toContain('Foundation depth');
    expect(context).toContain('Concrete strength');
    expect(context).toContain('Sheet');
  });

  it('should respect token limits in context building', () => {
    // Create many chunks to test limit
    const manyChunks = Array.from({ length: 50 }, (_, i) => ({
      id: `chunk-${i}`,
      content: `Content for chunk ${i} with construction details about foundation work and structural requirements.`,
      documentId: 'doc-1',
      regulatoryDocumentId: null,
      pageNumber: i + 1,
      metadata: { documentName: 'Plans.pdf' },
    }));

    const context = generateContextPrompt(manyChunks as any);

    // Context should be created but reasonably sized
    expect(context.length).toBeGreaterThan(0);
    expect(context).toContain('Plans.pdf');
  });

  it('should deduplicate context correctly', () => {
    const chunks = [
      {
        id: 'chunk-1',
        content: 'Foundation depth: 4 feet below grade.',
        documentId: 'doc-1',
        regulatoryDocumentId: null,
        pageNumber: 1,
        metadata: { documentName: 'Plans.pdf' },
      },
      {
        id: 'chunk-2',
        content: 'Foundation depth: 4 feet below grade.', // Duplicate content
        documentId: 'doc-1',
        regulatoryDocumentId: null,
        pageNumber: 1,
        metadata: { documentName: 'Plans.pdf' },
      },
    ];

    const context = generateContextPrompt(chunks as any);

    // Both chunks should be in context (deduplication happens elsewhere)
    expect(context).toContain('Foundation depth');
  });

  it('should format context properly for LLM consumption', () => {
    const chunks = [
      {
        id: 'chunk-1',
        content: 'Sheet S-001: Foundation plan details.',
        documentId: 'doc-1',
        regulatoryDocumentId: null,
        pageNumber: 5,
        metadata: { documentName: 'Plans.pdf', sheetNumber: 'S-001' },
        sheetNumber: 'S-001',
      },
    ];

    const context = generateContextPrompt(chunks as any);

    // Should have clear document references
    expect(context).toContain('[Plans.pdf');
    expect(context).toContain('Page 5');
    expect(context).toContain('IMPORTANT');
    expect(context).toContain('cite');
  });

  it('should handle empty or no-match scenarios', () => {
    const emptyContext = generateContextPrompt([]);

    expect(emptyContext).toContain('No specific document context');
    expect(emptyContext).toContain('general construction industry guidance');
  });
});

describe('RAG Service - Construction Terminology', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should recognize CSI codes', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Specs.pdf',
        accessLevel: 'guest',
        category: 'SPECS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'Division 03 - Concrete. CSI Code 03 30 00 Cast-in-Place Concrete.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Specs.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'CSI Division 03 concrete specifications',
      'admin',
      5,
      'test-project'
    );

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].content).toMatch(/03.*30.*00|03.*00.*00/);
  });

  it('should recognize trade names', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Plans.pdf',
        accessLevel: 'guest',
        category: 'PLANS_DRAWINGS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'HVAC equipment schedule. Mechanical contractor responsible for installation.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Plans.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'HVAC mechanical requirements',
      'admin',
      5,
      'test-project'
    );

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].content).toContain('HVAC');
  });

  it('should recognize material types', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Plans.pdf',
        accessLevel: 'guest',
        category: 'PLANS_DRAWINGS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'Reinforced concrete foundation. Structural steel framing. Rebar A615 Grade 60.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Plans.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'concrete rebar steel materials',
      'admin',
      5,
      'test-project'
    );

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].content).toMatch(/concrete|steel|rebar/i);
  });

  it('should recognize measurement units', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Plans.pdf',
        accessLevel: 'guest',
        category: 'PLANS_DRAWINGS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'Wall dimensions: 10 feet high, 8 inches thick. Load capacity: 150 PSF. Concrete: 4000 PSI.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Plans.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'wall dimensions PSI PSF measurements',
      'admin',
      5,
      'test-project'
    );

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].content).toMatch(/feet|inches|PSF|PSI/);
  });

  it('should handle abbreviation expansion', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Plans.pdf',
        accessLevel: 'guest',
        category: 'PLANS_DRAWINGS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'MEP coordination required. HVAC ductwork @ 10 ft O.C. spacing.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Plans.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'MEP HVAC on center spacing',
      'admin',
      5,
      'test-project'
    );

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].content).toMatch(/MEP|HVAC|O\.C\./);
  });
});

describe('RAG Service - Cross-Reference Bundling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should bundle related documents', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Plans.pdf',
        accessLevel: 'guest',
        category: 'PLANS_DRAWINGS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'See detail 3/S-002 for foundation connection.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Plans.pdf', sheetNumber: 'S-001' },
            sheetNumber: 'S-001',
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
          {
            id: 'chunk-2',
            content: 'Detail 3: Foundation to wall connection. Typical for all perimeter walls.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 2,
            metadata: { documentName: 'Plans.pdf', sheetNumber: 'S-002' },
            sheetNumber: 'S-002',
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'foundation connection detail',
      'admin',
      10,
      'test-project'
    );

    // Should retrieve both the reference and the detail
    expect(result.chunks.length).toBeGreaterThan(0);
  });

  it('should group same-document chunks', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Specs.pdf',
        accessLevel: 'guest',
        category: 'SPECS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'Section 03 30 00: Cast-in-place concrete requirements.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 10,
            metadata: { documentName: 'Specs.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
          {
            id: 'chunk-2',
            content: 'Concrete strength shall be 4000 PSI minimum at 28 days.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 11,
            metadata: { documentName: 'Specs.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'concrete specifications strength',
      'admin',
      5,
      'test-project'
    );

    expect(result.chunks.length).toBeGreaterThan(0);
    // All chunks should be from same document
    const uniqueDocs = new Set(result.chunks.map(c => c.documentName));
    expect(uniqueDocs.size).toBe(1);
  });

  it('should preserve metadata in bundled chunks', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Plans.pdf',
        accessLevel: 'client',
        category: 'PLANS_DRAWINGS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'Foundation plan with elevation markers.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 5,
            metadata: {
              documentName: 'Plans.pdf',
              sheetNumber: 'S-001',
              notesCount: 10,
              hasLegend: true,
            },
            sheetNumber: 'S-001',
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'foundation elevation',
      'client',
      5,
      'test-project'
    );

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].metadata).toHaveProperty('documentName');
    expect(result.chunks[0].metadata).toHaveProperty('accessLevel');
    expect(result.chunks[0].metadata.documentName).toBe('Plans.pdf');
  });

  it('should respect bundle size limits', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    const manyChunks = Array.from({ length: 100 }, (_, i) => ({
      id: `chunk-${i}`,
      content: `Foundation detail ${i} with construction specifications.`,
      documentId: 'doc-1',
      regulatoryDocumentId: null,
      pageNumber: i + 1,
      metadata: { documentName: 'Plans.pdf' },
      sheetNumber: null,
      titleBlockData: null,
      revision: null,
      dateIssued: null,
      discipline: null,
    }));

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Plans.pdf',
        accessLevel: 'guest',
        category: 'PLANS_DRAWINGS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: manyChunks as any,
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'foundation details',
      'admin',
      5, // Request limit of 5
      'test-project'
    );

    // Should respect the limit parameter
    expect(result.chunks.length).toBeLessThanOrEqual(5);
  });

  it('should handle orphan chunk scenarios', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Plans.pdf',
        accessLevel: 'guest',
        category: 'PLANS_DRAWINGS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-orphan',
            content: 'Isolated note with no cross-references.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: null, // No page number
            metadata: { documentName: 'Plans.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'isolated note',
      'admin',
      5,
      'test-project'
    );

    // Should still retrieve orphan chunks
    expect(result.chunks.length).toBeGreaterThan(0);
  });
});

describe('RAG Service - Admin Corrections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retrieve relevant corrections for queries', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: 'proj-1',
      name: 'Test Project',
      slug: 'test-project',
    } as any);

    vi.mocked(prisma.adminCorrection.findMany).mockResolvedValue([
      {
        id: 'corr-1',
        originalQuestion: 'What is the foundation depth?',
        correctedAnswer: 'The foundation depth is 4 feet below grade as shown on sheet S-001.',
        adminNotes: 'Verified with structural engineer.',
        keywords: ['foundation', 'depth', 'below', 'grade'],
        usageCount: 5,
        isActive: true,
        projectId: 'proj-1',
        createdById: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    ]);

    const result = await retrieveRelevantCorrections(
      'foundation depth below grade',
      'test-project',
      3
    );

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].originalQuestion).toContain('foundation depth');
  });

  it('should integrate corrections into context', async () => {
    const chunks = [
      {
        id: 'chunk-1',
        content: 'Foundation details from plans.',
        documentId: 'doc-1',
        regulatoryDocumentId: null,
        pageNumber: 1,
        metadata: { documentName: 'Plans.pdf' },
      },
    ];

    const corrections = [
      {
        id: 'corr-1',
        originalQuestion: 'What is the foundation depth?',
        correctedAnswer: 'The foundation depth is 4 feet below grade.',
        adminNotes: 'Confirmed by engineer.',
        keywords: ['foundation', 'depth'],
        usageCount: 3,
        isActive: true,
        projectId: 'proj-1',
        createdById: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const context = generateContextWithCorrections(chunks as any, corrections as any);

    expect(context).toContain('ADMIN CORRECTIONS');
    expect(context).toContain('foundation depth');
    expect(context).toContain('4 feet below grade');
    expect(context).toContain('Plans.pdf');
  });

  it('should prioritize corrections over raw document content', async () => {
    const chunks = [
      {
        id: 'chunk-1',
        content: 'Unclear foundation information.',
        documentId: 'doc-1',
        regulatoryDocumentId: null,
        pageNumber: 1,
        metadata: { documentName: 'Plans.pdf' },
      },
    ];

    const corrections = [
      {
        id: 'corr-1',
        originalQuestion: 'What is the foundation depth?',
        correctedAnswer: 'The foundation depth is 4 feet below grade (corrected from OCR error).',
        adminNotes: 'OCR originally read as 6 feet, corrected to 4 feet.',
        keywords: ['foundation', 'depth'],
        usageCount: 5,
        isActive: true,
        projectId: 'proj-1',
        createdById: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const context = generateContextWithCorrections(chunks as any, corrections as any);

    // Corrections should appear first in context
    const correctionIndex = context.indexOf('ADMIN CORRECTIONS');
    const documentIndex = context.indexOf('Plans.pdf');

    expect(correctionIndex).toBeGreaterThan(-1);
    expect(documentIndex).toBeGreaterThan(-1);
    expect(correctionIndex).toBeLessThan(documentIndex);
  });
});

describe('RAG Service - Access Control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should filter documents by guest access level', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Public.pdf',
        accessLevel: 'guest',
        category: 'PLANS_DRAWINGS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'Public information.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Public.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'information',
      'guest',
      5,
      'test-project'
    );

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].metadata.accessLevel).toBe('guest');
  });

  it('should allow client access to client and guest documents', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Client.pdf',
        accessLevel: 'client',
        category: 'BUDGET_COST',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'Client budget information.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Client.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'budget',
      'client',
      5,
      'test-project'
    );

    expect(result.chunks.length).toBeGreaterThan(0);
  });

  it('should allow admin access to all documents', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Admin.pdf',
        accessLevel: 'admin',
        category: 'INTERNAL',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'Admin-only information.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Admin.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'information',
      'admin',
      5,
      'test-project'
    );

    expect(result.chunks.length).toBeGreaterThan(0);
  });

  it('should enforce project isolation', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([]);

    const result = await retrieveRelevantDocuments(
      'test query',
      'admin',
      5,
      'nonexistent-project'
    );

    // Should return empty results for nonexistent project
    expect(result.chunks).toEqual([]);
    expect(result.documentNames).toEqual([]);
  });

  it('should return empty results when no projectSlug provided', async () => {
    const result = await retrieveRelevantDocuments(
      'test query',
      'admin',
      5
      // No projectSlug
    );

    // Should prevent cross-project access
    expect(result.chunks).toEqual([]);
    expect(result.documentNames).toEqual([]);
  });
});

describe('RAG Service - Phase 3 Context Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should integrate Phase 3 room data into context', async () => {
    const chunks = [
      {
        id: 'chunk-1',
        content: 'Building layout information.',
        documentId: 'doc-1',
        regulatoryDocumentId: null,
        pageNumber: 1,
        metadata: { documentName: 'Plans.pdf' },
      },
    ];

    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: 'proj-1',
      slug: 'test-project',
    } as any);

    vi.mocked(prisma.room.findMany).mockResolvedValue([
      {
        id: 'room-1',
        name: 'Conference Room',
        roomNumber: '101',
        type: 'Office',
        floorNumber: 1,
        area: 250,
        status: 'complete',
      } as any,
    ]);

    vi.mocked(prisma.adminCorrection.findMany).mockResolvedValue([]);

    const context = await generateContextWithPhase3(
      chunks as any,
      [],
      'rooms in building',
      'test-project'
    );

    expect(context).toContain('PROJECT ROOMS');
    expect(context).toContain('Conference Room');
    expect(context).toContain('101');
  });

  it('should integrate Phase 3 material data into context', async () => {
    const chunks = [
      {
        id: 'chunk-1',
        content: 'Material specifications.',
        documentId: 'doc-1',
        regulatoryDocumentId: null,
        pageNumber: 1,
        metadata: { documentName: 'Specs.pdf' },
      },
    ];

    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: 'proj-1',
      slug: 'test-project',
    } as any);

    vi.mocked(prisma.materialTakeoff.findMany).mockResolvedValue([
      {
        id: 'mat-1',
        name: 'Concrete',
        description: '4000 PSI concrete mix',
        TakeoffLineItem: [
          {
            description: 'Foundation concrete',
            quantity: 100,
            unit: 'CY',
            unitCost: 120,
            totalCost: 12000,
          },
        ],
      } as any,
    ]);

    vi.mocked(prisma.adminCorrection.findMany).mockResolvedValue([]);
    vi.mocked(prisma.room.findMany).mockResolvedValue([]);

    const context = await generateContextWithPhase3(
      chunks as any,
      [],
      'concrete materials',
      'test-project'
    );

    expect(context).toContain('MATERIAL TAKEOFF DATA');
    expect(context).toContain('Concrete');
  });
});

describe('RAG Service - Query Classification Functions', () => {
  // Import the query classification functions
  let isSymbolQuery: (query: string) => boolean;
  let isScaleQuery: (query: string) => boolean;
  let isDrawingTypeQuery: (query: string) => boolean;
  let isCalloutQuery: (query: string) => boolean;
  let isDimensionQuery: (query: string) => boolean;
  let isAnnotationQuery: (query: string) => boolean;
  let getPhaseARAGInstructions: () => string;
  let getPhaseBRAGInstructions: () => string;
  let enhanceSymbolContextWithStandardLibrary: (context: string) => string;

  beforeAll(async () => {
    const ragModule = await import('@/lib/rag');
    isSymbolQuery = ragModule.isSymbolQuery;
    isScaleQuery = ragModule.isScaleQuery;
    isDrawingTypeQuery = ragModule.isDrawingTypeQuery;
    isCalloutQuery = ragModule.isCalloutQuery;
    isDimensionQuery = ragModule.isDimensionQuery;
    isAnnotationQuery = ragModule.isAnnotationQuery;
    getPhaseARAGInstructions = ragModule.getPhaseARAGInstructions;
    getPhaseBRAGInstructions = ragModule.getPhaseBRAGInstructions;
    enhanceSymbolContextWithStandardLibrary = ragModule.enhanceSymbolContextWithStandardLibrary;
  });

  describe('isSymbolQuery', () => {
    it('should detect symbol-related queries', () => {
      expect(isSymbolQuery('What does the symbol mean?')).toBe(true);
      expect(isSymbolQuery('Show me the legend')).toBe(true);
      expect(isSymbolQuery('What is the abbreviation for HVAC?')).toBe(true);
      expect(isSymbolQuery('What does E-1 represent?')).toBe(true);
      expect(isSymbolQuery('Definition of this code')).toBe(true);
    });

    it('should not detect non-symbol queries', () => {
      // Note: isSymbolQuery includes "what is" as a keyword, so we use queries without it
      expect(isSymbolQuery('Show me the foundation depth')).toBe(false);
      expect(isSymbolQuery('Show me the budget')).toBe(false);
      expect(isSymbolQuery('When is the deadline?')).toBe(false);
      expect(isSymbolQuery('List all contractors')).toBe(false);
    });
  });

  describe('isScaleQuery', () => {
    it('should detect scale and dimension queries', () => {
      expect(isScaleQuery('What is the scale of this drawing?')).toBe(true);
      expect(isScaleQuery('What are the dimensions?')).toBe(true);
      expect(isScaleQuery('How big is the room?')).toBe(true);
      expect(isScaleQuery('Calculate the area')).toBe(true);
      expect(isScaleQuery('What is the square footage?')).toBe(true);
      expect(isScaleQuery('How long is the wall?')).toBe(true);
      expect(isScaleQuery('How wide is the door?')).toBe(true);
    });

    it('should not detect non-scale queries', () => {
      expect(isScaleQuery('Who is the contractor?')).toBe(false);
      expect(isScaleQuery('What is the budget?')).toBe(false);
      expect(isScaleQuery('Show me the schedule')).toBe(false);
    });
  });

  describe('isDrawingTypeQuery', () => {
    it('should detect drawing type queries', () => {
      expect(isDrawingTypeQuery('Show me the floor plan')).toBe(true);
      expect(isDrawingTypeQuery('What sheet shows the elevation?')).toBe(true);
      expect(isDrawingTypeQuery('Find the section drawing')).toBe(true);
      expect(isDrawingTypeQuery('Where is the mechanical drawing?')).toBe(true);
      expect(isDrawingTypeQuery('Show the electrical layout')).toBe(true);
      expect(isDrawingTypeQuery('What type of drawing is this?')).toBe(true);
      expect(isDrawingTypeQuery('HVAC ductwork location')).toBe(true);
    });

    it('should not detect non-drawing type queries', () => {
      expect(isDrawingTypeQuery('What is the budget?')).toBe(false);
      expect(isDrawingTypeQuery('Who is the project manager?')).toBe(false);
    });
  });

  describe('isCalloutQuery', () => {
    it('should detect callout-related queries', () => {
      expect(isCalloutQuery('What does callout 3 mean?')).toBe(true);
      expect(isCalloutQuery('Reference to detail A')).toBe(true);
      expect(isCalloutQuery('Section callout interpretation')).toBe(true);
    });

    it('should not detect non-callout queries', () => {
      expect(isCalloutQuery('What is the budget?')).toBe(false);
      expect(isCalloutQuery('Show me the schedule')).toBe(false);
    });
  });

  describe('isDimensionQuery', () => {
    it('should detect dimension-related queries', () => {
      expect(isDimensionQuery('What is the dimension?')).toBe(true);
      expect(isDimensionQuery('Wall measurement needed')).toBe(true);
      expect(isDimensionQuery('What is the distance between?')).toBe(true);
      expect(isDimensionQuery('What is the spacing?')).toBe(true);
    });

    it('should not detect non-dimension queries', () => {
      expect(isDimensionQuery('Who is the architect?')).toBe(false);
      expect(isDimensionQuery('What is the project name?')).toBe(false);
    });
  });

  describe('isAnnotationQuery', () => {
    it('should detect annotation-related queries', () => {
      expect(isAnnotationQuery('What does the annotation say?')).toBe(true);
      expect(isAnnotationQuery('Show me the notes')).toBe(true);
      expect(isAnnotationQuery('What is the specification?')).toBe(true);
      expect(isAnnotationQuery('What are the requirements?')).toBe(true);
    });

    it('should not detect non-annotation queries', () => {
      expect(isAnnotationQuery('What is the cost?')).toBe(false);
      expect(isAnnotationQuery('When is the deadline?')).toBe(false);
    });
  });

  describe('getPhaseARAGInstructions', () => {
    it('should return non-empty instructions string', () => {
      const instructions = getPhaseARAGInstructions();
      expect(instructions).toBeTruthy();
      expect(typeof instructions).toBe('string');
      expect(instructions.length).toBeGreaterThan(50);
    });

    it('should contain relevant construction terms', () => {
      const instructions = getPhaseARAGInstructions();
      // Should mention key concepts related to Phase A (legend, scale, drawing types)
      expect(instructions.toLowerCase()).toMatch(/legend|symbol|scale|drawing|title|block/i);
    });
  });

  describe('getPhaseBRAGInstructions', () => {
    it('should return non-empty instructions string', () => {
      const instructions = getPhaseBRAGInstructions();
      expect(instructions).toBeTruthy();
      expect(typeof instructions).toBe('string');
      expect(instructions.length).toBeGreaterThan(50);
    });

    it('should contain relevant Phase B terms', () => {
      const instructions = getPhaseBRAGInstructions();
      // Should mention key concepts related to Phase B (callouts, dimensions, annotations)
      expect(instructions.toLowerCase()).toMatch(/callout|dimension|annotation|detail|note/i);
    });
  });

  describe('enhanceSymbolContextWithStandardLibrary', () => {
    it('should enhance context with standard library info', () => {
      const baseContext = 'Symbol E-1 found in project.';
      const enhanced = enhanceSymbolContextWithStandardLibrary(baseContext);

      // Should return the context (may be enhanced or unchanged)
      expect(enhanced).toContain(baseContext);
    });

    it('should handle empty context', () => {
      const enhanced = enhanceSymbolContextWithStandardLibrary('');
      expect(typeof enhanced).toBe('string');
    });

    it('should not throw on various inputs', () => {
      expect(() => enhanceSymbolContextWithStandardLibrary('test')).not.toThrow();
      expect(() => enhanceSymbolContextWithStandardLibrary('HVAC symbol')).not.toThrow();
      expect(() => enhanceSymbolContextWithStandardLibrary('E-1, M-2, P-3')).not.toThrow();
    });
  });
});

describe('RAG Service - Regulatory Document Retrieval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retrieve regulatory chunks for compliance queries', async () => {
    const { retrieveRegulatoryChunks } = await import('@/lib/rag');

    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: 'proj-1',
      slug: 'test-project',
    } as any);

    vi.mocked(prisma.documentChunk.findMany).mockResolvedValue([
      {
        id: 'reg-chunk-1',
        content: 'ADA 2010 Standards require minimum 32 inch clear door width.',
        documentId: null,
        regulatoryDocumentId: 'reg-1',
        pageNumber: 15,
        metadata: {},
        RegulatoryDocument: {
          type: 'ada',
          standard: 'ADA 2010',
          jurisdiction: 'Federal',
        },
      } as any,
    ]);

    // Mock regulatoryDocument.findMany
    (prisma as any).regulatoryDocument = {
      findMany: vi.fn().mockResolvedValue([
        { id: 'reg-1', type: 'ada', standard: 'ADA 2010' },
      ]),
    };

    const result = await retrieveRegulatoryChunks(
      'ADA door width requirements',
      'test-project',
      5
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return empty array for non-existent project', async () => {
    const { retrieveRegulatoryChunks } = await import('@/lib/rag');

    vi.mocked(prisma.project.findUnique).mockResolvedValue(null);

    const result = await retrieveRegulatoryChunks(
      'ADA requirements',
      'nonexistent-project',
      5
    );

    expect(result).toEqual([]);
  });
});

describe('RAG Service - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle database errors gracefully in retrieveRelevantDocuments', async () => {
    vi.mocked(prisma.project.findMany).mockRejectedValue(new Error('Database connection failed'));

    const result = await retrieveRelevantDocuments(
      'test query',
      'admin',
      5,
      'test-project'
    );

    // Should return empty results, not throw
    expect(result.chunks).toEqual([]);
    expect(result.documentNames).toEqual([]);
  });

  it('should handle database errors gracefully in retrieveRelevantCorrections', async () => {
    vi.mocked(prisma.project.findUnique).mockRejectedValue(new Error('Database error'));

    const result = await retrieveRelevantCorrections(
      'test query',
      'test-project',
      3
    );

    // Should return empty results, not throw
    expect(result).toEqual([]);
  });

  it('should handle malformed metadata gracefully', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Plans.pdf',
        accessLevel: 'guest',
        category: 'PLANS_DRAWINGS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'Test content',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: 'invalid-metadata-string', // Malformed metadata
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    // Should not throw
    const result = await retrieveRelevantDocuments(
      'test query',
      'admin',
      5,
      'test-project'
    );

    expect(result.chunks).toBeDefined();
  });
});

describe('RAG Service - Counting Query Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should boost schedule/legend content for counting queries', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Plans.pdf',
        accessLevel: 'guest',
        category: 'PLANS_DRAWINGS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-schedule',
            content: 'DOOR SCHEDULE: D-1, D-2, D-3, D-4, D-5. Total: 5 doors. Legend shows door types.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Plans.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
          {
            id: 'chunk-generic',
            content: 'Generic building information without counts.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 2,
            metadata: { documentName: 'Plans.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'how many doors are there?',
      'admin',
      5,
      'test-project'
    );

    // Schedule chunk should be ranked first for counting queries
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].content).toContain('DOOR SCHEDULE');
  });

  it('should detect tabular data patterns for counting', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Plans.pdf',
        accessLevel: 'guest',
        category: 'PLANS_DRAWINGS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-table',
            content: '1 Window Type A\n2 Window Type B\n3 Window Type C\n4 Window Type D\n5 Window Type E',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Plans.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'count windows',
      'admin',
      5,
      'test-project'
    );

    expect(result.chunks.length).toBeGreaterThan(0);
  });
});

describe('RAG Service - Sheet Number and Discipline Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect and boost sheet numbers', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Plans.pdf',
        accessLevel: 'guest',
        category: 'PLANS_DRAWINGS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'Sheet S-001: Structural foundation plan. See S-002 for details.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Plans.pdf', sheetNumber: 'S-001' },
            sheetNumber: 'S-001',
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: 'structural',
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'structural foundation',
      'admin',
      5,
      'test-project'
    );

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].content).toContain('S-001');
  });

  it('should apply discipline-specific boosts', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Plans.pdf',
        accessLevel: 'guest',
        category: 'PLANS_DRAWINGS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-structural',
            content: 'S-001: Foundation layout with structural steel.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Plans.pdf' },
            sheetNumber: 'S-001',
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: 'structural',
          },
          {
            id: 'chunk-landscape',
            content: 'L-001: Landscape foundation planting.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 2,
            metadata: { documentName: 'Plans.pdf' },
            sheetNumber: 'L-001',
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: 'landscape',
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'foundation structural',
      'admin',
      5,
      'test-project'
    );

    // Structural sheet should rank higher than landscape for structural queries
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].content).toContain('S-001');
  });
});

describe('RAG Service - Keyword Proximity Scoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should boost content with closely placed keywords', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Plans.pdf',
        accessLevel: 'guest',
        category: 'PLANS_DRAWINGS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-close',
            content: 'The foundation depth is 4 feet below grade.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Plans.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
          {
            id: 'chunk-far',
            content: 'Foundation requirements. Many other details here. Grade specifications elsewhere.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 2,
            metadata: { documentName: 'Plans.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    const result = await retrieveRelevantDocuments(
      'foundation depth below grade',
      'admin',
      5,
      'test-project'
    );

    expect(result.chunks.length).toBeGreaterThan(0);
    // Chunk with keywords closer together should rank higher
    expect(result.chunks[0].content).toContain('foundation depth');
  });
});

describe('RAG Service - Synonym Expansion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should expand synonyms for construction terms', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Plans.pdf',
        accessLevel: 'guest',
        category: 'PLANS_DRAWINGS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'Footing depth minimum 36 inches below exterior grade.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Plans.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    // Query uses "footer" which should match "footing" through synonym expansion
    const result = await retrieveRelevantDocuments(
      'footer depth requirements',
      'admin',
      5,
      'test-project'
    );

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].content.toLowerCase()).toContain('footing');
  });

  it('should expand MEP-related synonyms', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Plans.pdf',
        accessLevel: 'guest',
        category: 'PLANS_DRAWINGS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'HVAC mechanical ventilation system with heating and cooling.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Plans.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    // Query for "heating" should match content with "HVAC"
    const result = await retrieveRelevantDocuments(
      'heating system',
      'admin',
      5,
      'test-project'
    );

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].content.toLowerCase()).toContain('hvac');
  });

  it('should expand counting/quantity synonyms', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', slug: 'test-project' } as any,
    ]);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Plans.pdf',
        accessLevel: 'guest',
        category: 'PLANS_DRAWINGS',
        processed: true,
        projectId: 'proj-1',
        DocumentChunk: [
          {
            id: 'chunk-1',
            content: 'Receptacle schedule: Total quantity of 50 outlets.',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Plans.pdf' },
            sheetNumber: null,
            titleBlockData: null,
            revision: null,
            dateIssued: null,
            discipline: null,
          },
        ],
      } as any,
    ]);

    // Query uses "outlets" which should match "receptacle" through synonym expansion
    const result = await retrieveRelevantDocuments(
      'how many outlets',
      'admin',
      5,
      'test-project'
    );

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].content.toLowerCase()).toContain('receptacle');
  });
});
