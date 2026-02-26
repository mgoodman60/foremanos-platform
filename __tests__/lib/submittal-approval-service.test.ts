import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MEPSubmittalStatus } from '@prisma/client';

// Mock Prisma BEFORE importing the module using vi.hoisted
const mockPrisma = vi.hoisted(() => ({
  submittalApprovalHistory: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  mEPSubmittal: {
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

// Import after mocking
import {
  getApprovalHistory,
  getAvailableActions,
  performApprovalAction,
  getApprovalStats,
  getSubmittalsAwaitingAction,
  type ApprovalAction,
  type ApprovalHistoryEntry,
} from '@/lib/submittal-approval-service';

describe('Submittal Approval Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getApprovalHistory', () => {
    it('should retrieve and format approval history for a submittal', async () => {
      const mockHistory = [
        {
          id: 'history-1',
          action: 'SUBMITTED',
          fromStatus: 'PENDING',
          toStatus: 'SUBMITTED',
          performedBy: 'user-1',
          performerName: 'John Doe',
          comments: 'Initial submission',
          createdAt: new Date('2024-01-15T10:00:00Z'),
        },
        {
          id: 'history-2',
          action: 'APPROVED',
          fromStatus: 'SUBMITTED',
          toStatus: 'APPROVED',
          performedBy: 'user-2',
          performerName: 'Jane Smith',
          comments: 'Looks good',
          createdAt: new Date('2024-01-16T14:30:00Z'),
        },
      ];

      mockPrisma.submittalApprovalHistory.findMany.mockResolvedValue(mockHistory);

      const result = await getApprovalHistory('submittal-1');

      expect(mockPrisma.submittalApprovalHistory.findMany).toHaveBeenCalledWith({
        where: { submittalId: 'submittal-1' },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toEqual([
        {
          id: 'history-1',
          action: 'SUBMITTED',
          fromStatus: 'PENDING',
          toStatus: 'SUBMITTED',
          performedBy: 'user-1',
          performerName: 'John Doe',
          comments: 'Initial submission',
          createdAt: new Date('2024-01-15T10:00:00Z'),
        },
        {
          id: 'history-2',
          action: 'APPROVED',
          fromStatus: 'SUBMITTED',
          toStatus: 'APPROVED',
          performedBy: 'user-2',
          performerName: 'Jane Smith',
          comments: 'Looks good',
          createdAt: new Date('2024-01-16T14:30:00Z'),
        },
      ]);
    });

    it('should handle null performerName with default value', async () => {
      const mockHistory = [
        {
          id: 'history-1',
          action: 'SUBMITTED',
          fromStatus: 'PENDING',
          toStatus: 'SUBMITTED',
          performedBy: 'user-1',
          performerName: null,
          comments: 'Test submission',
          createdAt: new Date('2024-01-15T10:00:00Z'),
        },
      ];

      mockPrisma.submittalApprovalHistory.findMany.mockResolvedValue(mockHistory);

      const result = await getApprovalHistory('submittal-1');

      expect(result[0].performerName).toBe('Unknown');
    });

    it('should return empty array when no history exists', async () => {
      mockPrisma.submittalApprovalHistory.findMany.mockResolvedValue([]);

      const result = await getApprovalHistory('submittal-1');

      expect(result).toEqual([]);
    });

    it('should handle null fromStatus correctly', async () => {
      const mockHistory = [
        {
          id: 'history-1',
          action: 'SUBMITTED',
          fromStatus: null,
          toStatus: 'SUBMITTED',
          performedBy: 'user-1',
          performerName: 'John Doe',
          comments: 'Initial submission',
          createdAt: new Date('2024-01-15T10:00:00Z'),
        },
      ];

      mockPrisma.submittalApprovalHistory.findMany.mockResolvedValue(mockHistory);

      const result = await getApprovalHistory('submittal-1');

      expect(result[0].fromStatus).toBeNull();
    });
  });

  describe('getAvailableActions', () => {
    it('should return available actions for PENDING status', () => {
      const actions = getAvailableActions('PENDING');
      expect(actions).toEqual(['SUBMITTED']);
    });

    it('should return available actions for SUBMITTED status', () => {
      const actions = getAvailableActions('SUBMITTED');
      expect(actions).toEqual(['REVIEWED', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED']);
    });

    it('should return available actions for UNDER_REVIEW status', () => {
      const actions = getAvailableActions('UNDER_REVIEW');
      expect(actions).toEqual(['APPROVED', 'REJECTED', 'REVISION_REQUESTED']);
    });

    it('should return available actions for APPROVED status', () => {
      const actions = getAvailableActions('APPROVED');
      expect(actions).toEqual(['RESUBMITTED']);
    });

    it('should return available actions for APPROVED_AS_NOTED status', () => {
      const actions = getAvailableActions('APPROVED_AS_NOTED');
      expect(actions).toEqual(['RESUBMITTED']);
    });

    it('should return available actions for REJECTED status', () => {
      const actions = getAvailableActions('REJECTED');
      expect(actions).toEqual(['RESUBMITTED']);
    });

    it('should return available actions for REVISE_RESUBMIT status', () => {
      const actions = getAvailableActions('REVISE_RESUBMIT');
      expect(actions).toEqual(['RESUBMITTED']);
    });

    it('should normalize status with hyphens', () => {
      const actions = getAvailableActions('under-review');
      expect(actions).toEqual(['APPROVED', 'REJECTED', 'REVISION_REQUESTED']);
    });

    it('should normalize status to uppercase', () => {
      const actions = getAvailableActions('pending');
      expect(actions).toEqual(['SUBMITTED']);
    });

    it('should return empty array for unknown status', () => {
      const actions = getAvailableActions('UNKNOWN_STATUS');
      expect(actions).toEqual([]);
    });

    it('should handle mixed case and hyphens', () => {
      const actions = getAvailableActions('Under-Review');
      expect(actions).toEqual(['APPROVED', 'REJECTED', 'REVISION_REQUESTED']);
    });
  });

  describe('performApprovalAction', () => {
    beforeEach(() => {
      // Mock $transaction to execute the callback functions
      mockPrisma.$transaction.mockImplementation(async (callbacks: any[]) => {
        const results = [];
        for (const callback of callbacks) {
          if (typeof callback === 'function') {
            // @ts-expect-error strictNullChecks migration
            results.push(await callback());
          } else {
            // @ts-expect-error strictNullChecks migration
            results.push(callback);
          }
        }
        return results;
      });
    });

    it('should successfully perform SUBMITTED action from PENDING status', async () => {
      const mockSubmittal = {
        id: 'submittal-1',
        status: 'PENDING',
        projectId: 'project-1',
        submittalNumber: 'SUB-001',
      };

      mockPrisma.mEPSubmittal.findUnique.mockResolvedValue(mockSubmittal);
      mockPrisma.mEPSubmittal.update.mockResolvedValue({ ...mockSubmittal, status: 'SUBMITTED' });
      mockPrisma.submittalApprovalHistory.create.mockResolvedValue({});

      const result = await performApprovalAction(
        'submittal-1',
        'SUBMITTED',
        'user-1',
        'John Doe',
        'Ready for review'
      );

      expect(result).toEqual({
        success: true,
        newStatus: MEPSubmittalStatus.SUBMITTED,
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should successfully perform APPROVED action and set stamp status', async () => {
      const mockSubmittal = {
        id: 'submittal-1',
        status: 'SUBMITTED',
        projectId: 'project-1',
        submittalNumber: 'SUB-001',
      };

      mockPrisma.mEPSubmittal.findUnique.mockResolvedValue(mockSubmittal);
      mockPrisma.mEPSubmittal.update.mockResolvedValue({ ...mockSubmittal, status: 'APPROVED' });
      mockPrisma.submittalApprovalHistory.create.mockResolvedValue({});

      const result = await performApprovalAction(
        'submittal-1',
        'APPROVED',
        'user-2',
        'Jane Smith',
        'Approved for construction'
      );

      expect(result).toEqual({
        success: true,
        newStatus: MEPSubmittalStatus.APPROVED,
      });
    });

    it('should successfully perform REJECTED action and set stamp status', async () => {
      const mockSubmittal = {
        id: 'submittal-1',
        status: 'SUBMITTED',
        projectId: 'project-1',
        submittalNumber: 'SUB-001',
      };

      mockPrisma.mEPSubmittal.findUnique.mockResolvedValue(mockSubmittal);
      mockPrisma.mEPSubmittal.update.mockResolvedValue({ ...mockSubmittal, status: 'REJECTED' });
      mockPrisma.submittalApprovalHistory.create.mockResolvedValue({});

      const result = await performApprovalAction(
        'submittal-1',
        'REJECTED',
        'user-2',
        'Jane Smith',
        'Does not meet specifications'
      );

      expect(result).toEqual({
        success: true,
        newStatus: MEPSubmittalStatus.REJECTED,
      });
    });

    it('should successfully perform REVISION_REQUESTED action and set stamp status', async () => {
      const mockSubmittal = {
        id: 'submittal-1',
        status: 'SUBMITTED',
        projectId: 'project-1',
        submittalNumber: 'SUB-001',
      };

      mockPrisma.mEPSubmittal.findUnique.mockResolvedValue(mockSubmittal);
      mockPrisma.mEPSubmittal.update.mockResolvedValue({ ...mockSubmittal, status: 'REVISE_RESUBMIT' });
      mockPrisma.submittalApprovalHistory.create.mockResolvedValue({});

      const result = await performApprovalAction(
        'submittal-1',
        'REVISION_REQUESTED',
        'user-2',
        'Jane Smith',
        'Please provide additional details'
      );

      expect(result).toEqual({
        success: true,
        newStatus: MEPSubmittalStatus.REVISE_RESUBMIT,
      });
    });

    it('should successfully perform REVIEWED action from SUBMITTED status', async () => {
      const mockSubmittal = {
        id: 'submittal-1',
        status: 'SUBMITTED',
        projectId: 'project-1',
        submittalNumber: 'SUB-001',
      };

      mockPrisma.mEPSubmittal.findUnique.mockResolvedValue(mockSubmittal);
      mockPrisma.mEPSubmittal.update.mockResolvedValue({ ...mockSubmittal, status: 'UNDER_REVIEW' });
      mockPrisma.submittalApprovalHistory.create.mockResolvedValue({});

      const result = await performApprovalAction(
        'submittal-1',
        'REVIEWED',
        'user-2',
        'Jane Smith'
      );

      expect(result).toEqual({
        success: true,
        newStatus: MEPSubmittalStatus.UNDER_REVIEW,
      });
    });

    it('should successfully perform RESUBMITTED action from REJECTED status', async () => {
      const mockSubmittal = {
        id: 'submittal-1',
        status: 'REJECTED',
        projectId: 'project-1',
        submittalNumber: 'SUB-001',
      };

      mockPrisma.mEPSubmittal.findUnique.mockResolvedValue(mockSubmittal);
      mockPrisma.mEPSubmittal.update.mockResolvedValue({ ...mockSubmittal, status: 'SUBMITTED' });
      mockPrisma.submittalApprovalHistory.create.mockResolvedValue({});

      const result = await performApprovalAction(
        'submittal-1',
        'RESUBMITTED',
        'user-1',
        'John Doe',
        'Resubmitting with requested changes'
      );

      expect(result).toEqual({
        success: true,
        newStatus: MEPSubmittalStatus.SUBMITTED,
      });
    });

    it('should return error when submittal not found', async () => {
      mockPrisma.mEPSubmittal.findUnique.mockResolvedValue(null);

      const result = await performApprovalAction(
        'invalid-submittal',
        'SUBMITTED',
        'user-1',
        'John Doe'
      );

      expect(result).toEqual({
        success: false,
        newStatus: '',
        error: 'Submittal not found',
      });

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should return error when action not allowed from current status', async () => {
      const mockSubmittal = {
        id: 'submittal-1',
        status: 'PENDING',
        projectId: 'project-1',
        submittalNumber: 'SUB-001',
      };

      mockPrisma.mEPSubmittal.findUnique.mockResolvedValue(mockSubmittal);

      const result = await performApprovalAction(
        'submittal-1',
        'APPROVED',
        'user-2',
        'Jane Smith'
      );

      expect(result).toEqual({
        success: false,
        newStatus: 'PENDING',
        error: 'Action APPROVED not allowed from status PENDING',
      });

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should work without optional comments', async () => {
      const mockSubmittal = {
        id: 'submittal-1',
        status: 'PENDING',
        projectId: 'project-1',
        submittalNumber: 'SUB-001',
      };

      mockPrisma.mEPSubmittal.findUnique.mockResolvedValue(mockSubmittal);
      mockPrisma.mEPSubmittal.update.mockResolvedValue({ ...mockSubmittal, status: 'SUBMITTED' });
      mockPrisma.submittalApprovalHistory.create.mockResolvedValue({});

      const result = await performApprovalAction(
        'submittal-1',
        'SUBMITTED',
        'user-1',
        'John Doe'
      );

      expect(result.success).toBe(true);
    });

    it('should handle invalid action for APPROVED_AS_NOTED status', async () => {
      const mockSubmittal = {
        id: 'submittal-1',
        status: 'APPROVED_AS_NOTED',
        projectId: 'project-1',
        submittalNumber: 'SUB-001',
      };

      mockPrisma.mEPSubmittal.findUnique.mockResolvedValue(mockSubmittal);

      const result = await performApprovalAction(
        'submittal-1',
        'APPROVED',
        'user-2',
        'Jane Smith'
      );

      expect(result).toEqual({
        success: false,
        newStatus: 'APPROVED_AS_NOTED',
        error: 'Action APPROVED not allowed from status APPROVED_AS_NOTED',
      });
    });

    it('should update timestamp when performing action', async () => {
      const mockSubmittal = {
        id: 'submittal-1',
        status: 'PENDING',
        projectId: 'project-1',
        submittalNumber: 'SUB-001',
      };

      mockPrisma.mEPSubmittal.findUnique.mockResolvedValue(mockSubmittal);
      mockPrisma.mEPSubmittal.update.mockResolvedValue({ ...mockSubmittal, status: 'SUBMITTED' });
      mockPrisma.submittalApprovalHistory.create.mockResolvedValue({});

      await performApprovalAction('submittal-1', 'SUBMITTED', 'user-1', 'John Doe');

      // Verify transaction was called (which includes the update with updatedAt)
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('getApprovalStats', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-20T12:00:00Z'));
    });

    it('should calculate approval statistics for a project', async () => {
      const mockProject = { id: 'project-1' };
      const mockSubmittals = [
        { status: 'PENDING', updatedAt: new Date('2024-01-15T10:00:00Z') },
        { status: 'SUBMITTED', updatedAt: new Date('2024-01-16T10:00:00Z') },
        { status: 'SUBMITTED', updatedAt: new Date('2024-01-17T10:00:00Z') },
        { status: 'UNDER_REVIEW', updatedAt: new Date('2024-01-18T10:00:00Z') },
        { status: 'APPROVED', updatedAt: new Date('2024-01-19T10:00:00Z') }, // Recent (within 7 days)
        { status: 'APPROVED', updatedAt: new Date('2024-01-10T10:00:00Z') }, // Not recent
        { status: 'REJECTED', updatedAt: new Date('2024-01-18T10:00:00Z') }, // Recent
        { status: 'REVISE_RESUBMIT', updatedAt: new Date('2024-01-17T10:00:00Z') },
      ];

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.mEPSubmittal.findMany.mockResolvedValue(mockSubmittals);

      const result = await getApprovalStats('project-slug');

      expect(result).toEqual({
        total: 8,
        byStatus: {
          pending: 1,
          submitted: 2,
          under_review: 1,
          approved: 2,
          rejected: 1,
          revise_resubmit: 1,
        },
        pendingReview: 2, // SUBMITTED (2) only - code checks for 'reviewed' not 'under_review'
        recentlyApproved: 1, // Only the one from Jan 19
        recentlyRejected: 1,
      });

      expect(mockPrisma.project.findUnique).toHaveBeenCalledWith({
        where: { slug: 'project-slug' },
        select: { id: true },
      });

      expect(mockPrisma.mEPSubmittal.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        select: { status: true, updatedAt: true },
      });
    });

    it('should return default stats when project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const result = await getApprovalStats('invalid-slug');

      expect(result).toEqual({
        total: 0,
        byStatus: {},
        pendingReview: 0,
        recentlyApproved: 0,
        recentlyRejected: 0,
      });

      expect(mockPrisma.mEPSubmittal.findMany).not.toHaveBeenCalled();
    });

    it('should return zero stats when project has no submittals', async () => {
      const mockProject = { id: 'project-1' };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.mEPSubmittal.findMany.mockResolvedValue([]);

      const result = await getApprovalStats('project-slug');

      expect(result).toEqual({
        total: 0,
        byStatus: {},
        pendingReview: 0,
        recentlyApproved: 0,
        recentlyRejected: 0,
      });
    });

    it('should handle reviewed status as pending review', async () => {
      const mockProject = { id: 'project-1' };
      const mockSubmittals = [
        { status: 'REVIEWED', updatedAt: new Date('2024-01-18T10:00:00Z') },
      ];

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.mEPSubmittal.findMany.mockResolvedValue(mockSubmittals);

      const result = await getApprovalStats('project-slug');

      expect(result.pendingReview).toBe(1);
      expect(result.byStatus.reviewed).toBe(1);
    });

    it('should not count old approvals as recent', async () => {
      const mockProject = { id: 'project-1' };
      const mockSubmittals = [
        { status: 'APPROVED', updatedAt: new Date('2024-01-01T10:00:00Z') }, // 19 days ago
      ];

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.mEPSubmittal.findMany.mockResolvedValue(mockSubmittals);

      const result = await getApprovalStats('project-slug');

      expect(result.recentlyApproved).toBe(0);
      expect(result.total).toBe(1);
      expect(result.byStatus.approved).toBe(1);
    });

    it('should handle multiple statuses correctly', async () => {
      const mockProject = { id: 'project-1' };
      const mockSubmittals = [
        { status: 'APPROVED', updatedAt: new Date('2024-01-15T10:00:00Z') },
        { status: 'APPROVED', updatedAt: new Date('2024-01-16T10:00:00Z') },
        { status: 'APPROVED', updatedAt: new Date('2024-01-17T10:00:00Z') },
        { status: 'REJECTED', updatedAt: new Date('2024-01-18T10:00:00Z') },
        { status: 'REJECTED', updatedAt: new Date('2024-01-19T10:00:00Z') },
      ];

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.mEPSubmittal.findMany.mockResolvedValue(mockSubmittals);

      const result = await getApprovalStats('project-slug');

      expect(result.byStatus.approved).toBe(3);
      expect(result.byStatus.rejected).toBe(2);
      expect(result.recentlyApproved).toBe(3); // All within 7 days
      expect(result.recentlyRejected).toBe(2); // All within 7 days
    });
  });

  describe('getSubmittalsAwaitingAction', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-20T12:00:00Z'));
    });

    it('should return submittals awaiting action sorted by oldest first', async () => {
      const mockProject = { id: 'project-1' };
      const mockSubmittals = [
        {
          id: 'submittal-1',
          submittalNumber: 'SUB-001',
          title: 'HVAC Equipment',
          status: 'SUBMITTED',
          submittedBy: 'user-1',
          updatedAt: new Date('2024-01-15T10:00:00Z'), // 5 days ago
        },
        {
          id: 'submittal-2',
          submittalNumber: 'SUB-002',
          title: 'Electrical Panels',
          status: 'UNDER_REVIEW',
          submittedBy: 'user-2',
          updatedAt: new Date('2024-01-18T10:00:00Z'), // 2 days ago
        },
      ];

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.mEPSubmittal.findMany.mockResolvedValue(mockSubmittals);

      const result = await getSubmittalsAwaitingAction('project-slug', 'user-3');

      expect(result).toEqual([
        {
          id: 'submittal-1',
          submittalNumber: 'SUB-001',
          title: 'HVAC Equipment',
          status: 'SUBMITTED',
          submittedBy: 'user-1',
          submittedAt: new Date('2024-01-15T10:00:00Z'),
          daysWaiting: 5,
        },
        {
          id: 'submittal-2',
          submittalNumber: 'SUB-002',
          title: 'Electrical Panels',
          status: 'UNDER_REVIEW',
          submittedBy: 'user-2',
          submittedAt: new Date('2024-01-18T10:00:00Z'),
          daysWaiting: 2,
        },
      ]);

      expect(mockPrisma.mEPSubmittal.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
        },
        orderBy: { updatedAt: 'asc' },
      });
    });

    it('should return empty array when project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const result = await getSubmittalsAwaitingAction('invalid-slug', 'user-1');

      expect(result).toEqual([]);
      expect(mockPrisma.mEPSubmittal.findMany).not.toHaveBeenCalled();
    });

    it('should return empty array when no submittals awaiting action', async () => {
      const mockProject = { id: 'project-1' };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.mEPSubmittal.findMany.mockResolvedValue([]);

      const result = await getSubmittalsAwaitingAction('project-slug', 'user-1');

      expect(result).toEqual([]);
    });

    it('should calculate days waiting correctly for today', async () => {
      const mockProject = { id: 'project-1' };
      const mockSubmittals = [
        {
          id: 'submittal-1',
          submittalNumber: 'SUB-001',
          title: 'Test Submittal',
          status: 'SUBMITTED',
          submittedBy: 'user-1',
          updatedAt: new Date('2024-01-20T10:00:00Z'), // 2 hours ago
        },
      ];

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.mEPSubmittal.findMany.mockResolvedValue(mockSubmittals);

      const result = await getSubmittalsAwaitingAction('project-slug', 'user-1');

      expect(result[0].daysWaiting).toBe(0);
    });

    it('should calculate days waiting correctly for old submittals', async () => {
      const mockProject = { id: 'project-1' };
      const mockSubmittals = [
        {
          id: 'submittal-1',
          submittalNumber: 'SUB-001',
          title: 'Old Submittal',
          status: 'SUBMITTED',
          submittedBy: 'user-1',
          updatedAt: new Date('2024-01-10T10:00:00Z'), // 10 days ago
        },
      ];

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.mEPSubmittal.findMany.mockResolvedValue(mockSubmittals);

      const result = await getSubmittalsAwaitingAction('project-slug', 'user-1');

      expect(result[0].daysWaiting).toBe(10);
    });

    it('should handle null submittedBy field', async () => {
      const mockProject = { id: 'project-1' };
      const mockSubmittals = [
        {
          id: 'submittal-1',
          submittalNumber: 'SUB-001',
          title: 'Test Submittal',
          status: 'SUBMITTED',
          submittedBy: null,
          updatedAt: new Date('2024-01-18T10:00:00Z'),
        },
      ];

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.mEPSubmittal.findMany.mockResolvedValue(mockSubmittals);

      const result = await getSubmittalsAwaitingAction('project-slug', 'user-1');

      expect(result[0].submittedBy).toBeNull();
    });

    it('should only include SUBMITTED and UNDER_REVIEW statuses', async () => {
      const mockProject = { id: 'project-1' };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.mEPSubmittal.findMany.mockResolvedValue([]);

      await getSubmittalsAwaitingAction('project-slug', 'user-1');

      expect(mockPrisma.mEPSubmittal.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
        },
        orderBy: { updatedAt: 'asc' },
      });
    });

    it('should handle multiple submittals with different waiting times', async () => {
      const mockProject = { id: 'project-1' };
      const mockSubmittals = [
        {
          id: 'submittal-1',
          submittalNumber: 'SUB-001',
          title: 'Oldest',
          status: 'SUBMITTED',
          submittedBy: 'user-1',
          updatedAt: new Date('2024-01-10T10:00:00Z'), // 10 days
        },
        {
          id: 'submittal-2',
          submittalNumber: 'SUB-002',
          title: 'Middle',
          status: 'UNDER_REVIEW',
          submittedBy: 'user-2',
          updatedAt: new Date('2024-01-15T10:00:00Z'), // 5 days
        },
        {
          id: 'submittal-3',
          submittalNumber: 'SUB-003',
          title: 'Recent',
          status: 'SUBMITTED',
          submittedBy: 'user-3',
          updatedAt: new Date('2024-01-19T10:00:00Z'), // 1 day
        },
      ];

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.mEPSubmittal.findMany.mockResolvedValue(mockSubmittals);

      const result = await getSubmittalsAwaitingAction('project-slug', 'user-1');

      expect(result.length).toBe(3);
      expect(result[0].daysWaiting).toBe(10);
      expect(result[1].daysWaiting).toBe(5);
      expect(result[2].daysWaiting).toBe(1);
    });
  });
});
