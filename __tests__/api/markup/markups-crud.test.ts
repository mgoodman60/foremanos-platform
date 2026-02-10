import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Hoisted mocks
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  document: { findFirst: vi.fn() },
  markup: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  markupReply: { updateMany: vi.fn() },
  $transaction: vi.fn().mockImplementation(async (fn: any) => {
    if (typeof fn === 'function') {
      return fn(mockPrisma);
    }
    // Array of operations
    return Promise.all(fn.map((op: any) => op));
  }),
}));
const mockCheckRateLimit = vi.hoisted(() => vi.fn());

vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }));
vi.mock('@/lib/auth-options', () => ({ authOptions: {} }));
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: mockCheckRateLimit,
  RATE_LIMITS: { API: { max: 60, window: 60000 } },
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock session data
const mockSession = {
  user: {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
  },
};

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
};

const mockDocument = {
  id: 'doc-1',
  projectId: 'project-1',
  name: 'Test Document',
  cloud_storage_path: 'uploads/test.pdf',
};

const mockMarkup = {
  id: 'markup-1',
  documentId: 'doc-1',
  projectId: 'project-1',
  pageNumber: 1,
  shapeType: 'rectangle',
  geometry: { x: 100, y: 200, width: 50, height: 30 },
  style: { color: '#FF0000', strokeWidth: 2, opacity: 1, lineStyle: 'solid' },
  content: 'Test markup',
  label: 'Issue #1',
  status: 'open',
  priority: 'medium',
  tags: ['foundation', 'critical'],
  layerId: null,
  measurementValue: null,
  measurementUnit: null,
  calibrationId: null,
  symbolId: null,
  createdBy: 'user-123',
  lockedBy: null,
  lockedAt: null,
  createdAt: new Date('2024-01-15T10:00:00Z'),
  updatedAt: new Date('2024-01-15T10:00:00Z'),
  deletedAt: null,
  Creator: {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
  },
  Layer: null,
  Replies: [],
};

describe('GET /api/projects/[slug]/documents/[id]/markups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
  });

  it('should return 401 if no session', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import('@/app/api/projects/[slug]/documents/[id]/markups/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups');
    const response = await GET(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 if document not found', async () => {
    mockPrisma.document.findFirst.mockResolvedValue(null);

    const { GET } = await import('@/app/api/projects/[slug]/documents/[id]/markups/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups');
    const response = await GET(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Document not found');
  });

  it('should return markups filtered by pageNumber query param', async () => {
    mockPrisma.markup.findMany.mockResolvedValue([mockMarkup]);

    const { GET } = await import('@/app/api/projects/[slug]/documents/[id]/markups/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups?page=1');
    const response = await GET(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.markups).toHaveLength(1);
    expect(mockPrisma.markup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          documentId: 'doc-1',
          deletedAt: null,
          pageNumber: 1,
        }),
      })
    );
  });

  it('should return all markups when no pageNumber filter', async () => {
    mockPrisma.markup.findMany.mockResolvedValue([mockMarkup]);

    const { GET } = await import('@/app/api/projects/[slug]/documents/[id]/markups/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups');
    const response = await GET(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.markups).toHaveLength(1);
    expect(mockPrisma.markup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          documentId: 'doc-1',
          deletedAt: null,
        },
      })
    );
  });

  it('should include Creator, Layer, Replies relations in response', async () => {
    mockPrisma.markup.findMany.mockResolvedValue([mockMarkup]);

    const { GET } = await import('@/app/api/projects/[slug]/documents/[id]/markups/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups');
    const response = await GET(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(200);
    expect(mockPrisma.markup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          Creator: { select: { id: true, username: true, email: true } },
          Layer: { select: { id: true, name: true, color: true } },
        },
      })
    );
  });
});

describe('POST /api/projects/[slug]/documents/[id]/markups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
    mockPrisma.markup.create.mockResolvedValue(mockMarkup);
  });

  it('should create single markup with geometry, style, shapeType', async () => {
    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/markups/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups', {
      method: 'POST',
      body: JSON.stringify({
        pageNumber: 1,
        shapeType: 'rectangle',
        geometry: { x: 100, y: 200, width: 50, height: 30 },
        style: { color: '#FF0000', strokeWidth: 2, opacity: 1, lineStyle: 'solid' },
        content: 'Test markup',
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.markup.id).toBe('markup-1');
    expect(mockPrisma.markup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentId: 'doc-1',
          projectId: 'project-1',
          pageNumber: 1,
          shapeType: 'rectangle',
          createdBy: 'user-123',
        }),
      })
    );
  });

  it('should create markup with layer assignment', async () => {
    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/markups/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups', {
      method: 'POST',
      body: JSON.stringify({
        pageNumber: 1,
        shapeType: 'text_box',
        geometry: { x: 50, y: 100 },
        style: { color: '#0000FF', strokeWidth: 1, opacity: 1, lineStyle: 'solid' },
        layerId: 'layer-1',
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(201);
    expect(mockPrisma.markup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          layerId: 'layer-1',
        }),
      })
    );
  });

  it('should return created markup with Creator relation', async () => {
    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/markups/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups', {
      method: 'POST',
      body: JSON.stringify({
        pageNumber: 1,
        shapeType: 'ellipse',
        geometry: { x: 100, y: 100, width: 50, height: 50 },
        style: { color: '#00FF00', strokeWidth: 2, opacity: 1, lineStyle: 'solid' },
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.markup.Creator.username).toBe('testuser');
    expect(mockPrisma.markup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          Creator: { select: { id: true, username: true, email: true } },
          Layer: { select: { id: true, name: true, color: true } },
        },
      })
    );
  });

  it('should handle bulk create with markups array', async () => {
    mockPrisma.markup.create.mockResolvedValueOnce(mockMarkup);
    mockPrisma.markup.create.mockResolvedValueOnce({ ...mockMarkup, id: 'markup-2' });

    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/markups/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups', {
      method: 'POST',
      body: JSON.stringify({
        markups: [
          {
            pageNumber: 1,
            shapeType: 'line',
            geometry: { points: [0, 0, 100, 100] },
            style: { color: '#000000', strokeWidth: 1, opacity: 1, lineStyle: 'solid' },
          },
          {
            pageNumber: 2,
            shapeType: 'arrow',
            geometry: { points: [50, 50, 150, 150] },
            style: { color: '#FF0000', strokeWidth: 2, opacity: 1, lineStyle: 'dashed' },
          },
        ],
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.markups).toHaveLength(2);
    expect(mockPrisma.markup.create).toHaveBeenCalledTimes(2);
  });
});

describe('GET /api/projects/[slug]/documents/[id]/markups/[markupId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
  });

  it('should return full markup with Creator, Layer, Replies', async () => {
    mockPrisma.markup.findFirst.mockResolvedValue(mockMarkup);

    const { GET } = await import('@/app/api/projects/[slug]/documents/[id]/markups/[markupId]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups/markup-1');
    const response = await GET(request, {
      params: Promise.resolve({ slug: 'test-project', id: 'doc-1', markupId: 'markup-1' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.markup.id).toBe('markup-1');
    expect(mockPrisma.markup.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          Creator: { select: { id: true, username: true, email: true } },
          Layer: { select: { id: true, name: true, color: true } },
          Replies: expect.objectContaining({
            where: { deletedAt: null },
          }),
        },
      })
    );
  });

  it('should return 404 for nonexistent markup', async () => {
    mockPrisma.markup.findFirst.mockResolvedValue(null);

    const { GET } = await import('@/app/api/projects/[slug]/documents/[id]/markups/[markupId]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups/invalid');
    const response = await GET(request, {
      params: Promise.resolve({ slug: 'test-project', id: 'doc-1', markupId: 'invalid' }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Markup not found');
  });
});

describe('PATCH /api/projects/[slug]/documents/[id]/markups/[markupId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
    mockPrisma.markup.findFirst.mockResolvedValue(mockMarkup);
    mockPrisma.markup.update.mockResolvedValue({ ...mockMarkup, label: 'Updated label' });
  });

  it('should update geometry and style', async () => {
    const { PATCH } = await import('@/app/api/projects/[slug]/documents/[id]/markups/[markupId]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups/markup-1', {
      method: 'PATCH',
      body: JSON.stringify({
        geometry: { x: 150, y: 250, width: 60, height: 40 },
        style: { color: '#00FF00', strokeWidth: 3 },
      }),
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ slug: 'test-project', id: 'doc-1', markupId: 'markup-1' }),
    });

    expect(response.status).toBe(200);
    expect(mockPrisma.markup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'markup-1' },
        data: expect.objectContaining({
          geometry: { x: 150, y: 250, width: 60, height: 40 },
          style: { color: '#00FF00', strokeWidth: 3 },
        }),
      })
    );
  });

  it('should return 409 on optimistic locking conflict', async () => {
    mockPrisma.markup.findFirst.mockResolvedValue({
      ...mockMarkup,
      updatedAt: new Date('2024-01-15T12:00:00Z'),
    });

    const { PATCH } = await import('@/app/api/projects/[slug]/documents/[id]/markups/[markupId]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups/markup-1', {
      method: 'PATCH',
      body: JSON.stringify({
        label: 'Updated',
        expectedUpdatedAt: '2024-01-15T10:00:00Z',
      }),
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ slug: 'test-project', id: 'doc-1', markupId: 'markup-1' }),
    });

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toContain('modified by another user');
  });

  it('should handle lock (lockedBy set)', async () => {
    const { PATCH } = await import('@/app/api/projects/[slug]/documents/[id]/markups/[markupId]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups/markup-1', {
      method: 'PATCH',
      body: JSON.stringify({
        lockedBy: 'user-123',
      }),
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ slug: 'test-project', id: 'doc-1', markupId: 'markup-1' }),
    });

    expect(response.status).toBe(200);
    expect(mockPrisma.markup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lockedBy: 'user-123',
          lockedAt: expect.any(Date),
        }),
      })
    );
  });

  it('should handle unlock (lockedBy clear)', async () => {
    const { PATCH } = await import('@/app/api/projects/[slug]/documents/[id]/markups/[markupId]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups/markup-1', {
      method: 'PATCH',
      body: JSON.stringify({
        lockedBy: null,
      }),
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ slug: 'test-project', id: 'doc-1', markupId: 'markup-1' }),
    });

    expect(response.status).toBe(200);
    expect(mockPrisma.markup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lockedBy: null,
          lockedAt: null,
        }),
      })
    );
  });
});

describe('DELETE /api/projects/[slug]/documents/[id]/markups/[markupId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
    mockPrisma.markup.findFirst.mockResolvedValue(mockMarkup);
    mockPrisma.markup.update.mockResolvedValue({ ...mockMarkup, deletedAt: new Date() });
    mockPrisma.markupReply.updateMany.mockResolvedValue({ count: 2 });
  });

  it('should soft-delete markup (sets deletedAt)', async () => {
    const { DELETE } = await import('@/app/api/projects/[slug]/documents/[id]/markups/[markupId]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups/markup-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ slug: 'test-project', id: 'doc-1', markupId: 'markup-1' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalledWith([
      expect.objectContaining({
        /* markup update operation */
      }),
      expect.objectContaining({
        /* markupReply updateMany operation */
      }),
    ]);
  });

  it('should also soft-delete associated replies in transaction', async () => {
    const { DELETE } = await import('@/app/api/projects/[slug]/documents/[id]/markups/[markupId]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups/markup-1', {
      method: 'DELETE',
    });
    await DELETE(request, {
      params: Promise.resolve({ slug: 'test-project', id: 'doc-1', markupId: 'markup-1' }),
    });

    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('should return 404 for already-deleted markup', async () => {
    mockPrisma.markup.findFirst.mockResolvedValue(null);

    const { DELETE } = await import('@/app/api/projects/[slug]/documents/[id]/markups/[markupId]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups/markup-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ slug: 'test-project', id: 'doc-1', markupId: 'markup-1' }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Markup not found');
  });
});
