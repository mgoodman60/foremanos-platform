/**
 * Project Enhancement API
 * POST /api/projects/[slug]/enhance
 * 
 * Triggers project-wide data enhancement
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { enhanceProjectData } from '@/lib/project-data-enhancer';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_ENHANCE');

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    logger.info('[Enhancement API] Starting enhancement for project', { slug });

    const result = await enhanceProjectData(slug);

    return NextResponse.json({
      success: result.success,
      modulesRun: result.modulesRun,
      improvements: result.improvements,
      errors: result.errors,
    });

  } catch (error) {
    logger.error('[Enhancement API] Error', error);
    return NextResponse.json(
      { error: `Enhancement failed: ${error}` },
      { status: 500 }
    );
  }
}
