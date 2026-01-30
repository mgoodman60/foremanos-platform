/**
 * AI-Powered Schedule Extractor
 * 
 * Uses LLM vision API to intelligently extract schedule tasks from documents
 * More robust than regex pattern matching - handles various formats
 */

import { prisma } from './db';
import { callAbacusLLM } from './abacus-llm';
import { generateAbbreviationContext, expandAbbreviationsInText } from './construction-abbreviations';
import { getFileUrl } from './s3';
import { withLock, isLocked } from './extraction-lock-service';
import { ScheduleTaskStatus } from '@prisma/client';

interface ExtractedTask {
  taskId: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  duration?: number;
  predecessors?: string[];
  assignedTo?: string;
  location?: string;
  wbsCode?: string;
  isCritical?: boolean;
  percentComplete?: number;
  status?: string;
}

interface ScheduleExtractionResult {
  scheduleId: string;
  totalTasks: number;
  criticalPathTasks: number;
  startDate: Date;
  endDate: Date;
  tasks: ExtractedTask[];
}

/**
 * Extract schedule tasks using AI vision analysis
 */
export async function extractScheduleWithAI(
  documentId: string,
  projectId: string,
  userId: string,
  scheduleName?: string
): Promise<ScheduleExtractionResult> {
  // Use lock to prevent race conditions during extraction
  const lockResult = await withLock(
    'document',
    documentId,
    'schedule',
    async () => performScheduleExtraction(documentId, projectId, userId, scheduleName),
    { 
      skipIfLocked: false, // Don't skip - we want to wait or return existing
      waitForLock: false,  // Don't wait - check if already locked
      lockDurationMs: 10 * 60 * 1000 // 10 minutes for long extractions
    }
  );

  if (lockResult.skipped || !lockResult.success) {
    console.log(`[AI_SCHEDULE_EXTRACTOR] ⏳ Schedule extraction already in progress for document ${documentId}, returning existing...`);
    
    // Return existing schedule if available
    const existingSchedule = await prisma.schedule.findFirst({
      where: { documentId, isActive: true },
      include: { ScheduleTask: true }
    });
    
    if (existingSchedule) {
      return {
        scheduleId: existingSchedule.id,
        totalTasks: existingSchedule.ScheduleTask.length,
        criticalPathTasks: existingSchedule.ScheduleTask.filter(t => t.isCritical).length,
        startDate: existingSchedule.startDate || new Date(),
        endDate: existingSchedule.endDate || new Date(),
        tasks: existingSchedule.ScheduleTask.map(t => ({
          taskId: t.taskId,
          name: t.name,
          description: t.description || undefined,
          startDate: t.startDate?.toISOString().split('T')[0] || '',
          endDate: t.endDate?.toISOString().split('T')[0] || '',
          duration: t.duration || undefined,
          predecessors: t.predecessors as string[] || undefined,
          assignedTo: t.assignedTo || undefined,
          location: t.location || undefined,
          wbsCode: t.wbsCode || undefined,
          isCritical: t.isCritical || undefined,
          percentComplete: t.percentComplete || undefined,
          status: t.status || undefined,
        }))
      };
    }
    
    throw new Error('Schedule extraction already in progress. Please wait for the current extraction to complete.');
  }

  return lockResult.result!;
}

/**
 * Internal function that performs the actual schedule extraction
 * This is wrapped by withLock to prevent race conditions
 */
async function performScheduleExtraction(
  documentId: string,
  projectId: string,
  userId: string,
  scheduleName?: string
): Promise<ScheduleExtractionResult> {
  console.log('[AI_SCHEDULE_EXTRACTOR] Starting AI-powered schedule extraction');

  // Delete any existing schedules for this document to prevent duplicates
  const deletedSchedules = await prisma.schedule.deleteMany({
    where: { documentId }
  });
  if (deletedSchedules.count > 0) {
    console.log(`[AI_SCHEDULE_EXTRACTOR] Deleted ${deletedSchedules.count} existing schedule(s) for document ${documentId}`);
  }

  // Get document
  const document = await prisma.document.findUnique({
    where: { id: documentId }
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (!document.cloud_storage_path) {
    throw new Error('Document has no file path');
  }

  // Try to extract directly from PDF images first (better for Gantt charts)
  console.log(`[AI_SCHEDULE_EXTRACTOR] Attempting direct PDF vision extraction for ${document.name}`);
  
  let allTasks: ExtractedTask[] = [];
  
  try {
    const tasksFromPdf = await extractTasksFromPdfImages(documentId, document.cloud_storage_path, document.isPublic, document.name);
    if (tasksFromPdf.length > 0) {
      allTasks = tasksFromPdf;
      console.log(`[AI_SCHEDULE_EXTRACTOR] Direct PDF extraction found ${allTasks.length} tasks`);
    }
  } catch (pdfError) {
    console.log(`[AI_SCHEDULE_EXTRACTOR] Direct PDF extraction failed, falling back to chunks:`, pdfError);
  }

  // Fallback to document chunks if direct extraction failed
  if (allTasks.length === 0) {
    const chunks = await prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { pageNumber: 'asc' }
    });

    if (chunks.length === 0) {
      throw new Error('Document has not been processed for OCR yet. Please wait for processing to complete.');
    }

    console.log(`[AI_SCHEDULE_EXTRACTOR] Processing ${chunks.length} text chunks`);

    const BATCH_SIZE = 10;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchTasks = await extractTasksFromChunkBatch(batch, document.name);
      allTasks.push(...batchTasks);
      console.log(`[AI_SCHEDULE_EXTRACTOR] Processed pages ${i + 1}-${Math.min(i + BATCH_SIZE, chunks.length)}, found ${batchTasks.length} tasks`);
    }
  }

  if (allTasks.length === 0) {
    throw new Error(
      'No schedule tasks found in document. The document may not contain a construction schedule, ' +
      'or it may be in a format that could not be parsed. Please verify the document contains ' +
      'task lists with dates.'
    );
  }

  // Deduplicate tasks by taskId
  const uniqueTasks = deduplicateTasks(allTasks);
  console.log(`[AI_SCHEDULE_EXTRACTOR] Found ${uniqueTasks.length} unique tasks (${allTasks.length - uniqueTasks.length} duplicates removed)`);

  // Parse and validate dates
  const tasksWithDates = uniqueTasks.map(task => ({
    ...task,
    startDate: parseFlexibleDate(task.startDate),
    endDate: parseFlexibleDate(task.endDate)
  }));

  // Calculate project date range
  const validTasks = tasksWithDates.filter(t => t.startDate && t.endDate);
  if (validTasks.length === 0) {
    throw new Error('No tasks with valid dates found');
  }

  const startDate = validTasks.reduce((min, task) => 
    new Date(task.startDate) < new Date(min) ? task.startDate : min, 
    validTasks[0].startDate
  );
  const endDate = validTasks.reduce((max, task) => 
    new Date(task.endDate) > new Date(max) ? task.endDate : max, 
    validTasks[0].endDate
  );

  // Deactivate any existing active schedules for this project
  await prisma.schedule.updateMany({
    where: {
      projectId,
      isActive: true
    },
    data: {
      isActive: false
    }
  });

  // Create schedule in database
  const schedule = await prisma.schedule.create({
    data: {
      name: scheduleName || `Schedule from ${document.name}`,
      projectId,
      documentId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      createdBy: userId,
      extractedBy: 'ai_vision',
      extractedAt: new Date(),
      isActive: true
    }
  });

  console.log(`[AI_SCHEDULE_EXTRACTOR] Created schedule ${schedule.id} (deactivated previous schedules)`);

  // Create tasks in database
  for (const task of validTasks) {
    const start = new Date(task.startDate);
    const end = new Date(task.endDate);
    const duration = task.duration || Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    await prisma.scheduleTask.create({
      data: {
        scheduleId: schedule.id,
        taskId: task.taskId,
        name: task.name,
        description: task.description,
        startDate: start,
        endDate: end,
        duration,
        predecessors: task.predecessors || [],
        assignedTo: task.assignedTo,
        location: task.location,
        wbsCode: task.wbsCode,
        isCritical: task.isCritical || false,
        percentComplete: task.percentComplete || 0,
        status: (task.status || 'not_started') as ScheduleTaskStatus
      }
    });
  }

  console.log(`[AI_SCHEDULE_EXTRACTOR] Successfully created ${validTasks.length} tasks`);

  // Create or update ProjectDataSource for schedule feature
  // This is required for schedule-metrics API to work correctly
  await prisma.projectDataSource.upsert({
    where: {
      projectId_featureType: {
        projectId,
        featureType: 'schedule'
      }
    },
    create: {
      projectId,
      featureType: 'schedule',
      documentId,
      sourceType: 'pdf',
      confidence: 85,
      metadata: {
        taskCount: validTasks.length,
        extractedBy: 'ai_vision',
        scheduleId: schedule.id
      }
    },
    update: {
      documentId,
      sourceType: 'pdf',
      confidence: 85,
      metadata: {
        taskCount: validTasks.length,
        extractedBy: 'ai_vision',
        scheduleId: schedule.id
      }
    }
  });

  console.log(`[AI_SCHEDULE_EXTRACTOR] Created/updated ProjectDataSource for schedule feature`);

  // Run trade inference on the new schedule (in background)
  console.log(`[AI_SCHEDULE_EXTRACTOR] 🏗️ Triggering trade inference for schedule ${schedule.id}...`);
  import('./trade-inference').then(({ inferTradesForSchedule }) => {
    inferTradesForSchedule(schedule.id, projectId)
      .then(result => {
        console.log(`[AI_SCHEDULE_EXTRACTOR] 🏗️ Trade inference complete: ${result.updated} tasks updated, ${result.needsClarification} need clarification`);
      })
      .catch(err => {
        console.error('[AI_SCHEDULE_EXTRACTOR] Trade inference error:', err);
      });
  });

  // Count critical path tasks
  const criticalCount = validTasks.filter(t => t.isCritical).length;

  return {
    scheduleId: schedule.id,
    totalTasks: validTasks.length,
    criticalPathTasks: criticalCount,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    tasks: validTasks
  };
}

/**
 * Extract tasks from a batch of document chunks using AI
 */
async function extractTasksFromChunkBatch(
  chunks: any[],
  documentName: string
): Promise<ExtractedTask[]> {
  // Combine chunk content for context
  const combinedContent = chunks
    .map(chunk => `=== Page ${chunk.pageNumber} ===\n${chunk.content}`)
    .join('\n\n');

  // Generate abbreviation glossary from document content
  const abbreviationGlossary = generateAbbreviationContext(combinedContent);

  // Build AI prompt
  const prompt = `You are analyzing construction schedule pages from the document "${documentName}".\n\nYour task is to extract ALL construction tasks/activities with their schedule information.${abbreviationGlossary}\n\n**CRITICAL INSTRUCTIONS:**\n1. Extract EVERY task, activity, or work item mentioned\n2. Include task IDs (e.g., A1010, T-001, 1.1.1) if present\n3. Extract dates in any format found (MM/DD/YY, DD-MMM-YY, etc.)\n4. Identify predecessors/dependencies if mentioned\n5. Note if tasks are marked as critical or on critical path\n6. Include location/area information if specified\n7. Extract WBS codes or activity codes if present\n\n**EXPECTED OUTPUT FORMAT (JSON array):**\n[\n  {\n    "taskId": "A1010",\n    "name": "Install Foundation Forms",\n    "description": "Set up formwork for foundation footings",\n    "startDate": "01/15/2024",\n    "endDate": "01/22/2024",\n    "duration": 5,\n    "predecessors": ["A1000", "A1005"],\n    "assignedTo": "ABC Concrete",\n    "location": "Area A",\n    "wbsCode": "1.1.1",\n    "isCritical": true,\n    "percentComplete": 0,\n    "status": "not_started"\n  }\n]\n\n**DATE HANDLING:**\n- If you see a date range like "01/15-01/22", split into startDate and endDate\n- If only one date is given, use it for both start and end\n- Always include the year. If year is missing, assume 2024\n- Format as MM/DD/YYYY in output\n\n**TASK ID RULES:**\n- If document doesn't have task IDs, generate sequential IDs: TASK-001, TASK-002, etc.\n- Maintain any existing numbering system from the document\n\n**STATUS MAPPING:**\n- Use "not_started", "in_progress", "completed", "delayed"\n- If status unclear, use "not_started"\n\nNow extract all tasks from these schedule pages:\n\n${combinedContent}\n\n**OUTPUT (JSON array only, no markdown):**`;

  try {
    console.log('[AI_SCHEDULE_EXTRACTOR] Calling LLM API for schedule extraction...');
    
    const llmResponse = await callAbacusLLM([
      {
        role: 'system',
        content: 'You are an expert construction schedule analyst. Extract ALL construction tasks from schedule documents. Always respond with valid JSON only.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ], {
      model: 'gpt-4o',
      temperature: 0.1,
      max_tokens: 16000,
    });

    const content = llmResponse.content;
    console.log('[AI_SCHEDULE_EXTRACTOR] LLM API call successful');

    if (!content) {
      console.error('[AI_SCHEDULE_EXTRACTOR] No content in LLM response');
      return [];
    }

    // Parse JSON response
    let tasks: ExtractedTask[] = [];
    try {
      // Remove markdown code blocks if present
      let jsonContent = content;
      if (content.includes('```json')) {
        const match = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) {
          jsonContent = match[1].trim();
        }
      } else if (content.includes('```')) {
        const match = content.match(/```\s*([\s\S]*?)\s*```/);
        if (match) {
          jsonContent = match[1].trim();
        }
      }
      
      // Try to extract JSON array
      const jsonMatch = jsonContent.match(/\[\s*[\s\S]*\]/);      
      if (jsonMatch) {
        tasks = JSON.parse(jsonMatch[0]);
      } else {
        // Try parsing the whole response
        tasks = JSON.parse(jsonContent);
      }
    } catch (parseError) {
      console.error('[AI_SCHEDULE_EXTRACTOR] Failed to parse AI response as JSON:', parseError);
      console.log('[AI_SCHEDULE_EXTRACTOR] Raw response:', content.substring(0, 500));
      // Return empty array instead of throwing
      return [];
    }

    // Validate and clean tasks
    const validTasks = tasks.filter(task => {
      const hasRequiredFields = task.taskId && task.name && task.startDate && task.endDate;
      if (!hasRequiredFields) {
        console.warn(`[AI_SCHEDULE_EXTRACTOR] Skipping invalid task:`, task);
      }
      return hasRequiredFields;
    });

    return validTasks;
  } catch (error) {
    console.error('[AI_SCHEDULE_EXTRACTOR] Error calling vision API:', error);
    return [];
  }
}

/**
 * Extract tasks directly from PDF images using vision AI
 * Better for Gantt charts and visual schedules
 */
async function extractTasksFromPdfImages(
  documentId: string,
  cloudStoragePath: string,
  isPublic: boolean,
  documentName: string
): Promise<ExtractedTask[]> {
  console.log('[AI_SCHEDULE_EXTRACTOR] Starting direct PDF image extraction');
  
  // Download PDF from S3
  const fileUrl = await getFileUrl(cloudStoragePath, isPublic);
  const response = await fetch(fileUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.statusText}`);
  }
  
  const buffer = Buffer.from(await response.arrayBuffer());
  const pdfBase64 = buffer.toString('base64');
  
  console.log(`[AI_SCHEDULE_EXTRACTOR] Sending PDF to vision API (${Math.round(buffer.length / 1024)}KB)`);
  
  const allTasks: ExtractedTask[] = [];
  
  const prompt = `You are analyzing a construction schedule / Gantt chart from "${documentName}".

**YOUR TASK:** Extract ALL construction tasks/activities visible in this schedule.

**LOOK FOR:**
1. Task/Activity names in the left column (e.g., "PEMB Procurement", "Sitework", "Foundations")
2. Activity IDs/codes (e.g., A1000, A1010, etc.)
3. Duration shown (e.g., "50d", "8d", "10d")
4. Start and end dates from the timeline/bars
5. Bar positions on the Gantt chart indicate timing
6. Critical path items (often shown in red or different color)
7. Milestones (diamond shapes, typically 0 duration)

**IMPORTANT:**
- Extract EVERY task row visible, even if partially visible
- Read task names carefully from the left side of the chart
- Estimate dates from the bar positions on the timeline
- The year should be 2025 or 2026 based on the project schedule

**OUTPUT FORMAT (JSON array only):**
[
  {
    "taskId": "A1000",
    "name": "PEMB Procurement",
    "startDate": "12/19/2025",
    "endDate": "02/07/2026",
    "duration": 50,
    "isCritical": false
  }
]

Extract all tasks now:`;

  try {
    // Use Claude which can process PDFs directly
    const llmResponse = await callAbacusLLM([
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64
            }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }
    ], {
      model: 'claude-sonnet-4-20250514',
      temperature: 0.1,
      max_tokens: 8000,
    });

    const content = llmResponse.content;
    
    if (content) {
      // Parse JSON response
      let jsonContent = content;
      if (content.includes('```json')) {
        const match = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) jsonContent = match[1].trim();
      } else if (content.includes('```')) {
        const match = content.match(/```\s*([\s\S]*?)\s*```/);
        if (match) jsonContent = match[1].trim();
      }
      
      const jsonMatch = jsonContent.match(/\[\s*[\s\S]*\]/);
      if (jsonMatch) {
        const tasks = JSON.parse(jsonMatch[0]);
        console.log(`[AI_SCHEDULE_EXTRACTOR] Vision extraction found ${tasks.length} tasks`);
        allTasks.push(...tasks);
      }
    }
  } catch (error: any) {
    console.error(`[AI_SCHEDULE_EXTRACTOR] Vision API error:`, error.message);
    throw error;
  }
  
  return allTasks;
}

/**
 * Deduplicate tasks by taskId
 */
function deduplicateTasks(tasks: ExtractedTask[]): ExtractedTask[] {
  const seen = new Map<string, ExtractedTask>();
  
  for (const task of tasks) {
    const key = task.taskId.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.set(key, task);
    } else {
      // If we've seen this task before, keep the one with more information
      const existing = seen.get(key)!;
      const existingScore = scoreTask(existing);
      const newScore = scoreTask(task);
      if (newScore > existingScore) {
        seen.set(key, task);
      }
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Score a task based on completeness of information
 */
function scoreTask(task: ExtractedTask): number {
  let score = 0;
  if (task.description) score += 2;
  if (task.duration) score += 1;
  if (task.predecessors && task.predecessors.length > 0) score += 2;
  if (task.assignedTo) score += 1;
  if (task.location) score += 1;
  if (task.wbsCode) score += 1;
  return score;
}

/**
 * Parse date from various formats
 */
function parseFlexibleDate(dateStr: string): string {
  try {
    // Handle various date formats
    const cleaned = dateStr.trim();

    // Format: MM/DD/YYYY or MM/DD/YY
    const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (slashMatch) {
      let [, month, day, year] = slashMatch;
      let yearNum = parseInt(year);
      if (yearNum < 100) {
        yearNum += yearNum < 50 ? 2000 : 1900;
      }
      return `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${yearNum}`;
    }

    // Format: DD-MMM-YYYY or DD-MMM-YY (e.g., 15-Jan-24)
    const dashMatch = cleaned.match(/^(\d{1,2})-(\w{3})-(\d{2,4})$/i);
    if (dashMatch) {
      const [, day, monthStr, year] = dashMatch;
      const monthMap: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
      };
      const month = monthMap[monthStr.toLowerCase()];
      let yearNum = parseInt(year);
      if (yearNum < 100) {
        yearNum += yearNum < 50 ? 2000 : 1900;
      }
      return `${month}/${day.padStart(2, '0')}/${yearNum}`;
    }

    // Try native Date parsing as fallback
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    }

    // If all parsing fails, return original
    console.warn(`[AI_SCHEDULE_EXTRACTOR] Could not parse date: ${dateStr}`);
    return cleaned;
  } catch (error) {
    console.error(`[AI_SCHEDULE_EXTRACTOR] Error parsing date "${dateStr}":`, error);
    return dateStr;
  }
}

/**
 * Delete existing schedule for a document before re-extraction
 */
export async function deleteScheduleForDocument(documentId: string): Promise<void> {
  try {
    // Find existing schedules for this document
    const existingSchedules = await prisma.schedule.findMany({
      where: { documentId }
    });

    for (const schedule of existingSchedules) {
      // Delete all tasks for this schedule
      await prisma.scheduleTask.deleteMany({
        where: { scheduleId: schedule.id }
      });

      // Delete the schedule itself
      await prisma.schedule.delete({
        where: { id: schedule.id }
      });
    }

    console.log(`[AI_SCHEDULE_EXTRACTOR] Deleted ${existingSchedules.length} existing schedule(s) for document ${documentId}`);
  } catch (error) {
    console.error('[AI_SCHEDULE_EXTRACTOR] Error deleting existing schedules:', error);
    throw error;
  }
}
