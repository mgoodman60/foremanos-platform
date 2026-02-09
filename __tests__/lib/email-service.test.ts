import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockPrisma = vi.hoisted(() => ({
  notification: {
    create: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
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

// Import after mocks
import {
  sendEmail,
  sendWelcomeEmail,
  sendApprovalEmail,
  sendRejectionEmail,
  sendProjectInviteEmail,
  sendPasswordResetEmail,
  sendSignInNotification,
  sendAdminAlert,
  sendProjectNotification,
  sendUserRequestNotification,
  sendDocumentUploadNotification,
  sendNewSignupNotification,
  sendDailyReportStatusEmail,
  sendEmailVerification,
} from '@/lib/email-service';

describe('email-service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    mockFetch.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('sendEmail', () => {
    it('should send email via Resend API with valid API key', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'email-id-123' }),
      });

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test body',
        type: 'info',
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should create notification in database when userId is provided', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'email-id-123' }),
      });

      mockPrisma.notification.create.mockResolvedValueOnce({
        id: 'notif-id-123',
        userId: 'user-id-123',
        type: 'info',
        subject: 'Test Subject',
        body: 'Test body',
        read: false,
      });

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test body',
        userId: 'user-id-123',
        type: 'info',
      });

      expect(result.success).toBe(true);
      expect(result.notificationId).toBe('notif-id-123');
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-id-123',
          type: 'info',
          subject: 'Test Subject',
          body: 'Test body',
          read: false,
        },
      });
    });

    it('should fall back to console logging when no API key is configured', async () => {
      delete process.env.RESEND_API_KEY;

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test body',
      });

      expect(result.success).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Email logged to console (no Resend API key)',
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Test Subject',
        })
      );
    });

    it('should handle domain not verified error gracefully', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ message: 'domain is not verified' }),
      });

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test body',
      });

      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith('Resend domain not verified - emails will be logged to console');
    });

    it('should handle rate limit error', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ message: 'Rate limit exceeded' }),
      });

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test body',
      });

      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith('Rate limit hit - please retry later');
    });

    it('should handle general API errors and fall back to console', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test body',
      });

      expect(result.success).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error sending email via Resend, falling back to console',
        expect.any(Error)
      );
    });

    it('should include custom HTML when provided', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'email-id-123' }),
      });

      await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test body',
        html: '<p>Custom HTML</p>',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.html).toBe('<p>Custom HTML</p>');
    });

    it('should convert newlines to <br> tags when no HTML provided', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'email-id-123' }),
      });

      await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Line 1\nLine 2\nLine 3',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.html).toBe('Line 1<br>Line 2<br>Line 3');
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email with correct content', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'email-id-123' }),
      });

      mockPrisma.notification.create.mockResolvedValueOnce({
        id: 'notif-id-123',
        userId: 'user-id-123',
        type: 'info',
        subject: 'Welcome to ForemanOS!',
        body: 'test',
        read: false,
      });

      const result = await sendWelcomeEmail('newuser@example.com', 'John Doe', 'user-id-123');

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
        })
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.subject).toBe('Welcome to ForemanOS!');
      expect(callBody.text).toContain('John Doe');
      expect(callBody.text).toContain('pending approval');
    });
  });

  describe('sendApprovalEmail', () => {
    it('should send approval email with correct content', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';
      process.env.NEXTAUTH_URL = 'https://example.com';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'email-id-123' }),
      });

      const result = await sendApprovalEmail('user@example.com', 'Jane Smith');

      expect(result.success).toBe(true);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.subject).toBe('Your ForemanOS Account Has Been Approved!');
      expect(callBody.text).toContain('Jane Smith');
      expect(callBody.text).toContain('https://example.com/login');
    });
  });

  describe('sendRejectionEmail', () => {
    it('should send rejection email with correct content', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'email-id-123' }),
      });

      const result = await sendRejectionEmail('user@example.com', 'John Doe');

      expect(result.success).toBe(true);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.subject).toBe('ForemanOS Account Application Update');
      expect(callBody.text).toContain('John Doe');
      expect(callBody.text).toContain('unable to approve');
    });
  });

  describe('sendProjectInviteEmail', () => {
    it('should send project invitation with credentials', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';
      process.env.NEXTAUTH_URL = 'https://example.com';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'email-id-123' }),
      });

      const result = await sendProjectInviteEmail(
        'guest@example.com',
        'Building Project',
        'guest123',
        'temppass123'
      );

      expect(result.success).toBe(true);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.subject).toContain('Building Project');
      expect(callBody.text).toContain('guest123');
      expect(callBody.text).toContain('temppass123');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with token', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';
      process.env.NEXTAUTH_URL = 'https://example.com';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'email-id-123' }),
      });

      const result = await sendPasswordResetEmail(
        'user@example.com',
        'John Doe',
        'reset-token-123'
      );

      expect(result.success).toBe(true);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.subject).toBe('Reset Your ForemanOS Password');
      expect(callBody.text).toContain('reset-token-123');
      expect(callBody.text).toContain('24 hours');
    });
  });

  describe('sendSignInNotification', () => {
    it('should notify all admins of user sign-in', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';

      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 'admin1', email: 'admin1@example.com' },
        { id: 'admin2', email: 'admin2@example.com' },
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'email-id-123' }),
      });

      const result = await sendSignInNotification(
        'user@example.com',
        'John Doe',
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          role: 'admin',
          NOT: { email: null },
        },
        select: { id: true, email: true },
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should skip admins with null email', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';

      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 'admin1', email: 'admin1@example.com' },
        { id: 'admin2', email: null },
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'email-id-123' }),
      });

      await sendSignInNotification(
        'user@example.com',
        'John Doe',
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.user.findMany.mockRejectedValueOnce(new Error('Database error'));

      const result = await sendSignInNotification(
        'user@example.com',
        'John Doe',
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(result.success).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('sendAdminAlert', () => {
    it('should send alert to all admins', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';

      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 'admin1', email: 'admin1@example.com', username: 'Admin One' },
        { id: 'admin2', email: 'admin2@example.com', username: 'Admin Two' },
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'email-id-123' }),
      });

      const result = await sendAdminAlert(
        'Critical Issue',
        'System failure detected',
        'error'
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.subject).toBe('[ADMIN ALERT] Critical Issue');
      expect(callBody.text).toContain('System failure detected');
    });

    it('should use default alert type as warning', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';

      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 'admin1', email: 'admin1@example.com', username: 'Admin One' },
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'email-id-123' }),
      });

      await sendAdminAlert('Test Alert', 'Test message');

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('sendProjectNotification', () => {
    it('should send notification to project owner', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';

      mockPrisma.project.findUnique.mockResolvedValueOnce({
        id: 'project-123',
        name: 'Building Project',
        User_Project_ownerIdToUser: {
          id: 'owner-123',
          email: 'owner@example.com',
          username: 'Project Owner',
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'email-id-123' }),
      });

      const result = await sendProjectNotification(
        'project-123',
        'Document Uploaded',
        'A new document has been uploaded',
        'info'
      );

      expect(result.success).toBe(true);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.subject).toContain('Building Project');
      expect(callBody.subject).toContain('Document Uploaded');
    });

    it('should skip email if project owner has no email', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        id: 'project-123',
        name: 'Building Project',
        User_Project_ownerIdToUser: {
          id: 'owner-123',
          email: null,
          username: 'Project Owner',
        },
      });

      const result = await sendProjectNotification(
        'project-123',
        'Document Uploaded',
        'A new document has been uploaded'
      );

      expect(result.success).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Skipping email notification - project owner has no email',
        expect.any(Object)
      );
    });

    it('should handle project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce(null);

      const result = await sendProjectNotification(
        'nonexistent-project',
        'Test',
        'Test message'
      );

      expect(result.success).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('sendUserRequestNotification', () => {
    it('should notify admins of user request', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';

      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 'admin1', email: 'admin1@example.com' },
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'email-id-123' }),
      });

      const result = await sendUserRequestNotification(
        'Access Request',
        'user@example.com',
        'John Doe',
        'Requesting access to project XYZ'
      );

      expect(result.success).toBe(true);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.subject).toBe('User Request: Access Request');
      expect(callBody.text).toContain('John Doe');
      expect(callBody.text).toContain('user@example.com');
    });
  });

  describe('sendDocumentUploadNotification', () => {
    it('should send document upload notification via project notification', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';

      mockPrisma.project.findUnique.mockResolvedValueOnce({
        id: 'project-123',
        name: 'Building Project',
        User_Project_ownerIdToUser: {
          id: 'owner-123',
          email: 'owner@example.com',
          username: 'Project Owner',
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'email-id-123' }),
      });

      const result = await sendDocumentUploadNotification(
        'project-123',
        'blueprint.pdf',
        'John Uploader'
      );

      expect(result.success).toBe(true);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.subject).toContain('New Document Uploaded');
      expect(callBody.text).toContain('blueprint.pdf');
      expect(callBody.text).toContain('John Uploader');
    });
  });

  describe('sendNewSignupNotification', () => {
    it('should notify admins of new signup', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';

      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 'admin1', email: 'admin1@example.com', username: 'Admin' },
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'email-id-123' }),
      });

      const result = await sendNewSignupNotification(
        'newuser@example.com',
        'New User',
        'client'
      );

      expect(result.success).toBe(true);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.subject).toContain('New User Signup');
      expect(callBody.text).toContain('New User');
      expect(callBody.text).toContain('newuser@example.com');
      expect(callBody.text).toContain('client');
    });
  });

  describe('sendDailyReportStatusEmail', () => {
    it('should send SUBMITTED status email', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'email-id-123' }),
      });

      const result = await sendDailyReportStatusEmail(
        'user@example.com',
        'John Doe',
        'Building Project',
        42,
        '2026-01-15',
        'SUBMITTED'
      );

      expect(result).toBe(true);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.subject).toContain('Daily Report #42 submitted for review');
      expect(callBody.text).toContain('submitted for your review');
    });

    it('should send APPROVED status email', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'email-id-123' }),
      });

      const result = await sendDailyReportStatusEmail(
        'user@example.com',
        'John Doe',
        'Building Project',
        42,
        '2026-01-15',
        'APPROVED'
      );

      expect(result).toBe(true);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.subject).toContain('Daily Report #42 approved');
      expect(callBody.text).toContain('has been approved');
    });

    it('should send REJECTED status email with reason and notes', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'email-id-123' }),
      });

      const result = await sendDailyReportStatusEmail(
        'user@example.com',
        'John Doe',
        'Building Project',
        42,
        '2026-01-15',
        'REJECTED',
        'Incomplete information',
        'Please add weather data'
      );

      expect(result).toBe(true);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.subject).toContain('Daily Report #42 needs revision');
      expect(callBody.text).toContain('Incomplete information');
      expect(callBody.text).toContain('Please add weather data');
    });
  });

  describe('sendEmailVerification', () => {
    it('should send email verification with token and HTML', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';
      process.env.NEXTAUTH_URL = 'https://example.com';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'email-id-123' }),
      });

      const result = await sendEmailVerification(
        'newuser@example.com',
        'John Doe',
        'verify-token-123'
      );

      expect(result.success).toBe(true);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.subject).toBe('Verify Your ForemanOS Account');
      expect(callBody.text).toContain('verify-token-123');
      expect(callBody.text).toContain('https://example.com/verify-email?token=verify-token-123');
      expect(callBody.html).toContain('Welcome, John Doe');
      expect(callBody.html).toContain('verify-token-123');
      expect(callBody.html).toContain('1 Project');
      expect(callBody.html).toContain('50 Queries/Month');
    });
  });
});
