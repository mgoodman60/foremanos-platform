import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Hoisted mocks
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  document: { findFirst: vi.fn() },
  markup: { findMany: vi.fn() },
}));
const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockDownloadFile = vi.hoisted(() => vi.fn());
const mockPDFDocument = vi.hoisted(() => ({
  load: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }));
vi.mock('@/lib/auth-options', () => ({ authOptions: {} }));
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: mockCheckRateLimit,
  RATE_LIMITS: { API: { max: 60, window: 60000 } },
}));
vi.mock('@/lib/s3', () => ({
  downloadFile: mockDownloadFile,
}));
vi.mock('pdf-lib', () => ({
  PDFDocument: mockPDFDocument,
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
  pageNumber: 1,
  shapeType: 'rectangle',
  label: 'Issue #1',
  status: 'open',
  priority: 'high',
  tags: ['foundation', 'critical'],
  measurementValue: 25.5,
  measurementUnit: 'feet',
  geometry: { x: 100, y: 200, width: 50, height: 30 },
  createdAt: new Date('2024-01-15T10:00:00Z'),
  Creator: { username: 'testuser' },
  Layer: { name: 'Structural', color: '#FF0000' },
  Replies: [
    { id: 'reply-1', content: 'First comment', Creator: { username: 'reviewer' } },
    { id: 'reply-2', content: 'Second comment', Creator: { username: 'testuser' } },
  ],
};

describe('POST /api/projects/[slug]/documents/[id]/markups/export (CSV)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
  });

  it('should return CSV with headers (Page, Type, Label, Status, Priority, Tags, Layer, Created By, Created At)', async () => {
    mockPrisma.markup.findMany.mockResolvedValue([mockMarkup]);

    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/markups/export/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups/export', {
      method: 'POST',
      body: JSON.stringify({
        format: 'csv',
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/csv');
    const csv = await response.text();
    expect(csv).toContain('Page,Type,Label,Status,Priority,Tags,Layer,Created By,Created At');
    expect(csv).toContain('1,rectangle,"Issue #1",open,high,"foundation, critical","Structural","testuser"');
  });

  it('should add Measurement Value, Measurement Unit columns when includeMeasurements=true', async () => {
    mockPrisma.markup.findMany.mockResolvedValue([mockMarkup]);

    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/markups/export/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups/export', {
      method: 'POST',
      body: JSON.stringify({
        format: 'csv',
        includeMeasurements: true,
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(200);
    const csv = await response.text();
    expect(csv).toContain('Measurement Value,Measurement Unit');
    expect(csv).toContain('25.5,feet');
  });

  it('should add Comments Count column when includeComments=true', async () => {
    mockPrisma.markup.findMany.mockResolvedValue([mockMarkup]);

    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/markups/export/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups/export', {
      method: 'POST',
      body: JSON.stringify({
        format: 'csv',
        includeComments: true,
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(200);
    const csv = await response.text();
    expect(csv).toContain('Comments Count');
    expect(csv).toContain(',2'); // 2 replies
  });

  it('should handle markups with null layer (Default)', async () => {
    mockPrisma.markup.findMany.mockResolvedValue([
      { ...mockMarkup, Layer: null },
    ]);

    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/markups/export/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups/export', {
      method: 'POST',
      body: JSON.stringify({
        format: 'csv',
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(200);
    const csv = await response.text();
    expect(csv).toContain('"Default"');
  });

  it('should handle empty tags array', async () => {
    mockPrisma.markup.findMany.mockResolvedValue([
      { ...mockMarkup, tags: [] },
    ]);

    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/markups/export/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups/export', {
      method: 'POST',
      body: JSON.stringify({
        format: 'csv',
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(200);
    const csv = await response.text();
    expect(csv).toContain('""'); // Empty tags
  });
});

describe('POST /api/projects/[slug]/documents/[id]/markups/export (PDF)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.document.findFirst.mockResolvedValue(mockDocument);

    const mockPage = {
      getSize: vi.fn().mockReturnValue({ width: 612, height: 792 }),
      drawText: vi.fn(),
    };
    const mockPdfDoc = {
      getPages: vi.fn().mockReturnValue([mockPage]),
      save: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    };
    mockPDFDocument.load.mockResolvedValue(mockPdfDoc);
    mockDownloadFile.mockResolvedValue(Buffer.from([1, 2, 3, 4]));
  });

  it('should call downloadFile and return application/pdf content-type', async () => {
    mockPrisma.markup.findMany.mockResolvedValue([mockMarkup]);

    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/markups/export/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups/export', {
      method: 'POST',
      body: JSON.stringify({
        format: 'pdf',
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(mockDownloadFile).toHaveBeenCalledWith('uploads/test.pdf');
    expect(mockPDFDocument.load).toHaveBeenCalled();
  });

  it('should return 404 when document has no storage path', async () => {
    mockPrisma.document.findFirst.mockResolvedValue({
      ...mockDocument,
      cloud_storage_path: null,
    });
    mockPrisma.markup.findMany.mockResolvedValue([mockMarkup]);

    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/markups/export/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups/export', {
      method: 'POST',
      body: JSON.stringify({
        format: 'pdf',
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Document file not found');
  });

  it('should render text_box markups on PDF pages', async () => {
    const textMarkup = {
      ...mockMarkup,
      shapeType: 'text_box',
      content: 'Test annotation',
      geometry: { x: 100, y: 200 },
    };
    mockPrisma.markup.findMany.mockResolvedValue([textMarkup]);

    const mockPage = {
      getSize: vi.fn().mockReturnValue({ width: 612, height: 792 }),
      drawText: vi.fn(),
    };
    const mockPdfDoc = {
      getPages: vi.fn().mockReturnValue([mockPage]),
      save: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    };
    mockPDFDocument.load.mockResolvedValue(mockPdfDoc);

    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/markups/export/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups/export', {
      method: 'POST',
      body: JSON.stringify({
        format: 'pdf',
      }),
    });
    await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(mockPage.drawText).toHaveBeenCalledWith(
      'Test annotation',
      expect.objectContaining({
        x: 100,
        y: expect.any(Number),
        size: 12,
      })
    );
  });

  it('should skip markups without matching page number', async () => {
    const markup2 = {
      ...mockMarkup,
      pageNumber: 10,
      shapeType: 'text_box',
      content: 'Out of bounds',
    };
    mockPrisma.markup.findMany.mockResolvedValue([mockMarkup, markup2]);

    const mockPage = {
      getSize: vi.fn().mockReturnValue({ width: 612, height: 792 }),
      drawText: vi.fn(),
    };
    const mockPdfDoc = {
      getPages: vi.fn().mockReturnValue([mockPage]),
      save: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    };
    mockPDFDocument.load.mockResolvedValue(mockPdfDoc);

    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/markups/export/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups/export', {
      method: 'POST',
      body: JSON.stringify({
        format: 'pdf',
      }),
    });
    await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(mockPage.drawText).not.toHaveBeenCalledWith('Out of bounds', expect.anything());
  });
});

describe('POST /api/projects/[slug]/documents/[id]/markups/export (validation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
  });

  it('should return 400 for invalid format', async () => {
    mockPrisma.markup.findMany.mockResolvedValue([mockMarkup]);

    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/markups/export/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups/export', {
      method: 'POST',
      body: JSON.stringify({
        format: 'invalid',
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid format');
  });

  it('should return 401 if no session', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/markups/export/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups/export', {
      method: 'POST',
      body: JSON.stringify({
        format: 'csv',
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 if document not found', async () => {
    mockPrisma.document.findFirst.mockResolvedValue(null);

    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/markups/export/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups/export', {
      method: 'POST',
      body: JSON.stringify({
        format: 'csv',
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Document not found');
  });

  it('should handle rate limit exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false });

    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/markups/export/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups/export', {
      method: 'POST',
      body: JSON.stringify({
        format: 'csv',
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.error).toBe('Rate limit exceeded');
  });

  it('should handle database errors gracefully', async () => {
    mockPrisma.markup.findMany.mockRejectedValue(new Error('Database error'));

    const { POST } = await import('@/app/api/projects/[slug]/documents/[id]/markups/export/route');
    const request = new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/markups/export', {
      method: 'POST',
      body: JSON.stringify({
        format: 'csv',
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ slug: 'test-project', id: 'doc-1' }) });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal server error');
  });
});
