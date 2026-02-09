/**
 * Schedule Parser - Extract project schedules from PDF documents
 * 
 * This module uses vision AI to parse construction schedule PDFs and extract:
 * - Task lists with IDs, names, dates
 * - Dependencies between tasks
 * - Critical path information
 * - Resource assignments
 */

import { prisma } from './db';
import { createScopedLogger } from './logger';

const log = createScopedLogger('SCHEDULE_PARSER');

interface ParsedTask {
  taskId: string;         // e.g., "A1010", "T-001"
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  duration: number;       // Days
  predecessors: string[]; // Task IDs this depends on
  assignedTo?: string;
  location?: string;
  wbsCode?: string;
  isCritical: boolean;
  totalFloat?: number;
}

interface ScheduleParsingResult {
  scheduleId: string;
  totalTasks: number;
  criticalPathTasks: number;
  startDate: Date;
  endDate: Date;
  tasks: ParsedTask[];
}

/**
 * Parse a schedule PDF document and extract tasks
 */
export async function parseScheduleFromDocument(
  documentId: string,
  projectId: string,
  userId: string,
  scheduleName?: string
): Promise<ScheduleParsingResult> {
  try {
    // Get document
    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });

    if (!document) {
      throw new Error('Document not found');
    }

    if (document.fileType !== 'pdf') {
      throw new Error('Only PDF documents are supported for schedule parsing');
    }

    log.info('Parsing schedule from document', { documentName: document.name });

    // Get existing chunks (OCR data)
    const chunks = await prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { pageNumber: 'asc' }
    });

    if (chunks.length === 0) {
      throw new Error('Document has not been processed for OCR yet');
    }

    // Parse tasks from chunks
    const tasks = await extractTasksFromChunks(chunks);

    if (tasks.length === 0) {
      throw new Error('No schedule tasks found in document');
    }

    // Calculate project dates
    const startDate = tasks.reduce((min, task) => 
      task.startDate < min ? task.startDate : min, tasks[0].startDate
    );
    const endDate = tasks.reduce((max, task) => 
      task.endDate > max ? task.endDate : max, tasks[0].endDate
    );

    // Create schedule in database
    const schedule = await prisma.schedule.create({
      data: {
        name: scheduleName || `Schedule from ${document.name}`,
        projectId,
        documentId,
        startDate,
        endDate,
        createdBy: userId,
        extractedBy: 'pdf_parser',
        extractedAt: new Date(),
        isActive: true
      }
    });

    log.info('Created schedule', { scheduleId: schedule.id, taskCount: tasks.length });

    // Create tasks
    const createdTasks = [];
    for (const task of tasks) {
      const scheduleTask = await prisma.scheduleTask.create({
        data: {
          scheduleId: schedule.id,
          taskId: task.taskId,
          name: task.name,
          description: task.description,
          startDate: task.startDate,
          endDate: task.endDate,
          duration: task.duration,
          predecessors: task.predecessors,
          assignedTo: task.assignedTo,
          location: task.location,
          wbsCode: task.wbsCode,
          isCritical: task.isCritical,
          totalFloat: task.totalFloat
        }
      });
      createdTasks.push(scheduleTask);
    }

    // Calculate successors for each task
    await updateTaskSuccessors(schedule.id);

    const criticalPathTasks = tasks.filter((t: any) => t.isCritical).length;

    log.info('Parsed tasks', { taskCount: tasks.length, criticalPathTasks });

    return {
      scheduleId: schedule.id,
      totalTasks: tasks.length,
      criticalPathTasks,
      startDate,
      endDate,
      tasks
    };
  } catch (error) {
    log.error('Schedule parsing error', error as Error);
    throw error;
  }
}

/**
 * Extract tasks from document chunks using pattern matching
 */
async function extractTasksFromChunks(chunks: any[]): Promise<ParsedTask[]> {
  const tasks: ParsedTask[] = [];

  for (const chunk of chunks) {
    const content = chunk.content;
    const metadata = chunk.metadata as any;

    // Extract tasks using various patterns
    const extractedTasks = parseScheduleContent(content, metadata);
    tasks.push(...extractedTasks);
  }

  return tasks;
}

/**
 * Parse schedule content to extract task information
 */
function parseScheduleContent(content: string, metadata: any): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // Pattern 1: Task ID - Task Name - Start - End - Duration
    // Example: "A1010    Install Foundation Forms    01/15/24    01/22/24    5d"
    const pattern1 = /([A-Z]?\d{3,})\s+([A-Za-z][\w\s\/\-\(\)]+)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d+)d?/;
    const match1 = line.match(pattern1);

    if (match1) {
      const [, taskId, name, start, end, duration] = match1;
      tasks.push({
        taskId: taskId.trim(),
        name: name.trim(),
        startDate: parseDate(start),
        endDate: parseDate(end),
        duration: parseInt(duration),
        predecessors: extractPredecessors(line),
        isCritical: line.toLowerCase().includes('critical') || line.includes('*'),
        totalFloat: extractFloat(line)
      });
      continue;
    }

    // Pattern 2: Simpler format - ID Name Date-Date
    // Example: "T-001 Foundation Work 1/15 - 1/22"
    const pattern2 = /([A-Z\-\d]{3,})\s+([A-Za-z][\w\s]+)\s+(\d{1,2}\/\d{1,2})\s*-\s*(\d{1,2}\/\d{1,2})/;
    const match2 = line.match(pattern2);

    if (match2) {
      const [, taskId, name, start, end] = match2;
      const currentYear = new Date().getFullYear();
      const startDate = parseDate(`${start}/${currentYear}`);
      const endDate = parseDate(`${end}/${currentYear}`);
      const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      tasks.push({
        taskId: taskId.trim(),
        name: name.trim(),
        startDate,
        endDate,
        duration,
        predecessors: extractPredecessors(line),
        isCritical: false
      });
    }
  }

  return tasks;
}

/**
 * Parse date from string
 */
function parseDate(dateStr: string): Date {
  // Handle various date formats
  const cleaned = dateStr.trim();

  // Format: MM/DD/YYYY or MM/DD/YY
  const parts = cleaned.split('/');
  if (parts.length === 3) {
    let month = parseInt(parts[0]) - 1; // 0-indexed
    let day = parseInt(parts[1]);
    let year = parseInt(parts[2]);

    // Handle 2-digit years
    if (year < 100) {
      year += year < 50 ? 2000 : 1900;
    }

    return new Date(year, month, day);
  }

  // Fallback: try native Date parsing
  return new Date(cleaned);
}

/**
 * Extract predecessor task IDs from a line
 */
function extractPredecessors(line: string): string[] {
  const predecessors: string[] = [];

  // Pattern: "Pred: A1010, A1020" or "Predecessors: T-001, T-002"
  const predMatch = line.match(/Pred(?:ecessors)?:\s*([A-Z\-\d,\s]+)/i);
  if (predMatch) {
    const predStr = predMatch[1];
    const ids = predStr.split(',').map(id => id.trim()).filter(id => id);
    predecessors.push(...ids);
  }

  return predecessors;
}

/**
 * Extract total float from a line
 */
function extractFloat(line: string): number | undefined {
  // Pattern: "Float: 5d" or "TF: 3"
  const floatMatch = line.match(/(?:Float|TF):\s*(\d+)/i);
  if (floatMatch) {
    return parseInt(floatMatch[1]);
  }
  return undefined;
}

/**
 * Update successor relationships for all tasks in a schedule
 */
async function updateTaskSuccessors(scheduleId: string): Promise<void> {
  const tasks = await prisma.scheduleTask.findMany({
    where: { scheduleId }
  });

  for (const task of tasks) {
    const successors: string[] = [];

    // Find all tasks that list this task as a predecessor
    for (const otherTask of tasks) {
      if (otherTask.id !== task.id && otherTask.predecessors.includes(task.taskId)) {
        successors.push(otherTask.taskId);
      }
    }

    // Update task with successors
    if (successors.length > 0) {
      await prisma.scheduleTask.update({
        where: { id: task.id },
        data: { successors }
      });
    }
  }
}

/**
 * Calculate critical path for a schedule
 */
export async function calculateCriticalPath(scheduleId: string): Promise<string[]> {
  const tasks = await prisma.scheduleTask.findMany({
    where: { scheduleId },
    orderBy: { startDate: 'asc' }
  });

  // Simple critical path: tasks with zero float
  const criticalTasks = tasks
    .filter((task: any) => task.totalFloat === 0 || task.isCritical)
    .map((task: any) => task.id);

  return criticalTasks;
}

/**
 * Get schedule progress summary
 */
export async function getScheduleProgress(scheduleId: string) {
  const tasks = await prisma.scheduleTask.findMany({
    where: { scheduleId }
  });

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t: any) => t.status === 'completed').length;
  const inProgressTasks = tasks.filter((t: any) => t.status === 'in_progress').length;
  const delayedTasks = tasks.filter((t: any) => t.status === 'delayed').length;

  const totalProgress = tasks.reduce((sum: any, t: any) => sum + t.percentComplete, 0) / totalTasks;

  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    delayedTasks,
    overallProgress: Math.round(totalProgress * 10) / 10 // Round to 1 decimal
  };
}

// ============================================================================
// SCHEDULE INTEGRATION FEATURES - Daily Report & Schedule Sync
// ============================================================================

export interface ScheduledActivity {
  activity: string;
  date?: string;
  location?: string;
}

export interface ScheduleCandidate {
  id: string;
  documentId: string;
  documentName: string;
  title: string;
  matchScore: number;
  confidence: number;
}

/**
 * Find schedule document candidates in project
 * Looks for documents that contain schedule/planning information
 */
export async function findScheduleCandidates(projectId: string): Promise<ScheduleCandidate[]> {
  try {
    log.info('Finding schedule candidates', { projectId });

    // Look for documents in the schedule category or with schedule-related names
    const documents = await prisma.document.findMany({
      where: {
        projectId,
        OR: [
          { category: 'schedule' },
          { name: { contains: 'schedule', mode: 'insensitive' } },
          { name: { contains: 'plan', mode: 'insensitive' } },
          { name: { contains: 'timeline', mode: 'insensitive' } },
          { name: { contains: 'gantt', mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        name: true,
        category: true
      }
    });

    if (documents.length === 0) {
      log.info('No schedule documents found');
      return [];
    }

    // Score each document based on relevance
    const candidates: ScheduleCandidate[] = documents.map((doc: any) => {
      let matchScore = 0;
      let confidence = 0.5;

      // Higher score for explicit schedule category
      if (doc.category === 'schedule') {
        matchScore += 50;
        confidence += 0.3;
      }

      // Score based on filename keywords
      const lowerName = doc.name.toLowerCase();
      if (lowerName.includes('schedule')) {
        matchScore += 30;
        confidence += 0.15;
      }
      if (lowerName.includes('gantt')) {
        matchScore += 25;
        confidence += 0.1;
      }
      if (lowerName.includes('timeline') || lowerName.includes('plan')) {
        matchScore += 15;
      }
      if (lowerName.includes('master')) {
        matchScore += 10;
      }

      // Cap confidence at 0.95
      confidence = Math.min(0.95, confidence);

      return {
        id: doc.id,
        documentId: doc.id,
        documentName: doc.name,
        title: doc.name,
        matchScore,
        confidence
      };
    });

    // Sort by match score (highest first)
    candidates.sort((a, b) => b.matchScore - a.matchScore);

    log.info('Found schedule candidates', { count: candidates.length });
    return candidates;
  } catch (error) {
    log.error('Error finding schedule candidates', error as Error);
    return [];
  }
}

/**
 * Parse schedule activities from document text for a specific date
 * Extracts activities scheduled for the target date
 */
export async function parseScheduleActivities(
  projectSlug: string,
  documentId: string,
  targetDate: Date
): Promise<ScheduledActivity[]> {
  try {
    log.info('Parsing activities for date', { targetDate });

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug }
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Get document chunks
    const chunks = await prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { pageNumber: 'asc' }
    });

    if (chunks.length === 0) {
      log.info('No document chunks found');
      return [];
    }

    const activities: ScheduledActivity[] = [];
    const targetDateStr = formatDateForMatching(targetDate);

    // Parse activities from chunks
    for (const chunk of chunks) {
      const content = chunk.content;
      const lines = content.split('\n');

      for (const line of lines) {
        // Try to match various activity patterns
        const activity = parseActivityLine(line, targetDate, targetDateStr);
        if (activity) {
          activities.push(activity);
        }
      }
    }

    // Remove duplicates
    const uniqueActivities = deduplicateActivities(activities);

    log.info('Found activities', { count: uniqueActivities.length, date: targetDateStr });
    return uniqueActivities;
  } catch (error) {
    log.error('Error parsing schedule activities', error as Error);
    return [];
  }
}

/**
 * Parse a single line to extract activity information
 */
function parseActivityLine(
  line: string,
  targetDate: Date,
  targetDateStr: string
): ScheduledActivity | null {
  // Skip empty lines or headers
  if (!line.trim() || line.length < 10) {
    return null;
  }

  // Pattern 1: Date followed by activity description
  // Example: "01/15/24 - Pour foundation footings - Area A"
  const pattern1 = /(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–]\s*([^-–]+)(?:[-–]\s*(.+))?/;
  const match1 = line.match(pattern1);
  if (match1) {
    const [, dateStr, activity, location] = match1;
    if (datesMatch(dateStr, targetDate)) {
      return {
        activity: activity.trim(),
        date: dateStr,
        location: location?.trim()
      };
    }
  }

  // Pattern 2: Activity ID, name, date range
  // Example: "A1010    Install Foundation Forms    01/15/24-01/22/24"
  const pattern2 = /([A-Z]?\d{3,})\s+([A-Za-z][\w\s\/\-\(\)]+)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/;
  const match2 = line.match(pattern2);
  if (match2) {
    const [, taskId, activity, startDate, endDate] = match2;
    if (dateInRange(targetDate, startDate, endDate)) {
      return {
        activity: `${taskId.trim()} - ${activity.trim()}`,
        date: formatDateForMatching(targetDate),
        location: undefined
      };
    }
  }

  // Pattern 3: Simple date mention with activity
  // Example: "Foundation work scheduled for 1/15"
  const pattern3 = /([^.!?]+)\s+(?:scheduled for|on)\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i;
  const match3 = line.match(pattern3);
  if (match3) {
    const [, activity, dateStr] = match3;
    if (datesMatch(dateStr, targetDate)) {
      return {
        activity: activity.trim(),
        date: dateStr,
        location: undefined
      };
    }
  }

  return null;
}

/**
 * Check if two dates match (flexible matching)
 */
function datesMatch(dateStr: string, targetDate: Date): boolean {
  try {
    const parsed = parseDate(dateStr);
    return (
      parsed.getFullYear() === targetDate.getFullYear() &&
      parsed.getMonth() === targetDate.getMonth() &&
      parsed.getDate() === targetDate.getDate()
    );
  } catch {
    return false;
  }
}

/**
 * Check if target date falls within a date range
 */
function dateInRange(targetDate: Date, startDateStr: string, endDateStr: string): boolean {
  try {
    const start = parseDate(startDateStr);
    const end = parseDate(endDateStr);
    return targetDate >= start && targetDate <= end;
  } catch {
    return false;
  }
}

/**
 * Format date for matching (MM/DD/YYYY)
 */
function formatDateForMatching(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Remove duplicate activities
 */
function deduplicateActivities(activities: ScheduledActivity[]): ScheduledActivity[] {
  const seen = new Set<string>();
  const unique: ScheduledActivity[] = [];

  for (const activity of activities) {
    const key = `${activity.activity}|${activity.location || ''}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(activity);
    }
  }

  return unique;
}

/**
 * Format schedule suggestions for display in daily reports
 */
export function formatScheduleSuggestions(activities: ScheduledActivity[]): string {
  if (activities.length === 0) {
    return '';
  }

  let formatted = '📋 **Scheduled Activities for Today:**\n\n';

  activities.forEach((activity, index) => {
    formatted += `${index + 1}. **${activity.activity}**`;
    if (activity.location) {
      formatted += ` (${activity.location})`;
    }
    formatted += '\n';
  });

  formatted += '\n_Based on project schedule documents_';

  return formatted;
}

/**
 * Compare scheduled activities with actual work performed
 */
export function compareScheduleActivities(
  scheduled: ScheduledActivity[],
  actual: ScheduledActivity[]
): { 
  hasDifferences: boolean; 
  matches: any[]; 
  missing: any[]; 
  extra: any[]; 
  differences: any[] 
} {
  const matches: any[] = [];
  const missing: any[] = [];
  const extra: any[] = [];

  // Normalize activities for comparison
  const normalizeActivity = (act: ScheduledActivity) => 
    act.activity.toLowerCase().replace(/[^\w\s]/g, '').trim();

  const actualNormalized = actual.map(a => ({
    ...a,
    normalized: normalizeActivity(a)
  }));

  // Find matches and missing
  for (const scheduledItem of scheduled) {
    const normalizedScheduled = normalizeActivity(scheduledItem);
    const match = actualNormalized.find(a => 
      a.normalized.includes(normalizedScheduled) || 
      normalizedScheduled.includes(a.normalized)
    );

    if (match) {
      matches.push({
        scheduled: scheduledItem.activity,
        actual: match.activity,
        location: scheduledItem.location || match.location
      });
    } else {
      missing.push({
        activity: scheduledItem.activity,
        location: scheduledItem.location,
        reason: 'Not completed or not reported'
      });
    }
  }

  // Find extra (unscheduled work)
  for (const actualItem of actual) {
    const normalizedActual = normalizeActivity(actualItem);
    const wasScheduled = scheduled.find(s => {
      const normalizedScheduled = normalizeActivity(s);
      return normalizedActual.includes(normalizedScheduled) || 
             normalizedScheduled.includes(normalizedActual);
    });

    if (!wasScheduled) {
      extra.push({
        activity: actualItem.activity,
        location: actualItem.location,
        reason: 'Unscheduled work'
      });
    }
  }

  const hasDifferences = missing.length > 0 || extra.length > 0;
  const differences = [...missing.map(m => ({ type: 'missing', ...m })), 
                       ...extra.map(e => ({ type: 'extra', ...e }))];

  return {
    hasDifferences,
    matches,
    missing,
    extra,
    differences
  };
}

/**
 * Generate schedule update draft based on comparison
 */
export function generateScheduleUpdateDraft(
  comparison: any,
  reportDate: Date | string
): string {
  const dateStr = typeof reportDate === 'string' 
    ? reportDate 
    : formatDateForMatching(reportDate);

  let draft = `# Schedule Update for ${dateStr}\n\n`;

  // Completed activities
  if (comparison.matches.length > 0) {
    draft += `## ✅ Completed Scheduled Activities (${comparison.matches.length})\n\n`;
    comparison.matches.forEach((match: any, index: number) => {
      draft += `${index + 1}. ${match.scheduled}`;
      if (match.location) {
        draft += ` - ${match.location}`;
      }
      draft += '\n';
    });
    draft += '\n';
  }

  // Missing/delayed activities
  if (comparison.missing.length > 0) {
    draft += `## ⚠️ Incomplete/Delayed Activities (${comparison.missing.length})\n\n`;
    comparison.missing.forEach((missing: any, index: number) => {
      draft += `${index + 1}. ${missing.activity}`;
      if (missing.location) {
        draft += ` - ${missing.location}`;
      }
      draft += `\n   - Status: ${missing.reason}\n`;
    });
    draft += '\n';
  }

  // Unscheduled work
  if (comparison.extra.length > 0) {
    draft += `## 🔧 Additional Unscheduled Work (${comparison.extra.length})\n\n`;
    comparison.extra.forEach((extra: any, index: number) => {
      draft += `${index + 1}. ${extra.activity}`;
      if (extra.location) {
        draft += ` - ${extra.location}`;
      }
      draft += '\n';
    });
    draft += '\n';
  }

  // Summary
  draft += `## 📊 Summary\n\n`;
  draft += `- Scheduled activities: ${comparison.matches.length + comparison.missing.length}\n`;
  draft += `- Completed: ${comparison.matches.length}\n`;
  draft += `- Delayed: ${comparison.missing.length}\n`;
  draft += `- Unscheduled work: ${comparison.extra.length}\n`;

  if (comparison.matches.length > 0) {
    const completionRate = Math.round(
      (comparison.matches.length / (comparison.matches.length + comparison.missing.length)) * 100
    );
    draft += `- Completion rate: ${completionRate}%\n`;
  }

  return draft;
}
