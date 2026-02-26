import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/documents/[id]/page-image/route';

// Mock dependencies
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  document: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
}));
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));
const mockDownloadFile = vi.hoisted(() => vi.fn());
const mockExtractPageAsPdf = vi.hoisted(() => vi.fn());
const mockRasterizeSinglePage = vi.hoisted(() => vi.fn());

vi.mock('@/auth', () => ({ auth: mockGetServerSession }));
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createScopedLogger: vi.fn(() => mockLogger),
}));
vi.mock('@/lib/s3', () => ({
  downloadFile: mockDownloadFile,
}));
vi.mock('@/lib/pdf-to-image-serverless', () => ({
  extractPageAsPdf: mockExtractPageAsPdf,
}));
vi.mock('@/lib/pdf-to-image-raster', () => ({
  rasterizeSinglePage: mockRasterizeSinglePage,
}));

describe('GET /api/documents/[id]/page-image', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if no session', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/documents/doc-1/page-image?page=1');
    const response = await GET(request, { params: { id: 'doc-1' } } as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(data.code).toBe('AUTH_REQUIRED');
  });

  it('should return 401 if session has no email', async () => {
    mockGetServerSession.mockResolvedValue({ user: {} });

    const request = new NextRequest('http://localhost/api/documents/doc-1/page-image?page=1');
    const response = await GET(request, { params: { id: 'doc-1' } } as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(data.code).toBe('AUTH_REQUIRED');
  });

  it('should return 400 if page parameter is missing', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });

    const request = new NextRequest('http://localhost/api/documents/doc-1/page-image');
    const response = await GET(request, { params: { id: 'doc-1' } } as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Page number is required');
    expect(data.code).toBe('MISSING_PAGE_PARAM');
  });

  it('should return 400 if page parameter is not a number', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });

    const request = new NextRequest('http://localhost/api/documents/doc-1/page-image?page=abc');
    const response = await GET(request, { params: { id: 'doc-1' } } as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid page number');
    expect(data.code).toBe('INVALID_PAGE_NUMBER');
  });

  it('should return 400 if page number is less than 1', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });

    const request = new NextRequest('http://localhost/api/documents/doc-1/page-image?page=0');
    const response = await GET(request, { params: { id: 'doc-1' } } as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid page number');
    expect(data.code).toBe('INVALID_PAGE_NUMBER');
  });

  it('should return 400 if maxWidth is invalid', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });

    const request = new NextRequest('http://localhost/api/documents/doc-1/page-image?page=1&maxWidth=50');
    const response = await GET(request, { params: { id: 'doc-1' } } as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('maxWidth must be between 100 and 8000');
    expect(data.code).toBe('INVALID_MAX_WIDTH');
  });

  it('should return 400 if maxWidth exceeds 8000', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });

    const request = new NextRequest('http://localhost/api/documents/doc-1/page-image?page=1&maxWidth=9000');
    const response = await GET(request, { params: { id: 'doc-1' } } as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('maxWidth must be between 100 and 8000');
    expect(data.code).toBe('INVALID_MAX_WIDTH');
  });

  it('should return 404 if document not found', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.document.findUnique.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/documents/doc-1/page-image?page=1');
    const response = await GET(request, { params: { id: 'doc-1' } } as any);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Document not found');
    expect(data.code).toBe('DOCUMENT_NOT_FOUND');
  });

  it('should return 410 if document has been deleted', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Test.pdf',
      cloud_storage_path: 'path/to/test.pdf',
      projectId: 'project-1',
      deletedAt: new Date(),
    });

    const request = new NextRequest('http://localhost/api/documents/doc-1/page-image?page=1');
    const response = await GET(request, { params: { id: 'doc-1' } } as any);
    const data = await response.json();

    expect(response.status).toBe(410);
    expect(data.error).toBe('Document has been deleted');
    expect(data.code).toBe('DOCUMENT_DELETED');
  });

  it('should return 404 if document has no storage path', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Test.pdf',
      cloud_storage_path: null,
      projectId: 'project-1',
      deletedAt: null,
    });

    const request = new NextRequest('http://localhost/api/documents/doc-1/page-image?page=1');
    const response = await GET(request, { params: { id: 'doc-1' } } as any);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Document has no storage path');
    expect(data.code).toBe('NO_STORAGE_PATH');
  });

  it('should return 404 if user not found', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Test.pdf',
      cloud_storage_path: 'path/to/test.pdf',
      projectId: 'project-1',
      deletedAt: null,
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/documents/doc-1/page-image?page=1');
    const response = await GET(request, { params: { id: 'doc-1' } } as any);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('User not found');
    expect(data.code).toBe('USER_NOT_FOUND');
  });

  it('should return 404 if project not found', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Test.pdf',
      cloud_storage_path: 'path/to/test.pdf',
      projectId: 'project-1',
      deletedAt: null,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'user',
    });
    mockPrisma.project.findUnique.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/documents/doc-1/page-image?page=1');
    const response = await GET(request, { params: { id: 'doc-1' } } as any);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Project not found');
    expect(data.code).toBe('PROJECT_NOT_FOUND');
  });

  it('should return 403 if user has no access to project', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Test.pdf',
      cloud_storage_path: 'path/to/test.pdf',
      projectId: 'project-1',
      deletedAt: null,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'user',
    });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ownerId: 'owner-1',
      ProjectMember: [],
    });

    const request = new NextRequest('http://localhost/api/documents/doc-1/page-image?page=1');
    const response = await GET(request, { params: { id: 'doc-1' } } as any);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Access denied');
    expect(data.code).toBe('ACCESS_DENIED');
  });

  it('should allow access for project owner', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Test.pdf',
      cloud_storage_path: 'path/to/test.pdf',
      projectId: 'project-1',
      deletedAt: null,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'user',
    });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ownerId: 'user-1',
      ProjectMember: [],
    });
    mockDownloadFile.mockResolvedValue(Buffer.from('pdf-content'));
    mockExtractPageAsPdf.mockResolvedValue({
      base64: Buffer.from('pdf-page').toString('base64'),
      pageCount: 5,
    });
    mockRasterizeSinglePage.mockResolvedValue({
      buffer: Buffer.from('png-image'),
      width: 1000,
      height: 1414,
    });

    const request = new NextRequest('http://localhost/api/documents/doc-1/page-image?page=1');
    const response = await GET(request, { params: { id: 'doc-1' } } as any);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });

  it('should allow access for admin user', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Test.pdf',
      cloud_storage_path: 'path/to/test.pdf',
      projectId: 'project-1',
      deletedAt: null,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'admin',
    });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ownerId: 'owner-1',
      ProjectMember: [],
    });
    mockDownloadFile.mockResolvedValue(Buffer.from('pdf-content'));
    mockExtractPageAsPdf.mockResolvedValue({
      base64: Buffer.from('pdf-page').toString('base64'),
      pageCount: 5,
    });
    mockRasterizeSinglePage.mockResolvedValue({
      buffer: Buffer.from('png-image'),
      width: 1000,
      height: 1414,
    });

    const request = new NextRequest('http://localhost/api/documents/doc-1/page-image?page=1');
    const response = await GET(request, { params: { id: 'doc-1' } } as any);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
  });

  it('should allow access for project member', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'member@example.com' } });
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Test.pdf',
      cloud_storage_path: 'path/to/test.pdf',
      projectId: 'project-1',
      deletedAt: null,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'user',
    });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ownerId: 'owner-1',
      ProjectMember: [
        { userId: 'user-1', User: { id: 'user-1', email: 'member@example.com' } },
      ],
    });
    mockDownloadFile.mockResolvedValue(Buffer.from('pdf-content'));
    mockExtractPageAsPdf.mockResolvedValue({
      base64: Buffer.from('pdf-page').toString('base64'),
      pageCount: 5,
    });
    mockRasterizeSinglePage.mockResolvedValue({
      buffer: Buffer.from('png-image'),
      width: 1000,
      height: 1414,
    });

    const request = new NextRequest('http://localhost/api/documents/doc-1/page-image?page=1');
    const response = await GET(request, { params: { id: 'doc-1' } } as any);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
  });

  it('should return 504 on download timeout', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Test.pdf',
      cloud_storage_path: 'path/to/test.pdf',
      projectId: 'project-1',
      deletedAt: null,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'user',
    });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ownerId: 'user-1',
      ProjectMember: [],
    });
    // Mock a timeout error instead of actually waiting
    mockDownloadFile.mockRejectedValue(new Error('Download timeout'));

    const request = new NextRequest('http://localhost/api/documents/doc-1/page-image?page=1');
    const response = await GET(request, { params: { id: 'doc-1' } } as any);
    const data = await response.json();

    expect(response.status).toBe(504);
    expect(data.error).toBe('Download timeout');
    expect(data.code).toBe('DOWNLOAD_TIMEOUT');
  });

  it('should return 500 on download error', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Test.pdf',
      cloud_storage_path: 'path/to/test.pdf',
      projectId: 'project-1',
      deletedAt: null,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'user',
    });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ownerId: 'user-1',
      ProjectMember: [],
    });
    mockDownloadFile.mockRejectedValue(new Error('S3 connection failed'));

    const request = new NextRequest('http://localhost/api/documents/doc-1/page-image?page=1');
    const response = await GET(request, { params: { id: 'doc-1' } } as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to download document');
    expect(data.code).toBe('DOWNLOAD_FAILED');
  });

  it('should return 400 on page out of range error', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Test.pdf',
      cloud_storage_path: 'path/to/test.pdf',
      projectId: 'project-1',
      deletedAt: null,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'user',
    });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ownerId: 'user-1',
      ProjectMember: [],
    });
    mockDownloadFile.mockResolvedValue(Buffer.from('pdf-content'));
    mockExtractPageAsPdf.mockRejectedValue(new Error('Page 10 is out of range'));

    const request = new NextRequest('http://localhost/api/documents/doc-1/page-image?page=10');
    const response = await GET(request, { params: { id: 'doc-1' } } as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('PAGE_OUT_OF_RANGE');
  });

  it('should return 500 on extraction error', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Test.pdf',
      cloud_storage_path: 'path/to/test.pdf',
      projectId: 'project-1',
      deletedAt: null,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'user',
    });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ownerId: 'user-1',
      ProjectMember: [],
    });
    mockDownloadFile.mockResolvedValue(Buffer.from('pdf-content'));
    mockExtractPageAsPdf.mockRejectedValue(new Error('PDF parsing failed'));

    const request = new NextRequest('http://localhost/api/documents/doc-1/page-image?page=1');
    const response = await GET(request, { params: { id: 'doc-1' } } as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to extract page');
    expect(data.code).toBe('EXTRACT_FAILED');
  });

  it('should return 500 on rasterization error', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Test.pdf',
      cloud_storage_path: 'path/to/test.pdf',
      projectId: 'project-1',
      deletedAt: null,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'user',
    });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ownerId: 'user-1',
      ProjectMember: [],
    });
    mockDownloadFile.mockResolvedValue(Buffer.from('pdf-content'));
    mockExtractPageAsPdf.mockResolvedValue({
      base64: Buffer.from('pdf-page').toString('base64'),
      pageCount: 5,
    });
    mockRasterizeSinglePage.mockRejectedValue(new Error('Rendering failed'));

    const request = new NextRequest('http://localhost/api/documents/doc-1/page-image?page=1');
    const response = await GET(request, { params: { id: 'doc-1' } } as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to rasterize page');
    expect(data.code).toBe('RASTERIZE_FAILED');
  });

  it('should apply custom maxWidth parameter', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Test.pdf',
      cloud_storage_path: 'path/to/test.pdf',
      projectId: 'project-1',
      deletedAt: null,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'user',
    });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ownerId: 'user-1',
      ProjectMember: [],
    });
    mockDownloadFile.mockResolvedValue(Buffer.from('pdf-content'));
    mockExtractPageAsPdf.mockResolvedValue({
      base64: Buffer.from('pdf-page').toString('base64'),
      pageCount: 5,
    });
    mockRasterizeSinglePage.mockResolvedValue({
      buffer: Buffer.from('png-image'),
      width: 1000,
      height: 1414,
    });

    const request = new NextRequest('http://localhost/api/documents/doc-1/page-image?page=1&maxWidth=1500');
    await GET(request, { params: { id: 'doc-1' } } as any);

    expect(mockRasterizeSinglePage).toHaveBeenCalledWith(
      expect.any(Buffer),
      1,
      expect.objectContaining({
        maxWidth: 1500,
        dpi: 150,
        format: 'png',
      })
    );
  });

  it('should use default maxWidth if not provided', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      name: 'Test.pdf',
      cloud_storage_path: 'path/to/test.pdf',
      projectId: 'project-1',
      deletedAt: null,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'user',
    });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ownerId: 'user-1',
      ProjectMember: [],
    });
    mockDownloadFile.mockResolvedValue(Buffer.from('pdf-content'));
    mockExtractPageAsPdf.mockResolvedValue({
      base64: Buffer.from('pdf-page').toString('base64'),
      pageCount: 5,
    });
    mockRasterizeSinglePage.mockResolvedValue({
      buffer: Buffer.from('png-image'),
      width: 1000,
      height: 1414,
    });

    const request = new NextRequest('http://localhost/api/documents/doc-1/page-image?page=1');
    await GET(request, { params: { id: 'doc-1' } } as any);

    expect(mockRasterizeSinglePage).toHaveBeenCalledWith(
      expect.any(Buffer),
      1,
      expect.objectContaining({
        maxWidth: 2000, // default
        dpi: 150,
        format: 'png',
      })
    );
  });
});
