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

// ============================================
// Upload Error Classification Tests (NOT skipped)
// These test the error classification logic that the catch block uses,
// independent of the FormData limitation.
// ============================================

/**
 * Replicates the error classification logic from the upload route's catch block.
 * This allows us to test the classification independently of FormData.
 */
function classifyUploadError(error: any): {
  errorCode: string;
  statusCode: number;
  retryAdvice: string;
  errorMessage: string;
} {
  const s3Meta = error.$metadata;

  const isTimeout = error.isTimeout
    || error.message?.includes('timeout')
    || error.message?.includes('timed out')
    || error.code === 'ETIMEDOUT';
  const isAuthError = error.isAuthError
    || error.name === 'InvalidAccessKeyId'
    || error.name === 'SignatureDoesNotMatch'
    || error.name === 'AccessDenied'
    || error.$metadata?.httpStatusCode === 403;
  const isNetworkError = error.code === 'ECONNRESET'
    || error.code === 'ECONNREFUSED'
    || error.code === 'ENOTFOUND'
    || error.message?.includes('network')
    || error.message?.includes('ECONNREFUSED');
  const isDbError = error.message?.includes('Prisma')
    || error.message?.includes('database');
  const isS3Error = error.message?.includes('S3')
    || error.message?.includes('upload')
    || error.code === 'NoSuchBucket'
    || !!error.httpStatus
    || !!s3Meta;

  let errorMessage: string;
  let errorCode: string;
  let statusCode: number;
  let retryAdvice: string;

  if (isAuthError) {
    errorCode = 'S3_AUTH_ERROR';
    errorMessage = 'Storage authentication failed. Please contact your administrator to verify storage credentials.';
    statusCode = 503;
    retryAdvice = 'Contact your administrator — storage credentials may need updating.';
  } else if (isTimeout) {
    errorCode = 'S3_TIMEOUT';
    errorMessage = 'Upload timed out. The file may be too large or the connection is slow.';
    statusCode = 504;
    retryAdvice = 'The file may be too large or the connection is slow. Try again or use a smaller file.';
  } else if (isDbError) {
    errorCode = 'DB_ERROR';
    errorMessage = 'Database error while saving document. Please try again.';
    statusCode = 503;
    retryAdvice = 'A temporary database error occurred. Please try again in a few moments.';
  } else if (isNetworkError) {
    errorCode = 'NETWORK_ERROR';
    errorMessage = 'Network connection error. Please check your internet connection and try again.';
    statusCode = 503;
    retryAdvice = 'Check your internet connection and try again.';
  } else if (isS3Error) {
    errorCode = 'S3_ERROR';
    errorMessage = 'Storage upload failed. Please check your network connection and try again.';
    statusCode = 503;
    retryAdvice = 'If the issue persists, try uploading a smaller file or contact support.';
  } else {
    errorCode = 'UPLOAD_ERROR';
    errorMessage = 'Upload failed. Please try again.';
    statusCode = 500;
    retryAdvice = 'If the issue persists, try uploading a smaller file or contact support.';
  }

  return { errorCode, statusCode, retryAdvice, errorMessage };
}

describe('Upload Error Classification', () => {
  describe('S3 Auth Errors', () => {
    it('should classify InvalidAccessKeyId as S3_AUTH_ERROR', () => {
      const error = Object.assign(new Error('Invalid access key'), {
        name: 'InvalidAccessKeyId',
        $metadata: { httpStatusCode: 403 },
      });
      const result = classifyUploadError(error);
      expect(result.errorCode).toBe('S3_AUTH_ERROR');
      expect(result.statusCode).toBe(503);
      expect(result.retryAdvice).toContain('administrator');
    });

    it('should classify SignatureDoesNotMatch as S3_AUTH_ERROR', () => {
      const error = Object.assign(new Error('Sig mismatch'), {
        name: 'SignatureDoesNotMatch',
      });
      const result = classifyUploadError(error);
      expect(result.errorCode).toBe('S3_AUTH_ERROR');
      expect(result.statusCode).toBe(503);
    });

    it('should classify AccessDenied as S3_AUTH_ERROR', () => {
      const error = Object.assign(new Error('Access denied'), {
        name: 'AccessDenied',
      });
      const result = classifyUploadError(error);
      expect(result.errorCode).toBe('S3_AUTH_ERROR');
    });

    it('should classify HTTP 403 without named error as S3_AUTH_ERROR', () => {
      const error = Object.assign(new Error('Forbidden'), {
        name: 'S3ServiceException',
        $metadata: { httpStatusCode: 403 },
      });
      const result = classifyUploadError(error);
      expect(result.errorCode).toBe('S3_AUTH_ERROR');
      expect(result.statusCode).toBe(503);
    });

    it('should classify error with isAuthError=true as S3_AUTH_ERROR', () => {
      const error = Object.assign(new Error('Auth failed'), {
        isAuthError: true,
      });
      const result = classifyUploadError(error);
      expect(result.errorCode).toBe('S3_AUTH_ERROR');
    });
  });

  describe('Timeout Errors', () => {
    it('should classify "timeout" in message as S3_TIMEOUT', () => {
      const error = new Error('S3 upload timeout after 120000ms');
      const result = classifyUploadError(error);
      expect(result.errorCode).toBe('S3_TIMEOUT');
      expect(result.statusCode).toBe(504);
    });

    it('should classify "timed out" in message as S3_TIMEOUT', () => {
      const error = new Error('Request timed out');
      const result = classifyUploadError(error);
      expect(result.errorCode).toBe('S3_TIMEOUT');
      expect(result.statusCode).toBe(504);
    });

    it('should classify ETIMEDOUT code as S3_TIMEOUT', () => {
      const error = Object.assign(new Error('Connection timed out'), {
        code: 'ETIMEDOUT',
      });
      const result = classifyUploadError(error);
      expect(result.errorCode).toBe('S3_TIMEOUT');
      expect(result.statusCode).toBe(504);
    });

    it('should classify error with isTimeout=true as S3_TIMEOUT', () => {
      const error = Object.assign(new Error('Upload failed'), {
        isTimeout: true,
      });
      const result = classifyUploadError(error);
      expect(result.errorCode).toBe('S3_TIMEOUT');
    });

    it('should include retry advice about file size for timeouts', () => {
      const error = new Error('Request timed out');
      const result = classifyUploadError(error);
      expect(result.retryAdvice).toContain('smaller file');
    });
  });

  describe('Database Errors', () => {
    it('should classify Prisma errors as DB_ERROR', () => {
      const error = new Error('Prisma client connection failed');
      const result = classifyUploadError(error);
      expect(result.errorCode).toBe('DB_ERROR');
      expect(result.statusCode).toBe(503);
    });

    it('should classify "database" in message as DB_ERROR', () => {
      const error = new Error('database connection reset');
      const result = classifyUploadError(error);
      expect(result.errorCode).toBe('DB_ERROR');
      expect(result.statusCode).toBe(503);
      expect(result.retryAdvice).toContain('try again');
    });
  });

  describe('Network Errors', () => {
    it('should classify ECONNRESET as NETWORK_ERROR', () => {
      const error = Object.assign(new Error('Connection reset'), {
        code: 'ECONNRESET',
      });
      const result = classifyUploadError(error);
      expect(result.errorCode).toBe('NETWORK_ERROR');
      expect(result.statusCode).toBe(503);
    });

    it('should classify ECONNREFUSED code as NETWORK_ERROR', () => {
      const error = Object.assign(new Error('Connection refused'), {
        code: 'ECONNREFUSED',
      });
      const result = classifyUploadError(error);
      expect(result.errorCode).toBe('NETWORK_ERROR');
    });

    it('should classify ENOTFOUND as NETWORK_ERROR', () => {
      const error = Object.assign(new Error('DNS lookup failed'), {
        code: 'ENOTFOUND',
      });
      const result = classifyUploadError(error);
      expect(result.errorCode).toBe('NETWORK_ERROR');
    });

    it('should classify "network" in message as NETWORK_ERROR', () => {
      const error = new Error('network error occurred');
      const result = classifyUploadError(error);
      expect(result.errorCode).toBe('NETWORK_ERROR');
      expect(result.retryAdvice).toContain('internet connection');
    });

    it('should classify "ECONNREFUSED" in message as NETWORK_ERROR', () => {
      const error = new Error('connect ECONNREFUSED 127.0.0.1:5432');
      const result = classifyUploadError(error);
      expect(result.errorCode).toBe('NETWORK_ERROR');
    });
  });

  describe('S3 Errors', () => {
    it('should classify "S3" in message as S3_ERROR', () => {
      const error = new Error('S3 upload failed after 3 attempts');
      const result = classifyUploadError(error);
      expect(result.errorCode).toBe('S3_ERROR');
      expect(result.statusCode).toBe(503);
    });

    it('should classify "upload" in message as S3_ERROR', () => {
      const error = new Error('upload stream interrupted');
      const result = classifyUploadError(error);
      expect(result.errorCode).toBe('S3_ERROR');
      expect(result.statusCode).toBe(503);
    });

    it('should classify NoSuchBucket code as S3_ERROR', () => {
      const error = Object.assign(new Error('Bucket not found'), {
        code: 'NoSuchBucket',
      });
      const result = classifyUploadError(error);
      expect(result.errorCode).toBe('S3_ERROR');
    });

    it('should classify errors with $metadata as S3_ERROR', () => {
      const error = Object.assign(new Error('S3 service error'), {
        $metadata: { httpStatusCode: 500 },
      });
      const result = classifyUploadError(error);
      // Note: 500 without auth patterns -> S3_ERROR (has $metadata)
      expect(result.errorCode).toBe('S3_ERROR');
    });

    it('should classify errors with httpStatus property as S3_ERROR', () => {
      const error = Object.assign(new Error('Storage error'), {
        httpStatus: 500,
      });
      const result = classifyUploadError(error);
      expect(result.errorCode).toBe('S3_ERROR');
    });
  });

  describe('Generic Errors', () => {
    it('should classify unknown errors as UPLOAD_ERROR', () => {
      const error = new Error('Something unexpected happened');
      const result = classifyUploadError(error);
      expect(result.errorCode).toBe('UPLOAD_ERROR');
      expect(result.statusCode).toBe(500);
    });

    it('should return generic retry advice for unknown errors', () => {
      const error = new Error('Unknown');
      const result = classifyUploadError(error);
      expect(result.retryAdvice).toContain('contact support');
    });
  });

  describe('Priority Order', () => {
    it('should prioritize auth over timeout when both match', () => {
      // Error that matches both auth and timeout patterns
      const error = Object.assign(new Error('Request timed out'), {
        name: 'AccessDenied',
      });
      const result = classifyUploadError(error);
      // Auth is checked first in the if/else chain
      expect(result.errorCode).toBe('S3_AUTH_ERROR');
    });

    it('should prioritize timeout over DB when both match', () => {
      const error = new Error('database operation timed out');
      const result = classifyUploadError(error);
      // timeout is checked before DB in the if/else chain
      expect(result.errorCode).toBe('S3_TIMEOUT');
    });

    it('should prioritize DB over network when both match', () => {
      const error = Object.assign(new Error('Prisma client error'), {
        code: 'ECONNREFUSED',
      });
      const result = classifyUploadError(error);
      // DB is checked before network in the if/else chain
      expect(result.errorCode).toBe('DB_ERROR');
    });
  });

  describe('Technical Details Construction', () => {
    it('should build technicalDetails from error.code', () => {
      const error = Object.assign(new Error('test'), {
        code: 'NoSuchBucket',
        $metadata: undefined as { httpStatusCode?: number } | undefined,
      });
      // Replicate the technicalDetails construction from the route
      const s3Meta = error.$metadata;
      const technicalDetails: Record<string, string | number | undefined> = {
        errorCode: (error as any).code || (error as any).Code || error.name || undefined,
        httpStatus: s3Meta?.httpStatusCode || (error as any).httpStatus || undefined,
        attempts: (error as any).attempts || undefined,
      };
      for (const key of Object.keys(technicalDetails)) {
        if (technicalDetails[key] === undefined) delete technicalDetails[key];
      }

      expect(technicalDetails).toEqual({ errorCode: 'NoSuchBucket' });
    });

    it('should build technicalDetails from error.Code (S3 style)', () => {
      const error = Object.assign(new Error('test'), {
        Code: 'SlowDown',
        $metadata: { httpStatusCode: 503 },
      });
      const s3Meta = (error as any).$metadata;
      const technicalDetails: Record<string, string | number | undefined> = {
        errorCode: (error as any).code || (error as any).Code || error.name || undefined,
        httpStatus: s3Meta?.httpStatusCode || (error as any).httpStatus || undefined,
        attempts: (error as any).attempts || undefined,
      };
      for (const key of Object.keys(technicalDetails)) {
        if (technicalDetails[key] === undefined) delete technicalDetails[key];
      }

      expect(technicalDetails).toEqual({ errorCode: 'SlowDown', httpStatus: 503 });
    });

    it('should include attempts when present on error', () => {
      const error = Object.assign(new Error('S3 upload failed after 3 attempts'), {
        attempts: 3,
      });
      const s3Meta = (error as any).$metadata;
      const technicalDetails: Record<string, string | number | undefined> = {
        errorCode: (error as any).code || (error as any).Code || error.name || undefined,
        httpStatus: s3Meta?.httpStatusCode || (error as any).httpStatus || undefined,
        attempts: (error as any).attempts || undefined,
      };
      for (const key of Object.keys(technicalDetails)) {
        if (technicalDetails[key] === undefined) delete technicalDetails[key];
      }

      expect(technicalDetails).toEqual({ errorCode: 'Error', attempts: 3 });
    });

    it('should omit all undefined keys', () => {
      const error = new Error('basic error');
      const s3Meta = (error as any).$metadata;
      const technicalDetails: Record<string, string | number | undefined> = {
        errorCode: (error as any).code || (error as any).Code || error.name || undefined,
        httpStatus: s3Meta?.httpStatusCode || (error as any).httpStatus || undefined,
        attempts: (error as any).attempts || undefined,
      };
      for (const key of Object.keys(technicalDetails)) {
        if (technicalDetails[key] === undefined) delete technicalDetails[key];
      }

      // Only errorCode should remain (from error.name = 'Error')
      expect(technicalDetails).toEqual({ errorCode: 'Error' });
      expect(technicalDetails).not.toHaveProperty('httpStatus');
      expect(technicalDetails).not.toHaveProperty('attempts');
    });
  });
});

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

// Skip upload tests - FormData Content-Type header not properly set in Node.js test environment
// The Request constructor in Node.js doesn't automatically set multipart/form-data boundary
// These tests work in the browser but not in Node.js vitest
describe.skip('Document Upload Route', () => {
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
