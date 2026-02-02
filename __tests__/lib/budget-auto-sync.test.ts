import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mocks Setup - Must use vi.hoisted for mock objects
// ============================================

// Mock Prisma with vi.hoisted
const mockPrisma = vi.hoisted(() => ({
  documentChunk: {
    findMany: vi.fn(),
  },
  projectBudget: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  budgetItem: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  materialTakeoff: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Mock OpenAI with vi.hoisted
const mockOpenAICreate = vi.hoisted(() => vi.fn());

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockOpenAICreate,
      },
    },
  })),
}));

// Set environment variable for OpenAI
process.env.OPENAI_API_KEY = 'test-api-key';

// Import functions after mocks
import {
  extractBudgetFromContent,
  syncBudgetToProject,
  compareTakeoffsToBudget,
  processUploadedBudgetDocument,
} from '@/lib/budget-auto-sync';

// ============================================
// Test Helpers
// ============================================

function createMockBudgetItem(overrides = {}) {
  return {
    phaseCode: 300,
    phaseName: 'CONCRETE',
    categoryNumber: 1,
    name: 'Foundation concrete',
    budgetedAmount: 50000,
    contractAmount: 50000,
    ...overrides,
  };
}

function createMockBudget(overrides = {}) {
  return {
    id: 'budget-1',
    projectId: 'project-1',
    totalBudget: 1000000,
    contingency: 50000,
    baselineDate: new Date('2024-01-01'),
    BudgetItem: [],
    ...overrides,
  };
}

function createMockDocumentChunk(content: string, pageNumber = 1) {
  return {
    id: `chunk-${pageNumber}`,
    documentId: 'doc-1',
    content,
    pageNumber,
    metadata: {},
  };
}

// ============================================
// AI JSON Extraction Tests (10 tests)
// ============================================

describe('Budget Auto-Sync - AI JSON Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract budget items from simple JSON response', async () => {
    const budgetJSON = [
      {
        phaseCode: 100,
        phaseName: 'GENERAL REQUIREMENTS',
        categoryNumber: 1,
        name: 'Mobilization',
        budgetedAmount: 35000,
        contractAmount: 35000,
      },
    ];

    mockOpenAICreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(budgetJSON),
          },
        },
      ],
    });

    const content = 'Budget Summary\nMobilization: $35,000\nGeneral Requirements';
    const result = await extractBudgetFromContent(content);

    expect(result).toEqual(budgetJSON);
    expect(mockOpenAICreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o',
        max_tokens: 4000,
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('Budget Summary'),
          }),
        ]),
      })
    );
  });

  it('should parse JSON from response with surrounding text', async () => {
    const budgetJSON = [
      {
        phaseCode: 300,
        phaseName: 'CONCRETE',
        categoryNumber: 1,
        name: 'Foundation',
        budgetedAmount: 120000,
        contractAmount: 120000,
      },
    ];

    mockOpenAICreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: `Here is the extracted budget data:\n\n${JSON.stringify(budgetJSON, null, 2)}\n\nThis includes foundation work.`,
          },
        },
      ],
    });

    const content = 'Foundation budget: $120,000';
    const result = await extractBudgetFromContent(content);

    expect(result).toEqual(budgetJSON);
  });

  it('should extract multiple budget items from response', async () => {
    const budgetJSON = [
      { phaseCode: 100, phaseName: 'GENERAL REQUIREMENTS', categoryNumber: 1, name: 'Mobilization', budgetedAmount: 35000, contractAmount: 35000 },
      { phaseCode: 200, phaseName: 'EXISTING CONDITIONS / DEMOLITION', categoryNumber: 1, name: 'Demolition', budgetedAmount: 25000, contractAmount: 25000 },
      { phaseCode: 300, phaseName: 'CONCRETE', categoryNumber: 1, name: 'Foundation', budgetedAmount: 120000, contractAmount: 120000 },
      { phaseCode: 500, phaseName: 'METALS', categoryNumber: 1, name: 'Structural Steel', budgetedAmount: 85000, contractAmount: 85000 },
    ];

    mockOpenAICreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(budgetJSON),
          },
        },
      ],
    });

    const result = await extractBudgetFromContent('Multi-phase budget document');

    expect(result).toHaveLength(4);
    expect(result[0].phaseCode).toBe(100);
    expect(result[3].phaseCode).toBe(500);
  });

  it('should handle CSI phase codes correctly', async () => {
    const budgetJSON = [
      { phaseCode: 2200, phaseName: 'PLUMBING', categoryNumber: 1, name: 'Plumbing rough-in', budgetedAmount: 45000, contractAmount: 45000 },
      { phaseCode: 2300, phaseName: 'HVAC', categoryNumber: 1, name: 'HVAC system', budgetedAmount: 95000, contractAmount: 95000 },
      { phaseCode: 2600, phaseName: 'ELECTRICAL', categoryNumber: 1, name: 'Electrical rough-in', budgetedAmount: 65000, contractAmount: 65000 },
    ];

    mockOpenAICreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(budgetJSON),
          },
        },
      ],
    });

    const result = await extractBudgetFromContent('MEP Budget');

    expect(result).toHaveLength(3);
    expect(result.find(item => item.phaseCode === 2200)).toBeDefined();
    expect(result.find(item => item.phaseCode === 2300)).toBeDefined();
    expect(result.find(item => item.phaseCode === 2600)).toBeDefined();
  });

  it('should return empty array when extraction fails', async () => {
    mockOpenAICreate.mockRejectedValue(new Error('API timeout'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await extractBudgetFromContent('Budget content');

    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Budget Auto-Sync] Failed to extract budget:',
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it('should return empty array for invalid JSON response', async () => {
    mockOpenAICreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'This is not valid JSON at all',
          },
        },
      ],
    });

    const result = await extractBudgetFromContent('Budget content');

    expect(result).toEqual([]);
  });

  it('should handle empty response from AI', async () => {
    mockOpenAICreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: '',
          },
        },
      ],
    });

    const result = await extractBudgetFromContent('Budget content');

    expect(result).toEqual([]);
  });

  it('should truncate content to 15000 characters before sending to AI', async () => {
    const longContent = 'Budget line item. '.repeat(2000); // ~36,000 characters

    mockOpenAICreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([createMockBudgetItem()]),
          },
        },
      ],
    });

    await extractBudgetFromContent(longContent);

    const callArgs = mockOpenAICreate.mock.calls[0][0];
    const promptContent = callArgs.messages[0].content;

    // Should truncate to 15000 chars
    expect(promptContent.length).toBeLessThan(longContent.length + 1000); // Allow for prompt wrapper
    expect(promptContent).toContain(longContent.substring(0, 15000));
  });

  it('should handle budgetedAmount and contractAmount differences', async () => {
    const budgetJSON = [
      {
        phaseCode: 300,
        phaseName: 'CONCRETE',
        categoryNumber: 1,
        name: 'Foundation',
        budgetedAmount: 120000,
        contractAmount: 115000, // Lower contract amount
      },
    ];

    mockOpenAICreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(budgetJSON),
          },
        },
      ],
    });

    const result = await extractBudgetFromContent('Budget content');

    expect(result[0].budgetedAmount).toBe(120000);
    expect(result[0].contractAmount).toBe(115000);
  });

  it('should handle sitework phase codes (3100-3300)', async () => {
    const budgetJSON = [
      { phaseCode: 3100, phaseName: 'SITEWORK', categoryNumber: 1, name: 'Excavation', budgetedAmount: 30000, contractAmount: 30000 },
      { phaseCode: 3200, phaseName: 'SITEWORK', categoryNumber: 2, name: 'Site utilities', budgetedAmount: 45000, contractAmount: 45000 },
      { phaseCode: 3300, phaseName: 'SITEWORK', categoryNumber: 3, name: 'Paving', budgetedAmount: 55000, contractAmount: 55000 },
    ];

    mockOpenAICreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(budgetJSON),
          },
        },
      ],
    });

    const result = await extractBudgetFromContent('Sitework budget');

    expect(result).toHaveLength(3);
    expect(result.every(item => item.phaseName === 'SITEWORK')).toBe(true);
  });
});

// ============================================
// Budget Sync Logic Tests (12 tests)
// ============================================

describe('Budget Auto-Sync - Sync Budget to Project', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create new budget when none exists', async () => {
    const items = [
      createMockBudgetItem({ budgetedAmount: 100000 }),
      createMockBudgetItem({ phaseCode: 500, phaseName: 'METALS', budgetedAmount: 50000 }),
    ];

    mockPrisma.projectBudget.findUnique.mockResolvedValue(null);
    mockPrisma.projectBudget.create.mockResolvedValue(
      createMockBudget({ totalBudget: 150000, contingency: 7500 })
    );
    mockPrisma.budgetItem.findFirst.mockResolvedValue(null);
    mockPrisma.budgetItem.create.mockResolvedValue({ id: 'item-1' });

    const result = await syncBudgetToProject('project-1', items);

    expect(result.created).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.total).toBe(2);

    // Verify budget was created with correct total and 5% contingency
    expect(mockPrisma.projectBudget.create).toHaveBeenCalledWith({
      data: {
        Project: { connect: { id: 'project-1' } },
        totalBudget: 150000,
        contingency: 7500, // 5% of 150000
        baselineDate: expect.any(Date),
      },
    });
  });

  it('should update existing budget total', async () => {
    const items = [
      createMockBudgetItem({ budgetedAmount: 120000 }),
      createMockBudgetItem({ phaseCode: 500, phaseName: 'METALS', budgetedAmount: 80000 }),
    ];

    const existingBudget = createMockBudget({ totalBudget: 150000 });
    mockPrisma.projectBudget.findUnique.mockResolvedValue(existingBudget);
    mockPrisma.projectBudget.update.mockResolvedValue(existingBudget);
    mockPrisma.budgetItem.findFirst.mockResolvedValue(null);
    mockPrisma.budgetItem.create.mockResolvedValue({ id: 'item-1' });

    const result = await syncBudgetToProject('project-1', items);

    expect(result.created).toBe(2);
    expect(result.updated).toBe(0);

    // Verify budget total was updated
    expect(mockPrisma.projectBudget.update).toHaveBeenCalledWith({
      where: { id: 'budget-1' },
      data: { totalBudget: 200000 },
    });
  });

  it('should update existing budget items instead of creating duplicates', async () => {
    const items = [
      createMockBudgetItem({ phaseCode: 300, categoryNumber: 1, budgetedAmount: 120000, contractAmount: 115000 }),
    ];

    const existingBudget = createMockBudget();
    const existingItem = {
      id: 'item-1',
      budgetId: 'budget-1',
      phaseCode: 300,
      categoryNumber: 1,
      name: 'Old name',
      budgetedAmount: 100000,
      contractAmount: 100000,
    };

    mockPrisma.projectBudget.findUnique.mockResolvedValue(existingBudget);
    mockPrisma.projectBudget.update.mockResolvedValue(existingBudget);
    mockPrisma.budgetItem.findFirst.mockResolvedValue(existingItem);
    mockPrisma.budgetItem.update.mockResolvedValue({ id: 'item-1' });

    const result = await syncBudgetToProject('project-1', items);

    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);
    expect(result.total).toBe(1);

    // Verify item was updated with new values
    expect(mockPrisma.budgetItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: {
        name: 'Foundation concrete',
        phaseName: 'CONCRETE',
        budgetedAmount: 120000,
        contractAmount: 115000,
      },
    });
  });

  it('should handle empty items array', async () => {
    const result = await syncBudgetToProject('project-1', []);

    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.total).toBe(0);
    expect(mockPrisma.projectBudget.findUnique).not.toHaveBeenCalled();
  });

  it('should create budget items with all required fields', async () => {
    const items = [createMockBudgetItem()];

    mockPrisma.projectBudget.findUnique.mockResolvedValue(createMockBudget());
    mockPrisma.projectBudget.update.mockResolvedValue(createMockBudget());
    mockPrisma.budgetItem.findFirst.mockResolvedValue(null);
    mockPrisma.budgetItem.create.mockResolvedValue({ id: 'item-1' });

    await syncBudgetToProject('project-1', items);

    expect(mockPrisma.budgetItem.create).toHaveBeenCalledWith({
      data: {
        budgetId: 'budget-1',
        phaseCode: 300,
        phaseName: 'CONCRETE',
        categoryNumber: 1,
        name: 'Foundation concrete',
        description: 'Foundation concrete',
        budgetedAmount: 50000,
        contractAmount: 50000,
        actualCost: 0,
        billedToDate: 0,
        budgetedHours: 0,
        actualHours: 0,
      },
    });
  });

  it('should handle items with different phase codes correctly', async () => {
    const items = [
      createMockBudgetItem({ phaseCode: 100, phaseName: 'GENERAL REQUIREMENTS', categoryNumber: 1 }),
      createMockBudgetItem({ phaseCode: 200, phaseName: 'EXISTING CONDITIONS / DEMOLITION', categoryNumber: 1 }),
      createMockBudgetItem({ phaseCode: 2200, phaseName: 'PLUMBING', categoryNumber: 1 }),
      createMockBudgetItem({ phaseCode: 2600, phaseName: 'ELECTRICAL', categoryNumber: 1 }),
    ];

    mockPrisma.projectBudget.findUnique.mockResolvedValue(createMockBudget());
    mockPrisma.projectBudget.update.mockResolvedValue(createMockBudget());
    mockPrisma.budgetItem.findFirst.mockResolvedValue(null);
    mockPrisma.budgetItem.create.mockResolvedValue({ id: 'item-1' });

    const result = await syncBudgetToProject('project-1', items);

    expect(result.created).toBe(4);
    expect(mockPrisma.budgetItem.create).toHaveBeenCalledTimes(4);
  });

  it('should calculate 5% contingency correctly', async () => {
    const items = [
      createMockBudgetItem({ budgetedAmount: 200000 }),
      createMockBudgetItem({ phaseCode: 500, budgetedAmount: 300000 }),
    ];

    mockPrisma.projectBudget.findUnique.mockResolvedValue(null);
    mockPrisma.projectBudget.create.mockResolvedValue(createMockBudget());
    mockPrisma.budgetItem.findFirst.mockResolvedValue(null);
    mockPrisma.budgetItem.create.mockResolvedValue({ id: 'item-1' });

    await syncBudgetToProject('project-1', items);

    // Total budget: 500000, contingency should be 25000 (5%)
    expect(mockPrisma.projectBudget.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalBudget: 500000,
          contingency: 25000,
        }),
      })
    );
  });

  it('should match items by phaseCode and categoryNumber combination', async () => {
    const items = [
      createMockBudgetItem({ phaseCode: 300, categoryNumber: 1, name: 'Foundation A' }),
      createMockBudgetItem({ phaseCode: 300, categoryNumber: 2, name: 'Foundation B' }),
    ];

    const existingBudget = createMockBudget();
    mockPrisma.projectBudget.findUnique.mockResolvedValue(existingBudget);
    mockPrisma.projectBudget.update.mockResolvedValue(existingBudget);

    // First item exists, second doesn't
    mockPrisma.budgetItem.findFirst
      .mockResolvedValueOnce({ id: 'item-1', phaseCode: 300, categoryNumber: 1 })
      .mockResolvedValueOnce(null);

    mockPrisma.budgetItem.update.mockResolvedValue({ id: 'item-1' });
    mockPrisma.budgetItem.create.mockResolvedValue({ id: 'item-2' });

    const result = await syncBudgetToProject('project-1', items);

    expect(result.created).toBe(1);
    expect(result.updated).toBe(1);

    // Verify correct matching by phaseCode and categoryNumber
    expect(mockPrisma.budgetItem.findFirst).toHaveBeenCalledWith({
      where: {
        budgetId: 'budget-1',
        phaseCode: 300,
        categoryNumber: 1,
      },
    });
    expect(mockPrisma.budgetItem.findFirst).toHaveBeenCalledWith({
      where: {
        budgetId: 'budget-1',
        phaseCode: 300,
        categoryNumber: 2,
      },
    });
  });

  it('should handle items with zero budgeted amount', async () => {
    const items = [
      createMockBudgetItem({ budgetedAmount: 0, contractAmount: 0 }),
    ];

    mockPrisma.projectBudget.findUnique.mockResolvedValue(null);
    mockPrisma.projectBudget.create.mockResolvedValue(createMockBudget());
    mockPrisma.budgetItem.findFirst.mockResolvedValue(null);
    mockPrisma.budgetItem.create.mockResolvedValue({ id: 'item-1' });

    const result = await syncBudgetToProject('project-1', items);

    expect(result.created).toBe(1);

    // Total budget should be 0, contingency should be 0
    expect(mockPrisma.projectBudget.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalBudget: 0,
          contingency: 0,
        }),
      })
    );
  });

  it('should set baselineDate when creating new budget', async () => {
    const items = [createMockBudgetItem()];

    mockPrisma.projectBudget.findUnique.mockResolvedValue(null);
    mockPrisma.projectBudget.create.mockResolvedValue(createMockBudget());
    mockPrisma.budgetItem.findFirst.mockResolvedValue(null);
    mockPrisma.budgetItem.create.mockResolvedValue({ id: 'item-1' });

    const beforeDate = new Date();
    await syncBudgetToProject('project-1', items);
    const afterDate = new Date();

    const createCall = mockPrisma.projectBudget.create.mock.calls[0][0];
    const baselineDate = createCall.data.baselineDate;

    expect(baselineDate).toBeInstanceOf(Date);
    expect(baselineDate.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
    expect(baselineDate.getTime()).toBeLessThanOrEqual(afterDate.getTime());
  });

  it('should handle mixed create and update operations', async () => {
    const items = [
      createMockBudgetItem({ phaseCode: 300, categoryNumber: 1, name: 'Item 1' }),
      createMockBudgetItem({ phaseCode: 300, categoryNumber: 2, name: 'Item 2' }),
      createMockBudgetItem({ phaseCode: 500, categoryNumber: 1, name: 'Item 3' }),
      createMockBudgetItem({ phaseCode: 500, categoryNumber: 2, name: 'Item 4' }),
    ];

    const existingBudget = createMockBudget();
    mockPrisma.projectBudget.findUnique.mockResolvedValue(existingBudget);
    mockPrisma.projectBudget.update.mockResolvedValue(existingBudget);

    // Items 1 and 3 exist, 2 and 4 are new
    mockPrisma.budgetItem.findFirst
      .mockResolvedValueOnce({ id: 'item-1' }) // Item 1 exists
      .mockResolvedValueOnce(null)             // Item 2 new
      .mockResolvedValueOnce({ id: 'item-3' }) // Item 3 exists
      .mockResolvedValueOnce(null);            // Item 4 new

    mockPrisma.budgetItem.update.mockResolvedValue({ id: 'updated' });
    mockPrisma.budgetItem.create.mockResolvedValue({ id: 'created' });

    const result = await syncBudgetToProject('project-1', items);

    expect(result.created).toBe(2);
    expect(result.updated).toBe(2);
    expect(result.total).toBe(4);
    expect(mockPrisma.budgetItem.update).toHaveBeenCalledTimes(2);
    expect(mockPrisma.budgetItem.create).toHaveBeenCalledTimes(2);
  });

  it('should use budgetedAmount or default to 0 when calculating total', async () => {
    const items = [
      createMockBudgetItem({ budgetedAmount: 50000 }),
      createMockBudgetItem({ budgetedAmount: undefined }), // Missing budgetedAmount
    ];

    mockPrisma.projectBudget.findUnique.mockResolvedValue(null);
    mockPrisma.projectBudget.create.mockResolvedValue(createMockBudget());
    mockPrisma.budgetItem.findFirst.mockResolvedValue(null);
    mockPrisma.budgetItem.create.mockResolvedValue({ id: 'item-1' });

    await syncBudgetToProject('project-1', items);

    // Should handle undefined budgetedAmount as 0
    expect(mockPrisma.projectBudget.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalBudget: 50000, // Only counts first item
          contingency: 2500,
        }),
      })
    );
  });
});

// ============================================
// Takeoff Variance Analysis Tests (5 tests)
// ============================================

describe('Budget Auto-Sync - Compare Takeoffs to Budget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect matching categories within 5% variance', async () => {
    const budget = createMockBudget({
      BudgetItem: [
        { id: 'item-1', phaseName: 'CONCRETE', budgetedAmount: 100000 },
        { id: 'item-2', phaseName: 'METALS', budgetedAmount: 50000 },
      ],
    });

    const takeoffs = [
      {
        id: 'takeoff-1',
        projectId: 'project-1',
        TakeoffLineItem: [
          { category: 'Concrete', totalCost: 102000 }, // 2% over budget (within 5%)
        ],
      },
      {
        id: 'takeoff-2',
        projectId: 'project-1',
        TakeoffLineItem: [
          { category: 'Metals', totalCost: 49000 }, // 2% under budget (within 5%)
        ],
      },
    ];

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.materialTakeoff.findMany.mockResolvedValue(takeoffs);

    const result = await compareTakeoffsToBudget('project-1');

    expect(result.matches).toBe(2);
    expect(result.overBudget).toBe(0);
    expect(result.underBudget).toBe(0);
    expect(result.missing).toBe(0);
  });

  it('should detect over-budget categories (>5% variance)', async () => {
    const budget = createMockBudget({
      BudgetItem: [
        { id: 'item-1', phaseName: 'CONCRETE', budgetedAmount: 100000 },
      ],
    });

    const takeoffs = [
      {
        id: 'takeoff-1',
        projectId: 'project-1',
        TakeoffLineItem: [
          { category: 'Concrete', totalCost: 120000 }, // 20% over budget
        ],
      },
    ];

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.materialTakeoff.findMany.mockResolvedValue(takeoffs);

    const result = await compareTakeoffsToBudget('project-1');

    expect(result.matches).toBe(0);
    expect(result.overBudget).toBe(1);
    expect(result.underBudget).toBe(0);
    expect(result.variances[0].variance).toBe(20000);
    expect(result.variances[0].variancePercent).toBe(20);
  });

  it('should detect under-budget categories (>5% variance)', async () => {
    const budget = createMockBudget({
      BudgetItem: [
        { id: 'item-1', phaseName: 'METALS', budgetedAmount: 80000 },
      ],
    });

    const takeoffs = [
      {
        id: 'takeoff-1',
        projectId: 'project-1',
        TakeoffLineItem: [
          { category: 'Metals', totalCost: 65000 }, // 18.75% under budget
        ],
      },
    ];

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.materialTakeoff.findMany.mockResolvedValue(takeoffs);

    const result = await compareTakeoffsToBudget('project-1');

    expect(result.matches).toBe(0);
    expect(result.overBudget).toBe(0);
    expect(result.underBudget).toBe(1);
    expect(result.variances[0].variance).toBe(-15000);
    expect(result.variances[0].variancePercent).toBe(-18.75);
  });

  it('should detect missing takeoff data for budget categories', async () => {
    const budget = createMockBudget({
      BudgetItem: [
        { id: 'item-1', phaseName: 'PLUMBING', budgetedAmount: 45000 },
        { id: 'item-2', phaseName: 'HVAC', budgetedAmount: 95000 },
      ],
    });

    const takeoffs = [
      {
        id: 'takeoff-1',
        projectId: 'project-1',
        TakeoffLineItem: [
          { category: 'Plumbing', totalCost: 0 }, // No takeoff data
        ],
      },
    ];

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.materialTakeoff.findMany.mockResolvedValue(takeoffs);

    const result = await compareTakeoffsToBudget('project-1');

    expect(result.missing).toBe(2); // Both phases have missing/zero takeoff data
    expect(result.matches).toBe(0);
  });

  it('should handle projects with no budget or takeoffs', async () => {
    mockPrisma.projectBudget.findUnique.mockResolvedValue(null);
    mockPrisma.materialTakeoff.findMany.mockResolvedValue([]);

    const result = await compareTakeoffsToBudget('project-1');

    expect(result.matches).toBe(0);
    expect(result.overBudget).toBe(0);
    expect(result.underBudget).toBe(0);
    expect(result.missing).toBe(0);
    expect(result.variances).toEqual([]);
  });
});

// ============================================
// CSI Phase Code Mapping Tests (5 tests)
// ============================================

describe('Budget Auto-Sync - CSI Phase Code Mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should map CONCRETE phase to Concrete category', async () => {
    const budget = createMockBudget({
      BudgetItem: [
        { id: 'item-1', phaseName: 'CONCRETE', budgetedAmount: 100000 },
      ],
    });

    const takeoffs = [
      {
        id: 'takeoff-1',
        projectId: 'project-1',
        TakeoffLineItem: [
          { category: 'Concrete', totalCost: 95000 },
        ],
      },
    ];

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.materialTakeoff.findMany.mockResolvedValue(takeoffs);

    const result = await compareTakeoffsToBudget('project-1');

    expect(result.variances[0].category).toBe('Concrete');
    expect(result.variances[0].budgetAmount).toBe(100000);
  });

  it('should map THERMAL & MOISTURE phase to Roofing category', async () => {
    const budget = createMockBudget({
      BudgetItem: [
        { id: 'item-1', phaseName: 'THERMAL & MOISTURE', budgetedAmount: 60000 },
      ],
    });

    const takeoffs = [
      {
        id: 'takeoff-1',
        projectId: 'project-1',
        TakeoffLineItem: [
          { category: 'Roofing', totalCost: 62000 },
        ],
      },
    ];

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.materialTakeoff.findMany.mockResolvedValue(takeoffs);

    const result = await compareTakeoffsToBudget('project-1');

    expect(result.variances[0].category).toBe('Roofing');
  });

  it('should map MEP phases correctly (PLUMBING, HVAC, ELECTRICAL)', async () => {
    const budget = createMockBudget({
      BudgetItem: [
        { id: 'item-1', phaseName: 'PLUMBING', budgetedAmount: 45000 },
        { id: 'item-2', phaseName: 'HVAC', budgetedAmount: 95000 },
        { id: 'item-3', phaseName: 'ELECTRICAL', budgetedAmount: 65000 },
      ],
    });

    const takeoffs = [
      {
        id: 'takeoff-1',
        projectId: 'project-1',
        TakeoffLineItem: [
          { category: 'Plumbing', totalCost: 44000 },
          { category: 'HVAC', totalCost: 97000 },
          { category: 'Electrical', totalCost: 63000 },
        ],
      },
    ];

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.materialTakeoff.findMany.mockResolvedValue(takeoffs);

    const result = await compareTakeoffsToBudget('project-1');

    expect(result.variances).toHaveLength(3);
    expect(result.variances.find(v => v.category === 'Plumbing')).toBeDefined();
    expect(result.variances.find(v => v.category === 'HVAC')).toBeDefined();
    expect(result.variances.find(v => v.category === 'Electrical')).toBeDefined();
  });

  it('should use phase name as category when no mapping exists', async () => {
    const budget = createMockBudget({
      BudgetItem: [
        { id: 'item-1', phaseName: 'CUSTOM PHASE', budgetedAmount: 25000 },
      ],
    });

    const takeoffs = [
      {
        id: 'takeoff-1',
        projectId: 'project-1',
        TakeoffLineItem: [
          { category: 'CUSTOM PHASE', totalCost: 24000 },
        ],
      },
    ];

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.materialTakeoff.findMany.mockResolvedValue(takeoffs);

    const result = await compareTakeoffsToBudget('project-1');

    expect(result.variances[0].category).toBe('CUSTOM PHASE');
  });

  it('should aggregate multiple line items by category', async () => {
    const budget = createMockBudget({
      BudgetItem: [
        { id: 'item-1', phaseName: 'CONCRETE', budgetedAmount: 150000 },
      ],
    });

    const takeoffs = [
      {
        id: 'takeoff-1',
        projectId: 'project-1',
        TakeoffLineItem: [
          { category: 'Concrete', totalCost: 50000 },
          { category: 'Concrete', totalCost: 60000 },
          { category: 'Concrete', totalCost: 45000 },
        ],
      },
    ];

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.materialTakeoff.findMany.mockResolvedValue(takeoffs);

    const result = await compareTakeoffsToBudget('project-1');

    // Should aggregate all concrete line items: 50000 + 60000 + 45000 = 155000
    expect(result.variances[0].takeoffAmount).toBe(155000);
    expect(result.variances[0].budgetAmount).toBe(150000);
    expect(result.variances[0].variance).toBe(5000);
  });
});

// ============================================
// Full Pipeline Orchestration Tests (5 tests)
// ============================================

describe('Budget Auto-Sync - Full Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process complete budget document successfully', async () => {
    const chunks = [
      createMockDocumentChunk('Budget Summary\n100 - Mobilization: $35,000', 1),
      createMockDocumentChunk('300 - Foundation: $120,000', 2),
    ];

    const budgetJSON = [
      { phaseCode: 100, phaseName: 'GENERAL REQUIREMENTS', categoryNumber: 1, name: 'Mobilization', budgetedAmount: 35000, contractAmount: 35000 },
      { phaseCode: 300, phaseName: 'CONCRETE', categoryNumber: 1, name: 'Foundation', budgetedAmount: 120000, contractAmount: 120000 },
    ];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);
    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(budgetJSON) } }],
    });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(null);
    mockPrisma.projectBudget.create.mockResolvedValue(createMockBudget());
    mockPrisma.budgetItem.findFirst.mockResolvedValue(null);
    mockPrisma.budgetItem.create.mockResolvedValue({ id: 'item-1' });

    mockPrisma.materialTakeoff.findMany.mockResolvedValue([]);

    const result = await processUploadedBudgetDocument('doc-1', 'project-1');

    expect(result.success).toBe(true);
    expect(result.itemsProcessed).toBe(2);
    expect(result.message).toContain('Imported 2 new items');
  });

  it('should handle document with no chunks', async () => {
    mockPrisma.documentChunk.findMany.mockResolvedValue([]);

    const result = await processUploadedBudgetDocument('doc-1', 'project-1');

    expect(result.success).toBe(false);
    expect(result.itemsProcessed).toBe(0);
    expect(result.message).toBe('No content found in document');
  });

  it('should handle AI extraction failure gracefully', async () => {
    const chunks = [createMockDocumentChunk('Budget data', 1)];
    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);
    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: 'Not valid JSON' } }],
    });

    const result = await processUploadedBudgetDocument('doc-1', 'project-1');

    expect(result.success).toBe(false);
    expect(result.itemsProcessed).toBe(0);
    expect(result.message).toBe('Could not extract budget items from document');
  });

  it('should log takeoff comparison results', async () => {
    const chunks = [createMockDocumentChunk('Budget', 1)];
    const budgetJSON = [createMockBudgetItem()];

    mockPrisma.documentChunk.findMany.mockResolvedValue(chunks);
    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(budgetJSON) } }],
    });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(null);
    mockPrisma.projectBudget.create.mockResolvedValue(createMockBudget());
    mockPrisma.budgetItem.findFirst.mockResolvedValue(null);
    mockPrisma.budgetItem.create.mockResolvedValue({ id: 'item-1' });

    const budget = createMockBudget({
      BudgetItem: [{ id: 'item-1', phaseName: 'CONCRETE', budgetedAmount: 50000 }],
    });
    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);

    const takeoffs = [
      {
        id: 'takeoff-1',
        projectId: 'project-1',
        TakeoffLineItem: [{ category: 'Concrete', totalCost: 52000 }],
      },
    ];
    mockPrisma.materialTakeoff.findMany.mockResolvedValue(takeoffs);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await processUploadedBudgetDocument('doc-1', 'project-1');

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Budget Auto-Sync] Processed 1 items, 1 created, 0 updated'
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Budget Auto-Sync] Takeoff comparison:')
    );

    consoleSpy.mockRestore();
  });

  it('should handle processing errors gracefully', async () => {
    mockPrisma.documentChunk.findMany.mockRejectedValue(new Error('Database error'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await processUploadedBudgetDocument('doc-1', 'project-1');

    expect(result.success).toBe(false);
    expect(result.itemsProcessed).toBe(0);
    expect(result.message).toBe('Failed to process budget document');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Budget Auto-Sync] Error:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});
