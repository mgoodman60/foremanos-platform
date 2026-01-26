/**
 * Trade Inference System
 * Uses AI to infer which trade/subcontractor should perform schedule tasks
 * Integrates with subcontractor log when available
 */

import { prisma } from './db';
import { callAbacusLLM } from './abacus-llm';

// Valid trade types from schema
export const TRADE_TYPES = [
  'general_contractor',
  'concrete_masonry',
  'carpentry_framing',
  'electrical',
  'plumbing',
  'hvac_mechanical',
  'drywall_finishes',
  'site_utilities',
  'structural_steel',
  'roofing',
  'glazing_windows',
  'painting_coating',
  'flooring',
] as const;

export type TradeType = typeof TRADE_TYPES[number];

// Trade display names
export const TRADE_DISPLAY_NAMES: Record<string, string> = {
  general_contractor: 'General Contractor',
  concrete_masonry: 'Concrete & Masonry',
  carpentry_framing: 'Carpentry & Framing',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  hvac_mechanical: 'HVAC/Mechanical',
  drywall_finishes: 'Drywall & Finishes',
  site_utilities: 'Site Utilities',
  structural_steel: 'Structural Steel',
  roofing: 'Roofing',
  glazing_windows: 'Glazing & Windows',
  painting_coating: 'Painting & Coating',
  flooring: 'Flooring',
};

interface TradeInferenceResult {
  tradeType: string;
  confidence: number; // 0-100
  reasoning: string;
  subcontractorId?: string;
  subcontractorName?: string;
  needsClarification: boolean;
}

interface TaskWithInference {
  taskId: string;
  taskName: string;
  inference: TradeInferenceResult;
}

// Confidence threshold for requiring clarification
const LOW_CONFIDENCE_THRESHOLD = 70;

/**
 * Infer trades for all tasks in a schedule
 */
export async function inferTradesForSchedule(
  scheduleId: string,
  projectId: string
): Promise<{ updated: number; needsClarification: number; errors: string[] }> {
  console.log(`[TRADE-INFERENCE] Starting inference for schedule ${scheduleId}`);
  
  const errors: string[] = [];
  let updated = 0;
  let needsClarification = 0;

  try {
    // Get all tasks for the schedule
    const tasks = await prisma.scheduleTask.findMany({
      where: { scheduleId },
      select: {
        id: true,
        taskId: true,
        name: true,
        description: true,
        tradeType: true,
        subcontractorId: true,
        inferredTradeType: true,
      },
    });

    // Get subcontractors for the project
    const subcontractors = await prisma.subcontractor.findMany({
      where: { projectId, isActive: true },
      select: {
        id: true,
        companyName: true,
        tradeType: true,
      },
    });

    // Build subcontractor lookup by trade
    const subsByTrade = new Map<string, { id: string; name: string }[]>();
    for (const sub of subcontractors) {
      const existing = subsByTrade.get(sub.tradeType) || [];
      existing.push({ id: sub.id, name: sub.companyName });
      subsByTrade.set(sub.tradeType, existing);
    }

    // Process tasks in batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
      const batch = tasks.slice(i, i + BATCH_SIZE);
      
      // Prepare batch for AI inference
      const tasksNeedingInference = batch.filter(
        (t: any) => !t.subcontractorId && !t.inferredTradeType
      );

      if (tasksNeedingInference.length > 0) {
        try {
          const inferences = await inferTradesWithAI(
            tasksNeedingInference.map((t: any) => ({
              taskId: t.taskId,
              name: t.name,
              description: t.description || '',
            })),
            Array.from(subsByTrade.keys())
          );

          // Update tasks with inferences
          for (const inference of inferences) {
            const task = tasksNeedingInference.find((t: any) => t.taskId === inference.taskId);
            if (!task) continue;

            // Check if we have a subcontractor for this trade
            const matchingSubs = subsByTrade.get(inference.inference.tradeType) || [];
            const subcontractor = matchingSubs[0]; // Take first matching sub

            await prisma.scheduleTask.update({
              where: { id: task.id },
              data: {
                inferredTradeType: inference.inference.tradeType,
                tradeInferenceConfidence: inference.inference.confidence,
                tradeInferenceSource: 'ai',
                tradeNeedsClarification: inference.inference.needsClarification,
                tradeClarificationNote: inference.inference.needsClarification
                  ? inference.inference.reasoning
                  : null,
                subcontractorId: subcontractor?.id || null,
              },
            });

            updated++;
            if (inference.inference.needsClarification) {
              needsClarification++;
            }
          }
        } catch (batchError: any) {
          errors.push(`Batch ${i}-${i + BATCH_SIZE}: ${batchError.message}`);
        }
      }
    }

    // Create notification if there are tasks needing clarification
    if (needsClarification > 0) {
      await createTradeInferenceNotification(projectId, scheduleId, needsClarification);
    }

    console.log(`[TRADE-INFERENCE] Complete: ${updated} updated, ${needsClarification} need clarification`);
    return { updated, needsClarification, errors };

  } catch (error: any) {
    console.error('[TRADE-INFERENCE] Error:', error.message);
    errors.push(error.message);
    return { updated, needsClarification, errors };
  }
}

/**
 * Use AI to infer trades for a batch of tasks
 */
async function inferTradesWithAI(
  tasks: { taskId: string; name: string; description: string }[],
  availableTrades: string[]
): Promise<TaskWithInference[]> {
  const prompt = buildTradeInferencePrompt(tasks, availableTrades);

  const messages = [
    {
      role: 'system' as const,
      content: `You are an expert construction scheduler who assigns trades to schedule tasks.
Your job is to determine which construction trade should perform each task.
Be precise and consistent. Use the exact trade type names provided.
Return ONLY valid JSON array, no other text.`,
    },
    {
      role: 'user' as const,
      content: prompt,
    },
  ];

  const response = await callAbacusLLM(messages, {
    model: 'claude-sonnet-4-20250514',
    temperature: 0.1,
    max_tokens: 2000,
  });

  return parseTradeInferenceResponse(response.content, tasks);
}

/**
 * Build the prompt for trade inference
 */
function buildTradeInferencePrompt(
  tasks: { taskId: string; name: string; description: string }[],
  availableTrades: string[]
): string {
  const tradeList = availableTrades.length > 0
    ? availableTrades.map(t => `- ${t}: ${TRADE_DISPLAY_NAMES[t] || t}`).join('\n')
    : TRADE_TYPES.map(t => `- ${t}: ${TRADE_DISPLAY_NAMES[t]}`).join('\n');

  return `## Trade Assignment for Schedule Tasks

### Available Trades:
${tradeList}

### Tasks to Assign:
${tasks.map((t, i) => `${i + 1}. Task ID: "${t.taskId}"
   Name: "${t.name}"
   Description: "${t.description || 'N/A'}"`).join('\n\n')}

### Instructions:
1. Analyze each task name and description
2. Determine which trade should perform the work
3. Assign a confidence score (0-100):
   - 90-100: Clear match (e.g., "Install electrical panel" → electrical)
   - 70-89: Likely match but some ambiguity
   - Below 70: Unclear, needs clarification
4. Provide brief reasoning

### Return Format (JSON Array):
[
  {
    "taskId": "A1000",
    "tradeType": "electrical",
    "confidence": 95,
    "reasoning": "Task explicitly mentions electrical panel installation"
  }
]

Return ONLY the JSON array.`;
}

/**
 * Parse the AI response into structured inference results
 */
function parseTradeInferenceResponse(
  response: string,
  tasks: { taskId: string; name: string; description: string }[]
): TaskWithInference[] {
  const results: TaskWithInference[] = [];

  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('[TRADE-INFERENCE] No JSON array found in response');
      return tasks.map(t => ({
        taskId: t.taskId,
        taskName: t.name,
        inference: {
          tradeType: 'general_contractor',
          confidence: 50,
          reasoning: 'Unable to parse AI response',
          needsClarification: true,
        },
      }));
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    for (const item of parsed) {
      const task = tasks.find(t => t.taskId === item.taskId);
      if (!task) continue;

      const confidence = Math.min(100, Math.max(0, item.confidence || 50));
      const tradeType = normalizeTradeType(item.tradeType);

      results.push({
        taskId: item.taskId,
        taskName: task.name,
        inference: {
          tradeType,
          confidence,
          reasoning: item.reasoning || '',
          needsClarification: confidence < LOW_CONFIDENCE_THRESHOLD,
        },
      });
    }

    // Add any tasks that weren't in the response
    for (const task of tasks) {
      if (!results.find(r => r.taskId === task.taskId)) {
        results.push({
          taskId: task.taskId,
          taskName: task.name,
          inference: {
            tradeType: 'general_contractor',
            confidence: 40,
            reasoning: 'Task not analyzed by AI',
            needsClarification: true,
          },
        });
      }
    }

    return results;
  } catch (error: any) {
    console.error('[TRADE-INFERENCE] Parse error:', error.message);
    return tasks.map(t => ({
      taskId: t.taskId,
      taskName: t.name,
      inference: {
        tradeType: 'general_contractor',
        confidence: 40,
        reasoning: 'Parse error: ' + error.message,
        needsClarification: true,
      },
    }));
  }
}

/**
 * Normalize trade type string to valid enum value
 */
function normalizeTradeType(trade: string): string {
  if (!trade) return 'general_contractor';
  
  const normalized = trade.toLowerCase().trim().replace(/[\s-]+/g, '_');
  
  // Direct match
  if (TRADE_TYPES.includes(normalized as TradeType)) {
    return normalized;
  }

  // Common variations
  const mappings: Record<string, string> = {
    'gc': 'general_contractor',
    'general': 'general_contractor',
    'concrete': 'concrete_masonry',
    'masonry': 'concrete_masonry',
    'framing': 'carpentry_framing',
    'carpentry': 'carpentry_framing',
    'electric': 'electrical',
    'elec': 'electrical',
    'plumb': 'plumbing',
    'hvac': 'hvac_mechanical',
    'mechanical': 'hvac_mechanical',
    'mech': 'hvac_mechanical',
    'drywall': 'drywall_finishes',
    'finishes': 'drywall_finishes',
    'finish': 'drywall_finishes',
    'site': 'site_utilities',
    'utilities': 'site_utilities',
    'sitework': 'site_utilities',
    'steel': 'structural_steel',
    'structural': 'structural_steel',
    'roof': 'roofing',
    'glazing': 'glazing_windows',
    'windows': 'glazing_windows',
    'doors': 'glazing_windows',
    'paint': 'painting_coating',
    'painting': 'painting_coating',
    'floor': 'flooring',
    'floors': 'flooring',
    'tile': 'flooring',
    'carpet': 'flooring',
  };

  return mappings[normalized] || 'general_contractor';
}

/**
 * Create a notification for tasks needing trade clarification
 */
async function createTradeInferenceNotification(
  projectId: string,
  scheduleId: string,
  count: number
): Promise<void> {
  try {
    // Get project owner
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true, name: true },
    });

    if (!project) return;

    // Create notification
    await prisma.notification.create({
      data: {
        userId: project.ownerId,
        type: 'trade_clarification_needed',
        subject: 'Trade Assignment Review Needed',
        body: `${count} schedule task${count > 1 ? 's' : ''} in "${project.name}" need trade assignment clarification. Please review on the Schedule page.`,
      },
    });

    console.log(`[TRADE-INFERENCE] Created notification for ${count} tasks needing clarification`);
  } catch (error: any) {
    console.error('[TRADE-INFERENCE] Failed to create notification:', error.message);
  }
}

/**
 * Manually set trade for a task (overrides AI inference)
 */
export async function setTaskTrade(
  taskId: string,
  tradeType: string,
  subcontractorId?: string
): Promise<void> {
  await prisma.scheduleTask.update({
    where: { id: taskId },
    data: {
      inferredTradeType: tradeType,
      tradeInferenceConfidence: 100,
      tradeInferenceSource: 'manual',
      tradeNeedsClarification: false,
      tradeClarificationNote: null,
      subcontractorId: subcontractorId || null,
    },
  });
}

/**
 * Get tasks needing trade clarification for a project
 */
export async function getTasksNeedingClarification(
  projectId: string
): Promise<{
  id: string;
  taskId: string;
  name: string;
  inferredTradeType: string | null;
  tradeInferenceConfidence: number | null;
  tradeClarificationNote: string | null;
}[]> {
  const schedules = await prisma.schedule.findMany({
    where: { projectId },
    select: { id: true },
  });

  const scheduleIds = schedules.map((s: any) => s.id);

  return prisma.scheduleTask.findMany({
    where: {
      scheduleId: { in: scheduleIds },
      tradeNeedsClarification: true,
    },
    select: {
      id: true,
      taskId: true,
      name: true,
      inferredTradeType: true,
      tradeInferenceConfidence: true,
      tradeClarificationNote: true,
    },
    orderBy: { tradeInferenceConfidence: 'asc' },
  });
}

/**
 * Get trade display info for a task
 */
export function getTaskTradeDisplay(task: {
  subcontractorId?: string | null;
  inferredTradeType?: string | null;
  tradeType?: string | null;
  tradeInferenceConfidence?: number | null;
  Subcontractor?: { companyName: string; tradeType: string } | null;
}): { displayName: string; source: 'subcontractor' | 'inferred' | 'manual' | 'unknown'; confidence: number | null } {
  // If assigned to a subcontractor, show their name
  if (task.Subcontractor) {
    return {
      displayName: task.Subcontractor.companyName,
      source: 'subcontractor',
      confidence: 100,
    };
  }

  // If we have an inferred trade type
  if (task.inferredTradeType) {
    return {
      displayName: TRADE_DISPLAY_NAMES[task.inferredTradeType] || task.inferredTradeType,
      source: 'inferred',
      confidence: task.tradeInferenceConfidence || null,
    };
  }

  // If we have a manually set trade type
  if (task.tradeType) {
    return {
      displayName: TRADE_DISPLAY_NAMES[task.tradeType] || task.tradeType,
      source: 'manual',
      confidence: 100,
    };
  }

  return {
    displayName: 'Unassigned',
    source: 'unknown',
    confidence: null,
  };
}
