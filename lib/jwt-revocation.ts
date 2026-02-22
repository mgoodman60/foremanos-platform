import { getCached, setCached, deleteCached, isRedisAvailable } from './redis';
import { logger } from './logger';

const REVOCATION_PREFIX = 'jwt:revoked:';
const REVOCATION_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

/**
 * Revoke all sessions for a user by storing the current timestamp.
 * Any JWT issued before this timestamp will be considered revoked.
 */
export async function revokeUserSessions(userId: string): Promise<boolean> {
  if (!isRedisAvailable()) {
    logger.warn('JWT_REVOCATION', 'Redis unavailable, cannot revoke sessions', { userId });
    return false;
  }

  const key = `${REVOCATION_PREFIX}${userId}`;
  const timestamp = Math.floor(Date.now() / 1000);

  const success = await setCached(key, timestamp, REVOCATION_TTL);
  if (success) {
    logger.info('JWT_REVOCATION', 'Sessions revoked', { userId, revokedAt: timestamp });
  } else {
    logger.error('JWT_REVOCATION', 'Failed to revoke sessions', new Error('setCached returned false'), { userId });
  }
  return success;
}

/**
 * Check if a token was issued before the user's sessions were revoked.
 * Returns true if the token is revoked (should be rejected).
 */
export async function isTokenRevoked(userId: string, tokenIssuedAt: number): Promise<boolean> {
  if (!isRedisAvailable()) {
    // If Redis is down, allow tokens through (graceful degradation)
    return false;
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
 */
export async function clearRevocation(userId: string): Promise<boolean> {
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
