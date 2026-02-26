import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/audit-log';
import { createLogger } from '@/lib/logger';

const logger = createLogger('USER_PREFERENCES');

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        preferences: true,
      },
    });

    return NextResponse.json({ preferences: user?.preferences || {} });
  } catch (error) {
    logger.error('Failed to fetch preferences', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const preferences = await request.json();

    // Update user preferences
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { preferences },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'user.preferences.update',
      resource: 'User',
      resourceId: session.user.id,
      details: { message: 'Updated user preferences' },
      request,
    });

    return NextResponse.json({
      success: true,
      preferences: user.preferences,
    });
  } catch (error) {
    logger.error('Failed to update preferences', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
