// Export API Route - CSV exports for project data
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { exportProjectData } from '@/lib/export-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_EXPORT');

export async function GET(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const type = url.searchParams.get('type') as 'daily_reports' | 'budget' | 'schedule' | 'mep' | 'change_orders' | 'crew_performance';
    
    if (!type) {
      return NextResponse.json(
        { error: 'Export type required. Options: daily_reports, budget, schedule, mep, change_orders, crew_performance' },
        { status: 400 }
      );
    }

    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    const options = {
      format: 'csv' as const,
      dateRange: startDate && endDate ? {
        start: new Date(startDate),
        end: new Date(endDate)
      } : undefined
    };

    const { content, filename, mimeType } = await exportProjectData(project.id, type, options);

    return new NextResponse(content, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    logger.error('[Export API] Error', error);
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    );
  }
}
