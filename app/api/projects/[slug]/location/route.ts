/**
 * Project Location API
 * 
 * GET /api/projects/[slug]/location
 * Get current project location
 * 
 * PUT /api/projects/[slug]/location
 * Update project location (with geocoding support)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Geocode using OpenWeatherMap Geocoding API
async function geocodeLocation(city: string, state: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
      console.warn('[Location API] No OpenWeatherMap API key for geocoding');
      return null;
    }
    
    const query = `${city}, ${state}, US`;
    const response = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=1&appid=${apiKey}`
    );
    
    if (!response.ok) {
      console.error('[Location API] Geocoding request failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    if (data && data.length > 0) {
      return { lat: data[0].lat, lon: data[0].lon };
    }
    
    return null;
  } catch (error) {
    console.error('[Location API] Geocoding error:', error);
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        name: true,
        locationCity: true,
        locationState: true,
        locationZip: true,
        locationLat: true,
        locationLon: true,
        projectAddress: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const isConfigured = project.locationLat !== null && project.locationLon !== null;

    return NextResponse.json({
      ...project,
      isConfigured,
    });
  } catch (error) {
    console.error('[Location API] Error fetching location:', error);
    return NextResponse.json(
      { error: 'Failed to fetch location' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true, ownerId: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    
    if (user?.role !== 'admin' && project.ownerId !== session.user.id) {
      // Check if user is project member with admin role
      const membership = await prisma.projectMember.findFirst({
        where: {
          projectId: project.id,
          userId: session.user.id,
          role: 'admin',
        },
      });
      
      if (!membership) {
        return NextResponse.json(
          { error: 'Permission denied' },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const { city, state, zip, address, lat, lon } = body;

    let finalLat = lat;
    let finalLon = lon;

    // If coordinates not provided but city/state are, geocode
    if ((!finalLat || !finalLon) && city && state) {
      const coords = await geocodeLocation(city, state);
      if (coords) {
        finalLat = coords.lat;
        finalLon = coords.lon;
      }
    }

    // Update project location
    const updatedProject = await prisma.project.update({
      where: { id: project.id },
      data: {
        locationCity: city || undefined,
        locationState: state || undefined,
        locationZip: zip || undefined,
        projectAddress: address || undefined,
        locationLat: finalLat || undefined,
        locationLon: finalLon || undefined,
      },
      select: {
        id: true,
        name: true,
        locationCity: true,
        locationState: true,
        locationZip: true,
        locationLat: true,
        locationLon: true,
        projectAddress: true,
      },
    });

    const isConfigured = updatedProject.locationLat !== null && updatedProject.locationLon !== null;
    const wasGeocoded = (!lat || !lon) && finalLat && finalLon;

    return NextResponse.json({
      ...updatedProject,
      isConfigured,
      geocoded: wasGeocoded,
      message: isConfigured 
        ? `Location set to ${updatedProject.locationCity}, ${updatedProject.locationState}`
        : 'Location updated but coordinates could not be determined',
    });
  } catch (error) {
    console.error('[Location API] Error updating location:', error);
    return NextResponse.json(
      { error: 'Failed to update location' },
      { status: 500 }
    );
  }
}
