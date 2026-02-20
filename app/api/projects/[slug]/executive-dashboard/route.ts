/**
 * Executive Dashboard API - Consolidated metrics with real data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { startOfWeek, format, differenceInDays } from 'date-fns';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
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
          include: {
            BudgetItem: true
          }
        },
        Schedule: {
          include: {
            ScheduleTask: true
          }
        },
        MEPSubmittal: {
          include: {
            lineItems: true
          }
        },
        ChangeOrder: true,
        DailyReport: {
          where: {
            createdAt: {
              gte: startOfWeek(new Date())
            }
          }
        },
        Document: {
          where: { deletedAt: null }
        },
        Crew: {
          where: { isActive: true }
        },
        CostAlert: {
          where: {
            isDismissed: false
          }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Calculate Schedule Metrics
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

    // Calculate Budget Metrics
    const budget = project.ProjectBudget[0];
    const budgetItems = budget?.BudgetItem || [];
    const totalBudget = budgetItems.reduce((sum, item) => sum + (item.budgetedAmount || 0), 0);
    const spent = budgetItems.reduce((sum, item) => sum + (item.actualCost || 0), 0);
    const committed = budgetItems.reduce((sum, item) => sum + (item.committedCost || 0), 0);
    const variance = totalBudget > 0 ? ((spent - (totalBudget * (totalProgress / 100))) / totalBudget) * 100 : 0;
    const forecastAtCompletion = totalProgress > 0 
      ? (spent / (totalProgress / 100))
      : totalBudget;

    // Calculate Submittal Metrics
    const submittals = project.MEPSubmittal || [];
    const approvedSubmittals = submittals.filter(s => s.status === 'APPROVED').length;
    const pendingSubmittals = submittals.filter(s => 
      ['PENDING', 'SUBMITTED', 'UNDER_REVIEW'].includes(s.status)
    ).length;
    const rejectedSubmittals = submittals.filter(s => s.status === 'REJECTED').length;
    
    // Count shortages from line items
    let shortages = 0;
    for (const sub of submittals) {
      for (const item of sub.lineItems || []) {
        const delivered = (item as any).deliveredQty || 0;
        const required = (item as any).requiredQty || 0;
        if (delivered < required) shortages++;
      }
    }

    // Field Operations
    const dailyReportsThisWeek = project.DailyReport.length;
    const safetyIncidents = project.DailyReport.filter(r => 
      (r as any).safetyIncidents && (r as any).safetyIncidents.length > 0
    ).length;

    // Labor
    const crewsOnSite = project.Crew.length;
    const totalWorkers = project.Crew.reduce((sum, c) => sum + (c.averageSize || 0), 0);
    
    // Calculate hours this week from daily reports
    const hoursThisWeek = project.DailyReport.reduce((sum, report) => {
      const labor = (report as any).laborSummary || [];
      return sum + labor.reduce((h: number, l: any) => h + (l.hours || 0), 0);
    }, 0);

    // Weather (mock if no weather data)
    const weather = {
      current: 'Clear',
      temp: 65,
      workImpact: 'Low',
      daysAffectedThisWeek: 0
    };

    // Fetch weather from project location if available
    if (project.locationLat && project.locationLon) {
      try {
        const weatherRes = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${project.locationLat}&lon=${project.locationLon}&units=imperial&appid=${process.env.OPENWEATHERMAP_API_KEY}`
        );
        if (weatherRes.ok) {
          const weatherData = await weatherRes.json();
          weather.current = weatherData.weather?.[0]?.main || 'Clear';
          weather.temp = Math.round(weatherData.main?.temp || 65);
          weather.workImpact = getWorkImpact(weatherData);
        }
      } catch (e) {
        // Use defaults
      }
    }

    // Recent Activity
    const recentActivity = await getRecentActivity(project.id);

    // Change Orders
    const changeOrders = project.ChangeOrder || [];
    const pendingChangeOrders = changeOrders.filter(co => 
      ['PENDING', 'SUBMITTED', 'UNDER_REVIEW'].includes(co.status)
    ).length;
    const approvedChangeOrdersValue = changeOrders
      .filter(co => co.status === 'APPROVED')
      .reduce((sum, co) => sum + (co.approvedAmount || 0), 0);

    // Cost Alerts
    const activeAlerts = project.CostAlert || [];

    const metrics = {
      schedule: {
        percentComplete: Math.round(totalProgress),
        daysRemaining,
        tasksOnTrack,
        tasksDelayed,
        criticalTasks,
        endDate: scheduleEndDate?.toISOString() || null,
        totalTasks: tasks.length
      },
      budget: {
        totalBudget,
        spent,
        committed,
        variance: parseFloat(variance.toFixed(2)),
        forecastAtCompletion,
        contingencyRemaining: budget?.contingencyBudget 
          ? (budget.contingencyBudget - (budget as any).contingencyUsed || 0) 
          : 0
      },
      submittals: {
        total: submittals.length,
        approved: approvedSubmittals,
        pending: pendingSubmittals,
        rejected: rejectedSubmittals,
        shortages
      },
      fieldOps: {
        openRFIs: 0, // RFI model not implemented yet
        openPunchItems: 0, // Punch list not implemented yet
        dailyReportsThisWeek,
        safetyIncidents
      },
      weather,
      labor: {
        crewsOnSite,
        totalWorkers,
        hoursThisWeek
      },
      changeOrders: {
        total: changeOrders.length,
        pending: pendingChangeOrders,
        approvedValue: approvedChangeOrdersValue
      },
      documents: {
        total: project.Document.length,
        processed: project.Document.filter(d => (d as any).processedAt).length
      },
      alerts: {
        critical: activeAlerts.filter(a => a.severity === 'CRITICAL').length,
        warning: activeAlerts.filter(a => a.severity === 'WARNING').length,
        info: activeAlerts.filter(a => a.severity === 'INFO').length
      }
    };

    return NextResponse.json({
      metrics,
      recentActivity,
      generatedAt: new Date().toISOString(),
      projectName: project.name
    });

  } catch (error) {
    console.error('[Executive Dashboard API Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}

function getWorkImpact(weatherData: any): string {
  const temp = weatherData.main?.temp || 65;
  const windSpeed = weatherData.wind?.speed || 0;
  const conditions = weatherData.weather?.[0]?.main?.toLowerCase() || '';

  if (conditions.includes('rain') || conditions.includes('storm') || conditions.includes('snow')) {
    return 'High';
  }
  if (temp > 100 || temp < 32 || windSpeed > 25) {
    return 'Moderate';
  }
  if (temp > 90 || temp < 40 || windSpeed > 15) {
    return 'Low';
  }
  return 'None';
}

async function getRecentActivity(projectId: string) {
  const activities: any[] = [];

  // Get recent submittals
  const recentSubmittals = await prisma.mEPSubmittal.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: {
      id: true,
      submittalNumber: true,
      title: true,
      status: true,
      updatedAt: true
    }
  });

  for (const sub of recentSubmittals) {
    activities.push({
      id: `sub-${sub.id}`,
      type: 'submittal',
      action: `Submittal ${sub.submittalNumber} - ${sub.status}`,
      description: sub.title,
      timestamp: sub.updatedAt.toISOString()
    });
  }

  // Get recent change orders
  const recentChangeOrders = await prisma.changeOrder.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
    take: 3,
    select: {
      id: true,
      orderNumber: true,
      title: true,
      status: true,
      updatedAt: true
    }
  });

  for (const co of recentChangeOrders) {
    activities.push({
      id: `co-${co.id}`,
      type: 'budget',
      action: `Change Order ${co.orderNumber} - ${co.status}`,
      description: co.title,
      timestamp: co.updatedAt.toISOString()
    });
  }

  // Get recent daily reports
  const recentReports = await prisma.dailyReport.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: {
      id: true,
      reportDate: true,
      createdAt: true,
      weatherCondition: true,
      workPerformed: true
    }
  });

  for (const report of recentReports) {
    activities.push({
      id: `dr-${report.id}`,
      type: 'daily_report',
      action: `Daily Report - ${format(new Date(report.reportDate), 'MMM d')}`,
      description: report.workPerformed || report.weatherCondition || 'Daily field report submitted',
      timestamp: report.createdAt.toISOString()
    });
  }

  // Get recent documents
  const recentDocs = await prisma.document.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: {
      id: true,
      name: true,
      createdAt: true
    }
  });

  for (const doc of recentDocs) {
    activities.push({
      id: `doc-${doc.id}`,
      type: 'document',
      action: 'Document Uploaded',
      description: doc.name,
      timestamp: doc.createdAt.toISOString()
    });
  }

  // Sort by timestamp and return top 10
  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);
}
