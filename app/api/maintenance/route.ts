import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const maintenance = await prisma.maintenanceMode.findUnique({
      where: { id: 'singleton' },
    });

    return NextResponse.json({
      isActive: maintenance?.isActive || false,
      message: maintenance?.message || 'Updating documents... Please check back in a few minutes',
    });
  } catch (error) {
    console.error('Error checking maintenance mode:', error);
    return NextResponse.json(
      { isActive: false },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { isActive, message } = body;

    const maintenance = await prisma.maintenanceMode.upsert({
      where: { id: 'singleton' },
      update: {
        isActive: isActive ?? false,
        message: message || 'Updating documents... Please check back in a few minutes',
        activatedAt: isActive ? new Date() : null,
      },
      create: {
        id: 'singleton',
        isActive: isActive ?? false,
        message: message || 'Updating documents... Please check back in a few minutes',
        activatedAt: isActive ? new Date() : null,
      },
    });

    return NextResponse.json(maintenance);
  } catch (error) {
    console.error('Error updating maintenance mode:', error);
    return NextResponse.json(
      { error: 'Failed to update maintenance mode' },
      { status: 500 }
    );
  }
}
