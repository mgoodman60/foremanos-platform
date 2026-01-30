import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies BEFORE importing the route
const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'user',
};

const mockProject = {
  id: 'project-1',
  slug: 'test-project',
  name: 'Test Project',
  ownerId: 'user-1',
  masterScheduleDocId: null,
  scheduleConfirmedAt: null,
  scheduleConfirmedBy: null,
};

const mockDocument = {
  id: 'doc-1',
  name: 'Master Schedule.pdf',
  fileName: 'schedule.pdf',
  projectId: 'project-1',
};

const prismaMock = {
  user: {
    findUnique: vi.fn().mockResolvedValue(mockUser),
  },
  project: {
    findUnique: vi.fn().mockResolvedValue(mockProject),
    update: vi.fn().mockResolvedValue({
      ...mockProject,
      masterScheduleDocId: 'doc-1',
      scheduleConfirmedAt: new Date('2024-01-15T10:00:00Z'),
      scheduleConfirmedBy: 'user-1',
    }),
  },
  document: {
    findFirst: vi.fn().mockResolvedValue(mockDocument),
    findUnique: vi.fn().mockResolvedValue(mockDocument),
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

const mockSession = {
  user: {
    email: 'test@example.com',
  },
};

describe('POST /api/projects/[slug]/schedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue(mockSession);
    prismaMock.user.findUnique.mockResolvedValue(mockUser);
    prismaMock.project.findUnique.mockResolvedValue(mockProject);
    prismaMock.document.findFirst.mockResolvedValue(mockDocument);
  });

  it('should return 401 when not authenticated', async () => {
    getServerSessionMock.mockResolvedValueOnce(null);

    const { POST } = await import('@/app/api/projects/[slug]/schedule/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/schedule', {
      method: 'POST',
      body: JSON.stringify({ documentId: 'doc-1' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 when documentId is missing', async () => {
    const { POST } = await import('@/app/api/projects/[slug]/schedule/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/schedule', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('documentId is required');
  });

  it('should return 404 when project not found', async () => {
    prismaMock.project.findUnique.mockResolvedValue(null);

    const { POST } = await import('@/app/api/projects/[slug]/schedule/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/schedule', {
      method: 'POST',
      body: JSON.stringify({ documentId: 'doc-1' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Project not found');
  });

  it('should return 403 when user is not owner or admin', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...mockUser,
      id: 'user-2',
      role: 'user',
    });
    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      ownerId: 'user-1', // Different owner
    });

    const { POST } = await import('@/app/api/projects/[slug]/schedule/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/schedule', {
      method: 'POST',
      body: JSON.stringify({ documentId: 'doc-1' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Only project owner or admin can set master schedule');
  });

  it('should return 404 when document not found', async () => {
    prismaMock.document.findFirst.mockResolvedValue(null);

    const { POST } = await import('@/app/api/projects/[slug]/schedule/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/schedule', {
      method: 'POST',
      body: JSON.stringify({ documentId: 'doc-1' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Document not found in this project');
  });

  it('should successfully set master schedule for project owner', async () => {
    const { POST } = await import('@/app/api/projects/[slug]/schedule/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/schedule', {
      method: 'POST',
      body: JSON.stringify({ documentId: 'doc-1' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.project.masterScheduleDocId).toBe('doc-1');
    expect(data.Document.id).toBe('doc-1');
    expect(prismaMock.project.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: {
        masterScheduleDocId: 'doc-1',
        scheduleConfirmedAt: expect.any(Date),
        scheduleConfirmedBy: 'user-1',
      },
    });
  });

  it('should successfully set master schedule for admin', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...mockUser,
      id: 'admin-1',
      role: 'admin',
    });
    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      ownerId: 'user-1', // Different owner, but user is admin
    });

    const { POST } = await import('@/app/api/projects/[slug]/schedule/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/schedule', {
      method: 'POST',
      body: JSON.stringify({ documentId: 'doc-1' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});

describe('GET /api/projects/[slug]/schedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue(mockSession);
    prismaMock.user.findUnique.mockResolvedValue(mockUser);
    prismaMock.project.findUnique.mockResolvedValue(mockProject);
  });

  it('should return 401 when not authenticated', async () => {
    getServerSessionMock.mockResolvedValueOnce(null);

    const { GET } = await import('@/app/api/projects/[slug]/schedule/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/schedule', {
      method: 'GET',
    });
    const response = await GET(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(401);
  });

  it('should return 404 when project not found', async () => {
    prismaMock.project.findUnique.mockResolvedValue(null);

    const { GET } = await import('@/app/api/projects/[slug]/schedule/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/schedule', {
      method: 'GET',
    });
    const response = await GET(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(404);
  });

  it('should return schedule info with no master schedule set', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      Document: [],
    });

    const { GET } = await import('@/app/api/projects/[slug]/schedule/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/schedule', {
      method: 'GET',
    });
    const response = await GET(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.hasSchedule).toBe(false);
    expect(data.masterScheduleDocId).toBeNull();
  });

  it('should return schedule info with master schedule set', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      masterScheduleDocId: 'doc-1',
      scheduleConfirmedAt: new Date('2024-01-15T10:00:00Z'),
      Document: [mockDocument],
    });

    const { GET } = await import('@/app/api/projects/[slug]/schedule/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/schedule', {
      method: 'GET',
    });
    const response = await GET(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.hasSchedule).toBe(true);
    expect(data.masterScheduleDocId).toBe('doc-1');
    expect(data.document.id).toBe('doc-1');
    expect(data.document.name).toBe('Master Schedule.pdf');
    expect(data.document.fileName).toBe('schedule.pdf');
  });
});

describe('DELETE /api/projects/[slug]/schedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue(mockSession);
    prismaMock.user.findUnique.mockResolvedValue(mockUser);
    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      masterScheduleDocId: 'doc-1',
    });
  });

  it('should return 401 when not authenticated', async () => {
    getServerSessionMock.mockResolvedValueOnce(null);

    const { DELETE } = await import('@/app/api/projects/[slug]/schedule/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/schedule', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(401);
  });

  it('should return 403 when user is not owner or admin', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...mockUser,
      id: 'user-2',
      role: 'user',
    });

    const { DELETE } = await import('@/app/api/projects/[slug]/schedule/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/schedule', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Only project owner or admin can remove master schedule');
  });

  it('should successfully remove master schedule', async () => {
    prismaMock.project.update.mockResolvedValue({
      ...mockProject,
      masterScheduleDocId: null,
      scheduleConfirmedAt: null,
      scheduleConfirmedBy: null,
    });

    const { DELETE } = await import('@/app/api/projects/[slug]/schedule/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/schedule', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: { slug: 'test-project' } });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(prismaMock.project.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: {
        masterScheduleDocId: null,
        scheduleConfirmedAt: null,
        scheduleConfirmedBy: null,
      },
    });
  });
});
