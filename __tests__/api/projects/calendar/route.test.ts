import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
const mockPrisma = vi.hoisted(() => ({
  project: { findUnique: vi.fn() }
}));

const mockSession = vi.hoisted(() => ({
  user: { id: 'user-1', email: 'test@test.com', role: 'client' }
}));

const mockVerifyCalendarToken = vi.hoisted(() => vi.fn());
const mockCheckRateLimit = vi.hoisted(() => vi.fn().mockResolvedValue({ success: true, limit: 60, remaining: 59, reset: 0 }));
const mockGetClientIp = vi.hoisted(() => vi.fn().mockReturnValue('127.0.0.1'));
const mockGetRateLimitIdentifier = vi.hoisted(() => vi.fn().mockReturnValue('ip:127.0.0.1'));

const mockExportMilestones = vi.hoisted(() => vi.fn().mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR'));
const mockExportSchedule = vi.hoisted(() => vi.fn().mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR'));
const mockExportDeadlines = vi.hoisted(() => vi.fn().mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR'));
const mockExportProjectCalendar = vi.hoisted(() => vi.fn().mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR'));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/calendar-share-token', () => ({
  verifyCalendarToken: mockVerifyCalendarToken,
  generateCalendarToken: vi.fn(),
}));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: mockCheckRateLimit,
  RATE_LIMITS: { API: { maxRequests: 60, windowSeconds: 60 } },
  getClientIp: mockGetClientIp,
  getRateLimitIdentifier: mockGetRateLimitIdentifier,
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));
vi.mock('@/lib/calendar-export', () => ({
  exportMilestonesAsICal: mockExportMilestones,
  exportScheduleAsICal: mockExportSchedule,
  exportDeadlinesAsICal: mockExportDeadlines,
  exportProjectCalendar: mockExportProjectCalendar,
}));

import { GET } from '@/app/api/projects/[slug]/calendar/[type]/route';

function makeRequest(url: string): Request {
  return new Request(url, { method: 'GET' });
}

describe('GET /api/projects/[slug]/calendar/[type]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 60, remaining: 59, reset: 0 });
  });

  it('returns 401 when no token provided', async () => {
    const req = makeRequest('http://localhost/api/projects/test-project/calendar/milestones');
    const res = await GET(req, { params: Promise.resolve({ slug: 'test-project', type: 'milestones' }) });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('token required');
  });

  it('returns 401 when invalid token provided', async () => {
    mockVerifyCalendarToken.mockImplementation(() => {
      throw new Error('Invalid or expired calendar token');
    });
    const req = makeRequest('http://localhost/api/projects/test-project/calendar/milestones?token=bad-token');
    const res = await GET(req, { params: Promise.resolve({ slug: 'test-project', type: 'milestones' }) });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Invalid or expired');
  });

  it('returns 401 when expired token provided', async () => {
    mockVerifyCalendarToken.mockImplementation(() => {
      throw new Error('Invalid or expired calendar token');
    });
    const req = makeRequest('http://localhost/api/projects/test-project/calendar/milestones?token=expired-token');
    const res = await GET(req, { params: Promise.resolve({ slug: 'test-project', type: 'milestones' }) });
    expect(res.status).toBe(401);
  });

  it('returns 401 when token projectId does not match route project', async () => {
    mockVerifyCalendarToken.mockReturnValue({
      projectId: 'different-project-id',
      calendarType: 'milestones',
      expiresAt: new Date(Date.now() + 86400000),
    });
    mockPrisma.project.findUnique.mockResolvedValue({ id: 'actual-project-id', name: 'Test Project' });

    const req = makeRequest('http://localhost/api/projects/test-project/calendar/milestones?token=valid-token');
    const res = await GET(req, { params: Promise.resolve({ slug: 'test-project', type: 'milestones' }) });
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid token', async () => {
    mockVerifyCalendarToken.mockReturnValue({
      projectId: 'proj-123',
      calendarType: 'milestones',
      expiresAt: new Date(Date.now() + 86400000),
    });
    mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-123', name: 'Test Project' });

    const req = makeRequest('http://localhost/api/projects/test-project/calendar/milestones?token=valid-token');
    const res = await GET(req, { params: Promise.resolve({ slug: 'test-project', type: 'milestones' }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/calendar');
    const text = await res.text();
    expect(text).toContain('VCALENDAR');
  });

  it('returns 404 when project not found', async () => {
    mockVerifyCalendarToken.mockReturnValue({
      projectId: 'proj-123',
      calendarType: 'milestones',
      expiresAt: new Date(Date.now() + 86400000),
    });
    mockPrisma.project.findUnique.mockResolvedValue(null);

    const req = makeRequest('http://localhost/api/projects/test-project/calendar/milestones?token=valid-token');
    const res = await GET(req, { params: Promise.resolve({ slug: 'test-project', type: 'milestones' }) });
    expect(res.status).toBe(404);
  });

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 60, remaining: 0, reset: 0, retryAfter: 60 });

    const req = makeRequest('http://localhost/api/projects/test-project/calendar/milestones?token=valid-token');
    const res = await GET(req, { params: Promise.resolve({ slug: 'test-project', type: 'milestones' }) });
    expect(res.status).toBe(429);
  });

  it('returns 400 for invalid calendar type', async () => {
    mockVerifyCalendarToken.mockReturnValue({
      projectId: 'proj-123',
      calendarType: 'invalid',
      expiresAt: new Date(Date.now() + 86400000),
    });
    mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-123', name: 'Test Project' });

    const req = makeRequest('http://localhost/api/projects/test-project/calendar/invalid?token=valid-token');
    const res = await GET(req, { params: Promise.resolve({ slug: 'test-project', type: 'invalid' }) });
    expect(res.status).toBe(400);
  });
});
