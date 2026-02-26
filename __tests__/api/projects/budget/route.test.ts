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
  ProjectBudget: null as any,
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
  createdAt: new Date(),
  updatedAt: new Date(),
  BudgetItem: [],
  EarnedValue: [],
};

const prismaMock = {
  project: {
    findUnique: vi.fn(),
  },
  projectBudget: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

const getServerSessionMock = vi.fn();
vi.mock('@/auth', () => ({
  auth: getServerSessionMock,
}));

describe('GET /api/projects/[slug]/budget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue(mockSession);
  });

  it('should return 401 when not authenticated', async () => {
    getServerSessionMock.mockResolvedValue(null);

    const { GET } = await import('@/app/api/projects/[slug]/budget/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget');
    const response = await GET(request, { params: Promise.resolve({ slug: 'test-project' }) });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 when project not found', async () => {
    prismaMock.project.findUnique.mockResolvedValue(null);

    const { GET } = await import('@/app/api/projects/[slug]/budget/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget');
    const response = await GET(request, { params: Promise.resolve({ slug: 'test-project' }) });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Project not found');
  });

  it('should return budget with items and EV history', async () => {
    const projectWithBudget = {
      ...mockProject,
      ProjectBudget: {
        ...mockBudget,
        BudgetItem: [
          {
            id: 'item-1',
            name: 'Concrete Work',
            budgetedAmount: 100000,
            actualCost: 25000,
          },
        ],
        EarnedValue: [
          {
            id: 'ev-1',
            periodDate: new Date('2024-01-15'),
            plannedValue: 50000,
            earnedValue: 40000,
            actualCost: 45000,
          },
        ],
      },
    };

    prismaMock.project.findUnique.mockResolvedValue(projectWithBudget);

    const { GET } = await import('@/app/api/projects/[slug]/budget/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget');
    const response = await GET(request, { params: Promise.resolve({ slug: 'test-project' }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.budget).toBeDefined();
    expect(data.budget.BudgetItem).toHaveLength(1);
    expect(data.budget.EarnedValue).toHaveLength(1);
  });

  it('should return project with null budget if no budget exists', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      ProjectBudget: null,
    });

    const { GET } = await import('@/app/api/projects/[slug]/budget/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget');
    const response = await GET(request, { params: Promise.resolve({ slug: 'test-project' }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.budget).toBeNull();
  });

  it('should return 500 on database error', async () => {
    prismaMock.project.findUnique.mockRejectedValue(new Error('Database error'));

    const { GET } = await import('@/app/api/projects/[slug]/budget/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget');
    const response = await GET(request, { params: Promise.resolve({ slug: 'test-project' }) });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Failed to fetch budget');
  });
});

describe('POST /api/projects/[slug]/budget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue(mockSession);
    prismaMock.project.findUnique.mockResolvedValue(mockProject);
  });

  it('should return 400 when totalBudget is missing', async () => {
    const { POST } = await import('@/app/api/projects/[slug]/budget/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget', {
      method: 'POST',
      body: JSON.stringify({ contingency: 50000 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project' }) });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Total budget is required');
  });

  it('should return 400 when totalBudget is zero or negative', async () => {
    const { POST } = await import('@/app/api/projects/[slug]/budget/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget', {
      method: 'POST',
      body: JSON.stringify({ totalBudget: -100 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project' }) });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('must be greater than 0');
  });

  it('should return 409 when budget already exists', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      ProjectBudget: mockBudget,
    });

    const { POST } = await import('@/app/api/projects/[slug]/budget/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget', {
      method: 'POST',
      body: JSON.stringify({ totalBudget: 1000000 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project' }) });

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toContain('Budget already exists');
  });

  it('should return 403 when user is not project owner or admin', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      ownerId: 'different-user',
    });

    const { POST } = await import('@/app/api/projects/[slug]/budget/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget', {
      method: 'POST',
      body: JSON.stringify({ totalBudget: 1000000 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project' }) });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('Only project owners and admins');
  });

  it('should create budget with totalBudget and contingency', async () => {
    const newBudget = {
      ...mockBudget,
      contingency: 75000,
    };

    prismaMock.projectBudget.create.mockResolvedValue(newBudget);

    const { POST } = await import('@/app/api/projects/[slug]/budget/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget', {
      method: 'POST',
      body: JSON.stringify({ totalBudget: 1000000, contingency: 75000 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project' }) });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.budget).toBeDefined();
    expect(data.budget.totalBudget).toBe(1000000);
    expect(data.budget.contingency).toBe(75000);

    expect(prismaMock.projectBudget.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'project-1',
        totalBudget: 1000000,
        contingency: 75000,
        currency: 'USD',
      }),
    });
  });

  it('should allow admin to create budget for any project', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { ...mockSession.user, role: 'admin' },
      expires: mockSession.expires,
    });

    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      ownerId: 'different-user',
    });

    prismaMock.projectBudget.create.mockResolvedValue(mockBudget);

    const { POST } = await import('@/app/api/projects/[slug]/budget/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget', {
      method: 'POST',
      body: JSON.stringify({ totalBudget: 1000000 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project' }) });

    expect(response.status).toBe(201);
  });
});

describe('PUT /api/projects/[slug]/budget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue(mockSession);
    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      ProjectBudget: mockBudget,
    });
  });

  it('should return 404 when budget does not exist', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      ProjectBudget: null,
    });

    const { PUT } = await import('@/app/api/projects/[slug]/budget/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget', {
      method: 'PUT',
      body: JSON.stringify({ totalBudget: 1200000 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await PUT(request, { params: Promise.resolve({ slug: 'test-project' }) });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toContain('Budget not found');
  });

  it('should update budget totals', async () => {
    const updatedBudget = {
      ...mockBudget,
      totalBudget: 1200000,
      contingency: 60000,
      actualCost: 100000,
      committedCost: 200000,
      BudgetItem: [],
      EarnedValue: [],
    };

    prismaMock.projectBudget.update.mockResolvedValue(updatedBudget);

    const { PUT } = await import('@/app/api/projects/[slug]/budget/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget', {
      method: 'PUT',
      body: JSON.stringify({
        totalBudget: 1200000,
        contingency: 60000,
        actualCost: 100000,
        committedCost: 200000,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await PUT(request, { params: Promise.resolve({ slug: 'test-project' }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.budget.totalBudget).toBe(1200000);
    expect(data.budget.contingency).toBe(60000);

    expect(prismaMock.projectBudget.update).toHaveBeenCalledWith({
      where: { id: 'budget-1' },
      data: expect.objectContaining({
        totalBudget: 1200000,
        contingency: 60000,
        actualCost: 100000,
        committedCost: 200000,
        lastUpdated: expect.any(Date),
      }),
      include: expect.any(Object),
    });
  });

  it('should return 403 when user is not authorized', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      ownerId: 'different-user',
      ProjectBudget: mockBudget,
    });

    const { PUT } = await import('@/app/api/projects/[slug]/budget/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/budget', {
      method: 'PUT',
      body: JSON.stringify({ totalBudget: 1200000 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await PUT(request, { params: Promise.resolve({ slug: 'test-project' }) });

    expect(response.status).toBe(403);
  });
});
