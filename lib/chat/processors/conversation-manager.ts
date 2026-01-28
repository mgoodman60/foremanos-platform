import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isReportLocked, canModifyLockedReport } from '@/lib/report-change-log';
import { markFirstChatStarted } from '@/lib/onboarding-tracker';
import type { ConversationResult } from '@/types/chat';

export interface ConversationManagerOptions {
  userId: string | null;
  conversationId: string | null;
  projectSlug: string;
  message: string | null;
  userRole: string;
}

/**
 * Manage conversation creation and locking checks
 * Extracted from app/api/chat/route.ts lines 140-206
 */
export async function manageConversation(
  options: ConversationManagerOptions
): Promise<ConversationResult> {
  let currentConversationId = options.conversationId;
  let currentProjectId: string | null = null;

  // Get projectId from slug if provided
  if (options.projectSlug) {
    const project = await prisma.project.findUnique({
      where: { slug: options.projectSlug },
      select: { id: true },
    });
    currentProjectId = project?.id || null;
  }

  // Create conversation for logged-in users if not provided
  if (options.userId && !currentConversationId) {
    const firstMessage = options.message || 'Image uploaded';
    const title = firstMessage.length > 50
      ? firstMessage.substring(0, 47) + '...'
      : firstMessage;

    const newConversation = await prisma.conversation.create({
      data: {
        userId: options.userId,
        title,
        userRole: options.userRole,
        projectId: currentProjectId,
      },
    });
    currentConversationId = newConversation.id;

    // Track onboarding progress - first chat started
    if (currentProjectId) {
      markFirstChatStarted(options.userId, currentProjectId).catch((err) => {
        console.error('[ONBOARDING] Error marking first chat started:', err);
      });
    }
  }

  // Check if this is a locked daily report
  if (options.userId && currentConversationId) {
    const locked = await isReportLocked(currentConversationId);

    if (locked) {
      const conv = await prisma.conversation.findUnique({
        where: { id: currentConversationId },
        select: { projectId: true },
      });

      if (conv?.projectId) {
        const canModify = await canModifyLockedReport(options.userId, conv.projectId);

        if (!canModify) {
          throw new Error('REPORT_LOCKED');
        }

        // User has permission to modify locked report - log this action
        console.log(`[LOCKED_REPORT_MODIFICATION] User ${options.userId} is modifying locked report ${currentConversationId}`);
      }
    }
  }

  return {
    id: currentConversationId,
    projectId: currentProjectId,
    created: !!currentConversationId && !options.conversationId,
  };
}

/**
 * Create locked report error response
 */
export function lockedReportResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'This daily report is locked and cannot be modified. Only project owners and admins can modify locked reports.',
      isLocked: true,
    },
    { status: 403 }
  );
}
