/**
 * Agent Executor — Trigger.dev task bridge for plugin agent definitions.
 *
 * Loads agent markdown definitions from ai-intelligence/agents/,
 * gathers project data from Prisma, invokes the LLM with agent context,
 * and stores structured results.
 */

import { loadAgentDefinition } from '@/lib/plugin/skill-loader';
import { callLLM } from '@/lib/llm-providers';
import type { LLMMessage } from '@/lib/llm-providers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { SIMPLE_MODEL } from '@/lib/model-config';

// ─── Interfaces ────────────────────────────────────────────────────

export interface AgentAlert {
  severity: 1 | 2 | 3 | 4 | 5;
  category: string;
  title: string;
  description: string;
  dataSource: string;
  metric?: string;
  value?: number | string;
  threshold?: number | string;
}

export interface AgentExecutionResult {
  agentName: string;
  projectId: string;
  status: 'success' | 'partial' | 'error' | 'no-data';
  alerts: AgentAlert[];
  kpis: Array<{
    name: string;
    value: number | string;
    unit?: string;
    trend?: 'up' | 'down' | 'flat' | 'mixed';
    tier?: string;
  }>;
  recommendations: string[];
  summary: string;
  executedAt: string;
  durationMs: number;
  dataGaps: string[];
}

// ─── Project Data Loader ───────────────────────────────────────────

interface ProjectDataBundle {
  project: {
    id: string;
    name: string;
    slug: string;
    status: string;
    jobNumber: string | null;
    superintendent: string | null;
    projectManager: string | null;
    clientName: string | null;
    projectType: string | null;
  } | null;
  scheduleCount: number;
  scheduleTasks: Array<{
    id: string;
    name: string;
    status: string;
    percentComplete: number;
    startDate: Date;
    endDate: Date;
    isCritical: boolean;
  }>;
  milestones: Array<{
    id: string;
    name: string;
    plannedDate: Date;
    status: string;
    isCritical: boolean;
  }>;
  budgetSummary: {
    totalBudgeted: number;
    totalActual: number;
    totalCommitted: number;
    itemCount: number;
  };
  changeOrders: Array<{
    id: string;
    orderNumber: string;
    title: string;
    status: string;
    proposedAmount: number;
    approvedAmount: number | null;
    scheduleImpactDays: number | null;
  }>;
  recentDailyReports: Array<{
    id: string;
    reportDate: Date;
    status: string;
    safetyIncidents: number;
    delayHours: number | null;
    delayReason: string | null;
  }>;
  laborSummary: {
    totalHours: number;
    totalCost: number;
    entryCount: number;
  };
  subcontractors: Array<{
    id: string;
    companyName: string;
    tradeType: string;
    isActive: boolean;
  }>;
  rfis: Array<{
    id: string;
    rfiNumber: number;
    title: string;
    status: string;
    priority: string;
    createdAt: Date;
  }>;
  punchListItems: Array<{
    id: string;
    title: string;
    status: string;
    priority: string | null;
    location: string | null;
    createdAt: Date;
  }>;
  healthSnapshots: Array<{
    overallScore: number;
    scheduleScore: number;
    budgetScore: number;
    safetyScore: number;
    qualityScore: number;
    documentScore: number;
    createdAt: Date;
  }>;
  invoiceSummary: {
    totalAmount: number;
    pendingAmount: number;
    paidAmount: number;
    invoiceCount: number;
  };
  procurementItems: Array<{
    id: string;
    description: string;
    status: string;
    requiredDate: Date | null;
    orderDate: Date | null;
  }>;
  dataGaps: string[];
}

/**
 * Load common project data needed by agents from Prisma.
 * Gracefully handles missing data — construction projects often have incomplete records.
 */
export async function getProjectDataForAgent(
  projectId: string,
  projectSlug: string,
): Promise<ProjectDataBundle> {
  const dataGaps: string[] = [];

  // Load project basics
  let project: ProjectDataBundle['project'] = null;
  try {
    const p = await prisma.project.findFirst({
      where: { OR: [{ id: projectId }, { slug: projectSlug }] },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        jobNumber: true,
        superintendent: true,
        projectManager: true,
        clientName: true,
        projectType: true,
      },
    });
    if (p) {
      project = {
        id: p.id,
        name: p.name,
        slug: p.slug,
        status: String(p.status),
        jobNumber: p.jobNumber,
        superintendent: p.superintendent,
        projectManager: p.projectManager,
        clientName: p.clientName,
        projectType: p.projectType ? String(p.projectType) : null,
      };
    } else {
      dataGaps.push('Project not found in database');
    }
  } catch (err) {
    logger.warn('AGENT_EXECUTOR', 'Failed to load project', { error: String(err) });
    dataGaps.push('Project data unavailable');
  }

  const resolvedProjectId = project?.id || projectId;

  // Load schedule tasks
  let scheduleTasks: ProjectDataBundle['scheduleTasks'] = [];
  let scheduleCount = 0;
  try {
    const tasks = await prisma.scheduleTask.findMany({
      where: { Schedule: { projectId: resolvedProjectId } },
      select: {
        id: true,
        name: true,
        status: true,
        percentComplete: true,
        startDate: true,
        endDate: true,
        isCritical: true,
      },
      take: 200,
      orderBy: { startDate: 'asc' },
    });
    scheduleTasks = tasks.map(t => ({
      id: t.id,
      name: t.name,
      status: String(t.status),
      percentComplete: t.percentComplete,
      startDate: t.startDate,
      endDate: t.endDate,
      isCritical: t.isCritical,
    }));
    scheduleCount = tasks.length;
    if (tasks.length === 0) dataGaps.push('No schedule tasks found');
  } catch (err) {
    logger.warn('AGENT_EXECUTOR', 'Failed to load schedule tasks', { error: String(err) });
    dataGaps.push('Schedule data unavailable');
  }

  // Load milestones
  let milestones: ProjectDataBundle['milestones'] = [];
  try {
    const ms = await prisma.milestone.findMany({
      where: { projectId: resolvedProjectId },
      select: {
        id: true,
        name: true,
        plannedDate: true,
        status: true,
        isCritical: true,
      },
      orderBy: { plannedDate: 'asc' },
    });
    milestones = ms.map(m => ({
      id: m.id,
      name: m.name,
      plannedDate: m.plannedDate,
      status: String(m.status),
      isCritical: m.isCritical,
    }));
    if (ms.length === 0) dataGaps.push('No milestones found');
  } catch (err) {
    logger.warn('AGENT_EXECUTOR', 'Failed to load milestones', { error: String(err) });
    dataGaps.push('Milestone data unavailable');
  }

  // Load budget summary
  let budgetSummary: ProjectDataBundle['budgetSummary'] = {
    totalBudgeted: 0,
    totalActual: 0,
    totalCommitted: 0,
    itemCount: 0,
  };
  try {
    const budget = await prisma.projectBudget.findUnique({
      where: { projectId: resolvedProjectId },
      select: { id: true },
    });
    if (budget) {
      const agg = await prisma.budgetItem.aggregate({
        where: { budgetId: budget.id, isActive: true },
        _sum: { budgetedAmount: true, actualCost: true, committedCost: true },
        _count: true,
      });
      budgetSummary = {
        totalBudgeted: agg._sum.budgetedAmount || 0,
        totalActual: agg._sum.actualCost || 0,
        totalCommitted: agg._sum.committedCost || 0,
        itemCount: agg._count,
      };
    } else {
      dataGaps.push('No project budget configured');
    }
  } catch (err) {
    logger.warn('AGENT_EXECUTOR', 'Failed to load budget', { error: String(err) });
    dataGaps.push('Budget data unavailable');
  }

  // Load change orders
  let changeOrders: ProjectDataBundle['changeOrders'] = [];
  try {
    changeOrders = await prisma.changeOrder.findMany({
      where: { projectId: resolvedProjectId },
      select: {
        id: true,
        orderNumber: true,
        title: true,
        status: true,
        proposedAmount: true,
        approvedAmount: true,
        scheduleImpactDays: true,
      },
      orderBy: { submittedDate: 'desc' },
      take: 50,
    });
    changeOrders = changeOrders.map(co => ({
      ...co,
      status: String(co.status),
    }));
  } catch (err) {
    logger.warn('AGENT_EXECUTOR', 'Failed to load change orders', { error: String(err) });
    dataGaps.push('Change order data unavailable');
  }

  // Load recent daily reports (last 14 days)
  let recentDailyReports: ProjectDataBundle['recentDailyReports'] = [];
  try {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const reports = await prisma.dailyReport.findMany({
      where: {
        projectId: resolvedProjectId,
        reportDate: { gte: fourteenDaysAgo },
        deletedAt: null,
      },
      select: {
        id: true,
        reportDate: true,
        status: true,
        safetyIncidents: true,
        delayHours: true,
        delayReason: true,
      },
      orderBy: { reportDate: 'desc' },
      take: 14,
    });
    recentDailyReports = reports.map(r => ({
      ...r,
      status: String(r.status),
    }));
    if (reports.length === 0) dataGaps.push('No recent daily reports (last 14 days)');
  } catch (err) {
    logger.warn('AGENT_EXECUTOR', 'Failed to load daily reports', { error: String(err) });
    dataGaps.push('Daily report data unavailable');
  }

  // Load labor summary
  let laborSummary: ProjectDataBundle['laborSummary'] = {
    totalHours: 0,
    totalCost: 0,
    entryCount: 0,
  };
  try {
    const agg = await prisma.laborEntry.aggregate({
      where: { projectId: resolvedProjectId },
      _sum: { hoursWorked: true, totalCost: true },
      _count: true,
    });
    laborSummary = {
      totalHours: agg._sum.hoursWorked || 0,
      totalCost: agg._sum.totalCost || 0,
      entryCount: agg._count,
    };
  } catch (err) {
    logger.warn('AGENT_EXECUTOR', 'Failed to load labor data', { error: String(err) });
    dataGaps.push('Labor data unavailable');
  }

  // Load subcontractors
  let subcontractors: ProjectDataBundle['subcontractors'] = [];
  try {
    const subs = await prisma.subcontractor.findMany({
      where: { projectId: resolvedProjectId },
      select: {
        id: true,
        companyName: true,
        tradeType: true,
        isActive: true,
      },
    });
    subcontractors = subs.map(s => ({
      id: s.id,
      companyName: s.companyName,
      tradeType: String(s.tradeType),
      isActive: s.isActive,
    }));
  } catch (err) {
    logger.warn('AGENT_EXECUTOR', 'Failed to load subcontractors', { error: String(err) });
    dataGaps.push('Subcontractor data unavailable');
  }

  // Load RFIs
  let rfis: ProjectDataBundle['rfis'] = [];
  try {
    const rfiList = await prisma.rFI.findMany({
      where: { projectId: resolvedProjectId },
      select: {
        id: true,
        rfiNumber: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    rfis = rfiList.map(r => ({
      id: r.id,
      rfiNumber: r.rfiNumber,
      title: r.title,
      status: String(r.status),
      priority: String(r.priority),
      createdAt: r.createdAt,
    }));
  } catch (err) {
    logger.warn('AGENT_EXECUTOR', 'Failed to load RFIs', { error: String(err) });
    dataGaps.push('RFI data unavailable');
  }

  // Load punch list items
  let punchListItems: ProjectDataBundle['punchListItems'] = [];
  try {
    const items = await prisma.punchListItem.findMany({
      where: { projectId: resolvedProjectId },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        location: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    punchListItems = items.map(i => ({
      ...i,
      status: String(i.status),
      priority: i.priority ? String(i.priority) : null,
    }));
  } catch (err) {
    logger.warn('AGENT_EXECUTOR', 'Failed to load punch list', { error: String(err) });
    dataGaps.push('Punch list data unavailable');
  }

  // Load health snapshots (last 10 for trend analysis)
  let healthSnapshots: ProjectDataBundle['healthSnapshots'] = [];
  try {
    healthSnapshots = await prisma.projectHealthSnapshot.findMany({
      where: { projectId: resolvedProjectId },
      select: {
        overallScore: true,
        scheduleScore: true,
        budgetScore: true,
        safetyScore: true,
        qualityScore: true,
        documentScore: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  } catch (err) {
    logger.warn('AGENT_EXECUTOR', 'Failed to load health snapshots', { error: String(err) });
    dataGaps.push('Health snapshot history unavailable');
  }

  // Load invoice summary
  let invoiceSummary: ProjectDataBundle['invoiceSummary'] = {
    totalAmount: 0,
    pendingAmount: 0,
    paidAmount: 0,
    invoiceCount: 0,
  };
  try {
    const allInvoices = await prisma.invoice.findMany({
      where: { projectId: resolvedProjectId },
      select: { amount: true, status: true },
    });
    invoiceSummary = {
      totalAmount: allInvoices.reduce((sum, inv) => sum + inv.amount, 0),
      pendingAmount: allInvoices
        .filter(inv => String(inv.status) === 'PENDING' || String(inv.status) === 'SUBMITTED')
        .reduce((sum, inv) => sum + inv.amount, 0),
      paidAmount: allInvoices
        .filter(inv => String(inv.status) === 'PAID')
        .reduce((sum, inv) => sum + inv.amount, 0),
      invoiceCount: allInvoices.length,
    };
  } catch (err) {
    logger.warn('AGENT_EXECUTOR', 'Failed to load invoices', { error: String(err) });
    dataGaps.push('Invoice data unavailable');
  }

  // Load procurement items
  let procurementItems: ProjectDataBundle['procurementItems'] = [];
  try {
    const items = await prisma.procurement.findMany({
      where: { projectId: resolvedProjectId },
      select: {
        id: true,
        description: true,
        status: true,
        requiredDate: true,
        orderDate: true,
      },
      orderBy: { requiredDate: 'asc' },
      take: 50,
    });
    procurementItems = items.map(p => ({
      id: p.id,
      description: p.description,
      status: String(p.status),
      requiredDate: p.requiredDate,
      orderDate: p.orderDate,
    }));
  } catch (err) {
    logger.warn('AGENT_EXECUTOR', 'Failed to load procurement', { error: String(err) });
    dataGaps.push('Procurement data unavailable');
  }

  return {
    project,
    scheduleCount,
    scheduleTasks,
    milestones,
    budgetSummary,
    changeOrders,
    recentDailyReports,
    laborSummary,
    subcontractors,
    rfis,
    punchListItems,
    healthSnapshots,
    invoiceSummary,
    procurementItems,
    dataGaps,
  };
}

// ─── Agent Executor ────────────────────────────────────────────────

/**
 * Execute an agent health check for a project.
 *
 * 1. Loads the agent markdown definition from ai-intelligence/agents/
 * 2. Gathers project data from Prisma
 * 3. Calls the LLM with agent definition + project data as context
 * 4. Parses structured results from the LLM response
 * 5. Stores results via ActivityLog + ProjectHealthSnapshot
 */
export async function executeAgentCheck(
  agentName: string,
  projectId: string,
  projectSlug: string,
): Promise<AgentExecutionResult> {
  const startTime = Date.now();
  const executedAt = new Date().toISOString();

  logger.info('AGENT_EXECUTOR', `Starting agent: ${agentName}`, { projectId, projectSlug });

  // 1. Load agent definition
  const agentDefinition = loadAgentDefinition(agentName);
  if (!agentDefinition) {
    logger.error('AGENT_EXECUTOR', `Agent definition not found: ${agentName}`);
    return {
      agentName,
      projectId,
      status: 'error',
      alerts: [],
      kpis: [],
      recommendations: [`Agent definition '${agentName}' not found in ai-intelligence/agents/`],
      summary: `Agent ${agentName} could not be loaded. Ensure the ai-intelligence submodule is present.`,
      executedAt,
      durationMs: Date.now() - startTime,
      dataGaps: ['Agent definition missing'],
    };
  }

  // 2. Load project data
  let projectData: ProjectDataBundle;
  try {
    projectData = await getProjectDataForAgent(projectId, projectSlug);
  } catch (err) {
    logger.error('AGENT_EXECUTOR', `Failed to load project data for ${agentName}`, {
      error: String(err),
      projectId,
    });
    return {
      agentName,
      projectId,
      status: 'error',
      alerts: [],
      kpis: [],
      recommendations: ['Project data could not be loaded from database'],
      summary: `Failed to load project data: ${String(err)}`,
      executedAt,
      durationMs: Date.now() - startTime,
      dataGaps: ['All project data unavailable'],
    };
  }

  if (!projectData.project) {
    return {
      agentName,
      projectId,
      status: 'no-data',
      alerts: [],
      kpis: [],
      recommendations: ['Project not found. Verify projectId and projectSlug.'],
      summary: `Project not found for id=${projectId} slug=${projectSlug}`,
      executedAt,
      durationMs: Date.now() - startTime,
      dataGaps: ['Project not found'],
    };
  }

  // 3. Build LLM prompt
  const dataContext = buildDataContext(projectData);
  const systemPrompt = buildSystemPrompt(agentName, agentDefinition);
  const userPrompt = buildUserPrompt(agentName, projectData, dataContext);

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  // 4. Call LLM
  let llmResponse: string;
  try {
    const response = await callLLM(messages, {
      model: SIMPLE_MODEL,
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });
    llmResponse = response.content;
  } catch (err) {
    logger.error('AGENT_EXECUTOR', `LLM call failed for ${agentName}`, {
      error: String(err),
      projectId,
    });
    return {
      agentName,
      projectId,
      status: 'error',
      alerts: [],
      kpis: [],
      recommendations: ['LLM analysis could not be completed'],
      summary: `LLM call failed: ${String(err).substring(0, 200)}`,
      executedAt,
      durationMs: Date.now() - startTime,
      dataGaps: projectData.dataGaps,
    };
  }

  // 5. Parse LLM response
  const result = parseLLMResponse(llmResponse, agentName, projectId, executedAt, startTime, projectData.dataGaps);

  // 6. Store results
  await storeAgentResults(result, projectData.project.id);

  logger.info('AGENT_EXECUTOR', `Agent ${agentName} completed`, {
    projectId,
    alertCount: result.alerts.length,
    status: result.status,
    durationMs: result.durationMs,
  });

  return result;
}

// ─── Prompt Builders ───────────────────────────────────────────────

function buildSystemPrompt(agentName: string, agentDefinition: string): string {
  return [
    'You are an AI agent for ForemanOS, a construction superintendent operating system.',
    `You are executing the "${agentName}" agent analysis.`,
    '',
    '## Agent Definition',
    agentDefinition,
    '',
    '## Response Format',
    'Respond with a JSON object containing:',
    '{',
    '  "status": "success" | "partial" | "no-data",',
    '  "summary": "Brief 1-2 sentence summary of findings",',
    '  "alerts": [{ "severity": 1-5, "category": "string", "title": "string", "description": "string", "dataSource": "string", "metric": "optional", "value": "optional", "threshold": "optional" }],',
    '  "kpis": [{ "name": "string", "value": "number|string", "unit": "optional", "trend": "up|down|flat|mixed", "tier": "optional" }],',
    '  "recommendations": ["string array of actionable recommendations"]',
    '}',
    '',
    'Base your analysis ONLY on the project data provided. If data is insufficient, set status to "partial" or "no-data" and note gaps in the summary.',
    'Severity levels: 1=Info, 2=Advisory, 3=Warning, 4=Elevated, 5=Critical.',
    'Be concise and actionable. The superintendent is reading this on a phone.',
  ].join('\n');
}

function buildUserPrompt(
  agentName: string,
  projectData: ProjectDataBundle,
  dataContext: string,
): string {
  const projectName = projectData.project?.name || 'Unknown Project';
  const todayStr = new Date().toISOString().split('T')[0];

  return [
    `Run the ${agentName} analysis for project "${projectName}" as of ${todayStr}.`,
    '',
    '## Current Project Data',
    dataContext,
    '',
    projectData.dataGaps.length > 0
      ? `## Data Gaps\nThe following data sources are unavailable or empty:\n${projectData.dataGaps.map(g => `- ${g}`).join('\n')}`
      : '## Data Gaps\nAll data sources loaded successfully.',
    '',
    'Analyze the data above and respond with the JSON format specified in your system instructions.',
  ].join('\n');
}

function buildDataContext(data: ProjectDataBundle): string {
  const sections: string[] = [];

  // Project info
  if (data.project) {
    sections.push(`### Project\nName: ${data.project.name}\nSlug: ${data.project.slug}\nStatus: ${data.project.status}\nJob Number: ${data.project.jobNumber || 'N/A'}\nSuperintendent: ${data.project.superintendent || 'N/A'}\nPM: ${data.project.projectManager || 'N/A'}\nClient: ${data.project.clientName || 'N/A'}\nType: ${data.project.projectType || 'N/A'}`);
  }

  // Schedule
  if (data.scheduleTasks.length > 0) {
    const critical = data.scheduleTasks.filter(t => t.isCritical);
    const inProgress = data.scheduleTasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'ACTIVE');
    sections.push(`### Schedule (${data.scheduleCount} tasks)\nCritical path tasks: ${critical.length}\nIn-progress tasks: ${inProgress.length}\nTop tasks:\n${data.scheduleTasks.slice(0, 20).map(t => `- ${t.name} | ${t.status} | ${t.percentComplete}% | Critical: ${t.isCritical}`).join('\n')}`);
  }

  // Milestones
  if (data.milestones.length > 0) {
    sections.push(`### Milestones (${data.milestones.length})\n${data.milestones.map(m => `- ${m.name} | Due: ${m.plannedDate.toISOString().split('T')[0]} | ${m.status} | Critical: ${m.isCritical}`).join('\n')}`);
  }

  // Budget
  if (data.budgetSummary.itemCount > 0) {
    const variance = data.budgetSummary.totalBudgeted > 0
      ? ((data.budgetSummary.totalActual / data.budgetSummary.totalBudgeted) * 100).toFixed(1)
      : 'N/A';
    sections.push(`### Budget\nTotal Budgeted: $${data.budgetSummary.totalBudgeted.toLocaleString()}\nTotal Actual: $${data.budgetSummary.totalActual.toLocaleString()}\nTotal Committed: $${data.budgetSummary.totalCommitted.toLocaleString()}\nBudget Items: ${data.budgetSummary.itemCount}\nSpend Ratio: ${variance}%`);
  }

  // Change orders
  if (data.changeOrders.length > 0) {
    const pending = data.changeOrders.filter(co => co.status === 'PENDING' || co.status === 'UNDER_REVIEW');
    const totalProposed = data.changeOrders.reduce((sum, co) => sum + co.proposedAmount, 0);
    sections.push(`### Change Orders (${data.changeOrders.length})\nPending: ${pending.length}\nTotal Proposed: $${totalProposed.toLocaleString()}\n${data.changeOrders.slice(0, 10).map(co => `- CO-${co.orderNumber}: ${co.title} | ${co.status} | $${co.proposedAmount.toLocaleString()} | Schedule Impact: ${co.scheduleImpactDays ?? 0} days`).join('\n')}`);
  }

  // Daily reports
  if (data.recentDailyReports.length > 0) {
    const totalIncidents = data.recentDailyReports.reduce((sum, r) => sum + r.safetyIncidents, 0);
    const totalDelayHours = data.recentDailyReports.reduce((sum, r) => sum + (r.delayHours || 0), 0);
    sections.push(`### Recent Daily Reports (last 14 days: ${data.recentDailyReports.length})\nSafety Incidents: ${totalIncidents}\nTotal Delay Hours: ${totalDelayHours}\n${data.recentDailyReports.slice(0, 7).map(r => `- ${r.reportDate.toISOString().split('T')[0]} | ${r.status} | Incidents: ${r.safetyIncidents} | Delay: ${r.delayHours || 0}h${r.delayReason ? ` (${r.delayReason})` : ''}`).join('\n')}`);
  }

  // Labor
  if (data.laborSummary.entryCount > 0) {
    sections.push(`### Labor\nTotal Hours: ${data.laborSummary.totalHours.toLocaleString()}\nTotal Cost: $${data.laborSummary.totalCost.toLocaleString()}\nEntries: ${data.laborSummary.entryCount}`);
  }

  // Subcontractors
  if (data.subcontractors.length > 0) {
    sections.push(`### Subcontractors (${data.subcontractors.length})\n${data.subcontractors.map(s => `- ${s.companyName} | Trade: ${s.tradeType} | ${s.isActive ? 'Active' : 'Inactive'}`).join('\n')}`);
  }

  // RFIs
  if (data.rfis.length > 0) {
    const open = data.rfis.filter(r => r.status === 'OPEN' || r.status === 'PENDING');
    sections.push(`### RFIs (${data.rfis.length} total, ${open.length} open)\n${data.rfis.slice(0, 15).map(r => `- RFI-${r.rfiNumber}: ${r.title} | ${r.status} | Priority: ${r.priority}`).join('\n')}`);
  }

  // Punch list
  if (data.punchListItems.length > 0) {
    const open = data.punchListItems.filter(i => i.status === 'OPEN' || i.status === 'IN_PROGRESS');
    sections.push(`### Punch List (${data.punchListItems.length} total, ${open.length} open)\n${data.punchListItems.slice(0, 15).map(i => `- ${i.title} | ${i.status} | Priority: ${i.priority || 'N/A'} | Location: ${i.location || 'N/A'}`).join('\n')}`);
  }

  // Health history
  if (data.healthSnapshots.length > 0) {
    sections.push(`### Health History (last ${data.healthSnapshots.length} snapshots)\n${data.healthSnapshots.map(h => `- ${h.createdAt.toISOString().split('T')[0]} | Overall: ${h.overallScore} | Schedule: ${h.scheduleScore} | Budget: ${h.budgetScore} | Safety: ${h.safetyScore} | Quality: ${h.qualityScore} | Docs: ${h.documentScore}`).join('\n')}`);
  }

  // Invoices
  if (data.invoiceSummary.invoiceCount > 0) {
    sections.push(`### Invoices\nTotal: $${data.invoiceSummary.totalAmount.toLocaleString()} (${data.invoiceSummary.invoiceCount} invoices)\nPending: $${data.invoiceSummary.pendingAmount.toLocaleString()}\nPaid: $${data.invoiceSummary.paidAmount.toLocaleString()}`);
  }

  // Procurement
  if (data.procurementItems.length > 0) {
    sections.push(`### Procurement (${data.procurementItems.length} items)\n${data.procurementItems.slice(0, 15).map(p => `- ${p.description} | ${p.status} | Required: ${p.requiredDate ? p.requiredDate.toISOString().split('T')[0] : 'TBD'} | Ordered: ${p.orderDate ? p.orderDate.toISOString().split('T')[0] : 'Not ordered'}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

// ─── Response Parser ───────────────────────────────────────────────

function parseLLMResponse(
  rawResponse: string,
  agentName: string,
  projectId: string,
  executedAt: string,
  startTime: number,
  dataGaps: string[],
): AgentExecutionResult {
  try {
    const parsed = JSON.parse(rawResponse);

    const alerts: AgentAlert[] = Array.isArray(parsed.alerts)
      ? parsed.alerts.map((a: Record<string, unknown>) => ({
          severity: (typeof a.severity === 'number' && a.severity >= 1 && a.severity <= 5
            ? a.severity
            : 1) as 1 | 2 | 3 | 4 | 5,
          category: String(a.category || 'general'),
          title: String(a.title || 'Untitled Alert'),
          description: String(a.description || ''),
          dataSource: String(a.dataSource || 'unknown'),
          metric: a.metric != null ? String(a.metric) : undefined,
          value: a.value != null ? (typeof a.value === 'number' ? a.value : String(a.value)) : undefined,
          threshold: a.threshold != null ? (typeof a.threshold === 'number' ? a.threshold : String(a.threshold)) : undefined,
        }))
      : [];

    const kpis = Array.isArray(parsed.kpis)
      ? parsed.kpis.map((k: Record<string, unknown>) => ({
          name: String(k.name || 'Unknown'),
          value: k.value != null ? k.value : 'N/A',
          unit: k.unit != null ? String(k.unit) : undefined,
          trend: (['up', 'down', 'flat', 'mixed'].indexOf(String(k.trend)) >= 0
            ? String(k.trend)
            : undefined) as 'up' | 'down' | 'flat' | 'mixed' | undefined,
          tier: k.tier != null ? String(k.tier) : undefined,
        }))
      : [];

    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations.map((r: unknown) => String(r))
      : [];

    const status = (['success', 'partial', 'no-data'].indexOf(String(parsed.status)) >= 0
      ? String(parsed.status)
      : 'success') as 'success' | 'partial' | 'no-data';

    return {
      agentName,
      projectId,
      status,
      alerts,
      kpis,
      recommendations,
      summary: String(parsed.summary || `${agentName} analysis completed.`),
      executedAt,
      durationMs: Date.now() - startTime,
      dataGaps,
    };
  } catch (parseErr) {
    logger.warn('AGENT_EXECUTOR', `Failed to parse LLM response for ${agentName}`, {
      error: String(parseErr),
      responsePreview: rawResponse.substring(0, 200),
    });

    return {
      agentName,
      projectId,
      status: 'partial',
      alerts: [],
      kpis: [],
      recommendations: [],
      summary: rawResponse.substring(0, 500),
      executedAt,
      durationMs: Date.now() - startTime,
      dataGaps,
    };
  }
}

// ─── Result Storage ────────────────────────────────────────────────

/**
 * Store agent results using available Prisma models.
 * Uses ActivityLog for audit trail and ProjectHealthSnapshot for health data.
 */
async function storeAgentResults(
  result: AgentExecutionResult,
  resolvedProjectId: string,
): Promise<void> {
  try {
    // Store in ActivityLog for audit trail
    // Cast to plain JSON to satisfy Prisma's InputJsonValue type
    const detailsJson = JSON.parse(JSON.stringify({
      agentName: result.agentName,
      status: result.status,
      alertCount: result.alerts.length,
      kpiCount: result.kpis.length,
      recommendationCount: result.recommendations.length,
      summary: result.summary,
      durationMs: result.durationMs,
      executedAt: result.executedAt,
      dataGaps: result.dataGaps,
      alerts: result.alerts,
      kpis: result.kpis,
      recommendations: result.recommendations,
    }));
    await prisma.activityLog.create({
      data: {
        action: `agent:${result.agentName}`,
        resource: 'project',
        resourceId: resolvedProjectId,
        details: detailsJson,
      },
    });

    // If this is the project-health-monitor agent, also update ProjectHealthSnapshot
    if (result.agentName === 'project-health-monitor' && result.kpis.length > 0) {
      const getKpiValue = (name: string): number => {
        const kpi = result.kpis.find(k => k.name.toLowerCase().includes(name.toLowerCase()));
        if (!kpi) return 0;
        const num = typeof kpi.value === 'number' ? kpi.value : parseFloat(String(kpi.value));
        return isNaN(num) ? 0 : num;
      };

      const maxSeverity = result.alerts.length > 0
        ? Math.max(...result.alerts.map(a => a.severity))
        : 1;

      // Convert severity 1-5 to health score 0-100 (inverted: 1=100, 5=0)
      const overallScore = Math.max(0, 100 - (maxSeverity - 1) * 25);

      await prisma.projectHealthSnapshot.create({
        data: {
          projectId: resolvedProjectId,
          overallScore,
          scheduleScore: getKpiValue('spi') * 100 || getKpiValue('ppc') || overallScore,
          budgetScore: getKpiValue('cpi') * 100 || overallScore,
          safetyScore: result.alerts.some(a => a.category.toLowerCase().includes('safety') && a.severity >= 4) ? 25 : 100,
          qualityScore: getKpiValue('fpir') > 0 ? Math.max(0, 100 - getKpiValue('fpir')) : overallScore,
          documentScore: overallScore,
          metrics: JSON.parse(JSON.stringify({
            agentName: result.agentName,
            alerts: result.alerts,
            kpis: result.kpis,
            recommendations: result.recommendations,
            dataGaps: result.dataGaps,
          })),
          trend: result.kpis.length > 0
            ? (result.alerts.some(a => a.severity >= 3) ? 'declining' : 'stable')
            : null,
        },
      });
    }
  } catch (err) {
    // Log but don't fail the agent execution
    logger.error('AGENT_EXECUTOR', `Failed to store agent results for ${result.agentName}`, {
      error: String(err),
      projectId: resolvedProjectId,
    });
  }
}
