// Export Service - CSV exports for project data
import { format } from 'date-fns';
import { prisma } from './db';
// Types are inferred from Prisma queries

// Types for export data
interface ExportOptions {
  format: 'pdf' | 'excel' | 'csv';
  includeCharts?: boolean;
  dateRange?: { start: Date; end: Date };
}

interface TableData {
  headers: string[];
  rows: (string | number)[][];
}

// Generate CSV content from table data
export function generateCSV(data: TableData): string {
  const escapeCSV = (value: string | number): string => {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = data.headers.map(escapeCSV).join(',');
  const dataRows = data.rows.map(row => row.map(escapeCSV).join(','));
  
  return [headerRow, ...dataRows].join('\n');
}

// Export Daily Reports
export async function exportDailyReports(
  projectId: string,
  options: ExportOptions
): Promise<{ content: string; filename: string; mimeType: string }> {
  const whereClause: Record<string, unknown> = { projectId };
  
  if (options.dateRange) {
    whereClause.reportDate = {
      gte: options.dateRange.start,
      lte: options.dateRange.end
    };
  }

  const reports = await prisma.dailyReport.findMany({
    where: whereClause,
    orderBy: { reportDate: 'desc' }
  });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true }
  });

  const headers = [
    'Date',
    'Report #',
    'Status',
    'Weather',
    'Temp High',
    'Temp Low',
    'Precipitation',
    'Work Performed',
    'Safety Incidents',
    'Delays',
    'Weather Notes'
  ];

  const rows = reports.map((report) => [
    format(report.reportDate, 'yyyy-MM-dd'),
    report.reportNumber || '',
    report.status || '',
    report.weatherCondition || 'N/A',
    report.temperatureHigh ? `${report.temperatureHigh}°F` : 'N/A',
    report.temperatureLow ? `${report.temperatureLow}°F` : 'N/A',
    report.precipitation ? `${report.precipitation} in` : '0',
    report.workPerformed || '',
    report.safetyIncidents || 0,
    report.delaysEncountered || '',
    report.weatherNotes || ''
  ]);

  const csv = generateCSV({ headers, rows });
  const filename = `${project?.name || 'Project'}_Daily_Reports_${format(new Date(), 'yyyy-MM-dd')}.csv`;

  return {
    content: csv,
    filename,
    mimeType: 'text/csv'
  };
}

// Export Budget Data
export async function exportBudget(
  projectId: string,
  _options: ExportOptions
): Promise<{ content: string; filename: string; mimeType: string }> {
  const budget = await prisma.projectBudget.findFirst({
    where: { projectId },
    include: {
      BudgetItem: {
        orderBy: { costCode: 'asc' }
      }
    }
  });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true }
  });

  if (!budget) {
    return {
      content: 'No budget data available',
      filename: `${project?.name || 'Project'}_Budget.csv`,
      mimeType: 'text/csv'
    };
  }

  const headers = [
    'Cost Code',
    'Name',
    'Trade Type',
    'Budgeted Amount',
    'Committed Cost',
    'Actual Cost',
    'Remaining',
    'Variance %'
  ];

  const rows = (budget.BudgetItem || []).map((item) => {
    const remaining = item.budgetedAmount - (item.actualCost || 0);
    const variance = item.budgetedAmount > 0 
      ? ((remaining / item.budgetedAmount) * 100).toFixed(1)
      : '0';
    
    return [
      item.costCode || '',
      item.name,
      item.tradeType || 'N/A',
      `$${item.budgetedAmount.toLocaleString()}`,
      `$${(item.committedCost || 0).toLocaleString()}`,
      `$${(item.actualCost || 0).toLocaleString()}`,
      `$${remaining.toLocaleString()}`,
      `${variance}%`
    ];
  });

  // Add totals row
  const totals = (budget.BudgetItem || []).reduce((acc: { budgeted: number; committed: number; actual: number }, item) => ({
    budgeted: acc.budgeted + item.budgetedAmount,
    committed: acc.committed + (item.committedCost || 0),
    actual: acc.actual + (item.actualCost || 0)
  }), { budgeted: 0, committed: 0, actual: 0 });

  rows.push([
    'TOTAL',
    '',
    '',
    `$${totals.budgeted.toLocaleString()}`,
    `$${totals.committed.toLocaleString()}`,
    `$${totals.actual.toLocaleString()}`,
    `$${(totals.budgeted - totals.actual).toLocaleString()}`,
    totals.budgeted > 0 ? `${(((totals.budgeted - totals.actual) / totals.budgeted) * 100).toFixed(1)}%` : '0%'
  ]);

  const csv = generateCSV({ headers, rows });

  return {
    content: csv,
    filename: `${project?.name || 'Project'}_Budget_${format(new Date(), 'yyyy-MM-dd')}.csv`,
    mimeType: 'text/csv'
  };
}

// Export Schedule Data
export async function exportSchedule(
  projectId: string,
  _options: ExportOptions
): Promise<{ content: string; filename: string; mimeType: string }> {
  const schedule = await prisma.schedule.findFirst({
    where: { projectId },
    include: {
      ScheduleTask: {
        orderBy: [{ startDate: 'asc' }, { name: 'asc' }]
      }
    }
  });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true }
  });

  if (!schedule) {
    return {
      content: 'No schedule data available',
      filename: `${project?.name || 'Project'}_Schedule.csv`,
      mimeType: 'text/csv'
    };
  }

  const headers = [
    'Task ID',
    'Task Name',
    'Start Date',
    'End Date',
    'Duration (days)',
    'Progress %',
    'Status',
    'Critical Path',
    'Float (days)',
    'Predecessors'
  ];

  const rows = (schedule.ScheduleTask || []).map((task) => [
    task.taskId || '',
    task.name,
    task.startDate ? format(task.startDate, 'yyyy-MM-dd') : 'TBD',
    task.endDate ? format(task.endDate, 'yyyy-MM-dd') : 'TBD',
    task.duration || 0,
    task.percentComplete || 0,
    task.status,
    task.isCritical ? 'Yes' : 'No',
    task.totalFloat || 0,
    (task.predecessors || []).join(', ')
  ]);

  const csv = generateCSV({ headers, rows });

  return {
    content: csv,
    filename: `${project?.name || 'Project'}_Schedule_${format(new Date(), 'yyyy-MM-dd')}.csv`,
    mimeType: 'text/csv'
  };
}

// Export MEP Equipment
export async function exportMEPEquipment(
  projectId: string,
  _options: ExportOptions
): Promise<{ content: string; filename: string; mimeType: string }> {
  const equipment = await prisma.mEPEquipment.findMany({
    where: { projectId },
    orderBy: [{ equipmentType: 'asc' }, { equipmentTag: 'asc' }]
  });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true }
  });

  const headers = [
    'Equipment Tag',
    'Name',
    'Type',
    'Status',
    'Manufacturer',
    'Model',
    'Location',
    'Level',
    'Estimated Cost',
    'Actual Cost',
    'Installation Date',
    'Warranty Expires'
  ];

  const rows = equipment.map((eq) => [
    eq.equipmentTag,
    eq.name,
    eq.equipmentType,
    eq.status,
    eq.manufacturer || 'N/A',
    eq.model || 'N/A',
    eq.gridLocation || 'N/A',
    eq.level || 'N/A',
    eq.estimatedCost ? `$${eq.estimatedCost.toLocaleString()}` : 'N/A',
    eq.actualCost ? `$${eq.actualCost.toLocaleString()}` : 'N/A',
    eq.installationDate ? format(eq.installationDate, 'yyyy-MM-dd') : 'N/A',
    eq.warrantyExpires ? format(eq.warrantyExpires, 'yyyy-MM-dd') : 'N/A'
  ]);

  const csv = generateCSV({ headers, rows });

  return {
    content: csv,
    filename: `${project?.name || 'Project'}_MEP_Equipment_${format(new Date(), 'yyyy-MM-dd')}.csv`,
    mimeType: 'text/csv'
  };
}

// Export Change Orders
export async function exportChangeOrders(
  projectId: string,
  _options: ExportOptions
): Promise<{ content: string; filename: string; mimeType: string }> {
  const changeOrders = await prisma.changeOrder.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' }
  });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true }
  });

  const headers = [
    'CO Number',
    'Title',
    'Status',
    'Proposed Amount',
    'Approved Amount',
    'Schedule Impact (days)',
    'Submitted Date',
    'Approved Date',
    'Reason',
    'Description'
  ];

  const rows = changeOrders.map((co) => [
    co.orderNumber,
    co.title,
    co.status,
    `$${co.proposedAmount.toLocaleString()}`,
    co.approvedAmount ? `$${co.approvedAmount.toLocaleString()}` : 'Pending',
    co.scheduleImpactDays || 0,
    format(co.createdAt, 'yyyy-MM-dd'),
    co.approvedDate ? format(co.approvedDate, 'yyyy-MM-dd') : 'Pending',
    co.requestedBy || 'N/A',
    co.description || ''
  ]);

  // Add summary
  const approved = changeOrders.filter((co) => co.status === 'APPROVED');
  const totalApproved = approved.reduce((sum: number, co) => sum + (co.approvedAmount || 0), 0);
  const totalProposed = changeOrders.reduce((sum: number, co) => sum + co.proposedAmount, 0);

  rows.push(['', '', '', '', '', '', '', '', '', '']);
  rows.push(['SUMMARY', '', '', '', '', '', '', '', '', '']);
  rows.push(['Total Proposed:', `$${totalProposed.toLocaleString()}`, '', '', '', '', '', '', '', '']);
  rows.push(['Total Approved:', `$${totalApproved.toLocaleString()}`, '', '', '', '', '', '', '', '']);
  rows.push(['Pending Count:', changeOrders.filter((co) => co.status === 'PENDING' || co.status === 'UNDER_REVIEW').length.toString(), '', '', '', '', '', '', '', '']);

  const csv = generateCSV({ headers, rows });

  return {
    content: csv,
    filename: `${project?.name || 'Project'}_Change_Orders_${format(new Date(), 'yyyy-MM-dd')}.csv`,
    mimeType: 'text/csv'
  };
}

// Export Crews and Performance
export async function exportCrewPerformance(
  projectId: string,
  options: ExportOptions
): Promise<{ content: string; filename: string; mimeType: string }> {
  const whereClause: Record<string, unknown> = {};
  
  if (options.dateRange) {
    whereClause.date = {
      gte: options.dateRange.start,
      lte: options.dateRange.end
    };
  }

  const crews = await prisma.crew.findMany({
    where: { projectId },
    include: {
      CrewPerformance: {
        where: whereClause,
        orderBy: { date: 'desc' }
      }
    }
  });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true }
  });

  const headers = [
    'Crew Name',
    'Trade Type',
    'Foreman',
    'Average Size',
    'Avg Productivity Rate',
    'Total Hours Worked',
    'Quality Issues',
    'Safety Incidents',
    'Status'
  ];

  const rows = crews.map((crew) => {
    const performances = crew.CrewPerformance || [];
    const avgProductivity = performances.length > 0
      ? (performances.reduce((sum: number, p) => sum + (p.productivityRate || 0), 0) / performances.length).toFixed(1)
      : 'N/A';
    const totalHours = performances.reduce((sum: number, p) => sum + (p.hoursWorked || 0), 0);
    const qualityIssues = performances.reduce((sum: number, p) => sum + (p.qualityIssues || 0), 0);
    const safetyIncidents = performances.reduce((sum: number, p) => sum + (p.safetyIncidents || 0), 0);

    return [
      crew.name,
      crew.tradeType || 'N/A',
      crew.foremanName || 'N/A',
      crew.averageSize || 0,
      avgProductivity,
      totalHours,
      qualityIssues,
      safetyIncidents,
      crew.isActive ? 'Active' : 'Inactive'
    ];
  });

  const csv = generateCSV({ headers, rows });

  return {
    content: csv,
    filename: `${project?.name || 'Project'}_Crew_Performance_${format(new Date(), 'yyyy-MM-dd')}.csv`,
    mimeType: 'text/csv'
  };
}

// Master export function
export async function exportProjectData(
  projectId: string,
  exportType: 'daily_reports' | 'budget' | 'schedule' | 'mep' | 'change_orders' | 'crew_performance',
  options: ExportOptions
): Promise<{ content: string; filename: string; mimeType: string }> {
  switch (exportType) {
    case 'daily_reports':
      return exportDailyReports(projectId, options);
    case 'budget':
      return exportBudget(projectId, options);
    case 'schedule':
      return exportSchedule(projectId, options);
    case 'mep':
      return exportMEPEquipment(projectId, options);
    case 'change_orders':
      return exportChangeOrders(projectId, options);
    case 'crew_performance':
      return exportCrewPerformance(projectId, options);
    default:
      throw new Error(`Unknown export type: ${exportType}`);
  }
}
