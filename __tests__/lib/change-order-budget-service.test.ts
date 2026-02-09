import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  previewChangeOrderImpact,
  applyChangeOrderToBudget,
  recalculateBudgetFromChangeOrders,
  getBudgetWithChangeOrders,
} from '@/lib/change-order-budget-service';

const mockPrisma = vi.hoisted(() => ({
  contractChangeOrder: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  projectBudget: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  budgetItem: {
    create: vi.fn(),
    update: vi.fn(),
  },
  cashFlowForecast: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  changeOrder: {
    create: vi.fn(),
  },
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

describe('change-order-budget-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('previewChangeOrderImpact', () => {
    it('should preview budget impact of change order', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);

      mockPrisma.contractChangeOrder.findFirst.mockResolvedValue({
        id: 'co-1',
        projectId: 'proj-1',
        coNumber: 'CO-001',
        title: 'Foundation Change',
        originalAmount: 50000,
        daysAdded: 5,
        contract: {
          title: 'Foundation Work',
          completionDate: futureDate,
          subcontractor: {
            tradeType: 'CONCRETE',
          },
        },
      });

      mockPrisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        projectId: 'proj-1',
        totalBudget: 1000000,
        contingency: 100000,
        committedCost: 500000,
        BudgetItem: [
          {
            id: 'item-1',
            name: 'Foundation',
            tradeType: 'CONCRETE',
            budgetedAmount: 200000,
            revisedBudget: 200000,
            committedCost: 150000,
            costCode: '03-100',
          },
        ],
      });

      const preview = await previewChangeOrderImpact('proj-1', 'co-1');

      expect(preview).not.toBeNull();
      expect(preview!.changeOrder.coNumber).toBe('CO-001');
      expect(preview!.budgetImpacts).toHaveLength(1);
      expect(preview!.budgetImpacts[0].changeAmount).toBe(50000);
      expect(preview!.projectBudgetImpact.useContingency).toBe(true);
      expect(preview!.scheduleImpact.daysAdded).toBe(5);
    });

    it('should handle missing project budget', async () => {
      mockPrisma.contractChangeOrder.findFirst.mockResolvedValue({
        id: 'co-1',
        projectId: 'proj-1',
        coNumber: 'CO-001',
        title: 'Change',
        originalAmount: 50000,
        daysAdded: 0,
        contract: {
          title: 'Work',
          completionDate: new Date(),
          subcontractor: null,
        },
      });

      mockPrisma.projectBudget.findUnique.mockResolvedValue(null);

      const preview = await previewChangeOrderImpact('proj-1', 'co-1');

      expect(preview).not.toBeNull();
      expect(preview!.warnings.some(w => w.includes('No project budget'))).toBe(true);
    });

    it('should warn when no matching budget items', async () => {
      mockPrisma.contractChangeOrder.findFirst.mockResolvedValue({
        id: 'co-1',
        projectId: 'proj-1',
        coNumber: 'CO-001',
        title: 'Change',
        originalAmount: 50000,
        daysAdded: 0,
        contract: {
          title: 'Work',
          completionDate: new Date(),
          subcontractor: { tradeType: 'ELECTRICAL' },
        },
      });

      mockPrisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        totalBudget: 1000000,
        contingency: 100000,
        committedCost: 500000,
        BudgetItem: [
          { id: 'item-1', tradeType: 'CONCRETE', budgetedAmount: 200000, revisedBudget: 200000, committedCost: 150000 },
        ],
      });

      const preview = await previewChangeOrderImpact('proj-1', 'co-1');

      expect(preview!.budgetImpacts).toHaveLength(0);
      expect(preview!.warnings.some(w => w.includes('No matching budget items'))).toBe(true);
    });

    it('should warn when exceeding contingency', async () => {
      mockPrisma.contractChangeOrder.findFirst.mockResolvedValue({
        id: 'co-1',
        projectId: 'proj-1',
        coNumber: 'CO-001',
        title: 'Large Change',
        originalAmount: 150000,
        daysAdded: 0,
        contract: {
          title: 'Work',
          completionDate: new Date(),
          subcontractor: null,
        },
      });

      mockPrisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        totalBudget: 1000000,
        contingency: 50000,
        committedCost: 500000,
        BudgetItem: [],
      });

      const preview = await previewChangeOrderImpact('proj-1', 'co-1');

      expect(preview!.warnings.some(w => w.includes('exceeds contingency'))).toBe(true);
    });

    it('should calculate schedule extension', async () => {
      const today = new Date();
      const completion = new Date(today);
      completion.setDate(completion.getDate() + 60);

      mockPrisma.contractChangeOrder.findFirst.mockResolvedValue({
        id: 'co-1',
        projectId: 'proj-1',
        coNumber: 'CO-001',
        title: 'Change',
        originalAmount: 50000,
        daysAdded: 10,
        contract: {
          completionDate: completion,
          subcontractor: null,
        },
      });

      mockPrisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        totalBudget: 1000000,
        contingency: 100000,
        committedCost: 500000,
        BudgetItem: [],
      });

      const preview = await previewChangeOrderImpact('proj-1', 'co-1');

      expect(preview!.scheduleImpact.daysAdded).toBe(10);
      expect(preview!.scheduleImpact.newCompletion).not.toEqual(preview!.scheduleImpact.originalCompletion);
      expect(preview!.warnings.some(w => w.includes('extended by 10 days'))).toBe(true);
    });

    it('should calculate cash flow impact', async () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 3);

      mockPrisma.contractChangeOrder.findFirst.mockResolvedValue({
        id: 'co-1',
        projectId: 'proj-1',
        coNumber: 'CO-001',
        title: 'Change',
        originalAmount: 60000,
        daysAdded: 0,
        contract: {
          completionDate: futureDate,
          subcontractor: null,
        },
      });

      mockPrisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        totalBudget: 1000000,
        contingency: 100000,
        committedCost: 500000,
        BudgetItem: [],
      });

      const preview = await previewChangeOrderImpact('proj-1', 'co-1');

      expect(preview!.cashFlowImpact.monthsAffected.length).toBeGreaterThan(0);
      expect(preview!.cashFlowImpact.additionalPerMonth).toBeGreaterThan(0);
    });

    it('should use approved amount if provided', async () => {
      mockPrisma.contractChangeOrder.findFirst.mockResolvedValue({
        id: 'co-1',
        projectId: 'proj-1',
        coNumber: 'CO-001',
        title: 'Change',
        originalAmount: 50000,
        daysAdded: 0,
        contract: {
          completionDate: new Date(),
          subcontractor: null,
        },
      });

      mockPrisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        totalBudget: 1000000,
        contingency: 100000,
        committedCost: 500000,
        BudgetItem: [],
      });

      const preview = await previewChangeOrderImpact('proj-1', 'co-1', 75000);

      expect(preview!.projectBudgetImpact.changeOrderAmount).toBe(75000);
      expect(preview!.changeOrder.approvedAmount).toBe(75000);
    });

    it('should return null if change order not found', async () => {
      mockPrisma.contractChangeOrder.findFirst.mockResolvedValue(null);

      const preview = await previewChangeOrderImpact('proj-1', 'missing-co');

      expect(preview).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.contractChangeOrder.findFirst.mockRejectedValue(new Error('DB error'));

      const preview = await previewChangeOrderImpact('proj-1', 'co-1');

      expect(preview).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('applyChangeOrderToBudget', () => {
    it('should apply change order to existing budget items', async () => {
      mockPrisma.contractChangeOrder.findFirst.mockResolvedValue({
        id: 'co-1',
        projectId: 'proj-1',
        coNumber: 'CO-001',
        title: 'Foundation Change',
        description: 'Additional excavation',
        originalAmount: 50000,
        daysAdded: 5,
        submittedAt: new Date(),
        approvedBy: 'user-1',
        contract: {
          title: 'Foundation',
          contractNumber: 'CNT-001',
          completionDate: new Date(),
          subcontractor: { tradeType: 'CONCRETE' },
        },
      });

      mockPrisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        totalBudget: 1000000,
        contingency: 100000,
        committedCost: 500000,
        BudgetItem: [
          {
            id: 'item-1',
            name: 'Foundation',
            tradeType: 'CONCRETE',
            budgetedAmount: 200000,
            revisedBudget: 200000,
            committedCost: 150000,
          },
        ],
      });

      mockPrisma.budgetItem.update.mockResolvedValue({});
      mockPrisma.projectBudget.update.mockResolvedValue({});
      mockPrisma.cashFlowForecast.findFirst.mockResolvedValue(null);
      mockPrisma.cashFlowForecast.create.mockResolvedValue({});
      mockPrisma.changeOrder.create.mockResolvedValue({});

      const result = await applyChangeOrderToBudget('proj-1', 'co-1', 50000);

      expect(result.success).toBe(true);
      expect(result.budgetItemsUpdated).toBe(1);
      expect(result.projectBudgetUpdated).toBe(true);
      expect(mockPrisma.budgetItem.update).toHaveBeenCalled();
      expect(mockPrisma.projectBudget.update).toHaveBeenCalled();
    });

    it('should create new budget item if none exist', async () => {
      mockPrisma.contractChangeOrder.findFirst.mockResolvedValue({
        id: 'co-1',
        projectId: 'proj-1',
        coNumber: 'CO-001',
        title: 'New Work',
        description: 'Additional scope',
        originalAmount: 50000,
        daysAdded: 0,
        contract: {
          title: 'New Work',
          contractNumber: 'CNT-002',
          completionDate: new Date(),
          subcontractor: { tradeType: 'ELECTRICAL' },
        },
      });

      mockPrisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        totalBudget: 1000000,
        contingency: 100000,
        committedCost: 500000,
        BudgetItem: [],
      });

      mockPrisma.budgetItem.create.mockResolvedValue({ id: 'new-item-1' });
      mockPrisma.projectBudget.update.mockResolvedValue({});
      mockPrisma.cashFlowForecast.findFirst.mockResolvedValue(null);
      mockPrisma.cashFlowForecast.create.mockResolvedValue({});
      mockPrisma.changeOrder.create.mockResolvedValue({});

      const result = await applyChangeOrderToBudget('proj-1', 'co-1', 50000, { createIfMissing: true });

      expect(result.success).toBe(true);
      expect(result.newBudgetItemId).toBe('new-item-1');
      expect(mockPrisma.budgetItem.create).toHaveBeenCalled();
    });

    it('should not create new item if createIfMissing is false', async () => {
      mockPrisma.contractChangeOrder.findFirst.mockResolvedValue({
        id: 'co-1',
        projectId: 'proj-1',
        coNumber: 'CO-001',
        title: 'Change',
        originalAmount: 50000,
        daysAdded: 0,
        contract: {
          contractNumber: 'CNT-001',
          completionDate: new Date(),
          subcontractor: null,
        },
      });

      mockPrisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        totalBudget: 1000000,
        contingency: 100000,
        committedCost: 500000,
        BudgetItem: [],
      });

      mockPrisma.projectBudget.update.mockResolvedValue({});
      mockPrisma.cashFlowForecast.findFirst.mockResolvedValue(null);
      mockPrisma.cashFlowForecast.create.mockResolvedValue({});
      mockPrisma.changeOrder.create.mockResolvedValue({});

      const result = await applyChangeOrderToBudget('proj-1', 'co-1', 50000, { createIfMissing: false });

      expect(result.budgetItemsUpdated).toBe(0);
      expect(mockPrisma.budgetItem.create).not.toHaveBeenCalled();
    });

    it('should use specific budget items if provided', async () => {
      mockPrisma.contractChangeOrder.findFirst.mockResolvedValue({
        id: 'co-1',
        projectId: 'proj-1',
        coNumber: 'CO-001',
        title: 'Change',
        originalAmount: 50000,
        daysAdded: 0,
        contract: {
          contractNumber: 'CNT-001',
          completionDate: new Date(),
          subcontractor: null,
        },
      });

      mockPrisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        totalBudget: 1000000,
        contingency: 100000,
        committedCost: 500000,
        BudgetItem: [
          { id: 'item-1', budgetedAmount: 200000, revisedBudget: 200000, committedCost: 150000 },
          { id: 'item-2', budgetedAmount: 150000, revisedBudget: 150000, committedCost: 100000 },
        ],
      });

      mockPrisma.budgetItem.update.mockResolvedValue({});
      mockPrisma.projectBudget.update.mockResolvedValue({});
      mockPrisma.cashFlowForecast.findFirst.mockResolvedValue(null);
      mockPrisma.cashFlowForecast.create.mockResolvedValue({});
      mockPrisma.changeOrder.create.mockResolvedValue({});

      const result = await applyChangeOrderToBudget('proj-1', 'co-1', 50000, {
        allocateToBudgetItems: ['item-1'],
      });

      expect(result.success).toBe(true);
      expect(result.budgetItemsUpdated).toBe(1);
    });

    it('should update cash flow forecasts', async () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 2);

      mockPrisma.contractChangeOrder.findFirst.mockResolvedValue({
        id: 'co-1',
        projectId: 'proj-1',
        coNumber: 'CO-001',
        title: 'Change',
        originalAmount: 60000,
        daysAdded: 0,
        contract: {
          contractNumber: 'CNT-001',
          completionDate: futureDate,
          subcontractor: null,
        },
      });

      mockPrisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        totalBudget: 1000000,
        contingency: 100000,
        committedCost: 500000,
        BudgetItem: [],
      });

      mockPrisma.budgetItem.create.mockResolvedValue({ id: 'item-1' });
      mockPrisma.projectBudget.update.mockResolvedValue({});
      mockPrisma.cashFlowForecast.findFirst.mockResolvedValue(null);
      mockPrisma.cashFlowForecast.create.mockResolvedValue({});
      mockPrisma.changeOrder.create.mockResolvedValue({});

      const result = await applyChangeOrderToBudget('proj-1', 'co-1', 60000);

      expect(result.cashFlowsUpdated).toBeGreaterThan(0);
      expect(mockPrisma.cashFlowForecast.create).toHaveBeenCalled();
    });

    it('should update existing cash flow forecast', async () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 1);

      mockPrisma.contractChangeOrder.findFirst.mockResolvedValue({
        id: 'co-1',
        projectId: 'proj-1',
        coNumber: 'CO-001',
        title: 'Change',
        originalAmount: 30000,
        daysAdded: 0,
        contract: {
          contractNumber: 'CNT-001',
          completionDate: futureDate,
          subcontractor: null,
        },
      });

      mockPrisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        totalBudget: 1000000,
        contingency: 100000,
        committedCost: 500000,
        BudgetItem: [],
      });

      mockPrisma.budgetItem.create.mockResolvedValue({ id: 'item-1' });
      mockPrisma.projectBudget.update.mockResolvedValue({});
      mockPrisma.cashFlowForecast.findFirst.mockResolvedValue({
        id: 'cf-1',
        forecastOutflow: 50000,
        notes: 'Existing forecast',
      });
      mockPrisma.cashFlowForecast.update.mockResolvedValue({});
      mockPrisma.changeOrder.create.mockResolvedValue({});

      const result = await applyChangeOrderToBudget('proj-1', 'co-1', 30000);

      expect(result.cashFlowsUpdated).toBeGreaterThan(0);
      expect(mockPrisma.cashFlowForecast.update).toHaveBeenCalled();
    });

    it('should use contingency when requested', async () => {
      mockPrisma.contractChangeOrder.findFirst.mockResolvedValue({
        id: 'co-1',
        projectId: 'proj-1',
        coNumber: 'CO-001',
        title: 'Change',
        originalAmount: 50000,
        daysAdded: 0,
        contract: {
          contractNumber: 'CNT-001',
          completionDate: new Date(),
          subcontractor: null,
        },
      });

      mockPrisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        totalBudget: 1000000,
        contingency: 100000,
        committedCost: 500000,
        BudgetItem: [],
      });

      mockPrisma.budgetItem.create.mockResolvedValue({ id: 'item-1' });
      mockPrisma.projectBudget.update.mockResolvedValue({});
      mockPrisma.cashFlowForecast.findFirst.mockResolvedValue(null);
      mockPrisma.cashFlowForecast.create.mockResolvedValue({});
      mockPrisma.changeOrder.create.mockResolvedValue({});

      await applyChangeOrderToBudget('proj-1', 'co-1', 50000, { useContingency: true });

      expect(mockPrisma.projectBudget.update).toHaveBeenCalledWith({
        where: { id: 'budget-1' },
        data: expect.objectContaining({
          contingency: 50000, // 100000 - 50000
        }),
      });
    });

    it('should return error if change order not found', async () => {
      mockPrisma.contractChangeOrder.findFirst.mockResolvedValue(null);

      const result = await applyChangeOrderToBudget('proj-1', 'missing-co', 50000);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error if project budget not found', async () => {
      mockPrisma.contractChangeOrder.findFirst.mockResolvedValue({
        id: 'co-1',
        contract: {
          contractNumber: 'CNT-001',
          completionDate: new Date(),
        },
      });

      mockPrisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await applyChangeOrderToBudget('proj-1', 'co-1', 50000);

      expect(result.success).toBe(false);
      expect(result.error).toContain('budget not found');
    });

    it('should handle legacy sync errors gracefully', async () => {
      mockPrisma.contractChangeOrder.findFirst.mockResolvedValue({
        id: 'co-1',
        projectId: 'proj-1',
        coNumber: 'CO-001',
        title: 'Change',
        originalAmount: 50000,
        daysAdded: 0,
        contract: {
          contractNumber: 'CNT-001',
          completionDate: new Date(),
          subcontractor: null,
        },
      });

      mockPrisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        totalBudget: 1000000,
        contingency: 100000,
        committedCost: 500000,
        BudgetItem: [],
      });

      mockPrisma.budgetItem.create.mockResolvedValue({ id: 'item-1' });
      mockPrisma.projectBudget.update.mockResolvedValue({});
      mockPrisma.cashFlowForecast.findFirst.mockResolvedValue(null);
      mockPrisma.cashFlowForecast.create.mockResolvedValue({});
      mockPrisma.changeOrder.create.mockRejectedValue(new Error('Legacy sync error'));

      const result = await applyChangeOrderToBudget('proj-1', 'co-1', 50000);

      expect(result.success).toBe(true); // Should still succeed
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('recalculateBudgetFromChangeOrders', () => {
    it('should calculate totals from change orders', async () => {
      mockPrisma.contractChangeOrder.findMany.mockResolvedValue([
        { status: 'APPROVED', approvedAmount: 50000, originalAmount: 45000 },
        { status: 'APPROVED', approvedAmount: null, originalAmount: 30000 },
        { status: 'DRAFT', originalAmount: 20000 },
        { status: 'SUBMITTED', originalAmount: 15000 },
      ]);

      const stats = await recalculateBudgetFromChangeOrders('proj-1');

      expect(stats.totalChangeOrderValue).toBe(80000); // 50000 + 30000
      expect(stats.approvedCount).toBe(2);
      expect(stats.pendingCount).toBe(2);
      expect(stats.pendingValue).toBe(35000); // 20000 + 15000
    });

    it('should handle empty project', async () => {
      mockPrisma.contractChangeOrder.findMany.mockResolvedValue([]);

      const stats = await recalculateBudgetFromChangeOrders('proj-1');

      expect(stats.totalChangeOrderValue).toBe(0);
      expect(stats.approvedCount).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.contractChangeOrder.findMany.mockRejectedValue(new Error('DB error'));

      const stats = await recalculateBudgetFromChangeOrders('proj-1');

      expect(stats.totalChangeOrderValue).toBe(0);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getBudgetWithChangeOrders', () => {
    it('should get budget with change order summary', async () => {
      mockPrisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        projectId: 'proj-1',
        totalBudget: 1050000,
        BudgetItem: [
          { id: 'item-1', ChangeOrder: [] },
        ],
      });

      mockPrisma.contractChangeOrder.findMany.mockResolvedValue([
        { status: 'APPROVED', approvedAmount: 50000, originalAmount: 50000 },
      ]);

      const budget = await getBudgetWithChangeOrders('proj-1');

      expect(budget).not.toBeNull();
      expect(budget!.changeOrderSummary.totalChangeOrderValue).toBe(50000);
      expect(budget!.originalBudget).toBe(1000000); // 1050000 - 50000
      expect(budget!.variance).toBe(50000);
    });

    it('should return null if budget not found', async () => {
      mockPrisma.projectBudget.findUnique.mockResolvedValue(null);

      const budget = await getBudgetWithChangeOrders('proj-1');

      expect(budget).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.projectBudget.findUnique.mockRejectedValue(new Error('DB error'));

      const budget = await getBudgetWithChangeOrders('proj-1');

      expect(budget).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
