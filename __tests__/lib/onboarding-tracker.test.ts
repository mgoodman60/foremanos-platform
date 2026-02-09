import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma client using vi.hoisted pattern
const mockPrisma = vi.hoisted(() => ({
  onboardingProgress: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Mock logger
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

import {
  updateOnboardingProgress,
  markDocumentUploaded,
  markDocumentProcessed,
  markFirstChatStarted,
  markFirstReportFinalized,
  markScheduleUpdatesReviewed,
} from '@/lib/onboarding-tracker';

describe('Onboarding Tracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateOnboardingProgress', () => {
    describe('New progress (first step)', () => {
      it('should create new progress record when none exists', async () => {
        mockPrisma.onboardingProgress.findUnique.mockResolvedValue(null);
        mockPrisma.onboardingProgress.upsert.mockResolvedValue({
          id: 'progress-1',
          userId: 'user-1',
          projectId: 'project-1',
          createdProject: true,
          createdProjectAt: new Date('2026-01-31T10:00:00Z'),
          uploadedDocuments: false,
          uploadedDocumentsAt: null,
          processedDocuments: false,
          processedDocumentsAt: null,
          startedFirstChat: false,
          startedFirstChatAt: null,
          finalizedFirstReport: false,
          finalizedFirstReportAt: null,
          reviewedScheduleUpdates: false,
          reviewedScheduleUpdatesAt: null,
          completedAt: null,
          createdAt: new Date('2026-01-31T10:00:00Z'),
          updatedAt: new Date('2026-01-31T10:00:00Z'),
        });

        const result = await updateOnboardingProgress({
          userId: 'user-1',
          projectId: 'project-1',
          step: 'createdProject',
        });

        expect(mockPrisma.onboardingProgress.findUnique).toHaveBeenCalledWith({
          where: { userId: 'user-1' },
        });

        expect(mockPrisma.onboardingProgress.upsert).toHaveBeenCalledWith({
          where: { userId: 'user-1' },
          update: expect.objectContaining({
            createdProject: true,
            projectId: 'project-1',
          }),
          create: expect.objectContaining({
            userId: 'user-1',
            projectId: 'project-1',
            createdProject: true,
          }),
        });

        expect(result).toBeDefined();
        expect(result?.createdProject).toBe(true);
      });

      it('should set timestamp for the step', async () => {
        mockPrisma.onboardingProgress.findUnique.mockResolvedValue(null);
        mockPrisma.onboardingProgress.upsert.mockImplementation(async ({ update }) => {
          expect(update).toHaveProperty('uploadedDocumentsAt');
          expect(update.uploadedDocumentsAt).toBeInstanceOf(Date);
          return {
            id: 'progress-1',
            userId: 'user-1',
            uploadedDocuments: true,
            uploadedDocumentsAt: update.uploadedDocumentsAt,
          };
        });

        await updateOnboardingProgress({
          userId: 'user-1',
          projectId: 'project-1',
          step: 'uploadedDocuments',
        });

        expect(mockPrisma.onboardingProgress.upsert).toHaveBeenCalled();
      });

      it('should handle creation without projectId', async () => {
        mockPrisma.onboardingProgress.findUnique.mockResolvedValue(null);
        mockPrisma.onboardingProgress.upsert.mockResolvedValue({
          id: 'progress-1',
          userId: 'user-1',
          projectId: null,
          startedFirstChat: true,
          startedFirstChatAt: new Date(),
        });

        const result = await updateOnboardingProgress({
          userId: 'user-1',
          step: 'startedFirstChat',
        });

        expect(mockPrisma.onboardingProgress.upsert).toHaveBeenCalledWith({
          where: { userId: 'user-1' },
          update: expect.objectContaining({
            startedFirstChat: true,
          }),
          create: expect.objectContaining({
            userId: 'user-1',
            projectId: undefined,
            startedFirstChat: true,
          }),
        });

        expect(result?.projectId).toBeNull();
      });
    });

    describe('Updating existing progress', () => {
      it('should update existing progress with new step', async () => {
        const existingProgress = {
          id: 'progress-1',
          userId: 'user-1',
          projectId: 'project-1',
          createdProject: true,
          createdProjectAt: new Date('2026-01-30T10:00:00Z'),
          uploadedDocuments: false,
          uploadedDocumentsAt: null,
          processedDocuments: false,
          processedDocumentsAt: null,
          startedFirstChat: false,
          startedFirstChatAt: null,
          finalizedFirstReport: false,
          finalizedFirstReportAt: null,
          reviewedScheduleUpdates: false,
          reviewedScheduleUpdatesAt: null,
          completedAt: null,
        };

        mockPrisma.onboardingProgress.findUnique.mockResolvedValue(existingProgress);
        mockPrisma.onboardingProgress.upsert.mockResolvedValue({
          ...existingProgress,
          uploadedDocuments: true,
          uploadedDocumentsAt: new Date('2026-01-31T10:00:00Z'),
        });

        const result = await updateOnboardingProgress({
          userId: 'user-1',
          projectId: 'project-1',
          step: 'uploadedDocuments',
        });

        expect(result?.uploadedDocuments).toBe(true);
        expect(result?.createdProject).toBe(true);
      });

      it('should skip update if step is already complete', async () => {
        const existingProgress = {
          id: 'progress-1',
          userId: 'user-1',
          projectId: 'project-1',
          processedDocuments: true,
          processedDocumentsAt: new Date('2026-01-30T10:00:00Z'),
        };

        mockPrisma.onboardingProgress.findUnique.mockResolvedValue(existingProgress);

        const result = await updateOnboardingProgress({
          userId: 'user-1',
          projectId: 'project-1',
          step: 'processedDocuments',
        });

        expect(mockPrisma.onboardingProgress.upsert).not.toHaveBeenCalled();
        expect(result).toEqual(existingProgress);
      });

      it('should not overwrite projectId if already set', async () => {
        const existingProgress = {
          id: 'progress-1',
          userId: 'user-1',
          projectId: 'project-1',
          createdProject: true,
          createdProjectAt: new Date(),
          uploadedDocuments: false,
        };

        mockPrisma.onboardingProgress.findUnique.mockResolvedValue(existingProgress);
        mockPrisma.onboardingProgress.upsert.mockResolvedValue({
          ...existingProgress,
          uploadedDocuments: true,
          uploadedDocumentsAt: new Date(),
        });

        await updateOnboardingProgress({
          userId: 'user-1',
          projectId: 'project-2', // Different project
          step: 'uploadedDocuments',
        });

        const upsertCall = mockPrisma.onboardingProgress.upsert.mock.calls[0][0];
        expect(upsertCall.update.projectId).toBeUndefined();
      });

      it('should set projectId if not previously set', async () => {
        const existingProgress = {
          id: 'progress-1',
          userId: 'user-1',
          projectId: null,
          createdProject: true,
          createdProjectAt: new Date(),
        };

        mockPrisma.onboardingProgress.findUnique.mockResolvedValue(existingProgress);
        mockPrisma.onboardingProgress.upsert.mockResolvedValue({
          ...existingProgress,
          projectId: 'project-1',
          uploadedDocuments: true,
          uploadedDocumentsAt: new Date(),
        });

        await updateOnboardingProgress({
          userId: 'user-1',
          projectId: 'project-1',
          step: 'uploadedDocuments',
        });

        const upsertCall = mockPrisma.onboardingProgress.upsert.mock.calls[0][0];
        expect(upsertCall.update.projectId).toBe('project-1');
      });
    });

    describe('Completion detection', () => {
      it('should mark progress as complete when all steps are done', async () => {
        const almostComplete = {
          id: 'progress-1',
          userId: 'user-1',
          projectId: 'project-1',
          createdProject: true,
          createdProjectAt: new Date(),
          uploadedDocuments: true,
          uploadedDocumentsAt: new Date(),
          processedDocuments: true,
          processedDocumentsAt: new Date(),
          startedFirstChat: true,
          startedFirstChatAt: new Date(),
          finalizedFirstReport: true,
          finalizedFirstReportAt: new Date(),
          reviewedScheduleUpdates: false,
          reviewedScheduleUpdatesAt: null,
          completedAt: null,
        };

        mockPrisma.onboardingProgress.findUnique.mockResolvedValue(almostComplete);

        const allComplete = {
          ...almostComplete,
          reviewedScheduleUpdates: true,
          reviewedScheduleUpdatesAt: new Date(),
        };

        mockPrisma.onboardingProgress.upsert.mockResolvedValue(allComplete);

        const finalComplete = {
          ...allComplete,
          completedAt: new Date('2026-01-31T10:00:00Z'),
        };

        mockPrisma.onboardingProgress.update.mockResolvedValue(finalComplete);

        const result = await updateOnboardingProgress({
          userId: 'user-1',
          projectId: 'project-1',
          step: 'reviewedScheduleUpdates',
        });

        expect(mockPrisma.onboardingProgress.update).toHaveBeenCalledWith({
          where: { userId: 'user-1' },
          data: { completedAt: expect.any(Date) },
        });

        expect(result?.completedAt).toBeDefined();
      });

      it('should not mark as complete if not all steps are done', async () => {
        const partialProgress = {
          id: 'progress-1',
          userId: 'user-1',
          createdProject: true,
          createdProjectAt: new Date(),
          uploadedDocuments: true,
          uploadedDocumentsAt: new Date(),
          processedDocuments: false,
          processedDocumentsAt: null,
          startedFirstChat: false,
          startedFirstChatAt: null,
          finalizedFirstReport: false,
          finalizedFirstReportAt: null,
          reviewedScheduleUpdates: false,
          reviewedScheduleUpdatesAt: null,
          completedAt: null,
        };

        mockPrisma.onboardingProgress.findUnique.mockResolvedValue(partialProgress);
        mockPrisma.onboardingProgress.upsert.mockResolvedValue({
          ...partialProgress,
          processedDocuments: true,
          processedDocumentsAt: new Date(),
        });

        const result = await updateOnboardingProgress({
          userId: 'user-1',
          projectId: 'project-1',
          step: 'processedDocuments',
        });

        expect(mockPrisma.onboardingProgress.update).not.toHaveBeenCalled();
        expect(result?.completedAt).toBeNull();
      });

      it('should not update completedAt if already set', async () => {
        const alreadyComplete = {
          id: 'progress-1',
          userId: 'user-1',
          createdProject: true,
          uploadedDocuments: true,
          processedDocuments: true,
          startedFirstChat: true,
          finalizedFirstReport: true,
          reviewedScheduleUpdates: true,
          completedAt: new Date('2026-01-30T10:00:00Z'),
        };

        mockPrisma.onboardingProgress.findUnique.mockResolvedValue(alreadyComplete);
        mockPrisma.onboardingProgress.upsert.mockResolvedValue(alreadyComplete);

        const result = await updateOnboardingProgress({
          userId: 'user-1',
          projectId: 'project-1',
          step: 'createdProject',
        });

        expect(mockPrisma.onboardingProgress.update).not.toHaveBeenCalled();
        expect(result?.completedAt).toEqual(alreadyComplete.completedAt);
      });
    });

    describe('Error handling', () => {
      it('should return null and log error when findUnique fails', async () => {
        mockPrisma.onboardingProgress.findUnique.mockRejectedValue(
          new Error('Database connection failed')
        );

        const result = await updateOnboardingProgress({
          userId: 'user-1',
          projectId: 'project-1',
          step: 'createdProject',
        });

        expect(result).toBeNull();
        expect(mockLogger.error).toHaveBeenCalledWith(
          'ONBOARDING',
          'Error updating onboarding progress',
          expect.any(Error)
        );
      });

      it('should return null and log error when upsert fails', async () => {
        mockPrisma.onboardingProgress.findUnique.mockResolvedValue(null);
        mockPrisma.onboardingProgress.upsert.mockRejectedValue(
          new Error('Unique constraint violation')
        );

        const result = await updateOnboardingProgress({
          userId: 'user-1',
          projectId: 'project-1',
          step: 'uploadedDocuments',
        });

        expect(result).toBeNull();
        expect(mockLogger.error).toHaveBeenCalledWith(
          'ONBOARDING',
          'Error updating onboarding progress',
          expect.any(Error)
        );
      });

      it('should return null when update completedAt fails', async () => {
        const allComplete = {
          id: 'progress-1',
          userId: 'user-1',
          createdProject: true,
          uploadedDocuments: true,
          processedDocuments: true,
          startedFirstChat: true,
          finalizedFirstReport: true,
          reviewedScheduleUpdates: false,
          completedAt: null,
        };

        mockPrisma.onboardingProgress.findUnique.mockResolvedValue(allComplete);
        mockPrisma.onboardingProgress.upsert.mockResolvedValue({
          ...allComplete,
          reviewedScheduleUpdates: true,
          reviewedScheduleUpdatesAt: new Date(),
        });
        mockPrisma.onboardingProgress.update.mockRejectedValue(
          new Error('Update failed')
        );

        const result = await updateOnboardingProgress({
          userId: 'user-1',
          projectId: 'project-1',
          step: 'reviewedScheduleUpdates',
        });

        expect(result).toBeNull();
        expect(mockLogger.error).toHaveBeenCalledWith(
          'ONBOARDING',
          'Error updating onboarding progress',
          expect.any(Error)
        );
      });
    });

    describe('All step types', () => {
      const stepTests: Array<{
        step: 'createdProject' | 'uploadedDocuments' | 'processedDocuments' | 'startedFirstChat' | 'finalizedFirstReport' | 'reviewedScheduleUpdates';
        description: string;
      }> = [
        { step: 'createdProject', description: 'should mark createdProject step' },
        { step: 'uploadedDocuments', description: 'should mark uploadedDocuments step' },
        { step: 'processedDocuments', description: 'should mark processedDocuments step' },
        { step: 'startedFirstChat', description: 'should mark startedFirstChat step' },
        { step: 'finalizedFirstReport', description: 'should mark finalizedFirstReport step' },
        { step: 'reviewedScheduleUpdates', description: 'should mark reviewedScheduleUpdates step' },
      ];

      stepTests.forEach(({ step, description }) => {
        it(description, async () => {
          mockPrisma.onboardingProgress.findUnique.mockResolvedValue(null);
          mockPrisma.onboardingProgress.upsert.mockResolvedValue({
            id: 'progress-1',
            userId: 'user-1',
            [step]: true,
            [`${step}At`]: new Date(),
          });

          const result = await updateOnboardingProgress({
            userId: 'user-1',
            projectId: 'project-1',
            step,
          });

          expect(result).toBeDefined();
          expect((result as any)?.[step]).toBe(true);
          expect((result as any)?.[`${step}At`]).toBeInstanceOf(Date);
        });
      });
    });
  });

  describe('markDocumentUploaded', () => {
    it('should call updateOnboardingProgress with uploadedDocuments step', async () => {
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(null);
      mockPrisma.onboardingProgress.upsert.mockResolvedValue({
        id: 'progress-1',
        userId: 'user-1',
        projectId: 'project-1',
        uploadedDocuments: true,
        uploadedDocumentsAt: new Date(),
      });

      const result = await markDocumentUploaded('user-1', 'project-1');

      expect(mockPrisma.onboardingProgress.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(result?.uploadedDocuments).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.onboardingProgress.findUnique.mockRejectedValue(
        new Error('Database error')
      );

      const result = await markDocumentUploaded('user-1', 'project-1');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('markDocumentProcessed', () => {
    it('should call updateOnboardingProgress with processedDocuments step', async () => {
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(null);
      mockPrisma.onboardingProgress.upsert.mockResolvedValue({
        id: 'progress-1',
        userId: 'user-1',
        projectId: 'project-1',
        processedDocuments: true,
        processedDocumentsAt: new Date(),
      });

      const result = await markDocumentProcessed('user-1', 'project-1');

      expect(mockPrisma.onboardingProgress.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(result?.processedDocuments).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.onboardingProgress.findUnique.mockRejectedValue(
        new Error('Database error')
      );

      const result = await markDocumentProcessed('user-1', 'project-1');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('markFirstChatStarted', () => {
    it('should call updateOnboardingProgress with startedFirstChat step', async () => {
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(null);
      mockPrisma.onboardingProgress.upsert.mockResolvedValue({
        id: 'progress-1',
        userId: 'user-1',
        projectId: 'project-1',
        startedFirstChat: true,
        startedFirstChatAt: new Date(),
      });

      const result = await markFirstChatStarted('user-1', 'project-1');

      expect(mockPrisma.onboardingProgress.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(result?.startedFirstChat).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.onboardingProgress.findUnique.mockRejectedValue(
        new Error('Database error')
      );

      const result = await markFirstChatStarted('user-1', 'project-1');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('markFirstReportFinalized', () => {
    it('should call updateOnboardingProgress with finalizedFirstReport step', async () => {
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(null);
      mockPrisma.onboardingProgress.upsert.mockResolvedValue({
        id: 'progress-1',
        userId: 'user-1',
        projectId: 'project-1',
        finalizedFirstReport: true,
        finalizedFirstReportAt: new Date(),
      });

      const result = await markFirstReportFinalized('user-1', 'project-1');

      expect(mockPrisma.onboardingProgress.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(result?.finalizedFirstReport).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.onboardingProgress.findUnique.mockRejectedValue(
        new Error('Database error')
      );

      const result = await markFirstReportFinalized('user-1', 'project-1');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('markScheduleUpdatesReviewed', () => {
    it('should call updateOnboardingProgress with reviewedScheduleUpdates step', async () => {
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(null);
      mockPrisma.onboardingProgress.upsert.mockResolvedValue({
        id: 'progress-1',
        userId: 'user-1',
        projectId: 'project-1',
        reviewedScheduleUpdates: true,
        reviewedScheduleUpdatesAt: new Date(),
      });

      const result = await markScheduleUpdatesReviewed('user-1', 'project-1');

      expect(mockPrisma.onboardingProgress.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(result?.reviewedScheduleUpdates).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.onboardingProgress.findUnique.mockRejectedValue(
        new Error('Database error')
      );

      const result = await markScheduleUpdatesReviewed('user-1', 'project-1');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete onboarding flow', async () => {
      // Step 1: Create project
      mockPrisma.onboardingProgress.findUnique.mockResolvedValueOnce(null);
      mockPrisma.onboardingProgress.upsert.mockResolvedValueOnce({
        id: 'progress-1',
        userId: 'user-1',
        projectId: 'project-1',
        createdProject: true,
        createdProjectAt: new Date(),
        uploadedDocuments: false,
        processedDocuments: false,
        startedFirstChat: false,
        finalizedFirstReport: false,
        reviewedScheduleUpdates: false,
        completedAt: null,
      });

      await updateOnboardingProgress({
        userId: 'user-1',
        projectId: 'project-1',
        step: 'createdProject',
      });

      // Step 2: Upload documents
      mockPrisma.onboardingProgress.findUnique.mockResolvedValueOnce({
        id: 'progress-1',
        userId: 'user-1',
        projectId: 'project-1',
        createdProject: true,
        createdProjectAt: new Date(),
        uploadedDocuments: false,
      });
      mockPrisma.onboardingProgress.upsert.mockResolvedValueOnce({
        id: 'progress-1',
        userId: 'user-1',
        projectId: 'project-1',
        createdProject: true,
        uploadedDocuments: true,
        uploadedDocumentsAt: new Date(),
        processedDocuments: false,
        startedFirstChat: false,
        finalizedFirstReport: false,
        reviewedScheduleUpdates: false,
        completedAt: null,
      });

      await markDocumentUploaded('user-1', 'project-1');

      expect(mockPrisma.onboardingProgress.findUnique).toHaveBeenCalledTimes(2);
      expect(mockPrisma.onboardingProgress.upsert).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent step updates', async () => {
      const baseProgress = {
        id: 'progress-1',
        userId: 'user-1',
        projectId: 'project-1',
        createdProject: true,
        createdProjectAt: new Date(),
        uploadedDocuments: false,
        processedDocuments: false,
        startedFirstChat: false,
        finalizedFirstReport: false,
        reviewedScheduleUpdates: false,
        completedAt: null,
      };

      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(baseProgress);
      mockPrisma.onboardingProgress.upsert
        .mockResolvedValueOnce({
          ...baseProgress,
          uploadedDocuments: true,
          uploadedDocumentsAt: new Date(),
        })
        .mockResolvedValueOnce({
          ...baseProgress,
          processedDocuments: true,
          processedDocumentsAt: new Date(),
        });

      await Promise.all([
        markDocumentUploaded('user-1', 'project-1'),
        markDocumentProcessed('user-1', 'project-1'),
      ]);

      expect(mockPrisma.onboardingProgress.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty userId', async () => {
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(null);
      mockPrisma.onboardingProgress.upsert.mockResolvedValue({
        userId: '',
        createdProject: true,
      });

      const result = await updateOnboardingProgress({
        userId: '',
        projectId: 'project-1',
        step: 'createdProject',
      });

      expect(mockPrisma.onboardingProgress.findUnique).toHaveBeenCalledWith({
        where: { userId: '' },
      });
      expect(result).toBeDefined();
    });

    it('should handle empty projectId', async () => {
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(null);
      mockPrisma.onboardingProgress.upsert.mockResolvedValue({
        userId: 'user-1',
        projectId: '',
        createdProject: true,
      });

      const result = await updateOnboardingProgress({
        userId: 'user-1',
        projectId: '',
        step: 'createdProject',
      });

      expect(result?.projectId).toBe('');
    });

    it('should handle database timeout', async () => {
      mockPrisma.onboardingProgress.findUnique.mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      const result = await updateOnboardingProgress({
        userId: 'user-1',
        projectId: 'project-1',
        step: 'createdProject',
      });

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle null values in existing progress', async () => {
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue({
        id: 'progress-1',
        userId: 'user-1',
        projectId: null,
        createdProject: null as any,
        uploadedDocuments: null as any,
      });
      mockPrisma.onboardingProgress.upsert.mockResolvedValue({
        id: 'progress-1',
        userId: 'user-1',
        projectId: 'project-1',
        uploadedDocuments: true,
        uploadedDocumentsAt: new Date(),
      });

      const result = await updateOnboardingProgress({
        userId: 'user-1',
        projectId: 'project-1',
        step: 'uploadedDocuments',
      });

      expect(result).toBeDefined();
      expect(mockPrisma.onboardingProgress.upsert).toHaveBeenCalled();
    });
  });
});
