import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { reviewPaymentApplication } from '@/lib/cash-flow-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_PAYMENT_APPS');

// GET /api/projects/[slug]/payment-apps/[id]
export async function GET(req: NextRequest, props: { params: Promise<{ slug: string; id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payApp = await prisma.paymentApplication.findUnique({
      where: { id: params.id },
      include: {
        items: {
          include: {
            budgetItem: true
          }
        },
        createdByUser: { select: { username: true } },
        budget: true
      }
    });

    if (!payApp) {
      return NextResponse.json({ error: 'Payment application not found' }, { status: 404 });
    }

    return NextResponse.json(payApp);
  } catch (error) {
    logger.error('Get pay app error', error);
    return NextResponse.json({ error: 'Failed to fetch payment application' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/payment-apps/[id] - Update or review
export async function PATCH(req: NextRequest, props: { params: Promise<{ slug: string; id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, reason, status, items } = body;

    // Handle review actions
    if (action && ['approve', 'reject', 'request_revision'].includes(action)) {
      const payApp = await reviewPaymentApplication(
        params.id,
        action as 'approve' | 'reject' | 'request_revision',
        session.user.id,
        reason
      );
      return NextResponse.json(payApp);
    }

    // Handle status updates
    if (status) {
      const payApp = await prisma.paymentApplication.update({
        where: { id: params.id },
        data: {
          status,
          ...(status === 'SUBMITTED' && { submittedAt: new Date() }),
          ...(status === 'PAID' && { paidAt: new Date() })
        }
      });
      return NextResponse.json(payApp);
    }

    // Handle line item updates
    if (items && Array.isArray(items)) {
      for (const item of items) {
        await prisma.paymentApplicationItem.update({
          where: { id: item.id },
          data: {
            thisApplication: item.thisApplication,
            materialsStored: item.materialsStored,
            percentComplete: item.percentComplete
          }
        });
      }

      // Recalculate totals
      const updatedItems = await prisma.paymentApplicationItem.findMany({
        where: { paymentAppId: params.id }
      });

      const currentPeriod = updatedItems.reduce((sum: number, i: any) => sum + i.thisApplication, 0);
      const totalCompleted = updatedItems.reduce((sum: number, i: any) => sum + i.totalCompleted, 0);

      const payApp = await prisma.paymentApplication.update({
        where: { id: params.id },
        data: {
          currentPeriod,
          totalCompleted
        },
        include: { items: true }
      });

      return NextResponse.json(payApp);
    }

    return NextResponse.json({ error: 'Invalid update parameters' }, { status: 400 });
  } catch (error) {
    logger.error('Update pay app error', error);
    return NextResponse.json({ error: 'Failed to update payment application' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/payment-apps/[id]
export async function DELETE(req: NextRequest, props: { params: Promise<{ slug: string; id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow deletion of draft pay apps
    const payApp = await prisma.paymentApplication.findUnique({
      where: { id: params.id }
    });

    if (!payApp) {
      return NextResponse.json({ error: 'Payment application not found' }, { status: 404 });
    }

    if (payApp.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only draft payment applications can be deleted' },
        { status: 400 }
      );
    }

    await prisma.paymentApplication.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Delete pay app error', error);
    return NextResponse.json({ error: 'Failed to delete payment application' }, { status: 500 });
  }
}
