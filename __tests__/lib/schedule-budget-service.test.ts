import { describe, it, expect, beforeEach, vi } from 'vitest';
import { addDays, differenceInDays } from 'date-fns';

// Mock dependencies using vi.hoisted pattern
const mocks = vi.hoisted(() => ({
  prisma: {
    schedule: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    scheduleTask: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
    resourceAllocation: {
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    milestone: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    scheduleForecast: {
      create: vi.fn(),
    },
    projectBudget: {
      findFirst: vi.fn(),
    },
    budgetItem: {
      update: vi.fn(),
      find: vi.fn(),
    },
    scheduleBaseline: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }));

// =============================================
// CRITICAL PATH METHOD (CPM) TESTS
// =============================================

describe('calculateCPM', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate CPM for simple linear schedule', async () => {
    const { calculateCPM } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate,
      endDate: addDays(startDate, 30),
      ScheduleTask: [
        {
          id: 'task-1',
          taskId: 'T1',
          name: 'Foundation',
          startDate,
          endDate: addDays(startDate, 10),
          duration: 10,
          predecessors: [],
          successors: ['T2'],
          status: 'IN_PROGRESS',
          percentComplete: 50,
          budgetedCost: 100000,
          actualCost: 50000,
        },
        {
          id: 'task-2',
          taskId: 'T2',
          name: 'Framing',
          startDate: addDays(startDate, 10),
          endDate: addDays(startDate, 20),
          duration: 10,
          predecessors: ['T1'],
          successors: [],
          status: 'NOT_STARTED',
          percentComplete: 0,
          budgetedCost: 150000,
          actualCost: null,
        },
      ],
    });

    mocks.prisma.scheduleTask.update.mockResolvedValue({});

    const result = await calculateCPM('schedule-1');

    expect(result.criticalPath).toEqual(['T1', 'T2']);
    expect(result.projectDuration).toBe(20);
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0].isCritical).toBe(true);
    expect(result.tasks[1].isCritical).toBe(true);
  });

  it('should return empty result for schedule with no tasks', async () => {
    const { calculateCPM } = await import('@/lib/schedule-budget-service');

    mocks.prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      ScheduleTask: [],
    });

    const result = await calculateCPM('schedule-1');

    expect(result.criticalPath).toEqual([]);
    expect(result.projectDuration).toBe(0);
    expect(result.tasks).toEqual([]);
    expect(result.totalFloat).toBe(0);
  });

  it('should throw error when schedule not found', async () => {
    const { calculateCPM } = await import('@/lib/schedule-budget-service');

    mocks.prisma.schedule.findUnique.mockResolvedValue(null);

    await expect(calculateCPM('invalid-schedule')).rejects.toThrow('Schedule not found');
  });

  it('should calculate early start and early finish correctly', async () => {
    const { calculateCPM } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate,
      endDate: addDays(startDate, 30),
      ScheduleTask: [
        {
          id: 'task-1',
          taskId: 'T1',
          name: 'Task 1',
          startDate,
          endDate: addDays(startDate, 5),
          duration: 5,
          predecessors: [],
          successors: ['T2'],
          status: 'COMPLETED',
          percentComplete: 100,
          budgetedCost: 50000,
          actualCost: 48000,
        },
        {
          id: 'task-2',
          taskId: 'T2',
          name: 'Task 2',
          startDate: addDays(startDate, 5),
          endDate: addDays(startDate, 10),
          duration: 5,
          predecessors: ['T1'],
          successors: [],
          status: 'IN_PROGRESS',
          percentComplete: 60,
          budgetedCost: 75000,
          actualCost: 45000,
        },
      ],
    });

    mocks.prisma.scheduleTask.update.mockResolvedValue({});

    const result = await calculateCPM('schedule-1');

    expect(result.tasks[0].earlyStart).toBe(0);
    expect(result.tasks[0].earlyFinish).toBe(5);
    expect(result.tasks[1].earlyStart).toBe(5);
    expect(result.tasks[1].earlyFinish).toBe(10);
  });

  it('should calculate total float for non-critical tasks', async () => {
    const { calculateCPM } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate,
      endDate: addDays(startDate, 20),
      ScheduleTask: [
        {
          id: 'task-1',
          taskId: 'T1',
          name: 'Critical Path',
          startDate,
          endDate: addDays(startDate, 20),
          duration: 20,
          predecessors: [],
          successors: [],
          status: 'IN_PROGRESS',
          percentComplete: 50,
          budgetedCost: 200000,
          actualCost: 100000,
        },
        {
          id: 'task-2',
          taskId: 'T2',
          name: 'Non-Critical',
          startDate,
          endDate: addDays(startDate, 10),
          duration: 10,
          predecessors: [],
          successors: [],
          status: 'IN_PROGRESS',
          percentComplete: 30,
          budgetedCost: 100000,
          actualCost: 30000,
        },
      ],
    });

    mocks.prisma.scheduleTask.update.mockResolvedValue({});

    const result = await calculateCPM('schedule-1');

    const criticalTask = result.tasks.find(t => t.taskId === 'T1');
    const nonCriticalTask = result.tasks.find(t => t.taskId === 'T2');

    expect(criticalTask?.totalFloat).toBe(0);
    expect(criticalTask?.isCritical).toBe(true);
    expect(nonCriticalTask?.totalFloat).toBeGreaterThan(0);
    expect(nonCriticalTask?.isCritical).toBe(false);
  });

  it('should update tasks in database with critical path information', async () => {
    const { calculateCPM } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate,
      endDate: addDays(startDate, 10),
      ScheduleTask: [
        {
          id: 'task-1',
          taskId: 'T1',
          name: 'Task',
          startDate,
          endDate: addDays(startDate, 10),
          duration: 10,
          predecessors: [],
          successors: [],
          status: 'IN_PROGRESS',
          percentComplete: 50,
          budgetedCost: 100000,
          actualCost: 50000,
        },
      ],
    });

    mocks.prisma.scheduleTask.update.mockResolvedValue({});

    await calculateCPM('schedule-1');

    expect(mocks.prisma.scheduleTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: {
        isCritical: true,
        totalFloat: 0,
      },
    });
  });

  it('should handle tasks with multiple predecessors', async () => {
    const { calculateCPM } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate,
      endDate: addDays(startDate, 30),
      ScheduleTask: [
        {
          id: 'task-1',
          taskId: 'T1',
          name: 'Task 1',
          startDate,
          endDate: addDays(startDate, 10),
          duration: 10,
          predecessors: [],
          successors: ['T3'],
          status: 'COMPLETED',
          percentComplete: 100,
          budgetedCost: 100000,
          actualCost: 95000,
        },
        {
          id: 'task-2',
          taskId: 'T2',
          name: 'Task 2',
          startDate,
          endDate: addDays(startDate, 15),
          duration: 15,
          predecessors: [],
          successors: ['T3'],
          status: 'COMPLETED',
          percentComplete: 100,
          budgetedCost: 150000,
          actualCost: 145000,
        },
        {
          id: 'task-3',
          taskId: 'T3',
          name: 'Task 3',
          startDate: addDays(startDate, 15),
          endDate: addDays(startDate, 25),
          duration: 10,
          predecessors: ['T1', 'T2'],
          successors: [],
          status: 'NOT_STARTED',
          percentComplete: 0,
          budgetedCost: 200000,
          actualCost: null,
        },
      ],
    });

    mocks.prisma.scheduleTask.update.mockResolvedValue({});

    const result = await calculateCPM('schedule-1');

    const task3 = result.tasks.find(t => t.taskId === 'T3');
    expect(task3?.earlyStart).toBe(15); // Max of predecessors' early finish
  });

  it('should calculate free float correctly', async () => {
    const { calculateCPM } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate,
      endDate: addDays(startDate, 20),
      ScheduleTask: [
        {
          id: 'task-1',
          taskId: 'T1',
          name: 'Task 1',
          startDate,
          endDate: addDays(startDate, 10),
          duration: 10,
          predecessors: [],
          successors: ['T2'],
          status: 'IN_PROGRESS',
          percentComplete: 80,
          budgetedCost: 100000,
          actualCost: 80000,
        },
        {
          id: 'task-2',
          taskId: 'T2',
          name: 'Task 2',
          startDate: addDays(startDate, 10),
          endDate: addDays(startDate, 20),
          duration: 10,
          predecessors: ['T1'],
          successors: [],
          status: 'NOT_STARTED',
          percentComplete: 0,
          budgetedCost: 100000,
          actualCost: null,
        },
      ],
    });

    mocks.prisma.scheduleTask.update.mockResolvedValue({});

    const result = await calculateCPM('schedule-1');

    expect(result.tasks[0].freeFloat).toBe(0);
  });

  it('should handle circular dependencies gracefully', async () => {
    const { calculateCPM } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate,
      endDate: addDays(startDate, 10),
      ScheduleTask: [
        {
          id: 'task-1',
          taskId: 'T1',
          name: 'Task 1',
          startDate,
          endDate: addDays(startDate, 5),
          duration: 5,
          predecessors: ['T2'], // Circular
          successors: ['T2'],
          status: 'IN_PROGRESS',
          percentComplete: 50,
          budgetedCost: 50000,
          actualCost: 25000,
        },
        {
          id: 'task-2',
          taskId: 'T2',
          name: 'Task 2',
          startDate: addDays(startDate, 5),
          endDate: addDays(startDate, 10),
          duration: 5,
          predecessors: ['T1'],
          successors: ['T1'], // Circular
          status: 'NOT_STARTED',
          percentComplete: 0,
          budgetedCost: 50000,
          actualCost: null,
        },
      ],
    });

    mocks.prisma.scheduleTask.update.mockResolvedValue({});

    // Should not throw error, handles cycle gracefully
    const result = await calculateCPM('schedule-1');

    expect(result.tasks).toHaveLength(2);
  });
});

// =============================================
// RESOURCE LEVELING TESTS
// =============================================

describe('analyzeResourceAllocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should analyze resource allocation with single resource', async () => {
    const { analyzeResourceAllocation } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.resourceAllocation.findMany.mockResolvedValue([
      {
        id: 'alloc-1',
        projectId: 'project-1',
        resourceType: 'LABOR',
        resourceName: 'Carpenter',
        startDate,
        endDate: addDays(startDate, 5),
        allocatedUnits: 2,
        maxUnits: 5,
        task: {
          id: 'task-1',
          name: 'Framing',
        },
      },
    ]);

    const result = await analyzeResourceAllocation('project-1');

    expect(result).toHaveLength(1);
    expect(result[0].resourceType).toBe('LABOR');
    expect(result[0].resourceName).toBe('Carpenter');
    expect(result[0].totalAllocated).toBe(2);
    expect(result[0].maxCapacity).toBe(5);
    expect(result[0].isOverallocated).toBe(false);
  });

  it('should detect overallocated resources', async () => {
    const { analyzeResourceAllocation } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.resourceAllocation.findMany.mockResolvedValue([
      {
        id: 'alloc-1',
        projectId: 'project-1',
        resourceType: 'EQUIPMENT',
        resourceName: 'Excavator',
        startDate,
        endDate: addDays(startDate, 2),
        allocatedUnits: 3,
        maxUnits: 2,
        task: { id: 'task-1', name: 'Excavation' },
      },
    ]);

    const result = await analyzeResourceAllocation('project-1');

    expect(result[0].isOverallocated).toBe(true);
  });

  it('should aggregate daily allocation across multiple tasks', async () => {
    const { analyzeResourceAllocation } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.resourceAllocation.findMany.mockResolvedValue([
      {
        id: 'alloc-1',
        projectId: 'project-1',
        resourceType: 'LABOR',
        resourceName: 'Electrician',
        startDate,
        endDate: addDays(startDate, 3),
        allocatedUnits: 2,
        maxUnits: 5,
        task: { id: 'task-1', name: 'Rough-in' },
      },
      {
        id: 'alloc-2',
        projectId: 'project-1',
        resourceType: 'LABOR',
        resourceName: 'Electrician',
        startDate: addDays(startDate, 2),
        endDate: addDays(startDate, 5),
        allocatedUnits: 3,
        maxUnits: 5,
        task: { id: 'task-2', name: 'Trim-out' },
      },
    ]);

    const result = await analyzeResourceAllocation('project-1');

    expect(result).toHaveLength(1);
    expect(result[0].periods.length).toBeGreaterThan(0);
  });

  it('should calculate utilization percentage correctly', async () => {
    const { analyzeResourceAllocation } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.resourceAllocation.findMany.mockResolvedValue([
      {
        id: 'alloc-1',
        projectId: 'project-1',
        resourceType: 'LABOR',
        resourceName: 'Plumber',
        startDate,
        endDate: addDays(startDate, 5),
        allocatedUnits: 4,
        maxUnits: 5,
        task: { id: 'task-1', name: 'Plumbing' },
      },
    ]);

    const result = await analyzeResourceAllocation('project-1');

    expect(result[0].utilizationPercent).toBeGreaterThan(0);
    expect(result[0].utilizationPercent).toBeLessThanOrEqual(100);
  });

  it('should return empty array when no allocations exist', async () => {
    const { analyzeResourceAllocation } = await import('@/lib/schedule-budget-service');

    mocks.prisma.resourceAllocation.findMany.mockResolvedValue([]);

    const result = await analyzeResourceAllocation('project-1');

    expect(result).toEqual([]);
  });

  it('should group allocations by resource type and name', async () => {
    const { analyzeResourceAllocation } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.resourceAllocation.findMany.mockResolvedValue([
      {
        id: 'alloc-1',
        projectId: 'project-1',
        resourceType: 'LABOR',
        resourceName: 'Carpenter',
        startDate,
        endDate: addDays(startDate, 3),
        allocatedUnits: 2,
        maxUnits: 5,
        task: { id: 'task-1', name: 'Task 1' },
      },
      {
        id: 'alloc-2',
        projectId: 'project-1',
        resourceType: 'EQUIPMENT',
        resourceName: 'Crane',
        startDate,
        endDate: addDays(startDate, 2),
        allocatedUnits: 1,
        maxUnits: 1,
        task: { id: 'task-2', name: 'Task 2' },
      },
    ]);

    const result = await analyzeResourceAllocation('project-1');

    expect(result).toHaveLength(2);
    expect(result.find(r => r.resourceType === 'LABOR')).toBeDefined();
    expect(result.find(r => r.resourceType === 'EQUIPMENT')).toBeDefined();
  });
});

describe('levelResources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should adjust overallocated resources', async () => {
    const { levelResources } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.resourceAllocation.findMany
      .mockResolvedValueOnce([
        {
          id: 'alloc-1',
          projectId: 'project-1',
          resourceType: 'LABOR',
          resourceName: 'Welder',
          startDate,
          endDate: addDays(startDate, 2),
          allocatedUnits: 6,
          maxUnits: 4,
          task: { id: 'task-1', name: 'Welding', isCritical: false },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'alloc-1',
          projectId: 'project-1',
          resourceType: 'LABOR',
          resourceName: 'Welder',
          startDate,
          endDate: addDays(startDate, 2),
          allocatedUnits: 6,
          maxUnits: 4,
          task: { id: 'task-1', name: 'Welding', isCritical: false },
        },
      ]);

    mocks.prisma.resourceAllocation.update.mockResolvedValue({});

    const result = await levelResources('project-1');

    expect(result.adjusted).toBeGreaterThan(0);
    expect(result.message).toContain('Adjusted');
  });

  it('should return no adjustments when no overallocation', async () => {
    const { levelResources } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.resourceAllocation.findMany.mockResolvedValue([
      {
        id: 'alloc-1',
        projectId: 'project-1',
        resourceType: 'LABOR',
        resourceName: 'Carpenter',
        startDate,
        endDate: addDays(startDate, 5),
        allocatedUnits: 2,
        maxUnits: 5,
        task: { id: 'task-1', name: 'Framing' },
      },
    ]);

    const result = await levelResources('project-1');

    expect(result.adjusted).toBe(0);
    expect(result.message).toBe('No overallocations found');
  });

  it('should prioritize critical tasks when leveling', async () => {
    const { levelResources } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    const criticalAllocation = {
      id: 'alloc-1',
      projectId: 'project-1',
      resourceType: 'LABOR',
      resourceName: 'Mason',
      startDate,
      endDate: addDays(startDate, 3),
      allocatedUnits: 8,
      maxUnits: 5,
      task: { id: 'task-1', name: 'Task', isCritical: true },
    };

    // First call for analyzeResourceAllocation
    mocks.prisma.resourceAllocation.findMany
      .mockResolvedValueOnce([criticalAllocation])
      // Subsequent calls for each overallocated period (3 days = 3 periods)
      .mockResolvedValue([criticalAllocation]);

    mocks.prisma.resourceAllocation.update.mockResolvedValue({});

    const result = await levelResources('project-1');

    // Critical tasks should not be reduced
    expect(mocks.prisma.resourceAllocation.update).not.toHaveBeenCalled();
  });

  it('should reduce non-critical allocations by 25%', async () => {
    const { levelResources } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.resourceAllocation.findMany
      .mockResolvedValueOnce([
        {
          id: 'alloc-1',
          projectId: 'project-1',
          resourceType: 'LABOR',
          resourceName: 'Painter',
          startDate,
          endDate: addDays(startDate, 2),
          allocatedUnits: 4,
          maxUnits: 3,
          task: { id: 'task-1', name: 'Painting', isCritical: false },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'alloc-1',
          projectId: 'project-1',
          resourceType: 'LABOR',
          resourceName: 'Painter',
          startDate,
          endDate: addDays(startDate, 2),
          allocatedUnits: 4,
          maxUnits: 3,
          task: { id: 'task-1', name: 'Painting', isCritical: false },
        },
      ]);

    mocks.prisma.resourceAllocation.update.mockResolvedValue({});

    await levelResources('project-1');

    expect(mocks.prisma.resourceAllocation.update).toHaveBeenCalledWith({
      where: { id: 'alloc-1' },
      data: {
        allocatedUnits: 3, // 4 * 0.75 = 3
        isOverallocated: false,
      },
    });
  });
});

// =============================================
// SCHEDULE FORECASTING TESTS
// =============================================

describe('generateScheduleForecast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate forecast for project on schedule', async () => {
    const { generateScheduleForecast } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');
    const endDate = addDays(startDate, 30);

    mocks.prisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Test Project',
      ownerId: 'user-1',
    });

    mocks.prisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate,
      endDate,
      isActive: true,
      ScheduleTask: [
        {
          id: 'task-1',
          taskId: 'T1',
          name: 'Task 1',
          startDate,
          endDate: addDays(startDate, 15),
          duration: 15,
          percentComplete: 50,
          isCritical: true,
          budgetedCost: 100000,
          actualCost: 48000,
        },
        {
          id: 'task-2',
          taskId: 'T2',
          name: 'Task 2',
          startDate: addDays(startDate, 15),
          endDate: endDate,
          duration: 15,
          percentComplete: 50,
          isCritical: true,
          budgetedCost: 100000,
          actualCost: 50000,
        },
      ],
    });

    mocks.prisma.resourceAllocation.count.mockResolvedValue(0);
    mocks.prisma.scheduleForecast.create.mockResolvedValue({
      id: 'forecast-1',
    });

    const result = await generateScheduleForecast('project-1');

    expect(result.projectedEndDate).toBeDefined();
    expect(result.originalEndDate).toEqual(endDate);
    expect(result.schedulePerformanceIndex).toBeGreaterThan(0);
    expect(result.completionConfidence).toBeGreaterThan(0);
    expect(result.riskLevel).toBeDefined();
  });

  it('should throw error when project not found', async () => {
    const { generateScheduleForecast } = await import('@/lib/schedule-budget-service');

    mocks.prisma.project.findUnique.mockResolvedValue(null);

    await expect(generateScheduleForecast('invalid-project')).rejects.toThrow('Project not found');
  });

  it('should throw error when no active schedule found', async () => {
    const { generateScheduleForecast } = await import('@/lib/schedule-budget-service');

    mocks.prisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Test Project',
    });

    mocks.prisma.schedule.findFirst.mockResolvedValue(null);

    await expect(generateScheduleForecast('project-1')).rejects.toThrow('No active schedule found');
  });

  it('should identify HIGH risk when critical tasks delayed', async () => {
    const { generateScheduleForecast } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');
    const now = new Date('2024-01-20');

    mocks.prisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Test Project',
    });

    mocks.prisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate,
      endDate: addDays(startDate, 30),
      isActive: true,
      ScheduleTask: [
        {
          id: 'task-1',
          taskId: 'T1',
          name: 'Critical Task',
          startDate,
          endDate: new Date('2024-01-10'), // Past due
          duration: 10,
          percentComplete: 30, // Incomplete
          isCritical: true,
          budgetedCost: 100000,
          actualCost: 30000,
        },
      ],
    });

    mocks.prisma.resourceAllocation.count.mockResolvedValue(0);
    mocks.prisma.scheduleForecast.create.mockResolvedValue({
      id: 'forecast-1',
    });

    const result = await generateScheduleForecast('project-1');

    expect(result.riskLevel).toBe('HIGH');
    expect(result.riskFactors.length).toBeGreaterThan(0);
    expect(result.riskFactors.some(f => f.includes('critical'))).toBe(true);
  });

  it('should identify MEDIUM risk when SPI < 0.95', async () => {
    const { generateScheduleForecast } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Test Project',
    });

    mocks.prisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate,
      endDate: addDays(startDate, 30),
      isActive: true,
      ScheduleTask: [
        {
          id: 'task-1',
          taskId: 'T1',
          name: 'Task',
          startDate,
          endDate: addDays(startDate, 30),
          duration: 30,
          percentComplete: 30, // Behind schedule
          isCritical: false,
          budgetedCost: 100000,
          actualCost: 30000,
        },
      ],
    });

    mocks.prisma.resourceAllocation.count.mockResolvedValue(0);
    mocks.prisma.scheduleForecast.create.mockResolvedValue({
      id: 'forecast-1',
    });

    const result = await generateScheduleForecast('project-1');

    expect(['MEDIUM', 'HIGH']).toContain(result.riskLevel);
  });

  it('should suggest recovery actions when variance exists', async () => {
    const { generateScheduleForecast } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Test Project',
    });

    mocks.prisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate,
      endDate: addDays(startDate, 30),
      isActive: true,
      ScheduleTask: [
        {
          id: 'task-1',
          taskId: 'T1',
          name: 'Task',
          startDate,
          endDate: new Date('2024-01-10'),
          duration: 10,
          percentComplete: 20,
          isCritical: true,
          budgetedCost: 100000,
          actualCost: 20000,
        },
      ],
    });

    mocks.prisma.resourceAllocation.count.mockResolvedValue(0);
    mocks.prisma.scheduleForecast.create.mockResolvedValue({
      id: 'forecast-1',
    });

    const result = await generateScheduleForecast('project-1');

    expect(result.recoveryActions.length).toBeGreaterThan(0);
  });

  it('should calculate completion confidence based on risk factors', async () => {
    const { generateScheduleForecast } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Test Project',
    });

    mocks.prisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate,
      endDate: addDays(startDate, 30),
      isActive: true,
      ScheduleTask: [
        {
          id: 'task-1',
          taskId: 'T1',
          name: 'Task',
          startDate,
          endDate: addDays(startDate, 30),
          duration: 30,
          percentComplete: 50,
          isCritical: false,
          budgetedCost: 100000,
          actualCost: 50000,
        },
      ],
    });

    mocks.prisma.resourceAllocation.count.mockResolvedValue(0);
    mocks.prisma.scheduleForecast.create.mockResolvedValue({
      id: 'forecast-1',
    });

    const result = await generateScheduleForecast('project-1');

    expect(result.completionConfidence).toBeGreaterThanOrEqual(20);
    expect(result.completionConfidence).toBeLessThanOrEqual(99);
  });

  it('should use specified schedule ID when provided', async () => {
    const { generateScheduleForecast } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Test Project',
    });

    mocks.prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-specific',
      projectId: 'project-1',
      startDate,
      endDate: addDays(startDate, 30),
      isActive: false,
      ScheduleTask: [
        {
          id: 'task-1',
          taskId: 'T1',
          name: 'Task',
          startDate,
          endDate: addDays(startDate, 30),
          duration: 30,
          percentComplete: 50,
          isCritical: false,
          budgetedCost: 100000,
          actualCost: 50000,
        },
      ],
    });

    mocks.prisma.resourceAllocation.count.mockResolvedValue(0);
    mocks.prisma.scheduleForecast.create.mockResolvedValue({
      id: 'forecast-1',
    });

    await generateScheduleForecast('project-1', 'schedule-specific');

    expect(mocks.prisma.schedule.findUnique).toHaveBeenCalledWith({
      where: { id: 'schedule-specific' },
      include: { ScheduleTask: true },
    });
  });

  it('should detect resource overallocation risk', async () => {
    const { generateScheduleForecast } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Test Project',
    });

    mocks.prisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate,
      endDate: addDays(startDate, 30),
      isActive: true,
      ScheduleTask: [
        {
          id: 'task-1',
          taskId: 'T1',
          name: 'Task',
          startDate,
          endDate: addDays(startDate, 30),
          duration: 30,
          percentComplete: 50,
          isCritical: false,
          budgetedCost: 100000,
          actualCost: 50000,
        },
      ],
    });

    mocks.prisma.resourceAllocation.count.mockResolvedValue(5);
    mocks.prisma.scheduleForecast.create.mockResolvedValue({
      id: 'forecast-1',
    });

    const result = await generateScheduleForecast('project-1');

    expect(result.riskFactors.some(f => f.includes('overallocated'))).toBe(true);
  });

  it('should save forecast to database', async () => {
    const { generateScheduleForecast } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Test Project',
    });

    mocks.prisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate,
      endDate: addDays(startDate, 30),
      isActive: true,
      ScheduleTask: [
        {
          id: 'task-1',
          taskId: 'T1',
          name: 'Task',
          startDate,
          endDate: addDays(startDate, 30),
          duration: 30,
          percentComplete: 50,
          isCritical: false,
          budgetedCost: 100000,
          actualCost: 50000,
        },
      ],
    });

    mocks.prisma.resourceAllocation.count.mockResolvedValue(0);
    mocks.prisma.scheduleForecast.create.mockResolvedValue({
      id: 'forecast-1',
    });

    await generateScheduleForecast('project-1');

    expect(mocks.prisma.scheduleForecast.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'project-1',
        scheduleId: 'schedule-1',
        forecastMethod: 'TRENDING',
      }),
    });
  });
});

// =============================================
// MILESTONE MANAGEMENT TESTS
// =============================================

describe('updateMilestoneStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update milestone to COMPLETED when actual date exists', async () => {
    const { updateMilestoneStatus } = await import('@/lib/schedule-budget-service');

    mocks.prisma.milestone.findMany.mockResolvedValue([
      {
        id: 'milestone-1',
        projectId: 'project-1',
        name: 'Foundation Complete',
        plannedDate: new Date('2024-01-15'),
        forecastDate: null,
        actualDate: new Date('2024-01-14'),
        status: 'IN_PROGRESS',
        linkedTaskIds: [],
        isCritical: true,
      },
    ]);

    mocks.prisma.milestone.update.mockResolvedValue({});

    const updated = await updateMilestoneStatus('project-1');

    expect(updated).toBe(1);
    expect(mocks.prisma.milestone.update).toHaveBeenCalledWith({
      where: { id: 'milestone-1' },
      data: { status: 'COMPLETED' },
    });
  });

  it('should update milestone to MISSED when more than 7 days past due', async () => {
    const { updateMilestoneStatus } = await import('@/lib/schedule-budget-service');

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);

    mocks.prisma.milestone.findMany.mockResolvedValue([
      {
        id: 'milestone-1',
        projectId: 'project-1',
        name: 'Late Milestone',
        plannedDate: pastDate,
        forecastDate: null,
        actualDate: null,
        status: 'IN_PROGRESS',
        linkedTaskIds: [],
        isCritical: true,
      },
    ]);

    mocks.prisma.milestone.update.mockResolvedValue({});

    const updated = await updateMilestoneStatus('project-1');

    expect(updated).toBe(1);
    expect(mocks.prisma.milestone.update).toHaveBeenCalledWith({
      where: { id: 'milestone-1' },
      data: { status: 'MISSED' },
    });
  });

  it('should update milestone to DELAYED when less than 7 days past due', async () => {
    const { updateMilestoneStatus } = await import('@/lib/schedule-budget-service');

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);

    mocks.prisma.milestone.findMany.mockResolvedValue([
      {
        id: 'milestone-1',
        projectId: 'project-1',
        name: 'Delayed Milestone',
        plannedDate: pastDate,
        forecastDate: null,
        actualDate: null,
        status: 'UPCOMING',
        linkedTaskIds: [],
        isCritical: true,
      },
    ]);

    mocks.prisma.milestone.update.mockResolvedValue({});

    const updated = await updateMilestoneStatus('project-1');

    expect(updated).toBe(1);
    expect(mocks.prisma.milestone.update).toHaveBeenCalledWith({
      where: { id: 'milestone-1' },
      data: { status: 'DELAYED' },
    });
  });

  it('should update milestone to AT_RISK when linked tasks delayed', async () => {
    const { updateMilestoneStatus } = await import('@/lib/schedule-budget-service');

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);

    mocks.prisma.milestone.findMany.mockResolvedValue([
      {
        id: 'milestone-1',
        projectId: 'project-1',
        name: 'Upcoming Milestone',
        plannedDate: futureDate,
        forecastDate: null,
        actualDate: null,
        status: 'UPCOMING',
        linkedTaskIds: ['task-1'],
        isCritical: true,
      },
    ]);

    mocks.prisma.scheduleTask.findMany.mockResolvedValue([
      {
        id: 'task-1',
        taskId: 'task-1',
        name: 'Task',
        endDate: pastDate,
        percentComplete: 50,
      },
    ]);

    mocks.prisma.milestone.update.mockResolvedValue({});

    const updated = await updateMilestoneStatus('project-1');

    expect(updated).toBe(1);
    expect(mocks.prisma.milestone.update).toHaveBeenCalledWith({
      where: { id: 'milestone-1' },
      data: { status: 'AT_RISK' },
    });
  });

  it('should update milestone to IN_PROGRESS when within 14 days', async () => {
    const { updateMilestoneStatus } = await import('@/lib/schedule-budget-service');

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    mocks.prisma.milestone.findMany.mockResolvedValue([
      {
        id: 'milestone-1',
        projectId: 'project-1',
        name: 'Upcoming Milestone',
        plannedDate: futureDate,
        forecastDate: null,
        actualDate: null,
        status: 'UPCOMING',
        linkedTaskIds: [],
        isCritical: false,
      },
    ]);

    mocks.prisma.milestone.update.mockResolvedValue({});

    const updated = await updateMilestoneStatus('project-1');

    expect(updated).toBe(1);
    expect(mocks.prisma.milestone.update).toHaveBeenCalledWith({
      where: { id: 'milestone-1' },
      data: { status: 'IN_PROGRESS' },
    });
  });

  it('should keep milestone UPCOMING when more than 14 days away', async () => {
    const { updateMilestoneStatus } = await import('@/lib/schedule-budget-service');

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    mocks.prisma.milestone.findMany.mockResolvedValue([
      {
        id: 'milestone-1',
        projectId: 'project-1',
        name: 'Future Milestone',
        plannedDate: futureDate,
        forecastDate: null,
        actualDate: null,
        status: 'UPCOMING',
        linkedTaskIds: [],
        isCritical: false,
      },
    ]);

    mocks.prisma.milestone.update.mockResolvedValue({});

    const updated = await updateMilestoneStatus('project-1');

    expect(updated).toBe(0);
  });

  it('should return 0 when no milestones to update', async () => {
    const { updateMilestoneStatus } = await import('@/lib/schedule-budget-service');

    mocks.prisma.milestone.findMany.mockResolvedValue([]);

    const updated = await updateMilestoneStatus('project-1');

    expect(updated).toBe(0);
  });
});

describe('getMilestoneTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return milestones and timeline', async () => {
    const { getMilestoneTimeline } = await import('@/lib/schedule-budget-service');

    const plannedDate = new Date('2024-01-15');

    mocks.prisma.milestone.findMany.mockResolvedValue([
      {
        id: 'milestone-1',
        projectId: 'project-1',
        name: 'Foundation Complete',
        category: 'CONSTRUCTION',
        plannedDate,
        forecastDate: null,
        actualDate: null,
        status: 'UPCOMING',
        isCritical: true,
      },
    ]);

    mocks.prisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
    });

    const result = await getMilestoneTimeline('project-1');

    expect(result.milestones).toHaveLength(1);
    expect(result.timeline).toHaveLength(1);
    expect(result.timeline[0].type).toBe('milestone');
    expect(result.timeline[0].varianceDays).toBe(0);
  });

  it('should calculate variance with forecast date', async () => {
    const { getMilestoneTimeline } = await import('@/lib/schedule-budget-service');

    const plannedDate = new Date('2024-01-15');
    const forecastDate = new Date('2024-01-20');

    mocks.prisma.milestone.findMany.mockResolvedValue([
      {
        id: 'milestone-1',
        projectId: 'project-1',
        name: 'Milestone',
        category: 'CONSTRUCTION',
        plannedDate,
        forecastDate,
        actualDate: null,
        status: 'AT_RISK',
        isCritical: true,
      },
    ]);

    mocks.prisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
    });

    const result = await getMilestoneTimeline('project-1');

    expect(result.timeline[0].varianceDays).toBe(5);
  });

  it('should calculate variance with actual date', async () => {
    const { getMilestoneTimeline } = await import('@/lib/schedule-budget-service');

    const plannedDate = new Date('2024-01-15');
    const actualDate = new Date('2024-01-12');

    mocks.prisma.milestone.findMany.mockResolvedValue([
      {
        id: 'milestone-1',
        projectId: 'project-1',
        name: 'Milestone',
        category: 'CONSTRUCTION',
        plannedDate,
        forecastDate: null,
        actualDate,
        status: 'COMPLETED',
        isCritical: true,
      },
    ]);

    mocks.prisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
    });

    const result = await getMilestoneTimeline('project-1');

    expect(result.timeline[0].varianceDays).toBe(-3);
  });

  it('should return empty timeline when no schedule exists', async () => {
    const { getMilestoneTimeline } = await import('@/lib/schedule-budget-service');

    mocks.prisma.milestone.findMany.mockResolvedValue([
      {
        id: 'milestone-1',
        projectId: 'project-1',
        name: 'Milestone',
        category: 'CONSTRUCTION',
        plannedDate: new Date('2024-01-15'),
        forecastDate: null,
        actualDate: null,
        status: 'UPCOMING',
        isCritical: true,
      },
    ]);

    mocks.prisma.schedule.findFirst.mockResolvedValue(null);

    const result = await getMilestoneTimeline('project-1');

    expect(result.milestones).toHaveLength(1);
    expect(result.timeline).toEqual([]);
  });
});

// =============================================
// SCHEDULE-BUDGET INTEGRATION TESTS
// =============================================

describe('linkTasksToBudget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should link tasks to budget items by taskId', async () => {
    const { linkTasksToBudget } = await import('@/lib/schedule-budget-service');

    mocks.prisma.scheduleTask.findMany.mockResolvedValue([
      {
        id: 'task-1',
        taskId: 'T1',
        name: 'Foundation Work',
        budgetedCost: 100000,
        tradeType: 'CONCRETE',
        Schedule: { projectId: 'project-1' },
      },
    ]);

    mocks.prisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      BudgetItem: [
        {
          id: 'item-1',
          name: 'Foundation',
          tradeType: 'CONCRETE',
          linkedTaskIds: ['T1'],
        },
      ],
    });

    const result = await linkTasksToBudget('project-1');

    expect(result.linked).toBe(0); // Already linked
  });

  it('should link tasks by trade type when not already linked', async () => {
    const { linkTasksToBudget } = await import('@/lib/schedule-budget-service');

    mocks.prisma.scheduleTask.findMany.mockResolvedValue([
      {
        id: 'task-1',
        taskId: 'T1',
        name: 'Electrical Work',
        budgetedCost: 75000,
        tradeType: 'ELECTRICAL',
        Schedule: { projectId: 'project-1' },
      },
    ]);

    mocks.prisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      BudgetItem: [
        {
          id: 'item-1',
          name: 'Electrical',
          tradeType: 'ELECTRICAL',
          linkedTaskIds: [],
        },
      ],
    });

    mocks.prisma.budgetItem.update.mockResolvedValue({});

    const result = await linkTasksToBudget('project-1');

    expect(result.linked).toBe(1);
    expect(mocks.prisma.budgetItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { linkedTaskIds: ['T1'] },
    });
  });

  it('should link tasks by name matching when trade type does not match', async () => {
    const { linkTasksToBudget } = await import('@/lib/schedule-budget-service');

    mocks.prisma.scheduleTask.findMany.mockResolvedValue([
      {
        id: 'task-1',
        taskId: 'T1',
        name: 'Framing Work',
        budgetedCost: 150000,
        tradeType: null,
        Schedule: { projectId: 'project-1' },
      },
    ]);

    mocks.prisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      BudgetItem: [
        {
          id: 'item-1',
          name: 'Framing',
          tradeType: 'CARPENTRY',
          linkedTaskIds: [],
        },
      ],
    });

    mocks.prisma.budgetItem.update.mockResolvedValue({});

    const result = await linkTasksToBudget('project-1');

    expect(result.linked).toBe(1);
  });

  it('should return 0 linked when no budget exists', async () => {
    const { linkTasksToBudget } = await import('@/lib/schedule-budget-service');

    mocks.prisma.scheduleTask.findMany.mockResolvedValue([
      {
        id: 'task-1',
        taskId: 'T1',
        name: 'Task',
        budgetedCost: 100000,
        tradeType: 'CONCRETE',
        Schedule: { projectId: 'project-1' },
      },
    ]);

    mocks.prisma.projectBudget.findFirst.mockResolvedValue(null);

    const result = await linkTasksToBudget('project-1');

    expect(result.linked).toBe(0);
  });

  it('should return 0 linked when no tasks with budgeted costs', async () => {
    const { linkTasksToBudget } = await import('@/lib/schedule-budget-service');

    mocks.prisma.scheduleTask.findMany.mockResolvedValue([]);

    const result = await linkTasksToBudget('project-1');

    expect(result.linked).toBe(0);
  });
});

describe('calculateScheduleDrivenCosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate planned spend based on task progress', async () => {
    const { calculateScheduleDrivenCosts } = await import('@/lib/schedule-budget-service');

    mocks.prisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      BudgetItem: [
        {
          id: 'item-1',
          name: 'Foundation',
          budgetedAmount: 100000,
          actualCost: 45000,
          linkedTaskIds: ['T1'],
        },
      ],
    });

    mocks.prisma.scheduleTask.findMany.mockResolvedValue([
      {
        id: 'task-1',
        taskId: 'T1',
        name: 'Foundation Work',
        percentComplete: 50,
      },
    ]);

    const result = await calculateScheduleDrivenCosts('project-1');

    expect(result.items).toHaveLength(1);
    // @ts-expect-error strictNullChecks migration
    expect(result.items[0].plannedSpend).toBe(50000); // 50% of 100k
    // @ts-expect-error strictNullChecks migration
    expect(result.items[0].variance).toBe(5000); // 50k - 45k
    expect(result.totalPlanned).toBe(50000);
    expect(result.totalActual).toBe(45000);
  });

  it('should return empty when no budget exists', async () => {
    const { calculateScheduleDrivenCosts } = await import('@/lib/schedule-budget-service');

    mocks.prisma.projectBudget.findFirst.mockResolvedValue(null);

    const result = await calculateScheduleDrivenCosts('project-1');

    expect(result.items).toEqual([]);
    expect(result.totalPlanned).toBe(0);
    expect(result.totalActual).toBe(0);
  });

  it('should average progress across multiple linked tasks', async () => {
    const { calculateScheduleDrivenCosts } = await import('@/lib/schedule-budget-service');

    mocks.prisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      BudgetItem: [
        {
          id: 'item-1',
          name: 'Electrical',
          budgetedAmount: 200000,
          actualCost: 80000,
          linkedTaskIds: ['T1', 'T2'],
        },
      ],
    });

    mocks.prisma.scheduleTask.findMany.mockResolvedValue([
      {
        id: 'task-1',
        taskId: 'T1',
        name: 'Rough-in',
        percentComplete: 100,
      },
      {
        id: 'task-2',
        taskId: 'T2',
        name: 'Trim-out',
        percentComplete: 50,
      },
    ]);

    const result = await calculateScheduleDrivenCosts('project-1');

    // @ts-expect-error strictNullChecks migration
    expect(result.items[0].avgTaskProgress).toBe(75); // (100 + 50) / 2
    // @ts-expect-error strictNullChecks migration
    expect(result.items[0].plannedSpend).toBe(150000); // 75% of 200k
  });

  it('should handle budget items with no linked tasks', async () => {
    const { calculateScheduleDrivenCosts } = await import('@/lib/schedule-budget-service');

    mocks.prisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      BudgetItem: [],
    });

    const result = await calculateScheduleDrivenCosts('project-1');

    expect(result.items).toEqual([]);
  });
});

// =============================================
// BASELINE MANAGEMENT TESTS
// =============================================

describe('createScheduleBaseline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create new baseline with snapshot', async () => {
    const { createScheduleBaseline } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    mocks.prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate,
      endDate,
      ScheduleTask: [
        {
          id: 'task-1',
          taskId: 'T1',
          name: 'Task 1',
          startDate,
          endDate: addDays(startDate, 10),
          duration: 10,
          percentComplete: 0,
          isCritical: true,
          totalFloat: 0,
          predecessors: [],
          budgetedCost: 100000,
        },
      ],
    });

    mocks.prisma.scheduleBaseline.findFirst.mockResolvedValue(null);
    mocks.prisma.scheduleBaseline.updateMany.mockResolvedValue({ count: 0 });
    mocks.prisma.scheduleBaseline.create.mockResolvedValue({
      id: 'baseline-1',
      baselineNumber: 1,
    });

    const result = await createScheduleBaseline('schedule-1', 'Baseline 1', 'user-1');

    expect(result.baselineNumber).toBe(1);
    expect(mocks.prisma.scheduleBaseline.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scheduleId: 'schedule-1',
        name: 'Baseline 1',
        baselineNumber: 1,
        isActive: true,
        createdBy: 'user-1',
      }),
    });
  });

  it('should throw error when schedule not found', async () => {
    const { createScheduleBaseline } = await import('@/lib/schedule-budget-service');

    mocks.prisma.schedule.findUnique.mockResolvedValue(null);

    await expect(
      createScheduleBaseline('invalid-schedule', 'Baseline', 'user-1')
    ).rejects.toThrow('Schedule not found');
  });

  it('should increment baseline number correctly', async () => {
    const { createScheduleBaseline } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate,
      endDate: addDays(startDate, 30),
      ScheduleTask: [],
    });

    mocks.prisma.scheduleBaseline.findFirst.mockResolvedValue({
      id: 'baseline-1',
      baselineNumber: 2,
    });

    mocks.prisma.scheduleBaseline.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.scheduleBaseline.create.mockResolvedValue({
      id: 'baseline-2',
      baselineNumber: 3,
    });

    const result = await createScheduleBaseline('schedule-1', 'Baseline 3', 'user-1');

    expect(result.baselineNumber).toBe(3);
  });

  it('should deactivate previous baselines', async () => {
    const { createScheduleBaseline } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate,
      endDate: addDays(startDate, 30),
      ScheduleTask: [],
    });

    mocks.prisma.scheduleBaseline.findFirst.mockResolvedValue(null);
    mocks.prisma.scheduleBaseline.updateMany.mockResolvedValue({ count: 2 });
    mocks.prisma.scheduleBaseline.create.mockResolvedValue({
      id: 'baseline-1',
      baselineNumber: 1,
    });

    await createScheduleBaseline('schedule-1', 'Baseline', 'user-1');

    expect(mocks.prisma.scheduleBaseline.updateMany).toHaveBeenCalledWith({
      where: { scheduleId: 'schedule-1' },
      data: { isActive: false },
    });
  });

  it('should include description when provided', async () => {
    const { createScheduleBaseline } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate,
      endDate: addDays(startDate, 30),
      ScheduleTask: [],
    });

    mocks.prisma.scheduleBaseline.findFirst.mockResolvedValue(null);
    mocks.prisma.scheduleBaseline.updateMany.mockResolvedValue({ count: 0 });
    mocks.prisma.scheduleBaseline.create.mockResolvedValue({
      id: 'baseline-1',
      baselineNumber: 1,
    });

    await createScheduleBaseline('schedule-1', 'Baseline', 'user-1', 'Test description');

    expect(mocks.prisma.scheduleBaseline.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: 'Test description',
      }),
    });
  });

  it('should calculate critical path days correctly', async () => {
    const { createScheduleBaseline } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate,
      endDate: addDays(startDate, 30),
      ScheduleTask: [
        {
          id: 'task-1',
          taskId: 'T1',
          name: 'Critical Task 1',
          startDate,
          endDate: addDays(startDate, 10),
          duration: 10,
          percentComplete: 0,
          isCritical: true,
          totalFloat: 0,
          predecessors: [],
          budgetedCost: 100000,
        },
        {
          id: 'task-2',
          taskId: 'T2',
          name: 'Critical Task 2',
          startDate: addDays(startDate, 10),
          endDate: addDays(startDate, 25),
          duration: 15,
          percentComplete: 0,
          isCritical: true,
          totalFloat: 0,
          predecessors: ['T1'],
          budgetedCost: 150000,
        },
      ],
    });

    mocks.prisma.scheduleBaseline.findFirst.mockResolvedValue(null);
    mocks.prisma.scheduleBaseline.updateMany.mockResolvedValue({ count: 0 });
    mocks.prisma.scheduleBaseline.create.mockResolvedValue({
      id: 'baseline-1',
      baselineNumber: 1,
    });

    await createScheduleBaseline('schedule-1', 'Baseline', 'user-1');

    expect(mocks.prisma.scheduleBaseline.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        criticalPathDays: 25, // 10 + 15
      }),
    });
  });
});

describe('compareToBaseline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should compare current schedule to active baseline', async () => {
    const { compareToBaseline } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate,
      endDate: addDays(startDate, 32),
      ScheduleTask: [
        {
          id: 'task-1',
          taskId: 'T1',
          name: 'Task 1',
          startDate,
          endDate: addDays(startDate, 12),
          duration: 12,
        },
      ],
    });

    mocks.prisma.scheduleBaseline.findFirst.mockResolvedValue({
      id: 'baseline-1',
      name: 'Baseline 1',
      baselineNumber: 1,
      capturedAt: new Date('2024-01-01'),
      isActive: true,
      taskSnapshot: [
        {
          taskId: 'T1',
          name: 'Task 1',
          startDate: startDate.toISOString(),
          endDate: addDays(startDate, 10).toISOString(),
          duration: 10,
          percentComplete: 0,
          isCritical: true,
          predecessors: [],
          budgetedCost: 100000,
        },
      ],
    });

    const result = await compareToBaseline('schedule-1');

    expect(result.hasBaseline).toBe(true);
    expect(result.comparison?.tracked).toHaveLength(1);
    expect(result.comparison?.tracked[0].durationVariance).toBe(2); // 12 - 10
  });

  it('should return hasBaseline false when no baseline exists', async () => {
    const { compareToBaseline } = await import('@/lib/schedule-budget-service');

    mocks.prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      ScheduleTask: [],
    });

    mocks.prisma.scheduleBaseline.findFirst.mockResolvedValue(null);

    const result = await compareToBaseline('schedule-1');

    expect(result.hasBaseline).toBe(false);
    expect(result.comparison).toBeNull();
  });

  it('should throw error when schedule not found', async () => {
    const { compareToBaseline } = await import('@/lib/schedule-budget-service');

    mocks.prisma.schedule.findUnique.mockResolvedValue(null);

    await expect(compareToBaseline('invalid-schedule')).rejects.toThrow('Schedule not found');
  });

  it('should identify new tasks not in baseline', async () => {
    const { compareToBaseline } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate,
      endDate: addDays(startDate, 30),
      ScheduleTask: [
        {
          id: 'task-1',
          taskId: 'T1',
          name: 'Existing Task',
          startDate,
          endDate: addDays(startDate, 10),
          duration: 10,
        },
        {
          id: 'task-2',
          taskId: 'T2',
          name: 'New Task',
          startDate: addDays(startDate, 10),
          endDate: addDays(startDate, 20),
          duration: 10,
        },
      ],
    });

    mocks.prisma.scheduleBaseline.findFirst.mockResolvedValue({
      id: 'baseline-1',
      name: 'Baseline',
      baselineNumber: 1,
      capturedAt: new Date('2024-01-01'),
      isActive: true,
      taskSnapshot: [
        {
          taskId: 'T1',
          name: 'Existing Task',
          startDate: startDate.toISOString(),
          endDate: addDays(startDate, 10).toISOString(),
          duration: 10,
          percentComplete: 0,
          isCritical: false,
          predecessors: [],
          budgetedCost: 50000,
        },
      ],
    });

    const result = await compareToBaseline('schedule-1');

    expect(result.comparison?.newTasks).toHaveLength(1);
    expect(result.comparison?.newTasks[0].taskId).toBe('T2');
    expect(result.comparison?.summary.newTasks).toBe(1);
  });

  it('should identify deleted tasks from baseline', async () => {
    const { compareToBaseline } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate,
      endDate: addDays(startDate, 30),
      ScheduleTask: [],
    });

    mocks.prisma.scheduleBaseline.findFirst.mockResolvedValue({
      id: 'baseline-1',
      name: 'Baseline',
      baselineNumber: 1,
      capturedAt: new Date('2024-01-01'),
      isActive: true,
      taskSnapshot: [
        {
          taskId: 'T1',
          name: 'Deleted Task',
          startDate: startDate.toISOString(),
          endDate: addDays(startDate, 10).toISOString(),
          duration: 10,
          percentComplete: 0,
          isCritical: false,
          predecessors: [],
          budgetedCost: 50000,
        },
      ],
    });

    const result = await compareToBaseline('schedule-1');

    expect(result.comparison?.deletedTasks).toHaveLength(1);
    expect(result.comparison?.deletedTasks[0].taskId).toBe('T1');
    expect(result.comparison?.summary.deletedTasks).toBe(1);
  });

  it('should calculate summary statistics correctly', async () => {
    const { compareToBaseline } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate,
      endDate: addDays(startDate, 30),
      ScheduleTask: [
        {
          id: 'task-1',
          taskId: 'T1',
          name: 'Ahead Task',
          startDate,
          endDate: addDays(startDate, 8),
          duration: 8,
        },
        {
          id: 'task-2',
          taskId: 'T2',
          name: 'Behind Task',
          startDate: addDays(startDate, 10),
          endDate: addDays(startDate, 22),
          duration: 12,
        },
      ],
    });

    mocks.prisma.scheduleBaseline.findFirst.mockResolvedValue({
      id: 'baseline-1',
      name: 'Baseline',
      baselineNumber: 1,
      capturedAt: new Date('2024-01-01'),
      isActive: true,
      taskSnapshot: [
        {
          taskId: 'T1',
          name: 'Ahead Task',
          startDate: startDate.toISOString(),
          endDate: addDays(startDate, 10).toISOString(),
          duration: 10,
          percentComplete: 0,
          isCritical: false,
          predecessors: [],
          budgetedCost: 50000,
        },
        {
          taskId: 'T2',
          name: 'Behind Task',
          startDate: addDays(startDate, 10).toISOString(),
          endDate: addDays(startDate, 20).toISOString(),
          duration: 10,
          percentComplete: 0,
          isCritical: false,
          predecessors: [],
          budgetedCost: 50000,
        },
      ],
    });

    const result = await compareToBaseline('schedule-1');

    expect(result.comparison?.summary.tasksAhead).toBe(1);
    expect(result.comparison?.summary.tasksBehind).toBe(1);
    expect(result.comparison?.summary.totalTasks).toBe(2);
  });

  it('should use specified baseline when baselineId provided', async () => {
    const { compareToBaseline } = await import('@/lib/schedule-budget-service');

    const startDate = new Date('2024-01-01');

    mocks.prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      startDate,
      endDate: addDays(startDate, 30),
      ScheduleTask: [],
    });

    mocks.prisma.scheduleBaseline.findUnique.mockResolvedValue({
      id: 'baseline-specific',
      name: 'Specific Baseline',
      baselineNumber: 2,
      capturedAt: new Date('2024-01-01'),
      isActive: false,
      taskSnapshot: [],
    });

    const result = await compareToBaseline('schedule-1', 'baseline-specific');

    expect(mocks.prisma.scheduleBaseline.findUnique).toHaveBeenCalledWith({
      where: { id: 'baseline-specific' },
    });
    expect(result.baseline?.id).toBe('baseline-specific');
  });
});
