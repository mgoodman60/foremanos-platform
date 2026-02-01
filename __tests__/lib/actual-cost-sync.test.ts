import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Prisma BEFORE importing the module
const mockPrisma = vi.hoisted(() => ({
  paymentApplication: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  invoice: {
    findMany: vi.fn(),
  },
  projectBudget: {
    findFirst: vi.fn(),
  },
  budgetItem: {
    update: vi.fn(),
  },
  projectDataSource: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

describe('Actual Cost Sync - getProjectActualCosts()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Priority 1: Pay Application Data Tests
  // ============================================

  it('should return PAY_APPLICATION source when pay apps exist', async () => {
    const { getProjectActualCosts } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([
      {
        id: 'payapp-1',
        applicationNumber: 3,
        totalCompleted: 500000,
        scheduledValue: 1000000,
        periodEnd: new Date('2024-01-15'),
        items: [
          {
            id: 'item-1',
            description: 'Foundation',
            scheduledValue: 100000,
            totalCompleted: 95000,
            percentComplete: 95,
          },
          {
            id: 'item-2',
            description: 'Framing',
            scheduledValue: 150000,
            totalCompleted: 140000,
            percentComplete: 93.33,
          },
        ],
      },
    ]);

    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      totalBudget: 1000000,
      BudgetItem: [],
    });

    const result = await getProjectActualCosts('project-1');

    expect(result.source).toBe('PAY_APPLICATION');
    expect(result.totalActualCost).toBe(500000);
    expect(result.totalBudget).toBe(1000000);
    expect(result.percentComplete).toBe(50); // 500000 / 1000000 * 100
    expect(result.lastUpdated).toEqual(new Date('2024-01-15'));
    expect(result.byCategory).toHaveLength(2);
  });

  it('should build category breakdown from pay app items', async () => {
    const { getProjectActualCosts } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([
      {
        id: 'payapp-1',
        applicationNumber: 1,
        totalCompleted: 200000,
        scheduledValue: 400000,
        periodEnd: new Date('2024-01-10'),
        items: [
          {
            id: 'item-1',
            description: 'Concrete Work',
            scheduledValue: 150000,
            totalCompleted: 120000,
            percentComplete: 80,
          },
          {
            id: 'item-2',
            description: 'Steel Work',
            scheduledValue: 250000,
            totalCompleted: 80000,
            percentComplete: 32,
          },
        ],
      },
    ]);

    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.projectBudget.findFirst.mockResolvedValue(null);

    const result = await getProjectActualCosts('project-1');

    expect(result.byCategory).toEqual([
      {
        name: 'Concrete Work',
        budget: 150000,
        actual: 120000,
        percentComplete: 80,
        source: 'PAY_APPLICATION',
      },
      {
        name: 'Steel Work',
        budget: 250000,
        actual: 80000,
        percentComplete: 32,
        source: 'PAY_APPLICATION',
      },
    ]);
  });

  it('should use latest pay app when multiple exist (highest applicationNumber)', async () => {
    const { getProjectActualCosts } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([
      {
        id: 'payapp-3',
        applicationNumber: 3,
        totalCompleted: 750000,
        scheduledValue: 1000000,
        periodEnd: new Date('2024-03-01'),
        items: [],
      },
      {
        id: 'payapp-2',
        applicationNumber: 2,
        totalCompleted: 500000,
        scheduledValue: 1000000,
        periodEnd: new Date('2024-02-01'),
        items: [],
      },
      {
        id: 'payapp-1',
        applicationNumber: 1,
        totalCompleted: 250000,
        scheduledValue: 1000000,
        periodEnd: new Date('2024-01-01'),
        items: [],
      },
    ]);

    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.projectBudget.findFirst.mockResolvedValue(null);

    const result = await getProjectActualCosts('project-1');

    expect(result.totalActualCost).toBe(750000);
    expect(result.lastUpdated).toEqual(new Date('2024-03-01'));
  });

  it('should use pay app scheduledValue as budget when no ProjectBudget exists', async () => {
    const { getProjectActualCosts } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([
      {
        id: 'payapp-1',
        applicationNumber: 1,
        totalCompleted: 300000,
        scheduledValue: 800000,
        periodEnd: new Date('2024-01-15'),
        items: [],
      },
    ]);

    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.projectBudget.findFirst.mockResolvedValue(null);

    const result = await getProjectActualCosts('project-1');

    expect(result.totalBudget).toBe(800000);
  });

  it('should filter pay apps to only approved/paid statuses', async () => {
    const { getProjectActualCosts } = await import('@/lib/actual-cost-sync');

    // Mock will only return approved/paid pay apps (query already filtered)
    mockPrisma.paymentApplication.findMany.mockResolvedValue([
      {
        id: 'payapp-1',
        applicationNumber: 1,
        status: 'APPROVED',
        totalCompleted: 100000,
        scheduledValue: 200000,
        periodEnd: new Date('2024-01-10'),
        items: [],
      },
    ]);

    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.projectBudget.findFirst.mockResolvedValue(null);

    await getProjectActualCosts('project-1');

    expect(mockPrisma.paymentApplication.findMany).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        status: { in: ['APPROVED', 'PARTIALLY_PAID', 'PAID'] },
      },
      orderBy: { applicationNumber: 'desc' },
      include: { items: true },
    });
  });

  // ============================================
  // Priority 2: Invoice Data Tests
  // ============================================

  it('should return INVOICE source when no pay apps but invoices exist', async () => {
    const { getProjectActualCosts } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);
    // Note: invoices are returned in createdAt desc order (most recent first)
    mockPrisma.invoice.findMany.mockResolvedValue([
      { id: 'inv-2', amount: 75000, createdAt: new Date('2024-01-20') },
      { id: 'inv-1', amount: 50000, createdAt: new Date('2024-01-10') },
      { id: 'inv-3', amount: 25000, createdAt: new Date('2024-01-05') },
    ]);

    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      totalBudget: 500000,
      BudgetItem: [],
    });

    const result = await getProjectActualCosts('project-1');

    expect(result.source).toBe('INVOICE');
    expect(result.totalActualCost).toBe(150000); // 50k + 75k + 25k
    expect(result.totalBudget).toBe(500000);
    expect(result.percentComplete).toBe(30);
    expect(result.lastUpdated).toEqual(new Date('2024-01-20')); // Most recent invoice
  });

  it('should sum all invoice amounts for total actual cost', async () => {
    const { getProjectActualCosts } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([
      { id: 'inv-1', amount: 10000, createdAt: new Date() },
      { id: 'inv-2', amount: 20000, createdAt: new Date() },
      { id: 'inv-3', amount: 15000, createdAt: new Date() },
      { id: 'inv-4', amount: 5000, createdAt: new Date() },
    ]);

    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      totalBudget: 100000,
      BudgetItem: [],
    });

    const result = await getProjectActualCosts('project-1');

    expect(result.totalActualCost).toBe(50000);
  });

  it('should handle null invoice amounts gracefully', async () => {
    const { getProjectActualCosts } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([
      { id: 'inv-1', amount: 10000, createdAt: new Date() },
      { id: 'inv-2', amount: null, createdAt: new Date() },
      { id: 'inv-3', amount: 15000, createdAt: new Date() },
    ]);

    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      totalBudget: 100000,
      BudgetItem: [],
    });

    const result = await getProjectActualCosts('project-1');

    expect(result.totalActualCost).toBe(25000); // 10k + 0 + 15k
  });

  it('should return empty byCategory array for invoice source', async () => {
    const { getProjectActualCosts } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([
      { id: 'inv-1', amount: 50000, createdAt: new Date() },
    ]);

    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      totalBudget: 200000,
      BudgetItem: [],
    });

    const result = await getProjectActualCosts('project-1');

    expect(result.byCategory).toEqual([]);
  });

  it('should use budget totalBudget when available for invoice source', async () => {
    const { getProjectActualCosts } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([
      { id: 'inv-1', amount: 50000, createdAt: new Date() },
    ]);

    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      totalBudget: 300000,
      BudgetItem: [],
    });

    const result = await getProjectActualCosts('project-1');

    expect(result.totalBudget).toBe(300000);
  });

  // ============================================
  // Priority 3: Derived Data Tests
  // ============================================

  it('should return DERIVED source when no pay apps or invoices exist', async () => {
    const { getProjectActualCosts } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      totalBudget: 500000,
      updatedAt: new Date('2024-01-15'),
      BudgetItem: [
        {
          id: 'item-1',
          name: 'Site Work',
          budgetedAmount: 100000,
          actualCost: 95000,
        },
        {
          id: 'item-2',
          name: 'Foundation',
          budgetedAmount: 150000,
          actualCost: 140000,
        },
        {
          id: 'item-3',
          name: 'Framing',
          budgetedAmount: 200000,
          actualCost: 180000,
        },
      ],
    });

    const result = await getProjectActualCosts('project-1');

    expect(result.source).toBe('DERIVED');
    expect(result.totalActualCost).toBe(415000); // 95k + 140k + 180k
    expect(result.totalBudget).toBe(500000);
    expect(result.lastUpdated).toEqual(new Date('2024-01-15'));
  });

  it('should calculate derived category breakdown with percent complete', async () => {
    const { getProjectActualCosts } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      totalBudget: 300000,
      updatedAt: new Date(),
      BudgetItem: [
        {
          id: 'item-1',
          name: 'Electrical',
          budgetedAmount: 100000,
          actualCost: 80000,
        },
        {
          id: 'item-2',
          name: 'Plumbing',
          budgetedAmount: 120000,
          actualCost: 100000,
        },
      ],
    });

    const result = await getProjectActualCosts('project-1');

    expect(result.byCategory).toHaveLength(2);
    expect(result.byCategory[0]).toEqual({
      name: 'Electrical',
      budget: 100000,
      actual: 80000,
      percentComplete: 80,
      source: 'DERIVED',
    });
    expect(result.byCategory[1].name).toBe('Plumbing');
    expect(result.byCategory[1].budget).toBe(120000);
    expect(result.byCategory[1].actual).toBe(100000);
    expect(result.byCategory[1].percentComplete).toBeCloseTo(83.33, 1);
    expect(result.byCategory[1].source).toBe('DERIVED');
  });

  it('should filter out budget items with zero or null actualCost from byCategory', async () => {
    const { getProjectActualCosts } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      totalBudget: 300000,
      updatedAt: new Date(),
      BudgetItem: [
        {
          id: 'item-1',
          name: 'Completed Work',
          budgetedAmount: 100000,
          actualCost: 95000,
        },
        {
          id: 'item-2',
          name: 'Not Started',
          budgetedAmount: 50000,
          actualCost: 0,
        },
        {
          id: 'item-3',
          name: 'Not Started 2',
          budgetedAmount: 75000,
          actualCost: null,
        },
        {
          id: 'item-4',
          name: 'In Progress',
          budgetedAmount: 80000,
          actualCost: 30000,
        },
      ],
    });

    const result = await getProjectActualCosts('project-1');

    expect(result.byCategory).toHaveLength(2);
    expect(result.byCategory.map((c) => c.name)).toEqual([
      'Completed Work',
      'In Progress',
    ]);
  });

  it('should sum BudgetItem budgetedAmounts as totalBudget when totalBudget is null', async () => {
    const { getProjectActualCosts } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      totalBudget: null,
      updatedAt: new Date(),
      BudgetItem: [
        { id: 'item-1', name: 'Work 1', budgetedAmount: 100000, actualCost: 80000 },
        { id: 'item-2', name: 'Work 2', budgetedAmount: 150000, actualCost: 120000 },
        { id: 'item-3', name: 'Work 3', budgetedAmount: 75000, actualCost: 60000 },
      ],
    });

    const result = await getProjectActualCosts('project-1');

    expect(result.totalBudget).toBe(325000); // 100k + 150k + 75k
  });

  it('should handle null actualCost in budget items when summing', async () => {
    const { getProjectActualCosts } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      totalBudget: 300000,
      updatedAt: new Date(),
      BudgetItem: [
        { id: 'item-1', name: 'Work 1', budgetedAmount: 100000, actualCost: 80000 },
        { id: 'item-2', name: 'Work 2', budgetedAmount: 150000, actualCost: null },
        { id: 'item-3', name: 'Work 3', budgetedAmount: 75000, actualCost: 60000 },
      ],
    });

    const result = await getProjectActualCosts('project-1');

    expect(result.totalActualCost).toBe(140000); // 80k + 0 + 60k
  });

  // ============================================
  // Priority 4: No Data (NONE) Tests
  // ============================================

  it('should return NONE source when no data exists', async () => {
    const { getProjectActualCosts } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.projectBudget.findFirst.mockResolvedValue(null);

    const result = await getProjectActualCosts('project-1');

    expect(result.source).toBe('NONE');
    expect(result.totalActualCost).toBe(0);
    expect(result.totalBudget).toBe(0);
    expect(result.percentComplete).toBe(0);
    expect(result.lastUpdated).toBeNull();
    expect(result.byCategory).toEqual([]);
  });

  it('should return NONE when budget exists but has no items', async () => {
    const { getProjectActualCosts } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      totalBudget: 500000,
      updatedAt: new Date(),
      BudgetItem: [],
    });

    const result = await getProjectActualCosts('project-1');

    expect(result.source).toBe('NONE');
    expect(result.totalBudget).toBe(500000);
  });

  // ============================================
  // Data Quality Metrics Tests
  // ============================================

  it('should calculate data quality metrics correctly with pay apps', async () => {
    const { getProjectActualCosts } = await import('@/lib/actual-cost-sync');

    const latestPayAppDate = new Date('2024-01-20');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([
      {
        id: 'payapp-2',
        applicationNumber: 2,
        totalCompleted: 200000,
        scheduledValue: 500000,
        periodEnd: latestPayAppDate,
        items: [],
      },
      {
        id: 'payapp-1',
        applicationNumber: 1,
        totalCompleted: 100000,
        scheduledValue: 500000,
        periodEnd: new Date('2024-01-10'),
        items: [],
      },
    ]);

    mockPrisma.invoice.findMany.mockResolvedValue([
      { id: 'inv-1', amount: 50000, createdAt: new Date() },
    ]);

    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      totalBudget: 500000,
      BudgetItem: [
        { id: 'item-1', budgetedAmount: 100000, actualCost: 95000 },
      ],
    });

    const result = await getProjectActualCosts('project-1');

    expect(result.dataQuality).toEqual({
      hasPayApps: true,
      payAppCount: 2,
      latestPayAppDate,
      hasInvoices: true,
      invoiceCount: 1,
      hasDerivedData: true,
    });
  });

  it('should detect hasDerivedData when budget items have actualCost > 0', async () => {
    const { getProjectActualCosts } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      totalBudget: 500000,
      BudgetItem: [
        { id: 'item-1', budgetedAmount: 100000, actualCost: 0 },
        { id: 'item-2', budgetedAmount: 150000, actualCost: 75000 },
      ],
    });

    const result = await getProjectActualCosts('project-1');

    expect(result.dataQuality.hasDerivedData).toBe(true);
  });

  it('should set hasDerivedData to false when all actualCosts are zero or null', async () => {
    const { getProjectActualCosts } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      totalBudget: 500000,
      BudgetItem: [
        { id: 'item-1', budgetedAmount: 100000, actualCost: 0 },
        { id: 'item-2', budgetedAmount: 150000, actualCost: null },
      ],
    });

    const result = await getProjectActualCosts('project-1');

    expect(result.dataQuality.hasDerivedData).toBe(false);
  });

  it('should handle division by zero when calculating percentComplete', async () => {
    const { getProjectActualCosts } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([
      {
        id: 'payapp-1',
        applicationNumber: 1,
        totalCompleted: 100000,
        scheduledValue: 0, // Zero budget
        periodEnd: new Date(),
        items: [],
      },
    ]);

    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      totalBudget: 0,
      BudgetItem: [],
    });

    const result = await getProjectActualCosts('project-1');

    expect(result.percentComplete).toBe(0);
  });

  it('should handle division by zero in derived category percentComplete', async () => {
    const { getProjectActualCosts } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      totalBudget: 300000,
      updatedAt: new Date(),
      BudgetItem: [
        {
          id: 'item-1',
          name: 'Zero Budget Item',
          budgetedAmount: 0,
          actualCost: 50000,
        },
        {
          id: 'item-2',
          name: 'Normal Item',
          budgetedAmount: 100000,
          actualCost: 80000,
        },
      ],
    });

    const result = await getProjectActualCosts('project-1');

    const zeroBudgetItem = result.byCategory.find((c) => c.name === 'Zero Budget Item');
    expect(zeroBudgetItem?.percentComplete).toBe(0);

    const normalItem = result.byCategory.find((c) => c.name === 'Normal Item');
    expect(normalItem?.percentComplete).toBe(80);
  });
});

describe('Actual Cost Sync - syncBudgetFromPayApp()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Success Cases
  // ============================================

  it('should sync budget items from latest approved pay app when no payAppId provided', async () => {
    const { syncBudgetFromPayApp } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findFirst.mockResolvedValue({
      id: 'payapp-1',
      applicationNumber: 3,
      items: [
        {
          id: 'payitem-1',
          budgetItemId: 'budget-item-1',
          totalCompleted: 95000,
        },
        {
          id: 'payitem-2',
          budgetItemId: 'budget-item-2',
          totalCompleted: 140000,
        },
      ],
    });

    mockPrisma.$transaction.mockResolvedValue([
      { id: 'budget-item-1' },
      { id: 'budget-item-2' },
    ]);

    const result = await syncBudgetFromPayApp('project-1');

    expect(result.updated).toBe(2);
    expect(result.skipped).toBe(0);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('should sync from specific pay app when payAppId provided', async () => {
    const { syncBudgetFromPayApp } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findUnique.mockResolvedValue({
      id: 'payapp-2',
      items: [
        {
          id: 'payitem-1',
          budgetItemId: 'budget-item-1',
          totalCompleted: 50000,
        },
      ],
    });

    mockPrisma.$transaction.mockResolvedValue([{ id: 'budget-item-1' }]);

    const result = await syncBudgetFromPayApp('project-1', 'payapp-2');

    expect(result.updated).toBe(1);
    expect(mockPrisma.paymentApplication.findUnique).toHaveBeenCalledWith({
      where: { id: 'payapp-2' },
      include: { items: true },
    });
  });

  it('should update actualCost and billedToDate for each budget item', async () => {
    const { syncBudgetFromPayApp } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findFirst.mockResolvedValue({
      id: 'payapp-1',
      items: [
        {
          id: 'payitem-1',
          budgetItemId: 'budget-item-1',
          totalCompleted: 120000,
        },
      ],
    });

    let capturedTransaction: any;
    mockPrisma.$transaction.mockImplementation(async (operations: any) => {
      capturedTransaction = operations;
      return operations;
    });

    await syncBudgetFromPayApp('project-1');

    expect(capturedTransaction).toHaveLength(1);
    // The transaction contains Prisma operations, we can't directly inspect them
    // but we can verify $transaction was called
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('should use batch transaction for multiple budget items', async () => {
    const { syncBudgetFromPayApp } = await import('@/lib/actual-cost-sync');

    const payAppItems = Array.from({ length: 10 }, (_, i) => ({
      id: `payitem-${i}`,
      budgetItemId: `budget-item-${i}`,
      totalCompleted: (i + 1) * 10000,
    }));

    mockPrisma.paymentApplication.findFirst.mockResolvedValue({
      id: 'payapp-1',
      items: payAppItems,
    });

    mockPrisma.$transaction.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({ id: `budget-item-${i}` }))
    );

    const result = await syncBudgetFromPayApp('project-1');

    expect(result.updated).toBe(10);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  // ============================================
  // Edge Cases
  // ============================================

  it('should return zero counts when no pay app exists', async () => {
    const { syncBudgetFromPayApp } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findFirst.mockResolvedValue(null);

    const result = await syncBudgetFromPayApp('project-1');

    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(0);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('should skip items without budgetItemId', async () => {
    const { syncBudgetFromPayApp } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findFirst.mockResolvedValue({
      id: 'payapp-1',
      items: [
        {
          id: 'payitem-1',
          budgetItemId: 'budget-item-1',
          totalCompleted: 50000,
        },
        {
          id: 'payitem-2',
          budgetItemId: null, // No linked budget item
          totalCompleted: 30000,
        },
        {
          id: 'payitem-3',
          budgetItemId: 'budget-item-3',
          totalCompleted: 70000,
        },
      ],
    });

    mockPrisma.$transaction.mockResolvedValue([
      { id: 'budget-item-1' },
      { id: 'budget-item-3' },
    ]);

    const result = await syncBudgetFromPayApp('project-1');

    expect(result.updated).toBe(2);
    expect(result.skipped).toBe(1);
  });

  it('should handle pay app with no items', async () => {
    const { syncBudgetFromPayApp } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findFirst.mockResolvedValue({
      id: 'payapp-1',
      items: [],
    });

    const result = await syncBudgetFromPayApp('project-1');

    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(0);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('should query for latest approved pay app with correct filters', async () => {
    const { syncBudgetFromPayApp } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findFirst.mockResolvedValue({
      id: 'payapp-1',
      items: [],
    });

    await syncBudgetFromPayApp('project-1');

    expect(mockPrisma.paymentApplication.findFirst).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        status: { in: ['APPROVED', 'PARTIALLY_PAID', 'PAID'] },
      },
      orderBy: { applicationNumber: 'desc' },
      include: { items: true },
    });
  });

  it('should handle all items skipped (none have budgetItemId)', async () => {
    const { syncBudgetFromPayApp } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findFirst.mockResolvedValue({
      id: 'payapp-1',
      items: [
        { id: 'payitem-1', budgetItemId: null, totalCompleted: 10000 },
        { id: 'payitem-2', budgetItemId: null, totalCompleted: 20000 },
      ],
    });

    const result = await syncBudgetFromPayApp('project-1');

    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(2);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('should not call transaction when itemsToUpdate is empty', async () => {
    const { syncBudgetFromPayApp } = await import('@/lib/actual-cost-sync');

    mockPrisma.paymentApplication.findFirst.mockResolvedValue({
      id: 'payapp-1',
      items: [
        { id: 'payitem-1', budgetItemId: null, totalCompleted: 10000 },
      ],
    });

    await syncBudgetFromPayApp('project-1');

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('Actual Cost Sync - getCostDataSources()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Priority Detection Tests
  // ============================================

  it('should return PAY_APPLICATION as primary when pay app source exists', async () => {
    const { getCostDataSources } = await import('@/lib/actual-cost-sync');

    mockPrisma.projectDataSource.findMany.mockResolvedValue([
      {
        id: 'source-1',
        sourceType: 'payment_application',
        confidence: 0.95,
        extractedAt: new Date('2024-01-20'),
        metadata: { applicationNumber: 3 },
      },
    ]);

    const result = await getCostDataSources('project-1');

    expect(result.primary).toBe('PAY_APPLICATION');
  });

  it('should return DERIVED as primary when schedule source exists (no pay app)', async () => {
    const { getCostDataSources } = await import('@/lib/actual-cost-sync');

    mockPrisma.projectDataSource.findMany.mockResolvedValue([
      {
        id: 'source-1',
        sourceType: 'schedule',
        confidence: 0.88,
        extractedAt: new Date('2024-01-15'),
        metadata: {},
      },
    ]);

    const result = await getCostDataSources('project-1');

    expect(result.primary).toBe('DERIVED');
  });

  it('should return DERIVED as primary when daily_report source exists (no pay app)', async () => {
    const { getCostDataSources } = await import('@/lib/actual-cost-sync');

    mockPrisma.projectDataSource.findMany.mockResolvedValue([
      {
        id: 'source-1',
        sourceType: 'daily_report',
        confidence: 0.85,
        extractedAt: new Date('2024-01-18'),
        metadata: {},
      },
    ]);

    const result = await getCostDataSources('project-1');

    expect(result.primary).toBe('DERIVED');
  });

  it('should return MANUAL as primary when manual source exists (no pay app or schedule)', async () => {
    const { getCostDataSources } = await import('@/lib/actual-cost-sync');

    mockPrisma.projectDataSource.findMany.mockResolvedValue([
      {
        id: 'source-1',
        sourceType: 'manual',
        confidence: 1.0,
        extractedAt: new Date('2024-01-10'),
        metadata: { enteredBy: 'user-1' },
      },
    ]);

    const result = await getCostDataSources('project-1');

    expect(result.primary).toBe('MANUAL');
  });

  it('should return NONE when no sources exist', async () => {
    const { getCostDataSources } = await import('@/lib/actual-cost-sync');

    mockPrisma.projectDataSource.findMany.mockResolvedValue([]);

    const result = await getCostDataSources('project-1');

    expect(result.primary).toBe('NONE');
    expect(result.sources).toEqual([]);
  });

  it('should prioritize pay app over schedule when both exist', async () => {
    const { getCostDataSources } = await import('@/lib/actual-cost-sync');

    mockPrisma.projectDataSource.findMany.mockResolvedValue([
      {
        id: 'source-1',
        sourceType: 'schedule',
        confidence: 0.90,
        extractedAt: new Date('2024-01-15'),
        metadata: {},
      },
      {
        id: 'source-2',
        sourceType: 'payment_application',
        confidence: 0.95,
        extractedAt: new Date('2024-01-20'),
        metadata: {},
      },
    ]);

    const result = await getCostDataSources('project-1');

    expect(result.primary).toBe('PAY_APPLICATION');
  });

  it('should prioritize schedule over manual when both exist', async () => {
    const { getCostDataSources } = await import('@/lib/actual-cost-sync');

    mockPrisma.projectDataSource.findMany.mockResolvedValue([
      {
        id: 'source-1',
        sourceType: 'manual',
        confidence: 1.0,
        extractedAt: new Date('2024-01-10'),
        metadata: {},
      },
      {
        id: 'source-2',
        sourceType: 'schedule',
        confidence: 0.88,
        extractedAt: new Date('2024-01-15'),
        metadata: {},
      },
    ]);

    const result = await getCostDataSources('project-1');

    expect(result.primary).toBe('DERIVED');
  });

  // ============================================
  // Sources Array Tests
  // ============================================

  it('should map all sources with correct fields', async () => {
    const { getCostDataSources } = await import('@/lib/actual-cost-sync');

    const extractedDate1 = new Date('2024-01-15');
    const extractedDate2 = new Date('2024-01-20');

    mockPrisma.projectDataSource.findMany.mockResolvedValue([
      {
        id: 'source-1',
        sourceType: 'payment_application',
        confidence: 0.95,
        extractedAt: extractedDate2,
        metadata: { applicationNumber: 3 },
      },
      {
        id: 'source-2',
        sourceType: 'schedule',
        confidence: 0.88,
        extractedAt: extractedDate1,
        metadata: { taskCount: 150 },
      },
    ]);

    const result = await getCostDataSources('project-1');

    expect(result.sources).toEqual([
      {
        sourceType: 'payment_application',
        confidence: 0.95,
        extractedAt: extractedDate2,
        metadata: { applicationNumber: 3 },
      },
      {
        sourceType: 'schedule',
        confidence: 0.88,
        extractedAt: extractedDate1,
        metadata: { taskCount: 150 },
      },
    ]);
  });

  it('should query with correct filters for budget feature type', async () => {
    const { getCostDataSources } = await import('@/lib/actual-cost-sync');

    mockPrisma.projectDataSource.findMany.mockResolvedValue([]);

    await getCostDataSources('project-1');

    expect(mockPrisma.projectDataSource.findMany).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        featureType: 'budget',
      },
      orderBy: { extractedAt: 'desc' },
    });
  });

  it('should order sources by extractedAt descending', async () => {
    const { getCostDataSources } = await import('@/lib/actual-cost-sync');

    mockPrisma.projectDataSource.findMany.mockResolvedValue([]);

    await getCostDataSources('project-1');

    expect(mockPrisma.projectDataSource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { extractedAt: 'desc' },
      })
    );
  });

  it('should handle multiple sources of same type', async () => {
    const { getCostDataSources } = await import('@/lib/actual-cost-sync');

    mockPrisma.projectDataSource.findMany.mockResolvedValue([
      {
        id: 'source-1',
        sourceType: 'schedule',
        confidence: 0.90,
        extractedAt: new Date('2024-01-20'),
        metadata: { version: 2 },
      },
      {
        id: 'source-2',
        sourceType: 'schedule',
        confidence: 0.85,
        extractedAt: new Date('2024-01-15'),
        metadata: { version: 1 },
      },
    ]);

    const result = await getCostDataSources('project-1');

    // Primary is determined by first found schedule source
    expect(result.primary).toBe('DERIVED');
    expect(result.sources).toHaveLength(2);
  });
});
