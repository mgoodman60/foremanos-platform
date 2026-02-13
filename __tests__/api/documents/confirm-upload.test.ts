import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// All mocks defined locally to avoid shared-mocks conflicts
// ============================================

const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  project: { findUnique: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  document: { create: vi.fn(), update: vi.fn() },
}));
const mockRequireProjectPermission = vi.hoisted(() => vi.fn());
const mockCanProcessDocument = vi.hoisted(() => vi.fn());
const mockGetRemainingPages = vi.hoisted(() => vi.fn());
const mockShouldResetQuota = vi.hoisted(() => vi.fn());
const mockGetNextResetDate = vi.hoisted(() => vi.fn());
const mockClassifyDocument = vi.hoisted(() => vi.fn());
const mockProcessDocument = vi.hoisted(() => vi.fn());
const mockGetDocumentMetadata = vi.hoisted(() => vi.fn());
const mockTasksTrigger = vi.hoisted(() => vi.fn());
const mockCalculateFileHash = vi.hoisted(() => vi.fn());
const mockIsDuplicate = vi.hoisted(() => vi.fn());
const mockScanFileBuffer = vi.hoisted(() => vi.fn());
const mockLogSecurityEvent = vi.hoisted(() => vi.fn());
const mockShouldBlockMacroFile = vi.hoisted(() => vi.fn());
const mockDownloadFile = vi.hoisted(() => vi.fn());
const mockDeleteFile = vi.hoisted(() => vi.fn());
const mockCreateS3Client = vi.hoisted(() => vi.fn());
const mockGetBucketConfig = vi.hoisted(() => vi.fn());
const mockValidateS3Config = vi.hoisted(() => vi.fn());
const mockSendDocumentUploadNotification = vi.hoisted(() => vi.fn());
const mockMarkDocumentUploaded = vi.hoisted(() => vi.fn());

vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }));
vi.mock('@/lib/auth-options', () => ({ authOptions: {} }));
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
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
vi.mock('@/lib/document-processor', () => ({
  processDocument: mockProcessDocument,
  getDocumentMetadata: mockGetDocumentMetadata,
}));
vi.mock('@trigger.dev/sdk/v3', () => ({
  tasks: { trigger: mockTasksTrigger },
  task: vi.fn(),
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
  configure: vi.fn(),
}));
vi.mock('@/src/trigger/process-document', () => ({
  processDocumentTask: { id: 'process-document' },
}));
vi.mock('@/lib/duplicate-detector', () => ({
  calculateFileHash: mockCalculateFileHash,
  isDuplicate: mockIsDuplicate,
}));
vi.mock('@/lib/virus-scanner', () => ({
  scanFileBuffer: mockScanFileBuffer,
  logSecurityEvent: mockLogSecurityEvent,
}));
vi.mock('@/lib/macro-detector', () => ({
  shouldBlockMacroFile: mockShouldBlockMacroFile,
}));
vi.mock('@/lib/s3', () => ({
  downloadFile: mockDownloadFile,
  deleteFile: mockDeleteFile,
}));
vi.mock('@/lib/aws-config', () => ({
  createS3Client: mockCreateS3Client,
  getBucketConfig: mockGetBucketConfig,
  validateS3Config: mockValidateS3Config,
}));
vi.mock('@aws-sdk/client-s3', () => ({
  HeadObjectCommand: vi.fn().mockImplementation((params: any) => params),
}));
vi.mock('@/lib/email-service', () => ({
  sendDocumentUploadNotification: mockSendDocumentUploadNotification,
}));
vi.mock('@/lib/onboarding-tracker', () => ({
  markDocumentUploaded: mockMarkDocumentUploaded,
}));
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createScopedLogger: vi.fn().mockReturnValue({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 10 }),
  RATE_LIMITS: { UPLOAD: { maxRequests: 10, windowMs: 60000 }, API: { maxRequests: 60, windowMs: 60000 }, AUTH: { maxRequests: 5, windowMs: 300000 }, CHAT: { maxRequests: 20, windowMs: 60000 } },
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  getRateLimitIdentifier: vi.fn().mockReturnValue('test-user'),
}));

import { POST } from '@/app/api/documents/confirm-upload/route';

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

const mockDocument = {
  id: 'doc-1',
  name: 'test-plan',
  fileName: 'test-plan.pdf',
  fileType: 'pdf',
  projectId: 'project-1',
  processed: false,
  cloud_storage_path: 'uploads/abc123/test-plan.pdf',
};

const testBuffer = Buffer.from('fake pdf content for testing');

function createConfirmRequest(body: Record<string, any>): Request {
  return new Request('http://localhost:3000/api/documents/confirm-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createInvalidJsonRequest(): Request {
  return new Request('http://localhost:3000/api/documents/confirm-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ broken json @@@',
  });
}

const validBody = {
  cloudStoragePath: 'uploads/abc123/test-plan.pdf',
  fileName: 'test-plan.pdf',
  fileSize: 1024 * 500,
  projectId: 'project-1',
  category: 'plans',
};

// ============================================
// Tests
// ============================================

describe('Confirm Upload Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Happy-path defaults
    mockGetServerSession.mockResolvedValue(mockSession);
    mockGetBucketConfig.mockReturnValue({ bucketName: 'foremanos-documents', folderPrefix: '' });
    mockValidateS3Config.mockReturnValue({ valid: true, missing: [] });
    mockPrisma.project.findUnique.mockResolvedValue(mockProject);
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.user.update.mockResolvedValue(mockUser);
    mockPrisma.document.create.mockResolvedValue(mockDocument);
    mockPrisma.document.update.mockResolvedValue(mockDocument);
    mockRequireProjectPermission.mockResolvedValue({ allowed: true, access: { role: 'owner' } });
    mockCanProcessDocument.mockResolvedValue({ allowed: true, reason: '' });
    mockGetRemainingPages.mockReturnValue(1950);
    mockShouldResetQuota.mockResolvedValue(false);
    mockGetNextResetDate.mockReturnValue(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    mockClassifyDocument.mockResolvedValue({ processorType: 'pdf', category: 'plans' });
    mockProcessDocument.mockResolvedValue(undefined);
    mockGetDocumentMetadata.mockResolvedValue({ totalPages: 5, processorType: 'vision-ai' });
    mockTasksTrigger.mockResolvedValue({ id: 'test-run-id' });
    mockCalculateFileHash.mockReturnValue('hash-abc-123');
    mockIsDuplicate.mockResolvedValue(false);
    mockScanFileBuffer.mockResolvedValue({ clean: true, engine: 'clamav' });
    mockShouldBlockMacroFile.mockReturnValue({ blocked: false });
    mockDeleteFile.mockResolvedValue(undefined);
    mockSendDocumentUploadNotification.mockResolvedValue(undefined);
    mockMarkDocumentUploaded.mockResolvedValue(undefined);

    // S3 Head check: mock client.send() resolves
    const mockS3Send = vi.fn().mockResolvedValue({});
    mockCreateS3Client.mockReturnValue({ send: mockS3Send });

    // Download file for security scanning
    mockDownloadFile.mockResolvedValue(testBuffer);
  });

  // ============================================
  // Authentication
  // ============================================
  describe('Authentication', () => {
    it('should return 401 when no session exists', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = createConfirmRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when session has no user', async () => {
      mockGetServerSession.mockResolvedValue({ expires: 'sometime' });

      const request = createConfirmRequest(validBody);
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
      expect(data.error).toContain('Invalid request body');
    });

    it('should return 400 when required fields are missing', async () => {
      const request = createConfirmRequest({ cloudStoragePath: 'uploads/test.pdf' });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Missing required fields');
    });

    it('should return 400 when cloudStoragePath contains path traversal (..)', async () => {
      const request = createConfirmRequest({
        ...validBody,
        cloudStoragePath: '../../../etc/passwd',
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid cloud storage path');
    });

    it('should return 400 when cloudStoragePath contains backslash', async () => {
      const request = createConfirmRequest({
        ...validBody,
        cloudStoragePath: 'uploads\\test.pdf',
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid cloud storage path');
    });
  });

  // ============================================
  // S3 Configuration
  // ============================================
  describe('S3 Configuration', () => {
    it('should return 503 when bucket name is not configured', async () => {
      mockGetBucketConfig.mockReturnValue({ bucketName: '', folderPrefix: '' });

      const request = createConfirmRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toContain('storage is not configured');
    });

    it('should return 503 when S3 credentials are missing', async () => {
      mockValidateS3Config.mockReturnValue({ valid: false, missing: ['AWS_ACCESS_KEY_ID'] });

      const request = createConfirmRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toContain('credentials are not fully configured');
    });
  });

  // ============================================
  // Project Permission
  // ============================================
  describe('Project Permission', () => {
    it('should return 404 when project does not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const request = createConfirmRequest(validBody);
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

      const request = createConfirmRequest(validBody);
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

      const request = createConfirmRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(mockRequireProjectPermission).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // File Verification in R2
  // ============================================
  describe('File Verification', () => {
    it('should return 404 when file not found in R2', async () => {
      const mockS3Send = vi.fn().mockRejectedValue(new Error('NotFound'));
      mockCreateS3Client.mockReturnValue({ send: mockS3Send });

      const request = createConfirmRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('not found in storage');
    });
  });

  // ============================================
  // File Download for Scanning
  // ============================================
  describe('File Download', () => {
    it('should return 500 when file download fails', async () => {
      mockDownloadFile.mockRejectedValue(new Error('Download failed'));

      const request = createConfirmRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Failed to retrieve uploaded file');
    });
  });

  // ============================================
  // Virus Detection
  // ============================================
  describe('Virus Detection', () => {
    it('should return 451 when virus detected', async () => {
      mockScanFileBuffer.mockResolvedValue({
        clean: false,
        engine: 'clamav',
        threat: 'Eicar-Test-Signature',
      });

      const request = createConfirmRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(451);
      const data = await response.json();
      expect(data.error).toContain('security threat detected');
      expect(data.threat).toBe('Eicar-Test-Signature');
    });

    it('should delete file from R2 after virus detection', async () => {
      mockScanFileBuffer.mockResolvedValue({
        clean: false,
        engine: 'clamav',
        threat: 'Trojan.Generic',
      });

      const request = createConfirmRequest(validBody);
      await POST(request);

      expect(mockDeleteFile).toHaveBeenCalledWith('uploads/abc123/test-plan.pdf');
      expect(mockLogSecurityEvent).toHaveBeenCalledWith(
        'VIRUS_DETECTED',
        expect.objectContaining({ fileName: 'test-plan.pdf', threat: 'Trojan.Generic' })
      );
    });
  });

  // ============================================
  // Macro Detection
  // ============================================
  describe('Macro Detection', () => {
    it('should return 415 when macros detected', async () => {
      mockShouldBlockMacroFile.mockReturnValue({
        blocked: true,
        reason: 'File contains VBA macros',
      });

      const request = createConfirmRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(415);
      const data = await response.json();
      expect(data.error).toContain('macros detected');
      expect(data.message).toContain('VBA macros');
    });

    it('should delete file from R2 after macro detection', async () => {
      mockShouldBlockMacroFile.mockReturnValue({
        blocked: true,
        reason: 'File contains VBA macros',
      });

      const request = createConfirmRequest(validBody);
      await POST(request);

      expect(mockDeleteFile).toHaveBeenCalledWith('uploads/abc123/test-plan.pdf');
      expect(mockLogSecurityEvent).toHaveBeenCalledWith(
        'MACRO_BLOCKED',
        expect.objectContaining({ fileName: 'test-plan.pdf' })
      );
    });
  });

  // ============================================
  // Duplicate Detection
  // ============================================
  describe('Duplicate Detection', () => {
    it('should return 409 when duplicate found', async () => {
      mockIsDuplicate.mockResolvedValue(true);

      const request = createConfirmRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toContain('Duplicate document');
    });

    it('should delete file from R2 after duplicate detection', async () => {
      mockIsDuplicate.mockResolvedValue(true);

      const request = createConfirmRequest(validBody);
      await POST(request);

      expect(mockDeleteFile).toHaveBeenCalledWith('uploads/abc123/test-plan.pdf');
    });
  });

  // ============================================
  // Quota Check
  // ============================================
  describe('Quota Check', () => {
    it('should return 404 when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const request = createConfirmRequest(validBody);
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

      const request = createConfirmRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Processing quota exceeded');
      expect(data.remainingPages).toBe(0);
    });
  });

  // ============================================
  // Success Case
  // ============================================
  describe('Success', () => {
    it('should create Document record in DB and return 201', async () => {
      const request = createConfirmRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(mockPrisma.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fileName: 'test-plan.pdf',
            projectId: 'project-1',
            cloud_storage_path: 'uploads/abc123/test-plan.pdf',
            processed: false,
            queueStatus: 'pending',
            virusStatus: 'clean',
          }),
        })
      );
    });

    it('should trigger Trigger.dev task for document processing', async () => {
      const request = createConfirmRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(mockTasksTrigger).toHaveBeenCalledWith(
        'process-document',
        expect.objectContaining({
          documentId: mockDocument.id,
          totalPages: 5,
          processorType: 'vision-ai',
        })
      );
    });

    it('should return correct response shape', async () => {
      const request = createConfirmRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();

      expect(data).toHaveProperty('Document');
      expect(data.Document).toHaveProperty('id');
      expect(data.Document).toHaveProperty('name');
      expect(data.Document).toHaveProperty('fileName');

      expect(data).toHaveProperty('message');
      expect(data.message).toContain('successfully');

      expect(data).toHaveProperty('processingInfo');
      expect(data.processingInfo).toHaveProperty('estimatedPages');
      expect(data.processingInfo).toHaveProperty('processorType');
      expect(data.processingInfo).toHaveProperty('remainingPages');
      expect(data.processingInfo).toHaveProperty('tier');
    });
  });

  // ============================================
  // Path Traversal Edge Cases
  // ============================================
  describe('Path Traversal Security', () => {
    it('should reject absolute Unix paths', async () => {
      const request = createConfirmRequest({
        ...validBody,
        cloudStoragePath: '/etc/passwd',
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid cloud storage path');
    });

    it('should reject absolute Windows paths', async () => {
      const request = createConfirmRequest({
        ...validBody,
        cloudStoragePath: 'C:\\Windows\\System32\\config',
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should reject paths with null bytes', async () => {
      const request = createConfirmRequest({
        ...validBody,
        cloudStoragePath: 'uploads/test\0.pdf',
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  // ============================================
  // Non-blocking Error Handling
  // ============================================
  describe('Non-blocking Error Handling', () => {
    it('should continue processing when virus scan throws (non-blocking)', async () => {
      mockScanFileBuffer.mockRejectedValue(new Error('Scan engine unavailable'));

      const request = createConfirmRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    it('should continue processing when macro detection throws (non-blocking)', async () => {
      mockShouldBlockMacroFile.mockImplementation(() => {
        throw new Error('Macro detection failed');
      });

      const request = createConfirmRequest(validBody);
      const response = await POST(request);

      expect(response.status).toBe(201);
    });
  });
});
