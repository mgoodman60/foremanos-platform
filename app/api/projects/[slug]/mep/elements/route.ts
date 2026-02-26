/**
 * MEP Elements API
 * Retrieves MEP elements (mechanical, electrical, plumbing) from project drawings
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractMEPElements, type MEPSystem } from '@/lib/mep-path-tracer';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEP_ELEMENTS');

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
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

    // Group by system for summary
    const summary = {
      mechanical: elements.filter(e => e.system === 'mechanical').length,
      electrical: elements.filter(e => e.system === 'electrical').length,
      plumbing: elements.filter(e => e.system === 'plumbing').length,
      fire_protection: elements.filter(e => e.system === 'fire_protection').length,
      total: elements.length
    };

    return NextResponse.json({
      success: true,
      elements,
      summary,
      filter: system || 'all'
    });
  } catch (error) {
    logger.error('MEP elements extraction error', error);
    return NextResponse.json(
      { error: 'Failed to extract MEP elements' },
      { status: 500 }
    );
  }
}
