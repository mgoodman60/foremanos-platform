// Weather API Route
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getProjectWeather, autoPopulateDailyReportWeather, fetchCurrentWeather, calculateWorkImpact } from '@/lib/weather-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_WEATHER');

// Fallback coordinates - Louisville, KY (only used if project has no location set)
const _FALLBACK_LAT = 38.2085;
const _FALLBACK_LON = -85.7585;

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch project with location coordinates
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { 
        id: true,
        name: true,
        locationLat: true,
        locationLon: true,
        locationCity: true,
        locationState: true
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if project has location configured
    if (!project.locationLat || !project.locationLon) {
      return NextResponse.json({
        error: 'PROJECT_LOCATION_NOT_SET',
        message: 'Project location is not configured. Please set the project location to get accurate weather data.',
        requiresSetup: true,
        projectName: project.name,
        currentLocation: {
          city: project.locationCity || null,
          state: project.locationState || null
        }
      }, { status: 400 });
    }

    const lat = project.locationLat;
    const lon = project.locationLon;
    const locationInfo = `${project.locationCity || 'Unknown'}, ${project.locationState || 'Unknown'}`;

    logger.info('[Weather API] Using coordinates for project', { project: project.name, lat, lon, location: locationInfo });

    const url = new URL(request.url);
    const forDailyReport = url.searchParams.get('forDailyReport') === 'true';

    if (forDailyReport) {
      const weatherData = await autoPopulateDailyReportWeather(lat, lon);
      if (!weatherData) {
        return NextResponse.json({ error: 'Weather data unavailable' });
      }
      return NextResponse.json({
        ...weatherData,
        location: locationInfo,
        coordinates: { lat, lon }
      });
    }

    const forecast = await getProjectWeather(params.slug);
    const current = await fetchCurrentWeather(lat, lon);
    const impact = current ? calculateWorkImpact(current) : 'none';

    return NextResponse.json({
      current,
      forecast,
      impact,
      location: locationInfo,
      coordinates: { lat, lon },
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[Weather API] Error', error);
    return NextResponse.json(
      { error: 'Failed to fetch weather data' },
      { status: 500 }
    );
  }
}
