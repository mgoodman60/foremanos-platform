import { getCached, setCached, deleteCached, isRedisAvailable } from './redis';
import { logger } from './logger';
import { prisma } from './db';

const REVOCATION_PREFIX = 'jwt:revoked:';
const REVOCATION_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

/**
 * Revoke all sessions for a user by storing the current timestamp.
 * Any JWT issued before this timestamp will be considered revoked.
 * Writes to both Redis (primary) and database (fallback).
 */
export async function revokeUserSessions(userId: string): Promise<boolean> {
  let redisSuccess = false;

  if (isRedisAvailable()) {
    const key = `${REVOCATION_PREFIX}${userId}`;
    const timestamp = Math.floor(Date.now() / 1000);

    redisSuccess = await setCached(key, timestamp, REVOCATION_TTL);
    if (redisSuccess) {
      logger.info('JWT_REVOCATION', 'Sessions revoked via Redis', { userId, revokedAt: timestamp });
    } else {
      logger.error('JWT_REVOCATION', 'Failed to revoke sessions via Redis', new Error('setCached returned false'), { userId });
    }
  } else {
    logger.warn('JWT_REVOCATION', 'Redis unavailable, using DB fallback only', { userId });
  }

  // DB fallback: always write to database regardless of Redis
  await prisma.user.update({
    where: { id: userId },
    data: { sessionsRevokedAt: new Date() },
  }).catch((error: unknown) => {
    logger.error('JWT_REVOCATION', 'DB fallback write failed', error as Error, { userId });
  });

  return redisSuccess;
}

/**
 * Check if a token was issued before the user's sessions were revoked.
 * Returns true if the token is revoked (should be rejected).
 * Falls back to database check when Redis is unavailable.
 */
export async function isTokenRevoked(userId: string, tokenIssuedAt: number): Promise<boolean> {
  if (!isRedisAvailable()) {
    // DB fallback: check sessionsRevokedAt
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { sessionsRevokedAt: true },
      });
      if (!user?.sessionsRevokedAt) return false;
      return tokenIssuedAt < Math.floor(user.sessionsRevokedAt.getTime() / 1000);
    } catch {
      return false; // Graceful degradation
    }
  }

  const key = `${REVOCATION_PREFIX}${userId}`;
  const revokedAt = await getCached<number>(key);

  if (revokedAt === null) {
    return false;
  }

  return tokenIssuedAt < revokedAt;
}

/**
 * Clear the revocation for a user (e.g., admin override).
 * Clears both Redis and database records.
 */
export async function clearRevocation(userId: string): Promise<boolean> {
  // Clear DB record regardless of Redis availability
  await prisma.user.update({
    where: { id: userId },
    data: { sessionsRevokedAt: null },
  }).catch((error: unknown) => {
    logger.error('JWT_REVOCATION', 'DB fallback clear failed', error as Error, { userId });
  });

  if (!isRedisAvailable()) {
    return false;
  }

  const key = `${REVOCATION_PREFIX}${userId}`;
  const success = await deleteCached(key);
  if (success) {
    logger.info('JWT_REVOCATION', 'Revocation cleared', { userId });
  }
  return success;
}
