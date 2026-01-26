/**
 * Verification Report Export API
 * POST: Generate PDF report for submittal verification
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { format } from 'date-fns';

interface ReportRequest {
  submittalId?: string;
  projectWide?: boolean;
}

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ReportRequest = await request.json();
    const { submittalId, projectWide } = body;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        name: true,
        jobNumber: true,
        clientName: true,
        projectAddress: true,
        projectManager: true,
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let submittals;

    if (projectWide) {
      // Get all submittals with line items
      submittals = await prisma.mEPSubmittal.findMany({
        where: {
          projectId: project.id,
          status: { not: 'VOID' },
          lineItems: { some: {} }
        },
        include: {
          lineItems: {
            include: {
              hardwareSet: true
            }
          }
        },
        orderBy: { submittalNumber: 'asc' }
      });
    } else if (submittalId) {
      // Get specific submittal
      const submittal = await prisma.mEPSubmittal.findUnique({
        where: { id: submittalId },
        include: {
          lineItems: {
            include: {
              hardwareSet: true
            }
          }
        }
      });
      submittals = submittal ? [submittal] : [];
    } else {
      return NextResponse.json({ error: 'Either submittalId or projectWide required' }, { status: 400 });
    }

    if (submittals.length === 0) {
      return NextResponse.json({ error: 'No submittals found' }, { status: 404 });
    }

    // Generate HTML report
    const htmlContent = generateReportHTML(project, submittals, projectWide);

    // Call HTML2PDF API
    const createResponse = await fetch('https://apps.abacus.ai/api/createConvertHtmlToPdfRequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        html_content: htmlContent,
        pdf_options: {
          format: 'Letter',
          margin: { top: '0.5in', right: '0.5in', bottom: '0.75in', left: '0.5in' },
          print_background: true,
          display_header_footer: true,
          footer_template: `
            <div style="font-size: 9px; width: 100%; text-align: center; color: #666;">
              Page <span class="pageNumber"></span> of <span class="totalPages"></span>
            </div>
          `
        },
        base_url: process.env.NEXTAUTH_URL || '',
      }),
    });

    if (!createResponse.ok) {
      console.error('PDF create error:', await createResponse.text());
      return NextResponse.json({ error: 'Failed to create PDF request' }, { status: 500 });
    }

    const { request_id } = await createResponse.json();
    if (!request_id) {
      return NextResponse.json({ error: 'No request ID returned' }, { status: 500 });
    }

    // Poll for status
    const maxAttempts = 60;
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const statusResponse = await fetch('https://apps.abacus.ai/api/getConvertHtmlToPdfStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id,
          deployment_token: process.env.ABACUSAI_API_KEY
        }),
      });

      const statusResult = await statusResponse.json();
      const status = statusResult?.status || 'FAILED';
      const result = statusResult?.result || null;

      if (status === 'SUCCESS' && result?.result) {
        const pdfBuffer = Buffer.from(result.result, 'base64');
        const filename = projectWide
          ? `Verification_Report_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`
          : `Submittal_Verification_${submittals[0].submittalNumber}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;

        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        });
      } else if (status === 'FAILED') {
        return NextResponse.json({ error: result?.error || 'PDF generation failed' }, { status: 500 });
      }

      attempts++;
    }

    return NextResponse.json({ error: 'PDF generation timed out' }, { status: 500 });
  } catch (error) {
    console.error('[Report Export Error]:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

function generateReportHTML(
  project: any,
  submittals: any[],
  projectWide: boolean
): string {
  const reportDate = format(new Date(), 'MMMM d, yyyy');

  // Calculate totals
  const allLineItems = submittals.flatMap(s => s.lineItems);
  const totals = {
    items: allLineItems.length,
    sufficient: allLineItems.filter(i => i.complianceStatus === 'SUFFICIENT').length,
    insufficient: allLineItems.filter(i => i.complianceStatus === 'INSUFFICIENT').length,
    excess: allLineItems.filter(i => i.complianceStatus === 'EXCESS').length,
    unverified: allLineItems.filter(i => i.complianceStatus === 'UNVERIFIED' || i.complianceStatus === 'NO_REQUIREMENT').length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUFFICIENT': return '#10b981';
      case 'INSUFFICIENT': return '#ef4444';
      case 'EXCESS': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'SUFFICIENT': return 'SUFFICIENT';
      case 'INSUFFICIENT': return 'SHORTAGE';
      case 'EXCESS': return 'EXCESS';
      case 'NO_REQUIREMENT': return 'NO REQ';
      default: return 'UNVERIFIED';
    }
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Submittal Verification Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #1f2937;
    }
    .header {
      background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
      color: white;
      padding: 24px;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .header .subtitle {
      font-size: 14px;
      opacity: 0.9;
    }
    .project-info {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      padding: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .project-info .item {
      display: flex;
      flex-direction: column;
    }
    .project-info .label {
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 2px;
    }
    .project-info .value {
      font-size: 12px;
      font-weight: 500;
      color: #1e293b;
    }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .summary-card {
      padding: 16px;
      border-radius: 8px;
      text-align: center;
    }
    .summary-card.total { background: #f1f5f9; border: 2px solid #94a3b8; }
    .summary-card.sufficient { background: #d1fae5; border: 2px solid #10b981; }
    .summary-card.insufficient { background: #fee2e2; border: 2px solid #ef4444; }
    .summary-card.excess { background: #fef3c7; border: 2px solid #f59e0b; }
    .summary-card.unverified { background: #f1f5f9; border: 2px solid #6b7280; }
    .summary-card .number {
      font-size: 28px;
      font-weight: 700;
      line-height: 1;
    }
    .summary-card .label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .submittal-section {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .submittal-header {
      background: #1e293b;
      color: white;
      padding: 12px 16px;
      border-radius: 8px 8px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .submittal-number {
      font-family: monospace;
      font-size: 14px;
      font-weight: 600;
      color: #60a5fa;
    }
    .submittal-title {
      font-size: 13px;
      font-weight: 500;
    }
    .submittal-status {
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    th {
      background: #f8fafc;
      padding: 8px 12px;
      text-align: left;
      font-weight: 600;
      color: #475569;
      border-bottom: 2px solid #e2e8f0;
      text-transform: uppercase;
      font-size: 9px;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    tr:hover { background: #f8fafc; }
    .status-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 600;
      color: white;
    }
    .qty-cell {
      font-family: monospace;
      text-align: right;
    }
    .variance-positive { color: #10b981; }
    .variance-negative { color: #ef4444; }
    .footer-note {
      margin-top: 24px;
      padding: 16px;
      background: #f8fafc;
      border-left: 4px solid #3b82f6;
      font-size: 10px;
      color: #64748b;
    }
    .page-break { page-break-before: always; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${projectWide ? 'Project Verification Report' : 'Submittal Verification Report'}</h1>
    <div class="subtitle">Generated on ${reportDate}</div>
  </div>

  <div class="project-info">
    <div class="item">
      <span class="label">Project Name</span>
      <span class="value">${project.name}</span>
    </div>
    <div class="item">
      <span class="label">Job Number</span>
      <span class="value">${project.jobNumber || 'N/A'}</span>
    </div>
    <div class="item">
      <span class="label">Client</span>
      <span class="value">${project.clientName || 'N/A'}</span>
    </div>
    <div class="item">
      <span class="label">Project Manager</span>
      <span class="value">${project.projectManager || 'N/A'}</span>
    </div>
  </div>

  <div class="summary-cards">
    <div class="summary-card total">
      <div class="number">${totals.items}</div>
      <div class="label">Total Items</div>
    </div>
    <div class="summary-card sufficient">
      <div class="number" style="color: #10b981;">${totals.sufficient}</div>
      <div class="label">Sufficient</div>
    </div>
    <div class="summary-card insufficient">
      <div class="number" style="color: #ef4444;">${totals.insufficient}</div>
      <div class="label">Shortages</div>
    </div>
    <div class="summary-card excess">
      <div class="number" style="color: #f59e0b;">${totals.excess}</div>
      <div class="label">Excess</div>
    </div>
    <div class="summary-card unverified">
      <div class="number" style="color: #6b7280;">${totals.unverified}</div>
      <div class="label">Unverified</div>
    </div>
  </div>

  ${submittals.map((submittal, idx) => `
    ${idx > 0 ? '<div class="page-break"></div>' : ''}
    <div class="submittal-section">
      <div class="submittal-header">
        <div>
          <span class="submittal-number">${submittal.submittalNumber}</span>
          <span class="submittal-title" style="margin-left: 12px;">${submittal.title}</span>
        </div>
        <span class="submittal-status" style="background: ${submittal.status === 'APPROVED' ? '#10b981' : submittal.status === 'REJECTED' ? '#ef4444' : '#6b7280'};">
          ${submittal.status}
        </span>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 35%;">Product</th>
            <th style="width: 15%;">Manufacturer</th>
            <th style="width: 12%; text-align: right;">Submitted</th>
            <th style="width: 12%; text-align: right;">Required</th>
            <th style="width: 10%; text-align: right;">Variance</th>
            <th style="width: 16%;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${submittal.lineItems.map((item: any) => `
            <tr>
              <td>
                <strong>${item.productName}</strong>
                ${item.modelNumber ? `<br><span style="color: #64748b; font-size: 9px;">Model: ${item.modelNumber}</span>` : ''}
              </td>
              <td>${item.manufacturer || '-'}</td>
              <td class="qty-cell">${item.submittedQty} ${item.unit}</td>
              <td class="qty-cell">${item.requiredQty !== null ? `${item.requiredQty} ${item.unit}` : '-'}</td>
              <td class="qty-cell ${(item.varianceQty || 0) >= 0 ? 'variance-positive' : 'variance-negative'}">
                ${item.varianceQty !== null ? (item.varianceQty > 0 ? '+' : '') + item.varianceQty : '-'}
              </td>
              <td>
                <span class="status-badge" style="background: ${getStatusColor(item.complianceStatus)};">
                  ${getStatusLabel(item.complianceStatus)}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `).join('')}

  <div class="footer-note">
    <strong>Note:</strong> This verification report compares submitted quantities against project requirements
    derived from door schedules, window schedules, material takeoffs, and MEP equipment lists.
    Items marked as "SHORTAGE" require attention before approval.
  </div>
</body>
</html>
  `;
}
