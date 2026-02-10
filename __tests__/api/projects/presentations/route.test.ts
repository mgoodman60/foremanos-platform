/**
 * Presentation Boards API Tests
 * Covers list, create, detail, update, delete, and logo upload routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted Mocks ───────────────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  project: { findUnique: vi.fn() },
  presentationBoard: {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  projectRender: { findMany: vi.fn() },
}));
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

const mockGetServerSession = vi.hoisted(() => vi.fn());
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }));

const mockCheckRateLimit = vi.hoisted(() => vi.fn());
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: mockCheckRateLimit,
  RATE_LIMITS: {
    RENDER: { maxRequests: 5, windowSeconds: 600 },
  },
  getRateLimitIdentifier: (userId: string) => `user:${userId}`,
  createRateLimitHeaders: () => ({}),
}));

const mockGetFileUrl = vi.hoisted(() => vi.fn());
const mockGeneratePresignedUploadUrl = vi.hoisted(() => vi.fn());
vi.mock('@/lib/s3', () => ({
  getFileUrl: mockGetFileUrl,
  generatePresignedUploadUrl: mockGeneratePresignedUploadUrl,
}));

vi.mock('@/lib/auth-options', () => ({ authOptions: {} }));
vi.mock('@/lib/logger', () => ({
  createScopedLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Helpers ─────────────────────────────────────────────────────────────

const TEST_USER = { id: 'user-1', role: 'user' };
const TEST_PROJECT = {
  id: 'proj-1',
  ownerId: 'user-1',
  ProjectMember: [],
};

const TEST_BOARD = {
  id: 'board-1',
  projectId: 'proj-1',
  createdBy: 'user-1',
  title: 'Client Presentation',
  templateId: 'hero_sign',
  projectName: 'Test Project',
  companyName: 'ACME Construction',
  tagline: null,
  contactInfo: null,
  dateText: null,
  primaryColor: '#F97316',
  accentColor: '#003B71',
  companyLogoKey: null,
  clientLogoKey: null,
  partnerLogo1Key: null,
  partnerLogo2Key: null,
  renderIds: [],
  sitePhotoKey: null,
  lastExportedAt: null,
  lastExportFormat: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeRequest(url: string, options?: RequestInit) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
}

function setupAuth(user = TEST_USER) {
  mockGetServerSession.mockResolvedValue({ user });
}

function setupProject(project = TEST_PROJECT) {
  mockPrisma.project.findUnique.mockResolvedValue(project);
}

function setupRateLimit(success = true) {
  mockCheckRateLimit.mockResolvedValue({
    success,
    limit: 5,
    remaining: success ? 4 : 0,
    reset: Math.floor(Date.now() / 1000) + 600,
    ...(success ? {} : { retryAfter: 600 }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth();
  setupProject();
  setupRateLimit();
});

// ── GET /presentations ──────────────────────────────────────────────────

describe('GET /api/projects/[slug]/presentations', () => {
  let GET: Function;

  beforeEach(async () => {
    const mod = await import('@/app/api/projects/[slug]/presentations/route');
    GET = mod.GET;
  });

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/presentations'),
      { params: { slug: 'test' } }
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when project not found', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);
    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/presentations'),
      { params: { slug: 'test' } }
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 when user has no access', async () => {
    setupProject({ ...TEST_PROJECT, ownerId: 'other-user' });
    setupAuth({ id: 'user-1', role: 'user' });
    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/presentations'),
      { params: { slug: 'test' } }
    );
    expect(res.status).toBe(403);
  });

  it('lists boards successfully', async () => {
    const boards = [TEST_BOARD];
    mockPrisma.presentationBoard.findMany.mockResolvedValue(boards);

    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/presentations'),
      { params: { slug: 'test' } }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.boards).toHaveLength(1);
    expect(data.total).toBe(1);
  });

  it('allows project member access', async () => {
    setupProject({
      ...TEST_PROJECT,
      ownerId: 'other-owner',
      ProjectMember: [{ userId: 'user-1' }],
    });
    mockPrisma.presentationBoard.findMany.mockResolvedValue([]);

    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/presentations'),
      { params: { slug: 'test' } }
    );
    expect(res.status).toBe(200);
  });

  it('allows admin access', async () => {
    setupProject({ ...TEST_PROJECT, ownerId: 'other-owner' });
    setupAuth({ id: 'admin-1', role: 'admin' });
    mockPrisma.presentationBoard.findMany.mockResolvedValue([]);

    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/presentations'),
      { params: { slug: 'test' } }
    );
    expect(res.status).toBe(200);
  });
});

// ── POST /presentations ─────────────────────────────────────────────────

describe('POST /api/projects/[slug]/presentations', () => {
  let POST: Function;

  beforeEach(async () => {
    const mod = await import('@/app/api/projects/[slug]/presentations/route');
    POST = mod.POST;
  });

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/presentations', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test', templateId: 'hero_sign' }),
      }),
      { params: { slug: 'test' } }
    );
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    setupRateLimit(false);
    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/presentations', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test', templateId: 'hero_sign' }),
      }),
      { params: { slug: 'test' } }
    );
    expect(res.status).toBe(429);
  });

  it('returns 400 when title is missing', async () => {
    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/presentations', {
        method: 'POST',
        body: JSON.stringify({ templateId: 'hero_sign' }),
      }),
      { params: { slug: 'test' } }
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('title');
  });

  it('returns 400 when templateId is invalid', async () => {
    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/presentations', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test', templateId: 'invalid_template' }),
      }),
      { params: { slug: 'test' } }
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('templateId');
  });

  it('returns 400 when templateId is missing', async () => {
    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/presentations', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test' }),
      }),
      { params: { slug: 'test' } }
    );
    expect(res.status).toBe(400);
  });

  it('creates a board successfully', async () => {
    mockPrisma.presentationBoard.create.mockResolvedValue(TEST_BOARD);

    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/presentations', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Client Presentation',
          templateId: 'hero_sign',
          projectName: 'Test Project',
          companyName: 'ACME Construction',
        }),
      }),
      { params: { slug: 'test' } }
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.board).toBeDefined();
    expect(mockPrisma.presentationBoard.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'proj-1',
        createdBy: 'user-1',
        title: 'Client Presentation',
        templateId: 'hero_sign',
        projectName: 'Test Project',
        companyName: 'ACME Construction',
      }),
    });
  });

  it('creates board with all valid template ids', async () => {
    const validTemplates = ['hero_sign', 'portfolio_sheet', 'before_after', 'presentation_cover'];

    for (const templateId of validTemplates) {
      vi.clearAllMocks();
      setupAuth();
      setupProject();
      setupRateLimit();
      mockPrisma.presentationBoard.create.mockResolvedValue({ ...TEST_BOARD, templateId });

      const res = await POST(
        makeRequest('http://localhost:3000/api/projects/test/presentations', {
          method: 'POST',
          body: JSON.stringify({ title: 'Test', templateId }),
        }),
        { params: { slug: 'test' } }
      );
      expect(res.status).toBe(201);
    }
  });

  it('returns 403 when user has no access', async () => {
    setupProject({ ...TEST_PROJECT, ownerId: 'other-user' });
    setupAuth({ id: 'user-1', role: 'user' });
    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/presentations', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test', templateId: 'hero_sign' }),
      }),
      { params: { slug: 'test' } }
    );
    expect(res.status).toBe(403);
  });
});

// ── GET /presentations/[id] ─────────────────────────────────────────────

describe('GET /api/projects/[slug]/presentations/[id]', () => {
  let GET: Function;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/app/api/projects/[slug]/presentations/[id]/route');
    GET = mod.GET;
  });

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/presentations/board-1'),
      { params: { slug: 'test', id: 'board-1' } }
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when board not found', async () => {
    mockPrisma.presentationBoard.findUnique.mockResolvedValue(null);
    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/presentations/board-1'),
      { params: { slug: 'test', id: 'board-1' } }
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 when board belongs to different project', async () => {
    mockPrisma.presentationBoard.findUnique.mockResolvedValue({
      ...TEST_BOARD,
      projectId: 'other-project',
    });
    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/presentations/board-1'),
      { params: { slug: 'test', id: 'board-1' } }
    );
    expect(res.status).toBe(404);
  });

  it('returns board with signed URLs for logos', async () => {
    mockPrisma.presentationBoard.findUnique.mockResolvedValue({
      ...TEST_BOARD,
      companyLogoKey: 'logos/company.png',
      sitePhotoKey: 'photos/site.jpg',
    });
    mockGetFileUrl.mockResolvedValue('https://signed-url.example.com/file');
    mockPrisma.projectRender.findMany.mockResolvedValue([]);

    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/presentations/board-1'),
      { params: { slug: 'test', id: 'board-1' } }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.board.companyLogoUrl).toBe('https://signed-url.example.com/file');
    expect(data.board.sitePhotoUrl).toBe('https://signed-url.example.com/file');
  });

  it('returns board with render URLs', async () => {
    mockPrisma.presentationBoard.findUnique.mockResolvedValue({
      ...TEST_BOARD,
      renderIds: ['render-1', 'render-2'],
    });
    mockPrisma.projectRender.findMany.mockResolvedValue([
      { id: 'render-1', imageKey: 'renders/r1.png', thumbnailKey: 'renders/r1-thumb.png' },
      { id: 'render-2', imageKey: 'renders/r2.png', thumbnailKey: null },
    ]);
    mockGetFileUrl.mockResolvedValue('https://signed-url.example.com/file');

    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/presentations/board-1'),
      { params: { slug: 'test', id: 'board-1' } }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.board.renders).toHaveLength(2);
    expect(data.board.renders[0].imageUrl).toBe('https://signed-url.example.com/file');
  });

  it('returns board without renders when renderIds is empty', async () => {
    mockPrisma.presentationBoard.findUnique.mockResolvedValue(TEST_BOARD);

    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/presentations/board-1'),
      { params: { slug: 'test', id: 'board-1' } }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.board.renders).toHaveLength(0);
    expect(mockPrisma.projectRender.findMany).not.toHaveBeenCalled();
  });
});

// ── PATCH /presentations/[id] ───────────────────────────────────────────

describe('PATCH /api/projects/[slug]/presentations/[id]', () => {
  let PATCH: Function;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/app/api/projects/[slug]/presentations/[id]/route');
    PATCH = mod.PATCH;
  });

  it('updates title', async () => {
    mockPrisma.presentationBoard.findUnique.mockResolvedValue(TEST_BOARD);
    mockPrisma.presentationBoard.update.mockResolvedValue({
      ...TEST_BOARD,
      title: 'Updated Title',
    });

    const res = await PATCH(
      makeRequest('http://localhost:3000/api/projects/test/presentations/board-1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Updated Title' }),
      }),
      { params: { slug: 'test', id: 'board-1' } }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockPrisma.presentationBoard.update).toHaveBeenCalledWith({
      where: { id: 'board-1' },
      data: expect.objectContaining({ title: 'Updated Title' }),
    });
  });

  it('updates multiple fields', async () => {
    mockPrisma.presentationBoard.findUnique.mockResolvedValue(TEST_BOARD);
    mockPrisma.presentationBoard.update.mockResolvedValue({
      ...TEST_BOARD,
      primaryColor: '#FF0000',
      tagline: 'New tagline',
    });

    const res = await PATCH(
      makeRequest('http://localhost:3000/api/projects/test/presentations/board-1', {
        method: 'PATCH',
        body: JSON.stringify({ primaryColor: '#FF0000', tagline: 'New tagline' }),
      }),
      { params: { slug: 'test', id: 'board-1' } }
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.presentationBoard.update).toHaveBeenCalledWith({
      where: { id: 'board-1' },
      data: expect.objectContaining({
        primaryColor: '#FF0000',
        tagline: 'New tagline',
      }),
    });
  });

  it('ignores non-whitelisted fields', async () => {
    mockPrisma.presentationBoard.findUnique.mockResolvedValue(TEST_BOARD);
    mockPrisma.presentationBoard.update.mockResolvedValue(TEST_BOARD);

    await PATCH(
      makeRequest('http://localhost:3000/api/projects/test/presentations/board-1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'OK', createdBy: 'hacker-id', projectId: 'hacked' }),
      }),
      { params: { slug: 'test', id: 'board-1' } }
    );

    const updateCall = mockPrisma.presentationBoard.update.mock.calls[0][0];
    expect(updateCall.data.createdBy).toBeUndefined();
    expect(updateCall.data.projectId).toBeUndefined();
    expect(updateCall.data.title).toBe('OK');
  });

  it('returns 404 when board not found', async () => {
    mockPrisma.presentationBoard.findUnique.mockResolvedValue(null);
    const res = await PATCH(
      makeRequest('http://localhost:3000/api/projects/test/presentations/board-1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'test' }),
      }),
      { params: { slug: 'test', id: 'board-1' } }
    );
    expect(res.status).toBe(404);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await PATCH(
      makeRequest('http://localhost:3000/api/projects/test/presentations/board-1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'test' }),
      }),
      { params: { slug: 'test', id: 'board-1' } }
    );
    expect(res.status).toBe(401);
  });
});

// ── DELETE /presentations/[id] ──────────────────────────────────────────

describe('DELETE /api/projects/[slug]/presentations/[id]', () => {
  let DELETE: Function;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/app/api/projects/[slug]/presentations/[id]/route');
    DELETE = mod.DELETE;
  });

  it('deletes board successfully', async () => {
    mockPrisma.presentationBoard.findUnique.mockResolvedValue(TEST_BOARD);
    mockPrisma.presentationBoard.delete.mockResolvedValue(TEST_BOARD);

    const res = await DELETE(
      makeRequest('http://localhost:3000/api/projects/test/presentations/board-1', {
        method: 'DELETE',
      }),
      { params: { slug: 'test', id: 'board-1' } }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.presentationBoard.delete).toHaveBeenCalledWith({
      where: { id: 'board-1' },
    });
  });

  it('returns 403 when user is not creator or owner', async () => {
    setupAuth({ id: 'other-user', role: 'user' });
    setupProject({
      ...TEST_PROJECT,
      ownerId: 'owner-user',
      ProjectMember: [{ userId: 'other-user' }],
    });
    mockPrisma.presentationBoard.findUnique.mockResolvedValue({
      ...TEST_BOARD,
      createdBy: 'user-1',
    });

    const res = await DELETE(
      makeRequest('http://localhost:3000/api/projects/test/presentations/board-1', {
        method: 'DELETE',
      }),
      { params: { slug: 'test', id: 'board-1' } }
    );
    expect(res.status).toBe(403);
  });

  it('allows project owner to delete any board', async () => {
    setupAuth({ id: 'owner-user', role: 'user' });
    setupProject({ ...TEST_PROJECT, ownerId: 'owner-user' });
    mockPrisma.presentationBoard.findUnique.mockResolvedValue({
      ...TEST_BOARD,
      createdBy: 'other-user',
    });
    mockPrisma.presentationBoard.delete.mockResolvedValue(TEST_BOARD);

    const res = await DELETE(
      makeRequest('http://localhost:3000/api/projects/test/presentations/board-1', {
        method: 'DELETE',
      }),
      { params: { slug: 'test', id: 'board-1' } }
    );
    expect(res.status).toBe(200);
  });

  it('allows admin to delete any board', async () => {
    setupAuth({ id: 'admin-1', role: 'admin' });
    setupProject({
      ...TEST_PROJECT,
      ownerId: 'other-owner',
      ProjectMember: [],
    });
    mockPrisma.presentationBoard.findUnique.mockResolvedValue({
      ...TEST_BOARD,
      createdBy: 'other-user',
    });
    mockPrisma.presentationBoard.delete.mockResolvedValue(TEST_BOARD);

    const res = await DELETE(
      makeRequest('http://localhost:3000/api/projects/test/presentations/board-1', {
        method: 'DELETE',
      }),
      { params: { slug: 'test', id: 'board-1' } }
    );
    expect(res.status).toBe(200);
  });

  it('returns 404 when board not found', async () => {
    mockPrisma.presentationBoard.findUnique.mockResolvedValue(null);
    const res = await DELETE(
      makeRequest('http://localhost:3000/api/projects/test/presentations/board-1', {
        method: 'DELETE',
      }),
      { params: { slug: 'test', id: 'board-1' } }
    );
    expect(res.status).toBe(404);
  });
});

// ── POST /presentations/[id]/logo-upload ────────────────────────────────

describe('POST /api/projects/[slug]/presentations/[id]/logo-upload', () => {
  let POST: Function;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/app/api/projects/[slug]/presentations/[id]/logo-upload/route');
    POST = mod.POST;
  });

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/presentations/board-1/logo-upload', {
        method: 'POST',
        body: JSON.stringify({ fileName: 'logo.png', contentType: 'image/png', slot: 'company' }),
      }),
      { params: { slug: 'test', id: 'board-1' } }
    );
    expect(res.status).toBe(401);
  });

  it('returns presigned URL for valid upload', async () => {
    mockPrisma.presentationBoard.findUnique.mockResolvedValue(TEST_BOARD);
    mockGeneratePresignedUploadUrl.mockResolvedValue({
      uploadUrl: 'https://s3.example.com/upload',
      cloud_storage_path: 'presentation-logos/proj-1/board-1/company-123.png',
    });

    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/presentations/board-1/logo-upload', {
        method: 'POST',
        body: JSON.stringify({ fileName: 'logo.png', contentType: 'image/png', slot: 'company' }),
      }),
      { params: { slug: 'test', id: 'board-1' } }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.uploadUrl).toBe('https://s3.example.com/upload');
    expect(data.key).toBeDefined();
  });

  it('returns 400 for invalid content type', async () => {
    mockPrisma.presentationBoard.findUnique.mockResolvedValue(TEST_BOARD);

    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/presentations/board-1/logo-upload', {
        method: 'POST',
        body: JSON.stringify({ fileName: 'file.exe', contentType: 'application/x-msdownload', slot: 'company' }),
      }),
      { params: { slug: 'test', id: 'board-1' } }
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid slot', async () => {
    mockPrisma.presentationBoard.findUnique.mockResolvedValue(TEST_BOARD);

    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/presentations/board-1/logo-upload', {
        method: 'POST',
        body: JSON.stringify({ fileName: 'logo.png', contentType: 'image/png', slot: 'invalid' }),
      }),
      { params: { slug: 'test', id: 'board-1' } }
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('slot');
  });

  it('returns 400 when fileName is missing', async () => {
    mockPrisma.presentationBoard.findUnique.mockResolvedValue(TEST_BOARD);

    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/presentations/board-1/logo-upload', {
        method: 'POST',
        body: JSON.stringify({ contentType: 'image/png', slot: 'company' }),
      }),
      { params: { slug: 'test', id: 'board-1' } }
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when board not found', async () => {
    mockPrisma.presentationBoard.findUnique.mockResolvedValue(null);

    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/presentations/board-1/logo-upload', {
        method: 'POST',
        body: JSON.stringify({ fileName: 'logo.png', contentType: 'image/png', slot: 'company' }),
      }),
      { params: { slug: 'test', id: 'board-1' } }
    );
    expect(res.status).toBe(404);
  });

  it('accepts all valid content types', async () => {
    const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
    mockPrisma.presentationBoard.findUnique.mockResolvedValue(TEST_BOARD);
    mockGeneratePresignedUploadUrl.mockResolvedValue({
      uploadUrl: 'https://s3.example.com/upload',
      cloud_storage_path: 'some/path',
    });

    for (const contentType of validTypes) {
      const res = await POST(
        makeRequest('http://localhost:3000/api/projects/test/presentations/board-1/logo-upload', {
          method: 'POST',
          body: JSON.stringify({ fileName: 'logo', contentType, slot: 'company' }),
        }),
        { params: { slug: 'test', id: 'board-1' } }
      );
      expect(res.status).toBe(200);
    }
  });

  it('accepts all valid slots', async () => {
    const validSlots = ['company', 'client', 'partner1', 'partner2'];
    mockPrisma.presentationBoard.findUnique.mockResolvedValue(TEST_BOARD);
    mockGeneratePresignedUploadUrl.mockResolvedValue({
      uploadUrl: 'https://s3.example.com/upload',
      cloud_storage_path: 'some/path',
    });

    for (const slot of validSlots) {
      const res = await POST(
        makeRequest('http://localhost:3000/api/projects/test/presentations/board-1/logo-upload', {
          method: 'POST',
          body: JSON.stringify({ fileName: 'logo.png', contentType: 'image/png', slot }),
        }),
        { params: { slug: 'test', id: 'board-1' } }
      );
      expect(res.status).toBe(200);
    }
  });
});
