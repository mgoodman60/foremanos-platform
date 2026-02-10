import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Hoisted mocks
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  document: { findFirst: vi.fn() },
  markupCalibration: {
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

const mockDocument = {
  id: 'doc-1',
  projectId: 'project-1',
  name: 'Test Document',
  cloud_storage_path: 'uploads/test.pdf',
};

const mockCalibration = {
  id: 'cal-1',
  documentId: 'doc-1',
  projectId: 'project-1',
  pageNumber: 1,
  point1X: 100,
  point1Y: 200,
  point2X: 500,
  point2Y: 200,
  realDistance: 50,
  realUnit: 'feet',
  pdfUnitsPerRealUnit: 8,
  confidence: 1.0,
  createdBy: 'user-123',
  createdAt: new Date('2024-01-15T10:00:00Z'),
};

describe('GET /api/projects/[slug]/documents/[id]/calibrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
  });

  it('should return 401 if no session', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import('@/app/api/projects/[slug]/documents/[id]/calibrations/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/calibrations');
    const response = await GET(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return calibrations ordered by pageNumber', async () => {
    mockPrisma.markupCalibration.findMany.mockResolvedValue([
      mockCalibration,
      { ...mockCalibration, id: 'cal-2', pageNumber: 2 },
    ]);

    const { GET } = await import('@/app/api/projects/[slug]/documents/[id]/calibrations/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/calibrations');
    const response = await GET(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.calibrations).toHaveLength(2);
    expect(mockPrisma.markupCalibration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { documentId: 'doc-1' },
        orderBy: { pageNumber: 'asc' },
      })
    );
  });

  it('should return 404 if document not found', async () => {
    mockPrisma.document.findFirst.mockResolvedValue(null);

    const { GET } = await import('@/app/api/projects/[slug]/documents/[id]/calibrations/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/calibrations');
    const response = await GET(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Document not found');
  });
});

describe('POST /api/projects/[slug]/documents/[id]/calibrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
    mockPrisma.markupCalibration.findFirst.mockResolvedValue(null);
    mockPrisma.markupCalibration.create.mockResolvedValue(mockCalibration);
  });

  it('should create calibration with referencePoint1, referencePoint2, realWorldDistance, unit', async () => {
    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/calibrations/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/calibrations', {
      method: 'POST',
      body: JSON.stringify({
        pageNumber: 1,
        point1X: 100,
        point1Y: 200,
        point2X: 500,
        point2Y: 200,
        realDistance: 50,
        realUnit: 'feet',
        pdfUnitsPerRealUnit: 8,
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.calibration.id).toBe('cal-1');
    expect(mockPrisma.markupCalibration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentId: 'doc-1',
          projectId: 'project-1',
          pageNumber: 1,
          point1X: 100,
          point1Y: 200,
          point2X: 500,
          point2Y: 200,
          realDistance: 50,
          realUnit: 'feet',
          pdfUnitsPerRealUnit: 8,
          createdBy: 'user-123',
        }),
      })
    );
  });

  it('should upsert when same documentId + pageNumber exists', async () => {
    mockPrisma.markupCalibration.findFirst.mockResolvedValue(mockCalibration);
    mockPrisma.markupCalibration.update.mockResolvedValue({ ...mockCalibration, realDistance: 60 });

    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/calibrations/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/calibrations', {
      method: 'POST',
      body: JSON.stringify({
        pageNumber: 1,
        point1X: 150,
        point1Y: 250,
        point2X: 550,
        point2Y: 250,
        realDistance: 60,
        realUnit: 'feet',
        pdfUnitsPerRealUnit: 6.67,
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.calibration.realDistance).toBe(60);
    expect(mockPrisma.markupCalibration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cal-1' },
        data: expect.objectContaining({
          point1X: 150,
          point1Y: 250,
          point2X: 550,
          point2Y: 250,
          realDistance: 60,
          realUnit: 'feet',
          pdfUnitsPerRealUnit: 6.67,
        }),
      })
    );
  });

  it('should return 400 for missing required fields', async () => {
    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/calibrations/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/calibrations', {
      method: 'POST',
      body: JSON.stringify({
        pageNumber: 1,
        point1X: 100,
        // Missing other required fields
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Missing required fields');
  });

  it('should use default confidence 1.0 if not provided', async () => {
    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/calibrations/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/calibrations', {
      method: 'POST',
      body: JSON.stringify({
        pageNumber: 1,
        point1X: 100,
        point1Y: 200,
        point2X: 500,
        point2Y: 200,
        realDistance: 50,
        realUnit: 'feet',
        pdfUnitsPerRealUnit: 8,
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(201);
    expect(mockPrisma.markupCalibration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          confidence: 1.0,
        }),
      })
    );
  });

  it('should store custom confidence value', async () => {
    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/calibrations/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/calibrations', {
      method: 'POST',
      body: JSON.stringify({
        pageNumber: 1,
        point1X: 100,
        point1Y: 200,
        point2X: 500,
        point2Y: 200,
        realDistance: 50,
        realUnit: 'feet',
        pdfUnitsPerRealUnit: 8,
        confidence: 0.85,
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(201);
    expect(mockPrisma.markupCalibration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          confidence: 0.85,
        }),
      })
    );
  });

  it('should validate pdfUnitsPerRealUnit is provided', async () => {
    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/calibrations/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/calibrations', {
      method: 'POST',
      body: JSON.stringify({
        pageNumber: 1,
        point1X: 100,
        point1Y: 200,
        point2X: 500,
        point2Y: 200,
        realDistance: 50,
        realUnit: 'feet',
        // Missing pdfUnitsPerRealUnit
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Missing required fields');
  });
});

describe('Calibration deletion edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
  });

  it('should handle rate limit exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false });

    const { GET } = await import('@/app/api/projects/[slug]/documents/[id]/calibrations/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/calibrations');
    const response = await GET(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.error).toBe('Rate limit exceeded');
  });

  it('should handle database errors gracefully', async () => {
    mockPrisma.markupCalibration.findMany.mockRejectedValue(new Error('Database error'));

    const { GET } = await import('@/app/api/projects/[slug]/documents/[id]/calibrations/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/calibrations');
    const response = await GET(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal server error');
  });
});
