import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Stripe before importing
const mockCheckoutSessionsCreate = vi.fn();
const mockBillingPortalSessionsCreate = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();
const mockSubscriptionsUpdate = vi.fn();

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          create: mockCheckoutSessionsCreate,
        },
      },
      billingPortal: {
        sessions: {
          create: mockBillingPortalSessionsCreate,
        },
      },
      subscriptions: {
        retrieve: mockSubscriptionsRetrieve,
        update: mockSubscriptionsUpdate,
      },
      webhooks: {
        constructEvent: vi.fn(),
      },
      customers: {
        retrieve: vi.fn(),
      },
    })),
  };
});

// Set required environment variable
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';

import {
  createCheckoutSession,
  createPortalSession,
  getSubscription,
  cancelSubscription,
  reactivateSubscription,
  STRIPE_PRICE_IDS,
  SUBSCRIPTION_LIMITS,
  isModelAllowed,
  getEffectiveModel,
} from '@/lib/stripe';

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

describe('stripe module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createCheckoutSession', () => {
    it('should create a checkout session with correct parameters', async () => {
      const mockSession = {
        id: 'cs_test123',
        url: 'https://checkout.stripe.com/test',
      };
      mockCheckoutSessionsCreate.mockResolvedValue(mockSession);

      const result = await createCheckoutSession({
        userId: 'user-1',
        userEmail: 'test@example.com',
        priceId: 'price_pro_monthly',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      });

      expect(result).toEqual(mockSession);
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: 'price_pro_monthly',
            quantity: 1,
          },
        ],
        success_url: 'http://localhost:3000/success',
        cancel_url: 'http://localhost:3000/cancel',
        customer_email: 'test@example.com',
        client_reference_id: 'user-1',
        metadata: {
          userId: 'user-1',
        },
        subscription_data: {
          metadata: {
            userId: 'user-1',
          },
        },
        allow_promotion_codes: true,
      });
    });

    it('should throw error when checkout session creation fails', async () => {
      mockCheckoutSessionsCreate.mockRejectedValue(new Error('Stripe API error'));

      await expect(
        createCheckoutSession({
          userId: 'user-1',
          userEmail: 'test@example.com',
          priceId: 'price_pro_monthly',
          successUrl: 'http://localhost:3000/success',
          cancelUrl: 'http://localhost:3000/cancel',
        })
      ).rejects.toThrow('Stripe API error');

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle different price IDs', async () => {
      mockCheckoutSessionsCreate.mockResolvedValue({ id: 'cs_test' });

      await createCheckoutSession({
        userId: 'user-1',
        userEmail: 'test@example.com',
        priceId: 'price_enterprise_monthly',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      });

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            {
              price: 'price_enterprise_monthly',
              quantity: 1,
            },
          ],
        })
      );
    });

    it('should include userId in both metadata locations', async () => {
      mockCheckoutSessionsCreate.mockResolvedValue({ id: 'cs_test' });

      await createCheckoutSession({
        userId: 'user-123',
        userEmail: 'test@example.com',
        priceId: 'price_pro_monthly',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      });

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          client_reference_id: 'user-123',
          metadata: { userId: 'user-123' },
          subscription_data: {
            metadata: { userId: 'user-123' },
          },
        })
      );
    });
  });

  describe('createPortalSession', () => {
    it('should create a billing portal session', async () => {
      const mockSession = {
        id: 'bps_test123',
        url: 'https://billing.stripe.com/test',
      };
      mockBillingPortalSessionsCreate.mockResolvedValue(mockSession);

      const result = await createPortalSession({
        customerId: 'cus_test123',
        returnUrl: 'http://localhost:3000/dashboard',
      });

      expect(result).toEqual(mockSession);
      expect(mockBillingPortalSessionsCreate).toHaveBeenCalledWith({
        customer: 'cus_test123',
        return_url: 'http://localhost:3000/dashboard',
      });
    });

    it('should throw error when portal session creation fails', async () => {
      mockBillingPortalSessionsCreate.mockRejectedValue(new Error('Customer not found'));

      await expect(
        createPortalSession({
          customerId: 'invalid_customer',
          returnUrl: 'http://localhost:3000/dashboard',
        })
      ).rejects.toThrow('Customer not found');

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle different return URLs', async () => {
      mockBillingPortalSessionsCreate.mockResolvedValue({ id: 'bps_test' });

      await createPortalSession({
        customerId: 'cus_test123',
        returnUrl: 'http://localhost:3000/settings/billing',
      });

      expect(mockBillingPortalSessionsCreate).toHaveBeenCalledWith({
        customer: 'cus_test123',
        return_url: 'http://localhost:3000/settings/billing',
      });
    });
  });

  describe('getSubscription', () => {
    it('should retrieve subscription details', async () => {
      const mockSubscription = {
        id: 'sub_test123',
        status: 'active',
        current_period_end: 1735689600,
        cancel_at_period_end: false,
        items: {
          data: [
            {
              price: { id: 'price_pro_monthly' },
            },
          ],
        },
      };
      mockSubscriptionsRetrieve.mockResolvedValue(mockSubscription);

      const result = await getSubscription('sub_test123');

      expect(result).toEqual(mockSubscription);
      expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith('sub_test123');
    });

    it('should throw error when subscription not found', async () => {
      mockSubscriptionsRetrieve.mockRejectedValue(new Error('No such subscription'));

      await expect(getSubscription('sub_invalid')).rejects.toThrow(
        'No such subscription'
      );

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle canceled subscription', async () => {
      const mockSubscription = {
        id: 'sub_test123',
        status: 'canceled',
        canceled_at: 1735689600,
      };
      mockSubscriptionsRetrieve.mockResolvedValue(mockSubscription);

      const result = await getSubscription('sub_test123');

      expect(result.status).toBe('canceled');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription at period end', async () => {
      const mockSubscription = {
        id: 'sub_test123',
        status: 'active',
        cancel_at_period_end: true,
      };
      mockSubscriptionsUpdate.mockResolvedValue(mockSubscription);

      const result = await cancelSubscription('sub_test123');

      expect(result.cancel_at_period_end).toBe(true);
      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_test123', {
        cancel_at_period_end: true,
      });
    });

    it('should throw error when cancellation fails', async () => {
      mockSubscriptionsUpdate.mockRejectedValue(new Error('Subscription already canceled'));

      await expect(cancelSubscription('sub_test123')).rejects.toThrow(
        'Subscription already canceled'
      );

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle already pending cancellation', async () => {
      const mockSubscription = {
        id: 'sub_test123',
        status: 'active',
        cancel_at_period_end: true,
        cancel_at: 1735689600,
      };
      mockSubscriptionsUpdate.mockResolvedValue(mockSubscription);

      const result = await cancelSubscription('sub_test123');

      expect(result.cancel_at_period_end).toBe(true);
    });
  });

  describe('reactivateSubscription', () => {
    it('should reactivate a canceled subscription', async () => {
      const mockSubscription = {
        id: 'sub_test123',
        status: 'active',
        cancel_at_period_end: false,
      };
      mockSubscriptionsUpdate.mockResolvedValue(mockSubscription);

      const result = await reactivateSubscription('sub_test123');

      expect(result.cancel_at_period_end).toBe(false);
      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_test123', {
        cancel_at_period_end: false,
      });
    });

    it('should throw error when reactivation fails', async () => {
      mockSubscriptionsUpdate.mockRejectedValue(new Error('Subscription expired'));

      await expect(reactivateSubscription('sub_test123')).rejects.toThrow(
        'Subscription expired'
      );

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle already active subscription', async () => {
      const mockSubscription = {
        id: 'sub_test123',
        status: 'active',
        cancel_at_period_end: false,
      };
      mockSubscriptionsUpdate.mockResolvedValue(mockSubscription);

      const result = await reactivateSubscription('sub_test123');

      expect(result.status).toBe('active');
      expect(result.cancel_at_period_end).toBe(false);
    });
  });

  describe('STRIPE_PRICE_IDS', () => {
    it('should have starter monthly price ID', () => {
      expect(STRIPE_PRICE_IDS.starter_monthly).toBeDefined();
    });

    it('should have starter annual price ID', () => {
      expect(STRIPE_PRICE_IDS.starter_annual).toBeDefined();
    });

    it('should have pro monthly price ID', () => {
      expect(STRIPE_PRICE_IDS.pro_monthly).toBeDefined();
    });

    it('should have pro annual price ID', () => {
      expect(STRIPE_PRICE_IDS.pro_annual).toBeDefined();
    });

    it('should have team monthly price ID', () => {
      expect(STRIPE_PRICE_IDS.team_monthly).toBeDefined();
    });

    it('should have business monthly price ID', () => {
      expect(STRIPE_PRICE_IDS.business_monthly).toBeDefined();
    });

    it('should have enterprise monthly price ID', () => {
      expect(STRIPE_PRICE_IDS.enterprise_monthly).toBeDefined();
    });
  });

  describe('SUBSCRIPTION_LIMITS', () => {
    it('should define free tier limits', () => {
      expect(SUBSCRIPTION_LIMITS.free).toEqual({
        projects: 1,
        queriesPerMonth: 50,
        models: ['gpt-4o-mini'],
      });
    });

    it('should define starter tier limits', () => {
      expect(SUBSCRIPTION_LIMITS.starter.projects).toBe(5);
      expect(SUBSCRIPTION_LIMITS.starter.queriesPerMonth).toBe(500);
      expect(SUBSCRIPTION_LIMITS.starter.models).toContain('claude-sonnet-4-5-20250929');
    });

    it('should define pro tier with unlimited projects', () => {
      expect(SUBSCRIPTION_LIMITS.pro.projects).toBe(-1); // unlimited
      expect(SUBSCRIPTION_LIMITS.pro.queriesPerMonth).toBe(2000);
    });

    it('should define team tier with team members', () => {
      expect(SUBSCRIPTION_LIMITS.team.teamMembers).toBe(10);
      expect(SUBSCRIPTION_LIMITS.team.queriesPerMonth).toBe(10000);
    });

    it('should define business tier with more team members', () => {
      expect(SUBSCRIPTION_LIMITS.business.teamMembers).toBe(25);
      expect(SUBSCRIPTION_LIMITS.business.queriesPerMonth).toBe(25000);
    });

    it('should define enterprise tier with unlimited everything', () => {
      expect(SUBSCRIPTION_LIMITS.enterprise.projects).toBe(-1);
      expect(SUBSCRIPTION_LIMITS.enterprise.queriesPerMonth).toBe(-1);
      expect(SUBSCRIPTION_LIMITS.enterprise.teamMembers).toBe(-1);
    });

    it('should include claude-opus-4-6 in pro and higher tiers', () => {
      expect(SUBSCRIPTION_LIMITS.pro.models).toContain('claude-opus-4-6');
      expect(SUBSCRIPTION_LIMITS.team.models).toContain('claude-opus-4-6');
      expect(SUBSCRIPTION_LIMITS.business.models).toContain('claude-opus-4-6');
      expect(SUBSCRIPTION_LIMITS.enterprise.models).toContain('claude-opus-4-6');
    });

    it('should not include claude-opus-4-6 in free tier', () => {
      expect(SUBSCRIPTION_LIMITS.free.models).not.toContain('claude-opus-4-6');
    });
  });

  describe('isModelAllowed', () => {
    it('should allow gpt-4o-mini for free tier', () => {
      expect(isModelAllowed('free', 'gpt-4o-mini')).toBe(true);
    });

    it('should not allow claude-opus-4-6 for free tier', () => {
      expect(isModelAllowed('free', 'claude-opus-4-6')).toBe(false);
    });

    it('should allow claude-sonnet-4-5-20250929 for starter tier', () => {
      expect(isModelAllowed('starter', 'claude-sonnet-4-5-20250929')).toBe(true);
    });

    it('should allow claude-opus-4-6 for pro tier', () => {
      expect(isModelAllowed('pro', 'claude-opus-4-6')).toBe(true);
    });

    it('should allow gpt-5.2 for enterprise tier', () => {
      expect(isModelAllowed('enterprise', 'gpt-5.2')).toBe(true);
    });

    it('should resolve legacy model aliases', () => {
      expect(isModelAllowed('starter', 'claude-3-5-sonnet-20241022')).toBe(true);
    });
  });

  describe('getEffectiveModel', () => {
    it('should return requested model if allowed', () => {
      expect(getEffectiveModel('pro', 'claude-opus-4-6', 'complex')).toBe('claude-opus-4-6');
    });

    it('should downgrade to premium model for complex queries when requested model not allowed', () => {
      expect(getEffectiveModel('pro', 'some-unavailable-model', 'complex')).toBe('claude-opus-4-6');
    });

    it('should downgrade to simple model for free tier complex queries', () => {
      expect(getEffectiveModel('free', 'claude-opus-4-6', 'complex')).toBe('gpt-4o-mini');
    });

    it('should downgrade to default model for medium queries', () => {
      expect(getEffectiveModel('starter', 'claude-opus-4-6', 'medium')).toBe('claude-sonnet-4-5-20250929');
    });

    it('should use simple model for simple queries on free tier', () => {
      expect(getEffectiveModel('free', 'gpt-4o-mini', 'simple')).toBe('gpt-4o-mini');
    });

    it('should resolve model aliases before checking', () => {
      expect(getEffectiveModel('starter', 'claude-3-5-sonnet-20241022', 'medium')).toBe('claude-sonnet-4-5-20250929');
    });
  });
});
