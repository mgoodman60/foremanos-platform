import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_COST_ALERTS');

export async function PATCH(req: NextRequest, props: { params: Promise<{ slug: string; id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
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
    logger.error('Error updating cost alert', error);
    return NextResponse.json({ error: 'Failed to update cost alert' }, { status: 500 });
  }
}
