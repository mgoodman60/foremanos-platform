import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock analytics-service functions BEFORE importing the module
const mockAnalytics = vi.hoisted(() => ({
  calculateProjectKPIs: vi.fn(),
  getProgressTrends: vi.fn(),
  getCostBreakdown: vi.fn(),
  getScheduleAnalytics: vi.fn(),
  getTeamPerformance: vi.fn(),
  getMEPAnalytics: vi.fn(),
  getDocumentAnalytics: vi.fn(),
  getResourceUtilization: vi.fn(),
}));

vi.mock('@/lib/analytics-service', () => mockAnalytics);

// Mock Prisma BEFORE importing the module
const mockPrisma = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
  },
  dailyReport: {
    findMany: vi.fn(),
  },
  changeOrder: {
    findMany: vi.fn(),
  },
  paymentApplication: {
    findMany: vi.fn(),
  },
  mEPEquipment: {
    findMany: vi.fn(),
  },
  mEPSubmittal: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

// Import after mocking
import {
  generateExecutiveSummary,
  generateProgressReport,
  generateCostReport,
  generateMEPReport,
  generateResourceReport,
  generateCustomReport,
  reportToCSV,
  reportToJSON,
  type ReportConfig,
  type GeneratedReport,
} from '@/lib/report-generator';

describe('Report Generator - generateExecutiveSummary()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should throw error when project not found', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);

    await expect(generateExecutiveSummary('invalid-project')).rejects.toThrow('Project not found');
  });

  it('should generate executive summary with all sections', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Office Building',
      createdAt: new Date('2024-01-01'),
    });

    mockAnalytics.calculateProjectKPIs.mockResolvedValue({
      percentComplete: 65,
      daysRemaining: 45,
      budgetUtilization: 70,
      schedulePerformanceIndex: 1.1,
      scheduleVariance: 5,
      tasksOnTrack: 15,
      tasksDelayed: 3,
      criticalPathTasks: 8,
      costPerformanceIndex: 0.95,
      costVariance: -50000,
      estimateAtCompletion: 2100000,
      varianceAtCompletion: -100000,
    });

    mockAnalytics.getProgressTrends.mockResolvedValue([
      { date: 'Jun 01', plannedProgress: 50, actualProgress: 55, plannedCost: 1000000, actualCost: 950000, earnedValue: 1100000 },
      { date: 'Jun 08', plannedProgress: 60, actualProgress: 65, plannedCost: 1200000, actualCost: 1150000, earnedValue: 1300000 },
    ]);

    mockAnalytics.getCostBreakdown.mockResolvedValue([
      { category: 'CONCRETE', budgeted: 500000, committed: 480000, actual: 490000, variance: 10000, percentOfBudget: 25 },
      { category: 'STEEL', budgeted: 400000, committed: 420000, actual: 410000, variance: -10000, percentOfBudget: 20 },
    ]);

    mockAnalytics.getScheduleAnalytics.mockResolvedValue({
      totalTasks: 25,
      completedTasks: 10,
      inProgressTasks: 8,
      notStartedTasks: 7,
      delayedTasks: 3,
      criticalTasks: 8,
      averageTaskDuration: 15,
      longestTask: { name: 'Foundation', duration: 45 },
      upcomingMilestones: [
        { name: 'Foundation Complete', date: '2024-06-20', daysUntil: 5, status: 'IN_PROGRESS' },
        { name: 'Framing Start', date: '2024-07-01', daysUntil: 16, status: 'NOT_STARTED' },
      ],
    });

    const result = await generateExecutiveSummary('project-1');

    expect(result).toBeDefined();
    expect(result.type).toBe('EXECUTIVE_SUMMARY');
    expect(result.title).toBe('Executive Summary - Office Building');
    expect(result.projectId).toBe('project-1');
    expect(result.projectName).toBe('Office Building');
    expect(result.sections).toHaveLength(6);
    expect(result.recommendations).toBeInstanceOf(Array);
    expect(result.summary).toContain('Office Building');
    expect(result.summary).toContain('65%');

    // Verify section structure
    const overviewSection = result.sections.find(s => s.id === 'overview');
    expect(overviewSection).toBeDefined();
    expect(overviewSection?.title).toBe('Project Overview');
    expect(overviewSection?.type).toBe('kpi');
    expect(overviewSection?.data.percentComplete).toBe(65);

    const scheduleSection = result.sections.find(s => s.id === 'schedule-status');
    expect(scheduleSection?.data.spi).toBe(1.1);

    const budgetSection = result.sections.find(s => s.id === 'budget-status');
    expect(budgetSection?.data.cpi).toBe(0.95);
  });

  it('should include recommendations for poor performance', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Delayed Project',
      createdAt: new Date('2024-01-01'),
    });

    mockAnalytics.calculateProjectKPIs.mockResolvedValue({
      percentComplete: 30,
      daysRemaining: 90,
      budgetUtilization: 45,
      schedulePerformanceIndex: 0.8,
      scheduleVariance: -15,
      tasksOnTrack: 5,
      tasksDelayed: 8,
      criticalPathTasks: 12,
      costPerformanceIndex: 0.85,
      costVariance: -200000,
      estimateAtCompletion: 2500000,
      varianceAtCompletion: -300000,
      pendingChangeOrders: 5,
      safetyScore: 75,
    });

    mockAnalytics.getProgressTrends.mockResolvedValue([]);
    mockAnalytics.getCostBreakdown.mockResolvedValue([]);
    mockAnalytics.getScheduleAnalytics.mockResolvedValue({
      totalTasks: 20,
      completedTasks: 5,
      inProgressTasks: 7,
      notStartedTasks: 8,
      delayedTasks: 8,
      criticalTasks: 12,
      averageTaskDuration: 10,
      longestTask: null,
      upcomingMilestones: [],
    });

    const result = await generateExecutiveSummary('project-1');

    expect(result.recommendations).toContain('Schedule performance is below target. Review critical path and consider acceleration measures.');
    expect(result.recommendations).toContain('Cost performance indicates potential overrun. Review spending and identify cost-saving opportunities.');
    expect(result.recommendations.some(r => r.includes('tasks are delayed'))).toBe(true);
    expect(result.recommendations.some(r => r.includes('change orders pending'))).toBe(true);
    expect(result.recommendations.some(r => r.includes('Safety score below target'))).toBe(true);
  });

  it('should format currency values correctly', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Test Project',
      createdAt: new Date('2024-01-01'),
    });

    mockAnalytics.calculateProjectKPIs.mockResolvedValue({
      percentComplete: 50,
      daysRemaining: 60,
      budgetUtilization: 50,
      schedulePerformanceIndex: 1.0,
      scheduleVariance: 0,
      tasksOnTrack: 10,
      tasksDelayed: 0,
      criticalPathTasks: 5,
      costPerformanceIndex: 1.0,
      costVariance: 1234567,
      estimateAtCompletion: 9876543,
      varianceAtCompletion: -2345678,
    });

    mockAnalytics.getProgressTrends.mockResolvedValue([]);
    mockAnalytics.getCostBreakdown.mockResolvedValue([]);
    mockAnalytics.getScheduleAnalytics.mockResolvedValue({
      totalTasks: 10,
      completedTasks: 5,
      inProgressTasks: 5,
      notStartedTasks: 0,
      delayedTasks: 0,
      criticalTasks: 5,
      averageTaskDuration: 10,
      longestTask: null,
      upcomingMilestones: [],
    });

    const result = await generateExecutiveSummary('project-1');

    const budgetSection = result.sections.find(s => s.id === 'budget-status');
    expect(budgetSection?.data.costVariance).toMatch(/\$1,234,567/);
    expect(budgetSection?.data.eac).toMatch(/\$9,876,543/);
    expect(budgetSection?.data.vac).toMatch(/-\$2,345,678/);
  });
});

describe('Report Generator - generateProgressReport()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should throw error when project not found', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);

    await expect(generateProgressReport('invalid-project')).rejects.toThrow('Project not found');
  });

  it('should generate weekly progress report', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Construction Project',
      createdAt: new Date('2024-01-01'),
    });

    mockAnalytics.calculateProjectKPIs.mockResolvedValue({
      percentComplete: 55,
      schedulePerformanceIndex: 1.05,
      scheduleVariance: 3,
      daysRemaining: 50,
      tasksCompletedThisWeek: 5,
    });

    mockAnalytics.getScheduleAnalytics.mockResolvedValue({
      totalTasks: 30,
      completedTasks: 12,
      inProgressTasks: 10,
      notStartedTasks: 8,
      delayedTasks: 2,
      criticalTasks: 8,
      averageTaskDuration: 12,
      longestTask: null,
      upcomingMilestones: [],
    });

    mockAnalytics.getTeamPerformance.mockResolvedValue([
      { crewId: 'crew-1', crewName: 'Concrete Crew', memberCount: 6, averageProductivity: 85, hoursLogged: 240 },
      { crewId: 'crew-2', crewName: 'Steel Crew', memberCount: 8, averageProductivity: 90, hoursLogged: 320 },
    ]);

    mockAnalytics.getProgressTrends.mockResolvedValue([
      { date: 'Jun 08', plannedProgress: 50, actualProgress: 52, plannedCost: 1000000, actualCost: 980000, earnedValue: 1040000 },
      { date: 'Jun 15', plannedProgress: 55, actualProgress: 55, plannedCost: 1100000, actualCost: 1075000, earnedValue: 1100000 },
    ]);

    mockPrisma.dailyReport.findMany.mockResolvedValue([
      { id: 'dr-1', createdAt: new Date('2024-06-14'), weatherCondition: 'SUNNY', status: 'ON_TRACK' },
      { id: 'dr-2', createdAt: new Date('2024-06-13'), weatherCondition: 'CLOUDY', status: 'ON_TRACK' },
      { id: 'dr-3', createdAt: new Date('2024-06-12'), weatherCondition: 'RAINY', status: 'DELAYED' },
    ]);

    const result = await generateProgressReport('project-1', 'weekly');

    expect(result.type).toBe('PROGRESS_REPORT');
    expect(result.title).toBe('Weekly Progress Report - Construction Project');
    expect(result.sections).toHaveLength(6);
    expect(result.summary).toContain('55%');
    expect(result.summary).toContain('1.05');
    expect(result.summary).toContain('5 tasks completed this week');

    const progressSummary = result.sections.find(s => s.id === 'progress-summary');
    expect(progressSummary?.data.overallProgress).toBe('55%');
    expect(progressSummary?.data.tasksCompleted).toBe(12);

    const teamSection = result.sections.find(s => s.id === 'team-performance');
    expect(teamSection?.data).toHaveLength(2);
  });

  it('should generate monthly progress report', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Monthly Project',
      createdAt: new Date('2024-01-01'),
    });

    mockAnalytics.calculateProjectKPIs.mockResolvedValue({
      percentComplete: 70,
      schedulePerformanceIndex: 0.95,
      scheduleVariance: -3,
      daysRemaining: 30,
      tasksCompletedThisWeek: 8,
    });

    mockAnalytics.getScheduleAnalytics.mockResolvedValue({
      totalTasks: 20,
      completedTasks: 14,
      inProgressTasks: 4,
      notStartedTasks: 2,
      delayedTasks: 1,
      criticalTasks: 5,
      averageTaskDuration: 10,
      longestTask: null,
      upcomingMilestones: [],
    });

    mockAnalytics.getTeamPerformance.mockResolvedValue([]);
    mockAnalytics.getProgressTrends.mockResolvedValue([]);
    mockPrisma.dailyReport.findMany.mockResolvedValue([]);

    const result = await generateProgressReport('project-1', 'monthly');

    expect(result.title).toBe('Monthly Progress Report - Monthly Project');
    expect(result.type).toBe('PROGRESS_REPORT');
  });

  it('should add recommendations for schedule issues', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Behind Schedule',
      createdAt: new Date('2024-01-01'),
    });

    mockAnalytics.calculateProjectKPIs.mockResolvedValue({
      percentComplete: 40,
      schedulePerformanceIndex: 0.85,
      scheduleVariance: -10,
      daysRemaining: 80,
      tasksCompletedThisWeek: 0,
    });

    mockAnalytics.getScheduleAnalytics.mockResolvedValue({
      totalTasks: 25,
      completedTasks: 8,
      inProgressTasks: 12,
      notStartedTasks: 5,
      delayedTasks: 5,
      criticalTasks: 10,
      averageTaskDuration: 15,
      longestTask: null,
      upcomingMilestones: [],
    });

    mockAnalytics.getTeamPerformance.mockResolvedValue([]);
    mockAnalytics.getProgressTrends.mockResolvedValue([]);
    mockPrisma.dailyReport.findMany.mockResolvedValue([]);

    const result = await generateProgressReport('project-1', 'weekly');

    expect(result.recommendations).toContain('Schedule is behind target. Consider adding resources to critical path tasks.');
    expect(result.recommendations.some(r => r.includes('tasks are delayed'))).toBe(true);
    expect(result.recommendations).toContain('No tasks completed this week. Investigate potential blockers.');
  });

  it('should handle daily reports with null weather', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Test Project',
      createdAt: new Date('2024-01-01'),
    });

    mockAnalytics.calculateProjectKPIs.mockResolvedValue({
      percentComplete: 50,
      schedulePerformanceIndex: 1.0,
      scheduleVariance: 0,
      daysRemaining: 50,
      tasksCompletedThisWeek: 3,
    });

    mockAnalytics.getScheduleAnalytics.mockResolvedValue({
      totalTasks: 20,
      completedTasks: 10,
      inProgressTasks: 8,
      notStartedTasks: 2,
      delayedTasks: 0,
      criticalTasks: 5,
      averageTaskDuration: 10,
      longestTask: null,
      upcomingMilestones: [],
    });

    mockAnalytics.getTeamPerformance.mockResolvedValue([]);
    mockAnalytics.getProgressTrends.mockResolvedValue([]);

    mockPrisma.dailyReport.findMany.mockResolvedValue([
      { id: 'dr-1', createdAt: new Date('2024-06-14'), weatherCondition: null, status: 'ON_TRACK' },
    ]);

    const result = await generateProgressReport('project-1', 'weekly');

    const dailyReportsSection = result.sections.find(s => s.id === 'daily-reports');
    expect(dailyReportsSection?.data[0].weather).toBe('N/A');
  });
});

describe('Report Generator - generateCostReport()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should throw error when project not found', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);

    await expect(generateCostReport('invalid-project')).rejects.toThrow('Project not found');
  });

  it('should generate cost report with all sections', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Budget Project',
      createdAt: new Date('2024-01-01'),
    });

    mockAnalytics.calculateProjectKPIs.mockResolvedValue({
      budgetUtilization: 75,
      costVariance: -100000,
      estimateAtCompletion: 2200000,
      varianceAtCompletion: -200000,
      costPerformanceIndex: 0.92,
      pendingChangeOrders: 2,
    });

    mockAnalytics.getCostBreakdown.mockResolvedValue([
      { category: 'CONCRETE', budgeted: 600000, committed: 580000, actual: 590000, variance: 10000, percentOfBudget: 30 },
      { category: 'STEEL', budgeted: 500000, committed: 520000, actual: 510000, variance: -10000, percentOfBudget: 25 },
      { category: 'ELECTRICAL', budgeted: 300000, committed: 290000, actual: 295000, variance: 5000, percentOfBudget: 15 },
    ]);

    mockAnalytics.getProgressTrends.mockResolvedValue([
      { date: 'Jan 2024', plannedProgress: 20, actualProgress: 18, plannedCost: 400000, actualCost: 420000, earnedValue: 360000 },
      { date: 'Feb 2024', plannedProgress: 40, actualProgress: 38, plannedCost: 800000, actualCost: 850000, earnedValue: 760000 },
    ]);

    mockPrisma.changeOrder.findMany.mockResolvedValue([
      { id: 'co-1', status: 'APPROVED', proposedAmount: 50000, approvedAmount: 45000, createdAt: new Date('2024-05-01') },
      { id: 'co-2', status: 'APPROVED', proposedAmount: 30000, approvedAmount: 30000, createdAt: new Date('2024-05-15') },
      { id: 'co-3', status: 'PENDING', proposedAmount: 25000, approvedAmount: null, createdAt: new Date('2024-06-01') },
    ]);

    mockPrisma.paymentApplication.findMany.mockResolvedValue([
      {
        id: 'pa-1',
        applicationNumber: '001',
        periodStart: new Date('2024-05-01'),
        periodEnd: new Date('2024-05-31'),
        netDue: 250000,
        status: 'APPROVED',
      },
      {
        id: 'pa-2',
        applicationNumber: '002',
        periodStart: new Date('2024-06-01'),
        periodEnd: new Date('2024-06-15'),
        netDue: 180000,
        status: 'SUBMITTED',
      },
    ]);

    const result = await generateCostReport('project-1');

    expect(result.type).toBe('COST_REPORT');
    expect(result.title).toBe('Cost Report - Budget Project');
    expect(result.sections).toHaveLength(6);

    const budgetOverview = result.sections.find(s => s.id === 'budget-overview');
    expect(budgetOverview?.data.budgetUtilization).toBe('75%');

    const evmMetrics = result.sections.find(s => s.id === 'evm-metrics');
    expect(evmMetrics?.data.cpi).toBe(0.92);
    expect(evmMetrics?.data.status).toBe('Over Budget');

    const changeOrdersSection = result.sections.find(s => s.id === 'change-orders');
    expect(changeOrdersSection?.data.totalCOs).toBe(3);
    expect(changeOrdersSection?.data.approved).toBe(2);
    expect(changeOrdersSection?.data.totalValue).toMatch(/\$75,000/);

    const paymentApps = result.sections.find(s => s.id === 'payment-apps');
    expect(paymentApps?.data).toHaveLength(2);
  });

  it('should handle change orders with null approved amount', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Test Project',
      createdAt: new Date('2024-01-01'),
    });

    mockAnalytics.calculateProjectKPIs.mockResolvedValue({
      budgetUtilization: 50,
      costVariance: 0,
      estimateAtCompletion: 2000000,
      varianceAtCompletion: 0,
      costPerformanceIndex: 1.0,
      pendingChangeOrders: 1,
    });

    mockAnalytics.getCostBreakdown.mockResolvedValue([]);
    mockAnalytics.getProgressTrends.mockResolvedValue([]);

    mockPrisma.changeOrder.findMany.mockResolvedValue([
      { id: 'co-1', status: 'APPROVED', proposedAmount: 40000, approvedAmount: null, createdAt: new Date('2024-05-01') },
    ]);

    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);

    const result = await generateCostReport('project-1');

    const changeOrdersSection = result.sections.find(s => s.id === 'change-orders');
    expect(changeOrdersSection?.data.totalValue).toMatch(/\$40,000/);
  });

  it('should add recommendations for cost overruns', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Over Budget Project',
      createdAt: new Date('2024-01-01'),
    });

    mockAnalytics.calculateProjectKPIs.mockResolvedValue({
      budgetUtilization: 95,
      costVariance: -300000,
      estimateAtCompletion: 2800000,
      varianceAtCompletion: -500000,
      costPerformanceIndex: 0.88,
      pendingChangeOrders: 5,
    });

    mockAnalytics.getCostBreakdown.mockResolvedValue([]);
    mockAnalytics.getProgressTrends.mockResolvedValue([]);
    mockPrisma.changeOrder.findMany.mockResolvedValue([]);
    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);

    const result = await generateCostReport('project-1');

    expect(result.recommendations).toContain('Project is trending over budget. Review spending in top cost categories.');
    expect(result.recommendations.some(r => r.includes('change orders pending approval'))).toBe(true);
  });

  it('should show under budget status when CPI >= 1', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Efficient Project',
      createdAt: new Date('2024-01-01'),
    });

    mockAnalytics.calculateProjectKPIs.mockResolvedValue({
      budgetUtilization: 60,
      costVariance: 50000,
      estimateAtCompletion: 1900000,
      varianceAtCompletion: 100000,
      costPerformanceIndex: 1.05,
      pendingChangeOrders: 0,
    });

    mockAnalytics.getCostBreakdown.mockResolvedValue([]);
    mockAnalytics.getProgressTrends.mockResolvedValue([]);
    mockPrisma.changeOrder.findMany.mockResolvedValue([]);
    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);

    const result = await generateCostReport('project-1');

    const evmMetrics = result.sections.find(s => s.id === 'evm-metrics');
    expect(evmMetrics?.data.status).toBe('Under Budget');
  });
});

describe('Report Generator - generateMEPReport()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should throw error when project not found', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);

    await expect(generateMEPReport('invalid-project')).rejects.toThrow('Project not found');
  });

  it('should generate MEP report with all sections', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'MEP Project',
      createdAt: new Date('2024-01-01'),
    });

    mockAnalytics.getMEPAnalytics.mockResolvedValue([
      { systemType: 'MECHANICAL', totalItems: 50, installed: 40, tested: 35, commissioned: 30, installationRate: 80 },
      { systemType: 'ELECTRICAL', totalItems: 75, installed: 60, tested: 50, commissioned: 45, installationRate: 80 },
      { systemType: 'PLUMBING', totalItems: 60, installed: 25, tested: 20, commissioned: 15, installationRate: 42 },
    ]);

    mockPrisma.mEPEquipment.findMany.mockResolvedValue([
      {
        id: 'eq-1',
        equipmentType: 'HVAC',
        name: 'Air Handler Unit #1',
        notes: 'Missing startup documentation',
        status: 'DEFICIENT',
        updatedAt: new Date('2024-06-10'),
      },
      {
        id: 'eq-2',
        equipmentType: 'ELECTRICAL',
        name: 'Panel Board A',
        notes: null,
        status: 'DEFICIENT',
        updatedAt: new Date('2024-06-12'),
      },
    ]);

    mockPrisma.mEPSubmittal.findMany.mockResolvedValue([
      {
        id: 'sub-1',
        submittalType: 'SHOP_DRAWING',
        submittalNumber: 'SD-001',
        submittedDate: new Date('2024-06-01'),
        status: 'UNDER_REVIEW',
      },
      {
        id: 'sub-2',
        submittalType: 'PRODUCT_DATA',
        submittalNumber: 'PD-005',
        submittedDate: new Date('2024-06-10'),
        status: 'SUBMITTED',
      },
    ]);

    const result = await generateMEPReport('project-1');

    expect(result.type).toBe('MEP_REPORT');
    expect(result.title).toBe('MEP Status Report - MEP Project');
    expect(result.sections).toHaveLength(4);

    const overview = result.sections.find(s => s.id === 'mep-overview');
    expect(overview?.data).toHaveLength(3);
    expect(overview?.data[0].system).toBe('MECHANICAL');
    expect(overview?.data[0].progress).toBe('80%');

    const deficientEquipment = result.sections.find(s => s.id === 'deficient-equipment');
    expect(deficientEquipment?.data).toHaveLength(2);
    expect(deficientEquipment?.data[0].notes).toBe('Missing startup documentation');
    expect(deficientEquipment?.data[1].notes).toBe('No notes');

    const submittals = result.sections.find(s => s.id === 'pending-submittals');
    expect(submittals?.data).toHaveLength(2);
  });

  it('should add recommendations for deficient equipment', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'MEP Issues',
      createdAt: new Date('2024-01-01'),
    });

    mockAnalytics.getMEPAnalytics.mockResolvedValue([
      { systemType: 'MECHANICAL', totalItems: 100, installed: 40, tested: 30, commissioned: 20, installationRate: 40 },
      { systemType: 'ELECTRICAL', totalItems: 80, installed: 35, tested: 25, commissioned: 15, installationRate: 44 },
    ]);

    mockPrisma.mEPEquipment.findMany.mockResolvedValue([
      { id: 'eq-1', equipmentType: 'HVAC', name: 'Unit 1', notes: 'Issue', status: 'DEFICIENT', updatedAt: new Date() },
      { id: 'eq-2', equipmentType: 'HVAC', name: 'Unit 2', notes: 'Issue', status: 'DEFICIENT', updatedAt: new Date() },
      { id: 'eq-3', equipmentType: 'HVAC', name: 'Unit 3', notes: 'Issue', status: 'DEFICIENT', updatedAt: new Date() },
    ]);

    mockPrisma.mEPSubmittal.findMany.mockResolvedValue([]);

    const result = await generateMEPReport('project-1');

    expect(result.recommendations.some(r => r.includes('3 MEP equipment items marked as deficient'))).toBe(true);
    expect(result.recommendations.some(r => r.includes('below 50% installation'))).toBe(true);
  });

  it('should handle no deficiencies gracefully', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Smooth MEP',
      createdAt: new Date('2024-01-01'),
    });

    mockAnalytics.getMEPAnalytics.mockResolvedValue([
      { systemType: 'MECHANICAL', totalItems: 50, installed: 48, tested: 45, commissioned: 40, installationRate: 96 },
    ]);

    mockPrisma.mEPEquipment.findMany.mockResolvedValue([]);
    mockPrisma.mEPSubmittal.findMany.mockResolvedValue([]);

    const result = await generateMEPReport('project-1');

    expect(result.recommendations).toHaveLength(0);
  });

  it('should handle null submittal date', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Test MEP',
      createdAt: new Date('2024-01-01'),
    });

    mockAnalytics.getMEPAnalytics.mockResolvedValue([]);

    mockPrisma.mEPEquipment.findMany.mockResolvedValue([]);

    mockPrisma.mEPSubmittal.findMany.mockResolvedValue([
      {
        id: 'sub-1',
        submittalType: 'PRODUCT_DATA',
        submittalNumber: 'PD-001',
        submittedDate: null,
        status: 'SUBMITTED',
      },
    ]);

    const result = await generateMEPReport('project-1');

    const submittals = result.sections.find(s => s.id === 'pending-submittals');
    expect(submittals?.data[0].date).toBe('N/A');
  });
});

describe('Report Generator - generateResourceReport()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should throw error when project not found', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);

    await expect(generateResourceReport('invalid-project')).rejects.toThrow('Project not found');
  });

  it('should generate resource report with utilization data', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Resource Project',
      createdAt: new Date('2024-01-01'),
    });

    mockAnalytics.getResourceUtilization.mockResolvedValue([
      { resourceType: 'LABOR', allocated: 100, utilized: 85, utilizationRate: 85, trend: 'up' },
      { resourceType: 'EQUIPMENT', allocated: 50, utilized: 40, utilizationRate: 80, trend: 'up' },
      { resourceType: 'MATERIALS', allocated: 200, utilized: 120, utilizationRate: 60, trend: 'stable' },
    ]);

    mockAnalytics.getTeamPerformance.mockResolvedValue([
      { crewId: 'crew-1', crewName: 'Foundation Crew', memberCount: 8, averageProductivity: 88, hoursLogged: 320 },
      { crewId: 'crew-2', crewName: 'Framing Crew', memberCount: 10, averageProductivity: 92, hoursLogged: 400 },
    ]);

    mockAnalytics.calculateProjectKPIs.mockResolvedValue({
      averageCrewSize: 9,
      workHoursLogged: 720,
    });

    const result = await generateResourceReport('project-1');

    expect(result.type).toBe('RESOURCE_REPORT');
    expect(result.title).toBe('Resource Report - Resource Project');
    expect(result.sections).toHaveLength(4);

    const resourceSummary = result.sections.find(s => s.id === 'resource-summary');
    expect(resourceSummary?.data.totalCrews).toBe(2);
    expect(resourceSummary?.data.totalWorkers).toBe(18);
    expect(resourceSummary?.data.avgCrewSize).toBe(9);
    expect(resourceSummary?.data.hoursLogged).toBe(720);

    const utilization = result.sections.find(s => s.id === 'utilization');
    expect(utilization?.data).toHaveLength(3);
  });

  it('should add recommendations for underutilized resources', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Low Utilization',
      createdAt: new Date('2024-01-01'),
    });

    mockAnalytics.getResourceUtilization.mockResolvedValue([
      { resourceType: 'LABOR', allocated: 100, utilized: 45, utilizationRate: 45, trend: 'down' },
      { resourceType: 'EQUIPMENT', allocated: 50, utilized: 40, utilizationRate: 80, trend: 'stable' },
    ]);

    mockAnalytics.getTeamPerformance.mockResolvedValue([]);

    mockAnalytics.calculateProjectKPIs.mockResolvedValue({
      averageCrewSize: 5,
      workHoursLogged: 200,
    });

    const result = await generateResourceReport('project-1');

    expect(result.recommendations.some(r => r.includes('LABOR resources are underutilized'))).toBe(true);
  });

  it('should add recommendations for overutilized resources', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'High Utilization',
      createdAt: new Date('2024-01-01'),
    });

    mockAnalytics.getResourceUtilization.mockResolvedValue([
      { resourceType: 'LABOR', allocated: 100, utilized: 110, utilizationRate: 110, trend: 'up' },
      { resourceType: 'EQUIPMENT', allocated: 50, utilized: 55, utilizationRate: 110, trend: 'up' },
    ]);

    mockAnalytics.getTeamPerformance.mockResolvedValue([]);

    mockAnalytics.calculateProjectKPIs.mockResolvedValue({
      averageCrewSize: 12,
      workHoursLogged: 960,
    });

    const result = await generateResourceReport('project-1');

    expect(result.recommendations.some(r => r.includes('LABOR, EQUIPMENT resources are overallocated'))).toBe(true);
  });

  it('should handle empty resource data', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Empty Resources',
      createdAt: new Date('2024-01-01'),
    });

    mockAnalytics.getResourceUtilization.mockResolvedValue([]);
    mockAnalytics.getTeamPerformance.mockResolvedValue([]);
    mockAnalytics.calculateProjectKPIs.mockResolvedValue({
      averageCrewSize: 0,
      workHoursLogged: 0,
    });

    const result = await generateResourceReport('project-1');

    const resourceSummary = result.sections.find(s => s.id === 'resource-summary');
    expect(resourceSummary?.data.totalCrews).toBe(0);
    expect(resourceSummary?.data.totalWorkers).toBe(0);
  });
});

describe('Report Generator - generateCustomReport()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should throw error when project not found', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);

    const config: ReportConfig = {
      type: 'CUSTOM',
      projectId: 'invalid-project',
      sections: ['kpis'],
    };

    await expect(generateCustomReport(config)).rejects.toThrow('Project not found');
  });

  it('should generate custom report with KPIs section', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Custom Project',
      createdAt: new Date('2024-01-01'),
    });

    const mockKPIs = {
      percentComplete: 60,
      schedulePerformanceIndex: 1.05,
      costPerformanceIndex: 0.98,
      budgetUtilization: 65,
    };

    mockAnalytics.calculateProjectKPIs.mockResolvedValue(mockKPIs);

    const config: ReportConfig = {
      type: 'CUSTOM',
      projectId: 'project-1',
      sections: ['kpis'],
    };

    const result = await generateCustomReport(config);

    expect(result.type).toBe('CUSTOM');
    expect(result.title).toBe('Custom Report - Custom Project');
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].id).toBe('kpis');
    expect(result.sections[0].data).toEqual(mockKPIs);
  });

  it('should generate custom report with multiple sections', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Multi Section',
      createdAt: new Date('2024-01-01'),
    });

    mockAnalytics.calculateProjectKPIs.mockResolvedValue({ percentComplete: 50 });
    mockAnalytics.getScheduleAnalytics.mockResolvedValue({ totalTasks: 20, completedTasks: 10 });
    mockAnalytics.getCostBreakdown.mockResolvedValue([{ category: 'CONCRETE', budgeted: 100000 }]);
    mockAnalytics.getResourceUtilization.mockResolvedValue([{ resourceType: 'LABOR', utilized: 50 }]);
    mockAnalytics.getMEPAnalytics.mockResolvedValue([{ systemType: 'MECHANICAL', totalItems: 30 }]);
    mockAnalytics.getDocumentAnalytics.mockResolvedValue({ totalDocuments: 25 });
    mockAnalytics.getProgressTrends.mockResolvedValue([{ date: 'Jun 15', actualProgress: 50 }]);
    mockAnalytics.getTeamPerformance.mockResolvedValue([{ crewId: 'crew-1', crewName: 'Test' }]);

    const config: ReportConfig = {
      type: 'CUSTOM',
      projectId: 'project-1',
      sections: ['kpis', 'schedule', 'budget', 'resources', 'mep', 'documents', 'trends', 'team'],
    };

    const result = await generateCustomReport(config);

    expect(result.sections).toHaveLength(8);
    expect(result.sections.map(s => s.id)).toEqual(['kpis', 'schedule', 'budget', 'resources', 'mep', 'documents', 'trends', 'team']);
  });

  it('should use custom title if provided', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Test Project',
      createdAt: new Date('2024-01-01'),
    });

    mockAnalytics.calculateProjectKPIs.mockResolvedValue({});

    const config: ReportConfig = {
      type: 'CUSTOM',
      projectId: 'project-1',
      title: 'Executive Summary Q2 2024',
      sections: ['kpis'],
    };

    const result = await generateCustomReport(config);

    expect(result.title).toBe('Executive Summary Q2 2024');
  });

  it('should use custom date range if provided', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Test Project',
      createdAt: new Date('2024-01-01'),
    });

    mockAnalytics.calculateProjectKPIs.mockResolvedValue({});

    const config: ReportConfig = {
      type: 'CUSTOM',
      projectId: 'project-1',
      sections: ['kpis'],
      dateRange: {
        start: new Date('2024-04-01T00:00:00Z'),
        end: new Date('2024-06-30T00:00:00Z'),
      },
    };

    const result = await generateCustomReport(config);

    expect(result.dateRange.start).toBe('Mar 31, 2024');
    expect(result.dateRange.end).toBe('Jun 29, 2024');
  });

  it('should handle empty sections array', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Empty Report',
      createdAt: new Date('2024-01-01'),
    });

    mockAnalytics.calculateProjectKPIs.mockResolvedValue({});

    const config: ReportConfig = {
      type: 'CUSTOM',
      projectId: 'project-1',
      sections: [],
    };

    const result = await generateCustomReport(config);

    expect(result.sections).toHaveLength(0);
    expect(result.summary).toBe('Custom report with 0 sections.');
  });
});

describe('Report Generator - reportToCSV()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should convert report to CSV format', () => {
    const report: GeneratedReport = {
      id: 'report-1',
      type: 'CUSTOM',
      title: 'Test Report',
      generatedAt: new Date('2024-06-15T12:00:00Z'),
      projectId: 'project-1',
      projectName: 'Test Project',
      dateRange: { start: 'Jun 01, 2024', end: 'Jun 15, 2024' },
      sections: [
        {
          id: 'kpi',
          title: 'Key Metrics',
          type: 'kpi',
          data: {
            percentComplete: 60,
            budgetUtilization: 70,
          },
        },
        {
          id: 'costs',
          title: 'Cost Breakdown',
          type: 'table',
          data: [
            { category: 'CONCRETE', budgeted: 500000, actual: 490000 },
            { category: 'STEEL', budgeted: 400000, actual: 410000 },
          ],
        },
      ],
      summary: 'Project is 60% complete.',
      recommendations: ['Continue monitoring budget', 'Review schedule'],
    };

    const csv = reportToCSV(report);

    expect(csv).toContain('Report: Test Report');
    expect(csv).toContain('Generated: 2024-06-15 08:00:00');
    expect(csv).toContain('Project: Test Project');
    expect(csv).toContain('Period: Jun 01, 2024 - Jun 15, 2024');
    expect(csv).toContain('Summary: Project is 60% complete.');
    expect(csv).toContain('=== Key Metrics ===');
    expect(csv).toContain('percentComplete,60');
    expect(csv).toContain('budgetUtilization,70');
    expect(csv).toContain('=== Cost Breakdown ===');
    expect(csv).toContain('category,budgeted,actual');
    expect(csv).toContain('CONCRETE,500000,490000');
    expect(csv).toContain('STEEL,400000,410000');
    expect(csv).toContain('=== Recommendations ===');
    expect(csv).toContain('1. Continue monitoring budget');
    expect(csv).toContain('2. Review schedule');
  });

  it('should handle empty table data', () => {
    const report: GeneratedReport = {
      id: 'report-1',
      type: 'CUSTOM',
      title: 'Empty Report',
      generatedAt: new Date('2024-06-15T12:00:00Z'),
      projectId: 'project-1',
      projectName: 'Test Project',
      dateRange: { start: 'Jun 01, 2024', end: 'Jun 15, 2024' },
      sections: [
        {
          id: 'empty-table',
          title: 'Empty Table',
          type: 'table',
          data: [],
        },
      ],
      summary: 'No data',
      recommendations: [],
    };

    const csv = reportToCSV(report);

    expect(csv).toContain('=== Empty Table ===');
    expect(csv).not.toContain('category');
  });

  it('should handle non-table section types', () => {
    const report: GeneratedReport = {
      id: 'report-1',
      type: 'CUSTOM',
      title: 'Chart Report',
      generatedAt: new Date('2024-06-15T12:00:00Z'),
      projectId: 'project-1',
      projectName: 'Test Project',
      dateRange: { start: 'Jun 01, 2024', end: 'Jun 15, 2024' },
      sections: [
        {
          id: 'chart',
          title: 'Progress Chart',
          type: 'chart',
          data: { labels: ['Week 1', 'Week 2'], values: [50, 60] },
        },
      ],
      summary: 'Chart data',
      recommendations: [],
    };

    const csv = reportToCSV(report);

    expect(csv).toContain('=== Progress Chart ===');
    // Chart data is not converted to CSV table format
  });

  it('should handle null values in table data', () => {
    const report: GeneratedReport = {
      id: 'report-1',
      type: 'CUSTOM',
      title: 'Null Values',
      generatedAt: new Date('2024-06-15T12:00:00Z'),
      projectId: 'project-1',
      projectName: 'Test Project',
      dateRange: { start: 'Jun 01, 2024', end: 'Jun 15, 2024' },
      sections: [
        {
          id: 'data',
          title: 'Data with Nulls',
          type: 'table',
          data: [
            { name: 'Item 1', value: 100, notes: null },
            { name: 'Item 2', value: null, notes: 'Some note' },
          ],
        },
      ],
      summary: 'Test',
      recommendations: [],
    };

    const csv = reportToCSV(report);

    expect(csv).toContain('name,value,notes');
    expect(csv).toContain('Item 1,100,');
    expect(csv).toContain('Item 2,,Some note');
  });
});

describe('Report Generator - reportToJSON()', () => {
  it('should convert report to JSON string', () => {
    const report: GeneratedReport = {
      id: 'report-1',
      type: 'PROGRESS_REPORT',
      title: 'Weekly Progress',
      generatedAt: new Date('2024-06-15T12:00:00Z'),
      projectId: 'project-1',
      projectName: 'Test Project',
      dateRange: { start: 'Jun 08, 2024', end: 'Jun 15, 2024' },
      sections: [
        {
          id: 'overview',
          title: 'Overview',
          type: 'kpi',
          data: { percentComplete: 55 },
        },
      ],
      summary: 'Project is on track',
      recommendations: ['Continue current pace'],
    };

    const json = reportToJSON(report);
    const parsed = JSON.parse(json);

    expect(parsed.id).toBe('report-1');
    expect(parsed.type).toBe('PROGRESS_REPORT');
    expect(parsed.title).toBe('Weekly Progress');
    expect(parsed.projectId).toBe('project-1');
    expect(parsed.sections).toHaveLength(1);
    expect(parsed.summary).toBe('Project is on track');
  });

  it('should handle complex nested data', () => {
    const report: GeneratedReport = {
      id: 'report-1',
      type: 'CUSTOM',
      title: 'Complex Report',
      generatedAt: new Date('2024-06-15T12:00:00Z'),
      projectId: 'project-1',
      projectName: 'Test Project',
      dateRange: { start: 'Jun 01, 2024', end: 'Jun 15, 2024' },
      sections: [
        {
          id: 'nested',
          title: 'Nested Data',
          type: 'table',
          data: [
            {
              category: 'CONCRETE',
              breakdown: {
                labor: 50000,
                materials: 100000,
                equipment: 25000,
              },
            },
          ],
        },
      ],
      summary: 'Complex data structure',
      recommendations: [],
    };

    const json = reportToJSON(report);
    const parsed = JSON.parse(json);

    expect(parsed.sections[0].data[0].breakdown.labor).toBe(50000);
    expect(parsed.sections[0].data[0].breakdown.materials).toBe(100000);
  });
});

describe('Report Generator - Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatCurrency()', () => {
    it('should format positive numbers as currency', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Test',
        createdAt: new Date('2024-01-01'),
      });

      mockAnalytics.calculateProjectKPIs.mockResolvedValue({
        percentComplete: 50,
        daysRemaining: 30,
        budgetUtilization: 50,
        schedulePerformanceIndex: 1.0,
        scheduleVariance: 0,
        tasksOnTrack: 10,
        tasksDelayed: 0,
        criticalPathTasks: 5,
        costPerformanceIndex: 1.0,
        costVariance: 123456,
        estimateAtCompletion: 2000000,
        varianceAtCompletion: 0,
      });

      mockAnalytics.getProgressTrends.mockResolvedValue([]);
      mockAnalytics.getCostBreakdown.mockResolvedValue([]);
      mockAnalytics.getScheduleAnalytics.mockResolvedValue({
        totalTasks: 10,
        completedTasks: 5,
        inProgressTasks: 5,
        notStartedTasks: 0,
        delayedTasks: 0,
        criticalTasks: 5,
        averageTaskDuration: 10,
        longestTask: null,
        upcomingMilestones: [],
      });

      const result = await generateExecutiveSummary('project-1');
      const budgetSection = result.sections.find(s => s.id === 'budget-status');

      expect(budgetSection?.data.costVariance).toMatch(/\$123,456/);
    });

    it('should format negative numbers as currency', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Test',
        createdAt: new Date('2024-01-01'),
      });

      mockAnalytics.calculateProjectKPIs.mockResolvedValue({
        percentComplete: 50,
        daysRemaining: 30,
        budgetUtilization: 50,
        schedulePerformanceIndex: 1.0,
        scheduleVariance: 0,
        tasksOnTrack: 10,
        tasksDelayed: 0,
        criticalPathTasks: 5,
        costPerformanceIndex: 1.0,
        costVariance: 0,
        estimateAtCompletion: 2000000,
        varianceAtCompletion: -789012,
      });

      mockAnalytics.getProgressTrends.mockResolvedValue([]);
      mockAnalytics.getCostBreakdown.mockResolvedValue([]);
      mockAnalytics.getScheduleAnalytics.mockResolvedValue({
        totalTasks: 10,
        completedTasks: 5,
        inProgressTasks: 5,
        notStartedTasks: 0,
        delayedTasks: 0,
        criticalTasks: 5,
        averageTaskDuration: 10,
        longestTask: null,
        upcomingMilestones: [],
      });

      const result = await generateExecutiveSummary('project-1');
      const budgetSection = result.sections.find(s => s.id === 'budget-status');

      expect(budgetSection?.data.vac).toMatch(/-\$789,012/);
    });
  });

  describe('generateRecommendations()', () => {
    it('should return positive message when all metrics are good', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Excellent Project',
        createdAt: new Date('2024-01-01'),
      });

      mockAnalytics.calculateProjectKPIs.mockResolvedValue({
        percentComplete: 75,
        daysRemaining: 25,
        budgetUtilization: 70,
        schedulePerformanceIndex: 1.1,
        scheduleVariance: 5,
        tasksOnTrack: 20,
        tasksDelayed: 2,
        criticalPathTasks: 8,
        costPerformanceIndex: 1.05,
        costVariance: 50000,
        estimateAtCompletion: 1900000,
        varianceAtCompletion: 100000,
        pendingChangeOrders: 1,
        safetyScore: 95,
      });

      mockAnalytics.getProgressTrends.mockResolvedValue([]);
      mockAnalytics.getCostBreakdown.mockResolvedValue([]);
      mockAnalytics.getScheduleAnalytics.mockResolvedValue({
        totalTasks: 25,
        completedTasks: 20,
        inProgressTasks: 5,
        notStartedTasks: 0,
        delayedTasks: 2,
        criticalTasks: 8,
        averageTaskDuration: 10,
        longestTask: null,
        upcomingMilestones: [],
      });

      const result = await generateExecutiveSummary('project-1');

      expect(result.recommendations).toContain('Project metrics are within acceptable ranges. Continue monitoring.');
    });
  });

  describe('generateSummaryText()', () => {
    it('should generate on track status', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'On Track Project',
        createdAt: new Date('2024-01-01'),
      });

      mockAnalytics.calculateProjectKPIs.mockResolvedValue({
        percentComplete: 60,
        daysRemaining: 40,
        budgetUtilization: 60,
        schedulePerformanceIndex: 1.05,
        costPerformanceIndex: 1.02,
        scheduleVariance: 3,
        tasksOnTrack: 15,
        tasksDelayed: 1,
        criticalPathTasks: 6,
        costVariance: 20000,
        estimateAtCompletion: 1980000,
        varianceAtCompletion: 20000,
      });

      mockAnalytics.getProgressTrends.mockResolvedValue([]);
      mockAnalytics.getCostBreakdown.mockResolvedValue([]);
      mockAnalytics.getScheduleAnalytics.mockResolvedValue({
        totalTasks: 20,
        completedTasks: 12,
        inProgressTasks: 7,
        notStartedTasks: 1,
        delayedTasks: 1,
        criticalTasks: 6,
        averageTaskDuration: 10,
        longestTask: null,
        upcomingMilestones: [],
      });

      const result = await generateExecutiveSummary('project-1');

      expect(result.summary).toContain('on track');
      expect(result.summary).toContain('60%');
      expect(result.summary).toContain('40 days remaining');
    });

    it('should generate on schedule but over budget status', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Over Budget Project',
        createdAt: new Date('2024-01-01'),
      });

      mockAnalytics.calculateProjectKPIs.mockResolvedValue({
        percentComplete: 50,
        daysRemaining: 50,
        budgetUtilization: 60,
        schedulePerformanceIndex: 1.1,
        costPerformanceIndex: 0.9,
        scheduleVariance: 5,
        tasksOnTrack: 12,
        tasksDelayed: 2,
        criticalPathTasks: 7,
        costVariance: -100000,
        estimateAtCompletion: 2100000,
        varianceAtCompletion: -100000,
      });

      mockAnalytics.getProgressTrends.mockResolvedValue([]);
      mockAnalytics.getCostBreakdown.mockResolvedValue([]);
      mockAnalytics.getScheduleAnalytics.mockResolvedValue({
        totalTasks: 20,
        completedTasks: 10,
        inProgressTasks: 8,
        notStartedTasks: 2,
        delayedTasks: 2,
        criticalTasks: 7,
        averageTaskDuration: 12,
        longestTask: null,
        upcomingMilestones: [],
      });

      const result = await generateExecutiveSummary('project-1');

      expect(result.summary).toContain('on schedule but over budget');
    });

    it('should generate under budget but behind schedule status', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Behind Schedule Project',
        createdAt: new Date('2024-01-01'),
      });

      mockAnalytics.calculateProjectKPIs.mockResolvedValue({
        percentComplete: 45,
        daysRemaining: 55,
        budgetUtilization: 40,
        schedulePerformanceIndex: 0.85,
        costPerformanceIndex: 1.1,
        scheduleVariance: -8,
        tasksOnTrack: 8,
        tasksDelayed: 6,
        criticalPathTasks: 9,
        costVariance: 100000,
        estimateAtCompletion: 1900000,
        varianceAtCompletion: 100000,
      });

      mockAnalytics.getProgressTrends.mockResolvedValue([]);
      mockAnalytics.getCostBreakdown.mockResolvedValue([]);
      mockAnalytics.getScheduleAnalytics.mockResolvedValue({
        totalTasks: 22,
        completedTasks: 8,
        inProgressTasks: 10,
        notStartedTasks: 4,
        delayedTasks: 6,
        criticalTasks: 9,
        averageTaskDuration: 14,
        longestTask: null,
        upcomingMilestones: [],
      });

      const result = await generateExecutiveSummary('project-1');

      expect(result.summary).toContain('under budget but behind schedule');
    });

    it('should generate requiring attention status', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Troubled Project',
        createdAt: new Date('2024-01-01'),
      });

      mockAnalytics.calculateProjectKPIs.mockResolvedValue({
        percentComplete: 35,
        daysRemaining: 70,
        budgetUtilization: 50,
        schedulePerformanceIndex: 0.8,
        costPerformanceIndex: 0.85,
        scheduleVariance: -12,
        tasksOnTrack: 5,
        tasksDelayed: 10,
        criticalPathTasks: 12,
        costVariance: -250000,
        estimateAtCompletion: 2500000,
        varianceAtCompletion: -300000,
      });

      mockAnalytics.getProgressTrends.mockResolvedValue([]);
      mockAnalytics.getCostBreakdown.mockResolvedValue([]);
      mockAnalytics.getScheduleAnalytics.mockResolvedValue({
        totalTasks: 28,
        completedTasks: 7,
        inProgressTasks: 11,
        notStartedTasks: 10,
        delayedTasks: 10,
        criticalTasks: 12,
        averageTaskDuration: 16,
        longestTask: null,
        upcomingMilestones: [],
      });

      const result = await generateExecutiveSummary('project-1');

      expect(result.summary).toContain('requiring attention on both schedule and budget');
    });
  });
});
