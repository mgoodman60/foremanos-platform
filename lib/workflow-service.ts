import { prisma } from './db';
// import { ProjectType, TradeType } from '@prisma/client';
type ProjectType = string;
type TradeType = string;

/**
 * Workflow Step Interface
 */
export interface WorkflowStepData {
  question: string;
  helpText?: string;
  order: number;
  stepType: 'text' | 'number' | 'select' | 'multiselect' | 'yes_no' | 'photo';
  options?: string[];
  isRequired?: boolean;
  conditionalOn?: string; // stepId
  conditionalValue?: string;
  checkSchedule?: boolean;
  scheduleContext?: string;
}

/**
 * Workflow Template Interface
 */
export interface WorkflowTemplateData {
  name: string;
  description?: string;
  projectType: ProjectType;
  tradeType: TradeType;
  steps: WorkflowStepData[];
}

/**
 * Get workflow template by ID
 */
export async function getWorkflowById(workflowId: string) {
  try {
    const template = await prisma.workflowTemplate.findUnique({
      where: {
        id: workflowId
      },
      include: {
        WorkflowStep: {
          orderBy: {
            order: 'asc'
          }
        }
      }
    });

    return template;
  } catch (error) {
    console.error('[WORKFLOW] Error fetching template:', error);
    return null;
  }
}

/**
 * Get workflow template for project and trade
 */
export async function getWorkflowTemplate(
  projectType: ProjectType,
  tradeType: TradeType
) {
  try {
    const template = await prisma.workflowTemplate.findFirst({
      where: {
        projectType: projectType as any,
        tradeType: tradeType as any,
        isActive: true
      },
      include: {
        WorkflowStep: {
          orderBy: {
            order: 'asc'
          }
        }
      }
    });

    return template;
  } catch (error) {
    console.error('[WORKFLOW] Error fetching template:', error);
    return null;
  }
}

/**
 * Get all active workflow templates for a project type
 */
export async function getAvailableWorkflows(projectType: ProjectType) {
  try {
    const templates = await prisma.workflowTemplate.findMany({
      where: {
        projectType: projectType as any,
        isActive: true
      },
      include: {
        WorkflowStep: {
          orderBy: {
            order: 'asc'
          },
          take: 3 // Just get first 3 steps for preview
        }
      },
      orderBy: {
        priority: 'desc'
      }
    });

    return templates;
  } catch (error) {
    console.error('[WORKFLOW] Error fetching workflows:', error);
    return [];
  }
}

/**
 * Create workflow template with steps
 */
export async function createWorkflowTemplate(data: WorkflowTemplateData) {
  try {
    const template = await prisma.workflowTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        projectType: data.projectType as any,
        tradeType: data.tradeType as any,
        WorkflowStep: {
          create: data.steps.map(step => ({
            question: step.question,
            helpText: step.helpText || undefined,
            order: step.order,
            stepType: step.stepType,
            options: step.options ? step.options : undefined,
            isRequired: step.isRequired || false,
            conditionalOn: step.conditionalOn || undefined,
            conditionalValue: step.conditionalValue || undefined,
            checkSchedule: step.checkSchedule || false,
            scheduleContext: step.scheduleContext || undefined
          }))
        }
      },
      include: {
        WorkflowStep: true
      }
    });

    console.log(`[WORKFLOW] Created template: ${template.name} (${template.id})`);
    return template;
  } catch (error) {
    console.error('[WORKFLOW] Error creating template:', error);
    throw error;
  }
}

/**
 * Save workflow response
 */
export async function saveWorkflowResponse(
  conversationId: string,
  workflowId: string,
  stepId: string,
  response: string,
  responseData?: any,
  timeToRespond?: number
) {
  try {
    const workflowResponse = await prisma.workflowResponse.create({
      data: {
        conversationId,
        workflowId,
        stepId,
        response,
        responseData: responseData || null,
        timeToRespond
      }
    });

    return workflowResponse;
  } catch (error) {
    console.error('[WORKFLOW] Error saving response:', error);
    return null;
  }
}

/**
 * Get workflow responses for a conversation
 */
export async function getWorkflowResponses(conversationId: string) {
  try {
    const responses = await prisma.workflowResponse.findMany({
      where: {
        conversationId
      },
      include: {
        WorkflowStep: true,
        WorkflowTemplate: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    return responses;
  } catch (error) {
    console.error('[WORKFLOW] Error fetching responses:', error);
    return [];
  }
}

/**
 * Update user reporting pattern
 */
export async function updateReportingPattern(
  userId: string,
  projectId: string,
  data: {
    preferredTradeType?: TradeType;
    reportingStyle?: string;
    commonKeywords?: string[];
    preferredQuestions?: string[];
    skippedQuestions?: string[];
  }
) {
  try {
    const pattern = await prisma.userReportingPattern.upsert({
      where: {
        userId_projectId: {
          userId,
          projectId
        }
      },
      create: {
        userId,
        projectId,
        preferredTradeType: data.preferredTradeType as any,
        reportingStyle: data.reportingStyle,
        commonKeywords: data.commonKeywords,
        preferredQuestions: data.preferredQuestions,
        skippedQuestions: data.skippedQuestions,
        reportsCompleted: 1,
        workflowsUsed: 1
      },
      update: {
        preferredTradeType: data.preferredTradeType as any,
        reportingStyle: data.reportingStyle,
        commonKeywords: data.commonKeywords,
        preferredQuestions: data.preferredQuestions,
        skippedQuestions: data.skippedQuestions,
        reportsCompleted: {
          increment: 1
        },
        workflowsUsed: {
          increment: 1
        },
        lastReportDate: new Date()
      }
    });

    return pattern;
  } catch (error) {
    console.error('[WORKFLOW] Error updating reporting pattern:', error);
    return null;
  }
}

/**
 * Get user reporting pattern
 */
export async function getReportingPattern(
  userId: string,
  projectId: string
) {
  try {
    const pattern = await prisma.userReportingPattern.findUnique({
      where: {
        userId_projectId: {
          userId,
          projectId
        }
      }
    });

    return pattern;
  } catch (error) {
    console.error('[WORKFLOW] Error fetching reporting pattern:', error);
    return null;
  }
}

/**
 * Determine next steps based on responses and conditional logic
 */
export function getNextSteps(
  allSteps: any[],
  completedResponses: any[]
): any[] {
  // Get IDs of completed steps
  const completedStepIds = new Set(completedResponses.map(r => r.stepId));
  
  // Get responses map for conditional logic
  const responsesMap = new Map(
    completedResponses.map(r => [r.stepId, r.response])
  );
  
  // Filter steps that should be shown next
  const nextSteps = allSteps.filter(step => {
    // Skip if already completed
    if (completedStepIds.has(step.id)) {
      return false;
    }
    
    // Check conditional logic
    if (step.conditionalOn && step.conditionalValue) {
      const conditionMet = responsesMap.get(step.conditionalOn) === step.conditionalValue;
      if (!conditionMet) {
        return false;
      }
    }
    
    return true;
  });
  
  // Return next 3-5 steps (hybrid approach)
  return nextSteps.slice(0, 5);
}

/**
 * Get next steps for a workflow based on current responses (object format)
 */
export async function getNextStepsForWorkflow(
  workflowId: string,
  currentResponses: Record<string, any>,
  scheduleContextData?: any
) {
  try {
    // Get workflow with all steps
    const workflow = await getWorkflowById(workflowId);
    if (!workflow) {
      return [];
    }

    // Convert responses object to array format for getNextSteps
    const completedResponses = Object.entries(currentResponses).map(([stepId, response]) => ({
      stepId,
      response
    }));

    // Get next steps using existing logic
    const nextSteps = getNextSteps(workflow.WorkflowStep, completedResponses);

    return nextSteps;
  } catch (error) {
    console.error('[WORKFLOW] Error getting next steps:', error);
    return [];
  }
}

/**
 * Analyze schedule context for a step
 */
export async function getScheduleContext(
  projectId: string,
  scheduleContext: string
): Promise<string | null> {
  try {
    // Look for schedule-related documents
    const schedules = await prisma.document.findMany({
      where: {
        projectId,
        OR: [
          { category: 'schedule' },
          { name: { contains: 'schedule', mode: 'insensitive' } }
        ]
      },
      take: 1
    });
    
    if (schedules.length === 0) {
      return null;
    }
    
    // Get chunks related to the schedule context
    const chunks = await prisma.documentChunk.findMany({
      where: {
        documentId: schedules[0].id,
        content: { contains: scheduleContext, mode: 'insensitive' }
      },
      take: 3
    });
    
    if (chunks.length === 0) {
      return null;
    }
    
    // Extract relevant information
    const context = chunks
      .map((chunk: any) => {
        // Try to parse metadata for structured data
        try {
          const metadata = chunk.metadata as any;
          if (metadata?.activities) {
            return `Scheduled: ${metadata.activities}`;
          }
        } catch (e) {
          // Fall back to content
        }
        return chunk.content.substring(0, 200);
      })
      .join('\n');
    
    return context;
  } catch (error) {
    console.error('[WORKFLOW] Error fetching schedule context:', error);
    return null;
  }
}

/**
 * Get trade name in user-friendly format
 */
export function getTradeDisplayName(tradeType: TradeType): string {
  const names: Record<TradeType, string> = {
    general_contractor: 'General Contractor / Superintendent',
    concrete_masonry: 'Concrete & Masonry',
    carpentry_framing: 'Carpentry & Framing',
    electrical: 'Electrical',
    plumbing: 'Plumbing',
    hvac_mechanical: 'HVAC & Mechanical',
    drywall_finishes: 'Drywall & Finishes',
    site_utilities: 'Site Utilities',
    structural_steel: 'Structural Steel',
    roofing: 'Roofing',
    glazing_windows: 'Glazing & Windows',
    painting_coating: 'Painting & Coating',
    flooring: 'Flooring'
  };
  
  return names[tradeType] || tradeType;
}
