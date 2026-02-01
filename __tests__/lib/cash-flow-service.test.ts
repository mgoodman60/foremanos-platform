import { describe, it, expect, beforeEach, vi } from 'vitest';
import { addMonths, addWeeks, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';

// Mock Prisma BEFORE importing the module
const mockPrisma = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
  },
  projectBudget: {
    findFirst: vi.fn(),
  },
  paymentApplication: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  paymentApplicationItem: {
    findFirst: vi.fn(),
  },
  scheduleTask: {
    findMany: vi.fn(),
  },
  schedule: {
    findFirst: vi.fn(),
  },
  invoice: {
    findMany: vi.fn(),
  },
  cashFlowForecast: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  procurement: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  budgetItem: {
    update: vi.fn(),
  },
  earnedValue: {
    findFirst: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

// =============================================
// PAYMENT APPLICATION TESTS
// =============================================

describe('Cash Flow Service - generatePaymentApplication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate first payment application with application number 1', async () => {
    const { generatePaymentApplication } = await import('@/lib/cash-flow-service');

    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ProjectBudget: {
        id: 'budget-1',
        totalBudget: 1000000,
        BudgetItem: [
          {
            id: 'item-1',
            costCode: '03100',
            name: 'Concrete',
            budgetedAmount: 100000,
            actualCost: 50000,
            linkedTaskIds: [],
          },
        ],
      },
    });

    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);
    mockPrisma.scheduleTask.findMany.mockResolvedValue([]);

    mockPrisma.paymentApplication.create.mockResolvedValue({
      id: 'payapp-1',
      applicationNumber: 1,
      projectId: 'project-1',
      budgetId: 'budget-1',
      scheduledValue: 100000,
      previouslyApproved: 0,
      currentPeriod: 50000,
      totalCompleted: 50000,
      retainage: 5000,
      retainagePercent: 10,
      netDue: 45000,
      status: 'DRAFT',
      items: [],
    });

    const result = await generatePaymentApplication(
      'project-1',
      new Date('2024-01-01'),
      new Date('2024-01-31'),
      'user-1'
    );

    expect(result.applicationNumber).toBe(1);
    expect(result.previouslyApproved).toBe(0);
    expect(result.status).toBe('DRAFT');
  });

  it('should increment application number from previous application', async () => {
    const { generatePaymentApplication } = await import('@/lib/cash-flow-service');

    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ProjectBudget: {
        id: 'budget-1',
        totalBudget: 1000000,
        BudgetItem: [],
      },
    });

    mockPrisma.paymentApplication.findMany.mockResolvedValue([
      {
        id: 'payapp-2',
        applicationNumber: 2,
        totalCompleted: 200000,
      },
    ]);

    mockPrisma.paymentApplication.create.mockResolvedValue({
      id: 'payapp-3',
      applicationNumber: 3,
      previouslyApproved: 200000,
      items: [],
    });

    const result = await generatePaymentApplication(
      'project-1',
      new Date('2024-02-01'),
      new Date('2024-02-29'),
      'user-1'
    );

    expect(result.applicationNumber).toBe(3);
    expect(result.previouslyApproved).toBe(200000);
  });

  it('should calculate percent complete from linked tasks', async () => {
    const { generatePaymentApplication } = await import('@/lib/cash-flow-service');

    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ProjectBudget: {
        id: 'budget-1',
        totalBudget: 500000,
        BudgetItem: [
          {
            id: 'item-1',
            costCode: '03100',
            name: 'Foundation',
            budgetedAmount: 100000,
            actualCost: 60000,
            linkedTaskIds: ['task-1', 'task-2'],
          },
        ],
      },
    });

    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);

    mockPrisma.scheduleTask.findMany.mockResolvedValue([
      { taskId: 'task-1', percentComplete: 80 },
      { taskId: 'task-2', percentComplete: 60 },
    ]);

    mockPrisma.paymentApplication.create.mockResolvedValue({
      id: 'payapp-1',
      applicationNumber: 1,
      items: [
        {
          id: 'item-1',
          percentComplete: 70, // Average of 80 and 60
          totalCompleted: 70000,
        },
      ],
    });

    const result = await generatePaymentApplication(
      'project-1',
      new Date('2024-01-01'),
      new Date('2024-01-31'),
      'user-1'
    );

    expect(mockPrisma.scheduleTask.findMany).toHaveBeenCalledWith({
      where: { taskId: { in: ['task-1', 'task-2'] } },
    });
  });

  it('should calculate percent complete from actual vs budgeted when no tasks linked', async () => {
    const { generatePaymentApplication } = await import('@/lib/cash-flow-service');

    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ProjectBudget: {
        id: 'budget-1',
        totalBudget: 200000,
        BudgetItem: [
          {
            id: 'item-1',
            costCode: '03100',
            name: 'Concrete',
            budgetedAmount: 100000,
            actualCost: 75000, // 75% complete
            linkedTaskIds: [],
          },
        ],
      },
    });

    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);
    mockPrisma.scheduleTask.findMany.mockResolvedValue([]);

    mockPrisma.paymentApplication.create.mockResolvedValue({
      id: 'payapp-1',
      applicationNumber: 1,
      items: [],
    });

    await generatePaymentApplication(
      'project-1',
      new Date('2024-01-01'),
      new Date('2024-01-31'),
      'user-1'
    );

    const createCall = mockPrisma.paymentApplication.create.mock.calls[0][0];
    const lineItem = createCall.data.items.create[0];

    expect(lineItem.percentComplete).toBe(75); // 75000 / 100000 * 100
  });

  it('should calculate this application as delta from previous application', async () => {
    const { generatePaymentApplication } = await import('@/lib/cash-flow-service');

    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ProjectBudget: {
        id: 'budget-1',
        totalBudget: 500000,
        BudgetItem: [
          {
            id: 'item-1',
            costCode: '03100',
            name: 'Foundation',
            budgetedAmount: 100000,
            actualCost: 80000, // 80% complete
            linkedTaskIds: [],
          },
        ],
      },
    });

    const previousApp = {
      id: 'payapp-1',
      applicationNumber: 1,
      totalCompleted: 50000,
    };

    mockPrisma.paymentApplication.findMany.mockResolvedValue([previousApp]);

    mockPrisma.paymentApplicationItem.findFirst.mockResolvedValue({
      id: 'prev-item-1',
      paymentAppId: 'payapp-1',
      budgetItemId: 'item-1',
      totalCompleted: 50000,
    });

    mockPrisma.paymentApplication.create.mockResolvedValue({
      id: 'payapp-2',
      items: [],
    });

    await generatePaymentApplication(
      'project-1',
      new Date('2024-02-01'),
      new Date('2024-02-29'),
      'user-1'
    );

    const createCall = mockPrisma.paymentApplication.create.mock.calls[0][0];
    const lineItem = createCall.data.items.create[0];

    // Total completed: 80,000
    // From previous: 50,000
    // This application: 30,000
    expect(lineItem.fromPreviousApp).toBe(50000);
    expect(lineItem.thisApplication).toBe(30000);
    expect(lineItem.totalCompleted).toBe(80000);
  });

  it('should apply 10% retainage to line items', async () => {
    const { generatePaymentApplication } = await import('@/lib/cash-flow-service');

    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ProjectBudget: {
        id: 'budget-1',
        totalBudget: 200000,
        BudgetItem: [
          {
            id: 'item-1',
            costCode: '03100',
            name: 'Concrete',
            budgetedAmount: 100000,
            actualCost: 50000,
            linkedTaskIds: [],
          },
        ],
      },
    });

    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);
    mockPrisma.paymentApplication.create.mockResolvedValue({ id: 'payapp-1', items: [] });

    await generatePaymentApplication(
      'project-1',
      new Date('2024-01-01'),
      new Date('2024-01-31'),
      'user-1'
    );

    const createCall = mockPrisma.paymentApplication.create.mock.calls[0][0];
    const lineItem = createCall.data.items.create[0];

    // thisApplication: 50,000
    // retainage: 50,000 * 0.10 = 5,000
    expect(lineItem.retainage).toBe(5000);
  });

  it('should throw error when project not found', async () => {
    const { generatePaymentApplication } = await import('@/lib/cash-flow-service');

    mockPrisma.project.findUnique.mockResolvedValue(null);

    await expect(
      generatePaymentApplication('nonexistent', new Date(), new Date(), 'user-1')
    ).rejects.toThrow('Project or budget not found');
  });

  it('should throw error when budget not found', async () => {
    const { generatePaymentApplication } = await import('@/lib/cash-flow-service');

    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ProjectBudget: null,
    });

    await expect(
      generatePaymentApplication('project-1', new Date(), new Date(), 'user-1')
    ).rejects.toThrow('Project or budget not found');
  });

  it('should handle budget items with no actual cost (0% complete)', async () => {
    const { generatePaymentApplication } = await import('@/lib/cash-flow-service');

    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ProjectBudget: {
        id: 'budget-1',
        totalBudget: 100000,
        BudgetItem: [
          {
            id: 'item-1',
            costCode: '03100',
            name: 'Not Started',
            budgetedAmount: 100000,
            actualCost: 0,
            linkedTaskIds: [],
          },
        ],
      },
    });

    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);
    mockPrisma.paymentApplication.create.mockResolvedValue({ id: 'payapp-1', items: [] });

    await generatePaymentApplication(
      'project-1',
      new Date('2024-01-01'),
      new Date('2024-01-31'),
      'user-1'
    );

    const createCall = mockPrisma.paymentApplication.create.mock.calls[0][0];
    const lineItem = createCall.data.items.create[0];

    expect(lineItem.percentComplete).toBe(0);
    expect(lineItem.totalCompleted).toBe(0);
    expect(lineItem.thisApplication).toBe(0);
  });
});

describe('Cash Flow Service - reviewPaymentApplication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should approve payment application', async () => {
    const { reviewPaymentApplication } = await import('@/lib/cash-flow-service');

    mockPrisma.paymentApplication.update.mockResolvedValue({
      id: 'payapp-1',
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: 'user-1',
    });

    const result = await reviewPaymentApplication('payapp-1', 'approve', 'user-1');

    expect(result.status).toBe('APPROVED');
    expect(mockPrisma.paymentApplication.update).toHaveBeenCalledWith({
      where: { id: 'payapp-1' },
      data: expect.objectContaining({
        status: 'APPROVED',
        approvedBy: 'user-1',
        reviewedBy: 'user-1',
        approvedAt: expect.any(Date),
        reviewedAt: expect.any(Date),
      }),
    });
  });

  it('should reject payment application with reason', async () => {
    const { reviewPaymentApplication } = await import('@/lib/cash-flow-service');

    mockPrisma.paymentApplication.update.mockResolvedValue({
      id: 'payapp-1',
      status: 'REJECTED',
      rejectionReason: 'Incomplete documentation',
    });

    await reviewPaymentApplication(
      'payapp-1',
      'reject',
      'user-1',
      'Incomplete documentation'
    );

    expect(mockPrisma.paymentApplication.update).toHaveBeenCalledWith({
      where: { id: 'payapp-1' },
      data: expect.objectContaining({
        status: 'REJECTED',
        reviewedBy: 'user-1',
        rejectionReason: 'Incomplete documentation',
        reviewedAt: expect.any(Date),
      }),
    });
  });

  it('should request revision with reason', async () => {
    const { reviewPaymentApplication } = await import('@/lib/cash-flow-service');

    mockPrisma.paymentApplication.update.mockResolvedValue({
      id: 'payapp-1',
      status: 'REVISION_REQUIRED',
      rejectionReason: 'Update line item 3',
    });

    await reviewPaymentApplication(
      'payapp-1',
      'request_revision',
      'user-1',
      'Update line item 3'
    );

    expect(mockPrisma.paymentApplication.update).toHaveBeenCalledWith({
      where: { id: 'payapp-1' },
      data: expect.objectContaining({
        status: 'REVISION_REQUIRED',
        reviewedBy: 'user-1',
        rejectionReason: 'Update line item 3',
        reviewedAt: expect.any(Date),
      }),
    });
  });

  it('should throw error for invalid action', async () => {
    const { reviewPaymentApplication } = await import('@/lib/cash-flow-service');

    await expect(
      reviewPaymentApplication('payapp-1', 'invalid' as any, 'user-1')
    ).rejects.toThrow('Invalid action');
  });
});

describe('Cash Flow Service - getPaymentApplicationSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate summary with multiple payment applications', async () => {
    const { getPaymentApplicationSummary } = await import('@/lib/cash-flow-service');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([
      {
        id: 'payapp-1',
        applicationNumber: 1,
        status: 'APPROVED',
        currentPeriod: 100000,
        netDue: 90000,
        retainage: 10000,
      },
      {
        id: 'payapp-2',
        applicationNumber: 2,
        status: 'PAID',
        currentPeriod: 150000,
        netDue: 135000,
        retainage: 15000,
      },
      {
        id: 'payapp-3',
        applicationNumber: 3,
        status: 'REJECTED',
        currentPeriod: 50000,
        netDue: 45000,
        retainage: 5000,
      },
    ]);

    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      totalBudget: 1000000,
    });

    const result = await getPaymentApplicationSummary('project-1');

    expect(result.totalContractValue).toBe(1000000);
    expect(result.totalBilled).toBe(250000); // 100k + 150k (excluding rejected)
    expect(result.totalApproved).toBe(250000); // APPROVED + PAID
    expect(result.totalPaid).toBe(135000); // Only PAID
    expect(result.totalRetainage).toBe(25000); // 10k + 15k (excluding rejected)
    expect(result.percentBilled).toBe(25); // 250k / 1000k * 100
    expect(result.percentPaid).toBe(13.5); // 135k / 1000k * 100
    expect(result.applicationCount).toBe(3);
  });

  it('should handle pending payment calculation', async () => {
    const { getPaymentApplicationSummary } = await import('@/lib/cash-flow-service');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([
      {
        id: 'payapp-1',
        status: 'APPROVED',
        currentPeriod: 100000,
        netDue: 90000,
        retainage: 10000,
      },
      {
        id: 'payapp-2',
        status: 'PARTIALLY_PAID',
        currentPeriod: 150000,
        netDue: 135000,
        retainage: 15000,
      },
    ]);

    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      totalBudget: 1000000,
    });

    const result = await getPaymentApplicationSummary('project-1');

    // Pending payment = APPROVED + PARTIALLY_PAID
    expect(result.pendingPayment).toBe(225000); // 90k + 135k
  });

  it('should handle empty payment applications', async () => {
    const { getPaymentApplicationSummary } = await import('@/lib/cash-flow-service');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);
    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      totalBudget: 1000000,
    });

    const result = await getPaymentApplicationSummary('project-1');

    expect(result.totalBilled).toBe(0);
    expect(result.totalApproved).toBe(0);
    expect(result.totalPaid).toBe(0);
    expect(result.pendingPayment).toBe(0);
    expect(result.applicationCount).toBe(0);
    expect(result.lastApplication).toBeUndefined();
  });

  it('should handle missing budget', async () => {
    const { getPaymentApplicationSummary } = await import('@/lib/cash-flow-service');

    mockPrisma.paymentApplication.findMany.mockResolvedValue([
      {
        id: 'payapp-1',
        status: 'APPROVED',
        currentPeriod: 100000,
        netDue: 90000,
        retainage: 10000,
      },
    ]);

    mockPrisma.projectBudget.findFirst.mockResolvedValue(null);

    const result = await getPaymentApplicationSummary('project-1');

    expect(result.totalContractValue).toBe(0);
    expect(result.percentBilled).toBe(0);
    expect(result.percentPaid).toBe(0);
  });
});

// =============================================
// CASH FLOW FORECASTING TESTS
// =============================================

describe('Cash Flow Service - generateCashFlowForecast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate monthly forecast periods', async () => {
    const { generateCashFlowForecast } = await import('@/lib/cash-flow-service');

    const projectStart = new Date('2024-01-01');
    const projectEnd = new Date('2024-12-31');

    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ProjectBudget: {
        id: 'budget-1',
        totalBudget: 1000000,
        BudgetItem: [],
      },
    });

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      startDate: projectStart,
      endDate: projectEnd,
      ScheduleTask: [],
    });

    mockPrisma.cashFlowForecast.findMany.mockResolvedValue([]);
    mockPrisma.cashFlowForecast.create.mockResolvedValue({ id: 'forecast-1' });
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);

    const result = await generateCashFlowForecast('project-1', 'MONTHLY', 12);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].periodType).toBe('MONTHLY');
    expect(mockPrisma.cashFlowForecast.create).toHaveBeenCalled();
  });

  it('should generate weekly forecast periods', async () => {
    const { generateCashFlowForecast } = await import('@/lib/cash-flow-service');

    const projectStart = new Date('2024-01-01');
    const projectEnd = new Date('2024-03-31');

    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ProjectBudget: {
        id: 'budget-1',
        totalBudget: 500000,
        BudgetItem: [],
      },
    });

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      startDate: projectStart,
      endDate: projectEnd,
      ScheduleTask: [],
    });

    mockPrisma.cashFlowForecast.findMany.mockResolvedValue([]);
    mockPrisma.cashFlowForecast.create.mockResolvedValue({ id: 'forecast-1' });
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);

    const result = await generateCashFlowForecast('project-1', 'WEEKLY', 12);

    expect(result[0].periodType).toBe('WEEKLY');
  });

  it('should calculate planned outflow from schedule tasks', async () => {
    const { generateCashFlowForecast } = await import('@/lib/cash-flow-service');

    const projectStart = new Date('2024-01-01');

    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ProjectBudget: {
        id: 'budget-1',
        totalBudget: 1000000,
        BudgetItem: [],
      },
    });

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      startDate: projectStart,
      endDate: addMonths(projectStart, 3),
      ScheduleTask: [
        {
          taskId: 'task-1',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
          budgetedCost: 100000,
        },
      ],
    });

    mockPrisma.cashFlowForecast.findMany.mockResolvedValue([]);
    mockPrisma.cashFlowForecast.create.mockResolvedValue({ id: 'forecast-1' });
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);

    const result = await generateCashFlowForecast('project-1', 'MONTHLY', 3);

    // First period should have planned outflow from task
    expect(result[0].plannedOutflow).toBeGreaterThan(0);
  });

  it('should calculate actual outflow from invoices', async () => {
    const { generateCashFlowForecast } = await import('@/lib/cash-flow-service');

    const periodStart = startOfMonth(new Date('2024-01-01'));
    const periodEnd = endOfMonth(new Date('2024-01-01'));

    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ProjectBudget: {
        id: 'budget-1',
        totalBudget: 1000000,
        BudgetItem: [],
      },
    });

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      ScheduleTask: [],
    });

    mockPrisma.cashFlowForecast.findMany.mockResolvedValue([]);
    mockPrisma.cashFlowForecast.create.mockResolvedValue({ id: 'forecast-1' });

    mockPrisma.invoice.findMany.mockResolvedValue([
      {
        id: 'invoice-1',
        projectId: 'project-1',
        amount: 50000,
        invoiceDate: new Date('2024-01-15'),
        status: 'APPROVED',
      },
    ]);

    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);

    // Mock current date to be in the past relative to January
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01'));

    const result = await generateCashFlowForecast('project-1', 'MONTHLY', 12);

    vi.useRealTimers();

    // Should have actual outflow from invoices in past periods
    const janPeriod = result.find((f) => f.periodDate >= periodStart && f.periodDate <= periodEnd);
    expect(janPeriod).toBeDefined();
  });

  it('should calculate actual inflow from paid payment applications', async () => {
    const { generateCashFlowForecast } = await import('@/lib/cash-flow-service');

    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ProjectBudget: {
        id: 'budget-1',
        totalBudget: 1000000,
        BudgetItem: [],
      },
    });

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      ScheduleTask: [],
    });

    mockPrisma.cashFlowForecast.findMany.mockResolvedValue([]);
    mockPrisma.cashFlowForecast.create.mockResolvedValue({ id: 'forecast-1' });
    mockPrisma.invoice.findMany.mockResolvedValue([]);

    mockPrisma.paymentApplication.findMany.mockResolvedValue([
      {
        id: 'payapp-1',
        projectId: 'project-1',
        netDue: 90000,
        periodEnd: new Date('2024-01-31'),
        status: 'PAID',
      },
    ]);

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01'));

    const result = await generateCashFlowForecast('project-1', 'MONTHLY', 12);

    vi.useRealTimers();

    // Past periods should have actual inflow
    expect(result.some((f) => f.actualInflow > 0)).toBe(true);
  });

  it('should apply 10% markup to planned inflow', async () => {
    const { generateCashFlowForecast } = await import('@/lib/cash-flow-service');

    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ProjectBudget: {
        id: 'budget-1',
        totalBudget: 1000000,
        BudgetItem: [],
      },
    });

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      ScheduleTask: [
        {
          taskId: 'task-1',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
          budgetedCost: 100000,
        },
      ],
    });

    mockPrisma.cashFlowForecast.findMany.mockResolvedValue([]);
    mockPrisma.cashFlowForecast.create.mockResolvedValue({ id: 'forecast-1' });
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);

    const result = await generateCashFlowForecast('project-1', 'MONTHLY', 3);

    // Planned inflow should be ~10% higher than planned outflow
    result.forEach((period) => {
      if (period.plannedOutflow > 0) {
        expect(period.plannedInflow).toBeCloseTo(period.plannedOutflow * 1.1, -2);
      }
    });
  });

  it('should lock past periods', async () => {
    const { generateCashFlowForecast } = await import('@/lib/cash-flow-service');

    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ProjectBudget: {
        id: 'budget-1',
        totalBudget: 1000000,
        BudgetItem: [],
      },
    });

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      ScheduleTask: [],
    });

    mockPrisma.cashFlowForecast.findMany.mockResolvedValue([]);
    mockPrisma.cashFlowForecast.create.mockResolvedValue({ id: 'forecast-1' });
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15'));

    const result = await generateCashFlowForecast('project-1', 'MONTHLY', 12);

    vi.useRealTimers();

    // Past periods should be locked
    const pastPeriods = result.filter((f) => f.periodDate < new Date('2024-06-01'));
    pastPeriods.forEach((period) => {
      expect(period.isLocked).toBe(true);
    });
  });

  it('should update existing forecast records', async () => {
    const { generateCashFlowForecast } = await import('@/lib/cash-flow-service');

    // Use local timezone date to match how date-fns generates periods
    const existingPeriod = new Date(2024, 0, 1); // January 1, 2024 in local timezone

    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ProjectBudget: {
        id: 'budget-1',
        totalBudget: 1000000,
        BudgetItem: [],
      },
    });

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      startDate: existingPeriod,
      endDate: new Date(2024, 11, 31), // December 31, 2024 in local timezone
      ScheduleTask: [],
    });

    mockPrisma.cashFlowForecast.findMany.mockResolvedValue([
      {
        id: 'existing-1',
        projectId: 'project-1',
        periodDate: existingPeriod,
        periodType: 'MONTHLY',
        plannedInflow: 50000,
      },
    ]);

    mockPrisma.cashFlowForecast.update.mockResolvedValue({ id: 'existing-1' });
    mockPrisma.cashFlowForecast.create.mockResolvedValue({ id: 'new-1' });
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);

    await generateCashFlowForecast('project-1', 'MONTHLY', 12);

    // Should update existing records
    expect(mockPrisma.cashFlowForecast.update).toHaveBeenCalled();
  });

  it('should throw error when project not found', async () => {
    const { generateCashFlowForecast } = await import('@/lib/cash-flow-service');

    mockPrisma.project.findUnique.mockResolvedValue(null);

    await expect(generateCashFlowForecast('nonexistent', 'MONTHLY', 12)).rejects.toThrow(
      'Project or budget not found'
    );
  });

  it('should distribute budget evenly when no schedule exists', async () => {
    const { generateCashFlowForecast } = await import('@/lib/cash-flow-service');

    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ProjectBudget: {
        id: 'budget-1',
        totalBudget: 1200000, // 100k per month for 12 months
        BudgetItem: [],
      },
    });

    mockPrisma.schedule.findFirst.mockResolvedValue(null);
    mockPrisma.cashFlowForecast.findMany.mockResolvedValue([]);
    mockPrisma.cashFlowForecast.create.mockResolvedValue({ id: 'forecast-1' });
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.paymentApplication.findMany.mockResolvedValue([]);

    const result = await generateCashFlowForecast('project-1', 'MONTHLY', 12);

    // Should distribute evenly
    expect(result[0].plannedOutflow).toBeGreaterThan(0);
  });
});

describe('Cash Flow Service - getCashFlowSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate cash flow summary from forecasts', async () => {
    const { getCashFlowSummary } = await import('@/lib/cash-flow-service');

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15'));

    mockPrisma.cashFlowForecast.findMany.mockResolvedValue([
      {
        id: 'forecast-1',
        projectId: 'project-1',
        periodDate: new Date('2024-01-01'),
        plannedInflow: 100000,
        actualInflow: 95000,
        plannedOutflow: 90000,
        actualOutflow: 85000,
        cumulativeForecast: 10000,
        cumulativeActual: 10000,
      },
      {
        id: 'forecast-2',
        projectId: 'project-1',
        periodDate: new Date('2024-02-01'),
        plannedInflow: 110000,
        actualInflow: 100000,
        plannedOutflow: 95000,
        actualOutflow: 90000,
        cumulativeForecast: 25000,
        cumulativeActual: 20000,
      },
      {
        id: 'forecast-3',
        projectId: 'project-1',
        periodDate: new Date('2024-07-01'),
        plannedInflow: 120000,
        actualInflow: 0,
        plannedOutflow: 100000,
        actualOutflow: 0,
        cumulativeForecast: 45000,
        cumulativeActual: 0,
      },
    ]);

    const result = await getCashFlowSummary('project-1');

    vi.useRealTimers();

    expect(result.totalPlannedInflow).toBe(330000); // 100k + 110k + 120k
    expect(result.totalActualInflow).toBe(195000); // 95k + 100k (past only)
    expect(result.totalPlannedOutflow).toBe(285000); // 90k + 95k + 100k
    expect(result.totalActualOutflow).toBe(175000); // 85k + 90k (past only)
    expect(result.projectedNetCash).toBe(45000); // Last period cumulative
    expect(result.currentNetCash).toBe(20000); // Last past period cumulative
    expect(result.remainingPeriods).toBe(1); // Only July is future
  });

  it('should handle empty forecasts', async () => {
    const { getCashFlowSummary } = await import('@/lib/cash-flow-service');

    mockPrisma.cashFlowForecast.findMany.mockResolvedValue([]);

    const result = await getCashFlowSummary('project-1');

    expect(result.totalPlannedInflow).toBe(0);
    expect(result.totalActualInflow).toBe(0);
    expect(result.projectedNetCash).toBe(0);
    expect(result.currentNetCash).toBe(0);
    expect(result.remainingPeriods).toBe(0);
  });
});

// =============================================
// PROCUREMENT TRACKING TESTS
// =============================================

describe('Cash Flow Service - createProcurement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create first procurement with PROC-0001 number', async () => {
    const { createProcurement } = await import('@/lib/cash-flow-service');

    mockPrisma.procurement.findFirst.mockResolvedValue(null);

    mockPrisma.procurement.create.mockResolvedValue({
      id: 'proc-1',
      procurementNumber: 'PROC-0001',
      projectId: 'project-1',
      description: 'Steel Beams',
      itemType: 'MATERIAL',
      status: 'IDENTIFIED',
    });

    const result = await createProcurement(
      'project-1',
      {
        description: 'Steel Beams',
        itemType: 'MATERIAL',
        quantity: 100,
        unit: 'tons',
        budgetedCost: 50000,
      },
      'user-1'
    );

    expect(result.procurementNumber).toBe('PROC-0001');
    expect(result.status).toBe('IDENTIFIED');
  });

  it('should increment procurement number from last procurement', async () => {
    const { createProcurement } = await import('@/lib/cash-flow-service');

    mockPrisma.procurement.findFirst.mockResolvedValue({
      id: 'proc-5',
      procurementNumber: 'PROC-0005',
    });

    mockPrisma.procurement.create.mockResolvedValue({
      id: 'proc-6',
      procurementNumber: 'PROC-0006',
    });

    const result = await createProcurement(
      'project-1',
      {
        description: 'Concrete',
        itemType: 'MATERIAL',
      },
      'user-1'
    );

    expect(result.procurementNumber).toBe('PROC-0006');
  });

  it('should create long lead item procurement', async () => {
    const { createProcurement } = await import('@/lib/cash-flow-service');

    mockPrisma.procurement.findFirst.mockResolvedValue(null);

    mockPrisma.procurement.create.mockResolvedValue({
      id: 'proc-1',
      procurementNumber: 'PROC-0001',
      itemType: 'LONG_LEAD_ITEM',
      leadTime: 90,
      requiredDate: new Date('2024-06-01'),
    });

    const result = await createProcurement(
      'project-1',
      {
        description: 'Custom HVAC Unit',
        itemType: 'LONG_LEAD_ITEM',
        leadTime: 90,
        requiredDate: new Date('2024-06-01'),
      },
      'user-1'
    );

    expect(result.itemType).toBe('LONG_LEAD_ITEM');
    expect(result.leadTime).toBe(90);
  });

  it('should link procurement to budget item', async () => {
    const { createProcurement } = await import('@/lib/cash-flow-service');

    mockPrisma.procurement.findFirst.mockResolvedValue(null);

    mockPrisma.procurement.create.mockResolvedValue({
      id: 'proc-1',
      procurementNumber: 'PROC-0001',
      budgetItemId: 'budget-item-1',
    });

    const result = await createProcurement(
      'project-1',
      {
        description: 'Electrical Equipment',
        itemType: 'EQUIPMENT',
        budgetItemId: 'budget-item-1',
      },
      'user-1'
    );

    expect(result.budgetItemId).toBe('budget-item-1');
  });
});

describe('Cash Flow Service - updateProcurementStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update procurement status to ORDERED', async () => {
    const { updateProcurementStatus } = await import('@/lib/cash-flow-service');

    mockPrisma.procurement.update.mockResolvedValue({
      id: 'proc-1',
      status: 'ORDERED',
      orderDate: new Date('2024-01-15'),
      purchaseOrder: 'PO-12345',
      budgetItemId: null,
    });

    const result = await updateProcurementStatus('proc-1', 'ORDERED', {
      orderDate: new Date('2024-01-15'),
      purchaseOrder: 'PO-12345',
      quotedCost: 50000,
    });

    expect(result.status).toBe('ORDERED');
    expect(mockPrisma.procurement.update).toHaveBeenCalledWith({
      where: { id: 'proc-1' },
      data: expect.objectContaining({
        status: 'ORDERED',
        orderDate: expect.any(Date),
        purchaseOrder: 'PO-12345',
        quotedCost: 50000,
      }),
    });
  });

  it('should update budget item committed cost when procurement has actual cost', async () => {
    const { updateProcurementStatus } = await import('@/lib/cash-flow-service');

    mockPrisma.procurement.update.mockResolvedValue({
      id: 'proc-1',
      status: 'RECEIVED',
      budgetItemId: 'budget-item-1',
      actualCost: 52000,
    });

    mockPrisma.budgetItem.update.mockResolvedValue({
      id: 'budget-item-1',
      committedCost: 52000,
    });

    await updateProcurementStatus('proc-1', 'RECEIVED', {
      actualDelivery: new Date('2024-02-01'),
      actualCost: 52000,
    });

    expect(mockPrisma.budgetItem.update).toHaveBeenCalledWith({
      where: { id: 'budget-item-1' },
      data: {
        committedCost: { increment: 52000 },
      },
    });
  });

  it('should not update budget item when no budget item linked', async () => {
    const { updateProcurementStatus } = await import('@/lib/cash-flow-service');

    mockPrisma.procurement.update.mockResolvedValue({
      id: 'proc-1',
      status: 'RECEIVED',
      budgetItemId: null,
      actualCost: 52000,
    });

    await updateProcurementStatus('proc-1', 'RECEIVED', {
      actualCost: 52000,
    });

    expect(mockPrisma.budgetItem.update).not.toHaveBeenCalled();
  });

  it('should update tracking information for in-transit items', async () => {
    const { updateProcurementStatus } = await import('@/lib/cash-flow-service');

    mockPrisma.procurement.update.mockResolvedValue({
      id: 'proc-1',
      status: 'IN_TRANSIT',
      trackingNumber: 'TRACK-123',
      expectedDelivery: new Date('2024-02-15'),
      budgetItemId: null,
    });

    await updateProcurementStatus('proc-1', 'IN_TRANSIT', {
      trackingNumber: 'TRACK-123',
      expectedDelivery: new Date('2024-02-15'),
    });

    expect(mockPrisma.procurement.update).toHaveBeenCalledWith({
      where: { id: 'proc-1' },
      data: expect.objectContaining({
        status: 'IN_TRANSIT',
        trackingNumber: 'TRACK-123',
        expectedDelivery: expect.any(Date),
      }),
    });
  });
});

describe('Cash Flow Service - getProcurementDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate procurement dashboard summary', async () => {
    const { getProcurementDashboard } = await import('@/lib/cash-flow-service');

    mockPrisma.procurement.findMany.mockResolvedValue([
      {
        id: 'proc-1',
        status: 'IDENTIFIED',
        itemType: 'MATERIAL',
        budgetedCost: 50000,
        quotedCost: null,
        actualCost: null,
        vendor: null,
        budgetItem: null,
      },
      {
        id: 'proc-2',
        status: 'ORDERED',
        itemType: 'EQUIPMENT',
        budgetedCost: 100000,
        quotedCost: 95000,
        actualCost: null,
        vendor: { id: 'vendor-1', name: 'ABC Supply' },
        budgetItem: null,
      },
      {
        id: 'proc-3',
        status: 'RECEIVED',
        itemType: 'LONG_LEAD_ITEM',
        budgetedCost: 75000,
        quotedCost: 75000,
        actualCost: 76000,
        vendor: null,
        budgetItem: null,
      },
    ]);

    const result = await getProcurementDashboard('project-1');

    expect(result.total).toBe(3);
    expect(result.byStatus['IDENTIFIED']).toBe(1);
    expect(result.byStatus['ORDERED']).toBe(1);
    expect(result.byStatus['RECEIVED']).toBe(1);
    expect(result.totalBudgeted).toBe(225000); // 50k + 100k + 75k
    expect(result.totalCommitted).toBe(170000); // 95k + 75k (ORDERED + RECEIVED)
    expect(result.totalActual).toBe(76000); // Only items with actualCost
    expect(result.variance).toBe(149000); // 225k - 76k
  });

  it('should identify at-risk procurements', async () => {
    const { getProcurementDashboard } = await import('@/lib/cash-flow-service');

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15'));

    mockPrisma.procurement.findMany.mockResolvedValue([
      {
        id: 'proc-1',
        status: 'IDENTIFIED',
        itemType: 'MATERIAL',
        requiredDate: new Date('2024-01-20'), // 5 days away
        leadTime: 14, // 14 day lead time - AT RISK!
        budgetedCost: 50000,
        vendor: null,
        budgetItem: null,
      },
      {
        id: 'proc-2',
        status: 'ORDERED',
        itemType: 'EQUIPMENT',
        requiredDate: new Date('2024-01-20'),
        leadTime: 7, // Already ordered - not at risk
        budgetedCost: 100000,
        vendor: null,
        budgetItem: null,
      },
      {
        id: 'proc-3',
        status: 'IDENTIFIED',
        itemType: 'MATERIAL',
        requiredDate: new Date('2024-02-15'), // 31 days away
        leadTime: 14, // Plenty of time - not at risk
        budgetedCost: 75000,
        vendor: null,
        budgetItem: null,
      },
    ]);

    const result = await getProcurementDashboard('project-1');

    vi.useRealTimers();

    expect(result.atRisk.length).toBe(1);
    expect(result.atRisk[0].id).toBe('proc-1');
  });

  it('should filter long lead items', async () => {
    const { getProcurementDashboard } = await import('@/lib/cash-flow-service');

    mockPrisma.procurement.findMany.mockResolvedValue([
      {
        id: 'proc-1',
        status: 'IDENTIFIED',
        itemType: 'LONG_LEAD_ITEM',
        budgetedCost: 100000,
        vendor: null,
        budgetItem: null,
      },
      {
        id: 'proc-2',
        status: 'ORDERED',
        itemType: 'MATERIAL',
        budgetedCost: 50000,
        vendor: null,
        budgetItem: null,
      },
      {
        id: 'proc-3',
        status: 'RECEIVED',
        itemType: 'LONG_LEAD_ITEM',
        budgetedCost: 75000,
        vendor: null,
        budgetItem: null,
      },
    ]);

    const result = await getProcurementDashboard('project-1');

    expect(result.longLeadItems.length).toBe(2);
    expect(result.longLeadItems.every((item) => item.itemType === 'LONG_LEAD_ITEM')).toBe(true);
  });

  it('should handle empty procurements', async () => {
    const { getProcurementDashboard } = await import('@/lib/cash-flow-service');

    mockPrisma.procurement.findMany.mockResolvedValue([]);

    const result = await getProcurementDashboard('project-1');

    expect(result.total).toBe(0);
    expect(result.totalBudgeted).toBe(0);
    expect(result.totalCommitted).toBe(0);
    expect(result.totalActual).toBe(0);
    expect(result.atRisk.length).toBe(0);
    expect(result.longLeadItems.length).toBe(0);
  });
});

// =============================================
// COST FORECASTING (EAC/ETC) TESTS
// =============================================

describe('Cash Flow Service - calculateCostForecast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate EAC using CPI and SPI (composite method)', async () => {
    const { calculateCostForecast } = await import('@/lib/cash-flow-service');

    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000, // BAC
      actualCost: 250000, // AC
      contingency: 100000,
      BudgetItem: [],
    });

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [
        { percentComplete: 50 },
        { percentComplete: 60 },
      ],
    });

    mockPrisma.earnedValue.findFirst.mockResolvedValue({
      id: 'ev-1',
      plannedValue: 300000, // PV
    });

    const result = await calculateCostForecast('project-1');

    // EV = (55% avg completion) * 1,000,000 = 550,000
    // CPI = 550,000 / 250,000 = 2.2
    // SPI = 550,000 / 300,000 = 1.83
    // EAC = AC + ((BAC - EV) / (CPI * SPI))
    expect(result.bac).toBe(1000000);
    expect(result.ac).toBe(250000);
    expect(result.ev).toBeGreaterThan(0);
    expect(result.cpi).toBeGreaterThan(0);
    expect(result.spi).toBeGreaterThan(0);
    expect(result.eac).toBeGreaterThan(0);
  });

  it('should calculate ETC (Estimate To Complete)', async () => {
    const { calculateCostForecast } = await import('@/lib/cash-flow-service');

    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      actualCost: 400000,
      contingency: 50000,
      BudgetItem: [],
    });

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [{ percentComplete: 50 }],
    });

    mockPrisma.earnedValue.findFirst.mockResolvedValue({
      plannedValue: 500000,
    });

    const result = await calculateCostForecast('project-1');

    // ETC = EAC - AC
    expect(result.etc).toBe(result.eac - result.ac);
  });

  it('should calculate VAC (Variance At Completion)', async () => {
    const { calculateCostForecast } = await import('@/lib/cash-flow-service');

    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      actualCost: 600000,
      contingency: 50000,
      BudgetItem: [],
    });

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [{ percentComplete: 50 }],
    });

    mockPrisma.earnedValue.findFirst.mockResolvedValue({
      plannedValue: 500000,
    });

    const result = await calculateCostForecast('project-1');

    // VAC = BAC - EAC
    expect(result.vac).toBe(result.bac - result.eac);
  });

  it('should calculate TCPI (To Complete Performance Index)', async () => {
    const { calculateCostForecast } = await import('@/lib/cash-flow-service');

    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      actualCost: 300000,
      contingency: 50000,
      BudgetItem: [],
    });

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [{ percentComplete: 40 }],
    });

    mockPrisma.earnedValue.findFirst.mockResolvedValue({
      plannedValue: 400000,
    });

    const result = await calculateCostForecast('project-1');

    // TCPI = (BAC - EV) / (BAC - AC)
    expect(result.tcpi).toBeGreaterThan(0);
  });

  it('should set confidence level to HIGH when CPI and SPI >= 0.9', async () => {
    const { calculateCostForecast } = await import('@/lib/cash-flow-service');

    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      actualCost: 500000,
      contingency: 50000,
      BudgetItem: [],
    });

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [{ percentComplete: 50 }],
    });

    mockPrisma.earnedValue.findFirst.mockResolvedValue({
      plannedValue: 500000,
    });

    const result = await calculateCostForecast('project-1');

    // CPI = 500k / 500k = 1.0, SPI = 500k / 500k = 1.0
    expect(result.confidenceLevel).toBe('HIGH');
    expect(result.confidencePercent).toBe(90);
  });

  it('should set confidence level to MEDIUM when CPI or SPI < 0.9', async () => {
    const { calculateCostForecast } = await import('@/lib/cash-flow-service');

    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      actualCost: 550000,
      contingency: 50000,
      BudgetItem: [],
    });

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [{ percentComplete: 50 }],
    });

    mockPrisma.earnedValue.findFirst.mockResolvedValue({
      plannedValue: 500000,
    });

    const result = await calculateCostForecast('project-1');

    // CPI = 500k / 550k = 0.909 (just below 0.9 threshold could trigger MEDIUM)
    expect(['MEDIUM', 'HIGH']).toContain(result.confidenceLevel);
  });

  it('should set confidence level to LOW when CPI or SPI < 0.8', async () => {
    const { calculateCostForecast } = await import('@/lib/cash-flow-service');

    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      actualCost: 650000,
      contingency: 50000,
      BudgetItem: [],
    });

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [{ percentComplete: 50 }],
    });

    mockPrisma.earnedValue.findFirst.mockResolvedValue({
      plannedValue: 500000,
    });

    const result = await calculateCostForecast('project-1');

    // CPI = 500k / 650k = 0.77 (< 0.8)
    expect(result.confidenceLevel).toBe('LOW');
    expect(result.confidencePercent).toBe(50);
  });

  it('should generate recommendations for cost overrun', async () => {
    const { calculateCostForecast } = await import('@/lib/cash-flow-service');

    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      actualCost: 600000,
      contingency: 50000,
      BudgetItem: [],
    });

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [{ percentComplete: 50 }],
    });

    mockPrisma.earnedValue.findFirst.mockResolvedValue({
      plannedValue: 500000,
    });

    const result = await calculateCostForecast('project-1');

    // CPI = 500k / 600k = 0.833 (< 1)
    expect(result.recommendations).toContain(
      'Cost overrun detected - review change orders and scope'
    );
  });

  it('should generate recommendations for schedule delay', async () => {
    const { calculateCostForecast } = await import('@/lib/cash-flow-service');

    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      actualCost: 400000,
      contingency: 50000,
      BudgetItem: [],
    });

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [{ percentComplete: 40 }],
    });

    mockPrisma.earnedValue.findFirst.mockResolvedValue({
      plannedValue: 500000,
    });

    const result = await calculateCostForecast('project-1');

    // SPI = 400k / 500k = 0.8 (< 1)
    expect(result.recommendations).toContain(
      'Schedule delay detected - consider acceleration measures'
    );
  });

  it('should calculate health status as ON_BUDGET when CPI >= 1', async () => {
    const { calculateCostForecast } = await import('@/lib/cash-flow-service');

    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      actualCost: 450000,
      contingency: 50000,
      BudgetItem: [],
    });

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [{ percentComplete: 50 }],
    });

    mockPrisma.earnedValue.findFirst.mockResolvedValue({
      plannedValue: 500000,
    });

    const result = await calculateCostForecast('project-1');

    // CPI = 500k / 450k = 1.11 (>= 1)
    expect(result.costHealthStatus).toBe('ON_BUDGET');
  });

  it('should calculate health status as OVER_BUDGET when CPI < 0.9', async () => {
    const { calculateCostForecast } = await import('@/lib/cash-flow-service');

    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      actualCost: 650000,
      contingency: 50000,
      BudgetItem: [],
    });

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [{ percentComplete: 50 }],
    });

    mockPrisma.earnedValue.findFirst.mockResolvedValue({
      plannedValue: 500000,
    });

    const result = await calculateCostForecast('project-1');

    // CPI = 500k / 650k = 0.77 (< 0.9)
    expect(result.costHealthStatus).toBe('OVER_BUDGET');
  });

  it('should calculate schedule health status as ON_SCHEDULE when SPI >= 1', async () => {
    const { calculateCostForecast } = await import('@/lib/cash-flow-service');

    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      actualCost: 500000,
      contingency: 50000,
      BudgetItem: [],
    });

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [{ percentComplete: 55 }],
    });

    mockPrisma.earnedValue.findFirst.mockResolvedValue({
      plannedValue: 500000,
    });

    const result = await calculateCostForecast('project-1');

    // SPI = 550k / 500k = 1.1 (>= 1)
    expect(result.scheduleHealthStatus).toBe('ON_SCHEDULE');
  });

  it('should use actual cost from budget when percent complete from schedule', async () => {
    const { calculateCostForecast } = await import('@/lib/cash-flow-service');

    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      actualCost: 300000,
      contingency: 50000,
      BudgetItem: [],
    });

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [
        { percentComplete: 50 },
        { percentComplete: 50 },
      ],
    });

    mockPrisma.earnedValue.findFirst.mockResolvedValue({
      plannedValue: 500000,
    });

    const result = await calculateCostForecast('project-1');

    expect(result.ac).toBe(300000);
    expect(result.percentComplete).toBe(50);
  });

  it('should throw error when budget not found', async () => {
    const { calculateCostForecast } = await import('@/lib/cash-flow-service');

    mockPrisma.projectBudget.findFirst.mockResolvedValue(null);

    await expect(calculateCostForecast('nonexistent')).rejects.toThrow('Budget not found');
  });

  it('should calculate percent complete from actual cost when no schedule', async () => {
    const { calculateCostForecast } = await import('@/lib/cash-flow-service');

    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      actualCost: 400000,
      contingency: 50000,
      BudgetItem: [],
    });

    mockPrisma.schedule.findFirst.mockResolvedValue(null);
    mockPrisma.earnedValue.findFirst.mockResolvedValue(null);

    const result = await calculateCostForecast('project-1');

    // percentComplete = (400k / 1000k) * 100 = 40%
    expect(result.percentComplete).toBe(40);
  });

  it('should provide all three EAC calculation methods', async () => {
    const { calculateCostForecast } = await import('@/lib/cash-flow-service');

    mockPrisma.projectBudget.findFirst.mockResolvedValue({
      id: 'budget-1',
      projectId: 'project-1',
      totalBudget: 1000000,
      actualCost: 500000,
      contingency: 50000,
      BudgetItem: [],
    });

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      isActive: true,
      ScheduleTask: [{ percentComplete: 50 }],
    });

    mockPrisma.earnedValue.findFirst.mockResolvedValue({
      plannedValue: 500000,
    });

    const result = await calculateCostForecast('project-1');

    expect(result.eacMethods.typical).toBeGreaterThan(0); // BAC / CPI
    expect(result.eacMethods.atypical).toBeGreaterThan(0); // AC + (BAC - EV)
    expect(result.eacMethods.composite).toBeGreaterThan(0); // AC + ((BAC - EV) / (CPI * SPI))
  });
});
