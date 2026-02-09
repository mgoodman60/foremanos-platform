/**
 * Schedule Improvement Analyzer
 * 
 * AI-powered analysis to provide schedule optimization recommendations,
 * identify risks, suggest resource leveling, and improve sequencing.
 */

import { prisma } from './db';
import { callAbacusLLM } from './abacus-llm';
import { logger } from '@/lib/logger';

export interface ScheduleImprovementRecommendation {
  id: string;
  category: 'sequencing' | 'resource' | 'duration' | 'dependency' | 'risk' | 'cost' | 'weather';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  affectedTasks: string[];
  suggestedAction: string;
  estimatedSavings?: {
    days?: number;
    cost?: number;
  };
}

export interface ScheduleAnalysisResult {
  scheduleId: string;
  projectName: string;
  analyzedAt: Date;
  overallHealth: 'good' | 'fair' | 'poor';
  healthScore: number; // 0-100
  summary: string;
  recommendations: ScheduleImprovementRecommendation[];
  metrics: {
    totalTasks: number;
    criticalPathLength: number;
    floatUtilization: number;
    resourceConflicts: number;
    sequencingIssues: number;
    weatherRiskDays: number;
  };
}

// CSI Division codes for proper WBS alignment
export const CSI_DIVISIONS = {
  '01': { name: 'General Requirements', trades: ['General Contractor', 'Project Management'] },
  '02': { name: 'Existing Conditions', trades: ['Demolition', 'Site Assessment'] },
  '03': { name: 'Concrete', trades: ['Concrete', 'Rebar', 'Formwork'] },
  '04': { name: 'Masonry', trades: ['Masonry', 'Stone'] },
  '05': { name: 'Metals', trades: ['Structural Steel', 'Misc Metals', 'Ornamental'] },
  '06': { name: 'Wood, Plastics, Composites', trades: ['Carpentry', 'Millwork', 'Casework'] },
  '07': { name: 'Thermal & Moisture Protection', trades: ['Roofing', 'Waterproofing', 'Insulation', 'Fireproofing'] },
  '08': { name: 'Openings', trades: ['Glazing', 'Doors', 'Windows', 'Hardware'] },
  '09': { name: 'Finishes', trades: ['Drywall', 'Painting', 'Flooring', 'Tile', 'Acoustical Ceilings'] },
  '10': { name: 'Specialties', trades: ['Signage', 'Lockers', 'Toilet Partitions'] },
  '11': { name: 'Equipment', trades: ['Food Service', 'Medical Equipment'] },
  '12': { name: 'Furnishings', trades: ['Furniture', 'Window Treatments'] },
  '13': { name: 'Special Construction', trades: ['Clean Rooms', 'Pools'] },
  '14': { name: 'Conveying Equipment', trades: ['Elevators', 'Escalators'] },
  '21': { name: 'Fire Suppression', trades: ['Fire Protection', 'Sprinkler'] },
  '22': { name: 'Plumbing', trades: ['Plumbing', 'Piping'] },
  '23': { name: 'HVAC', trades: ['HVAC', 'Mechanical', 'Controls'] },
  '26': { name: 'Electrical', trades: ['Electrical', 'Lighting'] },
  '27': { name: 'Communications', trades: ['Low Voltage', 'Data', 'Telecom'] },
  '28': { name: 'Electronic Safety & Security', trades: ['Security', 'Fire Alarm', 'Access Control'] },
  '31': { name: 'Earthwork', trades: ['Sitework', 'Excavation', 'Grading'] },
  '32': { name: 'Exterior Improvements', trades: ['Paving', 'Landscaping', 'Fencing'] },
  '33': { name: 'Utilities', trades: ['Underground Utilities', 'Storm', 'Sanitary', 'Water'] }
};

/**
 * Analyze a schedule and provide improvement recommendations
 */
export async function analyzeScheduleForImprovements(
  scheduleId: string
): Promise<ScheduleAnalysisResult> {
  logger.info('SCHEDULE_IMPROVEMENT', 'Starting analysis for schedule', { scheduleId });

  // Get schedule and tasks
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: {
      Project: true
    }
  });

  if (!schedule) {
    throw new Error('Schedule not found');
  }

  const tasks = await prisma.scheduleTask.findMany({
    where: { scheduleId },
    orderBy: { startDate: 'asc' }
  });

  // Get project subcontractors
  const subcontractors = await prisma.subcontractor.findMany({
    where: { projectId: schedule.projectId }
  });

  // Get budget items for cost analysis through ProjectBudget
  const projectBudget = await prisma.projectBudget.findUnique({
    where: { projectId: schedule.projectId },
    include: { BudgetItem: true }
  });
  const budgetItems = projectBudget?.BudgetItem || [];

  // Perform various analyses
  const sequencingIssues = analyzeSequencing(tasks);
  const resourceConflicts = analyzeResourceConflicts(tasks, subcontractors);
  const durationIssues = analyzeDurations(tasks, budgetItems);
  const dependencyIssues = analyzeDependencies(tasks);
  const riskFactors = analyzeRiskFactors(tasks, schedule);
  const weatherRisks = analyzeWeatherRisks(tasks);

  // Combine all issues
  const allRecommendations: ScheduleImprovementRecommendation[] = [
    ...sequencingIssues,
    ...resourceConflicts,
    ...durationIssues,
    ...dependencyIssues,
    ...riskFactors,
    ...weatherRisks
  ];

  // Sort by priority
  allRecommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // Calculate metrics
  const criticalTasks = tasks.filter(t => t.isCritical);
  const criticalPathLength = criticalTasks.reduce((sum, t) => sum + (t.duration || 0), 0);

  // Calculate health score
  const healthScore = calculateHealthScore(allRecommendations, tasks.length);
  const overallHealth = healthScore >= 80 ? 'good' : healthScore >= 60 ? 'fair' : 'poor';

  // Generate AI summary if we have recommendations
  let summary = `Schedule analysis complete. Found ${allRecommendations.length} recommendations.`;
  if (allRecommendations.length > 0) {
    summary = await generateAISummary(schedule.Project?.name || 'Project', tasks, allRecommendations);
  }

  return {
    scheduleId,
    projectName: schedule.Project?.name || 'Unknown Project',
    analyzedAt: new Date(),
    overallHealth,
    healthScore,
    summary,
    recommendations: allRecommendations.slice(0, 20), // Top 20 recommendations
    metrics: {
      totalTasks: tasks.length,
      criticalPathLength,
      floatUtilization: calculateFloatUtilization(tasks),
      resourceConflicts: resourceConflicts.length,
      sequencingIssues: sequencingIssues.length,
      weatherRiskDays: weatherRisks.reduce((sum, r) => sum + (r.estimatedSavings?.days || 0), 0)
    }
  };
}

/**
 * Analyze task sequencing for optimization opportunities
 */
function analyzeSequencing(tasks: any[]): ScheduleImprovementRecommendation[] {
  const recommendations: ScheduleImprovementRecommendation[] = [];
  let idCounter = 1;

  // Check for tasks that could run in parallel
  const tasksByPhase = groupTasksByPhase(tasks);
  for (const [phase, phaseTasks] of Object.entries(tasksByPhase)) {
    const sequentialTasks = phaseTasks.filter((t: any, i: number) => {
      if (i === 0) return false;
      const prevTask = phaseTasks[i - 1];
      // Check if tasks are strictly sequential but could overlap
      return t.predecessors?.includes(prevTask.taskId) && 
             !tasksConflict(t, prevTask);
    });

    if (sequentialTasks.length >= 3) {
      recommendations.push({
        id: `SEQ-${idCounter++}`,
        category: 'sequencing',
        priority: 'medium',
        title: `Parallel opportunity in ${phase}`,
        description: `${sequentialTasks.length} tasks in ${phase} are scheduled sequentially but may be able to overlap.`,
        impact: 'Could reduce phase duration by 15-25%',
        affectedTasks: sequentialTasks.map((t: any) => t.name),
        suggestedAction: 'Review task dependencies and consider overlapping activities where trade conflicts do not exist.',
        estimatedSavings: {
          days: Math.floor(sequentialTasks.length * 2)
        }
      });
    }
  }

  // Check for finish-to-start that could be start-to-start
  tasks.forEach((task, index) => {
    if (task.predecessors?.length > 0 && index > 0) {
      const predTask = tasks.find((t: any) => task.predecessors.includes(t.taskId));
      if (predTask && predTask.duration > 5 && task.duration > 5) {
        // Long tasks that follow other long tasks could potentially overlap
        if (!tasksConflict(task, predTask)) {
          recommendations.push({
            id: `SEQ-${idCounter++}`,
            category: 'sequencing',
            priority: 'low',
            title: `Consider SS relationship: ${task.name}`,
            description: `"${task.name}" follows "${predTask.name}" with finish-to-start. Consider start-to-start with lag.`,
            impact: `Could save ${Math.floor(predTask.duration * 0.3)} days`,
            affectedTasks: [task.name, predTask.name],
            suggestedAction: `Change to SS+${Math.floor(predTask.duration * 0.5)}d if activities can safely overlap.`,
            estimatedSavings: {
              days: Math.floor(predTask.duration * 0.3)
            }
          });
        }
      }
    }
  });

  return recommendations;
}

/**
 * Analyze resource conflicts and over-allocation
 */
function analyzeResourceConflicts(tasks: any[], subcontractors: any[]): ScheduleImprovementRecommendation[] {
  const recommendations: ScheduleImprovementRecommendation[] = [];
  let idCounter = 1;

  // Group tasks by trade/assignee
  const tasksByTrade: Record<string, any[]> = {};
  tasks.forEach(task => {
    const trade = task.assignedTo || 'Unassigned';
    if (!tasksByTrade[trade]) tasksByTrade[trade] = [];
    tasksByTrade[trade].push(task);
  });

  // Check for overlapping tasks for the same trade
  for (const [trade, tradeTasks] of Object.entries(tasksByTrade)) {
    for (let i = 0; i < tradeTasks.length; i++) {
      for (let j = i + 1; j < tradeTasks.length; j++) {
        const taskA = tradeTasks[i];
        const taskB = tradeTasks[j];
        
        if (datesOverlap(taskA.startDate, taskA.endDate, taskB.startDate, taskB.endDate)) {
          recommendations.push({
            id: `RES-${idCounter++}`,
            category: 'resource',
            priority: 'high',
            title: `Resource conflict: ${trade}`,
            description: `"${taskA.name}" and "${taskB.name}" overlap for ${trade}. This may cause resource over-allocation.`,
            impact: 'May cause delays if single crew cannot handle both tasks',
            affectedTasks: [taskA.name, taskB.name],
            suggestedAction: `Verify ${trade} has sufficient crew for parallel work, or stagger tasks.`
          });
        }
      }
    }
  }

  // Check for unassigned trades
  const unassignedCount = tasks.filter(t => !t.assignedTo || t.assignedTo === 'Unassigned').length;
  if (unassignedCount > 5) {
    recommendations.push({
      id: `RES-${idCounter++}`,
      category: 'resource',
      priority: 'medium',
      title: 'Multiple unassigned tasks',
      description: `${unassignedCount} tasks have no trade/subcontractor assigned.`,
      impact: 'Cannot accurately forecast resource needs or detect conflicts',
      affectedTasks: tasks.filter(t => !t.assignedTo).slice(0, 5).map(t => t.name),
      suggestedAction: 'Assign trades to all tasks for accurate resource planning.'
    });
  }

  // Check if assigned subs exist in the system
  const subTrades = new Set(subcontractors.map(s => s.tradeType?.toLowerCase()));
  const missingTrades = new Set<string>();
  tasks.forEach(task => {
    if (task.assignedTo && !subTrades.has(task.assignedTo.toLowerCase())) {
      missingTrades.add(task.assignedTo);
    }
  });

  if (missingTrades.size > 0) {
    recommendations.push({
      id: `RES-${idCounter++}`,
      category: 'resource',
      priority: 'medium',
      title: 'Missing subcontractor records',
      description: `${missingTrades.size} trades in schedule don't have matching subcontractor records.`,
      impact: 'Cannot track contracts, insurance, or contact info for these trades',
      affectedTasks: Array.from(missingTrades),
      suggestedAction: `Add subcontractor records for: ${Array.from(missingTrades).slice(0, 5).join(', ')}`
    });
  }

  return recommendations;
}

/**
 * Analyze task durations against budget/SOV
 */
function analyzeDurations(tasks: any[], budgetItems: any[]): ScheduleImprovementRecommendation[] {
  const recommendations: ScheduleImprovementRecommendation[] = [];
  let idCounter = 1;

  // Check for unusually short or long durations
  const avgDuration = tasks.reduce((sum, t) => sum + (t.duration || 0), 0) / tasks.length;

  tasks.forEach(task => {
    // Very short critical tasks
    if (task.isCritical && task.duration <= 1) {
      recommendations.push({
        id: `DUR-${idCounter++}`,
        category: 'duration',
        priority: 'medium',
        title: `Short critical task: ${task.name}`,
        description: `Critical task "${task.name}" has duration of ${task.duration} day(s). Very short critical tasks increase schedule risk.`,
        impact: 'Any delay directly impacts project completion',
        affectedTasks: [task.name],
        suggestedAction: 'Verify duration is realistic. Consider buffer or combining with adjacent tasks.'
      });
    }

    // Very long tasks that should be broken down
    if (task.duration > 20) {
      recommendations.push({
        id: `DUR-${idCounter++}`,
        category: 'duration',
        priority: 'low',
        title: `Long task: ${task.name}`,
        description: `"${task.name}" has a ${task.duration}-day duration. Consider breaking into smaller, measurable activities.`,
        impact: 'Long tasks are harder to track progress and identify delays early',
        affectedTasks: [task.name],
        suggestedAction: 'Break into 5-10 day activities with clear milestones.'
      });
    }
  });

  // Cross-reference with budget for cost-loaded durations
  if (budgetItems.length > 0) {
    const totalBudget = budgetItems.reduce((sum, b) => sum + (b.budgetedAmount || 0), 0);
    const totalDuration = tasks.reduce((sum, t) => sum + (t.duration || 0), 0);
    const avgCostPerDay = totalBudget / totalDuration;

    // Find budget items without corresponding schedule activities
    const scheduleTrades = new Set(tasks.map(t => (t.assignedTo || '').toLowerCase()));
    const unscheduledBudget = budgetItems.filter(b => {
      const budgetTrade = (b.phaseName || b.name || b.description || '').toLowerCase();
      return !scheduleTrades.has(budgetTrade) && b.budgetedAmount > totalBudget * 0.05;
    });

    if (unscheduledBudget.length > 0) {
      recommendations.push({
        id: `DUR-${idCounter++}`,
        category: 'duration',
        priority: 'high',
        title: 'Budget items missing from schedule',
        description: `${unscheduledBudget.length} significant budget items don't appear to have corresponding schedule activities.`,
        impact: 'Schedule may be missing critical scope',
        affectedTasks: unscheduledBudget.slice(0, 5).map(b => b.description || b.name),
        suggestedAction: 'Review budget and add missing activities to schedule.',
        estimatedSavings: {
          cost: unscheduledBudget.reduce((sum, b) => sum + (b.budgetedAmount || 0), 0)
        }
      });
    }
  }

  return recommendations;
}

/**
 * Analyze dependency logic
 */
function analyzeDependencies(tasks: any[]): ScheduleImprovementRecommendation[] {
  const recommendations: ScheduleImprovementRecommendation[] = [];
  let idCounter = 1;

  // Check for open-ended tasks (no successors)
  const tasksWithSuccessors = new Set<string>();
  tasks.forEach(task => {
    (task.predecessors || []).forEach((pred: string) => {
      tasksWithSuccessors.add(pred);
    });
  });

  const openEndedTasks = tasks.filter(t => 
    !tasksWithSuccessors.has(t.taskId) && 
    t.name !== 'Project Complete' &&
    !t.name.toLowerCase().includes('closeout')
  );

  if (openEndedTasks.length > 3) {
    recommendations.push({
      id: `DEP-${idCounter++}`,
      category: 'dependency',
      priority: 'medium',
      title: 'Open-ended tasks detected',
      description: `${openEndedTasks.length} tasks have no successors. This can cause logic gaps in the schedule.`,
      impact: 'Schedule may not accurately reflect true critical path',
      affectedTasks: openEndedTasks.slice(0, 5).map(t => t.name),
      suggestedAction: 'Add successor relationships to tie all activities to project completion.'
    });
  }

  // Check for tasks with no predecessors (danglers)
  const danglingTasks = tasks.filter(t => 
    (!t.predecessors || t.predecessors.length === 0) &&
    !t.name.toLowerCase().includes('mobilization') &&
    !t.name.toLowerCase().includes('start')
  );

  if (danglingTasks.length > 3) {
    recommendations.push({
      id: `DEP-${idCounter++}`,
      category: 'dependency',
      priority: 'medium',
      title: 'Tasks without predecessors',
      description: `${danglingTasks.length} tasks have no predecessor relationships.`,
      impact: 'These tasks may start at project start regardless of actual constraints',
      affectedTasks: danglingTasks.slice(0, 5).map(t => t.name),
      suggestedAction: 'Add predecessor relationships to properly sequence activities.'
    });
  }

  // Check for circular dependencies (simplified check)
  const visited = new Set<string>();
  const checkCircular = (taskId: string, path: string[]): boolean => {
    if (path.includes(taskId)) return true;
    const task = tasks.find(t => t.taskId === taskId);
    if (!task || !task.predecessors) return false;
    for (const pred of task.predecessors) {
      if (checkCircular(pred, [...path, taskId])) return true;
    }
    return false;
  };

  tasks.forEach(task => {
    if (checkCircular(task.taskId, [])) {
      recommendations.push({
        id: `DEP-${idCounter++}`,
        category: 'dependency',
        priority: 'high',
        title: 'Potential circular dependency',
        description: `Task "${task.name}" may be involved in a circular dependency loop.`,
        impact: 'Circular dependencies cause scheduling errors and infinite loops',
        affectedTasks: [task.name],
        suggestedAction: 'Review and break circular dependency chain.'
      });
    }
  });

  return recommendations;
}

/**
 * Analyze general risk factors
 */
function analyzeRiskFactors(tasks: any[], schedule: any): ScheduleImprovementRecommendation[] {
  const recommendations: ScheduleImprovementRecommendation[] = [];
  let idCounter = 1;

  // Check critical path concentration
  const criticalTasks = tasks.filter(t => t.isCritical);
  const criticalRatio = criticalTasks.length / tasks.length;

  if (criticalRatio > 0.5) {
    recommendations.push({
      id: `RISK-${idCounter++}`,
      category: 'risk',
      priority: 'high',
      title: 'High critical path concentration',
      description: `${Math.round(criticalRatio * 100)}% of tasks are on the critical path. This indicates a highly constrained schedule.`,
      impact: 'Very little flexibility to absorb delays',
      affectedTasks: [],
      suggestedAction: 'Look for opportunities to add parallel paths or increase float.'
    });
  }

  // Check for back-loaded schedule
  const midpoint = new Date(schedule.startDate);
  midpoint.setDate(midpoint.getDate() + Math.floor((new Date(schedule.endDate).getTime() - new Date(schedule.startDate).getTime()) / (1000 * 60 * 60 * 24) / 2));
  
  const firstHalfTasks = tasks.filter(t => new Date(t.startDate) < midpoint).length;
  const secondHalfTasks = tasks.filter(t => new Date(t.startDate) >= midpoint).length;

  if (secondHalfTasks > firstHalfTasks * 1.5) {
    recommendations.push({
      id: `RISK-${idCounter++}`,
      category: 'risk',
      priority: 'medium',
      title: 'Back-loaded schedule',
      description: `Schedule is back-loaded with ${secondHalfTasks} tasks in second half vs ${firstHalfTasks} in first half.`,
      impact: 'Higher risk of end-of-project crunch and quality issues',
      affectedTasks: [],
      suggestedAction: 'Review if any activities can be pulled forward or run in parallel.'
    });
  }

  // Check for compressed finishes phase
  const finishTasks = tasks.filter(t => 
    t.name.toLowerCase().includes('finish') ||
    t.name.toLowerCase().includes('paint') ||
    t.name.toLowerCase().includes('floor') ||
    t.name.toLowerCase().includes('ceiling')
  );

  if (finishTasks.length > 5) {
    const finishDuration = finishTasks.reduce((sum, t) => sum + (t.duration || 0), 0);
    const totalDuration = tasks.reduce((sum, t) => sum + (t.duration || 0), 0);
    if (finishDuration / totalDuration < 0.15) {
      recommendations.push({
        id: `RISK-${idCounter++}`,
        category: 'risk',
        priority: 'medium',
        title: 'Compressed finishes schedule',
        description: `Interior finishes represent only ${Math.round(finishDuration / totalDuration * 100)}% of schedule. This is typically 20-30%.`,
        impact: 'May result in quality issues or overtime costs',
        affectedTasks: finishTasks.slice(0, 5).map(t => t.name),
        suggestedAction: 'Review finish phase durations and consider extending if quality is paramount.'
      });
    }
  }

  return recommendations;
}

/**
 * Analyze weather-related risks
 */
function analyzeWeatherRisks(tasks: any[]): ScheduleImprovementRecommendation[] {
  const recommendations: ScheduleImprovementRecommendation[] = [];
  let idCounter = 1;

  // Identify weather-sensitive tasks
  const weatherSensitiveTasks = tasks.filter(t => {
    const name = (t.name || '').toLowerCase();
    return name.includes('concrete') ||
           name.includes('pour') ||
           name.includes('grading') ||
           name.includes('excavat') ||
           name.includes('roof') ||
           name.includes('exterior') ||
           name.includes('paving') ||
           name.includes('landscape') ||
           name.includes('site work') ||
           name.includes('foundation');
  });

  // Check for winter concrete work
  weatherSensitiveTasks.forEach(task => {
    const startMonth = new Date(task.startDate).getMonth();
    const name = (task.name || '').toLowerCase();

    // Winter months (Dec, Jan, Feb)
    if ([11, 0, 1].includes(startMonth)) {
      if (name.includes('concrete') || name.includes('pour')) {
        recommendations.push({
          id: `WX-${idCounter++}`,
          category: 'weather',
          priority: 'high',
          title: `Winter concrete: ${task.name}`,
          description: `"${task.name}" is scheduled during winter months. Cold weather concrete requires special measures.`,
          impact: 'May require heated enclosures, additives, or extended cure times',
          affectedTasks: [task.name],
          suggestedAction: 'Plan for cold weather concrete procedures, or shift schedule if possible.',
          estimatedSavings: { days: 3 }
        });
      }
      if (name.includes('grading') || name.includes('excavat') || name.includes('site work')) {
        recommendations.push({
          id: `WX-${idCounter++}`,
          category: 'weather',
          priority: 'medium',
          title: `Winter sitework: ${task.name}`,
          description: `"${task.name}" is scheduled during winter. Frozen ground may impact productivity.`,
          impact: 'Potential delays from frozen ground or snow',
          affectedTasks: [task.name],
          suggestedAction: 'Build in weather contingency or shift to warmer months if possible.',
          estimatedSavings: { days: 5 }
        });
      }
    }

    // Roofing in rainy season (varies by region, using spring as example)
    if ([3, 4, 5].includes(startMonth) && name.includes('roof')) {
      recommendations.push({
        id: `WX-${idCounter++}`,
        category: 'weather',
        priority: 'low',
        title: `Spring roofing: ${task.name}`,
        description: `"${task.name}" is scheduled during spring. Higher chance of rain delays.`,
        impact: 'May experience productivity losses from weather',
        affectedTasks: [task.name],
        suggestedAction: 'Build in 2-3 weather days or have backup indoor work ready.',
        estimatedSavings: { days: 2 }
      });
    }
  });

  return recommendations;
}

/**
 * Generate AI summary of schedule analysis
 */
async function generateAISummary(
  projectName: string,
  tasks: any[],
  recommendations: ScheduleImprovementRecommendation[]
): Promise<string> {
  const highPriority = recommendations.filter(r => r.priority === 'high').length;
  const mediumPriority = recommendations.filter(r => r.priority === 'medium').length;
  
  const totalSavings = recommendations.reduce((sum, r) => sum + (r.estimatedSavings?.days || 0), 0);

  const prompt = `You are a construction scheduling expert. Provide a brief 2-3 sentence executive summary of this schedule analysis:

Project: ${projectName}
Total Tasks: ${tasks.length}
High Priority Issues: ${highPriority}
Medium Priority Issues: ${mediumPriority}
Potential Schedule Savings: ${totalSavings} days

Top issues:
${recommendations.slice(0, 5).map(r => `- ${r.title}: ${r.description}`).join('\n')}

Provide actionable summary for a superintendent or project manager.`;

  try {
    const response = await callAbacusLLM([{ role: 'user', content: prompt }], {
      model: 'gpt-4o-mini',
      max_tokens: 200,
      temperature: 0.5
    });

    if (response?.content) {
      return response.content;
    }
  } catch (error) {
    logger.error('SCHEDULE_IMPROVEMENT', 'AI summary error', error as Error);
  }

  return `Analysis identified ${recommendations.length} recommendations including ${highPriority} high-priority items. Addressing these could save up to ${totalSavings} days.`;
}

// Helper functions
function groupTasksByPhase(tasks: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {};
  tasks.forEach(task => {
    const phase = task.wbsCode?.split('.')[0] || 'Other';
    if (!groups[phase]) groups[phase] = [];
    groups[phase].push(task);
  });
  return groups;
}

function tasksConflict(taskA: any, taskB: any): boolean {
  // Same trade or location = potential conflict
  if (taskA.assignedTo && taskA.assignedTo === taskB.assignedTo) return true;
  if (taskA.location && taskA.location === taskB.location) return true;
  return false;
}

function datesOverlap(start1: any, end1: any, start2: any, end2: any): boolean {
  const s1 = new Date(start1).getTime();
  const e1 = new Date(end1).getTime();
  const s2 = new Date(start2).getTime();
  const e2 = new Date(end2).getTime();
  return s1 < e2 && s2 < e1;
}

function calculateHealthScore(recommendations: ScheduleImprovementRecommendation[], taskCount: number): number {
  let score = 100;
  recommendations.forEach(r => {
    switch (r.priority) {
      case 'high': score -= 8; break;
      case 'medium': score -= 4; break;
      case 'low': score -= 2; break;
    }
  });
  // Bonus for having enough tasks (detailed schedule)
  if (taskCount > 50) score += 5;
  if (taskCount > 100) score += 5;
  return Math.max(0, Math.min(100, score));
}

function calculateFloatUtilization(tasks: any[]): number {
  // Simplified: ratio of non-critical to total
  const nonCritical = tasks.filter(t => !t.isCritical).length;
  return Math.round((nonCritical / tasks.length) * 100);
}

/**
 * Get CSI division for a trade
 */
export function getCSIDivision(trade: string): string {
  const tradeLower = trade.toLowerCase();
  for (const [code, division] of Object.entries(CSI_DIVISIONS)) {
    if (division.trades.some(t => tradeLower.includes(t.toLowerCase()))) {
      return code;
    }
  }
  return '01'; // Default to General Requirements
}

/**
 * Generate WBS code based on CSI and sequence
 */
export function generateWBSCode(trade: string, phase: number, sequence: number): string {
  const csi = getCSIDivision(trade);
  return `${csi}.${phase.toString().padStart(2, '0')}.${sequence.toString().padStart(3, '0')}`;
}
