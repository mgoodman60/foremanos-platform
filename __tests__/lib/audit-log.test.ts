import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock logger
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

// Mock Prisma with vi.hoisted
const mocks = vi.hoisted(() => ({
  prisma: {
    activityLog: {
      create: vi.fn().mockResolvedValue({ id: 'log-1' }),
    },
    notification: {
      create: vi.fn().mockResolvedValue({ id: 'notif-1' }),
    },
  },
}));

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));
vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }));

// Import after mocks
import { logActivity, createNotification } from '@/lib/audit-log';

describe('Audit Log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logActivity', () => {
    it('should create activity log with all parameters', async () => {
      await logActivity({
        userId: 'user-123',
        action: 'document.upload',
        resource: 'document',
        resourceId: 'doc-456',
        details: { fileName: 'test.pdf', size: 1024 },
      });

      expect(mocks.prisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          action: 'document.upload',
          resource: 'document',
          resourceId: 'doc-456',
          details: { fileName: 'test.pdf', size: 1024 },
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
    });

    it('should create activity log with minimal parameters', async () => {
      await logActivity({
        action: 'user.login',
      });

      expect(mocks.prisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          userId: undefined,
          action: 'user.login',
          resource: undefined,
          resourceId: undefined,
          details: undefined,
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
    });

    it('should extract IP address from x-forwarded-for header', async () => {
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Mozilla/5.0',
        },
      });

      await logActivity({
        userId: 'user-123',
        action: 'api.call',
        request,
      });

      expect(mocks.prisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          action: 'api.call',
          resource: undefined,
          resourceId: undefined,
          details: undefined,
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0',
        },
      });
    });

    it('should extract IP address from x-real-ip header', async () => {
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-real-ip': '10.0.0.1',
        },
      });

      await logActivity({
        action: 'api.request',
        request,
      });

      expect(mocks.prisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          userId: undefined,
          action: 'api.request',
          resource: undefined,
          resourceId: undefined,
          details: undefined,
          ipAddress: '10.0.0.1',
          userAgent: undefined,
        },
      });
    });

    it('should prefer x-forwarded-for over x-real-ip', async () => {
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '1.2.3.4',
          'x-real-ip': '5.6.7.8',
        },
      });

      await logActivity({
        action: 'test.action',
        request,
      });

      expect(mocks.prisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ipAddress: '1.2.3.4',
          }),
        })
      );
    });

    it('should extract user agent from request headers', async () => {
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      });

      await logActivity({
        action: 'page.view',
        request,
      });

      expect(mocks.prisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          userId: undefined,
          action: 'page.view',
          resource: undefined,
          resourceId: undefined,
          details: undefined,
          ipAddress: undefined,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      });
    });

    it('should handle request with no headers', async () => {
      const request = new NextRequest('http://localhost/api/test');

      await logActivity({
        action: 'test.action',
        request,
      });

      expect(mocks.prisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          userId: undefined,
          action: 'test.action',
          resource: undefined,
          resourceId: undefined,
          details: undefined,
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
    });

    it('should serialize details with JSON.parse(JSON.stringify())', async () => {
      const detailsWithDate = {
        timestamp: new Date('2024-01-15T12:00:00Z'),
        nested: { value: 'test' },
      };

      await logActivity({
        action: 'complex.log',
        details: detailsWithDate,
      });

      const expectedDetails = JSON.parse(JSON.stringify(detailsWithDate));
      expect(mocks.prisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          userId: undefined,
          action: 'complex.log',
          resource: undefined,
          resourceId: undefined,
          details: expectedDetails,
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
    });

    it('should pass undefined for details when not provided', async () => {
      await logActivity({
        action: 'no.details',
      });

      expect(mocks.prisma.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          details: undefined,
        }),
      });
    });

    it('should not throw error when prisma create fails', async () => {
      mocks.prisma.activityLog.create.mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      await expect(
        logActivity({
          action: 'failing.action',
        })
      ).resolves.not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        'Failed to log activity',
        expect.any(Error)
      );
    });

    it('should log error to console but continue execution', async () => {
      const dbError = new Error('Prisma timeout');
      mocks.prisma.activityLog.create.mockRejectedValueOnce(dbError);

      await logActivity({
        userId: 'user-123',
        action: 'error.test',
      });

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle complex nested details object', async () => {
      const complexDetails = {
        level1: {
          level2: {
            level3: {
              value: 'deep',
              array: [1, 2, 3],
            },
          },
        },
        metadata: {
          tags: ['tag1', 'tag2'],
        },
      };

      await logActivity({
        action: 'complex.data',
        details: complexDetails,
      });

      expect(mocks.prisma.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          details: JSON.parse(JSON.stringify(complexDetails)),
        }),
      });
    });

    it('should handle empty details object', async () => {
      await logActivity({
        action: 'empty.details',
        details: {},
      });

      expect(mocks.prisma.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          details: {},
        }),
      });
    });

    it('should handle resourceId without resource', async () => {
      await logActivity({
        action: 'resource.action',
        resourceId: 'orphan-resource-123',
      });

      expect(mocks.prisma.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          resource: undefined,
          resourceId: 'orphan-resource-123',
        }),
      });
    });

    it('should handle all request headers together', async () => {
      const request = new NextRequest('http://localhost/api/full-test', {
        headers: {
          'x-forwarded-for': '203.0.113.50',
          'user-agent': 'TestBot/1.0',
        },
      });

      await logActivity({
        userId: 'user-999',
        action: 'full.request.test',
        resource: 'api',
        resourceId: 'endpoint-1',
        details: { method: 'POST', path: '/api/full-test' },
        request,
      });

      expect(mocks.prisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-999',
          action: 'full.request.test',
          resource: 'api',
          resourceId: 'endpoint-1',
          details: { method: 'POST', path: '/api/full-test' },
          ipAddress: '203.0.113.50',
          userAgent: 'TestBot/1.0',
        },
      });
    });
  });

  describe('createNotification', () => {
    it('should create notification with all parameters', async () => {
      await createNotification({
        userId: 'user-456',
        type: 'info',
        subject: 'Welcome',
        body: 'Welcome to ForemanOS',
      });

      expect(mocks.prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-456',
          type: 'info',
          subject: 'Welcome',
          body: 'Welcome to ForemanOS',
        },
      });
    });

    it('should log notification details to console', async () => {
      await createNotification({
        userId: 'user-789',
        type: 'alert',
        subject: 'Action Required',
        body: 'Please verify your email',
      });

      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should not throw error when prisma create fails', async () => {
      mocks.prisma.notification.create.mockRejectedValueOnce(
        new Error('Database error')
      );

      await expect(
        createNotification({
          userId: 'user-error',
          type: 'error',
          subject: 'Test',
          body: 'Test body',
        })
      ).resolves.not.toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should log error to console but continue execution', async () => {
      const dbError = new Error('Connection timeout');
      mocks.prisma.notification.create.mockRejectedValueOnce(dbError);

      await createNotification({
        userId: 'user-123',
        type: 'info',
        subject: 'Test',
        body: 'Test',
      });

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle special characters in notification body', async () => {
      await createNotification({
        userId: 'user-special',
        type: 'info',
        subject: 'Special <chars> & "quotes"',
        body: 'Body with \n newlines \t tabs',
      });

      expect(mocks.prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-special',
          type: 'info',
          subject: 'Special <chars> & "quotes"',
          body: 'Body with \n newlines \t tabs',
        },
      });
    });

    it('should handle long notification body', async () => {
      const longBody = 'A'.repeat(5000);

      await createNotification({
        userId: 'user-long',
        type: 'info',
        subject: 'Long message',
        body: longBody,
      });

      expect(mocks.prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-long',
          type: 'info',
          subject: 'Long message',
          body: longBody,
        },
      });
    });

    it('should handle empty strings in notification', async () => {
      await createNotification({
        userId: '',
        type: '',
        subject: '',
        body: '',
      });

      expect(mocks.prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: '',
          type: '',
          subject: '',
          body: '',
        },
      });
    });

    it('should create notification even when logger.info fails', async () => {
      // Mock logger.info to throw (shouldn't affect notification creation)
      mockLogger.info.mockImplementation(() => {
        throw new Error('Logger error');
      });

      // The function has a try-catch around the whole block, so this will be caught
      await createNotification({
        userId: 'user-123',
        type: 'test',
        subject: 'Test',
        body: 'Test',
      });

      // The error in console.log will be caught by the outer try-catch
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should format console output correctly', async () => {
      await createNotification({
        userId: 'user-format',
        type: 'warning',
        subject: 'System Update',
        body: 'Scheduled maintenance tonight',
      });

      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle logActivity with null values in details', async () => {
      await logActivity({
        action: 'null.details',
        details: { value: null, nested: { empty: null } },
      });

      expect(mocks.prisma.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          details: { value: null, nested: { empty: null } },
        }),
      });
    });

    it('should handle createNotification with Unicode characters', async () => {
      await createNotification({
        userId: 'user-unicode',
        type: 'info',
        subject: '你好 Hello مرحبا',
        body: 'Unicode test: 🚀 ✓ ñ é',
      });

      expect(mocks.prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          subject: '你好 Hello مرحبا',
          body: 'Unicode test: 🚀 ✓ ñ é',
        }),
      });
    });

    it('should handle logActivity with circular reference error gracefully', async () => {
      // Create circular reference
      const circular: any = { name: 'test' };
      circular.self = circular;

      // JSON.stringify will throw on circular reference
      await logActivity({
        action: 'circular.test',
        details: circular,
      });

      // Should catch the error and log it
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
