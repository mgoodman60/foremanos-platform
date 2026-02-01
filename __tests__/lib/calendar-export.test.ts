import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// Mock date-fns
const mockFormat = vi.fn();
const mockAddDays = vi.fn();

vi.mock('date-fns', () => ({
  format: mockFormat,
  addDays: mockAddDays,
}));

// Mock Prisma with vi.hoisted
const mocks = vi.hoisted(() => ({
  prisma: {
    milestone: {
      findMany: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
    schedule: {
      findFirst: vi.fn(),
    },
    mEPSubmittal: {
      findMany: vi.fn(),
    },
    procurement: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }));

// Mock environment variable
const originalEnv = process.env.NEXTAUTH_URL;

describe('calendar-export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_URL = 'https://foremanos.site';

    // Setup default date-fns mocks
    mockFormat.mockImplementation((date: Date, formatStr: string) => {
      if (formatStr === "yyyyMMdd") {
        return '20240115';
      }
      if (formatStr === "yyyyMMdd'T'HHmmss'Z'") {
        return '20240115T120000Z';
      }
      return '20240115';
    });

    mockAddDays.mockImplementation((date: Date, days: number) => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    });
  });

  afterAll(() => {
    process.env.NEXTAUTH_URL = originalEnv;
  });

  describe('exportMilestonesAsICal', () => {
    const mockMilestones = [
      {
        id: 'milestone-1',
        name: 'Foundation Complete',
        description: 'All foundation work finished',
        plannedDate: new Date('2024-01-15'),
        actualDate: new Date('2024-01-16'),
        category: 'Construction',
        isCritical: true,
        status: 'COMPLETED',
      },
      {
        id: 'milestone-2',
        name: 'Framing Start',
        description: null,
        plannedDate: new Date('2024-02-01'),
        actualDate: null,
        category: null,
        isCritical: false,
        status: 'CONFIRMED',
      },
    ];

    const mockProject = {
      id: 'project-1',
      name: 'Downtown Office Building',
      locationCity: 'Seattle',
      locationState: 'WA',
    };

    beforeEach(() => {
      mocks.prisma.milestone.findMany.mockResolvedValue(mockMilestones);
      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
    });

    it('should export milestones as iCal format', async () => {
      const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
      const result = await exportMilestonesAsICal('project-1');

      expect(result).toContain('BEGIN:VCALENDAR');
      expect(result).toContain('END:VCALENDAR');
      expect(result).toContain('VERSION:2.0');
      expect(result).toContain('PRODID:-//ForemanOS//Construction Calendar//EN');
    });

    it('should include project name in calendar name', async () => {
      const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
      const result = await exportMilestonesAsICal('project-1');

      expect(result).toContain('X-WR-CALNAME:Downtown Office Building - Milestones');
    });

    it('should include milestone as VEVENT', async () => {
      const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
      const result = await exportMilestonesAsICal('project-1');

      expect(result).toContain('BEGIN:VEVENT');
      expect(result).toContain('END:VEVENT');
      expect(result).toContain('[MILESTONE] Foundation Complete');
    });

    it('should include location from project', async () => {
      const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
      const result = await exportMilestonesAsICal('project-1');

      expect(result).toContain('LOCATION:Seattle\\, WA');
    });

    it('should handle project with no location', async () => {
      const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
      mocks.prisma.project.findUnique.mockResolvedValue({
        ...mockProject,
        locationCity: null,
        locationState: null,
      });

      const result = await exportMilestonesAsICal('project-1');

      expect(result).not.toContain('LOCATION:');
    });

    it('should handle partial location (city only)', async () => {
      const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
      mocks.prisma.project.findUnique.mockResolvedValue({
        ...mockProject,
        locationCity: 'Seattle',
        locationState: null,
      });

      const result = await exportMilestonesAsICal('project-1');

      expect(result).toContain('LOCATION:Seattle');
    });

    it('should mark critical milestones with priority 1', async () => {
      const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
      const result = await exportMilestonesAsICal('project-1');

      expect(result).toContain('PRIORITY:1');
    });

    it('should mark non-critical milestones with priority 5', async () => {
      const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
      const result = await exportMilestonesAsICal('project-1');

      expect(result).toContain('PRIORITY:5');
    });

    it('should include categories with milestone category', async () => {
      const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
      const result = await exportMilestonesAsICal('project-1');

      expect(result).toContain('CATEGORIES:Milestone,Construction');
    });

    it('should use General category when milestone has no category', async () => {
      const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
      const result = await exportMilestonesAsICal('project-1');

      expect(result).toContain('CATEGORIES:Milestone,General');
    });

    it('should include milestone description', async () => {
      const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
      const result = await exportMilestonesAsICal('project-1');

      expect(result).toContain('DESCRIPTION:All foundation work finished');
    });

    it('should handle null description', async () => {
      const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
      const result = await exportMilestonesAsICal('project-1');

      // Should not contain DESCRIPTION for milestone-2
      const events = result.split('BEGIN:VEVENT');
      const milestone2Event = events.find(e => e.includes('Framing Start'));
      expect(milestone2Event).toBeDefined();
    });

    it('should use actualDate for dtend when available', async () => {
      const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
      await exportMilestonesAsICal('project-1');

      expect(mockFormat).toHaveBeenCalled();
    });

    it('should use plannedDate + 1 day for dtend when actualDate is null', async () => {
      const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
      await exportMilestonesAsICal('project-1');

      expect(mockAddDays).toHaveBeenCalledWith(expect.any(Date), 1);
    });

    it('should handle project not found', async () => {
      const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
      mocks.prisma.project.findUnique.mockResolvedValue(null);

      const result = await exportMilestonesAsICal('project-1');

      expect(result).toContain('X-WR-CALNAME:Project - Milestones');
    });

    it('should handle empty milestones', async () => {
      const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
      mocks.prisma.milestone.findMany.mockResolvedValue([]);

      const result = await exportMilestonesAsICal('project-1');

      expect(result).toContain('BEGIN:VCALENDAR');
      expect(result).toContain('END:VCALENDAR');
      expect(result).not.toContain('BEGIN:VEVENT');
    });

    it('should include STATUS field for milestones', async () => {
      const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
      const result = await exportMilestonesAsICal('project-1');

      expect(result).toContain('STATUS:COMPLETED');
      expect(result).toContain('STATUS:CONFIRMED');
    });

    it('should order milestones by plannedDate ascending', async () => {
      const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
      await exportMilestonesAsICal('project-1');

      expect(mocks.prisma.milestone.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        orderBy: { plannedDate: 'asc' },
      });
    });

    it('should generate unique UIDs for milestones', async () => {
      const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
      const result = await exportMilestonesAsICal('project-1');

      expect(result).toContain('UID:milestone-milestone-1@foremanos.site');
      expect(result).toContain('UID:milestone-milestone-2@foremanos.site');
    });
  });

  describe('exportScheduleAsICal', () => {
    const mockScheduleTasks = [
      {
        id: 'task-1',
        name: 'Install Foundation Forms',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-20'),
        percentComplete: 100,
        isCritical: true,
        totalFloat: 0,
        predecessors: [],
        status: 'completed',
      },
      {
        id: 'task-2',
        name: 'Pour Concrete',
        startDate: new Date('2024-01-21'),
        endDate: new Date('2024-01-25'),
        percentComplete: 50,
        isCritical: false,
        totalFloat: 2,
        predecessors: ['task-1'],
        status: 'in_progress',
      },
      {
        id: 'task-3',
        name: 'Task with null dates',
        startDate: null,
        endDate: null,
        percentComplete: 0,
        isCritical: false,
        totalFloat: 5,
        predecessors: [],
        status: 'not_started',
      },
    ];

    const mockSchedule = {
      id: 'schedule-1',
      projectId: 'project-1',
      ScheduleTask: mockScheduleTasks,
    };

    const mockProject = {
      id: 'project-1',
      name: 'Downtown Office Building',
      locationCity: 'Seattle',
      locationState: 'WA',
    };

    beforeEach(() => {
      mocks.prisma.schedule.findFirst.mockResolvedValue(mockSchedule);
      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
    });

    it('should export schedule tasks as iCal format', async () => {
      const { exportScheduleAsICal } = await import('@/lib/calendar-export');
      const result = await exportScheduleAsICal('project-1');

      expect(result).toContain('BEGIN:VCALENDAR');
      expect(result).toContain('END:VCALENDAR');
      expect(result).toContain('BEGIN:VEVENT');
    });

    it('should include task name with critical path emoji', async () => {
      const { exportScheduleAsICal } = await import('@/lib/calendar-export');
      const result = await exportScheduleAsICal('project-1');

      expect(result).toContain('🔴 Install Foundation Forms');
    });

    it('should not include emoji for non-critical tasks', async () => {
      const { exportScheduleAsICal } = await import('@/lib/calendar-export');
      const result = await exportScheduleAsICal('project-1');

      expect(result).toContain('SUMMARY:Pour Concrete');
    });

    it('should filter critical tasks only when criticalOnly is true', async () => {
      const { exportScheduleAsICal } = await import('@/lib/calendar-export');
      await exportScheduleAsICal('project-1', true);

      expect(mocks.prisma.schedule.findFirst).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        include: {
          ScheduleTask: {
            where: { isCritical: true },
            orderBy: { startDate: 'asc' },
          },
        },
      });
    });

    it('should include all tasks when criticalOnly is false', async () => {
      const { exportScheduleAsICal } = await import('@/lib/calendar-export');
      await exportScheduleAsICal('project-1', false);

      expect(mocks.prisma.schedule.findFirst).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        include: {
          ScheduleTask: {
            where: {},
            orderBy: { startDate: 'asc' },
          },
        },
      });
    });

    it('should include task description with progress and float', async () => {
      const { exportScheduleAsICal } = await import('@/lib/calendar-export');
      const result = await exportScheduleAsICal('project-1');

      expect(result).toContain('Progress: 100%');
      expect(result).toContain('Progress: 50%');
      expect(result).toContain('⚠️ CRITICAL PATH');
      expect(result).toContain('Float: 2 days');
    });

    it('should include predecessor information', async () => {
      const { exportScheduleAsICal } = await import('@/lib/calendar-export');
      const result = await exportScheduleAsICal('project-1');

      expect(result).toContain('Predecessors: task-1');
    });

    it('should filter out tasks with null dates', async () => {
      const { exportScheduleAsICal } = await import('@/lib/calendar-export');
      const result = await exportScheduleAsICal('project-1');

      expect(result).not.toContain('Task with null dates');
    });

    it('should mark completed tasks with STATUS:COMPLETED', async () => {
      const { exportScheduleAsICal } = await import('@/lib/calendar-export');
      const result = await exportScheduleAsICal('project-1');

      expect(result).toContain('STATUS:COMPLETED');
    });

    it('should mark in-progress tasks with STATUS:CONFIRMED', async () => {
      const { exportScheduleAsICal } = await import('@/lib/calendar-export');
      const result = await exportScheduleAsICal('project-1');

      expect(result).toContain('STATUS:CONFIRMED');
    });

    it('should include Critical Path category for critical tasks', async () => {
      const { exportScheduleAsICal } = await import('@/lib/calendar-export');
      const result = await exportScheduleAsICal('project-1');

      expect(result).toContain('CATEGORIES:Critical Path,Schedule');
    });

    it('should include Schedule category for non-critical tasks', async () => {
      const { exportScheduleAsICal } = await import('@/lib/calendar-export');
      const result = await exportScheduleAsICal('project-1');

      expect(result).toContain('CATEGORIES:Schedule');
    });

    it('should handle no schedule found', async () => {
      const { exportScheduleAsICal } = await import('@/lib/calendar-export');
      mocks.prisma.schedule.findFirst.mockResolvedValue(null);

      const result = await exportScheduleAsICal('project-1');

      expect(result).toContain('BEGIN:VCALENDAR');
      expect(result).not.toContain('BEGIN:VEVENT');
    });

    it('should handle schedule with no tasks', async () => {
      const { exportScheduleAsICal } = await import('@/lib/calendar-export');
      mocks.prisma.schedule.findFirst.mockResolvedValue({
        ...mockSchedule,
        ScheduleTask: [],
      });

      const result = await exportScheduleAsICal('project-1');

      expect(result).toContain('BEGIN:VCALENDAR');
      expect(result).not.toContain('BEGIN:VEVENT');
    });

    it('should include "Critical Path" in calendar name when criticalOnly is true', async () => {
      const { exportScheduleAsICal } = await import('@/lib/calendar-export');
      const result = await exportScheduleAsICal('project-1', true);

      expect(result).toContain('X-WR-CALNAME:Downtown Office Building - Critical Path');
    });

    it('should include "Schedule" in calendar name when criticalOnly is false', async () => {
      const { exportScheduleAsICal } = await import('@/lib/calendar-export');
      const result = await exportScheduleAsICal('project-1', false);

      expect(result).toContain('X-WR-CALNAME:Downtown Office Building - Schedule');
    });

    it('should generate unique UIDs for tasks', async () => {
      const { exportScheduleAsICal } = await import('@/lib/calendar-export');
      const result = await exportScheduleAsICal('project-1');

      expect(result).toContain('UID:task-task-1@foremanos.site');
      expect(result).toContain('UID:task-task-2@foremanos.site');
    });
  });

  describe('exportDeadlinesAsICal', () => {
    const mockSubmittals = [
      {
        id: 'submittal-1',
        submittalNumber: 'S-001',
        title: 'Structural Steel Shop Drawings',
        submittalType: 'SHOP_DRAWING',
        specSection: '05 12 00',
        status: 'PENDING',
        dueDate: new Date('2024-02-01'),
      },
      {
        id: 'submittal-2',
        submittalNumber: 'S-002',
        title: 'HVAC Equipment',
        submittalType: 'PRODUCT_DATA',
        specSection: null,
        status: 'SUBMITTED',
        dueDate: new Date('2024-02-15'),
      },
      {
        id: 'submittal-3',
        submittalNumber: 'S-003',
        title: 'Should be excluded',
        submittalType: 'PRODUCT_DATA',
        specSection: '23 00 00',
        status: 'APPROVED',
        dueDate: new Date('2024-03-01'),
      },
    ];

    const mockProcurements = [
      {
        id: 'proc-1',
        description: 'Structural Steel Beams',
        quantity: 500,
        unit: 'LF',
        status: 'ORDERED',
        requiredDate: new Date('2024-03-15'),
      },
      {
        id: 'proc-2',
        description: 'Concrete Mix',
        quantity: null,
        unit: null,
        status: 'BIDDING',
        requiredDate: new Date('2024-03-20'),
      },
      {
        id: 'proc-3',
        description: 'Should be excluded',
        quantity: 10,
        unit: 'EA',
        status: 'DELIVERED',
        requiredDate: new Date('2024-04-01'),
      },
    ];

    const mockProject = {
      id: 'project-1',
      name: 'Downtown Office Building',
    };

    beforeEach(() => {
      mocks.prisma.mEPSubmittal.findMany.mockResolvedValue(mockSubmittals);
      mocks.prisma.procurement.findMany.mockResolvedValue(mockProcurements);
      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
    });

    it('should export submittals and procurements as iCal', async () => {
      const { exportDeadlinesAsICal } = await import('@/lib/calendar-export');
      const result = await exportDeadlinesAsICal('project-1');

      expect(result).toContain('BEGIN:VCALENDAR');
      expect(result).toContain('END:VCALENDAR');
      expect(result).toContain('BEGIN:VEVENT');
    });

    it('should filter submittals by status and non-null dueDate', async () => {
      const { exportDeadlinesAsICal } = await import('@/lib/calendar-export');
      await exportDeadlinesAsICal('project-1');

      expect(mocks.prisma.mEPSubmittal.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          dueDate: { not: null },
          status: { in: ['PENDING', 'SUBMITTED', 'UNDER_REVIEW'] },
        },
        orderBy: { dueDate: 'asc' },
      });
    });

    it('should filter procurements by status and non-null requiredDate', async () => {
      const { exportDeadlinesAsICal } = await import('@/lib/calendar-export');
      await exportDeadlinesAsICal('project-1');

      expect(mocks.prisma.procurement.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          requiredDate: { not: null },
          status: { in: ['IDENTIFIED', 'SPEC_REVIEW', 'BIDDING', 'AWARDED', 'ORDERED', 'IN_TRANSIT'] },
        },
        orderBy: { requiredDate: 'asc' },
      });
    });

    it('should include submittal events with correct format', async () => {
      const { exportDeadlinesAsICal } = await import('@/lib/calendar-export');
      const result = await exportDeadlinesAsICal('project-1');

      expect(result).toContain('[SUBMITTAL DUE] S-001: Structural Steel Shop Drawings');
      expect(result).toContain('Type: SHOP_DRAWING');
      expect(result).toContain('Spec Section: 05 12 00');
      expect(result).toContain('Status: PENDING');
    });

    it('should handle null spec section in submittal', async () => {
      const { exportDeadlinesAsICal } = await import('@/lib/calendar-export');
      const result = await exportDeadlinesAsICal('project-1');

      expect(result).toContain('Spec Section: N/A');
    });

    it('should include procurement events with correct format', async () => {
      const { exportDeadlinesAsICal } = await import('@/lib/calendar-export');
      const result = await exportDeadlinesAsICal('project-1');

      expect(result).toContain('[DELIVERY REQUIRED] Structural Steel Beams');
      expect(result).toContain('Status: ORDERED');
      expect(result).toContain('Quantity: 500 LF');
    });

    it('should handle null quantity and unit in procurement', async () => {
      const { exportDeadlinesAsICal } = await import('@/lib/calendar-export');
      const result = await exportDeadlinesAsICal('project-1');

      expect(result).toContain('[DELIVERY REQUIRED] Concrete Mix');
      expect(result).toContain('Quantity:  ');
    });

    it('should include Submittal and Deadline categories for submittals', async () => {
      const { exportDeadlinesAsICal } = await import('@/lib/calendar-export');
      const result = await exportDeadlinesAsICal('project-1');

      expect(result).toContain('CATEGORIES:Submittal,Deadline');
    });

    it('should include Procurement and Deadline categories for procurements', async () => {
      const { exportDeadlinesAsICal } = await import('@/lib/calendar-export');
      const result = await exportDeadlinesAsICal('project-1');

      expect(result).toContain('CATEGORIES:Procurement,Deadline');
    });

    it('should use priority 3 for all deadlines', async () => {
      const { exportDeadlinesAsICal } = await import('@/lib/calendar-export');
      const result = await exportDeadlinesAsICal('project-1');

      const priorityMatches = result.match(/PRIORITY:3/g);
      expect(priorityMatches?.length).toBeGreaterThan(0);
    });

    it('should skip submittals with null dueDate', async () => {
      const { exportDeadlinesAsICal } = await import('@/lib/calendar-export');
      mocks.prisma.mEPSubmittal.findMany.mockResolvedValue([
        { ...mockSubmittals[0], dueDate: null },
      ]);

      const result = await exportDeadlinesAsICal('project-1');

      expect(result).not.toContain('[SUBMITTAL DUE]');
    });

    it('should skip procurements with null requiredDate', async () => {
      const { exportDeadlinesAsICal } = await import('@/lib/calendar-export');
      mocks.prisma.procurement.findMany.mockResolvedValue([
        { ...mockProcurements[0], requiredDate: null },
      ]);

      const result = await exportDeadlinesAsICal('project-1');

      expect(result).not.toContain('[DELIVERY REQUIRED]');
    });

    it('should handle empty submittals and procurements', async () => {
      const { exportDeadlinesAsICal } = await import('@/lib/calendar-export');
      mocks.prisma.mEPSubmittal.findMany.mockResolvedValue([]);
      mocks.prisma.procurement.findMany.mockResolvedValue([]);

      const result = await exportDeadlinesAsICal('project-1');

      expect(result).toContain('BEGIN:VCALENDAR');
      expect(result).not.toContain('BEGIN:VEVENT');
    });

    it('should include project name in calendar name', async () => {
      const { exportDeadlinesAsICal } = await import('@/lib/calendar-export');
      const result = await exportDeadlinesAsICal('project-1');

      expect(result).toContain('X-WR-CALNAME:Downtown Office Building - Deadlines');
    });

    it('should generate unique UIDs for submittals and procurements', async () => {
      const { exportDeadlinesAsICal } = await import('@/lib/calendar-export');
      const result = await exportDeadlinesAsICal('project-1');

      expect(result).toContain('UID:submittal-submittal-1@foremanos.site');
      expect(result).toContain('UID:procurement-proc-1@foremanos.site');
    });

    it('should use Promise.all to fetch submittals and procurements in parallel', async () => {
      const { exportDeadlinesAsICal } = await import('@/lib/calendar-export');
      await exportDeadlinesAsICal('project-1');

      expect(mocks.prisma.mEPSubmittal.findMany).toHaveBeenCalled();
      expect(mocks.prisma.procurement.findMany).toHaveBeenCalled();
    });
  });

  describe('exportProjectCalendar', () => {
    const mockMilestones = [
      {
        id: 'milestone-1',
        name: 'Foundation Complete',
        description: 'Foundation milestone',
        plannedDate: new Date('2024-01-15'),
        isCritical: true,
      },
    ];

    const mockScheduleTasks = [
      {
        id: 'task-1',
        name: 'Critical Task',
        startDate: new Date('2024-01-20'),
        endDate: new Date('2024-01-25'),
        isCritical: true,
      },
      {
        id: 'task-2',
        name: 'Task with null dates',
        startDate: null,
        endDate: null,
        isCritical: true,
      },
    ];

    const mockSchedule = {
      id: 'schedule-1',
      projectId: 'project-1',
      ScheduleTask: mockScheduleTasks,
    };

    const mockSubmittals = [
      {
        id: 'submittal-1',
        title: 'Shop Drawing A',
        dueDate: new Date('2024-02-01'),
      },
      {
        id: 'submittal-2',
        title: 'Should be excluded',
        dueDate: null,
      },
    ];

    const mockProject = {
      id: 'project-1',
      name: 'Downtown Office Building',
      locationCity: 'Seattle',
      locationState: 'WA',
    };

    beforeEach(() => {
      mocks.prisma.milestone.findMany.mockResolvedValue(mockMilestones);
      mocks.prisma.schedule.findFirst.mockResolvedValue(mockSchedule);
      mocks.prisma.mEPSubmittal.findMany.mockResolvedValue(mockSubmittals);
      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
    });

    it('should export combined project calendar', async () => {
      const { exportProjectCalendar } = await import('@/lib/calendar-export');
      const result = await exportProjectCalendar('project-1');

      expect(result).toContain('BEGIN:VCALENDAR');
      expect(result).toContain('END:VCALENDAR');
      expect(result).toContain('X-WR-CALNAME:Downtown Office Building - Project Calendar');
    });

    it('should fetch milestones, schedule, and submittals in parallel', async () => {
      const { exportProjectCalendar } = await import('@/lib/calendar-export');
      await exportProjectCalendar('project-1');

      expect(mocks.prisma.milestone.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
      });
      expect(mocks.prisma.schedule.findFirst).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        include: { ScheduleTask: { where: { isCritical: true } } },
      });
      expect(mocks.prisma.mEPSubmittal.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1', dueDate: { not: null } },
      });
    });

    it('should include milestone events with target emoji', async () => {
      const { exportProjectCalendar } = await import('@/lib/calendar-export');
      const result = await exportProjectCalendar('project-1');

      expect(result).toContain('SUMMARY:🎯 Foundation Complete');
      expect(result).toContain('CATEGORIES:Milestone');
    });

    it('should include critical task events with red circle emoji', async () => {
      const { exportProjectCalendar } = await import('@/lib/calendar-export');
      const result = await exportProjectCalendar('project-1');

      expect(result).toContain('SUMMARY:🔴 Critical Task');
      expect(result).toContain('CATEGORIES:Critical Path');
    });

    it('should include submittal events with clipboard emoji', async () => {
      const { exportProjectCalendar } = await import('@/lib/calendar-export');
      const result = await exportProjectCalendar('project-1');

      expect(result).toContain('SUMMARY:📋 Shop Drawing A');
      expect(result).toContain('CATEGORIES:Submittal');
    });

    it('should skip tasks with null dates', async () => {
      const { exportProjectCalendar } = await import('@/lib/calendar-export');
      const result = await exportProjectCalendar('project-1');

      expect(result).not.toContain('Task with null dates');
    });

    it('should skip submittals with null dueDate', async () => {
      const { exportProjectCalendar } = await import('@/lib/calendar-export');
      const result = await exportProjectCalendar('project-1');

      expect(result).not.toContain('Should be excluded');
    });

    it('should handle missing schedule', async () => {
      const { exportProjectCalendar } = await import('@/lib/calendar-export');
      mocks.prisma.schedule.findFirst.mockResolvedValue(null);

      const result = await exportProjectCalendar('project-1');

      expect(result).toContain('BEGIN:VCALENDAR');
      expect(result).toContain('🎯 Foundation Complete');
    });

    it('should include location for milestones and tasks', async () => {
      const { exportProjectCalendar } = await import('@/lib/calendar-export');
      const result = await exportProjectCalendar('project-1');

      expect(result).toContain('LOCATION:Seattle\\, WA');
    });

    it('should set priority based on isCritical for milestones', async () => {
      const { exportProjectCalendar } = await import('@/lib/calendar-export');
      const result = await exportProjectCalendar('project-1');

      expect(result).toContain('PRIORITY:1');
    });

    it('should generate unique UIDs for all event types', async () => {
      const { exportProjectCalendar } = await import('@/lib/calendar-export');
      const result = await exportProjectCalendar('project-1');

      expect(result).toContain('UID:milestone-milestone-1@foremanos.site');
      expect(result).toContain('UID:task-task-1@foremanos.site');
      expect(result).toContain('UID:submittal-submittal-1@foremanos.site');
    });
  });

  describe('getCalendarSubscriptionUrl', () => {
    it('should generate URL for milestones calendar', async () => {
      const { getCalendarSubscriptionUrl } = await import('@/lib/calendar-export');
      const url = getCalendarSubscriptionUrl('test-project', 'milestones');

      expect(url).toBe('https://foremanos.site/api/projects/test-project/calendar/milestones.ics');
    });

    it('should generate URL for schedule calendar', async () => {
      const { getCalendarSubscriptionUrl } = await import('@/lib/calendar-export');
      const url = getCalendarSubscriptionUrl('test-project', 'schedule');

      expect(url).toBe('https://foremanos.site/api/projects/test-project/calendar/schedule.ics');
    });

    it('should generate URL for critical path calendar', async () => {
      const { getCalendarSubscriptionUrl } = await import('@/lib/calendar-export');
      const url = getCalendarSubscriptionUrl('test-project', 'critical-path');

      expect(url).toBe('https://foremanos.site/api/projects/test-project/calendar/critical-path.ics');
    });

    it('should generate URL for deadlines calendar', async () => {
      const { getCalendarSubscriptionUrl } = await import('@/lib/calendar-export');
      const url = getCalendarSubscriptionUrl('test-project', 'deadlines');

      expect(url).toBe('https://foremanos.site/api/projects/test-project/calendar/deadlines.ics');
    });

    it('should use NEXTAUTH_URL from environment', async () => {
      const { getCalendarSubscriptionUrl } = await import('@/lib/calendar-export');
      process.env.NEXTAUTH_URL = 'https://custom.domain.com';

      const url = getCalendarSubscriptionUrl('test-project', 'milestones');

      expect(url).toBe('https://custom.domain.com/api/projects/test-project/calendar/milestones.ics');
    });

    it('should use default URL when NEXTAUTH_URL is not set', async () => {
      const { getCalendarSubscriptionUrl } = await import('@/lib/calendar-export');
      delete process.env.NEXTAUTH_URL;

      const url = getCalendarSubscriptionUrl('test-project', 'schedule');

      expect(url).toBe('https://foremanos.site/api/projects/test-project/calendar/schedule.ics');
    });

    it('should handle project slug with special characters', async () => {
      const { getCalendarSubscriptionUrl } = await import('@/lib/calendar-export');
      const url = getCalendarSubscriptionUrl('my-project-123', 'milestones');

      expect(url).toBe('https://foremanos.site/api/projects/my-project-123/calendar/milestones.ics');
    });
  });

  describe('Helper Functions', () => {
    describe('escapeICalString', () => {
      it('should escape backslashes', async () => {
        const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
        mocks.prisma.milestone.findMany.mockResolvedValue([
          {
            id: 'milestone-1',
            name: 'Test\\Milestone',
            description: 'Description\\with\\backslashes',
            plannedDate: new Date('2024-01-15'),
            actualDate: null,
            category: 'Test',
            isCritical: false,
            status: 'CONFIRMED',
          },
        ]);
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          name: 'Test Project',
          locationCity: null,
          locationState: null,
        });

        const result = await exportMilestonesAsICal('project-1');

        expect(result).toContain('Test\\\\Milestone');
        expect(result).toContain('Description\\\\with\\\\backslashes');
      });

      it('should escape semicolons', async () => {
        const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
        mocks.prisma.milestone.findMany.mockResolvedValue([
          {
            id: 'milestone-1',
            name: 'Test;Milestone',
            description: 'Description;with;semicolons',
            plannedDate: new Date('2024-01-15'),
            actualDate: null,
            category: 'Test',
            isCritical: false,
            status: 'CONFIRMED',
          },
        ]);
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          name: 'Test Project',
          locationCity: null,
          locationState: null,
        });

        const result = await exportMilestonesAsICal('project-1');

        expect(result).toContain('Test\\;Milestone');
        expect(result).toContain('Description\\;with\\;semicolons');
      });

      it('should escape commas', async () => {
        const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
        mocks.prisma.milestone.findMany.mockResolvedValue([
          {
            id: 'milestone-1',
            name: 'Test, Milestone',
            description: 'Description, with, commas',
            plannedDate: new Date('2024-01-15'),
            actualDate: null,
            category: 'Test',
            isCritical: false,
            status: 'CONFIRMED',
          },
        ]);
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          name: 'Test Project',
          locationCity: null,
          locationState: null,
        });

        const result = await exportMilestonesAsICal('project-1');

        expect(result).toContain('Test\\, Milestone');
        expect(result).toContain('Description\\, with\\, commas');
      });

      it('should escape newlines', async () => {
        const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
        mocks.prisma.milestone.findMany.mockResolvedValue([
          {
            id: 'milestone-1',
            name: 'Test\nMilestone',
            description: 'Description\nwith\nnewlines',
            plannedDate: new Date('2024-01-15'),
            actualDate: null,
            category: 'Test',
            isCritical: false,
            status: 'CONFIRMED',
          },
        ]);
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          name: 'Test Project',
          locationCity: null,
          locationState: null,
        });

        const result = await exportMilestonesAsICal('project-1');

        expect(result).toContain('Test\\nMilestone');
        expect(result).toContain('Description\\nwith\\nnewlines');
      });
    });

    describe('formatICalDate', () => {
      it('should format all-day dates correctly', async () => {
        const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
        mocks.prisma.milestone.findMany.mockResolvedValue([
          {
            id: 'milestone-1',
            name: 'Test Milestone',
            description: null,
            plannedDate: new Date('2024-01-15'),
            actualDate: null,
            category: 'Test',
            isCritical: false,
            status: 'CONFIRMED',
          },
        ]);
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          name: 'Test Project',
          locationCity: null,
          locationState: null,
        });

        await exportMilestonesAsICal('project-1');

        expect(mockFormat).toHaveBeenCalledWith(expect.any(Date), 'yyyyMMdd');
      });

      it('should format timestamp dates correctly', async () => {
        const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
        await exportMilestonesAsICal('project-1');

        expect(mockFormat).toHaveBeenCalledWith(expect.any(Date), "yyyyMMdd'T'HHmmss'Z'");
      });
    });

    describe('buildVEvent', () => {
      it('should include DTSTAMP for all events', async () => {
        const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
        mocks.prisma.milestone.findMany.mockResolvedValue([
          {
            id: 'milestone-1',
            name: 'Test Milestone',
            description: null,
            plannedDate: new Date('2024-01-15'),
            actualDate: null,
            category: 'Test',
            isCritical: false,
            status: 'CONFIRMED',
          },
        ]);
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          name: 'Test Project',
          locationCity: null,
          locationState: null,
        });

        const result = await exportMilestonesAsICal('project-1');

        expect(result).toContain('DTSTAMP:');
      });

      it('should use CRLF line endings', async () => {
        const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
        mocks.prisma.milestone.findMany.mockResolvedValue([
          {
            id: 'milestone-1',
            name: 'Test Milestone',
            description: null,
            plannedDate: new Date('2024-01-15'),
            actualDate: null,
            category: 'Test',
            isCritical: false,
            status: 'CONFIRMED',
          },
        ]);
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          name: 'Test Project',
          locationCity: null,
          locationState: null,
        });

        const result = await exportMilestonesAsICal('project-1');

        expect(result).toContain('\r\n');
      });

      it('should handle CANCELLED status', async () => {
        const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
        mocks.prisma.milestone.findMany.mockResolvedValue([
          {
            id: 'milestone-1',
            name: 'Test Milestone',
            description: null,
            plannedDate: new Date('2024-01-15'),
            actualDate: null,
            category: 'Test',
            isCritical: false,
            status: 'CANCELLED',
          },
        ]);
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          name: 'Test Project',
          locationCity: null,
          locationState: null,
        });

        const result = await exportMilestonesAsICal('project-1');

        expect(result).toContain('STATUS:CANCELLED');
      });
    });

    describe('buildICalendar', () => {
      it('should include standard iCal headers', async () => {
        const { exportMilestonesAsICal } = await import('@/lib/calendar-export');
        mocks.prisma.milestone.findMany.mockResolvedValue([]);
        mocks.prisma.project.findUnique.mockResolvedValue({
          id: 'project-1',
          name: 'Test Project',
          locationCity: null,
          locationState: null,
        });

        const result = await exportMilestonesAsICal('project-1');

        expect(result).toContain('VERSION:2.0');
        expect(result).toContain('PRODID:-//ForemanOS//Construction Calendar//EN');
        expect(result).toContain('CALSCALE:GREGORIAN');
        expect(result).toContain('METHOD:PUBLISH');
        expect(result).toContain('X-WR-TIMEZONE:America/New_York');
      });
    });
  });
});
