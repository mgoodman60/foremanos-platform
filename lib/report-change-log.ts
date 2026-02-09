import { prisma } from './db';
import { logger } from './logger';

export type ChangeType =
  | 'message_added'
  | 'message_edited'
  | 'message_deleted'
  | 'report_finalized'
  | 'report_reopened'
  | 'logo_uploaded';

export interface LogChangeParams {
  conversationId: string;
  messageId?: string;
  userId: string;
  projectId: string;
  reportDate: Date;
  changeType: ChangeType;
  description: string;
  metadata?: any;
}

/**
 * Log a change to a daily report
 * This creates an audit trail for all modifications to daily reports
 */
export async function logReportChange(params: LogChangeParams): Promise<void> {
  const {
    conversationId,
    messageId,
    userId,
    projectId,
    reportDate,
    changeType,
    description,
    metadata,
  } = params;

  try {
    await prisma.reportChangeLog.create({
      data: {
        conversationId,
        messageId: messageId || null,
        userId,
        projectId,
        reportDate,
        changeType,
        description,
        metadata: metadata || {},
      },
    });

    logger.info('REPORT_CHANGELOG', `Logged ${changeType}`, { conversationId, changeType });
  } catch (error) {
    logger.error('REPORT_CHANGELOG', 'Error logging report change', error as Error, { conversationId, changeType });
    // Don't throw - logging errors shouldn't break the main flow
  }
}

/**
 * Get change log for a daily report conversation
 */
export async function getReportChangeLog(
  conversationId: string
): Promise<any[]> {
  try {
    const logs = await prisma.reportChangeLog.findMany({
      where: { conversationId },
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

    return logs;
  } catch (error) {
    logger.error('REPORT_CHANGELOG', 'Error getting report change log', error as Error, { conversationId });
    return [];
  }
}

/**
 * Check if a conversation is a daily report that's currently locked/finalized
 */
export async function isReportLocked(
  conversationId: string
): Promise<boolean> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        conversationType: true,
        isReadOnly: true,
      },
    });

    return (
      conversation?.conversationType === 'daily_report' &&
      conversation?.isReadOnly === true
    );
  } catch (error) {
    logger.error('REPORT_CHANGELOG', 'Error checking report lock status', error as Error, { conversationId });
    return false;
  }
}

/**
 * Check if a user can modify a locked report
 * Only Project Owner or Admin can modify locked reports
 */
export async function canModifyLockedReport(
  userId: string,
  projectId: string
): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) return false;

    // Admins can always modify
    if (user.role === 'admin') return true;

    // Check if user is project owner
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId: userId,
      },
    });

    if (project) return true;

    // Check if user is project member with owner role
    const member = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId,
        role: 'owner',
      },
    });

    return !!member;
  } catch (error) {
    logger.error('REPORT_CHANGELOG', 'Error checking modify locked report permission', error as Error, { userId, projectId });
    return false;
  }
}
