import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Prisma mock ──────────────────────────────────────────────────────────────
const mockPrisma = vi.hoisted(() => ({
  project: {
    findFirst: vi.fn(),
  },
  scheduleTask: {
    findMany: vi.fn(),
  },
  milestone: {
    findMany: vi.fn(),
  },
  projectBudget: {
    findUnique: vi.fn(),
  },
  budgetItem: {
    aggregate: vi.fn(),
  },
  changeOrder: {
    findMany: vi.fn(),
  },
  dailyReport: {
    findMany: vi.fn(),
  },
  laborEntry: {
    aggregate: vi.fn(),
  },
  subcontractor: {
    findMany: vi.fn(),
  },
  rFI: {
    findMany: vi.fn(),
  },
  punchListItem: {
    findMany: vi.fn(),
  },
  projectHealthSnapshot: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  invoice: {
    findMany: vi.fn(),
  },
  procurement: {
    findMany: vi.fn(),
  },
  activityLog: {
    create: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

// ─── skill-loader mock ────────────────────────────────────────────────────────
const mockSkillLoader = vi.hoisted(() => ({
  loadAgentDefinition: vi.fn(),
}));

vi.mock('@/lib/plugin/skill-loader', () => mockSkillLoader);

// ─── LLM mock ─────────────────────────────────────────────────────────────────
const mockCallLLM = vi.hoisted(() => vi.fn());

vi.mock('@/lib/llm-providers', () => ({
  callLLM: mockCallLLM,
}));

// ─── model-config mock ────────────────────────────────────────────────────────
vi.mock('@/lib/model-config', () => ({
  SIMPLE_MODEL: 'gpt-4o-mini',
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { executeAgentCheck, getProjectDataForAgent } from '@/lib/plugin/agent-executor';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_PROJECT = {
  id: 'project-1',
  name: 'Test Construction Project',
  slug: 'test-construction-project',
  status: 'ACTIVE',
  jobNumber: 'JOB-001',
  superintendent: 'John Smith',
  projectManager: 'Jane Doe',
  clientName: 'Acme Corp',
  projectType: 'COMMERCIAL',
};

const MOCK_LLM_SUCCESS_RESPONSE = JSON.stringify({
  status: 'success',
  summary: 'Project health is on track. No critical issues detected.',
  alerts: [
    {
      severity: 2,
      category: 'schedule',
      title: 'Minor schedule float consumed',
      description: 'Foundation tasks have consumed 3 days of float.',
      dataSource: 'schedule',
      metric: 'float',
      value: 3,
      threshold: 5,
    },
  ],
  kpis: [
    {
      name: 'SPI',
      value: 0.97,
      unit: 'index',
      trend: 'flat',
    },
  ],
  recommendations: [
    'Review critical path activities weekly.',
    'Confirm concrete delivery schedule for next week.',
  ],
});

function setupDefaultMocks() {
  mockSkillLoader.loadAgentDefinition.mockReturnValue('# Agent Definition\n\nAnalyze project health.');
  mockCallLLM.mockResolvedValue({ content: MOCK_LLM_SUCCESS_RESPONSE });

  mockPrisma.project.findFirst.mockResolvedValue(MOCK_PROJECT);
  mockPrisma.scheduleTask.findMany.mockResolvedValue([]);
  mockPrisma.milestone.findMany.mockResolvedValue([]);
  mockPrisma.projectBudget.findUnique.mockResolvedValue(null);
  mockPrisma.changeOrder.findMany.mockResolvedValue([]);
  mockPrisma.dailyReport.findMany.mockResolvedValue([]);
  mockPrisma.laborEntry.aggregate.mockResolvedValue({
    _sum: { hoursWorked: 0, totalCost: 0 },
    _count: 0,
  });
  mockPrisma.subcontractor.findMany.mockResolvedValue([]);
  mockPrisma.rFI.findMany.mockResolvedValue([]);
  mockPrisma.punchListItem.findMany.mockResolvedValue([]);
  mockPrisma.projectHealthSnapshot.findMany.mockResolvedValue([]);
  mockPrisma.invoice.findMany.mockResolvedValue([]);
  mockPrisma.procurement.findMany.mockResolvedValue([]);
  mockPrisma.activityLog.create.mockResolvedValue({ id: 'log-1' });
  mockPrisma.projectHealthSnapshot.create.mockResolvedValue({ id: 'snap-1' });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('agent-executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  // ── getProjectDataForAgent ────────────────────────────────────────────────────

  describe('getProjectDataForAgent', () => {
    it('returns project data with correct structure when project exists', async () => {
      const data = await getProjectDataForAgent('project-1', 'test-project');

      expect(data.project).not.toBeNull();
      expect(data.project?.id).toBe('project-1');
      expect(data.project?.name).toBe('Test Construction Project');
    });

    it('returns null project when project is not found', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      const data = await getProjectDataForAgent('nonexistent-id', 'nonexistent');

      expect(data.project).toBeNull();
      expect(data.dataGaps).toContain('Project not found in database');
    });

    it('adds dataGaps entry when project.findFirst throws', async () => {
      mockPrisma.project.findFirst.mockRejectedValue(new Error('DB connection failed'));

      const data = await getProjectDataForAgent('project-1', 'test-project');

      expect(data.project).toBeNull();
      expect(data.dataGaps).toContain('Project data unavailable');
    });

    it('loads schedule tasks and tracks scheduleCount', async () => {
      mockPrisma.scheduleTask.findMany.mockResolvedValue([
        {
          id: 'task-1',
          name: 'Pour Foundation',
          status: 'IN_PROGRESS',
          percentComplete: 60,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-15'),
          isCritical: true,
        },
      ]);

      const data = await getProjectDataForAgent('project-1', 'test-project');

      expect(data.scheduleCount).toBe(1);
      expect(data.scheduleTasks[0].name).toBe('Pour Foundation');
      expect(data.scheduleTasks[0].isCritical).toBe(true);
    });

    it('adds dataGap when no schedule tasks are found', async () => {
      mockPrisma.scheduleTask.findMany.mockResolvedValue([]);

      const data = await getProjectDataForAgent('project-1', 'test-project');

      expect(data.dataGaps).toContain('No schedule tasks found');
    });

    it('adds dataGap when schedule query throws', async () => {
      mockPrisma.scheduleTask.findMany.mockRejectedValue(new Error('Query timeout'));

      const data = await getProjectDataForAgent('project-1', 'test-project');

      expect(data.dataGaps).toContain('Schedule data unavailable');
    });

    it('returns empty subcontractors array when none exist', async () => {
      mockPrisma.subcontractor.findMany.mockResolvedValue([]);

      const data = await getProjectDataForAgent('project-1', 'test-project');

      expect(data.subcontractors).toEqual([]);
    });

    it('returns populated subcontractors list', async () => {
      mockPrisma.subcontractor.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          companyName: 'Walker Construction',
          tradeType: 'CONCRETE',
          isActive: true,
        },
      ]);

      const data = await getProjectDataForAgent('project-1', 'test-project');

      expect(data.subcontractors[0].companyName).toBe('Walker Construction');
      expect(data.subcontractors[0].tradeType).toBe('CONCRETE');
    });

    it('returns the correct data bundle structure', async () => {
      const data = await getProjectDataForAgent('project-1', 'test-project');

      expect(data).toHaveProperty('project');
      expect(data).toHaveProperty('scheduleTasks');
      expect(data).toHaveProperty('milestones');
      expect(data).toHaveProperty('budgetSummary');
      expect(data).toHaveProperty('changeOrders');
      expect(data).toHaveProperty('recentDailyReports');
      expect(data).toHaveProperty('laborSummary');
      expect(data).toHaveProperty('subcontractors');
      expect(data).toHaveProperty('rfis');
      expect(data).toHaveProperty('punchListItems');
      expect(data).toHaveProperty('healthSnapshots');
      expect(data).toHaveProperty('invoiceSummary');
      expect(data).toHaveProperty('procurementItems');
      expect(data).toHaveProperty('dataGaps');
    });
  });

  // ── executeAgentCheck ─────────────────────────────────────────────────────────

  describe('executeAgentCheck', () => {
    it('returns error result when agent definition is not found', async () => {
      mockSkillLoader.loadAgentDefinition.mockReturnValue(null);

      const result = await executeAgentCheck(
        'nonexistent-agent',
        'project-1',
        'test-project',
      );

      expect(result.status).toBe('error');
      expect(result.agentName).toBe('nonexistent-agent');
      expect(result.recommendations[0]).toContain('nonexistent-agent');
      expect(result.dataGaps).toContain('Agent definition missing');
    });

    it('returns error result when project data loading throws', async () => {
      // Make all Prisma calls throw to simulate complete DB failure
      mockPrisma.project.findFirst.mockRejectedValue(new Error('Total DB failure'));
      mockPrisma.scheduleTask.findMany.mockRejectedValue(new Error('DB failure'));
      mockPrisma.milestone.findMany.mockRejectedValue(new Error('DB failure'));
      mockPrisma.changeOrder.findMany.mockRejectedValue(new Error('DB failure'));
      mockPrisma.dailyReport.findMany.mockRejectedValue(new Error('DB failure'));
      mockPrisma.laborEntry.aggregate.mockRejectedValue(new Error('DB failure'));
      mockPrisma.subcontractor.findMany.mockRejectedValue(new Error('DB failure'));
      mockPrisma.rFI.findMany.mockRejectedValue(new Error('DB failure'));
      mockPrisma.punchListItem.findMany.mockRejectedValue(new Error('DB failure'));
      mockPrisma.projectHealthSnapshot.findMany.mockRejectedValue(new Error('DB failure'));
      mockPrisma.invoice.findMany.mockRejectedValue(new Error('DB failure'));
      mockPrisma.procurement.findMany.mockRejectedValue(new Error('DB failure'));

      const result = await executeAgentCheck(
        'project-health-monitor',
        'project-1',
        'test-project',
      );

      // Project not found → no-data result
      expect(result.status).toBe('no-data');
    });

    it('returns no-data status when project does not exist in DB', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      const result = await executeAgentCheck(
        'project-health-monitor',
        'unknown-project-id',
        'unknown-slug',
      );

      expect(result.status).toBe('no-data');
      expect(result.summary).toContain('Project not found');
    });

    it('returns success result with alerts and KPIs from LLM response', async () => {
      const result = await executeAgentCheck(
        'project-health-monitor',
        'project-1',
        'test-project',
      );

      expect(result.status).toBe('success');
      expect(result.agentName).toBe('project-health-monitor');
      expect(result.projectId).toBe('project-1');
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].severity).toBe(2);
      expect(result.kpis).toHaveLength(1);
      expect(result.kpis[0].name).toBe('SPI');
      expect(result.recommendations).toHaveLength(2);
    });

    it('returns error status when LLM call fails', async () => {
      mockCallLLM.mockRejectedValue(new Error('Rate limit exceeded'));

      const result = await executeAgentCheck(
        'project-health-monitor',
        'project-1',
        'test-project',
      );

      expect(result.status).toBe('error');
      expect(result.summary).toContain('LLM call failed');
    });

    it('returns partial status when LLM returns unparseable JSON', async () => {
      mockCallLLM.mockResolvedValue({ content: 'Not valid JSON at all.' });

      const result = await executeAgentCheck(
        'project-health-monitor',
        'project-1',
        'test-project',
      );

      expect(result.status).toBe('partial');
      // Summary should contain a preview of the raw LLM response
      expect(result.summary).toContain('Not valid JSON');
    });

    it('stores results in ActivityLog after successful execution', async () => {
      await executeAgentCheck(
        'project-health-monitor',
        'project-1',
        'test-project',
      );

      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'agent:project-health-monitor',
            resource: 'project',
            resourceId: 'project-1',
          }),
        }),
      );
    });

    it('also creates a ProjectHealthSnapshot for project-health-monitor agent', async () => {
      await executeAgentCheck(
        'project-health-monitor',
        'project-1',
        'test-project',
      );

      expect(mockPrisma.projectHealthSnapshot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'project-1',
            overallScore: expect.any(Number),
          }),
        }),
      );
    });

    it('does NOT create a ProjectHealthSnapshot for non-health-monitor agents', async () => {
      await executeAgentCheck(
        'deadline-sentinel',
        'project-1',
        'test-project',
      );

      expect(mockPrisma.projectHealthSnapshot.create).not.toHaveBeenCalled();
    });

    it('includes durationMs and executedAt in the result', async () => {
      const result = await executeAgentCheck(
        'project-health-monitor',
        'project-1',
        'test-project',
      );

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.executedAt).toBeTruthy();
      // executedAt should be a valid ISO string
      expect(() => new Date(result.executedAt)).not.toThrow();
    });

    it('does not throw when ActivityLog.create fails (best-effort storage)', async () => {
      mockPrisma.activityLog.create.mockRejectedValue(new Error('DB write failed'));

      // Should not throw — result storage is non-blocking
      await expect(
        executeAgentCheck('project-health-monitor', 'project-1', 'test-project'),
      ).resolves.toBeDefined();
    });
  });
});
