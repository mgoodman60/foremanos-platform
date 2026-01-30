import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock data
const mockBudget = {
  id: 'budget-1',
  projectId: 'project-1',
  BudgetItem: [
    {
      id: 'budget-item-1',
      name: 'Carpentry',
      description: 'Framing and carpentry work',
      tradeType: 'carpentry_framing',
      phaseCode: 600,
      actualCost: 5000,
      actualHours: 100,
    },
    {
      id: 'budget-item-2',
      name: 'Electrical',
      description: 'Electrical installation',
      tradeType: 'electrical',
      phaseCode: 1600,
      actualCost: 3000,
      actualHours: 50,
    },
    {
      id: 'budget-item-3',
      name: 'Equipment Rental',
      description: 'General equipment',
      phaseCode: 100,
      actualCost: 2000,
    },
  ],
};

const mockSchedule = {
  id: 'schedule-1',
  projectId: 'project-1',
  isActive: true,
  ScheduleTask: [
    {
      id: 'task-1',
      name: 'Frame walls',
      description: 'Frame interior walls',
      percentComplete: 50,
      budgetedCost: 10000,
      actualCost: 5000,
      status: 'in_progress',
      endDate: new Date(),
    },
    {
      id: 'task-2',
      name: 'Install electrical rough-in',
      description: 'Rough electrical work',
      percentComplete: 20,
      budgetedCost: 8000,
      actualCost: 1000,
      status: 'in_progress',
      endDate: new Date(),
    },
  ],
};

const mockDailyReport = {
  id: 'report-1',
  projectId: 'project-1',
  reportDate: new Date('2024-01-15'),
  status: 'APPROVED',
  delayHours: 2,
  delayReason: 'Weather',
  weatherCondition: 'Rain',
  project: {
    id: 'project-1',
    name: 'Test Project',
  },
  laborEntries: [
    {
      tradeName: 'Carpenter',
      workerCount: 5,
      regularHours: 8,
      overtimeHours: 2,
      hourlyRate: 55,
      overtimeRate: 82.5,
      description: 'Framing work',
      budgetItemId: 'budget-item-1',
    },
    {
      tradeName: 'Electrician',
      workerCount: 3,
      regularHours: 8,
      overtimeHours: 0,
      hourlyRate: 75,
      overtimeRate: 112.5,
      description: 'Rough-in',
      budgetItemId: null,
    },
  ],
  equipmentEntries: [
    {
      equipmentName: 'Excavator',
      equipmentType: 'Heavy',
      hours: 6,
      dailyRate: 800,
      hourlyRate: 0,
      fuelCost: 150,
      operatorCost: 200,
      status: 'active',
      notes: 'Good condition',
      budgetItemId: null,
    },
  ],
  progressEntries: [
    {
      activityName: 'Frame walls',
      location: 'Building A',
      unitsCompleted: 100,
      unitOfMeasure: 'LF',
      percentComplete: 75,
      scheduleTaskId: 'task-1',
      budgetItemId: null,
      notes: 'Ahead of schedule',
    },
  ],
};

// Mock Prisma
const prismaMock = {
  projectBudget: {
    findFirst: vi.fn(),
  },
  schedule: {
    findFirst: vi.fn(),
  },
  dailyReport: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  dailyReportLabor: {
    upsert: vi.fn(),
  },
  dailyReportEquipment: {
    create: vi.fn(),
  },
  dailyReportProgress: {
    create: vi.fn(),
  },
  budgetItem: {
    update: vi.fn(),
    findMany: vi.fn(),
  },
  scheduleTask: {
    update: vi.fn(),
  },
  activityLog: {
    create: vi.fn(),
  },
  projectDataSource: {
    upsert: vi.fn(),
  },
};

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

// Mock project-specific pricing
const getProjectLaborRateMock = vi.fn();
vi.mock('@/lib/project-specific-pricing', () => ({
  getProjectLaborRate: getProjectLaborRateMock,
}));

describe('syncLaborToBudget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.projectBudget.findFirst.mockResolvedValue(mockBudget);
    prismaMock.dailyReportLabor.upsert.mockResolvedValue({});
    prismaMock.budgetItem.update.mockResolvedValue({});
    getProjectLaborRateMock.mockResolvedValue({
      hourlyRate: 55,
      source: 'project_specific',
    });
  });

  it('should sync labor entries with provided hourly rates', async () => {
    const { syncLaborToBudget } = await import('@/lib/daily-report-sync-service');

    const result = await syncLaborToBudget('report-1', 'project-1', [
      {
        tradeName: 'Carpenter',
        workerCount: 5,
        regularHours: 8,
        overtimeHours: 2,
        hourlyRate: 55,
        overtimeRate: 82.5,
        budgetItemId: 'budget-item-1',
      },
    ]);

    expect(result.synced).toBe(1);
    expect(result.totalCost).toBe(5 * 8 * 55 + 5 * 2 * 82.5); // 2200 + 825 = 3025
    expect(result.budgetItems).toContain('budget-item-1');
    expect(prismaMock.budgetItem.update).toHaveBeenCalledWith({
      where: { id: 'budget-item-1' },
      data: {
        actualCost: { increment: 3025 },
        actualHours: { increment: 50 }, // 5 workers * 10 hours
      },
    });
  });

  it('should calculate overtime rate automatically', async () => {
    const { syncLaborToBudget } = await import('@/lib/daily-report-sync-service');

    await syncLaborToBudget('report-1', 'project-1', [
      {
        tradeName: 'Electrician',
        workerCount: 3,
        regularHours: 8,
        overtimeHours: 2,
        hourlyRate: 75,
      },
    ]);

    expect(prismaMock.dailyReportLabor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          overtimeRate: 112.5, // 75 * 1.5
        }),
      })
    );
  });

  it('should use project-specific rates when not provided', async () => {
    getProjectLaborRateMock.mockResolvedValue({
      hourlyRate: 60,
      source: 'project_specific',
    });

    const { syncLaborToBudget } = await import('@/lib/daily-report-sync-service');

    await syncLaborToBudget('report-1', 'project-1', [
      {
        tradeName: 'Carpenter',
        workerCount: 5,
        regularHours: 8,
        overtimeHours: 0,
      },
    ]);

    expect(getProjectLaborRateMock).toHaveBeenCalledWith('project-1', 'Carpenter');
    expect(prismaMock.dailyReportLabor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          hourlyRate: 60,
        }),
      })
    );
  });

  it('should match trade to budget item automatically', async () => {
    const { syncLaborToBudget } = await import('@/lib/daily-report-sync-service');

    const result = await syncLaborToBudget('report-1', 'project-1', [
      {
        tradeName: 'Carpenter',
        workerCount: 5,
        regularHours: 8,
        overtimeHours: 0,
        hourlyRate: 55,
      },
    ]);

    expect(prismaMock.projectBudget.findFirst).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      include: { BudgetItem: true },
    });
    expect(result.budgetItems).toContain('budget-item-1');
  });

  it('should add warning when trade cannot be matched', async () => {
    prismaMock.projectBudget.findFirst.mockResolvedValue({
      ...mockBudget,
      BudgetItem: [],
    });

    const { syncLaborToBudget } = await import('@/lib/daily-report-sync-service');

    const result = await syncLaborToBudget('report-1', 'project-1', [
      {
        tradeName: 'Unknown Trade',
        workerCount: 5,
        regularHours: 8,
        overtimeHours: 0,
        hourlyRate: 55,
      },
    ]);

    expect(result.warnings).toContain('Could not match trade "Unknown Trade" to a budget item');
  });
});

describe('syncEquipmentToBudget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.projectBudget.findFirst.mockResolvedValue(mockBudget);
    prismaMock.dailyReportEquipment.create.mockResolvedValue({});
    prismaMock.budgetItem.update.mockResolvedValue({});
  });

  it('should sync equipment with daily rate', async () => {
    const { syncEquipmentToBudget } = await import('@/lib/daily-report-sync-service');

    const result = await syncEquipmentToBudget('report-1', 'project-1', [
      {
        equipmentName: 'Excavator',
        hours: 6,
        dailyRate: 800,
        fuelCost: 150,
        operatorCost: 200,
      },
    ]);

    expect(result.synced).toBe(1);
    expect(result.totalCost).toBe(800 + 150 + 200); // 1150
    expect(prismaMock.dailyReportEquipment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        equipmentName: 'Excavator',
        totalCost: 1150,
      }),
    });
  });

  it('should sync equipment with hourly rate', async () => {
    const { syncEquipmentToBudget } = await import('@/lib/daily-report-sync-service');

    const result = await syncEquipmentToBudget('report-1', 'project-1', [
      {
        equipmentName: 'Forklift',
        hours: 8,
        hourlyRate: 50,
        fuelCost: 75,
      },
    ]);

    expect(result.totalCost).toBe(8 * 50 + 75); // 475
  });

  it('should match equipment to budget item', async () => {
    const { syncEquipmentToBudget } = await import('@/lib/daily-report-sync-service');

    await syncEquipmentToBudget('report-1', 'project-1', [
      {
        equipmentName: 'Excavator',
        hours: 6,
        dailyRate: 800,
      },
    ]);

    expect(prismaMock.projectBudget.findFirst).toHaveBeenCalled();
  });
});

describe('syncProgressToSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.schedule.findFirst.mockResolvedValue(mockSchedule);
    prismaMock.dailyReportProgress.create.mockResolvedValue({});
    prismaMock.scheduleTask.update.mockResolvedValue({});
  });

  it('should sync progress to schedule task', async () => {
    const { syncProgressToSchedule } = await import('@/lib/daily-report-sync-service');

    const result = await syncProgressToSchedule('report-1', 'project-1', [
      {
        activityName: 'Frame walls',
        percentComplete: 75,
        unitsCompleted: 100,
        unitOfMeasure: 'LF',
        scheduleTaskId: 'task-1',
      },
    ]);

    expect(result.synced).toBe(1);
    expect(result.tasksUpdated).toContain('task-1');
    expect(prismaMock.scheduleTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: expect.objectContaining({
        percentComplete: 75,
      }),
    });
  });

  it('should calculate earned value correctly', async () => {
    const { syncProgressToSchedule } = await import('@/lib/daily-report-sync-service');

    // Task at 50%, moving to 75%, budget is 10000
    // Progress delta: 25%, earned value: 10000 * 0.25 = 2500
    // Don't provide scheduleTaskId so the function looks up the task by name
    await syncProgressToSchedule('report-1', 'project-1', [
      {
        activityName: 'Frame walls',
        percentComplete: 75,
        unitsCompleted: 100,
        // scheduleTaskId not provided - let it match by name
      },
    ]);

    expect(prismaMock.dailyReportProgress.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        previousPercent: 50,
        valueEarned: 2500,
      }),
    });
  });

  it('should match activity name to schedule task', async () => {
    const { syncProgressToSchedule } = await import('@/lib/daily-report-sync-service');

    const result = await syncProgressToSchedule('report-1', 'project-1', [
      {
        activityName: 'Frame walls',
        percentComplete: 75,
        unitsCompleted: 100,
      },
    ]);

    expect(prismaMock.schedule.findFirst).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      include: {
        ScheduleTask: expect.objectContaining({
          where: {
            OR: [
              { name: { contains: 'Frame walls', mode: 'insensitive' } },
              { description: { contains: 'Frame walls', mode: 'insensitive' } },
            ],
          },
        }),
      },
    });
  });

  it('should add warning when activity cannot be matched', async () => {
    prismaMock.schedule.findFirst.mockResolvedValue({
      ...mockSchedule,
      ScheduleTask: [],
    });

    const { syncProgressToSchedule } = await import('@/lib/daily-report-sync-service');

    const result = await syncProgressToSchedule('report-1', 'project-1', [
      {
        activityName: 'Unknown Activity',
        percentComplete: 50,
        unitsCompleted: 10,
      },
    ]);

    expect(result.warnings).toContain('Could not match activity "Unknown Activity" to a schedule task');
  });
});

describe('syncDailyReportFull', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.dailyReport.findUnique.mockResolvedValue(mockDailyReport);
    prismaMock.projectBudget.findFirst.mockResolvedValue(mockBudget);
    prismaMock.schedule.findFirst.mockResolvedValue(mockSchedule);
    prismaMock.dailyReportLabor.upsert.mockResolvedValue({});
    prismaMock.dailyReportEquipment.create.mockResolvedValue({});
    prismaMock.dailyReportProgress.create.mockResolvedValue({});
    prismaMock.budgetItem.update.mockResolvedValue({});
    prismaMock.scheduleTask.update.mockResolvedValue({});
    prismaMock.dailyReport.update.mockResolvedValue({});
    prismaMock.activityLog.create.mockResolvedValue({});
    prismaMock.projectDataSource.upsert.mockResolvedValue({});
    getProjectLaborRateMock.mockResolvedValue({
      hourlyRate: 55,
      source: 'project_specific',
    });
  });

  it('should return error when report not found', async () => {
    prismaMock.dailyReport.findUnique.mockResolvedValue(null);

    const { syncDailyReportFull } = await import('@/lib/daily-report-sync-service');
    const result = await syncDailyReportFull('report-1');

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Daily report not found');
  });

  it('should sync all report components', async () => {
    const { syncDailyReportFull } = await import('@/lib/daily-report-sync-service');
    const result = await syncDailyReportFull('report-1');

    expect(result.success).toBe(true);
    expect(result.laborSynced).toBe(2);
    expect(result.equipmentSynced).toBe(1);
    expect(result.progressSynced).toBe(1);
    expect(result.budgetItemsUpdated).toBeGreaterThan(0);
  });

  it('should record weather delays', async () => {
    const { syncDailyReportFull } = await import('@/lib/daily-report-sync-service');
    await syncDailyReportFull('report-1');

    expect(prismaMock.dailyReport.update).toHaveBeenCalledWith({
      where: { id: 'report-1' },
      data: expect.objectContaining({
        delayHours: 2,
        delayReason: 'Weather',
        weatherCondition: 'Rain',
      }),
    });
  });

  it('should log weather delay for active tasks', async () => {
    const { syncDailyReportFull } = await import('@/lib/daily-report-sync-service');
    await syncDailyReportFull('report-1');

    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'WEATHER_DELAY',
        resource: 'ScheduleTask',
      }),
    });
  });

  it('should update project data source', async () => {
    const { syncDailyReportFull } = await import('@/lib/daily-report-sync-service');
    await syncDailyReportFull('report-1');

    expect(prismaMock.projectDataSource.upsert).toHaveBeenCalledWith({
      where: {
        projectId_featureType: {
          projectId: 'project-1',
          featureType: 'daily_reports',
        },
      },
      create: expect.objectContaining({
        projectId: 'project-1',
        featureType: 'daily_reports',
        sourceType: 'daily_report',
        confidence: 100,
      }),
      update: expect.objectContaining({
        extractedAt: expect.any(Date),
      }),
    });
  });

  it('should handle sync errors gracefully', async () => {
    prismaMock.dailyReportLabor.upsert.mockRejectedValue(new Error('Database error'));

    const { syncDailyReportFull } = await import('@/lib/daily-report-sync-service');
    const result = await syncDailyReportFull('report-1');

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
