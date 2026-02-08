import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Hoisted mocks
// ============================================

const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  document: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  processingQueue: {
    deleteMany: vi.fn(),
  },
}));
const mockProcessDocument = vi.hoisted(() => vi.fn());
const mockClassifyDocument = vi.hoisted(() => vi.fn());
const mockWaitUntil = vi.hoisted(() => vi.fn());

vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }));
vi.mock('@/lib/auth-options', () => ({ authOptions: {} }));
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/document-processor', () => ({
  processDocument: mockProcessDocument,
}));
vi.mock('@/lib/document-classifier', () => ({
  classifyDocument: mockClassifyDocument,
}));
vi.mock('@vercel/functions', () => ({
  waitUntil: mockWaitUntil,
}));

// Import route handler after mocks
import { POST } from '@/app/api/documents/retry-failed/route';
import { NextRequest } from 'next/server';

// ============================================
// Test helpers
// ============================================

const adminSession = {
  user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
  expires: new Date(Date.now() + 86400000).toISOString(),
};

const clientSession = {
  user: { id: 'user-1', email: 'client@test.com', role: 'client' },
  expires: new Date(Date.now() + 86400000).toISOString(),
};

function createRequest(body: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost/api/documents/retry-failed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ============================================
// Tests
// ============================================

describe('POST /api/documents/retry-failed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWaitUntil.mockImplementation(() => {});
  });

  it('should return 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await POST(createRequest());

    expect(response.status).toBe(401);
  });

  it('should return 403 when user is not admin', async () => {
    mockGetServerSession.mockResolvedValue(clientSession);

    const response = await POST(createRequest());

    expect(response.status).toBe(403);
  });

  it('should return success when no failed documents found', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);
    mockPrisma.document.findMany.mockResolvedValue([]);

    const response = await POST(createRequest({ projectId: 'proj-1' }));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.retried).toBe(0);
  });

  // C5: Delete old ProcessingQueue entries before retrying
  it('should delete old ProcessingQueue entries before retrying (C5)', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);

    const failedDocs = [
      {
        id: 'doc-1',
        name: 'failed-plan.pdf',
        fileName: 'failed-plan.pdf',
        processingRetries: 0,
        lastProcessingError: 'Vision API timeout',
      },
      {
        id: 'doc-2',
        name: 'failed-spec.pdf',
        fileName: 'failed-spec.pdf',
        processingRetries: 1,
        lastProcessingError: 'Network error',
      },
    ];

    mockPrisma.document.findMany.mockResolvedValue(failedDocs);
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.document.update.mockResolvedValue({});
    mockClassifyDocument.mockResolvedValue({
      processorType: 'vision-ai',
      confidence: 0.95,
    });
    mockProcessDocument.mockResolvedValue(undefined);

    const response = await POST(createRequest({ projectId: 'proj-1' }));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.retried).toBe(2);

    // Verify ProcessingQueue cleanup was called for EACH failed document
    expect(mockPrisma.processingQueue.deleteMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.processingQueue.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'doc-1' },
    });
    expect(mockPrisma.processingQueue.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'doc-2' },
    });
  });

  it('should delete ProcessingQueue entries BEFORE updating document status', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);

    const failedDocs = [
      {
        id: 'doc-1',
        name: 'failed-plan.pdf',
        fileName: 'failed-plan.pdf',
        processingRetries: 0,
        lastProcessingError: 'Error',
      },
    ];

    mockPrisma.document.findMany.mockResolvedValue(failedDocs);
    mockPrisma.document.update.mockResolvedValue({});
    mockClassifyDocument.mockResolvedValue({
      processorType: 'vision-ai',
      confidence: 0.95,
    });
    mockProcessDocument.mockResolvedValue(undefined);

    // Track call order
    const callOrder: string[] = [];
    mockPrisma.processingQueue.deleteMany.mockImplementation(() => {
      callOrder.push('processingQueue.deleteMany');
      return Promise.resolve({ count: 1 });
    });
    mockPrisma.document.update.mockImplementation(() => {
      callOrder.push('document.update');
      return Promise.resolve({});
    });

    await POST(createRequest({}));

    // Verify deleteMany was called before document.update
    const deleteIndex = callOrder.indexOf('processingQueue.deleteMany');
    const updateIndex = callOrder.indexOf('document.update');
    expect(deleteIndex).toBeLessThan(updateIndex);
  });

  it('should increment processingRetries when retrying', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);

    const failedDocs = [
      {
        id: 'doc-1',
        name: 'plan.pdf',
        fileName: 'plan.pdf',
        processingRetries: 1,
        lastProcessingError: 'Error',
      },
    ];

    mockPrisma.document.findMany.mockResolvedValue(failedDocs);
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.document.update.mockResolvedValue({});
    mockClassifyDocument.mockResolvedValue({
      processorType: 'vision-ai',
      confidence: 0.95,
    });
    mockProcessDocument.mockResolvedValue(undefined);

    const response = await POST(createRequest({}));

    expect(response.status).toBe(200);

    // Verify retry counter was incremented
    expect(mockPrisma.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: expect.objectContaining({
        processingRetries: 2,
        queueStatus: 'queued',
        processed: false,
      }),
    });
  });

  it('should use waitUntil for async processing', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);

    const failedDocs = [
      {
        id: 'doc-1',
        name: 'plan.pdf',
        fileName: 'plan.pdf',
        processingRetries: 0,
        lastProcessingError: 'Error',
      },
    ];

    mockPrisma.document.findMany.mockResolvedValue(failedDocs);
    mockPrisma.processingQueue.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.document.update.mockResolvedValue({});
    mockClassifyDocument.mockResolvedValue({
      processorType: 'vision-ai',
      confidence: 0.95,
    });
    mockProcessDocument.mockResolvedValue(undefined);

    await POST(createRequest({}));

    // Verify waitUntil was used for async processing
    expect(mockWaitUntil).toHaveBeenCalledTimes(1);
  });
});
