import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies using vi.hoisted pattern
const mocks = vi.hoisted(() => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
    },
    projectBudget: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    budgetItem: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }));

// Import after mocking
import {
  importOneSeniorCareBudget,
  getBudgetSummaryByPhase,
  ONE_SENIOR_CARE_BUDGET,
  WalkerBudgetLine,
} from '@/lib/budget-importer';

describe('BudgetImporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('ONE_SENIOR_CARE_BUDGET', () => {
    it('should have correct structure', () => {
      expect(ONE_SENIOR_CARE_BUDGET).toBeDefined();
      expect(Array.isArray(ONE_SENIOR_CARE_BUDGET)).toBe(true);
      expect(ONE_SENIOR_CARE_BUDGET.length).toBeGreaterThan(0);
    });

    it('should have all required fields on each item', () => {
      ONE_SENIOR_CARE_BUDGET.forEach((item) => {
        expect(item).toHaveProperty('phaseCode');
        expect(item).toHaveProperty('phaseName');
        expect(item).toHaveProperty('categoryNumber');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('contractAmount');
        expect(item).toHaveProperty('billedToDate');
        expect(item).toHaveProperty('actualCost');
        expect(item).toHaveProperty('budgetedAmount');
        expect(item).toHaveProperty('budgetedHours');
        expect(item).toHaveProperty('actualHours');
      });
    });

    it('should have Phase 100 - General Requirements', () => {
      const phase100Items = ONE_SENIOR_CARE_BUDGET.filter(
        (item) => item.phaseCode === 100
      );
      expect(phase100Items.length).toBeGreaterThan(0);
      expect(phase100Items[0].phaseName).toBe('GENERAL REQUIREMENTS');
    });

    it('should have Phase 200 - Sitework', () => {
      const phase200Items = ONE_SENIOR_CARE_BUDGET.filter(
        (item) => item.phaseCode === 200
      );
      expect(phase200Items.length).toBeGreaterThan(0);
      expect(phase200Items[0].phaseName).toBe('SITEWORK');
    });

    it('should have Phase 300 - Concrete', () => {
      const phase300Items = ONE_SENIOR_CARE_BUDGET.filter(
        (item) => item.phaseCode === 300
      );
      expect(phase300Items.length).toBeGreaterThan(0);
      expect(phase300Items[0].phaseName).toBe('CONCRETE');
    });

    it('should have Phase 2300 - HVAC/Plumbing', () => {
      const phase2300Items = ONE_SENIOR_CARE_BUDGET.filter(
        (item) => item.phaseCode === 2300
      );
      expect(phase2300Items.length).toBeGreaterThan(0);
      expect(phase2300Items[0].phaseName).toBe('HVAC / PLUMBING');
    });

    it('should have Phase 3000 - Design', () => {
      const phase3000Items = ONE_SENIOR_CARE_BUDGET.filter(
        (item) => item.phaseCode === 3000
      );
      expect(phase3000Items.length).toBeGreaterThan(0);
      expect(phase3000Items[0].phaseName).toBe('DESIGN');
    });

    it('should have valid numeric values', () => {
      ONE_SENIOR_CARE_BUDGET.forEach((item) => {
        expect(typeof item.phaseCode).toBe('number');
        expect(typeof item.categoryNumber).toBe('number');
        expect(typeof item.contractAmount).toBe('number');
        expect(typeof item.billedToDate).toBe('number');
        expect(typeof item.actualCost).toBe('number');
        expect(typeof item.budgetedAmount).toBe('number');
        expect(typeof item.budgetedHours).toBe('number');
        expect(typeof item.actualHours).toBe('number');
      });
    });

    it('should have non-negative budgeted amounts', () => {
      ONE_SENIOR_CARE_BUDGET.forEach((item) => {
        expect(item.budgetedAmount).toBeGreaterThanOrEqual(0);
      });
    });

    it('should calculate correct total budget', () => {
      const total = ONE_SENIOR_CARE_BUDGET.reduce(
        (sum, item) => sum + item.budgetedAmount,
        0
      );
      expect(total).toBeGreaterThan(0);
    });
  });

  describe('importOneSeniorCareBudget', () => {
    it('should import budget successfully for new project', async () => {
      const mockProject = { id: 'project-1', slug: 'one-senior-care' };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.projectBudget.findFirst.mockResolvedValue(null);
      mocks.prisma.projectBudget.create.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        totalBudget: 2985000,
        contingency: 50000,
        baselineDate: new Date(),
        BudgetItem: [],
      });
      mocks.prisma.budgetItem.create.mockResolvedValue({ id: 'item-1' });
      mocks.prisma.projectBudget.update.mockResolvedValue({
        id: 'budget-1',
        totalBudget: 2771440,
      });

      const result = await importOneSeniorCareBudget('one-senior-care');

      expect(result.success).toBe(true);
      expect(result.itemsCreated).toBe(ONE_SENIOR_CARE_BUDGET.length);
      expect(result.totalBudget).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();

      expect(mocks.prisma.project.findUnique).toHaveBeenCalledWith({
        where: { slug: 'one-senior-care' },
      });
      expect(mocks.prisma.projectBudget.create).toHaveBeenCalled();
      expect(mocks.prisma.budgetItem.create).toHaveBeenCalledTimes(
        ONE_SENIOR_CARE_BUDGET.length
      );
    });

    it('should clear existing budget items before import', async () => {
      const mockProject = { id: 'project-1', slug: 'one-senior-care' };
      const mockBudget = {
        id: 'budget-1',
        projectId: 'project-1',
        totalBudget: 2985000,
        BudgetItem: [
          { id: 'old-item-1', name: 'Old Item 1' },
          { id: 'old-item-2', name: 'Old Item 2' },
        ],
      };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.projectBudget.findFirst.mockResolvedValue(mockBudget);
      mocks.prisma.budgetItem.deleteMany.mockResolvedValue({ count: 2 });
      mocks.prisma.budgetItem.create.mockResolvedValue({ id: 'item-1' });
      mocks.prisma.projectBudget.update.mockResolvedValue({
        id: 'budget-1',
        totalBudget: 2771440,
      });

      const result = await importOneSeniorCareBudget('one-senior-care');

      expect(result.success).toBe(true);
      expect(mocks.prisma.budgetItem.deleteMany).toHaveBeenCalledWith({
        where: { budgetId: 'budget-1' },
      });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Cleared 2 existing items')
      );
    });

    it('should not clear items if budget has no existing items', async () => {
      const mockProject = { id: 'project-1', slug: 'one-senior-care' };
      const mockBudget = {
        id: 'budget-1',
        projectId: 'project-1',
        totalBudget: 2985000,
        BudgetItem: [],
      };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.projectBudget.findFirst.mockResolvedValue(mockBudget);
      mocks.prisma.budgetItem.create.mockResolvedValue({ id: 'item-1' });
      mocks.prisma.projectBudget.update.mockResolvedValue({
        id: 'budget-1',
        totalBudget: 2771440,
      });

      const result = await importOneSeniorCareBudget('one-senior-care');

      expect(result.success).toBe(true);
      expect(mocks.prisma.budgetItem.deleteMany).not.toHaveBeenCalled();
    });

    it('should return error when project not found', async () => {
      mocks.prisma.project.findUnique.mockResolvedValue(null);

      const result = await importOneSeniorCareBudget('nonexistent-project');

      expect(result.success).toBe(false);
      expect(result.itemsCreated).toBe(0);
      expect(result.totalBudget).toBe(0);
      expect(result.error).toBe('Project not found');
    });

    it('should create budget with correct initial values', async () => {
      const mockProject = { id: 'project-1', slug: 'one-senior-care' };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.projectBudget.findFirst.mockResolvedValue(null);
      mocks.prisma.projectBudget.create.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        totalBudget: 2985000,
        contingency: 50000,
        baselineDate: new Date(),
        BudgetItem: [],
      });
      mocks.prisma.budgetItem.create.mockResolvedValue({ id: 'item-1' });
      mocks.prisma.projectBudget.update.mockResolvedValue({
        id: 'budget-1',
        totalBudget: 2771440,
      });

      await importOneSeniorCareBudget('one-senior-care');

      expect(mocks.prisma.projectBudget.create).toHaveBeenCalledWith({
        data: {
          projectId: 'project-1',
          totalBudget: 2985000,
          contingency: 50000,
          baselineDate: expect.any(Date),
        },
        include: { BudgetItem: true },
      });
    });

    it('should create budget items with all required fields', async () => {
      const mockProject = { id: 'project-1', slug: 'one-senior-care' };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.projectBudget.findFirst.mockResolvedValue(null);
      mocks.prisma.projectBudget.create.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        totalBudget: 2985000,
        contingency: 50000,
        baselineDate: new Date(),
        BudgetItem: [],
      });
      mocks.prisma.budgetItem.create.mockResolvedValue({ id: 'item-1' });
      mocks.prisma.projectBudget.update.mockResolvedValue({
        id: 'budget-1',
        totalBudget: 2771440,
      });

      await importOneSeniorCareBudget('one-senior-care');

      const firstBudgetItem = ONE_SENIOR_CARE_BUDGET[0];
      expect(mocks.prisma.budgetItem.create).toHaveBeenCalledWith({
        data: {
          budgetId: 'budget-1',
          name: firstBudgetItem.name,
          phaseCode: firstBudgetItem.phaseCode,
          phaseName: firstBudgetItem.phaseName,
          categoryNumber: firstBudgetItem.categoryNumber,
          budgetedAmount: firstBudgetItem.budgetedAmount,
          contractAmount: firstBudgetItem.contractAmount,
          actualCost: firstBudgetItem.actualCost,
          billedToDate: firstBudgetItem.billedToDate,
          budgetedHours: firstBudgetItem.budgetedHours,
          actualHours: firstBudgetItem.actualHours,
        },
      });
    });

    it('should update budget total after importing items', async () => {
      const mockProject = { id: 'project-1', slug: 'one-senior-care' };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.projectBudget.findFirst.mockResolvedValue(null);
      mocks.prisma.projectBudget.create.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        totalBudget: 2985000,
        contingency: 50000,
        baselineDate: new Date(),
        BudgetItem: [],
      });
      mocks.prisma.budgetItem.create.mockResolvedValue({ id: 'item-1' });
      mocks.prisma.projectBudget.update.mockResolvedValue({
        id: 'budget-1',
        totalBudget: 2771440,
      });

      const result = await importOneSeniorCareBudget('one-senior-care');

      const expectedTotal = ONE_SENIOR_CARE_BUDGET.reduce(
        (sum, item) => sum + item.budgetedAmount,
        0
      );

      expect(mocks.prisma.projectBudget.update).toHaveBeenCalledWith({
        where: { id: 'budget-1' },
        data: {
          totalBudget: expectedTotal,
        },
      });
      expect(result.totalBudget).toBe(expectedTotal);
    });

    it('should log success message with item count and total', async () => {
      const mockProject = { id: 'project-1', slug: 'one-senior-care' };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.projectBudget.findFirst.mockResolvedValue(null);
      mocks.prisma.projectBudget.create.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        totalBudget: 2985000,
        contingency: 50000,
        baselineDate: new Date(),
        BudgetItem: [],
      });
      mocks.prisma.budgetItem.create.mockResolvedValue({ id: 'item-1' });
      mocks.prisma.projectBudget.update.mockResolvedValue({
        id: 'budget-1',
        totalBudget: 2771440,
      });

      await importOneSeniorCareBudget('one-senior-care');

      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/Created \d+ items, total: \$[\d,]+/)
      );
    });

    it('should handle database errors gracefully', async () => {
      const mockProject = { id: 'project-1', slug: 'one-senior-care' };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.projectBudget.findFirst.mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await importOneSeniorCareBudget('one-senior-care');

      expect(result.success).toBe(false);
      expect(result.itemsCreated).toBe(0);
      expect(result.totalBudget).toBe(0);
      expect(result.error).toContain('Database connection failed');
      expect(console.error).toHaveBeenCalledWith(
        '[Budget Import] Error:',
        expect.any(Error)
      );
    });

    it('should handle budget creation error', async () => {
      const mockProject = { id: 'project-1', slug: 'one-senior-care' };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.projectBudget.findFirst.mockResolvedValue(null);
      mocks.prisma.projectBudget.create.mockRejectedValue(
        new Error('Failed to create budget')
      );

      const result = await importOneSeniorCareBudget('one-senior-care');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create budget');
    });

    it('should handle budget item creation error', async () => {
      const mockProject = { id: 'project-1', slug: 'one-senior-care' };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.projectBudget.findFirst.mockResolvedValue(null);
      mocks.prisma.projectBudget.create.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        totalBudget: 2985000,
        contingency: 50000,
        baselineDate: new Date(),
        BudgetItem: [],
      });
      mocks.prisma.budgetItem.create.mockRejectedValue(
        new Error('Failed to create budget item')
      );

      const result = await importOneSeniorCareBudget('one-senior-care');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create budget item');
    });
  });

  describe('getBudgetSummaryByPhase', () => {
    it('should return empty summary when project not found', async () => {
      mocks.prisma.project.findUnique.mockResolvedValue(null);

      const result = await getBudgetSummaryByPhase('nonexistent-project');

      expect(result.phases).toEqual([]);
      expect(result.totalBudgeted).toBe(0);
      expect(result.totalActual).toBe(0);
    });

    it('should return empty summary when budget not found', async () => {
      const mockProject = { id: 'project-1', slug: 'one-senior-care' };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.projectBudget.findFirst.mockResolvedValue(null);

      const result = await getBudgetSummaryByPhase('one-senior-care');

      expect(result.phases).toEqual([]);
      expect(result.totalBudgeted).toBe(0);
      expect(result.totalActual).toBe(0);
    });

    it('should return correct phase summary with items', async () => {
      const mockProject = { id: 'project-1', slug: 'one-senior-care' };
      const mockBudget = {
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [
          {
            id: 'item-1',
            phaseCode: 100,
            phaseName: 'GENERAL REQUIREMENTS',
            budgetedAmount: 100000,
            actualCost: 50000,
          },
          {
            id: 'item-2',
            phaseCode: 100,
            phaseName: 'GENERAL REQUIREMENTS',
            budgetedAmount: 50000,
            actualCost: 25000,
          },
          {
            id: 'item-3',
            phaseCode: 200,
            phaseName: 'SITEWORK',
            budgetedAmount: 200000,
            actualCost: 150000,
          },
        ],
      };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.projectBudget.findFirst.mockResolvedValue(mockBudget);

      const result = await getBudgetSummaryByPhase('one-senior-care');

      expect(result.phases).toHaveLength(2);
      expect(result.totalBudgeted).toBe(350000);
      expect(result.totalActual).toBe(225000);

      const phase100 = result.phases.find((p) => p.phaseCode === 100);
      expect(phase100).toBeDefined();
      expect(phase100?.budgeted).toBe(150000);
      expect(phase100?.actual).toBe(75000);
      expect(phase100?.variance).toBe(75000);
      expect(phase100?.percentComplete).toBe(50);

      const phase200 = result.phases.find((p) => p.phaseCode === 200);
      expect(phase200).toBeDefined();
      expect(phase200?.budgeted).toBe(200000);
      expect(phase200?.actual).toBe(150000);
      expect(phase200?.variance).toBe(50000);
      expect(phase200?.percentComplete).toBe(75);
    });

    it('should sort phases by phase code', async () => {
      const mockProject = { id: 'project-1', slug: 'one-senior-care' };
      const mockBudget = {
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [
          {
            id: 'item-1',
            phaseCode: 3000,
            phaseName: 'DESIGN',
            budgetedAmount: 100000,
            actualCost: 50000,
          },
          {
            id: 'item-2',
            phaseCode: 100,
            phaseName: 'GENERAL REQUIREMENTS',
            budgetedAmount: 50000,
            actualCost: 25000,
          },
          {
            id: 'item-3',
            phaseCode: 200,
            phaseName: 'SITEWORK',
            budgetedAmount: 200000,
            actualCost: 150000,
          },
        ],
      };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.projectBudget.findFirst.mockResolvedValue(mockBudget);

      const result = await getBudgetSummaryByPhase('one-senior-care');

      expect(result.phases[0].phaseCode).toBe(100);
      expect(result.phases[1].phaseCode).toBe(200);
      expect(result.phases[2].phaseCode).toBe(3000);
    });

    it('should skip items without phase code', async () => {
      const mockProject = { id: 'project-1', slug: 'one-senior-care' };
      const mockBudget = {
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [
          {
            id: 'item-1',
            phaseCode: 100,
            phaseName: 'GENERAL REQUIREMENTS',
            budgetedAmount: 100000,
            actualCost: 50000,
          },
          {
            id: 'item-2',
            phaseCode: null,
            phaseName: null,
            budgetedAmount: 50000,
            actualCost: 25000,
          },
        ],
      };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.projectBudget.findFirst.mockResolvedValue(mockBudget);

      const result = await getBudgetSummaryByPhase('one-senior-care');

      expect(result.phases).toHaveLength(1);
      expect(result.phases[0].phaseCode).toBe(100);
    });

    it('should calculate variance correctly (budgeted - actual)', async () => {
      const mockProject = { id: 'project-1', slug: 'one-senior-care' };
      const mockBudget = {
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [
          {
            id: 'item-1',
            phaseCode: 100,
            phaseName: 'GENERAL REQUIREMENTS',
            budgetedAmount: 100000,
            actualCost: 120000, // Over budget
          },
        ],
      };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.projectBudget.findFirst.mockResolvedValue(mockBudget);

      const result = await getBudgetSummaryByPhase('one-senior-care');

      const phase100 = result.phases[0];
      expect(phase100.variance).toBe(-20000); // Negative variance (over budget)
    });

    it('should calculate percent complete correctly', async () => {
      const mockProject = { id: 'project-1', slug: 'one-senior-care' };
      const mockBudget = {
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [
          {
            id: 'item-1',
            phaseCode: 100,
            phaseName: 'GENERAL REQUIREMENTS',
            budgetedAmount: 100000,
            actualCost: 33333,
          },
        ],
      };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.projectBudget.findFirst.mockResolvedValue(mockBudget);

      const result = await getBudgetSummaryByPhase('one-senior-care');

      const phase100 = result.phases[0];
      expect(phase100.percentComplete).toBe(33); // Rounded
    });

    it('should handle zero budgeted amount (avoid division by zero)', async () => {
      const mockProject = { id: 'project-1', slug: 'one-senior-care' };
      const mockBudget = {
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [
          {
            id: 'item-1',
            phaseCode: 100,
            phaseName: 'GENERAL REQUIREMENTS',
            budgetedAmount: 0,
            actualCost: 50000,
          },
        ],
      };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.projectBudget.findFirst.mockResolvedValue(mockBudget);

      const result = await getBudgetSummaryByPhase('one-senior-care');

      const phase100 = result.phases[0];
      expect(phase100.percentComplete).toBe(0);
    });

    it('should aggregate multiple items in same phase', async () => {
      const mockProject = { id: 'project-1', slug: 'one-senior-care' };
      const mockBudget = {
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [
          {
            id: 'item-1',
            phaseCode: 100,
            phaseName: 'GENERAL REQUIREMENTS',
            budgetedAmount: 50000,
            actualCost: 30000,
          },
          {
            id: 'item-2',
            phaseCode: 100,
            phaseName: 'GENERAL REQUIREMENTS',
            budgetedAmount: 30000,
            actualCost: 20000,
          },
          {
            id: 'item-3',
            phaseCode: 100,
            phaseName: 'GENERAL REQUIREMENTS',
            budgetedAmount: 20000,
            actualCost: 10000,
          },
        ],
      };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.projectBudget.findFirst.mockResolvedValue(mockBudget);

      const result = await getBudgetSummaryByPhase('one-senior-care');

      expect(result.phases).toHaveLength(1);
      const phase100 = result.phases[0];
      expect(phase100.budgeted).toBe(100000);
      expect(phase100.actual).toBe(60000);
    });

    it('should handle empty phase name gracefully', async () => {
      const mockProject = { id: 'project-1', slug: 'one-senior-care' };
      const mockBudget = {
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [
          {
            id: 'item-1',
            phaseCode: 100,
            phaseName: null,
            budgetedAmount: 100000,
            actualCost: 50000,
          },
        ],
      };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.projectBudget.findFirst.mockResolvedValue(mockBudget);

      const result = await getBudgetSummaryByPhase('one-senior-care');

      expect(result.phases[0].phaseName).toBe('');
    });

    it('should calculate total budgeted from all phases', async () => {
      const mockProject = { id: 'project-1', slug: 'one-senior-care' };
      const mockBudget = {
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [
          {
            id: 'item-1',
            phaseCode: 100,
            phaseName: 'GENERAL REQUIREMENTS',
            budgetedAmount: 100000,
            actualCost: 50000,
          },
          {
            id: 'item-2',
            phaseCode: 200,
            phaseName: 'SITEWORK',
            budgetedAmount: 200000,
            actualCost: 150000,
          },
          {
            id: 'item-3',
            phaseCode: 300,
            phaseName: 'CONCRETE',
            budgetedAmount: 300000,
            actualCost: 250000,
          },
        ],
      };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.projectBudget.findFirst.mockResolvedValue(mockBudget);

      const result = await getBudgetSummaryByPhase('one-senior-care');

      expect(result.totalBudgeted).toBe(600000);
      expect(result.totalActual).toBe(450000);
    });

    it('should handle budget with no items', async () => {
      const mockProject = { id: 'project-1', slug: 'one-senior-care' };
      const mockBudget = {
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [],
      };

      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.projectBudget.findFirst.mockResolvedValue(mockBudget);

      const result = await getBudgetSummaryByPhase('one-senior-care');

      expect(result.phases).toEqual([]);
      expect(result.totalBudgeted).toBe(0);
      expect(result.totalActual).toBe(0);
    });
  });
});
