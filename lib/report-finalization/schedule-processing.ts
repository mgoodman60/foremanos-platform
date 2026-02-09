/**
 * Schedule processing after report finalization
 */

import { prisma } from '../db';
import { ScheduleTaskStatus } from '@prisma/client';
import { createScopedLogger } from '../logger';

const log = createScopedLogger('SCHEDULE_PROCESSING');

/**
 * Process automatic schedule updates after report finalization
 */
export async function processScheduleUpdatesAfterFinalization(
  conversationId: string,
  projectSlug: string,
  userId?: string
): Promise<void> {
  if (!projectSlug) {
    log.info('No project slug, skipping schedule updates');
    return;
  }

  try {
    // Get project settings
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      select: {
        id: true,
        scheduleAutoUpdateEnabled: true,
        scheduleAutoApplyThreshold: true,
        scheduleRequireManualReview: true,
        Schedule: {
          where: { isActive: true },
          select: {
            id: true,
            autoUpdateEnabled: true
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!project) {
      log.info('Project not found for schedule update');
      return;
    }

    // Check if auto-update is enabled at project level
    if (!project.scheduleAutoUpdateEnabled) {
      log.info('Schedule auto-update disabled at project level');
      return;
    }

    // Check if there's an active schedule with auto-update enabled
    const activeSchedule = project.Schedule[0];
    if (!activeSchedule || !activeSchedule.autoUpdateEnabled) {
      log.info('No active schedule with auto-update enabled');
      return;
    }

    // Get report content
    const messages = await prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: { userRole: true, message: true },
    });

    const reportContent = messages
      .filter((m) => m.userRole === 'user')
      .map((m) => m.message)
      .join('\n\n');

    if (!reportContent) {
      log.info('No report content found for schedule update');
      return;
    }

    // Analyze for schedule impacts
    const { analyzeScheduleImpact } = await import('../schedule-analyzer');
    const analysis = await analyzeScheduleImpact(reportContent, projectSlug);

    if (!analysis.hasScheduleImpact || analysis.suggestions.length === 0) {
      log.info('No schedule impacts detected');
      return;
    }

    const threshold = project.scheduleAutoApplyThreshold || 85;
    const requireManualReview = project.scheduleRequireManualReview ?? true;

    // Filter suggestions by confidence threshold
    const autoApplicableSuggestions = analysis.suggestions.filter(
      s => s.confidence >= threshold
    );

    if (autoApplicableSuggestions.length === 0) {
      log.info('Suggestions below confidence threshold', { count: analysis.suggestions.length, threshold });

      // Store suggestions as pending for manual review
      for (const suggestion of analysis.suggestions) {
        await prisma.scheduleUpdate.create({
          data: {
            projectId: project.id,
            scheduleId: activeSchedule.id,
            taskId: suggestion.taskId,
            source: 'daily_report',
            sourceId: conversationId,
            previousStatus: suggestion.currentStatus,
            newStatus: suggestion.suggestedStatus,
            previousPercentComplete: suggestion.currentPercentComplete,
            newPercentComplete: suggestion.suggestedPercentComplete,
            confidence: suggestion.confidence,
            reasoning: suggestion.reasoning,
            impactType: suggestion.impactType,
            severity: suggestion.severity,
            status: 'pending',
            createdBy: userId || 'system',
          },
        });
      }
      return;
    }

    if (requireManualReview) {
      // Store all suggestions as pending for manual review
      log.info('Manual review required, storing suggestions as pending', { count: autoApplicableSuggestions.length });

      for (const suggestion of autoApplicableSuggestions) {
        await prisma.scheduleUpdate.create({
          data: {
            projectId: project.id,
            scheduleId: activeSchedule.id,
            taskId: suggestion.taskId,
            source: 'daily_report',
            sourceId: conversationId,
            previousStatus: suggestion.currentStatus,
            newStatus: suggestion.suggestedStatus,
            previousPercentComplete: suggestion.currentPercentComplete,
            newPercentComplete: suggestion.suggestedPercentComplete,
            confidence: suggestion.confidence,
            reasoning: suggestion.reasoning,
            impactType: suggestion.impactType,
            severity: suggestion.severity,
            status: 'pending',
            createdBy: userId || 'system',
          },
        });
      }
      return;
    }

    // Auto-apply high-confidence suggestions
    log.info('Auto-applying high-confidence updates', { count: autoApplicableSuggestions.length });

    for (const suggestion of autoApplicableSuggestions) {
      try {
        // Get the task from the schedule
        const task = await prisma.scheduleTask.findFirst({
          where: {
            scheduleId: activeSchedule.id,
            taskId: suggestion.taskId,
          },
        });

        if (!task) {
          log.info('Task not found, skipping', { taskId: suggestion.taskId });
          continue;
        }

        // Create audit record
        const scheduleUpdate = await prisma.scheduleUpdate.create({
          data: {
            projectId: project.id,
            scheduleId: activeSchedule.id,
            taskId: suggestion.taskId,
            source: 'daily_report',
            sourceId: conversationId,
            previousStatus: task.status,
            newStatus: suggestion.suggestedStatus,
            previousPercentComplete: task.percentComplete,
            newPercentComplete: suggestion.suggestedPercentComplete,
            confidence: suggestion.confidence,
            reasoning: suggestion.reasoning,
            impactType: suggestion.impactType,
            severity: suggestion.severity,
            status: 'auto_applied',
            appliedAt: new Date(),
            appliedBy: 'system',
            createdBy: userId || 'system',
          },
        });

        // Apply the update
        await prisma.scheduleTask.update({
          where: { id: task.id },
          data: {
            status: suggestion.suggestedStatus as ScheduleTaskStatus,
            percentComplete: suggestion.suggestedPercentComplete,
          },
        });

        log.info('Auto-applied schedule update', { taskId: suggestion.taskId, from: suggestion.currentPercentComplete, to: suggestion.suggestedPercentComplete });
      } catch (error) {
        log.error(`Error auto-applying update for task ${suggestion.taskId}`, error as Error);
      }
    }

    // Update schedule lastAutoUpdateAt
    await prisma.schedule.update({
      where: { id: activeSchedule.id },
      data: { lastAutoUpdateAt: new Date() },
    });

    log.info('Processed automatic schedule updates', { count: autoApplicableSuggestions.length });
  } catch (error) {
    log.error('Error processing schedule updates', error as Error);
    throw error;
  }
}
