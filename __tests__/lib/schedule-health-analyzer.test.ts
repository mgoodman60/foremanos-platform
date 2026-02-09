import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  HealthIssue,
  HealthMetric,
  ScheduleHealthReport,
  analyzeScheduleHealth,
  applyAutoFix,
} from '@/lib/schedule-health-analyzer';

const mockPrisma = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
  },
  scheduleTask: {
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createScopedLogger: vi.fn(() => mockLogger),
}));

describe('schedule-health-analyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeScheduleHealth', () => {
    it('should analyze healthy schedule', async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days ahead

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        slug: 'test-project',
        Schedule: [
          {
            id: 'sched-1',
            ScheduleTask: [
              {
                id: 'task-1',
                name: 'Task 1',
                status: 'completed',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-15'),
                percentComplete: 100,
                isCritical: false,
                totalFloat: 5,
                baselineStartDate: new Date('2024-01-01'),
                baselineEndDate: new Date('2024-01-15'),
              },
              {
                id: 'task-2',
                name: 'Task 2',
                status: 'in_progress',
                startDate: now,
                endDate: future,
                percentComplete: 50,
                isCritical: true,
                totalFloat: 0,
                baselineStartDate: now,
                baselineEndDate: future,
              },
            ],
          },
        ],
        Milestone: [
          {
            id: 'mile-1',
            name: 'Milestone 1',
            plannedDate: future,
            status: 'PENDING',
          },
        ],
      });

      const report = await analyzeScheduleHealth('test-project');

      expect(report.overallScore).toBeGreaterThan(50);
      expect(report.status).not.toBe('Critical');
      expect(report.metrics.length).toBeGreaterThan(0);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should detect critical path issues', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        Schedule: [
          {
            ScheduleTask: [
              {
                id: 'task-1',
                name: 'Critical Task',
                status: 'in_progress',
                startDate: past,
                endDate: past,
                percentComplete: 50,
                isCritical: true,
                totalFloat: 0,
              },
            ],
          },
        ],
        Milestone: [],
      });

      const report = await analyzeScheduleHealth('test-project');

      expect(report.issues.some(i => i.severity === 'critical')).toBe(true);
      expect(report.issues.some(i => i.type === 'schedule_slip')).toBe(true);
    });

    it('should detect overdue milestones', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        Schedule: [{ ScheduleTask: [] }],
        Milestone: [
          {
            id: 'mile-1',
            name: 'Overdue Milestone',
            plannedDate: past,
            status: 'PENDING',
          },
        ],
      });

      const report = await analyzeScheduleHealth('test-project');

      expect(report.issues.some(i => i.type === 'milestone_miss')).toBe(true);
      expect(report.issues.some(i => i.severity === 'critical')).toBe(true);
    });

    it('should detect zero float concentration', async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

      const zeroFloatTasks = Array.from({ length: 10 }, (_, i) => ({
        id: `task-${i}`,
        name: `Task ${i}`,
        status: 'in_progress',
        startDate: now,
        endDate: future,
        percentComplete: 50,
        isCritical: false,
        totalFloat: 0,
      }));

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        Schedule: [{ ScheduleTask: zeroFloatTasks }],
        Milestone: [],
      });

      const report = await analyzeScheduleHealth('test-project');

      expect(report.issues.some(i => i.type === 'float_depletion')).toBe(true);
    });

    it('should detect resource conflicts', async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        Schedule: [
          {
            ScheduleTask: [
              {
                id: 'task-1',
                name: 'Task 1',
                status: 'in_progress',
                startDate: now,
                endDate: future,
                assignedTo: 'user-1',
                percentComplete: 50,
                isCritical: false,
              },
              {
                id: 'task-2',
                name: 'Task 2',
                status: 'in_progress',
                startDate: now,
                endDate: future,
                assignedTo: 'user-1',
                percentComplete: 50,
                isCritical: false,
              },
            ],
          },
        ],
        Milestone: [],
      });

      const report = await analyzeScheduleHealth('test-project');

      expect(report.issues.some(i => i.type === 'resource_conflict')).toBe(true);
    });

    it('should detect tight deadlines', async () => {
      const now = new Date();
      const nearFuture = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        Schedule: [
          {
            ScheduleTask: [
              {
                id: 'task-1',
                name: 'Urgent Task',
                status: 'in_progress',
                startDate: now,
                endDate: nearFuture,
                percentComplete: 30,
                isCritical: false,
              },
            ],
          },
        ],
        Milestone: [],
      });

      const report = await analyzeScheduleHealth('test-project');

      expect(report.issues.some(i => i.type === 'deadline_risk')).toBe(true);
    });

    it('should detect stale tasks', async () => {
      const now = new Date();
      const longAgo = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
      const future = new Date(longAgo.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 day planned duration

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        Schedule: [
          {
            ScheduleTask: [
              {
                id: 'task-1',
                name: 'Stale Task',
                status: 'in_progress',
                startDate: longAgo,
                endDate: future,
                actualStartDate: longAgo,
                percentComplete: 60,
                isCritical: false,
              },
            ],
          },
        ],
        Milestone: [],
      });

      const report = await analyzeScheduleHealth('test-project');

      expect(report.issues.some(i => i.type === 'productivity')).toBe(true);
    });

    it('should detect missing baseline', async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

      const tasksWithoutBaseline = Array.from({ length: 10 }, (_, i) => ({
        id: `task-${i}`,
        name: `Task ${i}`,
        status: 'in_progress',
        startDate: now,
        endDate: future,
        percentComplete: 50,
        isCritical: false,
        baselineStartDate: null,
        baselineEndDate: null,
      }));

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        Schedule: [{ ScheduleTask: tasksWithoutBaseline }],
        Milestone: [],
      });

      const report = await analyzeScheduleHealth('test-project');

      expect(report.issues.some(i => i.type === 'data_quality')).toBe(true);
      expect(report.issues.some(i => i.autoFixable === true)).toBe(true);
    });

    it('should calculate grade correctly', async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        Schedule: [
          {
            ScheduleTask: [
              {
                id: 'task-1',
                name: 'Task 1',
                status: 'completed',
                startDate: now,
                endDate: future,
                percentComplete: 100,
                isCritical: true,
                totalFloat: 10,
                baselineStartDate: now,
                baselineEndDate: future,
              },
            ],
          },
        ],
        Milestone: [
          {
            id: 'mile-1',
            name: 'Milestone 1',
            plannedDate: future,
            status: 'COMPLETED',
          },
        ],
      });

      const report = await analyzeScheduleHealth('test-project');

      expect(['A', 'B', 'C', 'D', 'F']).toContain(report.grade);
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
    });

    it('should include benchmark comparison', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        Schedule: [{ ScheduleTask: [] }],
        Milestone: [],
      });

      const report = await analyzeScheduleHealth('test-project');

      expect(report.benchmarkComparison).toBeDefined();
      expect(report.benchmarkComparison.length).toBeGreaterThan(0);
      expect(report.benchmarkComparison[0]).toHaveProperty('metric');
      expect(report.benchmarkComparison[0]).toHaveProperty('yourValue');
      expect(report.benchmarkComparison[0]).toHaveProperty('industryAvg');
    });

    it('should provide recommendations', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        Schedule: [{ ScheduleTask: [] }],
        Milestone: [],
      });

      const report = await analyzeScheduleHealth('test-project');

      expect(report.recommendations).toBeDefined();
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should throw error if project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(analyzeScheduleHealth('missing-project')).rejects.toThrow('Project not found');
    });

    it('should calculate on-time performance correctly', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const future = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        Schedule: [
          {
            ScheduleTask: [
              { id: 'task-1', name: 'On-time', status: 'completed', startDate: past, endDate: past, percentComplete: 100, isCritical: false },
              { id: 'task-2', name: 'On-time', status: 'in_progress', startDate: now, endDate: future, percentComplete: 50, isCritical: false },
              { id: 'task-3', name: 'Delayed', status: 'delayed', startDate: past, endDate: past, percentComplete: 30, isCritical: false },
            ],
          },
        ],
        Milestone: [],
      });

      const report = await analyzeScheduleHealth('test-project');

      const onTimeMetric = report.metrics.find(m => m.name === 'On-Time Performance');
      expect(onTimeMetric).toBeDefined();
      expect(onTimeMetric!.value).toBeGreaterThan(0);
    });

    it('should sort issues by severity', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        Schedule: [
          {
            ScheduleTask: [
              { id: 'task-1', name: 'Critical', status: 'in_progress', startDate: past, endDate: past, percentComplete: 30, isCritical: true, totalFloat: 0 },
              { id: 'task-2', name: 'Zero float', status: 'in_progress', startDate: now, endDate: now, percentComplete: 30, isCritical: false, totalFloat: 0 },
            ],
          },
        ],
        Milestone: [],
      });

      const report = await analyzeScheduleHealth('test-project');

      if (report.issues.length > 1) {
        expect(report.issues[0].severity).toBe('critical');
      }
    });
  });

  describe('applyAutoFix', () => {
    it('should set baseline for tasks without baseline', async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        Schedule: [
          {
            ScheduleTask: [
              {
                id: 'task-1',
                name: 'Task 1',
                startDate: now,
                endDate: future,
                baselineStartDate: null,
              },
              {
                id: 'task-2',
                name: 'Task 2',
                startDate: now,
                endDate: future,
                baselineStartDate: null,
              },
            ],
          },
        ],
      });

      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await applyAutoFix('test-project', 'missing-baseline');

      expect(result.success).toBe(true);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should return error for project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const result = await applyAutoFix('missing-project', 'missing-baseline');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Project not found');
    });

    it('should return message for resource conflicts', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        Schedule: [{ ScheduleTask: [] }],
      });

      const result = await applyAutoFix('test-project', 'resource-conflict-user1');

      expect(result.success).toBe(false);
      expect(result.message).toContain('manual review');
    });

    it('should return error for unknown issue', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        Schedule: [{ ScheduleTask: [] }],
      });

      const result = await applyAutoFix('test-project', 'unknown-issue');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not available');
    });

    it('should handle transaction errors', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        Schedule: [
          {
            ScheduleTask: [
              {
                id: 'task-1',
                startDate: new Date(),
                endDate: new Date(),
                baselineStartDate: null,
              },
            ],
          },
        ],
      });

      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

      const result = await applyAutoFix('test-project', 'missing-baseline');

      expect(result.success).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
