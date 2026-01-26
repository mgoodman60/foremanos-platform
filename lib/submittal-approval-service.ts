import { prisma } from '@/lib/db';
import { MEPSubmittalStatus } from '@prisma/client';

export type ApprovalAction = 'SUBMITTED' | 'REVIEWED' | 'APPROVED' | 'REJECTED' | 'RESUBMITTED' | 'REVISION_REQUESTED';

export interface ApprovalHistoryEntry {
  id: string;
  action: ApprovalAction;
  fromStatus: string | null;
  toStatus: string;
  performedBy: string;
  performerName: string | null;
  comments: string | null;
  createdAt: Date;
}

const STATUS_TRANSITIONS: Record<string, ApprovalAction[]> = {
  PENDING: ['SUBMITTED'],
  SUBMITTED: ['REVIEWED', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'REVISION_REQUESTED'],
  APPROVED: ['RESUBMITTED'],
  APPROVED_AS_NOTED: ['RESUBMITTED'],
  REJECTED: ['RESUBMITTED'],
  REVISE_RESUBMIT: ['RESUBMITTED'],
};

const ACTION_TO_STATUS: Record<ApprovalAction, MEPSubmittalStatus> = {
  SUBMITTED: MEPSubmittalStatus.SUBMITTED,
  REVIEWED: MEPSubmittalStatus.UNDER_REVIEW,
  APPROVED: MEPSubmittalStatus.APPROVED,
  REJECTED: MEPSubmittalStatus.REJECTED,
  RESUBMITTED: MEPSubmittalStatus.SUBMITTED,
  REVISION_REQUESTED: MEPSubmittalStatus.REVISE_RESUBMIT,
};

export async function getApprovalHistory(submittalId: string): Promise<ApprovalHistoryEntry[]> {
  const history = await prisma.submittalApprovalHistory.findMany({
    where: { submittalId },
    orderBy: { createdAt: 'desc' },
  });

  return history.map((h) => ({
    id: h.id,
    action: h.action as ApprovalAction,
    fromStatus: h.fromStatus,
    toStatus: h.toStatus,
    performedBy: h.performedBy,
    performerName: h.performerName || 'Unknown',
    comments: h.comments,
    createdAt: h.createdAt,
  }));
}

export function getAvailableActions(currentStatus: string): ApprovalAction[] {
  // Normalize status to uppercase for lookup
  const normalizedStatus = currentStatus.toUpperCase().replace(/-/g, '_');
  return STATUS_TRANSITIONS[normalizedStatus] || [];
}

export async function performApprovalAction(
  submittalId: string,
  action: ApprovalAction,
  userId: string,
  userName: string,
  comments?: string
): Promise<{ success: boolean; newStatus: MEPSubmittalStatus | string; error?: string }> {
  // Fetch current submittal
  const submittal = await prisma.mEPSubmittal.findUnique({
    where: { id: submittalId },
  });

  if (!submittal) {
    return { success: false, newStatus: '', error: 'Submittal not found' };
  }

  const currentStatus = submittal.status;
  const availableActions = getAvailableActions(currentStatus);

  if (!availableActions.includes(action)) {
    return {
      success: false,
      newStatus: currentStatus,
      error: `Action ${action} not allowed from status ${currentStatus}`,
    };
  }

  const newStatus = ACTION_TO_STATUS[action];

  // Perform the transition
  await prisma.$transaction([
    // Update submittal status
    prisma.mEPSubmittal.update({
      where: { id: submittalId },
      data: {
        status: newStatus,
        updatedAt: new Date(),
        // Set stamp status based on action
        ...(action === 'APPROVED' && { stampStatus: 'approved' }),
        ...(action === 'REJECTED' && { stampStatus: 'rejected' }),
        ...(action === 'REVISION_REQUESTED' && { stampStatus: 'revise_resubmit' }),
      },
    }),
    // Record history
    prisma.submittalApprovalHistory.create({
      data: {
        submittalId,
        action,
        fromStatus: currentStatus,
        toStatus: newStatus,
        performedBy: userId,
        performerName: userName,
        comments,
      },
    }),
  ]);

  return { success: true, newStatus };
}

export async function getApprovalStats(projectSlug: string): Promise<{
  total: number;
  byStatus: Record<string, number>;
  pendingReview: number;
  recentlyApproved: number;
  recentlyRejected: number;
}> {
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    select: { id: true },
  });

  if (!project) {
    return { total: 0, byStatus: {}, pendingReview: 0, recentlyApproved: 0, recentlyRejected: 0 };
  }

  const submittals = await prisma.mEPSubmittal.findMany({
    where: { projectId: project.id },
    select: { status: true, updatedAt: true },
  });

  const total = submittals.length;
  const byStatus: Record<string, number> = {};

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let recentlyApproved = 0;
  let recentlyRejected = 0;
  let pendingReview = 0;

  for (const s of submittals) {
    const status = s.status.toLowerCase();
    byStatus[status] = (byStatus[status] || 0) + 1;

    if (status === 'submitted' || status === 'reviewed') {
      pendingReview++;
    }
    if (status === 'approved' && s.updatedAt >= weekAgo) {
      recentlyApproved++;
    }
    if (status === 'rejected' && s.updatedAt >= weekAgo) {
      recentlyRejected++;
    }
  }

  return { total, byStatus, pendingReview, recentlyApproved, recentlyRejected };
}

export async function getSubmittalsAwaitingAction(
  projectSlug: string,
  userId: string
): Promise<Array<{
  id: string;
  submittalNumber: string;
  title: string;
  status: string;
  submittedBy: string | null;
  submittedAt: Date | null;
  daysWaiting: number;
}>> {
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    select: { id: true },
  });

  if (!project) return [];

  const submittals = await prisma.mEPSubmittal.findMany({
    where: {
      projectId: project.id,
      status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
    },
    orderBy: { updatedAt: 'asc' },
  });

  return submittals.map((s) => {
    const daysWaiting = Math.floor(
      (Date.now() - new Date(s.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      id: s.id,
      submittalNumber: s.submittalNumber,
      title: s.title,
      status: s.status,
      submittedBy: s.submittedBy,
      submittedAt: s.updatedAt,
      daysWaiting,
    };
  });
}
