import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { analyzeScheduleForImprovements } from '@/lib/schedule-improvement-analyzer';
import { callAbacusLLM } from '@/lib/abacus-llm';
import { EXTRACTION_MODEL } from '@/lib/model-config';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SCHEDULE_COACH');

export const maxDuration = 120;

interface WhatIfScenario {
  scenarioName: string;
  delayDays: number;
  affectedTasks: string[];
  newEndDate: string;
  impactSummary: string;
  mitigationOptions: string[];
}

interface TradeBreakdown {
  trade: string;
  taskCount: number;
  totalDays: number;
  criticalTasks: number;
  suggestedTasks: ProposedTask[];
}

interface ProposedTask {
  name: string;
  trade: string;
  duration: number;
  predecessors: string[];
  description: string;
  location?: string;
}

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();
    const { scheduleId, action, scenarioParams } = body;

    const project = await prisma.project.findFirst({ where: { slug } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Generate schedule from project documents
    if (action === 'generate-from-documents') {
      const result = await generateScheduleFromDocuments(project.id, project.name);
      return NextResponse.json({ success: true, analysis: result });
    }

    // Analyze existing schedule with AI
    if (action === 'analyze' && scheduleId) {
      const result = await analyzeScheduleWithAI(scheduleId, project.id);
      return NextResponse.json({ success: true, analysis: result });
    }

    // What-If scenario modeling
    if (action === 'what-if' && scheduleId && scenarioParams) {
      const result = await runWhatIfScenario(scheduleId, scenarioParams);
      return NextResponse.json({ success: true, scenario: result });
    }

    // Get critical path analysis
    if (action === 'critical-path' && scheduleId) {
      const result = await getCriticalPathAnalysis(scheduleId);
      return NextResponse.json({ success: true, criticalPath: result });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    logger.error('Error', error);
    return NextResponse.json({ error: 'Failed to process' }, { status: 500 });
  }
}

async function analyzeScheduleWithAI(scheduleId: string, projectId: string) {
  // Get base analysis
  const baseAnalysis = await analyzeScheduleForImprovements(scheduleId);

  // Get schedule tasks for deeper analysis
  const tasks = await prisma.scheduleTask.findMany({
    where: { scheduleId },
    orderBy: { startDate: 'asc' }
  });

  // Get project documents for context
  const documents = await prisma.document.findMany({
    where: { projectId, deletedAt: null },
    select: { name: true, category: true }
  });

  // Generate AI insights with LLM
  const aiInsights = await generateAIInsights(tasks, baseAnalysis, documents);

  // Calculate critical path metrics
  const criticalTasks = tasks.filter(t => t.isCritical);
  const criticalPathDays = criticalTasks.reduce((sum, t) => sum + (t.duration || 0), 0);
  const nearCriticalTasks = tasks.filter(t => !t.isCritical && (t.totalFloat || 0) <= 5);

  // Group by trade for breakdown analysis
  const tradeBreakdowns = analyzeTradeBreakdowns(tasks);

  // Identify milestone breakdown opportunities
  const milestoneBreakdowns = identifyMilestoneBreakdowns(tasks);

  return {
    overallHealth: baseAnalysis.overallHealth,
    healthScore: baseAnalysis.healthScore,
    summary: baseAnalysis.summary,
    improvements: baseAnalysis.recommendations.slice(0, 15).map((rec, idx) => ({
      ...rec,
      reasoning: aiInsights.improvementReasons[idx] || rec.description,
      proposedTasks: generateProposedTasks(rec)
    })),
    milestoneBreakdowns,
    aiThoughts: aiInsights.thoughts,
    criticalPath: {
      length: criticalPathDays,
      taskCount: criticalTasks.length,
      nearCriticalCount: nearCriticalTasks.length
    },
    tradeBreakdowns
  };
}

async function generateAIInsights(tasks: any[], baseAnalysis: any, documents: any[]) {
  const tasksSummary = tasks.slice(0, 50).map(t => ({
    name: t.name,
    duration: t.duration,
    trade: t.assignedTo,
    isCritical: t.isCritical,
    status: t.status,
    percentComplete: t.percentComplete
  }));

  const prompt = `As a construction scheduling expert, analyze this schedule and provide insights:

SCHEDULE SUMMARY:
- Total Tasks: ${tasks.length}
- Critical Path Tasks: ${tasks.filter(t => t.isCritical).length}
- Health Score: ${baseAnalysis.healthScore}/100
- Status: ${baseAnalysis.overallHealth}

TOP TASKS (first 50):
${JSON.stringify(tasksSummary, null, 2)}

PROJECT DOCUMENTS:
${documents.map(d => `- ${d.name} (${d.category || 'Uncategorized'})`).join('\n')}

EXISTING ISSUES:
${baseAnalysis.recommendations.slice(0, 5).map((r: any) => `- ${r.title}: ${r.description}`).join('\n')}

Provide:
1. 5 specific insights about the schedule quality and risks
2. For each of the top 5 issues, provide a detailed reasoning explaining WHY it matters

Return JSON format:
{
  "thoughts": ["insight1", "insight2", ...],
  "improvementReasons": ["reason1", "reason2", ...]
}`;

  try {
    const response = await callAbacusLLM([{ role: 'user', content: prompt }], {
      model: 'gpt-4o-mini',
      max_tokens: 1500,
      temperature: 0.4
    });

    if (response?.content) {
      const cleanContent = response.content.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleanContent);
    }
  } catch (error) {
    logger.error('AI insights error', error);
  }

  return {
    thoughts: [
      `Analyzed ${tasks.length} tasks with ${baseAnalysis.recommendations.length} recommendations`,
      `Critical path has ${tasks.filter(t => t.isCritical).length} tasks`,
      `Schedule health score: ${baseAnalysis.healthScore}/100`
    ],
    improvementReasons: baseAnalysis.recommendations.map((r: any) => r.description)
  };
}

function analyzeTradeBreakdowns(tasks: any[]): TradeBreakdown[] {
  const tradeMap: Record<string, { tasks: any[]; criticalCount: number; totalDays: number }> = {};

  tasks.forEach(task => {
    const trade = task.assignedTo || 'Unassigned';
    if (!tradeMap[trade]) {
      tradeMap[trade] = { tasks: [], criticalCount: 0, totalDays: 0 };
    }
    tradeMap[trade].tasks.push(task);
    tradeMap[trade].totalDays += task.duration || 0;
    if (task.isCritical) tradeMap[trade].criticalCount++;
  });

  return Object.entries(tradeMap).map(([trade, data]) => ({
    trade,
    taskCount: data.tasks.length,
    totalDays: data.totalDays,
    criticalTasks: data.criticalCount,
    suggestedTasks: []
  })).sort((a, b) => b.totalDays - a.totalDays);
}

function identifyMilestoneBreakdowns(tasks: any[]) {
  // Group tasks by WBS or phase
  const phases: Record<string, any[]> = {};
  tasks.forEach(task => {
    const phase = task.wbsCode?.split('.')[0] || task.name.split(' ')[0] || 'General';
    if (!phases[phase]) phases[phase] = [];
    phases[phase].push(task);
  });

  const breakdowns = [];
  for (const [phase, phaseTasks] of Object.entries(phases)) {
    if (phaseTasks.length < 3) continue;

    const trades = new Set(phaseTasks.map(t => t.assignedTo).filter(Boolean));
    
    breakdowns.push({
      milestoneId: phase,
      milestoneName: `${phase} Phase`,
      currentTasks: phaseTasks.length,
      proposedTasks: generatePhaseProposedTasks(phase, phaseTasks),
      tradesInvolved: Array.from(trades),
      reasoning: `Phase "${phase}" has ${phaseTasks.length} tasks across ${trades.size} trades. Consider breaking down into more granular activities for better tracking.`
    });
  }

  return breakdowns.slice(0, 5);
}

function generatePhaseProposedTasks(phase: string, _existingTasks: any[]): ProposedTask[] {
  // Generate suggested tasks based on phase type
  const proposals: ProposedTask[] = [];

  if (phase.toLowerCase().includes('found') || phase === '03') {
    proposals.push(
      { name: 'Layout & Survey', trade: 'Surveyor', duration: 1, predecessors: [], description: 'Verify foundation layout marks', location: 'Foundation' },
      { name: 'Rebar Inspection', trade: 'QC Inspector', duration: 1, predecessors: [], description: 'Pre-pour rebar inspection', location: 'Foundation' }
    );
  }

  if (phase.toLowerCase().includes('frame') || phase === '06') {
    proposals.push(
      { name: 'Pre-frame Walkthrough', trade: 'Superintendent', duration: 0.5, predecessors: [], description: 'Verify slab conditions before framing', location: 'Building' },
      { name: 'Frame QC Inspection', trade: 'QC Inspector', duration: 1, predecessors: [], description: 'Pre-close inspection of framing', location: 'Building' }
    );
  }

  if (phase.toLowerCase().includes('finish') || phase === '09') {
    proposals.push(
      { name: 'Pre-paint Punch', trade: 'Superintendent', duration: 1, predecessors: [], description: 'Identify drywall repairs before paint', location: 'Interior' },
      { name: 'Final Clean - Phase 1', trade: 'Cleaning', duration: 2, predecessors: [], description: 'Initial construction clean before finishes', location: 'Interior' }
    );
  }

  return proposals;
}

function generateProposedTasks(_recommendation: any): ProposedTask[] {
  // Deprecated - keeping for compatibility
  return [];
}

async function generateScheduleFromDocuments(projectId: string, projectName: string) {
  // Get project documents
  const _documents = await prisma.document.findMany({
    where: { projectId, deletedAt: null },
    select: { id: true, name: true, category: true }
  });

  // Get document chunks for context
  const chunks = await prisma.documentChunk.findMany({
    where: {
      Document: { projectId, deletedAt: null }
    },
    select: { content: true },
    take: 100
  });

  const documentContext = chunks.map(c => c.content).join('\n\n').slice(0, 8000);

  // Generate schedule from documents using AI
  const prompt = `As a construction scheduling expert, analyze these project documents and generate a comprehensive construction schedule.

PROJECT: ${projectName}

DOCUMENT CONTEXT:
${documentContext}

Based on the project scope visible in the documents, generate a complete construction schedule with:
1. Major phases (Site Work, Foundation, Structure, MEP Rough, Finishes, etc.)
2. Specific tasks within each phase
3. Estimated durations based on typical construction productivity
4. Trade assignments
5. Logical dependencies

Return JSON format:
{
  "phases": [
    {
      "name": "Phase Name",
      "startDay": 1,
      "tasks": [
        {
          "name": "Task Name",
          "trade": "Trade/Subcontractor",
          "duration": 5,
          "predecessors": [],
          "description": "Brief task description",
          "location": "Area of work"
        }
      ]
    }
  ],
  "summary": "Brief summary of generated schedule",
  "totalDuration": 180,
  "keyMilestones": ["Milestone 1", "Milestone 2"]
}`;

  try {
    const response = await callAbacusLLM([{ role: 'user', content: prompt }], {
      model: EXTRACTION_MODEL,
      max_tokens: 4000,
      temperature: 0.5
    });

    if (response?.content) {
      const cleanContent = response.content.replace(/```json\n?|\n?```/g, '').trim();
      const scheduleData = JSON.parse(cleanContent);

      // Convert to our format
      const milestoneBreakdowns = scheduleData.phases.map((phase: any, idx: number) => ({
        milestoneId: `phase-${idx}`,
        milestoneName: phase.name,
        currentTasks: 0,
        proposedTasks: phase.tasks || [],
        tradesInvolved: [...new Set(phase.tasks?.map((t: any) => t.trade) || [])],
        reasoning: `Generated from project documents. ${phase.tasks?.length || 0} tasks identified.`
      }));

      return {
        overallHealth: 'good',
        healthScore: 85,
        summary: scheduleData.summary || `Generated ${scheduleData.phases?.length || 0} phases from project documents`,
        improvements: [],
        milestoneBreakdowns,
        aiThoughts: [
          '📄 Analyzed project documents for scope',
          `🏗️ Identified ${scheduleData.phases?.length || 0} major construction phases`,
          `📋 Generated ${milestoneBreakdowns.reduce((sum: number, p: any) => sum + (p.proposedTasks?.length || 0), 0)} tasks`,
          `⏱️ Estimated total duration: ${scheduleData.totalDuration || 'TBD'} days`,
          `🎯 Key milestones: ${scheduleData.keyMilestones?.join(', ') || 'See phases'}`
        ],
        generatedSchedule: scheduleData
      };
    }
  } catch (error) {
    logger.error('Generation error', error);
  }

  return {
    overallHealth: 'fair',
    healthScore: 50,
    summary: 'Unable to generate schedule from documents. Please ensure project documents are uploaded.',
    improvements: [],
    milestoneBreakdowns: [],
    aiThoughts: ['⚠️ Could not extract sufficient scope from documents', 'Please upload schedule or specification documents']
  };
}

async function runWhatIfScenario(scheduleId: string, params: { taskId?: string; delayDays: number; delayReason: string }): Promise<WhatIfScenario> {
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId }
  });

  const tasks = await prisma.scheduleTask.findMany({
    where: { scheduleId },
    orderBy: { startDate: 'asc' }
  });

  const targetTask = params.taskId 
    ? tasks.find(t => t.id === params.taskId || t.taskId === params.taskId)
    : tasks.find(t => t.isCritical);

  if (!targetTask) {
    return {
      scenarioName: 'Unknown Task Delay',
      delayDays: params.delayDays,
      affectedTasks: [],
      newEndDate: schedule?.endDate?.toISOString() || '',
      impactSummary: 'Could not find target task',
      mitigationOptions: []
    };
  }

  // Find all successor tasks
  const affectedTasks = findSuccessorChain(tasks, targetTask.taskId);
  
  // Calculate new end date
  const originalEnd = new Date(schedule?.endDate || new Date());
  const newEnd = new Date(originalEnd);
  if (targetTask.isCritical) {
    newEnd.setDate(newEnd.getDate() + params.delayDays);
  }

  // Generate mitigation options
  const mitigationOptions = generateMitigationOptions(targetTask, params.delayDays, tasks);

  return {
    scenarioName: `${params.delayDays}-Day Delay: ${targetTask.name}`,
    delayDays: params.delayDays,
    affectedTasks: affectedTasks.map(t => t.name),
    newEndDate: newEnd.toISOString(),
    impactSummary: targetTask.isCritical 
      ? `Critical path delay of ${params.delayDays} days will push project completion to ${newEnd.toLocaleDateString()}. ${affectedTasks.length} downstream tasks affected.`
      : `Non-critical delay with ${targetTask.totalFloat || 0} days of float. May be absorbed without project delay.`,
    mitigationOptions
  };
}

function findSuccessorChain(tasks: any[], taskId: string): any[] {
  const successors: any[] = [];
  const visited = new Set<string>();

  function traverse(id: string) {
    if (visited.has(id)) return;
    visited.add(id);

    tasks.forEach(task => {
      if (task.predecessors?.includes(id)) {
        successors.push(task);
        traverse(task.taskId);
      }
    });
  }

  traverse(taskId);
  return successors;
}

function generateMitigationOptions(task: any, delayDays: number, _allTasks: any[]): string[] {
  const options: string[] = [];

  if (delayDays <= 3) {
    options.push('Add overtime to affected activities');
    options.push('Work weekends to recover schedule');
  }

  if (delayDays <= 7) {
    options.push('Add second shift for critical activities');
    options.push('Fast-track procurement of long-lead items');
  }

  if (delayDays > 7) {
    options.push('Consider crashing critical path activities');
    options.push('Re-sequence activities to create parallel work');
    options.push('Add additional crews or subcontractors');
  }

  // Trade-specific options
  const trade = task.assignedTo?.toLowerCase() || '';
  if (trade.includes('concrete')) {
    options.push('Consider accelerated concrete mix for faster cure times');
  }
  if (trade.includes('steel') || trade.includes('metal')) {
    options.push('Expedite steel fabrication with overnight shipping');
  }

  return options;
}

async function getCriticalPathAnalysis(scheduleId: string) {
  const tasks = await prisma.scheduleTask.findMany({
    where: { scheduleId },
    orderBy: { startDate: 'asc' }
  });

  const criticalTasks = tasks.filter(t => t.isCritical);
  const nearCriticalTasks = tasks.filter(t => !t.isCritical && (t.totalFloat || 0) <= 5);

  const totalDuration = criticalTasks.reduce((sum, t) => sum + (t.duration || 0), 0);

  // Group critical tasks by trade
  const criticalByTrade: Record<string, number> = {};
  criticalTasks.forEach(t => {
    const trade = t.assignedTo || 'Unassigned';
    criticalByTrade[trade] = (criticalByTrade[trade] || 0) + 1;
  });

  return {
    totalDuration,
    taskCount: criticalTasks.length,
    nearCriticalCount: nearCriticalTasks.length,
    tasks: criticalTasks.map(t => ({
      id: t.id,
      name: t.name,
      duration: t.duration,
      trade: t.assignedTo,
      startDate: t.startDate,
      endDate: t.endDate
    })),
    nearCriticalTasks: nearCriticalTasks.slice(0, 10).map(t => ({
      id: t.id,
      name: t.name,
      float: t.totalFloat
    })),
    tradeBreakdown: Object.entries(criticalByTrade).map(([trade, count]) => ({ trade, count }))
  };
}

export async function PUT(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();
    const { scheduleId, improvements } = body;

    if (!scheduleId || !improvements || !Array.isArray(improvements)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({ where: { slug } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let tasksCreated = 0;
    let appliedCount = 0;

    // Process each improvement
    for (const improvement of improvements) {
      if (improvement.proposedTasks && Array.isArray(improvement.proposedTasks)) {
        for (const task of improvement.proposedTasks) {
          try {
            // Create task in database
            await prisma.scheduleTask.create({
              data: {
                scheduleId,
                taskId: `AI-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                name: task.name,
                description: task.description || '',
                assignedTo: task.trade || null,
                duration: task.duration || 1,
                startDate: new Date(),
                endDate: new Date(Date.now() + (task.duration || 1) * 24 * 60 * 60 * 1000),
                status: 'not_started',
                percentComplete: 0,
                isCritical: false,
                predecessors: task.predecessors || [],
                successors: [],
                location: task.location || null,
                wbsCode: null
              }
            });
            tasksCreated++;
          } catch (err) {
            logger.error('Failed to create task', err);
          }
        }
      }
      appliedCount++;
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'schedule_ai_improvements',
        resource: 'Schedule',
        resourceId: scheduleId,
        details: {
          projectId: project.id,
          appliedCount,
          tasksCreated,
          message: `Applied ${appliedCount} AI schedule improvements, created ${tasksCreated} tasks`
        },
        userId: (session.user as any).id || null
      }
    });

    return NextResponse.json({
      success: true,
      appliedCount,
      tasksCreated,
      message: `Applied ${appliedCount} improvements, created ${tasksCreated} tasks`
    });
  } catch (error) {
    logger.error('PUT Error', error);
    return NextResponse.json({ error: 'Failed to apply improvements' }, { status: 500 });
  }
}
