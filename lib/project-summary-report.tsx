/**
 * Project Summary Report Generator
 * Generates comprehensive project status reports in PDF/DOCX
 * Migrated from jspdf to @react-pdf/renderer for PDF generation
 */

import { prisma } from './db';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
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

// PDF Styles using @react-pdf/renderer
const pdfStyles = StyleSheet.create({
  page: {
    padding: 42,
    fontFamily: 'Helvetica',
    fontSize: 10,
  },
  header: {
    backgroundColor: '#003B71',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 110,
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  headerProject: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  content: {
    marginTop: 130,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginTop: 10,
    marginBottom: 7,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 5,
    fontSize: 10,
  },
  infoLabel: {
    fontFamily: 'Helvetica-Bold',
    width: 100,
  },
  infoValue: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    fontSize: 10,
  },
  statItem: {
    flex: 1,
  },
  progressBar: {
    height: 22,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 15,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 22,
    backgroundColor: '#22C55E',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    position: 'absolute',
  },
  listItem: {
    fontSize: 10,
    marginBottom: 4,
  },
  activityItem: {
    fontSize: 9,
    marginBottom: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 8,
    color: '#808080',
  },
});

// Header Component
const ReportHeader: React.FC<{ data: ProjectSummaryData }> = ({ data }) => (
  <View style={pdfStyles.header} fixed>
    <Text style={pdfStyles.headerTitle}>Project Summary Report</Text>
    <Text style={pdfStyles.headerProject}>{data.project.name}</Text>
  </View>
);

// Project Info Section
const ProjectInfo: React.FC<{ data: ProjectSummaryData }> = ({ data }) => {
  const infoLines: [string, string][] = [
    ['Status:', data.project.status.toUpperCase()],
    ...(data.project.address ? [['Location:', data.project.address]] as [string, string][] : []),
    ...(data.project.clientName ? [['Client:', data.project.clientName]] as [string, string][] : []),
    ...(data.project.projectManager ? [['PM:', data.project.projectManager]] as [string, string][] : []),
    ...(data.project.superintendent ? [['Super:', data.project.superintendent]] as [string, string][] : []),
    ['Generated:', new Date().toLocaleDateString()],
  ];

  return (
    <View>
      <Text style={pdfStyles.sectionTitle}>Project Information</Text>
      {infoLines.map(([label, value], idx) => (
        <View key={idx} style={pdfStyles.infoRow}>
          <Text style={pdfStyles.infoLabel}>{label}</Text>
          <Text style={pdfStyles.infoValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
};

// Room Summary Section
const RoomSummary: React.FC<{ data: ProjectSummaryData }> = ({ data }) => {
  const progress = data.rooms.total > 0
    ? Math.round((data.rooms.completed / data.rooms.total) * 100)
    : 0;

  return (
    <View>
      <Text style={pdfStyles.sectionTitle}>Room Summary</Text>
      <View style={pdfStyles.statsRow}>
        <Text style={pdfStyles.statItem}>Total Rooms: {data.rooms.total}</Text>
        <Text style={{ ...pdfStyles.statItem, color: '#22C55E' }}>
          Completed: {data.rooms.completed}
        </Text>
        <Text style={{ ...pdfStyles.statItem, color: '#3B82F6' }}>
          In Progress: {data.rooms.inProgress}
        </Text>
        <Text style={{ ...pdfStyles.statItem, color: '#9CA3AF' }}>
          Not Started: {data.rooms.notStarted}
        </Text>
      </View>
      <View style={pdfStyles.progressBar}>
        <View style={{ ...pdfStyles.progressFill, width: `${progress}%` }} />
        <Text style={pdfStyles.progressText}>{progress}% Complete</Text>
      </View>
    </View>
  );
};

// Schedule Summary Section
const ScheduleSummary: React.FC<{ data: ProjectSummaryData }> = ({ data }) => {
  if (data.schedule.tasks === 0) return null;

  return (
    <View>
      <Text style={pdfStyles.sectionTitle}>Schedule Summary</Text>
      <View style={pdfStyles.statsRow}>
        <Text style={pdfStyles.statItem}>Total Tasks: {data.schedule.tasks}</Text>
        <Text style={pdfStyles.statItem}>Completed: {data.schedule.completedTasks}</Text>
        <Text style={pdfStyles.statItem}>Critical Path: {data.schedule.criticalPath}</Text>
        {data.schedule.delayedTasks > 0 && (
          <Text style={{ ...pdfStyles.statItem, color: '#EF4444' }}>
            Delayed: {data.schedule.delayedTasks}
          </Text>
        )}
      </View>
    </View>
  );
};

// Budget Summary Section
const BudgetSummary: React.FC<{ data: ProjectSummaryData }> = ({ data }) => {
  if (!data.budget) return null;

  const formatCurrency = (n: number) => `$${n.toLocaleString()}`;
  const variance = data.budget.variance;

  return (
    <View>
      <Text style={pdfStyles.sectionTitle}>Budget Summary</Text>
      <View style={pdfStyles.statsRow}>
        <Text style={pdfStyles.statItem}>
          Budget: {formatCurrency(data.budget.totalBudget)}
        </Text>
        <Text style={pdfStyles.statItem}>
          Spent: {formatCurrency(data.budget.actualCost)}
        </Text>
        <Text style={{ ...pdfStyles.statItem, color: variance >= 0 ? '#22C55E' : '#EF4444' }}>
          Variance: {formatCurrency(Math.abs(variance))} {variance >= 0 ? 'under' : 'over'}
        </Text>
      </View>
    </View>
  );
};

// Documents Section
const DocumentsSummary: React.FC<{ data: ProjectSummaryData }> = ({ data }) => (
  <View>
    <Text style={pdfStyles.sectionTitle}>Documents</Text>
    <Text style={pdfStyles.listItem}>Total Documents: {data.documents.total}</Text>
    {Object.entries(data.documents.byCategory)
      .slice(0, 5)
      .map(([cat, count], idx) => (
        <Text key={idx} style={pdfStyles.listItem}>
          • {cat}: {count}
        </Text>
      ))}
  </View>
);

// Recent Activity Section
const RecentActivity: React.FC<{ data: ProjectSummaryData }> = ({ data }) => {
  if (data.recentActivity.length === 0) return null;

  return (
    <View>
      <Text style={pdfStyles.sectionTitle}>Recent Activity</Text>
      {data.recentActivity.map((activity, idx) => (
        <Text key={idx} style={pdfStyles.activityItem}>
          {activity.date}: {activity.description}
        </Text>
      ))}
    </View>
  );
};

// Footer Component
const ReportFooter: React.FC = () => (
  <Text style={pdfStyles.footer} fixed>
    Generated by ForemanOS
  </Text>
);

// Main PDF Document
const ProjectSummaryDocument: React.FC<{ data: ProjectSummaryData }> = ({ data }) => (
  <Document>
    <Page size="LETTER" style={pdfStyles.page}>
      <ReportHeader data={data} />
      <View style={pdfStyles.content}>
        <ProjectInfo data={data} />
        <RoomSummary data={data} />
        <ScheduleSummary data={data} />
        <BudgetSummary data={data} />
        <DocumentsSummary data={data} />
        <RecentActivity data={data} />
      </View>
      <ReportFooter />
    </Page>
  </Document>
);

/**
 * Generate PDF summary report using @react-pdf/renderer
 */
export async function generateProjectSummaryPDF(
  data: ProjectSummaryData
): Promise<Blob> {
  const doc = <ProjectSummaryDocument data={data} />;
  const blob = await pdf(doc).toBlob();
  return blob;
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
