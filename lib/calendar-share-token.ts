/**
 * Calendar Share Token
 * HMAC-SHA256 signed tokens for public calendar feed access.
 * Uses NEXTAUTH_SECRET as the signing key.
 */

import crypto from 'crypto';
import { logger } from '@/lib/logger';

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not configured');
  }
  return secret;
}

function toUrlSafeBase64(buffer: Buffer): string {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromUrlSafeBase64(str: string): Buffer {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (base64.length % 4)) % 4;
  base64 += '='.repeat(padLength);
  return Buffer.from(base64, 'base64');
}

function sign(payload: string): string {
  const hmac = crypto.createHmac('sha256', getSecret());
  hmac.update(payload);
  return toUrlSafeBase64(hmac.digest());
}

/**
 * Generate a signed calendar share token.
 * Token format: base64url(payload).base64url(signature)
 */
export function generateCalendarToken(
  projectId: string,
  calendarType: string,
  expiresInDays: number = 365
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInDays * 86400;
  const payload = `${projectId}:${calendarType}:${expiresAt}`;
  const encodedPayload = toUrlSafeBase64(Buffer.from(payload, 'utf-8'));
  const signature = sign(payload);
  return `${encodedPayload}.${signature}`;
}

/**
 * Verify a calendar share token and return its payload.
 * Throws if invalid or expired.
 */
export function verifyCalendarToken(token: string): {
  projectId: string;
  calendarType: string;
  expiresAt: Date;
} {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid or expired calendar token');
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid or expired calendar token');
  }

  const [encodedPayload, providedSignature] = parts;

  let payload: string;
  try {
    payload = fromUrlSafeBase64(encodedPayload).toString('utf-8');
  } catch {
    throw new Error('Invalid or expired calendar token');
  }

  // Verify signature with timing-safe comparison
  const expectedSignature = sign(payload);
  const sigBuffer = fromUrlSafeBase64(providedSignature);
  const expectedSigBuffer = fromUrlSafeBase64(expectedSignature);

  if (sigBuffer.length !== expectedSigBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)) {
    logger.warn('CALENDAR_TOKEN', 'Invalid token signature');
    throw new Error('Invalid or expired calendar token');
  }

  // Parse payload
  const segments = payload.split(':');
  if (segments.length !== 3) {
    throw new Error('Invalid or expired calendar token');
  }

  const [projectId, calendarType, expiresAtStr] = segments;
  const expiresAtUnix = parseInt(expiresAtStr, 10);

  if (isNaN(expiresAtUnix)) {
    throw new Error('Invalid or expired calendar token');
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (now >= expiresAtUnix) {
    logger.warn('CALENDAR_TOKEN', 'Expired token used', { projectId, expiresAt: expiresAtUnix });
    throw new Error('Invalid or expired calendar token');
  }

  return {
    projectId,
    calendarType,
    expiresAt: new Date(expiresAtUnix * 1000),
  };
}
