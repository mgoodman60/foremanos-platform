/**
 * MEP Path Tracing API
 * Traces paths between MEP elements through the building
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { tracePath, type MEPSystem } from '@/lib/mep-path-tracer';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEP_TRACE_PATH');

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
    const { system, startTag, endTag } = body as {
      system: MEPSystem;
      startTag: string;
      endTag: string;
    };

    if (!system || !startTag || !endTag) {
      return NextResponse.json(
        { error: 'system, startTag, and endTag are required' },
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

    // Trace the path
    const path = await tracePath(slug, system, startTag, endTag);

    if (!path) {
      return NextResponse.json({
        success: false,
        error: 'Unable to trace path - elements not found or not connected'
      });
    }

    return NextResponse.json({
      success: true,
      path: {
        ...path,
        visualization: generatePathVisualization(path)
      },
      analysis: {
        floors: path.floors.length,
        verticalTransitions: path.risers.length,
        horizontalDistance: Math.round(path.pathLength),
        clashCount: path.clashes.length,
        criticalClashes: path.clashes.filter(c => c.severity === 'critical').length,
        pathQuality: path.clashes.length === 0 ? 'excellent' :
                     path.clashes.filter(c => c.severity === 'critical').length === 0 ? 'good' :
                     'needs coordination'
      }
    });
  } catch (error) {
    logger.error('Path tracing error', error);
    return NextResponse.json(
      { error: 'Failed to trace path' },
      { status: 500 }
    );
  }
}

function generatePathVisualization(path: any): string[] {
  const steps: string[] = [];

  steps.push(`🎯 Start: ${path.startPoint.tag || path.startPoint.type} at ${path.startPoint.location.description}`);

  for (const intermediate of path.intermediatePoints) {
    const icon = intermediate.type === 'riser' ? '⬆️' : '➡️';
    steps.push(`${icon} ${intermediate.type} at ${intermediate.location.description}`);
  }

  steps.push(`🏁 End: ${path.endPoint.tag || path.endPoint.type} at ${path.endPoint.location.description}`);

  if (path.clashes.length > 0) {
    steps.push(`⚠️ ${path.clashes.length} clash${path.clashes.length > 1 ? 'es' : ''} detected along path`);
  }

  return steps;
}
