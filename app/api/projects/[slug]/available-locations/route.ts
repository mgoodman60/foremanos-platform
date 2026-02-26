/**
 * Available Locations API
 * 
 * GET /api/projects/[slug]/available-locations
 * Returns all detected locations from plan sheets (rooms, areas, elevations, zones)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { findAvailableLocations } from '@/lib/location-detector';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_AVAILABLE_LOCATIONS');

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

    // Verify user has access to this project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        ProjectMember: {
          where: { userId: session.user.id },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if user is owner or member
    const isOwner = project.ownerId === session.user.id;
    const isMember = project.ProjectMember.length > 0;

    if (!isOwner && !isMember) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get available locations from plan sheets
    const locations = await findAvailableLocations(slug);

    return NextResponse.json(locations);
  } catch (error) {
    logger.error('Error fetching available locations', error);
    return NextResponse.json(
      { error: 'Failed to fetch available locations' },
      { status: 500 }
    );
  }
}
