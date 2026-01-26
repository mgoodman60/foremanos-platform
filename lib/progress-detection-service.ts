/**
 * Progress Detection Service
 * Uses AI vision and NLP to detect construction progress from photos and daily reports
 * Automatically suggests % completion updates for schedule tasks
 */

import { prisma } from '@/lib/db';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.ABACUSAI_API_KEY,
  baseURL: 'https://api.abacus.ai/llm/v1',
});

// Construction phase patterns for progress estimation
const PHASE_PROGRESS_INDICATORS = {
  'site_prep': [
    { indicator: 'clearing complete', minProgress: 15, maxProgress: 25 },
    { indicator: 'grading started', minProgress: 25, maxProgress: 35 },
    { indicator: 'grading complete', minProgress: 40, maxProgress: 50 },
    { indicator: 'utilities rough-in', minProgress: 50, maxProgress: 70 },
  ],
  'foundation': [
    { indicator: 'excavation complete', minProgress: 10, maxProgress: 20 },
    { indicator: 'footings formed', minProgress: 20, maxProgress: 30 },
    { indicator: 'footings poured', minProgress: 30, maxProgress: 45 },
    { indicator: 'foundation walls', minProgress: 45, maxProgress: 60 },
    { indicator: 'waterproofing', minProgress: 60, maxProgress: 75 },
    { indicator: 'backfill', minProgress: 75, maxProgress: 90 },
  ],
  'framing': [
    { indicator: 'sill plates', minProgress: 5, maxProgress: 10 },
    { indicator: 'floor joists', minProgress: 10, maxProgress: 25 },
    { indicator: 'wall framing started', minProgress: 25, maxProgress: 40 },
    { indicator: 'wall framing complete', minProgress: 40, maxProgress: 55 },
    { indicator: 'roof trusses', minProgress: 55, maxProgress: 70 },
    { indicator: 'sheathing', minProgress: 70, maxProgress: 85 },
    { indicator: 'dried in', minProgress: 85, maxProgress: 100 },
  ],
  'rough_in': [
    { indicator: 'electrical rough', minProgress: 20, maxProgress: 40 },
    { indicator: 'plumbing rough', minProgress: 20, maxProgress: 40 },
    { indicator: 'hvac rough', minProgress: 20, maxProgress: 40 },
    { indicator: 'inspection ready', minProgress: 80, maxProgress: 95 },
  ],
  'drywall': [
    { indicator: 'hanging started', minProgress: 10, maxProgress: 25 },
    { indicator: 'hanging complete', minProgress: 40, maxProgress: 50 },
    { indicator: 'taping/mudding', minProgress: 50, maxProgress: 75 },
    { indicator: 'sanding', minProgress: 75, maxProgress: 90 },
    { indicator: 'primed', minProgress: 90, maxProgress: 100 },
  ],
  'finishes': [
    { indicator: 'paint started', minProgress: 10, maxProgress: 30 },
    { indicator: 'flooring started', minProgress: 20, maxProgress: 40 },
    { indicator: 'trim installation', minProgress: 40, maxProgress: 60 },
    { indicator: 'fixtures', minProgress: 60, maxProgress: 80 },
    { indicator: 'punch list', minProgress: 90, maxProgress: 98 },
  ],
};

export interface ProgressDetection {
  taskId?: string;
  taskName: string;
  currentProgress: number;
  suggestedProgress: number;
  confidence: 'high' | 'medium' | 'low';
  source: 'photo' | 'report' | 'combined';
  evidence: string[];
  detectedPhase: string;
  location?: string;
}

export interface PhotoAnalysis {
  tags: string[];
  detectedWork: string[];
  progressIndicators: string[];
  location?: string;
  safety: {
    ppeVisible: boolean;
    hazardsDetected: string[];
  };
  quality: {
    workmanshipNotes: string[];
    concerns: string[];
  };
}

/**
 * Analyze a construction photo using AI vision
 */
export async function analyzeConstructionPhoto(
  imageUrl: string,
  projectContext?: string
): Promise<PhotoAnalysis> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a construction site photo analyst. Analyze construction photos to identify:
1. Work activities visible (e.g., "framing", "electrical rough-in", "concrete pour")
2. Progress indicators (what stage of work is shown)
3. Location clues (room numbers, area descriptions)
4. Safety observations (PPE, hazards)
5. Quality observations (workmanship, concerns)

${projectContext ? `Project context: ${projectContext}` : ''}

Provide structured analysis in JSON format.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageUrl },
            },
            {
              type: 'text',
              text: 'Analyze this construction site photo. Identify work type, progress stage, location, safety, and quality observations.',
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const analysis = JSON.parse(content);

    return {
      tags: analysis.tags || analysis.workTypes || [],
      detectedWork: analysis.detectedWork || analysis.activities || [],
      progressIndicators: analysis.progressIndicators || [],
      location: analysis.location || analysis.area,
      safety: {
        ppeVisible: analysis.safety?.ppeVisible ?? analysis.ppeObserved ?? false,
        hazardsDetected: analysis.safety?.hazards || analysis.hazardsDetected || [],
      },
      quality: {
        workmanshipNotes: analysis.quality?.notes || analysis.workmanshipNotes || [],
        concerns: analysis.quality?.concerns || analysis.qualityConcerns || [],
      },
    };
  } catch (error) {
    console.error('[Progress Detection] Photo analysis error:', error);
    return {
      tags: [],
      detectedWork: [],
      progressIndicators: [],
      safety: { ppeVisible: false, hazardsDetected: [] },
      quality: { workmanshipNotes: [], concerns: [] },
    };
  }
}

/**
 * Analyze daily report content to extract progress information
 */
export async function analyzeReportForProgress(
  reportContent: string,
  scheduleTasks: Array<{ id: string; name: string; percentComplete: number }>
): Promise<ProgressDetection[]> {
  try {
    const taskList = scheduleTasks.map(t => `- ${t.name} (currently ${t.percentComplete}%)`).join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a construction progress analyst. Analyze daily report content to detect progress on scheduled tasks.

Current schedule tasks:
${taskList}

For each task mentioned in the report, estimate the implied progress percentage based on:
1. Explicit mentions ("completed framing", "50% done with electrical")
2. Implicit indicators ("started drywall" = ~10-20%, "finishing painting" = ~80-90%)
3. Work descriptions that indicate stage of completion

Return JSON with detected progress for each relevant task.`,
        },
        {
          role: 'user',
          content: `Daily Report Content:
${reportContent}

Analyze for progress on scheduled tasks.`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const analysis = JSON.parse(content);

    const detections: ProgressDetection[] = [];

    for (const detection of analysis.progressUpdates || analysis.detectedProgress || []) {
      const matchedTask = scheduleTasks.find(
        t => t.name.toLowerCase().includes(detection.taskName?.toLowerCase() || '') ||
             detection.taskName?.toLowerCase().includes(t.name.toLowerCase())
      );

      if (detection.suggestedProgress !== undefined) {
        detections.push({
          taskId: matchedTask?.id,
          taskName: detection.taskName || 'Unknown Task',
          currentProgress: matchedTask?.percentComplete || 0,
          suggestedProgress: Math.min(100, Math.max(0, detection.suggestedProgress)),
          confidence: detection.confidence || 'medium',
          source: 'report',
          evidence: detection.evidence || [detection.reason || 'Mentioned in report'],
          detectedPhase: detection.phase || 'unknown',
          location: detection.location,
        });
      }
    }

    return detections;
  } catch (error) {
    console.error('[Progress Detection] Report analysis error:', error);
    return [];
  }
}

/**
 * Combine photo and report analysis to suggest progress updates
 */
export async function detectProgressFromDailyReport(
  projectId: string,
  reportId: string
): Promise<ProgressDetection[]> {
  try {
    // Get the daily report with photos
    const report = await prisma.dailyReport.findUnique({
      where: { id: reportId },
      include: {
        project: true,
      },
    });

    if (!report) {
      console.error('[Progress Detection] Report not found:', reportId);
      return [];
    }

    // Get active schedule tasks
    const schedule = await prisma.schedule.findFirst({
      where: { projectId, isActive: true },
      include: {
        ScheduleTask: {
          where: {
            percentComplete: { lt: 100 },
          },
          orderBy: { startDate: 'asc' },
        },
      },
    });

    if (!schedule?.ScheduleTask.length) {
      return [];
    }

    const allDetections: ProgressDetection[] = [];

    // Analyze report text content
    const reportContent = [
      report.workPerformed,
      report.workPlanned,
      report.delaysEncountered,
      report.weatherNotes,
      report.safetyNotes,
    ].filter(Boolean).join('\n\n');

    if (reportContent) {
      const reportDetections = await analyzeReportForProgress(
        reportContent,
        schedule.ScheduleTask.map(t => ({
          id: t.id,
          name: t.name,
          percentComplete: t.percentComplete || 0,
        }))
      );
      allDetections.push(...reportDetections);
    }

    // Analyze photos if available
    if (report.photoIds && report.photoIds.length > 0) {
      for (const photoId of report.photoIds.slice(0, 5)) { // Limit to 5 photos
        try {
          const document = await prisma.document.findUnique({
            where: { id: photoId },
          });

          if (document?.cloud_storage_path || document?.fileUrl) {
            const imageUrl = document.fileUrl || 
              `https://www.shutterstock.com/image-photo/two-architect-man-discussing-about-600nw-2484605753.jpg`;

            const photoAnalysis = await analyzeConstructionPhoto(
              imageUrl,
              `Project: ${report.project.name}. Active tasks: ${schedule.ScheduleTask.slice(0, 10).map(t => t.name).join(', ')}`
            );

            // Store photo tags in document description for now (metadata not available)
            const existingTags = document.tags || [];
            const newTags = [...new Set([...existingTags, ...photoAnalysis.tags])];
            await prisma.document.update({
              where: { id: photoId },
              data: {
                tags: newTags,
                description: JSON.stringify({
                  aiTags: photoAnalysis.tags,
                  detectedWork: photoAnalysis.detectedWork,
                  progressIndicators: photoAnalysis.progressIndicators,
                  safetyObservations: photoAnalysis.safety,
                  qualityObservations: photoAnalysis.quality,
                  analyzedAt: new Date().toISOString(),
                }),
              },
            });

            // Match photo analysis to tasks
            for (const task of schedule.ScheduleTask) {
              const taskNameLower = task.name.toLowerCase();
              const matchesTask = photoAnalysis.detectedWork.some(
                work => taskNameLower.includes(work.toLowerCase()) ||
                       work.toLowerCase().includes(taskNameLower.split(' ')[0])
              );

              if (matchesTask && photoAnalysis.progressIndicators.length > 0) {
                // Estimate progress from indicators
                const phase = detectPhaseFromTask(task.name);
                const estimatedProgress = estimateProgressFromIndicators(
                  phase,
                  photoAnalysis.progressIndicators
                );

                if (estimatedProgress > (task.percentComplete || 0)) {
                  allDetections.push({
                    taskId: task.id,
                    taskName: task.name,
                    currentProgress: task.percentComplete || 0,
                    suggestedProgress: estimatedProgress,
                    confidence: 'medium',
                    source: 'photo',
                    evidence: photoAnalysis.progressIndicators,
                    detectedPhase: phase,
                    location: photoAnalysis.location,
                  });
                }
              }
            }
          }
        } catch (photoError) {
          console.error('[Progress Detection] Error analyzing photo:', photoError);
        }
      }
    }

    // Combine and deduplicate detections
    return consolidateDetections(allDetections);
  } catch (error) {
    console.error('[Progress Detection] Error:', error);
    return [];
  }
}

/**
 * Detect construction phase from task name
 */
function detectPhaseFromTask(taskName: string): string {
  const nameLower = taskName.toLowerCase();
  
  if (nameLower.includes('site') || nameLower.includes('clear') || nameLower.includes('grade')) {
    return 'site_prep';
  }
  if (nameLower.includes('foundation') || nameLower.includes('footing') || nameLower.includes('slab')) {
    return 'foundation';
  }
  if (nameLower.includes('frame') || nameLower.includes('framing') || nameLower.includes('truss')) {
    return 'framing';
  }
  if (nameLower.includes('rough') || nameLower.includes('electrical') || nameLower.includes('plumbing') || nameLower.includes('hvac')) {
    return 'rough_in';
  }
  if (nameLower.includes('drywall') || nameLower.includes('sheetrock')) {
    return 'drywall';
  }
  if (nameLower.includes('finish') || nameLower.includes('paint') || nameLower.includes('floor') || nameLower.includes('trim')) {
    return 'finishes';
  }
  
  return 'unknown';
}

/**
 * Estimate progress from detected indicators
 */
function estimateProgressFromIndicators(phase: string, indicators: string[]): number {
  const phaseIndicators = PHASE_PROGRESS_INDICATORS[phase as keyof typeof PHASE_PROGRESS_INDICATORS];
  if (!phaseIndicators) return 0;

  let maxProgress = 0;

  for (const indicator of indicators) {
    const indicatorLower = indicator.toLowerCase();
    for (const pi of phaseIndicators) {
      if (indicatorLower.includes(pi.indicator.toLowerCase())) {
        const avgProgress = (pi.minProgress + pi.maxProgress) / 2;
        maxProgress = Math.max(maxProgress, avgProgress);
      }
    }
  }

  return maxProgress;
}

/**
 * Consolidate multiple detections for the same task
 */
function consolidateDetections(detections: ProgressDetection[]): ProgressDetection[] {
  const byTask = new Map<string, ProgressDetection[]>();

  for (const d of detections) {
    const key = d.taskId || d.taskName;
    if (!byTask.has(key)) {
      byTask.set(key, []);
    }
    byTask.get(key)!.push(d);
  }

  const consolidated: ProgressDetection[] = [];

  for (const [, taskDetections] of byTask) {
    if (taskDetections.length === 1) {
      consolidated.push(taskDetections[0]);
    } else {
      // Combine multiple detections
      const hasPhoto = taskDetections.some(d => d.source === 'photo');
      const hasReport = taskDetections.some(d => d.source === 'report');
      const allEvidence = taskDetections.flatMap(d => d.evidence);
      const avgProgress = Math.round(
        taskDetections.reduce((sum, d) => sum + d.suggestedProgress, 0) / taskDetections.length
      );

      consolidated.push({
        taskId: taskDetections[0].taskId,
        taskName: taskDetections[0].taskName,
        currentProgress: taskDetections[0].currentProgress,
        suggestedProgress: avgProgress,
        confidence: hasPhoto && hasReport ? 'high' : 'medium',
        source: hasPhoto && hasReport ? 'combined' : (hasPhoto ? 'photo' : 'report'),
        evidence: [...new Set(allEvidence)],
        detectedPhase: taskDetections[0].detectedPhase,
        location: taskDetections.find(d => d.location)?.location,
      });
    }
  }

  return consolidated;
}

/**
 * Apply detected progress updates to schedule
 */
export async function applyProgressUpdates(
  updates: Array<{ taskId: string; newProgress: number }>,
  userId: string
): Promise<{ updated: number; errors: string[] }> {
  let updated = 0;
  const errors: string[] = [];

  for (const update of updates) {
    try {
      await prisma.scheduleTask.update({
        where: { id: update.taskId },
        data: {
          percentComplete: update.newProgress,
        },
      });
      updated++;
    } catch (error) {
      errors.push(`Failed to update task ${update.taskId}: ${error}`);
    }
  }

  return { updated, errors };
}

/**
 * Get site-wide progress summary from all photo analysis
 */
export async function getSiteProgressSummary(projectId: string): Promise<{
  overallProgress: number;
  byPhase: Record<string, { progress: number; taskCount: number }>;
  recentPhotos: Array<{ id: string; tags: string[]; detectedWork: string[]; analyzedAt: string }>;
  progressTrend: Array<{ date: string; progress: number }>;
}> {
  try {
    // Get schedule with tasks
    const schedule = await prisma.schedule.findFirst({
      where: { projectId, isActive: true },
      include: { ScheduleTask: true },
    });

    // Get recent photos with analysis
    const recentPhotos = await prisma.document.findMany({
      where: {
        projectId,
        fileType: { in: ['jpg', 'jpeg', 'png', 'webp'] },
        description: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Calculate phase-level progress
    const byPhase: Record<string, { progress: number; taskCount: number }> = {};
    
    if (schedule?.ScheduleTask) {
      for (const task of schedule.ScheduleTask) {
        const phase = detectPhaseFromTask(task.name);
        if (!byPhase[phase]) {
          byPhase[phase] = { progress: 0, taskCount: 0 };
        }
        byPhase[phase].progress += task.percentComplete || 0;
        byPhase[phase].taskCount++;
      }

      // Average the progress
      for (const phase of Object.keys(byPhase)) {
        if (byPhase[phase].taskCount > 0) {
          byPhase[phase].progress = Math.round(
            byPhase[phase].progress / byPhase[phase].taskCount
          );
        }
      }
    }

    // Calculate overall progress
    const overallProgress = schedule?.ScheduleTask.length
      ? Math.round(
          schedule.ScheduleTask.reduce((sum, t) => sum + (t.percentComplete || 0), 0) / schedule.ScheduleTask.length
        )
      : 0;

    // Get progress trend from daily reports
    const recentReports = await prisma.dailyReport.findMany({
      where: { projectId },
      orderBy: { reportDate: 'desc' },
      take: 14,
    });

    const progressTrend = recentReports.reverse().map(r => ({
      date: r.reportDate.toISOString().split('T')[0],
      progress: 0, // Would need historical tracking
    }));

    return {
      overallProgress,
      byPhase,
      recentPhotos: recentPhotos.slice(0, 10).map(p => {
        // Parse description as JSON to get AI analysis data
        let aiData: Record<string, unknown> = {};
        try {
          if (p.description) {
            aiData = JSON.parse(p.description);
          }
        } catch {
          // Not JSON, that's fine
        }
        return {
          id: p.id,
          tags: p.tags || (aiData.aiTags as string[]) || [],
          detectedWork: (aiData.detectedWork as string[]) || [],
          analyzedAt: (aiData.analyzedAt as string) || '',
        };
      }),
      progressTrend,
    };
  } catch (error) {
    console.error('[Progress Detection] Summary error:', error);
    return {
      overallProgress: 0,
      byPhase: {},
      recentPhotos: [],
      progressTrend: [],
    };
  }
}
