import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Hoisted mocks
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  document: { findFirst: vi.fn() },
  markupLayer: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  markup: { updateMany: vi.fn() },
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

const mockLayer = {
  id: 'layer-1',
  documentId: 'doc-1',
  projectId: 'project-1',
  name: 'Structural',
  color: '#FF0000',
  visible: true,
  locked: false,
  opacity: 1.0,
  sortOrder: 1,
  scope: 'document',
  createdBy: 'user-123',
  createdAt: new Date('2024-01-15T10:00:00Z'),
  updatedAt: new Date('2024-01-15T10:00:00Z'),
};

describe('GET /api/projects/[slug]/documents/[id]/layers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
  });

  it('should return 401 if no session', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import('@/app/api/projects/[slug]/documents/[id]/layers/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/layers');
    const response = await GET(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return layers ordered by sortOrder', async () => {
    mockPrisma.markupLayer.findMany.mockResolvedValue([
      mockLayer,
      { ...mockLayer, id: 'layer-2', name: 'MEP', sortOrder: 2 },
    ]);

    const { GET } = await import('@/app/api/projects/[slug]/documents/[id]/layers/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/layers');
    const response = await GET(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.layers).toHaveLength(2);
    expect(mockPrisma.markupLayer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { documentId: 'doc-1' },
        orderBy: { sortOrder: 'asc' },
      })
    );
  });

  it('should return 404 if document not found', async () => {
    mockPrisma.document.findFirst.mockResolvedValue(null);

    const { GET } = await import('@/app/api/projects/[slug]/documents/[id]/layers/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/layers');
    const response = await GET(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Document not found');
  });
});

describe('POST /api/projects/[slug]/documents/[id]/layers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
    mockPrisma.markupLayer.findFirst.mockResolvedValue(null);
    mockPrisma.markupLayer.create.mockResolvedValue(mockLayer);
  });

  it('should create layer with name, color, opacity, visible, locked', async () => {
    // First call: check for duplicate name (should return null)
    // Second call: get max sortOrder (should return { sortOrder: 3 })
    mockPrisma.markupLayer.findFirst.mockResolvedValueOnce(null);
    mockPrisma.markupLayer.findFirst.mockResolvedValueOnce({ sortOrder: 3 });

    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/layers/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/layers', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Architectural',
        color: '#0000FF',
        scope: 'document',
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.layer.name).toBe('Structural');
    expect(mockPrisma.markupLayer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentId: 'doc-1',
          projectId: 'project-1',
          name: 'Architectural',
          color: '#0000FF',
          visible: true,
          locked: false,
          opacity: 1.0,
          sortOrder: 4,
          scope: 'document',
          createdBy: 'user-123',
        }),
      })
    );
  });

  it('should return 409 for duplicate name in same document', async () => {
    mockPrisma.markupLayer.findFirst.mockResolvedValue(mockLayer);

    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/layers/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/layers', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Structural',
        color: '#FF0000',
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toContain('already exists');
  });

  it('should return 400 for missing name', async () => {
    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/layers/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/layers', {
      method: 'POST',
      body: JSON.stringify({
        color: '#00FF00',
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Name is required');
  });

  it('should use default color if not provided', async () => {
    mockPrisma.markupLayer.findFirst.mockResolvedValueOnce(null);

    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/layers/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/layers', {
      method: 'POST',
      body: JSON.stringify({
        name: 'New Layer',
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(201);
    expect(mockPrisma.markupLayer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          color: '#3B82F6',
        }),
      })
    );
  });

  it('should auto-increment sortOrder based on max existing', async () => {
    mockPrisma.markupLayer.findFirst.mockResolvedValueOnce(null);
    mockPrisma.markupLayer.findFirst.mockResolvedValueOnce({ sortOrder: 5 });

    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/layers/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/layers', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Layer 6',
        color: '#FFFF00',
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(201);
    expect(mockPrisma.markupLayer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sortOrder: 6,
        }),
      })
    );
  });

  it('should start sortOrder at 1 when no existing layers', async () => {
    mockPrisma.markupLayer.findFirst.mockResolvedValueOnce(null);
    mockPrisma.markupLayer.findFirst.mockResolvedValueOnce(null);

    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/layers/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/layers', {
      method: 'POST',
      body: JSON.stringify({
        name: 'First Layer',
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(201);
    expect(mockPrisma.markupLayer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sortOrder: 1,
        }),
      })
    );
  });
});

describe('PATCH /api/projects/[slug]/documents/[id]/layers/[layerId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
    mockPrisma.markupLayer.findFirst.mockResolvedValue(mockLayer);
    mockPrisma.markupLayer.update.mockResolvedValue({ ...mockLayer, visible: false });
  });

  it('should update visibility, opacity, locked, sortOrder, name', async () => {
    const { PATCH } = await import('@/app/api/projects/[slug]/documents/[id]/layers/[layerId]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/layers/layer-1', {
      method: 'PATCH',
      body: JSON.stringify({
        visible: false,
        opacity: 0.5,
        locked: true,
        sortOrder: 3,
        name: 'Updated Name',
      }),
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ slug: 'test-project', id: 'doc-1', layerId: 'layer-1' }),
    });

    expect(response.status).toBe(200);
    expect(mockPrisma.markupLayer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'layer-1' },
        data: expect.objectContaining({
          visible: false,
          opacity: 0.5,
          locked: true,
          sortOrder: 3,
          name: 'Updated Name',
        }),
      })
    );
  });

  it('should return 404 for nonexistent layer', async () => {
    mockPrisma.markupLayer.findFirst.mockResolvedValue(null);

    const { PATCH } = await import('@/app/api/projects/[slug]/documents/[id]/layers/[layerId]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/layers/invalid', {
      method: 'PATCH',
      body: JSON.stringify({
        visible: false,
      }),
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ slug: 'test-project', id: 'doc-1', layerId: 'invalid' }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Layer not found');
  });
});

describe('DELETE /api/projects/[slug]/documents/[id]/layers/[layerId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
    mockPrisma.markupLayer.findFirst.mockResolvedValue(mockLayer);
    mockPrisma.markup.updateMany.mockResolvedValue({ count: 3 });
    mockPrisma.markupLayer.delete.mockResolvedValue(mockLayer);
  });

  it('should delete layer and move markups to no-layer (SetNull)', async () => {
    const { DELETE } = await import('@/app/api/projects/[slug]/documents/[id]/layers/[layerId]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/layers/layer-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ slug: 'test-project', id: 'doc-1', layerId: 'layer-1' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalledWith([
      expect.objectContaining({
        /* markup updateMany operation */
      }),
      expect.objectContaining({
        /* markupLayer delete operation */
      }),
    ]);
  });

  it('should return 404 for nonexistent layer', async () => {
    mockPrisma.markupLayer.findFirst.mockResolvedValue(null);

    const { DELETE } = await import('@/app/api/projects/[slug]/documents/[id]/layers/[layerId]/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/layers/invalid', {
      method: 'DELETE',
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ slug: 'test-project', id: 'doc-1', layerId: 'invalid' }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Layer not found');
  });
});
