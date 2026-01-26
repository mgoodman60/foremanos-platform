import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { generatePaymentApplication, getPaymentApplicationSummary } from '@/lib/cash-flow-service';

// GET /api/projects/[slug]/payment-apps
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
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
    console.error('[API] Payment apps error:', error);
    return NextResponse.json({ error: 'Failed to fetch payment applications' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/payment-apps - Generate new pay app
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
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
    console.error('[API] Generate pay app error:', error);
    return NextResponse.json({ error: 'Failed to generate payment application' }, { status: 500 });
  }
}
