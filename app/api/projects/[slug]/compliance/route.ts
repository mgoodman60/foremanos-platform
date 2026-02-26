/**
 * Spec Compliance API
 * Handles compliance checking for submittals and materials
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  runComplianceCheckAndStore,
  getProjectComplianceChecks,
  getProjectComplianceSummary,
} from '@/lib/spec-compliance-checker';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_COMPLIANCE');

/**
 * GET /api/projects/[slug]/compliance
 * Get compliance checks and summary
 */
export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const status = searchParams.get('status') || undefined;
    const specSection = searchParams.get('specSection') || undefined;
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!)
      : 50;

    if (action === 'summary') {
      const summary = await getProjectComplianceSummary(project.id);
      return NextResponse.json({ success: true, summary });
    }

    const checks = await getProjectComplianceChecks(project.id, {
      status,
      specSection,
      limit,
    });

    return NextResponse.json({
      success: true,
      checks,
      total: checks.length,
    });
  } catch (error) {
    logger.error('GET error', error);
    return NextResponse.json(
      { error: 'Failed to fetch compliance data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[slug]/compliance
 * Run a new compliance check
 */
export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      itemType,
      itemDescription,
      manufacturer,
      model,
      specifications,
      productData,
      submittalId,
      documentId,
      specSection,
      specParagraph,
    } = body;

    if (!itemType || !itemDescription || !specSection) {
      return NextResponse.json(
        { error: 'Missing required fields: itemType, itemDescription, specSection' },
        { status: 400 }
      );
    }

    const { checkId, result } = await runComplianceCheckAndStore(
      project.id,
      {
        itemType,
        itemDescription,
        manufacturer,
        model,
        specifications,
        productData,
        submittalId,
        documentId,
      },
      specSection,
      specParagraph
    );

    return NextResponse.json({
      success: true,
      checkId,
      result,
    });
  } catch (error) {
    logger.error('POST error', error);
    return NextResponse.json(
      { error: 'Failed to run compliance check' },
      { status: 500 }
    );
  }
}
