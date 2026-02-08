/**
 * Crew Templates API
 * CRUD endpoint for crew templates (smart defaults).
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createScopedLogger } from '@/lib/logger';

const log = createScopedLogger('CREW_TEMPLATES');

interface CrewEntry {
  tradeName: string;
  workerCount: number;
  hourlyRate?: number;
}

/**
 * GET /api/projects/[slug]/crew-templates
 * List all crew templates for the project
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const { slug } = resolvedParams;

    // Find project by slug
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check membership and role
    const { getDailyReportRole } = await import('@/lib/daily-report-permissions');
    const role = await getDailyReportRole(session.user.id, project.id);

    if (!role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Any role can view templates
    const templates = await prisma.crewTemplate.findMany({
      where: { projectId: project.id },
      orderBy: { lastUsedAt: 'desc' },
    });

    log.info('Listed crew templates', { projectId: project.id, count: templates.length });
    return NextResponse.json({ templates });
  } catch (error) {
    log.error('GET crew templates failed', error as Error);
    return NextResponse.json({ error: 'Failed to fetch crew templates' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[slug]/crew-templates
 * Create a new crew template
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const { slug } = resolvedParams;

    // Find project by slug
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check membership and role
    const { getDailyReportRole, canCreateReport } = await import('@/lib/daily-report-permissions');
    const role = await getDailyReportRole(session.user.id, project.id);

    if (!role || !canCreateReport(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse and validate body
    const body = await request.json();
    const { name, entries } = body as { name?: string; entries?: CrewEntry[] };

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'Entries array is required and must not be empty' }, { status: 400 });
    }

    // Validate entries structure
    for (const entry of entries) {
      if (!entry.tradeName || typeof entry.workerCount !== 'number') {
        return NextResponse.json(
          { error: 'Each entry must have tradeName and workerCount' },
          { status: 400 }
        );
      }
    }

    // Create template
    const template = await prisma.crewTemplate.create({
      data: {
        projectId: project.id,
        name: name.trim(),
        entries: entries as unknown as any, // JSON field
        createdBy: session.user.id,
      },
    });

    log.info('Created crew template', { templateId: template.id, projectId: project.id, name: template.name });
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    log.error('POST crew template failed', error as Error);
    return NextResponse.json({ error: 'Failed to create crew template' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[slug]/crew-templates?id=xyz
 * Delete a crew template
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const { slug } = resolvedParams;

    // Get template ID from query params
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');

    if (!templateId) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    // Find project by slug
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Find template and verify it belongs to project
    const template = await prisma.crewTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, projectId: true, createdBy: true },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (template.projectId !== project.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check permissions
    const { getDailyReportRole, canDeleteReport } = await import('@/lib/daily-report-permissions');
    const role = await getDailyReportRole(session.user.id, project.id);

    if (!role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only creator or ADMIN can delete
    if (template.createdBy !== session.user.id && !canDeleteReport(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete template
    await prisma.crewTemplate.delete({
      where: { id: templateId },
    });

    log.info('Deleted crew template', { templateId, projectId: project.id });
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('DELETE crew template failed', error as Error);
    return NextResponse.json({ error: 'Failed to delete crew template' }, { status: 500 });
  }
}
