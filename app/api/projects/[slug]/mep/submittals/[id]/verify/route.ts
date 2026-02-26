/**
 * Submittal Verification API
 * POST: Verify all line items against project requirements
 */

import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifySubmittalQuantities } from '@/lib/submittal-verification-service';
import { createVerificationAuditLog } from '@/lib/verification-audit-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEP_SUBMITTALS_VERIFY');

export async function POST(request: Request, props: { params: Promise<{ slug: string; id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project ID from slug
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Run verification
    const report = await verifySubmittalQuantities(params.id);

    // Log to audit trail
    try {
      await createVerificationAuditLog(
        project.id,
        session.user.id,
        session.user.username || session.user.email || 'Unknown',
        report,
        'SINGLE_SUBMITTAL',
        'manual'
      );
    } catch (auditError) {
      logger.error('[Audit Log Error]', auditError);
      // Don't fail the verification if audit logging fails
    }

    return NextResponse.json({ report });
  } catch (error) {
    logger.error('[Submittal Verify Error]', error);
    return NextResponse.json(
      { error: 'Failed to verify submittal' },
      { status: 500 }
    );
  }
}
