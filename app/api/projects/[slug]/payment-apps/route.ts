import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generatePaymentApplication, getPaymentApplicationSummary } from '@/lib/cash-flow-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_PAYMENT_APPS');

// GET /api/projects/[slug]/payment-apps
export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const payApps = await prisma.paymentApplication.findMany({
      where: { projectId: project.id },
      include: {
        items: true,
        createdByUser: { select: { username: true } }
      },
      orderBy: { applicationNumber: 'desc' }
    });

    const summary = await getPaymentApplicationSummary(project.id);

    return NextResponse.json({ paymentApplications: payApps, summary });
  } catch (error) {
    logger.error('Payment apps error', error);
    return NextResponse.json({ error: 'Failed to fetch payment applications' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/payment-apps - Generate new pay app
export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await req.json();
    const { periodStart, periodEnd } = body;

    const payApp = await generatePaymentApplication(
      project.id,
      new Date(periodStart),
      new Date(periodEnd),
      session.user.id
    );

    return NextResponse.json(payApp);
  } catch (error) {
    logger.error('Generate pay app error', error);
    return NextResponse.json({ error: 'Failed to generate payment application' }, { status: 500 });
  }
}
