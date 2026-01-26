// iCal Export Service - Generate calendar feeds for milestones and tasks
import { format, addDays } from 'date-fns';
import { prisma } from './db';
// Types are inferred from Prisma queries

// Generate unique ID for calendar events
function generateUID(prefix: string, id: string): string {
  return `${prefix}-${id}@foremanos.site`;
}

// Escape special characters in iCal strings
function escapeICalString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Format date for iCal (YYYYMMDD or YYYYMMDDTHHmmssZ)
function formatICalDate(date: Date, allDay = false): string {
  if (allDay) {
    return format(date, "yyyyMMdd");
  }
  return format(date, "yyyyMMdd'T'HHmmss'Z'");
}

// Build a VEVENT component
function buildVEvent({
  uid,
  summary,
  description,
  dtstart,
  dtend,
  location,
  categories,
  priority,
  status,
  allDay = true
}: {
  uid: string;
  summary: string;
  description?: string;
  dtstart: Date;
  dtend?: Date;
  location?: string;
  categories?: string[];
  priority?: number;
  status?: string;
  allDay?: boolean;
}): string {
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatICalDate(new Date(), false)}`,
    allDay ? `DTSTART;VALUE=DATE:${formatICalDate(dtstart, true)}` : `DTSTART:${formatICalDate(dtstart, false)}`,
    `SUMMARY:${escapeICalString(summary)}`
  ];

  if (dtend) {
    lines.push(allDay ? `DTEND;VALUE=DATE:${formatICalDate(dtend, true)}` : `DTEND:${formatICalDate(dtend, false)}`);
  }

  if (description) {
    lines.push(`DESCRIPTION:${escapeICalString(description)}`);
  }

  if (location) {
    lines.push(`LOCATION:${escapeICalString(location)}`);
  }

  if (categories && categories.length > 0) {
    lines.push(`CATEGORIES:${categories.join(',')}`);
  }

  if (priority) {
    lines.push(`PRIORITY:${priority}`);
  }

  if (status) {
    const icalStatus = status === 'COMPLETED' ? 'COMPLETED' : 
                       status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED';
    lines.push(`STATUS:${icalStatus}`);
  }

  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

// Export milestones as iCal
export async function exportMilestonesAsICal(projectId: string): Promise<string> {
  const milestones = await prisma.milestone.findMany({
    where: { projectId },
    orderBy: { plannedDate: 'asc' }
  });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, locationCity: true, locationState: true }
  });

  const projectName = project?.name || 'Project';
  const location = [project?.locationCity, project?.locationState].filter(Boolean).join(', ');

  const events = milestones.map((milestone) => {
    return buildVEvent({
      uid: generateUID('milestone', milestone.id),
      summary: `[MILESTONE] ${milestone.name}`,
      description: milestone.description || undefined,
      dtstart: milestone.plannedDate,
      dtend: milestone.actualDate || addDays(milestone.plannedDate, 1),
      location,
      categories: ['Milestone', milestone.category || 'General'],
      priority: milestone.isCritical ? 1 : 5,
      status: milestone.status
    });
  });

  return buildICalendar(`${projectName} - Milestones`, events);
}

// Export schedule tasks as iCal
export async function exportScheduleAsICal(projectId: string, criticalOnly = false): Promise<string> {
  const schedule = await prisma.schedule.findFirst({
    where: { projectId },
    include: {
      ScheduleTask: {
        where: criticalOnly ? { isCritical: true } : {},
        orderBy: { startDate: 'asc' }
      }
    }
  });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, locationCity: true, locationState: true }
  });

  const projectName = project?.name || 'Project';
  const location = [project?.locationCity, project?.locationState].filter(Boolean).join(', ');

  if (!schedule?.ScheduleTask) {
    return buildICalendar(`${projectName} - Schedule`, []);
  }

  const events = schedule.ScheduleTask
    .filter((task) => task.startDate && task.endDate)
    .map((task) => {
      const description = [
        `Progress: ${task.percentComplete || 0}%`,
        task.isCritical ? '⚠️ CRITICAL PATH' : '',
        task.totalFloat ? `Float: ${task.totalFloat} days` : '',
        task.predecessors?.length ? `Predecessors: ${task.predecessors.join(', ')}` : ''
      ].filter(Boolean).join('\n');

      return buildVEvent({
        uid: generateUID('task', task.id),
        summary: `${task.isCritical ? '🔴 ' : ''}${task.name}`,
        description,
        dtstart: task.startDate!,
        dtend: task.endDate!,
        location,
        categories: task.isCritical ? ['Critical Path', 'Schedule'] : ['Schedule'],
        priority: task.isCritical ? 1 : 5,
        status: task.status === 'completed' ? 'COMPLETED' : 'CONFIRMED'
      });
    });

  return buildICalendar(`${projectName} - ${criticalOnly ? 'Critical Path' : 'Schedule'}`, events);
}

// Export inspections and submittals as iCal
export async function exportDeadlinesAsICal(projectId: string): Promise<string> {
  const [submittals, procurements] = await Promise.all([
    prisma.mEPSubmittal.findMany({
      where: { 
        projectId,
        dueDate: { not: null },
        status: { in: ['PENDING', 'SUBMITTED', 'UNDER_REVIEW'] }
      },
      orderBy: { dueDate: 'asc' }
    }),
    prisma.procurement.findMany({
      where: {
        projectId,
        requiredDate: { not: null },
        status: { in: ['IDENTIFIED', 'SPEC_REVIEW', 'BIDDING', 'AWARDED', 'ORDERED', 'IN_TRANSIT'] }
      },
      orderBy: { requiredDate: 'asc' }
    })
  ]);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true }
  });

  const projectName = project?.name || 'Project';

  const events: string[] = [];

  // Submittals
  submittals.forEach((sub) => {
    if (!sub.dueDate) return;
    events.push(buildVEvent({
      uid: generateUID('submittal', sub.id),
      summary: `[SUBMITTAL DUE] ${sub.submittalNumber}: ${sub.title}`,
      description: `Type: ${sub.submittalType}\nSpec Section: ${sub.specSection || 'N/A'}\nStatus: ${sub.status}`,
      dtstart: sub.dueDate,
      categories: ['Submittal', 'Deadline'],
      priority: 3
    }));
  });

  // Procurements
  procurements.forEach((proc) => {
    if (!proc.requiredDate) return;
    events.push(buildVEvent({
      uid: generateUID('procurement', proc.id),
      summary: `[DELIVERY REQUIRED] ${proc.description}`,
      description: `Status: ${proc.status}\nQuantity: ${proc.quantity || ''} ${proc.unit || ''}`,
      dtstart: proc.requiredDate,
      categories: ['Procurement', 'Deadline'],
      priority: 3
    }));
  });

  return buildICalendar(`${projectName} - Deadlines`, events);
}

// Build complete iCalendar file
function buildICalendar(calendarName: string, events: string[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ForemanOS//Construction Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICalString(calendarName)}`,
    'X-WR-TIMEZONE:America/New_York'
  ];

  events.forEach(event => {
    lines.push(event);
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// Generate calendar subscription URL
export function getCalendarSubscriptionUrl(
  projectSlug: string,
  calendarType: 'milestones' | 'schedule' | 'critical-path' | 'deadlines'
): string {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://foremanos.site';
  return `${baseUrl}/api/projects/${projectSlug}/calendar/${calendarType}.ics`;
}

// Combined project calendar
export async function exportProjectCalendar(projectId: string): Promise<string> {
  const [milestones, schedule, submittals] = await Promise.all([
    prisma.milestone.findMany({ where: { projectId } }),
    prisma.schedule.findFirst({
      where: { projectId },
      include: { ScheduleTask: { where: { isCritical: true } } }
    }),
    prisma.mEPSubmittal.findMany({
      where: { projectId, dueDate: { not: null } }
    })
  ]);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, locationCity: true, locationState: true }
  });

  const projectName = project?.name || 'Project';
  const location = [project?.locationCity, project?.locationState].filter(Boolean).join(', ');
  const events: string[] = [];

  // Add milestones
  milestones.forEach((m) => {
    events.push(buildVEvent({
      uid: generateUID('milestone', m.id),
      summary: `🎯 ${m.name}`,
      description: m.description || undefined,
      dtstart: m.plannedDate,
      location,
      categories: ['Milestone'],
      priority: m.isCritical ? 1 : 5
    }));
  });

  // Add critical tasks
  schedule?.ScheduleTask?.forEach((t) => {
    if (!t.startDate || !t.endDate) return;
    events.push(buildVEvent({
      uid: generateUID('task', t.id),
      summary: `🔴 ${t.name}`,
      dtstart: t.startDate,
      dtend: t.endDate,
      location,
      categories: ['Critical Path']
    }));
  });

  // Add submittal deadlines
  submittals.forEach((s) => {
    if (!s.dueDate) return;
    events.push(buildVEvent({
      uid: generateUID('submittal', s.id),
      summary: `📋 ${s.title}`,
      dtstart: s.dueDate,
      categories: ['Submittal']
    }));
  });

  return buildICalendar(`${projectName} - Project Calendar`, events);
}
