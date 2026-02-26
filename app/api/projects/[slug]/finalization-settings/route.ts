/**
 * Project Finalization Settings API
 * 
 * GET /api/projects/[slug]/finalization-settings
 * Retrieve finalization settings for daily reports
 * 
 * PATCH /api/projects/[slug]/finalization-settings
 * Update finalization settings (Admin/Owner only)
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_FINALIZATION_SETTINGS');

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { slug } = params;

    // Get project finalization settings
    const project = await prisma.project.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        finalizationTime: true,
        dailyReportsFolderId: true,
        dailyReportEnabled: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(project);
  } catch (error) {
    logger.error('Error fetching settings', error);
    return NextResponse.json(
      { error: 'Failed to fetch finalization settings' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { slug } = params;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    // Verify permissions (only admin or project owner)
    if (user?.role !== 'admin' && project.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only project owners and admins can update finalization settings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      timezone,
      finalizationTime,
      dailyReportsFolderId,
    } = body;

    // Validate finalizationTime format (HH:MM)
    if (finalizationTime && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(finalizationTime)) {
      return NextResponse.json(
        { error: 'Invalid finalization time format. Use HH:MM (e.g., 18:00)' },
        { status: 400 }
      );
    }

    // Validate timezone (basic check for IANA format)
    if (timezone && !/^[A-Za-z]+\/[A-Za-z_]+$/.test(timezone)) {
      return NextResponse.json(
        { error: 'Invalid timezone format. Use IANA timezone (e.g., America/New_York)' },
        { status: 400 }
      );
    }

    // Update finalization settings
    const updatedProject = await prisma.project.update({
      where: { id: project.id },
      data: {
        ...(timezone !== undefined && { timezone }),
        ...(finalizationTime !== undefined && { finalizationTime }),
        ...(dailyReportsFolderId !== undefined && { dailyReportsFolderId }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        finalizationTime: true,
        dailyReportsFolderId: true,
        dailyReportEnabled: true,
      },
    });

    logger.info('Updated settings for project', {
      projectName: project.name,
      timezone: updatedProject.timezone,
      finalizationTime: updatedProject.finalizationTime,
      dailyReportsFolderId: updatedProject.dailyReportsFolderId,
    });

    return NextResponse.json({
      success: true,
      project: updatedProject,
    });
  } catch (error) {
    logger.error('Error updating settings', error);
    return NextResponse.json(
      { error: 'Failed to update finalization settings' },
      { status: 500 }
    );
  }
}
