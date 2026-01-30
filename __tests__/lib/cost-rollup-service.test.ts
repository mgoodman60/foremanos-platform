import { describe, it, expect, beforeEach, vi } from 'vitest';
import { startOfDay, endOfDay } from 'date-fns';

// Mock dependencies BEFORE importing the module
const prismaMock = {
  laborEntry: {
    findMany: vi.fn(),
    groupBy: vi.fn(),
  },
  procurement: {
    findMany: vi.fn(),
    groupBy: vi.fn(),
  },
  conversation: {
    findMany: vi.fn(),
  },
  invoice: {
    findMany: vi.fn(),
  },
  budgetSnapshot: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  projectBudget: {
    findUnique: vi.fn(),
  },
  budgetItem: {
    aggregate: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

const syncBudgetFromScheduleMock = vi.fn();
vi.mock('@/lib/budget-sync-service', () => ({
  syncBudgetFromSchedule: syncBudgetFromScheduleMock,
}));

describe('Cost Rollup Service - Labor Costs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate labor costs for a specific date', async () => {
    const { calculateDailyCosts } = await import('@/lib/cost-rollup-service');

    const testDate = new Date('2024-01-15');

    prismaMock.laborEntry.findMany.mockResolvedValue([
      {
        id: 'labor-1',
        workerName: 'John Doe',
        hoursWorked: 8,
        totalCost: 400,
        date: testDate,
        status: 'APPROVED',
      },
      {
        id: 'labor-2',
        workerName: 'Jane Smith',
        hoursWorked: 8,
        totalCost: 450,
        date: testDate,
        status: 'APPROVED',
      },
    ]);

    prismaMock.procurement.findMany.mockResolvedValue([]);
    prismaMock.conversation.findMany.mockResolvedValue([]);
    prismaMock.invoice.findMany.mockResolvedValue([]);

    const summary = await calculateDailyCosts('project-1', testDate);

    expect(summary.laborCost).toBe(850);
    expect(summary.laborHours).toBe(16);
    expect(summary.workerCount).toBe(2); // 2 unique workers
  });

  it('should only count APPROVED labor entries', async () => {
    const { calculateDailyCosts } = await import('@/lib/cost-rollup-service');

    const testDate = new Date('2024-01-15');

    prismaMock.laborEntry.findMany.mockResolvedValue([
      { id: 'labor-1', workerName: 'John', hoursWorked: 8, totalCost: 400, status: 'APPROVED' },
      { id: 'labor-2', workerName: 'Jane', hoursWorked: 8, totalCost: 450, status: 'PENDING' },
    ]);

    prismaMock.procurement.findMany.mockResolvedValue([]);
    prismaMock.conversation.findMany.mockResolvedValue([]);
    prismaMock.invoice.findMany.mockResolvedValue([]);

    const summary = await calculateDailyCosts('project-1', testDate);

    // Should have been filtered by status: 'APPROVED' in the mock
    expect(prismaMock.laborEntry.findMany).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        date: { gte: startOfDay(testDate), lte: endOfDay(testDate) },
        status: 'APPROVED',
      },
    });
  });

  it('should count unique workers correctly', async () => {
    const { calculateDailyCosts } = await import('@/lib/cost-rollup-service');

    const testDate = new Date('2024-01-15');

    prismaMock.laborEntry.findMany.mockResolvedValue([
      { id: 'labor-1', workerName: 'John Doe', hoursWorked: 4, totalCost: 200 },
      { id: 'labor-2', workerName: 'John Doe', hoursWorked: 4, totalCost: 200 },
      { id: 'labor-3', workerName: 'Jane Smith', hoursWorked: 8, totalCost: 450 },
    ]);

    prismaMock.procurement.findMany.mockResolvedValue([]);
    prismaMock.conversation.findMany.mockResolvedValue([]);
    prismaMock.invoice.findMany.mockResolvedValue([]);

    const summary = await calculateDailyCosts('project-1', testDate);

    expect(summary.workerCount).toBe(2); // John appears twice, Jane once = 2 unique
    expect(summary.laborHours).toBe(16);
    expect(summary.laborCost).toBe(850);
  });
});

describe('Cost Rollup Service - Material Costs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate material costs from received procurements', async () => {
    const { calculateDailyCosts } = await import('@/lib/cost-rollup-service');

    const testDate = new Date('2024-01-15');

    prismaMock.laborEntry.findMany.mockResolvedValue([]);
    prismaMock.procurement.findMany.mockResolvedValue([
      {
        id: 'proc-1',
        actualDelivery: testDate,
        actualCost: 5000,
        status: 'RECEIVED',
      },
      {
        id: 'proc-2',
        actualDelivery: testDate,
        actualCost: 3000,
        status: 'RECEIVED',
      },
    ]);
    prismaMock.conversation.findMany.mockResolvedValue([]);
    prismaMock.invoice.findMany.mockResolvedValue([]);

    const summary = await calculateDailyCosts('project-1', testDate);

    expect(summary.materialCost).toBe(8000);
  });

  it('should only count RECEIVED procurement items', async () => {
    const { calculateDailyCosts } = await import('@/lib/cost-rollup-service');

    const testDate = new Date('2024-01-15');

    prismaMock.laborEntry.findMany.mockResolvedValue([]);
    prismaMock.procurement.findMany.mockResolvedValue([
      { id: 'proc-1', actualCost: 5000, status: 'RECEIVED' },
      { id: 'proc-2', actualCost: 3000, status: 'ORDERED' },
    ]);
    prismaMock.conversation.findMany.mockResolvedValue([]);
    prismaMock.invoice.findMany.mockResolvedValue([]);

    const summary = await calculateDailyCosts('project-1', testDate);

    expect(prismaMock.procurement.findMany).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        actualDelivery: { gte: startOfDay(testDate), lte: endOfDay(testDate) },
        status: 'RECEIVED',
      },
    });
  });
});

describe('Cost Rollup Service - Equipment and Subcontractor Costs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate equipment costs from daily reports', async () => {
    const { calculateDailyCosts } = await import('@/lib/cost-rollup-service');

    const testDate = new Date('2024-01-15');

    prismaMock.laborEntry.findMany.mockResolvedValue([]);
    prismaMock.procurement.findMany.mockResolvedValue([]);
    prismaMock.conversation.findMany.mockResolvedValue([
      {
        id: 'conv-1',
        conversationType: 'daily_report',
        dailyReportDate: testDate,
        equipmentData: [
          { name: 'Excavator', dailyCost: 500 },
          { name: 'Crane', cost: 800 },
        ],
      },
    ]);
    prismaMock.invoice.findMany.mockResolvedValue([]);

    const summary = await calculateDailyCosts('project-1', testDate);

    expect(summary.equipmentCost).toBe(1300);
  });

  it('should calculate subcontractor costs from approved invoices', async () => {
    const { calculateDailyCosts } = await import('@/lib/cost-rollup-service');

    const testDate = new Date('2024-01-15');

    prismaMock.laborEntry.findMany.mockResolvedValue([]);
    prismaMock.procurement.findMany.mockResolvedValue([]);
    prismaMock.conversation.findMany.mockResolvedValue([]);
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        id: 'inv-1',
        invoiceDate: testDate,
        amount: 10000,
        status: 'APPROVED',
      },
      {
        id: 'inv-2',
        invoiceDate: testDate,
        amount: 7500,
        status: 'APPROVED',
      },
    ]);

    const summary = await calculateDailyCosts('project-1', testDate);

    expect(summary.subcontractorCost).toBe(17500);
  });

  it('should calculate total cost correctly from all categories', async () => {
    const { calculateDailyCosts } = await import('@/lib/cost-rollup-service');

    const testDate = new Date('2024-01-15');

    prismaMock.laborEntry.findMany.mockResolvedValue([
      { workerName: 'John', hoursWorked: 8, totalCost: 400 },
    ]);

    prismaMock.procurement.findMany.mockResolvedValue([
      { actualCost: 5000, status: 'RECEIVED' },
    ]);

    prismaMock.conversation.findMany.mockResolvedValue([
      { equipmentData: [{ dailyCost: 500 }] },
    ]);

    prismaMock.invoice.findMany.mockResolvedValue([
      { amount: 10000, status: 'APPROVED' },
    ]);

    const summary = await calculateDailyCosts('project-1', testDate);

    expect(summary.totalCost).toBe(15900); // 400 + 5000 + 500 + 10000
  });
});

describe('Cost Rollup Service - Budget Item Reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should recalculate budget item actuals from labor and procurement', async () => {
    const { recalculateBudgetItemActuals } = await import('@/lib/cost-rollup-service');

    prismaMock.projectBudget.findUnique.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      BudgetItem: [
        {
          id: 'item-1',
          name: 'Concrete',
          actualHours: 0,
          actualCost: 0,
        },
        {
          id: 'item-2',
          name: 'Electrical',
          actualHours: 0,
          actualCost: 0,
        },
      ],
    });

    prismaMock.laborEntry.groupBy.mockResolvedValue([
      {
        budgetItemId: 'item-1',
        _sum: { hoursWorked: 80, totalCost: 4000 },
      },
      {
        budgetItemId: 'item-2',
        _sum: { hoursWorked: 60, totalCost: 3600 },
      },
    ]);

    prismaMock.procurement.groupBy.mockResolvedValue([
      {
        budgetItemId: 'item-1',
        _sum: { actualCost: 15000 },
      },
    ]);

    prismaMock.budgetItem.update.mockResolvedValue({});

    const updatedCount = await recalculateBudgetItemActuals('project-1');

    expect(updatedCount).toBe(2);

    // Item 1: Labor 4000 + Material 15000 = 19000
    expect(prismaMock.budgetItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: {
        actualHours: 80,
        actualCost: 19000,
      },
    });

    // Item 2: Labor 3600 + Material 0 = 3600
    expect(prismaMock.budgetItem.update).toHaveBeenCalledWith({
      where: { id: 'item-2' },
      data: {
        actualHours: 60,
        actualCost: 3600,
      },
    });
  });

  it('should use batch operations for performance', async () => {
    const { recalculateBudgetItemActuals } = await import('@/lib/cost-rollup-service');

    prismaMock.projectBudget.findUnique.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      BudgetItem: [
        { id: 'item-1', actualHours: 0, actualCost: 0 },
        { id: 'item-2', actualHours: 0, actualCost: 0 },
        { id: 'item-3', actualHours: 0, actualCost: 0 },
      ],
    });

    prismaMock.laborEntry.groupBy.mockResolvedValue([
      { budgetItemId: 'item-1', _sum: { hoursWorked: 10, totalCost: 500 } },
    ]);

    prismaMock.procurement.groupBy.mockResolvedValue([]);

    prismaMock.budgetItem.update.mockResolvedValue({});

    await recalculateBudgetItemActuals('project-1');

    // Should use groupBy for efficient aggregation
    expect(prismaMock.laborEntry.groupBy).toHaveBeenCalledWith({
      by: ['budgetItemId'],
      where: expect.objectContaining({
        budgetItemId: { in: expect.any(Array) },
        status: 'APPROVED',
      }),
      _sum: {
        hoursWorked: true,
        totalCost: true,
      },
    });
  });

  it('should skip update if values have not changed', async () => {
    const { recalculateBudgetItemActuals } = await import('@/lib/cost-rollup-service');

    prismaMock.projectBudget.findUnique.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      BudgetItem: [
        {
          id: 'item-1',
          actualHours: 80,
          actualCost: 4000,
        },
      ],
    });

    prismaMock.laborEntry.groupBy.mockResolvedValue([
      {
        budgetItemId: 'item-1',
        _sum: { hoursWorked: 80, totalCost: 4000 },
      },
    ]);

    prismaMock.procurement.groupBy.mockResolvedValue([]);

    prismaMock.budgetItem.update.mockResolvedValue({});

    const updatedCount = await recalculateBudgetItemActuals('project-1');

    expect(updatedCount).toBe(0); // No changes needed
    expect(prismaMock.budgetItem.update).not.toHaveBeenCalled();
  });
});

describe('Cost Rollup Service - Daily Rollup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should perform complete daily cost rollup', async () => {
    const { performDailyCostRollup } = await import('@/lib/cost-rollup-service');

    const testDate = new Date('2024-01-15');

    prismaMock.laborEntry.findMany.mockResolvedValue([
      { workerName: 'John', hoursWorked: 8, totalCost: 400 },
    ]);

    prismaMock.procurement.findMany.mockResolvedValue([
      { actualCost: 5000 },
    ]);

    prismaMock.conversation.findMany.mockResolvedValue([
      { equipmentData: [{ dailyCost: 500 }] },
    ]);

    prismaMock.invoice.findMany.mockResolvedValue([
      { amount: 10000 },
    ]);

    prismaMock.budgetSnapshot.findFirst.mockResolvedValue(null);
    prismaMock.budgetSnapshot.create.mockResolvedValue({ id: 'snapshot-1' });

    prismaMock.projectBudget.findUnique.mockResolvedValue({ id: 'budget-1' });
    prismaMock.budgetItem.aggregate.mockResolvedValue({
      _sum: { actualCost: 15900, actualHours: 8 },
      _count: { id: 3 },
    });

    syncBudgetFromScheduleMock.mockResolvedValue(undefined);

    const result = await performDailyCostRollup('project-1', testDate, 'user-1');

    expect(result.success).toBe(true);
    expect(result.summary.totalCost).toBe(15900);
    expect(result.budgetItemsUpdated).toBe(3);
    expect(result.evmRefreshed).toBe(true);
  });

  it('should create budget snapshot if none exists', async () => {
    const { performDailyCostRollup } = await import('@/lib/cost-rollup-service');

    const testDate = new Date('2024-01-15');

    prismaMock.laborEntry.findMany.mockResolvedValue([]);
    prismaMock.procurement.findMany.mockResolvedValue([]);
    prismaMock.conversation.findMany.mockResolvedValue([]);
    prismaMock.invoice.findMany.mockResolvedValue([]);

    prismaMock.budgetSnapshot.findFirst.mockResolvedValue(null);
    prismaMock.budgetSnapshot.create.mockResolvedValue({ id: 'snapshot-1' });

    prismaMock.projectBudget.findUnique.mockResolvedValue({ id: 'budget-1' });
    prismaMock.budgetItem.aggregate.mockResolvedValue({
      _sum: { actualCost: 0, actualHours: 0 },
      _count: { id: 0 },
    });

    syncBudgetFromScheduleMock.mockResolvedValue(undefined);

    await performDailyCostRollup('project-1', testDate);

    expect(prismaMock.budgetSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        snapshotDate: startOfDay(testDate),
        actualCost: 0,
      }),
    });
  });

  it('should update existing budget snapshot', async () => {
    const { performDailyCostRollup } = await import('@/lib/cost-rollup-service');

    const testDate = new Date('2024-01-15');

    prismaMock.laborEntry.findMany.mockResolvedValue([]);
    prismaMock.procurement.findMany.mockResolvedValue([]);
    prismaMock.conversation.findMany.mockResolvedValue([]);
    prismaMock.invoice.findMany.mockResolvedValue([]);

    prismaMock.budgetSnapshot.findFirst.mockResolvedValue({
      id: 'snapshot-1',
      snapshotDate: startOfDay(testDate),
    });

    prismaMock.budgetSnapshot.update.mockResolvedValue({ id: 'snapshot-1' });

    prismaMock.projectBudget.findUnique.mockResolvedValue({ id: 'budget-1' });
    prismaMock.budgetItem.aggregate.mockResolvedValue({
      _sum: { actualCost: 0, actualHours: 0 },
      _count: { id: 0 },
    });

    syncBudgetFromScheduleMock.mockResolvedValue(undefined);

    await performDailyCostRollup('project-1', testDate);

    expect(prismaMock.budgetSnapshot.update).toHaveBeenCalledWith({
      where: { id: 'snapshot-1' },
      data: expect.objectContaining({
        actualCost: 0,
      }),
    });
  });

  it('should trigger EVM sync after rollup', async () => {
    const { performDailyCostRollup } = await import('@/lib/cost-rollup-service');

    const testDate = new Date('2024-01-15');

    prismaMock.laborEntry.findMany.mockResolvedValue([]);
    prismaMock.procurement.findMany.mockResolvedValue([]);
    prismaMock.conversation.findMany.mockResolvedValue([]);
    prismaMock.invoice.findMany.mockResolvedValue([]);

    prismaMock.budgetSnapshot.findFirst.mockResolvedValue(null);
    prismaMock.budgetSnapshot.create.mockResolvedValue({ id: 'snapshot-1' });

    prismaMock.projectBudget.findUnique.mockResolvedValue({ id: 'budget-1' });
    prismaMock.budgetItem.aggregate.mockResolvedValue({
      _sum: { actualCost: 0, actualHours: 0 },
      _count: { id: 0 },
    });

    syncBudgetFromScheduleMock.mockResolvedValue(undefined);

    await performDailyCostRollup('project-1', testDate, 'user-1');

    expect(syncBudgetFromScheduleMock).toHaveBeenCalledWith('project-1', 'user-1');
  });

  it('should handle errors gracefully', async () => {
    const { performDailyCostRollup } = await import('@/lib/cost-rollup-service');

    const testDate = new Date('2024-01-15');

    prismaMock.laborEntry.findMany.mockRejectedValue(new Error('Database error'));

    const result = await performDailyCostRollup('project-1', testDate);

    expect(result.success).toBe(false);
    expect(result.summary.totalCost).toBe(0);
    expect(result.evmRefreshed).toBe(false);
  });
});
