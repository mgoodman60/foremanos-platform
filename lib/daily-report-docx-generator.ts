/**
 * Daily Report DOCX Generator
 * Client-side DOCX generation for editable daily field reports
 * Matches the PDF formatting but in an editable Word format
 */

import PizZip from 'pizzip';

// Input types for formatDailyReportForExport
interface ReportInput {
  id: string;
  reportNumber: number;
  reportDate: Date;
  status: string;
  createdByUser?: { username?: string; name?: string };
  submittedAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;
  weatherCondition?: string;
  temperatureHigh?: number;
  temperatureLow?: number;
  humidity?: number;
  precipitation?: number;
  windSpeed?: number;
  weatherNotes?: string;
  workPerformed?: string;
  workPlanned?: string;
  delaysEncountered?: string;
  delayHours?: number;
  delayReason?: string;
  safetyIncidents?: number;
  safetyNotes?: string;
  materialsReceived?: Array<{ description?: string; quantity?: string | number; supplier?: string }>;
  visitors?: Array<{ name?: string; company?: string; timeIn?: string; timeOut?: string }>;
}

interface ProjectInput {
  name: string;
  slug: string;
  address?: string;
  clientName?: string;
}

interface LaborEntry {
  trade?: string;
  subcontractor?: string;
  headcount?: number;
  hoursWorked?: number;
  hourlyRate?: number;
  notes?: string;
}

interface EquipmentEntry {
  equipmentName?: string;
  name?: string;
  hoursUsed?: number;
  hours?: number;
  status?: string;
  notes?: string;
}

interface ProgressEntry {
  area?: string;
  location?: string;
  activity?: string;
  description?: string;
  percentComplete?: number;
  notes?: string;
}

export interface DailyReportData {
  project: {
    name: string;
    slug: string;
    address?: string;
    clientName?: string;
  };
  report: {
    id: string;
    reportNumber: number;
    reportDate: string;
    status: string;
    createdBy?: string;
    submittedAt?: string;
    approvedAt?: string;
    approvedBy?: string;
  };
  weather: {
    condition?: string;
    temperatureHigh?: number;
    temperatureLow?: number;
    humidity?: number;
    precipitation?: number;
    windSpeed?: number;
    notes?: string;
  };
  workSummary: {
    workPerformed?: string;
    workPlanned?: string;
    delaysEncountered?: string;
    delayHours?: number;
    delayReason?: string;
  };
  safety: {
    incidents: number;
    notes?: string;
  };
  labor: Array<{
    trade: string;
    subcontractor?: string;
    headcount: number;
    hoursWorked: number;
    hourlyRate?: number;
    notes?: string;
  }>;
  equipment: Array<{
    name: string;
    hours: number;
    status: string;
    notes?: string;
  }>;
  materials: Array<{
    description: string;
    quantity: string;
    supplier?: string;
  }>;
  visitors: Array<{
    name: string;
    company?: string;
    timeIn?: string;
    timeOut?: string;
  }>;
  progress: Array<{
    area: string;
    activity: string;
    percentComplete: number;
    notes?: string;
  }>;
  photos: Array<{
    url: string;
    caption?: string;
  }>;
  exportedAt: string;
}

/**
 * Generate Daily Report DOCX
 */
export async function generateDailyReportDOCX(data: DailyReportData): Promise<Blob> {
  const reportDate = new Date(data.report.reportDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const exportDate = new Date(data.exportedAt).toLocaleDateString();

  // Build content sections
  const sections: string[] = [];

  // Header
  sections.push(`DAILY FIELD REPORT #${data.report.reportNumber}`);
  sections.push(`Project: ${data.project.name}`);
  sections.push(`Date: ${reportDate}`);
  sections.push(`Status: ${data.report.status}`);
  if (data.project.address) sections.push(`Location: ${data.project.address}`);
  sections.push(`Exported: ${exportDate}`);
  sections.push('');

  // Weather Section
  sections.push('=== WEATHER CONDITIONS ===');
  if (data.weather.condition) sections.push(`Condition: ${data.weather.condition}`);
  if (data.weather.temperatureHigh !== undefined && data.weather.temperatureLow !== undefined) {
    sections.push(`Temperature: ${data.weather.temperatureLow}°F - ${data.weather.temperatureHigh}°F`);
  }
  if (data.weather.humidity !== undefined) sections.push(`Humidity: ${data.weather.humidity}%`);
  if (data.weather.precipitation !== undefined) sections.push(`Precipitation: ${data.weather.precipitation}"`);
  if (data.weather.windSpeed !== undefined) sections.push(`Wind: ${data.weather.windSpeed} mph`);
  if (data.weather.notes) sections.push(`Notes: ${data.weather.notes}`);
  sections.push('');

  // Work Summary Section
  sections.push('=== WORK SUMMARY ===');
  if (data.workSummary.workPerformed) {
    sections.push('Work Performed Today:');
    sections.push(data.workSummary.workPerformed);
    sections.push('');
  }
  if (data.workSummary.workPlanned) {
    sections.push('Work Planned for Tomorrow:');
    sections.push(data.workSummary.workPlanned);
    sections.push('');
  }
  if (data.workSummary.delaysEncountered) {
    sections.push('Delays Encountered:');
    sections.push(data.workSummary.delaysEncountered);
    if (data.workSummary.delayHours) sections.push(`Delay Impact: ${data.workSummary.delayHours} hours`);
    if (data.workSummary.delayReason) sections.push(`Reason: ${data.workSummary.delayReason}`);
    sections.push('');
  }

  // Safety Section
  sections.push('=== SAFETY ===');
  sections.push(`Incidents: ${data.safety.incidents}`);
  if (data.safety.notes) sections.push(`Notes: ${data.safety.notes}`);
  sections.push('');

  // Labor Section
  if (data.labor.length > 0) {
    const totalHeadcount = data.labor.reduce((sum, l) => sum + l.headcount, 0);
    const totalHours = data.labor.reduce((sum, l) => sum + l.hoursWorked, 0);
    sections.push(`=== LABOR (${totalHeadcount} workers, ${totalHours} total hours) ===`);
    sections.push('Trade | Subcontractor | Workers | Hours | Rate | Notes');
    sections.push('-'.repeat(80));
    data.labor.forEach((entry) => {
      const rate = entry.hourlyRate ? `$${entry.hourlyRate}/hr` : '-';
      sections.push(
        `${entry.trade} | ${entry.subcontractor || '-'} | ${entry.headcount} | ${entry.hoursWorked} | ${rate} | ${entry.notes || '-'}`
      );
    });
    sections.push('');
  }

  // Equipment Section
  if (data.equipment.length > 0) {
    sections.push(`=== EQUIPMENT ON SITE (${data.equipment.length} items) ===`);
    sections.push('Equipment | Hours | Status | Notes');
    sections.push('-'.repeat(60));
    data.equipment.forEach((item) => {
      sections.push(`${item.name} | ${item.hours} | ${item.status} | ${item.notes || '-'}`);
    });
    sections.push('');
  }

  // Materials Received Section
  if (data.materials.length > 0) {
    sections.push(`=== MATERIALS RECEIVED (${data.materials.length} deliveries) ===`);
    sections.push('Description | Quantity | Supplier');
    sections.push('-'.repeat(60));
    data.materials.forEach((material) => {
      sections.push(`${material.description} | ${material.quantity} | ${material.supplier || '-'}`);
    });
    sections.push('');
  }

  // Visitors Section
  if (data.visitors.length > 0) {
    sections.push(`=== VISITORS (${data.visitors.length}) ===`);
    sections.push('Name | Company | Time In | Time Out');
    sections.push('-'.repeat(60));
    data.visitors.forEach((visitor) => {
      sections.push(
        `${visitor.name} | ${visitor.company || '-'} | ${visitor.timeIn || '-'} | ${visitor.timeOut || '-'}`
      );
    });
    sections.push('');
  }

  // Progress Section
  if (data.progress.length > 0) {
    sections.push(`=== PROGRESS UPDATE (${data.progress.length} areas) ===`);
    sections.push('Area | Activity | % Complete | Notes');
    sections.push('-'.repeat(70));
    data.progress.forEach((item) => {
      sections.push(
        `${item.area} | ${item.activity} | ${item.percentComplete}% | ${item.notes || '-'}`
      );
    });
    sections.push('');
  }

  // Signatures Section
  sections.push('=== SIGNATURES ===');
  sections.push('');
  sections.push(`Prepared By: ${data.report.createdBy || '________________'}`);
  sections.push('');
  sections.push('Superintendent: ________________  Date: ________________');
  sections.push('');
  sections.push('Project Manager: ________________  Date: ________________');
  sections.push('');

  // Footer
  sections.push('-'.repeat(60));
  sections.push('ForemanOS - Construction Project Management');
  sections.push(`Report generated: ${exportDate}`);

  // Build the final content
  const content = sections.join('\n');

  // Generate DOCX using the same approach as room-docx-generator
  const docxContent = generateDocxContent(content, data);

  return new Blob([docxContent], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/**
 * Generate DOCX XML content
 */
function generateDocxContent(textContent: string, data: DailyReportData): Uint8Array {
  // Create document.xml content
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" 
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${textContent
      .split('\n')
      .map((line) => {
        // Escape XML special characters
        const escapedLine = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');

        // Style headers differently
        if (line.startsWith('===') && line.endsWith('===')) {
          const headerText = line.replace(/===/g, '').trim();
          return `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${headerText}</w:t></w:r></w:p>`;
        }
        if (line.startsWith('DAILY FIELD REPORT')) {
          return `<w:p><w:pPr><w:pStyle w:val="Title"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>${escapedLine}</w:t></w:r></w:p>`;
        }
        if (line.startsWith('Project:') || line.startsWith('Date:') || line.startsWith('Status:')) {
          return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${escapedLine}</w:t></w:r></w:p>`;
        }
        if (line.startsWith('-'.repeat(10))) {
          return `<w:p><w:r><w:t>────────────────────────────────────────────────────────────</w:t></w:r></w:p>`;
        }
        return `<w:p><w:r><w:t>${escapedLine}</w:t></w:r></w:p>`;
      })
      .join('\n    ')}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  // Required DOCX components
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const documentRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:rPr><w:b/><w:sz w:val="36"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="Heading 2"/>
    <w:rPr><w:b/><w:sz w:val="28"/></w:rPr>
    <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>
  </w:style>
</w:styles>`;

  // Create ZIP file using PizZip
  const zip = new PizZip();
  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', relsXml);
  zip.file('word/document.xml', documentXml);
  zip.file('word/_rels/document.xml.rels', documentRelsXml);
  zip.file('word/styles.xml', stylesXml);

  return zip.generate({ type: 'uint8array' });
}

/**
 * Format daily report data for export
 */
export function formatDailyReportForExport(
  report: ReportInput,
  project: ProjectInput,
  laborEntries: LaborEntry[],
  equipmentEntries: EquipmentEntry[],
  progressEntries: ProgressEntry[]
): DailyReportData {
  return {
    project: {
      name: project.name,
      slug: project.slug,
      address: project.address || undefined,
      clientName: project.clientName || undefined,
    },
    report: {
      id: report.id,
      reportNumber: report.reportNumber,
      reportDate: report.reportDate.toISOString(),
      status: report.status,
      createdBy: report.createdByUser?.username || report.createdByUser?.name || undefined,
      submittedAt: report.submittedAt?.toISOString() || undefined,
      approvedAt: report.approvedAt?.toISOString() || undefined,
      approvedBy: report.approvedBy || undefined,
    },
    weather: {
      condition: report.weatherCondition || undefined,
      temperatureHigh: report.temperatureHigh || undefined,
      temperatureLow: report.temperatureLow || undefined,
      humidity: report.humidity || undefined,
      precipitation: report.precipitation || undefined,
      windSpeed: report.windSpeed || undefined,
      notes: report.weatherNotes || undefined,
    },
    workSummary: {
      workPerformed: report.workPerformed || undefined,
      workPlanned: report.workPlanned || undefined,
      delaysEncountered: report.delaysEncountered || undefined,
      delayHours: report.delayHours || undefined,
      delayReason: report.delayReason || undefined,
    },
    safety: {
      incidents: report.safetyIncidents || 0,
      notes: report.safetyNotes || undefined,
    },
    labor: laborEntries.map((entry) => ({
      trade: entry.trade || 'General',
      subcontractor: entry.subcontractor || undefined,
      headcount: entry.headcount || 0,
      hoursWorked: entry.hoursWorked || 0,
      hourlyRate: entry.hourlyRate || undefined,
      notes: entry.notes || undefined,
    })),
    equipment: equipmentEntries.map((entry) => ({
      name: entry.equipmentName || entry.name || 'Unknown',
      hours: entry.hoursUsed || entry.hours || 0,
      status: entry.status || 'Active',
      notes: entry.notes || undefined,
    })),
    materials: Array.isArray(report.materialsReceived)
      ? report.materialsReceived.map((m) => ({
          description: m.description || 'Unknown',
          quantity: String(m.quantity || '-'),
          supplier: m.supplier || undefined,
        }))
      : [],
    visitors: Array.isArray(report.visitors)
      ? report.visitors.map((v) => ({
          name: v.name || 'Unknown',
          company: v.company || undefined,
          timeIn: v.timeIn || undefined,
          timeOut: v.timeOut || undefined,
        }))
      : [],
    progress: progressEntries.map((entry) => ({
      area: entry.area || entry.location || 'General',
      activity: entry.activity || entry.description || '-',
      percentComplete: entry.percentComplete || 0,
      notes: entry.notes || undefined,
    })),
    photos: [],
    exportedAt: new Date().toISOString(),
  };
}
