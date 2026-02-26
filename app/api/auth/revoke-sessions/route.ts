import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { revokeUserSessions } from '@/lib/jwt-revocation';
import { logger } from '@/lib/logger';

/**
 * POST /api/auth/revoke-sessions
 * Revokes all existing sessions for the authenticated user.
 * Use cases: password change, "log out everywhere", security concern.
 */
export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const success = await revokeUserSessions(session.user.id);

    if (!success) {
      logger.warn('REVOKE_SESSIONS', 'Revocation failed (Redis unavailable)', { userId: session.user.id });
      return NextResponse.json(
        { error: 'Session revocation unavailable. Please try again later.' },
        { status: 503 }
      );
    }

    logger.info('REVOKE_SESSIONS', 'All sessions revoked', { userId: session.user.id });

    return NextResponse.json({ message: 'All sessions have been revoked. Please sign in again.' });
  } catch (error) {
    logger.error('REVOKE_SESSIONS', 'Unexpected error', error as Error);
    return NextResponse.json(
      { error: 'Failed to revoke sessions' },
      { status: 500 }
    );
  }
}
