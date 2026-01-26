/**
 * Project Summary Report Generator
 * Generates comprehensive project status reports in PDF/DOCX
 */

import { prisma } from './db';
import jsPDF from 'jspdf';
import PizZip from 'pizzip';

export interface ProjectSummaryData {
  project: {
    name: string;
    slug: string;
    address?: string;
    clientName?: string;
    projectManager?: string;
    superintendent?: string;
    status: string;
  };
  rooms: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    byType: Record<string, number>;
  };
  schedule: {
    tasks: number;
    completedTasks: number;
    criticalPath: number;
    delayedTasks: number;
  };
  budget?: {
    totalBudget: number;
    actualCost: number;
    variance: number;
    percentSpent: number;
  };
  documents: {
    total: number;
    byCategory: Record<string, number>;
  };
  recentActivity: Array<{
    date: string;
    type: string;
    description: string;
  }>;
  weather?: {
    current: string;
    temp: number;
  };
}

/**
 * Gather all project data for summary report
 */
export async function gatherProjectSummaryData(
  projectId: string
): Promise<ProjectSummaryData> {
  const [project, rooms, schedule, budget, documents, dailyReports] = await Promise.all([
    // Project info
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        name: true,
        slug: true,
        projectAddress: true,
        clientName: true,
        projectManager: true,
        superintendent: true,
        status: true,
        locationCity: true,
        locationState: true,
      },
    }),
    // Rooms
    prisma.room.findMany({
      where: { projectId },
      select: { status: true, type: true },
    }),
    // Schedule
    prisma.schedule.findFirst({
      where: { projectId },
      include: {
        ScheduleTask: {
          select: { status: true, isCritical: true },
        },
      },
    }),
    // Budget
    prisma.projectBudget.findFirst({
      where: { projectId },
    }),
    // Documents
    prisma.document.findMany({
      where: { projectId, deletedAt: null },
      select: { category: true },
    }),
    // Recent daily reports
    prisma.dailyReport.findMany({
      where: { projectId },
      orderBy: { reportDate: 'desc' },
      take: 5,
      select: { reportDate: true, workPerformed: true },
    }),
  ]);

  // Process rooms
  const roomsByStatus = {
    total: rooms.length,
    completed: rooms.filter((r) => r.status === 'completed').length,
    inProgress: rooms.filter((r) => r.status === 'in_progress').length,
    notStarted: rooms.filter((r) => r.status === 'not_started').length,
    byType: rooms.reduce((acc, r) => {
      acc[r.type || 'Other'] = (acc[r.type || 'Other'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  // Process schedule
  const tasks = schedule?.ScheduleTask || [];
  const scheduleStats = {
    tasks: tasks.length,
    completedTasks: tasks.filter((t) => t.status === 'completed').length,
    criticalPath: tasks.filter((t) => t.isCritical).length,
    delayedTasks: tasks.filter((t) => t.status === 'delayed').length,
  };

  // Process budget
  const budgetStats = budget ? {
    totalBudget: budget.totalBudget || 0,
    actualCost: budget.actualCost || 0,
    variance: (budget.totalBudget || 0) - (budget.actualCost || 0),
    percentSpent: budget.totalBudget ? Math.round(((budget.actualCost || 0) / budget.totalBudget) * 100) : 0,
  } : undefined;

  // Process documents
  const docsByCategory = documents.reduce((acc, d) => {
    const cat = d.category || 'Other';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Process activity
  const recentActivity = dailyReports.map((r) => ({
    date: r.reportDate.toISOString().split('T')[0],
    type: 'Daily Report',
    description: r.workPerformed?.substring(0, 100) || 'No summary',
  }));

  return {
    project: {
      name: project?.name || 'Unknown Project',
      slug: project?.slug || '',
      address: project?.projectAddress || `${project?.locationCity || ''}, ${project?.locationState || ''}`.trim() || undefined,
      clientName: project?.clientName || undefined,
      projectManager: project?.projectManager || undefined,
      superintendent: project?.superintendent || undefined,
      status: project?.status || 'active',
    },
    rooms: roomsByStatus,
    schedule: scheduleStats,
    budget: budgetStats,
    documents: {
      total: documents.length,
      byCategory: docsByCategory,
    },
    recentActivity,
  };
}

/**
 * Generate PDF summary report
 */
export async function generateProjectSummaryPDF(
  data: ProjectSummaryData
): Promise<Blob> {
  const pdf = new jsPDF('p', 'mm', 'letter');
  const pageWidth = 215.9;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  // Title
  pdf.setFillColor(0, 59, 113);
  pdf.rect(0, 0, pageWidth, 40, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Project Summary Report', pageWidth / 2, 20, { align: 'center' });
  pdf.setFontSize(14);
  pdf.text(data.project.name, pageWidth / 2, 32, { align: 'center' });
  pdf.setTextColor(0, 0, 0);
  y = 55;

  // Project Info
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Project Information', margin, y);
  y += 7;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  const infoLines = [
    ['Status:', data.project.status.toUpperCase()],
    ...(data.project.address ? [['Location:', data.project.address]] : []),
    ...(data.project.clientName ? [['Client:', data.project.clientName]] : []),
    ...(data.project.projectManager ? [['PM:', data.project.projectManager]] : []),
    ...(data.project.superintendent ? [['Super:', data.project.superintendent]] : []),
    ['Generated:', new Date().toLocaleDateString()],
  ];
  
  infoLines.forEach(([label, value]) => {
    pdf.setFont('helvetica', 'bold');
    pdf.text(label as string, margin, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(value as string, margin + 30, y);
    y += 5;
  });
  y += 10;

  // Room Summary
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Room Summary', margin, y);
  y += 7;
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Total Rooms: ${data.rooms.total}`, margin, y);
  pdf.setTextColor(34, 197, 94); // green
  pdf.text(`Completed: ${data.rooms.completed}`, margin + 50, y);
  pdf.setTextColor(59, 130, 246); // blue
  pdf.text(`In Progress: ${data.rooms.inProgress}`, margin + 100, y);
  pdf.setTextColor(156, 163, 175); // gray
  pdf.text(`Not Started: ${data.rooms.notStarted}`, margin + 150, y);
  pdf.setTextColor(0, 0, 0);
  y += 10;

  // Progress bar
  const progress = data.rooms.total > 0 
    ? Math.round((data.rooms.completed / data.rooms.total) * 100) 
    : 0;
  pdf.setFillColor(229, 231, 235);
  pdf.roundedRect(margin, y, contentWidth, 8, 2, 2, 'F');
  pdf.setFillColor(34, 197, 94);
  pdf.roundedRect(margin, y, (contentWidth * progress) / 100, 8, 2, 2, 'F');
  pdf.setFontSize(8);
  pdf.text(`${progress}% Complete`, pageWidth / 2, y + 5.5, { align: 'center' });
  y += 15;

  // Schedule Summary
  if (data.schedule.tasks > 0) {
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Schedule Summary', margin, y);
    y += 7;
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Total Tasks: ${data.schedule.tasks}`, margin, y);
    pdf.text(`Completed: ${data.schedule.completedTasks}`, margin + 50, y);
    pdf.text(`Critical Path: ${data.schedule.criticalPath}`, margin + 100, y);
    if (data.schedule.delayedTasks > 0) {
      pdf.setTextColor(239, 68, 68); // red
      pdf.text(`Delayed: ${data.schedule.delayedTasks}`, margin + 150, y);
      pdf.setTextColor(0, 0, 0);
    }
    y += 12;
  }

  // Budget Summary
  if (data.budget) {
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Budget Summary', margin, y);
    y += 7;
    
    const formatCurrency = (n: number) => `$${n.toLocaleString()}`;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Budget: ${formatCurrency(data.budget.totalBudget)}`, margin, y);
    pdf.text(`Spent: ${formatCurrency(data.budget.actualCost)}`, margin + 60, y);
    const variance = data.budget.variance;
    pdf.setTextColor(variance >= 0 ? 34 : 239, variance >= 0 ? 197 : 68, variance >= 0 ? 94 : 68);
    pdf.text(`Variance: ${formatCurrency(Math.abs(variance))} ${variance >= 0 ? 'under' : 'over'}`, margin + 120, y);
    pdf.setTextColor(0, 0, 0);
    y += 12;
  }

  // Documents
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Documents', margin, y);
  y += 7;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Total Documents: ${data.documents.total}`, margin, y);
  y += 5;
  Object.entries(data.documents.byCategory).slice(0, 5).forEach(([cat, count]) => {
    pdf.text(`• ${cat}: ${count}`, margin + 5, y);
    y += 4;
  });
  y += 8;

  // Recent Activity
  if (data.recentActivity.length > 0) {
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Recent Activity', margin, y);
    y += 7;
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    data.recentActivity.forEach((activity) => {
      pdf.text(`${activity.date}: ${activity.description}`, margin, y);
      y += 4;
    });
  }

  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(128, 128, 128);
  pdf.text('Generated by ForemanOS', pageWidth / 2, 270, { align: 'center' });

  return pdf.output('blob');
}

/**
 * Generate DOCX summary report
 */
export async function generateProjectSummaryDOCX(
  data: ProjectSummaryData
): Promise<Blob> {
  const today = new Date().toLocaleDateString();
  const progress = data.rooms.total > 0 
    ? Math.round((data.rooms.completed / data.rooms.total) * 100) 
    : 0;

  const escapeXml = (str: string) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  let bodyXml = `
    <w:p>
      <w:pPr><w:pStyle w:val="Title"/><w:jc w:val="center"/></w:pPr>
      <w:r><w:t>Project Summary Report</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="32"/></w:rPr><w:t>${escapeXml(data.project.name)}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:t>Generated: ${today}</w:t></w:r>
    </w:p>
    <w:p/>
    
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Project Information</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Status: </w:t></w:r><w:r><w:t>${escapeXml(data.project.status.toUpperCase())}</w:t></w:r></w:p>
    ${data.project.address ? `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Location: </w:t></w:r><w:r><w:t>${escapeXml(data.project.address)}</w:t></w:r></w:p>` : ''}
    ${data.project.clientName ? `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Client: </w:t></w:r><w:r><w:t>${escapeXml(data.project.clientName)}</w:t></w:r></w:p>` : ''}
    ${data.project.projectManager ? `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Project Manager: </w:t></w:r><w:r><w:t>${escapeXml(data.project.projectManager)}</w:t></w:r></w:p>` : ''}
    ${data.project.superintendent ? `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Superintendent: </w:t></w:r><w:r><w:t>${escapeXml(data.project.superintendent)}</w:t></w:r></w:p>` : ''}
    <w:p/>
    
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Room Summary</w:t></w:r></w:p>
    <w:p><w:r><w:t>Total Rooms: ${data.rooms.total} | Completed: ${data.rooms.completed} | In Progress: ${data.rooms.inProgress} | Not Started: ${data.rooms.notStarted}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/><w:color w:val="22C55E"/></w:rPr><w:t>Overall Progress: ${progress}%</w:t></w:r></w:p>
    <w:p/>`;

  if (data.schedule.tasks > 0) {
    bodyXml += `
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Schedule Summary</w:t></w:r></w:p>
    <w:p><w:r><w:t>Total Tasks: ${data.schedule.tasks} | Completed: ${data.schedule.completedTasks} | Critical Path: ${data.schedule.criticalPath}${data.schedule.delayedTasks > 0 ? ` | Delayed: ${data.schedule.delayedTasks}` : ''}</w:t></w:r></w:p>
    <w:p/>`;
  }

  if (data.budget) {
    const formatCurrency = (n: number) => `$${n.toLocaleString()}`;
    const variance = data.budget.variance;
    bodyXml += `
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Budget Summary</w:t></w:r></w:p>
    <w:p><w:r><w:t>Budget: ${formatCurrency(data.budget.totalBudget)} | Spent: ${formatCurrency(data.budget.actualCost)} (${data.budget.percentSpent}%)</w:t></w:r></w:p>
    <w:p><w:r><w:t>Variance: ${formatCurrency(Math.abs(variance))} ${variance >= 0 ? 'under budget' : 'over budget'}</w:t></w:r></w:p>
    <w:p/>`;
  }

  bodyXml += `
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Documents</w:t></w:r></w:p>
    <w:p><w:r><w:t>Total Documents: ${data.documents.total}</w:t></w:r></w:p>
    ${Object.entries(data.documents.byCategory).slice(0, 8).map(([cat, count]) => 
      `<w:p><w:r><w:t>• ${escapeXml(cat)}: ${count}</w:t></w:r></w:p>`
    ).join('')}
    <w:p/>`;

  if (data.recentActivity.length > 0) {
    bodyXml += `
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Recent Activity</w:t></w:r></w:p>
    ${data.recentActivity.map(a => 
      `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${a.date}: </w:t></w:r><w:r><w:t>${escapeXml(a.description)}</w:t></w:r></w:p>`
    ).join('')}`;
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${bodyXml}</w:body>
</w:document>`;

  const zip = new PizZip();
  zip.file('[Content_Types].xml', getContentTypes());
  zip.file('_rels/.rels', getRels());
  zip.file('word/_rels/document.xml.rels', getDocumentRels());
  zip.file('word/document.xml', documentXml);
  zip.file('word/styles.xml', getStyles());

  return zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

// DOCX helpers
function getContentTypes(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
}

function getRels(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function getDocumentRels(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function getStyles(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:rPr><w:b/><w:sz w:val="48"/><w:color w:val="003B71"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Heading 1"/>
    <w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="003B71"/></w:rPr>
  </w:style>
</w:styles>`;
}
