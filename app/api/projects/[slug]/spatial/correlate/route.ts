/**
 * Sheet Correlation API
 * Analyzes spatial relationships between two drawing sheets
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { correlateTwoSheets, extractGridSystem } from '@/lib/spatial-correlation';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SPATIAL_CORRELATE');

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { slug } = params;
    const body = await request.json();
    const { sheet1, sheet2 } = body;

    if (!sheet1 || !sheet2) {
      return NextResponse.json(
        { error: 'Both sheet1 and sheet2 are required' },
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

    // Get grid systems for both sheets
    const [gridSystem1, gridSystem2] = await Promise.all([
      extractGridSystem(slug, sheet1),
      extractGridSystem(slug, sheet2)
    ]);

    // Correlate the sheets
    const correlation = await correlateTwoSheets(slug, sheet1, sheet2);

    if (!correlation) {
      return NextResponse.json({
        success: false,
        error: 'Unable to correlate sheets - insufficient data'
      });
    }

    return NextResponse.json({
      success: true,
      sheet1: {
        number: sheet1,
        discipline: correlation.discipline1,
        gridSystem: gridSystem1?.gridSystem || [],
        bounds: gridSystem1?.bounds
      },
      sheet2: {
        number: sheet2,
        discipline: correlation.discipline2,
        gridSystem: gridSystem2?.gridSystem || [],
        bounds: gridSystem2?.bounds
      },
      correlation: {
        commonGrids: correlation.commonGrids,
        commonRooms: correlation.commonRooms,
        spatialOverlap: correlation.spatialOverlap,
        overlappingArea: correlation.spatialOverlap > 0.5 ? 'high' : 
                         correlation.spatialOverlap > 0.2 ? 'medium' : 'low',
        compatibility: {
          gridAlignment: correlation.commonGrids.length > 0,
          sharedSpaces: correlation.commonRooms.length > 0,
          crossDiscipline: correlation.discipline1 !== correlation.discipline2,
          score: (
            (correlation.commonGrids.length > 0 ? 0.4 : 0) +
            (correlation.commonRooms.length > 0 ? 0.3 : 0) +
            (correlation.spatialOverlap * 0.3)
          )
        }
      }
    });
  } catch (error) {
    logger.error('Sheet correlation error', error);
    return NextResponse.json(
      { error: 'Failed to correlate sheets' },
      { status: 500 }
    );
  }
}
