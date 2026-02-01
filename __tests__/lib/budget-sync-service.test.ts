import { describe, it, expect, beforeEach, vi } from 'vitest';
import { startOfDay } from 'date-fns';

// Mock dependencies BEFORE importing the module
const prismaMock = {
  projectBudget: {
    findUnique: vi.fn(),
  },
  schedule: {
    findFirst: vi.fn(),
  },
  earnedValue: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  budgetSnapshot: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  costAlert: {
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  notification: {
    create: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
  contingencyUsage: {
    findMany: vi.fn(),
  },
};

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

describe('Budget Sync Service - EVM Calculations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate basic EVM metrics from schedule tasks', async () => {
    const { calculateEVMFromSchedule } = await import('@/lib/budget-sync-service');

    const testDate = new Date('2024-01-15');

    prismaMock.projectBudget.findUnique.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      BudgetItem: [
        { id: 'item-1', isActive: true, actualCost: 50000 },
        { id: 'item-2', isActive: true, actualCost: 30000 },
      ],
    });

    prismaMock.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [
        {
          id: 'task-1',
          name: 'Foundation',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-10'),
          duration: 10,
          budgetedCost: 100000,
          percentComplete: 100,
          actualCost: 95000,
        },
        {
          id: 'task-2',
          name: 'Framing',
          startDate: new Date('2024-01-11'),
          endDate: new Date('2024-01-20'),
          duration: 10,
          budgetedCost: 150000,
          percentComplete: 50,
          actualCost: 70000,
        },
      ],
    });

    const metrics = await calculateEVMFromSchedule('project-1', testDate);

    expect(metrics).toBeDefined();
    expect(metrics?.plannedValue).toBeGreaterThan(0);
    expect(metrics?.earnedValue).toBe(175000); // 100k + (150k * 50%)
    expect(metrics?.actualCost).toBeGreaterThan(0);
    expect(metrics?.costVariance).toBeDefined();
    expect(metrics?.scheduleVariance).toBeDefined();
    expect(metrics?.costPerformanceIndex).toBeGreaterThan(0);
    expect(metrics?.schedulePerformanceIndex).toBeGreaterThan(0);
  });

  it('should calculate CPI correctly (EV / AC)', async () => {
    const { calculateEVMFromSchedule } = await import('@/lib/budget-sync-service');

    prismaMock.projectBudget.findUnique.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      BudgetItem: [{ id: 'item-1', isActive: true, actualCost: 100000 }],
    });

    prismaMock.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [
        {
          id: 'task-1',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-10'),
          duration: 10,
          budgetedCost: 100000,
          percentComplete: 100,
          actualCost: 80000, // Under budget
        },
      ],
    });

    const metrics = await calculateEVMFromSchedule('project-1', new Date('2024-01-15'));

    // EV = 100k, AC = 100k (from BudgetItem), CPI = 100k / 100k = 1.0
    expect(metrics?.earnedValue).toBe(100000);
    expect(metrics?.actualCost).toBe(100000);
    expect(metrics?.costPerformanceIndex).toBe(1.0);
  });

  it('should calculate SPI correctly (EV / PV)', async () => {
    const { calculateEVMFromSchedule } = await import('@/lib/budget-sync-service');

    prismaMock.projectBudget.findUnique.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      BudgetItem: [{ id: 'item-1', isActive: true, actualCost: 0 }],
    });

    prismaMock.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [
        {
          id: 'task-1',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-20'),
          duration: 20,
          budgetedCost: 200000,
          percentComplete: 60, // EV = 120k
          actualCost: 0,
        },
      ],
    });

    const testDate = new Date('2024-01-11'); // Day 10 of 20
    const metrics = await calculateEVMFromSchedule('project-1', testDate);

    // PV = 200k * 50% = 100k (planned at day 10)
    // EV = 200k * 60% = 120k (actual progress)
    // SPI = 120k / 100k = 1.2 (ahead of schedule)
    expect(metrics?.earnedValue).toBe(120000);
    expect(metrics?.plannedValue).toBeCloseTo(100000, -2);
    expect(metrics?.schedulePerformanceIndex).toBeGreaterThan(1.0);
  });

  it('should calculate EAC correctly (BAC / CPI)', async () => {
    const { calculateEVMFromSchedule } = await import('@/lib/budget-sync-service');

    prismaMock.projectBudget.findUnique.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000, // BAC
      BudgetItem: [{ id: 'item-1', isActive: true, actualCost: 120000 }],
    });

    prismaMock.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [
        {
          id: 'task-1',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-10'),
          duration: 10,
          budgetedCost: 100000,
          percentComplete: 100,
          actualCost: 100000,
        },
      ],
    });

    const metrics = await calculateEVMFromSchedule('project-1', new Date('2024-01-15'));

    // EV = 100k, AC = 120k, CPI = 100/120 = 0.833
    // EAC = 1000k / 0.833 = ~1,200,000
    expect(metrics?.costPerformanceIndex).toBeCloseTo(0.833, 2);
    expect(metrics?.estimateAtCompletion).toBeGreaterThan(1000000);
  });

  it('should return null when no budget exists', async () => {
    const { calculateEVMFromSchedule } = await import('@/lib/budget-sync-service');

    prismaMock.projectBudget.findUnique.mockResolvedValue(null);

    const metrics = await calculateEVMFromSchedule('project-1', new Date());

    expect(metrics).toBeNull();
  });

  it('should return null when no schedule exists', async () => {
    const { calculateEVMFromSchedule } = await import('@/lib/budget-sync-service');

    prismaMock.projectBudget.findUnique.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      BudgetItem: [],
    });

    prismaMock.schedule.findFirst.mockResolvedValue(null);

    const metrics = await calculateEVMFromSchedule('project-1', new Date());

    expect(metrics).toBeNull();
  });

  it('should calculate percent complete and percent spent', async () => {
    const { calculateEVMFromSchedule } = await import('@/lib/budget-sync-service');

    prismaMock.projectBudget.findUnique.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      BudgetItem: [{ id: 'item-1', isActive: true, actualCost: 250000 }],
    });

    prismaMock.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [
        {
          id: 'task-1',
          budgetedCost: 500000,
          percentComplete: 50,
          actualCost: 250000,
        },
      ],
    });

    const metrics = await calculateEVMFromSchedule('project-1', new Date());

    expect(metrics?.percentComplete).toBe(50);
    expect(metrics?.percentSpent).toBe(25); // 250k / 1000k
  });
});

describe('Budget Sync Service - EVM Snapshot Recording', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should upsert EVM snapshot with create data when none exists', async () => {
    const { recordEVMSnapshot } = await import('@/lib/budget-sync-service');

    prismaMock.projectBudget.findUnique.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
    });

    prismaMock.earnedValue.upsert.mockResolvedValue({ id: 'ev-1' });

    const metrics = {
      plannedValue: 100000,
      earnedValue: 95000,
      actualCost: 98000,
      costVariance: -3000,
      scheduleVariance: -5000,
      costPerformanceIndex: 0.97,
      schedulePerformanceIndex: 0.95,
      estimateAtCompletion: 1030000,
      estimateToComplete: 932000,
      varianceAtCompletion: -30000,
      percentComplete: 45,
      percentSpent: 48,
    };

    await recordEVMSnapshot('project-1', metrics, 'user-1');

    expect(prismaMock.earnedValue.upsert).toHaveBeenCalledWith({
      where: {
        budgetId_periodDate_periodType: expect.objectContaining({
          budgetId: 'budget-1',
          periodType: 'daily',
        }),
      },
      update: expect.objectContaining({
        plannedValue: 100000,
        earnedValue: 95000,
        actualCost: 98000,
        costPerformanceIndex: 0.97,
        schedulePerformanceIndex: 0.95,
      }),
      create: expect.objectContaining({
        budgetId: 'budget-1',
        periodType: 'daily',
        plannedValue: 100000,
        earnedValue: 95000,
        actualCost: 98000,
        costPerformanceIndex: 0.97,
        schedulePerformanceIndex: 0.95,
        calculatedBy: 'user-1',
      }),
    });
  });

  it('should upsert EVM snapshot with update data for existing record', async () => {
    const { recordEVMSnapshot } = await import('@/lib/budget-sync-service');

    prismaMock.projectBudget.findUnique.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
    });

    // Upsert handles both create and update atomically
    prismaMock.earnedValue.upsert.mockResolvedValue({ id: 'ev-1' });

    const metrics = {
      plannedValue: 100000,
      earnedValue: 95000,
      actualCost: 98000,
      costVariance: -3000,
      scheduleVariance: -5000,
      costPerformanceIndex: 0.97,
      schedulePerformanceIndex: 0.95,
      estimateAtCompletion: 1030000,
      estimateToComplete: 932000,
      varianceAtCompletion: -30000,
      percentComplete: 45,
      percentSpent: 48,
    };

    await recordEVMSnapshot('project-1', metrics);

    // Verify upsert was called with proper update data
    expect(prismaMock.earnedValue.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          plannedValue: 100000,
          earnedValue: 95000,
          actualCost: 98000,
        }),
      })
    );
  });
});

describe('Budget Sync Service - Cost Alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate CRITICAL CPI alert when CPI < 0.85', async () => {
    const { checkAndGenerateAlerts } = await import('@/lib/budget-sync-service');

    prismaMock.projectBudget.findUnique.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      contingency: 0,
      BudgetItem: [{ id: 'item-1', isActive: true, actualCost: 120000 }],
    });

    prismaMock.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [
        {
          id: 'task-1',
          budgetedCost: 100000,
          percentComplete: 100,
          actualCost: 100000,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-10'),
          duration: 10,
        },
      ],
    });

    prismaMock.costAlert.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.costAlert.create.mockResolvedValue({ id: 'alert-1' });
    prismaMock.project.findUnique.mockResolvedValue({ ownerId: 'user-1' });
    prismaMock.notification.create.mockResolvedValue({ id: 'notif-1' });

    const alerts = await checkAndGenerateAlerts('project-1');

    expect(alerts.length).toBeGreaterThan(0);
    const cpiAlert = alerts.find((a) => a.alertType === 'CPI_LOW');
    expect(cpiAlert).toBeDefined();
    expect(cpiAlert?.severity).toBe('CRITICAL');
    expect(cpiAlert?.currentValue).toBeLessThan(0.85);
  });

  it('should generate WARNING CPI alert when 0.85 <= CPI < 0.95', async () => {
    const { checkAndGenerateAlerts } = await import('@/lib/budget-sync-service');

    // For CPI WARNING: need 0.85 <= CPI < 0.95
    // CPI = EV / AC, so if EV=100000 and AC=112000, CPI = 0.893
    prismaMock.projectBudget.findUnique.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      contingency: 0,
      BudgetItem: [{ id: 'item-1', isActive: true, actualCost: 112000 }],
    });

    prismaMock.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [
        {
          id: 'task-1',
          budgetedCost: 100000,
          percentComplete: 100,
          actualCost: 112000,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-10'),
          duration: 10,
        },
      ],
    });

    prismaMock.costAlert.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.costAlert.create.mockResolvedValue({ id: 'alert-1' });
    prismaMock.project.findUnique.mockResolvedValue({ ownerId: 'user-1' });
    prismaMock.notification.create.mockResolvedValue({ id: 'notif-1' });

    const alerts = await checkAndGenerateAlerts('project-1');

    const cpiAlert = alerts.find((a) => a.alertType === 'CPI_LOW');
    expect(cpiAlert).toBeDefined();
    expect(cpiAlert?.severity).toBe('WARNING');
    expect(cpiAlert?.currentValue).toBeGreaterThanOrEqual(0.85);
    expect(cpiAlert?.currentValue).toBeLessThan(0.95);
  });

  it('should generate CRITICAL SPI alert when SPI < 0.85', async () => {
    const { checkAndGenerateAlerts } = await import('@/lib/budget-sync-service');

    prismaMock.projectBudget.findUnique.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      contingency: 0,
      BudgetItem: [],
    });

    prismaMock.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [
        {
          id: 'task-1',
          budgetedCost: 100000,
          percentComplete: 40, // Behind schedule
          actualCost: 0,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-20'),
          duration: 20,
        },
      ],
    });

    prismaMock.costAlert.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.costAlert.create.mockResolvedValue({ id: 'alert-1' });
    prismaMock.project.findUnique.mockResolvedValue({ ownerId: 'user-1' });
    prismaMock.notification.create.mockResolvedValue({ id: 'notif-1' });

    const alerts = await checkAndGenerateAlerts('project-1');

    const spiAlert = alerts.find((a) => a.alertType === 'SPI_LOW');
    expect(spiAlert).toBeDefined();
  });

  it('should generate FORECAST_OVERRUN alert when EAC > BAC', async () => {
    const { checkAndGenerateAlerts } = await import('@/lib/budget-sync-service');

    prismaMock.projectBudget.findUnique.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      contingency: 0,
      BudgetItem: [{ id: 'item-1', isActive: true, actualCost: 150000 }],
    });

    prismaMock.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [
        {
          id: 'task-1',
          budgetedCost: 100000,
          percentComplete: 100,
          actualCost: 100000,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-10'),
          duration: 10,
        },
      ],
    });

    prismaMock.costAlert.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.costAlert.create.mockResolvedValue({ id: 'alert-1' });
    prismaMock.project.findUnique.mockResolvedValue({ ownerId: 'user-1' });
    prismaMock.notification.create.mockResolvedValue({ id: 'notif-1' });

    const alerts = await checkAndGenerateAlerts('project-1');

    const overrunAlert = alerts.find((a) => a.alertType === 'FORECAST_OVERRUN');
    expect(overrunAlert).toBeDefined();
  });

  it('should generate CONTINGENCY_LOW CRITICAL alert when 90%+ used', async () => {
    const { checkAndGenerateAlerts } = await import('@/lib/budget-sync-service');

    // Need at least one task for EVM calculation to not return null
    prismaMock.projectBudget.findUnique.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      contingency: 100000,
      BudgetItem: [{ id: 'item-1', isActive: true, actualCost: 50000 }],
    });

    prismaMock.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [
        {
          id: 'task-1',
          budgetedCost: 100000,
          percentComplete: 50,
          actualCost: 50000,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-20'),
          duration: 20,
        },
      ],
    });

    prismaMock.contingencyUsage.findMany.mockResolvedValue([
      { id: 'usage-1', amount: 95000 },
    ]);

    prismaMock.costAlert.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.costAlert.create.mockResolvedValue({ id: 'alert-1' });
    prismaMock.project.findUnique.mockResolvedValue({ ownerId: 'user-1' });
    prismaMock.notification.create.mockResolvedValue({ id: 'notif-1' });

    const alerts = await checkAndGenerateAlerts('project-1');

    const contingencyAlert = alerts.find((a) => a.alertType === 'CONTINGENCY_LOW');
    expect(contingencyAlert).toBeDefined();
    expect(contingencyAlert?.severity).toBe('CRITICAL');
  });

  it('should generate CONTINGENCY_LOW WARNING alert when 70-90% used', async () => {
    const { checkAndGenerateAlerts } = await import('@/lib/budget-sync-service');

    // Need at least one task for EVM calculation to not return null
    prismaMock.projectBudget.findUnique.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      contingency: 100000,
      BudgetItem: [{ id: 'item-1', isActive: true, actualCost: 50000 }],
    });

    prismaMock.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [
        {
          id: 'task-1',
          budgetedCost: 100000,
          percentComplete: 50,
          actualCost: 50000,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-20'),
          duration: 20,
        },
      ],
    });

    prismaMock.contingencyUsage.findMany.mockResolvedValue([
      { id: 'usage-1', amount: 75000 },
    ]);

    prismaMock.costAlert.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.costAlert.create.mockResolvedValue({ id: 'alert-1' });
    prismaMock.project.findUnique.mockResolvedValue({ ownerId: 'user-1' });
    prismaMock.notification.create.mockResolvedValue({ id: 'notif-1' });

    const alerts = await checkAndGenerateAlerts('project-1');

    const contingencyAlert = alerts.find((a) => a.alertType === 'CONTINGENCY_LOW');
    expect(contingencyAlert).toBeDefined();
    expect(contingencyAlert?.severity).toBe('WARNING');
  });

  it('should dismiss old alerts before creating new ones', async () => {
    const { checkAndGenerateAlerts } = await import('@/lib/budget-sync-service');

    prismaMock.projectBudget.findUnique.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      contingency: 0,
      BudgetItem: [{ id: 'item-1', isActive: true, actualCost: 130000 }],
    });

    prismaMock.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [
        {
          id: 'task-1',
          budgetedCost: 100000,
          percentComplete: 100,
          actualCost: 100000,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-10'),
          duration: 10,
        },
      ],
    });

    prismaMock.costAlert.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.costAlert.create.mockResolvedValue({ id: 'alert-1' });
    prismaMock.project.findUnique.mockResolvedValue({ ownerId: 'user-1' });
    prismaMock.notification.create.mockResolvedValue({ id: 'notif-1' });

    await checkAndGenerateAlerts('project-1');

    // Should dismiss old CPI_LOW alerts
    expect(prismaMock.costAlert.updateMany).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        alertType: 'CPI_LOW',
        isDismissed: false,
      },
      data: { isDismissed: true },
    });
  });
});
