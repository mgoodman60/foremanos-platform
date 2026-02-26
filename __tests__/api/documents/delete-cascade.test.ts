import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSession = vi.hoisted(() => ({
  user: { id: 'user1', email: 'test@test.com', role: 'admin' },
}));

const mockPrisma = vi.hoisted(() => ({
  document: {
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  documentChunk: { deleteMany: vi.fn() },
  materialTakeoff: { deleteMany: vi.fn() },
  projectDataSource: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('@/auth', () => ({
  auth: vi.fn(() => mockSession),
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/s3', () => ({
  getFileUrl: vi.fn(),
  deleteFile: vi.fn(),
}));
vi.mock('@/lib/aws-config', () => ({
  createS3Client: vi.fn(),
  getBucketConfig: vi.fn(() => ({ bucketName: 'test' })),
}));
vi.mock('@/lib/document-auto-sync', () => ({
  handleDocumentDeletion: vi.fn(() => ({
    featuresAffected: 0,
    featuresResynced: 0,
    featuresCleared: 0,
  })),
}));
vi.mock('@/lib/docx-converter', () => ({
  convertDocxToPdf: vi.fn(),
  isConversionSupported: vi.fn().mockResolvedValue(false),
}));

import { DELETE } from '@/app/api/documents/[id]/route';
import { auth } from '@/auth';

const mockDoc = {
  id: 'doc-1',
  fileName: 'test.pdf',
  filePath: null,
  cloud_storage_path: 'projects/test/test.pdf',
  projectId: 'project-1',
  Project: {
    id: 'project-1',
    ownerId: 'user1',
  },
};

describe('Document DELETE - Cascade Transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
    // The actual code uses prisma.$transaction([...]) with an array of operations.
    // The array form returns the results of each operation.
    mockPrisma.$transaction.mockResolvedValue([
      { count: 3 }, // documentChunk deleteMany
      { count: 1 }, // materialTakeoff deleteMany
      { count: 2 }, // projectDataSource deleteMany
      { id: 'doc-1' }, // document delete
    ]);
  });

  it('should wrap DB deletions in a transaction', async () => {
    const request = new Request('http://localhost/api/documents/doc-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request as any, { params: Promise.resolve({ id: 'doc-1' }) });

    expect(response.status).toBe(200);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    // Verify it was called with an array (not a callback)
    const txArg = mockPrisma.$transaction.mock.calls[0][0];
    expect(Array.isArray(txArg)).toBe(true);
  });

  it('should clean up MaterialTakeoff records in the transaction', async () => {
    const request = new Request('http://localhost/api/documents/doc-1', {
      method: 'DELETE',
    });

    await DELETE(request as any, { params: Promise.resolve({ id: 'doc-1' }) });

    // The transaction array should include materialTakeoff.deleteMany, documentChunk.deleteMany,
    // projectDataSource.deleteMany, and document.delete
    const txArg = mockPrisma.$transaction.mock.calls[0][0];
    expect(txArg.length).toBe(4);

    const body = await (await DELETE(request as any, { params: Promise.resolve({ id: 'doc-1' }) })).json();
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('takeoffsCleaned');
  });

  it('should return 401 for unauthenticated users', async () => {
    (auth as any).mockResolvedValueOnce(null);

    const request = new Request('http://localhost/api/documents/doc-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request as any, { params: Promise.resolve({ id: 'doc-1' }) });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('should return 403 for non-admin non-owner users', async () => {
    (auth as any).mockResolvedValueOnce({
      user: { id: 'other-user', email: 'other@test.com', role: 'guest' },
    });

    const request = new Request('http://localhost/api/documents/doc-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request as any, { params: Promise.resolve({ id: 'doc-1' }) });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('permission');
  });

  it('should return 404 for non-existent document', async () => {
    mockPrisma.document.findUnique.mockResolvedValueOnce(null);

    const request = new Request('http://localhost/api/documents/nonexistent', {
      method: 'DELETE',
    });

    const response = await DELETE(request as any, { params: Promise.resolve({ id: 'nonexistent' }) });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('Document not found');
  });

  it('should include auto-sync result in response', async () => {
    const request = new Request('http://localhost/api/documents/doc-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request as any, { params: Promise.resolve({ id: 'doc-1' }) });

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.autoSync).toBeDefined();
    expect(body.autoSync).toHaveProperty('featuresAffected', 0);
    expect(body.autoSync).toHaveProperty('featuresResynced', 0);
    expect(body.autoSync).toHaveProperty('featuresCleared', 0);
  });
});
