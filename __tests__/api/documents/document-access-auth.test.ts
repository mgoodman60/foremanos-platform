import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  prismaMock,
  getServerSessionMock,
} from '../../mocks/shared-mocks';

// Mock modules that cause OpenAI SDK instantiation at import time
vi.mock('@/lib/document-auto-sync', () => ({
  handleDocumentDeletion: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/docx-converter', () => ({
  convertDocxToPdf: vi.fn(),
  isConversionSupported: vi.fn().mockReturnValue(false),
}));
vi.mock('@/lib/aws-config', () => ({
  createS3Client: vi.fn(),
  getBucketConfig: vi.fn().mockReturnValue({ bucket: 'test', prefix: '' }),
}));

import { GET } from '@/app/api/documents/[id]/route';

describe('Document Access Auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/documents/[id]', () => {
    it('should return 401 when no session exists', async () => {
      getServerSessionMock.mockResolvedValue(null);

      const request = new Request('http://localhost/api/documents/doc-1', {
        method: 'GET',
      });

      const response = await GET(request as any, { params: Promise.resolve({ id: 'doc-1' }) });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when session has no user', async () => {
      getServerSessionMock.mockResolvedValue({ expires: '2026-12-31' });

      const request = new Request('http://localhost/api/documents/doc-1', {
        method: 'GET',
      });

      const response = await GET(request as any, { params: Promise.resolve({ id: 'doc-1' }) });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when document not found', async () => {
      getServerSessionMock.mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'admin' },
        expires: '2026-12-31',
      });
      prismaMock.document.findUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/documents/nonexistent', {
        method: 'GET',
      });

      const response = await GET(request as any, { params: Promise.resolve({ id: 'nonexistent' }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Document not found');
    });

    it('should return 403 for guest user accessing non-guest document', async () => {
      getServerSessionMock.mockResolvedValue({
        user: { id: 'guest-1', email: 'guest@example.com', role: 'guest' },
        expires: '2026-12-31',
      });
      prismaMock.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        name: 'Test Doc',
        fileName: 'test.pdf',
        fileType: 'pdf',
        accessLevel: 'admin',
        filePath: null,
        cloud_storage_path: null,
        isPublic: false,
        fileSize: 1024,
      });

      const request = new Request('http://localhost/api/documents/doc-1', {
        method: 'GET',
      });

      const response = await GET(request as any, { params: Promise.resolve({ id: 'doc-1' }) });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Access denied');
    });

    it('should not call prisma when session is null (early return)', async () => {
      getServerSessionMock.mockResolvedValue(null);

      const request = new Request('http://localhost/api/documents/doc-1', {
        method: 'GET',
      });

      await GET(request as any, { params: Promise.resolve({ id: 'doc-1' }) });

      expect(prismaMock.document.findUnique).not.toHaveBeenCalled();
    });
  });
});
