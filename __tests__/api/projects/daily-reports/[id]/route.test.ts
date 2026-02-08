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

// Mock daily-report-indexer (dynamically imported in PATCH when status=APPROVED)
vi.mock('@/lib/daily-report-indexer', () => ({
  indexDailyReport: vi.fn().mockResolvedValue({ success: true, errors: [] }),
}));

// Mock session data
const mockSession = {
  user: {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
  },
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
  workPerformed: 'Completed foundation forms',
  workPlanned: 'Pour foundation concrete',
  safetyIncidents: 0,
  safetyNotes: 'No incidents',
  createdBy: 'user-123',
  submittedAt: null,
  submittedBy: null,
  approvedAt: null,
  approvedBy: null,
  deletedAt: null,
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
    },
  ],
};

// Mock Prisma
const prismaMock = {
  project: {
    findUnique: vi.fn(),
  },
  dailyReport: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  dailyReportLabor: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  activityLog: {
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

describe('GET /api/projects/[slug]/daily-reports/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue(mockSession);
    prismaMock.project.findUnique.mockResolvedValue({ id: 'project-1' });
    prismaMock.dailyReport.findUnique.mockResolvedValue(mockDailyReport);

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

    const { GET } = await import('@/app/api/projects/[slug]/daily-reports/[id]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/daily-reports/report-1');
    const response = await GET(request, { params: { slug: 'test-project', id: 'report-1' } });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 when report not found', async () => {
    prismaMock.dailyReport.findUnique.mockResolvedValue(null);

    const { GET } = await import('@/app/api/projects/[slug]/daily-reports/[id]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/daily-reports/report-1');
    const response = await GET(request, { params: { slug: 'test-project', id: 'report-1' } });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Report not found');
  });

  it('should return report with relations', async () => {
    const { GET } = await import('@/app/api/projects/[slug]/daily-reports/[id]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/daily-reports/report-1');
    const response = await GET(request, { params: { slug: 'test-project', id: 'report-1' } });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.report.id).toBe('report-1');
    expect(data.report.laborEntries).toBeDefined();
    expect(data.report.createdByUser).toBeDefined();
  });

  it('should handle database errors', async () => {
    prismaMock.dailyReport.findUnique.mockRejectedValue(new Error('Database error'));

    const { GET } = await import('@/app/api/projects/[slug]/daily-reports/[id]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/daily-reports/report-1');
    const response = await GET(request, { params: { slug: 'test-project', id: 'report-1' } });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Failed to fetch report');
  });
});

describe('PATCH /api/projects/[slug]/daily-reports/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue(mockSession);
    prismaMock.project.findUnique.mockResolvedValue({ id: 'project-1' });
    prismaMock.dailyReport.findUnique.mockResolvedValue(mockDailyReport);
    prismaMock.dailyReport.update.mockResolvedValue(mockDailyReport);
    prismaMock.dailyReportLabor.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.dailyReportLabor.createMany.mockResolvedValue({ count: 2 });
    prismaMock.activityLog.create.mockResolvedValue({});

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

    const { PATCH } = await import('@/app/api/projects/[slug]/daily-reports/[id]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/daily-reports/report-1', {
      method: 'PATCH',
      body: JSON.stringify({ workPerformed: 'Updated work' }),
    });
    const response = await PATCH(request, { params: { slug: 'test-project', id: 'report-1' } });

    expect(response.status).toBe(401);
  });

  it('should update report fields', async () => {
    const { PATCH } = await import('@/app/api/projects/[slug]/daily-reports/[id]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/daily-reports/report-1', {
      method: 'PATCH',
      body: JSON.stringify({
        workPerformed: 'Updated work performed',
        temperatureHigh: 80,
        safetyIncidents: 1,
      }),
    });
    const response = await PATCH(request, { params: { slug: 'test-project', id: 'report-1' } });

    expect(response.status).toBe(200);
    expect(prismaMock.dailyReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-1' },
        data: expect.objectContaining({
          workPerformed: 'Updated work performed',
          temperatureHigh: 80,
          safetyIncidents: 1,
        }),
      })
    );
  });

  it('should transition status to SUBMITTED with timestamps', async () => {
    const { PATCH } = await import('@/app/api/projects/[slug]/daily-reports/[id]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/daily-reports/report-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'SUBMITTED' }),
    });
    const response = await PATCH(request, { params: { slug: 'test-project', id: 'report-1' } });

    expect(response.status).toBe(200);
    expect(prismaMock.dailyReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'SUBMITTED',
          submittedAt: expect.any(Date),
          submittedBy: 'user-123',
        }),
      })
    );
  });

  it('should transition status to APPROVED with timestamps', async () => {
    const { PATCH } = await import('@/app/api/projects/[slug]/daily-reports/[id]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/daily-reports/report-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'APPROVED' }),
    });
    const response = await PATCH(request, { params: { slug: 'test-project', id: 'report-1' } });

    expect(response.status).toBe(200);
    expect(prismaMock.dailyReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'APPROVED',
          approvedAt: expect.any(Date),
          approvedBy: 'user-123',
        }),
      })
    );
  });

  it('should replace labor entries on update', async () => {
    const { PATCH } = await import('@/app/api/projects/[slug]/daily-reports/[id]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/daily-reports/report-1', {
      method: 'PATCH',
      body: JSON.stringify({
        laborEntries: [
          {
            tradeName: 'Carpenter',
            workerCount: 6,
            regularHours: 8,
            overtimeHours: 1,
            description: 'Updated framing',
          },
          {
            tradeName: 'Plumber',
            workerCount: 2,
            regularHours: 8,
            overtimeHours: 0,
            description: 'Rough plumbing',
          },
        ],
      }),
    });
    const response = await PATCH(request, { params: { slug: 'test-project', id: 'report-1' } });

    expect(response.status).toBe(200);
    // Should delete existing entries
    expect(prismaMock.dailyReportLabor.deleteMany).toHaveBeenCalledWith({
      where: { reportId: 'report-1' },
    });
    // Should create new entries
    expect(prismaMock.dailyReportLabor.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          reportId: 'report-1',
          tradeName: 'Carpenter',
          workerCount: 6,
        }),
        expect.objectContaining({
          reportId: 'report-1',
          tradeName: 'Plumber',
          workerCount: 2,
        }),
      ]),
    });
  });

  it('should handle database errors', async () => {
    prismaMock.dailyReport.update.mockRejectedValue(new Error('Database error'));

    const { PATCH } = await import('@/app/api/projects/[slug]/daily-reports/[id]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/daily-reports/report-1', {
      method: 'PATCH',
      body: JSON.stringify({ workPerformed: 'Updated' }),
    });
    const response = await PATCH(request, { params: { slug: 'test-project', id: 'report-1' } });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Failed to update report');
  });
});

describe('DELETE /api/projects/[slug]/daily-reports/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue(mockSession);
    prismaMock.project.findUnique.mockResolvedValue({ id: 'project-1' });
    prismaMock.dailyReport.findUnique.mockResolvedValue(mockDailyReport);
    prismaMock.dailyReport.update.mockResolvedValue({ ...mockDailyReport, deletedAt: new Date() });
    prismaMock.activityLog.create.mockResolvedValue({});

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

    const { DELETE } = await import('@/app/api/projects/[slug]/daily-reports/[id]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/daily-reports/report-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: { slug: 'test-project', id: 'report-1' } });

    expect(response.status).toBe(401);
  });

  it('should delete report and cascade to related records', async () => {
    const { DELETE } = await import('@/app/api/projects/[slug]/daily-reports/[id]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/daily-reports/report-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: { slug: 'test-project', id: 'report-1' } });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    // Soft delete uses update, not delete
    expect(prismaMock.dailyReport.update).toHaveBeenCalledWith({
      where: { id: 'report-1' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('should handle database errors', async () => {
    prismaMock.dailyReport.update.mockRejectedValue(new Error('Database error'));

    const { DELETE } = await import('@/app/api/projects/[slug]/daily-reports/[id]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/daily-reports/report-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: { slug: 'test-project', id: 'report-1' } });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Failed to delete report');
  });
});
