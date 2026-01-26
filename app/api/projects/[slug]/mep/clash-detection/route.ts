/**
 * MEP Clash Detection API
 * Identifies conflicts between different MEP systems
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { detectAllClashes, type MEPSystem } from '@/lib/mep-path-tracer';

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
    const { systems } = body as { systems?: MEPSystem[] };

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

    // Detect clashes
    const clashes = await detectAllClashes(slug, systems);

    // Categorize clashes
    const critical = clashes.filter(c => c.severity === 'critical');
    const major = clashes.filter(c => c.severity === 'major');
    const minor = clashes.filter(c => c.severity === 'minor');

    return NextResponse.json({
      success: true,
      clashes,
      summary: {
        total: clashes.length,
        critical: critical.length,
        major: major.length,
        minor: minor.length,
        byType: {
          hard_clash: clashes.filter(c => c.type === 'hard_clash').length,
          soft_clash: clashes.filter(c => c.type === 'soft_clash').length,
          clearance_clash: clashes.filter(c => c.type === 'clearance_clash').length
        },
        byFloor: groupByFloor(clashes)
      },
      recommendations: generateRecommendations(critical, major)
    });
  } catch (error) {
    console.error('Clash detection error:', error);
    return NextResponse.json(
      { error: 'Failed to detect clashes' },
      { status: 500 }
    );
  }
}

function groupByFloor(clashes: any[]): Record<string, number> {
  const byFloor: Record<string, number> = {};
  for (const clash of clashes) {
    const floor = clash.location.floor;
    byFloor[floor] = (byFloor[floor] || 0) + 1;
  }
  return byFloor;
}

function generateRecommendations(critical: any[], major: any[]): string[] {
  const recommendations: string[] = [];

  if (critical.length > 0) {
    recommendations.push(
      `⚠️ ${critical.length} CRITICAL clash${critical.length > 1 ? 'es' : ''} require immediate attention`
    );
    recommendations.push(
      'Schedule coordination meeting with MEP contractors'
    );
  }

  if (major.length > 0) {
    recommendations.push(
      `${major.length} major clash${major.length > 1 ? 'es' : ''} identified - review routing options`
    );
  }

  if (critical.length === 0 && major.length === 0) {
    recommendations.push(
      '✅ No critical clashes detected - systems are well coordinated'
    );
  }

  return recommendations;
}
