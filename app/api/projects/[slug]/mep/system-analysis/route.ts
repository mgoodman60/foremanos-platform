/**
 * MEP System Analysis API
 * Provides comprehensive analysis of MEP systems
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { extractMEPElements, detectAllClashes, identifyVerticalRisers, type MEPSystem } from '@/lib/mep-path-tracer';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEP_SYSTEM_ANALYSIS');

export async function GET(
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
    const { searchParams } = new URL(request.url);
    const system = searchParams.get('system') as MEPSystem | null;

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

    // Extract MEP elements
    const elements = await extractMEPElements(slug, system || undefined);
    
    // Detect clashes
    const clashes = await detectAllClashes(slug, system ? [system] : undefined);
    
    // Identify vertical risers for the system
    const risers = system ? await identifyVerticalRisers(slug, system) : [];

    // Generate system analysis
    const analysis = {
      system: system || 'all',
      elements: {
        total: elements.length,
        byType: elements.reduce((acc: Record<string, number>, elem) => {
          acc[elem.type] = (acc[elem.type] || 0) + 1;
          return acc;
        }, {}),
        byFloor: elements.reduce((acc: Record<string, number>, elem) => {
          acc[elem.location.floor] = (acc[elem.location.floor] || 0) + 1;
          return acc;
        }, {})
      },
      clashes: {
        total: clashes.length,
        critical: clashes.filter(c => c.severity === 'critical').length,
        major: clashes.filter(c => c.severity === 'major').length,
        minor: clashes.filter(c => c.severity === 'minor').length
      },
      risers: {
        total: risers.length,
        floors: Array.from(new Set(risers.flatMap(r => r.floors))).length
      },
      health: {
        score: calculateSystemHealthScore(elements.length, clashes),
        status: getSystemHealthStatus(elements.length, clashes)
      }
    };

    return NextResponse.json({
      success: true,
      analysis
    });
  } catch (error) {
    logger.error('System analysis error', error);
    return NextResponse.json(
      { error: 'Failed to analyze MEP system' },
      { status: 500 }
    );
  }
}

function calculateSystemHealthScore(elementCount: number, clashes: any[]): number {
  let score = 100;
  
  // Deduct for lack of data
  if (elementCount === 0) score -= 50;
  else if (elementCount < 10) score -= 20;
  
  // Deduct for clashes
  const criticalClashes = clashes.filter(c => c.severity === 'critical').length;
  const majorClashes = clashes.filter(c => c.severity === 'major').length;
  
  score -= (criticalClashes * 15);
  score -= (majorClashes * 5);
  score -= (clashes.length - criticalClashes - majorClashes) * 1;
  
  return Math.max(0, Math.min(100, score));
}

function getSystemHealthStatus(elementCount: number, clashes: any[]): string {
  const score = calculateSystemHealthScore(elementCount, clashes);
  
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'fair';
  if (score >= 40) return 'poor';
  return 'critical';
}
