import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_INVOICES');

export async function PATCH(req: NextRequest, props: { params: Promise<{ slug: string; id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { status, approvedBy, notes } = body;

    const updateData: Record<string, unknown> = {};
    
    if (status) {
      updateData.status = status;
      if (status === 'APPROVED') {
        updateData.approvedBy = approvedBy || session.user.username;
      } else if (status === 'PAID') {
        updateData.paidDate = new Date();
      }
    }
    
    if (notes !== undefined) updateData.notes = notes;

    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data: updateData,
      include: {
        BudgetItem: {
          select: { name: true, costCode: true, tradeType: true }
        },
        Subcontractor: {
          select: { companyName: true, tradeType: true }
        }
      }
    });

    // If paid, update budget item's actual cost
    if (status === 'PAID' && invoice.budgetItemId) {
      const budgetItem = await prisma.budgetItem.findUnique({
        where: { id: invoice.budgetItemId }
      });
      if (budgetItem) {
        await prisma.budgetItem.update({
          where: { id: invoice.budgetItemId },
          data: {
            actualCost: budgetItem.actualCost + invoice.amount
          }
        });
      }
    }

    return NextResponse.json(invoice);
  } catch (error) {
    logger.error('Error updating invoice', error);
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  }
}
