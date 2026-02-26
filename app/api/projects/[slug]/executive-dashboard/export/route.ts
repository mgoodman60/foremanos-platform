/**
 * Executive Dashboard PDF Export API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { format, differenceInDays, startOfWeek } from 'date-fns';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_EXECUTIVE_DASHBOARD_EXPORT');

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        ProjectBudget: {
          include: { BudgetItem: true }
        },
        Schedule: {
          include: { ScheduleTask: true }
        },
        MEPSubmittal: true,
        ChangeOrder: true,
        DailyReport: {
          where: { createdAt: { gte: startOfWeek(new Date()) } }
        },
        Document: { where: { deletedAt: null } },
        Crew: { where: { isActive: true } },
        CostAlert: { where: { isDismissed: false } }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Calculate all metrics (same as main endpoint)
    const schedule = project.Schedule[0];
    const tasks = schedule?.ScheduleTask || [];
    const now = new Date();
    
    const tasksOnTrack = tasks.filter(t => {
      const endDate = new Date(t.endDate);
      return t.status === 'completed' || (t.percentComplete > 0 && endDate >= now);
    }).length;
    
    const tasksDelayed = tasks.filter(t => {
      const endDate = new Date(t.endDate);
      return t.status !== 'completed' && endDate < now && t.percentComplete < 100;
    }).length;
    
    const criticalTasks = tasks.filter(t => t.isCritical).length;
    
    const totalProgress = tasks.length > 0
      ? tasks.reduce((sum, t) => sum + (t.percentComplete || 0), 0) / tasks.length
      : 0;

    const scheduleEndDate = tasks.length > 0
      ? tasks.reduce((max, t) => {
          const end = new Date(t.endDate);
          return end > max ? end : max;
        }, new Date(0))
      : null;

    const daysRemaining = scheduleEndDate 
      ? Math.max(0, differenceInDays(scheduleEndDate, now))
      : 0;

    const budget = project.ProjectBudget[0];
    const budgetItems = budget?.BudgetItem || [];
    const totalBudget = budgetItems.reduce((sum, item) => sum + (item.budgetedAmount || 0), 0);
    const spent = budgetItems.reduce((sum, item) => sum + (item.actualCost || 0), 0);
    const committed = budgetItems.reduce((sum, item) => sum + (item.committedCost || 0), 0);
    const variance = totalBudget > 0 ? ((spent - (totalBudget * (totalProgress / 100))) / totalBudget) * 100 : 0;

    const submittals = project.MEPSubmittal || [];
    const changeOrders = project.ChangeOrder || [];
    const activeAlerts = project.CostAlert || [];

    // Format currency
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
    };

    // Build HTML for PDF
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica', 'Arial', sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #1f2937;
      padding: 30px;
      background: #fff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #003B71;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 22px;
      color: #003B71;
      margin-bottom: 5px;
    }
    .header .subtitle {
      color: #6b7280;
      font-size: 12px;
    }
    .header .date {
      text-align: right;
      color: #6b7280;
    }
    .section {
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 14px;
      font-weight: bold;
      color: #003B71;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 5px;
      margin-bottom: 12px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .kpi-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      background: #f9fafb;
    }
    .kpi-card.good { border-left: 4px solid #10b981; }
    .kpi-card.warning { border-left: 4px solid #f59e0b; }
    .kpi-card.critical { border-left: 4px solid #ef4444; }
    .kpi-value {
      font-size: 20px;
      font-weight: bold;
      color: #111827;
    }
    .kpi-label {
      font-size: 10px;
      color: #6b7280;
      text-transform: uppercase;
    }
    .kpi-detail {
      font-size: 9px;
      color: #9ca3af;
      margin-top: 4px;
    }
    .metrics-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
    }
    .metrics-table th {
      text-align: left;
      padding: 8px;
      background: #f3f4f6;
      border-bottom: 1px solid #e5e7eb;
      font-weight: 600;
    }
    .metrics-table td {
      padding: 8px;
      border-bottom: 1px solid #f3f4f6;
    }
    .metrics-table .value {
      text-align: right;
      font-weight: 500;
    }
    .two-column {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 500;
    }
    .status-good { background: #d1fae5; color: #065f46; }
    .status-warning { background: #fef3c7; color: #92400e; }
    .status-critical { background: #fee2e2; color: #991b1b; }
    .progress-bar {
      height: 8px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 8px;
    }
    .progress-fill {
      height: 100%;
      background: #003B71;
      border-radius: 4px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 9px;
    }
    .alert-list {
      list-style: none;
    }
    .alert-item {
      padding: 8px;
      margin-bottom: 6px;
      border-radius: 4px;
      font-size: 10px;
    }
    .alert-critical { background: #fee2e2; border-left: 3px solid #ef4444; }
    .alert-warning { background: #fef3c7; border-left: 3px solid #f59e0b; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${project.name}</h1>
      <div class="subtitle">Executive Project Report</div>
    </div>
    <div class="date">
      <strong>Report Date:</strong> ${format(new Date(), 'MMMM d, yyyy')}<br>
      <strong>Generated:</strong> ${format(new Date(), 'h:mm a')}
    </div>
  </div>

  <!-- Key Performance Indicators -->
  <div class="section">
    <div class="section-title">Key Performance Indicators</div>
    <div class="kpi-grid">
      <div class="kpi-card ${totalProgress >= 80 ? 'good' : totalProgress >= 50 ? 'warning' : 'critical'}">
        <div class="kpi-value">${Math.round(totalProgress)}%</div>
        <div class="kpi-label">Project Progress</div>
        <div class="kpi-detail">${daysRemaining} days remaining</div>
      </div>
      <div class="kpi-card ${variance <= 0 ? 'good' : variance <= 5 ? 'warning' : 'critical'}">
        <div class="kpi-value">${variance > 0 ? '+' : ''}${variance.toFixed(1)}%</div>
        <div class="kpi-label">Budget Variance</div>
        <div class="kpi-detail">${formatCurrency(spent)} of ${formatCurrency(totalBudget)}</div>
      </div>
      <div class="kpi-card ${tasksDelayed === 0 ? 'good' : tasksDelayed <= 3 ? 'warning' : 'critical'}">
        <div class="kpi-value">${tasksOnTrack}/${tasks.length}</div>
        <div class="kpi-label">Tasks On Track</div>
        <div class="kpi-detail">${tasksDelayed} delayed, ${criticalTasks} critical</div>
      </div>
      <div class="kpi-card ${submittals.filter(s => ['PENDING', 'SUBMITTED'].includes(s.status)).length === 0 ? 'good' : 'warning'}">
        <div class="kpi-value">${submittals.filter(s => s.status === 'APPROVED').length}/${submittals.length}</div>
        <div class="kpi-label">Submittals Approved</div>
        <div class="kpi-detail">${submittals.filter(s => ['PENDING', 'SUBMITTED', 'UNDER_REVIEW'].includes(s.status)).length} pending review</div>
      </div>
    </div>
  </div>

  <div class="two-column">
    <!-- Schedule Status -->
    <div class="section">
      <div class="section-title">Schedule Status</div>
      <table class="metrics-table">
        <tr>
          <td>Overall Progress</td>
          <td class="value">${Math.round(totalProgress)}%</td>
        </tr>
        <tr>
          <td>Days Remaining</td>
          <td class="value">${daysRemaining}</td>
        </tr>
        <tr>
          <td>Tasks On Track</td>
          <td class="value" style="color: #10b981;">${tasksOnTrack}</td>
        </tr>
        <tr>
          <td>Tasks Delayed</td>
          <td class="value" style="color: ${tasksDelayed > 0 ? '#ef4444' : '#6b7280'};">${tasksDelayed}</td>
        </tr>
        <tr>
          <td>Critical Path Tasks</td>
          <td class="value" style="color: #f59e0b;">${criticalTasks}</td>
        </tr>
        <tr>
          <td>Target Completion</td>
          <td class="value">${scheduleEndDate ? format(scheduleEndDate, 'MMM d, yyyy') : 'Not set'}</td>
        </tr>
      </table>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${Math.min(totalProgress, 100)}%;"></div>
      </div>
    </div>

    <!-- Budget Status -->
    <div class="section">
      <div class="section-title">Budget Status</div>
      <table class="metrics-table">
        <tr>
          <td>Total Budget</td>
          <td class="value">${formatCurrency(totalBudget)}</td>
        </tr>
        <tr>
          <td>Spent to Date</td>
          <td class="value" style="color: #10b981;">${formatCurrency(spent)}</td>
        </tr>
        <tr>
          <td>Committed</td>
          <td class="value" style="color: #f59e0b;">${formatCurrency(committed)}</td>
        </tr>
        <tr>
          <td>Remaining</td>
          <td class="value">${formatCurrency(totalBudget - spent - committed)}</td>
        </tr>
        <tr>
          <td>Budget Variance</td>
          <td class="value" style="color: ${variance > 0 ? '#ef4444' : '#10b981'};">
            ${variance > 0 ? '+' : ''}${variance.toFixed(1)}%
          </td>
        </tr>
      </table>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${Math.min((spent / totalBudget) * 100, 100)}%; background: #10b981;"></div>
      </div>
    </div>
  </div>

  <div class="two-column">
    <!-- Submittals Summary -->
    <div class="section">
      <div class="section-title">Submittals Summary</div>
      <table class="metrics-table">
        <tr>
          <td>Total Submittals</td>
          <td class="value">${submittals.length}</td>
        </tr>
        <tr>
          <td>Approved</td>
          <td class="value" style="color: #10b981;">${submittals.filter(s => s.status === 'APPROVED').length}</td>
        </tr>
        <tr>
          <td>Pending Review</td>
          <td class="value" style="color: #f59e0b;">${submittals.filter(s => ['PENDING', 'SUBMITTED', 'UNDER_REVIEW'].includes(s.status)).length}</td>
        </tr>
        <tr>
          <td>Rejected</td>
          <td class="value" style="color: #ef4444;">${submittals.filter(s => s.status === 'REJECTED').length}</td>
        </tr>
      </table>
    </div>

    <!-- Change Orders -->
    <div class="section">
      <div class="section-title">Change Orders</div>
      <table class="metrics-table">
        <tr>
          <td>Total Change Orders</td>
          <td class="value">${changeOrders.length}</td>
        </tr>
        <tr>
          <td>Approved</td>
          <td class="value" style="color: #10b981;">${changeOrders.filter(c => c.status === 'APPROVED').length}</td>
        </tr>
        <tr>
          <td>Pending</td>
          <td class="value" style="color: #f59e0b;">${changeOrders.filter(c => ['PENDING', 'SUBMITTED', 'UNDER_REVIEW'].includes(c.status)).length}</td>
        </tr>
        <tr>
          <td>Approved Value</td>
          <td class="value">${formatCurrency(changeOrders.filter(c => c.status === 'APPROVED').reduce((sum, c) => sum + (c.approvedAmount || 0), 0))}</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- Active Alerts -->
  ${activeAlerts.length > 0 ? `
  <div class="section">
    <div class="section-title">Active Alerts (${activeAlerts.length})</div>
    <ul class="alert-list">
      ${activeAlerts.slice(0, 5).map(alert => `
        <li class="alert-item alert-${alert.severity.toLowerCase()}">
          <strong>${alert.title}</strong>: ${alert.message}
        </li>
      `).join('')}
    </ul>
  </div>
  ` : ''}

  <!-- Field Operations -->
  <div class="section">
    <div class="section-title">Field Operations (This Week)</div>
    <table class="metrics-table">
      <tr>
        <td>Daily Reports Submitted</td>
        <td class="value">${project.DailyReport.length}</td>
      </tr>
      <tr>
        <td>Active Crews</td>
        <td class="value">${project.Crew.length}</td>
      </tr>
      <tr>
        <td>Est. Workers on Site</td>
        <td class="value">${project.Crew.reduce((sum, c) => sum + (c.averageSize || 0), 0)}</td>
      </tr>
      <tr>
        <td>Documents Uploaded</td>
        <td class="value">${project.Document.length}</td>
      </tr>
    </table>
  </div>

  <div class="footer">
    Generated by ForemanOS • ${project.name} • ${format(new Date(), 'MMMM d, yyyy h:mm a')}
  </div>
</body>
</html>
    `;

    // Use HTML2PDF API to convert
    const pdfResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/html2pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html,
        options: {
          format: 'letter',
          margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
        }
      })
    });

    if (!pdfResponse.ok) {
      // Fallback: return HTML if PDF generation fails
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="${project.slug}-executive-report-${format(new Date(), 'yyyy-MM-dd')}.html"`
        }
      });
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${project.slug}-executive-report-${format(new Date(), 'yyyy-MM-dd')}.pdf"`
      }
    });

  } catch (error) {
    logger.error('[Executive Dashboard Export Error]', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
