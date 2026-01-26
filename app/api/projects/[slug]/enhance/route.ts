/**
 * Project Enhancement API
 * POST /api/projects/[slug]/enhance
 * 
 * Triggers project-wide data enhancement
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { enhanceProjectData } from '@/lib/project-data-enhancer';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    console.log(`[Enhancement API] Starting enhancement for project: ${slug}`);

    const result = await enhanceProjectData(slug);

    return NextResponse.json({
      success: result.success,
      modulesRun: result.modulesRun,
      improvements: result.improvements,
      errors: result.errors,
    });

  } catch (error) {
    console.error('[Enhancement API] Error:', error);
    return NextResponse.json(
      { error: `Enhancement failed: ${error}` },
      { status: 500 }
    );
  }
}
