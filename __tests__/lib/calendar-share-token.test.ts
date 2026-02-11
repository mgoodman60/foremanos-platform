import { describe, it, expect, beforeEach, vi } from 'vitest';

// Set secret before imports
beforeEach(() => {
  process.env.NEXTAUTH_SECRET = 'test-secret-key-for-unit-tests-minimum-32-chars-long';
});

import { generateCalendarToken, verifyCalendarToken } from '@/lib/calendar-share-token';

describe('calendar-share-token', () => {
  describe('generateCalendarToken', () => {
    it('returns a string with payload.signature format', () => {
      const token = generateCalendarToken('proj-123', 'milestones');
      expect(token).toContain('.');
      const parts = token.split('.');
      expect(parts).toHaveLength(2);
      expect(parts[0].length).toBeGreaterThan(0);
      expect(parts[1].length).toBeGreaterThan(0);
    });

    it('generates URL-safe tokens (no +, /, = characters)', () => {
      // Generate several tokens to increase chance of catching unsafe chars
      for (let i = 0; i < 20; i++) {
        const token = generateCalendarToken(`project-${i}-with-long-id`, 'all', 365);
        expect(token).not.toMatch(/[+/=]/);
      }
    });

    it('generates different tokens for different inputs', () => {
      const token1 = generateCalendarToken('proj-1', 'milestones');
      const token2 = generateCalendarToken('proj-2', 'milestones');
      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyCalendarToken', () => {
    it('correctly verifies a valid token', () => {
      const token = generateCalendarToken('proj-123', 'schedule', 30);
      const result = verifyCalendarToken(token);
      expect(result.projectId).toBe('proj-123');
      expect(result.calendarType).toBe('schedule');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('throws on tampered payload', () => {
      const token = generateCalendarToken('proj-123', 'milestones');
      const [, signature] = token.split('.');
      // Replace payload with different content
      const tamperedPayload = Buffer.from('proj-999:milestones:9999999999').toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const tampered = `${tamperedPayload}.${signature}`;
      expect(() => verifyCalendarToken(tampered)).toThrow('Invalid or expired calendar token');
    });

    it('throws on tampered signature', () => {
      const token = generateCalendarToken('proj-123', 'milestones');
      const [payload] = token.split('.');
      const tampered = `${payload}.tampered_signature_here`;
      expect(() => verifyCalendarToken(tampered)).toThrow('Invalid or expired calendar token');
    });

    it('throws on expired token', () => {
      // Generate a token that expires immediately (0 days)
      // We need to manually create an expired token since expiresInDays=0 would still give current timestamp
      const originalNow = Date.now;
      // Mock Date.now to be in the past for generation, then restore for verification
      const pastTime = Date.now() - 86400 * 1000; // 1 day ago
      vi.spyOn(Date, 'now').mockReturnValueOnce(pastTime).mockReturnValueOnce(pastTime);
      const token = generateCalendarToken('proj-123', 'milestones', 0);
      vi.spyOn(Date, 'now').mockRestore();

      // Token was created in the past with 0 days expiry, so it should be expired now
      expect(() => verifyCalendarToken(token)).toThrow('Invalid or expired calendar token');
    });

    it('throws on empty token', () => {
      expect(() => verifyCalendarToken('')).toThrow('Invalid or expired calendar token');
    });

    it('throws on malformed token without separator', () => {
      expect(() => verifyCalendarToken('no-dot-separator')).toThrow('Invalid or expired calendar token');
    });

    it('throws on null/undefined input', () => {
      expect(() => verifyCalendarToken(null as unknown as string)).toThrow('Invalid or expired calendar token');
      expect(() => verifyCalendarToken(undefined as unknown as string)).toThrow('Invalid or expired calendar token');
    });

    it('throws when NEXTAUTH_SECRET is missing', () => {
      delete process.env.NEXTAUTH_SECRET;
      expect(() => generateCalendarToken('proj-123', 'milestones')).toThrow('NEXTAUTH_SECRET is not configured');
    });
  });
});
