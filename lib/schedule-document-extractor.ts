/**
 * Schedule Document Extractor
 * 
 * Extracts schedule information from uploaded documents including:
 * - PDF schedules (P6 exports, MS Project exports)
 * - Excel schedules
 * - Project plans and specifications
 */

import { prisma } from './db';
import { callAbacusLLM } from './abacus-llm';
import { getFileUrl } from './s3';
import * as fs from 'fs';
import * as path from 'path';

interface ExtractedTask {
  taskId?: string;
  name: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  duration?: number;
  predecessors?: string[];
  successors?: string[];
  trade?: string;
  percentComplete?: number;
  wbsCode?: string;
  location?: string;
  notes?: string;
  isMilestone?: boolean;
}

interface ExtractionResult {
  success: boolean;
  source: string;
  extractedTasks: ExtractedTask[];
  warnings: string[];
  projectInfo?: {
    name?: string;
    startDate?: Date;
    endDate?: Date;
    totalDuration?: number;
  };
}

/**
 * Extract schedule data from a document
 */
export async function extractScheduleFromDocument(
  documentId: string
): Promise<ExtractionResult> {
  console.log('[SCHEDULE_EXTRACTOR] Extracting from document:', documentId);

  const document = await prisma.document.findUnique({
    where: { id: documentId }
  });

  if (!document) {
    return { success: false, source: '', extractedTasks: [], warnings: ['Document not found'] };
  }

  const fileName = document.name.toLowerCase();
  const warnings: string[] = [];

  // Determine extraction method based on file type
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return await extractFromExcel(document, warnings);
  } else if (fileName.endsWith('.pdf')) {
    return await extractFromPDF(document, warnings);
  } else if (fileName.endsWith('.mpp')) {
    return await extractFromMSProject(document, warnings);
  } else {
    // Try to extract from document chunks using AI
    return await extractFromDocumentChunks(document, warnings);
  }
}

/**
 * Extract schedule from Excel file
 */
async function extractFromExcel(
  document: any,
  warnings: string[]
): Promise<ExtractionResult> {
  try {
    // Get document chunks which may have been processed
    const chunks = await prisma.documentChunk.findMany({
      where: { documentId: document.id },
      orderBy: { pageNumber: 'asc' }
    });

    if (chunks.length === 0) {
      warnings.push('No processed content found for Excel file');
      return { success: false, source: document.name, extractedTasks: [], warnings };
    }

    // Use AI to parse the Excel content
    const content = chunks.map(c => c.content).join('\n');
    return await parseScheduleContentWithAI(content, document.name, warnings);
  } catch (error) {
    console.error('[SCHEDULE_EXTRACTOR] Excel extraction error:', error);
    warnings.push(`Excel extraction failed: ${error}`);
    return { success: false, source: document.name, extractedTasks: [], warnings };
  }
}

/**
 * Extract schedule from PDF file
 */
async function extractFromPDF(
  document: any,
  warnings: string[]
): Promise<ExtractionResult> {
  try {
    // Get document chunks
    const chunks = await prisma.documentChunk.findMany({
      where: { documentId: document.id },
      orderBy: { pageNumber: 'asc' }
    });

    if (chunks.length === 0) {
      warnings.push('No processed content found for PDF');
      return { success: false, source: document.name, extractedTasks: [], warnings };
    }

    const content = chunks.map(c => c.content).join('\n');
    return await parseScheduleContentWithAI(content, document.name, warnings);
  } catch (error) {
    console.error('[SCHEDULE_EXTRACTOR] PDF extraction error:', error);
    warnings.push(`PDF extraction failed: ${error}`);
    return { success: false, source: document.name, extractedTasks: [], warnings };
  }
}

/**
 * Extract from MS Project file (stub - would need specific library)
 */
async function extractFromMSProject(
  document: any,
  warnings: string[]
): Promise<ExtractionResult> {
  warnings.push('MS Project (.mpp) files require conversion to Excel or PDF for extraction');
  return { success: false, source: document.name, extractedTasks: [], warnings };
}

/**
 * Extract from document chunks using AI
 */
async function extractFromDocumentChunks(
  document: any,
  warnings: string[]
): Promise<ExtractionResult> {
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId: document.id },
    orderBy: { pageNumber: 'asc' },
    take: 50
  });

  if (chunks.length === 0) {
    warnings.push('No content available for extraction');
    return { success: false, source: document.name, extractedTasks: [], warnings };
  }

  const content = chunks.map(c => c.content).join('\n');
  return await parseScheduleContentWithAI(content, document.name, warnings);
}

/**
 * Use AI to parse schedule content and extract tasks
 */
async function parseScheduleContentWithAI(
  content: string,
  source: string,
  warnings: string[]
): Promise<ExtractionResult> {
  const prompt = `You are a construction schedule expert. Analyze this document content and extract any schedule/task information.

Document: ${source}
Content:
${content.slice(0, 20000)}

Extract tasks in this exact JSON format:
{
  "projectInfo": {
    "name": "Project name if found",
    "startDate": "YYYY-MM-DD or null",
    "endDate": "YYYY-MM-DD or null"
  },
  "tasks": [
    {
      "taskId": "Activity ID if present",
      "name": "Task name",
      "startDate": "YYYY-MM-DD or null",
      "endDate": "YYYY-MM-DD or null",
      "duration": number in days or null,
      "predecessors": ["pred task IDs"],
      "trade": "trade/resource name",
      "percentComplete": number 0-100 or null,
      "wbsCode": "WBS code if present",
      "isMilestone": boolean
    }
  ]
}

Extract ALL tasks you can identify. If dates aren't explicit, try to infer from context.
Return ONLY valid JSON, no explanations.`;

  try {
    const response = await callAbacusLLM([{ role: 'user', content: prompt }], {
      model: 'gpt-4o-mini',
      max_tokens: 4000,
      temperature: 0.2
    });

    if (response?.content) {
      const cleaned = response.content.replace(/```json\n?|```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      const tasks: ExtractedTask[] = (parsed.tasks || []).map((t: any) => ({
        taskId: t.taskId,
        name: t.name,
        startDate: t.startDate ? new Date(t.startDate) : undefined,
        endDate: t.endDate ? new Date(t.endDate) : undefined,
        duration: t.duration,
        predecessors: t.predecessors || [],
        trade: t.trade,
        percentComplete: t.percentComplete,
        wbsCode: t.wbsCode,
        isMilestone: t.isMilestone
      }));

      if (tasks.length === 0) {
        warnings.push('AI could not identify schedule tasks in this document');
      }

      return {
        success: tasks.length > 0,
        source,
        extractedTasks: tasks,
        warnings,
        projectInfo: parsed.projectInfo ? {
          name: parsed.projectInfo.name,
          startDate: parsed.projectInfo.startDate ? new Date(parsed.projectInfo.startDate) : undefined,
          endDate: parsed.projectInfo.endDate ? new Date(parsed.projectInfo.endDate) : undefined
        } : undefined
      };
    }
  } catch (error) {
    console.error('[SCHEDULE_EXTRACTOR] AI parsing error:', error);
    warnings.push(`AI parsing failed: ${error}`);
  }

  return { success: false, source, extractedTasks: [], warnings };
}

/**
 * Extract detailed schedule from project specifications and plans
 */
export async function extractDetailedScheduleFromPlans(
  projectId: string
): Promise<ExtractionResult> {
  console.log('[SCHEDULE_EXTRACTOR] Extracting detailed schedule from plans for project:', projectId);

  // Get all relevant documents
  const documents = await prisma.document.findMany({
    where: {
      projectId,
      OR: [
        { name: { contains: 'spec', mode: 'insensitive' } },
        { name: { contains: 'plan', mode: 'insensitive' } },
        { name: { contains: 'scope', mode: 'insensitive' } },
        { name: { contains: 'bid', mode: 'insensitive' } },
        { category: 'plans_drawings' },
        { category: 'specifications' }
      ]
    }
  });

  if (documents.length === 0) {
    return {
      success: false,
      source: 'project documents',
      extractedTasks: [],
      warnings: ['No plans or specifications found']
    };
  }

  // Get all document chunks
  const documentIds = documents.map(d => d.id);
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId: { in: documentIds } },
    orderBy: [{ documentId: 'asc' }, { pageNumber: 'asc' }],
    take: 200
  });

  // Get budget items for SOV-based tasks through ProjectBudget
  const projectBudget = await prisma.projectBudget.findUnique({
    where: { projectId },
    include: { BudgetItem: true }
  });
  const budgetItems = projectBudget?.BudgetItem || [];

  // Get registered subcontractors
  const subcontractors = await prisma.subcontractor.findMany({
    where: { projectId }
  });

  // Compile context
  const planContent = chunks.map(c => c.content).join('\n\n').slice(0, 30000);
  const budgetContext = budgetItems.map(b => 
    `${b.phaseCode || ''} ${b.phaseName || b.name || 'Unknown'}: ${b.description} - $${b.budgetedAmount}`
  ).join('\n');
  const subContext = subcontractors.map(s => 
    `${s.tradeType}: ${s.companyName}`
  ).join('\n');

  return await generateDetailedTasksFromContext(planContent, budgetContext, subContext);
}

/**
 * Generate detailed tasks from plans, budget, and subcontractor context
 */
async function generateDetailedTasksFromContext(
  planContent: string,
  budgetContext: string,
  subContext: string
): Promise<ExtractionResult> {
  const warnings: string[] = [];

  const prompt = `You are an expert construction scheduler. Analyze these project documents and generate a detailed construction schedule.

=== PROJECT PLANS/SPECIFICATIONS ===
${planContent.slice(0, 15000)}

=== BUDGET/SOV LINE ITEMS ===
${budgetContext.slice(0, 5000)}

=== REGISTERED SUBCONTRACTORS ===
${subContext}

Generate a comprehensive schedule with 75-150 activities covering:
1. All major scope items from plans
2. Each budget line item should have corresponding schedule activities
3. Proper CSI division sequencing (03 Concrete before 05 Steel before 09 Finishes)
4. Realistic predecessor/successor relationships
5. Trade assignments matching registered subcontractors where possible

Return JSON:
{
  "tasks": [
    {
      "taskId": "A1010",
      "name": "Task name",
      "description": "Scope description",
      "duration": 5,
      "predecessors": ["A1000"],
      "trade": "Trade name",
      "wbsCode": "03.01.001",
      "location": "Area/floor if applicable",
      "isMilestone": false,
      "isCritical": true
    }
  ]
}

Include activities for:
- Mobilization, layout, permits
- All sitework (erosion control, grading, utilities)
- Foundation (excavation, footings, walls, waterproofing)
- Structural (steel, concrete, masonry)
- Building envelope (roofing, windows, exterior)
- MEP rough-in (plumbing, HVAC, electrical, fire protection)
- Interior framing and drywall
- MEP finishes (fixtures, equipment)
- Interior finishes (flooring, paint, ceilings, millwork)
- Final inspections and punch list

Return ONLY valid JSON.`;

  try {
    const response = await callAbacusLLM([{ role: 'user', content: prompt }], {
      model: 'gpt-4o-mini',
      max_tokens: 8000,
      temperature: 0.3
    });

    if (response?.content) {
      const cleaned = response.content.replace(/```json\n?|```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      const tasks: ExtractedTask[] = (parsed.tasks || []).map((t: any) => ({
        taskId: t.taskId,
        name: t.name,
        description: t.description,
        duration: t.duration,
        predecessors: t.predecessors || [],
        trade: t.trade,
        wbsCode: t.wbsCode,
        location: t.location,
        isMilestone: t.isMilestone || false
      }));

      return {
        success: tasks.length > 0,
        source: 'plans and specifications',
        extractedTasks: tasks,
        warnings: tasks.length < 50 ? ['Generated fewer tasks than expected'] : []
      };
    }
  } catch (error) {
    console.error('[SCHEDULE_EXTRACTOR] Detailed extraction error:', error);
    warnings.push(`Detailed extraction failed: ${error}`);
  }

  return {
    success: false,
    source: 'plans and specifications',
    extractedTasks: [],
    warnings
  };
}

/**
 * Match extracted tasks with existing subcontractors
 */
export async function matchTasksToSubcontractors(
  tasks: ExtractedTask[],
  projectId: string
): Promise<ExtractedTask[]> {
  const subcontractors = await prisma.subcontractor.findMany({
    where: { projectId }
  });

  if (subcontractors.length === 0) return tasks;

  // Create trade mapping
  const tradeMap = new Map<string, string>();
  subcontractors.forEach(sub => {
    const trade = (sub.tradeType || '').toLowerCase();
    tradeMap.set(trade, `${sub.tradeType} - ${sub.companyName}`);
  });

  return tasks.map(task => {
    if (task.trade) {
      const tradeLower = task.trade.toLowerCase();
      // Try exact match first
      if (tradeMap.has(tradeLower)) {
        return { ...task, trade: tradeMap.get(tradeLower) };
      }
      // Try partial match
      for (const [key, value] of tradeMap) {
        if (tradeLower.includes(key) || key.includes(tradeLower)) {
          return { ...task, trade: value };
        }
      }
    }
    return task;
  });
}

/**
 * Import extracted tasks into the schedule
 */
export async function importExtractedTasks(
  scheduleId: string,
  tasks: ExtractedTask[],
  projectStartDate: Date
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Calculate dates for tasks without explicit dates
  let currentDate = new Date(projectStartDate);
  const taskDateMap = new Map<string, { start: Date; end: Date }>();

  for (const task of tasks) {
    try {
      // Calculate start date based on predecessors or sequence
      let startDate: Date;
      let endDate: Date;

      if (task.startDate && task.endDate) {
        startDate = new Date(task.startDate);
        endDate = new Date(task.endDate);
      } else if (task.predecessors && task.predecessors.length > 0) {
        // Find latest predecessor end date
        let latestEnd = new Date(projectStartDate);
        for (const predId of task.predecessors) {
          const predDates = taskDateMap.get(predId);
          if (predDates && predDates.end > latestEnd) {
            latestEnd = predDates.end;
          }
        }
        startDate = new Date(latestEnd);
        startDate.setDate(startDate.getDate() + 1); // Start day after predecessor ends
      } else {
        startDate = new Date(currentDate);
      }

      const duration = task.duration || 5; // Default 5 days if not specified
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + duration);

      // Store for predecessor calculations
      if (task.taskId) {
        taskDateMap.set(task.taskId, { start: startDate, end: endDate });
      }

      // Create the task
      await prisma.scheduleTask.create({
        data: {
          scheduleId,
          taskId: task.taskId || `T${imported + 1}`,
          name: task.name,
          description: task.description,
          startDate,
          endDate,
          duration,
          predecessors: task.predecessors || [],
          assignedTo: task.trade,
          location: task.location,
          wbsCode: task.wbsCode,
          percentComplete: task.percentComplete || 0,
          status: 'not_started',
          isCritical: false
        }
      });

      imported++;
      currentDate = endDate;
    } catch (error) {
      console.error(`[SCHEDULE_EXTRACTOR] Error importing task ${task.name}:`, error);
      errors.push(`Failed to import "${task.name}": ${error}`);
      skipped++;
    }
  }

  return { imported, skipped, errors };
}
