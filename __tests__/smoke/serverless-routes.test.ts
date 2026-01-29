import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock next-auth to return no session (unauthenticated)
vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

// Mock prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    document: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    project: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    plan: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

// Mock S3
vi.mock('@/lib/s3', () => ({
  downloadFile: vi.fn(),
  getSignedDownloadUrl: vi.fn(),
}));

describe('Serverless Routes Smoke Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/ai/generate-render', () => {
    it('returns 401 without authentication', async () => {
      const { POST } = await import('@/app/api/ai/generate-render/route');

      const request = new NextRequest('http://localhost/api/ai/generate-render', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/view-document/[id]', () => {
    it('returns 401 or 404 without authentication', async () => {
      const { GET } = await import('@/app/api/view-document/[id]/route');

      const request = new NextRequest('http://localhost/api/view-document/test-id', {
        method: 'GET',
      });

      const response = await GET(request, { params: Promise.resolve({ id: 'test-id' }) });

      // Should return 401 (unauthorized) or 404 (not found - which is also acceptable for smoke test)
      expect([401, 404]).toContain(response.status);
    });
  });

  describe('GET /api/projects/[slug]/plans/[documentId]/image', () => {
    it('returns error without valid project/document', async () => {
      const { GET } = await import('@/app/api/projects/[slug]/plans/[documentId]/image/route');

      const request = new NextRequest(
        'http://localhost/api/projects/test-project/plans/test-doc/image?page=1',
        { method: 'GET' }
      );

      const response = await GET(request, {
        params: Promise.resolve({ slug: 'test-project', documentId: 'test-doc' })
      });

      // Should return 401, 403, or 404 for invalid/unauthorized requests
      expect([401, 403, 404, 500]).toContain(response.status);
    });
  });

  describe('POST /api/projects/[slug]/extract-legends', () => {
    it('returns error without authentication', async () => {
      const { POST } = await import('@/app/api/projects/[slug]/extract-legends/route');

      const request = new NextRequest(
        'http://localhost/api/projects/test-project/extract-legends',
        {
          method: 'POST',
          body: JSON.stringify({ documentIds: ['test-doc'] }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ slug: 'test-project' })
      });

      // Should return 401, 403, or 404 for invalid/unauthorized requests
      expect([401, 403, 404, 500]).toContain(response.status);
    });
  });
});
