import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// --- Hoisted mocks ---

const mockSession = vi.hoisted(() => ({ user: { id: 'user-1' } }));

const mockPrisma = vi.hoisted(() => ({
  project: { findUnique: vi.fn() },
  projectMember: { findUnique: vi.fn() },
  dailyReport: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  dailyReportLabor: { deleteMany: vi.fn(), createMany: vi.fn() },
  activityLog: { create: vi.fn() },
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(() => mockSession),
}));
vi.mock('@/lib/auth-options', () => ({
  authOptions: {},
}));
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  createScopedLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(() => ({
    success: true,
    limit: 60,
    remaining: 59,
    reset: Date.now() + 60000,
  })),
  RATE_LIMITS: {
    DAILY_REPORT_READ: { maxRequests: 60, windowSeconds: 60 },
    DAILY_REPORT_WRITE: { maxRequests: 10, windowSeconds: 60 },
  },
  getRateLimitIdentifier: vi.fn((id: string) => `user:${id}`),
  createRateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock('@/lib/daily-report-permissions', () => ({
  getDailyReportRole: vi.fn(),
  canCreateReport: vi.fn(),
  canEditReport: vi.fn(),
  canSubmitReport: vi.fn(),
  canApproveReport: vi.fn(),
  canDeleteReport: vi.fn(),
  canViewReport: vi.fn(),
  isValidTransition: vi.fn(),
  sanitizeText: vi.fn((s: string) => s),
  VALID_STATUS_TRANSITIONS: {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['APPROVED', 'REJECTED'],
    APPROVED: [],
    REJECTED: ['DRAFT'],
  },
}));

// --- Imports ---

import { GET, POST } from '@/app/api/projects/[slug]/daily-reports/route';
import {
  GET as GET_REPORT,
  PATCH,
  DELETE,
} from '@/app/api/projects/[slug]/daily-reports/[id]/route';
import { POST as BULK_POST } from '@/app/api/projects/[slug]/daily-reports/approve-bulk/route';

import {
  getDailyReportRole,
  canCreateReport,
  canEditReport,
  canSubmitReport,
  canApproveReport,
  canDeleteReport,
  isValidTransition,
  sanitizeText,
} from '@/lib/daily-report-permissions';

const mockGetDailyReportRole = getDailyReportRole as ReturnType<typeof vi.fn>;
const mockCanCreateReport = canCreateReport as ReturnType<typeof vi.fn>;
const mockCanEditReport = canEditReport as ReturnType<typeof vi.fn>;
const mockCanSubmitReport = canSubmitReport as ReturnType<typeof vi.fn>;
const mockCanApproveReport = canApproveReport as ReturnType<typeof vi.fn>;
const mockCanDeleteReport = canDeleteReport as ReturnType<typeof vi.fn>;
const mockIsValidTransition = isValidTransition as ReturnType<typeof vi.fn>;
const mockSanitizeText = sanitizeText as ReturnType<typeof vi.fn>;

// --- Helpers ---

const PROJECT = { id: 'project-1' };
const PARAMS_SLUG = { params: { slug: 'test-project' } };
const PARAMS_SLUG_ID = { params: { slug: 'test-project', id: 'report-1' } };

function makeRequest(
  path: string,
  options?: { method?: string; body?: Record<string, unknown> }
): NextRequest {
  const init: RequestInit = {};
  if (options?.method) init.method = options.method;
  if (options?.body) init.body = JSON.stringify(options.body);
  return new NextRequest(`http://localhost:3000${path}`, init);
}

const sampleReport = {
  id: 'report-1',
  projectId: 'project-1',
  status: 'DRAFT',
  createdBy: 'user-1',
  reportNumber: 1,
  deletedAt: null,
  reportDate: new Date('2024-01-15'),
  createdByUser: { id: 'user-1', username: 'testuser' },
  laborEntries: [],
  equipmentEntries: [],
  progressEntries: [],
};

describe('Daily Reports API - RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: project exists, user is a member with REPORTER role
    mockPrisma.project.findUnique.mockResolvedValue(PROJECT);
    mockGetDailyReportRole.mockResolvedValue('REPORTER');
    mockCanCreateReport.mockReturnValue(true);
    mockCanEditReport.mockReturnValue(true);
    mockCanSubmitReport.mockReturnValue(true);
    mockCanApproveReport.mockReturnValue(false);
    mockCanDeleteReport.mockReturnValue(false);
    mockIsValidTransition.mockReturnValue(true);
    mockSanitizeText.mockImplementation((s: string) => s);
  });

  // =========================================================================
  // GET /api/projects/[slug]/daily-reports (List)
  // =========================================================================
  describe('GET /daily-reports (list)', () => {
    it('should return 403 for non-member', async () => {
      mockGetDailyReportRole.mockResolvedValue(null);

      const req = makeRequest('/api/projects/test-project/daily-reports');
      const res = await GET(req, PARAMS_SLUG);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toBe('Access denied');
    });

    it('should return paginated results with cursor', async () => {
      const reports = Array.from({ length: 3 }, (_, i) => ({
        id: `report-${i}`,
        projectId: 'project-1',
        deletedAt: null,
      }));
      mockPrisma.dailyReport.findMany.mockResolvedValue(reports);

      const req = makeRequest(
        '/api/projects/test-project/daily-reports?limit=2&cursor=report-0'
      );
      const res = await GET(req, PARAMS_SLUG);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.reports).toBeDefined();
      // Verify findMany was called with cursor-based pagination params
      const findManyCall = mockPrisma.dailyReport.findMany.mock.calls[0][0];
      expect(findManyCall.cursor).toEqual({ id: 'report-0' });
      expect(findManyCall.skip).toBe(1);
    });

    it('should filter out soft-deleted reports', async () => {
      mockPrisma.dailyReport.findMany.mockResolvedValue([]);

      const req = makeRequest('/api/projects/test-project/daily-reports');
      const res = await GET(req, PARAMS_SLUG);

      expect(res.status).toBe(200);
      const findManyCall = mockPrisma.dailyReport.findMany.mock.calls[0][0];
      expect(findManyCall.where.deletedAt).toBeNull();
    });

    it('should apply status filter when provided', async () => {
      mockPrisma.dailyReport.findMany.mockResolvedValue([]);

      const req = makeRequest(
        '/api/projects/test-project/daily-reports?status=SUBMITTED'
      );
      const res = await GET(req, PARAMS_SLUG);

      expect(res.status).toBe(200);
      const findManyCall = mockPrisma.dailyReport.findMany.mock.calls[0][0];
      expect(findManyCall.where.status).toBe('SUBMITTED');
    });

    it('should indicate hasMore when results exceed limit', async () => {
      // Return limit+1 items to trigger hasMore
      const reports = Array.from({ length: 21 }, (_, i) => ({
        id: `report-${i}`,
      }));
      mockPrisma.dailyReport.findMany.mockResolvedValue(reports);

      const req = makeRequest('/api/projects/test-project/daily-reports');
      const res = await GET(req, PARAMS_SLUG);
      const data = await res.json();

      expect(data.hasMore).toBe(true);
      expect(data.reports.length).toBe(20);
      expect(data.nextCursor).toBe('report-19');
    });
  });

  // =========================================================================
  // POST /api/projects/[slug]/daily-reports (Create)
  // =========================================================================
  describe('POST /daily-reports (create)', () => {
    it('should return 403 for VIEWER role', async () => {
      mockGetDailyReportRole.mockResolvedValue('VIEWER');
      mockCanCreateReport.mockReturnValue(false);

      const req = makeRequest('/api/projects/test-project/daily-reports', {
        method: 'POST',
        body: { reportDate: '2024-01-15' },
      });
      const res = await POST(req, PARAMS_SLUG);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toBe('Access denied');
    });

    it('should sanitize text fields on create', async () => {
      mockPrisma.dailyReport.findFirst.mockResolvedValue(null);
      mockPrisma.dailyReport.create.mockResolvedValue({ ...sampleReport });

      const req = makeRequest('/api/projects/test-project/daily-reports', {
        method: 'POST',
        body: {
          reportDate: '2024-01-15',
          workPerformed: '<b>Some work</b>',
          weatherNotes: '<script>xss</script>',
        },
      });
      const res = await POST(req, PARAMS_SLUG);

      expect(res.status).toBe(200);
      expect(mockSanitizeText).toHaveBeenCalledWith('<b>Some work</b>');
      expect(mockSanitizeText).toHaveBeenCalledWith('<script>xss</script>');
    });

    it('should auto-increment report number', async () => {
      mockPrisma.dailyReport.findFirst.mockResolvedValue({ reportNumber: 5 });
      mockPrisma.dailyReport.create.mockResolvedValue({ ...sampleReport, reportNumber: 6 });

      const req = makeRequest('/api/projects/test-project/daily-reports', {
        method: 'POST',
        body: { reportDate: '2024-01-15' },
      });
      await POST(req, PARAMS_SLUG);

      const createCall = mockPrisma.dailyReport.create.mock.calls[0][0];
      expect(createCall.data.reportNumber).toBe(6);
    });

    it('should return 404 for non-existent project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const req = makeRequest('/api/projects/test-project/daily-reports', {
        method: 'POST',
        body: { reportDate: '2024-01-15' },
      });
      const res = await POST(req, PARAMS_SLUG);

      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // GET /api/projects/[slug]/daily-reports/[id] (Single)
  // =========================================================================
  describe('GET /daily-reports/[id] (single)', () => {
    it('should return 404 for soft-deleted report', async () => {
      mockPrisma.dailyReport.findUnique.mockResolvedValue({
        ...sampleReport,
        deletedAt: new Date(),
      });

      const req = makeRequest('/api/projects/test-project/daily-reports/report-1');
      const res = await GET_REPORT(req, PARAMS_SLUG_ID);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe('Report not found');
    });

    it('should return 404 if report belongs to different project', async () => {
      mockPrisma.dailyReport.findUnique.mockResolvedValue({
        ...sampleReport,
        projectId: 'other-project',
      });

      const req = makeRequest('/api/projects/test-project/daily-reports/report-1');
      const res = await GET_REPORT(req, PARAMS_SLUG_ID);

      expect(res.status).toBe(404);
    });

    it('should return 403 for non-member', async () => {
      mockGetDailyReportRole.mockResolvedValue(null);

      const req = makeRequest('/api/projects/test-project/daily-reports/report-1');
      const res = await GET_REPORT(req, PARAMS_SLUG_ID);

      expect(res.status).toBe(403);
    });

    it('should return report for valid member', async () => {
      mockPrisma.dailyReport.findUnique.mockResolvedValue(sampleReport);

      const req = makeRequest('/api/projects/test-project/daily-reports/report-1');
      const res = await GET_REPORT(req, PARAMS_SLUG_ID);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.report.id).toBe('report-1');
    });
  });

  // =========================================================================
  // PATCH /api/projects/[slug]/daily-reports/[id] (Update)
  // =========================================================================
  describe('PATCH /daily-reports/[id] (update)', () => {
    beforeEach(() => {
      mockPrisma.dailyReport.findUnique.mockResolvedValue({
        ...sampleReport,
        status: 'SUBMITTED',
        createdBy: 'user-1',
      });
      mockPrisma.dailyReport.update.mockResolvedValue(sampleReport);
      mockPrisma.activityLog.create.mockResolvedValue({});
    });

    it('should return 400 for invalid status transition (DRAFT to APPROVED)', async () => {
      mockPrisma.dailyReport.findUnique.mockResolvedValue({
        ...sampleReport,
        status: 'DRAFT',
      });
      mockIsValidTransition.mockReturnValue(false);

      const req = makeRequest('/api/projects/test-project/daily-reports/report-1', {
        method: 'PATCH',
        body: { status: 'APPROVED' },
      });
      const res = await PATCH(req, PARAMS_SLUG_ID);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('Invalid status transition');
    });

    it('should return 400 for REJECTED without rejectionReason', async () => {
      mockIsValidTransition.mockReturnValue(true);
      mockCanApproveReport.mockReturnValue(true);

      const req = makeRequest('/api/projects/test-project/daily-reports/report-1', {
        method: 'PATCH',
        body: { status: 'REJECTED' },
      });
      const res = await PATCH(req, PARAMS_SLUG_ID);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Rejection reason is required');
    });

    it('should allow REPORTER to submit own report', async () => {
      mockPrisma.dailyReport.findUnique.mockResolvedValue({
        ...sampleReport,
        status: 'DRAFT',
        createdBy: 'user-1',
      });
      mockIsValidTransition.mockReturnValue(true);
      mockCanSubmitReport.mockReturnValue(true);
      mockPrisma.dailyReport.update.mockResolvedValue({
        ...sampleReport,
        status: 'SUBMITTED',
      });

      const req = makeRequest('/api/projects/test-project/daily-reports/report-1', {
        method: 'PATCH',
        body: { status: 'SUBMITTED' },
      });
      const res = await PATCH(req, PARAMS_SLUG_ID);

      expect(res.status).toBe(200);
      expect(mockCanSubmitReport).toHaveBeenCalledWith('REPORTER', 'user-1', 'user-1');
    });

    it('should return 403 for REPORTER attempting to approve', async () => {
      mockIsValidTransition.mockReturnValue(true);
      mockCanApproveReport.mockReturnValue(false);

      const req = makeRequest('/api/projects/test-project/daily-reports/report-1', {
        method: 'PATCH',
        body: { status: 'APPROVED' },
      });
      const res = await PATCH(req, PARAMS_SLUG_ID);

      expect(res.status).toBe(403);
    });

    it('should clear rejection fields when transitioning REJECTED to DRAFT', async () => {
      mockPrisma.dailyReport.findUnique.mockResolvedValue({
        ...sampleReport,
        status: 'REJECTED',
        createdBy: 'user-1',
      });
      mockIsValidTransition.mockReturnValue(true);
      mockCanEditReport.mockReturnValue(true);
      mockPrisma.dailyReport.update.mockResolvedValue({
        ...sampleReport,
        status: 'DRAFT',
      });

      const req = makeRequest('/api/projects/test-project/daily-reports/report-1', {
        method: 'PATCH',
        body: { status: 'DRAFT' },
      });
      const res = await PATCH(req, PARAMS_SLUG_ID);

      expect(res.status).toBe(200);
      const updateCall = mockPrisma.dailyReport.update.mock.calls[0][0];
      expect(updateCall.data.rejectionReason).toBeNull();
      expect(updateCall.data.rejectionNotes).toBeNull();
      expect(updateCall.data.submittedAt).toBeNull();
      expect(updateCall.data.submittedBy).toBeNull();
      expect(updateCall.data.status).toBe('DRAFT');
    });

    it('should create audit log entry on status change', async () => {
      mockIsValidTransition.mockReturnValue(true);
      mockCanApproveReport.mockReturnValue(true);
      mockPrisma.dailyReport.update.mockResolvedValue({
        ...sampleReport,
        status: 'APPROVED',
      });

      const req = makeRequest('/api/projects/test-project/daily-reports/report-1', {
        method: 'PATCH',
        body: { status: 'APPROVED' },
      });
      await PATCH(req, PARAMS_SLUG_ID);

      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'DAILY_REPORT_APPROVED',
            resource: 'DailyReport',
          }),
        })
      );
    });

    it('should return 403 for non-member on PATCH', async () => {
      mockGetDailyReportRole.mockResolvedValue(null);

      const req = makeRequest('/api/projects/test-project/daily-reports/report-1', {
        method: 'PATCH',
        body: { workPerformed: 'Updated work' },
      });
      const res = await PATCH(req, PARAMS_SLUG_ID);

      expect(res.status).toBe(403);
    });

    it('should set approvedAt and approvedBy on APPROVED transition', async () => {
      mockIsValidTransition.mockReturnValue(true);
      mockCanApproveReport.mockReturnValue(true);
      mockPrisma.dailyReport.update.mockResolvedValue({
        ...sampleReport,
        status: 'APPROVED',
      });

      const req = makeRequest('/api/projects/test-project/daily-reports/report-1', {
        method: 'PATCH',
        body: { status: 'APPROVED' },
      });
      await PATCH(req, PARAMS_SLUG_ID);

      const updateCall = mockPrisma.dailyReport.update.mock.calls[0][0];
      expect(updateCall.data.approvedAt).toBeInstanceOf(Date);
      expect(updateCall.data.approvedBy).toBe('user-1');
    });
  });

  // =========================================================================
  // DELETE /api/projects/[slug]/daily-reports/[id]
  // =========================================================================
  describe('DELETE /daily-reports/[id]', () => {
    beforeEach(() => {
      mockPrisma.dailyReport.findUnique.mockResolvedValue(sampleReport);
      mockPrisma.dailyReport.update.mockResolvedValue({});
      mockPrisma.activityLog.create.mockResolvedValue({});
    });

    it('should soft delete by setting deletedAt (not calling delete)', async () => {
      mockGetDailyReportRole.mockResolvedValue('ADMIN');
      mockCanDeleteReport.mockReturnValue(true);

      const req = makeRequest('/api/projects/test-project/daily-reports/report-1', {
        method: 'DELETE',
      });
      const res = await DELETE(req, PARAMS_SLUG_ID);

      expect(res.status).toBe(200);
      expect(mockPrisma.dailyReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
          }),
        })
      );
      expect(mockPrisma.dailyReport.delete).not.toHaveBeenCalled();
    });

    it('should return 403 for non-ADMIN', async () => {
      mockGetDailyReportRole.mockResolvedValue('SUPERVISOR');
      mockCanDeleteReport.mockReturnValue(false);

      const req = makeRequest('/api/projects/test-project/daily-reports/report-1', {
        method: 'DELETE',
      });
      const res = await DELETE(req, PARAMS_SLUG_ID);

      expect(res.status).toBe(403);
    });

    it('should return 403 for REPORTER', async () => {
      mockCanDeleteReport.mockReturnValue(false);

      const req = makeRequest('/api/projects/test-project/daily-reports/report-1', {
        method: 'DELETE',
      });
      const res = await DELETE(req, PARAMS_SLUG_ID);

      expect(res.status).toBe(403);
    });

    it('should return 404 for already soft-deleted report', async () => {
      mockGetDailyReportRole.mockResolvedValue('ADMIN');
      mockCanDeleteReport.mockReturnValue(true);
      mockPrisma.dailyReport.findUnique.mockResolvedValue({
        ...sampleReport,
        deletedAt: new Date(),
      });

      const req = makeRequest('/api/projects/test-project/daily-reports/report-1', {
        method: 'DELETE',
      });
      const res = await DELETE(req, PARAMS_SLUG_ID);

      expect(res.status).toBe(404);
    });

    it('should create audit log entry on delete', async () => {
      mockGetDailyReportRole.mockResolvedValue('ADMIN');
      mockCanDeleteReport.mockReturnValue(true);

      const req = makeRequest('/api/projects/test-project/daily-reports/report-1', {
        method: 'DELETE',
      });
      await DELETE(req, PARAMS_SLUG_ID);

      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'DAILY_REPORT_DELETED',
            resource: 'DailyReport',
            resourceId: 'report-1',
          }),
        })
      );
    });
  });

  // =========================================================================
  // POST /api/projects/[slug]/daily-reports/approve-bulk
  // =========================================================================
  describe('POST /daily-reports/approve-bulk', () => {
    beforeEach(() => {
      mockPrisma.dailyReport.update.mockResolvedValue({});
      mockPrisma.activityLog.create.mockResolvedValue({});
    });

    it('should return 403 for REPORTER role', async () => {
      mockCanApproveReport.mockReturnValue(false);

      const req = makeRequest('/api/projects/test-project/daily-reports/approve-bulk', {
        method: 'POST',
        body: { reportIds: ['report-1'], action: 'APPROVED' },
      });
      const res = await BULK_POST(req, PARAMS_SLUG);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toBe('Access denied');
    });

    it('should approve multiple SUBMITTED reports', async () => {
      mockGetDailyReportRole.mockResolvedValue('SUPERVISOR');
      mockCanApproveReport.mockReturnValue(true);
      mockIsValidTransition.mockReturnValue(true);

      const submittedReport = (id: string) => ({
        id,
        projectId: 'project-1',
        status: 'SUBMITTED',
        reportNumber: 1,
        deletedAt: null,
      });

      mockPrisma.dailyReport.findUnique
        .mockResolvedValueOnce(submittedReport('report-1'))
        .mockResolvedValueOnce(submittedReport('report-2'))
        .mockResolvedValueOnce(submittedReport('report-3'));

      const req = makeRequest('/api/projects/test-project/daily-reports/approve-bulk', {
        method: 'POST',
        body: {
          reportIds: ['report-1', 'report-2', 'report-3'],
          action: 'APPROVED',
        },
      });
      const res = await BULK_POST(req, PARAMS_SLUG);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.updated).toBe(3);
      expect(data.failed).toEqual([]);
    });

    it('should skip non-SUBMITTED reports and return them in failed array', async () => {
      mockGetDailyReportRole.mockResolvedValue('ADMIN');
      mockCanApproveReport.mockReturnValue(true);
      mockIsValidTransition
        .mockReturnValueOnce(true)  // report-1: SUBMITTED -> APPROVED valid
        .mockReturnValueOnce(false); // report-2: DRAFT -> APPROVED invalid

      mockPrisma.dailyReport.findUnique
        .mockResolvedValueOnce({
          id: 'report-1',
          projectId: 'project-1',
          status: 'SUBMITTED',
          reportNumber: 1,
          deletedAt: null,
        })
        .mockResolvedValueOnce({
          id: 'report-2',
          projectId: 'project-1',
          status: 'DRAFT',
          reportNumber: 2,
          deletedAt: null,
        });

      const req = makeRequest('/api/projects/test-project/daily-reports/approve-bulk', {
        method: 'POST',
        body: {
          reportIds: ['report-1', 'report-2'],
          action: 'APPROVED',
        },
      });
      const res = await BULK_POST(req, PARAMS_SLUG);
      const data = await res.json();

      expect(data.updated).toBe(1);
      expect(data.failed).toEqual(['report-2']);
    });

    it('should require rejectionReason for REJECTED action', async () => {
      mockGetDailyReportRole.mockResolvedValue('SUPERVISOR');
      mockCanApproveReport.mockReturnValue(true);

      const req = makeRequest('/api/projects/test-project/daily-reports/approve-bulk', {
        method: 'POST',
        body: {
          reportIds: ['report-1'],
          action: 'REJECTED',
        },
      });
      const res = await BULK_POST(req, PARAMS_SLUG);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Rejection reason is required');
    });

    it('should return 400 for empty reportIds array', async () => {
      mockGetDailyReportRole.mockResolvedValue('ADMIN');
      mockCanApproveReport.mockReturnValue(true);

      const req = makeRequest('/api/projects/test-project/daily-reports/approve-bulk', {
        method: 'POST',
        body: { reportIds: [], action: 'APPROVED' },
      });
      const res = await BULK_POST(req, PARAMS_SLUG);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('non-empty');
    });

    it('should return 400 for more than 50 reports', async () => {
      mockGetDailyReportRole.mockResolvedValue('ADMIN');
      mockCanApproveReport.mockReturnValue(true);

      const reportIds = Array.from({ length: 51 }, (_, i) => `report-${i}`);

      const req = makeRequest('/api/projects/test-project/daily-reports/approve-bulk', {
        method: 'POST',
        body: { reportIds, action: 'APPROVED' },
      });
      const res = await BULK_POST(req, PARAMS_SLUG);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('50');
    });

    it('should return 400 for invalid action', async () => {
      mockGetDailyReportRole.mockResolvedValue('ADMIN');
      mockCanApproveReport.mockReturnValue(true);

      const req = makeRequest('/api/projects/test-project/daily-reports/approve-bulk', {
        method: 'POST',
        body: { reportIds: ['report-1'], action: 'INVALID' },
      });
      const res = await BULK_POST(req, PARAMS_SLUG);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('APPROVED or REJECTED');
    });

    it('should bulk reject with reason', async () => {
      mockGetDailyReportRole.mockResolvedValue('SUPERVISOR');
      mockCanApproveReport.mockReturnValue(true);
      mockIsValidTransition.mockReturnValue(true);

      mockPrisma.dailyReport.findUnique.mockResolvedValue({
        id: 'report-1',
        projectId: 'project-1',
        status: 'SUBMITTED',
        reportNumber: 1,
        deletedAt: null,
      });

      const req = makeRequest('/api/projects/test-project/daily-reports/approve-bulk', {
        method: 'POST',
        body: {
          reportIds: ['report-1'],
          action: 'REJECTED',
          rejectionReason: 'Missing labor entries',
        },
      });
      const res = await BULK_POST(req, PARAMS_SLUG);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.updated).toBe(1);
      expect(mockSanitizeText).toHaveBeenCalledWith('Missing labor entries');
    });
  });
});
