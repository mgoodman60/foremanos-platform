import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mocks Setup - Must use vi.hoisted for mock objects
// ============================================

// Mock Prisma with vi.hoisted
const mockPrisma = vi.hoisted(() => ({
  projectBudget: {
    findUnique: vi.fn(),
  },
  earnedValue: {
    findFirst: vi.fn(),
  },
  contingencyUsage: {
    findMany: vi.fn(),
  },
  costAlert: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Import functions after mocks
import { checkAndCreateAlerts } from '@/lib/cost-alert-service';

// ============================================
// Test Helpers
// ============================================

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

function createMockBudgetItem(overrides = {}) {
  return {
    id: 'item-1',
    budgetId: 'budget-1',
    name: 'Foundation',
    budgetedAmount: 100000,
    actualCost: 95000,
    revisedBudget: null,
    ...overrides,
  };
}

function createMockEarnedValue(overrides = {}) {
  return {
    id: 'ev-1',
    budgetId: 'budget-1',
    periodDate: new Date('2024-02-01'),
    plannedValue: 500000,
    earnedValue: 450000,
    actualCost: 500000,
    cpi: 0.9,
    spi: 0.9,
    ...overrides,
  };
}

function createMockContingencyUsage(amount: number, overrides = {}) {
  return {
    id: `usage-${Math.random()}`,
    projectId: 'project-1',
    amount,
    description: 'Test usage',
    usedDate: new Date('2024-01-15'),
    ...overrides,
  };
}

// ============================================
// CPI (Cost Performance Index) Alert Tests (8 tests)
// ============================================

describe('Cost Alert Service - CPI Alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.costAlert.findFirst.mockResolvedValue(null);
  });

  it('should create CRITICAL alert when CPI < 0.85', async () => {
    const budget = createMockBudget();
    const ev = createMockEarnedValue({
      earnedValue: 400000,
      actualCost: 500000, // CPI = 400000 / 500000 = 0.8
      plannedValue: 500000, // SPI = 0.8 (also triggers)
    });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(ev);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    const alertCount = await checkAndCreateAlerts('project-1');

    // Both CPI and SPI alerts are created
    expect(alertCount).toBe(2);
    expect(mockPrisma.costAlert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'project-1',
        alertType: 'CPI_LOW',
        severity: 'CRITICAL',
        title: 'Critical: CPI Below Threshold',
        message: expect.stringContaining('0.80'),
        threshold: 0.85,
        currentValue: 0.8,
      }),
    });
  });

  it('should create WARNING alert when CPI between 0.85 and 0.95', async () => {
    const budget = createMockBudget();
    const ev = createMockEarnedValue({
      earnedValue: 450000,
      actualCost: 500000, // CPI = 450000 / 500000 = 0.9
      plannedValue: 500000, // SPI = 0.9 (also triggers)
    });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(ev);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    const alertCount = await checkAndCreateAlerts('project-1');

    // Both CPI and SPI alerts are created
    expect(alertCount).toBe(2);
    expect(mockPrisma.costAlert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'project-1',
        alertType: 'CPI_LOW',
        severity: 'WARNING',
        title: 'Warning: CPI Declining',
        message: expect.stringContaining('0.90'),
        threshold: 0.95,
        currentValue: 0.9,
      }),
    });
  });

  it('should NOT create CPI alert when CPI >= 0.95', async () => {
    const budget = createMockBudget();
    const ev = createMockEarnedValue({
      earnedValue: 480000,
      actualCost: 500000, // CPI = 480000 / 500000 = 0.96
    });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(ev);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(0);
    expect(mockPrisma.costAlert.create).not.toHaveBeenCalled();
  });

  it('should handle CPI at exact threshold boundary (0.85)', async () => {
    const budget = createMockBudget();
    const ev = createMockEarnedValue({
      earnedValue: 425000,
      actualCost: 500000, // CPI = 0.85 exactly
      plannedValue: 500000, // SPI = 0.85 (also at threshold)
    });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(ev);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    const alertCount = await checkAndCreateAlerts('project-1');

    // Should NOT trigger critical (only triggers when < 0.85), both CPI and SPI warnings
    expect(alertCount).toBe(2);
    const cpiCall = mockPrisma.costAlert.create.mock.calls.find(
      call => call[0].data.alertType === 'CPI_LOW'
    );
    expect(cpiCall[0].data.severity).toBe('WARNING');
  });

  it('should NOT create CPI alert when actualCost is zero', async () => {
    const budget = createMockBudget();
    const ev = createMockEarnedValue({
      earnedValue: 100000,
      actualCost: 0, // Division by zero case
    });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(ev);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    const alertCount = await checkAndCreateAlerts('project-1');

    // Should only get SPI alert, not CPI
    expect(mockPrisma.costAlert.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          alertType: 'CPI_LOW',
        }),
      })
    );
  });

  it('should handle negative earned value gracefully', async () => {
    const budget = createMockBudget();
    const ev = createMockEarnedValue({
      earnedValue: -100000, // Edge case: negative EV
      actualCost: 500000,
    });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(ev);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    const alertCount = await checkAndCreateAlerts('project-1');

    // Should create alert with negative CPI
    expect(mockPrisma.costAlert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        alertType: 'CPI_LOW',
        severity: 'CRITICAL',
        currentValue: -0.2,
      }),
    });
  });

  it('should format CPI values to 2 decimal places in message', async () => {
    const budget = createMockBudget();
    const ev = createMockEarnedValue({
      earnedValue: 456789,
      actualCost: 500000, // CPI = 0.913578
    });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(ev);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    await checkAndCreateAlerts('project-1');

    const createCall = mockPrisma.costAlert.create.mock.calls[0][0];
    expect(createCall.data.message).toContain('0.91');
    expect(createCall.data.message).not.toContain('0.913578');
  });

  it('should NOT create CPI alert when no EVM data exists', async () => {
    const budget = createMockBudget();

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(0);
    expect(mockPrisma.costAlert.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          alertType: 'CPI_LOW',
        }),
      })
    );
  });
});

// ============================================
// SPI (Schedule Performance Index) Alert Tests (7 tests)
// ============================================

describe('Cost Alert Service - SPI Alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.costAlert.findFirst.mockResolvedValue(null);
  });

  it('should create CRITICAL alert when SPI < 0.85', async () => {
    const budget = createMockBudget();
    const ev = createMockEarnedValue({
      earnedValue: 400000,
      plannedValue: 500000, // SPI = 400000 / 500000 = 0.8
      actualCost: 380000,
    });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(ev);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(1);
    expect(mockPrisma.costAlert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'project-1',
        alertType: 'SPI_LOW',
        severity: 'CRITICAL',
        title: 'Critical: SPI Below Threshold',
        message: expect.stringContaining('0.80'),
        threshold: 0.85,
        currentValue: 0.8,
      }),
    });
  });

  it('should create WARNING alert when SPI between 0.85 and 0.95', async () => {
    const budget = createMockBudget();
    const ev = createMockEarnedValue({
      earnedValue: 450000,
      plannedValue: 500000, // SPI = 450000 / 500000 = 0.9
      actualCost: 450000,
    });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(ev);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(1);
    expect(mockPrisma.costAlert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        alertType: 'SPI_LOW',
        severity: 'WARNING',
        title: 'Warning: SPI Declining',
        message: expect.stringContaining('0.90'),
      }),
    });
  });

  it('should NOT create SPI alert when SPI >= 0.95', async () => {
    const budget = createMockBudget();
    const ev = createMockEarnedValue({
      earnedValue: 480000,
      plannedValue: 500000, // SPI = 0.96
      actualCost: 480000,
    });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(ev);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(0);
  });

  it('should NOT create SPI alert when plannedValue is zero', async () => {
    const budget = createMockBudget();
    const ev = createMockEarnedValue({
      earnedValue: 100000,
      plannedValue: 0, // Division by zero case
      actualCost: 100000,
    });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(ev);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    await checkAndCreateAlerts('project-1');

    expect(mockPrisma.costAlert.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          alertType: 'SPI_LOW',
        }),
      })
    );
  });

  it('should create both CPI and SPI alerts when both are low', async () => {
    const budget = createMockBudget();
    const ev = createMockEarnedValue({
      earnedValue: 400000,
      plannedValue: 500000, // SPI = 0.8
      actualCost: 500000, // CPI = 0.8
    });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(ev);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(2);
    expect(mockPrisma.costAlert.create).toHaveBeenCalledTimes(2);

    const calls = mockPrisma.costAlert.create.mock.calls;
    const alertTypes = calls.map((call) => call[0].data.alertType);
    expect(alertTypes).toContain('CPI_LOW');
    expect(alertTypes).toContain('SPI_LOW');
  });

  it('should handle SPI at exact threshold boundary (0.95)', async () => {
    const budget = createMockBudget();
    const ev = createMockEarnedValue({
      earnedValue: 475000,
      plannedValue: 500000, // SPI = 0.95 exactly
      actualCost: 475000,
    });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(ev);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    const alertCount = await checkAndCreateAlerts('project-1');

    // Should NOT trigger warning (only triggers when < 0.95)
    expect(alertCount).toBe(0);
  });

  it('should format SPI message correctly for schedule behind', async () => {
    const budget = createMockBudget();
    const ev = createMockEarnedValue({
      earnedValue: 425000,
      plannedValue: 500000, // SPI = 0.85
      actualCost: 425000,
    });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(ev);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    await checkAndCreateAlerts('project-1');

    const createCall = mockPrisma.costAlert.create.mock.calls[0][0];
    expect(createCall.data.message).toContain('Schedule Performance Index is 0.85');
    expect(createCall.data.message).toContain('Schedule may be at risk');
  });
});

// ============================================
// Contingency Usage Alert Tests (8 tests)
// ============================================

describe('Cost Alert Service - Contingency Alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.costAlert.findFirst.mockResolvedValue(null);
  });

  it('should create CRITICAL alert when contingency >= 90% used', async () => {
    const budget = createMockBudget({ contingency: 100000 });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([
      createMockContingencyUsage(50000),
      createMockContingencyUsage(40000), // Total = 90000 (90%)
    ]);

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(1);
    expect(mockPrisma.costAlert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        alertType: 'CONTINGENCY_LOW',
        severity: 'CRITICAL',
        title: 'Critical: Contingency Nearly Exhausted',
        message: expect.stringContaining('90.0%'),
        threshold: 90,
        currentValue: 90,
      }),
    });
  });

  it('should create WARNING alert when contingency between 70% and 90% used', async () => {
    const budget = createMockBudget({ contingency: 100000 });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([
      createMockContingencyUsage(40000),
      createMockContingencyUsage(35000), // Total = 75000 (75%)
    ]);

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(1);
    expect(mockPrisma.costAlert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        alertType: 'CONTINGENCY_LOW',
        severity: 'WARNING',
        title: 'Warning: High Contingency Usage',
        threshold: 70,
        currentValue: 75,
      }),
    });
  });

  it('should NOT create contingency alert when < 70% used', async () => {
    const budget = createMockBudget({ contingency: 100000 });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([
      createMockContingencyUsage(30000),
      createMockContingencyUsage(20000), // Total = 50000 (50%)
    ]);

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(0);
  });

  it('should handle zero contingency budget gracefully', async () => {
    const budget = createMockBudget({ contingency: 0 });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([
      createMockContingencyUsage(10000),
    ]);

    const alertCount = await checkAndCreateAlerts('project-1');

    // Should not create alert (percentUsed = 0 when contingency = 0)
    expect(alertCount).toBe(0);
  });

  it('should show remaining contingency amount in critical alert', async () => {
    const budget = createMockBudget({ contingency: 100000 });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([
      createMockContingencyUsage(92000), // 92% used, 8000 remaining
    ]);

    await checkAndCreateAlerts('project-1');

    const createCall = mockPrisma.costAlert.create.mock.calls[0][0];
    expect(createCall.data.message).toContain('8,000 remaining');
  });

  it('should handle empty contingency usage array', async () => {
    const budget = createMockBudget({ contingency: 100000 });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(0);
  });

  it('should calculate total contingency usage correctly with many entries', async () => {
    const budget = createMockBudget({ contingency: 200000 });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([
      createMockContingencyUsage(30000),
      createMockContingencyUsage(40000),
      createMockContingencyUsage(25000),
      createMockContingencyUsage(45000), // Total = 140000 (70%)
    ]);

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(1);
    const createCall = mockPrisma.costAlert.create.mock.calls[0][0];
    expect(createCall.data.currentValue).toBe(70);
  });

  it('should handle 100% contingency usage', async () => {
    const budget = createMockBudget({ contingency: 50000 });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([
      createMockContingencyUsage(50000), // 100% used
    ]);

    await checkAndCreateAlerts('project-1');

    const createCall = mockPrisma.costAlert.create.mock.calls[0][0];
    expect(createCall.data.severity).toBe('CRITICAL');
    expect(createCall.data.currentValue).toBe(100);
    expect(createCall.data.message).toContain('100.0%');
    expect(createCall.data.message).toContain('0 remaining');
  });
});

// ============================================
// Budget Item Overrun Alert Tests (10 tests)
// ============================================

describe('Cost Alert Service - Budget Item Overrun Alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.costAlert.findFirst.mockResolvedValue(null);
  });

  it('should create CRITICAL alert when item > 20% over budget', async () => {
    const item = createMockBudgetItem({
      name: 'Foundation',
      budgetedAmount: 100000,
      actualCost: 125000, // 25% over
    });
    const budget = createMockBudget({ BudgetItem: [item] });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(1);
    expect(mockPrisma.costAlert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        alertType: 'ITEM_OVER_BUDGET',
        severity: 'CRITICAL',
        title: 'Foundation Over Budget',
        threshold: 100000,
        currentValue: 125000,
        budgetItemId: 'item-1',
      }),
    });
  });

  it('should create WARNING alert when item <= 20% over budget', async () => {
    const item = createMockBudgetItem({
      name: 'Framing',
      budgetedAmount: 100000,
      actualCost: 115000, // 15% over
    });
    const budget = createMockBudget({ BudgetItem: [item] });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(1);
    expect(mockPrisma.costAlert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        severity: 'WARNING',
        message: expect.stringContaining('15.0%'),
      }),
    });
  });

  it('should NOT create alert when item is under budget', async () => {
    const item = createMockBudgetItem({
      budgetedAmount: 100000,
      actualCost: 95000,
    });
    const budget = createMockBudget({ BudgetItem: [item] });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(0);
  });

  it('should use revisedBudget when available', async () => {
    const item = createMockBudgetItem({
      budgetedAmount: 100000,
      revisedBudget: 120000,
      actualCost: 125000, // Over revised budget, not original
    });
    const budget = createMockBudget({ BudgetItem: [item] });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(1);
    const createCall = mockPrisma.costAlert.create.mock.calls[0][0];
    expect(createCall.data.threshold).toBe(120000);
    expect(createCall.data.message).toContain('$120,000');
  });

  it('should create alerts for multiple items over budget', async () => {
    const items = [
      createMockBudgetItem({
        id: 'item-1',
        name: 'Foundation',
        budgetedAmount: 100000,
        actualCost: 130000,
      }),
      createMockBudgetItem({
        id: 'item-2',
        name: 'Framing',
        budgetedAmount: 150000,
        actualCost: 170000,
      }),
      createMockBudgetItem({
        id: 'item-3',
        name: 'Electrical',
        budgetedAmount: 80000,
        actualCost: 75000, // Under budget
      }),
    ];
    const budget = createMockBudget({ BudgetItem: items });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(2);
    expect(mockPrisma.costAlert.create).toHaveBeenCalledTimes(2);

    const calls = mockPrisma.costAlert.create.mock.calls;
    expect(calls[0][0].data.title).toContain('Foundation');
    expect(calls[1][0].data.title).toContain('Framing');
  });

  it('should handle item at exact budget (no overrun)', async () => {
    const item = createMockBudgetItem({
      budgetedAmount: 100000,
      actualCost: 100000, // Exactly at budget
    });
    const budget = createMockBudget({ BudgetItem: [item] });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(0);
  });

  it('should format currency values correctly in message', async () => {
    const item = createMockBudgetItem({
      name: 'HVAC',
      budgetedAmount: 1234567,
      actualCost: 1500000,
    });
    const budget = createMockBudget({ BudgetItem: [item] });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    await checkAndCreateAlerts('project-1');

    const createCall = mockPrisma.costAlert.create.mock.calls[0][0];
    expect(createCall.data.message).toContain('$1,500,000');
    expect(createCall.data.message).toContain('$1,234,567');
  });

  it('should handle small overrun amounts correctly', async () => {
    const item = createMockBudgetItem({
      budgetedAmount: 100000,
      actualCost: 100100, // 0.1% over
    });
    const budget = createMockBudget({ BudgetItem: [item] });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(1);
    const createCall = mockPrisma.costAlert.create.mock.calls[0][0];
    expect(createCall.data.severity).toBe('WARNING');
    expect(createCall.data.message).toContain('0.1%');
  });

  it('should handle very large overrun (>100%)', async () => {
    const item = createMockBudgetItem({
      name: 'Sitework',
      budgetedAmount: 50000,
      actualCost: 150000, // 200% over
    });
    const budget = createMockBudget({ BudgetItem: [item] });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    await checkAndCreateAlerts('project-1');

    const createCall = mockPrisma.costAlert.create.mock.calls[0][0];
    expect(createCall.data.severity).toBe('CRITICAL');
    expect(createCall.data.message).toContain('200.0%');
  });

  it('should include budgetItemId for item-specific alerts', async () => {
    const item = createMockBudgetItem({
      id: 'specific-item-123',
      budgetedAmount: 100000,
      actualCost: 125000,
    });
    const budget = createMockBudget({ BudgetItem: [item] });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    await checkAndCreateAlerts('project-1');

    const createCall = mockPrisma.costAlert.create.mock.calls[0][0];
    expect(createCall.data.budgetItemId).toBe('specific-item-123');
  });
});

// ============================================
// Duplicate Alert Prevention Tests (8 tests)
// ============================================

describe('Cost Alert Service - Duplicate Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should NOT create duplicate CPI alert within 24 hours', async () => {
    const budget = createMockBudget();
    const ev = createMockEarnedValue({
      earnedValue: 400000,
      actualCost: 500000, // CPI = 0.8
      plannedValue: 500000, // SPI = 0.8
    });

    // Existing alert from 12 hours ago
    const existingAlert = {
      id: 'alert-1',
      projectId: 'project-1',
      alertType: 'CPI_LOW',
      triggeredAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      isDismissed: false,
    };

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(ev);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);
    // Return existing alert for CPI, but not for SPI
    mockPrisma.costAlert.findFirst.mockImplementation((args) => {
      if (args.where.alertType === 'CPI_LOW') {
        return Promise.resolve(existingAlert);
      }
      return Promise.resolve(null);
    });

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(2); // Counted both (CPI duplicate not created, SPI created)
    expect(mockPrisma.costAlert.create).toHaveBeenCalledTimes(1); // Only SPI created
  });

  it('should create new alert if previous alert is dismissed', async () => {
    const budget = createMockBudget();
    const ev = createMockEarnedValue({
      earnedValue: 400000,
      actualCost: 500000,
      plannedValue: 500000,
    });

    // Existing dismissed alert - won't be found due to isDismissed: false filter
    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(ev);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);
    mockPrisma.costAlert.findFirst.mockResolvedValue(null); // Dismissed alerts are filtered out

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(2); // Both CPI and SPI
    expect(mockPrisma.costAlert.create).toHaveBeenCalledTimes(2);
  });

  it('should create new alert if previous alert is > 24 hours old', async () => {
    const budget = createMockBudget();
    const ev = createMockEarnedValue({
      earnedValue: 400000,
      actualCost: 500000,
      plannedValue: 500000,
    });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(ev);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);
    // Old alerts are filtered out by the >= yesterday query
    mockPrisma.costAlert.findFirst.mockResolvedValue(null);

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(2); // Both CPI and SPI
    expect(mockPrisma.costAlert.create).toHaveBeenCalledTimes(2);
  });

  it('should prevent duplicate budget item alerts separately', async () => {
    const item = createMockBudgetItem({
      id: 'item-1',
      name: 'Foundation',
      budgetedAmount: 100000,
      actualCost: 125000,
    });
    const budget = createMockBudget({ BudgetItem: [item] });

    // Existing alert for this specific budget item
    const existingItemAlert = {
      id: 'alert-1',
      projectId: 'project-1',
      alertType: 'ITEM_OVER_BUDGET',
      budgetItemId: 'item-1',
      triggeredAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      isDismissed: false,
    };

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);
    mockPrisma.costAlert.findFirst.mockResolvedValue(existingItemAlert);

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(1);
    expect(mockPrisma.costAlert.create).not.toHaveBeenCalled();
  });

  it('should allow different alert types for same project', async () => {
    const budget = createMockBudget({ contingency: 100000 });
    const ev = createMockEarnedValue({
      earnedValue: 400000,
      actualCost: 500000, // CPI alert
      plannedValue: 500000, // SPI alert
    });

    // Existing contingency alert (different type)
    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(ev);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([
      createMockContingencyUsage(95000), // Contingency alert
    ]);

    // First call for CPI alert - no existing
    // Second call for contingency - no existing
    mockPrisma.costAlert.findFirst.mockResolvedValue(null);

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(3); // CPI, SPI, and contingency
    expect(mockPrisma.costAlert.create).toHaveBeenCalledTimes(3);
  });

  it('should check for duplicates using correct time window', async () => {
    const budget = createMockBudget();
    const ev = createMockEarnedValue({
      earnedValue: 400000,
      actualCost: 500000,
    });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(ev);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);
    mockPrisma.costAlert.findFirst.mockResolvedValue(null);

    await checkAndCreateAlerts('project-1');

    const findFirstCall = mockPrisma.costAlert.findFirst.mock.calls[0][0];
    expect(findFirstCall.where.triggeredAt).toHaveProperty('gte');

    const timeThreshold = findFirstCall.where.triggeredAt.gte;
    const hoursDiff = (Date.now() - timeThreshold.getTime()) / (1000 * 60 * 60);

    expect(hoursDiff).toBeCloseTo(24, 0);
  });

  it('should handle null budgetItemId correctly in duplicate check', async () => {
    const budget = createMockBudget();
    const ev = createMockEarnedValue({
      earnedValue: 400000,
      actualCost: 500000,
    });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(ev);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);
    mockPrisma.costAlert.findFirst.mockResolvedValue(null);

    await checkAndCreateAlerts('project-1');

    const findFirstCall = mockPrisma.costAlert.findFirst.mock.calls[0][0];
    expect(findFirstCall.where.budgetItemId).toBe(null);
  });

  it('should create multiple item alerts if different items', async () => {
    const items = [
      createMockBudgetItem({
        id: 'item-1',
        name: 'Foundation',
        budgetedAmount: 100000,
        actualCost: 125000,
      }),
      createMockBudgetItem({
        id: 'item-2',
        name: 'Framing',
        budgetedAmount: 150000,
        actualCost: 170000,
      }),
    ];
    const budget = createMockBudget({ BudgetItem: items });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    // No existing alerts for either item
    mockPrisma.costAlert.findFirst.mockResolvedValue(null);

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(2);
    expect(mockPrisma.costAlert.create).toHaveBeenCalledTimes(2);
  });
});

// ============================================
// Edge Cases and Error Handling Tests (7 tests)
// ============================================

describe('Cost Alert Service - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.costAlert.findFirst.mockResolvedValue(null);
  });

  it('should return early if no budget exists', async () => {
    mockPrisma.projectBudget.findUnique.mockResolvedValue(null);

    const result = await checkAndCreateAlerts('project-1');

    expect(result).toBeUndefined();
    expect(mockPrisma.earnedValue.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.costAlert.create).not.toHaveBeenCalled();
  });

  it('should handle budget with empty BudgetItem array', async () => {
    const budget = createMockBudget({ BudgetItem: [] });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    const alertCount = await checkAndCreateAlerts('project-1');

    expect(alertCount).toBe(0);
  });

  it('should create multiple alerts when multiple conditions trigger', async () => {
    const items = [
      createMockBudgetItem({
        id: 'item-1',
        budgetedAmount: 100000,
        actualCost: 130000,
      }),
    ];
    const budget = createMockBudget({
      BudgetItem: items,
      contingency: 100000,
    });
    const ev = createMockEarnedValue({
      earnedValue: 400000,
      actualCost: 500000, // CPI = 0.8
      plannedValue: 500000, // SPI = 0.8
    });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(ev);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([
      createMockContingencyUsage(75000), // 75% used
    ]);

    const alertCount = await checkAndCreateAlerts('project-1');

    // Should create: CPI, SPI, Contingency, Item alerts
    expect(alertCount).toBe(4);
    expect(mockPrisma.costAlert.create).toHaveBeenCalledTimes(4);

    const alertTypes = mockPrisma.costAlert.create.mock.calls.map(
      (call) => call[0].data.alertType
    );
    expect(alertTypes).toContain('CPI_LOW');
    expect(alertTypes).toContain('SPI_LOW');
    expect(alertTypes).toContain('CONTINGENCY_LOW');
    expect(alertTypes).toContain('ITEM_OVER_BUDGET');
  });

  it('should handle projectId with special characters', async () => {
    const budget = createMockBudget();
    const projectId = 'project-123-abc_XYZ';

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    await checkAndCreateAlerts(projectId);

    expect(mockPrisma.projectBudget.findUnique).toHaveBeenCalledWith({
      where: { projectId },
      include: { BudgetItem: true },
    });
  });

  it('should include BudgetItem in budget query', async () => {
    const budget = createMockBudget();

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    await checkAndCreateAlerts('project-1');

    expect(mockPrisma.projectBudget.findUnique).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      include: { BudgetItem: true },
    });
  });

  it('should query latest EVM data with correct orderBy', async () => {
    const budget = createMockBudget();

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    await checkAndCreateAlerts('project-1');

    expect(mockPrisma.earnedValue.findFirst).toHaveBeenCalledWith({
      where: { budgetId: 'budget-1' },
      orderBy: { periodDate: 'desc' },
    });
  });

  it('should return alert count correctly', async () => {
    const items = [
      createMockBudgetItem({
        id: 'item-1',
        budgetedAmount: 100000,
        actualCost: 125000,
      }),
      createMockBudgetItem({
        id: 'item-2',
        budgetedAmount: 80000,
        actualCost: 95000,
      }),
    ];
    const budget = createMockBudget({ BudgetItem: items });
    const ev = createMockEarnedValue({
      earnedValue: 400000,
      actualCost: 500000, // CPI alert
      plannedValue: 500000, // SPI alert
    });

    mockPrisma.projectBudget.findUnique.mockResolvedValue(budget);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(ev);
    mockPrisma.contingencyUsage.findMany.mockResolvedValue([]);

    const alertCount = await checkAndCreateAlerts('project-1');

    // 1 CPI + 1 SPI + 2 item alerts = 4 total
    expect(alertCount).toBe(4);
  });
});
