/**
 * Verification Audit History API
 * GET - List verification audit logs for a project
 */

import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { 
  getProjectVerificationHistory,
  getVerificationLogDetails 
} from '@/lib/verification-audit-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEP_SUBMITTALS_AUDIT');

export async function GET(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const logId = url.searchParams.get('logId');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const submittalId = url.searchParams.get('submittalId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    // If specific log ID requested, return details
    if (logId) {
      const details = await getVerificationLogDetails(logId);
      if (!details) {
        return NextResponse.json({ error: 'Audit log not found' }, { status: 404 });
      }
      return NextResponse.json(details);
    }

    // Otherwise return paginated history
    const history = await getProjectVerificationHistory(project.id, {
      limit,
      offset,
      submittalId: submittalId || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });

    return NextResponse.json(history);
  } catch (error) {
    logger.error('[Verification Audit API] Error', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit history' },
      { status: 500 }
    );
  }
}
