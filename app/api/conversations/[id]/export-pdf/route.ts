/**
 * Daily Report PDF Export - Template A
 * 
 * GET /api/conversations/[id]/export-pdf
 * Generates a professional owner-ready PDF report with 14 mandatory sections:
 * 1. Letterhead (with project logo)
 * 2. Project header (Job Name, Job #, Date, Location)
 * 3. Metadata table (PM, Superintendent, Client, A/E)
 * 4. Weather table (07:00, 12:00, 16:00)
 * 5. Manpower (company + headcount)
 * 6. Work Performed (by trade/company + location)
 * 7. Deliveries
 * 8. Inspections / Visitors
 * 9. Safety Incidents
 * 10. Delays / Issues / Constraints
 * 11. Equipment On-Site
 * 12. Schedule Updates
 * 13. Notes
 * 14. Photos (grid, captions, paginated)
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getFileUrl } from '@/lib/s3';
import { format } from 'date-fns';
import { createLogger } from '@/lib/logger';

const logger = createLogger('pdf-export');

interface WeatherSnapshot {
  time: string;
  temperature: number;
  conditions: string;
  precipitation?: number;
  humidity?: number;
  windSpeed?: number;
}

interface ReportData {
  crew?: { company: string; count: number }[];
  trades?: string[];
  workDescription?: string;
  workByTrade?: { trade: string; company: string; description: string; location?: string }[];
  deliveries?: { time: string; supplier: string; material: string; quantity?: string }[];
  inspections?: { time: string; inspector: string; type: string; result?: string }[];
  visitors?: { time: string; name: string; company: string; purpose?: string }[];
  safetyIncidents?: { time: string; type: string; description: string; actionTaken?: string }[];
  delays?: { type: string; description: string; impact?: string; duration?: string }[];
  equipment?: { name: string; operator?: string; hours?: string; status?: string }[];
  notes?: string;
}

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Get conversation with project and user
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        Project: true,
        User: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (conversation.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Verify this is a daily report chat
    if (conversation.conversationType !== 'daily_report') {
      return NextResponse.json(
        { error: 'PDF export only supported for daily report chats' },
        { status: 400 }
      );
    }

    // Extract data
    const reportDate = conversation.dailyReportDate
      ? format(new Date(conversation.dailyReportDate), 'MMMM dd, yyyy')
      : format(new Date(), 'MMMM dd, yyyy');
    
    const reportData = (conversation.reportData as unknown as ReportData) || {};
    const weatherSnapshots = (conversation.weatherSnapshots as unknown as WeatherSnapshot[]) || [];
    const photos = (conversation.photos as unknown as any[]) || [];
    const scheduleUpdates = (conversation.scheduleUpdates as unknown as any[]) || [];
    const quantityCalculations = (conversation.quantityCalculations as unknown as any[]) || [];

    // Get project logo if available
    let logoUrl = '';
    if (conversation.Project?.logoUrl) {
      try {
        logoUrl = await getFileUrl(conversation.Project.logoUrl, true);
      } catch (error) {
        logger.error('Error getting logo URL', error as Error);
      }
    }

    // Get photo URLs
    const photosWithUrls = await Promise.all(
      photos.map(async (photo) => {
        try {
          const url = await getFileUrl(photo.cloud_storage_path, photo.isPublic);
          return { ...photo, url };
        } catch (error) {
          logger.error('Error getting photo URL', error as Error);
          return null;
        }
      })
    );
    const validPhotos = photosWithUrls.filter((p) => p !== null);

    // Generate HTML
    const html = generatePdfHtml({
      conversation,
      reportDate,
      reportData,
      weatherSnapshots,
      photos: validPhotos,
      scheduleUpdates,
      quantityCalculations,
      logoUrl,
    });

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    logger.error('Error generating PDF', error as Error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}

function generatePdfHtml(data: {
  conversation: any;
  reportDate: string;
  reportData: ReportData;
  weatherSnapshots: WeatherSnapshot[];
  photos: any[];
  scheduleUpdates: any[];
  quantityCalculations: any[];
  logoUrl: string;
}): string {
  const {
    conversation,
    reportDate,
    reportData,
    weatherSnapshots,
    photos,
    scheduleUpdates,
    quantityCalculations: _quantityCalculations,
    logoUrl,
  } = data;

  const project = conversation.Project;
  const user = conversation.User;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Report - ${project?.name || 'Project'} - ${reportDate}</title>
  <style>
    @page {
      size: letter;
      margin: 0.5in;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #1a1a1a;
      background: white;
    }

    /* ForemanOS Color Palette */
    .brand-orange { color: #F97316; }
    .brand-dark { color: #1F2328; }
    .brand-medium { color: #2d333b; }

    /* Print Styles */
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
      .avoid-break { page-break-inside: avoid; }
    }

    /* Letterhead */
    .letterhead {
      border-bottom: 3px solid #F97316;
      padding-bottom: 16px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .letterhead-logo {
      max-width: 200px;
      max-height: 80px;
      object-fit: contain;
    }

    .letterhead-brand {
      text-align: right;
    }

    .letterhead-brand h1 {
      font-size: 24pt;
      font-weight: 700;
      color: #1F2328;
      margin-bottom: 4px;
    }

    .letterhead-brand p {
      font-size: 10pt;
      color: #666;
    }

    /* Project Header */
    .project-header {
      background: #1F2328;
      color: white;
      padding: 16px;
      margin-bottom: 16px;
      border-radius: 4px;
    }

    .project-header h2 {
      font-size: 18pt;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .project-header-info {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      font-size: 10pt;
    }

    .project-header-info span {
      opacity: 0.9;
    }

    .project-header-info strong {
      font-weight: 600;
      opacity: 1;
    }

    /* Section Styles */
    .section {
      margin-bottom: 20px;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 12pt;
      font-weight: 700;
      color: #1F2328;
      padding: 8px 12px;
      background: #f8f9fa;
      border-left: 4px solid #F97316;
      margin-bottom: 12px;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }

    th {
      background: #2d333b;
      color: white;
      text-align: left;
      padding: 8px;
      font-size: 9pt;
      font-weight: 600;
    }

    td {
      padding: 8px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 9pt;
    }

    tr:hover td {
      background: #f9fafb;
    }

    /* Empty State */
    .empty-state {
      padding: 16px;
      background: #f9fafb;
      border: 1px dashed #d1d5db;
      border-radius: 4px;
      text-align: center;
      color: #6b7280;
      font-style: italic;
    }

    /* Photos Grid */
    .photos-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-top: 12px;
    }

    .photo-item {
      page-break-inside: avoid;
    }

    .photo-image {
      width: 100%;
      height: 200px;
      object-fit: cover;
      border-radius: 4px;
      border: 1px solid #e5e7eb;
    }

    .photo-caption {
      font-size: 8pt;
      color: #4b5563;
      margin-top: 4px;
      line-height: 1.3;
    }

    .photo-meta {
      font-size: 7pt;
      color: #9ca3af;
      margin-top: 2px;
    }

    /* Print Button */
    .print-button {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 24px;
      background: #F97316;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 1000;
    }

    .print-button:hover {
      background: #ea580c;
    }

    /* Footer */
    .report-footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 2px solid #e5e7eb;
      font-size: 8pt;
      color: #6b7280;
      text-align: center;
    }
  </style>
</head>
<body>
  <!-- Print Button -->
  <button onclick="window.print()" class="print-button no-print">🖨️ Print / Save as PDF</button>

  <!-- 1. LETTERHEAD -->
  <div class="letterhead">
    ${logoUrl ? `<img src="${logoUrl}" alt="Project Logo" class="letterhead-logo" />` : `
    <div class="letterhead-brand">
      <h1>ForemanOS</h1>
      <p>Construction Project Management</p>
    </div>`}
    <div style="flex: 1;"></div>
    <div style="text-align: right;">
      <div style="font-size: 14pt; font-weight: 700; color: #1F2328;">DAILY REPORT</div>
      <div style="font-size: 10pt; color: #666; margin-top: 4px;">${reportDate}</div>
    </div>
  </div>

  <!-- 2. PROJECT HEADER -->
  <div class="project-header">
    <h2>${project?.name || 'Project Name'}</h2>
    <div class="project-header-info">
      <span><strong>Job #:</strong> ${project?.jobNumber || 'Not specified'}</span>
      <span><strong>Date:</strong> ${reportDate}</span>
      <span><strong>Location:</strong> ${project?.projectAddress || project?.locationCity && project?.locationState ? `${project.locationCity}, ${project.locationState}` : 'Not specified'}</span>
      <span><strong>Submitted by:</strong> ${user?.name || user?.email || 'Unknown'}</span>
    </div>
  </div>

  <!-- 3. METADATA TABLE -->
  <div class="section">
    <div class="section-title">Project Information</div>
    <table>
      <tr>
        <th style="width: 25%;">Project Manager</th>
        <th style="width: 25%;">Superintendent</th>
        <th style="width: 25%;">Client/Owner</th>
        <th style="width: 25%;">Architect/Engineer</th>
      </tr>
      <tr>
        <td>${project?.projectManager || 'Not specified'}</td>
        <td>${project?.superintendent || 'Not specified'}</td>
        <td>${project?.clientName || 'Not specified'}</td>
        <td>${project?.architectEngineer || 'Not specified'}</td>
      </tr>
    </table>
  </div>

  <!-- 4. WEATHER TABLE -->
  <div class="section">
    <div class="section-title">Weather Conditions</div>
    ${weatherSnapshots.length > 0 ? `
    <table>
      <tr>
        <th>Time</th>
        <th>Temperature</th>
        <th>Conditions</th>
        <th>Precipitation</th>
        <th>Humidity</th>
        <th>Wind Speed</th>
      </tr>
      ${weatherSnapshots.map(w => `
      <tr>
        <td>${w.time}</td>
        <td>${w.temperature}°F</td>
        <td>${w.conditions}</td>
        <td>${w.precipitation ? `${w.precipitation}"` : '0"'}</td>
        <td>${w.humidity ? `${w.humidity}%` : 'N/A'}</td>
        <td>${w.windSpeed ? `${w.windSpeed} mph` : 'N/A'}</td>
      </tr>
      `).join('')}
    </table>
    ${conversation.weatherImpactWarning ? `
    <div style="padding: 8px 12px; background: #fef3c7; border-left: 4px solid #f59e0b; margin-top: 8px; font-size: 9pt;">
      <strong>⚠️ Weather Impact:</strong> ${conversation.weatherImpactWarning}
    </div>
    ` : ''}
    ` : `<div class="empty-state">No weather data recorded</div>`}
  </div>

  <!-- 5. MANPOWER -->
  <div class="section">
    <div class="section-title">Manpower</div>
    ${reportData.crew && reportData.crew.length > 0 ? `
    <table>
      <tr>
        <th>Company/Trade</th>
        <th style="text-align: right; width: 20%;">Head Count</th>
      </tr>
      ${reportData.crew.map(c => `
      <tr>
        <td>${c.company}</td>
        <td style="text-align: right;">${c.count}</td>
      </tr>
      `).join('')}
      <tr style="font-weight: 600; background: #f3f4f6;">
        <td>TOTAL WORKERS ON SITE</td>
        <td style="text-align: right;">${reportData.crew.reduce((sum, c) => sum + c.count, 0)}</td>
      </tr>
    </table>
    ` : `<div class="empty-state">No manpower data reported</div>`}
  </div>

  <!-- 6. WORK PERFORMED -->
  <div class="section">
    <div class="section-title">Work Performed</div>
    ${reportData.workByTrade && reportData.workByTrade.length > 0 ? `
    <table>
      <tr>
        <th style="width: 15%;">Trade</th>
        <th style="width: 20%;">Company</th>
        <th style="width: 45%;">Work Description</th>
        <th style="width: 20%;">Location</th>
      </tr>
      ${reportData.workByTrade.map(w => `
      <tr>
        <td>${w.trade}</td>
        <td>${w.company}</td>
        <td>${w.description}</td>
        <td>${w.location || 'N/A'}</td>
      </tr>
      `).join('')}
    </table>
    ` : reportData.workDescription ? `
    <div style="padding: 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px;">
      ${reportData.workDescription}
    </div>
    ` : `<div class="empty-state">No work performed data reported</div>`}
  </div>

  <!-- 7. DELIVERIES -->
  <div class="section">
    <div class="section-title">Deliveries</div>
    ${reportData.deliveries && reportData.deliveries.length > 0 ? `
    <table>
      <tr>
        <th style="width: 15%;">Time</th>
        <th style="width: 25%;">Supplier</th>
        <th style="width: 40%;">Material</th>
        <th style="width: 20%;">Quantity</th>
      </tr>
      ${reportData.deliveries.map(d => `
      <tr>
        <td>${d.time}</td>
        <td>${d.supplier}</td>
        <td>${d.material}</td>
        <td>${d.quantity || 'N/A'}</td>
      </tr>
      `).join('')}
    </table>
    ` : `<div class="empty-state">No deliveries reported</div>`}
  </div>

  <!-- 8. INSPECTIONS / VISITORS -->
  <div class="section">
    <div class="section-title">Inspections</div>
    ${reportData.inspections && reportData.inspections.length > 0 ? `
    <table>
      <tr>
        <th style="width: 15%;">Time</th>
        <th style="width: 25%;">Inspector</th>
        <th style="width: 35%;">Type</th>
        <th style="width: 25%;">Result</th>
      </tr>
      ${reportData.inspections.map(i => `
      <tr>
        <td>${i.time}</td>
        <td>${i.inspector}</td>
        <td>${i.type}</td>
        <td>${i.result || 'Pending'}</td>
      </tr>
      `).join('')}
    </table>
    ` : `<div class="empty-state">No inspections reported</div>`}
  </div>

  <div class="section">
    <div class="section-title">Visitors</div>
    ${reportData.visitors && reportData.visitors.length > 0 ? `
    <table>
      <tr>
        <th style="width: 15%;">Time</th>
        <th style="width: 25%;">Name</th>
        <th style="width: 25%;">Company</th>
        <th style="width: 35%;">Purpose</th>
      </tr>
      ${reportData.visitors.map(v => `
      <tr>
        <td>${v.time}</td>
        <td>${v.name}</td>
        <td>${v.company}</td>
        <td>${v.purpose || 'N/A'}</td>
      </tr>
      `).join('')}
    </table>
    ` : `<div class="empty-state">No visitors reported</div>`}
  </div>

  <!-- 9. SAFETY INCIDENTS -->
  <div class="section">
    <div class="section-title">Safety Incidents</div>
    ${reportData.safetyIncidents && reportData.safetyIncidents.length > 0 ? `
    <table>
      <tr>
        <th style="width: 15%;">Time</th>
        <th style="width: 20%;">Type</th>
        <th style="width: 40%;">Description</th>
        <th style="width: 25%;">Action Taken</th>
      </tr>
      ${reportData.safetyIncidents.map(s => `
      <tr style="background: #fef2f2;">
        <td>${s.time}</td>
        <td><strong>${s.type}</strong></td>
        <td>${s.description}</td>
        <td>${s.actionTaken || 'Under review'}</td>
      </tr>
      `).join('')}
    </table>
    ` : `<div class="empty-state">No safety incidents reported ✓</div>`}
  </div>

  <!-- 10. DELAYS / ISSUES / CONSTRAINTS -->
  <div class="section">
    <div class="section-title">Delays / Issues / Constraints</div>
    ${reportData.delays && reportData.delays.length > 0 ? `
    <table>
      <tr>
        <th style="width: 20%;">Type</th>
        <th style="width: 50%;">Description</th>
        <th style="width: 15%;">Duration</th>
        <th style="width: 15%;">Impact</th>
      </tr>
      ${reportData.delays.map(d => `
      <tr>
        <td>${d.type}</td>
        <td>${d.description}</td>
        <td>${d.duration || 'N/A'}</td>
        <td>${d.impact || 'TBD'}</td>
      </tr>
      `).join('')}
    </table>
    ` : `<div class="empty-state">No delays reported</div>`}
  </div>

  <!-- 11. EQUIPMENT ON-SITE -->
  <div class="section">
    <div class="section-title">Equipment On-Site</div>
    ${reportData.equipment && reportData.equipment.length > 0 ? `
    <table>
      <tr>
        <th style="width: 35%;">Equipment Name</th>
        <th style="width: 25%;">Operator</th>
        <th style="width: 20%;">Hours</th>
        <th style="width: 20%;">Status</th>
      </tr>
      ${reportData.equipment.map(e => `
      <tr>
        <td>${e.name}</td>
        <td>${e.operator || 'N/A'}</td>
        <td>${e.hours || 'N/A'}</td>
        <td>${e.status || 'Operational'}</td>
      </tr>
      `).join('')}
    </table>
    ` : `<div class="empty-state">No equipment data reported</div>`}
  </div>

  <!-- 12. SCHEDULE UPDATES -->
  <div class="section">
    <div class="section-title">Schedule Updates</div>
    ${scheduleUpdates.length > 0 ? `
    <table>
      <tr>
        <th style="width: 30%;">Activity</th>
        <th style="width: 20%;">Planned</th>
        <th style="width: 20%;">Actual</th>
        <th style="width: 30%;">Notes</th>
      </tr>
      ${scheduleUpdates.map((u: any) => `
      <tr>
        <td>${u.activity}</td>
        <td>${u.plannedStatus || 'N/A'}</td>
        <td>${u.actualStatus || 'N/A'}</td>
        <td>${u.notes || ''}</td>
      </tr>
      `).join('')}
    </table>
    ` : `<div class="empty-state">No schedule updates reported</div>`}
  </div>

  <!-- 13. NOTES -->
  <div class="section">
    <div class="section-title">Additional Notes</div>
    ${reportData.notes ? `
    <div style="padding: 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; white-space: pre-wrap;">
      ${reportData.notes}
    </div>
    ` : `<div class="empty-state">No additional notes</div>`}
  </div>

  <!-- 14. PHOTOS -->
  ${photos.length > 0 ? `
  <div class="page-break"></div>
  <div class="section">
    <div class="section-title">Photo Documentation (${photos.length} photos)</div>
    <div class="photos-grid">
      ${photos.map(p => `
      <div class="photo-item">
        <img src="${p.url}" alt="${p.caption || 'Project photo'}" class="photo-image" />
        <div class="photo-caption">${p.caption || 'No caption'}</div>
        ${p.location || p.trade ? `
        <div class="photo-meta">
          ${p.location ? `📍 ${p.location}` : ''}
          ${p.trade ? ` | ${p.trade}` : ''}
        </div>
        ` : ''}
      </div>
      `).join('')}
    </div>
  </div>
  ` : ''}

  <!-- FOOTER -->
  <div class="report-footer">
    <p><strong>Report ID:</strong> ${conversation.id}</p>
    <p>Generated on ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</p>
    <p style="margin-top: 8px;">Powered by <strong>ForemanOS</strong> Construction Management Platform</p>
  </div>
</body>
</html>
  `;
}
