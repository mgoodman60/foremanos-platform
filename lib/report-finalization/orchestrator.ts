/**
 * Report finalization orchestrator
 * Coordinates all finalization steps
 */

import { prisma } from '../db';
import { format } from 'date-fns';
import { createScopedLogger } from '../logger';
import type { FinalizationOptions, FinalizationResult } from './types';
import { hasReportData, isUserActive, toZonedTime } from './validation';
import { generateReportPDF } from './pdf-generation';
import { saveToDocumentLibrary } from './document-library';
import { exportToOneDrive } from './onedrive-export';
import { indexForRAG } from './rag-indexing';
import { processScheduleUpdatesAfterFinalization } from './schedule-processing';

const log = createScopedLogger('FINALIZATION');

/**
 * Finalize a daily report
 */
export async function finalizeReport(
  options: FinalizationOptions
): Promise<FinalizationResult> {
  const { conversationId, userId, method, skipWarning } = options;

  try {
    // 1. Get conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { Project: true },
    });

    if (!conversation) {
      return {
        success: false,
        conversationId,
        finalized: false,
        error: 'Conversation not found',
      };
    }

    // 2. Check if already finalized
    if (conversation.finalized) {
      return {
        success: false,
        conversationId,
        finalized: true,
        warning: 'Report already finalized',
      };
    }

    // 3. Check if report has data
    const hasData = await hasReportData(conversationId);
    if (!hasData) {
      return {
        success: false,
        conversationId,
        finalized: false,
        warning: 'No data to finalize',
      };
    }

    // 4. Check user activity (only for auto finalization)
    if (method === 'auto' && !skipWarning) {
      const active = await isUserActive(conversationId, 5);
      if (active && !conversation.finalizationWarned) {
        // Warn user and delay
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { finalizationWarned: true },
        });

        return {
          success: false,
          conversationId,
          finalized: false,
          warning: 'User active - finalization delayed',
        };
      }
    }

    // 5. Generate PDF
    log.info('Generating PDF', { conversationId });
    const pdfPath = await generateReportPDF(conversationId);

    // 6. Save to Document Library
    log.info('Saving to document library', { conversationId });
    const documentId = await saveToDocumentLibrary(conversationId, pdfPath);

    // 7. Export to OneDrive
    log.info('Exporting to OneDrive', { conversationId });
    const onedriveResult = await exportToOneDrive(conversationId, pdfPath);

    // 8. Index for RAG
    log.info('Indexing for RAG', { conversationId });
    const ragIndexed = await indexForRAG(conversationId);

    // 9. Update conversation as finalized
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        finalized: true,
        finalizedAt: new Date(),
        finalizedBy: userId || 'system',
        finalizationMethod: method,
        documentId,
        onedriveExported: onedriveResult.success,
        onedriveExportPath: onedriveResult.path,
        onedriveExportedAt: onedriveResult.success ? new Date() : null,
        ragIndexed,
        ragIndexedAt: ragIndexed ? new Date() : null,
        isReadOnly: true, // Lock the report
        workflowState: 'finalized',
      },
    });

    log.info('Report finalized successfully', { conversationId });

    // 10. Process automatic schedule updates
    log.info('Processing automatic schedule updates', { conversationId });
    try {
      await processScheduleUpdatesAfterFinalization(
        conversationId,
        conversation.Project?.slug || '',
        userId
      );
    } catch (error) {
      log.error('Error processing schedule updates', error, { conversationId });
      // Don't fail finalization if schedule updates fail
    }

    // 11. Extract labor data from report (with budget item linking)
    log.info('Extracting labor data', { conversationId });
    let _laborCost = 0;
    try {
      if (conversation.Project?.id) {
        const { processLaborFromDailyReport } = await import('../labor-extraction-service');
        const laborResult = await processLaborFromDailyReport(
          conversationId,
          conversation.Project.id,
          conversation.createdAt
        );
        _laborCost = laborResult.totalLaborCost;
        if (laborResult.entriesSaved > 0) {
          log.info('Saved labor entries', {
            entriesSaved: laborResult.entriesSaved,
            linkedToBudget: laborResult.linkedToBudget,
            totalLaborCost: laborResult.totalLaborCost,
          });
        }
      }
    } catch (error) {
      log.error('Error extracting labor', error, { conversationId });
      // Don't fail finalization if labor extraction fails
    }

    // 12. Extract material data from report (with budget item linking)
    log.info('Extracting material data', { conversationId });
    let _materialCost = 0;
    try {
      if (conversation.Project?.id) {
        const { processMaterialsFromDailyReport } = await import('../material-extraction-service');
        const materialResult = await processMaterialsFromDailyReport(
          conversationId,
          conversation.Project.id,
          conversation.createdAt
        );
        _materialCost = materialResult.totalMaterialCost;
        if (materialResult.entriesSaved > 0) {
          log.info('Saved material entries', {
            entriesSaved: materialResult.entriesSaved,
            linkedToBudget: materialResult.linkedToBudget,
            totalMaterialCost: materialResult.totalMaterialCost,
          });
        }
      }
    } catch (error) {
      log.error('Error extracting materials', error, { conversationId });
      // Don't fail finalization if material extraction fails
    }

    // 13. Extract schedule actuals from daily report
    log.info('Extracting schedule actuals', { conversationId });
    try {
      if (conversation.Project?.id) {
        const { extractActualsFromDailyReport } = await import('../schedule-actuals-service');

        // Get work performed data from report
        // ReportData has [key: string]: unknown for dynamic fields like workPerformed/summary
        const reportData = conversation.reportData as Record<string, unknown> | null;
        const workPerformed = (reportData?.workPerformed as string) || (reportData?.summary as string) || '';

        const actualsResult = await extractActualsFromDailyReport(
          conversation.Project.id,
          conversation.createdAt,
          workPerformed,
          [] // Labor entries would come from extracted data
        );

        if (actualsResult.updatedTasks.length > 0) {
          log.info('Updated schedule actuals', { taskCount: actualsResult.updatedTasks.length, tasks: actualsResult.updatedTasks });
        }
      }
    } catch (error) {
      log.error('Error extracting schedule actuals', error as Error);
      // Don't fail finalization if actuals extraction fails
    }

    // 14. Perform daily cost rollup and sync budget metrics
    log.info('Performing daily cost rollup');
    try {
      if (conversation.Project?.id) {
        const { performDailyCostRollup } = await import('../cost-rollup-service');
        const rollupResult = await performDailyCostRollup(
          conversation.Project.id,
          conversation.createdAt,
          userId
        );
        if (rollupResult.success) {
          log.info('Cost rollup complete', { totalCost: rollupResult.summary.totalCost, budgetItemsUpdated: rollupResult.budgetItemsUpdated });
        }
      }
    } catch (error) {
      log.error('Error performing cost rollup', error as Error);
      // Don't fail finalization if cost rollup fails
    }

    return {
      success: true,
      conversationId,
      finalized: true,
      documentId,
      onedriveExported: onedriveResult.success,
      ragIndexed,
    };
  } catch (error) {
    log.error('Error finalizing report', error as Error, { conversationId });
    return {
      success: false,
      conversationId,
      finalized: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all reports ready for finalization at current time
 */
export async function getReportsReadyForFinalization(): Promise<string[]> {
  const now = new Date();

  // Get all projects with daily reports enabled
  const projects = await prisma.project.findMany({
    where: {
      dailyReportEnabled: true,
    },
    select: {
      id: true,
      slug: true,
      timezone: true,
      finalizationTime: true,
    },
  });

  const readyConversations: string[] = [];

  for (const project of projects) {
    // Convert current time to project timezone
    const projectTime = toZonedTime(now, project.timezone);
    const currentTime = format(projectTime, 'HH:mm');

    // Check if it's finalization time (within 5-minute window)
    const [targetHour, targetMinute] = project.finalizationTime.split(':').map(Number);
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);

    const isFinalizationTime =
      currentHour === targetHour &&
      currentMinute >= targetMinute &&
      currentMinute < targetMinute + 5;

    if (!isFinalizationTime) {
      continue;
    }

    // Get today's report (in project timezone)
    const todayDate = format(projectTime, 'yyyy-MM-dd');

    const conversations = await prisma.conversation.findMany({
      where: {
        projectId: project.id,
        conversationType: 'daily_report',
        dailyReportDate: {
          gte: new Date(`${todayDate}T00:00:00Z`),
          lt: new Date(`${todayDate}T23:59:59Z`),
        },
        finalized: false,
      },
      select: { id: true },
    });

    readyConversations.push(...conversations.map((c) => c.id));
  }

  return readyConversations;
}

/**
 * Check finalization status for a conversation
 */
export async function getFinalizationStatus(conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      finalized: true,
      finalizedAt: true,
      finalizationMethod: true,
      documentId: true,
      onedriveExported: true,
      onedriveExportPath: true,
      ragIndexed: true,
      lastActivityAt: true,
      finalizationWarned: true,
    },
  });

  if (!conversation) {
    return null;
  }

  return {
    ...conversation,
    hasData: await hasReportData(conversationId),
    isUserActive: await isUserActive(conversationId),
  };
}
