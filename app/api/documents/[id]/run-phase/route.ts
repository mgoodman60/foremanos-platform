import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limiter';
import { runIntelligenceExtraction } from '@/lib/intelligence-orchestrator';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitCheck = await checkRateLimit(`run-phase:${session.user.id}`, { maxRequests: 10, windowSeconds: 3600 });
    if (!rateLimitCheck.success) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const body = await req.json();
    const { phases, pageRange } = body;

    if (!Array.isArray(phases) || phases.length === 0) {
      return NextResponse.json({ error: 'phases array required' }, { status: 400 });
    }

    const validPhases = phases.filter((p: string) => ['A', 'B', 'C'].includes(p));
    if (validPhases.length === 0) {
      return NextResponse.json({ error: 'Invalid phases. Must be A, B, or C.' }, { status: 400 });
    }

    const documentId = params.id;

    // Get project slug from document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { Project: { select: { slug: true } } },
    });

    if (!document || !document.Project) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const result = await runIntelligenceExtraction({
      documentId,
      projectSlug: document.Project.slug,
      phases: validPhases as ('A' | 'B' | 'C')[],
      pageRange,
    });

    // Update phasesRun on document
    const existingPhases = (document.phasesRun as string[] || []);
    const updatedPhases = [...new Set([...existingPhases, ...validPhases])];
    await prisma.document.update({
      where: { id: documentId },
      data: { phasesRun: updatedPhases },
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('RUN_PHASE', 'Error running intelligence phase', error as Error);
    return NextResponse.json({ error: 'Failed to run phase' }, { status: 500 });
  }
}
