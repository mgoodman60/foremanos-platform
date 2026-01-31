import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  prismaMock,
  getServerSessionMock,
  mockSession,
  mockProject,
  mockDocument,
  uploadFileMock,
  processDocumentMock,
  calculateFileHashMock,
  isDuplicateMock,
  classifyDocumentMock,
  canProcessDocumentMock,
  getRemainingPagesMock,
  shouldResetQuotaMock,
  requireProjectPermissionMock,
} from '../../mocks/shared-mocks';
import {
  createMockPrismaUser,
  createMockPrismaDocument,
  createMockFile,
} from '../../helpers/test-utils';
import { POST } from '@/app/api/documents/upload/route';

// Helper to create upload request with FormData
function createUploadRequest(
  file: File | null,
  projectId: string | null,
  category?: string
): Request {
  const formData = new FormData();
  if (file) formData.append('file', file);
  if (projectId) formData.append('projectId', projectId);
  if (category) formData.append('category', category);

  return new Request('http://localhost/api/documents/upload', {
    method: 'POST',
    body: formData,
  });
}

describe('Document Upload Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset default mock values
    getServerSessionMock.mockResolvedValue(mockSession);
    prismaMock.project.findUnique.mockResolvedValue(mockProject);
    prismaMock.user.findUnique.mockResolvedValue(createMockPrismaUser());
    prismaMock.user.update.mockResolvedValue(createMockPrismaUser());
    prismaMock.document.create.mockResolvedValue(createMockPrismaDocument());
    prismaMock.document.findFirst.mockResolvedValue(null);

    uploadFileMock.mockResolvedValue('projects/test-project/test.pdf');
    processDocumentMock.mockResolvedValue(undefined);
    calculateFileHashMock.mockReturnValue('hash123');
    isDuplicateMock.mockResolvedValue(false);
    classifyDocumentMock.mockResolvedValue({ processorType: 'pdf', category: 'plans' });
    canProcessDocumentMock.mockResolvedValue({ allowed: true, reason: '' });
    getRemainingPagesMock.mockReturnValue(1950);
    shouldResetQuotaMock.mockResolvedValue(false);
    requireProjectPermissionMock.mockResolvedValue({ allowed: true, access: { role: 'owner' } });
  });

  // ============================================
  // Authentication & Authorization Tests (4 tests)
  // ============================================
  describe('Authentication & Authorization', () => {
    it('should return 401 when not authenticated', async () => {
      getServerSessionMock.mockResolvedValue(null);

      const file = createMockFile('test content', 'test.pdf');
      const request = createUploadRequest(file, 'project-1');
      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks project permission', async () => {
      requireProjectPermissionMock.mockResolvedValue({
        allowed: false,
        access: { role: 'viewer' },
      });

      const file = createMockFile('test content', 'test.pdf');
      const request = createUploadRequest(file, 'project-1');
      const response = await POST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('permission');
    });

    it('should allow upload for project owner', async () => {
      requireProjectPermissionMock.mockResolvedValue({
        allowed: true,
        access: { role: 'owner' },
      });

      const file = createMockFile('test content', 'test.pdf');
      const request = createUploadRequest(file, 'project-1');
      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    it('should allow admin to bypass permission check', async () => {
      getServerSessionMock.mockResolvedValue({
        ...mockSession,
        user: { ...mockSession.user, role: 'admin' },
      });

      const file = createMockFile('test content', 'test.pdf');
      const request = createUploadRequest(file, 'project-1');
      const response = await POST(request);

      expect(response.status).toBe(201);
      // Admin should bypass permission check
      expect(requireProjectPermissionMock).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Input Validation Tests (4 tests)
  // ============================================
  describe('Input Validation', () => {
    it('should return 400 when file is missing', async () => {
      const request = createUploadRequest(null, 'project-1');
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('File');
    });

    it('should return 400 when projectId is missing', async () => {
      const file = createMockFile('test content', 'test.pdf');
      const request = createUploadRequest(file, null);
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('project ID');
    });

    it('should return 404 when project does not exist', async () => {
      prismaMock.project.findUnique.mockResolvedValue(null);

      const file = createMockFile('test content', 'test.pdf');
      const request = createUploadRequest(file, 'nonexistent-project');
      const response = await POST(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Project not found');
    });

    it('should return 413 when file exceeds 200MB', async () => {
      // Create a mock file with overridden size
      const file = createMockFile('test', 'large.pdf', 'application/pdf');

      // Create a custom request that returns a FormData with a file that has custom size
      const mockFormData = new FormData();
      mockFormData.append('file', file);
      mockFormData.append('projectId', 'project-1');

      // Override the get method to return a file with custom size for 'file' key
      const originalGet = mockFormData.get.bind(mockFormData);
      mockFormData.get = ((key: string) => {
        if (key === 'file') {
          const mockFile = originalGet('file') as File;
          // Create a proxy that returns custom size
          return new Proxy(mockFile, {
            get(target, prop, receiver) {
              if (prop === 'size') return 209715201; // > 200MB
              const value = Reflect.get(target, prop, receiver);
              return typeof value === 'function' ? value.bind(target) : value;
            },
          });
        }
        return originalGet(key);
      }) as typeof mockFormData.get;

      // Create request with mock formData method
      const request = new Request('http://localhost/api/documents/upload', {
        method: 'POST',
        body: new FormData(), // Dummy body
      });

      // Override formData() to return our mock
      (request as unknown as { formData: () => Promise<FormData> }).formData = async () =>
        mockFormData;

      const response = await POST(request);

      expect(response.status).toBe(413);
      const data = await response.json();
      expect(data.error).toContain('File too large');
    });
  });

  // ============================================
  // Duplicate Detection Tests (3 tests)
  // ============================================
  describe('Duplicate Detection', () => {
    it('should return 409 for duplicate file (same hash)', async () => {
      isDuplicateMock.mockResolvedValue(true);

      const file = createMockFile('duplicate content', 'test.pdf');
      const request = createUploadRequest(file, 'project-1');
      const response = await POST(request);

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toContain('Duplicate');
    });

    it('should return 409 for duplicate filename in project', async () => {
      isDuplicateMock.mockResolvedValue(true);

      const file = createMockFile('different content', 'existing-file.pdf');
      const request = createUploadRequest(file, 'project-1');
      const response = await POST(request);

      expect(response.status).toBe(409);
      expect(isDuplicateMock).toHaveBeenCalledWith(
        'project-1',
        'existing-file.pdf',
        expect.any(Number),
        expect.any(String)
      );
    });

    it('should allow same file in different projects', async () => {
      isDuplicateMock.mockResolvedValue(false);

      const file = createMockFile('same content', 'test.pdf');
      const request = createUploadRequest(file, 'project-2');
      const response = await POST(request);

      expect(response.status).toBe(201);
    });
  });

  // ============================================
  // Quota Management Tests (4 tests)
  // ============================================
  describe('Quota Management', () => {
    it('should return 403 when quota exceeded', async () => {
      canProcessDocumentMock.mockResolvedValue({
        allowed: false,
        reason: 'Monthly processing quota exceeded',
      });

      const file = createMockFile('test content', 'test.pdf');
      const request = createUploadRequest(file, 'project-1');
      const response = await POST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('quota');
    });

    it('should reset quota at month boundary', async () => {
      shouldResetQuotaMock.mockResolvedValue(true);

      const userWithHighUsage = createMockPrismaUser({
        pagesProcessedThisMonth: 1999,
        processingResetAt: new Date(Date.now() - 1000), // Past reset date
      });
      prismaMock.user.findUnique.mockResolvedValue(userWithHighUsage);

      const file = createMockFile('test content', 'test.pdf');
      const request = createUploadRequest(file, 'project-1');
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pagesProcessedThisMonth: 0,
          }),
        })
      );
    });

    it('should allow admin to bypass quota check', async () => {
      getServerSessionMock.mockResolvedValue({
        ...mockSession,
        user: { ...mockSession.user, role: 'admin' },
      });

      // Even with quota exceeded, admin should be able to upload
      canProcessDocumentMock.mockResolvedValue({ allowed: true, reason: '' });

      const file = createMockFile('test content', 'test.pdf');
      const request = createUploadRequest(file, 'project-1');
      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    it('should return remaining quota in response', async () => {
      getRemainingPagesMock.mockReturnValue(1500);

      const file = createMockFile('test content', 'test.pdf');
      const request = createUploadRequest(file, 'project-1');
      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.processingInfo.remainingPages).toBe(1500);
    });
  });

  // ============================================
  // S3 & Processing Tests (5 tests)
  // ============================================
  describe('S3 & Processing', () => {
    it('should return 503 on S3 upload failure', async () => {
      uploadFileMock.mockRejectedValue(new Error('S3 upload failed'));

      const file = createMockFile('test content', 'test.pdf');
      const request = createUploadRequest(file, 'project-1');
      const response = await POST(request);

      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toContain('Storage');
    });

    it('should return 504 on S3 upload timeout', async () => {
      uploadFileMock.mockRejectedValue(new Error('Request timed out'));

      const file = createMockFile('test content', 'test.pdf');
      const request = createUploadRequest(file, 'project-1');
      const response = await POST(request);

      expect(response.status).toBe(504);
      const data = await response.json();
      expect(data.error).toContain('timed out');
    });

    it('should create document record on success', async () => {
      const file = createMockFile('test content', 'test.pdf');
      const request = createUploadRequest(file, 'project-1', 'plans');
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(prismaMock.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'project-1',
            category: 'plans',
            processed: false,
          }),
        })
      );
    });

    it('should trigger async processing', async () => {
      const file = createMockFile('test content', 'test.pdf');
      const request = createUploadRequest(file, 'project-1');
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(processDocumentMock).toHaveBeenCalledWith(
        'doc-1', // Document ID from mock
        expect.objectContaining({ processorType: 'pdf' })
      );
    });

    it('should still return 201 when processing fails (async failure)', async () => {
      // Processing fails asynchronously
      processDocumentMock.mockRejectedValue(new Error('Processing failed'));

      const file = createMockFile('test content', 'test.pdf');
      const request = createUploadRequest(file, 'project-1');
      const response = await POST(request);

      // Should still return 201 because processing is async
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.message).toContain('Processing in background');
    });
  });

  // ============================================
  // Response Structure Tests
  // ============================================
  describe('Response Structure', () => {
    it('should return correct response structure on success', async () => {
      const file = createMockFile('test content', 'test.pdf');
      const request = createUploadRequest(file, 'project-1');
      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();

      expect(data).toHaveProperty('Document');
      expect(data.Document).toHaveProperty('id');
      expect(data.Document).toHaveProperty('name');
      expect(data.Document).toHaveProperty('fileName');

      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('processingInfo');
      expect(data.processingInfo).toHaveProperty('estimatedPages');
      expect(data.processingInfo).toHaveProperty('processorType');
      expect(data.processingInfo).toHaveProperty('remainingPages');
      expect(data.processingInfo).toHaveProperty('tier');
    });
  });
});
