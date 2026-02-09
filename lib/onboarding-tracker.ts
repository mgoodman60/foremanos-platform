/**
 * Onboarding Progress Tracker
 * Utility functions for automatically updating user onboarding progress
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

interface UpdateProgressParams {
  userId: string;
  projectId?: string;
  step:
    | 'createdProject'
    | 'uploadedDocuments'
    | 'processedDocuments'
    | 'startedFirstChat'
    | 'finalizedFirstReport'
    | 'reviewedScheduleUpdates';
}

/**
 * Update a single step in the onboarding progress
 */
export async function updateOnboardingProgress(params: UpdateProgressParams) {
  const { userId, projectId, step } = params;

  try {
    // Get current progress
    const progress = await prisma.onboardingProgress.findUnique({
      where: { userId },
    });

    // If step is already complete, skip
    if (progress && (progress as any)[step]) {
      return progress;
    }

    // Prepare update data
    const updateData: any = {
      [step]: true,
      [`${step}At`]: new Date(),
    };

    // Add projectId if provided and not set
    if (projectId && (!progress || !progress.projectId)) {
      updateData.projectId = projectId;
    }

    // Upsert progress
    const updatedProgress = await prisma.onboardingProgress.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        projectId: projectId || undefined,
        ...updateData,
      },
    });

    // Check if all steps are complete
    const allSteps = [
      'createdProject',
      'uploadedDocuments',
      'processedDocuments',
      'startedFirstChat',
      'finalizedFirstReport',
      'reviewedScheduleUpdates',
    ];

    const allComplete = allSteps.every(
      (s) => (updatedProgress as any)[s] === true
    );

    // If all complete and not yet marked, mark as complete
    if (allComplete && !updatedProgress.completedAt) {
      return await prisma.onboardingProgress.update({
        where: { userId },
        data: { completedAt: new Date() },
      });
    }

    return updatedProgress;
  } catch (error) {
    logger.error('ONBOARDING', 'Error updating onboarding progress', error as Error);
    // Silently fail - don't block user actions
    return null;
  }
}

/**
 * Mark "uploadedDocuments" step as complete
 */
export async function markDocumentUploaded(userId: string, projectId: string) {
  return updateOnboardingProgress({
    userId,
    projectId,
    step: 'uploadedDocuments',
  });
}

/**
 * Mark "processedDocuments" step as complete
 */
export async function markDocumentProcessed(userId: string, projectId: string) {
  return updateOnboardingProgress({
    userId,
    projectId,
    step: 'processedDocuments',
  });
}

/**
 * Mark "startedFirstChat" step as complete
 */
export async function markFirstChatStarted(userId: string, projectId: string) {
  return updateOnboardingProgress({
    userId,
    projectId,
    step: 'startedFirstChat',
  });
}

/**
 * Mark "finalizedFirstReport" step as complete
 */
export async function markFirstReportFinalized(userId: string, projectId: string) {
  return updateOnboardingProgress({
    userId,
    projectId,
    step: 'finalizedFirstReport',
  });
}

/**
 * Mark "reviewedScheduleUpdates" step as complete
 */
export async function markScheduleUpdatesReviewed(userId: string, projectId: string) {
  return updateOnboardingProgress({
    userId,
    projectId,
    step: 'reviewedScheduleUpdates',
  });
}
