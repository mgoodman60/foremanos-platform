import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Prisma BEFORE importing the module
const mockPrisma = vi.hoisted(() => ({
  schedule: {
    findFirst: vi.fn(),
  },
  scheduleTask: {
    update: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  dailyReport: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

describe('Schedule Actuals Service - extractActualsFromDailyReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract actual start date for task mentioned in work performed', async () => {
    const { extractActualsFromDailyReport } = await import('@/lib/schedule-actuals-service');

    const reportDate = new Date('2024-01-15');

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      ScheduleTask: [
        {
          id: 'task-1',
          name: 'Foundation Work',
          tradeType: 'concrete',
          actualStartDate: null,
          actualEndDate: null,
          status: 'not_started',
        },
      ],
    });

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    const result = await extractActualsFromDailyReport(
      'project-1',
      reportDate,
      'Started foundation work today',
      []
    );

    expect(result.updatedTasks).toContain('Foundation Work');
    expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: {
        actualStartDate: reportDate,
        status: 'in_progress',
      },
    });
  });

  it('should extract actual end date for completed task', async () => {
    const { extractActualsFromDailyReport } = await import('@/lib/schedule-actuals-service');

    const reportDate = new Date('2024-01-20');

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      ScheduleTask: [
        {
          id: 'task-1',
          name: 'Framing',
          tradeType: 'carpentry',
          actualStartDate: new Date('2024-01-10'),
          actualEndDate: null,
          status: 'in_progress',
        },
      ],
    });

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    const result = await extractActualsFromDailyReport(
      'project-1',
      reportDate,
      'Completed framing work today. Final inspection passed.',
      []
    );

    expect(result.updatedTasks).toContain('Framing');
    expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: {
        actualEndDate: reportDate,
        percentComplete: 100,
        status: 'completed',
      },
    });
  });

  it('should match task by trade type in labor entries', async () => {
    const { extractActualsFromDailyReport } = await import('@/lib/schedule-actuals-service');

    const reportDate = new Date('2024-01-15');

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      ScheduleTask: [
        {
          id: 'task-1',
          name: 'Electrical Rough-In',
          tradeType: 'electrical',
          actualStartDate: null,
          actualEndDate: null,
          status: 'not_started',
        },
      ],
    });

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    const result = await extractActualsFromDailyReport(
      'project-1',
      reportDate,
      'General work performed',
      [
        { tradeName: 'Electrician', description: 'electrical work - installed conduit and boxes' },
      ]
    );

    expect(result.updatedTasks).toContain('Electrical Rough-In');
    expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: {
        actualStartDate: reportDate,
        status: 'in_progress',
      },
    });
  });

  it('should match task by task name words in work description', async () => {
    const { extractActualsFromDailyReport } = await import('@/lib/schedule-actuals-service');

    const reportDate = new Date('2024-01-15');

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      ScheduleTask: [
        {
          id: 'task-1',
          name: 'Install HVAC Ductwork',
          tradeType: null,
          actualStartDate: null,
          actualEndDate: null,
          status: 'not_started',
        },
      ],
    });

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    const result = await extractActualsFromDailyReport(
      'project-1',
      reportDate,
      'Began ductwork installation in building A',
      []
    );

    expect(result.updatedTasks).toContain('Install HVAC Ductwork');
  });

  it('should not set actual start date if already set', async () => {
    const { extractActualsFromDailyReport } = await import('@/lib/schedule-actuals-service');

    const reportDate = new Date('2024-01-20');
    const existingStartDate = new Date('2024-01-10');

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      ScheduleTask: [
        {
          id: 'task-1',
          name: 'Plumbing Rough-In',
          tradeType: 'plumbing',
          actualStartDate: existingStartDate,
          actualEndDate: null,
          status: 'in_progress',
        },
      ],
    });

    const result = await extractActualsFromDailyReport(
      'project-1',
      reportDate,
      'Continued plumbing work',
      []
    );

    // Should not update since actualStartDate is already set
    expect(mockPrisma.scheduleTask.update).not.toHaveBeenCalled();
    expect(result.updatedTasks).toEqual([]);
  });

  it('should not set actual end date if already set', async () => {
    const { extractActualsFromDailyReport } = await import('@/lib/schedule-actuals-service');

    const reportDate = new Date('2024-01-25');
    const existingEndDate = new Date('2024-01-20');

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      ScheduleTask: [
        {
          id: 'task-1',
          name: 'Drywall Installation',
          tradeType: 'drywall',
          actualStartDate: new Date('2024-01-15'),
          actualEndDate: existingEndDate,
          status: 'completed',
        },
      ],
    });

    const result = await extractActualsFromDailyReport(
      'project-1',
      reportDate,
      'Completed drywall installation',
      []
    );

    expect(mockPrisma.scheduleTask.update).not.toHaveBeenCalled();
    expect(result.updatedTasks).toEqual([]);
  });

  it('should detect completion with "100%" indicator', async () => {
    const { extractActualsFromDailyReport } = await import('@/lib/schedule-actuals-service');

    const reportDate = new Date('2024-01-20');

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      ScheduleTask: [
        {
          id: 'task-1',
          name: 'Concrete Pour',
          tradeType: 'concrete',
          actualStartDate: new Date('2024-01-18'),
          actualEndDate: null,
          status: 'in_progress',
        },
      ],
    });

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    const result = await extractActualsFromDailyReport(
      'project-1',
      reportDate,
      'Concrete pour is now 100% complete',
      []
    );

    expect(result.updatedTasks).toContain('Concrete Pour');
    expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: {
        actualEndDate: reportDate,
        percentComplete: 100,
        status: 'completed',
      },
    });
  });

  it('should detect completion with "finished" indicator', async () => {
    const { extractActualsFromDailyReport } = await import('@/lib/schedule-actuals-service');

    const reportDate = new Date('2024-01-20');

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      ScheduleTask: [
        {
          id: 'task-1',
          name: 'Painting',
          tradeType: 'painting',
          actualStartDate: new Date('2024-01-15'),
          actualEndDate: null,
          status: 'in_progress',
        },
      ],
    });

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    const result = await extractActualsFromDailyReport(
      'project-1',
      reportDate,
      'Finished painting in all rooms',
      []
    );

    expect(result.updatedTasks).toContain('Painting');
    expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: {
        actualEndDate: reportDate,
        percentComplete: 100,
        status: 'completed',
      },
    });
  });

  it('should detect completion with "signed off" indicator', async () => {
    const { extractActualsFromDailyReport } = await import('@/lib/schedule-actuals-service');

    const reportDate = new Date('2024-01-20');

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      ScheduleTask: [
        {
          id: 'task-1',
          name: 'Fire Alarm System',
          tradeType: 'fire_protection',
          actualStartDate: new Date('2024-01-10'),
          actualEndDate: null,
          status: 'in_progress',
        },
      ],
    });

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    const result = await extractActualsFromDailyReport(
      'project-1',
      reportDate,
      'Fire alarm system signed off by inspector',
      []
    );

    expect(result.updatedTasks).toContain('Fire Alarm System');
    expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: {
        actualEndDate: reportDate,
        percentComplete: 100,
        status: 'completed',
      },
    });
  });

  it('should return empty array when no schedule exists', async () => {
    const { extractActualsFromDailyReport } = await import('@/lib/schedule-actuals-service');

    mockPrisma.schedule.findFirst.mockResolvedValue(null);

    const result = await extractActualsFromDailyReport(
      'project-1',
      new Date(),
      'Some work performed',
      []
    );

    expect(result.updatedTasks).toEqual([]);
    expect(mockPrisma.scheduleTask.update).not.toHaveBeenCalled();
  });

  it('should return empty array when schedule has no tasks', async () => {
    const { extractActualsFromDailyReport } = await import('@/lib/schedule-actuals-service');

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      ScheduleTask: [],
    });

    const result = await extractActualsFromDailyReport(
      'project-1',
      new Date(),
      'Some work performed',
      []
    );

    expect(result.updatedTasks).toEqual([]);
    expect(mockPrisma.scheduleTask.update).not.toHaveBeenCalled();
  });

  it('should handle null workPerformed parameter', async () => {
    const { extractActualsFromDailyReport } = await import('@/lib/schedule-actuals-service');

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      ScheduleTask: [
        {
          id: 'task-1',
          name: 'Roofing',
          tradeType: 'roofing',
          actualStartDate: null,
          actualEndDate: null,
          status: 'not_started',
        },
      ],
    });

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    const result = await extractActualsFromDailyReport(
      'project-1',
      new Date('2024-01-15'),
      '',
      [{ tradeName: 'Roofer', description: 'Started roofing work' }]
    );

    expect(result.updatedTasks).toContain('Roofing');
  });

  it('should handle undefined laborEntries parameter', async () => {
    const { extractActualsFromDailyReport } = await import('@/lib/schedule-actuals-service');

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      ScheduleTask: [
        {
          id: 'task-1',
          name: 'Excavation',
          tradeType: 'excavation',
          actualStartDate: null,
          actualEndDate: null,
          status: 'not_started',
        },
      ],
    });

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    const result = await extractActualsFromDailyReport(
      'project-1',
      new Date('2024-01-15'),
      'Excavation work started'
    );

    expect(result.updatedTasks).toContain('Excavation');
  });

  it('should handle database errors gracefully', async () => {
    const { extractActualsFromDailyReport } = await import('@/lib/schedule-actuals-service');


    mockPrisma.schedule.findFirst.mockRejectedValue(new Error('Database connection failed'));

    const result = await extractActualsFromDailyReport(
      'project-1',
      new Date(),
      'Some work',
      []
    );

    expect(result.updatedTasks).toEqual([]);
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should filter task name words by minimum length (>3 chars)', async () => {
    const { extractActualsFromDailyReport } = await import('@/lib/schedule-actuals-service');

    const reportDate = new Date('2024-01-15');

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      ScheduleTask: [
        {
          id: 'task-1',
          name: 'Do the Work',
          tradeType: null,
          actualStartDate: null,
          actualEndDate: null,
          status: 'not_started',
        },
      ],
    });

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    // "Do" and "the" are <=3 chars, only "Work" should be matched
    const result = await extractActualsFromDailyReport(
      'project-1',
      reportDate,
      'Started work today',
      []
    );

    expect(result.updatedTasks).toContain('Do the Work');
  });

  it('should handle multiple tasks mentioned in same report', async () => {
    const { extractActualsFromDailyReport } = await import('@/lib/schedule-actuals-service');

    const reportDate = new Date('2024-01-15');

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      ScheduleTask: [
        {
          id: 'task-1',
          name: 'Framing',
          tradeType: 'carpentry',
          actualStartDate: null,
          actualEndDate: null,
          status: 'not_started',
        },
        {
          id: 'task-2',
          name: 'Electrical',
          tradeType: 'electrical',
          actualStartDate: null,
          actualEndDate: null,
          status: 'not_started',
        },
      ],
    });

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    const result = await extractActualsFromDailyReport(
      'project-1',
      reportDate,
      'Started framing and electrical work today',
      []
    );

    expect(result.updatedTasks).toHaveLength(2);
    expect(result.updatedTasks).toContain('Framing');
    expect(result.updatedTasks).toContain('Electrical');
    expect(mockPrisma.scheduleTask.update).toHaveBeenCalledTimes(2);
  });
});

describe('Schedule Actuals Service - setBaselineForSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set baseline dates for tasks without existing baselines', async () => {
    const { setBaselineForSchedule } = await import('@/lib/schedule-actuals-service');

    mockPrisma.scheduleTask.findMany.mockResolvedValue([
      {
        id: 'task-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-10'),
        baselineStartDate: null,
        baselineEndDate: null,
      },
      {
        id: 'task-2',
        startDate: new Date('2024-01-11'),
        endDate: new Date('2024-01-20'),
        baselineStartDate: null,
        baselineEndDate: null,
      },
    ]);

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    const result = await setBaselineForSchedule('schedule-1');

    expect(result.tasksUpdated).toBe(2);
    expect(mockPrisma.scheduleTask.update).toHaveBeenCalledTimes(2);
    expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: {
        baselineStartDate: expect.any(Date),
        baselineEndDate: expect.any(Date),
      },
    });
  });

  it('should not update tasks that already have baselines', async () => {
    const { setBaselineForSchedule } = await import('@/lib/schedule-actuals-service');

    const existingBaseline = new Date('2024-01-01');

    mockPrisma.scheduleTask.findMany.mockResolvedValue([
      {
        id: 'task-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-10'),
        baselineStartDate: existingBaseline,
        baselineEndDate: existingBaseline,
      },
    ]);

    const result = await setBaselineForSchedule('schedule-1');

    expect(result.tasksUpdated).toBe(0);
    expect(mockPrisma.scheduleTask.update).not.toHaveBeenCalled();
  });

  it('should update task with partial baseline (only startDate set)', async () => {
    const { setBaselineForSchedule } = await import('@/lib/schedule-actuals-service');

    mockPrisma.scheduleTask.findMany.mockResolvedValue([
      {
        id: 'task-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-10'),
        baselineStartDate: new Date('2024-01-01'),
        baselineEndDate: null,
      },
    ]);

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    const result = await setBaselineForSchedule('schedule-1');

    // Should update because baselineEndDate is null (condition uses OR)
    expect(result.tasksUpdated).toBe(1);
  });

  it('should handle schedule with no tasks', async () => {
    const { setBaselineForSchedule } = await import('@/lib/schedule-actuals-service');

    mockPrisma.scheduleTask.findMany.mockResolvedValue([]);

    const result = await setBaselineForSchedule('schedule-1');

    expect(result.tasksUpdated).toBe(0);
    expect(mockPrisma.scheduleTask.update).not.toHaveBeenCalled();
  });

  it('should handle database errors gracefully', async () => {
    const { setBaselineForSchedule } = await import('@/lib/schedule-actuals-service');


    mockPrisma.scheduleTask.findMany.mockRejectedValue(new Error('Database error'));

    const result = await setBaselineForSchedule('schedule-1');

    expect(result.tasksUpdated).toBe(0);
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should copy current planned dates to baseline fields', async () => {
    const { setBaselineForSchedule } = await import('@/lib/schedule-actuals-service');

    const startDate = new Date('2024-02-01');
    const endDate = new Date('2024-02-15');

    mockPrisma.scheduleTask.findMany.mockResolvedValue([
      {
        id: 'task-1',
        startDate,
        endDate,
        baselineStartDate: null,
        baselineEndDate: null,
      },
    ]);

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    await setBaselineForSchedule('schedule-1');

    expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: {
        baselineStartDate: startDate,
        baselineEndDate: endDate,
      },
    });
  });
});

describe('Schedule Actuals Service - updateTaskActuals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update task with actual start date', async () => {
    const { updateTaskActuals } = await import('@/lib/schedule-actuals-service');

    const actualStart = new Date('2024-01-15');

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    const result = await updateTaskActuals('task-1', actualStart);

    expect(result).toBe(true);
    expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: {
        actualStartDate: actualStart,
        status: 'in_progress',
      },
    });
  });

  it('should update task with actual end date', async () => {
    const { updateTaskActuals } = await import('@/lib/schedule-actuals-service');

    const actualEnd = new Date('2024-01-20');

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    const result = await updateTaskActuals('task-1', undefined, actualEnd);

    expect(result).toBe(true);
    expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: {
        actualEndDate: actualEnd,
        status: 'completed',
        percentComplete: 100,
      },
    });
  });

  it('should update task with percent complete', async () => {
    const { updateTaskActuals } = await import('@/lib/schedule-actuals-service');

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    const result = await updateTaskActuals('task-1', undefined, undefined, 75);

    expect(result).toBe(true);
    expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: {
        percentComplete: 75,
      },
    });
  });

  it('should update task with all parameters', async () => {
    const { updateTaskActuals } = await import('@/lib/schedule-actuals-service');

    const actualStart = new Date('2024-01-15');
    const actualEnd = new Date('2024-01-20');

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    const result = await updateTaskActuals('task-1', actualStart, actualEnd, 100);

    expect(result).toBe(true);
    expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: {
        actualStartDate: actualStart,
        actualEndDate: actualEnd,
        status: 'completed',
        percentComplete: 100,
      },
    });
  });

  it('should set end date and status when percent complete is 100', async () => {
    const { updateTaskActuals } = await import('@/lib/schedule-actuals-service');

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    const result = await updateTaskActuals('task-1', undefined, undefined, 100);

    expect(result).toBe(true);
    expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: {
        percentComplete: 100,
        actualEndDate: expect.any(Date),
        status: 'completed',
      },
    });
  });

  it('should not override actualEndDate with new Date when already provided', async () => {
    const { updateTaskActuals } = await import('@/lib/schedule-actuals-service');

    const specificEndDate = new Date('2024-01-25');

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    await updateTaskActuals('task-1', undefined, specificEndDate, 100);

    expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: {
        actualEndDate: specificEndDate,
        status: 'completed',
        percentComplete: 100,
      },
    });
  });

  it('should return false when no parameters provided', async () => {
    const { updateTaskActuals } = await import('@/lib/schedule-actuals-service');

    const result = await updateTaskActuals('task-1');

    expect(result).toBe(false);
    expect(mockPrisma.scheduleTask.update).not.toHaveBeenCalled();
  });

  it('should handle percent complete of 0', async () => {
    const { updateTaskActuals } = await import('@/lib/schedule-actuals-service');

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    const result = await updateTaskActuals('task-1', undefined, undefined, 0);

    expect(result).toBe(true);
    expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: {
        percentComplete: 0,
      },
    });
  });

  it('should handle database errors gracefully', async () => {
    const { updateTaskActuals } = await import('@/lib/schedule-actuals-service');


    mockPrisma.scheduleTask.update.mockRejectedValue(new Error('Database error'));

    const result = await updateTaskActuals('task-1', new Date());

    expect(result).toBe(false);
    expect(mockLogger.error).toHaveBeenCalled();
  });
});

describe('Schedule Actuals Service - calculateScheduleVariance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate variance when task started early', async () => {
    const { calculateScheduleVariance } = await import('@/lib/schedule-actuals-service');

    const task = {
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-01-25'),
      actualStartDate: new Date('2024-01-10'),
      actualEndDate: null,
      baselineStartDate: null,
      baselineEndDate: null,
    };

    const variance = calculateScheduleVariance(task);

    expect(variance.startVariance).toBe(5); // Started 5 days early
    expect(variance.endVariance).toBe(0); // Not completed yet
    expect(variance.isAheadOfSchedule).toBe(true);
    expect(variance.isBehindSchedule).toBe(false);
  });

  it('should calculate variance when task started late', async () => {
    const { calculateScheduleVariance } = await import('@/lib/schedule-actuals-service');

    const task = {
      startDate: new Date('2024-01-10'),
      endDate: new Date('2024-01-20'),
      actualStartDate: new Date('2024-01-15'),
      actualEndDate: null,
      baselineStartDate: null,
      baselineEndDate: null,
    };

    const variance = calculateScheduleVariance(task);

    expect(variance.startVariance).toBe(-5); // Started 5 days late
    expect(variance.isAheadOfSchedule).toBe(false);
    expect(variance.isBehindSchedule).toBe(true);
  });

  it('should calculate variance when task finished early', async () => {
    const { calculateScheduleVariance } = await import('@/lib/schedule-actuals-service');

    const task = {
      startDate: new Date('2024-01-10'),
      endDate: new Date('2024-01-30'),
      actualStartDate: new Date('2024-01-10'),
      actualEndDate: new Date('2024-01-25'),
      baselineStartDate: null,
      baselineEndDate: null,
    };

    const variance = calculateScheduleVariance(task);

    expect(variance.endVariance).toBe(5); // Finished 5 days early
    expect(variance.isAheadOfSchedule).toBe(true);
    expect(variance.isBehindSchedule).toBe(false);
  });

  it('should calculate variance when task finished late', async () => {
    const { calculateScheduleVariance } = await import('@/lib/schedule-actuals-service');

    const task = {
      startDate: new Date('2024-01-10'),
      endDate: new Date('2024-01-20'),
      actualStartDate: new Date('2024-01-10'),
      actualEndDate: new Date('2024-01-25'),
      baselineStartDate: null,
      baselineEndDate: null,
    };

    const variance = calculateScheduleVariance(task);

    expect(variance.endVariance).toBe(-5); // Finished 5 days late
    expect(variance.isAheadOfSchedule).toBe(false);
    expect(variance.isBehindSchedule).toBe(true);
  });

  it('should use baseline dates when available', async () => {
    const { calculateScheduleVariance } = await import('@/lib/schedule-actuals-service');

    const task = {
      startDate: new Date('2024-01-15'), // Updated planned date
      endDate: new Date('2024-01-25'),
      actualStartDate: new Date('2024-01-12'),
      actualEndDate: null,
      baselineStartDate: new Date('2024-01-10'), // Original baseline
      baselineEndDate: new Date('2024-01-20'),
    };

    const variance = calculateScheduleVariance(task);

    // Should compare against baseline (2024-01-10), not current planned (2024-01-15)
    expect(variance.startVariance).toBe(-2); // Started 2 days late vs baseline
  });

  it('should return zero variance when no actual dates exist', async () => {
    const { calculateScheduleVariance } = await import('@/lib/schedule-actuals-service');

    const task = {
      startDate: new Date('2024-01-10'),
      endDate: new Date('2024-01-20'),
      actualStartDate: null,
      actualEndDate: null,
      baselineStartDate: null,
      baselineEndDate: null,
    };

    const variance = calculateScheduleVariance(task);

    expect(variance.startVariance).toBe(0);
    expect(variance.endVariance).toBe(0);
    expect(variance.isAheadOfSchedule).toBe(false);
    expect(variance.isBehindSchedule).toBe(false);
  });

  it('should calculate variance on same day as zero', async () => {
    const { calculateScheduleVariance } = await import('@/lib/schedule-actuals-service');

    const sameDate = new Date('2024-01-15');

    const task = {
      startDate: sameDate,
      endDate: new Date('2024-01-25'),
      actualStartDate: sameDate,
      actualEndDate: null,
      baselineStartDate: null,
      baselineEndDate: null,
    };

    const variance = calculateScheduleVariance(task);

    expect(variance.startVariance).toBe(0);
  });

  it('should handle mixed ahead and behind indicators correctly', async () => {
    const { calculateScheduleVariance } = await import('@/lib/schedule-actuals-service');

    const task = {
      startDate: new Date('2024-01-10'),
      endDate: new Date('2024-01-20'),
      actualStartDate: new Date('2024-01-08'), // Started early (+2)
      actualEndDate: new Date('2024-01-25'), // Finished late (-5)
      baselineStartDate: null,
      baselineEndDate: null,
    };

    const variance = calculateScheduleVariance(task);

    expect(variance.startVariance).toBe(2); // Started early
    expect(variance.endVariance).toBe(-5); // Finished late
    // Task is both ahead (started early) and behind (finished late)
    expect(variance.isAheadOfSchedule).toBe(true);
    expect(variance.isBehindSchedule).toBe(true);
  });
});

describe('Schedule Actuals Service - backfillActualsFromHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process all daily reports in chronological order', async () => {
    const { backfillActualsFromHistory } = await import('@/lib/schedule-actuals-service');

    mockPrisma.dailyReport.findMany.mockResolvedValue([
      {
        id: 'report-1',
        projectId: 'project-1',
        reportDate: new Date('2024-01-10'),
        workPerformed: 'Started foundation work',
        laborEntries: [],
      },
      {
        id: 'report-2',
        projectId: 'project-1',
        reportDate: new Date('2024-01-15'),
        workPerformed: 'Continued foundation work',
        laborEntries: [],
      },
    ]);

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      ScheduleTask: [
        {
          id: 'task-1',
          name: 'Foundation',
          tradeType: 'concrete',
          actualStartDate: null,
          actualEndDate: null,
          status: 'not_started',
        },
      ],
    });

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    const result = await backfillActualsFromHistory('project-1');

    expect(result.reportsProcessed).toBe(2);
    expect(result.tasksUpdated).toBeGreaterThan(0);
    expect(mockPrisma.dailyReport.findMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      include: { laborEntries: true },
      orderBy: { reportDate: 'asc' },
    });
  });

  it('should include labor entries in extraction', async () => {
    const { backfillActualsFromHistory } = await import('@/lib/schedule-actuals-service');

    mockPrisma.dailyReport.findMany.mockResolvedValue([
      {
        id: 'report-1',
        projectId: 'project-1',
        reportDate: new Date('2024-01-10'),
        workPerformed: 'General work',
        laborEntries: [
          {
            tradeName: 'Carpenter',
            description: 'Framing work',
          },
        ],
      },
    ]);

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      ScheduleTask: [
        {
          id: 'task-1',
          name: 'Framing',
          tradeType: 'carpentry',
          actualStartDate: null,
          actualEndDate: null,
          status: 'not_started',
        },
      ],
    });

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    const result = await backfillActualsFromHistory('project-1');

    expect(result.reportsProcessed).toBe(1);
    expect(result.tasksUpdated).toBeGreaterThan(0);
  });

  it('should handle projects with no daily reports', async () => {
    const { backfillActualsFromHistory } = await import('@/lib/schedule-actuals-service');

    mockPrisma.dailyReport.findMany.mockResolvedValue([]);

    const result = await backfillActualsFromHistory('project-1');

    expect(result.reportsProcessed).toBe(0);
    expect(result.tasksUpdated).toBe(0);
  });

  it('should count total tasks updated across all reports', async () => {
    const { backfillActualsFromHistory } = await import('@/lib/schedule-actuals-service');

    mockPrisma.dailyReport.findMany.mockResolvedValue([
      {
        id: 'report-1',
        projectId: 'project-1',
        reportDate: new Date('2024-01-10'),
        workPerformed: 'Foundation work',
        laborEntries: [],
      },
      {
        id: 'report-2',
        projectId: 'project-1',
        reportDate: new Date('2024-01-15'),
        workPerformed: 'Framing work',
        laborEntries: [],
      },
    ]);

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      ScheduleTask: [
        {
          id: 'task-1',
          name: 'Foundation',
          tradeType: 'concrete',
          actualStartDate: null,
          actualEndDate: null,
          status: 'not_started',
        },
        {
          id: 'task-2',
          name: 'Framing',
          tradeType: 'carpentry',
          actualStartDate: null,
          actualEndDate: null,
          status: 'not_started',
        },
      ],
    });

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    const result = await backfillActualsFromHistory('project-1');

    expect(result.reportsProcessed).toBe(2);
    // Each report should update one task
    expect(result.tasksUpdated).toBe(2);
  });

  it('should handle labor entries with null descriptions', async () => {
    const { backfillActualsFromHistory } = await import('@/lib/schedule-actuals-service');

    mockPrisma.dailyReport.findMany.mockResolvedValue([
      {
        id: 'report-1',
        projectId: 'project-1',
        reportDate: new Date('2024-01-10'),
        workPerformed: 'Electrical work',
        laborEntries: [
          {
            tradeName: 'Electrician',
            description: null,
          },
        ],
      },
    ]);

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      ScheduleTask: [
        {
          id: 'task-1',
          name: 'Electrical',
          tradeType: 'electrical',
          actualStartDate: null,
          actualEndDate: null,
          status: 'not_started',
        },
      ],
    });

    mockPrisma.scheduleTask.update.mockResolvedValue({ id: 'task-1' });

    const result = await backfillActualsFromHistory('project-1');

    expect(result.reportsProcessed).toBe(1);
    expect(result.tasksUpdated).toBeGreaterThan(0);
  });

  it('should handle database errors gracefully', async () => {
    const { backfillActualsFromHistory } = await import('@/lib/schedule-actuals-service');


    mockPrisma.dailyReport.findMany.mockRejectedValue(new Error('Database error'));

    const result = await backfillActualsFromHistory('project-1');

    expect(result.reportsProcessed).toBe(0);
    expect(result.tasksUpdated).toBe(0);
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should process reports even if some fail', async () => {
    const { backfillActualsFromHistory } = await import('@/lib/schedule-actuals-service');


    mockPrisma.dailyReport.findMany.mockResolvedValue([
      {
        id: 'report-1',
        projectId: 'project-1',
        reportDate: new Date('2024-01-10'),
        workPerformed: 'Work performed',
        laborEntries: [],
      },
    ]);

    // First call fails, second succeeds
    mockPrisma.schedule.findFirst
      .mockRejectedValueOnce(new Error('Temporary error'))
      .mockResolvedValueOnce({
        id: 'schedule-1',
        projectId: 'project-1',
        ScheduleTask: [],
      });

    const result = await backfillActualsFromHistory('project-1');

    // Should still report 1 report processed despite error
    expect(result.reportsProcessed).toBe(1);
  });
});
