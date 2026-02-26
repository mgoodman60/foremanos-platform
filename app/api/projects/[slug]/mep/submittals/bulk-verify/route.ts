/**
 * Bulk Submittal Verification API
 * POST: Verify all submittals in a project at once
 */

import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifySubmittalQuantities, SubmittalVerificationReport } from '@/lib/submittal-verification-service';
import { createBulkVerificationAuditLog } from '@/lib/verification-audit-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEP_SUBMITTALS_BULK_VERIFY');

export async function POST(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get all submittals with line items
    const submittals = await prisma.mEPSubmittal.findMany({
      where: { 
        projectId: project.id,
        status: { not: 'VOID' }
      },
      include: {
        lineItems: true
      }
    });

    // Filter to submittals that have line items
    const submittalsWithItems = submittals.filter(s => s.lineItems.length > 0);

    if (submittalsWithItems.length === 0) {
      return NextResponse.json({
        error: 'No submittals with line items found',
        message: 'Add line items to submittals before running verification'
      }, { status: 400 });
    }

    // Run verification on each submittal
    const reports: SubmittalVerificationReport[] = [];
    const errors: { submittalId: string; error: string }[] = [];

    for (const submittal of submittalsWithItems) {
      try {
        const report = await verifySubmittalQuantities(submittal.id);
        reports.push(report);
      } catch (error) {
        errors.push({
          submittalId: submittal.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Calculate aggregate summary
    const summary = {
      totalSubmittals: submittals.length,
      verifiedSubmittals: reports.length,
      failedSubmittals: errors.length,
      totalLineItems: reports.reduce((acc, r) => acc + r.totalLineItems, 0),
      sufficientItems: reports.reduce((acc, r) => acc + r.sufficientCount, 0),
      insufficientItems: reports.reduce((acc, r) => acc + r.insufficientCount, 0),
      excessItems: reports.reduce((acc, r) => acc + r.excessCount, 0),
      noRequirementItems: reports.reduce((acc, r) => acc + r.noRequirementCount, 0),
      passCount: reports.filter(r => r.overallStatus === 'PASS').length,
      failCount: reports.filter(r => r.overallStatus === 'FAIL').length,
      reviewCount: reports.filter(r => r.overallStatus === 'REVIEW_NEEDED').length
    };

    // Log to audit trail
    try {
      await createBulkVerificationAuditLog(
        project.id,
        session.user.id,
        session.user.username || session.user.email || 'Unknown',
        reports,
        'manual'
      );
    } catch (auditError) {
      logger.error('[Bulk Audit Log Error]', auditError);
    }

    return NextResponse.json({
      summary,
      reports: reports.map(r => ({
        submittalId: r.submittalId,
        submittalNumber: r.submittalNumber,
        overallStatus: r.overallStatus,
        totalLineItems: r.totalLineItems,
        sufficientCount: r.sufficientCount,
        insufficientCount: r.insufficientCount,
        excessCount: r.excessCount,
        criticalShortages: r.criticalShortages
      })),
      errors
    });
  } catch (error) {
    logger.error('[Bulk Verify Error]', error);
    return NextResponse.json(
      { error: 'Failed to run bulk verification' },
      { status: 500 }
    );
  }
}

// GET: Get bulk verification status / summary
export async function GET(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get all submittals with line item compliance breakdown
    const submittals = await prisma.mEPSubmittal.findMany({
      where: { projectId: project.id },
      include: {
        lineItems: {
          select: {
            id: true,
            complianceStatus: true
          }
        }
      }
    });

    // Build summary for each submittal
    const submittalSummaries = submittals.map(s => {
      const counts = s.lineItems.reduce((acc, item) => {
        acc[item.complianceStatus] = (acc[item.complianceStatus] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      let status: 'NOT_VERIFIED' | 'PASS' | 'FAIL' | 'REVIEW_NEEDED' = 'NOT_VERIFIED';
      if (s.lineItems.length > 0) {
        const hasInsufficient = (counts['INSUFFICIENT'] || 0) > 0;
        const hasExcess = (counts['EXCESS'] || 0) > 0;
        const hasUnverified = (counts['UNVERIFIED'] || 0) > 0;
        
        if (hasInsufficient) {
          status = 'FAIL';
        } else if (hasExcess || hasUnverified) {
          status = 'REVIEW_NEEDED';
        } else {
          status = 'PASS';
        }
      }

      return {
        id: s.id,
        submittalNumber: s.submittalNumber,
        title: s.title,
        status: s.status,
        submittalType: s.submittalType,
        verificationStatus: status,
        lineItemCount: s.lineItems.length,
        sufficient: counts['SUFFICIENT'] || 0,
        insufficient: counts['INSUFFICIENT'] || 0,
        excess: counts['EXCESS'] || 0,
        unverified: counts['UNVERIFIED'] || 0,
        noRequirement: counts['NO_REQUIREMENT'] || 0
      };
    });

    // Aggregate project-level summary
    const projectSummary = {
      totalSubmittals: submittals.length,
      withLineItems: submittals.filter(s => s.lineItems.length > 0).length,
      passCount: submittalSummaries.filter(s => s.verificationStatus === 'PASS').length,
      failCount: submittalSummaries.filter(s => s.verificationStatus === 'FAIL').length,
      reviewCount: submittalSummaries.filter(s => s.verificationStatus === 'REVIEW_NEEDED').length,
      notVerifiedCount: submittalSummaries.filter(s => s.verificationStatus === 'NOT_VERIFIED').length,
      totalLineItems: submittals.reduce((acc, s) => acc + s.lineItems.length, 0)
    };

    return NextResponse.json({
      projectSummary,
      submittals: submittalSummaries
    });
  } catch (error) {
    logger.error('[Bulk Verify GET Error]', error);
    return NextResponse.json(
      { error: 'Failed to get verification summary' },
      { status: 500 }
    );
  }
}
