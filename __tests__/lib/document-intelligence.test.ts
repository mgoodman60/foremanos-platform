import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mocks Setup - Must use vi.hoisted for mock objects
// ============================================

// Mock Prisma with vi.hoisted to ensure it's available before module imports
const mockPrisma = vi.hoisted(() => ({
  documentChunk: {
    findMany: vi.fn(),
  },
  document: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Import functions after mocks
import {
  extractCrossReferences,
  compareDocumentVersions,
  getRelatedDocuments,
} from '@/lib/document-intelligence';
import { prisma } from '@/lib/db';

describe('Document Intelligence - Cross Reference Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract sheet references from metadata', async () => {
    const mockChunks = [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        content: 'Some content',
        pageNumber: 1,
        metadata: {
          crossReferences: ['See Sheet A-101', 'Detail on A3.2'],
        },
        Document: {
          Project: {
            Document: [
              { id: 'doc-2', name: 'Sheet A-101', fileName: 'A-101.pdf' },
              { id: 'doc-3', name: 'Sheet A3.2', fileName: 'A3.2.pdf' },
            ],
          },
        },
      },
    ];

    vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

    const refs = await extractCrossReferences('doc-1');

    expect(refs).toHaveLength(2);
    expect(refs[0]).toMatchObject({
      sourceDocumentId: 'doc-1',
      targetDocumentId: 'doc-2',
      referenceType: 'sheet_reference',
      location: 'Page 1',
    });
    expect(refs[1]).toMatchObject({
      sourceDocumentId: 'doc-1',
      targetDocumentId: 'doc-3',
      referenceType: 'sheet_reference',
      location: 'Page 1',
    });
  });

  it('should parse content for sheet references', async () => {
    const mockChunks = [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        content: 'See Sheet A-101 for details\nRefer to Drawing M-201',
        pageNumber: 1,
        metadata: {},
        Document: {
          Project: {
            Document: [
              { id: 'doc-2', name: 'Sheet A-101', fileName: 'A-101.pdf' },
              { id: 'doc-3', name: 'Mechanical M-201', fileName: 'M-201.pdf' },
            ],
          },
        },
      },
    ];

    vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

    const refs = await extractCrossReferences('doc-1');

    expect(refs.length).toBeGreaterThan(0);
    const sheetRef = refs.find(r => r.targetDocumentId === 'doc-2');
    expect(sheetRef).toBeDefined();
    expect(sheetRef?.referenceType).toBe('sheet_reference');
  });

  it('should parse detail callouts from content', async () => {
    const mockChunks = [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        content: 'Detail 5/A3.2 shows wall section',
        pageNumber: 1,
        metadata: {},
        Document: {
          Project: {
            Document: [
              { id: 'doc-3', name: 'Sheet A3.2', fileName: 'A3.2.pdf' },
            ],
          },
        },
      },
    ];

    vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

    const refs = await extractCrossReferences('doc-1');

    const detailRef = refs.find(r => r.referenceType === 'detail_callout');
    expect(detailRef).toBeDefined();
  });

  it('should handle empty chunks gracefully', async () => {
    vi.mocked(prisma.documentChunk.findMany).mockResolvedValue([]);

    const refs = await extractCrossReferences('doc-1');

    expect(refs).toEqual([]);
  });

  it('should handle chunks without project context', async () => {
    const mockChunks = [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        content: 'See Sheet A-101',
        pageNumber: 1,
        metadata: {},
        Document: null,
      },
    ];

    vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

    const refs = await extractCrossReferences('doc-1');

    expect(refs).toEqual([]);
  });

  it('should handle database errors gracefully', async () => {
    vi.mocked(prisma.documentChunk.findMany).mockRejectedValue(new Error('Database error'));

    const refs = await extractCrossReferences('doc-1');

    expect(refs).toEqual([]);
  });

  it('should deduplicate references to the same document', async () => {
    const mockChunks = [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        content: 'See Sheet A-101 for details\nAlso refer to Sheet A-101',
        pageNumber: 1,
        metadata: {},
        Document: {
          Project: {
            Document: [
              { id: 'doc-2', name: 'Sheet A-101', fileName: 'A-101.pdf' },
            ],
          },
        },
      },
    ];

    vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

    const refs = await extractCrossReferences('doc-1');

    // Should have multiple references but all pointing to same target
    const targetIds = refs.map(r => r.targetDocumentId);
    expect(targetIds.every(id => id === 'doc-2')).toBe(true);
  });
});

describe('Document Intelligence - Version Comparison', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect document name changes', async () => {
    const oldDoc = {
      id: 'doc-1',
      name: 'Old Name',
      DocumentChunk: [],
    };

    const newDoc = {
      id: 'doc-2',
      name: 'New Name',
      DocumentChunk: [],
    };

    vi.mocked(prisma.document.findUnique)
      .mockResolvedValueOnce(oldDoc as any)
      .mockResolvedValueOnce(newDoc as any);

    const result = await compareDocumentVersions('doc-1', 'doc-2');

    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toMatchObject({
      field: 'document_name',
      oldValue: 'Old Name',
      newValue: 'New Name',
      changeType: 'modified',
    });
    expect(result.summary).toContain('1 changes');
    expect(result.summary).toContain('1 modifications');
  });

  it('should detect page additions', async () => {
    const oldDoc = {
      id: 'doc-1',
      name: 'Test Doc',
      DocumentChunk: [
        { id: 'chunk-1', metadata: {} },
        { id: 'chunk-2', metadata: {} },
      ],
    };

    const newDoc = {
      id: 'doc-2',
      name: 'Test Doc',
      DocumentChunk: [
        { id: 'chunk-1', metadata: {} },
        { id: 'chunk-2', metadata: {} },
        { id: 'chunk-3', metadata: {} },
      ],
    };

    vi.mocked(prisma.document.findUnique)
      .mockResolvedValueOnce(oldDoc as any)
      .mockResolvedValueOnce(newDoc as any);

    const result = await compareDocumentVersions('doc-1', 'doc-2');

    expect(result.changes.some(c => c.field === 'page_count' && c.changeType === 'added')).toBe(true);
    const pageChange = result.changes.find(c => c.field === 'page_count');
    expect(pageChange?.oldValue).toBe(2);
    expect(pageChange?.newValue).toBe(3);
  });

  it('should detect page removals', async () => {
    const oldDoc = {
      id: 'doc-1',
      name: 'Test Doc',
      DocumentChunk: [
        { id: 'chunk-1', metadata: {} },
        { id: 'chunk-2', metadata: {} },
        { id: 'chunk-3', metadata: {} },
      ],
    };

    const newDoc = {
      id: 'doc-2',
      name: 'Test Doc',
      DocumentChunk: [
        { id: 'chunk-1', metadata: {} },
      ],
    };

    vi.mocked(prisma.document.findUnique)
      .mockResolvedValueOnce(oldDoc as any)
      .mockResolvedValueOnce(newDoc as any);

    const result = await compareDocumentVersions('doc-1', 'doc-2');

    expect(result.changes.some(c => c.field === 'page_count' && c.changeType === 'removed')).toBe(true);
    const pageChange = result.changes.find(c => c.field === 'page_count');
    expect(pageChange?.oldValue).toBe(3);
    expect(pageChange?.newValue).toBe(1);
  });

  it('should detect sheet number changes', async () => {
    const oldDoc = {
      id: 'doc-1',
      name: 'Test Doc',
      DocumentChunk: [
        { id: 'chunk-1', metadata: { sheet_number: 'A-101' } },
      ],
    };

    const newDoc = {
      id: 'doc-2',
      name: 'Test Doc',
      DocumentChunk: [
        { id: 'chunk-1', metadata: { sheet_number: 'A-102' } },
      ],
    };

    vi.mocked(prisma.document.findUnique)
      .mockResolvedValueOnce(oldDoc as any)
      .mockResolvedValueOnce(newDoc as any);

    const result = await compareDocumentVersions('doc-1', 'doc-2');

    expect(result.changes.some(c => c.field === 'page_1_sheet_number')).toBe(true);
    const sheetChange = result.changes.find(c => c.field === 'page_1_sheet_number');
    expect(sheetChange?.oldValue).toBe('A-101');
    expect(sheetChange?.newValue).toBe('A-102');
  });

  it('should detect dimension changes', async () => {
    const oldDoc = {
      id: 'doc-1',
      name: 'Test Doc',
      DocumentChunk: [
        {
          id: 'chunk-1',
          metadata: {
            labeled_dimensions: [{ value: '10ft' }],
            derived_dimensions: [],
          },
        },
      ],
    };

    const newDoc = {
      id: 'doc-2',
      name: 'Test Doc',
      DocumentChunk: [
        {
          id: 'chunk-1',
          metadata: {
            labeled_dimensions: [{ value: '10ft' }, { value: '20ft' }],
            derived_dimensions: [{ value: '30ft' }],
          },
        },
      ],
    };

    vi.mocked(prisma.document.findUnique)
      .mockResolvedValueOnce(oldDoc as any)
      .mockResolvedValueOnce(newDoc as any);

    const result = await compareDocumentVersions('doc-1', 'doc-2');

    expect(result.changes.some(c => c.field === 'page_1_dimensions')).toBe(true);
    const dimChange = result.changes.find(c => c.field === 'page_1_dimensions');
    expect(dimChange?.oldValue).toBe(1);
    expect(dimChange?.newValue).toBe(3);
    expect(dimChange?.changeType).toBe('added');
  });

  it('should handle missing old document', async () => {
    vi.mocked(prisma.document.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'doc-2', DocumentChunk: [] } as any);

    await expect(compareDocumentVersions('doc-1', 'doc-2')).rejects.toThrow('One or both documents not found');
  });

  it('should handle missing new document', async () => {
    vi.mocked(prisma.document.findUnique)
      .mockResolvedValueOnce({ id: 'doc-1', DocumentChunk: [] } as any)
      .mockResolvedValueOnce(null);

    await expect(compareDocumentVersions('doc-1', 'doc-2')).rejects.toThrow('One or both documents not found');
  });

  it('should handle identical documents', async () => {
    const doc = {
      id: 'doc-1',
      name: 'Test Doc',
      DocumentChunk: [
        { id: 'chunk-1', metadata: { sheet_number: 'A-101' } },
      ],
    };

    vi.mocked(prisma.document.findUnique)
      .mockResolvedValueOnce(doc as any)
      .mockResolvedValueOnce(doc as any);

    const result = await compareDocumentVersions('doc-1', 'doc-1');

    expect(result.changes).toHaveLength(0);
    expect(result.summary).toContain('0 changes');
  });

  it('should generate accurate summary', async () => {
    const oldDoc = {
      id: 'doc-1',
      name: 'Old Name',
      DocumentChunk: [
        { id: 'chunk-1', metadata: { sheet_number: 'A-101' } },
      ],
    };

    const newDoc = {
      id: 'doc-2',
      name: 'New Name',
      DocumentChunk: [
        { id: 'chunk-1', metadata: { sheet_number: 'A-101' } },
        { id: 'chunk-2', metadata: {} },
      ],
    };

    vi.mocked(prisma.document.findUnique)
      .mockResolvedValueOnce(oldDoc as any)
      .mockResolvedValueOnce(newDoc as any);

    const result = await compareDocumentVersions('doc-1', 'doc-2');

    expect(result.summary).toMatch(/Found \d+ changes/);
    expect(result.summary).toContain('additions');
    expect(result.summary).toContain('modifications');
  });
});

describe('Document Intelligence - Related Documents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should find documents referenced by source document', async () => {
    const sourceDoc = {
      id: 'doc-1',
      name: 'Floor Plan',
      Project: {
        Document: [
          { id: 'doc-1', name: 'Floor Plan', fileName: 'floor.pdf' },
          { id: 'doc-2', name: 'Sheet A-101', fileName: 'A-101.pdf' },
        ],
      },
    };

    const mockChunks = [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        content: 'See Sheet A-101',
        pageNumber: 1,
        metadata: {},
        Document: sourceDoc,
      },
    ];

    vi.mocked(prisma.document.findUnique).mockResolvedValue(sourceDoc as any);
    vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

    const related = await getRelatedDocuments('doc-1');

    expect(related.length).toBeGreaterThan(0);
    const ref = related.find(r => r.id === 'doc-2');
    expect(ref).toBeDefined();
    expect(ref?.relationshipType).toBe('references');
  });

  it('should find documents that reference source document', async () => {
    const project = {
      Document: [
        { id: 'doc-1', name: 'Sheet A-101', fileName: 'A-101.pdf' },
        { id: 'doc-2', name: 'Floor Plan', fileName: 'floor.pdf' },
      ],
    };

    const sourceDoc = {
      id: 'doc-1',
      name: 'Sheet A-101',
      Project: project,
    };

    // Chunks for doc-2 that reference doc-1
    const doc2Chunks = [
      {
        id: 'chunk-2',
        documentId: 'doc-2',
        content: 'See Sheet A-101',
        pageNumber: 1,
        metadata: {},
        Document: {
          Project: project,
        },
      },
    ];

    vi.mocked(prisma.document.findUnique).mockResolvedValue(sourceDoc as any);

    // First call returns empty (for doc-1), second returns chunks for doc-2
    vi.mocked(prisma.documentChunk.findMany)
      .mockResolvedValueOnce([]) // doc-1 has no outgoing refs
      .mockResolvedValueOnce(doc2Chunks as any); // doc-2 references doc-1

    const related = await getRelatedDocuments('doc-1');

    const ref = related.find(r => r.id === 'doc-2');
    expect(ref).toBeDefined();
    expect(ref?.relationshipType).toBe('referenced_by');
  });

  it('should handle documents with no project', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: 'doc-1',
      name: 'Orphan Doc',
      Project: null,
    } as any);

    const related = await getRelatedDocuments('doc-1');

    expect(related).toEqual([]);
  });

  it('should handle missing document', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

    const related = await getRelatedDocuments('doc-1');

    expect(related).toEqual([]);
  });

  it('should deduplicate bidirectional references', async () => {
    const project = {
      Document: [
        { id: 'doc-1', name: 'Sheet A-101', fileName: 'A-101.pdf' },
        { id: 'doc-2', name: 'Sheet A-102', fileName: 'A-102.pdf' },
      ],
    };

    const sourceDoc = {
      id: 'doc-1',
      name: 'Sheet A-101',
      Project: project,
    };

    // doc-1 references doc-2
    const doc1Chunks = [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        content: 'See Sheet A-102',
        pageNumber: 1,
        metadata: {},
        Document: sourceDoc,
      },
    ];

    vi.mocked(prisma.document.findUnique).mockResolvedValue(sourceDoc as any);
    vi.mocked(prisma.documentChunk.findMany)
      .mockResolvedValueOnce(doc1Chunks as any)
      .mockResolvedValueOnce([]); // doc-2 has no refs back

    const related = await getRelatedDocuments('doc-1');

    // Should only have doc-2 once, not duplicated
    const doc2Refs = related.filter(r => r.id === 'doc-2');
    expect(doc2Refs).toHaveLength(1);
  });

  it('should handle database errors gracefully', async () => {
    vi.mocked(prisma.document.findUnique).mockRejectedValue(new Error('Database error'));

    const related = await getRelatedDocuments('doc-1');

    expect(related).toEqual([]);
  });

  it('should include context from references', async () => {
    const project = {
      Document: [
        { id: 'doc-1', name: 'Floor Plan', fileName: 'floor.pdf' },
        { id: 'doc-2', name: 'Sheet A-101', fileName: 'A-101.pdf' },
      ],
    };

    const sourceDoc = {
      id: 'doc-1',
      name: 'Floor Plan',
      Project: project,
    };

    const mockChunks = [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        content: 'See Sheet A-101 for wall details',
        pageNumber: 1,
        metadata: {},
        Document: sourceDoc,
      },
    ];

    vi.mocked(prisma.document.findUnique).mockResolvedValue(sourceDoc as any);
    vi.mocked(prisma.documentChunk.findMany)
      .mockResolvedValueOnce(mockChunks as any)
      .mockResolvedValueOnce([]); // No incoming refs

    const related = await getRelatedDocuments('doc-1');

    const ref = related.find(r => r.id === 'doc-2');
    expect(ref?.context).toBeTruthy();
    expect(ref?.context).toContain('Sheet A-101');
  });

  it('should handle multiple documents referencing the same target', async () => {
    const project = {
      Document: [
        { id: 'doc-1', name: 'Sheet A-101', fileName: 'A-101.pdf' },
        { id: 'doc-2', name: 'Sheet A-102', fileName: 'A-102.pdf' },
        { id: 'doc-3', name: 'Sheet A-103', fileName: 'A-103.pdf' },
      ],
    };

    const sourceDoc = {
      id: 'doc-1',
      name: 'Sheet A-101',
      Project: project,
    };

    // Both doc-2 and doc-3 reference doc-1
    const doc2Chunks = [
      {
        id: 'chunk-2',
        documentId: 'doc-2',
        content: 'Refer to Sheet A-101',
        pageNumber: 1,
        metadata: {},
        Document: { Project: project },
      },
    ];

    const doc3Chunks = [
      {
        id: 'chunk-3',
        documentId: 'doc-3',
        content: 'See Sheet A-101',
        pageNumber: 1,
        metadata: {},
        Document: { Project: project },
      },
    ];

    vi.mocked(prisma.document.findUnique).mockResolvedValue(sourceDoc as any);
    vi.mocked(prisma.documentChunk.findMany)
      .mockResolvedValueOnce([]) // doc-1 has no outgoing refs
      .mockResolvedValueOnce(doc2Chunks as any) // doc-2 refs doc-1
      .mockResolvedValueOnce(doc3Chunks as any); // doc-3 refs doc-1

    const related = await getRelatedDocuments('doc-1');

    expect(related.length).toBe(2);
    expect(related.every(r => r.relationshipType === 'referenced_by')).toBe(true);
  });
});

describe('Document Intelligence - Edge Cases and Patterns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle chunks with null metadata gracefully', async () => {
    const mockChunks = [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        content: 'See Sheet A-101',
        pageNumber: 1,
        metadata: null,
        Document: {
          Project: {
            Document: [
              { id: 'doc-2', name: 'Sheet A-101', fileName: 'A-101.pdf' },
            ],
          },
        },
      },
    ];

    vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

    const refs = await extractCrossReferences('doc-1');

    // Should still parse content references
    expect(refs.length).toBeGreaterThan(0);
  });

  it('should match sheet references with hyphens correctly', async () => {
    const mockChunks = [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        content: 'Shown on Sheet E-2.1',
        pageNumber: 1,
        metadata: {},
        Document: {
          Project: {
            Document: [
              { id: 'doc-electrical', name: 'Electrical E-2.1', fileName: 'E-2.1.pdf' },
            ],
          },
        },
      },
    ];

    vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

    const refs = await extractCrossReferences('doc-1');

    const electricalRef = refs.find(r => r.targetDocumentId === 'doc-electrical');
    expect(electricalRef).toBeDefined();
  });

  it('should handle version comparison with dimension removals', async () => {
    const oldDoc = {
      id: 'doc-1',
      name: 'Test Doc',
      DocumentChunk: [
        {
          id: 'chunk-1',
          metadata: {
            labeled_dimensions: [{ value: '10ft' }, { value: '20ft' }],
            derived_dimensions: [{ value: '30ft' }],
          },
        },
      ],
    };

    const newDoc = {
      id: 'doc-2',
      name: 'Test Doc',
      DocumentChunk: [
        {
          id: 'chunk-1',
          metadata: {
            labeled_dimensions: [{ value: '10ft' }],
            derived_dimensions: [],
          },
        },
      ],
    };

    vi.mocked(prisma.document.findUnique)
      .mockResolvedValueOnce(oldDoc as any)
      .mockResolvedValueOnce(newDoc as any);

    const result = await compareDocumentVersions('doc-1', 'doc-2');

    const dimChange = result.changes.find(c => c.field === 'page_1_dimensions');
    expect(dimChange?.changeType).toBe('removed');
    expect(dimChange?.oldValue).toBe(3);
    expect(dimChange?.newValue).toBe(1);
  });

  it('should handle documents with special characters in names', async () => {
    const mockChunks = [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        content: 'See Sheet M&E-101',
        pageNumber: 1,
        metadata: {},
        Document: {
          Project: {
            Document: [
              { id: 'doc-mep', name: 'M&E Equipment Schedule', fileName: 'M&E-101.pdf' },
            ],
          },
        },
      },
    ];

    vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

    const refs = await extractCrossReferences('doc-1');

    // Should not crash on special characters
    expect(Array.isArray(refs)).toBe(true);
  });

  it('should handle comparison with empty metadata', async () => {
    const oldDoc = {
      id: 'doc-1',
      name: 'Test Doc',
      DocumentChunk: [
        { id: 'chunk-1', metadata: null },
      ],
    };

    const newDoc = {
      id: 'doc-2',
      name: 'Test Doc',
      DocumentChunk: [
        { id: 'chunk-1', metadata: {} },
      ],
    };

    vi.mocked(prisma.document.findUnique)
      .mockResolvedValueOnce(oldDoc as any)
      .mockResolvedValueOnce(newDoc as any);

    const result = await compareDocumentVersions('doc-1', 'doc-2');

    // Should not crash and should handle gracefully
    expect(result.changes).toBeDefined();
    expect(Array.isArray(result.changes)).toBe(true);
  });

  it('should parse multiple reference patterns in same content', async () => {
    const mockChunks = [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        content: `
          See Sheet A-101 for plan view.
          Detail on A3.2 shows wall section.
          Refer to Drawing M-201 for mechanical details.
        `,
        pageNumber: 1,
        metadata: {},
        Document: {
          Project: {
            Document: [
              { id: 'doc-2', name: 'Sheet A-101', fileName: 'A-101.pdf' },
              { id: 'doc-3', name: 'Sheet A3.2', fileName: 'A3.2.pdf' },
              { id: 'doc-4', name: 'Mechanical M-201', fileName: 'M-201.pdf' },
            ],
          },
        },
      },
    ];

    vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

    const refs = await extractCrossReferences('doc-1');

    // Should extract at least 2 references (implementation may vary based on pattern matching)
    expect(refs.length).toBeGreaterThanOrEqual(2);
  });
});
