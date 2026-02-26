/**
 * Project Renders API Tests
 * Covers list, create, detail, update, delete, generate, download, and context routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted Mocks ───────────────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  projectRender: {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  room: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
}));
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

const mockSession = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: mockSession }));

const mockCheckRateLimit = vi.hoisted(() => vi.fn());
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: mockCheckRateLimit,
  RATE_LIMITS: {
    RENDER: { maxRequests: 5, windowSeconds: 600 },
    API: { maxRequests: 60, windowSeconds: 60 },
  },
  getRateLimitIdentifier: (userId: string) => `user:${userId}`,
  createRateLimitHeaders: () => ({}),
}));

const mockAssemble = vi.hoisted(() => vi.fn());
const mockCompleteness = vi.hoisted(() => vi.fn());
const mockGatherRoom = vi.hoisted(() => vi.fn());
const mockGatherExterior = vi.hoisted(() => vi.fn());
const mockGatherAerial = vi.hoisted(() => vi.fn());
vi.mock('@/lib/render-prompt-assembler', () => ({
  assembleRenderPrompt: mockAssemble,
  calculateDataCompleteness: mockCompleteness,
  gatherRoomData: mockGatherRoom,
  gatherExteriorData: mockGatherExterior,
  gatherAerialData: mockGatherAerial,
}));

const mockGenerateImage = vi.hoisted(() => vi.fn());
vi.mock('@/lib/render-provider', () => ({
  generateImage: mockGenerateImage,
}));

const mockUploadFile = vi.hoisted(() => vi.fn());
const mockDownloadFile = vi.hoisted(() => vi.fn());
const mockDeleteFile = vi.hoisted(() => vi.fn());
const mockGetFileUrl = vi.hoisted(() => vi.fn());
vi.mock('@/lib/s3', () => ({
  uploadFile: mockUploadFile,
  downloadFile: mockDownloadFile,
  deleteFile: mockDeleteFile,
  getFileUrl: mockGetFileUrl,
}));

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

const TEST_RENDER = {
  id: 'render-1',
  projectId: 'proj-1',
  createdBy: 'user-1',
  viewType: 'exterior',
  style: 'photorealistic',
  cameraAngle: 'eye_level',
  qualityTier: 'high',
  assembledPrompt: 'A beautiful building...',
  promptHash: 'abc123hash',
  userNotes: null,
  dataSnapshot: {},
  referencePhotoKeys: [],
  roomId: null,
  status: 'pending',
  provider: null,
  imageKey: null,
  thumbnailKey: null,
  revisedPrompt: null,
  imageWidth: null,
  imageHeight: null,
  fileSizeBytes: null,
  generationTimeMs: null,
  estimatedCostUsd: null,
  errorMessage: null,
  retryCount: 0,
  isFavorite: false,
  title: null,
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeRequest(url: string, options?: RequestInit) {
  // @ts-expect-error strictNullChecks migration
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
}

function setupAuth(user = TEST_USER) {
  mockSession.mockResolvedValue({ user });
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

// ── GET /renders ────────────────────────────────────────────────────────

describe('GET /api/projects/[slug]/renders', () => {
  let GET: Function;

  beforeEach(async () => {
    const mod = await import('@/app/api/projects/[slug]/renders/route');
    GET = mod.GET;
  });

  it('returns 401 when not authenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/renders'),
      { params: { slug: 'test' } }
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when project not found', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);
    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/renders'),
      { params: { slug: 'test' } }
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 when user has no access', async () => {
    setupProject({ ...TEST_PROJECT, ownerId: 'other-user' });
    setupAuth({ id: 'user-1', role: 'user' });
    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/renders'),
      { params: { slug: 'test' } }
    );
    expect(res.status).toBe(403);
  });

  it('lists renders with pagination', async () => {
    const renders = [{ ...TEST_RENDER }];
    mockPrisma.projectRender.findMany.mockResolvedValue(renders);
    mockPrisma.projectRender.count.mockResolvedValue(1);

    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/renders?page=1&limit=10'),
      { params: { slug: 'test' } }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.renders).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.page).toBe(1);
    expect(data.limit).toBe(10);
  });

  it('applies viewType filter', async () => {
    mockPrisma.projectRender.findMany.mockResolvedValue([]);
    mockPrisma.projectRender.count.mockResolvedValue(0);

    await GET(
      makeRequest('http://localhost:3000/api/projects/test/renders?viewType=interior'),
      { params: { slug: 'test' } }
    );

    expect(mockPrisma.projectRender.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ viewType: 'interior' }),
      })
    );
  });

  it('applies status filter', async () => {
    mockPrisma.projectRender.findMany.mockResolvedValue([]);
    mockPrisma.projectRender.count.mockResolvedValue(0);

    await GET(
      makeRequest('http://localhost:3000/api/projects/test/renders?status=completed'),
      { params: { slug: 'test' } }
    );

    expect(mockPrisma.projectRender.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'completed' }),
      })
    );
  });

  it('allows project member access', async () => {
    setupProject({
      ...TEST_PROJECT,
      ownerId: 'other-owner',
      // @ts-expect-error strictNullChecks migration
      ProjectMember: [{ userId: 'user-1' }],
    });
    mockPrisma.projectRender.findMany.mockResolvedValue([]);
    mockPrisma.projectRender.count.mockResolvedValue(0);

    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/renders'),
      { params: { slug: 'test' } }
    );
    expect(res.status).toBe(200);
  });
});

// ── POST /renders ───────────────────────────────────────────────────────

describe('POST /api/projects/[slug]/renders', () => {
  let POST: Function;

  beforeEach(async () => {
    const mod = await import('@/app/api/projects/[slug]/renders/route');
    POST = mod.POST;
    mockAssemble.mockResolvedValue({
      prompt: 'Generated prompt text',
      dataSnapshot: { architecturalStyle: 'Modern' },
      tokenEstimate: 250,
      dataCompleteness: { score: 60, items: [] },
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/renders', {
        method: 'POST',
        body: JSON.stringify({ viewType: 'exterior', style: 'photorealistic' }),
      }),
      { params: { slug: 'test' } }
    );
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    setupRateLimit(false);
    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/renders', {
        method: 'POST',
        body: JSON.stringify({ viewType: 'exterior', style: 'photorealistic' }),
      }),
      { params: { slug: 'test' } }
    );
    expect(res.status).toBe(429);
  });

  it('returns 400 when viewType is missing', async () => {
    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/renders', {
        method: 'POST',
        body: JSON.stringify({ style: 'photorealistic' }),
      }),
      { params: { slug: 'test' } }
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when style is missing', async () => {
    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/renders', {
        method: 'POST',
        body: JSON.stringify({ viewType: 'exterior' }),
      }),
      { params: { slug: 'test' } }
    );
    expect(res.status).toBe(400);
  });

  it('creates a render successfully', async () => {
    const created = { ...TEST_RENDER };
    mockPrisma.projectRender.create.mockResolvedValue(created);

    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/renders', {
        method: 'POST',
        body: JSON.stringify({
          viewType: 'exterior',
          style: 'photorealistic',
          cameraAngle: 'eye_level',
          qualityTier: 'high',
        }),
      }),
      { params: { slug: 'test' } }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.render).toBeDefined();
    expect(mockAssemble).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj-1',
        viewType: 'exterior',
        style: 'photorealistic',
      })
    );
  });

  it('saves project design-intent fields when saveToProject is true', async () => {
    mockPrisma.projectRender.create.mockResolvedValue(TEST_RENDER);

    await POST(
      makeRequest('http://localhost:3000/api/projects/test/renders', {
        method: 'POST',
        body: JSON.stringify({
          viewType: 'exterior',
          style: 'photorealistic',
          saveToProject: true,
          userOverrides: {
            architecturalStyle: 'Contemporary',
            roofType: 'Flat',
          },
        }),
      }),
      { params: { slug: 'test' } }
    );

    expect(mockPrisma.project.update).toHaveBeenCalledWith({
      where: { id: 'proj-1' },
      data: expect.objectContaining({
        architecturalStyle: 'Contemporary',
        roofType: 'Flat',
      }),
    });
  });

  it('generates prompt hash from assembled prompt', async () => {
    mockPrisma.projectRender.create.mockResolvedValue(TEST_RENDER);

    await POST(
      makeRequest('http://localhost:3000/api/projects/test/renders', {
        method: 'POST',
        body: JSON.stringify({ viewType: 'exterior', style: 'photorealistic' }),
      }),
      { params: { slug: 'test' } }
    );

    expect(mockPrisma.projectRender.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        promptHash: expect.any(String),
        assembledPrompt: 'Generated prompt text',
      }),
    });

    // Verify hash is a sha256 hex string (64 chars)
    const call = mockPrisma.projectRender.create.mock.calls[0][0];
    expect(call.data.promptHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ── GET /renders/[id] ───────────────────────────────────────────────────

describe('GET /api/projects/[slug]/renders/[id]', () => {
  let GET: Function;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/app/api/projects/[slug]/renders/[id]/route');
    GET = mod.GET;
  });

  it('returns 401 when not authenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/renders/render-1'),
      { params: { slug: 'test', id: 'render-1' } }
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when render not found', async () => {
    mockPrisma.projectRender.findUnique.mockResolvedValue(null);
    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/renders/render-1'),
      { params: { slug: 'test', id: 'render-1' } }
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 when render belongs to different project', async () => {
    mockPrisma.projectRender.findUnique.mockResolvedValue({
      ...TEST_RENDER,
      projectId: 'other-project',
    });
    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/renders/render-1'),
      { params: { slug: 'test', id: 'render-1' } }
    );
    expect(res.status).toBe(404);
  });

  it('returns render with signed image URL', async () => {
    mockPrisma.projectRender.findUnique.mockResolvedValue({
      ...TEST_RENDER,
      status: 'completed',
      imageKey: 'renders/proj-1/render-1.png',
    });
    mockGetFileUrl.mockResolvedValue('https://signed-url.example.com/image.png');

    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/renders/render-1'),
      { params: { slug: 'test', id: 'render-1' } }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.render.imageUrl).toBe('https://signed-url.example.com/image.png');
  });

  it('returns render without imageUrl when no imageKey', async () => {
    mockPrisma.projectRender.findUnique.mockResolvedValue(TEST_RENDER);

    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/renders/render-1'),
      { params: { slug: 'test', id: 'render-1' } }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.render.imageUrl).toBeUndefined();
  });
});

// ── PATCH /renders/[id] ─────────────────────────────────────────────────

describe('PATCH /api/projects/[slug]/renders/[id]', () => {
  let PATCH: Function;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/app/api/projects/[slug]/renders/[id]/route');
    PATCH = mod.PATCH;
  });

  it('updates title', async () => {
    mockPrisma.projectRender.findUnique.mockResolvedValue(TEST_RENDER);
    mockPrisma.projectRender.update.mockResolvedValue({
      ...TEST_RENDER,
      title: 'Front Facade',
    });

    const res = await PATCH(
      makeRequest('http://localhost:3000/api/projects/test/renders/render-1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Front Facade' }),
      }),
      { params: { slug: 'test', id: 'render-1' } }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockPrisma.projectRender.update).toHaveBeenCalledWith({
      where: { id: 'render-1' },
      data: expect.objectContaining({ title: 'Front Facade' }),
    });
  });

  it('updates isFavorite', async () => {
    mockPrisma.projectRender.findUnique.mockResolvedValue(TEST_RENDER);
    mockPrisma.projectRender.update.mockResolvedValue({
      ...TEST_RENDER,
      isFavorite: true,
    });

    const res = await PATCH(
      makeRequest('http://localhost:3000/api/projects/test/renders/render-1', {
        method: 'PATCH',
        body: JSON.stringify({ isFavorite: true }),
      }),
      { params: { slug: 'test', id: 'render-1' } }
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.projectRender.update).toHaveBeenCalledWith({
      where: { id: 'render-1' },
      data: expect.objectContaining({ isFavorite: true }),
    });
  });

  it('updates tags', async () => {
    mockPrisma.projectRender.findUnique.mockResolvedValue(TEST_RENDER);
    mockPrisma.projectRender.update.mockResolvedValue({
      ...TEST_RENDER,
      tags: ['front', 'client-presentation'],
    });

    const res = await PATCH(
      makeRequest('http://localhost:3000/api/projects/test/renders/render-1', {
        method: 'PATCH',
        body: JSON.stringify({ tags: ['front', 'client-presentation'] }),
      }),
      { params: { slug: 'test', id: 'render-1' } }
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.projectRender.update).toHaveBeenCalledWith({
      where: { id: 'render-1' },
      data: expect.objectContaining({ tags: ['front', 'client-presentation'] }),
    });
  });

  it('returns 404 when render not found', async () => {
    mockPrisma.projectRender.findUnique.mockResolvedValue(null);
    const res = await PATCH(
      makeRequest('http://localhost:3000/api/projects/test/renders/render-1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'test' }),
      }),
      { params: { slug: 'test', id: 'render-1' } }
    );
    expect(res.status).toBe(404);
  });
});

// ── DELETE /renders/[id] ────────────────────────────────────────────────

describe('DELETE /api/projects/[slug]/renders/[id]', () => {
  let DELETE: Function;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/app/api/projects/[slug]/renders/[id]/route');
    DELETE = mod.DELETE;
  });

  it('deletes render and cleans up R2 files', async () => {
    mockPrisma.projectRender.findUnique.mockResolvedValue({
      ...TEST_RENDER,
      imageKey: 'renders/proj-1/render-1.png',
      thumbnailKey: 'renders/proj-1/render-1-thumb.png',
    });
    mockPrisma.projectRender.delete.mockResolvedValue(TEST_RENDER);

    const res = await DELETE(
      makeRequest('http://localhost:3000/api/projects/test/renders/render-1', {
        method: 'DELETE',
      }),
      { params: { slug: 'test', id: 'render-1' } }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDeleteFile).toHaveBeenCalledWith('renders/proj-1/render-1.png');
    expect(mockDeleteFile).toHaveBeenCalledWith('renders/proj-1/render-1-thumb.png');
    expect(mockPrisma.projectRender.delete).toHaveBeenCalledWith({
      where: { id: 'render-1' },
    });
  });

  it('skips R2 cleanup when no image keys', async () => {
    mockPrisma.projectRender.findUnique.mockResolvedValue(TEST_RENDER);
    mockPrisma.projectRender.delete.mockResolvedValue(TEST_RENDER);

    const res = await DELETE(
      makeRequest('http://localhost:3000/api/projects/test/renders/render-1', {
        method: 'DELETE',
      }),
      { params: { slug: 'test', id: 'render-1' } }
    );

    expect(res.status).toBe(200);
    expect(mockDeleteFile).not.toHaveBeenCalled();
  });

  it('returns 403 when user is not creator or owner', async () => {
    setupAuth({ id: 'other-user', role: 'user' });
    setupProject({
      ...TEST_PROJECT,
      ownerId: 'owner-user',
      // @ts-expect-error strictNullChecks migration
      ProjectMember: [{ userId: 'other-user' }],
    });
    mockPrisma.projectRender.findUnique.mockResolvedValue({
      ...TEST_RENDER,
      createdBy: 'user-1',
    });

    const res = await DELETE(
      makeRequest('http://localhost:3000/api/projects/test/renders/render-1', {
        method: 'DELETE',
      }),
      { params: { slug: 'test', id: 'render-1' } }
    );
    expect(res.status).toBe(403);
  });

  it('allows project owner to delete any render', async () => {
    setupAuth({ id: 'owner-user', role: 'user' });
    setupProject({ ...TEST_PROJECT, ownerId: 'owner-user' });
    mockPrisma.projectRender.findUnique.mockResolvedValue({
      ...TEST_RENDER,
      createdBy: 'other-user',
    });
    mockPrisma.projectRender.delete.mockResolvedValue(TEST_RENDER);

    const res = await DELETE(
      makeRequest('http://localhost:3000/api/projects/test/renders/render-1', {
        method: 'DELETE',
      }),
      { params: { slug: 'test', id: 'render-1' } }
    );
    expect(res.status).toBe(200);
  });
});

// ── POST /renders/[id]/generate ─────────────────────────────────────────

describe('POST /api/projects/[slug]/renders/[id]/generate', () => {
  let POST: Function;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/app/api/projects/[slug]/renders/[id]/generate/route');
    POST = mod.POST;
  });

  it('returns 401 when not authenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/renders/render-1/generate', {
        method: 'POST',
      }),
      { params: { slug: 'test', id: 'render-1' } }
    );
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    setupRateLimit(false);
    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/renders/render-1/generate', {
        method: 'POST',
      }),
      { params: { slug: 'test', id: 'render-1' } }
    );
    expect(res.status).toBe(429);
  });

  it('returns 409 when already generating (double-click prevention)', async () => {
    mockPrisma.projectRender.findUnique.mockResolvedValue({
      ...TEST_RENDER,
      status: 'generating',
    });

    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/renders/render-1/generate', {
        method: 'POST',
      }),
      { params: { slug: 'test', id: 'render-1' } }
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain('already in progress');
  });

  it('returns dedup warning when duplicate prompt exists', async () => {
    mockPrisma.projectRender.findUnique.mockResolvedValue(TEST_RENDER);
    mockPrisma.projectRender.findFirst.mockResolvedValue({ id: 'render-existing' });

    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/renders/render-1/generate', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      { params: { slug: 'test', id: 'render-1' } }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.warning).toBe('duplicate');
    expect(data.existingRenderId).toBe('render-existing');
  });

  it('proceeds with generation when force=true despite duplicate', async () => {
    mockPrisma.projectRender.findUnique.mockResolvedValue(TEST_RENDER);
    mockPrisma.projectRender.findFirst.mockResolvedValue({ id: 'render-existing' });
    mockPrisma.projectRender.update.mockResolvedValue({
      ...TEST_RENDER,
      status: 'completed',
    });
    mockGenerateImage.mockResolvedValue({
      success: true,
      provider: 'gpt-image-1.5',
      imageBase64: Buffer.from('fake-png').toString('base64'),
      durationMs: 5000,
      estimatedCostUsd: 0.04,
      attempts: 1,
    });
    mockUploadFile.mockResolvedValue('renders/proj-1/render-1.png');

    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/renders/render-1/generate', {
        method: 'POST',
        body: JSON.stringify({ force: true }),
      }),
      { params: { slug: 'test', id: 'render-1' } }
    );

    expect(res.status).toBe(200);
    expect(mockGenerateImage).toHaveBeenCalled();
  });

  it('handles generation failure and sets status to failed', async () => {
    mockPrisma.projectRender.findUnique.mockResolvedValue(TEST_RENDER);
    mockPrisma.projectRender.findFirst.mockResolvedValue(null);
    mockPrisma.projectRender.update.mockResolvedValue({
      ...TEST_RENDER,
      status: 'failed',
      errorMessage: 'Provider unavailable',
    });
    mockGenerateImage.mockResolvedValue({
      success: false,
      provider: 'gpt-image-1.5',
      error: 'Provider unavailable',
      errorCode: 'api_error',
      durationMs: 1000,
      estimatedCostUsd: 0,
      attempts: 3,
    });

    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/renders/render-1/generate', {
        method: 'POST',
      }),
      { params: { slug: 'test', id: 'render-1' } }
    );

    expect(res.status).toBe(502);
    // Second update call sets status to failed
    const updateCalls = mockPrisma.projectRender.update.mock.calls;
    const failCall = updateCalls.find(
      (c: any) => c[0].data.status === 'failed'
    );
    expect(failCall).toBeDefined();
  });

  it('returns 404 when render not found', async () => {
    mockPrisma.projectRender.findUnique.mockResolvedValue(null);
    const res = await POST(
      makeRequest('http://localhost:3000/api/projects/test/renders/render-1/generate', {
        method: 'POST',
      }),
      { params: { slug: 'test', id: 'render-1' } }
    );
    expect(res.status).toBe(404);
  });
});

// ── GET /renders/[id]/download ──────────────────────────────────────────

describe('GET /api/projects/[slug]/renders/[id]/download', () => {
  let GET: Function;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/app/api/projects/[slug]/renders/[id]/download/route');
    GET = mod.GET;
  });

  it('returns 401 when not authenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/renders/render-1/download'),
      { params: { slug: 'test', id: 'render-1' } }
    );
    expect(res.status).toBe(401);
  });

  it('returns image with download headers', async () => {
    mockPrisma.projectRender.findUnique.mockResolvedValue({
      ...TEST_RENDER,
      imageKey: 'renders/proj-1/render-1.png',
      title: 'Front View',
    });
    const fakeImage = Buffer.from('fake-png-data');
    mockDownloadFile.mockResolvedValue(fakeImage);

    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/renders/render-1/download'),
      { params: { slug: 'test', id: 'render-1' } }
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
    expect(res.headers.get('Content-Disposition')).toContain('Front_View.png');
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=3600');
  });

  it('returns 404 when image not yet generated', async () => {
    mockPrisma.projectRender.findUnique.mockResolvedValue({
      ...TEST_RENDER,
      imageKey: null,
    });
    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/renders/render-1/download'),
      { params: { slug: 'test', id: 'render-1' } }
    );
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain('not yet generated');
  });

  it('uses render id for filename when no title', async () => {
    mockPrisma.projectRender.findUnique.mockResolvedValue({
      ...TEST_RENDER,
      imageKey: 'renders/proj-1/render-1.png',
      title: null,
    });
    mockDownloadFile.mockResolvedValue(Buffer.from('png'));

    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/renders/render-1/download'),
      { params: { slug: 'test', id: 'render-1' } }
    );

    expect(res.headers.get('Content-Disposition')).toContain('render-render-1.png');
  });
});

// ── GET /renders/context ────────────────────────────────────────────────

describe('GET /api/projects/[slug]/renders/context', () => {
  let GET: Function;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/app/api/projects/[slug]/renders/context/route');
    GET = mod.GET;
  });

  it('returns 401 when not authenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/renders/context?viewType=exterior'),
      { params: { slug: 'test' } }
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when viewType is missing', async () => {
    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/renders/context'),
      { params: { slug: 'test' } }
    );
    expect(res.status).toBe(400);
  });

  it('returns exterior context data', async () => {
    mockGatherExterior.mockResolvedValue({ architecturalStyle: 'Modern' });
    mockCompleteness.mockResolvedValue({ score: 50, items: [] });
    mockPrisma.room.findMany.mockResolvedValue([
      { id: 'room-1', name: 'Lobby', type: 'lobby', floorNumber: 1, area: 500 },
    ]);

    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/renders/context?viewType=exterior'),
      { params: { slug: 'test' } }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.dataSnapshot).toEqual({ architecturalStyle: 'Modern' });
    expect(data.dataCompleteness).toBeDefined();
    expect(data.rooms).toHaveLength(1);
    expect(mockGatherExterior).toHaveBeenCalledWith('proj-1');
  });

  it('gathers room data for interior viewType', async () => {
    mockGatherRoom.mockResolvedValue({ roomName: 'Office 101' });
    mockCompleteness.mockResolvedValue({ score: 70, items: [] });
    mockPrisma.room.findMany.mockResolvedValue([]);

    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/renders/context?viewType=interior&roomId=room-1'),
      { params: { slug: 'test' } }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockGatherRoom).toHaveBeenCalledWith('proj-1', 'room-1');
    expect(data.dataSnapshot).toEqual({ roomName: 'Office 101' });
  });

  it('gathers aerial data for aerial_site viewType', async () => {
    mockGatherAerial.mockResolvedValue({ totalBuildingArea: 25000 });
    mockCompleteness.mockResolvedValue({ score: 40, items: [] });
    mockPrisma.room.findMany.mockResolvedValue([]);

    const res = await GET(
      makeRequest('http://localhost:3000/api/projects/test/renders/context?viewType=aerial_site'),
      { params: { slug: 'test' } }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockGatherAerial).toHaveBeenCalledWith('proj-1');
    expect(data.dataSnapshot).toEqual({ totalBuildingArea: 25000 });
  });
});
