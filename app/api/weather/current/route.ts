/**
 * Current Weather API
 * 
 * GET /api/weather/current?projectSlug=xxx
 * Fetches current weather for a project location
 * 
 * Used for on-demand weather fetching in daily reports
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { fetchCurrentWeather } from '@/lib/weather-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('WEATHER_CURRENT');

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const projectSlug = searchParams.get('projectSlug');

    if (!projectSlug) {
      return NextResponse.json(
        { error: 'Project slug is required' },
        { status: 400 }
      );
    }

    // Get project with location data
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      select: {
        id: true,
        name: true,
        locationLat: true,
        locationLon: true,
        locationCity: true,
        locationState: true,
        ProjectMember: {
          where: { userId: session.user.id },
          select: { role: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Verify user has access to project
    if (project.ProjectMember.length === 0) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Check if project has location data
    if (!project.locationLat || !project.locationLon) {
      return NextResponse.json(
        { 
          error: 'Project location not configured',
          message: 'Please configure project location in project settings to enable weather data.'
        },
        { status: 400 }
      );
    }

    // Fetch current weather
    const weatherData = await fetchCurrentWeather(
      project.locationLat,
      project.locationLon
    );

    if (!weatherData) {
      return NextResponse.json(
        { error: 'Failed to fetch weather data' },
        { status: 500 }
      );
    }

    // Return weather data with location info
    return NextResponse.json({
      ...weatherData,
      location: {
        city: project.locationCity,
        state: project.locationState,
        lat: project.locationLat,
        lon: project.locationLon,
      },
      projectName: project.name,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error', error);
    return NextResponse.json(
      { error: 'Failed to fetch weather data' },
      { status: 500 }
    );
  }
}
