import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Hoisted mocks
// ============================================

const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
  },
  document: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  documentChunk: {
    deleteMany: vi.fn(),
  },
  processingQueue: {
    deleteMany: vi.fn(),
  },
}));
const mockTasksTrigger = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'test-run-id' }));
const mockDownloadFile = vi.hoisted(() => vi.fn());
const mockGetDocumentMetadata = vi.hoisted(() => vi.fn());

vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }));
vi.mock('@/lib/auth-options', () => ({ authOptions: {} }));
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@trigger.dev/sdk/v3', () => ({
  tasks: { trigger: mockTasksTrigger },
  task: vi.fn(),
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
  configure: vi.fn(),
}));
vi.mock('@/lib/s3', () => ({
  downloadFile: mockDownloadFile,
}));
vi.mock('@/lib/document-processor', () => ({
  getDocumentMetadata: mockGetDocumentMetadata,
}));
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import route handler after mocks
import { POST } from '@/app/api/projects/[slug]/documents/[id]/reprocess/route';
import { NextRequest } from 'next/server';

// ============================================
// Test helpers
// ============================================

const adminSession = {
  user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
  expires: new Date(Date.now() + 86400000).toISOString(),
};

const ownerSession = {
  user: { id: 'user-1', email: 'owner@test.com', role: 'client' },
  expires: new Date(Date.now() + 86400000).toISOString(),
};

function createRequest() {
  return new NextRequest('http://localhost/api/projects/test-project/documents/doc-1/reprocess', {
    method: 'POST',
  });
}

function createMockProject(overrides = {}) {
  return {
    id: 'proj-1',
    slug: 'test-project',
    ownerId: 'user-1',
    ProjectMember: [],
    ...overrides,
  };
}

function createMockDocument(overrides = {}) {
  return {
    id: 'doc-1',
    name: 'test-plan.pdf',
    fileName: 'test-plan.pdf',
    projectId: 'proj-1',
    cloud_storage_path: 'uploads/test-plan.pdf',
    processed: true,
    processedAt: null,
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe('POST /api/projects/[slug]/documents/[id]/reprocess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockBuffer = Buffer.from('fake-pdf-content');
    mockDownloadFile.mockResolvedValue(mockBuffer);
    mockGetDocumentMetadata.mockResolvedValue({ totalPages: 10, processorType: 'vision-ai' });
    mockTasksTrigger.mockResolvedValue({ id: 'test-run-id' });
  });

  it('should return 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await POST(createRequest(), {
      params: { slug: 'test-project', id: 'doc-1' },
    });

    expect(response.status).toBe(401);
  });

  it('should return 404 when project not found', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);
    mockPrisma.project.findUnique.mockResolvedValue(null);

    const response = await POST(createRequest(), {
      params: { slug: 'nonexistent', id: 'doc-1' },
    });

    expect(response.status).toBe(404);
  });

  it('should return 403 when user has no access', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'other-user', email: 'other@test.com', role: 'client' },
      expires: new Date(Date.now() + 86400000).toISOString(),
    });
    mockPrisma.project.findUnique.mockResolvedValue(
      createMockProject({ ownerId: 'user-1', ProjectMember: [] })
    );

    const response = await POST(createRequest(), {
      params: { slug: 'test-project', id: 'doc-1' },
    });

    expect(response.status).toBe(403);
  });

  // C2: 60-minute cooldown
  it('should return 429 when document was processed within 60 minutes (C2 cooldown)', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);
    mockPrisma.project.findUnique.mockResolvedValue(createMockProject());

    // Document processed 30 minutes ago
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    mockPrisma.document.findUnique.mockResolvedValue(
      createMockDocument({ processedAt: thirtyMinutesAgo })
    );

    const response = await POST(createRequest(), {
      params: { slug: 'test-project', id: 'doc-1' },
    });

    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.error).toContain('recently processed');
    expect(data.error).toContain('minutes');
  });

  it('should allow reprocessing when cooldown has elapsed (>60 minutes)', async () => {
    mockGetServerSession.mockResolvedValue(ownerSession);
    mockPrisma.project.findUnique.mockResolvedValue(createMockProject());

    // Document processed 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    mockPrisma.document.findUnique.mockResolvedValue(
      createMockDocument({ processedAt: twoHoursAgo })
    );

    mockPrisma.documentChunk.deleteMany.mockResolvedValue({ count: 5 });
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.document.update.mockResolvedValue({});

    const response = await POST(createRequest(), {
      params: { slug: 'test-project', id: 'doc-1' },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe('Document reprocessing started');
  });

  it('should allow reprocessing when processedAt is null (never processed)', async () => {
    mockGetServerSession.mockResolvedValue(ownerSession);
    mockPrisma.project.findUnique.mockResolvedValue(createMockProject());

    // Document never processed
    mockPrisma.document.findUnique.mockResolvedValue(
      createMockDocument({ processedAt: null })
    );

    mockPrisma.documentChunk.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.document.update.mockResolvedValue({});

    const response = await POST(createRequest(), {
      params: { slug: 'test-project', id: 'doc-1' },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  // Trigger.dev async processing (replaces waitUntil)
  it('should use Trigger.dev tasks.trigger for async processing', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);
    mockPrisma.project.findUnique.mockResolvedValue(createMockProject());
    mockPrisma.document.findUnique.mockResolvedValue(
      createMockDocument({ processedAt: null })
    );

    mockPrisma.documentChunk.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.document.update.mockResolvedValue({});

    const response = await POST(createRequest(), {
      params: { slug: 'test-project', id: 'doc-1' },
    });

    expect(response.status).toBe(200);

    // Verify Trigger.dev was called (async processing)
    expect(mockTasksTrigger).toHaveBeenCalledWith('process-document', {
      documentId: 'doc-1',
      totalPages: 10,
      processorType: 'vision-ai',
    });
  });

  // Old ProcessingQueue entries are cleaned up before reprocessing
  it('should delete old ProcessingQueue entries before reprocessing', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);
    mockPrisma.project.findUnique.mockResolvedValue(createMockProject());
    mockPrisma.document.findUnique.mockResolvedValue(
      createMockDocument({ processedAt: null })
    );

    mockPrisma.documentChunk.deleteMany.mockResolvedValue({ count: 3 });
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.document.update.mockResolvedValue({});

    await POST(createRequest(), {
      params: { slug: 'test-project', id: 'doc-1' },
    });

    // Verify old queue entries were cleaned up
    expect(mockPrisma.processingQueue.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'doc-1' },
    });

    // Verify chunks were also cleaned up
    expect(mockPrisma.documentChunk.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'doc-1' },
    });
  });

  it('should return 400 when document has no cloud storage path', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);
    mockPrisma.project.findUnique.mockResolvedValue(createMockProject());
    mockPrisma.document.findUnique.mockResolvedValue(
      createMockDocument({ cloud_storage_path: null })
    );

    const response = await POST(createRequest(), {
      params: { slug: 'test-project', id: 'doc-1' },
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('no file');
  });
});
