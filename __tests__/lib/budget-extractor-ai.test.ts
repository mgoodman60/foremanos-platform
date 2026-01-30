import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies BEFORE importing the module
const prismaMock = {
  document: {
    findUnique: vi.fn(),
  },
  documentChunk: {
    findMany: vi.fn(),
  },
  projectBudget: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  budgetItem: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
};

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

const callAbacusLLMMock = vi.fn();
vi.mock('@/lib/abacus-llm', () => ({
  callAbacusLLM: callAbacusLLMMock,
}));

const getFileUrlMock = vi.fn();
vi.mock('@/lib/s3', () => ({
  getFileUrl: getFileUrlMock,
}));

// Mock fetch globally
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe('Budget Extractor AI - Trade Type Inference', () => {
  it('should infer concrete_masonry from CSI code 03', async () => {
    const { extractBudgetWithAI } = await import('@/lib/budget-extractor-ai');

    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Budget.pdf',
      cloud_storage_path: 'projects/test/budget.pdf',
      isPublic: true,
    });

    getFileUrlMock.mockResolvedValue('https://s3.amazonaws.com/test/budget.pdf');

    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('PDF content'),
    });

    callAbacusLLMMock.mockResolvedValue({
      content: JSON.stringify({
        totalBudget: 100000,
        contingency: 5000,
        items: [
          { name: 'Concrete Foundation', costCode: '03 30 00', budgetedAmount: 100000 },
        ],
      }),
    });

    const result = await extractBudgetWithAI('doc-1', 'project-1', 'user-1');

    expect(result.lineItems[0].tradeType).toBe('concrete_masonry');
  });

  it('should infer electrical from CSI code 26', async () => {
    const { extractBudgetWithAI } = await import('@/lib/budget-extractor-ai');

    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Budget.pdf',
      cloud_storage_path: 'projects/test/budget.pdf',
      isPublic: true,
    });

    getFileUrlMock.mockResolvedValue('https://s3.amazonaws.com/test/budget.pdf');

    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('PDF content'),
    });

    callAbacusLLMMock.mockResolvedValue({
      content: JSON.stringify({
        totalBudget: 50000,
        contingency: 2500,
        items: [
          { name: 'Electrical Work', costCode: '26-00', budgetedAmount: 50000 },
        ],
      }),
    });

    const result = await extractBudgetWithAI('doc-1', 'project-1', 'user-1');

    expect(result.lineItems[0].tradeType).toBe('electrical');
  });

  it('should infer plumbing from CSI code 22', async () => {
    const { extractBudgetWithAI } = await import('@/lib/budget-extractor-ai');

    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Budget.pdf',
      cloud_storage_path: 'projects/test/budget.pdf',
      isPublic: true,
    });

    getFileUrlMock.mockResolvedValue('https://s3.amazonaws.com/test/budget.pdf');

    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('PDF content'),
    });

    callAbacusLLMMock.mockResolvedValue({
      content: JSON.stringify({
        totalBudget: 75000,
        contingency: 3750,
        items: [
          { name: 'Plumbing Systems', costCode: '22 00 00', budgetedAmount: 75000 },
        ],
      }),
    });

    const result = await extractBudgetWithAI('doc-1', 'project-1', 'user-1');

    expect(result.lineItems[0].tradeType).toBe('plumbing');
  });

  it('should infer hvac_mechanical from CSI code 23', async () => {
    const { extractBudgetWithAI } = await import('@/lib/budget-extractor-ai');

    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Budget.pdf',
      cloud_storage_path: 'projects/test/budget.pdf',
      isPublic: true,
    });

    getFileUrlMock.mockResolvedValue('https://s3.amazonaws.com/test/budget.pdf');

    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('PDF content'),
    });

    callAbacusLLMMock.mockResolvedValue({
      content: JSON.stringify({
        totalBudget: 120000,
        contingency: 6000,
        items: [
          { name: 'HVAC Installation', costCode: '23 00', budgetedAmount: 120000 },
        ],
      }),
    });

    const result = await extractBudgetWithAI('doc-1', 'project-1', 'user-1');

    expect(result.lineItems[0].tradeType).toBe('hvac_mechanical');
  });

  it('should infer trade from keywords when no cost code', async () => {
    const { extractBudgetWithAI } = await import('@/lib/budget-extractor-ai');

    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Budget.pdf',
      cloud_storage_path: 'projects/test/budget.pdf',
      isPublic: true,
    });

    getFileUrlMock.mockResolvedValue('https://s3.amazonaws.com/test/budget.pdf');

    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('PDF content'),
    });

    callAbacusLLMMock.mockResolvedValue({
      content: JSON.stringify({
        totalBudget: 30000,
        contingency: 1500,
        items: [
          { name: 'Interior Painting', budgetedAmount: 30000 },
        ],
      }),
    });

    const result = await extractBudgetWithAI('doc-1', 'project-1', 'user-1');

    expect(result.lineItems[0].tradeType).toBe('painting_coating');
  });

  it('should infer carpentry_framing from CSI code 06', async () => {
    const { extractBudgetWithAI } = await import('@/lib/budget-extractor-ai');

    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Budget.pdf',
      cloud_storage_path: 'projects/test/budget.pdf',
      isPublic: true,
    });

    getFileUrlMock.mockResolvedValue('https://s3.amazonaws.com/test/budget.pdf');

    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('PDF content'),
    });

    callAbacusLLMMock.mockResolvedValue({
      content: JSON.stringify({
        totalBudget: 80000,
        contingency: 4000,
        items: [
          { name: 'Rough Carpentry', costCode: '06 10 00', budgetedAmount: 80000 },
        ],
      }),
    });

    const result = await extractBudgetWithAI('doc-1', 'project-1', 'user-1');

    expect(result.lineItems[0].tradeType).toBe('carpentry_framing');
  });

  it('should infer roofing from CSI code 07', async () => {
    const { extractBudgetWithAI } = await import('@/lib/budget-extractor-ai');

    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Budget.pdf',
      cloud_storage_path: 'projects/test/budget.pdf',
      isPublic: true,
    });

    getFileUrlMock.mockResolvedValue('https://s3.amazonaws.com/test/budget.pdf');

    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('PDF content'),
    });

    callAbacusLLMMock.mockResolvedValue({
      content: JSON.stringify({
        totalBudget: 60000,
        contingency: 3000,
        items: [
          { name: 'Roof Assembly', costCode: '07 50 00', budgetedAmount: 60000 },
        ],
      }),
    });

    const result = await extractBudgetWithAI('doc-1', 'project-1', 'user-1');

    expect(result.lineItems[0].tradeType).toBe('roofing');
  });
});

describe('Budget Extractor AI - PDF Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract budget items from PDF with vision API', async () => {
    const { extractBudgetWithAI } = await import('@/lib/budget-extractor-ai');

    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Budget.pdf',
      cloud_storage_path: 'projects/test/budget.pdf',
      isPublic: true,
    });

    getFileUrlMock.mockResolvedValue('https://s3.amazonaws.com/test/budget.pdf');

    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('PDF content'),
    });

    callAbacusLLMMock.mockResolvedValue({
      content: JSON.stringify({
        totalBudget: 500000,
        contingency: 25000,
        items: [
          {
            name: 'Site Work',
            costCode: '02 00 00',
            budgetedAmount: 100000,
            quantity: 1,
            unit: 'LS',
          },
          {
            name: 'Concrete',
            costCode: '03 00 00',
            budgetedAmount: 200000,
            quantity: 500,
            unit: 'CY',
            unitCost: 400,
          },
        ],
      }),
    });

    const result = await extractBudgetWithAI('doc-1', 'project-1', 'user-1');

    // totalBudget is calculated from sum of items (100000 + 200000 = 300000)
    expect(result.totalBudget).toBe(300000);
    // contingency is extracted from items with 'contingency' or 'reserve' in name (none here)
    expect(result.contingency).toBe(0);
    expect(result.lineItems).toHaveLength(2);
    expect(result.lineItems[0].name).toBe('Site Work');
    expect(result.lineItems[1].quantity).toBe(500);
    expect(result.lineItems[1].unitCost).toBe(400);
    expect(result.extractionMethod).toBe('vision');
  });

  it('should calculate confidence score based on cost codes', async () => {
    const { extractBudgetWithAI } = await import('@/lib/budget-extractor-ai');

    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Budget.pdf',
      cloud_storage_path: 'projects/test/budget.pdf',
      isPublic: true,
    });

    getFileUrlMock.mockResolvedValue('https://s3.amazonaws.com/test/budget.pdf');

    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('PDF content'),
    });

    callAbacusLLMMock.mockResolvedValue({
      content: JSON.stringify({
        totalBudget: 300000,
        contingency: 15000,
        items: [
          { name: 'Item 1', costCode: '03 00', budgetedAmount: 100000 },
          { name: 'Item 2', costCode: '26 00', budgetedAmount: 100000 },
          { name: 'Item 3', budgetedAmount: 100000 }, // No cost code
        ],
      }),
    });

    const result = await extractBudgetWithAI('doc-1', 'project-1', 'user-1');

    // Confidence: base 50 + cost code bonus + contingency = 70+
    expect(result.confidence).toBeGreaterThanOrEqual(70);
  });

  it('should identify and extract contingency line item', async () => {
    const { extractBudgetWithAI } = await import('@/lib/budget-extractor-ai');

    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Budget.pdf',
      cloud_storage_path: 'projects/test/budget.pdf',
      isPublic: true,
    });

    getFileUrlMock.mockResolvedValue('https://s3.amazonaws.com/test/budget.pdf');

    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('PDF content'),
    });

    callAbacusLLMMock.mockResolvedValue({
      content: JSON.stringify({
        totalBudget: 220000,
        contingency: 0,
        items: [
          { name: 'Construction Work', budgetedAmount: 200000 },
          { name: 'Contingency Reserve', budgetedAmount: 20000 },
        ],
      }),
    });

    const result = await extractBudgetWithAI('doc-1', 'project-1', 'user-1');

    expect(result.contingency).toBe(20000);
    expect(result.lineItems).toHaveLength(2);
  });

  it('should throw error when document not found', async () => {
    const { extractBudgetWithAI } = await import('@/lib/budget-extractor-ai');

    prismaMock.document.findUnique.mockResolvedValue(null);

    await expect(extractBudgetWithAI('doc-1', 'project-1', 'user-1')).rejects.toThrow(
      'Document not found'
    );
  });

  it('should throw error when no cloud storage path', async () => {
    const { extractBudgetWithAI } = await import('@/lib/budget-extractor-ai');

    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Budget.pdf',
      cloud_storage_path: null,
      isPublic: true,
    });

    await expect(extractBudgetWithAI('doc-1', 'project-1', 'user-1')).rejects.toThrow(
      'Document has no file path'
    );
  });

  it('should fallback to text chunks when vision extraction fails', async () => {
    const { extractBudgetWithAI } = await import('@/lib/budget-extractor-ai');

    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Budget.pdf',
      cloud_storage_path: 'projects/test/budget.pdf',
      isPublic: true,
    });

    getFileUrlMock.mockResolvedValue('https://s3.amazonaws.com/test/budget.pdf');

    // First fetch fails (vision)
    fetchMock.mockRejectedValueOnce(new Error('S3 error'));

    // Text chunk extraction succeeds
    prismaMock.documentChunk.findMany.mockResolvedValue([
      { id: '1', content: 'Budget line items...', pageNumber: 1 },
    ]);

    callAbacusLLMMock.mockResolvedValue({
      content: JSON.stringify({
        totalBudget: 100000,
        contingency: 5000,
        items: [{ name: 'Work Item', budgetedAmount: 100000 }],
      }),
    });

    const result = await extractBudgetWithAI('doc-1', 'project-1', 'user-1');

    expect(result.extractionMethod).toBe('text');
    expect(result.lineItems).toHaveLength(1);
  });
});

describe('Budget Extractor AI - Import to Project', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create new budget and import items', async () => {
    const { importBudgetToProject } = await import('@/lib/budget-extractor-ai');

    prismaMock.projectBudget.findUnique.mockResolvedValue(null);

    const newBudget = {
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 500000,
      contingency: 25000,
    };

    prismaMock.projectBudget.create.mockResolvedValue(newBudget);
    prismaMock.budgetItem.createMany.mockResolvedValue({ count: 3 });

    const extraction = {
      totalBudget: 500000,
      contingency: 25000,
      lineItems: [
        {
          name: 'Item 1',
          costCode: '03 00',
          tradeType: 'concrete_masonry' as const,
          budgetedAmount: 150000,
        },
        {
          name: 'Item 2',
          costCode: '26 00',
          tradeType: 'electrical' as const,
          budgetedAmount: 200000,
        },
        {
          name: 'Item 3',
          tradeType: 'plumbing' as const,
          budgetedAmount: 150000,
        },
      ],
      currency: 'USD',
      extractionMethod: 'vision',
      confidence: 85,
    };

    const result = await importBudgetToProject('project-1', extraction, 'user-1');

    expect(result.budgetId).toBe('budget-1');
    expect(result.itemsCreated).toBe(3);

    expect(prismaMock.projectBudget.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'project-1',
        totalBudget: 500000,
        contingency: 25000,
        currency: 'USD',
      }),
    });

    expect(prismaMock.budgetItem.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          name: 'Item 1',
          costCode: '03 00',
          tradeType: 'concrete_masonry',
          budgetedAmount: 150000,
        }),
      ]),
    });
  });

  it('should update existing budget and replace items', async () => {
    const { importBudgetToProject } = await import('@/lib/budget-extractor-ai');

    const existingBudget = {
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 400000,
    };

    prismaMock.projectBudget.findUnique.mockResolvedValue(existingBudget);
    prismaMock.projectBudget.update.mockResolvedValue(existingBudget);
    prismaMock.budgetItem.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.budgetItem.createMany.mockResolvedValue({ count: 2 });

    const extraction = {
      totalBudget: 500000,
      contingency: 25000,
      lineItems: [
        { name: 'New Item 1', budgetedAmount: 250000 },
        { name: 'New Item 2', budgetedAmount: 250000 },
      ],
      currency: 'USD',
      extractionMethod: 'vision',
      confidence: 80,
    };

    const result = await importBudgetToProject('project-1', extraction, 'user-1');

    expect(result.budgetId).toBe('budget-1');
    expect(result.itemsCreated).toBe(2);

    // Should delete old items
    expect(prismaMock.budgetItem.deleteMany).toHaveBeenCalledWith({
      where: { budgetId: 'budget-1' },
    });

    // Should update budget totals
    expect(prismaMock.projectBudget.update).toHaveBeenCalledWith({
      where: { id: 'budget-1' },
      data: expect.objectContaining({
        totalBudget: 500000,
        contingency: 25000,
      }),
    });
  });
});
