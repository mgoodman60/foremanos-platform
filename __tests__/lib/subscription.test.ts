import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock } from '../mocks/shared-mocks';
import { createMockPrismaUser } from '../helpers/test-utils';

// Import the actual functions (mocks will intercept prisma calls)
import {
  checkQueryLimit,
  incrementQueryCount,
  checkProjectLimit,
  updateSubscriptionTier,
} from '@/lib/subscription';

describe('Subscription Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // checkQueryLimit Tests (5 tests)
  // ============================================
  describe('checkQueryLimit', () => {
    it('should return allowed:true when under limit', async () => {
      const user = createMockPrismaUser({
        subscriptionTier: 'pro',
        queriesUsedThisMonth: 10,
        queriesResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Future date
      });
      prismaMock.user.findUnique.mockResolvedValue(user);

      const result = await checkQueryLimit('user-1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(990); // 1000 - 10
      expect(result.limit).toBe(1000);
      expect(result.tier).toBe('pro');
    });

    it('should return allowed:false when at limit', async () => {
      const user = createMockPrismaUser({
        subscriptionTier: 'pro',
        queriesUsedThisMonth: 1000, // At limit
        queriesResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      prismaMock.user.findUnique.mockResolvedValue(user);

      const result = await checkQueryLimit('user-1');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should return allowed:true with remaining:-1 for unlimited tiers', async () => {
      const user = createMockPrismaUser({
        subscriptionTier: 'enterprise',
        queriesUsedThisMonth: 5000,
        queriesResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      prismaMock.user.findUnique.mockResolvedValue(user);

      const result = await checkQueryLimit('user-1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(-1);
      expect(result.limit).toBe(-1);
    });

    it('should reset counter at month boundary', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      const user = createMockPrismaUser({
        subscriptionTier: 'pro',
        queriesUsedThisMonth: 999, // Almost at limit
        queriesResetAt: pastDate, // Past reset date
      });
      prismaMock.user.findUnique.mockResolvedValue(user);
      prismaMock.user.update.mockResolvedValue(user);

      const result = await checkQueryLimit('user-1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1000); // Full limit after reset
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            queriesUsedThisMonth: 0,
          }),
        })
      );
    });

    it('should throw error when user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(checkQueryLimit('nonexistent-user')).rejects.toThrow('User not found');
    });
  });

  // ============================================
  // incrementQueryCount Tests (2 tests)
  // ============================================
  describe('incrementQueryCount', () => {
    it('should increment queriesUsedThisMonth by 1', async () => {
      const user = createMockPrismaUser({ queriesUsedThisMonth: 10 });
      prismaMock.user.update.mockResolvedValue({ ...user, queriesUsedThisMonth: 11 });

      await incrementQueryCount('user-1');

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          queriesUsedThisMonth: {
            increment: 1,
          },
        },
      });
    });

    it('should handle Prisma error gracefully', async () => {
      prismaMock.user.update.mockRejectedValue(new Error('Database error'));

      await expect(incrementQueryCount('user-1')).rejects.toThrow('Database error');
    });
  });

  // ============================================
  // checkProjectLimit Tests (3 tests)
  // ============================================
  describe('checkProjectLimit', () => {
    it('should return allowed:true when under project limit', async () => {
      const user = {
        ...createMockPrismaUser({ subscriptionTier: 'pro' }),
        Project_Project_ownerIdToUser: [{ id: 'proj-1' }, { id: 'proj-2' }], // 2 projects
      };
      prismaMock.user.findUnique.mockResolvedValue(user);

      const result = await checkProjectLimit('user-1');

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(2);
      expect(result.limit).toBe(10); // Pro tier limit
    });

    it('should return allowed:false when at project limit', async () => {
      const projects = Array.from({ length: 10 }, (_, i) => ({ id: `proj-${i}` }));
      const user = {
        ...createMockPrismaUser({ subscriptionTier: 'pro' }),
        Project_Project_ownerIdToUser: projects, // 10 projects (at limit)
      };
      prismaMock.user.findUnique.mockResolvedValue(user);

      const result = await checkProjectLimit('user-1');

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(10);
      expect(result.limit).toBe(10);
    });

    it('should return unlimited for enterprise tier', async () => {
      const projects = Array.from({ length: 50 }, (_, i) => ({ id: `proj-${i}` }));
      const user = {
        ...createMockPrismaUser({ subscriptionTier: 'enterprise' }),
        Project_Project_ownerIdToUser: projects,
      };
      prismaMock.user.findUnique.mockResolvedValue(user);

      const result = await checkProjectLimit('user-1');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
    });
  });

  // ============================================
  // updateSubscriptionTier Tests (2 tests)
  // ============================================
  describe('updateSubscriptionTier', () => {
    it('should update all subscription fields correctly', async () => {
      prismaMock.user.update.mockResolvedValue(createMockPrismaUser());

      await updateSubscriptionTier({
        userId: 'user-1',
        tier: 'team',
        stripeCustomerId: 'cus_new123',
        stripeSubscriptionId: 'sub_new123',
        stripePriceId: 'price_team_monthly',
        status: 'active',
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            subscriptionTier: 'team',
            subscriptionStatus: 'active',
            stripeCustomerId: 'cus_new123',
            stripeSubscriptionId: 'sub_new123',
            stripePriceId: 'price_team_monthly',
            queriesUsedThisMonth: 0,
          }),
        })
      );
    });

    it('should set correct reset date for next month', async () => {
      prismaMock.user.update.mockResolvedValue(createMockPrismaUser());

      await updateSubscriptionTier({
        userId: 'user-1',
        tier: 'pro',
      });

      const call = prismaMock.user.update.mock.calls[0][0];
      const data = call.data;

      // subscriptionEnd should be approximately 1 month from now
      const expectedEnd = new Date();
      expectedEnd.setMonth(expectedEnd.getMonth() + 1);

      const actualEnd = new Date(data.subscriptionEnd);
      const diffDays = Math.abs(actualEnd.getTime() - expectedEnd.getTime()) / (1000 * 60 * 60 * 24);

      // Allow for small time differences (within 1 day)
      expect(diffDays).toBeLessThan(1);
    });
  });

  // ============================================
  // Edge Cases
  // ============================================
  describe('Edge Cases', () => {
    it('should handle free tier limits correctly', async () => {
      const user = createMockPrismaUser({
        subscriptionTier: 'free',
        queriesUsedThisMonth: 49,
        queriesResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      prismaMock.user.findUnique.mockResolvedValue(user);

      const result = await checkQueryLimit('user-1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1); // 50 - 49
      expect(result.limit).toBe(50);
    });

    it('should handle exactly one query before limit', async () => {
      const user = createMockPrismaUser({
        subscriptionTier: 'pro',
        queriesUsedThisMonth: 999, // One before limit
        queriesResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      prismaMock.user.findUnique.mockResolvedValue(user);

      const result = await checkQueryLimit('user-1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });
  });
});
