import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getSubscriptionInfo } from '@/lib/subscription';
import { prisma } from '@/lib/db';
import { safeErrorMessage } from '@/lib/api-error';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { createLogger } from '@/lib/logger';

const logger = createLogger('SUBSCRIPTION_INFO');

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const rateLimitResult = await checkRateLimit(`api:${session.user.email}`, RATE_LIMITS.API);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const subscriptionInfo = await getSubscriptionInfo(user.id);

    return NextResponse.json(subscriptionInfo);
  } catch (error: unknown) {
    logger.error('Failed to fetch subscription info', error);
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to fetch subscription info') },
      { status: 500 }
    );
  }
}
