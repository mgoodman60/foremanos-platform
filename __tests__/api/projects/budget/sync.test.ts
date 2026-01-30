import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies BEFORE importing the route
const mockSession = {
  user: {
    id: 'user-1',
    email: 'test@example.com',
    role: 'client',
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

const mockProject = {
  id: 'project-1',
  slug: 'test-project',
  name: 'Test Project',
  ownerId: 'user-1',
};

const mockBudget = {
  id: 'budget-1',
  projectId: 'project-1',
  totalBudget: 1000000,
  contingency: 50000,
  actualCost: 0,
  committedCost: 0,
  baselineDate: new Date('2024-01-01'),
  lastUpdated: new Date(),
  currency: 'USD',
  BudgetItem: [] as any[],
};

const prismaMock = {
  project: {
    findUnique: vi.fn(),
  },
  projectBudget: {
    update: vi.fn(),
  },
  budgetItem: {
    update: vi.fn(),
  },
};

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

const getServerSessionMock = vi.fn();
vi.mock('next-auth', () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock('@/lib/auth-options', () => ({
  authOptions: {},
}));

describe('POST /api/projects/[slug]/budget/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue(mockSession);
  });

  it('should return 401 when not authenticated', async () => {
    getServerSessionMock.mockResolvedValue(null);

    const { POST } = await import('@/app/api/projects/[slug]/budget/sync/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget/sync', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 when project not found', async () => {
    prismaMock.project.findUnique.mockResolvedValue(null);

    const { POST } = await import('@/app/api/projects/[slug]/budget/sync/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget/sync', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Project not found');
  });

  it('should return 404 when budget does not exist', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      ProjectBudget: null,
    });

    const { POST } = await import('@/app/api/projects/[slug]/budget/sync/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget/sync', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('No budget found');
  });

  it('should sync totals from budget items using contractAmount', async () => {
    const budgetItems = [
      {
        id: 'item-1',
        name: 'Concrete Work',
        contractAmount: 100000,
        budgetedAmount: 90000,
        actualCost: 25000,
        committedCost: 75000,
      },
      {
        id: 'item-2',
        name: 'Electrical',
        contractAmount: 200000,
        budgetedAmount: 180000,
        actualCost: 50000,
        committedCost: 150000,
      },
    ];

    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      ProjectBudget: {
        ...mockBudget,
        BudgetItem: budgetItems,
      },
    });

    const updatedBudget = {
      ...mockBudget,
      totalBudget: 300000,
      actualCost: 75000,
      committedCost: 225000,
    };

    prismaMock.projectBudget.update.mockResolvedValue(updatedBudget);

    const { POST } = await import('@/app/api/projects/[slug]/budget/sync/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget/sync', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.itemTotals.contractAmountSum).toBe(300000);
    expect(data.itemTotals.actualCost).toBe(75000);
    expect(data.itemTotals.committedCost).toBe(225000);
    expect(data.sourceField).toBe('contractAmount');

    expect(prismaMock.projectBudget.update).toHaveBeenCalledWith({
      where: { id: 'budget-1' },
      data: {
        totalBudget: 300000,
        actualCost: 75000,
        committedCost: 225000,
        lastUpdated: expect.any(Date),
      },
    });
  });

  it('should fall back to budgetedAmount when contractAmount is 0', async () => {
    const budgetItems = [
      {
        id: 'item-1',
        name: 'Item 1',
        contractAmount: 0,
        budgetedAmount: 50000,
        actualCost: 10000,
        committedCost: 20000,
      },
      {
        id: 'item-2',
        name: 'Item 2',
        contractAmount: null,
        budgetedAmount: 75000,
        actualCost: 15000,
        committedCost: 30000,
      },
    ];

    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      ProjectBudget: {
        ...mockBudget,
        BudgetItem: budgetItems,
      },
    });

    prismaMock.projectBudget.update.mockResolvedValue(mockBudget);

    const { POST } = await import('@/app/api/projects/[slug]/budget/sync/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget/sync', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.itemTotals.budgetedAmountSum).toBe(125000);
    expect(data.sourceField).toBe('budgetedAmount');
  });

  it('should accept manual totalBudget override', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      ProjectBudget: {
        ...mockBudget,
        totalBudget: 1000000,
        BudgetItem: [
          {
            id: 'item-1',
            contractAmount: 100000,
            budgetedAmount: 100000,
            actualCost: 0,
            committedCost: 0,
          },
        ],
      },
    });

    prismaMock.projectBudget.update.mockResolvedValue(mockBudget);

    const { POST } = await import('@/app/api/projects/[slug]/budget/sync/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget/sync', {
      method: 'POST',
      body: JSON.stringify({ totalBudget: 1500000 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.totalChanged).toBe(true);

    expect(prismaMock.projectBudget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalBudget: 1500000,
        }),
      })
    );
  });

  it('should recalculate revisedBudget when recalculate=true', async () => {
    const budgetItems = [
      {
        id: 'item-1',
        contractAmount: 100000,
        budgetedAmount: 100000,
        revisedBudget: null,
        actualCost: 0,
        committedCost: 0,
      },
      {
        id: 'item-2',
        contractAmount: 200000,
        budgetedAmount: 200000,
        revisedBudget: null,
        actualCost: 0,
        committedCost: 0,
      },
    ];

    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      ProjectBudget: {
        ...mockBudget,
        BudgetItem: budgetItems,
      },
    });

    prismaMock.projectBudget.update.mockResolvedValue(mockBudget);
    prismaMock.budgetItem.update.mockResolvedValue({});

    const { POST } = await import('@/app/api/projects/[slug]/budget/sync/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget/sync', {
      method: 'POST',
      body: JSON.stringify({ recalculate: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(200);

    // Should have called update for each item with contractAmount but no revisedBudget
    expect(prismaMock.budgetItem.update).toHaveBeenCalledTimes(2);
  });

  it('should return 500 on database error', async () => {
    prismaMock.project.findUnique.mockRejectedValue(new Error('Database error'));

    const { POST } = await import('@/app/api/projects/[slug]/budget/sync/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget/sync', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Failed to sync budget');
  });
});

describe('PUT /api/projects/[slug]/budget/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue(mockSession);
  });

  it('should manually update totalBudget', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      ProjectBudget: mockBudget,
    });

    const updatedBudget = {
      ...mockBudget,
      totalBudget: 1200000,
    };

    prismaMock.projectBudget.update.mockResolvedValue(updatedBudget);

    const { PUT } = await import('@/app/api/projects/[slug]/budget/sync/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget/sync', {
      method: 'PUT',
      body: JSON.stringify({ totalBudget: 1200000 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await PUT(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.budget.totalBudget).toBe(1200000);

    expect(prismaMock.projectBudget.update).toHaveBeenCalledWith({
      where: { id: 'budget-1' },
      data: expect.objectContaining({
        totalBudget: 1200000,
        lastUpdated: expect.any(Date),
      }),
    });
  });

  it('should manually update contingency', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      ProjectBudget: mockBudget,
    });

    const updatedBudget = {
      ...mockBudget,
      contingency: 75000,
    };

    prismaMock.projectBudget.update.mockResolvedValue(updatedBudget);

    const { PUT } = await import('@/app/api/projects/[slug]/budget/sync/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget/sync', {
      method: 'PUT',
      body: JSON.stringify({ contingency: 75000 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await PUT(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.budget.contingency).toBe(75000);
  });

  it('should return 404 when budget does not exist', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      ProjectBudget: null,
    });

    const { PUT } = await import('@/app/api/projects/[slug]/budget/sync/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget/sync', {
      method: 'PUT',
      body: JSON.stringify({ totalBudget: 1200000 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await PUT(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('No budget found');
  });
});
