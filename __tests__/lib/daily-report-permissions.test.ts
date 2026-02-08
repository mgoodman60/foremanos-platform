import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  project: { findUnique: vi.fn() },
  projectMember: { findUnique: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  createScopedLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  getDailyReportRole,
  canCreateReport,
  canEditReport,
  canSubmitReport,
  canApproveReport,
  canDeleteReport,
  canViewReport,
  isValidTransition,
  sanitizeText,
  VALID_STATUS_TRANSITIONS,
} from '@/lib/daily-report-permissions';

describe('daily-report-permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDailyReportRole', () => {
    it('should return ADMIN for project owner', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'user-1' });

      const role = await getDailyReportRole('user-1', 'project-1');
      expect(role).toBe('ADMIN');
      // Should not query projectMember when user is owner
      expect(mockPrisma.projectMember.findUnique).not.toHaveBeenCalled();
    });

    it('should return ADMIN for member with role admin', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'other-user' });
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'admin' });

      const role = await getDailyReportRole('user-1', 'project-1');
      expect(role).toBe('ADMIN');
    });

    it('should return SUPERVISOR for member with role superintendent', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'other-user' });
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'superintendent' });

      const role = await getDailyReportRole('user-1', 'project-1');
      expect(role).toBe('SUPERVISOR');
    });

    it('should return SUPERVISOR for member with role manager', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'other-user' });
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'manager' });

      const role = await getDailyReportRole('user-1', 'project-1');
      expect(role).toBe('SUPERVISOR');
    });

    it('should return REPORTER for member with role worker', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'other-user' });
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'worker' });

      const role = await getDailyReportRole('user-1', 'project-1');
      expect(role).toBe('REPORTER');
    });

    it('should return REPORTER for member with role member', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'other-user' });
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'member' });

      const role = await getDailyReportRole('user-1', 'project-1');
      expect(role).toBe('REPORTER');
    });

    it('should return VIEWER for member with role client', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'other-user' });
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'client' });

      const role = await getDailyReportRole('user-1', 'project-1');
      expect(role).toBe('VIEWER');
    });

    it('should return VIEWER for member with role guest', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'other-user' });
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'guest' });

      const role = await getDailyReportRole('user-1', 'project-1');
      expect(role).toBe('VIEWER');
    });

    it('should return VIEWER for unknown role strings', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'other-user' });
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'unknown-role' });

      const role = await getDailyReportRole('user-1', 'project-1');
      expect(role).toBe('VIEWER');
    });

    it('should return null for non-member', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'other-user' });
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);

      const role = await getDailyReportRole('user-1', 'project-1');
      expect(role).toBeNull();
    });

    it('should return null when prisma throws error', async () => {
      mockPrisma.project.findUnique.mockRejectedValue(new Error('DB connection failed'));

      const role = await getDailyReportRole('user-1', 'project-1');
      expect(role).toBeNull();
    });

    it('should handle case-insensitive role mapping', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'other-user' });
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'ADMIN' });

      const role = await getDailyReportRole('user-1', 'project-1');
      expect(role).toBe('ADMIN');
    });
  });

  describe('canCreateReport', () => {
    it('should return true for REPORTER', () => {
      expect(canCreateReport('REPORTER')).toBe(true);
    });

    it('should return true for SUPERVISOR', () => {
      expect(canCreateReport('SUPERVISOR')).toBe(true);
    });

    it('should return true for ADMIN', () => {
      expect(canCreateReport('ADMIN')).toBe(true);
    });

    it('should return false for VIEWER', () => {
      expect(canCreateReport('VIEWER')).toBe(false);
    });
  });

  describe('canEditReport', () => {
    it('should allow ADMIN to edit any report regardless of status', () => {
      expect(canEditReport('ADMIN', 'other-user', 'user-1', 'DRAFT')).toBe(true);
      expect(canEditReport('ADMIN', 'other-user', 'user-1', 'SUBMITTED')).toBe(true);
      expect(canEditReport('ADMIN', 'other-user', 'user-1', 'APPROVED')).toBe(true);
      expect(canEditReport('ADMIN', 'other-user', 'user-1', 'REJECTED')).toBe(true);
    });

    it('should allow SUPERVISOR to edit any report regardless of status', () => {
      expect(canEditReport('SUPERVISOR', 'other-user', 'user-1', 'DRAFT')).toBe(true);
      expect(canEditReport('SUPERVISOR', 'other-user', 'user-1', 'SUBMITTED')).toBe(true);
      expect(canEditReport('SUPERVISOR', 'other-user', 'user-1', 'APPROVED')).toBe(true);
    });

    it('should allow REPORTER to edit own DRAFT report', () => {
      expect(canEditReport('REPORTER', 'user-1', 'user-1', 'DRAFT')).toBe(true);
    });

    it('should allow REPORTER to edit own REJECTED report', () => {
      expect(canEditReport('REPORTER', 'user-1', 'user-1', 'REJECTED')).toBe(true);
    });

    it('should deny REPORTER editing own SUBMITTED report', () => {
      expect(canEditReport('REPORTER', 'user-1', 'user-1', 'SUBMITTED')).toBe(false);
    });

    it('should deny REPORTER editing own APPROVED report', () => {
      expect(canEditReport('REPORTER', 'user-1', 'user-1', 'APPROVED')).toBe(false);
    });

    it('should deny REPORTER editing another users report', () => {
      expect(canEditReport('REPORTER', 'other-user', 'user-1', 'DRAFT')).toBe(false);
    });

    it('should deny VIEWER editing any report', () => {
      expect(canEditReport('VIEWER', 'user-1', 'user-1', 'DRAFT')).toBe(false);
    });
  });

  describe('canSubmitReport', () => {
    it('should allow ADMIN to submit any report', () => {
      expect(canSubmitReport('ADMIN', 'other-user', 'user-1')).toBe(true);
    });

    it('should allow SUPERVISOR to submit any report', () => {
      expect(canSubmitReport('SUPERVISOR', 'other-user', 'user-1')).toBe(true);
    });

    it('should allow REPORTER to submit own report', () => {
      expect(canSubmitReport('REPORTER', 'user-1', 'user-1')).toBe(true);
    });

    it('should deny REPORTER submitting another users report', () => {
      expect(canSubmitReport('REPORTER', 'other-user', 'user-1')).toBe(false);
    });

    it('should deny VIEWER submitting reports', () => {
      expect(canSubmitReport('VIEWER', 'user-1', 'user-1')).toBe(false);
    });
  });

  describe('canApproveReport', () => {
    it('should allow SUPERVISOR to approve', () => {
      expect(canApproveReport('SUPERVISOR')).toBe(true);
    });

    it('should allow ADMIN to approve', () => {
      expect(canApproveReport('ADMIN')).toBe(true);
    });

    it('should deny REPORTER from approving', () => {
      expect(canApproveReport('REPORTER')).toBe(false);
    });

    it('should deny VIEWER from approving', () => {
      expect(canApproveReport('VIEWER')).toBe(false);
    });
  });

  describe('canDeleteReport', () => {
    it('should allow ADMIN to delete', () => {
      expect(canDeleteReport('ADMIN')).toBe(true);
    });

    it('should deny SUPERVISOR from deleting', () => {
      expect(canDeleteReport('SUPERVISOR')).toBe(false);
    });

    it('should deny REPORTER from deleting', () => {
      expect(canDeleteReport('REPORTER')).toBe(false);
    });

    it('should deny VIEWER from deleting', () => {
      expect(canDeleteReport('VIEWER')).toBe(false);
    });
  });

  describe('canViewReport', () => {
    it('should allow all roles to view', () => {
      expect(canViewReport('VIEWER')).toBe(true);
      expect(canViewReport('REPORTER')).toBe(true);
      expect(canViewReport('SUPERVISOR')).toBe(true);
      expect(canViewReport('ADMIN')).toBe(true);
    });
  });

  describe('isValidTransition', () => {
    it('should allow DRAFT to SUBMITTED', () => {
      expect(isValidTransition('DRAFT', 'SUBMITTED')).toBe(true);
    });

    it('should allow SUBMITTED to APPROVED', () => {
      expect(isValidTransition('SUBMITTED', 'APPROVED')).toBe(true);
    });

    it('should allow SUBMITTED to REJECTED', () => {
      expect(isValidTransition('SUBMITTED', 'REJECTED')).toBe(true);
    });

    it('should allow REJECTED to DRAFT', () => {
      expect(isValidTransition('REJECTED', 'DRAFT')).toBe(true);
    });

    it('should deny DRAFT to APPROVED (skip SUBMITTED)', () => {
      expect(isValidTransition('DRAFT', 'APPROVED')).toBe(false);
    });

    it('should deny DRAFT to REJECTED', () => {
      expect(isValidTransition('DRAFT', 'REJECTED')).toBe(false);
    });

    it('should deny APPROVED to DRAFT', () => {
      expect(isValidTransition('APPROVED', 'DRAFT')).toBe(false);
    });

    it('should deny APPROVED to REJECTED', () => {
      expect(isValidTransition('APPROVED', 'REJECTED')).toBe(false);
    });

    it('should deny APPROVED to SUBMITTED', () => {
      expect(isValidTransition('APPROVED', 'SUBMITTED')).toBe(false);
    });

    it('should deny REJECTED to SUBMITTED', () => {
      expect(isValidTransition('REJECTED', 'SUBMITTED')).toBe(false);
    });

    it('should deny REJECTED to APPROVED', () => {
      expect(isValidTransition('REJECTED', 'APPROVED')).toBe(false);
    });

    it('should return false for unknown current status', () => {
      expect(isValidTransition('UNKNOWN', 'DRAFT')).toBe(false);
    });
  });

  describe('sanitizeText', () => {
    it('should pass through normal text (with trim)', () => {
      expect(sanitizeText('  Hello world  ')).toBe('Hello world');
    });

    it('should strip HTML bold tags', () => {
      expect(sanitizeText('<b>bold</b>')).toBe('bold');
    });

    it('should strip script tags and their content', () => {
      expect(sanitizeText("<script>alert('xss')</script>")).toBe('');
    });

    it('should strip nested HTML tags', () => {
      expect(sanitizeText('<div><span>text</span></div>')).toBe('text');
    });

    it('should return empty string for empty input', () => {
      expect(sanitizeText('')).toBe('');
    });

    it('should return falsy values as-is', () => {
      // sanitizeText checks `if (!input) return input`
      expect(sanitizeText(null as any)).toBeNull();
      expect(sanitizeText(undefined as any)).toBeUndefined();
    });

    it('should decode &amp; entity', () => {
      expect(sanitizeText('A &amp; B')).toBe('A & B');
    });

    it('should decode &lt; and &gt; entities then strip resulting tags', () => {
      // After security fix: entities are decoded FIRST, then tags stripped
      // '&lt;tag&gt;' → '<tag>' (decode) → '' (strip as HTML tag)
      expect(sanitizeText('&lt;tag&gt;')).toBe('');
    });

    it('should decode &quot; entity', () => {
      expect(sanitizeText('&quot;quoted&quot;')).toBe('"quoted"');
    });

    it('should handle mixed HTML and entities', () => {
      expect(sanitizeText('<p>Price: $100 &amp; tax</p>')).toBe('Price: $100 & tax');
    });
  });

  describe('VALID_STATUS_TRANSITIONS', () => {
    it('should have correct transition map', () => {
      expect(VALID_STATUS_TRANSITIONS).toEqual({
        DRAFT: ['SUBMITTED'],
        SUBMITTED: ['APPROVED', 'REJECTED'],
        APPROVED: [],
        REJECTED: ['DRAFT'],
      });
    });
  });
});
