import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies using vi.hoisted pattern
const mocks = vi.hoisted(() => ({
  prisma: {
    reportChangeLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    conversation: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    project: {
      findFirst: vi.fn(),
    },
    projectMember: {
      findFirst: vi.fn(),
    },
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

// Import after mocks are set up
import {
  logReportChange,
  getReportChangeLog,
  isReportLocked,
  canModifyLockedReport,
  type ChangeType,
  type LogChangeParams,
} from '@/lib/report-change-log';

describe('Report Change Log Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logReportChange', () => {
    const baseParams: LogChangeParams = {
      conversationId: 'conv-1',
      userId: 'user-1',
      projectId: 'project-1',
      reportDate: new Date('2024-01-15'),
      changeType: 'message_added',
      description: 'Added new message to daily report',
    };

    it('should successfully log a report change with all required fields', async () => {
      mocks.prisma.reportChangeLog.create.mockResolvedValue({
        id: 'log-1',
        ...baseParams,
        messageId: null,
        metadata: {},
        createdAt: new Date(),
      });

      await logReportChange(baseParams);

      expect(mocks.prisma.reportChangeLog.create).toHaveBeenCalledWith({
        data: {
          conversationId: 'conv-1',
          messageId: null,
          userId: 'user-1',
          projectId: 'project-1',
          reportDate: baseParams.reportDate,
          changeType: 'message_added',
          description: 'Added new message to daily report',
          metadata: {},
        },
      });

      expect(mocks.logger.info).toHaveBeenCalledWith(
        'REPORT_CHANGELOG',
        'Logged message_added',
        expect.objectContaining({ conversationId: 'conv-1', changeType: 'message_added' })
      );
    });

    it('should log change with messageId when provided', async () => {
      const paramsWithMessage = {
        ...baseParams,
        messageId: 'msg-123',
      };

      mocks.prisma.reportChangeLog.create.mockResolvedValue({
        id: 'log-1',
        ...paramsWithMessage,
        metadata: {},
        createdAt: new Date(),
      });

      await logReportChange(paramsWithMessage);

      expect(mocks.prisma.reportChangeLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          messageId: 'msg-123',
        }),
      });
    });

    it('should log change with metadata when provided', async () => {
      const paramsWithMetadata = {
        ...baseParams,
        metadata: {
          oldValue: 'old text',
          newValue: 'new text',
          editedFields: ['description'],
        },
      };

      mocks.prisma.reportChangeLog.create.mockResolvedValue({
        id: 'log-1',
        ...paramsWithMetadata,
        messageId: null,
        createdAt: new Date(),
      });

      await logReportChange(paramsWithMetadata);

      expect(mocks.prisma.reportChangeLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: {
            oldValue: 'old text',
            newValue: 'new text',
            editedFields: ['description'],
          },
        }),
      });
    });

    it('should log message_edited change type', async () => {
      const editParams = {
        ...baseParams,
        changeType: 'message_edited' as ChangeType,
        description: 'Edited message content',
      };

      mocks.prisma.reportChangeLog.create.mockResolvedValue({
        id: 'log-1',
        ...editParams,
        messageId: null,
        metadata: {},
        createdAt: new Date(),
      });

      await logReportChange(editParams);

      expect(mocks.prisma.reportChangeLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          changeType: 'message_edited',
        }),
      });
    });

    it('should log message_deleted change type', async () => {
      const deleteParams = {
        ...baseParams,
        changeType: 'message_deleted' as ChangeType,
        description: 'Deleted message from report',
      };

      mocks.prisma.reportChangeLog.create.mockResolvedValue({
        id: 'log-1',
        ...deleteParams,
        messageId: null,
        metadata: {},
        createdAt: new Date(),
      });

      await logReportChange(deleteParams);

      expect(mocks.prisma.reportChangeLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          changeType: 'message_deleted',
        }),
      });
    });

    it('should log report_finalized change type', async () => {
      const finalizeParams = {
        ...baseParams,
        changeType: 'report_finalized' as ChangeType,
        description: 'Report finalized for date 2024-01-15',
      };

      mocks.prisma.reportChangeLog.create.mockResolvedValue({
        id: 'log-1',
        ...finalizeParams,
        messageId: null,
        metadata: {},
        createdAt: new Date(),
      });

      await logReportChange(finalizeParams);

      expect(mocks.prisma.reportChangeLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          changeType: 'report_finalized',
        }),
      });
    });

    it('should log report_reopened change type', async () => {
      const reopenParams = {
        ...baseParams,
        changeType: 'report_reopened' as ChangeType,
        description: 'Report reopened for editing',
      };

      mocks.prisma.reportChangeLog.create.mockResolvedValue({
        id: 'log-1',
        ...reopenParams,
        messageId: null,
        metadata: {},
        createdAt: new Date(),
      });

      await logReportChange(reopenParams);

      expect(mocks.prisma.reportChangeLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          changeType: 'report_reopened',
        }),
      });
    });

    it('should log logo_uploaded change type', async () => {
      const logoParams = {
        ...baseParams,
        changeType: 'logo_uploaded' as ChangeType,
        description: 'Company logo uploaded to report',
      };

      mocks.prisma.reportChangeLog.create.mockResolvedValue({
        id: 'log-1',
        ...logoParams,
        messageId: null,
        metadata: {},
        createdAt: new Date(),
      });

      await logReportChange(logoParams);

      expect(mocks.prisma.reportChangeLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          changeType: 'logo_uploaded',
        }),
      });
    });

    it('should not throw error when database create fails', async () => {
      mocks.prisma.reportChangeLog.create.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Should not throw - errors are caught and logged
      await expect(logReportChange(baseParams)).resolves.toBeUndefined();

      expect(mocks.logger.error).toHaveBeenCalledWith(
        'REPORT_CHANGELOG',
        expect.stringContaining('Error'),
        expect.any(Error),
        expect.any(Object)
      );
    });

    it('should handle undefined messageId gracefully', async () => {
      const paramsWithUndefinedMessage = {
        ...baseParams,
        messageId: undefined,
      };

      mocks.prisma.reportChangeLog.create.mockResolvedValue({
        id: 'log-1',
        ...baseParams,
        messageId: null,
        metadata: {},
        createdAt: new Date(),
      });

      await logReportChange(paramsWithUndefinedMessage);

      expect(mocks.prisma.reportChangeLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          messageId: null,
        }),
      });
    });

    it('should handle undefined metadata gracefully', async () => {
      const paramsWithoutMetadata = {
        ...baseParams,
        metadata: undefined,
      };

      mocks.prisma.reportChangeLog.create.mockResolvedValue({
        id: 'log-1',
        ...baseParams,
        messageId: null,
        metadata: {},
        createdAt: new Date(),
      });

      await logReportChange(paramsWithoutMetadata);

      expect(mocks.prisma.reportChangeLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: {},
        }),
      });
    });

    it('should handle complex metadata objects', async () => {
      const complexMetadata = {
        action: 'bulk_edit',
        changes: [
          { field: 'status', from: 'draft', to: 'finalized' },
          { field: 'approver', from: null, to: 'user-2' },
        ],
        timestamp: new Date('2024-01-15T10:00:00Z'),
        ipAddress: '192.168.1.1',
      };

      const paramsWithComplexMetadata = {
        ...baseParams,
        metadata: complexMetadata,
      };

      mocks.prisma.reportChangeLog.create.mockResolvedValue({
        id: 'log-1',
        ...paramsWithComplexMetadata,
        messageId: null,
        createdAt: new Date(),
      });

      await logReportChange(paramsWithComplexMetadata);

      expect(mocks.prisma.reportChangeLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: complexMetadata,
        }),
      });
    });

    it('should handle network timeout errors gracefully', async () => {
      mocks.prisma.reportChangeLog.create.mockRejectedValue(
        new Error('ETIMEDOUT')
      );

      await logReportChange(baseParams);

      expect(mocks.logger.error).toHaveBeenCalledWith(
        'REPORT_CHANGELOG',
        expect.stringContaining('Error'),
        expect.objectContaining({ message: 'ETIMEDOUT' }),
        expect.any(Object)
      );
    });

    it('should handle validation errors gracefully', async () => {
      mocks.prisma.reportChangeLog.create.mockRejectedValue(
        new Error('Invalid field type')
      );

      await logReportChange(baseParams);

      expect(mocks.logger.error).toHaveBeenCalledWith(
        'REPORT_CHANGELOG',
        expect.stringContaining('Error'),
        expect.objectContaining({ message: 'Invalid field type' }),
        expect.any(Object)
      );
    });
  });

  describe('getReportChangeLog', () => {
    it('should return all change logs for a conversation with user info', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          conversationId: 'conv-1',
          messageId: null,
          userId: 'user-1',
          projectId: 'project-1',
          reportDate: new Date('2024-01-15'),
          changeType: 'message_added',
          description: 'Added new message',
          metadata: {},
          createdAt: new Date('2024-01-15T08:00:00Z'),
          User: {
            id: 'user-1',
            email: 'john@example.com',
            username: 'johndoe',
          },
        },
        {
          id: 'log-2',
          conversationId: 'conv-1',
          messageId: 'msg-1',
          userId: 'user-2',
          projectId: 'project-1',
          reportDate: new Date('2024-01-15'),
          changeType: 'message_edited',
          description: 'Edited message content',
          metadata: { oldValue: 'old', newValue: 'new' },
          createdAt: new Date('2024-01-15T09:00:00Z'),
          User: {
            id: 'user-2',
            email: 'jane@example.com',
            username: 'janedoe',
          },
        },
      ];

      mocks.prisma.reportChangeLog.findMany.mockResolvedValue(mockLogs);

      const result = await getReportChangeLog('conv-1');

      expect(result).toEqual(mockLogs);
      expect(mocks.prisma.reportChangeLog.findMany).toHaveBeenCalledWith({
        where: { conversationId: 'conv-1' },
        include: {
          User: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should return empty array when no change logs exist', async () => {
      mocks.prisma.reportChangeLog.findMany.mockResolvedValue([]);

      const result = await getReportChangeLog('conv-1');

      expect(result).toEqual([]);
    });

    it('should return logs ordered by createdAt ascending', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          createdAt: new Date('2024-01-15T08:00:00Z'),
          User: { id: 'user-1', email: 'user1@example.com', username: 'user1' },
        },
        {
          id: 'log-2',
          createdAt: new Date('2024-01-15T09:00:00Z'),
          User: { id: 'user-2', email: 'user2@example.com', username: 'user2' },
        },
        {
          id: 'log-3',
          createdAt: new Date('2024-01-15T10:00:00Z'),
          User: { id: 'user-3', email: 'user3@example.com', username: 'user3' },
        },
      ];

      mocks.prisma.reportChangeLog.findMany.mockResolvedValue(mockLogs);

      const result = await getReportChangeLog('conv-1');

      expect(result).toEqual(mockLogs);
      expect(result[0].createdAt.getTime()).toBeLessThan(
        result[1].createdAt.getTime()
      );
      expect(result[1].createdAt.getTime()).toBeLessThan(
        result[2].createdAt.getTime()
      );
    });

    it('should return empty array when database query fails', async () => {
      mocks.prisma.reportChangeLog.findMany.mockRejectedValue(
        new Error('Database error')
      );

      const result = await getReportChangeLog('conv-1');

      expect(result).toEqual([]);
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'REPORT_CHANGELOG',
        expect.stringContaining('Error'),
        expect.any(Error),
        expect.any(Object)
      );
    });

    it('should handle network errors gracefully', async () => {
      mocks.prisma.reportChangeLog.findMany.mockRejectedValue(
        new Error('ECONNREFUSED')
      );

      const result = await getReportChangeLog('conv-1');

      expect(result).toEqual([]);
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'REPORT_CHANGELOG',
        expect.stringContaining('Error'),
        expect.objectContaining({ message: 'ECONNREFUSED' }),
        expect.any(Object)
      );
    });

    it('should only select specific user fields', async () => {
      mocks.prisma.reportChangeLog.findMany.mockResolvedValue([]);

      await getReportChangeLog('conv-1');

      expect(mocks.prisma.reportChangeLog.findMany).toHaveBeenCalledWith({
        where: { conversationId: 'conv-1' },
        include: {
          User: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should handle conversation with multiple change types', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          changeType: 'message_added',
          createdAt: new Date('2024-01-15T08:00:00Z'),
          User: { id: 'user-1', email: 'user@example.com', username: 'user' },
        },
        {
          id: 'log-2',
          changeType: 'message_edited',
          createdAt: new Date('2024-01-15T09:00:00Z'),
          User: { id: 'user-1', email: 'user@example.com', username: 'user' },
        },
        {
          id: 'log-3',
          changeType: 'report_finalized',
          createdAt: new Date('2024-01-15T18:00:00Z'),
          User: { id: 'user-2', email: 'admin@example.com', username: 'admin' },
        },
        {
          id: 'log-4',
          changeType: 'report_reopened',
          createdAt: new Date('2024-01-15T19:00:00Z'),
          User: { id: 'user-2', email: 'admin@example.com', username: 'admin' },
        },
      ];

      mocks.prisma.reportChangeLog.findMany.mockResolvedValue(mockLogs);

      const result = await getReportChangeLog('conv-1');

      expect(result).toHaveLength(4);
      expect(result.map((log) => log.changeType)).toEqual([
        'message_added',
        'message_edited',
        'report_finalized',
        'report_reopened',
      ]);
    });
  });

  describe('isReportLocked', () => {
    it('should return true when conversation is a finalized daily report', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        conversationType: 'daily_report',
        isReadOnly: true,
      });

      const result = await isReportLocked('conv-1');

      expect(result).toBe(true);
      expect(mocks.prisma.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        select: {
          conversationType: true,
          isReadOnly: true,
        },
      });
    });

    it('should return false when conversation is not read-only', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        conversationType: 'daily_report',
        isReadOnly: false,
      });

      const result = await isReportLocked('conv-1');

      expect(result).toBe(false);
    });

    it('should return false when conversation is not a daily report', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        conversationType: 'general',
        isReadOnly: true,
      });

      const result = await isReportLocked('conv-1');

      expect(result).toBe(false);
    });

    it('should return false when conversation type is general and not read-only', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        conversationType: 'general',
        isReadOnly: false,
      });

      const result = await isReportLocked('conv-1');

      expect(result).toBe(false);
    });

    it('should return false when conversation not found', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue(null);

      const result = await isReportLocked('conv-1');

      expect(result).toBe(false);
    });

    it('should return false when database query fails', async () => {
      mocks.prisma.conversation.findUnique.mockRejectedValue(
        new Error('Database error')
      );

      const result = await isReportLocked('conv-1');

      expect(result).toBe(false);
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'REPORT_CHANGELOG',
        expect.stringContaining('Error'),
        expect.any(Error),
        expect.any(Object)
      );
    });

    it('should handle null conversationType gracefully', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        conversationType: null,
        isReadOnly: true,
      });

      const result = await isReportLocked('conv-1');

      expect(result).toBe(false);
    });

    it('should handle null isReadOnly gracefully', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        conversationType: 'daily_report',
        isReadOnly: null,
      });

      const result = await isReportLocked('conv-1');

      expect(result).toBe(false);
    });

    it('should handle network timeout errors gracefully', async () => {
      mocks.prisma.conversation.findUnique.mockRejectedValue(
        new Error('ETIMEDOUT')
      );

      const result = await isReportLocked('conv-1');

      expect(result).toBe(false);
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'REPORT_CHANGELOG',
        expect.stringContaining('Error'),
        expect.objectContaining({ message: 'ETIMEDOUT' }),
        expect.any(Object)
      );
    });

    it('should return false for other conversation types', async () => {
      const conversationTypes = ['project', 'support', 'feedback'];

      for (const type of conversationTypes) {
        mocks.prisma.conversation.findUnique.mockResolvedValue({
          id: 'conv-1',
          conversationType: type,
          isReadOnly: true,
        });

        const result = await isReportLocked('conv-1');

        expect(result).toBe(false);
      }
    });
  });

  describe('canModifyLockedReport', () => {
    it('should return true for admin users', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'admin',
      });

      const result = await canModifyLockedReport('user-1', 'project-1');

      expect(result).toBe(true);
      expect(mocks.prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { role: true },
      });
    });

    it('should return true for project owner (via ownerId)', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'client',
      });

      mocks.prisma.project.findFirst.mockResolvedValue({
        id: 'project-1',
        ownerId: 'user-1',
      });

      const result = await canModifyLockedReport('user-1', 'project-1');

      expect(result).toBe(true);
      expect(mocks.prisma.project.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'project-1',
          ownerId: 'user-1',
        },
      });
    });

    it('should return true for project member with owner role', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'client',
      });

      mocks.prisma.project.findFirst.mockResolvedValue(null);

      mocks.prisma.projectMember.findFirst.mockResolvedValue({
        id: 'member-1',
        projectId: 'project-1',
        userId: 'user-1',
        role: 'owner',
      });

      const result = await canModifyLockedReport('user-1', 'project-1');

      expect(result).toBe(true);
      expect(mocks.prisma.projectMember.findFirst).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          userId: 'user-1',
          role: 'owner',
        },
      });
    });

    it('should return false for regular client users', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'client',
      });

      mocks.prisma.project.findFirst.mockResolvedValue(null);
      mocks.prisma.projectMember.findFirst.mockResolvedValue(null);

      const result = await canModifyLockedReport('user-1', 'project-1');

      expect(result).toBe(false);
    });

    it('should return false for guest users', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'guest',
      });

      mocks.prisma.project.findFirst.mockResolvedValue(null);
      mocks.prisma.projectMember.findFirst.mockResolvedValue(null);

      const result = await canModifyLockedReport('user-1', 'project-1');

      expect(result).toBe(false);
    });

    it('should return false when user not found', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(null);

      const result = await canModifyLockedReport('user-1', 'project-1');

      expect(result).toBe(false);
    });

    it('should return false when database query fails', async () => {
      mocks.prisma.user.findUnique.mockRejectedValue(
        new Error('Database error')
      );

      const result = await canModifyLockedReport('user-1', 'project-1');

      expect(result).toBe(false);
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'REPORT_CHANGELOG',
        expect.stringContaining('Error'),
        expect.any(Error),
        expect.any(Object)
      );
    });

    it('should return false for project members with non-owner roles', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'client',
      });

      mocks.prisma.project.findFirst.mockResolvedValue(null);

      mocks.prisma.projectMember.findFirst.mockResolvedValue(null);

      const result = await canModifyLockedReport('user-1', 'project-1');

      expect(result).toBe(false);
    });

    it('should check project member role after checking project owner', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'client',
      });

      // Not project owner
      mocks.prisma.project.findFirst.mockResolvedValue(null);

      // But is project member with owner role
      mocks.prisma.projectMember.findFirst.mockResolvedValue({
        id: 'member-1',
        projectId: 'project-1',
        userId: 'user-1',
        role: 'owner',
      });

      const result = await canModifyLockedReport('user-1', 'project-1');

      expect(result).toBe(true);
      expect(mocks.prisma.project.findFirst).toHaveBeenCalled();
      expect(mocks.prisma.projectMember.findFirst).toHaveBeenCalled();
    });

    it('should not check project member if user is admin', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'admin',
      });

      const result = await canModifyLockedReport('user-1', 'project-1');

      expect(result).toBe(true);
      expect(mocks.prisma.project.findFirst).not.toHaveBeenCalled();
      expect(mocks.prisma.projectMember.findFirst).not.toHaveBeenCalled();
    });

    it('should not check project member if user is project owner', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'client',
      });

      mocks.prisma.project.findFirst.mockResolvedValue({
        id: 'project-1',
        ownerId: 'user-1',
      });

      const result = await canModifyLockedReport('user-1', 'project-1');

      expect(result).toBe(true);
      expect(mocks.prisma.projectMember.findFirst).not.toHaveBeenCalled();
    });

    it('should handle network errors gracefully', async () => {
      mocks.prisma.user.findUnique.mockRejectedValue(
        new Error('ECONNREFUSED')
      );

      const result = await canModifyLockedReport('user-1', 'project-1');

      expect(result).toBe(false);
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'REPORT_CHANGELOG',
        expect.stringContaining('Error'),
        expect.objectContaining({ message: 'ECONNREFUSED' }),
        expect.any(Object)
      );
    });

    it('should return false for pending users', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'pending',
      });

      mocks.prisma.project.findFirst.mockResolvedValue(null);
      mocks.prisma.projectMember.findFirst.mockResolvedValue(null);

      const result = await canModifyLockedReport('user-1', 'project-1');

      expect(result).toBe(false);
    });

    it('should handle user role as null gracefully', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: null,
      });

      mocks.prisma.project.findFirst.mockResolvedValue(null);
      mocks.prisma.projectMember.findFirst.mockResolvedValue(null);

      const result = await canModifyLockedReport('user-1', 'project-1');

      expect(result).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty conversation ID in getReportChangeLog', async () => {
      mocks.prisma.reportChangeLog.findMany.mockResolvedValue([]);

      const result = await getReportChangeLog('');

      expect(result).toEqual([]);
      expect(mocks.prisma.reportChangeLog.findMany).toHaveBeenCalledWith({
        where: { conversationId: '' },
        include: {
          User: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should handle empty conversation ID in isReportLocked', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue(null);

      const result = await isReportLocked('');

      expect(result).toBe(false);
    });

    it('should handle empty user ID in canModifyLockedReport', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(null);

      const result = await canModifyLockedReport('', 'project-1');

      expect(result).toBe(false);
    });

    it('should handle empty project ID in canModifyLockedReport', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'client',
      });

      mocks.prisma.project.findFirst.mockResolvedValue(null);
      mocks.prisma.projectMember.findFirst.mockResolvedValue(null);

      const result = await canModifyLockedReport('user-1', '');

      expect(result).toBe(false);
    });

    it('should handle very long descriptions in logReportChange', async () => {
      const longDescription = 'A'.repeat(10000);
      const params = {
        conversationId: 'conv-1',
        userId: 'user-1',
        projectId: 'project-1',
        reportDate: new Date('2024-01-15'),
        changeType: 'message_added' as ChangeType,
        description: longDescription,
      };

      mocks.prisma.reportChangeLog.create.mockResolvedValue({
        id: 'log-1',
        ...params,
        messageId: null,
        metadata: {},
        createdAt: new Date(),
      });

      await logReportChange(params);

      expect(mocks.prisma.reportChangeLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: longDescription,
        }),
      });
    });

    it('should handle special characters in metadata', async () => {
      const specialMetadata = {
        description: "Test with 'quotes' and \"double quotes\"",
        path: 'C:\\Users\\test\\file.txt',
        regex: '/test.*$/i',
        unicode: '测试 テスト 테스트',
      };

      const params = {
        conversationId: 'conv-1',
        userId: 'user-1',
        projectId: 'project-1',
        reportDate: new Date('2024-01-15'),
        changeType: 'message_edited' as ChangeType,
        description: 'Test with special chars',
        metadata: specialMetadata,
      };

      mocks.prisma.reportChangeLog.create.mockResolvedValue({
        id: 'log-1',
        ...params,
        messageId: null,
        createdAt: new Date(),
      });

      await logReportChange(params);

      expect(mocks.prisma.reportChangeLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: specialMetadata,
        }),
      });
    });

    it('should handle Date objects in metadata', async () => {
      const dateMetadata = {
        previousDate: new Date('2024-01-14'),
        newDate: new Date('2024-01-15'),
      };

      const params = {
        conversationId: 'conv-1',
        userId: 'user-1',
        projectId: 'project-1',
        reportDate: new Date('2024-01-15'),
        changeType: 'report_reopened' as ChangeType,
        description: 'Date changed',
        metadata: dateMetadata,
      };

      mocks.prisma.reportChangeLog.create.mockResolvedValue({
        id: 'log-1',
        ...params,
        messageId: null,
        createdAt: new Date(),
      });

      await logReportChange(params);

      expect(mocks.prisma.reportChangeLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: dateMetadata,
        }),
      });
    });
  });
});
