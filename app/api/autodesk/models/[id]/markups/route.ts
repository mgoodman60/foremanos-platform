import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Retrieve markups for a model
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: modelId } = params;

    const model = await prisma.autodeskModel.findUnique({
      where: { id: modelId },
      select: { markups: true },
    });

    if (!model) {
      return NextResponse.json({ markups: [], svg: null });
    }

    const data = model.markups as any;
    return NextResponse.json({
      markups: data?.markups || [],
      svg: data?.svg || null,
      updatedAt: data?.updatedAt,
    });
  } catch (error) {
    console.error('[API] Get markups error:', error);
    return NextResponse.json({ error: 'Failed to get markups' }, { status: 500 });
  }
}

// POST - Save markups for a model
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: modelId } = params;
    const body = await request.json();
    const { markups, svg } = body;

    if (!Array.isArray(markups)) {
      return NextResponse.json({ error: 'Invalid markups data' }, { status: 400 });
    }

    // Verify model exists and update markups
    await prisma.autodeskModel.update({
      where: { id: modelId },
      data: {
        markups: {
          markups: markups.map((m: any) => ({
            ...m,
            createdBy: m.createdBy || session.user?.id,
          })),
          svg: svg || null,
          updatedAt: new Date().toISOString(),
          updatedBy: session.user.id,
        },
      },
    });

    return NextResponse.json({
      success: true,
      count: markups.length,
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }
    console.error('[API] Save markups error:', error);
    return NextResponse.json({ error: 'Failed to save markups' }, { status: 500 });
  }
}

// DELETE - Clear markups for a model
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: modelId } = params;

    await prisma.autodeskModel.update({
      where: { id: modelId },
      data: { markups: null },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }
    console.error('[API] Delete markups error:', error);
    return NextResponse.json({ error: 'Failed to delete markups' }, { status: 500 });
  }
}
