import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateProjectHealth,
  saveHealthSnapshot,
  getHealthHistory,
  getHealthColor,
  getHealthLabel,
} from '@/lib/project-health-service';

const mockPrisma = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
  },
  projectBudget: {
    findUnique: vi.fn(),
  },
  changeOrder: {
    findMany: vi.fn(),
  },
  invoice: {
    findMany: vi.fn(),
  },
  rFI: {
    findMany: vi.fn(),
  },
  punchListItem: {
    findMany: vi.fn(),
  },
  dailyReport: {
    findMany: vi.fn(),
  },
  document: {
    findMany: vi.fn(),
  },
  scheduleUpdate: {
    findMany: vi.fn(),
  },
  projectHealthSnapshot: {
    findFirst: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

describe('project-health-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateProjectHealth', () => {
    const mockProjectId = 'project-123';
    const now = new Date('2024-01-15T12:00:00Z');

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(now);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should calculate health score for a project with all data', async () => {
      const mockProject = {
        id: mockProjectId,
        scheduleActivities: [
          {
            startDate: '2024-01-01',
            endDate: '2024-01-20',
            progress: 80,
          },
          {
            startDate: '2024-01-10',
            endDate: '2024-01-25',
            progress: 50,
          },
        ],
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.projectBudget.findUnique.mockResolvedValue({
        totalBudget: 100000,
        actualCost: 95000,
      });
      mockPrisma.changeOrder.findMany.mockResolvedValue([
        { status: 'PENDING' },
        { status: 'APPROVED' },
      ]);
      mockPrisma.invoice.findMany.mockResolvedValue([
        { status: 'PENDING' },
        { status: 'PAID' },
      ]);
      mockPrisma.rFI.findMany.mockResolvedValue([
        { status: 'OPEN', dueDate: null },
        { status: 'CLOSED', dueDate: null },
      ]);
      mockPrisma.punchListItem.findMany.mockResolvedValue([
        { status: 'OPEN', category: 'QUALITY' },
        { status: 'VERIFIED', category: 'QUALITY' },
      ]);
      mockPrisma.dailyReport.findMany.mockResolvedValue([
        { reportDate: new Date('2024-01-14'), safetyIncidents: 0, status: 'APPROVED' },
        { reportDate: new Date('2024-01-13'), safetyIncidents: 0, status: 'APPROVED' },
      ]);
      mockPrisma.document.findMany.mockResolvedValue([
        { fileType: 'pdf' },
        { fileType: 'jpg' },
      ]);
      mockPrisma.scheduleUpdate.findMany.mockResolvedValue([]);
      mockPrisma.projectHealthSnapshot.findFirst.mockResolvedValue(null);

      const result = await calculateProjectHealth(mockProjectId);

      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(result.scheduleScore).toBeDefined();
      expect(result.budgetScore).toBeDefined();
      expect(result.safetyScore).toBeDefined();
      expect(result.qualityScore).toBeDefined();
      expect(result.documentScore).toBeDefined();
      expect(result.trend).toBe('stable');
      expect(result.metrics).toBeDefined();
      expect(result.alerts).toBeInstanceOf(Array);
    });

    it('should throw error if project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);
      mockPrisma.projectBudget.findUnique.mockResolvedValue(null);
      mockPrisma.changeOrder.findMany.mockResolvedValue([]);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.rFI.findMany.mockResolvedValue([]);
      mockPrisma.punchListItem.findMany.mockResolvedValue([]);
      mockPrisma.dailyReport.findMany.mockResolvedValue([]);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.scheduleUpdate.findMany.mockResolvedValue([]);
      mockPrisma.projectHealthSnapshot.findFirst.mockResolvedValue(null);

      await expect(calculateProjectHealth(mockProjectId)).rejects.toThrow('Project not found');
    });

    it('should penalize overdue tasks in schedule score', async () => {
      const overdueTask = {
        startDate: '2024-01-01',
        endDate: '2024-01-10', // Past due
        progress: 50,
      };

      mockPrisma.project.findUnique.mockResolvedValue({
        id: mockProjectId,
        scheduleActivities: [overdueTask],
      });
      mockPrisma.projectBudget.findUnique.mockResolvedValue(null);
      mockPrisma.changeOrder.findMany.mockResolvedValue([]);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.rFI.findMany.mockResolvedValue([]);
      mockPrisma.punchListItem.findMany.mockResolvedValue([]);
      mockPrisma.dailyReport.findMany.mockResolvedValue([]);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.scheduleUpdate.findMany.mockResolvedValue([]);
      mockPrisma.projectHealthSnapshot.findFirst.mockResolvedValue(null);

      const result = await calculateProjectHealth(mockProjectId);

      expect(result.metrics.overdueTasks).toBe(1);
      expect(result.scheduleScore).toBeLessThan(100);
      expect(result.alerts.some((a) => a.category === 'Schedule')).toBe(true);
    });

    it('should detect budget overruns', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: mockProjectId,
        scheduleActivities: [],
      });
      mockPrisma.projectBudget.findUnique.mockResolvedValue({
        totalBudget: 100000,
        actualCost: 115000, // 15% over budget
      });
      mockPrisma.changeOrder.findMany.mockResolvedValue([]);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.rFI.findMany.mockResolvedValue([]);
      mockPrisma.punchListItem.findMany.mockResolvedValue([]);
      mockPrisma.dailyReport.findMany.mockResolvedValue([]);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.scheduleUpdate.findMany.mockResolvedValue([]);
      mockPrisma.projectHealthSnapshot.findFirst.mockResolvedValue(null);

      const result = await calculateProjectHealth(mockProjectId);

      expect(result.metrics.budgetVariance).toBeGreaterThan(10);
      expect(result.budgetScore).toBeLessThan(100);
      expect(result.alerts.some((a) => a.type === 'critical' && a.category === 'Budget')).toBe(true);
    });

    it('should track safety incidents', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: mockProjectId,
        scheduleActivities: [],
      });
      mockPrisma.projectBudget.findUnique.mockResolvedValue(null);
      mockPrisma.changeOrder.findMany.mockResolvedValue([]);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.rFI.findMany.mockResolvedValue([]);
      mockPrisma.punchListItem.findMany.mockResolvedValue([
        { status: 'OPEN', category: 'SAFETY' },
        { status: 'IN_PROGRESS', category: 'SAFETY' },
      ]);
      mockPrisma.dailyReport.findMany.mockResolvedValue([
        { reportDate: new Date('2024-01-14'), safetyIncidents: 1, status: 'APPROVED' },
      ]);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.scheduleUpdate.findMany.mockResolvedValue([]);
      mockPrisma.projectHealthSnapshot.findFirst.mockResolvedValue(null);

      const result = await calculateProjectHealth(mockProjectId);

      expect(result.metrics.safetyIssuesOpen).toBe(2);
      expect(result.safetyScore).toBeLessThan(100);
      expect(result.alerts.some((a) => a.type === 'critical' && a.category === 'Safety')).toBe(true);
    });

    it('should calculate safety score with 7 incident-free days', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: mockProjectId,
        scheduleActivities: [],
      });
      mockPrisma.projectBudget.findUnique.mockResolvedValue(null);
      mockPrisma.changeOrder.findMany.mockResolvedValue([]);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.rFI.findMany.mockResolvedValue([]);
      mockPrisma.punchListItem.findMany.mockResolvedValue([]);
      mockPrisma.dailyReport.findMany.mockResolvedValue([
        { reportDate: new Date('2024-01-14'), safetyIncidents: 0, status: 'APPROVED' },
        { reportDate: new Date('2024-01-13'), safetyIncidents: 0, status: 'APPROVED' },
        { reportDate: new Date('2024-01-12'), safetyIncidents: 0, status: 'APPROVED' },
      ]);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.scheduleUpdate.findMany.mockResolvedValue([]);
      mockPrisma.projectHealthSnapshot.findFirst.mockResolvedValue(null);

      const result = await calculateProjectHealth(mockProjectId);

      expect(result.metrics.incidentsFree).toBe(7);
      expect(result.safetyScore).toBe(100);
    });

    it('should track overdue RFIs', async () => {
      const pastDue = new Date('2024-01-10');

      mockPrisma.project.findUnique.mockResolvedValue({
        id: mockProjectId,
        scheduleActivities: [],
      });
      mockPrisma.projectBudget.findUnique.mockResolvedValue(null);
      mockPrisma.changeOrder.findMany.mockResolvedValue([]);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.rFI.findMany.mockResolvedValue([
        { status: 'OPEN', dueDate: pastDue },
        { status: 'PENDING_RESPONSE', dueDate: pastDue },
      ]);
      mockPrisma.punchListItem.findMany.mockResolvedValue([]);
      mockPrisma.dailyReport.findMany.mockResolvedValue([]);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.scheduleUpdate.findMany.mockResolvedValue([]);
      mockPrisma.projectHealthSnapshot.findFirst.mockResolvedValue(null);

      const result = await calculateProjectHealth(mockProjectId);

      expect(result.metrics.overdueRFIs).toBe(2);
      expect(result.qualityScore).toBeLessThan(100);
      expect(result.alerts.some((a) => a.category === 'Quality')).toBe(true);
    });

    it('should alert on many open punch items', async () => {
      const punchItems = Array.from({ length: 25 }, () => ({
        status: 'OPEN',
        category: 'QUALITY',
      }));

      mockPrisma.project.findUnique.mockResolvedValue({
        id: mockProjectId,
        scheduleActivities: [],
      });
      mockPrisma.projectBudget.findUnique.mockResolvedValue(null);
      mockPrisma.changeOrder.findMany.mockResolvedValue([]);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.rFI.findMany.mockResolvedValue([]);
      mockPrisma.punchListItem.findMany.mockResolvedValue(punchItems);
      mockPrisma.dailyReport.findMany.mockResolvedValue([]);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.scheduleUpdate.findMany.mockResolvedValue([]);
      mockPrisma.projectHealthSnapshot.findFirst.mockResolvedValue(null);

      const result = await calculateProjectHealth(mockProjectId);

      expect(result.metrics.openPunchItems).toBe(25);
      expect(result.alerts.some((a) => a.message.includes('punch list'))).toBe(true);
    });

    it('should calculate document score based on daily reports', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: mockProjectId,
        scheduleActivities: [],
      });
      mockPrisma.projectBudget.findUnique.mockResolvedValue(null);
      mockPrisma.changeOrder.findMany.mockResolvedValue([]);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.rFI.findMany.mockResolvedValue([]);
      mockPrisma.punchListItem.findMany.mockResolvedValue([]);
      mockPrisma.dailyReport.findMany.mockResolvedValue([
        { reportDate: new Date('2024-01-14'), safetyIncidents: 0, status: 'SUBMITTED' },
      ]);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.scheduleUpdate.findMany.mockResolvedValue([]);
      mockPrisma.projectHealthSnapshot.findFirst.mockResolvedValue(null);

      const result = await calculateProjectHealth(mockProjectId);

      expect(result.metrics.dailyReportsSubmitted).toBe(1);
      expect(result.documentScore).toBeLessThan(100); // Should be penalized for < 3 reports
      expect(result.alerts.some((a) => a.category === 'Documentation')).toBe(true);
    });

    it('should determine improving trend from previous snapshot', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: mockProjectId,
        scheduleActivities: [],
      });
      mockPrisma.projectBudget.findUnique.mockResolvedValue(null);
      mockPrisma.changeOrder.findMany.mockResolvedValue([]);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.rFI.findMany.mockResolvedValue([]);
      mockPrisma.punchListItem.findMany.mockResolvedValue([]);
      mockPrisma.dailyReport.findMany.mockResolvedValue([]);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.scheduleUpdate.findMany.mockResolvedValue([]);
      mockPrisma.projectHealthSnapshot.findFirst.mockResolvedValue({
        overallScore: 85,
        createdAt: new Date('2024-01-14'),
      });

      const result = await calculateProjectHealth(mockProjectId);

      expect(result.changeFromPrevious).toBeGreaterThan(0);
      expect(result.trend).toBe('improving');
    });

    it('should determine declining trend from previous snapshot', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: mockProjectId,
        scheduleActivities: [],
      });
      mockPrisma.projectBudget.findUnique.mockResolvedValue({
        totalBudget: 100000,
        actualCost: 120000, // Over budget to lower score
      });
      mockPrisma.changeOrder.findMany.mockResolvedValue([
        { status: 'PENDING' },
        { status: 'PENDING' },
        { status: 'PENDING' },
      ]);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.rFI.findMany.mockResolvedValue([
        { status: 'OPEN', dueDate: new Date('2024-01-10') },
        { status: 'OPEN', dueDate: new Date('2024-01-10') },
      ]);
      mockPrisma.punchListItem.findMany.mockResolvedValue([
        { status: 'OPEN', category: 'QUALITY' },
        { status: 'OPEN', category: 'QUALITY' },
      ]);
      mockPrisma.dailyReport.findMany.mockResolvedValue([]);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.scheduleUpdate.findMany.mockResolvedValue([]);
      mockPrisma.projectHealthSnapshot.findFirst.mockResolvedValue({
        overallScore: 95,
        createdAt: new Date('2024-01-14'),
      });

      const result = await calculateProjectHealth(mockProjectId);

      expect(result.changeFromPrevious).toBeLessThan(0);
      expect(result.trend).toBe('declining');
    });

    it('should handle empty schedule activities', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: mockProjectId,
        scheduleActivities: [],
      });
      mockPrisma.projectBudget.findUnique.mockResolvedValue(null);
      mockPrisma.changeOrder.findMany.mockResolvedValue([]);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.rFI.findMany.mockResolvedValue([]);
      mockPrisma.punchListItem.findMany.mockResolvedValue([]);
      mockPrisma.dailyReport.findMany.mockResolvedValue([]);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.scheduleUpdate.findMany.mockResolvedValue([]);
      mockPrisma.projectHealthSnapshot.findFirst.mockResolvedValue(null);

      const result = await calculateProjectHealth(mockProjectId);

      expect(result.metrics.overdueTasks).toBe(0);
      expect(result.metrics.tasksOnTrack).toBe(0);
      expect(result.scheduleScore).toBe(100);
    });

    it('should count upcoming milestones', async () => {
      const soonDueDate = new Date(now);
      soonDueDate.setDate(soonDueDate.getDate() + 5); // 5 days from now

      mockPrisma.project.findUnique.mockResolvedValue({
        id: mockProjectId,
        scheduleActivities: [
          {
            startDate: '2024-01-01',
            endDate: soonDueDate.toISOString(),
            progress: 80,
          },
        ],
      });
      mockPrisma.projectBudget.findUnique.mockResolvedValue(null);
      mockPrisma.changeOrder.findMany.mockResolvedValue([]);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.rFI.findMany.mockResolvedValue([]);
      mockPrisma.punchListItem.findMany.mockResolvedValue([]);
      mockPrisma.dailyReport.findMany.mockResolvedValue([]);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.scheduleUpdate.findMany.mockResolvedValue([]);
      mockPrisma.projectHealthSnapshot.findFirst.mockResolvedValue(null);

      const result = await calculateProjectHealth(mockProjectId);

      expect(result.metrics.upcomingMilestones).toBe(1);
    });
  });

  describe('saveHealthSnapshot', () => {
    it('should save a health snapshot', async () => {
      const mockProjectId = 'project-123';

      mockPrisma.project.findUnique.mockResolvedValue({
        id: mockProjectId,
        scheduleActivities: [],
      });
      mockPrisma.projectBudget.findUnique.mockResolvedValue(null);
      mockPrisma.changeOrder.findMany.mockResolvedValue([]);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.rFI.findMany.mockResolvedValue([]);
      mockPrisma.punchListItem.findMany.mockResolvedValue([]);
      mockPrisma.dailyReport.findMany.mockResolvedValue([]);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.scheduleUpdate.findMany.mockResolvedValue([]);
      mockPrisma.projectHealthSnapshot.findFirst.mockResolvedValue(null);
      mockPrisma.projectHealthSnapshot.create.mockResolvedValue({
        id: 'snapshot-123',
        projectId: mockProjectId,
        overallScore: 95,
      });

      await saveHealthSnapshot(mockProjectId);

      expect(mockPrisma.projectHealthSnapshot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: mockProjectId,
            overallScore: expect.any(Number),
            scheduleScore: expect.any(Number),
            budgetScore: expect.any(Number),
            safetyScore: expect.any(Number),
            qualityScore: expect.any(Number),
            documentScore: expect.any(Number),
            metrics: expect.any(Object),
            trend: expect.stringMatching(/^(improving|stable|declining)$/),
          }),
        })
      );
    });
  });

  describe('getHealthHistory', () => {
    it('should return health history for last 30 days', async () => {
      const mockProjectId = 'project-123';
      const snapshots = [
        {
          createdAt: new Date('2024-01-01'),
          overallScore: 90,
          trend: 'stable',
        },
        {
          createdAt: new Date('2024-01-15'),
          overallScore: 95,
          trend: 'improving',
        },
      ];

      mockPrisma.projectHealthSnapshot.findMany.mockResolvedValue(snapshots);

      const result = await getHealthHistory(mockProjectId, 30);

      expect(result).toHaveLength(2);
      expect(result[0].score).toBe(90);
      expect(result[1].score).toBe(95);
      expect(mockPrisma.projectHealthSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: mockProjectId,
            createdAt: { gte: expect.any(Date) },
          }),
        })
      );
    });

    it('should use custom days parameter', async () => {
      const mockProjectId = 'project-123';
      mockPrisma.projectHealthSnapshot.findMany.mockResolvedValue([]);

      await getHealthHistory(mockProjectId, 7);

      expect(mockPrisma.projectHealthSnapshot.findMany).toHaveBeenCalled();
    });
  });

  describe('getHealthColor', () => {
    it('should return green for excellent scores (>= 80)', () => {
      expect(getHealthColor(100)).toBe('#22C55E');
      expect(getHealthColor(80)).toBe('#22C55E');
    });

    it('should return yellow for good scores (60-79)', () => {
      expect(getHealthColor(70)).toBe('#EAB308');
      expect(getHealthColor(60)).toBe('#EAB308');
    });

    it('should return orange for concerning scores (40-59)', () => {
      expect(getHealthColor(50)).toBe('#F97316');
      expect(getHealthColor(40)).toBe('#F97316');
    });

    it('should return red for critical scores (< 40)', () => {
      expect(getHealthColor(30)).toBe('#EF4444');
      expect(getHealthColor(0)).toBe('#EF4444');
    });
  });

  describe('getHealthLabel', () => {
    it('should return Excellent for scores >= 80', () => {
      expect(getHealthLabel(100)).toBe('Excellent');
      expect(getHealthLabel(80)).toBe('Excellent');
    });

    it('should return Good for scores 60-79', () => {
      expect(getHealthLabel(70)).toBe('Good');
      expect(getHealthLabel(60)).toBe('Good');
    });

    it('should return Needs Attention for scores 40-59', () => {
      expect(getHealthLabel(50)).toBe('Needs Attention');
      expect(getHealthLabel(40)).toBe('Needs Attention');
    });

    it('should return Critical for scores < 40', () => {
      expect(getHealthLabel(30)).toBe('Critical');
      expect(getHealthLabel(0)).toBe('Critical');
    });
  });
});
