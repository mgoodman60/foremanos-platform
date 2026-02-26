/**
 * Project Metadata API
 * 
 * GET /api/projects/[slug]/metadata
 * Retrieve project metadata for PDF generation
 * 
 * PATCH /api/projects/[slug]/metadata
 * Update project metadata (Admin/Owner only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getFileUrl } from '@/lib/s3';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_METADATA');

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
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
      select: {
        id: true,
        name: true,
        slug: true,
        jobNumber: true,
        projectManager: true,
        superintendent: true,
        clientName: true,
        architectEngineer: true,
        projectAddress: true,
        locationCity: true,
        locationState: true,
        logoUrl: true,
        logoUploadedAt: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get logo public URL if exists
    let logoPublicUrl = null;
    if (project.logoUrl) {
      try {
        logoPublicUrl = await getFileUrl(project.logoUrl, true);
      } catch (error) {
        logger.error('Error getting logo URL', error);
      }
    }

    return NextResponse.json({
      ...project,
      logoPublicUrl,
    });
  } catch (error) {
    logger.error('Error fetching metadata', error);
    return NextResponse.json(
      { error: 'Failed to fetch metadata' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
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
        { error: 'Only project owners and admins can update metadata' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      jobNumber,
      projectManager,
      superintendent,
      clientName,
      architectEngineer,
      projectAddress,
    } = body;

    // Update project metadata
    const updatedProject = await prisma.project.update({
      where: { id: project.id },
      data: {
        ...(jobNumber !== undefined && { jobNumber }),
        ...(projectManager !== undefined && { projectManager }),
        ...(superintendent !== undefined && { superintendent }),
        ...(clientName !== undefined && { clientName }),
        ...(architectEngineer !== undefined && { architectEngineer }),
        ...(projectAddress !== undefined && { projectAddress }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        jobNumber: true,
        projectManager: true,
        superintendent: true,
        clientName: true,
        architectEngineer: true,
        projectAddress: true,
      },
    });

    return NextResponse.json({
      success: true,
      project: updatedProject,
    });
  } catch (error) {
    logger.error('Error updating metadata', error);
    return NextResponse.json(
      { error: 'Failed to update metadata' },
      { status: 500 }
    );
  }
}
