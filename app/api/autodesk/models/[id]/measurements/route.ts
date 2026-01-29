import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Retrieve measurements for a model
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
      select: { measurements: true },
    });

    if (!model) {
      return NextResponse.json({ measurements: [] });
    }

    const data = model.measurements as any;
    return NextResponse.json({ measurements: data?.measurements || [] });
  } catch (error) {
    console.error('[API] Get measurements error:', error);
    return NextResponse.json({ error: 'Failed to get measurements' }, { status: 500 });
  }
}

// POST - Save measurements for a model
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
    const { measurements } = body;

    if (!Array.isArray(measurements)) {
      return NextResponse.json({ error: 'Invalid measurements data' }, { status: 400 });
    }

    // Verify model exists and update measurements
    const model = await prisma.autodeskModel.update({
      where: { id: modelId },
      data: {
        measurements: {
          measurements,
          updatedAt: new Date().toISOString(),
          updatedBy: session.user.id,
        },
      },
    });

    return NextResponse.json({
      success: true,
      count: measurements.length,
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }
    console.error('[API] Save measurements error:', error);
    return NextResponse.json({ error: 'Failed to save measurements' }, { status: 500 });
  }
}
