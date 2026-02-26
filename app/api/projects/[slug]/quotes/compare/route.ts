import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { compareQuotes } from '@/lib/quote-analysis-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_QUOTES_COMPARE');

export const dynamic = 'force-dynamic';

// POST - Compare multiple quotes
export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const { quoteIds } = body;

    if (!quoteIds || !Array.isArray(quoteIds) || quoteIds.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 quote IDs are required for comparison' },
        { status: 400 }
      );
    }

    const comparison = await compareQuotes(project.id, quoteIds);

    return NextResponse.json({ comparison });
  } catch (error) {
    logger.error('[QUOTES COMPARE] Error', error);
    return NextResponse.json({ error: 'Failed to compare quotes' }, { status: 500 });
  }
}
