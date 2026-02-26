import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEP_SUBMITTALS_SHORTAGES');

/**
 * GET: Fetch all shortages across project submittals
 */
export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
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

    // Find all line items with INSUFFICIENT status
    const insufficientItems = await prisma.submittalLineItem.findMany({
      where: {
        submittal: { projectId: project.id },
        complianceStatus: 'INSUFFICIENT'
      },
      include: {
        submittal: {
          select: {
            id: true,
            submittalNumber: true,
            title: true
          }
        }
      },
      orderBy: [
        { variancePercent: 'asc' }, // Most negative first (worst shortages)
        { updatedAt: 'desc' }
      ]
    });

    // Transform into shortage alerts with severity
    const shortages = insufficientItems.map(item => {
      const variancePercent = item.variancePercent || 0;
      const variance = item.varianceQty || 0;

      // Determine severity based on variance percentage
      let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
      if (variancePercent <= -50) {
        severity = 'CRITICAL'; // Missing more than 50%
      } else if (variancePercent <= -25) {
        severity = 'HIGH'; // Missing 25-50%
      } else {
        severity = 'MEDIUM'; // Missing less than 25%
      }

      return {
        lineItemId: item.id,
        productName: item.productName,
        submittalId: item.submittal.id,
        submittalNumber: item.submittal.submittalNumber,
        submitted: item.submittedQty,
        required: item.requiredQty || 0,
        variance: variance,
        variancePercent: variancePercent,
        unit: item.unit,
        tradeCategory: item.tradeCategory,
        severity
      };
    });

    // Sort by severity (CRITICAL first)
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
    shortages.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return NextResponse.json({
      shortages,
      summary: {
        total: shortages.length,
        critical: shortages.filter(s => s.severity === 'CRITICAL').length,
        high: shortages.filter(s => s.severity === 'HIGH').length,
        medium: shortages.filter(s => s.severity === 'MEDIUM').length
      }
    });
  } catch (error) {
    logger.error('[Shortages GET] Error', error);
    return NextResponse.json({ error: 'Failed to fetch shortages' }, { status: 500 });
  }
}
