import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockPrisma = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  document: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  documentChunk: {
    deleteMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createScopedLogger: vi.fn(() => mockLogger),
}));

const mockS3 = vi.hoisted(() => ({
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
}));

vi.mock('@/lib/s3', () => mockS3);

const mockDocumentProcessor = vi.hoisted(() => ({
  processUnprocessedDocuments: vi.fn(),
}));

vi.mock('@/lib/document-processor', () => mockDocumentProcessor);

const mockDocumentCategorizer = vi.hoisted(() => ({
  suggestDocumentCategory: vi.fn(),
}));

vi.mock('@/lib/document-categorizer', () => mockDocumentCategorizer);

// Import after mocks
import { OneDriveService } from '@/lib/onedrive-service';

describe('OneDriveService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ONEDRIVE_CLIENT_ID = 'test-client-id';
    process.env.ONEDRIVE_CLIENT_SECRET = 'test-client-secret';
    process.env.ONEDRIVE_TENANT_ID = 'test-tenant-id';
    process.env.NEXTAUTH_URL = 'https://example.com';
    mockFetch.mockClear();

    // Mock static properties since they're evaluated at module load
    vi.spyOn(OneDriveService as any, 'CLIENT_ID', 'get').mockReturnValue('test-client-id');
    vi.spyOn(OneDriveService as any, 'CLIENT_SECRET', 'get').mockReturnValue('test-client-secret');
    vi.spyOn(OneDriveService as any, 'TENANT_ID', 'get').mockReturnValue('test-tenant-id');
    vi.spyOn(OneDriveService as any, 'REDIRECT_URI', 'get').mockReturnValue('https://example.com/api/projects/onedrive/callback');
  });

  describe('getAuthUrl', () => {
    it('should generate OAuth authorization URL', () => {
      const url = OneDriveService.getAuthUrl('project-slug');

      // Check URL contains expected components (tenant may be 'common' if env vars not set)
      expect(url).toContain('https://login.microsoftonline.com/');
      expect(url).toContain('oauth2/v2.0/authorize');
      expect(url).toContain('response_type=code');
      expect(url).toContain('state=project-slug');
      expect(url).toContain('scope=Files.ReadWrite');
      expect(url).toContain('offline_access');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange authorization code for tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'access-token-123',
          refresh_token: 'refresh-token-123',
          expires_in: 3600,
        }),
      });

      const result = await OneDriveService.exchangeCodeForTokens('auth-code-123');

      expect(result.accessToken).toBe('access-token-123');
      expect(result.refreshToken).toBe('refresh-token-123');
      expect(result.expiresIn).toBe(3600);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('oauth2/v2.0/token'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
    });

    it('should throw error on failed token exchange', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Invalid authorization code',
      });

      await expect(
        OneDriveService.exchangeCodeForTokens('invalid-code')
      ).rejects.toThrow('Failed to exchange code for tokens');
    });
  });

  describe('fromProject', () => {
    it('should create service instance from project data', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        id: 'project-123',
        oneDriveAccessToken: 'access-token',
        oneDriveRefreshToken: 'refresh-token',
        oneDriveTokenExpiry: new Date('2026-12-31'),
        oneDriveFolderId: 'folder-123',
      });

      const service = await OneDriveService.fromProject('project-123');

      expect(service).toBeInstanceOf(OneDriveService);
      expect(mockPrisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'project-123' },
        select: expect.objectContaining({
          id: true,
          oneDriveAccessToken: true,
          oneDriveRefreshToken: true,
          oneDriveTokenExpiry: true,
          oneDriveFolderId: true,
        }),
      });
    });

    it('should return null if project has no OneDrive tokens', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        id: 'project-123',
        oneDriveAccessToken: null,
        oneDriveRefreshToken: null,
      });

      const service = await OneDriveService.fromProject('project-123');

      expect(service).toBeNull();
    });

    it('should return null if project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce(null);

      const service = await OneDriveService.fromProject('nonexistent');

      expect(service).toBeNull();
    });
  });

  describe('getAccessToken', () => {
    it('should return existing token if not expired', async () => {
      const futureDate = new Date(Date.now() + 3600000);
      const service = new OneDriveService({
        projectId: 'project-123',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        tokenExpiry: futureDate,
      });

      const token = await service.getAccessToken();

      expect(token).toBe('valid-token');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should refresh token if expired', async () => {
      const pastDate = new Date(Date.now() - 3600000);
      const service = new OneDriveService({
        projectId: 'project-123',
        accessToken: 'expired-token',
        refreshToken: 'refresh-token',
        tokenExpiry: pastDate,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          expires_in: 3600,
        }),
      });

      const token = await service.getAccessToken();

      expect(token).toBe('new-access-token');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('oauth2/v2.0/token'),
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(mockPrisma.project.update).toHaveBeenCalled();
    });

    it('should throw error if token refresh fails', async () => {
      const pastDate = new Date(Date.now() - 3600000);
      const service = new OneDriveService({
        projectId: 'project-123',
        accessToken: 'expired-token',
        refreshToken: 'invalid-refresh-token',
        tokenExpiry: pastDate,
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Invalid refresh token',
      });

      await expect(service.getAccessToken()).rejects.toThrow(
        'Failed to refresh OneDrive access token'
      );
    });
  });

  describe('listFolders', () => {
    it('should list folders in OneDrive root', async () => {
      const service = new OneDriveService({
        projectId: 'project-123',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        tokenExpiry: new Date(Date.now() + 3600000),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            { id: 'folder1', name: 'Documents' },
            { id: 'folder2', name: 'Projects' },
          ],
        }),
      });

      const folders = await service.listFolders();

      expect(folders).toHaveLength(2);
      expect(folders[0]).toEqual({ id: 'folder1', name: 'Documents', path: '/Documents' });
      expect(folders[1]).toEqual({ id: 'folder2', name: 'Projects', path: '/Projects' });
    });

    it('should return empty array on error', async () => {
      const service = new OneDriveService({
        projectId: 'project-123',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        tokenExpiry: new Date(Date.now() + 3600000),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const folders = await service.listFolders();

      expect(folders).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('listFilesInFolder', () => {
    it('should throw error if no folder configured', async () => {
      const service = new OneDriveService({
        projectId: 'project-123',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        tokenExpiry: new Date(Date.now() + 3600000),
      });

      await expect(service.listFilesInFolder()).rejects.toThrow(
        'No folder configured for this project'
      );
    });

    it('should list files in configured folder', async () => {
      const service = new OneDriveService({
        projectId: 'project-123',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        tokenExpiry: new Date(Date.now() + 3600000),
        folderId: 'folder-123',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            {
              id: 'file1',
              name: 'document.pdf',
              size: 1024,
              lastModifiedDateTime: '2026-01-15T10:00:00Z',
              '@microsoft.graph.downloadUrl': 'https://download.url',
            },
          ],
        }),
      });

      const files = await service.listFilesInFolder();

      expect(files).toHaveLength(1);
      expect(files[0].name).toBe('document.pdf');
    });
  });

  describe('downloadFile', () => {
    it('should download file from OneDrive', async () => {
      const service = new OneDriveService({
        projectId: 'project-123',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        tokenExpiry: new Date(Date.now() + 3600000),
      });

      const mockBuffer = Buffer.from('file content');
      const arrayBuffer = new ArrayBuffer(mockBuffer.length);
      const view = new Uint8Array(arrayBuffer);
      for (let i = 0; i < mockBuffer.length; i++) {
        view[i] = mockBuffer[i];
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => arrayBuffer,
      });

      const result = await service.downloadFile('file-123');

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString()).toBe('file content');
    });

    it('should throw error on failed download', async () => {
      const service = new OneDriveService({
        projectId: 'project-123',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        tokenExpiry: new Date(Date.now() + 3600000),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(service.downloadFile('file-123')).rejects.toThrow(
        'Failed to download file from OneDrive'
      );
    });
  });

  describe('createFolder', () => {
    it('should create nested folder path', async () => {
      const service = new OneDriveService({
        projectId: 'project-123',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        tokenExpiry: new Date(Date.now() + 3600000),
      });

      // Check for first folder segment returns empty
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });

      // Create first folder
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'folder1-id' }),
      });

      // Check for second folder segment returns empty
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });

      // Create second folder
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'folder2-id' }),
      });

      const folderId = await service.createFolder('Projects/2026');

      expect(folderId).toBe('folder2-id');
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should reuse existing folder', async () => {
      const service = new OneDriveService({
        projectId: 'project-123',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        tokenExpiry: new Date(Date.now() + 3600000),
      });

      // Check returns existing folder
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [{ id: 'existing-folder-id' }] }),
      });

      const folderId = await service.createFolder('Projects');

      expect(folderId).toBe('existing-folder-id');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw error if credentials not configured', async () => {
      // Temporarily mock static properties to return undefined
      vi.spyOn(OneDriveService as any, 'CLIENT_ID', 'get').mockReturnValue('');
      vi.spyOn(OneDriveService as any, 'CLIENT_SECRET', 'get').mockReturnValue('');

      const service = new OneDriveService({
        projectId: 'project-123',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        tokenExpiry: new Date(Date.now() + 3600000),
      });

      await expect(service.createFolder('test')).rejects.toThrow(
        'OneDrive credentials not configured'
      );
    });
  });

  describe('uploadFile', () => {
    it('should upload small file using simple upload', async () => {
      const service = new OneDriveService({
        projectId: 'project-123',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        tokenExpiry: new Date(Date.now() + 3600000),
      });

      const smallBuffer = Buffer.from('small file content');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'uploaded-file-id',
          webUrl: 'https://onedrive.com/file',
        }),
      });

      const result = await service.uploadFile(smallBuffer, 'test.txt');

      expect(result.fileId).toBe('uploaded-file-id');
      expect(result.webUrl).toBe('https://onedrive.com/file');
    });

    it('should upload large file using resumable upload', async () => {
      const service = new OneDriveService({
        projectId: 'project-123',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        tokenExpiry: new Date(Date.now() + 3600000),
      });

      const largeBuffer = Buffer.alloc(5 * 1024 * 1024); // 5MB

      // Create upload session
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uploadUrl: 'https://upload.url' }),
      });

      // Upload chunk
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'uploaded-file-id',
          webUrl: 'https://onedrive.com/file',
        }),
      });

      const result = await service.uploadFile(largeBuffer, 'large-file.bin');

      expect(result.fileId).toBe('uploaded-file-id');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should create folder if folderPath provided', async () => {
      const service = new OneDriveService({
        projectId: 'project-123',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        tokenExpiry: new Date(Date.now() + 3600000),
      });

      const buffer = Buffer.from('content');

      // Check for first folder segment
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });

      // Create first folder
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'folder1-id' }),
      });

      // Check for second folder segment
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });

      // Create second folder
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'folder2-id' }),
      });

      // Upload file
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'file-id', webUrl: 'https://url' }),
      });

      await service.uploadFile(buffer, 'test.txt', 'Projects/2026');

      expect(mockFetch).toHaveBeenCalledTimes(5);
    });
  });

  describe('syncDocuments', () => {
    it('should sync documents from OneDrive folder', async () => {
      const service = new OneDriveService({
        projectId: 'project-123',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        tokenExpiry: new Date(Date.now() + 3600000),
        folderId: 'folder-123',
      });

      // List files
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            {
              id: 'file1',
              name: 'document.pdf',
              size: 1024,
              lastModifiedDateTime: '2026-01-15T10:00:00Z',
              '@microsoft.graph.downloadUrl': 'https://download.url',
            },
          ],
        }),
      });

      // Download file
      const mockBuffer = Buffer.from('file content');
      const arrayBuffer = new ArrayBuffer(mockBuffer.length);
      const view = new Uint8Array(arrayBuffer);
      for (let i = 0; i < mockBuffer.length; i++) {
        view[i] = mockBuffer[i];
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => arrayBuffer,
      });

      mockPrisma.document.findMany.mockResolvedValueOnce([]);

      mockS3.uploadFile.mockResolvedValueOnce('s3://path/to/file');

      mockDocumentCategorizer.suggestDocumentCategory.mockResolvedValueOnce({
        suggestedCategory: 'plans_drawings',
        confidence: 0.9,
      });

      mockPrisma.document.create.mockResolvedValueOnce({
        id: 'doc-123',
        name: 'document.pdf',
      });

      mockDocumentProcessor.processUnprocessedDocuments.mockResolvedValueOnce({
        processed: 1,
        failed: 0,
        errors: [],
      });

      const result = await service.syncDocuments();

      expect(result.added).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.deleted).toBe(0);
      expect(mockPrisma.document.create).toHaveBeenCalled();
    });

    it('should update existing document if modified', async () => {
      const service = new OneDriveService({
        projectId: 'project-123',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        tokenExpiry: new Date(Date.now() + 3600000),
        folderId: 'folder-123',
      });

      const oldDate = new Date('2026-01-01T10:00:00Z');
      const newDate = new Date('2026-01-15T10:00:00Z');

      // List files
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            {
              id: 'file1',
              name: 'document.pdf',
              size: 1024,
              lastModifiedDateTime: newDate.toISOString(),
              '@microsoft.graph.downloadUrl': 'https://download.url',
            },
          ],
        }),
      });

      // Download file
      const mockBuffer = Buffer.from('new content');
      const arrayBuffer = new ArrayBuffer(mockBuffer.length);
      const view = new Uint8Array(arrayBuffer);
      for (let i = 0; i < mockBuffer.length; i++) {
        view[i] = mockBuffer[i];
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => arrayBuffer,
      });

      mockPrisma.document.findMany.mockResolvedValueOnce([
        {
          id: 'doc-123',
          oneDriveId: 'file1',
          oneDriveHash: 'old-hash',
          lastModified: oldDate,
          deletedAt: null,
        },
      ]);

      mockS3.uploadFile.mockResolvedValueOnce('s3://path/to/file');

      mockPrisma.document.update.mockResolvedValueOnce({
        id: 'doc-123',
        name: 'document.pdf',
      });

      mockDocumentProcessor.processUnprocessedDocuments.mockResolvedValueOnce({
        processed: 1,
        failed: 0,
        errors: [],
      });

      const result = await service.syncDocuments();

      expect(result.updated).toBe(1);
      expect(mockPrisma.document.update).toHaveBeenCalled();
      expect(mockPrisma.documentChunk.deleteMany).toHaveBeenCalled();
    });

    it('should skip unsupported file types', async () => {
      const service = new OneDriveService({
        projectId: 'project-123',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        tokenExpiry: new Date(Date.now() + 3600000),
        folderId: 'folder-123',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            {
              id: 'file1',
              name: 'unsupported.exe',
              size: 1024,
              lastModifiedDateTime: '2026-01-15T10:00:00Z',
            },
          ],
        }),
      });

      mockPrisma.document.findMany.mockResolvedValueOnce([]);

      mockDocumentProcessor.processUnprocessedDocuments.mockResolvedValueOnce({
        processed: 0,
        failed: 0,
        errors: [],
      });

      const result = await service.syncDocuments();

      expect(result.added).toBe(0);
      expect(result.updated).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting document processing for synced files'
      );
    });

    it('should soft delete documents no longer in OneDrive', async () => {
      const service = new OneDriveService({
        projectId: 'project-123',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        tokenExpiry: new Date(Date.now() + 3600000),
        folderId: 'folder-123',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });

      mockPrisma.document.findMany.mockResolvedValueOnce([
        {
          id: 'doc-123',
          name: 'deleted-file.pdf',
          oneDriveId: 'file1',
          deletedAt: null,
        },
      ]);

      mockDocumentProcessor.processUnprocessedDocuments.mockResolvedValueOnce({
        processed: 0,
        failed: 0,
        errors: [],
      });

      const result = await service.syncDocuments();

      expect(result.deleted).toBe(1);
      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-123' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should handle sync errors gracefully', async () => {
      const service = new OneDriveService({
        projectId: 'project-123',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        tokenExpiry: new Date(Date.now() + 3600000),
        folderId: 'folder-123',
      });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      mockDocumentProcessor.processUnprocessedDocuments.mockResolvedValueOnce({
        processed: 0,
        failed: 0,
        errors: [],
      });

      const result = await service.syncDocuments();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Error syncing documents');
    });
  });
});
