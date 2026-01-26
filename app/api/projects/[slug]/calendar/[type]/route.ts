// Calendar Export API Route - iCal feeds
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  exportMilestonesAsICal,
  exportScheduleAsICal,
  exportDeadlinesAsICal,
  exportProjectCalendar
} from '@/lib/calendar-export';

export async function GET(
  request: Request,
  { params }: { params: { slug: string; type: string } }
) {
  try {
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true, name: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Remove .ics extension if present
    const calendarType = params.type.replace('.ics', '');

    let icalContent: string;
    let filename: string;

    switch (calendarType) {
      case 'milestones':
        icalContent = await exportMilestonesAsICal(project.id);
        filename = `${project.name}-milestones.ics`;
        break;
      
      case 'schedule':
        icalContent = await exportScheduleAsICal(project.id, false);
        filename = `${project.name}-schedule.ics`;
        break;
      
      case 'critical-path':
        icalContent = await exportScheduleAsICal(project.id, true);
        filename = `${project.name}-critical-path.ics`;
        break;
      
      case 'deadlines':
        icalContent = await exportDeadlinesAsICal(project.id);
        filename = `${project.name}-deadlines.ics`;
        break;
      
      case 'all':
      case 'combined':
        icalContent = await exportProjectCalendar(project.id);
        filename = `${project.name}-calendar.ics`;
        break;
      
      default:
        return NextResponse.json(
          { error: 'Invalid calendar type. Options: milestones, schedule, critical-path, deadlines, all' },
          { status: 400 }
        );
    }

    return new NextResponse(icalContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error) {
    console.error('[Calendar API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate calendar' },
      { status: 500 }
    );
  }
}
