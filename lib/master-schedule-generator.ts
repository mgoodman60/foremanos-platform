/**
 * Master Schedule Generator
 * 
 * Analyzes construction plans, CAD files, DWG drawings, specifications,
 * budget/SOV, and subcontractor data to automatically generate a detailed
 * master project schedule with CSI division alignment and AI recommendations.
 */

import { prisma } from './db';
import { callAbacusLLM, LLMResponse } from './abacus-llm';
import { getFileUrl } from './s3';
import { CSI_DIVISIONS, getCSIDivision, generateWBSCode } from './schedule-improvement-analyzer';
import { extractDetailedScheduleFromPlans, matchTasksToSubcontractors, importExtractedTasks } from './schedule-document-extractor';

interface GeneratedTask {
  taskId: string;
  name: string;
  description?: string;
  phase: string;
  trade: string;
  duration: number; // days
  predecessors: string[];
  location?: string;
  wbsCode?: string;
  csiDivision?: string;
  budgetItemId?: string;
  isCritical?: boolean;
  isMilestone?: boolean;
}

interface MasterScheduleResult {
  scheduleId: string;
  projectName: string;
  totalTasks: number;
  phases: string[];
  estimatedDuration: number; // total calendar days
  startDate: Date;
  endDate: Date;
  tasks: GeneratedTask[];
  sourcesUsed: string[];
  detailLevel: 'basic' | 'standard' | 'detailed';
}

// Standard construction phases and sequencing
const CONSTRUCTION_PHASES = [
  { name: 'Pre-Construction', order: 1, defaultDuration: 14 },
  { name: 'Site Work', order: 2, defaultDuration: 21 },
  { name: 'Foundation', order: 3, defaultDuration: 28 },
  { name: 'Structural', order: 4, defaultDuration: 42 },
  { name: 'Rough-In MEP', order: 5, defaultDuration: 35 },
  { name: 'Exterior Enclosure', order: 6, defaultDuration: 28 },
  { name: 'Interior Framing', order: 7, defaultDuration: 21 },
  { name: 'Insulation & Drywall', order: 8, defaultDuration: 21 },
  { name: 'Finish MEP', order: 9, defaultDuration: 28 },
  { name: 'Interior Finishes', order: 10, defaultDuration: 35 },
  { name: 'Final Inspections', order: 11, defaultDuration: 14 },
  { name: 'Punch List & Closeout', order: 12, defaultDuration: 14 }
];

// Trade-specific task templates
const TRADE_TASKS: Record<string, string[]> = {
  'Site Work': [
    'Mobilization',
    'Site Clearing & Demolition',
    'Erosion Control Installation',
    'Rough Grading',
    'Utilities Trenching',
    'Storm Drainage Installation',
    'Sanitary Sewer Installation',
    'Water Line Installation',
    'Final Grading'
  ],
  'Foundation': [
    'Layout & Staking',
    'Excavation',
    'Footer Formwork',
    'Footer Rebar Installation',
    'Footer Pour',
    'Foundation Wall Forms',
    'Foundation Wall Rebar',
    'Foundation Wall Pour',
    'Waterproofing',
    'Backfill'
  ],
  'Structural': [
    'Steel Delivery',
    'Column Installation',
    'Beam Installation',
    'Metal Deck Installation',
    'Concrete on Metal Deck',
    'Masonry Walls',
    'Structural Inspections'
  ],
  'Rough-In MEP': [
    'Underground Plumbing Rough-In',
    'Plumbing Risers',
    'HVAC Ductwork Installation',
    'HVAC Equipment Setting',
    'Electrical Conduit Rough-In',
    'Electrical Panel Installation',
    'Fire Protection Rough-In',
    'Low Voltage Rough-In'
  ],
  'Exterior Enclosure': [
    'Window Installation',
    'Exterior Door Frames',
    'Roofing - Underlayment',
    'Roofing - Final',
    'Exterior Wall Sheathing',
    'Air/Weather Barrier',
    'Exterior Finishes'
  ],
  'Interior Finishes': [
    'Ceiling Grid Installation',
    'Flooring - Prep',
    'Flooring - Installation',
    'Millwork Installation',
    'Interior Doors',
    'Hardware Installation',
    'Paint - Prime',
    'Paint - Finish',
    'Signage'
  ]
};

/**
 * Generate a master schedule by analyzing project documents
 */
export async function generateMasterSchedule(
  projectId: string,
  userId: string,
  options?: {
    projectStartDate?: Date;
    scheduleName?: string;
    includeAllPhases?: boolean;
    detailLevel?: 'basic' | 'standard' | 'detailed';
    useSOV?: boolean;
    matchSubcontractors?: boolean;
  }
): Promise<MasterScheduleResult> {
  console.log('[MASTER_SCHEDULE] Starting master schedule generation for project:', projectId);

  // Get project info
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const projectStartDate = options?.projectStartDate || new Date();
  const detailLevel = options?.detailLevel || 'standard';
  const sourcesUsed: string[] = [];

  // Get project documents
  const documents = await prisma.document.findMany({
    where: {
      projectId,
      OR: [
        { name: { contains: 'plan', mode: 'insensitive' } },
        { name: { contains: 'dwg', mode: 'insensitive' } },
        { name: { contains: 'cad', mode: 'insensitive' } },
        { name: { contains: 'schedule', mode: 'insensitive' } },
        { name: { contains: 'spec', mode: 'insensitive' } },
        { category: 'plans_drawings' },
        { category: 'specifications' }
      ]
    }
  });

  // Get budget items (SOV) through ProjectBudget
  const projectBudget = await prisma.projectBudget.findUnique({
    where: { projectId },
    include: { BudgetItem: { orderBy: { phaseCode: 'asc' } } }
  });
  const budgetItems = projectBudget?.BudgetItem || [];

  // Get subcontractors
  const subcontractors = await prisma.subcontractor.findMany({
    where: { projectId }
  });

  // Get document chunks for analysis
  const documentIds = documents.map(d => d.id);
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId: { in: documentIds } },
    orderBy: { pageNumber: 'asc' },
    take: 150
  });

  let tasks: GeneratedTask[] = [];

  // DETAILED: Try to extract from plans/specs with AI
  if (detailLevel === 'detailed') {
    console.log('[MASTER_SCHEDULE] Generating detailed schedule from all sources...');
    
    const extractionResult = await extractDetailedScheduleFromPlans(projectId);
    if (extractionResult.success && extractionResult.extractedTasks.length > 30) {
      // Match tasks to subcontractors
      const matchedTasks = await matchTasksToSubcontractors(extractionResult.extractedTasks, projectId);
      
      // Convert to GeneratedTask format
      tasks = matchedTasks.map((t, idx) => ({
        taskId: t.taskId || `T${idx + 1}`,
        name: t.name,
        description: t.description,
        phase: inferPhaseFromWBS(t.wbsCode) || 'General',
        trade: t.trade || 'General Contractor',
        duration: t.duration || 5,
        predecessors: t.predecessors || [],
        location: t.location,
        wbsCode: t.wbsCode,
        csiDivision: t.wbsCode?.split('.')[0],
        isMilestone: t.isMilestone
      }));

      sourcesUsed.push('plans_drawings', 'specifications');
      if (budgetItems.length > 0) sourcesUsed.push('SOV/budget');
      if (subcontractors.length > 0) sourcesUsed.push('subcontractors');
    }
  }

  // STANDARD or fallback: Use template-based with enhancements
  if (tasks.length === 0) {
    // Analyze documents to identify scope
    const scopeAnalysis = await analyzeProjectScope(chunks, project.name, budgetItems);
    console.log('[MASTER_SCHEDULE] Scope analysis complete:', scopeAnalysis);

    // Generate tasks based on scope and SOV
    tasks = await generateEnhancedTasks(scopeAnalysis, budgetItems, subcontractors, detailLevel);
    console.log(`[MASTER_SCHEDULE] Generated ${tasks.length} tasks`);

    sourcesUsed.push('document analysis');
    if (budgetItems.length > 0) sourcesUsed.push('SOV/budget');
    if (subcontractors.length > 0) sourcesUsed.push('subcontractors');
  }

  // Calculate end date
  const endDate = new Date(projectStartDate);
  const totalDuration = tasks.reduce((max, t) => {
    const taskEnd = getDaysFromStart(t, tasks);
    return Math.max(max, taskEnd + t.duration);
  }, 0);
  endDate.setDate(endDate.getDate() + totalDuration);

  // Create schedule in database
  const schedule = await prisma.schedule.create({
    data: {
      name: options?.scheduleName || `Master Schedule - ${project.name}`,
      projectId,
      startDate: projectStartDate,
      endDate,
      createdBy: userId,
      extractedBy: 'ai_generated',
      extractedAt: new Date(),
      isActive: true
    }
  });

  // Create tasks in database with CSI-aligned WBS
  for (const task of tasks) {
    const taskStart = calculateTaskStartDate(task, tasks, projectStartDate);
    const taskEnd = new Date(taskStart);
    taskEnd.setDate(taskEnd.getDate() + task.duration);

    await prisma.scheduleTask.create({
      data: {
        scheduleId: schedule.id,
        taskId: task.taskId,
        name: task.name,
        description: task.description,
        startDate: taskStart,
        endDate: taskEnd,
        duration: task.duration,
        predecessors: task.predecessors,
        assignedTo: task.trade,
        location: task.location,
        wbsCode: task.wbsCode,
        isCritical: task.isCritical || isOnCriticalPath(task, tasks),
        percentComplete: 0,
        status: 'not_started'
      }
    });
  }

  console.log(`[MASTER_SCHEDULE] Successfully created schedule with ${tasks.length} tasks`);

  return {
    scheduleId: schedule.id,
    projectName: project.name,
    totalTasks: tasks.length,
    phases: [...new Set(tasks.map(t => t.phase))],
    estimatedDuration: totalDuration,
    startDate: projectStartDate,
    endDate,
    tasks,
    sourcesUsed,
    detailLevel
  };
}

/**
 * Analyze project scope from document chunks and budget
 */
async function analyzeProjectScope(
  chunks: any[],
  projectName: string,
  budgetItems: any[] = []
): Promise<{
  projectType: string;
  buildingSize: string;
  identifiedTrades: string[];
  keyFeatures: string[];
  complexity: 'simple' | 'medium' | 'complex';
  budgetTrades: string[];
  locations: string[];
}> {
  // Combine relevant chunk content
  const content = chunks
    .map(c => c.content)
    .join('\n\n')
    .slice(0, 15000);

  // Extract trades from budget/SOV
  const budgetTrades = [...new Set(budgetItems.map(b => b.phaseName || b.name || '').filter(Boolean))];
  const budgetContext = budgetItems.length > 0 
    ? `\n\nBudget/SOV Line Items:\n${budgetItems.map(b => `- ${b.phaseCode || ''} ${b.phaseName || b.name}: ${b.description} ($${b.budgetedAmount})`).join('\n').slice(0, 3000)}`
    : '';

  const prompt = `Analyze this construction project documentation and identify the scope of work.

Project Name: ${projectName}

Document Content:
${content}${budgetContext}

Provide a JSON response with:
1. projectType: Type of building (e.g., "Commercial Office", "Healthcare Facility", "Senior Living", "Educational", "Residential Multi-Family")
2. buildingSize: Estimated size (e.g., "Small (<10,000 SF)", "Medium (10,000-50,000 SF)", "Large (>50,000 SF)")
3. identifiedTrades: Array of ALL trades/disciplines needed (e.g., ["Concrete", "Steel", "Electrical", "Plumbing", "HVAC", "Drywall", "Flooring", "Painting"])
4. keyFeatures: Array of notable building features (e.g., ["Elevator", "Generator", "Fire Sprinkler", "Commercial Kitchen"])
5. complexity: Overall complexity level ("simple", "medium", "complex")
6. locations: Array of distinct areas/zones (e.g., ["Building A", "Wing 1", "Floor 1", "Exterior"])

Return ONLY valid JSON, no other text.`;

  try {
    const response = await callAbacusLLM([
      { role: 'user', content: prompt }
    ], {
      model: 'gpt-4o-mini',
      max_tokens: 800,
      temperature: 0.3
    });

    if (response && response.content) {
      const cleaned = response.content.replace(/```json\n?|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        ...parsed,
        budgetTrades,
        locations: parsed.locations || []
      };
    }
  } catch (error) {
    console.error('[MASTER_SCHEDULE] Scope analysis error:', error);
  }

  // Default fallback
  return {
    projectType: 'Commercial Building',
    buildingSize: 'Medium (10,000-50,000 SF)',
    identifiedTrades: ['Concrete', 'Steel', 'Electrical', 'Plumbing', 'HVAC', 'Drywall', 'Flooring', 'Painting'],
    keyFeatures: [],
    complexity: 'medium',
    budgetTrades,
    locations: []
  };
}

/**
 * Generate enhanced tasks using SOV and subcontractor data
 */
async function generateEnhancedTasks(
  scope: any,
  budgetItems: any[],
  subcontractors: any[],
  detailLevel: 'basic' | 'standard' | 'detailed'
): Promise<GeneratedTask[]> {
  const tasks: GeneratedTask[] = [];
  let taskCounter = 1;
  let phaseCounter = 1;

  // Create subcontractor lookup by trade
  const subByTrade = new Map<string, any>();
  subcontractors.forEach(sub => {
    const trade = (sub.tradeType || '').toLowerCase();
    subByTrade.set(trade, sub);
  });

  // Helper to get trade with subcontractor
  const formatTrade = (tradeName: string): string => {
    const tradeLower = tradeName.toLowerCase();
    for (const [key, sub] of subByTrade) {
      if (tradeLower.includes(key) || key.includes(tradeLower)) {
        return `${tradeName} - ${sub.companyName}`;
      }
    }
    return tradeName;
  };

  // Duration multiplier based on complexity
  const durationMultiplier = {
    simple: 0.7,
    medium: 1.0,
    complex: 1.4
  }[scope.complexity];

  // Task count multiplier based on detail level
  const detailMultiplier = {
    basic: 0.5,
    standard: 1.0,
    detailed: 1.5
  }[detailLevel];

  // Generate tasks from SOV if available
  if (budgetItems.length > 10) {
    console.log('[MASTER_SCHEDULE] Generating tasks from SOV...');
    
    // Group budget items by phase
    const phaseGroups = new Map<number, any[]>();
    budgetItems.forEach(item => {
      const phase = item.phaseCode || 0;
      if (!phaseGroups.has(phase)) phaseGroups.set(phase, []);
      phaseGroups.get(phase)!.push(item);
    });

    // Create tasks from each phase
    for (const [phaseCode, items] of Array.from(phaseGroups).sort((a, b) => a[0] - b[0])) {
      const phaseName = items[0]?.phaseName || `Phase ${phaseCode}`;
      const csiDiv = phaseCode.toString().padStart(2, '0');
      
      // Add phase milestone
      tasks.push({
        taskId: `M${phaseCounter}`,
        name: `${phaseName} - Start`,
        phase: phaseName,
        trade: 'Project Management',
        duration: 0,
        predecessors: phaseCounter > 1 ? [`T${taskCounter - 1}`] : [],
        wbsCode: `${csiDiv}.00.000`,
        csiDivision: csiDiv,
        isMilestone: true
      });

      // Create tasks from budget items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.description || item.description.trim() === '') continue;

        const tradeName = inferTradeFromTask(item.description || item.name);
        const duration = Math.ceil(
          estimateDurationFromBudget(item.budgetedAmount, item.budgetedHours) * durationMultiplier
        );

        tasks.push({
          taskId: `T${taskCounter}`,
          name: item.description || item.name,
          description: `Budget: $${item.budgetedAmount?.toLocaleString() || 0}`,
          phase: phaseName,
          trade: formatTrade(tradeName),
          duration: Math.max(duration, 1),
          predecessors: i === 0 ? [`M${phaseCounter}`] : [`T${taskCounter - 1}`],
          wbsCode: generateWBSCode(tradeName, phaseCode, i + 1),
          csiDivision: csiDiv,
          budgetItemId: item.id
        });

        taskCounter++;
      }
      phaseCounter++;
    }
  }

  // If no SOV or insufficient, use template-based generation
  if (tasks.length < 20) {
    console.log('[MASTER_SCHEDULE] Using template-based generation...');
    
    for (const phase of CONSTRUCTION_PHASES) {
      const phaseTasks = TRADE_TASKS[phase.name] || [];
      const csiDiv = getCSIDivisionForPhase(phase.name);
      
      // Adjust task count based on detail level
      const taskCount = Math.ceil(phaseTasks.length * detailMultiplier);
      const selectedTasks = phaseTasks.slice(0, taskCount);

      // Add phase milestone
      tasks.push({
        taskId: `M${phaseCounter}`,
        name: `${phase.name} - Start`,
        phase: phase.name,
        trade: 'Project Management',
        duration: 0,
        predecessors: tasks.length > 0 ? [`T${taskCounter - 1}`] : [],
        wbsCode: `${csiDiv}.00.000`,
        csiDivision: csiDiv,
        isMilestone: true
      });

      // Add tasks
      for (let i = 0; i < selectedTasks.length; i++) {
        const taskName = selectedTasks[i];
        const tradeName = inferTradeFromTask(taskName);
        const baseDuration = Math.ceil((phase.defaultDuration / phaseTasks.length) * durationMultiplier);

        // Add location variants if detailed
        const locations = detailLevel === 'detailed' && scope.locations?.length > 0
          ? scope.locations.slice(0, 3)
          : [''];

        for (const location of locations) {
          const fullName = location ? `${taskName} - ${location}` : taskName;
          
          tasks.push({
            taskId: `T${taskCounter}`,
            name: fullName,
            phase: phase.name,
            trade: formatTrade(tradeName),
            duration: Math.max(baseDuration, 1),
            predecessors: i === 0 && !location ? [`M${phaseCounter}`] : [`T${taskCounter - 1}`],
            wbsCode: generateWBSCode(tradeName, phase.order, taskCounter),
            csiDivision: csiDiv,
            location: location || undefined,
            isCritical: ['Site Work', 'Foundation', 'Structural', 'Rough-In MEP'].includes(phase.name)
          });

          taskCounter++;
        }
      }
      phaseCounter++;
    }
  }

  return tasks;
}

/**
 * Estimate duration from budget amount and hours
 */
function estimateDurationFromBudget(amount: number, hours?: number): number {
  if (hours && hours > 0) {
    // Assume 8 hours per day, 2-3 workers
    return Math.ceil(hours / 20);
  }
  // Estimate based on cost (rough: $5000/day average)
  if (amount) {
    return Math.ceil(amount / 5000);
  }
  return 5; // Default
}

/**
 * Get CSI division for construction phase
 */
function getCSIDivisionForPhase(phaseName: string): string {
  const mapping: Record<string, string> = {
    'Pre-Construction': '01',
    'Site Work': '31',
    'Foundation': '03',
    'Structural': '05',
    'Rough-In MEP': '22',
    'Exterior Enclosure': '07',
    'Interior Framing': '06',
    'Insulation & Drywall': '09',
    'Finish MEP': '26',
    'Interior Finishes': '09',
    'Final Inspections': '01',
    'Punch List & Closeout': '01'
  };
  return mapping[phaseName] || '01';
}

/**
 * Infer phase name from WBS code
 */
function inferPhaseFromWBS(wbsCode?: string): string | undefined {
  if (!wbsCode) return undefined;
  const csi = wbsCode.split('.')[0];
  const division = CSI_DIVISIONS[csi as keyof typeof CSI_DIVISIONS];
  return division?.name;
}

/**
 * Generate tasks based on scope analysis
 */
function generateTasksFromScope(
  scope: {
    projectType: string;
    buildingSize: string;
    identifiedTrades: string[];
    keyFeatures: string[];
    complexity: 'simple' | 'medium' | 'complex';
  },
  startDate: Date
): GeneratedTask[] {
  const tasks: GeneratedTask[] = [];
  let taskCounter = 1;

  // Duration multiplier based on complexity
  const durationMultiplier = {
    simple: 0.7,
    medium: 1.0,
    complex: 1.4
  }[scope.complexity];

  // Generate tasks for each phase
  for (const phase of CONSTRUCTION_PHASES) {
    const phaseTasks = TRADE_TASKS[phase.name] || [];
    const phasePredecessor = taskCounter > 1 ? `T${taskCounter - 1}` : '';

    // Add phase milestone
    const milestoneId = `M${phase.order}`;
    tasks.push({
      taskId: milestoneId,
      name: `${phase.name} Start`,
      phase: phase.name,
      trade: 'Project Management',
      duration: 0,
      predecessors: phasePredecessor ? [phasePredecessor] : [],
      wbsCode: `${phase.order}.0`
    });

    // Add individual tasks for this phase
    for (let i = 0; i < phaseTasks.length; i++) {
      const taskName = phaseTasks[i];
      const taskId = `T${taskCounter}`;
      const baseDuration = Math.ceil((phase.defaultDuration / phaseTasks.length) * durationMultiplier);

      tasks.push({
        taskId,
        name: taskName,
        phase: phase.name,
        trade: inferTradeFromTask(taskName),
        duration: Math.max(baseDuration, 1),
        predecessors: i === 0 ? [milestoneId] : [`T${taskCounter - 1}`],
        wbsCode: `${phase.order}.${i + 1}`
      });

      taskCounter++;
    }
  }

  return tasks;
}

/**
 * Infer trade from task name
 */
function inferTradeFromTask(taskName: string): string {
  const name = taskName.toLowerCase();
  
  if (name.includes('electrical') || name.includes('conduit') || name.includes('panel')) return 'Electrical';
  if (name.includes('plumbing') || name.includes('pipe') || name.includes('sanitary')) return 'Plumbing';
  if (name.includes('hvac') || name.includes('duct') || name.includes('mechanical')) return 'HVAC';
  if (name.includes('concrete') || name.includes('pour') || name.includes('footer') || name.includes('foundation')) return 'Concrete';
  if (name.includes('steel') || name.includes('beam') || name.includes('column')) return 'Structural Steel';
  if (name.includes('roof')) return 'Roofing';
  if (name.includes('drywall') || name.includes('framing')) return 'Drywall';
  if (name.includes('paint')) return 'Painting';
  if (name.includes('floor')) return 'Flooring';
  if (name.includes('fire') || name.includes('sprinkler')) return 'Fire Protection';
  if (name.includes('excavat') || name.includes('grading') || name.includes('site')) return 'Sitework';
  if (name.includes('masonry') || name.includes('block')) return 'Masonry';
  if (name.includes('window') || name.includes('door') || name.includes('glass')) return 'Glazing';
  if (name.includes('ceiling')) return 'Acoustical Ceilings';
  if (name.includes('millwork') || name.includes('casework')) return 'Millwork';
  
  return 'General Contractor';
}

/**
 * Calculate task start date based on predecessors
 */
function calculateTaskStartDate(
  task: GeneratedTask,
  allTasks: GeneratedTask[],
  projectStart: Date
): Date {
  if (task.predecessors.length === 0) {
    return new Date(projectStart);
  }

  let latestEnd = new Date(projectStart);
  
  for (const predId of task.predecessors) {
    const pred = allTasks.find(t => t.taskId === predId);
    if (pred) {
      const predStart = calculateTaskStartDate(pred, allTasks, projectStart);
      const predEnd = new Date(predStart);
      predEnd.setDate(predEnd.getDate() + pred.duration);
      
      if (predEnd > latestEnd) {
        latestEnd = predEnd;
      }
    }
  }

  return latestEnd;
}

/**
 * Get days from project start for a task
 */
function getDaysFromStart(task: GeneratedTask, allTasks: GeneratedTask[]): number {
  if (task.predecessors.length === 0) return 0;

  let maxDays = 0;
  for (const predId of task.predecessors) {
    const pred = allTasks.find(t => t.taskId === predId);
    if (pred) {
      const predDays = getDaysFromStart(pred, allTasks) + pred.duration;
      maxDays = Math.max(maxDays, predDays);
    }
  }

  return maxDays;
}

/**
 * Determine if task is on critical path
 */
function isOnCriticalPath(task: GeneratedTask, allTasks: GeneratedTask[]): boolean {
  // Simplified critical path detection
  // Tasks in phases 2-5 are typically critical
  const criticalPhases = ['Site Work', 'Foundation', 'Structural', 'Rough-In MEP'];
  return criticalPhases.includes(task.phase);
}

/**
 * Check if a project has the capability for schedule generation
 */
export async function canGenerateSchedule(projectId: string): Promise<{
  canGenerate: boolean;
  reason?: string;
  documentCount: number;
  hasPlans: boolean;
  hasSpecs: boolean;
}> {
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    return { canGenerate: false, reason: 'Project not found', documentCount: 0, hasPlans: false, hasSpecs: false };
  }

  const documents = await prisma.document.findMany({
    where: { projectId }
  });

  const hasPlans = documents.some(d =>
    d.name.toLowerCase().includes('plan') ||
    d.name.toLowerCase().includes('dwg') ||
    d.name.toLowerCase().includes('cad') ||
    d.category === 'plans_drawings'
  );

  const hasSpecs = documents.some(d =>
    d.name.toLowerCase().includes('spec') ||
    d.category === 'specifications'
  );

  const canGenerate = documents.length >= 1;

  return {
    canGenerate,
    reason: canGenerate ? undefined : 'Upload at least one project document (plans, specs, or schedule)',
    documentCount: documents.length,
    hasPlans,
    hasSpecs
  };
}
