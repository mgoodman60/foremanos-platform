import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: { slug: string; id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { isRead, isDismissed } = body;

    const updateData: Record<string, unknown> = {};
    
    if (isRead !== undefined) {
      updateData.isRead = isRead;
      if (isRead) updateData.readAt = new Date();
    }
    
    if (isDismissed !== undefined) {
      updateData.isDismissed = isDismissed;
      if (isDismissed) updateData.dismissedAt = new Date();
    }

    const alert = await prisma.costAlert.update({
      where: { id: params.id },
      data: updateData
    });

    return NextResponse.json(alert);
  } catch (error) {
    console.error('[API] Error updating cost alert:', error);
    return NextResponse.json({ error: 'Failed to update cost alert' }, { status: 500 });
  }
}
