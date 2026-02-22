import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Hoisted mocks
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  markupToolPreset: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
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

const mockPreset = {
  id: 'preset-1',
  userId: 'user-123',
  name: 'Red Rectangle',
  shapeType: 'rectangle',
  style: {
    color: '#FF0000',
    strokeWidth: 2,
    opacity: 1,
    lineStyle: 'solid',
  },
  createdAt: new Date('2024-01-15T10:00:00Z'),
  updatedAt: new Date('2024-01-15T10:00:00Z'),
};

describe('GET /api/markup/tool-presets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
  });

  it('should return 401 if no session', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import('@/app/api/markup/tool-presets/route');
    const request = new NextRequest('http://localhost/api/markup/tool-presets');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return user presets ordered by createdAt desc', async () => {
    mockPrisma.markupToolPreset.findMany.mockResolvedValue([
      mockPreset,
      { ...mockPreset, id: 'preset-2', name: 'Blue Arrow' },
    ]);

    const { GET } = await import('@/app/api/markup/tool-presets/route');
    const request = new NextRequest('http://localhost/api/markup/tool-presets');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.presets).toHaveLength(2);
    expect(mockPrisma.markupToolPreset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('should use session user id path and not require a user lookup', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.markupToolPreset.findMany.mockResolvedValue([]);

    const { GET } = await import('@/app/api/markup/tool-presets/route');
    const request = new NextRequest('http://localhost/api/markup/tool-presets');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.presets).toEqual([]);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.markupToolPreset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-123' },
      })
    );
  });

  it('should handle rate limit exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false });

    const { GET } = await import('@/app/api/markup/tool-presets/route');
    const request = new NextRequest('http://localhost/api/markup/tool-presets');
    const response = await GET(request);

    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.error).toBe('Rate limit exceeded');
  });
});

describe('POST /api/markup/tool-presets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.markupToolPreset.findFirst.mockResolvedValue(null);
    mockPrisma.markupToolPreset.create.mockResolvedValue(mockPreset);
  });

  it('should create preset with name, shapeType, style', async () => {
    const { POST } = await import('@/app/api/markup/tool-presets/route');
    const request = new NextRequest('http://localhost/api/markup/tool-presets', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Red Rectangle',
        shapeType: 'rectangle',
        style: {
          color: '#FF0000',
          strokeWidth: 2,
          opacity: 1,
          lineStyle: 'solid',
        },
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.preset.name).toBe('Red Rectangle');
    expect(mockPrisma.markupToolPreset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Red Rectangle',
          shapeType: 'rectangle',
          style: {
            color: '#FF0000',
            strokeWidth: 2,
            opacity: 1,
            lineStyle: 'solid',
          },
        }),
      })
    );
  });

  it('should return 409 for duplicate name per user', async () => {
    mockPrisma.markupToolPreset.findFirst.mockResolvedValue(mockPreset);

    const { POST } = await import('@/app/api/markup/tool-presets/route');
    const request = new NextRequest('http://localhost/api/markup/tool-presets', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Red Rectangle',
        shapeType: 'rectangle',
        style: { color: '#FF0000' },
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toContain('already exists');
  });

  it('should return 400 for missing name', async () => {
    const { POST } = await import('@/app/api/markup/tool-presets/route');
    const request = new NextRequest('http://localhost/api/markup/tool-presets', {
      method: 'POST',
      body: JSON.stringify({
        shapeType: 'rectangle',
        style: { color: '#FF0000' },
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Name is required');
  });

  it('should return 400 for missing shapeType', async () => {
    const { POST } = await import('@/app/api/markup/tool-presets/route');
    const request = new NextRequest('http://localhost/api/markup/tool-presets', {
      method: 'POST',
      body: JSON.stringify({
        name: 'My Preset',
        style: { color: '#FF0000' },
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('shapeType is required');
  });

  it('should return 400 for missing style', async () => {
    const { POST } = await import('@/app/api/markup/tool-presets/route');
    const request = new NextRequest('http://localhost/api/markup/tool-presets', {
      method: 'POST',
      body: JSON.stringify({
        name: 'My Preset',
        shapeType: 'rectangle',
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Style is required');
  });

  it('should return 400 for non-object style', async () => {
    const { POST } = await import('@/app/api/markup/tool-presets/route');
    const request = new NextRequest('http://localhost/api/markup/tool-presets', {
      method: 'POST',
      body: JSON.stringify({
        name: 'My Preset',
        shapeType: 'rectangle',
        style: 'invalid',
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Style is required');
  });

  it('should trim name before uniqueness check', async () => {
    mockPrisma.markupToolPreset.findFirst.mockResolvedValue(null);

    const { POST } = await import('@/app/api/markup/tool-presets/route');
    const request = new NextRequest('http://localhost/api/markup/tool-presets', {
      method: 'POST',
      body: JSON.stringify({
        name: '  Trimmed Preset  ',
        shapeType: 'ellipse',
        style: { color: '#00FF00' },
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mockPrisma.markupToolPreset.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: 'Trimmed Preset',
        }),
      })
    );
  });
});

describe('PATCH /api/markup/tool-presets/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.markupToolPreset.findFirst.mockResolvedValue(mockPreset);
    mockPrisma.markupToolPreset.update.mockResolvedValue({ ...mockPreset, name: 'Updated Name' });
  });

  it('should update preset name', async () => {
    const { PATCH } = await import('@/app/api/markup/tool-presets/[id]/route');
    const request = new NextRequest('http://localhost/api/markup/tool-presets/preset-1', {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'Updated Name',
      }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'preset-1' }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.preset.name).toBe('Updated Name');
    expect(mockPrisma.markupToolPreset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'preset-1' },
        data: expect.objectContaining({
          name: 'Updated Name',
        }),
      })
    );
  });

  it('should update preset style', async () => {
    const { PATCH } = await import('@/app/api/markup/tool-presets/[id]/route');
    const request = new NextRequest('http://localhost/api/markup/tool-presets/preset-1', {
      method: 'PATCH',
      body: JSON.stringify({
        style: {
          color: '#0000FF',
          strokeWidth: 3,
        },
      }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'preset-1' }) });

    expect(response.status).toBe(200);
    expect(mockPrisma.markupToolPreset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          style: {
            color: '#0000FF',
            strokeWidth: 3,
          },
        }),
      })
    );
  });

  it('should return 404 for nonexistent preset', async () => {
    mockPrisma.markupToolPreset.findFirst.mockResolvedValue(null);

    const { PATCH } = await import('@/app/api/markup/tool-presets/[id]/route');
    const request = new NextRequest('http://localhost/api/markup/tool-presets/invalid', {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'Updated',
      }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'invalid' }) });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Preset not found');
  });

  it('should return 404 when preset belongs to different user', async () => {
    mockPrisma.markupToolPreset.findFirst.mockResolvedValue(null);

    const { PATCH } = await import('@/app/api/markup/tool-presets/[id]/route');
    const request = new NextRequest('http://localhost/api/markup/tool-presets/preset-1', {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'Hacked',
      }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'preset-1' }) });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Preset not found');
  });
});

describe('DELETE /api/markup/tool-presets/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.markupToolPreset.findFirst.mockResolvedValue(mockPreset);
    mockPrisma.markupToolPreset.delete.mockResolvedValue(mockPreset);
  });

  it('should delete preset', async () => {
    const { DELETE } = await import('@/app/api/markup/tool-presets/[id]/route');
    const request = new NextRequest('http://localhost/api/markup/tool-presets/preset-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'preset-1' }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(mockPrisma.markupToolPreset.delete).toHaveBeenCalledWith({
      where: { id: 'preset-1' },
    });
  });

  it('should return 404 for nonexistent preset', async () => {
    mockPrisma.markupToolPreset.findFirst.mockResolvedValue(null);

    const { DELETE } = await import('@/app/api/markup/tool-presets/[id]/route');
    const request = new NextRequest('http://localhost/api/markup/tool-presets/invalid', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'invalid' }) });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Preset not found');
  });

  it('should return 404 when preset belongs to different user', async () => {
    mockPrisma.markupToolPreset.findFirst.mockResolvedValue(null);

    const { DELETE } = await import('@/app/api/markup/tool-presets/[id]/route');
    const request = new NextRequest('http://localhost/api/markup/tool-presets/preset-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'preset-1' }) });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Preset not found');
  });

  it('should handle rate limit exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false });

    const { DELETE } = await import('@/app/api/markup/tool-presets/[id]/route');
    const request = new NextRequest('http://localhost/api/markup/tool-presets/preset-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'preset-1' }) });

    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.error).toBe('Rate limit exceeded');
  });

  it('should handle database errors gracefully', async () => {
    mockPrisma.markupToolPreset.delete.mockRejectedValue(new Error('Database error'));

    const { DELETE } = await import('@/app/api/markup/tool-presets/[id]/route');
    const request = new NextRequest('http://localhost/api/markup/tool-presets/preset-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'preset-1' }) });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal server error');
  });
});
