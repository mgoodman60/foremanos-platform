import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
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

    const invoices = await prisma.invoice.findMany({
      where: { projectId: project.id },
      include: {
        BudgetItem: {
          select: { name: true, costCode: true, tradeType: true }
        },
        Subcontractor: {
          select: { companyName: true, tradeType: true }
        }
      },
      orderBy: { invoiceDate: 'desc' }
    });

    type InvoiceRecord = typeof invoices[number];
    const summary = {
      total: invoices.length,
      pending: invoices.filter((inv: InvoiceRecord) => inv.status === 'PENDING').length,
      approved: invoices.filter((inv: InvoiceRecord) => inv.status === 'APPROVED').length,
      paid: invoices.filter((inv: InvoiceRecord) => inv.status === 'PAID').length,
      totalAmount: invoices.reduce((sum: number, inv: InvoiceRecord) => sum + inv.amount, 0),
      totalPaid: invoices
        .filter((inv: InvoiceRecord) => inv.status === 'PAID')
        .reduce((sum: number, inv: InvoiceRecord) => sum + inv.amount, 0),
      totalPending: invoices
        .filter((inv: InvoiceRecord) => inv.status === 'PENDING' || inv.status === 'APPROVED')
        .reduce((sum: number, inv: InvoiceRecord) => sum + inv.amount, 0)
    };

    return NextResponse.json({ invoices, summary });
  } catch (error) {
    console.error('[API] Error fetching invoices:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
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

    const body = await req.json();
    const {
      invoiceNumber, description, amount, laborAmount, materialsAmount,
      budgetItemId, subcontractorId, invoiceDate, dueDate, notes
    } = body;

    const invoice = await prisma.invoice.create({
      data: {
        projectId: project.id,
        invoiceNumber,
        description,
        amount: parseFloat(amount),
        laborAmount: laborAmount ? parseFloat(laborAmount) : 0,
        materialsAmount: materialsAmount ? parseFloat(materialsAmount) : 0,
        budgetItemId: budgetItemId || null,
        subcontractorId: subcontractorId || null,
        invoiceDate: new Date(invoiceDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        notes,
        submittedBy: session.user.username,
        status: 'PENDING'
      },
      include: {
        BudgetItem: {
          select: { name: true, costCode: true, tradeType: true }
        },
        Subcontractor: {
          select: { companyName: true, tradeType: true }
        }
      }
    });

    return NextResponse.json(invoice);
  } catch (error) {
    console.error('[API] Error creating invoice:', error);
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}
