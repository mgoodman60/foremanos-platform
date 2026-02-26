import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// All mocks defined locally to avoid shared-mocks conflicts
// ============================================

const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  project: { findUnique: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
}));
const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockGetClientIp = vi.hoisted(() => vi.fn());
const mockCreateRateLimitHeaders = vi.hoisted(() => vi.fn());
const mockRequireProjectPermission = vi.hoisted(() => vi.fn());
const mockCanProcessDocument = vi.hoisted(() => vi.fn());
const mockGetRemainingPages = vi.hoisted(() => vi.fn());
const mockShouldResetQuota = vi.hoisted(() => vi.fn());
const mockGetNextResetDate = vi.hoisted(() => vi.fn());
const mockClassifyDocument = vi.hoisted(() => vi.fn());
const mockGeneratePresignedUploadUrl = vi.hoisted(() => vi.fn());
const mockGetBucketConfig = vi.hoisted(() => vi.fn());
const mockValidateS3Config = vi.hoisted(() => vi.fn());

vi.mock('@/auth', () => ({ auth: mockGetServerSession }));
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: mockCheckRateLimit,
  getClientIp: mockGetClientIp,
  createRateLimitHeaders: mockCreateRateLimitHeaders,
  RATE_LIMITS: { UPLOAD: { maxRequests: 10, windowSeconds: 60 } },
}));
vi.mock('@/lib/project-permissions', () => ({
  requireProjectPermission: mockRequireProjectPermission,
}));
vi.mock('@/lib/retry-util', () => ({
  withDatabaseRetry: vi.fn((fn: any) => fn()),
}));
vi.mock('@/lib/processing-limits', () => ({
  canProcessDocument: mockCanProcessDocument,
  getRemainingPages: mockGetRemainingPages,
  shouldResetQuota: mockShouldResetQuota,
  getNextResetDate: mockGetNextResetDate,
  getProcessingLimits: vi.fn().mockReturnValue({ pagesPerMonth: 2000 }),
}));
vi.mock('@/lib/document-classifier', () => ({
  classifyDocument: mockClassifyDocument,
}));
vi.mock('@/lib/s3', () => ({
  generatePresignedUploadUrl: mockGeneratePresignedUploadUrl,
}));
vi.mock('@/lib/aws-config', () => ({
  getBucketConfig: mockGetBucketConfig,
  validateS3Config: mockValidateS3Config,
  createS3Client: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createScopedLogger: vi.fn().mockReturnValue({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { POST } from '@/app/api/documents/presign/route';

// ============================================
// Helpers
// ============================================

const mockSession = {
  user: { id: 'user-1', email: 'test@example.com', username: 'testuser', role: 'client' },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

const mockProject = {
  id: 'project-1',
  name: 'Test Project',
  slug: 'test-project',
  ownerId: 'user-1',
};

const mockUser = {
  id: 'user-1',
  subscriptionTier: 'pro',
  pagesProcessedThisMonth: 50,
  processingResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
};

function createPresignRequest(body: Record<string, any>): Request {
  return new Request('http://localhost:3000/api/documents/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createInvalidJsonRequest(): Request {
  return new Request('http://localhost:3000/api/documents/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ invalid json !!!',
  });
}

const validBody = {
  fileName: 'test-plan.pdf',
  fileSize: 1024 * 500, // 500KB
  contentType: 'application/pdf',
  projectId: 'project-1',
  category: 'plans',
};

// ============================================
// Tests
// ============================================

describe('Presign Upload URL Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Happy-path defaults
    mockGetServerSession.mockResolvedValue(mockSession);
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: Math.floor(Date.now() / 1000) + 60 });
    mockGetClientIp.mockReturnValue('127.0.0.1');
    mockCreateRateLimitHeaders.mockReturnValue({});
    mockGetBucketConfig.mockReturnValue({ bucketName: 'foremanos-documents', folderPrefix: '' });
    mockValidateS3Config.mockReturnValue({ valid: true, missing: [] });
    mockPrisma.project.findUnique.mockResolvedValue(mockProject);
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.user.update.mockResolvedValue(mockUser);
    mockRequireProjectPermission.mockResolvedValue({ allowed: true, access: { role: 'owner' } });
    mockCanProcessDocument.mockResolvedValue({ allowed: true, reason: '' });
    mockGetRemainingPages.mockReturnValue(1950);
    mockShouldResetQuota.mockResolvedValue(false);
    mockGetNextResetDate.mockReturnValue(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    mockClassifyDocument.mockResolvedValue({ processorType: 'pdf', category: 'plans' });
    mockGeneratePresignedUploadUrl.mockResolvedValue({
      uploadUrl: 'https://r2.example.com/presigned-put-url',
      cloud_storage_path: 'uploads/abc123/test-plan.pdf',
    });
  });

  // ============================================
  // Rate Limiting
  // ============================================
  describe('Rate Limiting', () => {
    it('should return 429 when rate limit exceeded', async () => {
      mockCheckRateLimit.mockResolvedValue({ success: false, limit: 10, remaining: 0, reset: Math.floor(Date.now() / 1000) + 60 });

      const request = createPresignRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toContain('Too many upload attempts');
    });
  });

  // ============================================
  // Authentication
  // ============================================
  describe('Authentication', () => {
    it('should return 401 when no session exists', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = createPresignRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when session has no user', async () => {
      mockGetServerSession.mockResolvedValue({ expires: 'sometime' });

      const request = createPresignRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  // ============================================
  // Request Validation
  // ============================================
  describe('Request Validation', () => {
    it('should return 400 when body is invalid JSON', async () => {
      const request = createInvalidJsonRequest();
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid JSON');
    });

    it('should return 400 when fileName is missing', async () => {
      const { fileName, ...bodyWithoutFileName } = validBody;
      const request = createPresignRequest(bodyWithoutFileName);
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('fileName');
    });

    it('should return 400 when fileSize is missing', async () => {
      const { fileSize, ...bodyWithoutSize } = validBody;
      const request = createPresignRequest(bodyWithoutSize);
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('fileSize');
    });

    it('should return 400 when contentType is missing', async () => {
      const { contentType, ...bodyWithoutType } = validBody;
      const request = createPresignRequest(bodyWithoutType);
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('contentType');
    });

    it('should return 400 when projectId is missing', async () => {
      const { projectId, ...bodyWithoutProject } = validBody;
      const request = createPresignRequest(bodyWithoutProject);
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('projectId');
    });
  });

  // ============================================
  // S3 Configuration
  // ============================================
  describe('S3 Configuration', () => {
    it('should return 503 when bucket name is not configured', async () => {
      mockGetBucketConfig.mockReturnValue({ bucketName: '', folderPrefix: '' });

      const request = createPresignRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toContain('storage is not configured');
    });

    it('should return 503 when S3 credentials are missing', async () => {
      mockValidateS3Config.mockReturnValue({ valid: false, missing: ['AWS_ACCESS_KEY_ID'] });

      const request = createPresignRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toContain('credentials are not fully configured');
    });
  });

  // ============================================
  // MIME Type Validation
  // ============================================
  describe('MIME Type Validation', () => {
    it('should return 415 for disallowed MIME types', async () => {
      const request = createPresignRequest({
        ...validBody,
        contentType: 'application/javascript',
      });
      const response = await POST(request);

      expect(response.status).toBe(415);
      const data = await response.json();
      expect(data.error).toContain('Invalid file type');
    });

    it('should accept allowed MIME types (pdf)', async () => {
      const request = createPresignRequest({ ...validBody, contentType: 'application/pdf' });
      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('should accept allowed MIME types (jpeg)', async () => {
      const request = createPresignRequest({ ...validBody, contentType: 'image/jpeg' });
      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('should accept allowed MIME types (png)', async () => {
      const request = createPresignRequest({ ...validBody, contentType: 'image/png' });
      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });

  // ============================================
  // File Size Validation
  // ============================================
  describe('File Size Validation', () => {
    it('should return 413 when file size exceeds 200MB', async () => {
      const request = createPresignRequest({
        ...validBody,
        fileSize: 209715201, // > 200MB
      });
      const response = await POST(request);

      expect(response.status).toBe(413);
      const data = await response.json();
      expect(data.error).toContain('File too large');
    });

    it('should accept files at exactly 200MB', async () => {
      const request = createPresignRequest({
        ...validBody,
        fileSize: 209715200, // exactly 200MB
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  // ============================================
  // Project Permission
  // ============================================
  describe('Project Permission', () => {
    it('should return 404 when project does not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const request = createPresignRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Project not found');
    });

    it('should return 403 when user lacks upload permission', async () => {
      mockRequireProjectPermission.mockResolvedValue({
        allowed: false,
        access: { role: 'viewer' },
      });

      const request = createPresignRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('permission');
      expect(data.yourRole).toBe('viewer');
    });

    it('should allow admin to bypass permission check', async () => {
      mockGetServerSession.mockResolvedValue({
        ...mockSession,
        user: { ...mockSession.user, role: 'admin' },
      });

      const request = createPresignRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockRequireProjectPermission).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Quota Check
  // ============================================
  describe('Quota Check', () => {
    it('should return 404 when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const request = createPresignRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('User not found');
    });

    it('should return 403 when processing quota exceeded', async () => {
      mockCanProcessDocument.mockResolvedValue({
        allowed: false,
        reason: 'Monthly processing quota exceeded',
      });
      mockGetRemainingPages.mockReturnValue(0);

      const request = createPresignRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Processing quota exceeded');
      expect(data.remainingPages).toBe(0);
      expect(data.tier).toBeDefined();
    });
  });

  // ============================================
  // Quota Reset
  // ============================================
  describe('Quota Reset', () => {
    it('should reset quota before checking if due', async () => {
      mockShouldResetQuota.mockResolvedValue(true);

      const request = createPresignRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pagesProcessedThisMonth: 0,
          }),
        })
      );
    });
  });

  // ============================================
  // Success Case
  // ============================================
  describe('Success', () => {
    it('should return presigned URL, cloudStoragePath, and expiresAt', async () => {
      const request = createPresignRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.uploadUrl).toBe('https://r2.example.com/presigned-put-url');
      expect(data.cloudStoragePath).toBe('uploads/abc123/test-plan.pdf');
      expect(data.expiresAt).toBeDefined();
      const expiresAt = new Date(data.expiresAt);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should call generatePresignedUploadUrl with correct arguments', async () => {
      const request = createPresignRequest(validBody);
      await POST(request);

      expect(mockGeneratePresignedUploadUrl).toHaveBeenCalledWith(
        'test-plan.pdf',
        'application/pdf',
        false,
        3600
      );
    });

    it('should classify document before quota check', async () => {
      const request = createPresignRequest(validBody);
      await POST(request);

      expect(mockClassifyDocument).toHaveBeenCalledWith('test-plan.pdf', 'pdf');
    });
  });

  // ============================================
  // Error Handling
  // ============================================
  describe('Error Handling', () => {
    it('should return 500 when an unexpected error occurs', async () => {
      mockGeneratePresignedUploadUrl.mockRejectedValue(new Error('Unexpected S3 error'));

      const request = createPresignRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Failed to generate upload URL');
    });
  });
});
