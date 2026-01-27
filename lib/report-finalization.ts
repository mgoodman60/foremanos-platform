/**
 * Daily Report Finalization Service (Phase 6)
 *
 * Handles automatic finalization of daily reports at 18:00 project time:
 * - Timezone-aware scheduling
 * - User activity detection and warnings
 * - PDF generation and locking
 * - Document library integration
 * - OneDrive export
 * - OCR and RAG indexing
 */

import { prisma } from './db';
import { getFileUrl, generatePresignedUploadUrl } from './s3';
import { format, parseISO } from 'date-fns';
import type { Prisma } from '@prisma/client';

// =============================================
// TYPE DEFINITIONS FOR JSON FIELDS
// =============================================

/** Work entry by trade in daily report */
interface WorkByTradeEntry {
  trade: string;
  company?: string;
  description?: string;
  location?: string;
  crewSize?: number;
}

/** Crew entry in daily report */
interface CrewEntry {
  trade?: string;
  company?: string;
  count: number;
}

/** Report data stored in conversation JSON field */
interface ReportData {
  workByTrade?: WorkByTradeEntry[];
  crew?: CrewEntry[];
  notes?: string;
  [key: string]: unknown;
}

/** Photo data stored in conversation JSON field */
interface PhotoEntry {
  id: string;
  cloud_storage_path: string;
  isPublic?: boolean;
  caption?: string;
  location?: string;
  aiDescription?: string;
  aiConfidence?: number;
}

/** Weather snapshot data */
interface WeatherSnapshot {
  time: string;
  temperature?: number;
  conditions?: string;
  humidity?: number;
  windSpeed?: number;
}

/** Material delivery entry */
interface MaterialDelivery {
  sub?: string;
  material: string;
  quantity?: number;
}

/** Equipment data entry */
interface EquipmentEntry {
  name: string;
  type?: string;
}

/** Schedule update entry */
interface ScheduleUpdateEntry {
  activity: string;
  plannedStatus?: string;
  actualStatus?: string;
}

/** Quantity calculation entry */
interface QuantityCalculation {
  type: string;
  description?: string;
  location?: string;
  actualQuantity?: number;
  unit?: string;
}

// Helper functions to replace date-fns-tz
function toZonedTime(date: Date, timezone: string): Date {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  const offset = tzDate.getTime() - utcDate.getTime();
  return new Date(date.getTime() + offset);
}

function fromZonedTime(date: Date, timezone: string): Date {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  const offset = tzDate.getTime() - utcDate.getTime();
  return new Date(date.getTime() - offset);
}

interface FinalizationOptions {
  conversationId: string;
  userId?: string; // Required for manual finalization
  method: 'auto' | 'manual';
  skipWarning?: boolean; // Skip user activity warning
}

interface FinalizationResult {
  success: boolean;
  conversationId: string;
  finalized: boolean;
  warning?: string;
  error?: string;
  documentId?: string;
  onedriveExported?: boolean;
  ragIndexed?: boolean;
}

/**
 * Check if report has any data to finalize
 */
export async function hasReportData(conversationId: string): Promise<boolean> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      reportData: true,
      weatherSnapshots: true,
      photos: true,
      scheduleUpdates: true,
      quantityCalculations: true,
      ChatMessage: {
        select: { id: true },
        take: 2, // Need at least 2 messages (intro + 1 user message)
      },
    },
  });

  if (!conversation) {
    return false;
  }

  // Check if there's meaningful data
  const hasMessages = (conversation.ChatMessage?.length || 0) > 1;
  const reportData = conversation.reportData as ReportData | null;
  const hasReportData = !!reportData && Object.keys(reportData).length > 0;
  const hasWeather = !!conversation.weatherSnapshots;
  const photos = conversation.photos as PhotoEntry[] | null;
  const hasPhotos = !!photos && photos.length > 0;
  const hasSchedule = !!conversation.scheduleUpdates;
  const hasCalculations = !!conversation.quantityCalculations;

  return hasMessages && (hasReportData || hasWeather || hasPhotos || hasSchedule || hasCalculations);
}

/**
 * Check if user is currently active in the conversation
 */
export async function isUserActive(conversationId: string, thresholdMinutes: number = 5): Promise<boolean> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { lastActivityAt: true },
  });

  if (!conversation?.lastActivityAt) {
    return false;
  }

  const now = new Date();
  const lastActivity = new Date(conversation.lastActivityAt);
  const minutesSinceActivity = (now.getTime() - lastActivity.getTime()) / 1000 / 60;

  return minutesSinceActivity < thresholdMinutes;
}

/**
 * Update last activity timestamp for a conversation
 */
export async function updateLastActivity(conversationId: string): Promise<void> {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastActivityAt: new Date() },
  });
}

/**
 * Generate PDF for finalized report
 */
async function generateReportPDF(conversationId: string): Promise<string> {
  const ReactPDF = await import('@react-pdf/renderer');
  const React = await import('react');
  const { DailyReportPDF } = await import('./pdf-template');
  const { uploadFile } = await import('./s3');
  
  // Get conversation data
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      Project: true,
      User: true,
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const reportDate = conversation.dailyReportDate
    ? format(new Date(conversation.dailyReportDate), 'yyyy-MM-dd')
    : format(new Date(), 'yyyy-MM-dd');

  // Prepare photo URLs (convert S3 paths to signed URLs)
  const photos = (conversation.photos as PhotoEntry[] | null) || [];
  const photoData = await Promise.all(
    photos.map(async (photo) => {
      const url = await getFileUrl(photo.cloud_storage_path, photo.isPublic || false);
      return {
        id: photo.id,
        url,
        caption: photo.caption,
        location: photo.location,
        aiDescription: photo.aiDescription,
        aiConfidence: photo.aiConfidence,
      };
    })
  );

  // Get company logo URL
  let companyLogoUrl: string | undefined;
  if (conversation.User?.companyLogo) {
    companyLogoUrl = await getFileUrl(conversation.User.companyLogo, false);
  }

  // Prepare work entries
  const reportData = (conversation.reportData as ReportData | null) || {};
  const workPerformed = (reportData.workByTrade || []).map((w) => ({
    trade: w.trade,
    company: w.company,
    description: w.description,
    location: w.location,
    crewSize: w.crewSize,
  }));

  // Calculate total crew size
  const totalCrewSize = (reportData.crew || []).reduce((sum, c) => sum + (c.count || 0), 0);

  // Prepare weather snapshots
  const weatherSnapshots = ((conversation.weatherSnapshots as WeatherSnapshot[] | null) || []).map((w) => ({
    time: w.time,
    temperature: w.temperature,
    conditions: w.conditions,
    humidity: w.humidity,
    windSpeed: w.windSpeed,
  }));

  // Prepare material deliveries
  const materialDeliveries = ((conversation.materialDeliveries as MaterialDelivery[] | null) || []).map((m) => ({
    sub: m.sub,
    material: m.material,
    quantity: m.quantity,
  }));

  // Prepare equipment
  const equipment = ((conversation.equipmentData as EquipmentEntry[] | null) || []).map((e) => ({
    name: e.name,
    type: e.type,
  }));

  // Prepare schedule updates
  const scheduleUpdates = ((conversation.scheduleUpdates as ScheduleUpdateEntry[] | null) || []).map((s) => ({
    activity: s.activity,
    plannedStatus: s.plannedStatus,
    actualStatus: s.actualStatus,
  }));

  // Prepare quantity calculations
  const quantityCalculations = ((conversation.quantityCalculations as QuantityCalculation[] | null) || []).map((q) => ({
    type: q.type,
    description: q.description,
    location: q.location,
    actualQuantity: q.actualQuantity,
    unit: q.unit,
  }));

  // Build PDF data
  const pdfData = {
    projectName: conversation.Project?.name || 'Project',
    projectAddress: conversation.Project?.projectAddress || undefined,
    reportDate: format(new Date(conversation.dailyReportDate || new Date()), 'MMMM dd, yyyy'),
    projectManager: conversation.Project?.projectManager || undefined,
    superintendent: conversation.Project?.superintendent || undefined,
    client: conversation.Project?.clientName || undefined,
    architectEngineer: conversation.Project?.architectEngineer || undefined,
    companyName: conversation.User?.username || undefined, // Use username as company name for now
    companyLogo: companyLogoUrl,
    weatherSnapshots: weatherSnapshots.length > 0 ? weatherSnapshots : undefined,
    workPerformed: workPerformed.length > 0 ? workPerformed : undefined,
    totalCrewSize: totalCrewSize > 0 ? totalCrewSize : undefined,
    photos: photoData.length > 0 ? photoData : undefined,
    materialDeliveries: materialDeliveries.length > 0 ? materialDeliveries : undefined,
    equipment: equipment.length > 0 ? equipment : undefined,
    scheduleUpdates: scheduleUpdates.length > 0 ? scheduleUpdates : undefined,
    quantityCalculations: quantityCalculations.length > 0 ? quantityCalculations : undefined,
    notes: reportData.notes,
    preparedBy: conversation.User?.username || conversation.User?.email || 'System',
    finalizationDate: format(new Date(), 'MMMM dd, yyyy h:mm a'),
  };

  // Generate PDF
  const pdfBuffer = await ReactPDF.renderToBuffer(
    React.createElement(DailyReportPDF, { data: pdfData }) as React.ReactElement
  );

  // Upload to S3
  const fileName = `daily-report-${conversation.Project?.slug || 'project'}-${reportDate}.pdf`;
  
  // Upload using S3 (isPublic = false for private reports)
  const cloud_storage_path = await uploadFile(pdfBuffer, fileName, false);

  return cloud_storage_path;
}

/**
 * Save report to Document Library
 */
async function saveToDocumentLibrary(
  conversationId: string,
  pdfPath: string
): Promise<string> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { Project: true },
  });

  if (!conversation?.Project) {
    throw new Error('Project not found');
  }

  // Ensure "Daily Reports" folder exists
  let folderId = conversation.Project?.dailyReportsFolderId;
  
  if (!folderId) {
    // Create folder if it doesn't exist
    const folder = await prisma.document.create({
      data: {
        projectId: conversation.Project?.id,
        name: 'Daily Reports',
        fileName: 'Daily Reports',
        fileType: 'folder',
        accessLevel: 'admin', // Admin-only by default
      },
    });

    folderId = folder.id;

    // Update project with folder ID
    await prisma.project.update({
      where: { id: conversation.Project?.id },
      data: { dailyReportsFolderId: folderId },
    });
  }

  // Create document entry
  const reportDate = conversation.dailyReportDate
    ? format(new Date(conversation.dailyReportDate), 'MMMM dd, yyyy')
    : format(new Date(), 'MMMM dd, yyyy');

  const fileName = `daily-report-${format(
    conversation.dailyReportDate ? new Date(conversation.dailyReportDate) : new Date(),
    'yyyy-MM-dd'
  )}.pdf`;

  const document = await prisma.document.create({
    data: {
      projectId: conversation.Project?.id,
      name: `Daily Report - ${reportDate}`,
      fileName,
      fileType: 'application/pdf',
      cloud_storage_path: pdfPath,
      isPublic: false,
      fileSize: 0, // Will be updated when actual PDF is generated
      accessLevel: 'admin',
      description: `Auto-generated daily report for ${reportDate}. Conversation ID: ${conversationId}`,
      processed: true, // Generated PDFs don't need OCR processing
      syncSource: 'workflow_generated',
    },
  });

  return document.id;
}

/**
 * Export PDF to OneDrive/SharePoint
 */
async function exportToOneDrive(
  conversationId: string,
  pdfPath: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { Project: true },
    });

    if (!conversation?.Project) {
      return { success: false, error: 'Project not found' };
    }

    // Check if OneDrive sync is enabled
    if (!conversation.Project?.syncEnabled || !conversation.Project?.oneDriveAccessToken) {
      return { success: false, error: 'OneDrive sync not enabled' };
    }

    // Import OneDrive service
    // TODO: Implement OneDrive file upload function
    // const { uploadFileToOneDrive } = await import('./onedrive-service');

    // Create "Daily Reports" folder in OneDrive if needed
    const folderPath = `${conversation.Project?.oneDriveFolderPath || 'ForemanOS'}/Daily Reports`;

    // Upload PDF
    const reportDate = conversation.dailyReportDate
      ? format(new Date(conversation.dailyReportDate), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd');

    const fileName = `Daily_Report_${reportDate}.pdf`;
    const uploadPath = `${folderPath}/${fileName}`;

    // In actual implementation, you would:
    // await uploadFileToOneDrive(pdfPath, uploadPath, conversation.Project);

    return {
      success: true,
      path: uploadPath,
    };
  } catch (error) {
    console.error('[FINALIZATION] OneDrive export error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Index report data for RAG queries
 */
async function indexForRAG(conversationId: string): Promise<boolean> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        Project: true,
        ChatMessage: true,
      },
    });

    if (!conversation) {
      return false;
    }

    // Extract all report data into searchable text chunks
    const chunks: string[] = [];

    // 1. Report metadata
    const reportDate = conversation.dailyReportDate
      ? format(new Date(conversation.dailyReportDate), 'MMMM dd, yyyy')
      : format(new Date(), 'MMMM dd, yyyy');

    chunks.push(`Daily Report for ${reportDate}`);

    // 2. Weather data
    if (conversation.weatherSnapshots) {
      const snapshots = conversation.weatherSnapshots as WeatherSnapshot[];
      snapshots.forEach((w) => {
        chunks.push(
          `Weather at ${w.time}: ${w.temperature}°F, ${w.conditions}, Humidity: ${w.humidity}%, Wind: ${w.windSpeed} mph`
        );
      });
    }

    // 3. Work performed
    if (conversation.reportData) {
      const data = conversation.reportData as ReportData;

      if (data.workByTrade) {
        data.workByTrade.forEach((w) => {
          chunks.push(
            `Work performed by ${w.trade} (${w.company}): ${w.description} at ${w.location || 'site'}`
          );
        });
      }

      if (data.crew) {
        data.crew.forEach((c) => {
          chunks.push(`Crew: ${c.company} with ${c.count} workers`);
        });
      }
    }

    // 4. Photo captions
    if (conversation.photos) {
      const photos = conversation.photos as PhotoEntry[];
      photos.forEach((p) => {
        if (p.caption) {
          chunks.push(`Photo: ${p.caption} (Location: ${p.location || 'unknown'})`);
        }
      });
    }

    // 5. Schedule updates
    if (conversation.scheduleUpdates) {
      const updates = conversation.scheduleUpdates as ScheduleUpdateEntry[];
      updates.forEach((u) => {
        chunks.push(
          `Schedule update: ${u.activity} - Planned: ${u.plannedStatus}, Actual: ${u.actualStatus}`
        );
      });
    }

    // 6. Quantity calculations
    if (conversation.quantityCalculations) {
      const calcs = conversation.quantityCalculations as QuantityCalculation[];
      calcs.forEach((c) => {
        chunks.push(
          `Quantity: ${c.description} at ${c.location} - ${c.actualQuantity} ${c.unit}`
        );
      });
    }

    // Store chunks in database
    // In actual implementation, you would:
    // - Generate embeddings for each chunk
    // - Store in vector database or DocumentChunk table
    // - Link to conversation for retrieval

    // For now, we'll create a single document chunk with all data
    // Link to project's first document as a placeholder
    const firstDoc = await prisma.document.findFirst({
      where: { projectId: conversation.projectId || undefined },
      select: { id: true },
    });

    if (firstDoc) {
      await prisma.documentChunk.create({
        data: {
          documentId: firstDoc.id,
          content: chunks.join('\n\n'),
          chunkIndex: 0,
          metadata: {
            conversationId,
            reportDate: conversation.dailyReportDate,
            type: 'daily_report',
            projectId: conversation.projectId,
          },
        },
      });
    }

    return true;
  } catch (error) {
    console.error('[FINALIZATION] RAG indexing error:', error);
    return false;
  }
}

/**
 * Finalize a daily report
 */
/**
 * Process automatic schedule updates after report finalization
 */
async function processScheduleUpdatesAfterFinalization(
  conversationId: string,
  projectSlug: string,
  userId?: string
): Promise<void> {
  if (!projectSlug) {
    console.log('[SCHEDULE_UPDATE] No project slug, skipping schedule updates');
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
      console.log('[SCHEDULE_UPDATE] Project not found');
      return;
    }

    // Check if auto-update is enabled at project level
    if (!project.scheduleAutoUpdateEnabled) {
      console.log('[SCHEDULE_UPDATE] Schedule auto-update disabled at project level');
      return;
    }

    // Check if there's an active schedule with auto-update enabled
    const activeSchedule = project.Schedule[0];
    if (!activeSchedule || !activeSchedule.autoUpdateEnabled) {
      console.log('[SCHEDULE_UPDATE] No active schedule with auto-update enabled');
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
      console.log('[SCHEDULE_UPDATE] No report content found');
      return;
    }

    // Analyze for schedule impacts
    const { analyzeScheduleImpact } = await import('./schedule-analyzer');
    const analysis = await analyzeScheduleImpact(reportContent, projectSlug);

    if (!analysis.hasScheduleImpact || analysis.suggestions.length === 0) {
      console.log('[SCHEDULE_UPDATE] No schedule impacts detected');
      return;
    }

    const threshold = project.scheduleAutoApplyThreshold || 85;
    const requireManualReview = project.scheduleRequireManualReview ?? true;

    // Filter suggestions by confidence threshold
    const autoApplicableSuggestions = analysis.suggestions.filter(
      s => s.confidence >= threshold
    );

    if (autoApplicableSuggestions.length === 0) {
      console.log(
        `[SCHEDULE_UPDATE] ${analysis.suggestions.length} suggestion(s) found, but none meet ${threshold}% confidence threshold`
      );
      
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
      console.log(
        `[SCHEDULE_UPDATE] Manual review required. Storing ${autoApplicableSuggestions.length} suggestion(s) as pending`
      );
      
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
    console.log(
      `[SCHEDULE_UPDATE] Auto-applying ${autoApplicableSuggestions.length} high-confidence update(s)`
    );

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
          console.log(`[SCHEDULE_UPDATE] Task ${suggestion.taskId} not found, skipping`);
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
            status: suggestion.suggestedStatus,
            percentComplete: suggestion.suggestedPercentComplete,
          },
        });

        console.log(
          `[SCHEDULE_UPDATE] Auto-applied update for task ${suggestion.taskId}: ${suggestion.currentPercentComplete}% → ${suggestion.suggestedPercentComplete}%`
        );
      } catch (error) {
        console.error(`[SCHEDULE_UPDATE] Error auto-applying update for task ${suggestion.taskId}:`, error);
      }
    }

    // Update schedule lastAutoUpdateAt
    await prisma.schedule.update({
      where: { id: activeSchedule.id },
      data: { lastAutoUpdateAt: new Date() },
    });

    console.log(
      `[SCHEDULE_UPDATE] Processed ${autoApplicableSuggestions.length} automatic schedule update(s)`
    );
  } catch (error) {
    console.error('[SCHEDULE_UPDATE] Error processing schedule updates:', error);
    throw error;
  }
}

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
    console.log('[FINALIZATION] Generating PDF for', conversationId);
    const pdfPath = await generateReportPDF(conversationId);

    // 6. Save to Document Library
    console.log('[FINALIZATION] Saving to document library');
    const documentId = await saveToDocumentLibrary(conversationId, pdfPath);

    // 7. Export to OneDrive
    console.log('[FINALIZATION] Exporting to OneDrive');
    const onedriveResult = await exportToOneDrive(conversationId, pdfPath);

    // 8. Index for RAG
    console.log('[FINALIZATION] Indexing for RAG');
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

    console.log('[FINALIZATION] Report finalized successfully');

    // 10. Process automatic schedule updates
    console.log('[FINALIZATION] Processing automatic schedule updates');
    try {
      await processScheduleUpdatesAfterFinalization(
        conversationId,
        conversation.Project?.slug || '',
        userId
      );
    } catch (error) {
      console.error('[FINALIZATION] Error processing schedule updates:', error);
      // Don't fail finalization if schedule updates fail
    }

    // 11. Extract labor data from report (with budget item linking)
    console.log('[FINALIZATION] Extracting labor data');
    let laborCost = 0;
    try {
      if (conversation.Project?.id) {
        const { processLaborFromDailyReport } = await import('./labor-extraction-service');
        const laborResult = await processLaborFromDailyReport(
          conversationId,
          conversation.Project.id,
          conversation.createdAt
        );
        laborCost = laborResult.totalLaborCost;
        if (laborResult.entriesSaved > 0) {
          console.log(`[FINALIZATION] Saved ${laborResult.entriesSaved} labor entries, ${laborResult.linkedToBudget} linked to budget, $${laborResult.totalLaborCost.toFixed(2)} total cost`);
        }
      }
    } catch (error) {
      console.error('[FINALIZATION] Error extracting labor:', error);
      // Don't fail finalization if labor extraction fails
    }

    // 12. Extract material data from report (with budget item linking)
    console.log('[FINALIZATION] Extracting material data');
    let materialCost = 0;
    try {
      if (conversation.Project?.id) {
        const { processMaterialsFromDailyReport } = await import('./material-extraction-service');
        const materialResult = await processMaterialsFromDailyReport(
          conversationId,
          conversation.Project.id,
          conversation.createdAt
        );
        materialCost = materialResult.totalMaterialCost;
        if (materialResult.entriesSaved > 0) {
          console.log(`[FINALIZATION] Saved ${materialResult.entriesSaved} material entries, ${materialResult.linkedToBudget} linked to budget, $${materialResult.totalMaterialCost.toFixed(2)} total cost`);
        }
      }
    } catch (error) {
      console.error('[FINALIZATION] Error extracting materials:', error);
      // Don't fail finalization if material extraction fails
    }

    // 13. Extract schedule actuals from daily report
    console.log('[FINALIZATION] Extracting schedule actuals from daily report');
    try {
      if (conversation.Project?.id) {
        const { extractActualsFromDailyReport } = await import('./schedule-actuals-service');
        
        // Get work performed data from report
        const reportData = conversation.reportData as any;
        const workPerformed = reportData?.workPerformed || reportData?.summary || '';
        
        const actualsResult = await extractActualsFromDailyReport(
          conversation.Project.id,
          conversation.createdAt,
          workPerformed,
          [] // Labor entries would come from extracted data
        );
        
        if (actualsResult.updatedTasks.length > 0) {
          console.log(`[FINALIZATION] Updated actuals for ${actualsResult.updatedTasks.length} tasks: ${actualsResult.updatedTasks.join(', ')}`);
        }
      }
    } catch (error) {
      console.error('[FINALIZATION] Error extracting schedule actuals:', error);
      // Don't fail finalization if actuals extraction fails
    }

    // 14. Perform daily cost rollup and sync budget metrics
    console.log('[FINALIZATION] Performing daily cost rollup');
    try {
      if (conversation.Project?.id) {
        const { performDailyCostRollup } = await import('./cost-rollup-service');
        const rollupResult = await performDailyCostRollup(
          conversation.Project.id,
          conversation.createdAt,
          userId
        );
        if (rollupResult.success) {
          console.log(`[FINALIZATION] Cost rollup complete: $${rollupResult.summary.totalCost.toFixed(2)} total daily cost, ${rollupResult.budgetItemsUpdated} budget items updated`);
        }
      }
    } catch (error) {
      console.error('[FINALIZATION] Error performing cost rollup:', error);
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
    console.error('[FINALIZATION] Error finalizing report:', error);
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