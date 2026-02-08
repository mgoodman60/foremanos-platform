import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Hoisted mocks for daily-report-permissions
const mockGetDailyReportRole = vi.hoisted(() => vi.fn());
const mockCanCreateReport = vi.hoisted(() => vi.fn());
const mockCanEditReport = vi.hoisted(() => vi.fn());
const mockCanSubmitReport = vi.hoisted(() => vi.fn());
const mockCanApproveReport = vi.hoisted(() => vi.fn());
const mockCanDeleteReport = vi.hoisted(() => vi.fn());
const mockCanViewReport = vi.hoisted(() => vi.fn());
const mockIsValidTransition = vi.hoisted(() => vi.fn());
const mockSanitizeText = vi.hoisted(() => vi.fn());

// Hoisted mocks for rate-limiter
const mockCheckRateLimit = vi.hoisted(() => vi.fn());

vi.mock('@/lib/daily-report-permissions', () => ({
  getDailyReportRole: mockGetDailyReportRole,
  canCreateReport: mockCanCreateReport,
  canEditReport: mockCanEditReport,
  canSubmitReport: mockCanSubmitReport,
  canApproveReport: mockCanApproveReport,
  canDeleteReport: mockCanDeleteReport,
  canViewReport: mockCanViewReport,
  isValidTransition: mockIsValidTransition,
  sanitizeText: mockSanitizeText,
  VALID_STATUS_TRANSITIONS: {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['APPROVED', 'REJECTED'],
    APPROVED: [],
    REJECTED: ['DRAFT'],
  },
}));

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: mockCheckRateLimit,
  RATE_LIMITS: {
    DAILY_REPORT_READ: { max: 60, window: 60000 },
    DAILY_REPORT_WRITE: { max: 20, window: 60000 },
  },
  getRateLimitIdentifier: vi.fn((userId: string) => `user:${userId}`),
  createRateLimitHeaders: vi.fn(() => ({})),
}));

// Mock session data
const mockSession = {
  user: {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
  },
};

const mockProject = {
  id: 'project-1',
  slug: 'test-project',
  name: 'Test Project',
};

const mockDailyReport = {
  id: 'report-1',
  projectId: 'project-1',
  reportDate: new Date('2024-01-15'),
  reportNumber: 1,
  status: 'DRAFT',
  weatherCondition: 'Sunny',
  temperatureHigh: 75,
  temperatureLow: 55,
  humidity: 60,
  precipitation: 0,
  windSpeed: 5,
  weatherNotes: 'Perfect weather',
  workPerformed: 'Completed foundation forms',
  workPlanned: 'Pour foundation concrete',
  delaysEncountered: null,
  delayHours: null,
  delayReason: null,
  safetyIncidents: 0,
  safetyNotes: 'No incidents',
  visitors: [],
  equipmentOnSite: [],
  materialsReceived: [],
  photoIds: ['photo-1', 'photo-2'],
  createdBy: 'user-123',
  submittedAt: null,
  submittedBy: null,
  approvedAt: null,
  approvedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdByUser: {
    id: 'user-123',
    username: 'testuser',
  },
  laborEntries: [
    {
      id: 'labor-1',
      reportId: 'report-1',
      tradeName: 'Carpenter',
      workerCount: 5,
      regularHours: 8,
      overtimeHours: 0,
      description: 'Framing work',
      crewId: null,
    },
  ],
};

// Mock Prisma
const prismaMock = {
  project: {
    findUnique: vi.fn(),
  },
  dailyReport: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

// Mock NextAuth
const getServerSessionMock = vi.fn();
vi.mock('next-auth', () => ({
  getServerSession: getServerSessionMock,
}));

// Mock auth options
vi.mock('@/lib/auth-options', () => ({
  authOptions: {},
}));

describe('GET /api/projects/[slug]/daily-reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue(mockSession);
    prismaMock.project.findUnique.mockResolvedValue(mockProject);

    // Default RBAC mocks - ADMIN role has all permissions
    mockGetDailyReportRole.mockResolvedValue('ADMIN');
    mockCanCreateReport.mockReturnValue(true);
    mockCanEditReport.mockReturnValue(true);
    mockCanSubmitReport.mockReturnValue(true);
    mockCanApproveReport.mockReturnValue(true);
    mockCanDeleteReport.mockReturnValue(true);
    mockCanViewReport.mockReturnValue(true);
    mockIsValidTransition.mockReturnValue(true);
    mockSanitizeText.mockImplementation((text: string) => text);

    // Default rate limit mock - success
    mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 10 });
  });

  it('should return 401 when not authenticated', async () => {
    getServerSessionMock.mockResolvedValue(null);

    const { GET } = await import('@/app/api/projects/[slug]/daily-reports/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/daily-reports');
    const response = await GET(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 when project not found', async () => {
    prismaMock.project.findUnique.mockResolvedValue(null);

    const { GET } = await import('@/app/api/projects/[slug]/daily-reports/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/daily-reports');
    const response = await GET(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Project not found');
  });

  it('should return all daily reports for project', async () => {
    prismaMock.dailyReport.findMany.mockResolvedValue([mockDailyReport]);

    const { GET } = await import('@/app/api/projects/[slug]/daily-reports/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/daily-reports');
    const response = await GET(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.reports).toHaveLength(1);
    expect(data.reports[0].id).toBe('report-1');
    expect(prismaMock.dailyReport.findMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1', deletedAt: null },
      include: {
        createdByUser: { select: { id: true, username: true } },
        laborEntries: true,
      },
      orderBy: { reportDate: 'desc' },
      take: 21, // limit + 1 for pagination
    });
  });

  it('should filter by startDate', async () => {
    prismaMock.dailyReport.findMany.mockResolvedValue([mockDailyReport]);

    const { GET } = await import('@/app/api/projects/[slug]/daily-reports/route');
    const request = new NextRequest(
      'http://localhost/api/projects/test-project/daily-reports?startDate=2024-01-01'
    );
    const response = await GET(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(200);
    expect(prismaMock.dailyReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          reportDate: expect.objectContaining({
            gte: new Date('2024-01-01'),
          }),
        }),
      })
    );
  });

  it('should filter by endDate', async () => {
    prismaMock.dailyReport.findMany.mockResolvedValue([mockDailyReport]);

    const { GET } = await import('@/app/api/projects/[slug]/daily-reports/route');
    const request = new NextRequest(
      'http://localhost/api/projects/test-project/daily-reports?endDate=2024-01-31'
    );
    const response = await GET(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(200);
    expect(prismaMock.dailyReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          reportDate: expect.objectContaining({
            lte: new Date('2024-01-31'),
          }),
        }),
      })
    );
  });

  it('should filter by status', async () => {
    prismaMock.dailyReport.findMany.mockResolvedValue([mockDailyReport]);

    const { GET } = await import('@/app/api/projects/[slug]/daily-reports/route');
    const request = new NextRequest(
      'http://localhost/api/projects/test-project/daily-reports?status=SUBMITTED'
    );
    const response = await GET(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(200);
    expect(prismaMock.dailyReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          status: 'SUBMITTED',
        }),
      })
    );
  });

  it('should handle database errors', async () => {
    prismaMock.dailyReport.findMany.mockRejectedValue(new Error('Database error'));

    const { GET } = await import('@/app/api/projects/[slug]/daily-reports/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/daily-reports');
    const response = await GET(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Failed to fetch daily reports');
  });
});

describe('POST /api/projects/[slug]/daily-reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue(mockSession);
    prismaMock.project.findUnique.mockResolvedValue(mockProject);
    prismaMock.dailyReport.findFirst.mockResolvedValue(null);
    prismaMock.dailyReport.create.mockResolvedValue(mockDailyReport);

    // Default RBAC mocks - ADMIN role has all permissions
    mockGetDailyReportRole.mockResolvedValue('ADMIN');
    mockCanCreateReport.mockReturnValue(true);
    mockCanEditReport.mockReturnValue(true);
    mockCanSubmitReport.mockReturnValue(true);
    mockCanApproveReport.mockReturnValue(true);
    mockCanDeleteReport.mockReturnValue(true);
    mockCanViewReport.mockReturnValue(true);
    mockIsValidTransition.mockReturnValue(true);
    mockSanitizeText.mockImplementation((text: string) => text);

    // Default rate limit mock - success
    mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 10 });
  });

  it('should return 401 when not authenticated', async () => {
    getServerSessionMock.mockResolvedValue(null);

    const { POST } = await import('@/app/api/projects/[slug]/daily-reports/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/daily-reports', {
      method: 'POST',
      body: JSON.stringify({ reportDate: '2024-01-15' }),
    });
    const response = await POST(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(401);
  });

  it('should create daily report with auto-incremented reportNumber', async () => {
    const lastReport = { reportNumber: 5 };
    prismaMock.dailyReport.findFirst.mockResolvedValue(lastReport);

    const { POST } = await import('@/app/api/projects/[slug]/daily-reports/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/daily-reports', {
      method: 'POST',
      body: JSON.stringify({
        reportDate: '2024-01-15',
        weatherCondition: 'Sunny',
        temperatureHigh: 75,
        workPerformed: 'Foundation work',
      }),
    });
    const response = await POST(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(200);
    expect(prismaMock.dailyReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reportNumber: 6,
        }),
      })
    );
  });

  it('should create first report with reportNumber 1', async () => {
    prismaMock.dailyReport.findFirst.mockResolvedValue(null);

    const { POST } = await import('@/app/api/projects/[slug]/daily-reports/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/daily-reports', {
      method: 'POST',
      body: JSON.stringify({
        reportDate: '2024-01-15',
        weatherCondition: 'Sunny',
      }),
    });
    const response = await POST(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(200);
    expect(prismaMock.dailyReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reportNumber: 1,
        }),
      })
    );
  });

  it('should create report with labor entries', async () => {
    const { POST } = await import('@/app/api/projects/[slug]/daily-reports/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/daily-reports', {
      method: 'POST',
      body: JSON.stringify({
        reportDate: '2024-01-15',
        laborEntries: [
          {
            tradeName: 'Carpenter',
            workerCount: 5,
            regularHours: 8,
            overtimeHours: 2,
            description: 'Framing',
          },
          {
            tradeName: 'Electrician',
            workerCount: 3,
            regularHours: 8,
            overtimeHours: 0,
            description: 'Rough-in',
          },
        ],
      }),
    });
    const response = await POST(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(200);
    expect(prismaMock.dailyReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          laborEntries: {
            create: expect.arrayContaining([
              expect.objectContaining({
                tradeName: 'Carpenter',
                workerCount: 5,
                regularHours: 8,
                overtimeHours: 2,
              }),
              expect.objectContaining({
                tradeName: 'Electrician',
                workerCount: 3,
                regularHours: 8,
                overtimeHours: 0,
              }),
            ]),
          },
        }),
      })
    );
  });

  it('should return 400 on unique constraint violation (duplicate date)', async () => {
    const uniqueError = new Error('Unique constraint failed');
    (uniqueError as any).code = 'P2002';
    prismaMock.dailyReport.create.mockRejectedValue(uniqueError);

    const { POST } = await import('@/app/api/projects/[slug]/daily-reports/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/daily-reports', {
      method: 'POST',
      body: JSON.stringify({
        reportDate: '2024-01-15',
        weatherCondition: 'Sunny',
      }),
    });
    const response = await POST(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('A report for this date already exists');
  });

  it('should handle database errors', async () => {
    prismaMock.dailyReport.create.mockRejectedValue(new Error('Database error'));

    const { POST } = await import('@/app/api/projects/[slug]/daily-reports/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/daily-reports', {
      method: 'POST',
      body: JSON.stringify({
        reportDate: '2024-01-15',
      }),
    });
    const response = await POST(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Failed to create daily report');
  });
});
