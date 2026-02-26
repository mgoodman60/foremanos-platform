import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SUBCONTRACTORS');
// type TradeType = string; // Unused type removed

// PUT /api/projects/[slug]/subcontractors/[id] - Update a subcontractor
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ slug: string; id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user?.email }
    });

    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const { companyName, tradeType, contactName, contactPhone, contactEmail, isActive } = body;

    // Validate trade type if provided
    if (tradeType) {
      const validTrades = ["electrical", "plumbing", "mechanical", "structural", "concrete", "roofing", "flooring", "painting", "general"];
      if (!validTrades.includes(tradeType)) {
        return NextResponse.json(
          { error: 'Invalid trade type' },
          { status: 400 }
        );
      }
    }

    const subcontractor = await prisma.subcontractor.update({
      where: { id: params.id },
      data: {
        ...(companyName !== undefined && { companyName: companyName.trim() }),
        ...(tradeType !== undefined && { tradeType }),
        ...(contactName !== undefined && { contactName: contactName?.trim() || null }),
        ...(contactPhone !== undefined && { contactPhone: contactPhone?.trim() || null }),
        ...(contactEmail !== undefined && { contactEmail: contactEmail?.trim() || null }),
        ...(isActive !== undefined && { isActive })
      }
    });

    return NextResponse.json(subcontractor);
  } catch (error: unknown) {
    logger.error('Error', error);

    const errCode = error instanceof Object && 'code' in error ? (error as { code?: string }).code : undefined;
    if (errCode === 'P2002') {
      return NextResponse.json(
        { error: 'A subcontractor with this company name already exists in this project' },
        { status: 409 }
      );
    }

    if (errCode === 'P2025') {
      return NextResponse.json(
        { error: 'Subcontractor not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update subcontractor' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[slug]/subcontractors/[id] - Delete a subcontractor
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ slug: string; id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user?.email }
    });

    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    await prisma.subcontractor.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Error', error);

    const errCode = error instanceof Object && 'code' in error ? (error as { code?: string }).code : undefined;
    if (errCode === 'P2025') {
      return NextResponse.json(
        { error: 'Subcontractor not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete subcontractor' },
      { status: 500 }
    );
  }
}
