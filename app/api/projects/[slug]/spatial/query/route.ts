/**
 * Spatial Query API
 * Enables cross-sheet location queries and spatial correlation analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { findSheetsAtLocation, type CrossSheetQuery } from '@/lib/spatial-correlation';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { slug } = params;
    const body = await request.json();
    const { location, disciplines, includeRelated = true } = body as CrossSheetQuery & { location: string };

    if (!location) {
      return NextResponse.json(
        { error: 'Location is required' },
        { status: 400 }
      );
    }

    // Verify project access
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        ProjectMember: {
          where: { User: { email: session.user?.email } }
        }
      }
    });

    if (!project || project.ProjectMember.length === 0) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // Execute spatial query
    const matches = await findSheetsAtLocation(slug, {
      location,
      disciplines,
      includeRelated
    });

    return NextResponse.json({
      success: true,
      query: { location, disciplines, includeRelated },
      matches,
      count: matches.length,
      summary: {
        highConfidence: matches.filter(m => m.confidence >= 0.8).length,
        mediumConfidence: matches.filter(m => m.confidence >= 0.5 && m.confidence < 0.8).length,
        lowConfidence: matches.filter(m => m.confidence < 0.5).length,
        byType: {
          grid: matches.filter(m => m.matchType === 'grid').length,
          room: matches.filter(m => m.matchType === 'room').length,
          element: matches.filter(m => m.matchType === 'element').length,
          coordinate: matches.filter(m => m.matchType === 'coordinate').length
        }
      }
    });
  } catch (error) {
    console.error('Spatial query error:', error);
    return NextResponse.json(
      { error: 'Failed to execute spatial query' },
      { status: 500 }
    );
  }
}
